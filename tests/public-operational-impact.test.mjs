import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {Script,runInNewContext} from "node:vm";

const src=readFileSync("cloudflare/public-operational-impact-v6-addon.mjs","utf8");
const website=readFileSync("src/WebsiteUpdates.jsx","utf8");
const css=readFileSync("src/styles/website-updates.css","utf8");
const endpoint="https://mamta-donor-desk-launch-new.bharathairseva-in.workers.dev/api/public/operational-impact";
function setup(row){
 const prior=async()=>new Response("Existing Worker route untouched",{status:200});
 const worker={fetch:prior};
 const context={launch_wig_maker_portal_worker_default:worker,console:{error(){}},Response,URL,Date,Number,JSON};
 runInNewContext(src,context);
 const db={prepare(sql){
  return {first:async()=>row};
 }};
 return {worker,db};
}
test("read-only endpoint returns verified active pending and never leaks donor details",async()=>{
 const row={stored_total:160,in_bin:31,active_donor_rows:129,active_pending:73,completed_in_desk:56,cancelled:0,expired:0,legacy_cleared:0};
 const {worker,db}=setup(row);
 const response=await worker.fetch(new Request(endpoint),{DB:db},{});
 const payload=await response.json();
 assert.equal(response.status,200);
 assert.equal(payload.scope,"donor_desk_operational_queue");
 assert.equal(payload.active_pending,73);
 assert.equal(payload.in_bin,31);
 assert.equal(response.headers.get("access-control-allow-origin"),"*");
 const body=JSON.stringify(payload);
 for(const key of ["full_name","phone","awb","email","photo","registration_id","identity_proof"])assert.equal(body.includes('"'+key+'"'),false);
});
test("invalid database totals are never published",async()=>{
 const {worker,db}=setup({stored_total:160,in_bin:31,active_donor_rows:129,active_pending:140});
 const response=await worker.fetch(new Request(endpoint),{DB:db},{});
 assert.equal(response.status,503);
 assert.equal((await response.json()).ok,false);
});
test("unexpected methods blocked; other Worker routes unchanged",async()=>{
 const {worker,db}=setup({stored_total:160,in_bin:31,active_donor_rows:129,active_pending:73});
 const post=await worker.fetch(new Request(endpoint,{method:"POST"}),{DB:db},{});
 assert.equal(post.status,405);
 const legacy=await worker.fetch(new Request(endpoint.replace("operational-impact","other-service")),{DB:db},{});
 assert.equal(await legacy.text(),"Existing Worker route untouched");
});
test("SQL only reads D1 and excludes archived/closed statuses",()=>{
 assert.doesNotThrow(()=>new Script(src));
 assert.match(src,/LEFT JOIN mc_donor_recycle/);
 assert.match(src,/b\.donor_id IS NULL AND d\.followup_status IN \('Pending','Not answered','Call again'\)/);
 assert.match(src,/case/i);
 assert.doesNotMatch(src,/UPDATE donors|INSERT INTO donors|DELETE FROM donors/);
 assert.doesNotMatch(src,/\.scheduled=/);
 assert.match(src,/MCCT_IMPACT_V6_PREVIOUS_FETCH\.call\(this,req,env,ctx\)/);
});
test("website labels live operational queue separately from historical totals",()=>{
 assert.match(website,/DONOR_DESK_OPERATIONS_FEED/);
 assert.match(website,/scope === "donor_desk_operational_queue"/);
 assert.match(website,/active_donor_rows \+ next\.in_bin === next\.stored_total/);
 assert.match(website,/not the historical all-time Google Sheets total/);
 assert.match(website,/ImpactNumber amount=\{total\} label="Total recorded"/);
 assert.match(website,/ImpactNumber amount=\{published\.pending\} label="Pending donations"/);
 assert.match(css,/\.mcct-public-ops-snapshot/);
});
