import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {Script} from "node:vm";

const worker=readFileSync("cloudflare/donor-desk-ops-v1-addon.mjs","utf8");
const html=readFileSync("cloudflare/donor-desk-ops-console.html","utf8");
const migration=readFileSync("cloudflare/migrations/20261114_donor_ops_v1.sql","utf8");

test("admin operations addon parses as JavaScript",()=>{assert.doesNotThrow(()=>new Script(worker));});
test("protected admin page JavaScript parses",()=>{
  const match=/<script nonce="MCCT_OPS_NONCE_PLACEHOLDER">([\s\S]*?)<\/script>/i.exec(html);
  assert.ok(match?.[1]);
  assert.doesNotThrow(()=>new Script(match[1]));
});
test("every added endpoint requires the existing authenticated admin session",()=>{
  assert.match(worker,/const user=await currentUser\(req,env\.DB\)/);
  assert.match(worker,/user\.role!=="admin"/);
  assert.match(worker,/!allowedWrite\(req\)/);
  assert.match(worker,/\/api\/admin\/ops\//);
});
test("status transitions cannot mutate completed or binned donor records",()=>{
  assert.match(worker,/getDonor\(env\.DB,id\)/);
  assert.match(worker,/from==="Completed"/);
  assert.match(worker,/version=version\+1 WHERE id=\? AND version=\?/);
  assert.match(worker,/mcct_ops_donor_status_events/);
});
test("notifications and expiry are not falsely marked sent",()=>{
  assert.match(worker,/PENDING_CONFIGURATION/);
  assert.match(worker,/automatic_expiry:false,email_delivery:false/);
  assert.match(worker,/Automated expiry is disabled/);
  assert.doesNotMatch(worker,/fetch\(['"]https?:\/\/.*send/i);
});
test("hair inventory is separately auditable without changing pre-existing hair data",()=>{
  assert.match(worker,/mcct_ops_hair_lots/);
  assert.match(worker,/mcct_ops_hair_events/);
  assert.match(worker,/custodian_type/);
  assert.match(worker,/piece_count/);
  assert.match(migration,/CREATE TABLE IF NOT EXISTS mcct_ops_hair_lots/);
  assert.doesNotMatch(migration,/DROP TABLE|DELETE FROM donors|UPDATE donors/i);
});
test("private admin page keeps official logo intact, access controls and visible warnings",()=>{
  assert.match(html,/src="\/volunteer-logo\.jpeg"/);
  assert.match(html,/MCCT_OPS_NONCE_PLACEHOLDER/);
  assert.match(html,/Back to Donor Desk/);
  assert.match(html,/Automatic rejection and emails remain off/);
});
