// STAGING ONLY. Synthetic 4-image public intake E2E test; no real patient data.
import {handleMamtaWigV8} from "./mcwig-v8.js";
const TEST_IDEMPOTENCY="d0ab0c24-f880-4595-8e92-b85c64b82403";
const PHOTO_PNG_B64="iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAIAAAAmkwkpAAAAz3RFWHRTb2Z0d2FyZQBNYW10YSBDYXJlIHN5bnRoZXRpYyBpbnRha2UgcGhvdG8gc2FuZGJveCB0ZXN0IC0tIG5vIHJlYWwgcGF0aWVudCBNYW10YSBDYXJlIHN5bnRoZXRpYyBpbnRha2UgcGhvdG8gc2FuZGJveCB0ZXN0IC0tIG5vIHJlYWwgcGF0aWVudCBNYW10YSBDYXJlIHN5bnRoZXRpYyBpbnRha2UgcGhvdG8gc2FuZGJveCB0ZXN0IC0tIG5vIHJlYWwgcGF0aWVudCCZSIo7AAAAFElEQVR4nGPkq+higAEmBiSAmwMANagBGDVgZScAAAAASUVORK5CYII=";
const PHOTO_VIEWS=["front","back","left","right"];
const TEST_EMAIL="test@example.invalid";
function json(x,status=200){return new Response(JSON.stringify(x),{status,headers:{"content-type":"application/json","cache-control":"no-store","x-content-type-options":"nosniff"}})}
function fixedSecretEqual(a,b){const e=new TextEncoder(),x=e.encode(String(a||"")),y=e.encode(String(b||""));if(x.length!==y.length||x.length<48)return false;let diff=0;for(let i=0;i<x.length;i++)diff|=x[i]^y[i];return diff===0}
function intakeRequest(env,origin){
 const p={name:"SYSTEM TEST INTAKE",email:TEST_EMAIL,phone:"0000000000",city:"TEST",idempotency_key:TEST_IDEMPOTENCY,
  privacy:true,terms:true,cancerRelated:"Yes",hairLoss:"Yes",hairSource:"donated",
  wigLength:"Medium",wigColor:"Natural Black",texture:"Straight",capSize:"To confirm",
  mediaTraining:false,mediaPublic:false};
 const b=new Uint8Array(Array.from(atob(PHOTO_PNG_B64),c=>c.charCodeAt(0)));
 const form=new FormData();form.set("patient",JSON.stringify(p));form.set("turnstile","XXXX.DUMMY.TOKEN.XXXX");
 for(const view of PHOTO_VIEWS)form.set(view,new File([b],view+".png",{type:"image/png"}));
 return new Request(new URL("/api/public/wig-v8",origin),{method:"POST",
   headers:{"Origin":origin,"X-Mamta-Public":"1"},body:form});
}
export async function testStagingIntake(req,env){
 if(req.method!=="POST"||new URL(req.url).pathname!=="/internal/wig-intake-test")return null;
 if(!fixedSecretEqual(req.headers.get("X-Mamta-Wig-Bridge-Test"),env.WIG_SHEET_BRIDGE_SECRET))return json({ok:false,error:"Unauthorized"},403);
 if(env.MC_WIG_ENABLED!=="false"||env.MC_WIG_STAGING_BRIDGE_READY!=="true")return json({ok:false,error:"Staging environment not locked"},503);
 if(env.TURNSTILE_SECRET_KEY!=="1x0000000000000000000000000000000AA")return json({ok:false,error:"Staging Turnstile test key missing"},503);
 const origins=String(env.MC_WIG_ALLOWED_ORIGINS||"").split(",").map(x=>x.trim());
 const origin="https://mamta-care-website.vercel.app";
 if(!origins.includes(origin))return json({ok:false,error:"Staging Origin missing"},503);
 const fakeEnv={...env,MC_WIG_ENABLED:"true"};
 const first=await handleMamtaWigV8(intakeRequest(env,origin),fakeEnv,null);
 const one=await first.json().catch(()=>({error:"Invalid intake response"}));
 if(!first.ok||!one.ok)return json({ok:false,phase:"first_photo_upload",status:first.status,serverResponse:one},502);
 const second=await handleMamtaWigV8(intakeRequest(env,origin),fakeEnv,null);
 const two=await second.json().catch(()=>({error:"Invalid duplicate response"}));
 const idrow=await env.DB.prepare("SELECT c.id,c.registration_id,c.patient_name,c.email,c.phone,c.status FROM mcwig_cases_v1 c JOIN mcwig_idempotency_v1 i ON i.case_id=c.id WHERE i.idempotency_key=?").bind(TEST_IDEMPOTENCY).first();
 if(!idrow||idrow.patient_name!=="SYSTEM TEST INTAKE"||idrow.email!==TEST_EMAIL||idrow.phone!=="0000000000"||idrow.registration_id!==one.registration_id)return json({ok:false,error:"Synthetic intake registration was not stored correctly"},502);
 const photoRows=await env.DB.prepare("SELECT view,object_key,byte_size FROM mcwig_photos_v1 WHERE case_id=? ORDER BY view").bind(idrow.id).all();
 const imgs=photoRows.results||[];
 const checks=await Promise.all(imgs.map(async photo=>{const obj=await env.DONOR_PHOTOS.head(photo.object_key);return {view:photo.view,exists:!!obj,size:obj?.size||0}}));
 const tasks=await env.DB.prepare("SELECT kind,state FROM mcwig_outbox_v1 WHERE case_id=? ORDER BY kind").bind(idrow.id).all();
 const all=tasks.results||[];
 const ids=await env.DB.prepare("SELECT COUNT(*) AS copies FROM mcwig_cases_v1 WHERE id=?").bind(idrow.id).first();
 const ok=second.ok&&two.ok&&two.already_received===true&&two.registration_id===one.registration_id&&checks.length===4&&checks.every(x=>x.exists&&x.size>100)&&idrow.status==="PENDING_REVIEW"&&ids.copies===1&&all.length===2&&all.every(x=>x.state==="PENDING")&&all.some(x=>x.kind==="GOOGLE_SHEET_CREATE")&&all.some(x=>x.kind==="REGISTRATION_EMAIL");
 return json({ok,stagingOnly:true,registration_id:one.registration_id,photosUploaded:checks.length,photoViews:checks.map(x=>x.view),photoObjectsVerified:checks.every(x=>x.exists&&x.size>100),registeredExactlyOnce:ids.copies===1,duplicateSubmissionBlocked:two.already_received===true,applicationStatus:idrow.status,queue:all,syntheticDataOnly:true,productionDatabaseTouched:false,realEmailsSent:0,remaining:"Google sandbox bridge allows only prior test ID 2099/010199, so this new case's queue must not be delivered before sandbox guard is updated."},ok?200:502);
}
