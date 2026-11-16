import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {Script,createContext,runInContext} from "node:vm";
import {DatabaseSync} from "node:sqlite";
import {webcrypto} from "node:crypto";

const addon=readFileSync("cloudflare/hair-stock-addon-v1.mjs","utf8");
const html=readFileSync("cloudflare/hair-stock-mobile-v1.html","utf8");
const migration=readFileSync("cloudflare/migrations/hair-stock-v1.sql","utf8");
const assembled=addon.replace("__MCST_HTML_JSON__",JSON.stringify(html));
const lotId="a1aaa111-1111-4111-a111-111111111111";
const secondLot="b2bbb222-2222-4222-b222-222222222222";
const thirdLot="c3ccc333-3333-4333-c333-333333333333";

test("full additive Worker module and mobile script compile",()=>{
 assert.doesNotThrow(()=>new Script(assembled));
 const script=html.split('<script nonce="MCCT_WIG_NONCE_PLACEHOLDER">')[1]?.split("</script>")[0];
 assert.ok(script);
 assert.doesNotThrow(()=>new Script(script));
 assert.match(html,/id="send-form"/);
 assert.match(html,/data-receive-form/);
 assert.match(html,/data-nav/);
 assert.match(html,/MCCT_WIG_NONCE_PLACEHOLDER/);
 assert.match(addon,/currentUser\(req,env.DB\)/);
 assert.match(addon,/mcvCurrent\(req,env\)/);
 assert.match(addon,/currentMaker\(req,env.DB\)/);
 assert.match(addon,/allowedWrite\(req\)/);
 assert.match(addon,/MCST_PREVIOUS_FETCH.call\(this,req,env,ctx\)/);
 assert.match(addon,/MCST_HAIR_STOCK_CHAIN_OF_CUSTODY_V1_20261116/);
 assert.doesNotMatch(addon,/\b(?:DROP TABLE|DELETE FROM donors|UPDATE donors SET|INSERT INTO donors)\b/i);
});
test("indexed custody, transfer, audit and exact once-only constraints",()=>{
 assert.match(migration,/donor_id TEXT PRIMARY KEY REFERENCES donors\(id\)/);
 assert.match(migration,/PRIMARY KEY\(transfer_id,donor_id\)/);
 assert.match(migration,/CHECK\(expected=actual\)/);
 assert.match(migration,/UNIQUE\(transfer_id,alert_type\)/);
 assert.match(migration,/mcst_lots_holder/);
 assert.match(migration,/mcst_transfer_admin/);
 assert.match(addon,/stage='held' AND lock_transfer=''/);
 assert.match(addon,/stage='pending'/);
 assert.match(addon,/stage='approved'/);
 assert.match(addon,/WHERE id=\? AND stage='approved'/);
 assert.match(addon,/mcst_tx_checks\(id,expected,actual\) VALUES\(\?,\?,changes\(\)\)/);
 assert.match(addon,/mcstReconcileOld/);
});
function setup(){
 const sql=new DatabaseSync(":memory:");
 sql.exec("PRAGMA foreign_keys=ON;");
 sql.exec("CREATE TABLE donors(id TEXT PRIMARY KEY,registration_id TEXT,full_name TEXT);");
 sql.exec("CREATE TABLE staff(username TEXT PRIMARY KEY,display_name TEXT,active INTEGER,role TEXT);");
 sql.exec("CREATE TABLE mcvol_people(id TEXT PRIMARY KEY,full_name TEXT,status TEXT,agreement_received INTEGER,valid_until TEXT);");
 sql.exec("CREATE TABLE mcvol_accounts(person_id TEXT,login_enabled INTEGER);");
 sql.exec("CREATE TABLE maker_accounts(id TEXT PRIMARY KEY,display_name TEXT,active INTEGER);");
 sql.exec("CREATE TABLE mcct_staff_hand_collections(id TEXT PRIMARY KEY,donor_id TEXT,collector_username TEXT,status TEXT,collected_at INTEGER);");
 sql.exec("CREATE TABLE mcct_hand_collections(id TEXT PRIMARY KEY,donor_id TEXT,volunteer_id TEXT,status TEXT,collected_at INTEGER);");
 sql.exec("CREATE TABLE mcct_hand_collection_cancellations(handover_id TEXT);");
 sql.exec(migration);
 sql.prepare("INSERT INTO staff VALUES(?,?,?,?)").run("a","Staff A",1,"team");
 sql.prepare("INSERT INTO staff VALUES(?,?,?,?)").run("b","Staff B",1,"team");
 sql.prepare("INSERT INTO staff VALUES(?,?,?,?)").run("admin","Administrator",1,"admin");
 sql.prepare("INSERT INTO maker_accounts VALUES(?,?,?)").run("maker1","Wig Maker",1);
 sql.prepare("INSERT INTO mcvol_people VALUES(?,?,?,?,?)").run("v1","Volunteer A","active",1,"2030-12-30");
 sql.prepare("INSERT INTO mcvol_accounts VALUES(?,?)").run("v1",1);
 for(const id of [lotId,secondLot,thirdLot]){
  sql.prepare("INSERT INTO donors VALUES(?,?,?)").run(id,"MC-"+id.slice(0,8),"Donor "+id.slice(0,2));
  sql.prepare("INSERT INTO mcst_lots(donor_id,source_kind,source_ref,origin_id,holder_kind,holder_id,stage,created_at,updated_at) VALUES(?,'staff',?,'a','staff','a','held',10,10)").run(id,"orig-"+id);
 }
 const db={
  prepare(statement){let args=[];
   return {
    bind(...xs){args=xs;return this;},
    async first(){return sql.prepare(statement).get(...args)||null;},
    async all(){return{results:sql.prepare(statement).all(...args),meta:{rows_read:0}};},
    async run(){return{meta:{changes:Number(sql.prepare(statement).run(...args).changes)}};}
   };
  },
  async batch(prepared){
   sql.exec("BEGIN TRANSACTION");
   try{const out=[];for(const p of prepared)out.push(await p.run());sql.exec("COMMIT");return out;}
   catch(e){sql.exec("ROLLBACK");throw e;}
  }
 };
 const context=createContext({
  launch_wig_maker_portal_worker_default:{fetch:async()=>new Response("old",{status:200})},
  mcctJSON:(x,n=200)=>new Response(JSON.stringify(x),{status:n,headers:{"content-type":"application/json"}}),
  currentUser:async()=>null,mcvCurrent:async()=>null,currentMaker:async()=>null,
  allowedWrite:()=>true,mcvToday:()=>"2026-11-16",
  crypto:webcrypto,Request,Response,Headers,URL,FormData,console,Date,
 });
 new Script(assembled).runInContext(context);
 const get=n=>runInContext(n,context);
 const req=payload=>new Request("https://example.test/api/stock/send",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});
 const a={kind:"staff",id:"a",name:"Staff A",admin:false},
  b={kind:"staff",id:"b",name:"Staff B",admin:false},
  maker={kind:"maker",id:"maker1",name:"Wig Maker",admin:false},
  admin={kind:"staff",id:"admin",name:"Administrator",admin:true};
 return {sql,db,req,a,b,maker,admin,
  send:(payload,person=a)=>get("mcstSend")(req(payload),{DB:db},person),
  decide:(payload,person=admin)=>get("mcstDecide")(req(payload),{DB:db},person),
  receive:(payload,person=b)=>get("mcstReceive")(req(payload),{DB:db},person),
  overview:person=>get("mcstOverview")(req({}),{DB:db},person),
  sync:()=>get("mcstReconcileOld")({DB:db}),
 };
}
async function jsonResponse(response){return{httpStatus:response.status,...await response.json()}}
test("staff sends hair, admin approves, recipient confirms and zero balance follows",async()=>{
 const x=setup();
 const sent=await jsonResponse(await x.send({lot_ids:[lotId],to_kind:"staff",to_id:"b",dispatch_weight_grams:110}));
 assert.equal(sent.httpStatus,201);
 assert.equal(x.sql.prepare("SELECT stage FROM mcst_lots WHERE donor_id=?").get(lotId).stage,"reserved");
 assert.equal(x.sql.prepare("SELECT holder_id FROM mcst_lots WHERE donor_id=?").get(lotId).holder_id,"a");
 const duplicated=await jsonResponse(await x.send({lot_ids:[lotId],to_kind:"staff",to_id:"b"}));
 assert.equal(duplicated.httpStatus,409);
 const deniedAdmin=await jsonResponse(await x.decide({transfer_id:sent.transfer_id,action:"approve"},x.a));
 assert.equal(deniedAdmin.httpStatus,403);
 const unauthorizedReceipt=await jsonResponse(await x.receive({transfer_id:sent.transfer_id,receipt_weight_grams:110},x.b));
 assert.equal(unauthorizedReceipt.httpStatus,409);
 const approved=await jsonResponse(await x.decide({transfer_id:sent.transfer_id,action:"approve"}));
 assert.equal(approved.httpStatus,200);
 assert.equal(x.sql.prepare("SELECT stage,holder_kind FROM mcst_lots WHERE donor_id=?").get(lotId).stage,"transit");
 const doubleApproval=await jsonResponse(await x.decide({transfer_id:sent.transfer_id,action:"approve"}));
 assert.equal(doubleApproval.httpStatus,409);
 const wrongReceiver=await jsonResponse(await x.receive({transfer_id:sent.transfer_id,receipt_weight_grams:110},x.a));
 assert.equal(wrongReceiver.httpStatus,403);
 const receipt=await jsonResponse(await x.receive({transfer_id:sent.transfer_id,receipt_weight_grams:110},x.b));
 assert.equal(receipt.httpStatus,200);
 assert.equal(receipt.status,"received");
 const row=x.sql.prepare("SELECT holder_kind,holder_id,stage,lock_transfer FROM mcst_lots WHERE donor_id=?").get(lotId);
 assert.deepEqual({...row},{holder_kind:"staff",holder_id:"b",stage:"held",lock_transfer:""});
 const repeated=await jsonResponse(await x.receive({transfer_id:sent.transfer_id,receipt_weight_grams:110},x.b));
 assert.equal(repeated.httpStatus,409);
 const counts=x.sql.prepare("SELECT (SELECT COUNT(*) FROM mcst_events) AS events,(SELECT COUNT(*) FROM mcst_transfer_items) AS items,(SELECT COUNT(*) FROM mcst_tx_checks) AS guards").get();
 assert.equal(counts.events,3);assert.equal(counts.items,1);assert.equal(counts.guards,0);
});
test("wig maker needs measured receipt weight and flags actual weight differences",async()=>{
 const x=setup();
 const sent=await jsonResponse(await x.send({lot_ids:[lotId,secondLot],to_kind:"maker",to_id:"maker1",dispatch_weight_grams:250}));
 assert.equal(sent.httpStatus,201);
 assert.equal((await x.decide({transfer_id:sent.transfer_id,action:"approve"})).status,200);
 const empty=await jsonResponse(await x.receive({transfer_id:sent.transfer_id},x.maker));
 assert.equal(empty.httpStatus,400);
 const done=await jsonResponse(await x.receive({transfer_id:sent.transfer_id,receipt_weight_grams:230,note:"verified net weight"},x.maker));
 assert.equal(done.httpStatus,200);
 assert.equal(done.weight_difference_grams,-20);
 assert.equal(done.status,"received_difference");
 assert.equal(x.sql.prepare("SELECT stage FROM mcst_transfers WHERE id=?").get(sent.transfer_id).stage,"received_difference");
 assert.equal(x.sql.prepare("SELECT COUNT(*) n FROM mcst_admin_alerts WHERE alert_type='received_difference'").get().n,1);
 assert.equal(x.sql.prepare("SELECT COUNT(*) n FROM mcst_lots WHERE holder_kind='maker' AND holder_id='maker1'").get().n,2);
 const visible=await jsonResponse(await x.overview(x.maker));
 assert.equal(visible.httpStatus,200);
 assert.ok(visible.lots.every(l=>l.donor_name===""&&l.registration_id===""));
});
test("atomic constraint prevents partial approval of mismatched packages",async()=>{
 const x=setup();
 const sent=await jsonResponse(await x.send({lot_ids:[lotId,secondLot],to_kind:"staff",to_id:"b"}));
 assert.equal(sent.httpStatus,201);
 x.sql.prepare("UPDATE mcst_lots SET lock_transfer='' WHERE donor_id=?").run(secondLot);
 const fail=await jsonResponse(await x.decide({transfer_id:sent.transfer_id,action:"approve"}));
 assert.equal(fail.httpStatus,409);
 assert.equal(x.sql.prepare("SELECT stage FROM mcst_transfers WHERE id=?").get(sent.transfer_id).stage,"pending");
 assert.equal(x.sql.prepare("SELECT stage FROM mcst_lots WHERE donor_id=?").get(lotId).stage,"reserved");
 assert.equal(x.sql.prepare("SELECT holder_kind FROM mcst_lots WHERE donor_id=?").get(lotId).holder_kind,"staff");
 assert.equal(x.sql.prepare("SELECT COUNT(*) n FROM mcst_tx_checks").get().n,0);
});
test("legacy hand collections import once, preserving old in-transit status",async()=>{
 const x=setup();
 x.sql.prepare("DELETE FROM mcst_lots").run();
 x.sql.prepare("INSERT INTO mcct_staff_hand_collections VALUES(?,?,?,?,?)").run("H1",lotId,"a","collected",100);
 x.sql.prepare("INSERT INTO mcct_staff_hand_collections VALUES(?,?,?,?,?)").run("H2",secondLot,"a","in_transit",101);
 assert.equal(await x.sync(),2);
 assert.equal(await x.sync(),0);
 const first=x.sql.prepare("SELECT holder_kind,holder_id,stage FROM mcst_lots WHERE donor_id=?").get(lotId);
 const second=x.sql.prepare("SELECT holder_kind,stage FROM mcst_lots WHERE donor_id=?").get(secondLot);
 assert.deepEqual({...first},{holder_kind:"staff",holder_id:"a",stage:"held"});
 assert.deepEqual({...second},{holder_kind:"transit",stage:"legacy_in_transit"});
});
