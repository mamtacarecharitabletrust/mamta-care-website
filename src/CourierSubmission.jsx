import React, { useMemo, useState } from "react";
import logo from "./assets/mamta-care-logo.jpeg";
import "./styles/courier-submission.css";

const EXISTING_COURIER_FORM = "https://script.google.com/macros/s/AKfycbzEYc0GYB25mTIp2l1nHEOa8MRx0DX5sxN-TWIOntXBWVikvkz5ZK1vyiK1ABj1FEIN/exec";
const COURIERS = [
  { id: "speedpost", name: "India Post / Speed Post" },
  { id: "dtdc", name: "DTDC" },
  { id: "bluedart", name: "Blue Dart" },
  { id: "professional", name: "Professional Couriers" },
  { id: "other", name: "Other courier (manual review)" }
];
// Remains off unless the server-side courier bridge and old workflow have
// passed an end-to-end test. Never trust this flag as server authorization.
const ENABLED = import.meta.env.VITE_COURIER_SUBMISSION_ENABLED === "true";
const clean = value => value.trim().toUpperCase().replace(/\s+/g, "");
const regPattern = /^20\d{2}-\d{6}\/M\/2022$/;
const trackingPattern = /^[A-Z0-9-]{5,40}$/;

export default function CourierSubmission() {
  const [form, setForm] = useState({
    registration_id: "", courier_partner: "", other_courier: "",
    tracking_number: "", confirm: false
  });
  const [waiting, setWaiting] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [submissionId] = useState(() =>
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID() : ""
  );
  const set = (key, value) => setForm(previous => ({ ...previous, [key]: value }));
  const registrationId = useMemo(() => clean(form.registration_id), [form.registration_id]);
  const awb = useMemo(() => clean(form.tracking_number), [form.tracking_number]);
  const courierName = form.courier_partner === "other" ? form.other_courier.trim() : form.courier_partner;

  async function submit(event) {
    event.preventDefault();
    setError("");
    if (!ENABLED) {
      setError("Website courier submissions are not active yet. Please use the existing courier submission form below.");
      return;
    }
    if (!regPattern.test(registrationId)) return setError("Enter your full Mamta Care registration ID exactly as shown on your confirmation.");
    if (!courierName || !form.courier_partner) return setError("Choose a courier company.");
    if (!trackingPattern.test(awb)) return setError("Enter a valid courier tracking or AWB number (5–40 letters, numbers or hyphens).");
    if (!form.confirm) return setError("Confirm that the courier details are accurate before submitting.");
    if (waiting || result) return;
    setWaiting(true);
    try {
      const response = await fetch("/api/courier-submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          submission_uuid: submissionId,
          registration_id: registrationId,
          courier_partner: courierName,
          tracking_number: awb,
          confirmation: true
        })
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || data?.ok !== true) {
        throw new Error(data?.error || "Courier submission could not be confirmed. Please contact Mamta Care before attempting again.");
      }
      setResult(data);
    } catch (e) {
      setError(e.message || "Unable to confirm submission. Please contact Mamta Care before submitting again.");
    } finally { setWaiting(false); }
  }

  return (
    <main className="mcc-page">
      <div className="mcc-wrap">
        <header className="mcc-heading">
          <img src={logo} alt="Mamta Care Charitable Trust" />
          <div>
            <div className="mcc-eyebrow">MAMTA CARE CHARITABLE TRUST</div>
            <h1>Submit Courier Details</h1>
            <p>Already sent your hair donation parcel? Share your consignment number so our team can follow its journey.</p>
          </div>
        </header>
        <div className="mcc-columns">
          <section className="mcc-card">
            <div className="mcc-pill"><span>01</span> Courier information</div>
            {result ? (
              <div className="mcc-confirm" role="status">
                <h2>Courier details received</h2>
                <p>Thank you. Your parcel details have been recorded for Mamta Care's verification and tracking process.</p>
                <p><strong>Registration ID:</strong> {registrationId}</p>
                <p><strong>Tracking number:</strong> {awb}</p>
                <p className="mcc-small">Courier delivery or hair receipt has not yet been verified. Please keep your original courier receipt.</p>
              </div>
            ) : (
              <form onSubmit={submit} noValidate>
                <label htmlFor="mcc-registration">Mamta Care Registration ID <span>*</span></label>
                <input id="mcc-registration" autoComplete="off" spellCheck="false" value={form.registration_id} maxLength={35}
                  onChange={e => set("registration_id", e.target.value)} placeholder="2026-231005/M/2022" required />
                <p className="mcc-help">Use the ID in your Mamta Care registration email or certificate.</p>

                <label htmlFor="mcc-partner">Courier company <span>*</span></label>
                <select id="mcc-partner" value={form.courier_partner} required onChange={e => set("courier_partner", e.target.value)}>
                  <option value="">Select the courier company</option>
                  {COURIERS.map(c => <option value={c.id} key={c.id}>{c.name}</option>)}
                </select>
                {form.courier_partner === "other" && <>
                  <label htmlFor="mcc-other">Courier company name <span>*</span></label>
                  <input id="mcc-other" maxLength={80} value={form.other_courier}
                    onChange={e => set("other_courier", e.target.value)} placeholder="Name as printed on your receipt" required />
                  <p className="mcc-help">Other couriers may require a manual tracking review.</p>
                </>}

                <label htmlFor="mcc-awb">Consignment / AWB / Tracking Number <span>*</span></label>
                <input id="mcc-awb" autoComplete="off" spellCheck="false" value={form.tracking_number} maxLength={40}
                  onChange={e => set("tracking_number", e.target.value)} placeholder="Enter the number on your courier receipt" required />
                <p className="mcc-help">Make sure every letter and digit matches your courier receipt.</p>
                <label className="mcc-consent" htmlFor="mcc-confirm">
                  <input id="mcc-confirm" type="checkbox" checked={form.confirm}
                    onChange={e => set("confirm", e.target.checked)} />
                  <span>I confirm that these details are accurate and understand that shipment verification is performed separately.</span>
                </label>
                {error && <p className="mcc-error" role="alert">{error}</p>}
                <button className="mcc-submit" type="submit" disabled={!ENABLED || waiting}>
                  {waiting ? "Submitting…" : ENABLED ? "Submit Courier Details" : "Website submission coming soon"}
                </button>
                {!ENABLED && <p className="mcc-help mcc-preview">This website form is being connected to the existing courier system. The current courier submission form remains available below.</p>}
              </form>
            )}
          </section>
          <aside className="mcc-card mcc-aside">
            <div className="mcc-pill"><span>02</span> What happens next?</div>
            <ol>
              <li><strong>Submit your consignment details.</strong><p>Keep a photograph or copy of your booking receipt.</p></li>
              <li><strong>Courier verification.</strong><p>Tracking information is checked through the existing Mamta Care process. Submission is not proof of delivery.</p></li>
              <li><strong>Hair donation processing.</strong><p>Receipt and processing statuses are updated only after confirmation and Administrator approval.</p></li>
            </ol>
            <div className="mcc-note"><strong>Current courier submission</strong><p>Until the integrated page is activated, use the existing official Apps Script link.</p>
              <a href={EXISTING_COURIER_FORM} target="_blank" rel="noopener noreferrer">Open the existing Courier Details form ↗</a>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}
