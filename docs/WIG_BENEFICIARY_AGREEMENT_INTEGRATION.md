# Wig beneficiary agreement: staged implementation

This module is not connected to production. It implements the approved state transitions and message templates without reusing staff/volunteer agreement records.

Integration requirements before release:
- Server loads approved beneficiary from the authoritative database; never trusts browser-supplied approval, amounts, or verification booleans.
- Store immutable agreement snapshot, PDF digest, acceptance evidence, and unique email outbox rows. Generate PDF with official logo and registration number. Validate single-use expiring email challenge on server. Record acceptance and enqueue the payment email atomically; provider status is separate from actual delivery. Use stable message IDs, no blind retries of uncertain sends.
- Add verified Apps Script email relay actions for patient agreement and payment notices. Test with fictional recipients in a controlled environment. Do not substitute staff/volunteer templates.
- Configure the Trust-owned verified UPI destination and exact amount; do not assume ownership of the existing public QR. Payment launch is not evidence of settlement.
- Integrate admin dashboard counts and one next action, and verify patient preview access controls. Run signed-in browser tests and rollback plan before live activation.

Run: node --test tests/wig-beneficiary-agreement.test.mjs
