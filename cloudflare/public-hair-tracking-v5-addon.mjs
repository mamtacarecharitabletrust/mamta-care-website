/* Mamta Care Public Hair Donation Tracking (Cloudflare).
 *
 * V5 additive release:
 * - Exact registration ID + last four phone digits + Turnstile to prevent
 *   exposing donor status via sequential/guessable public registration IDs.
 * - Reads only the existing D1 donor/courier/receipt/custody records.
 * - No donor names, full phones, addresses, AWBs, health data or staff IDs
 *   returned to the public. No mutation to existing donor or certificate flow.
 * - Legacy historical Google Apps Script remains available as a link from UI.
 */
const MCCT_TRACK_V5_PREV_FETCH=launch_wig_maker_portal_worker_default.fetch;
const MCCT_TRACK_V5_PREV_SCHEDULED=launch_wig_maker_portal_worker_default.scheduled;
const MCCT_TRACK_V5_REG=/^[A-Za-z0-9][A-Za-z0-9/_-]{5,74}$/;
function mcctTrackV5Out(data,status=200){
 return new Response(JSON.stringify(data),{status,headers:{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store","X-Content-Type-Options":"nosniff","Referrer-Policy":"no-referrer"}});
}
function mcctTrackV5Err(message,status=400){
 return mcctTrackV5Out({ok:false,error:message},status);
}
function mcctTrackV5Page(env){
 const key=String(env.TURNSTILE_SITE_KEY||"").trim();
 if(!/^0x[A-Za-z0-9_-]{12,90}$/.test(key))return mcctTrackV5Err("Tracking verification is temporarily unavailable. Please use the historical tracking page.",503);
 return mcctWigV3SecureHTML(MCCT_TRACK_V5_HTML,true,key);
}
async function mcctTrackV5Lookup(req,env){
 if(req.method!=="POST")return mcctTrackV5Err("Method not allowed",405);
 if(req.headers.get("Origin")!==new URL(req.url).origin||
    req.headers.get("X-Mamta-Public")!=="1"||
    !/^application\/json(?:;|$)/i.test(req.headers.get("Content-Type")||""))return mcctTrackV5Err("Request verification failed",403);
 let input;try{input=await mcctWigV3Body(req)}catch{return mcctTrackV5Err("Invalid request")}
 const reg=String(input.registration_id||"").trim().toUpperCase(),
       last4=String(input.phone_last4||"").trim(),
       token=String(input.cf_turnstile_response||"");
 if(!MCCT_TRACK_V5_REG.test(reg)||!/^\d{4}$/.test(last4))return mcctTrackV5Err("Enter your official registration ID and last four mobile digits.");
 if(!(await mcctWigV3Verify(req,env,token)))return mcctTrackV5Err("Complete the security challenge and try again.",403);
 const ts=Math.floor(Date.now()/1000),hour=Math.floor(ts/3600);
 const ip=req.headers.get("CF-Connecting-IP")||"anonymous";
 let hashed;
 try{hashed=await mcctWigV3Hash(env,"mcct:tracking:v5:"+hour+":"+ip)}catch{return mcctTrackV5Err("Verification temporarily unavailable",503)}
 try{
  const cap=await env.DB.prepare(
   "INSERT INTO mcct_public_tracking_rate(bucket,hour_utc,attempts,updated_at) VALUES(?,?,1,?) "+
   "ON CONFLICT(bucket) DO UPDATE SET attempts=attempts+1,updated_at=excluded.updated_at WHERE attempts<20")
   .bind(hashed,hour,ts).run();
  if((cap.meta?.changes||0)!==1)return mcctTrackV5Err("Too many tracking lookups. Try again later.",429);
  const donors=await env.DB.prepare(
   "SELECT d.id,d.registration_id,d.phone,d.followup_status,d.verification_status,d.certificate_url,d.updated_at, "+
   "CASE WHEN b.donor_id IS NULL THEN 0 ELSE 1 END AS binned "+
   "FROM donors d LEFT JOIN mc_donor_recycle b ON b.donor_id=d.id "+
   "WHERE UPPER(TRIM(d.registration_id))=? LIMIT 2").bind(reg).all();
  const found=donors.results||[];
  // Identical failure for mismatched registration/phone and absent records.
  if(found.length!==1||String(found[0].phone||"").replace(/\D/g,"").slice(-4)!==last4)
    return mcctTrackV5Err("No matching record was verified. Check the details, or use the historical tracking link.",404);
  const d=found[0];
  if(d.binned)return mcctTrackV5Out({ok:true,registration_id:d.registration_id,application_status:"Archived",phase:"closed",phase_label:"Please contact Mamta Care for information about this registration.",verified:false,updated_at:d.updated_at||null,source:"donor_desk"});
  const queries=[
   env.DB.prepare("SELECT carrier,status,updated_at FROM mcq_donor_couriers WHERE donor_id=? LIMIT 1").bind(d.id).first(),
   env.DB.prepare("SELECT received_at,received_location FROM mcct_parcel_receipts WHERE donor_id=? LIMIT 1").bind(d.id).first(),
   env.DB.prepare("SELECT status,received_at,collected_at FROM mcct_hand_collections WHERE donor_id=? LIMIT 1").bind(d.id).first(),
   env.DB.prepare("SELECT status,received_at,collected_at FROM mcct_staff_hand_collections WHERE donor_id=? LIMIT 1").bind(d.id).first(),
   env.DB.prepare("SELECT MAX(CASE WHEN stage='consumed' THEN 1 ELSE 0 END) consumed,MAX(CASE WHEN stage='at_fabricator' THEN 1 ELSE 0 END) at_fabricator,MAX(CASE WHEN stage='in_transit' THEN 1 ELSE 0 END) in_transit,MAX(updated_at) last_movement FROM mcct_ops_hair_lots WHERE donor_id=?").bind(d.id).first()
  ];
  const [courier,parcel,hand,staffHand,inventory]=await Promise.all(queries);
  let phase="registered",phaseLabel="Application registered. Awaiting the next donation update.",hint="";
  const verified=String(d.verification_status||"").toUpperCase()==="VERIFIED";
  const followup=String(d.followup_status||"");
  if(["Cancelled","Expired"].includes(followup)){
   phase="closed";phaseLabel=followup==="Expired"?"Application expired; contact Mamta Care to reopen it.":"Application cancelled; contact Mamta Care if you wish to re-register.";
  }else if(verified){
   phase="verified";phaseLabel="Hair donation verified by Mamta Care.";
   hint="Verification does not necessarily mean a completed wig has already been delivered.";
  }else if(Number(inventory?.consumed||0)>0){
   phase="fabrication";phaseLabel="Hair allocated to the wig-making process.";
   hint="Hair allocation is not confirmation that a wig is completed.";
  }else if(Number(inventory?.at_fabricator||0)>0){
   phase="fabrication";phaseLabel="Hair recorded at the fabrication centre.";
  }else if(parcel?.received_at||hand?.status==="received_at_center"||staffHand?.status==="received_at_center"){
   phase="received";phaseLabel="Hair received by Mamta Care at a collection or fabrication centre.";
  }else if(inventory?.in_transit||hand?.status==="in_transit"||staffHand?.status==="in_transit"||
    /^(in[_ -]?transit|dispatched|shipped)$/i.test(String(courier?.status||""))){
   phase="transit";phaseLabel="Hair recorded in transit.";
  }else if(hand?.status==="collected"||staffHand?.status==="collected"){
   phase="collected";phaseLabel="Hair collected by a Mamta Care representative.";
  }else if(courier){
   phase="courier";phaseLabel="Courier details recorded; awaiting confirmed delivery.";
  }else if(followup==="Completed"){
   phase="followup";phaseLabel="Donor follow-up marked completed. Hair receipt or verification is not yet confirmed.";
  }
  return mcctTrackV5Out({
    ok:true,registration_id:d.registration_id,
    application_status:followup||"Pending",phase,phase_label:phaseLabel,hint,
    verified,updated_at:Math.max(Number(d.updated_at||0),Number(courier?.updated_at||0),Number(parcel?.received_at||0),Number(hand?.received_at||0),Number(staffHand?.received_at||0),Number(inventory?.last_movement||0))||null,
    source:"donor_desk",historical_records_available_separately:true
  });
 }catch(e){
  console.error("MCCT_PUBLIC_TRACK_V5",String(e?.name||"Error"));
  return mcctTrackV5Err("Tracking temporarily unavailable; please use the historical tracker.",503);
 }
}
async function mcctTrackV5Prune(env){
 if(!env.DB)return;
 const ts=Math.floor(Date.now()/1000),hour=Math.floor(ts/3600);
 const marker=await env.DB.prepare("INSERT INTO mcct_ops_run_state(task,last_run_at) VALUES('public-tracking-rate-prune',?) ON CONFLICT(task) DO UPDATE SET last_run_at=excluded.last_run_at WHERE last_run_at<?")
  .bind(ts,ts-23*3600).run();
 if((marker.meta?.changes||0)!==1)return;
 await env.DB.prepare("DELETE FROM mcct_public_tracking_rate WHERE hour_utc<?").bind(hour-72).run();
}
launch_wig_maker_portal_worker_default.fetch=async function(req,env,ctx){
 const path=new URL(req.url).pathname;
 if(path==="/track-hair-donation"){
  return req.method==="GET"?mcctTrackV5Page(env):mcctTrackV5Err("Method not allowed",405);
 }
 if(path==="/api/public/hair-tracking")return mcctTrackV5Lookup(req,env);
 return MCCT_TRACK_V5_PREV_FETCH.call(this,req,env,ctx);
};
launch_wig_maker_portal_worker_default.scheduled=async function(controller,env,ctx){
 if(MCCT_TRACK_V5_PREV_SCHEDULED)await MCCT_TRACK_V5_PREV_SCHEDULED.call(this,controller,env,ctx);
 ctx.waitUntil(mcctTrackV5Prune(env).catch(e=>console.error("MCCT_TRACK_PRUNE",String(e?.name||"Error"))));
};
