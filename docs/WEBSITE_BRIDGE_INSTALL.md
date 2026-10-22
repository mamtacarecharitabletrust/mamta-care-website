# Mamta Care website Google Form bridge — installation checklist

This is **not deployed**. It must first pass preflight on a copied TEST Form and TEST spreadsheet.

## Existing Apps Script — no replacement of original generators

Add these two files to the SAME bound Apps Script project only after backing up the project:
- `apps-script/MamtaWebsiteGoogleFormBridge.gs`
- `apps-script/MamtaWebsiteBridgePreflight.gs`

There must be ONE `doPost(e)` handler across the Apps Script project. **Do not paste another top-level doPost.**

Add the following branch inside the *existing* doPost handler, preserving the existing social and donor-desk actions:

```javascript
if (payload && (
  payload.action === 'website_submit' ||
  payload.action === 'website_status'
)) {
  return mcWebsiteBridgePost_(payload);
}
```

Here `payload` must already have been parsed from `e.postData.contents` by the existing handler. If its local variable is named differently, use that actual name.

Configure a unique Script Property `WEBSITE_FORM_BRIDGE_SECRET` (48+ random characters). Keep it server-side and pair it with a Cloudflare Worker secret; never embed in React or a URL.

Before enabling website submissions:
1. Run `mcWebsitePreflightReadOnly_()`. It must report `ready: true`.
2. Confirm the Form is linked to the intended `HAIR DONATION-(FREE ENROLL) (Responses)` spreadsheet and that the existing `onFormSubmit(e)` and email functions are retained.
3. Confirm that `FormResponse.submit()` **does not fire the original form-submit triggers**; verify the explicit generator invocation on a TEST copy.
4. Verify one TEST donor produces exactly one Form response/Sheet row, one official registration ID, and one expected email. Then test retry and interrupted-submit reconciliation.
5. Modify the website Worker so it no longer directly inserts into production Donor Desk. It must call the authenticated bridge and retain private photo UUID-to-registration-ID mapping.
6. Implement admin-authenticated dual photo viewing and import matching in Donor Desk before public release.

**Current caution:** The bridge as committed is not yet preflighted against the actual live Form question types, and the current Worker bypasses Google Form. No production activation is authorized by this file.
