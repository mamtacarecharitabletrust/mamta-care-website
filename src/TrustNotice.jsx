import React from "react";
import "./styles/trust-notice.css";

export default function TrustNotice() {
  return (
    <aside className="mc-trust-notice" aria-label="Mamta Care registration">
      <img className="mc-trust-mark" src="/courier/trust-logo.webp" alt="Mamta Care Charitable Trust" width="58" height="58" />
      <div className="mc-trust-copy">
        <strong className="mc-trust-title">A women-led charitable trust</strong>
        <span className="mc-trust-detail">Registered on the <strong>Government of India</strong>’s NGO Darpan portal · NITI Aayog</span>
        <span className="mc-trust-id">NGO Darpan ID · MH/2025/0518578</span>
      </div>
      <a className="mc-trust-proof" href="/official-documents">View registration documents</a>
    </aside>
  );
}
