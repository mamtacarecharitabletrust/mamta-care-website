/* MAMTA CARE: Public wig intake + reviewed registration auto-link v3.
 * Append to original live Worker after V2. No existing route, schedule,
 * registration-ID algorithm or certificate workflow is replaced.
 */
const MCCT_WIG_V3_PREV_FETCH=launch_wig_maker_portal_worker_default.fetch;
const MCCT_WIG_V3_PREV_SCHEDULED=launch_wig_maker_portal_worker_default.scheduled;
const MCCT_WIG_V3_UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MCCT_WIG_V3_MATERIALS=new Set(["Any","Human hair","Synthetic","Blend"]);
function mcctWigV3Str(value,max=140){return String(value??"").trim().slice(0,max)}
function mcctWigV3Json(obj,status=200){return new Response(JSON.stringify(obj),{status,headers:{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store","X-Content-Type-Options":"nosniff"}})}
function mcctWigV3Err(msg,status=400){return mcctWigV3Json({ok:false,error:msg},status)}
function mcctWigV3IST(date=new Date()){
 const p=new Intl.DateTimeFormat("en-GB",{timeZone:"Asia/Kolkata",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(date);
 const v=k=>p.find(x=>x.type===k)?.value||"";
 return v("year")+"-"+v("month")+"-"+v("day");
}
function mcctWigV3Nonce(){return [...crypto.getRandomValues(new Uint8Array(20))].map(v=>v.toString(16).padStart(2,"0")).join("")}
function mcctWigV3SecureHTML(source,publicPage,siteKey=""){
 const nonce=mcctWigV3Nonce();
 const html=source.replaceAll("MCCT_WIG_NONCE_PLACEHOLDER",nonce).replaceAll("MCCT_WIG_SITEKEY_PLACEHOLDER",siteKey);
 const policy="default-src 'none'; style-src 'nonce-"+nonce+"'; script-src 'nonce-"+nonce+"'"+(publicPage?" https://challenges.cloudflare.com":"")+"; img-src 'self'; connect-src 'self'"+(publicPage?" https://challenges.cloudflare.com":"")+"; frame-src "+(publicPage?"https://challenges.cloudflare.com":"'none'")+"; frame-ancestors 'none'; base-uri 'none'; form-action 'none'";
 return new Response(html,{headers:{"Content-Type":"text/html; charset=utf-8","Cache-Control":"private,no-store,max-age=0","Referrer-Policy":"no-referrer","X-Content-Type-Options":"nosniff","X-Frame-Options":"DENY","Content-Security-Policy":policy}});
}
function mcctWigV3PublicPage(env){
 const siteKey=mcctWigV3Str(env.TURNSTILE_SITE_KEY,100);
 if(!/^0x[A-Za-z0-9_-]{12,90}$/.test(siteKey))return mcctWigV3Err("Request verification temporarily unavailable",503);
 return mcctWigV3SecureHTML(MCCT_WIG_PUBLIC_HTML,true,siteKey);
}
async function mcctWigV3Body(req){
 const n=Number(req.headers.get("Content-Length")||0);
 if(n>9000)throw Error("Payload too large");
 const raw=await req.text();
 if(raw.length>9000)throw Error("Payload too large");
 return JSON.parse(raw||"{}");
}
async function mcctWigV3Hash(env,value){
 const secret=String(env.SESSION_SECRET||"");
 if(secret.length<32)throw Error("HMAC secret unavailable");
 const key=await crypto.subtle.importKey("raw",new TextEncoder().encode(secret),{name:"HMAC",hash:"SHA-256"},false,["sign"]);
 const signed=new Uint8Array(await crypto.subtle.sign("HMAC",key,new TextEncoder().encode(value)));
 return [...signed].map(x=>x.toString(16).padStart(2,"0")).join("");
}
async function mcctWigV3Verify(req,env,token){
 if(!env.TURNSTILE_SECRET_KEY||token.length<10||token.length>3000)return false;
 const body=new URLSearchParams({secret:String(env.TURNSTILE_SECRET_KEY),response:token});
 const ip=req.headers.get("CF-Connecting-IP");
 if(ip)body.set("remoteip",ip);
 try{
  const res=await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify",{
   method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body,
   signal:typeof AbortSignal.timeout==="function"?AbortSignal.timeout(9000):undefined
  });
  if(!res.ok)return false;
  const result=await res.json();
  return result.success===true;
 }catch{return false}
}
async function mcctWigV3Submit(req,env){
 if(req.method!=="POST")return mcctWigV3Err("Method not allowed",405);
 const origin=req.headers.get("Origin")||"";
 if(origin!==new URL(req.url).origin||req.headers.get("X-Mamta-Public")!=="1"||
    !/^application\/json(?:;|$)/i.test(req.headers.get("Content-Type")||""))return mcctWigV3Err("Request verification failed",403);
 let data;try{data=await mcctWigV3Body(req)}catch{return mcctWigV3Err("Invalid form submission")}
 const fullName=mcctWigV3Str(data.recipient_name,90),phoneInput=mcctWigV3Str(data.recipient_phone,32),
       city=mcctWigV3Str(data.city,120),material=mcctWigV3Str(data.hair_material,20),
       cap=mcctWigV3Str(data.cap_size,60),urgency=mcctWigV3Str(data.urgency,15),
       note=mcctWigV3Str(data.note,400),token=String(data.cf_turnstile_response||"");
 const digits=phoneInput.replace(/[^0-9]/g,"");
 const phone=digits.length===10?"+91"+digits:"+"+digits;
 if(fullName.length<2||city.length<2||digits.length<10||digits.length>15||
    !MCCT_WIG_V3_MATERIALS.has(material)||!["Normal","Urgent"].includes(urgency)||
    data.guardian_or_self_consent!==true||data.privacy_accepted!==true)return mcctWigV3Err("Please complete required details and consent");
 if(!(await mcctWigV3Verify(req,env,token)))return mcctWigV3Err("Verification failed. Please refresh the challenge and try again.",403);
 const today=mcctWigV3IST(),ts=Math.floor(Date.now()/1000);
 let contactKey,bucket;
 try{
  contactKey=await mcctWigV3Hash(env,"mcct:wig:contact:"+phone.toLowerCase());
  const rawIp=req.headers.get("CF-Connecting-IP")||"unknown";
  bucket=await mcctWigV3Hash(env,"mcct:wig:rate:"+today+":"+rawIp);
 }catch{return mcctWigV3Err("Submission temporarily unavailable",503)}
 const duplicate=await env.DB.prepare("SELECT 1 AS exists_row FROM mcct_public_wig_intakes WHERE contact_hash=? AND day_ist=? LIMIT 1").bind(contactKey,today).first();
 if(duplicate)return mcctWigV3Json({ok:true,received:true,message:"Your request has been recorded for review if not already submitted."},202);
 const rate=await env.DB.prepare("INSERT INTO mcct_public_wig_rate(bucket,day_ist,submissions,updated_at) VALUES(?,?,1,?) ON CONFLICT(bucket) DO UPDATE SET submissions=submissions+1,updated_at=excluded.updated_at WHERE submissions<5").bind(bucket,today,ts).run();
 if((rate.meta?.changes||0)!==1)return mcctWigV3Err("Daily submission limit reached. Please contact Mamta Care directly.",429);
 const id=crypto.randomUUID();
 try{
  await env.DB.prepare("INSERT INTO mcct_public_wig_intakes(id,recipient_name,recipient_phone,city,hair_material,cap_size,urgency,note,consent_at,contact_hash,day_ist,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)")
    .bind(id,fullName,phone,city,material,cap,urgency,note,ts,contactKey,today,ts,ts).run();
  return mcctWigV3Json({ok:true,received:true,reference:id.slice(0,8).toUpperCase(),message:"Request received for review. This does not guarantee availability or allocation of a wig."},202);
 }catch(e){
  if(String(e?.message||e).includes("UNIQUE"))return mcctWigV3Json({ok:true,received:true,message:"Your request has been recorded for review if not already submitted."},202);
  console.error("MCCT_WIG_PUBLIC_WRITE",String(e?.name||"Error"));
  return mcctWigV3Err("Unable to save your request. Please try again later.",503);
 }
}
async function mcctWigV3AdminList(db){
 const [rows,count]=await Promise.all([
  db.prepare("SELECT id,recipient_name,recipient_phone,city,hair_material,cap_size,urgency,note,consent_at,status,reviewed_by,reviewed_at,review_note,wig_request_id,created_at FROM mcct_public_wig_intakes ORDER BY CASE WHEN status='PENDING' THEN 0 ELSE 1 END,created_at DESC LIMIT 100").all(),
  db.prepare("SELECT status,COUNT(*) n FROM mcct_public_wig_intakes GROUP BY status").all()
 ]);
 return mcctWigV3Json({ok:true,requests:rows.results||[],stats:count.results||[],privacy:"Admin-only, do not share recipient contact details"});
}
async function mcctWigV3AdminDecision(req,env,user,id,action){
 if(!MCCT_WIG_V3_UUID.test(id))return mcctWigV3Err("Invalid request reference");
 let value;try{value=await mcctWigV3Body(req)}catch{return mcctWigV3Err("Invalid JSON")}
 const reason=mcctWigV3Str(value.reason,350);
 if(reason.length<8)return mcctWigV3Err("A review reason of at least 8 characters is required");
 const old=await env.DB.prepare("SELECT * FROM mcct_public_wig_intakes WHERE id=?").bind(id).first();
 if(!old)return mcctWigV3Err("Case not found",404);
 if(old.status!=="PENDING")return mcctWigV3Err("Case has already been reviewed",409);
 const ts=Math.floor(Date.now()/1000);
 if(action==="reject"){
  const rs=await env.DB.prepare("UPDATE mcct_public_wig_intakes SET status='REJECTED',reviewed_by=?,reviewed_at=?,review_note=?,updated_at=? WHERE id=? AND status='PENDING'")
   .bind(user.username,ts,reason,ts,id).run();
  return (rs.meta?.changes||0)===1?mcctWigV3Json({ok:true,rejected:true,contacted:false}):mcctWigV3Err("Request changed; reload",409);
 }
 if(action!=="import")return mcctWigV3Err("Unknown review action",404);
 const wigId=crypto.randomUUID();
 try{
  const inserted=await env.DB.batch([
   env.DB.prepare("INSERT INTO wig_requests(id,requested_by,recipient_name,recipient_contact,city,hair_material,hair_length_cm,hair_color,texture,cap_size,urgency,note,consent_attested_at,status,created_at,updated_at) SELECT ?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM mcct_public_wig_intakes w WHERE w.id=? AND w.status='PENDING' AND w.wig_request_id IS NULL)")
    .bind(wigId,"public_wig_intake:"+id,old.recipient_name,old.recipient_phone,old.city,old.hair_material,0,"","",old.cap_size,old.urgency,old.note,old.consent_at,"pending",ts,ts,id),
   env.DB.prepare("UPDATE mcct_public_wig_intakes SET status='IMPORTED',wig_request_id=?,reviewed_by=?,reviewed_at=?,review_note=?,updated_at=? WHERE id=? AND status='PENDING' AND changes()=1")
    .bind(wigId,user.username,ts,reason,ts,id),
   env.DB.prepare("INSERT INTO wig_events(id,request_id,actor,action,detail_json,happened_at) SELECT ?,?,?,?, ?,? WHERE changes()=1")
    .bind(crypto.randomUUID(),wigId,user.username,"public_wig_intake_imported",JSON.stringify({intake_id:id,review_reason:reason,source:"public_turnstile_consent"}),ts)
  ]);
  if((inserted[0]?.meta?.changes||0)!==1||(inserted[1]?.meta?.changes||0)!==1)return mcctWigV3Err("Case changed during import. No successful import confirmed.",409);
  return mcctWigV3Json({ok:true,imported:true,wig_request_id:wigId,wig_status:"pending",recipient_notified:false});
 }catch(e){
  console.error("MCCT_WIG_IMPORT",String(e?.name||"Error"));
  return mcctWigV3Err("Could not import safely. Refresh and check for an existing Wig Desk request.",409);
 }
}
async function mcctWigV3AutoLinkReviewed(env){
 if(!env?.DB)return;
 const rows=await env.DB.prepare(
  "SELECT i.submission_uuid,i.registration_id,a.reviewed_by,d.id AS donor_id FROM website_form_intakes i "+
  "JOIN mc_v3_photo_review_actions a ON a.submission_uuid=i.submission_uuid AND a.decision='ACCEPTED_FOR_FOLLOWUP' "+
  "JOIN donors d ON LOWER(TRIM(d.registration_id))=LOWER(TRIM(i.registration_id)) "+
  "WHERE i.registration_id IS NOT NULL AND TRIM(i.registration_id)<>'' "+
  "AND (SELECT COUNT(*) FROM donors unique_d WHERE LOWER(TRIM(unique_d.registration_id))=LOWER(TRIM(i.registration_id)))=1 "+
  "AND NOT EXISTS(SELECT 1 FROM mcct_ops_review_links l WHERE l.submission_uuid=i.submission_uuid OR l.donor_id=d.id) "+
  "ORDER BY i.created_at ASC LIMIT 15"
 ).all();
 for(const caseRow of (rows.results||[])){
  const ts=Math.floor(Date.now()/1000);
  try{
   const audited=await env.DB.batch([
    env.DB.prepare("INSERT INTO mcct_ops_review_links(submission_uuid,donor_id,registration_id,verified_by,verified_at,note) SELECT i.submission_uuid,d.id,d.registration_id,a.reviewed_by,?,? FROM website_form_intakes i JOIN mc_v3_photo_review_actions a ON a.submission_uuid=i.submission_uuid AND a.decision='ACCEPTED_FOR_FOLLOWUP' JOIN donors d ON LOWER(TRIM(d.registration_id))=LOWER(TRIM(i.registration_id)) WHERE i.submission_uuid=? AND (SELECT COUNT(*) FROM donors unique_d WHERE LOWER(TRIM(unique_d.registration_id))=LOWER(TRIM(i.registration_id)))=1 AND NOT EXISTS(SELECT 1 FROM mcct_ops_review_links l WHERE l.submission_uuid=i.submission_uuid OR l.donor_id=d.id)")
     .bind(ts,"Automatically matched accepted photo review to its official already-imported donor registration; no certificate or email triggered.",caseRow.submission_uuid),
    env.DB.prepare("INSERT INTO donor_events(id,donor_id,actor,action,detail_json,happened_at) SELECT ?,l.donor_id,l.verified_by,'accepted_photo_auto_reconciled',?,? FROM mcct_ops_review_links l WHERE l.submission_uuid=? AND changes()=1")
     .bind(crypto.randomUUID(),JSON.stringify({source:"approved_registration_link",registration_preserved:true}),ts,caseRow.submission_uuid)
   ]);
  }catch(e){console.error("MCCT_PHOTO_RECONCILIATION",String(e?.name||"Error"))}
 }
}
async function mcctWigV3AdminApi(req,env,user,path){
 if(req.method==="GET"&&path==="/wig-intakes")return mcctWigV3AdminList(env.DB);
 if(req.method==="GET"&&path==="/review-links"){
  const [count,unmatched]=await Promise.all([
   env.DB.prepare("SELECT COUNT(*) AS n FROM mcct_ops_review_links").first(),
   env.DB.prepare("SELECT COUNT(*) AS n FROM website_form_intakes i JOIN mc_v3_photo_review_actions a ON a.submission_uuid=i.submission_uuid WHERE a.decision='ACCEPTED_FOR_FOLLOWUP' AND NOT EXISTS(SELECT 1 FROM mcct_ops_review_links l WHERE l.submission_uuid=i.submission_uuid)").first()
  ]);
  return mcctWigV3Json({ok:true,reviewed_and_linked:count?.n||0,accepted_missing_registration:unmatched?.n||0});
 }
 if(req.method!=="POST")return mcctWigV3Err("Not found",404);
 if(!allowedWrite(req))return mcctWigV3Err("Origin verification failed",403);
 const m=/^\/wig-intakes\/([0-9a-f-]{36})\/(import|reject)$/i.exec(path);
 if(m)return mcctWigV3AdminDecision(req,env,user,m[1],m[2]);
 return mcctWigV3Err("Not found",404);
}
launch_wig_maker_portal_worker_default.fetch=async function(req,env,ctx){
 const path=new URL(req.url).pathname;
 if(path==="/request-free-wig")return req.method==="GET"?mcctWigV3PublicPage(env):mcctWigV3Err("Method not allowed",405);
 if(path==="/api/public/wig-requests")return mcctWigV3Submit(req,env);
 if(path==="/admin-wig-intakes"||path.startsWith("/api/admin/ops/v3/")){
  try{
   const user=await currentUser(req,env.DB);
   if(!user)return mcctWigV3Err("Sign in to Donor Desk first",401);
   if(user.role!=="admin")return mcctWigV3Err("Administrator only",403);
   if(path==="/admin-wig-intakes")return req.method==="GET"?mcctWigV3SecureHTML(MCCT_WIG_ADMIN_HTML,false):mcctWigV3Err("Method not allowed",405);
   return mcctWigV3AdminApi(req,env,user,path.slice("/api/admin/ops/v3".length));
  }catch(e){console.error("MCCT_WIG_ADMIN",String(e?.name||"Error"));return mcctWigV3Err("Wig review temporarily unavailable",503)}
 }
 if(path==="/admin-ops"&&req.method==="GET"){
  const res=await MCCT_WIG_V3_PREV_FETCH.call(this,req,env,ctx);
  if(!res.ok||!String(res.headers.get("Content-Type")||"").includes("text/html"))return res;
  const original=await res.text();
  const anchor='<a class="tile" href="/app">';
  if(!original.includes(anchor))return new Response(original,{status:res.status,headers:res.headers});
  const extra='<a class="tile" href="/admin-wig-intakes"><b>Public Wig Requests</b><small>Review consent-based wig requests and import accepted cases into the existing Wig Desk</small></a>';
  return new Response(original.replace(anchor,extra+anchor),{status:res.status,headers:res.headers});
 }
 return MCCT_WIG_V3_PREV_FETCH.call(this,req,env,ctx);
};
launch_wig_maker_portal_worker_default.scheduled=async function(controller,env,ctx){
 if(MCCT_WIG_V3_PREV_SCHEDULED)await MCCT_WIG_V3_PREV_SCHEDULED.call(this,controller,env,ctx);
 ctx.waitUntil(mcctWigV3AutoLinkReviewed(env).catch(e=>console.error("MCCT_WIG_AUTO_LINK",String(e?.name||"Error"))));
};
