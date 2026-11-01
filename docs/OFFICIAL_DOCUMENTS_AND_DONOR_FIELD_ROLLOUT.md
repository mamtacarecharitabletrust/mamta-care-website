# Mamta Care · Official Documents and Donor Desk Field Repair

## Public website staging

- The feature branch adds `/official-documents` and "Official Documents" to public navigation and footer.
- The page reads a public `documents` list from the existing Website Content Control `/api/public` endpoint, and displays only published PDF links matching `/documents/<UUID>.pdf`.
- Without approved documents, the page says no official copies are published; it **does not** advertise unverified registrations.
- Existing site, donor intake, donor tracking, wig services and Google integrations are untouched in this branch.

## Required next backend addition (not yet deployed)

Add a **separate** official-document draft and published register to the existing Website Content Control Worker. Admin access must use the existing verified session cookie, same-origin checks and administrator login. Store redacted PDF documents in existing R2 `MEDIA` binding, never in GitHub, with random object keys. Serve only published PDFs on a public `/documents/<UUID>.pdf` endpoint; the corresponding draft file-review URL must remain authenticated.

Controller fields:

| Field | Type |
|---|---|
| category | trust_registration / trust_deed / darpan / pan / tax_12ab / tax_80g / other |
| title | required, max 110 chars |
| issuer | required, max 110 chars |
| reference | optional, public or masked identifier |
| issuedOn | optional ISO date |
| note | optional, max 300 chars |
| file | PDF, max 5MB, verified magic bytes, privacy-reviewed |
| status | draft, published, removed |

Admin workflow: Upload redacted PDF → review in private portal → Save document metadata → Publish verified set → public page shows exact published set. Removed documents are immediately unavailable publicly after publishing. Keep audit history and delete unused storage objects safely after verifying they are not referenced by published documents. Only the administrator publishes.

**Legal wording:** Registration as a trust under the relevant state authority and registration on the Government of India's NGO Darpan portal are distinct. Do not claim direct central-government incorporation, approval, funding or endorsement from an NGO Darpan registration. Display each document's actual legal status and issuer as supported by uploaded records. NEVER publish a full PAN card, Aadhaar number, unmasked signatures, personal home addresses or private donor details.

## Donor Desk production findings · 2026-11-01

Production D1 `donors.hair_length` is populated for all 132 records. The source Google Sheet `HAIR DONATION-(FREE ENROLL) (Responses)`, tab `Form Responses 1`, column E is titled **LENGTH THAT YOU PREFER TO DONATE**. The existing Worker `COLUMN_MAP` includes `hair_length`, and `donorSelect` also selects it. **Do not import duplicates or overwrite donor rows.**

The Donor Desk `openDonor(id)` interface currently displays City/Readiness and Phone/Email, but not `hair_length`. The safe HTML change is to add (after escaping the stored value):

```js
const desiredLength = String(d.hair_length || '').trim();
const lengthLabel = desiredLength
  ? /BALD|HEAD\s*SHAVE/i.test(desiredLength)
    ? 'Complete Head Shave · Full Length'
    : desiredLength.replace(/INCHES/i, ' inches').replace(/(\d)\s*-\s*(\d)/, '$1–$2')
  : 'Not recorded';
const lengthHTML = '<p class="mc-donor-donation-length" style="border:1px solid #9cd9bd;padding:12px 14px;border-radius:12px;background:#eafaf1;color:#12412e"><b>HAIR DONATION SELECTION:</b> ' + escapeHtml(lengthLabel) + '</p>';
// Insert lengthHTML into the existing details panel immediately after
// the donor name, before private photos and contact details.
```

Render the same badge on donor list cards, preserving the exact raw field in the database. Keep the text "donor-selected" rather than "AI-measured".

## Team pending count

The existing `mcOverview` staff query returns per-member `allocated`, `cleared` and `completed`, but not `pending`. Add this to its current SQL query **without changing existing columns**:

```sql
SUM(CASE WHEN d.followup_status IN ('Pending','Not answered','Call again')
    THEN 1 ELSE 0 END) AS pending
```

Then extend `mcRefreshOverview` staff chip markup:

```js
+ ' · <strong style="color:#c62828">Pending: ' + Number(m.pending || 0) + '</strong>'
```

The pending metric must reflect follow-up statuses, **not simply allocated minus completed** (because Cleared also needs exclusion and alternative in-progress statuses count). Example: 36 allocated / 1 cleared / 6 completed implies **29 pending** only if no other care statuses exist.

## AI-assisted hair measurement

Photos alone without a physical calibration object cannot establish accurate inches. Provide a separate optional assessment widget with photos including a ruler/known-size marker, pose guidelines, camera angle and confidence flag. Preserve `donors.hair_length` as the donor's **selected** length, and store the estimate in a different field only with permission. Use manual tape-measure confirmation for the 14-inch usable-hair policy; excludes split ends, and assumes the hairstyle can safely be cut at the proposed point.

## Safe rollout checklist

- Keep current Donor Desk Worker and Website Control Worker unchanged until reviewing the exact deployed code and bindings.
- Verify all team roles and permissions, donated hair selection for 14–16, 18–20, 21–26, BALD, zero-value and historical rows.
- Verify redacted documents cannot be read publicly before publication or after removal.
- Test documents and hair-length badges on Android PWA and iPhone.
- Preview website, then deploy only after tests.
