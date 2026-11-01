import React, { useEffect, useState } from "react";
import "./styles/official-documents.css";

const CONTENT_ORIGIN = "https://mamta-website-content-control.bharathairseva-in.workers.dev";
const CATEGORIES = {
  trust_registration: "Trust Registration Certificate",
  trust_deed: "Trust Deed / Founding Document",
  darpan: "NGO Darpan · NITI Aayog",
  pan: "Trust PAN · Redacted Copy",
  tax_12ab: "Income Tax 12AB",
  tax_80g: "Income Tax 80G",
  other: "Other Official Document",
};
const PUBLIC_PATH = /^\/documents\/[0-9a-f-]{36}\.pdf$/i;

function displayDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || "")) return "";
  const d = new Date(value + "T00:00:00Z");
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
}

export default function OfficialDocuments() {
  const [state, setState] = useState({ loading: true, documents: [], error: false });
  useEffect(() => {
    const ctrl = new AbortController();
    fetch(CONTENT_ORIGIN + "/api/public", { signal: ctrl.signal, cache: "no-store" })
      .then((r) => {
        if (!r.ok) throw new Error("Cannot load published documents");
        return r.json();
      })
      .then((payload) => {
        if (payload?.ok !== true) throw new Error("Invalid publication status");
        const documents = Array.isArray(payload.documents) ? payload.documents.filter(
          (item) => item && PUBLIC_PATH.test(item.url || "") && typeof item.title === "string"
        ).slice(0, 16) : [];
        setState({ loading: false, documents, error: false });
      })
      .catch((err) => {
        if (err.name !== "AbortError") setState({ loading: false, documents: [], error: true });
      });
    return () => ctrl.abort();
  }, []);

  const hasDarpan = state.documents.some((d) => d.category === "darpan");
  return (
    <div className="mc-legal-page">
      <section className="mc-legal-hero">
        <span className="mc-legal-eyebrow">TRANSPARENCY • ACCOUNTABILITY • PUBLIC RECORDS</span>
        <h1>Official Documents &amp; Registration</h1>
        <p>Review the legal and registration documents that Mamta Care Charitable Trust has approved for public release.</p>
        <span className="mc-legal-hero-caption">Mamta Care Charitable Trust · Established 2022 · Jalgaon, Maharashtra</span>
      </section>

      <section className="mc-legal-body" aria-labelledby="mc-legal-documents">
        <div className="mc-legal-heading">
          <div><span className="mc-legal-eyebrow">OUR PUBLIC RECORDS</span><h2 id="mc-legal-documents">Document library</h2></div>
          <p>Only approved, privacy-checked copies appear here.</p>
        </div>
        {state.loading ? (
          <p className="mc-legal-empty" role="status">Checking the published document register…</p>
        ) : state.error ? (
          <p className="mc-legal-empty" role="status">The public document register is temporarily unavailable. Please try again later.</p>
        ) : state.documents.length === 0 ? (
          <p className="mc-legal-empty" role="status">Official document copies are being prepared for publication. No documents have been published here yet.</p>
        ) : (
          <div className="mc-legal-grid">
            {state.documents.map((doc) => (
              <article className="mc-legal-card" key={doc.id}>
                <div className="mc-legal-icon" aria-hidden="true">▤</div>
                <span className="mc-legal-category">{CATEGORIES[doc.category] || CATEGORIES.other}</span>
                <h3>{doc.title}</h3>
                {doc.issuer && <p><strong>Issuing authority:</strong> {doc.issuer}</p>}
                {doc.reference && <p><strong>Public reference:</strong> {doc.reference}</p>}
                {displayDate(doc.issuedOn) && <p><strong>Issued:</strong> {displayDate(doc.issuedOn)}</p>}
                {doc.note && <p className="mc-legal-note">{doc.note}</p>}
                <a href={CONTENT_ORIGIN + doc.url} target="_blank" rel="noopener noreferrer">View public PDF <span aria-hidden="true">↗</span></a>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="mc-legal-verify" aria-labelledby="mc-legal-verify">
        <span className="mc-legal-eyebrow">INDEPENDENT CHECKS</span>
        <h2 id="mc-legal-verify">How to verify our documents</h2>
        <div className="mc-legal-verify-grid">
          <div><b>Registered trust documents</b><p>Check the registered trust deed or registration certificate against the issuing authority and stated registration details.</p></div>
          <div><b>Government of India · NGO Darpan</b><p>Where an NGO Darpan document is published, check its unique ID directly on the NITI Aayog portal. A Darpan ID is not itself central-government incorporation or an endorsement.</p><a href="https://ngodarpan.gov.in/" target="_blank" rel="noopener noreferrer">Visit official NGO Darpan portal ↗</a></div>
          <div><b>Authenticity and privacy</b><p>Published copies may mask PAN numbers, signatures, residential addresses and other sensitive data. Contact the Trust to request further verification through an appropriate private channel.</p></div>
        </div>
        {hasDarpan && <p className="mc-legal-darpan">An NGO Darpan document has been published above. Please verify its details independently using the Government of India portal.</p>}
      </section>
    </div>
  );
}
