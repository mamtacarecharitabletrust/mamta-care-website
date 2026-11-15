import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {Script,runInNewContext} from "node:vm";
import {webcrypto} from "node:crypto";

const worker=readFileSync("cloudflare/verified-email-relay-v8-addon.mjs","utf8");
const html=readFileSync("cloudflare/verified-email-relay-v8-admin.html","utf8");
const gs=readFileSync("apps-script/MamtaDeskNotificationRelay.gs","utf8");
const sql=readFileSync("cloudflare/migrations/20261115_notification_relay.sql","utf8");

test("Worker, Google Apps Script and nonce protected UI JavaScript parse",()=>{
 assert.doesNotThrow(()=>new Script(worker));
 assert.doesNotThrow(()=>new Script(gs));
 const match=/<script nonce="MCCT_WIG_NONCE_PLACEHOLDER">([\s\S]*?)<\/script>/i.exec(html);
 assert.ok(match?.[1]);
 assert.doesNotThrow(()=>new Script(match[1]));
});
test("no autonomous emails unless BOTH production and Apps Script flags are enabled",()=>{
 assert.match(worker,/MC_NOTIFICATION_EMAIL_ENABLED/);
 assert.match(worker,/if\(!env\?\.DB\|\|!mcctMailV8Enabled\(env\)\)/);
 assert.match(worker,/h\.ready_to_send/);
 assert.match(gs,/MCCT_NOTIFICATION_RELAY_ENABLE_SEND/);
 assert.match(gs,/MailApp\.getRemainingDailyQuota\(\)/);
});
test("existing original form registration emails are not duplicated",()=>{
 assert.match(worker,/o\.kind='FEEDBACK_EMAIL'/);
 assert.match(worker,/registration_emails_not_replaced:true/);
 assert.match(worker,/expiry_notifications_not_activated:true/);
 assert.doesNotMatch(worker,/action:"REGISTRATION_ACK"/);
});
test("only genuine completed/certificated/consented donors enter feedback queue",()=>{
 assert.match(worker,/d\.followup_status='Completed'/);
 assert.match(worker,/d\.source='google_sheet'/);
 assert.match(worker,/d\.consent='STRONGLY AGREE'/);
 assert.match(worker,/d\.certificate_url IS NOT NULL/);
 assert.match(worker,/LOWER\(TRIM\(d\.email\)\)=LOWER\(TRIM\(o\.target\)\)/);
 assert.match(worker,/NOT EXISTS\(SELECT 1 FROM mc_donor_recycle b/);
});
test("Script locks and reserves original outbox ID before sending MailApp",()=>{
 assert.match(gs,/LockService\.getScriptLock\(\)/);
 assert.match(gs,/writable\.appendRow\(\[id,kind,signature,'RESERVED'/);
 assert.ok(gs.indexOf("writable.appendRow([id,kind,signature,'RESERVED'")<gs.indexOf("MailApp.sendEmail("));
 assert.match(gs,/already_sent:true/);
 assert.match(gs,/UNKNOWN/);
 assert.match(gs,/do not auto retry/i);
 assert.match(gs,/MCCT_NOTIFICATION_ORIGINAL_RESPONSES/);
 assert.match(gs,/^\s*function mcDeskNotificationRelayPost_\(/m);
 assert.doesNotMatch(gs,/^\s*function doPost\(/m);
});
test("uncertain messages are not sent again; 32-character original D1 outbox IDs allowed",()=>{
 assert.match(gs,/\[0-9a-f\]\{32\}/);
 assert.match(worker,/MCCT_MAIL_V8_OUTBOX_ID/);
 assert.match(worker,/delivery_state='READY'/);
 assert.match(worker,/desk_notification_status/);
 assert.match(worker,/delivery_state='PENDING_CONFIGURATION'/);
 assert.match(worker,/20-Number\(count\?\.n\|\|0\)/);
 assert.match(worker,/mail_quota_remaining\)-10/);
});
test("full existing donor desk and scheduled imports remain untouched",()=>{
 assert.match(worker,/MCCT_MAIL_V8_PREVIOUS_FETCH\.call\(this,req,env,ctx\)/);
 assert.match(worker,/MCCT_MAIL_V8_PREVIOUS_SCHEDULED\.call\(this,controller,env,ctx\)/);
 assert.match(html,/src="\/volunteer-logo\.jpeg"/);
 assert.doesNotMatch(html,/data:image\/jpeg;base64/);
 assert.doesNotMatch(sql,/DELETE FROM|DROP TABLE|UPDATE donors/i);
});
test("disabled integration makes zero external calls and zero database writes",async()=>{
 const ctx={
  launch_wig_maker_portal_worker_default:{fetch:async()=>new Response("baseline"),scheduled:async()=>{}},
  mcctWigV3IST:()=>"2026-11-15",
  crypto:webcrypto,Response,Request,URL,Date,JSON,Math,Number,
  currentUser:async()=>({role:"admin",username:"admin"}),allowedWrite:()=>true,
  console:{error(){}},
  fetch:async()=>{throw Error("Unexpected external relay call")}
 };
 runInNewContext(worker,ctx);
 const result=await ctx.mcctMailV8Pump({DB:{prepare(){throw Error("Unexpected D1 operation")}}});
 assert.equal(result.enabled,false);
 assert.equal(result.sent,0);
 const baseline=await ctx.launch_wig_maker_portal_worker_default.fetch(new Request("https://example.com/known-donor-route"),{},{});
 assert.equal(await baseline.text(),"baseline");
});
test("only existing administrators can access private outbox",async()=>{
 const ctx={
  launch_wig_maker_portal_worker_default:{fetch:async()=>new Response("baseline"),scheduled:async()=>{}},
  currentUser:async()=>null,allowedWrite:()=>false,
  crypto:webcrypto,Response,Request,URL,Date,JSON,Math,Number,console:{error(){}}
 };
 runInNewContext(worker,ctx);
 const r=await ctx.launch_wig_maker_portal_worker_default.fetch(new Request("https://example.org/admin-notification-outbox"),{DB:{}},{});
 assert.equal(r.status,401);
});
