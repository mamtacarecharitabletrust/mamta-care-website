import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Script,createContext} from 'node:vm';
import {DatabaseSync} from 'node:sqlite';
import {webcrypto} from 'node:crypto';

const code=readFileSync('cloudflare/admin-native-v3-addon.mjs','utf8');
const css=readFileSync('cloudflare/admin-native-v3.css','utf8');
const source=code.replace('__MP3_CSS_JSON__',JSON.stringify(css));
const UUID='a8ea8ea8-a8ea-4a8e-9a8e-a8ea8ea8ea8e';
function setup(){
 const sqlite=new DatabaseSync(':memory:');
 sqlite.exec([
 'CREATE TABLE donors(id TEXT PRIMARY KEY,full_name TEXT,registration_id TEXT,city TEXT,phone TEXT,hair_length TEXT,followup_status TEXT,verification_status TEXT,assigned_to TEXT,created_at INTEGER,updated_at INTEGER);',
 'CREATE TABLE mcq_donor_couriers(donor_id TEXT,carrier TEXT,awb TEXT,status TEXT,dispatch_date TEXT,updated_at INTEGER);',
 'CREATE TABLE mcst_lots(donor_id TEXT PRIMARY KEY,holder_kind TEXT,holder_id TEXT,stage TEXT,weight_grams INTEGER,braids INTEGER,length_cm INTEGER);',
 'CREATE TABLE mcst_transfers(id TEXT PRIMARY KEY,stage TEXT);'
 ].join('\n'));
 sqlite.prepare('INSERT INTO donors VALUES(?,?,?,?,?,?,?,?,?,?,?)').run(UUID,'Donor One','2026-1116-01','Guntur','8500000000','14 inches','Pending','PENDING','staff_a',100,200);
 sqlite.prepare('INSERT INTO donors VALUES(?,?,?,?,?,?,?,?,?,?,?)').run('b8eb8eb8-b8eb-4b8e-8b8e-b8eb8eb8eb8e','Verified Donor','2026-1116-02','Nashik','8600000000','17 inches','Completed','VERIFIED','staff_b',150,200);
 sqlite.prepare('INSERT INTO mcq_donor_couriers VALUES(?,?,?,?,?,?)').run(UUID,'India Post','AWB-TEST-01','In transit','2026-11-16',200);
 sqlite.prepare('INSERT INTO mcst_lots VALUES(?,?,?,?,?,?,?)').run(UUID,'staff','staff_a','held',125,1,37);
 sqlite.prepare('INSERT INTO mcst_transfers VALUES(?,?)').run('transfer-a','pending');
 const db={prepare(sql){let args=[];return{
  bind(...values){args=values;return this},
  first:async()=>sqlite.prepare(sql).get(...args)||null,
  all:async()=>({results:sqlite.prepare(sql).all(...args)}),
  run:async()=>({meta:{changes:sqlite.prepare(sql).run(...args).changes}})
 }}};
 const who={role:'admin',username:'admin',display_name:'Administrator'};
 const context=createContext({launch_wig_maker_portal_worker_default:{fetch:async()=>new Response('ORIGINAL DONOR DESK',{status:200,headers:{'content-type':'text/plain'}})},
  currentUser:async(req)=>req.headers.get('x-test-auth')==='admin'?who:req.headers.get('x-test-auth')==='staff'?{...who,role:'team'}:null,
  crypto:webcrypto,URL,Response,Request,Headers,Intl,console});
 new Script(source).runInContext(context);
 const fetch=context.launch_wig_maker_portal_worker_default.fetch;
 return{db,fetch,sqlite,
  call:(path,role='admin',method='GET')=>fetch(new Request('https://example.test'+path,{method,headers:{'x-test-auth':role}}),{DB:db},{})};
}
test('new admin portal compiles as a self-contained additive Worker module',()=>{
 assert.doesNotThrow(()=>new Script(source));
 assert.ok(code.includes('MP3_PREVIOUS_FETCH.call(this,req,env,ctx)'));
 assert.ok(code.includes("path!==MP3_HOME&&!path.startsWith(MP3_HOME+'/')"));
 assert.ok(code.includes('MCCT_ADMIN_NATIVE_HOME_V3_20261116'));
 assert.doesNotMatch(code,/\b(?:DELETE FROM|UPDATE donors|ALTER TABLE|DROP TABLE|CREATE TABLE)\b/i);
 assert.doesNotMatch(source,/\bfetch\s*\(\s*['"]https?:\/\//);
});
test('premium screen has no fragile JavaScript navigation or embedded iframe',async()=>{
 const {call}=setup();
 const r=await call('/app/premium');
 const html=await r.text();
 assert.equal(r.status,200);
 assert.match(html,/Everything you need\. Easy to find/);
 assert.match(html,/href="\/app\/premium\/donors"/);
 assert.match(html,/href="\/app\/premium\/queue"/);
 assert.match(html,/href="\/hair-stock"/);
 assert.match(html,/href="\/app\/hand-collections"/);
 assert.match(html,/href="\/app\/premium\/all"/);
 assert.match(html,/href="\/app"/);
 assert.doesNotMatch(html,/<iframe/i);
 assert.doesNotMatch(html,/<script/i);
 assert.match(r.headers.get('content-security-policy'),/form-action 'self'/);
 assert.match(r.headers.get('cache-control'),/no-store/);
 assert.match(html,/<style nonce="[a-f0-9]{32}">/);
 assert.match(html,/Registered donors/);
 assert.match(html,/Saved couriers/);
 assert.match(html,/Hair transfers awaiting approval/);
});
test('new donor list, name search and individual donor details load from real-style SQLite',async()=>{
 const {call}=setup();
 const all=await call('/app/premium/donors');
 assert.equal(all.status,200);assert.match(await all.text(),/Donor One/);
 const matched=await call('/app/premium/donors?q=Donor%20One');
 const mh=await matched.text();assert.equal(matched.status,200);assert.match(mh,/Donor One/);assert.doesNotMatch(mh,/Verified Donor/);
 const notFound=await call('/app/premium/donors?q=nonexistent');
 assert.match(await notFound.text(),/No matching donor/);
 const details=await call('/app/premium/donor/'+UUID);
 const dh=await details.text();assert.equal(details.status,200);
 assert.match(dh,/125 grams/);assert.match(dh,/2026-1116-01/);assert.match(dh,/\/app\/workspace\/desk/);
 assert.equal((await call('/app/premium/donor/nope')).status,404);
});
test('pending and verified queue links route to independently working native pages',async()=>{
 const {call}=setup();
 const pending=await call('/app/premium/queue');
 const ph=await pending.text();assert.equal(pending.status,200);
 assert.match(ph,/Donor One/);assert.doesNotMatch(ph,/Verified Donor/);
 const verified=await call('/app/premium/queue?status=verified');
 const vh=await verified.text();assert.equal(verified.status,200);
 assert.match(vh,/Verified Donor/);assert.doesNotMatch(vh,/Donor One/);
});
test('courier screen reads AWBs and supports native server search',async()=>{
 const {call}=setup();
 const c=await call('/app/premium/couriers?q=AWB-TEST-01');
 const html=await c.text();
 assert.equal(c.status,200);assert.match(html,/AWB-TEST-01/);assert.match(html,/India Post/);
 assert.match(html,/action="\/app\/premium\/couriers"/);
 const none=await call('/app/premium/couriers?q=UnmatchedAWB');
 assert.match(await none.text(),/No matching courier records/);
});
test('all modules are normal links and discoverable with no client JS',async()=>{
 const {call}=setup();
 const page=await call('/app/premium/all');
 const html=await page.text();
 assert.equal(page.status,200);
 for(const link of ['/hair-stock','/app/receipts','/app/hand-collections','/app/print-studio','/premium-v3/wigs','/premium-v3/people','/admin-registration-sync','/app/courier-certificate-sync','/admin-ops','/app/workspace/desk','/app']){
  assert.ok(html.includes('href="'+link+'"'),link+' not visible');
 }
 const search=await call('/app/premium/all?find=hair');
 assert.match(await search.text(),/Hair Stock/);
 const empty=await call('/app/premium/all?find=noneofthese');
 assert.match(await empty.text(),/No matching feature/);
});
test('unauthenticated users and non-admin accounts are prevented from reading the premium portal',async()=>{
 const {call}=setup();
 const unauth=await call('/app/premium','none');
 assert.equal(unauth.status,302);assert.equal(unauth.headers.get('location'),'/app');
 const staff=await call('/app/premium','staff');
 assert.equal(staff.status,403);
 const post=await call('/app/premium','admin','POST');
 assert.equal(post.status,405);
});
test('legacy routes, sign-in and existing Donor Desk remain untouched',async()=>{
 const {call}=setup();
 for(const path of ['/','/app','/app/workspace/desk','/hair-stock','/app/receipts','/maker','/volunteer','/app/api/queue']){
  const r=await call(path);
  assert.equal(r.status,200);
  assert.equal(await r.text(),'ORIGINAL DONOR DESK',path);
 }
});
test('responsive animated CSS remains accessible and honors reduced-motion preference',()=>{
 assert.match(css,/\.mobilebar\{display:grid;position:fixed/);
 assert.match(css,/\.tiles\{grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
 assert.match(css,/prefers-reduced-motion:reduce/);
 assert.match(css,/a:focus-visible/);
 assert.match(css,/touch-action:manipulation/);
});
