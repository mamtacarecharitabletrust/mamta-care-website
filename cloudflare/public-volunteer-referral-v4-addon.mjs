/* Mamta Care volunteer expression-of-interest intake V4.
 * Existing approved Wig Desk intake, donor APIs, volunteer records, IDs,
 * agreements and scheduled imports remain unchanged.
 * Requires previous V3 Turnstile/HMAC helpers from deployed Worker.
 */
const MCCT_VOL_V4_PREV_FETCH=launch_wig_maker_portal_worker_default.fetch;
function mcctVolV4Fail(msg,status=400){return mcctWigV3Json({ok:false,error:msg},status)}
function mcctVolV4Page(env){
 const key=mcctWigV3Str(env.TURNSTILE_SITE_KEY,100);
 if(!/^0x[A-Za-z0-9_-]{12,90}$/.test(key))return mcctVolV4Fail("Security verification unavailable",503);
 return mcctWigV3SecureHTML(MCCT_VOL_PUBLIC_HTML,true,key);
}
async function mcctVolV4Submit(req,env){
 if(req.method!=="POST")return mcctVolV4Fail("Method not allowed",405);
 const origin=req.headers.get("Origin")||"";
 if(origin!==new URL(req.url).origin||req.headers.get("X-Mamta-Public")!=="1"||!/^application\/json(?:;|$)/i.test(req.headers.get("Content-Type")||""))return mcctVolV4Fail("Request verification failed",403);
 let d;try{d=await mcctWigV3Body(req)}catch{return mcctVolV4Fail("Invalid application")}
 const name=mcctWigV3Str(d.full_name,110),rawPhone=mcctWigV3Str(d.phone,30),
       city=mcctWigV3Str(d.city,100),profession=mcctWigV3Str(d.profession,80),
       interest=mcctWigV3Str(d.interest,70),notes=mcctWigV3Str(d.note,100),
       email=mcctWigV3Str(d.email,180),token=String(d.cf_turnstile_response||"");
 const digits=rawPhone.replace(/[^0-9]/g,"");
 const phone=digits.length===10?"+91"+digits:"+"+digits;
 const approvedInterests=new Set(["Hair Collection","Cancer Awareness","Hair Styling","Community Outreach","Other"]);
 if(name.length<3||city.length<2||profession.length<2||digits.length<10||digits.length>15||!approvedInterests.has(interest)||
    (email.length>0&&!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email))||d.consent_confirmed!==true||d.privacy_accepted!==true)return mcctVolV4Fail("Complete required details and consent");
 if(!(await mcctWigV3Verify(req,env,token)))return mcctVolV4Fail("Security challenge failed. Please try again.",403);
 const today=mcctWigV3IST(),ts=Math.floor(Date.now()/1000);
 let contactKey,bucket;
 try{
  contactKey=await mcctWigV3Hash(env,"mcct:volunteer:phone:"+phone);
  bucket=await mcctWigV3Hash(env,"mcct:volunteer:ip:"+today+":"+(req.headers.get("CF-Connecting-IP")||"unknown"));
 }catch{return mcctVolV4Fail("Application service temporarily unavailable",503)}
 const dup=await env.DB.prepare("SELECT 1 AS found FROM mcct_public_volunteer_intakes WHERE contact_hash=? AND day_ist=? LIMIT 1").bind(contactKey,today).first();
 if(dup)return mcctWigV3Json({ok:true,received:true,message:"Your interest has been submitted for review if not already registered."},202);
 const rate=await env.DB.prepare("INSERT INTO mcct_public_volunteer_rate(bucket,day_ist,submissions,updated_at) VALUES(?,?,1,?) ON CONFLICT(bucket) DO UPDATE SET submissions=submissions+1,updated_at=excluded.updated_at WHERE submissions<5").bind(bucket,today,ts).run();
 if((rate.meta?.changes||0)!==1)return mcctVolV4Fail("Daily submission limit reached. Contact Mamta Care directly.",429);
 const id=crypto.randomUUID();
 const summary=("Profession: "+profession+"; Interest: "+interest+(notes?"; Additional: "+notes:"")).slice(0,250);
 try{
  const inserted=await env.DB.batch([
    env.DB.prepare("INSERT INTO mca_referrals(id,referrer_type,referrer_id,name,email,phone,city,note,consent_confirmed,status,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)")
     .bind(id,"public_web","website_volunteer_form",name,email,phone,city,summary,1,"pending",ts),
    env.DB.prepare("INSERT INTO mcct_public_volunteer_intakes(referral_id,contact_hash,day_ist,created_at) SELECT ?,?,?,? WHERE changes()=1")
     .bind(id,contactKey,today,ts)
  ]);
  if((inserted[0]?.meta?.changes||0)!==1||(inserted[1]?.meta?.changes||0)!==1)return mcctVolV4Fail("Application not confirmed; please contact Mamta Care",503);
  return mcctWigV3Json({ok:true,received:true,reference:id.slice(0,8).toUpperCase(),status:"pending",id_card_issued:false,approved:false,message:"Volunteer interest received for administrator review. No ID or status is issued automatically."},202);
 }catch(e){
  if(String(e?.message||e).includes("UNIQUE"))return mcctWigV3Json({ok:true,received:true,message:"Your interest has been submitted for review if not already registered."},202);
  console.error("MCCT_VOLUNTEER_APPLY",String(e?.name||"Error"));
  return mcctVolV4Fail("Unable to record interest. Please try again later.",503);
 }
}
launch_wig_maker_portal_worker_default.fetch=async function(req,env,ctx){
 const path=new URL(req.url).pathname;
 if(path==="/join-volunteer")return req.method==="GET"?mcctVolV4Page(env):mcctVolV4Fail("Method not allowed",405);
 if(path==="/api/public/volunteer-referrals")return mcctVolV4Submit(req,env);
 if(path==="/admin-ops"&&req.method==="GET"){
  const res=await MCCT_VOL_V4_PREV_FETCH.call(this,req,env,ctx);
  if(!res.ok||!String(res.headers.get("Content-Type")||"").includes("text/html"))return res;
  const text=await res.text(),anchor='<a class="tile" href="/app/volunteer-onboarding">';
  const extra='<a class="tile" href="/premium-v3/volunteers"><b>Volunteer Interest Reviews</b><small>Website applications enter existing volunteer referral and approval workflows</small></a>';
  return new Response(text.includes(anchor)?text.replace(anchor,extra+anchor):text,{status:res.status,headers:res.headers});
 }
 return MCCT_VOL_V4_PREV_FETCH.call(this,req,env,ctx);
};
