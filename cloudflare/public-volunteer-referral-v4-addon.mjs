/* Mamta Care volunteer expression-of-interest intake V4.
 * Existing approved Wig Desk intake, donor APIs, volunteer records, IDs,
 * agreements and scheduled imports remain unchanged.
 * Requires previous V3 Turnstile/HMAC helpers from deployed Worker.
 */
import {enabled as phonePeEnabled, sessionHash, orderId, prepareForm, checkoutRoute, reconcile} from './volunteer-phonepe.mjs';
import { volunteerLocations } from './volunteer-locations.mjs';
const MCCT_VOL_V4_PREV_FETCH=launch_wig_maker_portal_worker_default.fetch;
function mcctVolV4Fail(msg,status=400){return mcctWigV3Json({ok:false,error:msg},status)}
async function mcctVolV4Page(env,req){
 if(phonePeEnabled(env)){
  const browser=await sessionHash(req);
  if(browser&&await env.DB.prepare("SELECT 1 FROM mc_vol_phonepe WHERE session_hash=? AND state<>'paid'").bind(browser).first())return new Response(null,{status:303,headers:{Location:'/volunteer-checkout','Cache-Control':'no-store'}});
 }
 const key=mcctWigV3Str(env.TURNSTILE_SITE_KEY,100);
 if(!/^0x[A-Za-z0-9_-]{12,90}$/.test(key))return mcctVolV4Fail("Security verification unavailable",503);
 const source=MCCT_VOL_PUBLIC_HTML.replace('const mobileCheckout=false;',()=> 'const mobileCheckout='+phonePeEnabled(env)+';');
 return prepareForm(req,mcctWigV3SecureHTML(source.replace("MC_VOLUNTEER_LOCATIONS_JSON",()=>JSON.stringify(volunteerLocations).replaceAll("<","\\u003c")),true,key),env);
}
const volunteerRoleFees=new Map(Object.entries({"Hair collection & courier":999,"Professional hairstylist / barber":999,"Campus & donation drive":999,"Donor support":999,"Awareness & outreach":0,"Hospital & patient support":0,"Creative & translation":0,"Wig-making & workshop":0,"Help wherever needed":0}));
async function volunteerProof(file){
 if(!file||typeof file.slice!=='function'||file.size<8||file.size>5*1024*1024)return null;
 const head=new Uint8Array(await file.slice(0,8).arrayBuffer());
 const matches=bytes=>bytes.every((v,i)=>head[i]===v);
 const mime=matches([255,216,255])?'image/jpeg':matches([137,80,78,71,13,10,26,10])?'image/png':matches([37,80,68,70,45])?'application/pdf':null;
 return mime?{file,mime}:null;
}
async function mcctVolV4Submit(req,env){
 if(req.method!=="POST")return mcctVolV4Fail("Method not allowed",405);
 const origin=req.headers.get("Origin")||"";
 if(origin!==new URL(req.url).origin||req.headers.get("X-Mamta-Public")!=="1"||!/^multipart\/form-data;/i.test(req.headers.get("Content-Type")||""))return mcctVolV4Fail("Request verification failed",403);
 const limit=10*1024*1024+32768;
 if(Number(req.headers.get('content-length'))>limit)return mcctVolV4Fail('Documents exceed the upload limit.',413);
 let d;try{
  const reader=req.body.getReader(),chunks=[];let total=0;
  while(true){const {done,value}=await reader.read();if(done)break;total+=value.byteLength;if(total>limit){await reader.cancel();return mcctVolV4Fail('Documents exceed the upload limit.',413)}chunks.push(value)}
  d=Object.fromEntries(await new Response(new Blob(chunks),{headers:{'Content-Type':req.headers.get('content-type')}}).formData());
 }catch{return mcctVolV4Fail('Invalid application upload')}
 const name=mcctWigV3Str(d.full_name,110),rawPhone=mcctWigV3Str(d.phone,30),
       city=mcctWigV3Str(d.city==="__other"?d.city_other:d.city,100),profession=mcctWigV3Str(d.profession,80),
       interest=mcctWigV3Str(d.interest,70),notes=mcctWigV3Str(d.note,100),
       email=mcctWigV3Str(d.email,180),token=String(d["cf-turnstile-response"]||"");
 const digits=rawPhone.replace(/[^0-9]/g,"");
 const phone=digits.length===10?"+91"+digits:"+"+digits;
 const fee=volunteerRoleFees.get(interest);
 const state=String(d.state||''),district=String(d.district||'');
 const towns=Object.hasOwn(volunteerLocations,state)&&Object.hasOwn(volunteerLocations[state],district)?volunteerLocations[state][district]:null;
 if(!towns||(d.city!=='__other'&&!towns.includes(city))||(d.city==='__other'&&(typeof d.city_other!=='string'||d.city_other.trim().length>100)))return mcctVolV4Fail('Select your state, district and city.');
 if(fee&&d.fee_ack!=='on')return mcctVolV4Fail('Please acknowledge the scrutiny fee before submitting.');
 if(name.length<3||city.length<2||profession.length<2||digits.length<10||digits.length>15||fee===undefined||
    (!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email))||d.consent_confirmed!=="on"||d.privacy_accepted!=="on")return mcctVolV4Fail("Complete required details and consent");
 const proofs=await Promise.all([volunteerProof(d.address_proof),volunteerProof(d.id_proof)]);
 if(proofs.some(p=>!p))return mcctVolV4Fail('Attach both your address proof and government ID as JPEG, PNG or PDF files of up to 5 MB each.');
 if(!(await mcctWigV3Verify(req,env,token)))return mcctVolV4Fail("Security challenge failed. Please try again.",403);
 const today=mcctWigV3IST(),ts=Math.floor(Date.now()/1000);
 let contactKey,bucket;
 try{
  contactKey=await mcctWigV3Hash(env,"mcct:volunteer:phone:"+phone);
  bucket=await mcctWigV3Hash(env,"mcct:volunteer:ip:"+today+":"+(req.headers.get("CF-Connecting-IP")||"unknown"));
 }catch{return mcctVolV4Fail("Application service temporarily unavailable",503)}
 const automatic=Boolean(fee&&phonePeEnabled(env));
 const browser=automatic?await sessionHash(req):null;
 if(automatic&&!browser)return mcctVolV4Fail('Reload the application to start secure mobile checkout.',409);
 const resume=()=>mcctWigV3Json({ok:true,checkout:'/volunteer-checkout'},202);
 const receipt=fee&&!automatic?String(d.utr||'').trim():'';
 if(fee&&!automatic&&!/^[0-9]{12}$/.test(receipt))return mcctVolV4Fail("Enter the 12-digit UPI reference from your successful payment.");
 async function existing(){
  if(automatic){
   const same=await env.DB.prepare('SELECT i.contact_hash FROM mc_vol_phonepe g JOIN mcct_public_volunteer_intakes i ON i.referral_id=g.referral_id WHERE g.session_hash=?').bind(browser).first();
   if(same)return same.contact_hash===contactKey?resume():mcctVolV4Fail('This browser already has a payment application. Use a separate browser profile for another applicant.',409);
   return null;
  }
  if(!fee){const prior=await env.DB.prepare('SELECT i.referral_id FROM mcct_public_volunteer_intakes i JOIN mc_volunteer_proofs v ON v.referral_id=i.referral_id WHERE i.contact_hash=? AND i.day_ist=? AND v.role=?').bind(contactKey,today,interest).first();
   return prior?mcctWigV3Json({ok:true,received:true,reference:prior.referral_id.slice(0,8).toUpperCase()},202):null}
  const row=await env.DB.prepare("SELECT i.contact_hash,i.referral_id FROM mc_volunteer_payments p JOIN mcct_public_volunteer_intakes i ON i.referral_id=p.referral_id WHERE p.utr=?").bind(receipt).first();
  if(!row)return null;
  return row.contact_hash===contactKey?mcctWigV3Json({ok:true,received:true,reference:row.referral_id.slice(0,8).toUpperCase()},202):mcctVolV4Fail("This payment reference is already in use. Contact Mamta Care before making another payment.",409);
 }
 const previous=await existing();if(previous)return previous;
 const rate=await env.DB.prepare("INSERT INTO mcct_public_volunteer_rate(bucket,day_ist,submissions,updated_at) VALUES(?,?,1,?) ON CONFLICT(bucket) DO UPDATE SET submissions=submissions+1,updated_at=excluded.updated_at WHERE submissions<5").bind(bucket,today,ts).run();
 if((rate.meta?.changes||0)!==1)return mcctVolV4Fail("Daily submission limit reached. Contact Mamta Care directly.",429);
 const id=crypto.randomUUID();
 const summary=("Profession: "+profession+"; Interest: "+interest+(notes?"; Additional: "+notes:"")).slice(0,250);
 try{
  for(let i=0;i<proofs.length;i++)await env.VOLUNTEER_PROOFS.put(id+'/'+['address','identity'][i],proofs[i].file.stream(),{httpMetadata:{contentType:proofs[i].mime}});
  const inserted=await env.DB.batch([
    env.DB.prepare("INSERT INTO mca_referrals(id,referrer_type,referrer_id,name,email,phone,city,note,consent_confirmed,status,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)")
     .bind(id,"public_web","website_volunteer_form",name,email,phone,city,summary,1,automatic?"payment_draft":"pending",ts),
    env.DB.prepare("INSERT INTO mcct_public_volunteer_intakes(referral_id,contact_hash,day_ist,created_at) SELECT ?,?,?,? WHERE changes()=1")
     .bind(id,contactKey,today,ts),
    env.DB.prepare("INSERT INTO mc_volunteer_proofs(referral_id,role,fee,address_mime,id_mime) VALUES(?,?,?,?,?)").bind(id,interest,fee,proofs[0].mime,proofs[1].mime),
    env.DB.prepare("INSERT INTO mc_volunteer_locations(referral_id,state,district,city,fee_ack_version) VALUES(?,?,?,?,?)").bind(id,state,district,city,fee?'scrutiny-v1':null),
    ...(automatic?[env.DB.prepare('INSERT INTO mc_vol_phonepe(referral_id,session_hash,merchant_order) VALUES(?,?,?)').bind(id,browser,orderId())]:fee?[env.DB.prepare("INSERT INTO mc_volunteer_payments(referral_id,utr,amount) VALUES(?,?,?)").bind(id,receipt,fee)]:[])
  ]);
  if((inserted[0]?.meta?.changes||0)!==1||(inserted[1]?.meta?.changes||0)!==1)return mcctVolV4Fail("Application not confirmed; please contact Mamta Care",503);
  if(automatic)return resume();
  return mcctWigV3Json({ok:true,received:true,reference:id.slice(0,8).toUpperCase(),status:"pending",id_card_issued:false,approved:false,message:"Volunteer interest received for administrator review. No ID or status is issued automatically."},202);
 }catch(e){
  const committed=await env.DB.prepare('SELECT referral_id FROM mc_volunteer_proofs WHERE referral_id=?').bind(id).first();
  if(committed)return automatic?resume():mcctWigV3Json({ok:true,received:true,reference:id.slice(0,8).toUpperCase()},202);
  await env.VOLUNTEER_PROOFS.delete([id+'/address',id+'/identity']);
  if(String(e?.message||e).includes("UNIQUE"))return (await existing())||mcctVolV4Fail("An application is already on file today. Contact Mamta Care with your reference; do not pay again.",409);
  console.error("MCCT_VOLUNTEER_APPLY",String(e?.name||"Error"));
  return mcctVolV4Fail("Unable to record interest. Please try again later.",503);
 }
}
launch_wig_maker_portal_worker_default.fetch=async function(req,env,ctx){
 const path=new URL(req.url).pathname;
 if(path.startsWith('/volunteer-checkout')){const result=await checkoutRoute(req,env);if(result)return result}
 if(path==="/join-volunteer")return req.method==="GET"?mcctVolV4Page(env,req):mcctVolV4Fail("Method not allowed",405);
 if(path==="/api/public/volunteer-referrals")return mcctVolV4Submit(req,env);
 if(path==="/admin-ops"&&req.method==="GET"){
  const res=await MCCT_VOL_V4_PREV_FETCH.call(this,req,env,ctx);
  if(!res.ok||!String(res.headers.get("Content-Type")||"").includes("text/html"))return res;
  const text=await res.text(),anchor='<a class="tile" href="/app/volunteer-onboarding">';
  const extra='<a class="tile" href="/premium-v3/volunteer-review"><b>Volunteer Interest Reviews</b><small>Website applications enter existing volunteer referral and approval workflows</small></a>';
  return new Response(text.includes(anchor)?text.replace(anchor,extra+anchor):text,{status:res.status,headers:res.headers});
 }
 return MCCT_VOL_V4_PREV_FETCH.call(this,req,env,ctx);
};
