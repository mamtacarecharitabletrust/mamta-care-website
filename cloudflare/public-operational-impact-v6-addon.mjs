/* Mamta Care V6 — read-only current Donor Desk operational metrics.
 * Public response is aggregate only. No names, phones, registration IDs,
 * worker credentials, photographs or certificate records are exposed.
 * This is a separate data population from the historic Google Sheet totals.
 */
const MCCT_IMPACT_V6_PREVIOUS_FETCH=launch_wig_maker_portal_worker_default.fetch;
async function mcctImpactV6Snapshot(env){
  try{
    if(!env?.DB)return new Response(JSON.stringify({ok:false,error:"Operational metrics temporarily unavailable"}),{status:503,headers:{"Content-Type":"application/json","Cache-Control":"no-store","Access-Control-Allow-Origin":"*"}});
    const row=await env.DB.prepare(
      "SELECT COUNT(*) AS stored_total,"+
      "SUM(CASE WHEN b.donor_id IS NOT NULL THEN 1 ELSE 0 END) AS in_bin,"+
      "SUM(CASE WHEN b.donor_id IS NULL THEN 1 ELSE 0 END) AS active_donor_rows,"+
      "SUM(CASE WHEN b.donor_id IS NULL AND d.followup_status IN ('Pending','Not answered','Call again') THEN 1 ELSE 0 END) AS active_pending,"+
      "SUM(CASE WHEN b.donor_id IS NULL AND d.followup_status='Completed' THEN 1 ELSE 0 END) AS completed_in_desk,"+
      "SUM(CASE WHEN b.donor_id IS NULL AND d.followup_status='Cancelled' THEN 1 ELSE 0 END) AS cancelled,"+
      "SUM(CASE WHEN b.donor_id IS NULL AND d.followup_status='Expired' THEN 1 ELSE 0 END) AS expired,"+
      "SUM(CASE WHEN b.donor_id IS NULL AND d.followup_status='Cleared' THEN 1 ELSE 0 END) AS legacy_cleared "+
      "FROM donors d LEFT JOIN mc_donor_recycle b ON b.donor_id=d.id"
    ).first();
    const val=k=>Number(row?.[k]??0);
    const stored=val("stored_total"),bin=val("in_bin"),active=val("active_donor_rows"),pending=val("active_pending");
    if(![stored,bin,active,pending].every(n=>Number.isSafeInteger(n)&&n>=0)||
       active+bin!==stored||pending>active)throw Error("Operational count invariant failed");
    const payload={
      ok:true,scope:"donor_desk_operational_queue",active_pending:pending,
      in_bin:bin,active_donor_rows:active,stored_total:stored,
      completed_in_desk:val("completed_in_desk"),cancelled:val("cancelled"),
      expired:val("expired"),legacy_cleared:val("legacy_cleared"),
      excludes:["in_bin","cancelled","expired","completed","cleared"],
      as_of:new Date().toISOString(),
      note:"This is the current Donor Desk operational queue, not the historical all-time Google Sheets registration total."
    };
    return new Response(JSON.stringify(payload),{status:200,headers:{
      "Content-Type":"application/json; charset=utf-8","Access-Control-Allow-Origin":"*",
      "Cross-Origin-Resource-Policy":"cross-origin",
      "Cache-Control":"public, s-maxage=45, stale-while-revalidate=60",
      "X-Content-Type-Options":"nosniff","Referrer-Policy":"no-referrer"
    }});
  }catch(e){
    console.error("MCCT_PUBLIC_IMPACT_V6",String(e?.name||"Error"));
    return new Response(JSON.stringify({ok:false,error:"Operational metrics unavailable"}),{status:503,headers:{"Content-Type":"application/json","Cache-Control":"no-store","Access-Control-Allow-Origin":"*"}});
  }
}
launch_wig_maker_portal_worker_default.fetch=async function(req,env,ctx){
  if(new URL(req.url).pathname==="/api/public/operational-impact"){
    if(req.method!=="GET")return new Response(JSON.stringify({ok:false,error:"Method not allowed"}),{status:405,headers:{"Content-Type":"application/json","Allow":"GET","Access-Control-Allow-Origin":"*"}});
    return mcctImpactV6Snapshot(env);
  }
  return MCCT_IMPACT_V6_PREVIOUS_FETCH.call(this,req,env,ctx);
};
