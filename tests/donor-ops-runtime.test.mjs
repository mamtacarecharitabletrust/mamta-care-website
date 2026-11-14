import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {createContext,runInContext} from "node:vm";
import {webcrypto} from "node:crypto";

const script=readFileSync("cloudflare/donor-desk-ops-v1-addon.mjs","utf8");
function harness(user, donor){
  const calls=[];
  const db={
    batch:async statements=>{calls.push({kind:"batch",statements:statements.map(s=>s.sql)});return [{meta:{changes:1}},{meta:{changes:1}},{meta:{changes:1}}];},
    prepare(sql){
      const handle={sql,
        bind(...args){calls.push({kind:"bind",sql,args});return this;},
        async first(){calls.push({kind:"first",sql});return sql.includes("from donors")?{total:0}:null;},
        async all(){calls.push({kind:"all",sql});return {results:[]};},
        async run(){calls.push({kind:"run",sql});return {meta:{changes:1}};}};
      return handle;
    }
  };
  const worker={fetch:async()=>new Response("untouched route", {status:201}),scheduled:async()=>{}};
  const context=createContext({
    launch_wig_maker_portal_worker_default:worker,
    PAGE:'<header><span id="who"></span></header><script>me=m.user;$(\'login\').classList.add(\'hide\');</script>',
    MCCT_OPS_HTML:'<html><style nonce="MCCT_OPS_NONCE_PLACEHOLDER"></style><script nonce="MCCT_OPS_NONCE_PLACEHOLDER"></script></html>',
    Response,Request,Headers,crypto:webcrypto,console,
    now:()=>1_800_000_000,
    json:(obj,status=200)=>new Response(JSON.stringify(obj),{status,headers:{"content-type":"application/json"}}),
    currentUser:async()=>user,
    getDonor:async()=>donor,
    allowedWrite:()=>true
  });
  runInContext(script,context);
  return {worker,db,calls,context};
}
const url="https://desk.example";
test("unauthenticated access to admin operations cannot access database or page",async()=>{
 const x=harness(null,null);
 const r=await x.worker.fetch(new Request(url+"/admin-ops"),{DB:x.db},{waitUntil(){}});
 assert.equal(r.status,401);
 assert.equal(x.calls.length,0);
});
test("volunteers cannot use admin operations API",async()=>{
 const x=harness({username:"volunteer",role:"staff"},null);
 const r=await x.worker.fetch(new Request(url+"/api/admin/ops/summary"),{DB:x.db},{waitUntil(){}});
 assert.equal(r.status,403);
 assert.equal(x.calls.length,0);
});
test("unknown existing routes continue to original Worker unchanged",async()=>{
 const x=harness(null,null);
 const r=await x.worker.fetch(new Request(url+"/api/donors"),{DB:x.db},{waitUntil(){}});
 assert.equal(r.status,201);assert.equal(await r.text(),"untouched route");
});
test("completed donors cannot be cancelled",async()=>{
 const d={id:"cf70e070-0000-4000-8000-123456789000",version:2,followup_status:"Completed"};
 const x=harness({username:"administrator",role:"admin"},d);
 const req=new Request(url+"/api/admin/ops/donors/"+d.id+"/cancel",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({version:2,reason:"Donor asked for cancellation"})});
 const r=await x.worker.fetch(req,{DB:x.db},{waitUntil(){}});
 assert.equal(r.status,409);assert.equal(x.calls.length,0);
});
test("cancelling an eligible application adds versioned audit writes",async()=>{
 const d={id:"cf70e070-0000-4000-8000-123456789000",version:2,followup_status:"Pending"};
 const x=harness({username:"administrator",role:"admin"},d);
 const req=new Request(url+"/api/admin/ops/donors/"+d.id+"/cancel",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({version:2,reason:"Donor requested cancellation"})});
 const r=await x.worker.fetch(req,{DB:x.db},{waitUntil(){}});
 assert.equal(r.status,200);const body=await r.json();assert.equal(body.followup_status,"Cancelled");
 assert.equal(x.calls.filter(z=>z.kind==="batch").length,1);
 assert.match(x.calls.find(z=>z.kind==="batch").statements.join("\n"),/mcct_ops_donor_status_events/);
});
test("stock entry rejects invalid quantity without writing",async()=>{
 const x=harness({username:"administrator",role:"admin"},null);
 const req=new Request(url+"/api/admin/ops/hair",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({source_type:"donor",hair_form:"ponytail",collection_mode:"hand",custodian_type:"center",location:"Nashik",piece_count:-3})});
 const r=await x.worker.fetch(req,{DB:x.db},{waitUntil(){}});
 assert.equal(r.status,400);assert.equal(x.calls.length,0);
});
test("admin-only panel is a nonced private HTML document",async()=>{
 const x=harness({username:"administrator",role:"admin"},null);
 const r=await x.worker.fetch(new Request(url+"/admin-ops"),{DB:x.db},{waitUntil(){}});
 assert.equal(r.status,200);
 assert.match(r.headers.get("content-security-policy")||"",/nonce-/);
 assert.match(await r.text(),/nonce="[0-9a-f]{36}"/);
});
