/**
 * Dedicated staging-only approval test. Never include in live Worker.
 * Authenticates a private test key then runs real wig module admin approval
 * with a synthetic staging case and staging-only inactive credential maker.
 */
import {handleMamtaWigV8, wigProductionGuard, syncMamtaMakerJobUpdate, drainMamtaWigOutbox} from "./mcwig-v8.js";
import {testWigBridgeFromStaging} from "./diagnostic.js";
import {testStagingIntake} from "./synthetic-intake.js";
import {verifyProductionWigBridgeNoWrite} from "./production-probe.js";
const TEST_CASE="8bd2e2b6-7a2c-4f70-bbf9-705a40c566b3";
const TEST_MAKER="d702c1d8-63b0-4b3a-a593-984ae2336b13";
function equal(a,b){
 a=new TextEncoder().encode(String(a||""));b=new TextEncoder().encode(String(b||""));
 if(a.length!==b.length||a.length<48)return false;
 let diff=0;for(let i=0;i<a.length;i++)diff|=a[i]^b[i];return diff===0;
}
function json(x,status=200){return new Response(JSON.stringify(x),{status,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store","x-content-type-options":"nosniff"}})}
async function wigApprovalTest(req,env){
 if(req.method!=="POST"||new URL(req.url).pathname!=="/internal/wig-approval-test")return null;
 if(!equal(req.headers.get("X-Mamta-Wig-Bridge-Test"),env.WIG_SHEET_BRIDGE_SECRET))return json({ok:false,error:"Unauthorized"},403);
 if(env.MC_WIG_ENABLED!=="false")return json({ok:false,error:"Staging public intake must remain disabled"},503);
 const c=await env.DB.prepare("SELECT id,registration_id,patient_name,status,maker_job_id FROM mcwig_cases_v1 WHERE id=?").bind(TEST_CASE).first();
 const maker=await env.DB.prepare("SELECT id,login_name,active,created_by FROM maker_accounts WHERE id=?").bind(TEST_MAKER).first();
 if(!c||c.patient_name!=="SYSTEM TEST ONLY"||c.registration_id!=="2099/010199"||!maker||maker.login_name!=="staging_cine_wigs_unusable"||maker.created_by!=="SYSTEM_STAGING_TEST"||maker.active!==1){
  return json({ok:false,error:"Synthetic staging fixtures missing or changed"},409);
 }
 const origin=new URL(req.url).origin;
 const syntheticAdminRequest=new Request(new URL("/api/admin/wig-v8/"+TEST_CASE+"/approve",origin),{
  method:"POST",headers:{"origin":origin,"X-Mamta-Desk":"1","content-type":"application/json"},
  body:JSON.stringify({confirm_verification:true,review_note:"Synthetic staging-only approval test; no actual patient"})
 });
 const approvalResponse=await handleMamtaWigV8(syntheticAdminRequest,{...env,MC_WIG_ENABLED:"true"},{role:"admin",username:"STAGING_TEST_ADMIN"});
 const approval=await approvalResponse.json();
 const approved=await env.DB.prepare("SELECT id,status,maker_id,maker_job_id,production_released_at FROM mcwig_cases_v1 WHERE id=?").bind(TEST_CASE).first();
 const job=approved?.maker_job_id?await env.DB.prepare("SELECT id,maker_id,status,reference FROM maker_jobs WHERE id=?").bind(approved.maker_job_id).first():null;
 const guardAllowed=approved?.maker_job_id?await wigProductionGuard(env.DB,approved.maker_job_id):null;
 const events=approved?.maker_job_id?await env.DB.prepare("SELECT action FROM maker_events WHERE job_id=?").bind(approved.maker_job_id).all():null;
 const outbox=await env.DB.prepare("SELECT kind,state FROM mcwig_outbox_v1 WHERE case_id=? ORDER BY kind").bind(TEST_CASE).all();
 const ok=approvalResponse.ok&&approval.ok===true&&approved?.status==="APPROVED"&&approved?.maker_id===TEST_MAKER&&job?.maker_id===TEST_MAKER&&job?.status==="assigned"&&guardAllowed===false&&approved?.production_released_at===null&&(events?.results||[]).some(x=>x.action==="maker_job_assigned")&&(outbox.results||[]).some(x=>x.kind==="GOOGLE_SHEET_APPROVE")&&(outbox.results||[]).some(x=>x.kind==="APPROVAL_EMAIL");
 return json({ok,stagingOnly:true,registration_id:"2099/010199",approvalAction:approval.ok===true?"PASS":"FAIL",manufacturerAssignment:job?.maker_id===TEST_MAKER?"CINE WIGS staging fixture assigned":"FAIL",orderStatus:job?.status||null,manufacturingBlockedUntilAdminRelease:guardAllowed===false,approvalSheetSyncQueued:(outbox.results||[]).some(x=>x.kind==="GOOGLE_SHEET_APPROVE"),approvalEmailQueued:(outbox.results||[]).some(x=>x.kind==="APPROVAL_EMAIL"),realEmailsSent:false,productionDBTouched:false,warning:ok?undefined:(approval.error||"Review staging results")},ok?200:502);
}

async function wigReleaseAndMakerProgressTest(req,env){
 if(req.method!=="POST"||new URL(req.url).pathname!=="/internal/wig-release-test")return null;
 if(!equal(req.headers.get("X-Mamta-Wig-Bridge-Test"),env.WIG_SHEET_BRIDGE_SECRET))
  return json({ok:false,error:"Unauthorized"},403);
 if(env.MC_WIG_ENABLED!=="false")return json({ok:false,error:"Staging public intake must remain disabled"},503);
 const c=await env.DB.prepare("SELECT id,registration_id,patient_name,status,maker_id,maker_job_id,production_released_at FROM mcwig_cases_v1 WHERE id=?").bind(TEST_CASE).first();
 const maker=await env.DB.prepare("SELECT id,login_name,created_by FROM maker_accounts WHERE id=?").bind(TEST_MAKER).first();
 if(!c||c.patient_name!=="SYSTEM TEST ONLY"||c.registration_id!=="2099/010199"||c.status!=="APPROVED"||c.maker_id!==TEST_MAKER||!c.maker_job_id||!maker||maker.login_name!=="staging_cine_wigs_unusable"||maker.created_by!=="SYSTEM_STAGING_TEST")
  return json({ok:false,error:"Approved synthetic staging fixtures missing or changed"},409);
 const origin=new URL(req.url).origin;
 const requestFor=(body)=>new Request(new URL("/api/admin/wig-v8/"+TEST_CASE+"/release",origin),{
  method:"POST",headers:{"origin":origin,"X-Mamta-Desk":"1","content-type":"application/json"},
  body:JSON.stringify(body)
 });
 let rejectionPass=true,releasePass=true,alreadyReleased=c.production_released_at!==null;
 if(!alreadyReleased){
  const refused=await handleMamtaWigV8(requestFor({hair_ready:false,fitting_confirmed:true,conditions_confirmed:true}),{...env,MC_WIG_ENABLED:"true"},{role:"admin",username:"STAGING_TEST_ADMIN"});
  rejectionPass=refused.status===400;
  const guardBefore=await wigProductionGuard(env.DB,c.maker_job_id);
  if(guardBefore!==false)return json({ok:false,error:"Manufacturing was not blocked before release"},502);
  const approved=await handleMamtaWigV8(requestFor({hair_ready:true,fitting_confirmed:true,conditions_confirmed:true}),{...env,MC_WIG_ENABLED:"true"},{role:"admin",username:"STAGING_TEST_ADMIN"});
  const body=await approved.json();
  releasePass=approved.ok&&body.released===true;
 }
 const updated=await env.DB.prepare("SELECT id,production_released_at FROM mcwig_cases_v1 WHERE id=?").bind(TEST_CASE).first();
 const guardAfter=await wigProductionGuard(env.DB,c.maker_job_id);
 let job=await env.DB.prepare("SELECT id,maker_id,status,version FROM maker_jobs WHERE id=?").bind(c.maker_job_id).first();
 if(!job||job.maker_id!==TEST_MAKER)return json({ok:false,error:"Staging manufacturer order not found"},502);
 if(job.status==="assigned"){
  await env.DB.prepare("UPDATE maker_jobs SET status='in_progress',version=version+1,updated_at=? WHERE id=? AND maker_id=? AND status='assigned'").bind(Math.floor(Date.now()/1000),job.id,TEST_MAKER).run();
 }
 job=await env.DB.prepare("SELECT id,maker_id,status,version FROM maker_jobs WHERE id=?").bind(c.maker_job_id).first();
 const sync=await syncMamtaMakerJobUpdate({...env,MC_WIG_ENABLED:"true"},job.id);
 const statusKind="MAKER_STATUS_V"+String(job.version);
 const queued=await env.DB.prepare("SELECT kind,state FROM mcwig_outbox_v1 WHERE case_id=? ORDER BY kind").bind(TEST_CASE).all();
 const progressEvent=await env.DB.prepare("SELECT COUNT(*) AS count FROM mcwig_event_v1 WHERE case_id=? AND event_type='MAKER_PROGRESS'").bind(TEST_CASE).first();
 const releasedEvent=await env.DB.prepare("SELECT COUNT(*) AS count FROM mcwig_event_v1 WHERE case_id=? AND event_type='PRODUCTION_RELEASED'").bind(TEST_CASE).first();
 const s=(queued.results||[]).find(x=>x.kind===statusKind);
 const ok=rejectionPass&&releasePass&&updated?.production_released_at!==null&&guardAfter===true&&job.status==="in_progress"&&job.version>=2&&sync.linked===true&&s?.state==="PENDING"&&(releasedEvent?.count||0)>0&&(progressEvent?.count||0)>0;
 return json({ok,stagingOnly:true,preReleaseChecksEnforced:rejectionPass,administratorProductionRelease:releasePass&&updated.production_released_at!==null,manufacturingUnblockedAfterApproval:guardAfter===true,manufacturingStatus:job.status,manufacturingStatusVersion:job.version,donorDeskStatusEventLogged:(progressEvent?.count||0)>0,googleSheetStatusUpdateQueued:s?.state==="PENDING",queuedActions:(queued.results||[]).map(x=>({kind:x.kind,state:x.state})),emailsSent:0,realManufacturerOrdersCreated:0,productionDatabaseModified:false},ok?200:502);
}


const LIVE_APPS_SCRIPT_ID="AKfycbxwFsJBYmHYBuMdDIOgMZ7oriDQXeD2-PeNlm9vKjUNjc61bhh6qOsbLdT17mVLDCgaaA";
function sandboxBridgeConfig(env){
 if(env.MC_WIG_ENABLED!=="false"||env.MC_WIG_STAGING_BRIDGE_READY!=="true")return null;
 const expected=String(env.MC_WIG_STAGING_SCRIPT_ID||"");
 if(expected.length<35||expected===LIVE_APPS_SCRIPT_ID||!/^[-_A-Za-z0-9]+$/.test(expected))return null;
 let u;try{u=new URL(String(env.WIG_SHEET_BRIDGE_URL||""))}catch{return null}
 if(u.hostname!=="script.google.com"||u.protocol!=="https:"||u.pathname!=="/macros/s/"+expected+"/exec")return null;
 return u;
}
async function verifySandboxBridge(env){
 const url=sandboxBridgeConfig(env);if(!url)return false;
 try{
  const response=await fetch(url.toString(),{method:"GET",redirect:"follow",signal:AbortSignal.timeout(10000)});
  if(!response.ok)return false;
  const result=await response.json();
  return result?.service==="Mamta Care Wig Database Bridge — SANDBOX ONLY";
 }catch{return false}
}
async function wigOutboxTest(req,env){
 const pathname=new URL(req.url).pathname;
 if(pathname!=="/internal/wig-outbox-test")return null;
 if(req.method!=="POST")return json({ok:false,error:"Method not supported"},405);
 if(!equal(req.headers.get("X-Mamta-Wig-Bridge-Test"),env.WIG_SHEET_BRIDGE_SECRET))return json({ok:false,error:"Unauthorized"},403);
 const verified=await verifySandboxBridge(env);
 if(!verified)return json({ok:false,error:"Test-only Google Apps Script deployment was not verified; no queue delivery attempted"},409);
 const caseRow=await env.DB.prepare("SELECT id,registration_id,patient_name,email FROM mcwig_cases_v1 WHERE id=?").bind(TEST_CASE).first();
 if(caseRow?.registration_id!=="2099/010199"||caseRow.patient_name!=="SYSTEM TEST ONLY"||caseRow.email!=="test@example.invalid")return json({ok:false,error:"Synthetic staging case has changed"},409);
 const result=await drainMamtaWigOutbox(env,8);
 const statuses=await env.DB.prepare("SELECT kind,state,attempts FROM mcwig_outbox_v1 WHERE case_id=? ORDER BY kind").bind(TEST_CASE).all();
 return json({ok:result.ok!==false&&result.failed===0,bridgeVerifiedAsSandbox:true,automaticOutboxFunctionInvoked:true,delivery:result,queuedStatuses:statuses.results||[],productionDatabaseTouched:false,patientEmailsActuallySent:0},result.failed?502:200);
}

export default {
 async fetch(req,env){
  const diagnostic=await testWigBridgeFromStaging(req,env);if(diagnostic)return diagnostic;
  const synthetic=await testStagingIntake(req,env);if(synthetic)return synthetic;
  const productionProbe=await verifyProductionWigBridgeNoWrite(req,env);if(productionProbe)return productionProbe;
  const approval=await wigApprovalTest(req,env);if(approval)return approval;
  const release=await wigReleaseAndMakerProgressTest(req,env);if(release)return release;
  const outbox=await wigOutboxTest(req,env);if(outbox)return outbox;
  const path=new URL(req.url).pathname;
  if(req.method==="GET"&&path==="/health"){
   const count=await env.DB.prepare("SELECT COUNT(*) AS cases FROM mcwig_cases_v1").first();
   return json({ok:true,staging:true,case_count:count?.cases||0,publicIntakeEnabled:env.MC_WIG_ENABLED==="true"});
  }
  return (await handleMamtaWigV8(req,env,null))||new Response("Not found",{status:404});
 },
 async scheduled(event,env,ctx){
  if(!sandboxBridgeConfig(env))return;
  ctx.waitUntil((async()=>{
   if(!await verifySandboxBridge(env))return;
   await drainMamtaWigOutbox(env,8);
  })().catch(e=>console.error('WIG_SANDBOX_SCHEDULED_TEST',e?.name||'Error')));
 }
}