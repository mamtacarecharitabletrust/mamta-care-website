import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {Script,runInNewContext} from "node:vm";
import {webcrypto} from "node:crypto";
const addon=readFileSync("cloudflare/photo-review-free-registration-v10-addon.mjs","utf8");
const admin=readFileSync("cloudflare/photo-review-free-registration-v10-admin.html","utf8");
const publicWorker=readFileSync("cloudflare/website-hair-registration-no-review-v10.mjs","utf8");
const website=readFileSync("src/App.jsx","utf8");
test("donor desk addon, website registration Worker and admin JS parse",()=>{
 assert.doesNotThrow(()=>new Script(addon));
 assert.doesNotThrow(()=>new Script(publicWorker));
 const script=/<script nonce="MCCT_WIG_NONCE_PLACEHOLDER">([\s\S]*?)<\/script>/i.exec(admin);
 assert.ok(script?.[1]);
 assert.doesNotThrow(()=>new Script(script[1]));
});
test("all new public website donations use the original Google Form, not a photo-approval gate",()=>{
 assert.match(website,/hairDonationForm:\s*OFFICIAL_DONATION_FORM/);
 assert.match(website,/const OFFICIAL_DONATION_FORM = "https:\/\/forms\.gle\/VpKSKJoichRqyTvH9"/);
 assert.match(website,/path="\/hair-registration" element=\{<OfficialRegistrationRedirect \/>/);
 assert.doesNotMatch(website,/VITE_HAIR_REGISTRATION_ENABLED/);
 assert.match(website,/window\.location\.replace\(OFFICIAL_DONATION_FORM\)/);
});
test("no new website photo upload can be held for human approval",()=>{
 assert.doesNotMatch(publicWorker,/state='REVIEW_REQUIRED'/);
 assert.match(publicWorker,/state='FORM_SYNC_PENDING'/);
 assert.match(publicWorker,/state='UPLOAD_SYNC_PENDING'/);
 assert.doesNotMatch(publicWorker,/requires Administrator review|pending review for this registration|requires team review/i);
 assert.match(publicWorker,/action:"website_submit"/);
 assert.match(publicWorker,/website_status/);
 assert.match(publicWorker,/GOOGLE_FORM_BRIDGE_SECRET/);
 assert.match(publicWorker,/state='COMPLETE'/);
});
test("original Google Form creates registration IDs and emails; no independent registration IDs or mail sends",()=>{
 assert.match(publicWorker,/if\(!answer\)throw Error\("Registration not confirmed"\)/);
 assert.match(publicWorker,/official\.test/);
 assert.match(publicWorker,/confirmation_email:"handled_by_existing_automation"/);
 assert.doesNotMatch(addon,/INSERT INTO donors|MailApp|sendEmail|registration_id=\$\{/);
 assert.match(addon,/created_ids:0,sent_emails:0/);
});
test("automatic photo linking requires exact source marker, single imported donor and real private photos",()=>{
 assert.match(addon,/d\.source='google_sheet'/);
 assert.match(addon,/TRIM\(COALESCE\(d\.sheet_extra,''\)\)='WEBSITE:'\|\|i\.submission_uuid/);
 assert.match(addon,/SELECT COUNT\(\*\) FROM donors d2/);
 assert.match(addon,/SELECT COUNT\(\*\) FROM donors d3/);
 assert.match(addon,/DONOR_PHOTOS\.head\(i\.front_key\)/);
 assert.match(addon,/DONOR_PHOTOS\.head\(i\.back_key\)/);
 assert.match(addon,/INSERT INTO website_hair_photos/);
 assert.match(addon,/UPDATE website_form_intakes SET state='COMPLETE'/);
 assert.match(addon,/INSERT INTO donor_events/);
 assert.match(addon,/NOT EXISTS\(SELECT 1 FROM website_form_intakes j/);
});
test("manual accept/reject buttons retired while private photographs and original history preserved",()=>{
 assert.match(addon,/p==="\/app\/photo-decisions"/);
 assert.match(addon,/p==="\/app\/api\/review-decisions"/);
 assert.match(addon,/manual_photo_decisions_enabled:false/);
 assert.match(addon,/mcctNoReviewV10Redirect\("\/app\?view=queue"\)/);
 assert.match(addon,/Photo Review Decisions/);
 assert.match(admin,/NO PHOTO APPROVAL REQUIRED/);
 assert.doesNotMatch(admin,/Accept application|Reject application/);
 assert.match(admin,/src="\/volunteer-logo\.jpeg"/);
 assert.doesNotMatch(addon,/DELETE FROM website_form_intakes|DELETE FROM donors|DELETE FROM mc_v3_photo_review_actions/);
});
test("previous donor desk request + scheduled imports continue",()=>{
 assert.match(addon,/MCCT_NO_REVIEW_V10_PREVIOUS_FETCH\.call\(this,req,env,ctx\)/);
 assert.match(addon,/MCCT_NO_REVIEW_V10_PREVIOUS_SCHEDULED\.call\(this,controller,env,ctx\)/);
 assert.match(addon,/ctx\.waitUntil\(mcctNoReviewV10Backfill/);
});
test("unmatched historical photo cases require no manual review and remain safe until original Form exists",async()=>{
 const calls=[];
 const db={prepare(sql){
   calls.push(sql);
   return {
     bind(){return{async run(){return{meta:{changes:15}}}}},
     async all(){return{results:[]}}
   }
 }};
 const ctx={
   launch_wig_maker_portal_worker_default:{fetch:async()=>new Response("existing service"),scheduled:async()=>{}},
   mcctWigV3SecureHTML:html=>new Response(html,{headers:{"Content-Type":"text/html"}}),
   Response,Request,URL,Date,Math,Number,JSON,Headers,crypto:webcrypto,console:{error(){}}
 };
 runInNewContext(addon,ctx);
 const result=await ctx.mcctNoReviewV10Backfill({DB:db,DONOR_PHOTOS:{head:async()=>null}});
 assert.equal(result.linked,0);
 assert.equal(result.created_ids,0);
 assert.equal(result.sent_emails,0);
 assert.equal(calls.length,2);
 const baseline=await ctx.launch_wig_maker_portal_worker_default.fetch(new Request("https://example.org/api/donors"),{},{});
 assert.equal(await baseline.text(),"existing service");
});
