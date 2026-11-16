/**
 * Mamta Care V14 (16 Nov 2026): legacy photo-review reconciliation
 * once daily at 03:00 UTC (08:30 IST), rather than hourly.
 * Original donor import keeps its existing 2-minute cron schedule.
 *
 * Changes exactly one installed scheduled callback in the compiled Donor Desk
 * Worker. No login/auth, data, binding, Forms, or certificate changes.
 */
export function patchLowPriorityReviewSchedule(previousSource) {
  if (typeof previousSource !== "string" ||
      !previousSource.includes("MCCT_PHOTO_QUERY_INDEXED_V13_20261115"))
    throw Error("Unexpected Donor Desk baseline; V13 is required");
  const marker="MCCT_D1_LOW_PRIORITY_RECON_V14_20261116";
  if (previousSource.includes(marker))throw Error("V14 already present");
  const before='if(new Date(controller?.scheduledTime||Date.now()).getUTCMinutes()===0)\n'+
    '  ctx.waitUntil(mcctReconV7Run(env.DB,"scheduled").catch(e=>console.error("MCCT_RECON_V7_SCHEDULED",String(e?.name||"Error"))));';
  const after='if(new Date(controller?.scheduledTime||Date.now()).getUTCHours()===3 && new Date(controller?.scheduledTime||Date.now()).getUTCMinutes()===0)\n'+
    '  ctx.waitUntil(mcctReconV7Run(env.DB,"scheduled").catch(e=>console.error("MCCT_RECON_V7_SCHEDULED",String(e?.name||"Error"))));';
  if (previousSource.split(before).length!==2)throw Error("Unsafe V7 schedule anchor count");
  const patched=previousSource.replace(before,after)+"\n/* "+marker+" */\n";
  if (!patched.includes("MCCT_D1_ROW_READ_HOTFIX_V12_20261115") ||
      !patched.includes("MCCT_SECURE_CUSTOM_DONOR_AUTO_PHOTOS_V11_20261115"))
    throw Error("Expected Donor Desk modules missing");
  return patched;
}
