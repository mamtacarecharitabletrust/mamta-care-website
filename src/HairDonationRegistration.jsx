import React, { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Link } from "react-router-dom";
import officialLogo from "./assets/mamta-care-logo.jpeg";




import "./styles/hair-registration.css";

const PHOTO_GUIDES = { haircut: "/registration-guides/haircut-approved.webp", head_shave: "/registration-guides/headshave.webp", front: "/registration-guides/front.webp", back: "/registration-guides/back.webp" };
const LENGTHS = ["14-16INCHES", "18-20INCHES", "21-26INCHES"];
const FILE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_PHOTO_BYTES = 4 * 1024 * 1024;

function GuidePhoto({ src, alt }) { const [missing, setMissing] = React.useState(false); return missing ? <div className="mchr-photo-unavailable">Corrected photograph will appear after image upload</div> : <img src={src} alt={alt} onError={() => setMissing(true)} />; }

function StepTitle({ number, title, help }) {
  return <header className="mchr-step-heading"><span>{number}</span><div><h2>{title}</h2><p>{help}</p></div></header>;
}

function FormField({ title, required = true, children }) {
  return <label className="mchr-field"><span>{title}{required ? " *" : ""}</span>{children}</label>;
}

export default function HairDonationRegistration() {
  useEffect(() => {
    const script=document.createElement("script");
    script.src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    script.async=true;script.defer=true;document.head.appendChild(script);
    return()=>{document.head.removeChild(script);};
  }, []);
  const [step, setStep] = useState(1);
  const securityRef = useRef(null);
  const widgetId = useRef(null);
  useEffect(() => {
    if (step !== 4) return;
    let disposed = false;
    let frame = 0;
    function mount() {
      if (disposed) return;
      if (window.turnstile && securityRef.current) {
        widgetId.current = window.turnstile.render(securityRef.current, {
          sitekey: "0x4AAAAAAFg4La53uj9Wuu94", theme: "light"
        });
      } else {
        frame = requestAnimationFrame(mount);
      }
    }
    mount();
    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      if (widgetId.current !== null) {
        try { window.turnstile?.remove(widgetId.current); } catch {}
        widgetId.current = null;
      }
    };
  }, [step]);
  const [method, setMethod] = useState("haircut");
  const [values, setValues] = useState({
    hair_length: LENGTHS[0], full_name: "", phone: "", email: "", gender: "", state: "", city: "",
    hair_type: "", guidance: "", readiness: "", referral_source: "",
    voluntary: false, private_photos: false, awareness: false,
  });
  const [files, setFiles] = useState({ front: null, back: null });
  const [error, setError] = useState("");
  const [finished, setFinished] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const attempted = useRef(false);
  const [uploadState, setUploadState] = useState("idle");
  const frontGallery = useRef(null), frontCamera = useRef(null);
  const backGallery = useRef(null), backCamera = useRef(null);
  const refs = useMemo(() => ({ front: { gallery: frontGallery, camera: frontCamera }, back: { gallery: backGallery, camera: backCamera } }), []);
  const set = (key, value) => { setValues(old => ({ ...old, [key]: value })); setError(""); };
  const handleFile = (which, file) => {
    if (!file) return;
    if (!FILE_TYPES.includes(file.type) || !file.size || file.size > MAX_PHOTO_BYTES) {
      setError("Choose a JPG, PNG or WebP image smaller than 4 MB."); return;
    }
    setFiles(old => ({ ...old, [which]: file })); setError("");
  };
  const validate = (current) => {
    if (current === 2) {
      if (!values.full_name.trim() || !/^\+?[\d\s-]{10,18}$/.test(values.phone.trim()) ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim()) ||
        !values.gender || !values.state.trim() || !values.city.trim() || !values.hair_type ||
        !values.guidance || !values.readiness || !values.referral_source) {
        return "Complete every required donor information field before continuing.";
      }
    }
    if (current === 3 && (!files.front || !files.back)) return "Select one front photograph and one back photograph.";
    if (current === 4 && (!values.voluntary || !values.private_photos)) return "Accept the voluntary donation declaration and private photo review consent.";
    return "";
  };
  const next = () => {
    const issue = validate(step);
    if (issue) { setError(issue); return; }
    setError(""); if (step < 4) { setStep(step + 1); window.scrollTo({ top: 0, behavior: "smooth" }); }
    else submitTest();
  };
  const submitTest = async () => {
    if (attempted.current || submitting) return;
    setSubmitting(true); setError(""); setUploadState("Submitting your registration securely");
    try {
      throw new Error("Website photo registration is not active. Use the official Google Form above; your photos have not been uploaded.");
      const token = window.turnstile?.getResponse?.(widgetId.current);
      if (!token) throw new Error("Complete the security check before submitting.");
      const body = new FormData();
      const fields = {
        ...values,
        hair_length: method === "head_shave" ? "BALD(FULL LENGTH)" : values.hair_length,
        method,
        voluntary: values.voluntary ? "yes" : "no",
        private_photos: values.private_photos ? "yes" : "no",
        awareness: values.awareness ? "yes" : "no",
        turnstile: token,
      };
      Object.entries(fields).forEach(([key,value]) => body.append(key,String(value)));
      body.append("front",files.front); body.append("back",files.back);
      attempted.current = true;
      // Do not send donor data into the old direct-to-D1 Worker.
      // Activation requires a verified Google Form bridge, same-ID photo pairing,
      // and the existing Apps Script email flow.
      throw new Error("Online registration is being connected to our official Google Form. Please use the existing Google Form link above for now.");
      // Submission transport will be enabled after the original Form bridge passes validation.
      // const res = await fetch(SAFE_BRIDGE_ENDPOINT, {method:"POST", body});

    } catch(ex) {
      setError(String(ex.message||"Registration failed. Contact Mamta Care if you have already submitted."));
    } finally { setSubmitting(false); }
  };
  const photoNames = { front: "Front photograph", back: "Back photograph" };

  return <div className="mchr">
    <div className="mchr-container">
      <div className="mchr-top"><img src={officialLogo} alt="Official Mamta Care Charitable Trust logo" /><div>
        <p className="mchr-overline">MAMTA CARE CHARITABLE TRUST</p>
        <h1>Donate Hair. Give Hope.</h1>
        <p>Secure hair donation registration · Designed for mobile and desktop</p>
      </div></div>
      <div className="mchr-preview-warning" role="status"><strong>Photo-enabled registration is not yet accepting submissions.</strong> The existing Google Form is still the official registration channel and continues its registration-ID and email process. <a href="https://forms.gle/VpKSKJoichRqyTvH9" target="_blank" rel="noreferrer">Open the official Google Form</a>. Photos selected on this preview page are not transmitted.</div>
      {finished ? <section className="mchr-panel mchr-success" aria-live="polite">
        <span className="mchr-success-icon">✓</span><h2>Registration received</h2>
        <p>Your reference number: <strong>{testResult?.registration_id}</strong>. Your two photographs were submitted for private Administrator review. The official registration ID and any confirmation emails will follow the Trust’s verification process.</p>
        <button type="button" className="mchr-primary" onClick={() => window.location.reload()}>Return to website</button>
      </section> : <>
        <nav aria-label="Registration preview steps" className="mchr-steps">
          {["Donation type", "Your details", "Two photos", "Consent"].map((label, index) =>
            <div key={label} className={step === index + 1 ? "current" : step > index + 1 ? "done" : ""}><b>{index + 1}</b><span>{label}</span></div>)}
        </nav>
        <AnimatePresence mode="wait">
          <motion.section className="mchr-panel" key={step} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: .23 }}>
            {step === 1 && <>
              <StepTitle number="01" title="Tell us about your hair donation" help="Choose how you would like to donate. Both options are entirely voluntary." />
              <div className="mchr-choices">
                <button type="button" className={"mchr-method " + (method === "haircut" ? "selected" : "")} aria-pressed={method === "haircut"} onClick={() => setMethod("haircut")}>
                  <div className="mchr-method-image"><GuidePhoto src={PHOTO_GUIDES.haircut} alt="Illustrative Indian woman smiling while a woman stylist cuts her tied braid" /><div className="mchr-falling-hair" aria-hidden="true"><i/><i/><i/><i/></div><span className="mchr-method-icon">✂</span></div>
                  <div className="mchr-method-body"><strong>Haircut Donation</strong><span>Minimum 14 usable inches, excluding split ends and uneven hair.</span></div>
                </button>
                <button type="button" className={"mchr-method " + (method === "head_shave" ? "selected" : "")} aria-pressed={method === "head_shave"} onClick={() => setMethod("head_shave")}>
                  <div className="mchr-method-image"><GuidePhoto src={PHOTO_GUIDES.head_shave} alt="Illustrative Indian woman receiving complete head shave with a razor guided by a woman barber" /><span className="mchr-razor" aria-hidden="true">⌁</span></div>
                  <div className="mchr-method-body"><strong>Complete Head Shave <small>Recommended</small></strong><span>A meaningful option when chosen freely. A woman barber may guide the process.</span></div>
                </button>
              </div>
              <p className="mchr-image-note">These are generated guidance illustrations, not photographs of actual Mamta Care donors. Animation is symbolic and the donation choice is voluntary.</p>
              {method === "haircut" ? <FormField title="Approximate usable hair length, excluding split ends (original Google Form choices)"><select value={values.hair_length} onChange={e => set("hair_length", e.target.value)}>{LENGTHS.map(x => <option key={x}>{x}</option>)}</select><small className="mchr-image-note">The original Google Form has 14–16, 18–20 and 21–26 inches; it does not currently offer 17 inches. We will not record an inaccurate range.</small></FormField> : <div className="mchr-note">Complete head shave selected. The existing Google Form records this as <strong>BALD(FULL LENGTH)</strong>.</div>}
            </>}
            {step === 2 && <>
              <StepTitle number="02" title="Your donation details" help="These are the basic fields from your existing Google Form." />
              <div className="mchr-form-grid">
                <FormField title="Full name"><input autoComplete="name" value={values.full_name} onChange={e => set("full_name", e.target.value)} placeholder="Full name" /></FormField>
                <FormField title="Contact number"><input type="tel" inputMode="tel" autoComplete="tel" value={values.phone} onChange={e => set("phone", e.target.value)} placeholder="10-digit mobile number" /></FormField>
                <FormField title="Email address"><input type="email" autoComplete="email" value={values.email} onChange={e => set("email", e.target.value)} placeholder="name@example.com" /></FormField>
                <FormField title="Gender"><select value={values.gender} onChange={e => set("gender", e.target.value)}><option value="">Select gender</option>{["FEMALE","MALE"].map(x => <option key={x}>{x}</option>)}</select></FormField>
                <FormField title="State"><input autoComplete="address-level1" value={values.state} onChange={e => set("state", e.target.value)} placeholder="e.g. Andhra Pradesh" /></FormField>
                <FormField title="City"><input autoComplete="address-level2" value={values.city} onChange={e => set("city", e.target.value)} placeholder="e.g. Guntur" /></FormField>
                <FormField title="Hair type"><select value={values.hair_type} onChange={e => set("hair_type", e.target.value)}><option value="">Select hair type</option>{["STRAIGHT","CURLY","WAVY","COILY","MIXED/COMBINATION"].map(x => <option key={x}>{x}</option>)}</select></FormField>
                <FormField title="Need guidance on cutting and packing?"><select value={values.guidance} onChange={e => set("guidance", e.target.value)}><option value="">Select</option><option value="YES">Yes, please guide me</option><option value="ALREADY AWARE">Already aware</option></select></FormField>
                <FormField title="Donation readiness"><select value={values.readiness} onChange={e => set("readiness", e.target.value)}><option value="">Select</option><option value="planning to donate">Planning to donate</option><option value="Already cut and ready to donate">Already cut and ready to donate</option><option value="Need guidance before cutting">Need guidance before cutting</option></select></FormField>
                <FormField title="How did you hear about Mamta Care?"><select value={values.referral_source} onChange={e => set("referral_source", e.target.value)}><option value="">Select</option>{["INSTAGRAM","FACEBOOK","WHATSAPP","FRIENDS/FAMILY"].map(x => <option key={x}>{x}</option>)}</select></FormField>
              </div>
            </>}
            {step === 3 && <>
              <StepTitle number="03" title="Upload exactly two photographs" help="Bring your hair to the front for the front photo. Show its full length in the back photo." />
              <div className="mchr-photo-grid">
                {["front", "back"].map(which => <div className="mchr-photo-card" key={which}>
                  <div className={"mchr-photo-sample " + which}><GuidePhoto src={PHOTO_GUIDES[which]} alt={which === "front" ? "Illustrative Indian woman facing forward with all her long hair brought to the front over her shoulders" : "Illustrative Indian woman photographed from behind showing the full length of long hair"} /><span>{which === "front" ? "Face visible · hair brought forward" : "Back view · complete hair length"}</span></div>
                  <strong>{photoNames[which]}</strong>
                  <p>{which === "front" ? "Face and front hair clearly visible." : "Show the complete length of your hair from behind."}</p>
                  <div className="mchr-upload-actions">
                    <button type="button" onClick={() => refs[which].camera.current?.click()}>Take photo</button>
                    <button type="button" onClick={() => refs[which].gallery.current?.click()}>Choose file</button>
                  </div>
                  <input aria-label={"Camera " + photoNames[which]} className="mchr-hidden-file" ref={refs[which].camera} type="file" accept="image/jpeg,image/png,image/webp" capture="environment" onChange={e => handleFile(which, e.target.files?.[0])}/>
                  <input aria-label={"Gallery " + photoNames[which]} className="mchr-hidden-file" ref={refs[which].gallery} type="file" accept="image/jpeg,image/png,image/webp" onChange={e => handleFile(which, e.target.files?.[0])}/>
                  <small>{files[which] ? "Selected: " + files[which].name : "No photograph selected yet"}</small>
                </div>)}
              </div>
              <div className="mchr-note">JPEG, PNG or WebP · maximum 4 MB per photograph. Please use clear, well-lit photographs. Your photographs are stored privately for review by the Mamta Care team.</div>
            </>}
            {step === 4 && <>
              <StepTitle number="04" title="Review and consent" help="Please read each declaration before submitting your registration." />
              <div className="mchr-summary"><div>Method: <strong>{method === "haircut" ? "Haircut · " + values.hair_length : "Complete Head Shave · BALD(FULL LENGTH)"}</strong></div><div>Front and back photos: <strong>{files.front && files.back ? "Selected" : "Missing"}</strong></div></div>
              <label className="mchr-check"><input type="checkbox" checked={values.voluntary} onChange={e => set("voluntary", e.target.checked)}/><span>I voluntarily wish to donate my hair to help make wigs for cancer patients through Mamta Care Charitable Trust. I confirm that no one has pressured me and that I have read the donation conditions. <b>Required</b></span></label>
              <label className="mchr-check"><input type="checkbox" checked={values.private_photos} onChange={e => set("private_photos", e.target.checked)}/><span>I permit the Trust to collect and privately review my submitted photographs and donor details for registration and coordination under its privacy notice. <b>Required</b></span></label>
              <label className="mchr-check"><input type="checkbox" checked={values.awareness} onChange={e => set("awareness", e.target.checked)}/><span>I optionally authorize the Trust to use specific photographs or videos I approve for educational and awareness communications. This choice is not required to donate. <b>Optional</b></span></label>
              <p className="mchr-image-note">Publicity consent does not transfer copyright. Terms, photo retention and withdrawal instructions require final legal and privacy review before launch.</p>
            </>}
            {step === 4 && <div ref={securityRef} aria-label="Security verification" />}
            {uploadState !== "idle" && <p role="status" className="mchr-note">{uploadState}</p>}
            {error && <p role="alert" className="mchr-error">{error}</p>}
            <div className="mchr-footer-actions">
              <button type="button" className="mchr-secondary" onClick={() => step === 1 ? null : (setStep(step - 1), setError(""))} disabled={step === 1}>Back</button>
              <button type="button" className="mchr-primary" onClick={next} disabled={submitting || attempted.current}>{submitting ? "Submitting securely…" : step === 4 ? "Registration not yet enabled" : "Continue →"}</button>
            </div>
          </motion.section>
        </AnimatePresence>
      </>}
      <p className="mchr-footnote">By submitting, you request review by Mamta Care Charitable Trust. Your reference is not an official registration ID or certificate. <Link to="/">Return to Mamta Care website</Link>.</p>
    </div>
  </div>;
}
