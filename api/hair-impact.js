// Public Vercel function: aggregate-only Google Apps Script proxy.
// Keeps private Sheet data inaccessible and does not query Cloudflare D1.
const isCount = n => Number.isSafeInteger(n) && n >= 0 && n <= 1000000000;
export default async function handler(request, response) {
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("X-Content-Type-Options", "nosniff");
  if (request.method !== "GET") return response.status(405).json({ ok: false });
  const url = process.env.GOOGLE_HAIR_METRICS_URL || "";
  if (!/^https:\/\/script\.google\.com\/macros\/s\/[^/]+\/exec$/.test(url)) {
    response.setHeader("Cache-Control", "no-store");
    return response.status(503).json({ ok: false, error: "Google metrics source not configured" });
  }
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);
    let upstream;
    try {
      upstream = await fetch(url, { redirect: "follow", signal: controller.signal,
        headers: { Accept: "application/json" } });
    } finally { clearTimeout(timer); }
    if (!upstream.ok) throw new Error("Upstream unavailable");
    const data = await upstream.json();
    if (data?.ok !== true || !isCount(data.total) || !isCount(data.completed) ||
        !isCount(data.pending) || data.completed + data.pending !== data.total) {
      throw new Error("Invalid aggregate payload");
    }
    // Administrator corrections are stored in Cloudflare KV, never Donor Desk D1.
    // Google Sheets remains authoritative for new registrations and verifications.
    let total = data.total;
    let pending = data.pending;
    try {
      const configController = new AbortController();
      const timeout = setTimeout(() => configController.abort(), 4000);
      let configResponse;
      try {
        configResponse = await fetch(
          "https://mamta-website-content-control.bharathairseva-in.workers.dev/api/counter-config",
          { signal: configController.signal, headers: { Accept: "application/json" } }
        );
      } finally { clearTimeout(timeout); }
      if (configResponse.ok) {
        const cfg = await configResponse.json();
        if (cfg?.ok === true && isCount(cfg.baselineTotal) &&
            Number.isSafeInteger(cfg.pendingAdjustment) &&
            Math.abs(cfg.pendingAdjustment) <= 100000) {
          const newTotal = total + cfg.baselineTotal - 2469;
          const newPending = pending + cfg.pendingAdjustment;
          if (isCount(newTotal) && isCount(newPending) && newPending <= newTotal) {
            total = newTotal;
            pending = newPending;
          }
        }
      }
    } catch {
      // Retain the Google Sheets-only totals if settings are temporarily unavailable.
    }
    response.setHeader("Cache-Control", "public, s-maxage=120, stale-while-revalidate=240");
    return response.status(200).json({ ok: true, total,
      completed: total - pending, pending, source: "google_sheets" });
  } catch {
    response.setHeader("Cache-Control", "no-store");
    return response.status(503).json({ ok: false, error: "Metrics temporarily unavailable" });
  }
}
