/* Mamta Care Donor Desk Administration Operations v1.
   Append to the EXISTING bundled Worker AFTER its final fetch wrapper.
   No change to existing donor/certificate/courier code or bindings.
   Original Worker module default remains unchanged.
   The separately maintained HTML source is embedded as MCCT_OPS_HTML at deploy time.
*/
// Add a small, admin-only navigation entry to the EXISTING Donor Desk.
// The existing page, registration and certificate controls are not replaced.
if(typeof PAGE==="string"&&!PAGE.includes('id="mcctOpsLink"')){
  const anchor='<span id="who"></span>';
  const menu='<a id="mcctOpsLink" href="/admin-ops" hidden style="background:#e7f4eb;color:#185e49;padding:10px 12px;border-radius:10px;text-decoration:none;font-size:12px;font-weight:850;margin-right:8px">Admin Operations</a>';
  if(PAGE.includes(anchor))PAGE=PAGE.replace(anchor,menu+anchor);
  const onLogin="me=m.user;$('login').classList.add('hide');";
  const show="me=m.user;const mcctOpsNav=document.getElementById('mcctOpsLink');if(mcctOpsNav)mcctOpsNav.hidden=me.role!=='admin';$('login').classList.add('hide');";
  if(PAGE.includes(onLogin))PAGE=PAGE.replace(onLogin,show);
  const onLogout="$('who').textContent='';";
  const hide="const mcctOpsNav=document.getElementById('mcctOpsLink');if(mcctOpsNav)mcctOpsNav.hidden=true;$('who').textContent='';";
  if(PAGE.includes(onLogout))PAGE=PAGE.replace(onLogout,hide);
}
// Keep Cancelled / Expired records readable in the EXISTING donor editor;
// status creation and reopening remain audited in Admin Operations.
if(typeof PAGE==="string"){
 const previous="choices(['Pending','Not answered','Call again','Cleared','Completed'],d.followup_status)";
 const choices="choices(['Pending','Not answered','Call again',...(d.followup_status==='Cleared'||d.followup_status==='Cancelled'||d.followup_status==='Expired'?[d.followup_status]:[]),'Completed'],d.followup_status)";
 if(PAGE.includes(previous))PAGE=PAGE.replaceAll(previous,choices);
 const oldFilter="<option>Cleared</option><option>Completed</option>";
 const filter="<option>Cleared</option><option>Cancelled</option><option>Expired</option><option>Completed</option>";
 if(PAGE.includes(oldFilter))PAGE=PAGE.replaceAll(oldFilter,filter);
}
const MCCT_OPS_PREVIOUS_FETCH=launch_wig_maker_portal_worker_default.fetch;
const MCCT_OPS_PREVIOUS_SCHEDULED=launch_wig_maker_portal_worker_default.scheduled;
const MCCT_OPS_PENDING="('Pending','Not answered','Call again')";
const MCCT_OPS_IDLE_WHERE=
  "d.followup_status IN "+MCCT_OPS_PENDING+
  " AND d.updated_at<?"+
  " AND (d.verification_status IS NULL OR UPPER(d.verification_status)<>'VERIFIED')"+
  " AND (d.certificate_url IS NULL OR TRIM(d.certificate_url)='')"+
  " AND NOT EXISTS(SELECT 1 FROM mc_donor_recycle b WHERE b.donor_id=d.id)"+
  " AND NOT EXISTS(SELECT 1 FROM mcq_donor_couriers c WHERE c.donor_id=d.id)"+
  " AND NOT EXISTS(SELECT 1 FROM mcct_parcel_receipts p WHERE p.donor_id=d.id)"+
  " AND NOT EXISTS(SELECT 1 FROM mcct_hand_collections h WHERE h.donor_id=d.id)"+
  " AND NOT EXISTS(SELECT 1 FROM mcct_staff_hand_collections sh WHERE sh.donor_id=d.id)";
const MCCT_OPS_STOCK_TYPES=new Set(["donor","salon","volunteer","hospital","drive","other"]);
const MCCT_OPS_HAIR_FORMS=new Set(["ponytail","braid","mixed","loose"]);
const MCCT_OPS_MODES=new Set(["courier","hand","salon","drive","other"]);
const MCCT_OPS_CUSTODIANS=new Set(["staff","volunteer","salon","hospital","center","fabricator","other"]);
const MCCT_OPS_STAGES=new Set(["received","in_transit","with_custodian","at_fabricator","consumed","closed"]);
const MCCT_OPS_UUID=/^[0-9a-f-]{36}$/i;
const MCCT_OPS_DEFAULT_LOCATION="Nashik";
function mcctOpsVal(value,n=150){return String(value??"").trim().slice(0,n);}
function mcctOpsInt(value,min,max){const n=Number(value);return Number.isSafeInteger(n)&&n>=min&&n<=max?n:null;}
function mcctOpsAllowed(value,set,label){if(!set.has(value))throw Error("Invalid "+label);return value;}
function mcctOpsReject(message,status=400){return json({ok:false,error:message},status);}
async function mcctOpsRead(req){const n=Number(req.headers.get("Content-Length")||0);if(n>12000)throw Error("Request too large");const text=await req.text();if(text.length>12000)throw Error("Request too large");return JSON.parse(text||"{}");}
function mcctOpsNonce(){return [...crypto.getRandomValues(new Uint8Array(18))].map(v=>v.toString(16).padStart(2,"0")).join("");}
function mcctOpsPage(){
 const nonce=mcctOpsNonce();
 const html=MCCT_OPS_HTML.replaceAll("MCCT_OPS_NONCE_PLACEHOLDER",nonce);
 return new Response(html,{status:200,headers:{
  "Content-Type":"text/html; charset=utf-8","Cache-Control":"private, no-store, max-age=0",
  "X-Content-Type-Options":"nosniff","X-Frame-Options":"DENY","Referrer-Policy":"no-referrer",
  "Content-Security-Policy":"default-src 'none'; script-src 'nonce-"+nonce+"'; style-src 'nonce-"+nonce+"'; img-src 'self'; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'"
 }});
}
async function mcctOpsSummary(db){
 const status=await db.prepare("SELECT COUNT(*) AS historical_total, "+
  "SUM(CASE WHEN b.donor_id IS NOT NULL THEN 1 ELSE 0 END) AS in_bin, "+
  "SUM(CASE WHEN b.donor_id IS NULL THEN 1 ELSE 0 END) AS active_records, "+
  "SUM(CASE WHEN b.donor_id IS NULL AND d.followup_status IN "+MCCT_OPS_PENDING+" THEN 1 ELSE 0 END) AS pending, "+
  "SUM(CASE WHEN b.donor_id IS NULL AND d.followup_status='Completed' THEN 1 ELSE 0 END) AS completed, "+
  "SUM(CASE WHEN b.donor_id IS NULL AND d.followup_status='Cleared' THEN 1 ELSE 0 END) AS old_cleared, "+
  "SUM(CASE WHEN b.donor_id IS NULL AND d.followup_status='Cancelled' THEN 1 ELSE 0 END) AS cancelled, "+
  "SUM(CASE WHEN b.donor_id IS NULL AND d.followup_status='Expired' THEN 1 ELSE 0 END) AS expired "+
  "FROM donors d LEFT JOIN mc_donor_recycle b ON b.donor_id=d.id").first();
 const hair=await db.prepare("SELECT COALESCE(SUM(CASE WHEN stage NOT IN ('consumed','closed') THEN piece_count ELSE 0 END),0) AS available_pieces, COUNT(*) AS lots, "+
  "COALESCE(SUM(CASE WHEN stage NOT IN ('consumed','closed') AND hair_form='ponytail' THEN piece_count ELSE 0 END),0) AS ponytails, "+
  "COALESCE(SUM(CASE WHEN stage NOT IN ('consumed','closed') AND hair_form='braid' THEN piece_count ELSE 0 END),0) AS braids "+
  "FROM mcct_ops_hair_lots").first();
 const review=await db.prepare("SELECT COUNT(*) AS unreviewed FROM website_form_intakes i LEFT JOIN mc_v3_photo_review_actions a ON a.submission_uuid=i.submission_uuid WHERE i.state='REVIEW_REQUIRED' AND a.submission_uuid IS NULL").first();
 const queued=await db.prepare("SELECT kind,delivery_state,COUNT(*) n FROM mcct_ops_notification_outbox GROUP BY kind,delivery_state ORDER BY kind").all();
 return {ok:true,status,hair,photos_to_review:review?.unreviewed||0,notifications:queued.results||[],counter_scope:"Donor Desk D1 only; website historical Google Sheets total is separate"};
}
async function mcctOpsIdle(db){
 const cutoff=now()-30*86400;
 const total=await db.prepare("SELECT COUNT(*) n FROM donors d WHERE "+MCCT_OPS_IDLE_WHERE).bind(cutoff).first();
 const rows=await db.prepare("SELECT d.id,d.full_name,d.registration_id,d.followup_status,d.updated_at,d.version FROM donors d WHERE "+MCCT_OPS_IDLE_WHERE+" ORDER BY d.updated_at ASC LIMIT 90").bind(cutoff).all();
 return {ok:true,cutoff,days:30,candidates:rows.results||[],count:total?.n||0,
    action:"For safety, candidates are queued for review. No application expires and no email is claimed delivered until outbound email is configured."};
}
async function mcctOpsQueueDaily(env){
 if(!env?.DB)return;
 const ts=now(),cutoff=ts-30*86400;
 const gate=await env.DB.prepare("INSERT INTO mcct_ops_run_state(task,last_run_at) VALUES(?,?) ON CONFLICT(task) DO UPDATE SET last_run_at=excluded.last_run_at WHERE last_run_at<?")
  .bind("daily-notification-scan",ts,ts-22*3600).run();
 if((gate.meta?.changes||0)<1)return;
 try{
  await env.DB.prepare("INSERT OR IGNORE INTO mcct_ops_expiry_review(donor_id,detected_at,last_updated_at) "+
    "SELECT d.id,?,d.updated_at FROM donors d WHERE "+MCCT_OPS_IDLE_WHERE).bind(ts,cutoff).run();
  await env.DB.prepare("INSERT OR IGNORE INTO mcct_ops_notification_outbox(id,donor_id,kind,target,created_at) "+
    "SELECT lower(hex(randomblob(16))),d.id,'FEEDBACK_EMAIL',d.email,? FROM donors d "+
    "WHERE d.followup_status='Completed' AND d.email IS NOT NULL AND TRIM(d.email)<>'' AND d.certificate_url IS NOT NULL AND TRIM(d.certificate_url)<>'' "+
    "AND NOT EXISTS(SELECT 1 FROM mc_donor_recycle b WHERE b.donor_id=d.id)").bind(ts).run();
 }catch(e){console.error("MCCT_OPS_DAILY_SCAN",String(e?.name||"Error"));}
}
async function mcctOpsChangeStatus(req,env,user,id,action){
 if(!MCCT_OPS_UUID.test(id))return mcctOpsReject("Invalid donor ID");
 const donor=await getDonor(env.DB,id);
 if(!donor)return mcctOpsReject("Donor not found or is archived",404);
 let data;try{data=await mcctOpsRead(req)}catch{return mcctOpsReject("Invalid JSON");}
 const version=mcctOpsInt(data.version,1,2147483647);
 if(!version||version!==donor.version)return mcctOpsReject("Record changed; reload before editing",409);
 const reason=mcctOpsVal(data.reason,450);
 if(reason.length<8)return mcctOpsReject("Enter a reason of at least 8 characters");
 const from=donor.followup_status;
 let to;
 if(action==="cancel"){
  if(from==="Completed")return mcctOpsReject("Completed donations cannot be cancelled",409);
  if(from==="Cancelled")return json({ok:true,no_change:true});
  if(from==="Expired")return mcctOpsReject("Reopen an expired donor before cancelling",409);
  to="Cancelled";
 }else if(action==="reopen"){
  if(!["Cancelled","Expired"].includes(from))return mcctOpsReject("Only Cancelled or Expired applications can be reopened",409);
  to="Pending";
 }else if(action==="expire"){
  return mcctOpsReject("Automated expiry is disabled until a verified email-delivery service is connected",409);
 }else return mcctOpsReject("Unknown status action",404);
 const ts=now(),auditId=crypto.randomUUID();
 const result=await env.DB.batch([
   env.DB.prepare("UPDATE donors SET followup_status=?,updated_at=?,version=version+1 WHERE id=? AND version=? AND followup_status=?")
     .bind(to,ts,id,version,from),
   env.DB.prepare("INSERT INTO mcct_ops_donor_status_events(id,donor_id,actor,old_status,new_status,reason,happened_at,version_before) "+
     "SELECT ?,?,?,?,?,?,?,? WHERE changes()=1").bind(auditId,id,user.username,from,to,reason,ts,version),
   env.DB.prepare("INSERT INTO donor_events(id,donor_id,actor,action,detail_json,happened_at) "+
     "SELECT ?,?,?,?,?,? WHERE changes()=1").bind(crypto.randomUUID(),id,user.username,"admin_status_"+to.toLowerCase(),JSON.stringify({from,to,reason}),ts)
 ]);
 if((result[0]?.meta?.changes||0)!==1)return mcctOpsReject("Conflict; reload donor",409);
 return json({ok:true,donor_id:id,old_status:from,followup_status:to,version:version+1});
}
async function mcctOpsHairList(db){
 const rs=await db.prepare("SELECT id,donor_id,source_type,source_label,hair_form,piece_count,length_inches,collection_mode,custodian_type,custodian_ref,location,stage,note,created_at,updated_at,version "+
   "FROM mcct_ops_hair_lots ORDER BY updated_at DESC LIMIT 300").all();
 const byCustodian=await db.prepare("SELECT custodian_type,location,stage,hair_form,SUM(piece_count) AS pieces,COUNT(*) AS lots "+
   "FROM mcct_ops_hair_lots GROUP BY custodian_type,location,stage,hair_form ORDER BY location,custodian_type").all();
 return {ok:true,lots:rs.results||[],custody:byCustodian.results||[]};
}
async function mcctOpsCreateHair(req,env,user){
 let d;try{d=await mcctOpsRead(req)}catch{return mcctOpsReject("Invalid JSON")}
 const sourceType=mcctOpsVal(d.source_type,20),form=mcctOpsVal(d.hair_form,20),mode=mcctOpsVal(d.collection_mode,20),custodian=mcctOpsVal(d.custodian_type,20);
 if(!MCCT_OPS_STOCK_TYPES.has(sourceType)||!MCCT_OPS_HAIR_FORMS.has(form)||!MCCT_OPS_MODES.has(mode)||!MCCT_OPS_CUSTODIANS.has(custodian))return mcctOpsReject("Select valid stock attributes");
 const pieces=mcctOpsInt(d.piece_count,1,10000);
 if(!pieces)return mcctOpsReject("Enter pieces between 1 and 10000");
 const length=d.length_inches==null||d.length_inches===""?null:Number(d.length_inches);
 if(length!==null&&(!Number.isFinite(length)||length<1||length>80))return mcctOpsReject("Invalid hair length");
 const place=mcctOpsVal(d.location,120)||MCCT_OPS_DEFAULT_LOCATION;
 const label=mcctOpsVal(d.source_label,160),custodianRef=mcctOpsVal(d.custodian_ref,140),note=mcctOpsVal(d.note,500);
 const donor=mcctOpsVal(d.donor_id,36)||null;
 if(donor&&!MCCT_OPS_UUID.test(donor))return mcctOpsReject("Invalid donor ID");
 if(donor&&!await env.DB.prepare("SELECT 1 present FROM donors WHERE id=?").bind(donor).first())return mcctOpsReject("Donor record not found",404);
 const ts=now(),id=crypto.randomUUID(),record={sourceType,form,mode,pieces,length,place,label,custodian,custodianRef,note,donor};
 await env.DB.batch([
  env.DB.prepare("INSERT INTO mcct_ops_hair_lots(id,donor_id,source_type,source_label,hair_form,piece_count,length_inches,collection_mode,custodian_type,custodian_ref,location,stage,note,created_by,updated_by,created_at,updated_at) "+
  "VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)").bind(id,donor,sourceType,label,form,pieces,length,mode,custodian,custodianRef,place,"received",note,user.username,user.username,ts,ts),
  env.DB.prepare("INSERT INTO mcct_ops_hair_events(id,lot_id,actor,action,before_json,after_json,happened_at) VALUES(?,?,?,?,?,?,?)").bind(crypto.randomUUID(),id,user.username,"created","{}",JSON.stringify(record),ts)
 ]);
 return json({ok:true,id,version:1,lot:record},201);
}
async function mcctOpsMoveHair(req,env,user,id){
 if(!MCCT_OPS_UUID.test(id))return mcctOpsReject("Invalid lot ID");
 let d;try{d=await mcctOpsRead(req)}catch{return mcctOpsReject("Invalid JSON")}
 const prior=await env.DB.prepare("SELECT * FROM mcct_ops_hair_lots WHERE id=?").bind(id).first();
 if(!prior)return mcctOpsReject("Hair stock lot not found",404);
 if(prior.stage==="consumed"||prior.stage==="closed")return mcctOpsReject("Closed stock cannot be transferred",409);
 const version=mcctOpsInt(d.version,1,2147483647);
 if(!version||version!==prior.version)return mcctOpsReject("Stock record changed; reload before saving",409);
 const custodian=mcctOpsVal(d.custodian_type,20),stage=mcctOpsVal(d.stage,24),place=mcctOpsVal(d.location,120),ref=mcctOpsVal(d.custodian_ref,140),note=mcctOpsVal(d.note,500);
 if(!MCCT_OPS_CUSTODIANS.has(custodian)||!MCCT_OPS_STAGES.has(stage)||!place)return mcctOpsReject("Invalid destination/custody state");
 const after={custodian_type:custodian,custodian_ref:ref,location:place,stage,note};
 const before={custodian_type:prior.custodian_type,custodian_ref:prior.custodian_ref,location:prior.location,stage:prior.stage,note:prior.note};
 if(JSON.stringify(after)===JSON.stringify(before))return json({ok:true,no_change:true});
 const ts=now();
 const results=await env.DB.batch([
  env.DB.prepare("UPDATE mcct_ops_hair_lots SET custodian_type=?,custodian_ref=?,location=?,stage=?,note=?,updated_by=?,updated_at=?,version=version+1 WHERE id=? AND version=?")
    .bind(custodian,ref,place,stage,note,user.username,ts,id,version),
  env.DB.prepare("INSERT INTO mcct_ops_hair_events(id,lot_id,actor,action,before_json,after_json,happened_at) SELECT ?,?,?,?,?,?,? WHERE changes()=1")
    .bind(crypto.randomUUID(),id,user.username,"transferred",JSON.stringify(before),JSON.stringify(after),ts)
 ]);
 if((results[0]?.meta?.changes||0)!==1)return mcctOpsReject("Stock moved by another administrator; reload",409);
 return json({ok:true,id,version:version+1,...after});
}
async function mcctOpsAPI(req,env,user,path){
 const method=req.method;
 if(method==="GET"&&path==="/summary")return json(await mcctOpsSummary(env.DB));
 if(method==="GET"&&path==="/inactive")return json(await mcctOpsIdle(env.DB));
 if(method==="GET"&&path==="/statuses"){
   const x=await env.DB.prepare("SELECT d.id,d.full_name,d.registration_id,d.followup_status,d.updated_at,d.version FROM donors d WHERE d.followup_status IN ('Cancelled','Expired') AND NOT EXISTS(SELECT 1 FROM mc_donor_recycle b WHERE b.donor_id=d.id) ORDER BY d.updated_at DESC LIMIT 120").all();
   return json({ok:true,records:x.results||[]});
 }
 if(method==="GET"&&path==="/hair")return json(await mcctOpsHairList(env.DB));
 if(method==="GET"&&path==="/outbox"){
  const q=await env.DB.prepare("SELECT kind,delivery_state,COUNT(*) AS n FROM mcct_ops_notification_outbox GROUP BY kind,delivery_state ORDER BY kind").all();
  return json({ok:true,states:q.results||[],delivery_configured:false});
 }
 if(method==="POST"&&!allowedWrite(req))return mcctOpsReject("Origin or request verification failed",403);
 if(method==="POST"&&path==="/scan"){
  await mcctOpsQueueDaily(env);
  const q=await env.DB.prepare("SELECT COUNT(*) AS n FROM mcct_ops_expiry_review WHERE decision='PENDING'").first();
  return json({ok:true,review_queue:q?.n||0,automatic_expiry:false,email_delivery:false});
 }
 if(method==="POST"&&path==="/hair")return mcctOpsCreateHair(req,env,user);
 const move=/^\/hair\/([0-9a-f-]{36})\/move$/i.exec(path);
 if(method==="POST"&&move)return mcctOpsMoveHair(req,env,user,move[1]);
 const donor=/^\/donors\/([0-9a-f-]{36})\/(cancel|reopen|expire)$/i.exec(path);
 if(method==="POST"&&donor)return mcctOpsChangeStatus(req,env,user,donor[1],donor[2]);
 return mcctOpsReject("Not found",404);
}
launch_wig_maker_portal_worker_default.fetch=async function(req,env,ctx){
 const path=new URL(req.url).pathname;
 if(path==="/admin-ops"||path.startsWith("/api/admin/ops/")){
  if(path==="/admin-ops"&&req.method!=="GET")return mcctOpsReject("Method not allowed",405);
  try{
   const user=await currentUser(req,env.DB);
   if(!user)return mcctOpsReject("Sign in to Donor Desk first",401);
   if(user.role!=="admin")return mcctOpsReject("Administrator only",403);
   if(path==="/admin-ops")return mcctOpsPage();
   return await mcctOpsAPI(req,env,user,path.slice("/api/admin/ops".length));
  }catch(e){console.error("MCCT_OPS_REQUEST",String(e?.name||"Error"));return mcctOpsReject("Operations temporarily unavailable",503)}
 }
 return MCCT_OPS_PREVIOUS_FETCH.call(this,req,env,ctx);
};
launch_wig_maker_portal_worker_default.scheduled=async function(controller,env,ctx){
 if(MCCT_OPS_PREVIOUS_SCHEDULED)await MCCT_OPS_PREVIOUS_SCHEDULED.call(this,controller,env,ctx);
 ctx.waitUntil(mcctOpsQueueDaily(env).catch(e=>console.error("MCCT_OPS_SCAN",String(e?.name||"Error"))));
};
