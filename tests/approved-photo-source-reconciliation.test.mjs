import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {Script,runInNewContext} from "node:vm";
import {webcrypto} from "node:crypto";

const addon=readFileSync("cloudflare/approved-photo-source-reconciliation-v7-addon.mjs","utf8");
const html=readFileSync("cloudflare/approved-photo-source-reconciliation-v7-admin.html","utf8");
function createContext(extra={}){
 const originalFetch=async()=>new Response("previous route");
 const originalScheduled=async()=>{};
 const ctx={launch_wig_maker_portal_worker_default:{fetch:originalFetch,scheduled:originalScheduled},
   crypto:webcrypto,Response,Request,URL,Date,Math,Number,console:{error(){}},
   currentUser:async()=>({username:"administrator",role:"admin"}),allowedWrite:()=>true,
   mcctWigV3SecureHTML:(page)=>new Response(page,{headers:{"Content-Type":"text/html"}}),
   MCCT_RECON_V7_HTML:html,...extra};
 runInNewContext(addon,ctx);
 return ctx;
}
function fakeDB(cases=[],changes=[1,1,1]){
 const seen={batches:[],sql:[],queries:[]};
 return {seen,
  prepare(sql){seen.sql.push(sql);
   return {
    async all(){seen.queries.push(sql);return{results:cases}},
    async first(){return{n:0}},
    bind(...args){return{sql,args}}
   };
  },
  async batch(statements){
   seen.batches.push(statements);
   return changes.map(n=>({meta:{changes:n}}));
  }
 };
}
test("Worker addon and admin browser script parse",()=>{
 assert.doesNotThrow(()=>new Script(addon));
 const local=/<script nonce="MCCT_WIG_NONCE_PLACEHOLDER">([\s\S]*?)<\/script>/i.exec(html);
 assert.ok(local?.[1]);
 assert.doesNotThrow(()=>new Script(local[1]));
});
test("only exact WEBSITE:UUID from genuine Google Form and unique registered donor is eligible",()=>{
 assert.match(addon,/TRIM\(COALESCE\(d\.sheet_extra,''\)\)='WEBSITE:'\|\|i\.submission_uuid/);
 assert.match(addon,/d\.source='google_sheet'/);
 assert.match(addon,/a\.decision='ACCEPTED_FOR_FOLLOWUP'/);
 assert.match(addon,/SELECT COUNT\(\*\) FROM donors x/);
 assert.match(addon,/SELECT COUNT\(\*\) FROM donors y/);
 assert.match(addon,/NOT EXISTS\(SELECT 1 FROM website_form_intakes j WHERE j\.registration_id=d\.registration_id\)/);
 assert.doesNotMatch(addon,/INSERT INTO donors|INSERT INTO certificates|onFormSubmit\(/);
});
test("zero matching source markers never mutates donor or photo registration",async()=>{
 const context=createContext();
 const db=fakeDB([]);
 const result=await context.mcctReconV7Run(db,"scheduled");
 assert.equal(result.linked,0);
 assert.equal(result.created_ids,0);
 assert.equal(result.sent_emails,0);
 assert.equal(db.seen.batches.length,0);
});
test("unique matched source registration is atomically linked with audit",async()=>{
 const context=createContext();
 const db=fakeDB([{submission_uuid:"41117fff-131d-4cdf-8fd6-99de6745a230",
   donor_id:"3b054aac-4e34-4096-8234-9a1b1f64ed01",
   registration_id:"2026-101104/M/2022",reviewed_by:"administrator"}]);
 const r=await context.mcctReconV7Run(db,"scheduled");
 assert.equal(r.linked,1);
 assert.equal(r.created_ids,0);
 assert.equal(db.seen.batches.length,1);
 const statements=db.seen.batches[0];
 assert.equal(statements.length,3);
 assert.match(statements[0].sql,/UPDATE website_form_intakes SET registration_id/);
 assert.match(statements[0].sql,/NOT EXISTS\(SELECT 1 FROM website_form_intakes j/);
 assert.match(statements[1].sql,/INSERT INTO mcct_ops_review_links/);
 assert.match(statements[1].sql,/changes\(\)=1/);
 assert.match(statements[2].sql,/INSERT INTO donor_events/);
 assert.match(statements[2].sql,/changes\(\)=1/);
});
test("reconciliation does not claim success if any required audit write is missing",async()=>{
 const context=createContext(),db=fakeDB([{submission_uuid:"aaaa",donor_id:"bbbb",registration_id:"cccc"}],[1,1,0]);
 const r=await context.mcctReconV7Run(db);
 assert.equal(r.linked,0);
 assert.equal(r.skipped,1);
});
test("unauthenticated users cannot view private reconciliation page or API",async()=>{
 const ctx=createContext({currentUser:async()=>null});
 const url="https://example.org/admin-photo-reconciliation";
 const page=await ctx.launch_wig_maker_portal_worker_default.fetch(new Request(url),{DB:fakeDB()}, {});
 assert.equal(page.status,401);
 const api=await ctx.launch_wig_maker_portal_worker_default.fetch(new Request("https://example.org/api/admin/ops/v7/summary"),{DB:fakeDB()}, {});
 assert.equal(api.status,401);
});
test("only administrators can trigger reconciliation and POST requires origin check",async()=>{
 const ctx=createContext({currentUser:async()=>({role:"volunteer"}),allowedWrite:()=>true});
 const response=await ctx.launch_wig_maker_portal_worker_default.fetch(new Request("https://example.org/api/admin/ops/v7/reconcile",{method:"POST"}),{DB:fakeDB()}, {});
 assert.equal(response.status,403);
 const blocked=createContext({allowedWrite:()=>false});
 const res=await blocked.launch_wig_maker_portal_worker_default.fetch(new Request("https://example.org/api/admin/ops/v7/reconcile",{method:"POST"}),{DB:fakeDB()}, {});
 assert.equal(res.status,403);
});
test("existing app, cron and original logo are preserved",()=>{
 assert.match(addon,/MCCT_RECON_V7_PREV_FETCH\.call\(this,req,env,ctx\)/);
 assert.match(addon,/MCCT_RECON_V7_PREV_SCHEDULED\.call\(this,controller,env,ctx\)/);
 assert.match(addon,/ctx\.waitUntil\(mcctReconV7Run/);
 assert.match(html,/src="\/volunteer-logo\.jpeg"/);
 assert.doesNotMatch(html,/data:image\/jpeg;base64/);
 assert.match(html,/No registration IDs, certificates, donor emails or donor records are created/);
});
