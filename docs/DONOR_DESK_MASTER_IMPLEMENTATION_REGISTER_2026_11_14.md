# Mamta Care Charitable Trust — Donor Desk Master Implementation Register

**Record date:** 14 November 2026  
**Website:** Mamta Care Charitable Trust / Vercel  
**Donor Desk:** Cloudflare Worker "mamta-donor-desk-launch-new", existing D1 database and private R2 photographs  
**Mission:** Reliable donor management, fully traceable donations and authentic wigs for cancer patients, with privacy, consent and a completely preserved historic register.

This document is the canonical list of outstanding work reported in previous Mamta Care conversations. An entry is marked complete ONLY if implementation and deployment were verified. Describing a concept or adding an empty table is not the same as delivering the full workflow.

## Release history and production facts


### 14 November 2026: Free Wig Intake & Permanent Photo Auto-Reconciliation V3
- Existing Google Form free-wig entry is replaced on the public website with a **consent-attested, Turnstile-protected Cloudflare request page** at \`/request-free-wig\`. The original Mamta Care logo remains unchanged and separate from the form artwork.
- D1 public request staging uses two new **additive-only** tables: \`mcct_public_wig_intakes\` (private recipient/contact information, consent and state) and \`mcct_public_wig_rate\` (HMAC-pseudonymized daily request rate). Five requests per daily hashed-IP bucket; duplicate contact/day safe. No diagnosis or identity-proof upload is requested.
- Admin \`/admin-wig-intakes\` privately reviews new requests; accepted requests are inserted idempotently into existing \`wig_requests\` with status **pending**, and a \`wig_events\` audit. Rejected requests require an admin note. No wig allocation, payment or recipient email is falsely reported.
- Existing accepted website photo reviews are now **automatically reconciled by the current two-minute cron** once a genuine official registration ID exists on the intake and a single matching donor has been imported. This does not create a new registration ID or an artificial donor.
- Recovered an accepted registration missing its official ID from Form Responses row 143, after verifying the dated sequence, consent and hidden intake-ledger identity. Assigned unique \`2026-101104/M/2022\`; repaired hidden ledger row 71 and D1 intake registration link. Existing two-minute import successfully added the donor. Linked it plus another already registered accepted photo case to the donor directory with audited \`mcct_ops_review_links\` and \`donor_events\`.
- Verified after recovery: **160 donor records, 31 binned, 2 accepted photo reviews linked, 4 accepted reviews without authoritative form/ledger matches**. These four cannot safely be assigned official IDs until their source registration is recovered. Previously 54 feedback notifications remain queued and **unsent**.
- The future-year festival calendar and official website artwork are unrelated and untouched.
- Real Turnstile submission and signed-in mobile-browser acceptance testing remain unverified through automated tools; don't mark these as passed without a real user test.


### 14 November 2026: Unified Operations V2 production release
- Deployed the consolidated private administrator hub at `/admin-ops` on the **existing Cloudflare Donor Desk Worker** (GitHub PR #15). Its links route directly to the established donor, photo, courier, hand collection, certificate, salon, hospital, volunteer and wig maker workspaces, subject to their original role and session checks.
- Added a receipt-to-inventory reconciliation queue, audited partial hair-lot splitting (piece-count conservation and retry keys), stock CSV export, camera/photo AWB lookup where browser BarcodeDetector is supported, and manual fallback.
- Added **photo-review matching**: an accepted case can be linked to an *already existing, uniquely imported official registration ID*, after an administrator confirms identity. No IDs are invented, and existing donor / certificate records are untouched. This does **not** yet automatically assign official IDs to the six accepted, unregistered review cases.
- Added manual consent-attested WhatsApp/SMS/email drafts with a maximum of **50 WhatsApp/SMS drafts per IST day**; opening a messaging client is recorded as **OPENED_UNVERIFIED**, never delivered or provider-confirmed.
- Integrated existing Cancelled/reopen, bin-aware D1 counts, 30-day inactivity review and unsent certificate-feedback queues into the new dashboard. Automatic expiration and outbound email/SMS/WhatsApp delivery remain OFF pending verified providers and callbacks.
- Cloudflare upload used the **content-only Worker API** with the original bundled Worker intact; 21 existing bindings and scheduled handler preserved. Both GitHub safety workflows passed, staging Worker compilation passed, and the postdeploy D1 readback confirmed **159 donors, 58 completed, 31 binned**. Verified production Worker version `4226a6a2-e12d-4a7d-bce6-3169e3a6a28d`; previous version `3acbd482-0bbc-476c-8178-bfa142ff2a2b` retained for rollback.
- External unauthenticated browser checker could not fetch the production workers.dev URL; a real signed-in phone/browser visual test is **not yet verified**. Do not mark the UI QA requirement completed.


### 14 November 2026: Operations V1 deployed
- Production Worker code updated through the content-only Cloudflare API. Existing **21 Worker bindings**, R2 photo bucket, database ID, existing two-minute cron and prior API routes preserved.
- Added private administrator-only **/admin-ops** dashboard, with a navigation link shown after an existing administrator signs in. No independent passwords, new user accounts or public donor lists.
- Donor Desk operations counts exclude the recycle table and distinguish pending, completed, cancelled, expired and historic Cleared values. This is D1-only; **it does NOT change the separate public Google Sheets-derived website counts**.
- Safe administrator **Cancel** and **Reopen** actions, optimistic concurrency control, audit trail and completed-donor protection. The 7 historic Cleared records were NOT mass-translated or deleted. New Cleared transitions blocked; the existing donor editor can display Cancelled/Expired without accidentally reopening them.
- **Hair inventory**: create hair lots with source (donor/salon/volunteer/hospital/drive), hair type (ponytail/braid/mixed/loose), quantity, optional length, collection mode, current custodian, location, stage and notes; full-lot transfer and audit history. Existing physical stock remains unentered; zero recorded lots initially means *unrecorded*, not zero actual stock.
- Scheduled **30-day inactivity candidate scanner** and feedback outbox preparation on the existing Worker cron; scanner runs at most once daily. It does NOT auto-expire donors. Email/SMS/WhatsApp are NOT sent, because no verified outbound donor-email binding is configured.
- Initial production verification: 159 existing donors, 31 binned; after the scheduled scan, 3 applications placed in inactivity-review queue and 54 certificate-completion feedback items queued, all without external delivery.
- Source and tests: GitHub PR #13; previous deployed Worker version retained for rollback. Static and simulated runtime tests passed.

### Earlier verified
- Premium Children's Day display with unchanged official Mamta Care logo; automated IST festival scheduler and premium Christmas treatment (GitHub PRs #8–#12).
- Website form processing and several Donor Desk modules existed before this release. Their end-to-end completeness is not assumed.

## I. Highest-priority lifecycle and donor intake work

| ID | Requirement | Current status | Required acceptance test |
| --- | --- | --- | --- |
| D01 | Moving a donor to Bin removes them from pending in Donor Desk and public website, but preserves all-time history and allows restore | **Partial:** Desk excludes Bin; website integration pending | Binned donor absent from pending everywhere, remains in lifetime record count and audit, restored once only |
| D02 | Cancelled replaces intended Cleared action for new entries; keep old Cleared records | **Partial deployed:** Admin Operations cancel and reopen, standard editor compatibility | Staff/admin permission rules confirmed in browser; Google Sheets and website share final status |
| D03 | Automatically expire dormant, not-donated registrations after 30 days without progress | **Review scanner deployed, actual expiry OFF** | Exclude received, in-transit, verified, binned and completed; email must deliver or retry before completing expiry |
| D04 | Expiry emails with reason and safe re-registration link; retain ID/history, reopenable queue | **Not delivered** | Verified outbound mail, idempotent expiry, retry history, no deletions, re-registration preserves source lineage |
| D05 | Admin photo review: visible Reviewed/Accept/Reject buttons after inspecting two photos | **Existing review decisions plus V2 queue links; full official workflow pending** | Reviewed accepts one real record, locks decision, stores audit and handles corrections |
| D06 | Reviewed applicant automatically enters assignable donor list, receives official registration ID in Sheet column M, state in N, consistent with website form | **V3 partial: two reviewed applications reconciled, one missing official ID issued; cron now auto-links if official ID exists; four remain unregistered and Apps Script generation still outstanding** | Test with synthetic application, no duplicate registration ID, no premature certificate or email |
| D07 | Two-photo intake (front hair forward and back), camera upload, minimum 14 inches or complete head shave, consent, optional email | **Partially existing** | Android/iOS camera and gallery work, independent of social or website source, source metadata preserved |
| D08 | Volunteer/staff allocation by city and state, first-come-first-served, hours-ago display, phone visibility restriction | **Existing but integration review pending** | All donors viewable, only assigned donors editable, admin-only actions blocked |
| D09 | Unique official registration IDs and 2022-series formatting, never overwrite existing IDs | **Existing and must be preserved** | Idempotent Google Sheet scripts, import and Cloudflare donor IDs map one-to-one |
| D10 | Website counter reconciliation with historic Sheets baseline and new Cloudflare donor records, including cancelled, expired and binned | **Outstanding** | Lifetime total invariant; pending equals active pending only, no duplicate count across import, completed verified separately |

## II. Hair and courier logistics

| ID | Requirement | Current status | Required acceptance test |
| --- | --- | --- | --- |
| H01 | Received hair stock: total quantity, ponytail/braid counts, hair length, source and collection mode | **Initial Ops V1 deployed** | Enter sample lot, count and location reconciled; original donor data unchanged |
| H02 | Record current stock custodian: volunteer, salon, staff, hospital, fabrication centre | **Initial Ops V1 deployed** | Full transfer updates current holder and immutable movement history |
| H03 | Partial stock transfers, split and merge lots, batch dispatch to maker, stock weight if available | **Partial V2: audited partial-lot split/transfer deployed; merge, weighing, maker-batch dispatch outstanding** | No negative balance, double count or untracked location |
| H04 | Link stock to parcel reception and hand collection, AWB barcode scan, camera beep and paper/phone photo recognition | **Partial V2: unstocked receipt queue and camera/photo AWB lookup deployed; device QA and full receipt integration outstanding** | Scan authentic AWB on mobile, auto-resolve donor and update existing route |
| H05 | Courier / hand-collected decision inside donor record and immediate or two-minute In Transit sync to Sheets | **Existing, but end-to-end bug verification outstanding** | One courier entry produces correct Google Sheet row and tracking stage without duplicate |
| H06 | Courier received by fabrication centre Nashik, staff scanning, manual status updates reflected hourly | **Existing components, reliability verification pending** | Correct donor, AWB and destination matched, source-of-truth Sheet sync stable |
| H07 | Fabrication stage schedule: received -> processing -> wig making -> implantation -> wig complete, with the latest stage respected | **Outstanding reliability audit** | Time transitions never regress or skip donor stages |
| H08 | Public tracking shows accurate stage immediately from Sheet column K onward, QR certificate opens the correct donor without exposing internal volunteer names | **Existing, integration bugs outstanding** | QR and registration ID resolve same donor and stage at every step |

## III. Certificates, donor feedback and communications

| ID | Requirement | Current status | Required acceptance test |
| --- | --- | --- | --- |
| C01 | Certificate database sync from registration/verification and Google Slides-generated PDFs | **Existing, needs synchronization audit** | Verified donor reaches certificate database with correct name/ID once |
| C02 | Individual QR on each issued certificate links directly to donor's donation tracking | **Previously fixed, regression testing required** | Auto-issued and manual Sheets-issued certificates both use donor-specific QR |
| C03 | Automatic feedback request after Completed AND certificate genuinely generated | **Feedback queue deployed, delivery OFF** | Exactly one verified email per donor with a personalized feedback token |
| C04 | Registration acknowledgements with donor name, ID, city, length via WhatsApp/SMS; maximum 50/day | **Partial V2: consent-attested manual message drafts capped at 50/day; automated sending/provider webhooks outstanding** | Consent, sender verification, provider delivery receipt, daily quota, no false free/unlimited promises |
| C05 | Admin staff-specific push and in-app notification bell; reminders with date/time, snooze, persistence | **Existing features with usability bugs** | Android and iOS alert conditions, no accidental cross-staff visibility |
| C06 | Certificate Print Studio Pro, two certificates on 12x18, custom sizes, border adjustment, JPG export | **Existing requests, integration verification pending** | Print-ready export, no distortion to original certificates |
| C07 | A4 3x3-inch and courier 3x4-inch stickers, multiple-label batch printing, pincode autofill and clear Back navigation | **Existing requests, integration verification pending** | Multi-sticker printing works, label telephone number legible |
| C08 | Paid hard-copy workshop with PhonePe/UPI verification, Google Sheet paid list and complimentary recipients | **Outstanding integrated sync** | Only verified payments require charge; complimentary bypass payment; no false payment approvals |

## IV. Wigs, salons, volunteers, hospitals and partner access

| ID | Requirement | Current status | Required acceptance test |
| --- | --- | --- | --- |
| P01 | "Request a Free Wig" replaces Google Form with Cloudflare while preserving cases | **V3 deployed pending live user acceptance check: public secure form, admin review and existing Wig Desk import** | End-to-end intake, consent, maker allocation and recipient privacy |
| P02 | Wig requests and inventory visible in Donor Desk, maker logins, maker progress and delivery | **Existing modules with navigation/reporting bugs** | Wig Desk and Fabricator buttons open real pages, not return to overview |
| P03 | Hospital partner login, wig requests and agreement/document workflows | **Partially existing** | Hospital request reaches maker, consent recorded, patient identity restricted |
| P04 | Salon collaboration, ₹249 one-time non-refundable onboarding, partner login and donor submission review | **Partially existing** | Only approved salon records can submit; admin approvals create correct pending donor; no refund logic |
| P05 | Volunteer registration on Cloudflare, secure document collection and optional UPI verification | **Outstanding migration** | Existing profiles/agreements preserved and no manual form duplicate |
| P06 | Volunteer management, city search, referrals, photo, ID proof, agreements, signatures, one-year QR-verified digital ID | **Partially existing, full QA pending** | Role, QR authenticity, Aadhaar internal-only, no donor personal data leaked |
| P07 | Staff, volunteer, salon, hospital and website control Single Sign-On | **Outstanding** | Existing sessions migrated securely; roles remain compartmentalized |
| P08 | Volunteer Wig Request tool and hand collection "Hair collected by me" action directly on donor | **Existing requests; visibility/permissions issues** | Button exists for correct role and updates Donor Desk, Sheet and audit |

## V. Public website, control centre, security and UI

| ID | Requirement | Current status | Required acceptance test |
| --- | --- | --- | --- |
| W01 | Migrate "Track Your Hair Donation" from Apps Script to Cloudflare without breaking existing QR URLs | **Outstanding migration** | Historical ID links preserved, new live stages correct, no downtime |
| W02 | Move admin Website Control Center (counters, photos, drives, announcements, promotions, posters) into Donor Desk | **Outstanding unified workflow** | Publish, preview, remove, cleanup uploaded storage and announce safely |
| W03 | Admin-controlled visitor campaign splash graphics with schedules and 14-inch rule | **Separate holiday automation completed; custom campaigns pending** | Admin preview and schedule; no overlapping popups |
| W04 | India occasion/festival premium greetings automatically change on IST date | **Deployed and verified** | Every configured date displayed from midnight IST; original logo unchanged |
| W05 | Registration spam protection: Turnstile, rate limit, abuse logging, appropriately disclosed coarse location | **Existing bindings, complete QA pending** | No covert GPS; bot retries limited, user consent and legitimate donors unaffected |
| W06 | Premium, calm, intuitive mobile Donor Desk with direct donor details, Back, sign-out, clean card counts and admin tabs | **Partial V2: consolidated premium admin hub and module links deployed; entire staff/donor page redesign and device QA pending** | Tested on Android, iPhone and desktop with no lost functionality |
| W07 | Donor celebration graphics/confetti after actual donation Completed and certificate generated | **Outstanding** | Trigger only after confirmed success; accessible reduced-motion fallback |
| W08 | Hair donor privacy: hide volunteer identities on donor tracking, masked donor phone for volunteers or verified calling bridge | **Outstanding security review** | Donors and volunteers see only authorized fields; no unsafe telephone proxy |
| W09 | 14-inch rule across forms, guidance, donation posters and website | **Partially existing** | Explicit usable length excluding split ends; shaving option supported |
| W10 | Free or low-cost hosting, sustainable D1 usage and Google Sheets cron cadence | **Ongoing** | Query counts monitored, no surprise paid dependency, no full-table repeated scans |

## Operations release constraints and safety rules

1. **Never alter or regenerate the official Mamta Care black-and-white mother-and-children arch logo.**
2. **Never delete or overwrite existing donor, volunteer, wig, certificate, registration, photo or courier records during migrations.** Use an auditable, reversible state transition.
3. **Always test registration ID, donor allocation, certificate QR and Google Sheet synchronization before any production change.** One success in a preview does not prove the complete donor workflow.
4. **Keep all donor contact details and images private.** If location is needed, obtain informed consent for precise GPS; do not collect it covertly.
5. **Never claim WhatsApp/SMS or donor emails were delivered without provider confirmation.**
6. **No automatic 30-day expiration until the donor notification channel and reopen flow are both tested.**
7. **Do not silently change website public impact totals.** Source reconciliation with historical Google Sheets must be deterministic and explainable.
8. **Do not change the previously approved PWA installation URL, session cookies or login permissions.**
9. **State what has and has not been deployed.** Schema foundations, preview UI and queued emails must never be represented as end-to-end feature completion.

## Next integration dependencies

- **Website public counters:** Google Sheets live metrics API and the donor status/bin source must reconcile by official registration ID, with a separate all-time lifetime total.
- **Automatic expiration:** verified email delivery bridge + tokenized re-registration + idempotent task processor + bounce/retry policy.
- **Reviewed donor queue:** official Google Sheet donor identity and original two-photo intake, per-registration idempotency, and an approved decision-to-import bridge.
- **Hair custody:** historical physical stock intake and links to received parcels, makers and wig jobs, with partial quantity/weight movements.
- **WhatsApp/SMS:** explicit opt-in, an authorized Meta/telecom messaging provider and budget/quota controls.
- **Volunteer and salon forms:** phased migration with test accounts, regulatory consent and existing payment/certificate data protected.

## Current verified production metrics (point-in-time)

- Pre-change donor table: 159 rows.
- Recycle/Bin: 31 rows (29 have pending-type follow-up statuses historically).
- After Operations V1 scheduled run: 3 safely flagged inactivity-review candidates; 54 queued feedback-email records **not sent**.
- Newly recorded physical hair-stock lots: zero at deployment. This is an empty **new ledger**, not a claim that Mamta Care has no existing hair stock.

Latest donor-count point-in-time after V3 reconciliation: 160 D1 donor rows, 31 recycle/bin rows, two photo-review donor links, four unmatched accepted photo cases. Wig intake has no manufactured test-patient records.

This register is the authoritative remaining-work checklist. It should be revised only after verified deployment and cross-system testing.
