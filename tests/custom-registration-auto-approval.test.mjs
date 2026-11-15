import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {Script,runInNewContext} from "node:vm";
import worker from "../cloudflare/website-form-registration-autorecovery-v11.mjs";
const website=readFileSync("src/App.jsx","utf8");
const ui=readFileSync("src/HairDonationRegistration.jsx","utf8");
const routes=JSON.parse(readFileSync("vercel.json","utf8"));
const backend=readFileSync("cloudflare/website-form-registration-autorecovery-v11.mjs","utf8");
const addon=readFileSync("cloudflare/custom-photo-auto-link-v11-addon.mjs","utf8");
const adminPage=readFileSync("cloudflare/custom-registration-sync-v11-admin.html","utf8");
const origin="https://mamta-care-website.vercel.app";
const dummy="12345678-1234-4234-a234-123456789abc";
test("custom website registration remains the user-facing form, never Google Forms",()=>{
 assert.match(website,/hairDonationForm:\s*"\/hair-registration"/);
 assert.doesNotMatch(website,/hairDonationForm:\s*.*forms\.gle/);
 assert.match(ui,/function HairDonationRegistration/);
 assert.match(ui,/Submit my donation/);
 assert.match(ui,/front/);
 assert.match(ui,/back/);
 assert.match(ui,/0x4AAAAA/);
 assert.match(ui,/\/api\/hair-registration/);
 assert.doesNotMatch(ui,/VITE_HAIR_REGISTRATION_ENABLED/);
});
test("donor never sees administrator photo approval on pending registration",()=>{
 assert.doesNotMatch(ui,/Your registration needs Administrator review/);
 assert.match(ui,/Finalizing your registration/);
 assert.match(ui,/No administrator photo approval is required/);
 assert.match(ui,/checkRegistrationStatus/);
 assert.match(ui,/retryOriginalSubmission/);
 assert.match(ui,/requestId\.current/);
 assert.match(ui,/47[0]{3}/);
});
test("custom registration redirects only to its existing Cloudflare Worker, with safe status proxy",()=>{
 assert.ok(routes.rewrites.some(x=>x.source==="/api/hair-registration"&&x.destination.endsWith("/api/register")));
 assert.ok(routes.rewrites.some(x=>x.source==="/api/hair-registration-status"&&x.destination.endsWith("/api/registration-status")));
 assert.match(backend,/action:"website_submit"/);
 assert.match(backend,/website_status/);
 assert.match(backend,/confirmation_email:"handled_by_existing_automation"/);
 assert.doesNotMatch(backend,/MailApp\.sendEmail|INSERT INTO donors/);
});
test("status endpoint reports only official registration status, no private contact data",async()=>{
 const db={prepare(sql){assert.match(sql,/SELECT state,registration_id FROM website_form_intakes/);return{bind(id){assert.equal(id,dummy);return{first:async()=>({state:"COMPLETE",registration_id:"2026-101104/M/2022"})}}}}};
 const res=await worker.fetch(new Request("https://worker.example.org/api/registration-status?submission_uuid="+dummy,{headers:{Origin:origin}}),{DB:db});
 assert.equal(res.status,200);
 const data=await res.json();
 assert.equal(data.registered,true);
 assert.equal(data.registration_id,"2026-101104/M/2022");
 assert.doesNotMatch(JSON.stringify(data),/email_address|full_name|phone_number/);
 assert.equal(res.headers.get("access-control-allow-origin"),origin);
});
test("pending registration is not rejected and does not claim ID or email delivery",async()=>{
 const db={prepare(){return{bind(){return{first:async()=>({state:"FORM_SYNC_PENDING",registration_id:null})}}}}};
 const r=await worker.fetch(new Request("https://worker.example.org/api/registration-status?submission_uuid="+dummy,{headers:{Origin:origin}}),{DB:db});
 assert.equal(r.status,202);
 const j=await r.json();
 assert.equal(j.pending,true);
 assert.equal(j.registered,false);
 assert.equal(j.registration_id,undefined);
});
test("retries retain the same UUID with a 45-second cooldown and fail closed",()=>{
 assert.match(backend,/updated_at<\?/);
 assert.match(backend,/now-45000/);
 assert.match(backend,/last\.front_key!==key1\|\|last\.back_key!==key2/);
 assert.match(backend,/last\?\.state==="COMPLETE"/);
 assert.match(backend,/action:"website_submit"/);
 assert.match(backend,/submission_uuid:id/);
 assert.match(backend,/photosStored\?"FORM_SYNC_PENDING":"RESERVED"/);
});
test("Donor Desk no-review addon uses imported source marker and never invents IDs",()=>{
 assert.doesNotThrow(()=>new Script(addon));
 assert.match(addon,/WEBSITE:'\|\|i\.submission_uuid/);
 assert.match(addon,/state='FORM_SYNC_PENDING'/);
 assert.match(addon,/d\.source='google_sheet'/);
 assert.match(addon,/DONOR_PHOTOS\.head/);
 assert.match(addon,/mcctNoReviewV11Backfill/);
 assert.match(addon,/created_ids:0,sent_emails:0/);
 assert.doesNotMatch(addon,/INSERT INTO donors|DELETE FROM donors|MailApp/);
});
test("admin photo decisions retired but donor photo history and scheduled import preserved",()=>{
 assert.match(addon,/\/app\/api\/review-decisions/);
 assert.match(addon,/Manual photo decisions have been retired/);
 assert.match(addon,/MCCT_NO_REVIEW_V11_PREVIOUS_SCHEDULED\.call\(this,controller,env,ctx\)/);
 assert.match(addon,/MCCT_NO_REVIEW_V11_PREVIOUS_FETCH\.call\(this,req,env,ctx\)/);
 assert.match(adminPage,/NO PHOTO APPROVAL REQUIRED/);
 assert.match(adminPage,/\/hair-registration/);
 assert.doesNotMatch(adminPage,/href="https:\/\/forms\.gle/);
 assert.match(adminPage,/\/volunteer-logo\.jpeg/);
});
