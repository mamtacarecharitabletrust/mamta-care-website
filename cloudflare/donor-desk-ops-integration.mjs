/**
 * Narrow compatibility patch for the existing bundled Donor Desk Worker.
 * Modifies exactly ONE validation point, and nothing else. The new addon
 * renders Cancelled / Expired as selected read-only values in the old editor.
 *
 * All transitions to/from Cancelled or Expired must go through the new
 * audited administrator operation endpoints. Legacy Cleared records retain
 * their old value; no new Cleared records may be written.
 */
export function patchLegacyDonorStatus(source) {
  if (typeof source !== "string") throw Error("Worker source required");
  const before='if (!["Pending", "Not answered", "Call again", "Cleared", "Completed"].includes(status)) return error("Invalid status");';
  const after=[
    'if (!["Pending", "Not answered", "Call again", "Cleared", "Completed"].includes(status) && !(["Cancelled", "Expired"].includes(status) && status===prior.followup_status)) return error("Invalid status");',
    '  if (["Cancelled", "Expired"].includes(prior.followup_status) && status!==prior.followup_status) return error("Reopen a cancelled or expired donor from Admin Operations",403);',
    '  if (status==="Cleared" && prior.followup_status!=="Cleared") return error("Cleared is a legacy status; use Admin Operations to cancel",400);'
  ].join("\n");
  const occurrences=source.split(before).length-1;
  if (occurrences!==1) throw Error("Unsafe Donor Desk Worker version: expected exactly one status validation anchor, found "+occurrences);
  return source.replace(before,after);
}
