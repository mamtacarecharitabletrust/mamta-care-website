import test from "node:test";
import assert from "node:assert/strict";
import {patchLegacyDonorStatus} from "../cloudflare/donor-desk-ops-integration.mjs";
const old='const status=safe(d.followup_status,60);\n  if (!["Pending", "Not answered", "Call again", "Cleared", "Completed"].includes(status)) return error("Invalid status");';
test("legacy worker status validation is patched at precisely one guarded anchor",()=>{
  const x=patchLegacyDonorStatus(old);
  assert.match(x,/Reopen a cancelled or expired donor from Admin Operations/);
  assert.match(x,/Cleared is a legacy status/);
  assert.match(x,/status===prior.followup_status/);
  assert.doesNotMatch(x,/return error\("Invalid status"\);\s*$/);
});
test("unsafe or already modified bundle is rejected",()=>{
  assert.throws(()=>patchLegacyDonorStatus("no matching worker"),/Unsafe/);
  assert.throws(()=>patchLegacyDonorStatus(old+"\n"+old),/exactly one/);
  assert.throws(()=>patchLegacyDonorStatus(patchLegacyDonorStatus(old)),/Unsafe/);
});
