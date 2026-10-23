/**
 * Completes the isolated TEST Donor Desk handoff after both private photos exist.
 * This is deliberately separate from the public production Donor Desk.
 * Do not add passwords, Apps Script keys, or private Worker secrets here.
 */
const TEST_PHOTO_API = "https://mamta-website-photo-upload-test-20261019.bharathairseva-in.workers.dev";

export async function finalizeFictionalDonorDeskSync(uploadToken, values) {
  if (!uploadToken || typeof uploadToken !== "string") {
    throw new Error("Missing TEST upload authorization");
  }
  const response = await fetch(TEST_PHOTO_API + "/api/test-finalize", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + uploadToken,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ values })
  });
  const data = await response.json().catch(() => null);
  if (!response.ok || data?.desk_synced !== true || data?.photo_count !== 2) {
    throw new Error(data?.error || "TEST Donor Desk synchronization is not yet available");
  }
  return data;
}
