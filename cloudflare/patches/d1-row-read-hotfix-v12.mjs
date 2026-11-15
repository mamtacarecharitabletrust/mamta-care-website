/**
 * Emergency D1 rows-read mitigation, applied to the live Donor Desk Worker 2026-11-15.
 * This reproducible patch applies against the compiled V11 Worker source obtained
 * from Cloudflare. It never changes database schema, rows, permissions or bindings.
 * The production Worker source is not tracked as one complete GitHub file.
 */
export function patchMamtaD1Source(input) {
  let source=String(input||"");
  if(source.length<1000000||!source.includes("MCCT_SECURE_CUSTOM_DONOR_AUTO_PHOTOS_V11_20261115"))
    throw Error("Not the approved V11 production Worker baseline");
  if(source.includes("MCCT_D1_ROW_READ_HOTFIX_V12_20261115"))
    throw Error("V12 already applied");
  const changes=[];
  function once(before,after,label){
    const count=source.split(before).length-1;
    if(count!==1)throw Error("Unsafe patch "+label+": expected one matching anchor, got "+count);
    source=source.replace(before,after);
    changes.push(label);
  }
  once(
    "  let imported=0,skipped=0;\n  for(const r of snap.records){\n    if(await alreadyImported(env.DB,r)){skipped++;continue;}",
    "  // One donor snapshot per two-minute import; original atomic INSERT guard is unchanged.\n"+
    "  let already;\n"+
    "  try { already=await env.DB.prepare('SELECT source_key,registration_id FROM donors').all(); }\n"+
    "  catch(e) { console.error('Auto import donor index unavailable',String(e?.name||'Error')); return; }\n"+
    "  const importedSources=new Set(), importedRegistrationIds=new Set();\n"+
    "  for(const d of (already.results||[])){\n"+
    "    if(d.source_key)importedSources.add(String(d.source_key));\n"+
    "    if(d.registration_id)importedRegistrationIds.add(String(d.registration_id).trim().toLowerCase());\n"+
    "  }\n"+
    "  let imported=0,skipped=0;\n"+
    "  for(const r of snap.records){\n"+
    "    if(importedSources.has(r.sourceKey)||importedRegistrationIds.has(String(r.values.registration_id||'').trim().toLowerCase())){skipped++;continue;}",
    "replace repeated per-donor lookups with one read"
  );
  once(
    "      imported++;\n      // Notification failure never rolls back the confirmed imported donor.",
    "      imported++;\n"+
    "      importedSources.add(r.sourceKey);\n"+
    "      importedRegistrationIds.add(String(r.values.registration_id).trim().toLowerCase());\n"+
    "      // Notification failure never rolls back the confirmed imported donor.",
    "in-run official ID collision guard"
  );
  once(
    ' ctx.waitUntil(mcctNoReviewV10Backfill(env).catch(e=>console.error("MCCT_NO_REVIEW_V10_SCHEDULED",String(e?.name||"Error"))));',
    ' // Deprecated V10 duplicate matcher disabled. V11 maintains the same automatic photo association.',
    "retire duplicate V10 photo scan"
  );
  once(
    ' ctx.waitUntil(mcctNoReviewV11Backfill(env).catch(e=>console.error("MCCT_NO_REVIEW_V11_SCHEDULED",String(e?.name||"Error"))));',
    ' if(new Date(controller?.scheduledTime||Date.now()).getUTCMinutes()%20===0)\n'+
    '  ctx.waitUntil(mcctNoReviewV11Backfill(env).catch(e=>console.error("MCCT_NO_REVIEW_V11_SCHEDULED",String(e?.name||"Error"))));',
    "photo association every 20 minutes"
  );
  once(
    ' ctx.waitUntil(mcctReconV7Run(env.DB,"scheduled").catch(e=>console.error("MCCT_RECON_V7_SCHEDULED",String(e?.name||"Error"))));',
    ' if(new Date(controller?.scheduledTime||Date.now()).getUTCMinutes()===0)\n'+
    '  ctx.waitUntil(mcctReconV7Run(env.DB,"scheduled").catch(e=>console.error("MCCT_RECON_V7_SCHEDULED",String(e?.name||"Error"))));',
    "review reconciliation hourly"
  );
  once(
    ' ctx.waitUntil(mcctWigV3AutoLinkReviewed(env).catch(e=>console.error("MCCT_WIG_AUTO_LINK",String(e?.name||"Error"))));',
    ' if(new Date(controller?.scheduledTime||Date.now()).getUTCMinutes()===0)\n'+
    '  ctx.waitUntil(mcctWigV3AutoLinkReviewed(env).catch(e=>console.error("MCCT_WIG_AUTO_LINK",String(e?.name||"Error"))));',
    "legacy wig source reconciliation hourly"
  );
  once(
    ' ctx.waitUntil((async()=>{\n   await mcctExpiryV9Stage(env);',
    ' if(new Date(controller?.scheduledTime||Date.now()).getUTCHours()===0 && new Date(controller?.scheduledTime||Date.now()).getUTCMinutes()===0)\n'+
    ' ctx.waitUntil((async()=>{\n   await mcctExpiryV9Stage(env);',
    "expiry scan once daily"
  );
  source+="\n/* MCCT_D1_ROW_READ_HOTFIX_V12_20261115 */\n";
  return {source,changes};
}
