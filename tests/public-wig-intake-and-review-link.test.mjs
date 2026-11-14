import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Script } from "node:vm";

const worker=readFileSync("cloudflare/public-wig-intake-v3-addon.mjs","utf8");
const publicPage=readFileSync("cloudflare/public-wig-intake-form.html","utf8");
const adminPage=readFileSync("cloudflare/public-wig-intake-admin.html","utf8");
const migration=readFileSync("cloudflare/migrations/20261114_public_wig_intakes.sql","utf8");
function parseLocalScript(html){
 const m=/<script nonce="MCCT_WIG_NONCE_PLACEHOLDER">([\s\S]*?)<\/script>/i.exec(html);
 assert.ok(m?.[1],"nonce-protected app script missing");
 assert.doesNotThrow(()=>new Script(m[1]));
}
test("Worker and browser scripts parse correctly",()=>{
 assert.doesNotThrow(()=>new Script(worker));
 parseLocalScript(publicPage);
 parseLocalScript(adminPage);
});
test("original worker routes and scheduled automation are preserved",()=>{
 assert.match(worker,/MCCT_WIG_V3_PREV_FETCH=launch_wig_maker_portal_worker_default\.fetch/);
 assert.match(worker,/MCCT_WIG_V3_PREV_SCHEDULED=launch_wig_maker_portal_worker_default\.scheduled/);
 assert.match(worker,/MCCT_WIG_V3_PREV_FETCH\.call\(this,req,env,ctx\)/);
 assert.match(worker,/MCCT_WIG_V3_PREV_SCHEDULED\.call\(this,controller,env,ctx\)/);
});
test("wig application cannot be saved before Turnstile, consent, and input checks",()=>{
 assert.match(worker,/TURNSTILE_SECRET_KEY/);
 assert.match(worker,/siteverify/);
 assert.match(worker,/guardian_or_self_consent!==true/);
 assert.match(worker,/privacy_accepted!==true/);
 assert.match(worker,/Origin/);
 assert.match(worker,/X-Mamta-Public/);
 assert.match(worker,/mcctWigV3Hash/);
 assert.match(worker,/submissions<5/);
 assert.match(worker,/UNIQUE/);
 assert.match(migration,/UNIQUE\(contact_hash,day_ist\)/);
});
test("admin import requires authenticated admin role, audited writes and pending Wig Desk status",()=>{
 assert.match(worker,/currentUser\(req,env\.DB\)/);
 assert.match(worker,/user\.role!=="admin"/);
 assert.match(worker,/!allowedWrite\(req\)/);
 assert.match(worker,/INSERT INTO wig_requests/);
 assert.match(worker,/INSERT INTO wig_events/);
 assert.match(worker,/SELECT \?,\?,\?,\?,\?,\?,\?,\?,\?,\?,\?,\?,\?,\?,\?,\?/);
 assert.match(worker,/\"pending\",ts,ts/);
 assert.match(worker,/w\.status='PENDING'/);
 assert.match(worker,/mcct_public_wig_intakes/);
});
test("accepted photo reviews are linked only to existing uniquely imported official IDs",()=>{
 assert.match(worker,/a\.decision='ACCEPTED_FOR_FOLLOWUP'/);
 assert.match(worker,/SELECT COUNT\(\*\) FROM donors unique_d/);
 assert.match(worker,/INSERT INTO mcct_ops_review_links/);
 assert.match(worker,/INSERT INTO donor_events/);
 assert.doesNotMatch(worker,/INSERT INTO donors|UPDATE donors SET registration_id/);
});
test("original logo preserved separately, without personal data on public page",()=>{
 assert.match(publicPage,/src="\/volunteer-logo\.jpeg"/);
 assert.match(adminPage,/src="\/volunteer-logo\.jpeg"/);
 assert.doesNotMatch(publicPage,/data:image\/jpeg;base64/);
 assert.match(publicPage,/Do not share sensitive medical details/);
 assert.match(publicPage,/guardian_or_self_consent/);
 assert.match(publicPage,/cf-turnstile/);
 assert.match(adminPage,/confidential|CONFIDENTIAL/);
});
test("migration is strictly additive; historic Wig Desk records untouched",()=>{
 assert.match(migration,/CREATE TABLE IF NOT EXISTS mcct_public_wig_intakes/);
 assert.match(migration,/CREATE TABLE IF NOT EXISTS mcct_public_wig_rate/);
 assert.doesNotMatch(migration,/\b(?:DROP|TRUNCATE|DELETE\s+FROM|UPDATE\s+wig_requests)\b/i);
});


test("public website routes Request a Free Wig to the existing Worker intake",()=>{
 const app=readFileSync("src/App.jsx","utf8");
 assert.match(app,/wigRequestForm:\s*"https:\/\/mamta-donor-desk-launch-new\.bharathairseva-in\.workers\.dev\/request-free-wig"/);
 assert.doesNotMatch(app,/wigRequestForm:\s*"https:\/\/forms\.gle/);
});
