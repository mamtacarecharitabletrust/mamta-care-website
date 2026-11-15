import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {Script,runInNewContext} from "node:vm";

const code=readFileSync("cloudflare/verified-email-gated-expiry-v9-addon.mjs","utf8");
const page=readFileSync("cloudflare/verified-email-gated-expiry-v9-admin.html","utf8");

test("Worker V9 and private admin JS parse",()=>{
 assert.doesNotThrow(()=>new Script(code));
 const inline=/<script nonce="MCCT_WIG_NONCE_PLACEHOLDER">([\s\S]*?)<\/script>/i.exec(page);
 assert.ok(inline?.[1]);
 assert.doesNotThrow(()=>new Script(inline[1]));
});
test("expiry explicitly requires working MailApp plus independent owner opt-in",()=>{
 assert.match(code,/mcctMailV8Enabled\(env\)&&String\(env\?\.MC_NOTIFICATION_EXPIRY_ENABLED/);
 assert.match(code,/mcctMailV8Health\(env\)/);
 assert.match(code,/health\.ready_to_send/);
 assert.match(code,/mcctExpiryV9DailyCap\(env\)/);
 assert.match(code,/MC_NOTIFICATION_EXPIRY_DAILY_CAP/);
});
test("no-one with recorded hair movement, verified donor or binned record can expire",()=>{
 assert.match(code,/d\.updated_at<\?/);
 assert.match(code,/q\.last_updated_at=d\.updated_at/);
 assert.match(code,/q\.decision='PENDING'/);
 assert.match(code,/d\.followup_status IN \('Pending','Not answered','Call again'\)/);
 assert.match(code,/d\.consent='STRONGLY AGREE'/);
 assert.match(code,/mc_donor_recycle/);
 assert.match(code,/mcq_donor_couriers/);
 assert.match(code,/mcct_parcel_receipts/);
 assert.match(code,/mcct_hand_collections/);
 assert.match(code,/mcct_staff_hand_collections/);
 assert.match(code,/mcct_ops_hair_lots/);
 assert.match(code,/verification_status/);
 assert.match(code,/certificate_url/);
});
test("staging notices is not sending or status mutation",()=>{
 const begin=code.indexOf("async function mcctExpiryV9Stage");
 const end=code.indexOf("async function mcctExpiryV9Reconcile",begin);
 const s=code.slice(begin,end);
 assert.match(s,/INSERT OR IGNORE INTO mcct_ops_notification_outbox/);
 assert.match(s,/EXPIRY_EMAIL/);
 assert.doesNotMatch(s,/MailApp|UPDATE donors|delivery_state='SENT'/);
});
test("expiry requires 24-hour sender-acknowledged grace, audit and optimistic version",()=>{
 assert.match(code,/grace=ts-86400/);
 assert.match(code,/o\.delivery_state='SENT'/);
 assert.match(code,/o\.sent_at<=\?/);
 assert.match(code,/UPDATE donors SET followup_status='Expired'/);
 assert.match(code,/version=version\+1/);
 assert.match(code,/mcct_ops_donor_status_events/);
 assert.match(code,/INSERT INTO donor_events/);
 assert.match(code,/mcct_ops_expiry_review SET decision='APPROVED'/);
 assert.match(code,/result\.every\(x=>\(x\.meta\?\.changes\|\|0\)===1\)/);
 assert.doesNotMatch(code,/DELETE FROM donors|UPDATE donors SET.*registration_id/);
});
test("real registered donor history and two-minute cron retain previous worker",()=>{
 assert.match(code,/MCCT_EXP_V9_PREV_FETCH\.call\(this,req,env,ctx\)/);
 assert.match(code,/MCCT_EXP_V9_PREV_SCHEDULED\.call\(this,controller,env,ctx\)/);
 assert.match(code,/ctx\.waitUntil/);
 assert.match(page,/src="\/volunteer-logo\.jpeg"/);
 assert.doesNotMatch(page,/data:image\/jpeg;base64/);
});
test("disabled expiry cannot send email or mark donor Expired",async()=>{
 let queries=0,posts=0;
 const context={
  launch_wig_maker_portal_worker_default:{fetch:async()=>new Response("baseline"),scheduled:async()=>{}},
  mcctMailV8Enabled:()=>false,
  mcctMailV8Err:(message,status)=>new Response(JSON.stringify({ok:false,error:message}),{status}),
  mcctWigV3SecureHTML:()=>new Response("secured"),
  mcctMailV8Json:value=>new Response(JSON.stringify(value)),
  mcctMailV8Call:async()=>{posts++;throw Error("No relay call allowed")},
  Response,Request,URL,Date,Math,Number,JSON,console:{error(){}},
  currentUser:async()=>({role:"admin",username:"admin"}),allowedWrite:()=>true
 };
 runInNewContext(code,context);
 const db={prepare(sql){
  queries++;
  return {bind(){return{async run(){return{meta:{changes:3}}}}}};
 }};
 const result=await context.mcctExpiryV9Stage({DB:db});
 assert.equal(result.queued,3);
 assert.equal(queries,1);
 const state=await context.mcctExpiryV9Finalize({DB:db});
 assert.equal(state.closed,0);
 assert.equal(posts,0);
});
test("admin status is restricted and staging POST requires origin verification",async()=>{
 const context={
  launch_wig_maker_portal_worker_default:{fetch:async()=>new Response("baseline"),scheduled:async()=>{}},
  currentUser:async()=>null,allowedWrite:()=>false,
  mcctMailV8Err:(message,status)=>new Response(JSON.stringify({ok:false,error:message}),{status}),
  Response,Request,URL,Date,Math,Number,JSON,console:{error(){}}
 };
 runInNewContext(code,context);
 const response=await context.launch_wig_maker_portal_worker_default.fetch(
  new Request("https://example.com/admin-expiry-automation"),{DB:{}},{});
 assert.equal(response.status,401);
});
