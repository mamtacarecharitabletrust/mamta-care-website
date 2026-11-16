import test from "node:test";
import assert from "node:assert/strict";
import {patchLowPriorityReviewSchedule} from "../cloudflare/patches/d1-legacy-reconciliation-daily-v14.mjs";
const anchor='if(new Date(controller?.scheduledTime||Date.now()).getUTCMinutes()===0)\n'+
 '  ctx.waitUntil(mcctReconV7Run(env.DB,"scheduled").catch(e=>console.error("MCCT_RECON_V7_SCHEDULED",String(e?.name||"Error"))));';
function baseline(){return 'MCCT_PHOTO_QUERY_INDEXED_V13_20261115\n'+
 'MCCT_D1_ROW_READ_HOTFIX_V12_20261115\n'+
 'MCCT_SECURE_CUSTOM_DONOR_AUTO_PHOTOS_V11_20261115\n'+
 'launch_wig_maker_portal_worker_default.scheduled=async function(controller,env,ctx){\n'+anchor+'\n};\n';}
test("only V7 legacy-reconciliation timing changes, all other bytes preserved",()=>{
 const old=baseline();
 const next=patchLowPriorityReviewSchedule(old);
 assert.ok(next.includes('getUTCHours()===3 && new Date(controller?.scheduledTime||Date.now()).getUTCMinutes()===0'));
 assert.match(next,/mcctReconV7Run\(env\.DB,"scheduled"\)/);
 assert.match(next,/MCCT_PHOTO_QUERY_INDEXED_V13_20261115/);
 assert.match(next,/MCCT_D1_ROW_READ_HOTFIX_V12_20261115/);
 assert.match(next,/MCCT_SECURE_CUSTOM_DONOR_AUTO_PHOTOS_V11_20261115/);
 const prefix='if(new Date(controller?.scheduledTime||Date.now()).getUTCHours()===3 && new Date(controller?.scheduledTime||Date.now()).getUTCMinutes()===0)';
 const reverted=next.replace(prefix,'if(new Date(controller?.scheduledTime||Date.now()).getUTCMinutes()===0)').replace('\n/* MCCT_D1_LOW_PRIORITY_RECON_V14_20261116 */\n','');
 assert.equal(reverted,old);
});
test("never patch twice or apply to an unfamiliar Worker",()=>{
 assert.throws(()=>patchLowPriorityReviewSchedule(patchLowPriorityReviewSchedule(baseline())),/already present/);
 assert.throws(()=>patchLowPriorityReviewSchedule('Old Worker'),/V13 is required/);
 assert.throws(()=>patchLowPriorityReviewSchedule(baseline().replace(anchor,'')),/Unsafe V7 schedule/);
});
