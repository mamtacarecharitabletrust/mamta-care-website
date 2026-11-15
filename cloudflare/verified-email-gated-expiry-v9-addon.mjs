/* Mamta Care V9 — 30-day inactive donor expiry with verified email gate.
 *
 * Scheduled scan prepares (but does not send) expiry email outbox rows.
 * Automatic email sending requires BOTH already-existing V8 email gates
 * plus an independent explicit V9 expiry gate. The first pilot is 1/day.
 *
 * Donor status only becomes Expired 24+ hours AFTER the Apps Script
 * MailApp ledger positively acknowledges sending an expiry email and
 * a fresh DB check confirms no courier, receipt, collection or stock and
 * no further donor update. Never delete an original donor/registration.
 */
const MCCT_EXP_V9_PREV_FETCH=launch_wig_maker_portal_worker_default.fetch;
const MCCT_EXP_V9_PREV_SCHEDULED=launch_wig_maker_portal_worker_default.scheduled;
const MCCT_EXP_V9_IDLE_FILTER=(
 "q.decision='PENDING' AND q.last_updated_at=d.updated_at "+
 "AND d.followup_status IN ('Pending','Not answered','Call again') "+
 "AND d.updated_at<? "+
 "AND d.source='google_sheet' "+
 "AND d.registration_id IS NOT NULL AND TRIM(d.registration_id)<>'' "+
 "AND d.email IS NOT NULL AND TRIM(d.email)<>'' AND d.consent='STRONGLY AGREE' "+
 "AND (d.verification_status IS NULL OR UPPER(TRIM(d.verification_status))<>'VERIFIED') "+
 "AND (d.certificate_url IS NULL OR TRIM(d.certificate_url)='') "+
 "AND NOT EXISTS(SELECT 1 FROM mc_donor_recycle b WHERE b.donor_id=d.id) "+
 "AND NOT EXISTS(SELECT 1 FROM mcq_donor_couriers c WHERE c.donor_id=d.id) "+
 "AND NOT EXISTS(SELECT 1 FROM mcct_parcel_receipts p WHERE p.donor_id=d.id) "+
 "AND NOT EXISTS(SELECT 1 FROM mcct_hand_collections h WHERE h.donor_id=d.id) "+
 "AND NOT EXISTS(SELECT 1 FROM mcct_staff_hand_collections sh WHERE sh.donor_id=d.id) "+
 "AND NOT EXISTS(SELECT 1 FROM mcct_ops_hair_lots l WHERE l.donor_id=d.id)"
);
function mcctExpiryV9Enabled(env){
 return mcctMailV8Enabled(env)&&String(env?.MC_NOTIFICATION_EXPIRY_ENABLED||"")==="true";
}
function mcctExpiryV9DailyCap(env){
 return String(env?.MC_NOTIFICATION_EXPIRY_DAILY_CAP||"")==="5"?5:1;
}
async function mcctExpiryV9Stage(env){
 const db=env.DB,ts=Math.floor(Date.now()/1000),cutoff=ts-30*86400;
 const statement="INSERT OR IGNORE INTO mcct_ops_notification_outbox(id,donor_id,kind,target,created_at) "+
  "SELECT lower(hex(randomblob(16))),d.id,'EXPIRY_EMAIL',LOWER(TRIM(d.email)),? "+
  "FROM donors d JOIN mcct_ops_expiry_review q ON q.donor_id=d.id WHERE "+MCCT_EXP_V9_IDLE_FILTER;
 const result=await db.prepare(statement).bind(ts,cutoff).run();
 return {queued:Number(result.meta?.changes||0)};
}
async function mcctExpiryV9Reconcile(env){
 const rows=await env.DB.prepare("SELECT id FROM mcct_ops_notification_outbox WHERE kind='EXPIRY_EMAIL' AND delivery_state='READY' ORDER BY created_at LIMIT 10").all();
 let accepted=0,waiting=0,reset=0;
 for(const row of rows.results||[]){
  if(!MCCT_MAIL_V8_OUTBOX_ID.test(String(row.id||"")))continue;
  try{
   const status=await mcctMailV8Call(env,"desk_notification_status",{outbox_id:row.id});
   if(status.ok!==true){waiting++;continue}
   if(status.outbox_id===row.id&&status.state==="SENT"&&status.sent===true){
    const x=await env.DB.prepare("UPDATE mcct_ops_notification_outbox SET delivery_state='SENT',sent_at=?,last_error='' WHERE id=? AND delivery_state='READY' AND kind='EXPIRY_EMAIL'").bind(Math.floor(Date.now()/1000),row.id).run();
    if((x.meta?.changes||0)===1){accepted++;await mcctMailV8Log(env.DB,row.id,"RECONCILED","Original Apps Script ledger confirms MailApp acceptance, not recipient delivery");}
   }else if(status.outbox_id===row.id&&status.state==="NOT_FOUND"){
    const x=await env.DB.prepare("UPDATE mcct_ops_notification_outbox SET delivery_state='PENDING_CONFIGURATION',last_error='' WHERE id=? AND delivery_state='READY' AND kind='EXPIRY_EMAIL'").bind(row.id).run();
    if((x.meta?.changes||0)===1)reset++;
   }else waiting++;
  }catch{waiting++;}
 }
 return {accepted,waiting,reset};
}
async function mcctExpiryV9Send(env){
 if(!mcctExpiryV9Enabled(env))return {ready:false,sent:0};
 const health=await mcctMailV8Health(env);
 if(!health.ready_to_send)return {ready:false,sent:0};
 const db=env.DB,start=mcctMailV8MidnightUTC(),next=start+86400;
 const count=await db.prepare("SELECT COUNT(*) n FROM mcct_ops_notification_outbox WHERE delivery_state='SENT' AND kind IN ('FEEDBACK_EMAIL','EXPIRY_EMAIL') AND sent_at>=? AND sent_at<?").bind(start,next).first();
 const allSent=Number(count?.n||0);
 let budget=Math.min(3,mcctExpiryV9DailyCap(env),Math.max(0,25-allSent),health.mail_quota_remaining-10);
 if(!Number.isSafeInteger(budget)||budget<=0)return {ready:true,sent:0,quota_limited:true};
 const cutoff=Math.floor(Date.now()/1000)-30*86400;
 const rows=await db.prepare(
  "SELECT o.id,d.full_name,d.email,d.registration_id FROM mcct_ops_notification_outbox o "+
  "JOIN donors d ON d.id=o.donor_id JOIN mcct_ops_expiry_review q ON q.donor_id=d.id "+
  "WHERE o.kind='EXPIRY_EMAIL' AND o.delivery_state='PENDING_CONFIGURATION' "+
  "AND LOWER(TRIM(d.email))=LOWER(TRIM(o.target)) AND "+MCCT_EXP_V9_IDLE_FILTER+
  " ORDER BY q.detected_at ASC LIMIT 8"
 ).bind(cutoff).all();
 let sent=0,uncertain=0;
 for(const r of rows.results||[]){
  if(budget<=0)break;
  if(!MCCT_MAIL_V8_OUTBOX_ID.test(String(r.id||""))||!mcctMailV8ValidEmail(r.email)||
     !/^\d{4}-\d{4}\d+\/M\/2022$/.test(String(r.registration_id||"")))continue;
  const reserved=await db.prepare("UPDATE mcct_ops_notification_outbox SET delivery_state='READY',last_error='' WHERE id=? AND kind='EXPIRY_EMAIL' AND delivery_state='PENDING_CONFIGURATION'").bind(r.id).run();
  if((reserved.meta?.changes||0)!==1)continue;
  budget--;
  await mcctMailV8Log(db,r.id,"RESERVED","30-day inactivity notice reserved. Donor unchanged.");
  try{
   const response=await mcctMailV8Call(env,"desk_notification_send",{
    outbox_id:r.id,kind:"EXPIRY_EMAIL",email:r.email,
    donor_name:String(r.full_name||"").slice(0,100),registration_id:r.registration_id
   });
   if(response.ok===true&&response.sent===true&&response.outbox_id===r.id&&response.mailapp_accepted===true){
    const result=await db.prepare("UPDATE mcct_ops_notification_outbox SET delivery_state='SENT',sent_at=?,last_error='' WHERE id=? AND delivery_state='READY' AND kind='EXPIRY_EMAIL'").bind(Math.floor(Date.now()/1000),r.id).run();
    if((result.meta?.changes||0)===1){sent++;await mcctMailV8Log(db,r.id,"PROVIDER_ACCEPTED","Expiry notice accepted by MailApp; donor is not yet expired, delivery unverified");}
   }else{uncertain++;await mcctMailV8Log(db,r.id,"UNCERTAIN","Provider acceptance uncertain; donor not expired and no automatic resend");}
  }catch{uncertain++;await mcctMailV8Log(db,r.id,"UNCERTAIN","Network failure or uncertain outcome; leave donor active");}
 }
 return {ready:true,sent,uncertain};
}
async function mcctExpiryV9Finalize(env){
 if(!mcctExpiryV9Enabled(env))return {closed:0,enabled:false};
 const health=await mcctMailV8Health(env);
 if(!health.ready_to_send)return {closed:0,enabled:true,relay_not_ready:true};
 const db=env.DB,ts=Math.floor(Date.now()/1000),cutoff=ts-30*86400,grace=ts-86400;
 const cases=await db.prepare(
  "SELECT d.id,d.version,d.updated_at,d.followup_status FROM donors d "+
  "JOIN mcct_ops_expiry_review q ON q.donor_id=d.id "+
  "JOIN mcct_ops_notification_outbox o ON o.donor_id=d.id AND o.kind='EXPIRY_EMAIL' "+
  "WHERE "+MCCT_EXP_V9_IDLE_FILTER+" AND o.delivery_state='SENT' "+
  "AND o.sent_at IS NOT NULL AND o.sent_at<=? ORDER BY o.sent_at ASC LIMIT 10"
 ).bind(cutoff,grace).all();
 let closed=0,conflicts=0;
 for(const d of cases.results||[]){
  try{
   const reason="Automatically expired after 30+ inactive days, no recorded hair receipt/dispatch, and MailApp-accepted expiry email with 24h grace; donor history retained.";
   const result=await db.batch([
    db.prepare(
     "UPDATE donors SET followup_status='Expired',updated_at=?,version=version+1 "+
     "WHERE id=? AND version=? AND updated_at=? AND followup_status=? "+
     "AND EXISTS(SELECT 1 FROM donors d JOIN mcct_ops_expiry_review q ON q.donor_id=d.id WHERE d.id=donors.id AND "+MCCT_EXP_V9_IDLE_FILTER+") "+
     "AND EXISTS(SELECT 1 FROM mcct_ops_notification_outbox o WHERE o.donor_id=donors.id AND o.kind='EXPIRY_EMAIL' AND o.delivery_state='SENT' AND o.sent_at<=?)"
    ).bind(ts,d.id,d.version,d.updated_at,d.followup_status,cutoff,grace),
    db.prepare("INSERT INTO mcct_ops_donor_status_events(id,donor_id,actor,old_status,new_status,reason,happened_at,version_before) "+
      "SELECT ?,?,?,?,?,?,?,? WHERE changes()=1")
      .bind(crypto.randomUUID(),d.id,"automatic_expiry_guard",d.followup_status,"Expired",reason,ts,d.version),
    db.prepare("INSERT INTO donor_events(id,donor_id,actor,action,detail_json,happened_at) "+
      "SELECT ?,?,?,?,?,? WHERE changes()=1")
      .bind(crypto.randomUUID(),d.id,"automatic_expiry_guard","expiry_notice_accepted_and_30_days",JSON.stringify({old_status:d.followup_status,email_accepted:true,delivered_unverified:true,reopenable:true,old_version:d.version}),ts),
    db.prepare("UPDATE mcct_ops_expiry_review SET decision='APPROVED',decided_by=?,decided_at=?,note=? "+
      "WHERE donor_id=? AND decision='PENDING' AND changes()=1")
      .bind("automatic_expiry_guard",ts,reason,d.id)
   ]);
   if(result.every(x=>(x.meta?.changes||0)===1))closed++;else conflicts++;
  }catch(e){conflicts++;console.error("MCCT_EXP_V9_FINALIZE",String(e?.name||"Error"))}
 }
 return {closed,conflicts,enabled:true};
}
async function mcctExpiryV9Summary(env){
 const db=env.DB;
 const [queue,reviews,closed]=await Promise.all([
  db.prepare("SELECT delivery_state,COUNT(*) n FROM mcct_ops_notification_outbox WHERE kind='EXPIRY_EMAIL' GROUP BY delivery_state").all(),
  db.prepare("SELECT decision,COUNT(*) n FROM mcct_ops_expiry_review GROUP BY decision").all(),
  db.prepare("SELECT COUNT(*) n FROM donors WHERE followup_status='Expired'").first()
 ]);
 const enabled=mcctExpiryV9Enabled(env);
 return mcctMailV8Json({ok:true,expiry_automatic_enabled:enabled,source:"30-day donor status review",
  notification_states:queue.results||[],review_states:reviews.results||[],expired_record_count:closed?.n||0,
  status_change_requirements:["30 days no update","original official registration","no receipt, courier or collection","verified MailApp send acceptance","24 hour grace","original donor record retained"],
  email_delivery_unverified_even_if_accepted:true});
}
launch_wig_maker_portal_worker_default.fetch=async function(req,env,ctx){
 const p=new URL(req.url).pathname;
 if(p==="/admin-expiry-automation"||p.startsWith("/api/admin/ops/v9/")){
  try{
   const user=await currentUser(req,env.DB);
   if(!user)return mcctMailV8Err("Login required",401);
   if(user.role!=="admin")return mcctMailV8Err("Administrator only",403);
   if(p==="/admin-expiry-automation"){
    return req.method==="GET"?mcctWigV3SecureHTML(MCCT_EXP_V9_HTML,false):mcctMailV8Err("Method not allowed",405);
   }
   const action=p.slice("/api/admin/ops/v9/".length);
   if(req.method==="GET"&&action==="status")return mcctExpiryV9Summary(env);
   if(req.method==="POST"&&action==="scan"){
    if(!allowedWrite(req))return mcctMailV8Err("Origin verification failed",403);
    return mcctMailV8Json({ok:true,...await mcctExpiryV9Stage(env),emails_sent:0,donors_expired:0});
   }
   return mcctMailV8Err("Not found",404);
  }catch(e){console.error("MCCT_EXP_V9_ADMIN",String(e?.name||"Error"));return mcctMailV8Err("Expiry service temporarily unavailable",503)}
 }
 if(p==="/admin-ops"&&req.method==="GET"){
  const res=await MCCT_EXP_V9_PREV_FETCH.call(this,req,env,ctx);
  if(!res.ok||!String(res.headers.get("Content-Type")||"").includes("text/html"))return res;
  const html=await res.text(),anchor='<a class="tile" href="/app/photo-decisions">';
  const tile='<a class="tile" href="/admin-expiry-automation"><b>30-Day Expiry Safeguards</b><small>Review queued inactive cases and verified-notification requirements before expiration</small></a>';
  return new Response(html.includes(anchor)?html.replace(anchor,tile+anchor):html,{status:res.status,headers:res.headers});
 }
 return MCCT_EXP_V9_PREV_FETCH.call(this,req,env,ctx);
};
launch_wig_maker_portal_worker_default.scheduled=async function(controller,env,ctx){
 if(MCCT_EXP_V9_PREV_SCHEDULED)await MCCT_EXP_V9_PREV_SCHEDULED.call(this,controller,env,ctx);
 ctx.waitUntil((async()=>{
   await mcctExpiryV9Stage(env);
   if(mcctExpiryV9Enabled(env)){
     await mcctExpiryV9Reconcile(env);
     await mcctExpiryV9Send(env);
     await mcctExpiryV9Finalize(env);
   }
 })().catch(e=>console.error("MCCT_EXP_V9_SCHEDULED",String(e?.name||"Error"))));
};
