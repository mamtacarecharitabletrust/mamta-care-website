# Mamta Care master implementation register — 14 November 2026

This register separates requested features from deployed behavior. Preserve existing
production donor data, certificate IDs, media, email automation, and the official logo.

## Verified architecture

- Website: Vite/React project, connected GitHub to Vercel.
- Website hair registration has a Google Form fallback and a gated Cloudflare route.
- Free wig requests use Google Form; tracking uses Apps Script.
- Public counters use a Google Sheets aggregate with a baseline adjustment.
- Donor Desk uses a Cloudflare Worker with D1 and private R2 photos and a two-minute sync schedule.
- Production D1 has donor recycle, photo review, reminder, partner, wig inventory and courier tables.
- The Cloudflare D1 record count does not necessarily match historical Google Sheets counts.

## Implementation register

| Area | Requested behavior | Status |
| --- | --- | --- |
| Occasion popup | Responsive greeting, close/continue/register, 14-inch reminder | Built in review branch |
| Occasion calendar | Indian fixed/movable dates, midnight IST boundaries | Built in review branch |
| Announcements | Website-opening images and admin notes | Pending |
| Free wig requests | Cloudflare form preserving existing workflow | Pending |
| Donation tracker | Cloudflare public tracking retaining IDs/history | Pending |
| Public metrics | Continuously updated, accurately reconciled totals | Partly existing; correction pending |
| 30-day inactivity | Auto-expire unfinished cases, email, reopen | Pending |
| Bin | Exclude bin from pending, preserve historic total | Existing bin; integration pending |
| Cancelled status | Replace intended Cleared workflow safely | Pending |
| Donor queue | Accept photo review into assignable pending queue | Pending verification |
| Hair inventory | Custodian, location, braid, ponytail, mode and transfers | Pending |
| Volunteer intake/payments | Cloudflare + UPI verification | Pending |
| Donor messaging | Up to 50/day personalized, consented messages | Pending |
| Feedback | Send one link after certificate issuance | Pending |
| Security | Rate limits/bot challenges and privacy safeguards | Partially existing |
| Admin UI | Simplified premium layout and accessible celebrations | Pending |
| Website control | Add authenticated Control Center integration | Pending |

## Safety gates

1. Identify every production Worker, D1/R2 binding, Google Sheet and Apps Script before changing them.
2. Export D1, verify restoration, snapshot code, and stage changes on isolated resources.
3. Use synthetic donors for testing; never send test notifications to real donors.
4. Do not alter registration numbers, certificate statuses, emails, or media in UI tests.
5. Total historical records must remain independent of completed, pending, expired, cancelled and bin counts. A status change cannot silently increase completed.
6. Preserve Google workflows until a Cloudflare migration is fully reconciled.
7. Never collect precise coordinates secretly. Disclose IP-based spam safeguards.
8. Jobs must be idempotent, audited, and respect reopened cases.
9. Test preview and mobile accessibility before any production deployment.

## First branch

- Calendar: src/lib/occasionCalendar.js
- Popup: src/OccasionWelcome.jsx
- Styling: src/styles/occasion-welcome.css
- Integration: src/App.jsx, homepage only
- Unit tests: tests/occasion-calendar.test.mjs

Popup dismissal is session-local to the occasion. Registration respects the
existing feature gate, so Google Form remains the fallback until Cloudflare
registration is verified.

Date sources: India Post 2026 holidays and central Government 2027 holiday list.
Moving festival dates require verification for future years.
