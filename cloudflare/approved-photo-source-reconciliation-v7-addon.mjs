/* Mamta Care V7 — Reconcile approved photo review to original Google Form ID.
 *
 * A Google Sheet import is authoritative only when it has an exact
 * Column S WEBSITE:<submission_uuid> marker in donors.sheet_extra, one
 * official ID and exactly one imported donor record. No ID is generated
 * here. No email, certificate, photo or historic donor is rewritten.
 */
const MCCT_RECON_V7_PREV_FETCH=launch_wig_maker_portal_worker_default.fetch;
const MCCT_RECON_V7_PREV_SCHEDULED=launch_wig_maker_portal_worker_default.scheduled;
function mcctReconV7JSON(value,status=200){
 return new Response(JSON.stringify(value),{status,headers:{"Content-Type":"application/json; charset=utf-8","Cache-Control":"private,no-store","X-Content-Type-Options":"nosniff","Referrer-Policy":"no-referrer"}});
}
function mcctReconV7Error(msg,status=400){return mcctReconV7JSON({ok:false,error:msg},status)}
const MCCT_RECON_V7_PROVEN_MATCH=(
 "SELECT i.submission_uuid,d.id AS donor_id,d.registration_id,a.reviewed_by "+
 "FROM website_form_intakes i "+
 "JOIN mc_v3_photo_review_actions a ON a.submission_uuid=i.submission_uuid "+
 " AND a.decision='ACCEPTED_FOR_FOLLOWUP' "+
 "JOIN donors d ON d.source='google_sheet' "+
 " AND TRIM(COALESCE(d.sheet_extra,''))='WEBSITE:'||i.submission_uuid "+
 " AND d.registration_id IS NOT NULL AND TRIM(d.registration_id)<>'' "+
 "WHERE i.state='REVIEW_REQUIRED' "+
 " AND (i.registration_id IS NULL OR TRIM(i.registration_id)='') "+
 " AND NOT EXISTS(SELECT 1 FROM mcct_ops_review_links l WHERE l.submission_uuid=i.submission_uuid OR l.donor_id=d.id) "+
 " AND (SELECT COUNT(*) FROM donors x WHERE x.source='google_sheet' AND TRIM(COALESCE(x.sheet_extra,''))='WEBSITE:'||i.submission_uuid)=1 "+
 " AND (SELECT COUNT(*) FROM donors y WHERE LOWER(TRIM(y.registration_id))=LOWER(TRIM(d.registration_id)))=1 "+
 " AND NOT EXISTS(SELECT 1 FROM website_form_intakes j WHERE j.registration_id=d.registration_id) "+
 " ORDER BY i.created_at ASC LIMIT 20"
);
async function mcctReconV7Run(db,mode="scheduled"){
 if(!db)throw Error("D1 is not configured");
 const query=await db.prepare(MCCT_RECON_V7_PROVEN_MATCH).all();
 let linked=0,skipped=0,failed=0;
 for(const item of query.results||[]){
  const date=Math.floor(Date.now()/1000),eventId=crypto.randomUUID();
  const reason="Verified original Google Form WEBSITE submission marker, unique imported official ID and accepted photo review; no ID, email or certificate generated.";
  try{
   const batch=await db.batch([
    db.prepare("UPDATE website_form_intakes SET registration_id=?,updated_at=? "+
      "WHERE submission_uuid=? AND state='REVIEW_REQUIRED' AND (registration_id IS NULL OR TRIM(registration_id)='') "+
      "AND EXISTS(SELECT 1 FROM mc_v3_photo_review_actions a WHERE a.submission_uuid=website_form_intakes.submission_uuid AND a.decision='ACCEPTED_FOR_FOLLOWUP') "+
      "AND EXISTS(SELECT 1 FROM donors d WHERE d.id=? AND d.source='google_sheet' AND d.registration_id=? AND TRIM(COALESCE(d.sheet_extra,''))='WEBSITE:'||website_form_intakes.submission_uuid) "+
      "AND (SELECT COUNT(*) FROM donors dd WHERE dd.source='google_sheet' AND TRIM(COALESCE(dd.sheet_extra,''))='WEBSITE:'||website_form_intakes.submission_uuid)=1 "+
      "AND NOT EXISTS(SELECT 1 FROM website_form_intakes j WHERE j.registration_id=?)")
      .bind(item.registration_id,date,item.submission_uuid,item.donor_id,item.registration_id,item.registration_id),
    db.prepare("INSERT INTO mcct_ops_review_links(submission_uuid,donor_id,registration_id,verified_by,verified_at,note) "+
      "SELECT i.submission_uuid,d.id,d.registration_id,a.reviewed_by,?,? "+
      "FROM website_form_intakes i JOIN mc_v3_photo_review_actions a ON a.submission_uuid=i.submission_uuid "+
      "JOIN donors d ON d.id=? AND LOWER(TRIM(d.registration_id))=LOWER(TRIM(i.registration_id)) "+
      "WHERE i.submission_uuid=? AND a.decision='ACCEPTED_FOR_FOLLOWUP' AND changes()=1 "+
      "AND NOT EXISTS(SELECT 1 FROM mcct_ops_review_links l WHERE l.submission_uuid=i.submission_uuid OR l.donor_id=d.id)")
      .bind(date,reason,item.donor_id,item.submission_uuid),
    db.prepare("INSERT INTO donor_events(id,donor_id,actor,action,detail_json,happened_at) "+
      "SELECT ?,l.donor_id,l.verified_by,'photo_source_marker_verified',?,? FROM mcct_ops_review_links l "+
      "WHERE l.submission_uuid=? AND changes()=1")
      .bind(eventId,JSON.stringify({source:"original_form_column_s",reconciled_by:mode,registration_id_preserved:true,photo_review_preserved:true}),date,item.submission_uuid)
   ]);
   if((batch[0]?.meta?.changes||0)===1&&(batch[1]?.meta?.changes||0)===1&&(batch[2]?.meta?.changes||0)===1)linked++;
   else skipped++;
  }catch(e){failed++;console.error("MCCT_RECON_V7_ROW",String(e?.name||"Error"))}
 }
 return {matched_candidates:(query.results||[]).length,linked,skipped,failed,created_ids:0,sent_emails:0};
}
async function mcctReconV7Summary(db){
 const [a,b,c,d]=await Promise.all([
  db.prepare("SELECT COUNT(*) n FROM website_form_intakes i JOIN mc_v3_photo_review_actions a ON a.submission_uuid=i.submission_uuid WHERE a.decision='ACCEPTED_FOR_FOLLOWUP' AND NOT EXISTS(SELECT 1 FROM mcct_ops_review_links l WHERE l.submission_uuid=i.submission_uuid)").first(),
  db.prepare("SELECT COUNT(*) n FROM mcct_ops_review_links").first(),
  db.prepare("SELECT COUNT(*) n FROM website_form_intakes i JOIN mc_v3_photo_review_actions a ON a.submission_uuid=i.submission_uuid WHERE a.decision='ACCEPTED_FOR_FOLLOWUP' AND NOT EXISTS(SELECT 1 FROM mcct_ops_review_links l WHERE l.submission_uuid=i.submission_uuid) AND EXISTS(SELECT 1 FROM donors d WHERE d.source='google_sheet' AND TRIM(COALESCE(d.sheet_extra,''))='WEBSITE:'||i.submission_uuid)").first(),
  db.prepare("SELECT COUNT(*) n FROM website_form_intakes i JOIN mc_v3_photo_review_actions a ON a.submission_uuid=i.submission_uuid WHERE a.decision='ACCEPTED_FOR_FOLLOWUP' AND NOT EXISTS(SELECT 1 FROM mcct_ops_review_links l WHERE l.submission_uuid=i.submission_uuid) AND NOT EXISTS(SELECT 1 FROM donors d WHERE d.source='google_sheet' AND TRIM(COALESCE(d.sheet_extra,''))='WEBSITE:'||i.submission_uuid)").first()
 ]);
 return mcctReconV7JSON({ok:true,accepted_without_link:a?.n||0,linked_with_official_record:b?.n||0,
   official_imported_marker_available:c?.n||0,missing_official_form_marker:d?.n||0,
   automatic_registration_id_creation:false,
   instruction:"Missing exact website markers cannot safely be matched by donor name or phone. Recover the original Google Form/ledger entry first; no duplicate ID will be created."
 });
}
async function mcctReconV7Route(req,env,user,path){
 if(req.method==="GET"&&path==="/summary")return mcctReconV7Summary(env.DB);
 if(req.method==="POST"&&path==="/reconcile"){
  if(!allowedWrite(req))return mcctReconV7Error("Origin verification failed",403);
  return mcctReconV7JSON({ok:true,...await mcctReconV7Run(env.DB,"manual_admin")});
 }
 return mcctReconV7Error("Not found",404);
}
launch_wig_maker_portal_worker_default.fetch=async function(req,env,ctx){
 const url=new URL(req.url),path=url.pathname;
 if(path==="/admin-photo-reconciliation"||path.startsWith("/api/admin/ops/v7/")){
  try{
   const user=await currentUser(req,env.DB);
   if(!user)return mcctReconV7Error("Log in to Donor Desk",401);
   if(user.role!=="admin")return mcctReconV7Error("Administrator only",403);
   if(path==="/admin-photo-reconciliation"){
    return req.method==="GET"?mcctWigV3SecureHTML(MCCT_RECON_V7_HTML,false):mcctReconV7Error("Method not allowed",405);
   }
   return mcctReconV7Route(req,env,user,path.slice("/api/admin/ops/v7".length));
  }catch(e){console.error("MCCT_RECON_V7_ROUTE",String(e?.name||"Error"));return mcctReconV7Error("Reconciliation temporarily unavailable",503)}
 }
 if(path==="/admin-ops"&&req.method==="GET"){
  const original=await MCCT_RECON_V7_PREV_FETCH.call(this,req,env,ctx);
  if(!original.ok||!String(original.headers.get("Content-Type")||"").includes("text/html"))return original;
  const html=await original.text(),anchor='<a class="tile" href="/app/photo-decisions">';
  const extra='<a class="tile" href="/admin-photo-reconciliation"><b>Photo Registration Reconciliation</b><small>Recover accepted submissions using exact original Form IDs, with zero duplicates</small></a>';
  return new Response(html.includes(anchor)?html.replace(anchor,extra+anchor):html,{status:original.status,headers:original.headers});
 }
 return MCCT_RECON_V7_PREV_FETCH.call(this,req,env,ctx);
};
launch_wig_maker_portal_worker_default.scheduled=async function(controller,env,ctx){
 if(MCCT_RECON_V7_PREV_SCHEDULED)await MCCT_RECON_V7_PREV_SCHEDULED.call(this,controller,env,ctx);
 ctx.waitUntil(mcctReconV7Run(env.DB,"scheduled").catch(e=>console.error("MCCT_RECON_V7_SCHEDULED",String(e?.name||"Error"))));
};
