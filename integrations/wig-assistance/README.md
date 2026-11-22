# Mamta Care Wig Portal — Production Release Gate

STATUS: STAGING ONLY. Existing public wig form, donor intake and production patient data unchanged.

Built: V7 patient UI, four guided photo uploads, backend API with Cloudflare Turnstile and collision-free daily registration IDs, private R2 photo storage, D1 cancer-case tables, admin review/approval/production release controls, active CINE WIGS job assignment, an email and Google Sheet synchronization outbox, and an Apps Script bridge.

Required to activate:
1. Create a NEW standalone Apps Script project at https://script.google.com/home/projects/create and paste WigDatabaseBridge.gs. Do not paste this into an existing Sheet-bound project; that could interfere with its existing doPost handler. Authorize Google Sheets and MailApp from the Trust account. Set a unique 48+ character WIG_SHEET_BRIDGE_SECRET in the standalone project's Script Properties. Deploy as a Web App executing as the Trust account with access for Anyone, protected by the secret.
2. Bind the same secret encrypted in Cloudflare, set WIG_SHEET_BRIDGE_URL to the Apps Script HTTPS web app URL, and allow only real production website origins via MC_WIG_ALLOWED_ORIGINS.
3. Import integrations/wig-assistance/worker-module.js and existing-worker-hook.js into the original Donor Desk Worker build WITHOUT removing old bindings, secrets, routes or schedules.
4. Apply additive schema.sql to production D1 after staging tests. Keep donor photo bucket private and all medical/photo endpoints admin-only.
5. Test that registration creates one official ID, four private photos, one row in Form Responses 1 and one registration acknowledgment. Repeat same submission key and confirm no duplicate.
6. Test administrator approval creates exactly one CINE WIGS maker order, queues and delivers one approval email, and synchronizes the Sheet. Confirm maker job cannot start before separate release.
7. Test maker status updates, cancellations, recovery and retries. Preserve live hair-donor registration; keep a tested rollback plan.
8. ONLY THEN set MC_WIG_ENABLED=true in the Worker and WIG_FORM_ENABLED=true in the website and publish the production branch.

IMPORTANT: the feature is currently disabled. Successful code upload/build does not mean production integration and delivery are verified.

## Verified staging results — 2026-11-23 IST

- Standalone production Google Apps Script deployed by NGO administrator; original Wig donation Database ('Form Responses 1', 46 columns, and 'Sheet1') read successfully. MailApp authorization and self-addressed test email verified. This is NOT production E2E certification.
- Isolated Google Apps Script SANDBOX ONLY deployed with TEST ONLY spreadsheet 1umeQfIKjrGimR62F7gb-GA2zOq1GB1rp2jTw1RE3Q2c and simulated emails only.
- Cloudflare staging authenticated to Apps Script; fictional patient 2099/010199 was assigned to isolated staging CINE WIGS, manufacturing release guard worked, and manufacturing status queued and synced.
- Real handleMamtaWigV8 multipart registration tested with four synthetic PNGs and official Cloudflare Turnstile testing credentials; fictional registration 2026/231101. Staging R2 objects verified, idempotent retry returned original registration.
- New fictional 2026/231101 appears in both TEST ONLY Google tabs. Staging outbox shows GOOGLE_SHEET_CREATE DONE (after one safe retry) and REGISTRATION_EMAIL DONE (simulation only).
- First fictional 2099/010199 outbox shows GOOGLE_SHEET_CREATE, GOOGLE_SHEET_APPROVE, APPROVAL_EMAIL (simulated), and MAKER_STATUS_V2 all DONE.
- Temporary staging one-minute Cron Trigger removed; production existing two-minute schedule unchanged.
- Frontend preview Turnstile site key corrected to match existing production configuration; activation-dependent preview copy improved, but WIG_FORM_ENABLED remains false.
- Production Worker deployed version 543b20a2-be5a-49fe-9aa7-1681ad4cb7ad is unchanged; production MC_WIG_ENABLED remains false.

### Remaining mandatory production release gates

1. Verify deployed production Apps Script version and MailApp/Google Sheets permissions. Never route real patient information into sandbox App Script.
2. Configure production Worker with genuine Google Apps Script URL and matching encrypted bridge secret; verify with no real patient data.
3. Deploy the wig module in disabled mode into existing Donor Desk Worker, preserving all existing bindings, maker jobs, sessions, donor flows and two-minute cron. Read-only smoke test and rollback plan required.
4. Check permitted production website origins, Turnstile widget domain approval, upload/photo privacy and application consents.
5. Controlled first-time UI-to-API test in isolated environment, including registration ID, private photo storage, confirmation mail, admin review, one maker job, release gate and status sync.
6. Only after tests, deliberately activate MC_WIG_ENABLED, WIG_FORM_ENABLED, admin navigation and publish production branch after approval.

Successful staging tests do not authorize publication of public patient intake.
