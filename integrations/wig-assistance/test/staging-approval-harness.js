/**
 * Dedicated staging-only approval test. Never include in live Worker.
 * Authenticates a private test key then runs real wig module admin approval
 * with a synthetic staging case and staging-only inactive credential maker.
 */
import {handleMamtaWigV8, wigProductionGuard} from "./mcwig-v8.js";
import {testWigBridgeFromStaging} from "./diagnostic.js";
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
export default {
 async fetch(req,env){
  const diagnostic=await testWigBridgeFromStaging(req,env);if(diagnostic)return diagnostic;
  const approval=await wigApprovalTest(req,env);if(approval)return approval;
  const path=new URL(req.url).pathname;
  if(req.method==="GET"&&path==="/health"){
   const count=await env.DB.prepare("SELECT COUNT(*) AS cases FROM mcwig_cases_v1").first();
   return json({ok:true,staging:true,case_count:count?.cases||0,publicIntakeEnabled:env.MC_WIG_ENABLED==="true"});
  }
  return (await handleMamtaWigV8(req,env,null))||new Response("Not found",{status:404});
 }
}