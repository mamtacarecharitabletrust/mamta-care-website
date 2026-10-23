import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import logo from "./assets/mamta-care-logo.jpeg";
import "./styles/courier-submission.css";

const COURIERS = [
  { id: "speedpost", name: "India Post / Speed Post" },
  { id: "dtdc", name: "DTDC" },
  { id: "bluedart", name: "Blue Dart" },
  { id: "professional", name: "Professional Couriers" }
];

// Off until the authenticated Apps Script bridge is connected and verified.
// This is presentation only: server-side access controls must independently deny submissions.
const ENABLED = import.meta.env.VITE_COURIER_SUBMISSION_ENABLED === "true";
const regPattern = /^[A-Z0-9][A-Z0-9/_.-]{2,79}$/;
const trackingPattern = /^[A-Z0-9][A-Z0-9-]{4,39}$/;
const norm = value => String(value || "").trim().toUpperCase();

function StepHeader({ number, title }) {
  return <div className="mcc-pill"><span>{number}</span>{title}</div>;
}

export default function CourierSubmission() {
  const [stage, setStage] = useState("identity");
  const [identity, setIdentity] = useState({ registration_id: "", email: "", code: "" });
  const [shipment, setShipment] = useState({ carrier: "", tracking: "", confirm: false });
  const [token, setToken] = useState("");
  const [record, setRecord] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const captchaNode = useRef(null);
  const captchaId = useRef(null);
  const registeredId = norm(identity.registration_id);

  useEffect(() => {
    if (!ENABLED) return;
    const script = document.createElement("script");
    script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    script.async = true;
    script.defer = true;
    document.head.appendChild(script);
    return () => { if (script.parentNode) script.parentNode.removeChild(script); };
  }, []);

  useEffect(() => {
    if (!ENABLED || stage !== "identity") return;
    let closed = false;
    let frame;
    function mount() {
      if (closed) return;
      if (window.turnstile && captchaNode.current) {
        if (captchaId.current === null) {
          captchaId.current = window.turnstile.render(captchaNode.current, {
            sitekey: "0x4AAAAAAFg4La53uj9Wuu94",
            theme: "light"
          });
        }
      } else frame = requestAnimationFrame(mount);
    }
    mount();
    return () => {
      closed = true;
      cancelAnimationFrame(frame);
      if (captchaId.current !== null) {
        try { window.turnstile?.remove(captchaId.current); } catch {}
        captchaId.current = null;
      }
    };
  }, [stage]);

  const setI = (key, value) => { setIdentity(old => ({ ...old, [key]: value })); setError(""); };
  const setS = (key, value) => { setShipment(old => ({ ...old, [key]: value })); setError(""); };

  async function api(action, fields) {
    const res = await fetch("/api/courier/" + action, {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(fields)
    });
    const response = await res.json().catch(() => null);
    if (!res.ok || !response?.ok) {
      throw new Error(response?.error || "The secure courier service is unavailable. Please contact Mamta Care.");
    }
    return response.data || {};
  }

  async function requestCode(e) {
    e.preventDefault();
    if (!ENABLED || busy) return;
    if (!regPattern.test(registeredId)) return setError("Enter the Registration ID exactly as shown in your email.");
    const email = identity.email.trim().toLowerCase();
    if (!/^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/.test(email)) return setError("Enter your registered email address.");
    const challenge = window.turnstile?.getResponse?.(captchaId.current);
    if (!challenge) return setError("Complete the Cloudflare security verification first.");
    setBusy(true);
    try {
      const reply = await api("request-code", {
        registration_id: registeredId, email, turnstile_token: challenge
      });
      setMessage(reply.message || "If your details match our records, a code has been emailed to you.");
      setStage("verify");
    } catch (err) {
      setError(err.message);
      try { window.turnstile?.reset(captchaId.current); } catch {}
    } finally { setBusy(false); }
  }

  async function verifyCode(e) {
    e.preventDefault();
    if (!ENABLED || busy) return;
    const code = norm(identity.code);
    if (!/^\d{4}$/.test(code)) return setError("Enter the four-digit code sent to your email.");
    setBusy(true);
    try {
      const result = await api("verify-code", { registration_id: registeredId, code });
      if (!result.token || result.registrationId !== registeredId) throw new Error("Verification was not completed.");
      setToken(result.token);
      const status = await api("status", { token: result.token });
      setRecord(status);
      setMessage("");
      setStage(status.found ? "existing" : "shipment");
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }

  async function submitCourier(e) {
    e.preventDefault();
    if (!ENABLED || busy) return;
    const carrier = shipment.carrier;
    const tracking = norm(shipment.tracking);
    if (!COURIERS.some(c => c.id === carrier)) return setError("Choose a supported courier company.");
    if (!trackingPattern.test(tracking)) return setError("Enter the tracking/AWB number shown on your receipt.");
    if (!shipment.confirm) return setError("Confirm that the courier details match your booking receipt.");
    setBusy(true);
    try {
      const result = await api("submit", { token, carrier, tracking });
      const latest = await api("status", { token });
      setRecord(latest);
      setMessage(result.message || "Courier details received.");
      setStage("existing");
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }

  return <main className="mcc-page">
    <div className="mcc-wrap">
      <header className="mcc-heading">
        <img src={logo} alt="Mamta Care Charitable Trust" />
        <div>
          <div className="mcc-eyebrow">MAMTA CARE CHARITABLE TRUST</div>
          <h1>Submit Courier Details</h1>
          <p>Already dispatched your hair donation? Securely submit your consignment details and follow the verification process.</p>
        </div>
      </header>
      <div className="mcc-columns">
        <section className="mcc-card">
          {!ENABLED && <div className="mcc-error" role="status">
            <strong>Courier website preview only.</strong> This form is being connected to the existing secure Apps Script system. No courier submissions are accepted on this page yet.
          </div>}
          {stage === "identity" && <>
            <StepHeader number="01" title="Verify your registration" />
            <p className="mcc-help">For your privacy, we first verify the email address registered with Mamta Care.</p>
            <form onSubmit={requestCode}>
              <label htmlFor="mcc-id">Registration ID <span>*</span></label>
              <input id="mcc-id" autoComplete="off" spellCheck="false" maxLength={80}
                placeholder="Enter the ID shown in your email" value={identity.registration_id}
                onChange={e => setI("registration_id", e.target.value)} required />
              <label htmlFor="mcc-email">Registered email address <span>*</span></label>
              <input id="mcc-email" type="email" autoComplete="email" maxLength={254}
                placeholder="Email used during hair registration" value={identity.email}
                onChange={e => setI("email", e.target.value)} required />
              {ENABLED && <div className="mcc-security" ref={captchaNode} />}
              {error && <p className="mcc-error" role="alert">{error}</p>}
              <button className="mcc-submit" type="submit" disabled={!ENABLED || busy}>
                {busy ? "Sending…" : "Email my verification code"}
              </button>
              <p className="mcc-help">The code is sent only to the registered address, expires after 10 minutes, and does not confirm shipment delivery.</p>
            </form>
          </>}
          {stage === "verify" && <>
            <StepHeader number="02" title="Enter email verification code" />
            <p className="mcc-help" role="status">{message}</p>
            <form onSubmit={verifyCode}>
              <label htmlFor="mcc-otp">Four-digit verification code <span>*</span></label>
              <input id="mcc-otp" autoComplete="one-time-code" inputMode="numeric" pattern="[0-9]{4}" spellCheck="false" maxLength={4}
                placeholder="Enter 4 digits" value={identity.code}
                onChange={e => setI("code", e.target.value.replace(/\D/g, "").slice(0, 4))} required />
              {error && <p className="mcc-error" role="alert">{error}</p>}
              <button className="mcc-submit" disabled={!ENABLED || busy} type="submit">
                {busy ? "Verifying…" : "Verify and continue"}
              </button>
              <button className="mcc-secondary" type="button" onClick={() => { setStage("identity"); setError(""); }}>Back to email verification</button>
            </form>
          </>}
          {stage === "shipment" && <>
            <StepHeader number="03" title="Your courier shipment" />
            <p className="mcc-help">Email verified for Registration ID: <strong>{registeredId}</strong></p>
            <form onSubmit={submitCourier}>
              <label htmlFor="mcc-partner">Courier company <span>*</span></label>
              <select id="mcc-partner" value={shipment.carrier} onChange={e => setS("carrier", e.target.value)} required>
                <option value="">Select courier company</option>
                {COURIERS.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <label htmlFor="mcc-tracking">Consignment / AWB / Tracking Number <span>*</span></label>
              <input id="mcc-tracking" spellCheck="false" maxLength={40}
                placeholder="As printed on your courier receipt" value={shipment.tracking}
                onChange={e => setS("tracking", e.target.value)} required />
              <label className="mcc-consent" htmlFor="mcc-confirm">
                <input id="mcc-confirm" type="checkbox" checked={shipment.confirm}
                  onChange={e => setS("confirm", e.target.checked)} />
                <span>I confirm that my courier details are correct. I understand that shipment verification, receipt, and processing are separate.</span>
              </label>
              {error && <p className="mcc-error" role="alert">{error}</p>}
              <button className="mcc-submit" type="submit" disabled={!ENABLED || busy}>
                {busy ? "Saving…" : "Submit Courier Details"}
              </button>
            </form>
          </>}
          {stage === "existing" && <>
            <StepHeader number="✓" title="Courier submission status" />
            {message && <p role="status" className="mcc-confirm">{message}</p>}
            <div className="mcc-confirm">
              <p><strong>Registration ID:</strong> {registeredId}</p>
              <p><strong>Courier:</strong> {record?.carrier || "Pending"}</p>
              <p><strong>Tracking number:</strong> {record?.tracking || "Pending"}</p>
              <p><strong>Verification:</strong> {record?.verification || "Pending"}</p>
              <p><strong>Courier status:</strong> {record?.status || "Awaiting check"}</p>
              <p><strong>Administrator review:</strong> {record?.approval || "Pending"}</p>
              <p className="mcc-small">Status reflects the existing courier system. Submission does not guarantee that your parcel has been received or processed.</p>
            </div>
          </>}
        </section>
        <aside className="mcc-card mcc-aside">
          <StepHeader number="?" title="How it works" />
          <ol>
            <li><strong>Verify your registered email.</strong><p>We send a one-time code to the email associated with your Mamta Care registration ID.</p></li>
            <li><strong>Submit your courier tracking number.</strong><p>Only after successful verification can your shipment be linked to your existing registration.</p></li>
            <li><strong>Follow secure processing updates.</strong><p>The courier tracker and certificate database stay connected to the existing automated workflow.</p></li>
          </ol>
          <div className="mcc-note">
            <strong>Need help?</strong>
            <p>Keep your courier receipt and contact Mamta Care if you entered incorrect shipment details. Please do not submit the same parcel under another registration ID.</p>
            <Link to="/contact">Contact Mamta Care →</Link>
          </div>
        </aside>
      </div>
    </div>
  </main>;
}
