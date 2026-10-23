# Website registration: existing Apps Script compatibility review

**Status: documentation only; not deployed or connected.**

The user's actual MAMTA `SocialRegistrationBridge.gs` already contains a single `doPost(e)` dispatcher:
- `desk_verify` and `desk_snapshot` call `mcDeskBridgePost_(payload)`.
- All other requests call `mcSocialBridgePost_(e)`.
- `mcSocialBridgePost_` only accepts `pending` and `approve`.
- `pending` appends an A:S row to `Form Responses 1` with a pending marker and no ID.
- `approve` explicitly calls `onFormSubmit({range: sheet.getRange(row,1)})` (outside ScriptLock), verifies Column M, then sets Column N to `SOCIAL APPROVED`.
- `mcDeskPeriodicPush_` and `mcDeskOnVerificationEdited_` handle separate sheet-to-desk status synchronization.

## Required website behavior (NOT IMPLEMENTED)
Website submission should reach the original Google Form with **basic data only**, then reuse ID and existing registration email logic. Private front/back photos are stored by Cloudflare R2 and visible to the Administrator and assigned team within existing Donor Desk. No Administrator approval is required to create a valid new enquiry.

Do **not** call existing `pending` action for website registrations: it only appends a Sheet row; it does not submit a native Google Form response.

A proposed dispatcher adjustment **after TEST approval only** is:

```javascript
if (payload && (payload.action === 'desk_verify' || payload.action === 'desk_snapshot')) {
  return mcDeskBridgePost_(payload);
}
if (payload && payload.action === 'website_register_form') {
  return mcWebFormBridge_(e); // authentication happens INSIDE the bridge
}
return mcSocialBridgePost_(e);
```

This is **not** a second `doPost`. Never deploy this before reviewing `Code.gs`, `REGEMAIL.gs`, the actual Google Form choices/types, the native FormApp row matching, and the TEST failure/retry logic.

### Guardrails
- No change to existing production `MAMTA` Apps Script or deployed web app.
- No change to Google Form or current A:S spreadsheet columns.
- Google Apps Script's programmatic FormApp submission does not invoke normal form-submit installable triggers. Existing ID generator must be called explicitly after unambiguous row identification.
- A successful Form submission followed by timeout is an *uncertain outcome*: do not retry blindly and create duplicate Google Form responses or emails.
- Preserve the scheduled email function's SENT guards; never call an email function during public browser submission.
- Keep shared secrets in private server settings only, not in React, HTML, or GitHub.
- Before connecting to production, test with fictional donors against an isolated TEST copy of Form, Sheet, Apps Script, D1 and R2.

## Immediate verification blocker
Read the actual `REGEMAIL.gs` and `Code.gs` functions to learn the exact eligible statuses and SENT guard. The current website bridge is only a review candidate.
