/* Mamta Care V10 — Registration-first hair donation. No photo approval.
 *
 * Photos do not gate the registration process. The original Google Form and
 * its official ID/email automation are the sole authority for new donors.
 * This addon never issues an ID, creates a donor, or sends an email.
 *
 * Existing photo-only records are retained for automatic matching with
 * their original Google Form Column S WEBSITE:<UUID> marker. Past manual
 * rejections are preserved in audit history, never deleted or overwritten.
 */
const MCCT_NO_REVIEW_V10_PREVIOUS_FETCH=launch_wig_maker_portal_worker_default.fetch;
const MCCT_NO_REVIEW_V10_PREVIOUS_SCHEDULED=launch_wig_maker_portal_worker_default.scheduled;
const MCCT_NO_REVIEW_V10_STATES=["REVIEW_REQUIRED","FORM_SYNC_PENDING","RESERVED","CLAIMED","PHOTOS_STORED"];
function mcctNoReviewV10Json(v,status=200){
 return new Response(JSON.stringify(v),{status,headers:{"Content-Type":"application/json; charset=utf-8","Cache-Control":"private,no-store","X-Content-Type-Options":"nosniff"}});
}
async function mcctNoReviewV10Backfill(env){
 const db=env.DB;
 if(!db||!env.DONOR_PHOTOS)return {linked:0,awaiting_original_form:0,failed:0};
 const now=Date.now();
 // An old "review" state never represents rejection of a donor.
 // Registration remains valid only when the real Google Form ID exists.
 await db.prepare("UPDATE website_form_intakes SET state='FORM_SYNC_PENDING',updated_at=? WHERE state='REVIEW_REQUIRED'").bind(now).run();
 const candidates=await db.prepare(
  "SELECT i.submission_uuid,i.front_key,i.back_key,i.registration_id,d.id AS donor_id,d.registration_id AS official_id "+
  "FROM website_form_intakes i JOIN donors d "+
  "ON d.source='google_sheet' AND TRIM(COALESCE(d.sheet_extra,''))='WEBSITE:'||i.submission_uuid "+
  "AND d.registration_id IS NOT NULL AND TRIM(d.registration_id)<>'' "+
  "WHERE i.state IN ('REVIEW_REQUIRED','FORM_SYNC_PENDING','RESERVED','CLAIMED','PHOTOS_STORED') "+
  "AND (i.registration_id IS NULL OR TRIM(i.registration_id)='' OR i.registration_id=d.registration_id) "+
  "AND (SELECT COUNT(*) FROM donors d2 WHERE d2.source='google_sheet' "+
  "AND TRIM(COALESCE(d2.sheet_extra,''))='WEBSITE:'||i.submission_uuid)=1 "+
  "AND (SELECT COUNT(*) FROM donors d3 WHERE LOWER(TRIM(d3.registration_id))=LOWER(TRIM(d.registration_id)))=1 "+
  "AND NOT EXISTS(SELECT 1 FROM website_form_intakes j WHERE j.submission_uuid<>i.submission_uuid AND j.registration_id=d.registration_id) "+
  "ORDER BY i.created_at ASC LIMIT 20"
 ).all();
 let linked=0,failed=0,skipped=0;
 for(const i of candidates.results||[]){
  try{
   const known=await db.prepare("SELECT side,object_key FROM website_hair_photos WHERE donor_id=?").bind(i.official_id).all();
   const photos=known.results||[];
   if(photos.length && !(photos.length===2 && photos.some(p=>p.side==="front"&&p.object_key===i.front_key)&&photos.some(p=>p.side==="back"&&p.object_key===i.back_key))){
    skipped++;continue; // conflicting existing original photos; never overwrite.
   }
   let result;
   if(photos.length===2){
    result=await db.prepare("UPDATE website_form_intakes SET state='COMPLETE',registration_id=?,updated_at=? "+
      "WHERE submission_uuid=? AND state IN ('REVIEW_REQUIRED','FORM_SYNC_PENDING','RESERVED','CLAIMED','PHOTOS_STORED') "+
      "AND (registration_id IS NULL OR registration_id=?) "+
      "AND EXISTS(SELECT 1 FROM donors d WHERE d.id=? AND d.registration_id=? AND TRIM(d.sheet_extra)='WEBSITE:'||website_form_intakes.submission_uuid)")
       .bind(i.official_id,now,i.submission_uuid,i.official_id,i.donor_id,i.official_id).run();
    if((result.meta?.changes||0)===1)linked++;
    else skipped++;
    continue;
   }
   const [front,back]=await Promise.all([
    env.DONOR_PHOTOS.head(i.front_key),env.DONOR_PHOTOS.head(i.back_key)
   ]);
   const types=["image/jpeg","image/png","image/webp"];
   const fMime=front?.httpMetadata?.contentType,bMime=back?.httpMetadata?.contentType;
   if(!front||!back||!types.includes(fMime)||!types.includes(bMime)||
      !Number.isSafeInteger(front.size)||front.size<1||front.size>4194304||
      !Number.isSafeInteger(back.size)||back.size<1||back.size>4194304){
    skipped++;continue;
   }
   const write=await db.batch([
    db.prepare("INSERT INTO website_hair_photos(donor_id,side,object_key,mime,size_bytes,created_at) "+
      "SELECT ?,?,?,?,?,? WHERE NOT EXISTS(SELECT 1 FROM website_hair_photos p WHERE p.donor_id=?)")
     .bind(i.official_id,"front",i.front_key,fMime,front.size,now,i.official_id),
    db.prepare("INSERT INTO website_hair_photos(donor_id,side,object_key,mime,size_bytes,created_at) "+
      "SELECT ?,?,?,?,?,? WHERE changes()=1")
     .bind(i.official_id,"back",i.back_key,bMime,back.size,now),
    db.prepare("UPDATE website_form_intakes SET state='COMPLETE',registration_id=?,updated_at=? "+
      "WHERE submission_uuid=? AND state IN ('REVIEW_REQUIRED','FORM_SYNC_PENDING','RESERVED','CLAIMED','PHOTOS_STORED') "+
      "AND (registration_id IS NULL OR registration_id=?) "+
      "AND EXISTS(SELECT 1 FROM website_hair_photos p WHERE p.donor_id=? AND p.side='front' AND p.object_key=?) "+
      "AND EXISTS(SELECT 1 FROM website_hair_photos p WHERE p.donor_id=? AND p.side='back' AND p.object_key=?) "+
      "AND (SELECT COUNT(*) FROM donors d WHERE d.source='google_sheet' AND TRIM(d.sheet_extra)='WEBSITE:'||website_form_intakes.submission_uuid)=1")
     .bind(i.official_id,now,i.submission_uuid,i.official_id,i.official_id,i.front_key,i.official_id,i.back_key),
    db.prepare("INSERT INTO donor_events(id,donor_id,actor,action,detail_json,happened_at) "+
      "SELECT ?,?,?,'website_photos_automatically_linked',?,? WHERE changes()=1")
     .bind(crypto.randomUUID(),i.donor_id,"registration_auto_sync",JSON.stringify({official_registration_preserved:true,photo_approval_required:false,certificate_email_not_generated:true}),Math.floor(now/1000))
   ]);
   if((write[0]?.meta?.changes||0)===1&&(write[1]?.meta?.changes||0)===1&&(write[2]?.meta?.changes||0)===1)linked++;
   else skipped++;
  }catch(e){
   failed++;console.error("MCCT_NO_REVIEW_V10_LINK",String(e?.name||"Error"));
  }
 }
 return {linked,failed,skipped,processed:(candidates.results||[]).length,created_ids:0,sent_emails:0};
}
async function mcctNoReviewV10Status(db){
 const [states,photoPairs,official,unlinked]=await Promise.all([
  db.prepare("SELECT state,COUNT(*) n FROM website_form_intakes GROUP BY state ORDER BY state").all(),
  db.prepare("SELECT COUNT(DISTINCT donor_id) n FROM website_hair_photos").first(),
  db.prepare("SELECT COUNT(*) n FROM website_form_intakes WHERE state='COMPLETE' AND registration_id IS NOT NULL").first(),
  db.prepare("SELECT COUNT(*) n FROM website_form_intakes WHERE state IN ('FORM_SYNC_PENDING','RESERVED','CLAIMED','PHOTOS_STORED','REVIEW_REQUIRED')").first()
 ]);
 return mcctNoReviewV10Json({
   ok:true,registration_policy:"Every valid donor registration is processed by the original Google Form without photograph approval.",
   original_google_form:"https://forms.gle/VpKSKJoichRqyTvH9",
   official_registered:official?.n||0,photo_pairs:photoPairs?.n||0,
   original_form_sync_pending:unlinked?.n||0,states:states.results||[],
   manual_photo_decisions_enabled:false,
   pending_description:"Old uploaded photos waiting for an authoritative Google Form marker, NOT awaiting staff approval. Normal new donors use the official Form immediately.",
   no_automatic_fake_id:true,no_automatic_duplicate_email:true
 });
}
function mcctNoReviewV10Page(){
 return mcctWigV3SecureHTML(MCCT_NO_REVIEW_V10_HTML,false);
}
function mcctNoReviewV10Redirect(path){
 return new Response(null,{status:302,headers:{"Location":path,"Cache-Control":"private,no-store","Referrer-Policy":"no-referrer"}});
}
function mcctNoReviewV10AdjustAdminPage(html){
 // Keep the donor photograph gallery; retire only the approval/rejection controls.
 return html
  .replace(/<a class="tile" href="\/app\/photo-decisions">[\s\S]*?<\/a>/g,"")
  .replace(/<a class="tile" href="\/admin-photo-reconciliation">[\s\S]*?<\/a>/g,"")
  .replace(/<a class="tile" href="\/admin-registration-sync">[\s\S]*?<\/a>/g,"")
  .replace('<a class="tile" href="/app/receipts">',
    '<a class="tile" href="/admin-registration-sync"><b>Automatic Donor Registration Sync</b><small>Official Google Form IDs, private photo attachments and outstanding source records. No manual approvals.</small></a><a class="tile" href="/app/receipts">')
  .replaceAll("Photo Review Decisions","Donor Photos")
  .replaceAll("Photo Review","Donor Photos")
  .replaceAll("photo review approval","photo association");
}
launch_wig_maker_portal_worker_default.fetch=async function(req,env,ctx){
 const url=new URL(req.url),p=url.pathname;
 if(p==="/app/photo-decisions"&&req.method==="GET")return mcctNoReviewV10Redirect("/admin-registration-sync");
 if(p==="/admin-photo-reconciliation"&&req.method==="GET")return mcctNoReviewV10Redirect("/admin-registration-sync");
 if(p==="/app"&&url.searchParams.get("view")==="review"&&req.method==="GET")return mcctNoReviewV10Redirect("/app?view=queue");
 if(p==="/app/api/review-decisions"){
  const actor=await currentUser(req,env.DB);
  if(!actor)return mcctNoReviewV10Json({ok:false,error:"Sign in required"},401);
  if(actor.role!=="admin")return mcctNoReviewV10Json({ok:false,error:"Administrator only"},403);
  if(req.method==="GET")return mcctNoReviewV10Json({ok:true,cases:[],message:"No photo approvals required. Open the automatic registration sync page."});
  return mcctNoReviewV10Json({ok:false,error:"Manual photo decisions have been retired. All valid official Form registrations are admitted automatically."},410);
 }
 if(p==="/admin-registration-sync"||p.startsWith("/api/admin/ops/v10/")){
  try{
   const user=await currentUser(req,env.DB);
   if(!user)return mcctNoReviewV10Json({ok:false,error:"Log in to Donor Desk"},401);
   if(user.role!=="admin")return mcctNoReviewV10Json({ok:false,error:"Administrator only"},403);
   if(p==="/admin-registration-sync")return req.method==="GET"?mcctNoReviewV10Page():mcctNoReviewV10Json({ok:false,error:"Method not allowed"},405);
   if(p==="/api/admin/ops/v10/status"&&req.method==="GET")return mcctNoReviewV10Status(env.DB);
   if(p==="/api/admin/ops/v10/sync"&&req.method==="POST"){
    if(!allowedWrite(req))return mcctNoReviewV10Json({ok:false,error:"Origin check failed"},403);
    return mcctNoReviewV10Json({ok:true,...await mcctNoReviewV10Backfill(env)});
   }
   return mcctNoReviewV10Json({ok:false,error:"Not found"},404);
  }catch(e){console.error("MCCT_NO_REVIEW_V10_API",String(e?.name||"Error"));return mcctNoReviewV10Json({ok:false,error:"Registration sync temporarily unavailable"},503)}
 }
 if(req.method==="GET"&&(p==="/admin-ops"||p==="/app"||p==="/app/workspace/overview")){
  const res=await MCCT_NO_REVIEW_V10_PREVIOUS_FETCH.call(this,req,env,ctx);
  if(!res.ok||!String(res.headers.get("Content-Type")||"").includes("text/html"))return res;
  let html=await res.text();
  if(p==="/admin-ops")html=mcctNoReviewV10AdjustAdminPage(html);
  else {
   html=html.replaceAll("Photo Review","Donor Photos")
     .replaceAll("Photo Decisions","Registration Sync")
     .replaceAll("/app/photo-decisions","/admin-registration-sync")
     .replaceAll("href=\"/app?view=review\"","href=\"/app/workspace/photos\"");
  }
  const headers=new Headers(res.headers);headers.delete("content-length");headers.set("cache-control","private,no-store");
  return new Response(html,{status:res.status,headers});
 }
 return MCCT_NO_REVIEW_V10_PREVIOUS_FETCH.call(this,req,env,ctx);
};
launch_wig_maker_portal_worker_default.scheduled=async function(controller,env,ctx){
 if(MCCT_NO_REVIEW_V10_PREVIOUS_SCHEDULED)
  await MCCT_NO_REVIEW_V10_PREVIOUS_SCHEDULED.call(this,controller,env,ctx);
 ctx.waitUntil(mcctNoReviewV10Backfill(env).catch(e=>console.error("MCCT_NO_REVIEW_V10_SCHEDULED",String(e?.name||"Error"))));
};
