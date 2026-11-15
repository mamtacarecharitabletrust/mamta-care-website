import test from "node:test";
import assert from "node:assert/strict";
import {patchMamtaD1Source} from "../cloudflare/patches/d1-row-read-hotfix-v12.mjs";
const anchors=[
  "  let imported=0,skipped=0;\n  for(const r of snap.records){\n    if(await alreadyImported(env.DB,r)){skipped++;continue;}",
  "      imported++;\n      // Notification failure never rolls back the confirmed imported donor.",
  ' ctx.waitUntil(mcctNoReviewV10Backfill(env).catch(e=>console.error("MCCT_NO_REVIEW_V10_SCHEDULED",String(e?.name||"Error"))));',
  ' ctx.waitUntil(mcctNoReviewV11Backfill(env).catch(e=>console.error("MCCT_NO_REVIEW_V11_SCHEDULED",String(e?.name||"Error"))));',
  ' ctx.waitUntil(mcctReconV7Run(env.DB,"scheduled").catch(e=>console.error("MCCT_RECON_V7_SCHEDULED",String(e?.name||"Error"))));',
  ' ctx.waitUntil(mcctWigV3AutoLinkReviewed(env).catch(e=>console.error("MCCT_WIG_AUTO_LINK",String(e?.name||"Error"))));',
  ' ctx.waitUntil((async()=>{\n   await mcctExpiryV9Stage(env);'
];
function fixture(){
  return "MCCT_SECURE_CUSTOM_DONOR_AUTO_PHOTOS_V11_20261115\n"+
    "launch_wig_maker_portal_worker_default.scheduled=async function(controller,env,ctx){}\n"+
    anchors.join("\n")+
    "\n"+ "x".repeat(1000001);
}
test("guarded patch optimizes importer and preserves scheduled handler",()=>{
 const {source,changes}=patchMamtaD1Source(fixture());
 assert.equal(changes.length,7);
 assert.match(source,/SELECT source_key,registration_id FROM donors/);
 assert.match(source,/importedRegistrationIds\.has/);
 assert.match(source,/importedRegistrationIds\.add/);
 assert.match(source,/MCCT_D1_ROW_READ_HOTFIX_V12_20261115/);
 assert.match(source,/launch_wig_maker_portal_worker_default\.scheduled/);
 assert.match(source,/getUTCMinutes\(\)%20===0/);
 assert.match(source,/getUTCMinutes\(\)===0/);
 assert.match(source,/getUTCHours\(\)===0/);
 assert.doesNotMatch(source,/if\(await alreadyImported\(env\.DB,r\)\)/);
 assert.doesNotMatch(source,/ctx\.waitUntil\(mcctNoReviewV10Backfill/);
 assert.doesNotMatch(source,/DELETE FROM donors|DROP TABLE/);
});
test("patch fails closed on second application and unfamiliar worker source",()=>{
 const once=patchMamtaD1Source(fixture()).source;
 assert.throws(()=>patchMamtaD1Source(once),/V12 already applied/);
 assert.throws(()=>patchMamtaD1Source("Wrong Worker"),/Not the approved V11/);
 assert.throws(()=>patchMamtaD1Source(fixture().replace(anchors[0],"unknown")),/expected one matching anchor/);
});
