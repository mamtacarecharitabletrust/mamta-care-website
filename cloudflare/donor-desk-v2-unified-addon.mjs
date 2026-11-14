/* Mamta Care — Unified Donor Desk Operations Release V2.
 * Append after the latest production V1 script. Never replace its existing
 * donor, staff, wig, photo, courier, certificate or scheduled handlers.
 * MCCT_V2_HTML is separately injected as an unmodified HTML string at deploy.
 */
const MCCT_V2_PREV_FETCH=launch_wig_maker_portal_worker_default.fetch;
const MCCT_V2_UUID=/^[0-9a-f-]{36}$/i;
const MCCT_V2_REG=/^\d{4}-\d{4}\d+\/M\/2022$/;
const MCCT_V2_STAGES=new Set(["received","in_transit","with_custodian","at_fabricator","consumed","closed"]);
const MCCT_V2_CUSTODIANS=new Set(["staff","volunteer","salon","hospital","center","fabricator","other"]);
function mcctV2Str(v,len=160){return String(v??"").trim().slice(0,len)}
function mcctV2Err(message,status=400){return json({ok:false,error:message},status)}
function mcctV2IST(){const p=new Intl.DateTimeFormat("en-GB",{timeZone:"Asia/Kolkata",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date());const v=k=>p.find(x=>x.type===k)?.value||"";return v("year")+"-"+v("month")+"-"+v("day")}
function mcctV2SafeCsv(v){
 const s=String(v??"").replace(/\r?\n/g," ").slice(0,1200);
 const f=/^[=+\-@]/.test(s)?"'"+s:s;
 return '"'+f.replace(/"/g,'""')+'"';
}
function mcctV2HTMLResponse(){
 const random=Array.from(crypto.getRandomValues(new Uint8Array(20)),b=>b.toString(16).padStart(2,"0")).join("");
 const page=MCCT_V2_HTML.replaceAll("MCCT_V2_NONCE_PLACEHOLDER",random);
 return new Response(page,{status:200,headers:{"Content-Type":"text/html; charset=utf-8","Cache-Control":"private,no-store","X-Content-Type-Options":"nosniff","X-Frame-Options":"DENY","Referrer-Policy":"no-referrer","Content-Security-Policy":"default-src 'none';script-src 'nonce-"+random+"';style-src 'nonce-"+random+"';img-src 'self';connect-src 'self';form-action 'none';base-uri 'none';frame-ancestors 'none';media-src 'self' blob:"}});
}
async function mcctV2Body(req){
 const n=Number(req.headers.get("Content-Length")||0);
 if(n>16000)throw Error("Request too large");
 const s=await req.text();
 if(s.length>16000)throw Error("Request too large");
 return JSON.parse(s||"{}");
}
async function mcctV2Metrics(db){
 const reads=await Promise.all([
  db.prepare("SELECT COUNT(*) n FROM website_form_intakes i JOIN mc_v3_photo_review_actions a ON a.submission_uuid=i.submission_uuid WHERE a.decision='ACCEPTED_FOR_FOLLOWUP' AND NOT EXISTS(SELECT 1 FROM mcct_ops_review_links l WHERE l.submission_uuid=i.submission_uuid)").first(),
  db.prepare("SELECT COUNT(*) n FROM website_form_intakes i WHERE i.state='REVIEW_REQUIRED' AND NOT EXISTS(SELECT 1 FROM mc_v3_photo_review_actions a WHERE a.submission_uuid=i.submission_uuid)").first(),
  db.prepare("SELECT COUNT(DISTINCT z.donor_id) n FROM (SELECT donor_id FROM mcct_parcel_receipts UNION SELECT donor_id FROM mcct_staff_hand_collections WHERE status='received_at_center' UNION SELECT donor_id FROM mcct_hand_collections WHERE status='received_at_center') z WHERE NOT EXISTS(SELECT 1 FROM mcct_ops_hair_lots l WHERE l.donor_id=z.donor_id)").first(),
  db.prepare("SELECT COUNT(*) n FROM mcct_ops_expiry_review WHERE decision='PENDING'").first(),
  db.prepare("SELECT COUNT(*) n FROM mcct_ops_notification_outbox WHERE delivery_state='PENDING_CONFIGURATION'").first(),
  db.prepare("SELECT COUNT(*) n FROM mcct_ops_hair_lots WHERE stage NOT IN ('consumed','closed')").first(),
  db.prepare("SELECT COUNT(*) n FROM mcct_ops_manual_comms WHERE day_ist=? AND channel IN ('WHATSAPP','SMS') AND state<>'CANCELLED'").bind(mcctV2IST()).first(),
  db.prepare("SELECT username,display_name,role,active FROM staff WHERE active=1 ORDER BY CASE WHEN role='admin' THEN 0 ELSE 1 END,display_name LIMIT 40").all(),
 ]);
 return json({ok:true,accepted_unlinked:reads[0]?.n||0,photo_review_pending:reads[1]?.n||0,received_missing_hair_stock:reads[2]?.n||0,expiry_review:reads[3]?.n||0,undelivered_queued:reads[4]?.n||0,active_hair_lots:reads[5]?.n||0,messaging_drafts_today:reads[6]?.n||0,daily_manual_message_limit:50,staff:reads[7]?.results||[],assurance:{automatic_sms:false,automatic_email:false,automatic_expiry:false,live_sheet_reconciliation:false}});
}
async function mcctV2Reviews(db){
 const q=await db.prepare("SELECT i.submission_uuid,i.state,i.registration_id AS intake_registration_id,i.created_at,a.decision,a.review_note,l.registration_id AS linked_registration_id,l.donor_id AS linked_donor_id,l.verified_at FROM website_form_intakes i LEFT JOIN mc_v3_photo_review_actions a ON a.submission_uuid=i.submission_uuid LEFT JOIN mcct_ops_review_links l ON l.submission_uuid=i.submission_uuid WHERE i.state='REVIEW_REQUIRED' ORDER BY CASE WHEN a.decision='ACCEPTED_FOR_FOLLOWUP' AND l.submission_uuid IS NULL THEN 0 WHEN a.decision IS NULL THEN 1 ELSE 2 END,i.created_at ASC LIMIT 140").all();
 return json({ok:true,submissions:q.results||[],message:"Photo decisions do not mint official IDs. Link only when an official Google Sheets ID exists and identity is verified."});
}
async function mcctV2LinkReviewed(req,env,user){
 let v;try{v=await mcctV2Body(req)}catch{return mcctV2Err("Invalid JSON")}
 const id=mcctV2Str(v.submission_uuid,36),reg=mcctV2Str(v.registration_id,110),note=mcctV2Str(v.note,450);
 if(!MCCT_V2_UUID.test(id)||!MCCT_V2_REG.test(reg)||note.length<10||v.identity_confirmed!==true)return mcctV2Err("Valid submission, official registration ID, identity attestation and 10-character review note required");
 const prior=await env.DB.prepare("SELECT l.donor_id FROM mcct_ops_review_links l WHERE l.submission_uuid=?").bind(id).first();
 if(prior)return mcctV2Err("Already linked; duplicates are not permitted",409);
 const review=await env.DB.prepare("SELECT i.submission_uuid FROM website_form_intakes i JOIN mc_v3_photo_review_actions a ON a.submission_uuid=i.submission_uuid WHERE i.submission_uuid=? AND i.state='REVIEW_REQUIRED' AND a.decision='ACCEPTED_FOR_FOLLOWUP'").bind(id).first();
 if(!review)return mcctV2Err("Submission must first be accepted in the existing photo review workflow",409);
 const donors=await env.DB.prepare("SELECT id,full_name,registration_id FROM donors WHERE LOWER(TRIM(registration_id))=LOWER(?) LIMIT 2").bind(reg).all();
 if(donors.results.length!==1)return mcctV2Err("Official registration ID not found uniquely in Donor Desk. Wait for Google Sheet import or resolve duplicates.",409);
 const donor=donors.results[0],ts=now();
 try{
  const results=await env.DB.batch([
   env.DB.prepare("INSERT INTO mcct_ops_review_links(submission_uuid,donor_id,registration_id,verified_by,verified_at,note) VALUES(?,?,?,?,?,?)").bind(id,donor.id,reg,user.username,ts,note),
   env.DB.prepare("INSERT INTO donor_events(id,donor_id,actor,action,detail_json,happened_at) VALUES(?,?,?,?,?,?)").bind(crypto.randomUUID(),donor.id,user.username,"photo_review_matched_to_sheet_registration",JSON.stringify({submission_uuid:id,registration_id:reg,note}),ts)
  ]);
  return json({ok:true,linked:true,donor_id:donor.id,registration_id:reg,donor_name:donor.full_name,verification_unchanged:true,email_sent:false});
 }catch{return mcctV2Err("Conflicting link or audit write; no donor record was changed",409)}
}
async function mcctV2Unstocked(db){
 const q=await db.prepare("SELECT d.id,d.registration_id,d.full_name,z.receipt_mode,z.received_at FROM (SELECT donor_id,'courier' AS receipt_mode,received_at FROM mcct_parcel_receipts UNION ALL SELECT donor_id,'staff hand collection',received_at FROM mcct_staff_hand_collections WHERE status='received_at_center' UNION ALL SELECT donor_id,'volunteer hand collection',received_at FROM mcct_hand_collections WHERE status='received_at_center') z JOIN donors d ON d.id=z.donor_id WHERE NOT EXISTS(SELECT 1 FROM mcct_ops_hair_lots h WHERE h.donor_id=d.id) AND NOT EXISTS(SELECT 1 FROM mc_donor_recycle b WHERE b.donor_id=d.id) ORDER BY z.received_at DESC LIMIT 80").all();
 return json({ok:true,records:q.results||[],warning:"Receipt confirmed, quantity not yet inventoried. Never assume pieces from an AWB or hair length."});
}
async function mcctV2Split(req,env,user,id){
 if(!MCCT_V2_UUID.test(id))return mcctV2Err("Invalid hair lot");
 let v;try{v=await mcctV2Body(req)}catch{return mcctV2Err("Invalid JSON")}
 const key=mcctV2Str(v.request_key,36);
 if(!MCCT_V2_UUID.test(key))return mcctV2Err("Missing idempotency key");
 const priorKey=await env.DB.prepare("SELECT parent_lot_id,child_lot_id,moved_pieces FROM mcct_ops_hair_split_keys WHERE request_key=?").bind(key).first();
 if(priorKey)return priorKey.parent_lot_id===id?json({ok:true,duplicate_safe:true,child_lot_id:priorKey.child_lot_id,moved_pieces:priorKey.moved_pieces}):mcctV2Err("Conflicting transfer key",409);
 const prior=await env.DB.prepare("SELECT * FROM mcct_ops_hair_lots WHERE id=?").bind(id).first();
 if(!prior)return mcctV2Err("Hair stock lot not found",404);
 const version=Number(v.version),count=Number(v.pieces);
 if(!Number.isSafeInteger(version)||version!==prior.version)return mcctV2Err("Stock lot changed: reload before moving pieces",409);
 if(!Number.isSafeInteger(count)||count<1||count>=prior.piece_count)return mcctV2Err("Split pieces must be positive and less than the current lot. Use Transfer for all pieces.");
 if(["consumed","closed"].includes(prior.stage))return mcctV2Err("Closed or consumed lots cannot be split",409);
 const custodian=mcctV2Str(v.custodian_type,20),stage=mcctV2Str(v.stage,30),location=mcctV2Str(v.location,120),ref=mcctV2Str(v.custodian_ref,140),note=mcctV2Str(v.note,450);
 if(!MCCT_V2_CUSTODIANS.has(custodian)||!MCCT_V2_STAGES.has(stage)||!location||note.length<5)return mcctV2Err("Destination, stage, and movement reason required");
 const child=crypto.randomUUID(),ts=now(),remains=prior.piece_count-count;
 const original={lot_id:id,pieces:prior.piece_count,custodian:prior.custodian_type,location:prior.location,stage:prior.stage};
 const dest={lot_id:child,pieces:count,custodian,location,stage,original_lot:id,reason:note};
 try {
  const result=await env.DB.batch([
   env.DB.prepare("UPDATE mcct_ops_hair_lots SET piece_count=?,updated_by=?,updated_at=?,version=version+1 WHERE id=? AND version=? AND piece_count>?")
    .bind(remains,user.username,ts,id,version,count),
   env.DB.prepare("INSERT INTO mcct_ops_hair_lots(id,donor_id,source_type,source_label,hair_form,piece_count,length_inches,collection_mode,custodian_type,custodian_ref,location,stage,note,created_by,updated_by,created_at,updated_at) SELECT ?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,? WHERE changes()=1")
    .bind(child,prior.donor_id,prior.source_type,prior.source_label,prior.hair_form,count,prior.length_inches,prior.collection_mode,custodian,ref,location,stage,note,user.username,user.username,ts,ts),
   env.DB.prepare("INSERT INTO mcct_ops_hair_events(id,lot_id,actor,action,before_json,after_json,happened_at) SELECT ?,?,?,?,?,?,? WHERE changes()=1")
    .bind(crypto.randomUUID(),id,user.username,"split_parent",JSON.stringify(original),JSON.stringify({lot_id:id,pieces:remains,child_lot_id:child}),ts),
   env.DB.prepare("INSERT INTO mcct_ops_hair_events(id,lot_id,actor,action,before_json,after_json,happened_at) SELECT ?,?,?,?,?,?,? WHERE changes()=1")
    .bind(crypto.randomUUID(),child,user.username,"split_child",JSON.stringify(original),JSON.stringify(dest),ts),
   env.DB.prepare("INSERT INTO mcct_ops_hair_split_keys(request_key,parent_lot_id,child_lot_id,moved_pieces,actor,created_at) SELECT ?,?,?,?,?,? WHERE changes()=1")
    .bind(key,id,child,count,user.username,ts)
  ]);
  if((result[0]?.meta?.changes||0)!==1) return mcctV2Err("Concurrent change; please reload",409);
  return json({ok:true,original_lot_id:id,remaining_pieces:remains,child_lot_id:child,moved_pieces:count,version:version+1});
 }catch(e){console.error("MCCT_V2_SPLIT",String(e?.name||"Error"));return mcctV2Err("Unable to split the stock safely; no transfer confirmed",409)}
}
async function mcctV2ExportHair(db){
 const q=await db.prepare("SELECT id,donor_id,source_type,source_label,hair_form,piece_count,length_inches,collection_mode,custodian_type,custodian_ref,location,stage,updated_at FROM mcct_ops_hair_lots ORDER BY updated_at DESC LIMIT 10000").all();
 const fields=["id","donor_id","source_type","source_label","hair_form","piece_count","length_inches","collection_mode","custodian_type","custodian_ref","location","stage","updated_at"];
 const csv=fields.join(",")+"\r\n"+(q.results||[]).map(v=>fields.map(k=>mcctV2SafeCsv(v[k])).join(",")).join("\r\n")+"\r\n";
 return new Response(csv,{headers:{"Content-Type":"text/csv; charset=utf-8","Content-Disposition":"attachment; filename=\"mamta-care-hair-ledger.csv\"","Cache-Control":"private,no-store","X-Content-Type-Options":"nosniff"}});
}
async function mcctV2Comms(db){
 const day=mcctV2IST();
 const [a,b]=await Promise.all([
  db.prepare("SELECT m.id,m.channel,m.template,m.state,m.day_ist,m.created_at,d.id donor_id,d.full_name,d.registration_id,d.city,d.hair_length,d.phone,d.email FROM mcct_ops_manual_comms m JOIN donors d ON d.id=m.donor_id ORDER BY m.created_at DESC LIMIT 100").all(),
  db.prepare("SELECT COUNT(*) n FROM mcct_ops_manual_comms WHERE day_ist=? AND channel IN ('WHATSAPP','SMS') AND state<>'CANCELLED'").bind(day).first()
 ]);
 return json({ok:true,records:a.results||[],queued_today:b?.n||0,limit:50,delivery_provider_connected:false,sent_count:0,note:"Only consent-attested manual drafts; OPENED_UNVERIFIED is never a provider delivery receipt."});
}
async function mcctV2NewComm(req,env,user){
 let v;try{v=await mcctV2Body(req)}catch{return mcctV2Err("Invalid JSON")}
 const donorId=mcctV2Str(v.donor_id,36),channel=mcctV2Str(v.channel,20).toUpperCase(),template=mcctV2Str(v.template,30).toUpperCase();
 if(!MCCT_V2_UUID.test(donorId)||!["WHATSAPP","SMS","EMAIL"].includes(channel)||!["REGISTRATION_ACK","CERTIFICATE_FEEDBACK","EXPIRY_NOTICE"].includes(template)||v.explicit_consent_attested!==true)return mcctV2Err("Donor, valid channel and confirmed messaging consent are required");
 const donor=await getDonor(env.DB,donorId);
 if(!donor)return mcctV2Err("Donor not found or archived",404);
 if(!donor.registration_id)return mcctV2Err("A real official registration ID is required before drafting communication",409);
 if(channel==="EMAIL"&&!String(donor.email||"").includes("@"))return mcctV2Err("Donor has no email address",409);
 if(["WHATSAPP","SMS"].includes(channel)&&!String(donor.phone||"").replace(/\D/g,""))return mcctV2Err("Donor has no verified phone field",409);
 if(template==="CERTIFICATE_FEEDBACK" && (donor.followup_status!=="Completed"||!donor.certificate_url))return mcctV2Err("Feedback requires Completed status and issued certificate",409);
 if(template==="EXPIRY_NOTICE"&&["Completed","Cancelled","Expired"].includes(donor.followup_status))return mcctV2Err("Expiry warning must target an eligible active donor",409);
 const day=mcctV2IST(),ts=now(),id=crypto.randomUUID();
 const sql="INSERT INTO mcct_ops_manual_comms(id,donor_id,channel,template,day_ist,consent_attested_by,created_at,updated_at) SELECT ?,?,?,?,?,?,?,? WHERE (SELECT COUNT(*) FROM mcct_ops_manual_comms WHERE day_ist=? AND channel IN ('WHATSAPP','SMS') AND state<>'CANCELLED')<50";
 const args=[id,donorId,channel,template,day,user.username,ts,ts,day];
 try{
  const r=channel==="EMAIL"?await env.DB.prepare("INSERT INTO mcct_ops_manual_comms(id,donor_id,channel,template,day_ist,consent_attested_by,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)").bind(...args.slice(0,8)).run():await env.DB.prepare(sql).bind(...args).run();
  if((r.meta?.changes||0)!==1)return mcctV2Err("Daily limit of 50 messaging drafts reached. Come back tomorrow in IST.",429);
  return json({ok:true,id,day,delivery_state:"DRAFT",delivery_provider_connected:false});
 }catch{return mcctV2Err("Duplicate donor/channel/template draft for today or database conflict",409)}
}
async function mcctV2Opened(req,env,user,id){
 if(!MCCT_V2_UUID.test(id))return mcctV2Err("Invalid message draft");
 if(!allowedWrite(req))return mcctV2Err("Origin verification failed",403);
 const r=await env.DB.prepare("UPDATE mcct_ops_manual_comms SET state='OPENED_UNVERIFIED',updated_at=? WHERE id=? AND state='DRAFT'").bind(now(),id).run();
 if((r.meta?.changes||0)!==1)return mcctV2Err("Message draft already opened or unavailable",409);
 return json({ok:true,opened:true,provider_delivery_unverified:true});
}
async function mcctV2API(req,env,user,path){
 const method=req.method;
 if(method==="GET"&&path==="/metrics")return mcctV2Metrics(env.DB);
 if(method==="GET"&&path==="/reviews")return mcctV2Reviews(env.DB);
 if(method==="GET"&&path==="/unstocked")return mcctV2Unstocked(env.DB);
 if(method==="GET"&&path==="/hair/export")return mcctV2ExportHair(env.DB);
 if(method==="GET"&&path==="/communications")return mcctV2Comms(env.DB);
 if(method!=="POST")return mcctV2Err("Not found",404);
 if(!allowedWrite(req))return mcctV2Err("Origin or request verification failed",403);
 if(path==="/reviews/link")return mcctV2LinkReviewed(req,env,user);
 if(path==="/communications")return mcctV2NewComm(req,env,user);
 const split=/^\/hair\/([0-9a-f-]{36})\/split$/i.exec(path);
 if(split)return mcctV2Split(req,env,user,split[1]);
 const opened=/^\/communications\/([0-9a-f-]{36})\/opened$/i.exec(path);
 if(opened)return mcctV2Opened(req,env,user,opened[1]);
 return mcctV2Err("Not found",404);
}
launch_wig_maker_portal_worker_default.fetch=async function(req,env,ctx){
 const path=new URL(req.url).pathname;
 if(path==="/admin-ops"||path.startsWith("/api/admin/ops/v2/")){
  try{
   const user=await currentUser(req,env.DB);
   if(!user)return mcctV2Err("Sign in to Donor Desk first",401);
   if(user.role!=="admin")return mcctV2Err("Administrator only",403);
   if(path==="/admin-ops")return req.method==="GET"?mcctV2HTMLResponse():mcctV2Err("Method not allowed",405);
   return mcctV2API(req,env,user,path.slice("/api/admin/ops/v2".length));
  }catch(e){console.error("MCCT_V2_REQUEST",String(e?.name||"Error"));return mcctV2Err("Admin operations temporarily unavailable",503)}
 }
 return MCCT_V2_PREV_FETCH.call(this,req,env,ctx);
};
