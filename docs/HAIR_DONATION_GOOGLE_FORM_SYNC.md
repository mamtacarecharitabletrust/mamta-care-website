# Mamta Care — Google Form-first Hair Donation Integration

This document records the **approved** registration flow. It supersedes the direct-to-Donor-Desk prototype.

## Approved route

`Donate Hair` on Mamta Care's Vercel website → `/hair-registration` (haircut/head shave, donor information, 2 private photos) → trusted website Cloudflare Worker → existing Google Form response + its linked `Form Responses 1` Sheet → existing Apps Script creates official ID in **column M** and existing email automation sends donor confirmation → existing Donor Desk importer reads the official Sheet record and attaches the two R2 photos to **that same official ID** → Admin review and staff assignment.

## Authoritative data

Production response spreadsheet: **HAIR DONATION-(FREE ENROLL) (Responses)**, tab **Form Responses 1**. The header is:
A Timestamp; B Name; C Phone; D Gender; E Length; F City; G Hair Type; H Guidance; I Readiness; J Referral; K Consent; L Email; M Registration ID; N Verification Status; O Certificate URL; P Registration Email Status; Q Certificate Email Status; R Hard Copy; S extra marker.

Original Google Form and Apps Script email/certificate triggers are **not** replaced. A website reference is NOT an official registration ID.

## Non-negotiable safeguards

- Google Form is authoritative for submissions; Google Sheet is the source imported into Donor Desk.
- Google Apps Script `FormResponse.submit()` **does not fire installable submission triggers**. The trusted bridge must safely invoke the existing `onFormSubmit({range:sheet.getRange(row,1)})` once the exact row is known; existing scheduled email automation remains intact.
- Programmatic Form response and its Sheet row must be joined deterministically. Use a submission UUID, a dedicated bridge ledger, timestamp/full-field checks, and a private Sheet marker. **Never match by name or telephone alone**. An ambiguous match is held for Admin review, not guessed.
- Upload only two images, front and back, JPEG/PNG/WebP <= 4 MiB each; private R2 with user consent.
- Worker must be Turnstile-protected, rate-limited and idempotent. Secrets in Workers or Apps Script Properties only, never front-end.
- A retry must never create duplicate Form responses, ID, email, Donor Desk donor or photo pair.
- Donor Desk staff see only assigned donors; Admin can review unassigned donors. No unauthenticated image URLs.

## Current implementation gap

The older `mamta-website-hair-registration` Worker writes directly to production D1 donors. This does **not** meet the approved workflow and must not be used for real donor intake.
The preview branch routes Donate Hair to `/hair-registration`, but it still calls the old Worker. **Do not merge preview into production until replaced and fully verified.**
The Donor Desk importer currently requires Admin preview/commit; automatic ingestion and front/back viewer remain to be implemented or confirmed.
A prior social-registration Apps Script bridge exists; it should not be overwritten. The website bridge needs a separate action routed through the existing `doPost` entry point.

## Safe release criteria

First test with fictional donors in separate TEST Forms/Sheets/D1/R2. Then verify exactly one real Form response and linked row; official M registration ID; one existing confirmation email; photos privately linked; one Donor Desk record; no duplicate on retry; safe recoveries after interrupted submissions; privacy permissions. No edits to current donor records or existing Google Form/certificate/email triggers while building.
