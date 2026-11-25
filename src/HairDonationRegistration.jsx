import TrustNotice from "./TrustNotice";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Link } from "react-router-dom";
import officialLogo from "./assets/mamta-care-logo.jpeg";




import "./styles/hair-registration.css";

const PHOTO_GUIDES = { haircut: "/registration-guides/haircut-approved.webp", head_shave: "/registration-guides/headshave.webp", front: "/registration-guides/front.webp", back: "/registration-guides/back.webp" };
const LENGTHS = ["14-16INCHES", "18-20INCHES", "21-26INCHES"];
const FILE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_PHOTO_BYTES = 4 * 1024 * 1024;
const MAX_SOURCE_PHOTO_BYTES = 20 * 1024 * 1024;
/* Resize large phone photos locally before upload. No external photo services. */
async function optimizeHairPhoto(file){
  if(file.size<=650*1024)return file;
  let image=null,objectURL="";
  try{
    if("createImageBitmap" in window)image=await createImageBitmap(file);
    else {
      objectURL=URL.createObjectURL(file);
      image=await new Promise((resolve,reject)=>{const el=new Image();el.onload=()=>resolve(el);el.onerror=reject;el.src=objectURL;});
    }
    const scale=Math.min(1,1600/Math.max(image.width,image.height));
    const canvas=document.createElement("canvas");
    canvas.width=Math.max(1,Math.round(image.width*scale));
    canvas.height=Math.max(1,Math.round(image.height*scale));
    const ctx=canvas.getContext("2d");
    if(!ctx)throw Error("Cannot prepare the photo on this device");
    ctx.fillStyle="#ffffff";
    ctx.fillRect(0,0,canvas.width,canvas.height);
    ctx.drawImage(image,0,0,canvas.width,canvas.height);
    let compressed=null;
    for(const quality of [0.82,0.72,0.62]){
      const blob=await new Promise(resolve=>canvas.toBlob(resolve,"image/jpeg",quality));
      if(!blob)break;
      compressed=blob;
      if(blob.size<=900*1024)break;
    }
    if(!compressed||compressed.size>=file.size)return file;
    return new File([compressed],file.name.replace(/\.[^.]+$/,"")+".jpg",{type:"image/jpeg",lastModified:file.lastModified});
  }finally{
    if(objectURL)URL.revokeObjectURL(objectURL);
    if(image&&typeof image.close==="function")image.close();
  }
}


function GuidePhoto({ src, alt }) { const [missing, setMissing] = React.useState(false); return missing ? <div className="mchr-photo-unavailable">Corrected photograph will appear after image upload</div> : <img src={src} alt={alt} onError={() => setMissing(true)} />; }

function StepTitle({ number, title, help }) {
  return <header className="mchr-step-heading"><span>{number}</span><div><h2>{title}</h2><p>{help}</p></div></header>;
}

function FormField({ title, required = true, children }) {
  return <label className="mchr-field"><span>{title}{required ? " *" : ""}</span>{children}</label>;
}

const WEBSITE_REGISTRATION_ENABLED = true; // Server still checks Cloudflare registration and integration gates.

export default function HairDonationRegistration() {
  const driveId = new URLSearchParams(window.location.search).get("drive");
  const [driveInfo, setDriveInfo] = React.useState(null);
  React.useEffect(() => {
    if (driveId === null) return;
    let active = true;
    fetch("/api/hair-registration-status?school_drive=" + encodeURIComponent(driveId), {cache:"no-store"})
      .then(async response => {
        if (!response.ok) throw new Error(response.status === 404 ? "This school enrollment link is invalid. Ask the school coordinator for its drive link." : "Unable to check the school drive. Refresh this page to retry.");
        return response.json();
      })
      .then(info => { if (active) setDriveInfo(info); })
      .catch(error => { if (active) setDriveInfo({error:error.message}); });
    return () => { active = false; };
  }, [driveId]);
  const [driveConsent, setDriveConsent] = React.useState(false);
  useEffect(() => {
    if (!WEBSITE_REGISTRATION_ENABLED) return;
    const script=document.createElement("script");
    script.src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    script.async=true;script.defer=true;document.head.appendChild(script);
    return()=>{document.head.removeChild(script);};
  }, []);
  const [step, setStep] = useState(1);
  const securityRef = useRef(null);
  const widgetId = useRef(null);
  useEffect(() => {
    if (step !== 4 || !WEBSITE_REGISTRATION_ENABLED) return;
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
    hair_length: LENGTHS[0], full_name: "", phone: "", email: "", gender: "", city: "",
    hair_type: "", guidance: "", readiness: "", referral_source: "",
    voluntary: false, private_photos: false, terms_accepted: false, awareness: false,
  });
  const [files, setFiles] = useState({ front: null, back: null });
  const [photoBusy, setPhotoBusy] = useState({front:false,back:false});
  const photoSequence = useRef({front:0,back:0});
  const frontPreview = useMemo(() => files.front ? URL.createObjectURL(files.front) : null, [files.front]);
  const backPreview = useMemo(() => files.back ? URL.createObjectURL(files.back) : null, [files.back]);
  useEffect(() => () => { if (frontPreview) URL.revokeObjectURL(frontPreview); }, [frontPreview]);
  useEffect(() => () => { if (backPreview) URL.revokeObjectURL(backPreview); }, [backPreview]);
  const [error, setError] = useState("");
  const [finished, setFinished] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const attempted = useRef(false);
  const [uploadState, setUploadState] = useState("idle");
  const [syncPending, setSyncPending] = useState(false);
  const [receiptConfirmed, setReceiptConfirmed] = useState(false);
  const statusInFlight = useRef(false);
  const [canRetry, setCanRetry] = useState(false);
  const [statusChecking, setStatusChecking] = useState(false);
  const frontGallery = useRef(null), frontCamera = useRef(null);
  const backGallery = useRef(null), backCamera = useRef(null);
  const refs = useMemo(() => ({ front: { gallery: frontGallery, camera: frontCamera }, back: { gallery: backGallery, camera: backCamera } }), []);
  const set = (key, value) => { setValues(old => ({ ...old, [key]: value })); setError(""); };
  const handleFile = async (which, file) => {
    if(!file)return;
    if(!FILE_TYPES.includes(file.type)||!file.size||file.size>MAX_SOURCE_PHOTO_BYTES){
      setError("Choose a JPG, PNG or WebP photo smaller than 20 MB."); return;
    }
    const seq=++photoSequence.current[which];
    setPhotoBusy(old=>({...old,[which]:true}));
    setError("");
    try{
      const ready=await optimizeHairPhoto(file);
      if(seq!==photoSequence.current[which])return;
      if(!ready.size||ready.size>MAX_PHOTO_BYTES){
        setError("This photo is still too large. Choose a smaller image (under 4 MB)."); return;
      }
      setFiles(old=>({...old,[which]:ready}));
    }catch{
      if(seq!==photoSequence.current[which])return;
      if(file.size<=MAX_PHOTO_BYTES)setFiles(old=>({...old,[which]:file}));
      else setError("Unable to prepare this large photo on your device. Please choose a smaller image.");
    }finally{
      if(seq===photoSequence.current[which])setPhotoBusy(old=>({...old,[which]:false}));
    }
  };
  const validate = (current) => {
    if (driveId !== null && !driveInfo?.school) return driveInfo?.error || "Checking your school drive…";
    if (current === 2) {
      if (!values.full_name.trim() || !/^[0-9]{10}$/.test(values.phone.replace(/\D/g, "")) ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim()) ||
        !values.gender || !values.city.trim() || !values.hair_type ||
        !values.guidance || !values.readiness || !values.referral_source) {
        return "Complete every required donor information field before continuing.";
      }
    }
    if (current === 3 && (photoBusy.front || photoBusy.back)) return "Your photographs are being prepared securely. Please try again.";
    if (current === 3 && (!files.front || !files.back)) return "Select one front photograph and one back photograph.";
    if (current === 4 && driveId && !driveConsent) return "An adult donor or a parent or guardian must confirm school drive enrollment.";
    if (current === 4 && (!values.voluntary || !values.private_photos || !values.terms_accepted)) return "Please accept the voluntary donation, privacy, and registration terms.";
    return "";
  };
  const next = () => {
    const issue = validate(step);
    if (issue) { setError(issue); return; }
    setError(""); if (step < 4) { setStep(step + 1); window.scrollTo({ top: 0, behavior: "smooth" }); }
    else submitTest();
  };
  // Donors use the custom secure app. Official IDs and confirmation emails
  // remain issued by the existing private registration bridge, never this browser.
  // Server-side Cloudflare feature/security gates remain authoritative.
  const requestId = useRef(null);
  const checkRegistrationStatus = async () => {
    if (!requestId.current || statusInFlight.current) return false;
    statusInFlight.current=true;
    setStatusChecking(true);
    try {
      const response = await fetch("/api/hair-registration-status?submission_uuid=" + encodeURIComponent(requestId.current), {cache:"no-store"});
      const result = await response.json().catch(() => null);
      if (response.ok && result?.ok === true && result?.registered && result?.registration_id) {
        setTestResult({registration_id:result.registration_id});
        setFinished(true); setSyncPending(false); setError("");
        setUploadState("Official registration confirmed");
        return true;
      }
      if (response.ok && result?.ok === true && result?.photos_received === true) setReceiptConfirmed(true);
      if (response.status === 404) {
        setUploadState("Checking the original registration reference. Please do not create a second application.");
      }
    } catch {
      setUploadState("Registration status is temporarily unavailable; automatic checking will continue.");
    } finally {
      statusInFlight.current=false;
      setStatusChecking(false);
    }
    return false;
  };
  useEffect(() => {
    if (!syncPending || finished || !requestId.current) return;
    let active = true;
    let count = 0;
    const poll = async () => {
      if (!active || count >= 48) return;
      count++;
      await checkRegistrationStatus();
    };
    poll();
    const interval = window.setInterval(poll, 5000);
    const retry = window.setTimeout(() => { if (active) setCanRetry(true); }, 47000);
    return () => { active = false; window.clearInterval(interval); window.clearTimeout(retry); };
  }, [syncPending, finished]);

  const retryOriginalSubmission = () => {
    // The same submission UUID is reused: no second Google Form registration.
    if (receiptConfirmed) return;
    attempted.current = false;
    setSyncPending(false); setCanRetry(false); setError("");
    setUploadState("Retrying the original registration reference securely");
    try { window.turnstile?.reset?.(widgetId.current); } catch {}
  };
  const submitTest = async () => {
    if (!WEBSITE_REGISTRATION_ENABLED) {
      setError("Preview only: no information or photographs have been submitted.");
      return;
    }
    if (attempted.current || submitting) return;
    setSubmitting(true); setError(""); setUploadState("Sending secure registration");
    try {
      const token = window.turnstile?.getResponse?.(widgetId.current);
      if (!token) throw new Error("Complete the security check first.");
      if (!requestId.current) requestId.current = crypto.randomUUID();
      const body = new FormData();
      if (driveId !== null) { body.set("school_drive_id", driveId); body.set("drive_adult_confirmation", driveConsent ? "yes" : "no"); }
      const fields = {
        ...values,
        submission_uuid: requestId.current,
        hair_length: method === "head_shave" ? "BALD(FULL LENGTH)" : values.hair_length,
        method, voluntary: values.voluntary ? "yes" : "no",
        private_photos: values.private_photos ? "yes" : "no", terms_accepted: values.terms_accepted ? "yes" : "no",
        awareness: values.awareness ? "yes" : "no", turnstile: token
      };
      Object.entries(fields).forEach(([key,value]) => body.append(key,String(value)));
      body.append("front",files.front); body.append("back",files.back);
      attempted.current = true;
      const res = await fetch(
        "/api/hair-registration",
        {method:"POST",body}
      );
      const result = await res.json().catch(() => null);
      if (res.ok && result?.ok === true && (res.status === 202 || result?.pending === true) && !result?.registration_id) {
        setReceiptConfirmed(result?.photos_received === true);
        setUploadState("We are confirming your original submission. Please do not register again.");
        setSyncPending(true); setCanRetry(false); setError("");
        try { window.turnstile?.reset?.(widgetId.current); } catch {}
        return;
      }
      if (!res.ok || result?.ok !== true || !result?.registration_id) {
        throw new Error(result?.error || "Registration not confirmed. Contact Mamta Care before retrying.");
      }
      setTestResult({registration_id:result.registration_id});
      setUploadState("Registration received");
      setFinished(true);
    } catch (e) {
      attempted.current = false;
      setError(String(e?.message || "Registration status could not be confirmed. Retry this same submission reference."));
      try { window.turnstile?.reset?.(widgetId.current); } catch {}
    } finally { setSubmitting(false); }
  };
  const photoNames = { front: "Front photograph", back: "Back photograph" };

  return <div className="mchr">
    <div className="mchr-container">
      <div className="mchr-top"><img src={officialLogo} alt="Official Mamta Care Charitable Trust logo" /><div>
        <p className="mchr-overline">MAMTA CARE CHARITABLE TRUST</p>
        <h1>{driveId ? "School drive enrollment" : "Donate Hair. Give Hope."}</h1>
        {driveId !== null && <p aria-live="polite">{driveInfo?.school ? <strong>{driveInfo.school} · {driveInfo.drive_date}</strong> : (driveInfo?.error || "Checking your school drive…")}</p>}
        {driveId && <p>Register one student at a time. If the student is under 18, a parent or guardian should complete the form with them.</p>}
        <p>Secure hair donation registration · Designed for mobile and desktop</p>
      </div></div>
      <TrustNotice />
      {!WEBSITE_REGISTRATION_ENABLED && <div className="mchr-preview-warning" role="status">
        <strong>Registration page preview — not accepting applications yet.</strong>
        You can explore all four steps and choose photos without sending any details. This page will submit the existing Google Form automatically when the secure integration has been verified.
        <span className="mchr-preview-note">This is a test preview only. No donor information, photographs, or email is submitted from this page.</span>
      </div>}
      {finished ? <section className="mchr-panel mchr-success" aria-live="polite">
        <span className="mchr-success-icon" aria-hidden="true">✓</span>
        <h2>Registration Successful!</h2>
        <p><strong>Thank you for choosing Mamta Care Charitable Trust.</strong></p>
        <p>You are not just donating hair — you are gifting confidence, dignity and hope to someone undergoing cancer treatment.</p>
        <p className="mchr-registration-label">Your official hair donation registration number</p>
        <div className="mchr-registration-number"><strong>{testResult?.registration_id}</strong></div>
        <p>Your two photographs were received privately, without administrator photo approval. Your confirmation email follows Mamta Care’s existing email process, and your record will synchronize with Donor Desk.</p>
        <div className="mchr-contact-instruction">
          <strong>Kindly contact Mamta Care Charitable Trust with your registration number</strong> if you need assistance or want to arrange the next steps of your hair donation.
          <a href="tel:+918500012190">Call Mamta Care: 8500012190</a>
        </div>
        <a className="mchr-secondary" href="/courier-my-hair">Courier my hair</a>
        <Link className="mchr-secondary" to="/track">Track my donation</Link>
        <Link className="mchr-secondary" to="/">Return to website</Link>
      </section> : syncPending ? <section className="mchr-panel mchr-pending" role="status" aria-live="polite">
        {receiptConfirmed ? <>
          <span className="mchr-success-icon" aria-hidden="true">✓</span>
          <h2>Application received</h2>
          <p><strong>Thank you for choosing Mamta Care Charitable Trust.</strong></p>
          <p>Your hair donation application and both photographs have been securely received. No administrator photo approval is required.</p>
          <p>You are not just donating hair — you are gifting confidence, dignity and hope to someone undergoing cancer treatment.</p>
          <p>Your official registration number is being finalized. It will appear here when available, and your confirmation email follows our existing registration process. You do not need to register again or keep this page open.</p>
          <div className="mchr-contact-instruction">
            <strong>Need assistance? Reach out to us.</strong>
            <a href="tel:+918500012190">Call Mamta Care: +91 85000 12190</a>
          </div>
          <p><strong>Women-led NGO · PAN India Hair Donation Initiative</strong></p>
          <p>Together, we donate confidence.</p>
          <details className="mchr-note"><summary>Support reference</summary><p>Your saved submission reference (not the registration ID): <strong>{requestId.current}</strong></p></details>
          <Link className="mchr-secondary" to="/">Return to website</Link>
        </> : <>
          <h2>Confirming your application receipt</h2>
          <p>We are checking whether your details and photographs were securely received. Please do not create a second application.</p>
          <p className="mchr-note">Support reference (not the registration ID): <strong>{requestId.current}</strong></p>
          <p>{uploadState}</p>
          <div className="mchr-contact-instruction"><strong>Need assistance?</strong><a href="tel:+918500012190">Call Mamta Care: +91 85000 12190</a></div>
          <div className="mchr-footer-actions">
            <button type="button" className="mchr-secondary" disabled={statusChecking} onClick={checkRegistrationStatus}>{statusChecking ? "Confirming receipt…" : "Check my application"}</button>
            {canRetry && <button type="button" className="mchr-primary" onClick={retryOriginalSubmission}>Retry this same submission safely</button>}
          </div>
        </>}
      </section> : <>
        <nav aria-label="Hair donation registration steps" className="mchr-steps">
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
              <StepTitle number="02" title="About you" help="Tell us about yourself once. We will complete the official Google Form in the background." />
              <div className="mchr-form-grid">
                <FormField title="Full name"><input autoComplete="name" value={values.full_name} onChange={e => set("full_name", e.target.value)} placeholder="Full name" /></FormField>
                <FormField title="Contact number"><input type="tel" inputMode="tel" autoComplete="tel" value={values.phone} onChange={e => set("phone", e.target.value)} placeholder="10-digit mobile number" /></FormField>
                <FormField title="Email address"><input type="email" autoComplete="email" value={values.email} onChange={e => set("email", e.target.value)} placeholder="name@example.com" /></FormField>
                <FormField title="Gender"><select value={values.gender} onChange={e => set("gender", e.target.value)}><option value="">Select gender</option>{["FEMALE","MALE"].map(x => <option key={x}>{x}</option>)}</select></FormField>
                
                <FormField title="City"><input autoComplete="address-level2" value={values.city} onChange={e => set("city", e.target.value)} placeholder="e.g. Guntur" /></FormField>
                <FormField title="Hair type"><select value={values.hair_type} onChange={e => set("hair_type", e.target.value)}><option value="">Select hair type</option>{["STRAIGHT","CURLY","WAVY","COILY","MIXED/COMBINATION"].map(x => <option key={x}>{x}</option>)}</select></FormField>
                <FormField title="Need guidance on cutting and packing?"><select value={values.guidance} onChange={e => set("guidance", e.target.value)}><option value="">Select</option><option value="YES">Yes, please guide me</option><option value="ALREADY AWARE">Already aware</option></select></FormField>
                <FormField title="Donation readiness"><select value={values.readiness} onChange={e => set("readiness", e.target.value)}><option value="">Select</option><option value="planning to donate">Planning to donate</option><option value="Already cut and ready to donate">Already cut and ready to donate</option><option value="Need guidance before cutting">Need guidance before cutting</option></select></FormField>
                <FormField title="How did you hear about Mamta Care?"><select value={values.referral_source} onChange={e => set("referral_source", e.target.value)}><option value="">Select</option>{["INSTAGRAM","FACEBOOK","WHATSAPP","FRIENDS/FAMILY"].map(x => <option key={x}>{x}</option>)}</select></FormField>
              </div>
            </>}
            {step === 3 && <>
              <StepTitle number="03" title="Two simple photos" help="Please take one picture with your hair in front, and one picture with your hair at the back." />
              <div className="mchr-photo-grid">
                {["front", "back"].map(which => <div className="mchr-photo-card" key={which}>
                  <div className={"mchr-photo-sample " + which}>
                    {(which === "front" ? frontPreview : backPreview)
                      ? <img src={which === "front" ? frontPreview : backPreview} alt={"Your selected " + which + " hair photograph"} />
                      : <GuidePhoto src={PHOTO_GUIDES[which]} alt={which === "front" ? "Sample front view: face visible and long hair brought forward over both shoulders" : "Sample back view: hair hanging down the back with full length visible"} />}
                    <span>{files[which] ? "Your photo · on this device" : which === "front" ? "Example · hair in front" : "Example · hair at back"}</span>
                  </div>
                  <strong>{photoNames[which]}</strong>
                  <p>{which === "front" ? "Face and front hair clearly visible." : "Show the complete length of your hair from behind."}</p>
                  <div className="mchr-upload-actions">
                    <button type="button" disabled={photoBusy[which]} onClick={() => refs[which].camera.current?.click()}>Take photo</button>
                    <button type="button" disabled={photoBusy[which]} onClick={() => refs[which].gallery.current?.click()}>Choose file</button>
                  </div>
                  <input aria-label={"Camera " + photoNames[which]} className="mchr-hidden-file" ref={refs[which].camera} type="file" accept="image/jpeg,image/png,image/webp" capture="environment" onChange={e => handleFile(which, e.target.files?.[0])}/>
                  <input aria-label={"Gallery " + photoNames[which]} className="mchr-hidden-file" ref={refs[which].gallery} type="file" accept="image/jpeg,image/png,image/webp" onChange={e => handleFile(which, e.target.files?.[0])}/>
                  <small>{photoBusy[which] ? "Preparing photo for faster secure upload…" : files[which] ? "✓ Photo ready for secure upload" : "No photo selected yet"}</small>
                </div>)}
              </div>
              <div className="mchr-note">Exactly two clear pictures. Large phone photos are resized privately on your device to upload faster.  When registration is enabled, they will be stored privately for your assigned Mamta Care team — never posted publicly.</div>
            </>}
            {step === 4 && <>
              <StepTitle number="04" title="Review and consent" help="Please read each declaration before submitting your registration." />
              <div className="mchr-summary"><div>Method: <strong>{method === "haircut" ? "Haircut · " + values.hair_length : "Complete Head Shave · BALD(FULL LENGTH)"}</strong></div><div>Front and back photos: <strong>{files.front && files.back ? "Selected" : "Missing"}</strong></div></div>
              {driveId && <label className="mchr-check"><input type="checkbox" checked={driveConsent} onChange={e => setDriveConsent(e.target.checked)} /><span>I am the adult donor or the student’s parent or guardian, and I agree to enroll this student in this school drive.</span></label>}
              <label className="mchr-check"><input type="checkbox" checked={values.voluntary} onChange={e => set("voluntary", e.target.checked)}/><span>I voluntarily wish to donate my hair to help make wigs for cancer patients through Mamta Care Charitable Trust. I confirm that no one has pressured me and that I have read the donation conditions. <b>Required</b></span></label>
              <label className="mchr-check"><input type="checkbox" checked={values.private_photos} onChange={e => set("private_photos", e.target.checked)}/><span>I permit the Trust to securely collect and use my submitted photographs and donor details for registration and coordination under its privacy notice. <b>Required</b></span></label>
              <div className="mchr-note" style={{margin:"14px 0"}}>
                <strong>Hair donation terms</strong>
                <p>For haircut donations, Mamta Care requires at least 14 inches of usable hair, excluding split ends and uneven ends. A full head shave is optional and must be entirely your choice. Submit accurate contact details and clear front/back photographs so our team can coordinate the donation. Submitted photos are stored privately for donation coordination and will not be published without separate permission. A donation does not guarantee a particular wig recipient.</p>
              </div>
              <label className="mchr-check"><input type="checkbox" checked={values.terms_accepted} onChange={e => set("terms_accepted", e.target.checked)}/><span>I have read and agree to the hair donation registration terms above. <b>Required</b></span></label>
              <label className="mchr-check"><input type="checkbox" checked={values.awareness} onChange={e => set("awareness", e.target.checked)}/><span>I optionally authorize the Trust to use specific photographs or videos I approve for educational and awareness communications. This choice is not required to donate. <b>Optional</b></span></label>
              <p className="mchr-image-note">Publicity permission is optional and separate from registration. Your photos are used privately for donor registration and coordination. To ask about your data or request withdrawal, contact Mamta Care through our Contact page. Requests are reviewed under the Trust's applicable procedures.</p>
            </>}
            {step === 4 && WEBSITE_REGISTRATION_ENABLED && <div ref={securityRef} aria-label="Security verification" />}
            {step === 4 && submitting && <div className="mchr-submitting-progress" role="status" aria-live="polite" aria-busy="true">
              <span className="mchr-loading-ring mchr-loading-ring-small" aria-hidden="true" />
              <div><strong>Submitting your hair donation registration…</strong><span>Please keep this page open. Your photos and details are being processed securely.</span></div>
            </div>}
            {uploadState !== "idle" && !submitting && <p role="status" className="mchr-note">{uploadState}</p>}
            {error && <p role="alert" className="mchr-error">{error}</p>}
            <div className="mchr-footer-actions">
              <button type="button" className="mchr-secondary" onClick={() => step === 1 ? null : (setStep(step - 1), setError(""))} disabled={step === 1}>Back</button>
              <button type="button" className="mchr-primary" onClick={next} disabled={submitting || attempted.current || (step === 4 && !WEBSITE_REGISTRATION_ENABLED)}>{submitting ? "Submitting securely…" : step === 4 ? (WEBSITE_REGISTRATION_ENABLED ? "Submit my donation" : "Preview only — submissions disabled") : "Continue →"}</button>
            </div>
          </motion.section>
        </AnimatePresence>
      </>}
      <p className="mchr-footnote">By submitting, you register your hair donation with Mamta Care Charitable Trust. Your official registration number is generated automatically by Mamta Care after a successful submission. <Link to="/">Return to Mamta Care website</Link>.</p>
    </div>
  </div>;
}
