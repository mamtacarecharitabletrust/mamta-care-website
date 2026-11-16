# Mamta Care Donor Desk — daily safety and unfinished-work register
**Checked:** 16 November 2026, Asia/Kolkata.  
**Production Worker:** `mamta-donor-desk-launch-new` — baseline version `2035f2b4-171c-418a-8694-c562a9c1a789`.  
**Source of truth:** Existing Cloudflare D1 (database `f57caa31-0e3c-46ab-90f5-da1aa676dbff`), private R2 photos, original Google Forms/Sheets/Apps Script, GitHub/Vercel website. Do not duplicate or replace these.

## What was directly verified today
- D1 query successful: **164 donors**, **33 Bin**, **15 historical website intake cases** in `FORM_SYNC_PENDING`, **0** in manual `REVIEW_REQUIRED`, **1 active admin**. These are technical record counts, not a completed live administrator sign-in test.
- Cloudflare account analytics reported **158,032 total D1 rows read so far on 2026-11-16 UTC** against the Workers Free **5,000,000 rows/day** allowance, approximately **3.2%** at that point. Usage is time-dependent and reporting can lag.
- Existing Worker has **21 bindings**, original scheduled `*/2 * * * *` Google Sheets donor import intact.
- The website latest production Vercel deployment is **READY**, GitHub main commit `8700b3ef00ddc867ae7a50a500bb4d1e2bd205de`. Custom registration, loading spinner and official ID display are in the released website source. The custom app is the public donor-facing entry; Google backend remains hidden.
- Account's most-read queries (today): two-minute import snapshot, courier lookup, legacy accepted-photo reconciliation. The huge correlated V11 photo matcher responsible for the previous D1 quota incident is absent from current production V13.
- A daily ChatGPT task was created to check Cloudflare usage at approximately **3 PM IST** and report resource use with no donor scanning or writes. **This is a report, not an automatic hard quota stop.**

## Immediate low-risk change
- V14 patch in `cloudflare/patches/d1-legacy-reconciliation-daily-v14.mjs`: reduce only legacy V7 accepted-photo reconciliation from hourly to daily at **03:00 UTC / 08:30 IST**, while keeping actual V11 private photo matching every **20 minutes** and core donor import every **2 minutes**. Source API and database writes remain unchanged.
- Staging and safety tests required before releasing. Do not remove login, disable the core sync, change D1 schema, or replace all Worker bindings.

## Outstanding items, prioritized

| Priority | Item | Verified status / dependency | Safe next action |
| --- | --- | --- | --- |
| P0 | Administrator and volunteer login | D1 and one active admin verified; password-based live browser login not tested because user credentials are private | User tests real sign-in; investigate only the exact error if it persists |
| P0 | Daily D1 quota protection | Account analytics read-only check scheduled daily; recommended warning thresholds 1 million rows, pause nonessential jobs over 2 million; Cloudflare hard free cap 5 million | Review daily report and measure next full-day pattern before further background jobs |
| P1 | 15 older photo submissions | No manual photo review; these are awaiting trustworthy original source registration match. The donor registration ID/email must come from the original automation, never invented | Reconcile only exact original `WEBSITE:<UUID>` markers and official Column M IDs; do not guess by name/phone |
| P1 | User-facing donor registration | Custom Cloudflare/Vercel form and spinner in latest main; backend existing Sheet bridge preserved | Perform one explicit test registration with user's permission and a known test contact, verify ID, Sheet row, email and photo link exactly once |
| P1 | Notification relay | As last checked 15 Nov: ~54 feedback notifications and 3 expiry notices configured as held; default no sends | Requires installation and real authorized test of additive notification dispatcher in existing original Apps Script, before enabling double gates |
| P1 | 30-day inactive donor expiry | Staging exists, irreversible expiry prevented until actual authorized email acceptance and grace | Keep email and expiry feature flags off until original relay is tested; retain all records |
| P2 | Courier sheet ↔ Certificate DB ↔ Desk | Existing bridge flows must be acceptance-tested with one verified AWB; old separate hourly courier automation was found disabled and was **not re-enabled** | Inspect authorized courier source and test a single known shipment; no third-party courier API assumptions |
| P2 | Wig inventory, salons, hospitals, volunteer and wig-maker desks | Prior modules present or prototyped; full authenticated role-by-role mobile acceptance tests not yet verified | Test using existing legitimate accounts, do not broaden access or reset passwords |
| P2 | Hard-copy payments | Static QR cannot prove a bank/PhonePe payment | Keep manual confirmation or connect an authorized gateway and signed webhook; never mark paid without evidence |
| P3 | Single sign-on and messaging | Cross-service auth and WhatsApp/SMS business provider require separate authorization, opt-in and controlled credentials | Design additive integrations only after credentials and data permissions are available |

## Release discipline
1. Check read-only account D1 usage before a change. Hard stop on nonessential releases when cumulative daily rows read exceed **2 million**; leave core login and donor operations running.
2. Never test on production by creating dummy donor IDs, sending unauthorized emails, or changing certificate data. Do not run `SELECT *` over full donor history merely for diagnostics.
3. Compile the **entire** existing Worker in Cloudflare staging, test original `fetch` and `scheduled` handlers, verify current source baseline, preserve 21 bindings and 2-minute cron.
4. Keep a rollback version; document all changes. No release or rollback should be claimed successful without production version verification.
5. At most **one small production code change per work session** until 24 hours of safe D1 consumption and genuine admin login acceptance are verified.
6. The daily ChatGPT check cannot directly stop Cloudflare queries; a future hard in-product usage circuit-breaker requires design and tests. Prefer reducing query costs and duplicate scheduling, not disabling all services.

**Limitations:** It is not safe or possible to mark all external-email, payment, role acceptance, or absent-source registrations as completed without the original authorized systems and real test evidence.
