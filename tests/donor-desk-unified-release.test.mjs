import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {Script} from "node:vm";

const addon=readFileSync("cloudflare/donor-desk-v2-unified-addon.mjs","utf8");
const html=readFileSync("cloudflare/donor-desk-v2-unified-console.html","utf8");
const migration=readFileSync("cloudflare/migrations/20261114_unified_donor_desk.sql","utf8");

test("Unified Worker addon parses without modifying existing routes",()=>{
 assert.doesNotThrow(()=>new Script(addon));
 assert.match(addon,/MCCT_V2_PREV_FETCH=launch_wig_maker_portal_worker_default.fetch/);
 assert.match(addon,/return MCCT_V2_PREV_FETCH\.call\(this,req,env,ctx\)/);
 assert.doesNotMatch(addon,/\.scheduled=/);
});
test("Unified Admin console client JavaScript parses and uses original untouched logo image",()=>{
 const match=/<script nonce="MCCT_V2_NONCE_PLACEHOLDER">([\s\S]*?)<\/script>/i.exec(html);
 assert.ok(match?.[1]);
 assert.doesNotThrow(()=>new Script(match[1]));
 assert.match(html,/img src="\/volunteer-logo\.jpeg"/);
 assert.doesNotMatch(html,/data:image\/jpeg;base64/i);
});
test("all Unified API routes require existing admin login and origin-checked writes",()=>{
 assert.match(addon,/const user=await currentUser\(req,env\.DB\)/);
 assert.match(addon,/user\.role!=="admin"/);
 assert.match(addon,/if\(!allowedWrite\(req\)\)/);
 assert.match(addon,/^.*\/api\/admin\/ops\/v2\/.*$/m);
});
test("Photo review bridge links only accepted cases with official existing registration IDs",()=>{
 assert.match(addon,/a\.decision='ACCEPTED_FOR_FOLLOWUP'/);
 assert.match(addon,/MCCT_V2_REG\.test\(reg\)/);
 assert.match(addon,/v\.identity_confirmed!==true/);
 assert.match(addon,/SELECT id,full_name,registration_id FROM donors/);
 assert.match(addon,/INSERT INTO mcct_ops_review_links/);
 assert.doesNotMatch(addon,/INSERT INTO donors|UPDATE website_form_intakes|UPDATE.*registration_id/);
});
test("Split hair preserves stock totals and applies optimistic versions",()=>{
 assert.match(addon,/count>=prior\.piece_count/);
 assert.match(addon,/const child=crypto\.randomUUID\(\)/);
 assert.match(addon,/remains=prior\.piece_count-count/);
 assert.match(addon,/version=version\+1 WHERE id=\? AND version=\? AND piece_count>\?/);
 assert.match(addon,/mcct_ops_hair_split_keys/);
 assert.match(addon,/mcct_ops_hair_events/);
});
test("Message drafting requires consent, never reports automatic delivery and enforces 50/day",()=>{
 assert.match(addon,/v\.explicit_consent_attested!==true/);
 assert.match(addon,/COUNT\(\*\) FROM mcct_ops_manual_comms/);
 assert.match(addon,/<50/);
 assert.match(addon,/OPENED_UNVERIFIED/);
 assert.match(addon,/automatic_sms:false,automatic_email:false,automatic_expiry:false/);
 assert.match(migration,/UNIQUE\(donor_id,channel,template,day_ist\)/);
});
test("CSV escape and barcode controls are present",()=>{
 assert.match(addon,/mcctV2SafeCsv/);
 assert.match(addon,/text\/csv/);
 assert.match(html,/BarcodeDetector/);
 assert.match(html,/createImageBitmap\(file\)/);
 assert.match(html,/\/api\/parcel-receipts\/lookup\?awb=/);
 assert.match(html,/Open Received Parcels/);
});
test("Migration is additive and does not update historic rows",()=>{
 assert.match(migration,/CREATE TABLE IF NOT EXISTS mcct_ops_review_links/);
 assert.match(migration,/CREATE TABLE IF NOT EXISTS mcct_ops_manual_comms/);
 assert.doesNotMatch(migration,/\b(?:DROP|TRUNCATE|DELETE\s+FROM|UPDATE\s+donors)\b/i);
});
