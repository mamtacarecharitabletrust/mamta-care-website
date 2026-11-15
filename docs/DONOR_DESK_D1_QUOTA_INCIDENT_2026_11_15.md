# Donor Desk emergency Cloudflare D1 quota hotfix — 15 November 2026

## Verified root cause
- Mamta Care Donor Desk showed "Authentication temporarily unavailable".
- Production D1 requests for staff/sessions returned Cloudflare API error 7500: "Your account has exceeded D1's free tier daily row read limit. Upgrade to a paid plan or wait until tomorrow (midnight UTC) to continue."
- This is a free-plan capacity rejection, not a changed administrator password or evidence of donor deletion.
- Cloudflare enforces the D1 daily Free plan limit. Reset is at midnight UTC (05:30 IST), next **16 November 2026**.
- The connection's account-level analytics endpoint returned 403, so we cannot independently rank actual queries. Code inspection found a major inefficiency: the two-minute donor importer did a per-donor full-table-friendly OR expression lookup for every Google Sheet record. V10 and V11 also duplicated heavy photo matching every two minutes.

## V12 production mitigation
- Reproducible guarded patch: cloudflare/patches/d1-row-read-hotfix-v12.mjs.
- A single donor index snapshot at the start of each two-minute import replaces many repeated per-donor database lookups. In-memory sets preserve current-run deduplication; the original atomic insert duplicate guard remains unchanged.
- Disable obsolete V10 duplicate scheduled photo matcher; keep the V11 matcher every 20 minutes.
- Keep legacy V7 and wig source reconciliation hourly, V9 expiry staging once per day.
- Preserve the core two-minute Sheet importer, courier bridge, staff authentication, every prior fetch route, R2 photos, registration IDs, certificates, original 21 Worker bindings and the unchanged cron schedule: */2 * * * *.
- No D1 schema or row mutation was run. No donor, photo, password, session or original Google Form was replaced.

## Deployment record
- Full approximately 1.88MB Worker compiled with fetch and scheduled handlers in isolated Cloudflare staging.
- Production Worker version: d5bdfc19-f051-4133-9367-1353881e5f14.
- Rollback version: 67f59049-77d4-493e-a737-885a4fa10a0a.
- All 21 bindings and the two-minute cron were verified after deployment.

## Next required verification
- D1 queries cannot resume during the exhausted free daily quota merely because optimized code was deployed. At the midnight UTC reset, verify both administrator and staff login, donor list, and new donor import. Do not promise success before actual authenticated tests.
- Inspect 24h D1 rows-read trends after reset. If the cap still approaches exhaustion, secure appropriate account analytics access, optimize remaining queries and add indexes.
- Every future Worker update MUST incorporate this V12 patch rather than deploying an older staging source and reintroducing the row-read overuse.
- Separate Vercel registration spinner and confirmation UI is blocked by unrelated Vercel 100-builds-per-day quota; it does not cause this authentication error.

Avoid claiming a working login until a real post-reset check succeeds.
