# Mamta Care website registration — isolated bridge QA
**Date:** 2026-10-19
**State:** Static/simulated checks only. NOT an end-to-end deployment.

The review-only `WebsiteOriginalFormBridge.REVIEW.gs` was exercised in an isolated JavaScript mock with fictional values. The mock provided stand-in `FormApp`, `SpreadsheetApp`, `LockService`, Script Properties and a simplified generator following the user's provided `onFormSubmit(e)` ID algorithm.

| Mock test | Result |
|---|---|
| First fictional website registration writes one Google Form response and generates an ID | PASS |
| Reuse same donor UUID: does not submit the Form twice | PASS |
| Separate fictional donor: generates the next daily sequence | PASS |
| Incorrect bridge secret: rejected before Form submission | PASS |
| Consent other than exact `STRONGLY AGREE`: rejected | PASS |
| Unsupported length `17 inches`: rejected | PASS |
| `BALD(FULL LENGTH)` preserved for complete head shave | PASS |
| Simulated ambiguous failure after Form submission: no blind repeat | PASS |

**8/8 mock tests passed.** Neither Google Forms nor the connected Google Sheet, Apps Script, production D1/R2, R2 donor photos or the production Worker were accessed for these mock submissions.

## Preconditions before any production registration
1. Create or select an **isolated copied Google Form** linked to a **TEST spreadsheet**. Do NOT connect to the original production `Form Responses 1`.
2. Inspect actual Form question item types, choice spellings and order with a read-only diagnostic in TEST. Simulated Form items can differ from real items.
3. Deploy only a **TEST Apps Script bridge** and `MC_WEB_FORM_ID`/secret. Review the single existing `doPost` dispatcher; do not create a second.
4. Run fictional TEST registrations to verify the `FormApp.submit()` response row timestamp/answer correlation, ID format and that normal Form triggers do NOT fire automatically.
5. Confirm no duplicates on concurrent submissions, timeouts, and reconciliation.
6. Implement the **separate TEST Cloudflare Worker / TEST D1 / TEST R2** pipeline and authenticated donor/staff photo access. This is not yet wired to the public React preview.
7. Prove that the existing registration email job sends once, and Column P becomes `SENT`. A send followed by failure to mark `SENT` may still cause a duplicate; handle it before production.
8. Validate consent, rate limits, photo content types, size, storage retention/deletion and per-team access.
9. Only after explicit approval merge PR and switch the website's Donate Your Hair button from the original Google Form.

## Important
Mock success does **not** mean that real donor registration, emails or Cloudflare photo storage work yet. The existing production website, Form and Donor Desk remain untouched.
