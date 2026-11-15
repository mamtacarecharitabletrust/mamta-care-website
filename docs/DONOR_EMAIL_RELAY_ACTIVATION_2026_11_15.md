# Mamta Care — Verified Donor Email Relay Activation (V8)
**Prepared 15 November 2026. Deployment to Cloudflare is safe but email SENDING remains DISABLED until Google Apps Script is connected and tested.**

## Why the existing 54 queued emails must not be released blindly
The Donor Desk has 54 feedback notices in \`mcct_ops_notification_outbox\` with state \`PENDING_CONFIGURATION\`. Each maps to a Completed Google-Sheet donor with a real certificate, official registration ID, matching registered email and \`STRONGLY AGREE\` donation consent. This consent should still be reviewed for communication authorization. No verified email sending or delivery callback currently exists in the Cloudflare Worker. Marking these \`SENT\` without a Gmail/Apps Script acknowledgment would be dishonest and create lost donor communications.

## Architecture: reuse the official NGO's existing Google Apps Script
The original social-registration/Donor Desk script already uses an \`MC_DESK_SHARED_SECRET\` and a published \`SOCIAL_BRIDGE_URL\`. The V8 Worker never exposes these values to clients.

1. **Original spreadsheet-bound Apps Script owner only:** Open the trusted project associated with \`HAIR DONATION-(FREE ENROLL) (Responses)\`; existing project link previously provided: https://script.google.com/u/0/home/projects/1sPYRk_p3sXr8RwQ2WZoSwUgXiZExtmY9vhD0gO6z6f9uIDorooaRvwu8/edit. The current connected Drive account could not retrieve this Apps Script file, so its deployed dispatcher was NOT modified here.
2. Back up the full existing \`doPost(e)\` and \`onFormSubmit(e)\`. Add **only** the new source \`apps-script/MamtaDeskNotificationRelay.gs\` to the original project; do **not** replace the original generator, Google Form email scheduler or create a second \`doPost\`.
3. In the existing \`doPost\`, after parsing \`payload\` but before the social fallback, route the three new actions:
   \`\`\`js
   if (payload && [
      'desk_notification_health', 'desk_notification_status',
      'desk_notification_send'
   ].includes(payload.action)) {
      return mcDeskNotificationRelayPost_(payload);
   }
   \`\`\`
   Retain the existing \`website_*\`, \`desk_verify\`, \`desk_snapshot\`, \`pending\`, \`approve\` and other newer actions exactly as they are. The sender validates the existing \`MC_DESK_SHARED_SECRET\` against the Script Property. Confirm this property already matches the Cloudflare secret via a no-send health probe. Never paste the secret into GitHub or browser code.
4. Authorize \`MailApp\` in the Apps Script editor and deploy a **new web app version**, retaining the existing deployment URL and permissions. Test \`desk_notification_health\` using the legitimate secret through the internal Worker admin health page. It should report \`relay_connected:true\`, MailApp remaining quota and \`apps_script_send_enabled:false\` initially.
5. When the owner has reviewed consent, verified MailApp sender identity and performed one safe pilot, set Google Script Property \`MCCT_NOTIFICATION_RELAY_ENABLE_SEND\` to \`YES\`. Configure Cloudflare Worker plain-text binding \`MC_NOTIFICATION_EMAIL_ENABLED=true\` to activate the two-minute queue pump. Default pilot cap is **ONE email per IST day**. Only after checking the original Gmail Sent folder, outbox state and no duplicates may the owner set \`MC_NOTIFICATION_EMAIL_DAILY_CAP=20\` in Cloudflare.
6. If Gmail/Apps Script send is uncertain, both systems preserve the \`RESERVED\`/ \`READY\` state and **never automatically retry the same outbox ID**. The owner checks Gmail Sent and the hidden \`MC_Desk_Notification_Dispatch_Ledger\`. From \`/admin-notification-outbox\`, the \`Reconcile Uncertain Sends\` control queries ledger status; it does **not** send new emails.
7. Existing Google Form registration acknowledgments and certificate mail jobs stay independent. V8 automates only consent-attested **FEEDBACK_EMAIL** cases. Automatic expiry/rejection is **not** activated. Payment, WhatsApp/SMS and single sign-on are separate integrations.

## Quotas, privacy and terminology
Google's currently documented Apps Script daily MailApp recipient quota is 100 per day for consumer accounts and 1,500 for Google Workspace, subject to change; other existing script emails use the same quota. V8 reserves at least 10 reported recipients for existing jobs and caps its own feedback at one per day by default, 20 only with explicit configuration.

- \`PENDING_CONFIGURATION\`: not sent; no verified sender.
- \`READY\`: one dispatch attempt reserved; might have reached Google.
- \`SENT\`: MailApp accepted a send call; **not** proof of final delivery to the donor's mailbox.
- \`UNKNOWN\` in the private Apps Script ledger: ambiguous outcome, never resend automatically.
- \`FAILED\`: possible terminal state for explicit future verified relay errors, not evidence of non-delivery.
- Outbox ID is 32-hex (original D1) or UUID, used as the immutable idempotency key in both systems.
- No donor contact details are placed in visible public APIs, the relay ledger or audit event body. Emails are sent only through the Google account authorized to operate the original Apps Script.

## Release acceptance checklist
- [ ] Full existing Apps Script backed up and its live \`doPost\` reviewed.
- [ ] Relay added, Script Property verified, web app deployment updated without changing \`onFormSubmit\`.
- [ ] \`/admin-notification-outbox\` reports healthy connected relay, sending still disabled.
- [ ] MailApp authorization and test send to a controlled NGO email confirmed in the sending account.
- [ ] Owner consciously activates both gates; first genuine eligible feedback email accepted, recorded exactly once.
- [ ] Remaining queue drains at the approved capped rate, with failures reviewed and 54 historical originals preserved.
- [ ] Only then evaluate automatic expiry notices, consented WhatsApp/SMS and gateway payment webhooks.

**Never state 'email automation fully functional' until these externally authorized steps and an actual send have been verified.**
