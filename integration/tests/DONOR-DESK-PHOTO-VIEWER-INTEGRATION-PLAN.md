# TEST donor photo viewer integration — verified resources and access requirements

**2026-10-19 · Development branch only · NO production changes**

## Confirmed TEST facts
- Copied website Google Form generated fictional registration ID `2026-191003/M/2022` in isolated Google Sheet row 4.
- A separate website TEST D1 database `mamta-website-registration-photos-test-20261019` contains two `photo_uploads` rows for this registration: `front` (145832 bytes, JPEG) and `back` (135440 bytes, JPEG).
- The *actual private R2 bucket* `mamta-website-photos-test-20261019` has both `fictional-test/<uuid>/front.jpg` and `fictional-test/<uuid>/back.jpg` objects of matching sizes.
- Existing Donor Desk TEST Worker: `mamta-donor-desk-integration-test`, TEST D1 `mamta-donor-desk-integration-test`, and separate R2 `mamta-donor-photos-integration-test`.
- TEST Desk D1 already has `donors`, `donor_photos`, `staff`, `sessions` and `donor_events` tables.

## Important: access before integration
Do not expose images through a public R2 URL or a query-string-only donor UUID or registration ID. All staff photo retrieval MUST require a valid existing Donor Desk session, active staff account, role and assignment check (or Administrator role). Do not permit anonymous access to donor photos. Review real Desk routes and session logic before applying code.

## Planned integration after code review and TEST approval
1. Idempotently import fictional website row into *TEST* Desk donor record with `source=website-test`, `registration_id`, and original `source_key`. Never import to production until explicit approval.
2. Map website photo side `front/back` to a private object reference that cannot be guessed or fetched anonymously. Never treat photos in a separate R2 binding as already available through the Desk's existing `DONOR_PHOTOS` binding.
3. Add a separate read-only **TEST R2 binding** to the TEST Desk Worker or authorized internal service binding. No public bucket access.
4. Retrieve each image using existing Desk session + authorization checks; require active Administrator, or staff assigned to this donor. Apply Cache-Control: no-store and prohibit sharing to other staff.
5. Protect duplicate imports and missing/uncertain photo objects, record audit events, and test offboarding, forged sessions, inactive staff, unassigned staff, incorrect donor ID, admin, and assigned staff.
6. Confirm that original donor IDs, photos, permissions, mail automation and production Worker are unaffected.

**Status:** Storage verified, permission model mapped, integration NOT yet deployed or tested in Donor Desk.
