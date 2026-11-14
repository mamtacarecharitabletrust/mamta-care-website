import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {Script} from "node:vm";
const addon=readFileSync("cloudflare/public-volunteer-referral-v4-addon.mjs","utf8");
const page=readFileSync("cloudflare/public-volunteer-referral-form.html","utf8");
const migration=readFileSync("cloudflare/migrations/20261114_public_volunteer_referrals.sql","utf8");
test("Worker V4 and public browser script parse",()=>{
 assert.doesNotThrow(()=>new Script(addon));
 const m=/<script nonce="MCCT_WIG_NONCE_PLACEHOLDER">([\s\S]*?)<\/script>/i.exec(page);
 assert.ok(m?.[1]);
 assert.doesNotThrow(()=>new Script(m[1]));
});
test("volunteer registration preserves original session, Worker and approvals",()=>{
 assert.match(addon,/MCCT_VOL_V4_PREV_FETCH=launch_wig_maker_portal_worker_default\.fetch/);
 assert.match(addon,/MCCT_VOL_V4_PREV_FETCH\.call\(this,req,env,ctx\)/);
 assert.doesNotMatch(addon,/\.scheduled=/);
 assert.match(addon,/INSERT INTO mca_referrals/);
 assert.ok(addon.includes('href="/premium-v3/volunteer-review"'));
 assert.doesNotMatch(addon,/\/premium-v3\/volunteers/);
 assert.match(addon,/\"pending\",ts/);
 assert.doesNotMatch(addon,/INSERT INTO mcvol_people|INSERT INTO mcvol_accounts|UPDATE mcvol_people/);
});
test("public request requires anti-bot verification and consent",()=>{
 assert.match(addon,/mcctWigV3Verify\(req,env,token\)/);
 assert.match(addon,/mcctWigV3Hash/);
 assert.match(addon,/d\.consent_confirmed!==true/);
 assert.match(addon,/d\.privacy_accepted!==true/);
 assert.match(addon,/X-Mamta-Public/);
 assert.match(addon,/submissions<5/);
 assert.match(addon,/mcct_public_volunteer_intakes/);
});
test("public form preserves the actual logo, no Aadhaar or sensitive uploads",()=>{
 assert.match(page,/src="\/volunteer-logo\.jpeg"/);
 assert.match(page,/do not upload Aadhaar/i);
 assert.match(page,/cf-turnstile/);
 assert.doesNotMatch(page,/data:image\/jpeg;base64/);
 assert.doesNotMatch(page,/<input[^>]+type="file"/);
});
test("migration is additive and does not mutate existing people",()=>{
 assert.match(migration,/CREATE TABLE IF NOT EXISTS mcct_public_volunteer_intakes/);
 assert.match(migration,/CREATE TABLE IF NOT EXISTS mcct_public_volunteer_rate/);
 assert.doesNotMatch(migration,/DELETE FROM|DROP TABLE|UPDATE mcvol_people/i);
});
test("public website joins the existing Cloudflare volunteer referral intake",()=>{
 const s=readFileSync("src/App.jsx","utf8");
 assert.match(s,/volunteerForm:\s*"https:\/\/mamta-donor-desk-launch-new\.bharathairseva-in\.workers\.dev\/join-volunteer"/);
});
