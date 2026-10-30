// Mamta Care public hair donation impact. Read-only Google Sheets aggregate; no D1.
const valid = n => Number.isSafeInteger(n) && n >= 0 && n <= 1000000000;
const SOURCE_TOTAL = 2469, SOURCE_PENDING = 53;
const BASE_TOTAL = 986, BASE_PENDING = 70;
export default async function handler(req, res) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("X-Content-Type-Options", "nosniff");
  if (req.method !== "GET") return res.status(405).json({ok:false});
  const endpoint = process.env.GOOGLE_HAIR_METRICS_URL || "";
  if (!/^https:\/\/script\.google\.com\/macros\/s\/[^/]+\/exec$/.test(endpoint)) {
    res.setHeader("Cache-Control","no-store");
    return res.status(503).json({ok:false,error:"Google Sheets counter not configured"});
  }
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), 10000);
  try {
    const upstream = await fetch(endpoint,{redirect:"follow",signal:abort.signal,headers:{Accept:"application/json"}});
    if (!upstream.ok) throw new Error("Sheet endpoint failed");
    const sheet = await upstream.json();
    if (sheet.ok!==true || !valid(sheet.total) || !valid(sheet.completed) ||
        !valid(sheet.pending) || sheet.completed+sheet.pending!==sheet.total)
      throw new Error("Invalid source counts");
    let baseTotal = BASE_TOTAL, pendingOffset = BASE_PENDING-SOURCE_PENDING;
    try {
      const cAbort = new AbortController();
      const cTimer = setTimeout(() => cAbort.abort(), 2800);
      try {
        const response = await fetch("https://mamta-website-content-control.bharathairseva-in.workers.dev/api/counter-config",
          {signal:cAbort.signal,headers:{Accept:"application/json"}});
        if (response.ok) {
          const config = await response.json();
          if (config.ok === true && valid(config.baselineTotal) &&
              Number.isSafeInteger(config.pendingAdjustment) && Math.abs(config.pendingAdjustment)<=100000) {
            baseTotal = config.baselineTotal;
            pendingOffset = config.pendingAdjustment;
          }
        }
      } finally { clearTimeout(cTimer); }
    } catch { /* Historical owner baseline is the safe fallback. */ }
    const total = baseTotal + sheet.total - SOURCE_TOTAL;
    const pending = sheet.pending + pendingOffset;
    if (!valid(total)||!valid(pending)||pending>total) throw new Error("Counter reconciliation required");
    res.setHeader("Cache-Control","public, s-maxage=45, stale-while-revalidate=90");
    return res.status(200).json({ok:true,total,completed:total-pending,pending,source:"google_sheets"});
  } catch {
    res.setHeader("Cache-Control","no-store");
    return res.status(503).json({ok:false,error:"Counters unavailable"});
  } finally { clearTimeout(timer); }
}
