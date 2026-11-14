import React, { useEffect, useState } from "react";
import { occasionOn } from "./lib/occasionCalendar";
import "./styles/occasion-welcome.css";

const seenKey = (event) => "mcct-occasion-dismissed-" + event.date + "-" + event.id;

export default function OccasionWelcome({ registrationUrl }) {
  const [occasion, setOccasion] = useState(() => occasionOn());
  const [dismissed, setDismissed] = useState(() => {
    const event = occasionOn();
    try { return event ? sessionStorage.getItem(seenKey(event)) === "1" : false; }
    catch { return false; }
  });

  useEffect(() => {
    const syncDate = () => {
      const next = occasionOn();
      setOccasion(next);
      try { setDismissed(next ? sessionStorage.getItem(seenKey(next)) === "1" : false); }
      catch { setDismissed(false); }
    };
    // The date is evaluated in IST, including for visitors in other time zones.
    const timer = window.setInterval(syncDate, 30000);
    window.addEventListener("focus", syncDate);
    document.addEventListener("visibilitychange", syncDate);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", syncDate);
      document.removeEventListener("visibilitychange", syncDate);
    };
  }, []);

  const visible = occasion && !dismissed;
  useEffect(() => {
    if (!visible) return undefined;
    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        try { sessionStorage.setItem(seenKey(occasion), "1"); } catch { /* storage is optional */ }
        setDismissed(true);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [visible, occasion]);

  if (!visible) return null;

  const dismiss = () => {
    try { sessionStorage.setItem(seenKey(occasion), "1"); } catch { /* storage is optional */ }
    setDismissed(true);
  };

  return (
    <div className="mcct-occasion-overlay" role="presentation">
      <section
        className="mcct-occasion-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="mcct-occasion-title"
        aria-describedby="mcct-occasion-message"
      >
        <button className="mcct-occasion-close" type="button" onClick={dismiss} aria-label="Close greeting and continue to website">×</button>
        <div className="mcct-occasion-ambient" aria-hidden="true" />
        <div className="mcct-occasion-content">
          <p className="mcct-occasion-kicker">MAMTA CARE CHARITABLE TRUST</p>
          <span className="mcct-occasion-symbol" aria-hidden="true">{occasion.symbol}</span>
          <p className="mcct-occasion-eyebrow">A MESSAGE OF HOPE & KINDNESS</p>
          <h1 id="mcct-occasion-title">{occasion.title}</h1>
          <p className="mcct-occasion-message" id="mcct-occasion-message">{occasion.message}</p>
          <p className="mcct-occasion-mission">Every act of kindness matters. Donate at least <strong>14 inches of usable hair</strong> or choose a complete head shave to help us support people affected by cancer.</p>
          <div className="mcct-occasion-actions">
            <a className="mcct-occasion-register" href={registrationUrl} onClick={dismiss}>Register to Donate Hair</a>
            <button className="mcct-occasion-continue" type="button" onClick={dismiss}>Continue to Website</button>
          </div>
        </div>
      </section>
    </div>
  );
}
