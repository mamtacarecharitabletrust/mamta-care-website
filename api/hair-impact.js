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
    response.setHeader("Cache-Control", "public, s-maxage=120, stale-while-revalidate=240");
    return response.status(200).json({ ok: true, total: data.total,
      completed: data.completed, pending: data.pending, source: "google_sheets" });
  } catch {
    response.setHeader("Cache-Control", "no-store");
    return response.status(503).json({ ok: false, error: "Metrics temporarily unavailable" });
  }
}
