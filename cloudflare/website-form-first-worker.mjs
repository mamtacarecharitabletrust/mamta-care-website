/**
 * Mamta Care website registration: Google Form is the authority for donor data,
 * registration IDs and confirmation emails. Cloudflare R2 retains the 2 photos.
 * The public endpoint is deliberately off until both feature gates are enabled.
 */
const ORIGIN="https://mamta-care-website.vercel.app",MB=4194304;
const PREVIEW_ORIGIN="https://mamta-care-website-f4j0izzmh-mamtacarecharitabletrust.vercel.app";
const allowedOrigin=o=>o===ORIGIN||o===PREVIEW_ORIGIN;
const kinds=new Set(["image/jpeg","image/png","image/webp"]);
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const official=/^\d{4}-\d{4}\d+\/M\/2022$/;
const response=(data,status=200,origin="")=>new Response(JSON.stringify(data),{status,headers:{"content-type":"application/json","cache-control":"no-store","x-content-type-options":"nosniff",...(allowedOrigin(origin)?{"access-control-allow-origin":origin,"vary":"Origin"}:{})}});
const field=(f,k,n=200)=>String(f.get(k)||"").trim().slice(0,n);
const type=(b)=>b.length>=3&&b[0]===255&&b[1]===216&&b[2]===255?"image/jpeg":
 b.length>=8&&[137,80,78,71,13,10,26,10].every((v,i)=>b[i]===v)?"image/png":
 b.length>=12&&[82,73,70,70].every((v,i)=>b[i]===v)&&[87,69,66,80].every((v,i)=>b[i+8]===v)?"image/webp":null;
const ext=m=>m==="image/jpeg"?"jpg":m==="image/png"?"png":"webp";
const validUrl=v=>{try{const u=new URL(v);return u.protocol==="https:"&&u.hostname==="script.google.com"&&/^\/macros\/s\/[-\w]+\/exec$/.test(u.pathname)}catch{return false}};
async function registration(req,env,origin){
 if(env.REGISTRATION_ENABLED!=="true"||env.INTEGRATION_VERIFIED!=="true")
   return response({ok:false,error:"Website photo registration is not active. Use the official Google Form."},503,origin);
 if(origin!==ORIGIN)return response({ok:false,error:"Origin not allowed"},403,origin);
 if(!env.DB||!env.DONOR_PHOTOS||!env.TURNSTILE_SECRET||!env.GOOGLE_FORM_BRIDGE_SECRET||!validUrl(env.GOOGLE_FORM_BRIDGE_URL))
   return response({ok:false,error:"Service configuration incomplete"},503,origin);
 if(Number(req.headers.get("content-length")||0)>9*1024*1024)return response({ok:false,error:"Upload limit exceeded"},413,origin);
 let f;try{f=await req.formData()}catch{return response({ok:false,error:"Invalid form"},400,origin)}
 const id=field(f,"submission_uuid",50),token=field(f,"turnstile",4096);
 if(!uuid.test(id)||!token)return response({ok:false,error:"Submission reference or security check missing"},400,origin);
 const verify=new FormData();verify.set("secret",env.TURNSTILE_SECRET);verify.set("response",token);
 let verdict;try{const r=await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify",{method:"POST",body:verify});if(!r.ok)throw Error("Turnstile service unavailable");verdict=await r.json()}catch{return response({ok:false,error:"Security check temporarily unavailable"},503,origin)}
 if(verdict.success!==true||verdict.hostname!==new URL(ORIGIN).hostname)return response({ok:false,error:"Security check rejected"},403,origin);
 const values=Object.fromEntries(["full_name","phone","gender","hair_length","city","hair_type","guidance","readiness","referral_source","email"].map(k=>[k,field(f,k,k==="email"?180:200)]));
 values.phone=values.phone.replace(/\D/g,"");values.consent="STRONGLY AGREE";
 if(values.full_name.length<2||!/^[0-9]{10}$/.test(values.phone)||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)
  ||["gender","hair_length","city","hair_type","guidance","readiness","referral_source"].some(k=>!values[k])||field(f,"voluntary")!=="yes"||field(f,"private_photos")!=="yes")
  return response({ok:false,error:"Incomplete donor registration"},400,origin);
 const method=field(f,"method",32);
 if(!["haircut","head_shave"].includes(method)||(method==="head_shave")!==(values.hair_length==="BALD(FULL LENGTH)"))
  return response({ok:false,error:"Hair donation choice inconsistent"},400,origin);
 const front=f.get("front"),back=f.get("back");
 if(!(front instanceof File)||!(back instanceof File)||!kinds.has(front.type)||!kinds.has(back.type)||front.size<1||back.size<1||front.size>MB||back.size>MB)
  return response({ok:false,error:"Provide two valid photos no larger than 4 MB each"},400,origin);
 const b1=new Uint8Array(await front.arrayBuffer()),b2=new Uint8Array(await back.arrayBuffer());
 if(type(b1)!==front.type||type(b2)!==back.type)return response({ok:false,error:"Invalid image format"},400,origin);
 const now=Date.now(),key1="website-form/"+id+"/front."+ext(front.type),key2="website-form/"+id+"/back."+ext(back.type);
 const reservation=await env.DB.prepare("INSERT OR IGNORE INTO website_form_intakes(submission_uuid,state,front_key,back_key,created_at,updated_at) VALUES(?,?,?,?,?,?)").bind(id,"RESERVED",key1,key2,now,now).run();
 if(reservation.meta?.changes!==1){
  const last=await env.DB.prepare("SELECT state,registration_id FROM website_form_intakes WHERE submission_uuid=?").bind(id).first();
  if(last?.state==="COMPLETE")return response({ok:true,existing:true,registration_id:last.registration_id,photos_received:true},200,origin);
  return response({ok:false,pending:true,error:"Previous submission requires review; do not resubmit"},202,origin);
 }
 let phase="photos";
 try{
  await env.DONOR_PHOTOS.put(key1,b1,{httpMetadata:{contentType:front.type}});
  await env.DONOR_PHOTOS.put(key2,b2,{httpMetadata:{contentType:back.type}});
  await env.DB.prepare("UPDATE website_form_intakes SET state='PHOTOS_STORED',updated_at=? WHERE submission_uuid=?").bind(Date.now(),id).run();
  phase="google_form";
  const requestBody={action:"website_submit",submission_uuid:id,secret:env.GOOGLE_FORM_BRIDGE_SECRET,values};
  // Retry using the same UUID. Apps Script ledger prevents duplicate Forms rows.
  let answer=null;
  async function bridgeStatus(action){
   const a=await fetch(env.GOOGLE_FORM_BRIDGE_URL,{method:"POST",headers:{"content-type":"text/plain;charset=UTF-8"},body:JSON.stringify({...requestBody,action}),redirect:"follow"});
   if(!a.ok)throw Error("Google Form bridge HTTP failure");
   const t=await a.text();
   if(t.length>20000)throw Error("Unexpected bridge payload");
   return JSON.parse(t);
  }
  for(let attempt=0;attempt<3&&!answer;attempt++){
   let action=attempt===0?"website_submit":"website_status";
   try{
    const candidate=await bridgeStatus(action);
    if(candidate?.ok===true&&official.test(String(candidate.registration_id||""))){answer=candidate;break;}
    if(action==="website_status"&&candidate?.error==="Submission reference not found"){
     const retried=await bridgeStatus("website_submit");
     if(retried?.ok===true&&official.test(String(retried.registration_id||""))){answer=retried;break;}
    }
   }catch(e){console.error("Website bridge not confirmed during safe retry");}
  }
  if(!answer)throw Error("Registration not confirmed");
  phase="association";
  const reg=String(answer.registration_id);
  const updates=await env.DB.batch([
   env.DB.prepare("INSERT OR IGNORE INTO website_hair_photos(donor_id,side,object_key,mime,size_bytes,created_at) VALUES(?,?,?,?,?,?)").bind(reg,"front",key1,front.type,front.size,now),
   env.DB.prepare("INSERT OR IGNORE INTO website_hair_photos(donor_id,side,object_key,mime,size_bytes,created_at) VALUES(?,?,?,?,?,?)").bind(reg,"back",key2,back.type,back.size,now),
   env.DB.prepare("UPDATE website_form_intakes SET state='COMPLETE',registration_id=?,updated_at=? WHERE submission_uuid=?").bind(reg,Date.now(),id)
  ]);
  if(updates[0]?.meta?.changes!==1||updates[1]?.meta?.changes!==1)throw Error("Duplicate official registration photo association");
  return response({ok:true,registration_id:reg,photos_received:true,confirmation_email:"handled_by_existing_automation"},201,origin);
 }catch(e){
  await env.DB.prepare("UPDATE website_form_intakes SET state='REVIEW_REQUIRED',updated_at=? WHERE submission_uuid=?").bind(Date.now(),id).run().catch(()=>{});
  console.error("Website intake held for reconciliation: "+phase);
  return response({ok:false,pending:true,error:"Registration requires Administrator review. Do not resubmit."},202,origin);
 }
}

const PHOTO_APP_ORIGIN="https://mamta-hair-registration-app.bharathairseva-in.workers.dev";
const photoReply=(obj,status=200)=>new Response(JSON.stringify(obj),{status,headers:{"content-type":"application/json","cache-control":"no-store","access-control-allow-origin":PHOTO_APP_ORIGIN,"vary":"Origin","x-content-type-options":"nosniff"}});
const digestHex=async text=>Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(text)))).map(x=>x.toString(16).padStart(2,"0")).join("");
async function uploadOfficialFormPhotos(req,env){
 if(req.headers.get("Origin")!==PHOTO_APP_ORIGIN)return response({ok:false,error:"Origin not allowed"},403);
 if(!env.DB||!env.DONOR_PHOTOS||!env.TURNSTILE_SECRET||!env.RATE_SALT)return photoReply({ok:false,error:"Photo intake unavailable"},503);
 if(Number(req.headers.get("content-length")||0)>9*1024*1024)return photoReply({ok:false,error:"Maximum 4 MB for each photograph"},413);
 let f;try{f=await req.formData()}catch{return photoReply({ok:false,error:"Invalid form upload"},400)}
 const id=String(f.get("registration_id")||"").trim().toUpperCase();
 const phone=String(f.get("phone")||"").replace(/\D/g,""),token=String(f.get("turnstile")||"");
 if(!/^\d{4}-\d{6}\/M\/2022$/.test(id)||!/^\d{10}$/.test(phone)||f.get("consent")!=="on"||!token)
  return photoReply({ok:false,error:"Enter your exact official registration ID, phone, consent and security verification"},400);
 const d=new FormData();d.set("secret",env.TURNSTILE_SECRET);d.set("response",token);
 let v;try{const r=await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify",{method:"POST",body:d});if(!r.ok)throw Error("Verification unavailable");v=await r.json()}catch{return photoReply({ok:false,error:"Security check unavailable"},503)}
 if(v.success!==true||v.hostname!=="mamta-hair-registration-app.bharathairseva-in.workers.dev")
  return photoReply({ok:false,error:"Please complete the security verification"},403);
 const ip=req.headers.get("CF-Connecting-IP")||"unknown",day=new Date().toISOString().slice(0,10);
 const bucket=await digestHex(env.RATE_SALT+"|"+ip+"|"+day);
 try{
  await env.DB.prepare("INSERT INTO website_hair_rate(bucket,day,n) VALUES(?,?,1) ON CONFLICT(bucket) DO UPDATE SET n=n+1").bind(bucket,day).run();
  const lim=await env.DB.prepare("SELECT n FROM website_hair_rate WHERE bucket=?").bind(bucket).first();
  if(Number(lim?.n)>6)return photoReply({ok:false,error:"Too many attempts today. Contact the Mamta Care team."},429);
 }catch{return photoReply({ok:false,error:"Verification temporarily unavailable"},503)}
 const donor=await env.DB.prepare("SELECT id,phone FROM donors WHERE source='google_sheet' AND UPPER(TRIM(registration_id))=? LIMIT 1").bind(id).first();
 if(!donor||String(donor.phone||"").replace(/\D/g,"")!==phone)
  return photoReply({ok:false,error:"Your Google Form registration has not yet appeared in Donor Desk, or the phone number does not match. Please ask Mamta Care to import the form before uploading photographs."},409);
 const before=await env.DB.prepare("SELECT side FROM website_hair_photos WHERE donor_id=? LIMIT 1").bind(id).first();
 if(before)return photoReply({ok:false,error:"Photographs are already associated with this ID. Contact Mamta Care to change them."},409);
 const files=[f.get("front"),f.get("back")],types=[],contents=[];
 for(const file of files){
  if(!(file instanceof File)||file.size<1||file.size>4194304||!["image/jpeg","image/png","image/webp"].includes(file.type))
   return photoReply({ok:false,error:"Select one front and one back JPG, PNG or WebP photograph, each at most 4 MB"},400);
  const bytes=new Uint8Array(await file.arrayBuffer());
  const actual=bytes[0]===255&&bytes[1]===216&&bytes[2]===255?"image/jpeg":bytes.length>=8&&[137,80,78,71,13,10,26,10].every((x,i)=>bytes[i]===x)?"image/png":bytes.length>=12&&[82,73,70,70].every((x,i)=>bytes[i]===x)&&[87,69,66,80].every((x,i)=>bytes[8+i]===x)?"image/webp":"";
  if(actual!==file.type)return photoReply({ok:false,error:"Invalid photograph format"},400);
  types.push(actual);contents.push(bytes);
 }
 const uuid=crypto.randomUUID(),time=Date.now();
 const keys=["front","back"].map((side,i)=>"official-photo/"+uuid+"/"+side+"."+(types[i]==="image/jpeg"?"jpg":types[i]==="image/png"?"png":"webp"));
 const hash=await digestHex(env.RATE_SALT+"|"+id+"|"+phone);
 const reserved=await env.DB.prepare("INSERT OR IGNORE INTO standalone_photo_intakes(id,registration_id,phone_hash,state,front_key,back_key,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)")
  .bind(uuid,id,hash,"RESERVED",keys[0],keys[1],time,time).run();
 if(reserved.meta?.changes!==1)return photoReply({ok:false,error:"Photos already received or pending review for this registration. Contact Mamta Care."},409);
 try{
  await env.DONOR_PHOTOS.put(keys[0],contents[0],{httpMetadata:{contentType:types[0]}});
  await env.DONOR_PHOTOS.put(keys[1],contents[1],{httpMetadata:{contentType:types[1]}});
  const q=await env.DB.batch([
    env.DB.prepare("INSERT OR IGNORE INTO website_hair_photos(donor_id,side,object_key,mime,size_bytes,created_at) VALUES(?,?,?,?,?,?)").bind(id,"front",keys[0],types[0],contents[0].byteLength,time),
    env.DB.prepare("INSERT OR IGNORE INTO website_hair_photos(donor_id,side,object_key,mime,size_bytes,created_at) VALUES(?,?,?,?,?,?)").bind(id,"back",keys[1],types[1],contents[1].byteLength,time)
  ]);
  if(q.some(x=>x.meta?.changes!==1))throw Error("Photo association requires review");
  await env.DB.prepare("UPDATE standalone_photo_intakes SET state='COMPLETE',updated_at=? WHERE id=?").bind(Date.now(),uuid).run();
  return photoReply({ok:true,message:"Your two photographs were received privately and linked to your official registration ID."});
 }catch(e){
  await env.DB.prepare("UPDATE standalone_photo_intakes SET state='REVIEW_REQUIRED',updated_at=? WHERE id=?").bind(Date.now(),uuid).run().catch(()=>{});
  return photoReply({ok:false,error:"Your upload requires team review. Do not resubmit before contacting Mamta Care."},503);
 }
}

async function checkWebsiteBridge(env){
 if(!env.GOOGLE_FORM_BRIDGE_SECRET||!validUrl(env.GOOGLE_FORM_BRIDGE_URL))return response({ok:false,check:'configuration_missing'},503);
 const old=await env.DB.prepare("SELECT result,checked_at FROM website_bridge_auth_check WHERE id='latest'").first();
 if(old&&Date.now()-Number(old.checked_at)<300000)return response({ok:old.result==='verified',check:old.result,cached:true});
 async function ask(key){
  try{const r=await fetch(env.GOOGLE_FORM_BRIDGE_URL,{method:'POST',headers:{'content-type':'text/plain;charset=UTF-8'},body:JSON.stringify({action:'website_status',submission_uuid:crypto.randomUUID(),secret:key}),redirect:'follow',signal:AbortSignal.timeout(12000)});
  if(!r.ok)return 'http_'+r.status;
  const t=await r.text();if(t.length>5000)return 'bad_response';
  const x=JSON.parse(t);return JSON.stringify({ok:x.ok===true,error:String(x.error||'').slice(0,100)});
  }catch{return 'request_failed';}
 }
 const bad=await ask('not-a-real-bridge-secret'),good=await ask(env.GOOGLE_FORM_BRIDGE_SECRET);
 const state=good==='request_failed'||bad==='request_failed'?'transport_failed':good.startsWith('http_')||bad.startsWith('http_')?'http_error':good!==bad?'verified':'needs_review';
 await env.DB.prepare("INSERT INTO website_bridge_auth_check(id,result,checked_at) VALUES('latest',?,?) ON CONFLICT(id) DO UPDATE SET result=excluded.result,checked_at=excluded.checked_at").bind(state,Date.now()).run();
 return response({ok:state==='verified',check:state,cached:false});
}
const MC_COURIER_ACTIONS={"request-code":"courier_code","verify-code":"courier_verify","submit":"courier_submit","status":"courier_status"};
async function courierWebsiteRequest(req,env,path,origin){
 if(env.COURIER_SUBMISSION_ENABLED!=="true")return response({ok:false,error:"Website courier submissions are not active yet"},503,origin);
 if(origin!==ORIGIN)return response({ok:false,error:"Origin not allowed"},403,origin);
 if(!env.GOOGLE_FORM_BRIDGE_SECRET||!validUrl(env.GOOGLE_FORM_BRIDGE_URL)||!env.TURNSTILE_SECRET||!env.RATE_SALT)return response({ok:false,error:"Courier connection unavailable"},503,origin);
 if(Number(req.headers.get("content-length")||0)>3500)return response({ok:false,error:"Request too large"},413,origin);
 const action=path.slice("/api/courier/".length),cmd=MC_COURIER_ACTIONS[action];if(!cmd)return response({ok:false,error:"Unknown courier action"},404,origin);
 let input;try{input=await req.json()}catch{return response({ok:false,error:"Invalid input"},400,origin)}
 if(!input||typeof input!=="object"||Array.isArray(input))return response({ok:false,error:"Invalid input"},400,origin);
 const id=String(input.registration_id||"").trim().toUpperCase(),code=String(input.code||"").trim().toUpperCase(),email=String(input.email||"").trim().toLowerCase(),token=String(input.token||""),carrier=String(input.carrier||"").trim(),tracking=String(input.tracking||"").trim().toUpperCase();
 if(action==="request-code"&&(!/^[A-Z0-9][A-Z0-9/_.-]{2,79}$/.test(id)||!/^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/.test(email)||email.length>254))return response({ok:false,error:"Check your registration ID and registered email"},400,origin);
 if(action==="verify-code"&&(!/^[A-Z0-9][A-Z0-9/_.-]{2,79}$/.test(id)||!/^[0-9]{4}$/.test(code)))return response({ok:false,error:"Invalid verification code"},400,origin);
 if(["submit","status"].includes(action)&&(!token||token.length>100))return response({ok:false,error:"Verify your registered email first"},400,origin);
 if(action==="submit"&&(!["speedpost","dtdc","bluedart","professional"].includes(carrier)||!/^[A-Z0-9][A-Z0-9-]{4,39}$/.test(tracking)))return response({ok:false,error:"Check courier and AWB details"},400,origin);
 if(action==="request-code"){
  const c=String(input.turnstile_token||"");if(!c||c.length>4096)return response({ok:false,error:"Security check required"},400,origin);
  const verify=new FormData();verify.set("secret",env.TURNSTILE_SECRET);verify.set("response",c);
  let verdict;try{const q=await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify",{method:"POST",body:verify,signal:AbortSignal.timeout(10000)});verdict=await q.json()}catch{return response({ok:false,error:"Security verification unavailable"},503,origin)}
  if(verdict.success!==true||verdict.hostname!==new URL(ORIGIN).hostname)return response({ok:false,error:"Security check rejected"},403,origin);
  const ip=req.headers.get("CF-Connecting-IP")||"unknown",day=new Date().toISOString().slice(0,10),key=await digestHex(env.RATE_SALT+"|courier|"+ip+"|"+day);
  let hits;try{await env.DB.prepare("INSERT INTO website_hair_rate(bucket,day,n) VALUES(?,?,1) ON CONFLICT(bucket) DO UPDATE SET n=n+1").bind(key,day).run();hits=await env.DB.prepare("SELECT n FROM website_hair_rate WHERE bucket=?").bind(key).first()}catch{return response({ok:false,error:"Verification temporarily unavailable"},503,origin)}
  if(Number(hits?.n)>6)return response({ok:false,error:"Too many requests today. Contact Mamta Care"},429,origin);
 }
 const payload={action:cmd,secret:env.GOOGLE_FORM_BRIDGE_SECRET};
 if(action==="request-code")Object.assign(payload,{registration_id:id,email});
 if(action==="verify-code")Object.assign(payload,{registration_id:id,code});
 if(action==="submit")Object.assign(payload,{token,carrier,tracking});
 if(action==="status")payload.token=token;
 try{const resp=await fetch(env.GOOGLE_FORM_BRIDGE_URL,{method:"POST",headers:{"Content-Type":"text/plain;charset=UTF-8"},body:JSON.stringify(payload),redirect:"follow",signal:AbortSignal.timeout(22000)});
 if(!resp.ok)return response({ok:false,error:"Courier service temporarily unavailable"},502,origin);
 const text=await resp.text();if(text.length>8192)return response({ok:false,error:"Unexpected courier response"},502,origin);
 const out=JSON.parse(text);if(!out||out.ok!==true)return response({ok:false,error:String(out?.error||"Courier verification failed").slice(0,180)},400,origin);
 return response({ok:true,data:out.data||{}},200,origin);
 }catch{return response({ok:false,error:"Courier service temporarily unavailable; check status before retrying"},502,origin)}
}
export default {async fetch(req,env){
 const path=new URL(req.url).pathname,origin=req.headers.get("origin")||"";
 if(req.method==="GET"&&path==="/health/bridge-check")return checkWebsiteBridge(env);
 if(req.method==="GET"&&path==="/health")
  return response({ok:true,service:"mamta-website-form-first",accepting_submissions:env.REGISTRATION_ENABLED==="true"&&env.INTEGRATION_VERIFIED==="true",bridge_url_configured:validUrl(env.GOOGLE_FORM_BRIDGE_URL),bridge_secret_configured:!!env.GOOGLE_FORM_BRIDGE_SECRET});
 if(path==="/api/photos"&&req.method==="OPTIONS")return new Response(null,{status:204,headers:{"access-control-allow-origin":origin===PHOTO_APP_ORIGIN?PHOTO_APP_ORIGIN:"null","access-control-allow-methods":"POST,OPTIONS","access-control-allow-headers":"Content-Type","access-control-max-age":"300"}});
 if(path==="/api/photos"&&req.method==="POST")return uploadOfficialFormPhotos(req,env);
 if(path.startsWith("/api/courier/")&&req.method==="OPTIONS")return new Response(null,{status:204,headers:{"access-control-allow-origin":allowedOrigin(origin)?origin:"null","access-control-allow-methods":"POST,OPTIONS","access-control-allow-headers":"Content-Type","access-control-max-age":"300"}});
 if(path.startsWith("/api/courier/")&&req.method==="POST")return courierWebsiteRequest(req,env,path,origin);
 if(path==="/api/register"&&req.method==="OPTIONS")
  return new Response(null,{status:204,headers:{"access-control-allow-origin":allowedOrigin(origin)?origin:"null","access-control-allow-methods":"POST,OPTIONS","access-control-allow-headers":"Content-Type","access-control-max-age":"300"}});
 if(path==="/api/register"&&req.method==="POST")return registration(req,env,origin);
 return response({ok:false,error:"Not found"},404,origin);
}};