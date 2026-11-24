import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const ui=readFileSync("src/HairDonationRegistration.jsx","utf8");
const css=readFileSync("src/styles/hair-registration.css","utf8");
const app=readFileSync("src/App.jsx","utf8");
const routes=JSON.parse(readFileSync("vercel.json","utf8"));

test("the existing secure donor form, original submission endpoint and photo fields remain intact",()=>{
 assert.match(app,/hairDonationForm:\s*"\/hair-registration"/);
 assert.match(ui,/function HairDonationRegistration/);
 assert.match(ui,/\/api\/hair-registration/);
 assert.match(ui,/\/api\/hair-registration-status\?submission_uuid=/);
 assert.match(ui,/submission_uuid:\s*requestId\.current/);
 assert.match(ui,/body\.append\("front",files\.front\)/);
 assert.match(ui,/body\.append\("back",files\.back\)/);
 assert.match(ui,/const token = window\.turnstile/);
 assert.match(ui,/const \[step, setStep\] = useState\(1\)/);
 assert.match(ui,/const \[method, setMethod\] = useState\("haircut"\)/);
 assert.ok(routes.rewrites.some(r=>r.source==="/api/hair-registration" && r.destination.endsWith("/api/register")));
});

test("donors see a circular loading animation during the original submission",()=>{
 assert.match(ui,/step === 4 && submitting && <div className="mchr-submitting-progress"/);
 assert.match(ui,/className="mchr-loading-ring mchr-loading-ring-small"/);
 assert.match(ui,/Submitting your hair donation registration/);
 assert.match(ui,/aria-busy="true"/);
 assert.match(css,/@keyframes mchr-registration-spin/);
 assert.match(css,/\.mchr-loading-ring\s*\{/);
 assert.match(css,/animation:mchr-registration-spin/);
 assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
});

test("pending official registration shows saved-photo receipt, not a false completed number",()=>{
 assert.match(ui,/syncPending \? <section className="mchr-panel mchr-pending"/);
 assert.match(ui,/receiptConfirmed \? <>/);
 assert.match(ui,/setReceiptConfirmed\(result\?\.photos_received === true\)/);
 assert.match(ui,/response\.ok && result\?\.ok === true && result\?\.photos_received === true/);
 assert.match(ui,/Confirming your application receipt/);
 assert.match(ui,/if \(receiptConfirmed\) return/);
 assert.match(ui,/You do not need to register again or keep this page open/);
 assert.match(ui,/className="mchr-success-icon" aria-hidden="true"/);
 assert.match(ui,/Your saved submission reference/);
 assert.match(ui,/checkRegistrationStatus/);
 assert.match(ui,/window\.setInterval\(poll, 5000\)/);
 assert.match(ui,/No administrator photo approval is required/);
 assert.doesNotMatch(ui,/Your registration needs Administrator review|under administrator scrutiny/i);
});

test("only official success response shows the official registration number and contact",()=>{
 assert.match(ui,/if \(response\.ok && result\?\.ok === true && result\?\.registered && result\?\.registration_id\)/);
 assert.match(ui,/if \(!res\.ok \|\| result\?\.ok !== true \|\| !result\?\.registration_id\)/);
 assert.match(ui,/setTestResult\(\{registration_id:result\.registration_id\}\)/);
 assert.match(ui,/finished \? <section className="mchr-panel mchr-success"/);
 assert.match(ui,/Registration Successful!/);
 assert.match(ui,/Your official hair donation registration number/);
 assert.match(ui,/className="mchr-registration-number"/);
 assert.match(ui,/testResult\?\.registration_id/);
 assert.match(ui,/Kindly contact Mamta Care Charitable Trust with your registration number/);
 assert.match(ui,/href="tel:\+918500012190"/);
 assert.match(ui,/8500012190/);
 assert.doesNotMatch(ui,/setTestResult\(\{registration_id:\s*requestId\.current/);
 assert.doesNotMatch(ui,/href="https:\/\/forms\.gle/);
});
