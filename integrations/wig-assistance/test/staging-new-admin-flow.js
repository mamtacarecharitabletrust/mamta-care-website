/**
 * STAGING ONLY: end-to-end admin test of a synthetic four-photo intake.
 * NEVER attach to the live worker or use with the original production D1.
 */
import {handleMamtaWigV8,wigProductionGuard,drainMamtaWigOutbox} from "./mcwig-v8.js";
const TEST_CASE="fa370aff-4fd8-438c-99b5-ceaca497036c";
const TEST_MAKER="d702c1d8-63b0-4b3a-a593-984ae2336b13";
const TEST_REG="2026/231101";
const exact=(a,b)=>{const x=new TextEncoder().encode(String(a||"")),y=new TextEncoder().encode(String(b||""));if(x.length!==y.length||x.length<48)return false;let v=0;for(let i=0;i<x.length;i++)v|=x[i]^y[i];return v===0};
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{"content-type":"application/json","cache-control":"no-store","x-content-type-options":"nosniff"}});
export async function verifyNewSyntheticAdminFlow(req,env){
 if(new URL(req.url).pathname!=="/internal/wig-new-admin-flow-test")return null;
 if(req.method!=="POST")return json({ok:false,error:"Method not allowed"},405);
 if(!exact(req.headers.get("X-Mamta-Wig-Bridge-Test"),env.WIG_SHEET_BRIDGE_SECRET))return json({ok:false,error:"Not authorized"},403);
 if(env.MC_WIG_ENABLED!=="false"||env.MC_WIG_STAGING_BRIDGE_READY!=="true"||env.MC_WIG_STAGING_SCRIPT_ID!=="AKfycbw-V3178QDvReoWn6RQgfH02-7T8qRjwk_om5qTAVLLkV1lkwGCMvHQAXOxoBiDRCQeVg")return json({ok:false,error:"Sandbox isolation gate failed"},503);
 const caseRow=await env.DB.prepare("SELECT id,registration_id,patient_name,email,phone,status,maker_id,maker_job_id,production_released_at FROM mcwig_cases_v1 WHERE id=?").bind(TEST_CASE).first();
 const maker=await env.DB.prepare("SELECT id,login_name,display_name,active,created_by FROM maker_accounts WHERE id=?").bind(TEST_MAKER).first();
 if(!caseRow||caseRow.registration_id!==TEST_REG||caseRow.patient_name!=="SYSTEM TEST INTAKE"||caseRow.email!=="test@example.invalid"||caseRow.phone!=="0000000000"||!["PENDING_REVIEW","APPROVED"].includes(caseRow.status)||!maker||maker.login_name!=="staging_cine_wigs_unusable"||maker.display_name!=="CINE WIGS"||maker.active!==1||maker.created_by!=="SYSTEM_STAGING_TEST")return json({ok:false,error:"Fictional test-only case or maker is unavailable"},409);
 const oldJobs=await env.DB.prepare("SELECT COUNT(*) AS n FROM maker_jobs WHERE reference=?").bind("MC-WIG-2026-231101").first();
 if(oldJobs.n>1||oldJobs.n===1&&caseRow.status!=="APPROVED")return json({ok:false,error:"Unexpected existing staging job; no further action"},409);
 const origin=new URL(req.url).origin,live={...env,MC_WIG_ENABLED:"true"};
 const get=(path)=>new Request(new URL(path,origin),{method:"GET"});
 const post=(path,body,headers)=>new Request(new URL(path,origin),{method:"POST",headers:{"origin":origin,"X-Mamta-Desk":"1","content-type":"application/json",...headers},body:JSON.stringify(body)});
 const detail="/api/admin/wig-v8/"+TEST_CASE;
 const guest=await handleMamtaWigV8(get(detail),live,null);
 const staff=await handleMamtaWigV8(get(detail+"/photos/front"),live,{role:"staff",username:"STAGING_STAFF"});
 const admin={role:"admin",username:"STAGING_TEST_ADMIN"};
 const originalPhoto=await handleMamtaWigV8(get(detail+"/photos/front"),live,admin);
 const photoOk=originalPhoto.ok&&String(originalPhoto.headers.get("content-type")).startsWith("image/png")&&originalPhoto.headers.get("cache-control")==="private,no-store";
 const photos=await env.DB.prepare("SELECT view FROM mcwig_photos_v1 WHERE case_id=? ORDER BY view").bind(TEST_CASE).all();
 const photoCount=photos.results?.length||0;
 if(guest.status!==401||staff.status!==401||!photoOk||photoCount!==4)return json({ok:false,error:"Patient privacy or admin photo retrieval failed",guestStatus:guest.status,staffStatus:staff.status,adminPhotoStatus:originalPhoto.status,photoCount},502);
 const unauthPost=await handleMamtaWigV8(post(detail+"/approve",{confirm_verification:true,review_note:"STAGING ONLY safe verification"},{"Origin":"https://unapproved.example.invalid"}),live,admin);
 if(unauthPost.status!==403)return json({ok:false,error:"Cross-origin admin approval was not blocked"},502);
 let approvalResponse;
 if(caseRow.status==="PENDING_REVIEW"){
   approvalResponse=await handleMamtaWigV8(post(detail+"/approve",{confirm_verification:true,review_note:"Four synthetic photos reviewed in isolated staging; fictional patient only"}),live,admin);
   if(!approvalResponse.ok)return json({ok:false,error:"Staging approval rejected",httpStatus:approvalResponse.status,details:(await approvalResponse.json()).error},502);
 }
 const idempotent=await handleMamtaWigV8(post(detail+"/approve",{confirm_verification:true,review_note:"Repeated synthetic approval request"}),live,admin);
 const duplicate=await idempotent.json();
 const c=await env.DB.prepare("SELECT id,registration_id,status,maker_id,maker_job_id,approved_at,production_released_at FROM mcwig_cases_v1 WHERE id=?").bind(TEST_CASE).first();
 const job=c?.maker_job_id?await env.DB.prepare("SELECT id,maker_id,reference,status,created_by,version FROM maker_jobs WHERE id=?").bind(c.maker_job_id).first():null;
 const jobs=await env.DB.prepare("SELECT COUNT(*) AS n FROM maker_jobs WHERE reference=?").bind("MC-WIG-2026-231101").first();
 const guard=c?.maker_job_id?await wigProductionGuard(env.DB,c.maker_job_id):null;
 const rejection=await handleMamtaWigV8(post(detail+"/release",{hair_ready:false,fitting_confirmed:true,conditions_confirmed:true}),live,admin);
 const guardAfter=c?.maker_job_id?await wigProductionGuard(env.DB,c.maker_job_id):null;
 const outbox=(await env.DB.prepare("SELECT kind,state FROM mcwig_outbox_v1 WHERE case_id=? ORDER BY kind").bind(TEST_CASE).all()).results||[];
 const event=(await env.DB.prepare("SELECT COUNT(*) AS n FROM mcwig_event_v1 WHERE case_id=? AND event_type='APPROVED'").bind(TEST_CASE).first());
 const ok=c?.status==="APPROVED"&&c.maker_id===TEST_MAKER&&job?.maker_id===TEST_MAKER&&job.status==="assigned"&&job.reference==="MC-WIG-2026-231101"&&jobs.n===1&&duplicate.already_approved===true&&guard===false&&guardAfter===false&&rejection.status===400&&c.production_released_at===null&&event.n===1&&outbox.some(x=>x.kind==="GOOGLE_SHEET_APPROVE"&&["PENDING","DONE"].includes(x.state))&&outbox.some(x=>x.kind==="APPROVAL_EMAIL"&&["PENDING","DONE"].includes(x.state))&&outbox.some(x=>x.kind==="GOOGLE_SHEET_CREATE"&&x.state==="DONE");
 if(!ok)return json({ok:false,error:"Stage admin security or assignment validation failed",stagingOnly:true,queuedActions:outbox,productionDBModified:false},502);
 const pinned="https://script.google.com/macros/s/AKfycbw-V3178QDvReoWn6RQgfH02-7T8qRjwk_om5qTAVLLkV1lkwGCMvHQAXOxoBiDRCQeVg/exec";
 if(String(env.WIG_SHEET_BRIDGE_URL)!==pinned)return json({ok:false,error:"Test Google Apps Script URL not pinned to isolated sandbox",productionDBModified:false},409);
 let sandboxVerified=false;
 try{const v=await fetch(pinned,{method:"GET",redirect:"follow",signal:AbortSignal.timeout(12000)});const result=v.ok?await v.json():null;sandboxVerified=result?.service==="Mamta Care Wig Database Bridge — SANDBOX ONLY"}catch{}
 if(!sandboxVerified)return json({ok:false,error:"Sandbox bridge identity verification failed; no queue delivery attempted"},409);
 const delivery=await drainMamtaWigOutbox(env,8);
 const completed=(await env.DB.prepare("SELECT kind,state,attempts FROM mcwig_outbox_v1 WHERE case_id=? ORDER BY kind").bind(TEST_CASE).all()).results||[];
 const allDone=["GOOGLE_SHEET_CREATE","REGISTRATION_EMAIL","GOOGLE_SHEET_APPROVE","APPROVAL_EMAIL"].every(kind=>completed.some(x=>x.kind===kind&&x.state==="DONE"));
 return json({ok:allDone&&delivery.failed===0,stagingOnly:true,registrationId:TEST_REG,patientPhotoAccess:{unauthenticatedBlocked:true,staffBlocked:true,administratorPhotoVerified:photoOk,photos:photoCount},administratorApproval:true,CINEWIGSStagingAssignment:true,manufacturingOrderCount:jobs.n,duplicateApprovalPrevented:true,productionReleaseStillBlocked:true,approvalEventExactlyOnce:true,googleSandboxBridgeVerified:true,approvalSyncDelivered:completed.some(x=>x.kind==="GOOGLE_SHEET_APPROVE"&&x.state==="DONE"),approvalEmailSimulated:completed.some(x=>x.kind==="APPROVAL_EMAIL"&&x.state==="DONE"),automaticQueueFunction:delivery,queuedActions:completed,realManufacturerUntouched:true,patientEmailsSent:0,productionDBModified:false},allDone&&delivery.failed===0?200:502);
}
