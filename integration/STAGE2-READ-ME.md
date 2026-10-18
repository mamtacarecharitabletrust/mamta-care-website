# Mamta Care website hair-registration — Stage 2 integration review

**Status: DEVELOPMENT ONLY — not connected or deployed.**

The current **Donate Your Hair** button still goes to the original Google Form. The separate preview route `/hair-registration-preview` is a local/dev design and does not send any data or photos.

## Integration added to this branch
- `src/HairDonationRegistration.jsx`: React mobile/desktop preview with the haircut and complete head shave choices, 14-inch minimum, details, two photo selectors, and separate permissions.
- `src/styles/hair-registration.css`: responsive layout and symbolic motion (subject to reduced-motion preferences).
- `integration/apps-script/WebsiteOriginalFormBridge.REVIEW.gs`: proposed Apps Script native Google Form submission adapter (not deployed; not hooked up).
- Existing official Form, Google Sheet, registration-ID generator, email scripts, donor desk and source button remain unchanged.

## Before a working beta
1. **Inspect the exact Google Form questions and types** through `FormApp.getItems()` in a fictional TEST copy; labels and choices may not match the review mapping.
2. Fix form answer mappings for native checkbox/multiple choice/list question types and hair length ranges; do not create responses for any unsupported item.
3. Use TEST Apps Script + TEST Form + TEST Sheet + TEST D1 + TEST private R2. Never submit TEST records into production.
4. Review the bridge's response-row correlation and script property state machine carefully. FormApp programmatic submissions do **not** fire Form submit triggers. Ambiguous or unknown submission outcomes must stop for manual reconciliation instead of resubmission.
5. Connect the React UI to a secure backend that stores two photos in private R2 and donor metadata in D1; use private authentication for Administrator and assigned-team viewing. Do **not** expose bridge secret in React.
6. Verify exactly-once registration IDs and recipient email automation after the existing guarded scheduled email job runs; check duplicate retries and outages.
7. Use approved realistic reference photos for front (hair brought forward), back (full length), haircut (female donor and braid) and head shave (woman barber with razor). Do not imply that generated images depict real donors.
8. Privacy policy, retention/deletion and optional awareness consent need approval before release.
9. Never change the website's existing Google Form button or deploy to production without explicit user authorization.

## Known limits of this stage
- The current photo previews are placeholders based on existing website imagery, not final photographic instructions.
- Animations are lightweight symbolic CSS, not video of real humans.
- Form connection and cloud photo storage are not wired into the preview.
- No TEST deployment or end-to-end verification was performed.
