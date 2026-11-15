/* Mamta Care V8 — Verified Google Apps Script donor email relay.
 *
 * Source-only integration; sending remains disabled until BOTH gates:
 *   env.MC_NOTIFICATION_EMAIL_ENABLED === "true"
 *   Apps Script MCCT_NOTIFICATION_RELAY_ENABLE_SEND === "YES"
 * and health probe confirms the authenticated MailApp relay.
 *
 * The existing Google registration email automation is NOT duplicated:
 * V8 processes FEEDBACK_EMAIL only after completed/certificate/consent
 * checks. Expiry emails and status rejection remain disabled for now.
 * Every send reserves D1 first, then the Apps Script bridge reserves its
 * own immutable outbox ID before MailApp. Uncertain sends NEVER auto-retry.
 */
const MCCT_MAIL_V8_PREVIOUS_FETCH=launch_wig_maker_portal_worker_default.fetch;
const MCCT_MAIL_V8_PREVIOUS_SCHEDULED=launch_wig_maker_portal_worker_default.scheduled;
const MCCT_MAIL_V8_OUTBOX_ID=/^(?:[0-9a-f]{32}|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;
function mcctMailV8Json(payload,status=200){
 return new Response(JSON.stringify(payload),{status,headers:{"Content-Type":"application/json; charset=utf-8","Cache-Control":"private,no-store","X-Content-Type-Options":"nosniff","Referrer-Policy":"no-referrer"}});
}
function mcctMailV8Err(message,status=400){return mcctMailV8Json({ok:false,error:message},status)}
function mcctMailV8Enabled(env){return String(env?.MC_NOTIFICATION_EMAIL_ENABLED||"")==="true"}
function mcctMailV8IST(){return mcctWigV3IST(new Date())}
function mcctMailV8MidnightUTC(){
 const d=mcctMailV8IST();
 return Math.floor(Date.parse(d+"T00:00:00+05:30")/1000);
}
function mcctMailV8ValidEmail(x){
 const s=String(x||"").trim().toLowerCase();
 return s.length<=180 && /^[^\s@<>"(),;]+@[^\s@<>"(),;]+\.[a-z]{2,}$/i.test(s);
}
function mcctMailV8RelayURL(env){
 const str=String(env?.SOCIAL_BRIDGE_URL||"");
 const url=new URL(str);
 if(url.protocol!=="https:"||url.hostname!=="script.google.com"||
    !/^\/macros\/s\/[^/]+\/exec$/.test(url.pathname))throw Error("Official Apps Script relay unavailable");
 if(String(env?.MC_DESK_SHARED_SECRET||"").length<48)throw Error("Bridge authentication unavailable");
 return url;
}
async function mcctMailV8Call(env,action,data={}){
 const url=mcctMailV8RelayURL(env);
 const body=JSON.stringify({action,secret:env.MC_DESK_SHARED_SECRET,...data});
 const response=await fetch(url.toString(),{
  method:"POST",redirect:"follow",
  headers:{"Content-Type":"application/json"},body,
  signal:typeof AbortSignal.timeout==="function"?AbortSignal.timeout(12000):undefined
 });
 if(!response.ok)throw Error("Apps Script relay did not respond");
 const raw=await response.text();
 if(raw.length>10000)throw Error("Unexpected relay response size");
 const parsed=JSON.parse(raw);
 if(!parsed || typeof parsed!=="object"||Array.isArray(parsed))throw Error("Unrecognized relay result");
 return parsed;
}
async function mcctMailV8Health(env){
 let connection=false,enabled=false,quota=null,ledger=false,reason="";
 try{
  const result=await mcctMailV8Call(env,"desk_notification_health");
  if(result?.ok===true && result?.relay==="mamta_donor_notification_v1"){
   connection=true;enabled=result.ready_send===true;
   quota=Number.isSafeInteger(result.remaining_recipients)?Math.max(0,result.remaining_recipients):null;
   ledger=Boolean(result.ledger_exists);
  }else reason="Apps Script relay route is not installed or not authorized";
 }catch(e){reason=String(e?.message||"Relay unavailable").slice(0,120)}
 return {relay_connected:connection,apps_script_send_enabled:enabled,worker_send_enabled:mcctMailV8Enabled(env),
  mail_quota_remaining:quota,ledger_present:ledger,ready_to_send:connection&&enabled&&mcctMailV8Enabled(env)&&Number.isSafeInteger(quota)&&quota>10,reason};
}
async function mcctMailV8Status(env){
 const db=env.DB;
 const [groups,eligible,blocked,opened]=await Promise.all([
  db.prepare("SELECT kind,delivery_state,COUNT(*) AS count FROM mcct_ops_notification_outbox GROUP BY kind,delivery_state ORDER BY kind,delivery_state").all(),
  db.prepare("SELECT COUNT(*) n FROM mcct_ops_notification_outbox o JOIN donors d ON d.id=o.donor_id WHERE o.kind='FEEDBACK_EMAIL' AND o.delivery_state='PENDING_CONFIGURATION' AND d.followup_status='Completed' AND d.source='google_sheet' AND d.consent='STRONGLY AGREE' AND d.certificate_url IS NOT NULL AND TRIM(d.certificate_url)<>'' AND d.email IS NOT NULL AND LOWER(TRIM(d.email))=LOWER(TRIM(o.target)) AND d.registration_id IS NOT NULL AND TRIM(d.registration_id)<>'' AND NOT EXISTS(SELECT 1 FROM mc_donor_recycle b WHERE b.donor_id=d.id)").first(),
  db.prepare("SELECT COUNT(*) n FROM mcct_ops_notification_outbox WHERE delivery_state='READY'").first(),
  db.prepare("SELECT COUNT(*) n FROM mcct_ops_notification_outbox WHERE delivery_state='SENT'").first()
 ]);
 const health=await mcctMailV8Health(env);
 return mcctMailV8Json({ok:true,notifications:groups.results||[],eligible_feedback_email:eligible?.n||0,
  uncertain_or_in_progress:blocked?.n||0,mailapp_accepted_total:opened?.n||0,
  ...health,registration_emails_not_replaced:true,expiry_notifications_not_activated:true,
  accepted_is_not_delivered:true,limits:{feedback_emails_per_day:20,min_other_email_quota_reserved:10}});
}
async function mcctMailV8Log(db,id,state,detail){
 return db.prepare("INSERT INTO mcct_notification_dispatch_events(id,outbox_id,event_state,detail,happened_at) VALUES(?,?,?,?,?)")
  .bind(crypto.randomUUID(),id,state,detail,Math.floor(Date.now()/1000)).run();
}
async function mcctMailV8ReconcileReserved(env){
 const db=env.DB;
 const rows=await db.prepare("SELECT id FROM mcct_ops_notification_outbox WHERE delivery_state='READY' AND kind='FEEDBACK_EMAIL' ORDER BY created_at LIMIT 12").all();
 let acknowledged=0,still_uncertain=0,reset=0;
 for(const row of rows.results||[]){
  if(!MCCT_MAIL_V8_OUTBOX_ID.test(String(row.id||"")))continue;
  try{
   const remote=await mcctMailV8Call(env,"desk_notification_status",{outbox_id:row.id});
   if(remote.ok!==true){still_uncertain++;continue}
   if(remote.sent===true && remote.state==="SENT" && remote.outbox_id===row.id){
    const x=await db.prepare("UPDATE mcct_ops_notification_outbox SET delivery_state='SENT',sent_at=?,last_error='' WHERE id=? AND delivery_state='READY'")
      .bind(Math.floor(Date.now()/1000),row.id).run();
    if((x.meta?.changes||0)===1){acknowledged++;await mcctMailV8Log(db,row.id,"RECONCILED","Original MailApp ledger confirms acceptance; not end recipient delivery");}
   }else if(remote.state==="NOT_FOUND"&&remote.outbox_id===row.id){
    // Relay never reserved this specific ID; retry is safe after re-checking eligibility.
    const x=await db.prepare("UPDATE mcct_ops_notification_outbox SET delivery_state='PENDING_CONFIGURATION',last_error='' WHERE id=? AND delivery_state='READY'").bind(row.id).run();
    if((x.meta?.changes||0)===1)reset++;
   }else still_uncertain++;
  }catch{still_uncertain++;}
 }
 return {acknowledged,still_uncertain,reset};
}
async function mcctMailV8Pump(env){
 if(!env?.DB||!mcctMailV8Enabled(env))return {enabled:false,sent:0};
 const h=await mcctMailV8Health(env);
 if(!h.ready_to_send)return {enabled:true,ready:false,sent:0};
 const db=env.DB;
 await mcctMailV8ReconcileReserved(env);
 const start=mcctMailV8MidnightUTC(),next=start+86400;
 const count=await db.prepare("SELECT COUNT(*) n FROM mcct_ops_notification_outbox WHERE kind='FEEDBACK_EMAIL' AND delivery_state='SENT' AND sent_at>=? AND sent_at<?").bind(start,next).first();
 let budget=Math.min(5,20-Number(count?.n||0),Number(h.mail_quota_remaining)-10);
 if(!Number.isSafeInteger(budget)||budget<1)return {enabled:true,ready:true,sent:0,quota_limited:true};
 const list=await db.prepare(
  "SELECT o.id,d.full_name,d.email,d.registration_id FROM mcct_ops_notification_outbox o "+
  "JOIN donors d ON d.id=o.donor_id WHERE o.kind='FEEDBACK_EMAIL' AND o.delivery_state='PENDING_CONFIGURATION' "+
  "AND d.source='google_sheet' AND d.followup_status='Completed' AND d.consent='STRONGLY AGREE' "+
  "AND d.certificate_url IS NOT NULL AND TRIM(d.certificate_url)<>'' "+
  "AND d.registration_id IS NOT NULL AND TRIM(d.registration_id)<>'' "+
  "AND d.email IS NOT NULL AND LOWER(TRIM(d.email))=LOWER(TRIM(o.target)) "+
  "AND NOT EXISTS(SELECT 1 FROM mc_donor_recycle b WHERE b.donor_id=d.id) "+
  "ORDER BY o.created_at LIMIT 10"
 ).all();
 let sent=0,uncertain=0;
 for(const item of list.results||[]){
  if(budget<1)break;
  if(!MCCT_MAIL_V8_OUTBOX_ID.test(String(item.id||""))||!mcctMailV8ValidEmail(item.email)||
     !/^\d{4}-\d{4}\d+\/M\/2022$/.test(String(item.registration_id||"")))continue;
  const reserved=await db.prepare("UPDATE mcct_ops_notification_outbox SET delivery_state='READY',last_error='' WHERE id=? AND kind='FEEDBACK_EMAIL' AND delivery_state='PENDING_CONFIGURATION'")
    .bind(item.id).run();
  if((reserved.meta?.changes||0)!==1)continue;
  budget--;
  await mcctMailV8Log(db,item.id,"RESERVED","Email reserved, double opt-in gating and donor eligibility checked");
  try{
   const result=await mcctMailV8Call(env,"desk_notification_send",{
    outbox_id:item.id,kind:"FEEDBACK_EMAIL",email:item.email,donor_name:String(item.full_name||"").slice(0,100),registration_id:item.registration_id
   });
   if(result.ok===true&&result.sent===true&&result.outbox_id===item.id&&result.mailapp_accepted===true){
    const r=await db.prepare("UPDATE mcct_ops_notification_outbox SET delivery_state='SENT',sent_at=?,last_error='' WHERE id=? AND delivery_state='READY'")
      .bind(Math.floor(Date.now()/1000),item.id).run();
    if((r.meta?.changes||0)===1){await mcctMailV8Log(db,item.id,"PROVIDER_ACCEPTED","Google MailApp send call accepted; recipient delivery not verified");sent++;}
   }else{
    uncertain++;await mcctMailV8Log(db,item.id,"UNCERTAIN","Relay did not confirm provider acceptance; never automatically resend this ID");
   }
  }catch{
   uncertain++;await mcctMailV8Log(db,item.id,"UNCERTAIN","Relay request uncertain; waiting for idempotent status lookup, no automatic duplicate");
  }
 }
 return {enabled:true,ready:true,sent,uncertain,remaining_budget:budget};
}
launch_wig_maker_portal_worker_default.fetch=async function(req,env,ctx){
 const url=new URL(req.url),path=url.pathname;
 if(path==="/admin-notification-outbox"||path.startsWith("/api/admin/ops/v8/")){
  try{
   const actor=await currentUser(req,env.DB);
   if(!actor)return mcctMailV8Err("Login required",401);
   if(actor.role!=="admin")return mcctMailV8Err("Administrator only",403);
   if(path==="/admin-notification-outbox")
    return req.method==="GET"?mcctWigV3SecureHTML(MCCT_MAIL_V8_HTML,false):mcctMailV8Err("Method not allowed",405);
   const action=path.slice("/api/admin/ops/v8/".length);
   if(req.method==="GET"&&action==="status")return mcctMailV8Status(env);
   if(req.method==="POST"&&action==="reconcile"){
    if(!allowedWrite(req))return mcctMailV8Err("Origin verification failed",403);
    if(!mcctMailV8Enabled(env))return mcctMailV8Json({ok:true,reconciled:false,reason:"Sending disabled. No provider call issued."});
    return mcctMailV8Json({ok:true,...await mcctMailV8ReconcileReserved(env)});
   }
   return mcctMailV8Err("Not found",404);
  }catch(e){console.error("MCCT_MAIL_V8_ADMIN",String(e?.name||"Error"));return mcctMailV8Err("Notification service temporarily unavailable",503)}
 }
 if(path==="/admin-ops"&&req.method==="GET"){
  const response=await MCCT_MAIL_V8_PREVIOUS_FETCH.call(this,req,env,ctx);
  if(!response.ok||!String(response.headers.get("Content-Type")||"").includes("text/html"))return response;
  const original=await response.text(),anchor='<a class="tile" href="/app/photo-decisions">';
  const link='<a class="tile" href="/admin-notification-outbox"><b>Donor Notification Outbox</b><small>Verified email integration readiness, pending notifications and duplicate-safe delivery status</small></a>';
  return new Response(original.includes(anchor)?original.replace(anchor,link+anchor):original,{status:response.status,headers:response.headers});
 }
 return MCCT_MAIL_V8_PREVIOUS_FETCH.call(this,req,env,ctx);
};
launch_wig_maker_portal_worker_default.scheduled=async function(controller,env,ctx){
 if(MCCT_MAIL_V8_PREVIOUS_SCHEDULED)await MCCT_MAIL_V8_PREVIOUS_SCHEDULED.call(this,controller,env,ctx);
 if(mcctMailV8Enabled(env))ctx.waitUntil(mcctMailV8Pump(env).catch(e=>console.error("MCCT_MAIL_V8_PUMP",String(e?.name||"Error"))));
};
