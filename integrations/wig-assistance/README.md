# Mamta Care Wig Portal — Production Release Gate

STATUS: STAGING ONLY. Existing public wig form, donor intake and production patient data unchanged.

Built: V7 patient UI, four guided photo uploads, backend API with Cloudflare Turnstile and collision-free daily registration IDs, private R2 photo storage, D1 cancer-case tables, admin review/approval/production release controls, active CINE WIGS job assignment, an email and Google Sheet synchronization outbox, and an Apps Script bridge.

Required to activate:
1. Deploy integrations/wig-assistance/WigDatabaseBridge.gs from the original Wig Donation Database Google Sheet's Apps Script editor. Authorize Google Sheets and MailApp. Set a unique 48+ character WIG_SHEET_BRIDGE_SECRET in Script Properties.
2. Bind the same secret encrypted in Cloudflare, set WIG_SHEET_BRIDGE_URL to the Apps Script HTTPS web app URL, and allow only real production website origins via MC_WIG_ALLOWED_ORIGINS.
3. Import integrations/wig-assistance/worker-module.js and existing-worker-hook.js into the original Donor Desk Worker build WITHOUT removing old bindings, secrets, routes or schedules.
4. Apply additive schema.sql to production D1 after staging tests. Keep donor photo bucket private and all medical/photo endpoints admin-only.
5. Test that registration creates one official ID, four private photos, one row in Form Responses 1 and one registration acknowledgment. Repeat same submission key and confirm no duplicate.
6. Test administrator approval creates exactly one CINE WIGS maker order, queues and delivers one approval email, and synchronizes the Sheet. Confirm maker job cannot start before separate release.
7. Test maker status updates, cancellations, recovery and retries. Preserve live hair-donor registration; keep a tested rollback plan.
8. ONLY THEN set MC_WIG_ENABLED=true in the Worker and WIG_FORM_ENABLED=true in the website and publish the production branch.

IMPORTANT: the feature is currently disabled. Successful code upload/build does not mean production integration and delivery are verified.