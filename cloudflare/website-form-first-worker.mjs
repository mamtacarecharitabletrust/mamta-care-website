/**
 * Mamta Care website registration: Google Form is the authority for donor data,
 * registration IDs and confirmation emails. Cloudflare R2 retains the 2 photos.
 * The public endpoint is deliberately off until both feature gates are enabled.
 */
const ORIGIN="https://mamta-care-website.vercel.app",MB=4194304;
const kinds=new Set(["image/jpeg","image/png","image/webp"]);
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const official=/^\d{4}-\d{4}\d+\/M\/2022$/;
const response=(data,status=200,origin="")=>new Response(JSON.stringify(data),{status,headers:{"content-type":"application/json","cache-control":"no-store","x-content-type-options":"nosniff",...(origin===ORIGIN?{"access-control-allow-origin":ORIGIN,"vary":"Origin"}:{})}});
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
 if(verdict.success!==true||verdict.hostname!=="mamta-care-website.vercel.app")return response({ok:false,error:"Security check rejected"},403,origin);
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
  const a=await fetch(env.GOOGLE_FORM_BRIDGE_URL,{method:"POST",headers:{"content-type":"text/plain;charset=UTF-8"},body:JSON.stringify(requestBody),redirect:"follow"});
  if(!a.ok)throw Error("Google Form bridge request failed");
  const t=await a.text();if(t.length>20000)throw Error("Unrecognized bridge response");
  let answer;try{answer=JSON.parse(t)}catch{throw Error("Invalid bridge response")}
  if(answer.ok!==true||!official.test(String(answer.registration_id||"")))throw Error("Registration not confirmed");
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

export default {async fetch(req,env){
 const path=new URL(req.url).pathname,origin=req.headers.get("origin")||"";
 if(req.method==="GET"&&path==="/health")
  return response({ok:true,service:"mamta-website-form-first",accepting_submissions:env.REGISTRATION_ENABLED==="true"&&env.INTEGRATION_VERIFIED==="true",bridge_url_configured:validUrl(env.GOOGLE_FORM_BRIDGE_URL),bridge_secret_configured:!!env.GOOGLE_FORM_BRIDGE_SECRET});
 if(path==="/api/photos"&&req.method==="OPTIONS")return new Response(null,{status:204,headers:{"access-control-allow-origin":origin===PHOTO_APP_ORIGIN?PHOTO_APP_ORIGIN:"null","access-control-allow-methods":"POST,OPTIONS","access-control-allow-headers":"Content-Type","access-control-max-age":"300"}});
 if(path==="/api/photos"&&req.method==="POST")return uploadOfficialFormPhotos(req,env);
 if(path==="/api/register"&&req.method==="OPTIONS")
  return new Response(null,{status:204,headers:{"access-control-allow-origin":origin===ORIGIN?ORIGIN:"null","access-control-allow-methods":"POST,OPTIONS","access-control-allow-headers":"Content-Type","access-control-max-age":"300"}});
 if(path==="/api/register"&&req.method==="POST")return registration(req,env,origin);
 return response({ok:false,error:"Not found"},404,origin);
}};