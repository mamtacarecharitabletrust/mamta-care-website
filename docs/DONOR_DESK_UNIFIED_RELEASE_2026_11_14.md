# Mamta Care Unified Donor Desk — consolidated release plan

14 November 2026. The previous baseline is the 159-donor, 31-bin production Worker. The release is additive, preserves existing staff sessions and the official logo, and does not rewrite historic records.

## Included in the consolidated application

1. **Private admin hub:** a mobile-first entrance at `/admin-ops` with direct working module links to donor management, photo review, courier receiving, staff hand collection, operations, Certificate Print Studio and stickers, salon donor intake and onboarding, hospital partner cases, volunteer registration and IDs, courier-certificate synchronization and wig-maker portal.
2. **Accurate D1-only dashboard:** active vs all-time donor counts, bin exclusions, active pending, photo-review backlog, hair inventory, staff allocation summaries, inactive review and undelivered notification queue. Public website lifetime figures remain sourced from their historical Google Sheet until the legacy offsets and real registration IDs are reconciled.
3. **Photo-review reconciliation:** accepted reviews are presented in an admin queue. Admin can link a submission only after the official Google Sheets registration ID has been imported and the donor identity has been independently verified. This operation is idempotent and audited, changes no existing donor registration number and does not prematurely issue a certificate.
4. **Hair stock and movements:** entering source, donor link, hair form, ponytail/braid quantity, length, collection mode, custodian and location; full-lot and partial-lot stock movement with transaction-backed conservation and immutable audit. Receipt-to-ledger backlog identifies items received by courier or hand but whose physical hair quantity has not been entered. It does not fabricate a quantity.
5. **Barcode camera and photo scanning:** supported browsers can read AWB barcode from camera or image and compare it to the authorized courier registry. The existing Received Parcels flow remains the only place that confirms a physical receipt. Manual AWB fallback and optional beep are included. Feature detection is required because not all Android/iOS devices expose BarcodeDetector.
6. **Follow-up:** existing administrator-only Cancel/Reopen, Bin/Restore, 30-day inactivity review with verified/received/courier and completed exclusions. Automatic expiry and external emails stay disabled until donor notifications and re-registration links are verified.
7. **Communication drafts:** manual WhatsApp, SMS and email composition requiring admin attestation of channel-specific donor consent, official ID, and a shared 50-message-draft quota per IST day for WhatsApp/SMS. Drafts are NOT sent by the Worker and opened mail/WhatsApp apps are not delivery receipts. Certificate feedback templates require Completed + genuine certificate.
8. **Existing partner modules:** old session guards, volunteer permissions, wigs, salons, hospitals, print studio, legacy QR/certificates, PWA installation path and Sheet sync are preserved unchanged. Shortcuts do not equal migration to new shared SSO.

## Exact cross-system blockers not disguised as completion

- **Official Google Sheets approved review:** 16 submissions are in REVIEW_REQUIRED state, including six already accepted. None has an official registration ID in Cloudflare. No automatic official ID can be created without an authorized working Google Form / Apps Script bridge and deterministic per-person identity mapping. This release adds a matching queue only.
- **Website public counters:** the historical Sheet-derived total and D1 active count are different populations; do not silently replace one with the other.
- **Automatic 30-day expiry/email:** no verified donor-email sender binding or tested retry/re-registration system; records must not expire without notifications.
- **Automated WhatsApp/SMS:** provider account, opt-in, verified templates, billing and delivery webhooks are not connected. Manual drafts with daily limit are safe.
- **Payment review:** UPI screenshot or QR payment isn't a verified payment. Partner and hard-copy workshops need a signed payment gateway webhook to mark Paid.
- **Cross-platform one-login:** Vercel Control Center, Cloudflare staff, hospital/salon and volunteer accounts require a tested OpenID-compatible identity provider and role mapping before sharing login sessions.
- **Historic wig/certificate/QR/Print Studio workflows:** existing modules are linked rather than rewritten, because live certificate issuance and donor emails must not be duplicated or overwritten without end-to-end tests.

## Deployment criteria

- Existing 159 donor rows and 31 bin rows remain unchanged during schema migrations.
- New migration creates only three new tables and two indexes, never alters existing certificates/photos.
- New addon is appended to the complete existing Worker; /admin-ops is intercepted only for authenticated admin; other routes fall through to previous handler.
- No new 2-minute worker sync jobs are added; previous scheduled trigger remains intact.
- Full tests, Vite build, Cloudflare staging bundle compile must succeed before production script-content upload.
- Release verification: production version, 21 existing Worker bindings, existing cron trigger, original photo bucket, D1 table record counts, unauthorized admin route protection and UI navigation.

## Follow-up roadmap

Remaining vendor-dependent and high-risk migrations are retained in `docs/DONOR_DESK_MASTER_IMPLEMENTATION_REGISTER_2026_11_14.md` with per-feature acceptance criteria. A single code deployment cannot promise functioning provider-side email, Google Apps Script, payment confirmation, SMS, or federated SSO if those external systems are not connected.
