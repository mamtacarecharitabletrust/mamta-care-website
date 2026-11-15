import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {runInNewContext,Script} from "node:vm";
import {webcrypto} from "node:crypto";

const addon=readFileSync("cloudflare/public-hair-tracking-v5-addon.mjs","utf8");
const page=readFileSync("cloudflare/public-hair-tracking-form.html","utf8");
const migration=readFileSync("cloudflare/migrations/20261115_public_tracking.sql","utf8");

function fakeDB(overrides={}){
 const {donor=null,courier=null,parcel=null,hand=null,staffHand=null,inventory=null,blocked=false}=overrides;
 return {prepare(sql){
   return {bind(...values){
     return {
       async run(){return {meta:{changes:blocked?0:1}};},
       async all(){
         if(sql.includes("FROM donors d LEFT JOIN mc_donor_recycle"))return {results:donor?[donor]:[]};
         return {results:[]};
       },
       async first(){
         if(sql.includes("FROM mcq_donor_couriers"))return courier;
         if(sql.includes("FROM mcct_parcel_receipts"))return parcel;
         if(sql.includes("FROM mcct_hand_collections"))return hand;
         if(sql.includes("FROM mcct_staff_hand_collections"))return staffHand;
         if(sql.includes("FROM mcct_ops_hair_lots"))return inventory;
         return null;
       }
     };
   }};
 }};
}
const validDonor={
 id:"3f318d20-73da-446c-8ac3-486b00ec0acb",registration_id:"2026-101104/M/2022",
 phone:"8500012190",followup_status:"Pending",verification_status:"",updated_at:1794658800,binned:0
};
function worker({verify=true}={}){
 const ctx={
   launch_wig_maker_portal_worker_default:{fetch:async()=>new Response("previous"),scheduled:async()=>{}},
   mcctWigV3Body:async(req)=>req.json(),
   mcctWigV3Verify:async()=>verify,
   mcctWigV3Hash:async()=>"e".repeat(64),
   mcctWigV3SecureHTML:html=>new Response(html,{headers:{"Content-Type":"text/html"}}),
   MCCT_TRACK_V5_HTML:"<html>tracking</html>",
   console:{error(){}},URL,Response,Request,Math,Date,Intl,TextEncoder,crypto:webcrypto,
 };
 runInNewContext(addon,ctx);
 return ctx.launch_wig_maker_portal_worker_default;
}
function lookup(w,db,extra={}){
 const origin="https://mamta-donor-desk-launch-new.bharathairseva-in.workers.dev";
 const r=new Request(origin+"/api/public/hair-tracking",{
  method:"POST",
  headers:{"Origin":origin,"X-Mamta-Public":"1","Content-Type":"application/json"},
  body:JSON.stringify({registration_id:"2026-101104/M/2022",phone_last4:"2190",cf_turnstile_response:"a".repeat(32),...extra})
 });
 return w.fetch(r,{DB:db}, {waitUntil(){}});
}
test("Worker, public client script and additive migration parse",()=>{
 assert.doesNotThrow(()=>new Script(addon));
 const js=/<script nonce="MCCT_WIG_NONCE_PLACEHOLDER">([\s\S]*?)<\/script>/i.exec(page);
 assert.ok(js?.[1]);
 assert.doesNotThrow(()=>new Script(js[1]));
 assert.match(migration,/CREATE TABLE IF NOT EXISTS mcct_public_tracking_rate/);
 assert.doesNotMatch(migration,/DROP TABLE|UPDATE donors|DELETE FROM donors/i);
});
test("registered donation without physical receipt does not claim delivered wig",async()=>{
 const response=await lookup(worker(),fakeDB({donor:{...validDonor,followup_status:"Completed"}}));
 const payload=await response.json();
 assert.equal(response.status,200);
 assert.equal(payload.phase,"followup");
 assert.match(payload.phase_label,/not yet confirmed/);
 assert.doesNotMatch(JSON.stringify(payload),/8500012190|3f318d20|full_name|email|recipient_contact|awb/i);
});
test("courier received at the fabrication centre is shown as received",async()=>{
 const response=await lookup(worker(),fakeDB({donor:validDonor,courier:{status:"in_transit"},parcel:{received_at:1794662400}}));
 const payload=await response.json();
 assert.equal(response.status,200);
 assert.equal(payload.phase,"received");
 assert.equal(payload.source,"donor_desk");
 assert.match(payload.phase_label,/received/i);
});
test("actual wig fabrication allocation does not imply wig donation",async()=>{
 const response=await lookup(worker(),fakeDB({donor:validDonor,inventory:{consumed:1,at_fabricator:1,last_movement:1794662400}}));
 const payload=await response.json();
 assert.equal(payload.phase,"fabrication");
 assert.match(payload.hint,/not confirmation/);
});
test("valid official registration but mismatched phone digits reveals no donor details",async()=>{
 const response=await lookup(worker(),fakeDB({donor:validDonor}),{phone_last4:"0000"});
 const payload=await response.json();
 assert.equal(response.status,404);
 assert.equal(payload.ok,false);
 assert.equal("registration_id" in payload,false);
 assert.equal("phone" in payload,false);
});
test("missing registration and bad phone return same generic lookup failure",async()=>{
 const a=await lookup(worker(),fakeDB({donor:validDonor}),{phone_last4:"0000"});
 const b=await lookup(worker(),fakeDB({donor:null}));
 assert.equal((await a.json()).error,(await b.json()).error);
});
test("missing security attestation is rejected before database search",async()=>{
 const response=await lookup(worker({verify:false}),fakeDB({donor:validDonor}));
 assert.equal(response.status,403);
});
test("20 lookups per hour limit has a safe failure",async()=>{
 const response=await lookup(worker(),fakeDB({donor:validDonor,blocked:true}));
 assert.equal(response.status,429);
});
test("archive state is surfaced only after phone verification",async()=>{
 const response=await lookup(worker(),fakeDB({donor:{...validDonor,binned:1}}));
 const payload=await response.json();
 assert.equal(payload.phase,"closed");
 assert.doesNotMatch(JSON.stringify(payload),/8500012190|3f318d20/);
});
test("existing Worker fetch and scheduled handlers are preserved",()=>{
 assert.match(addon,/MCCT_TRACK_V5_PREV_FETCH=launch_wig_maker_portal_worker_default\.fetch/);
 assert.match(addon,/MCCT_TRACK_V5_PREV_SCHEDULED=launch_wig_maker_portal_worker_default\.scheduled/);
 assert.match(addon,/MCCT_TRACK_V5_PREV_FETCH\.call\(this,req,env,ctx\)/);
 assert.match(addon,/MCCT_TRACK_V5_PREV_SCHEDULED\.call\(this,controller,env,ctx\)/);
});
test("public page supports old QR registration IDs and original historical tracker",()=>{
 assert.match(page,/registration_id/);
 assert.match(page,/phone_last4/);
 assert.match(page,/cf-turnstile/);
 assert.match(page,/\/volunteer-logo\.jpeg/);
 assert.match(page,/script\.google\.com\/macros\/s\//);
 assert.doesNotMatch(page,/data:image\/jpeg;base64/i);
});
test("public website tracking buttons use the new Cloudflare entry point",()=>{
 const app=readFileSync("src/App.jsx","utf8");
 assert.match(app,/PUBLIC_TRACKING_BASE = "https:\/\/mamta-donor-desk-launch-new\.bharathairseva-in\.workers\.dev\/track-hair-donation"/);
 assert.match(app,/trackingApp:\s*PUBLIC_TRACKING_BASE \+ registrationQrSearch\(\)/);
 assert.match(app,/path="\/track-your-hair-donation"/);
});
