import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { occasionOn } from "./lib/occasionCalendar";
import mamtaCareLogo from "./assets/mamta-care-logo.jpeg";
import "./styles/occasion-welcome.css";

const seenKey = (event) => "mcct-occasion-dismissed-" + event.date + "-" + event.id;

export default function OccasionWelcome({ registrationUrl }) {
  const panelRef = useRef(null);
  const contentRef = useRef(null);
  const closeRef = useRef(null);
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

  useLayoutEffect(() => {
    if (!visible) return undefined;
    const panel = panelRef.current;
    const content = contentRef.current;
    if (!panel || !content) return undefined;

    const previousBodyOverflow = document.body.style.overflow;
    const previousHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";

    // Fit the entire greeting inside the viewport instead of adding scrollbars.
    // scrollHeight/scrollWidth are unaffected by the visual scale transform.
    const fit = () => {
      const width = Math.max(1, content.scrollWidth);
      const height = Math.max(1, content.scrollHeight);
      const topAndBottomRoom = panel.clientHeight < 520 ? 62 : 84;
      const availableHeight = Math.max(1, panel.clientHeight - topAndBottomRoom);
      const availableWidth = Math.max(1, panel.clientWidth - 28);
      const scale = Math.min(1, availableHeight / height, availableWidth / width);
      content.style.setProperty("--mcct-occasion-fit", String(scale));
    };
    fit();
    const observer = typeof ResizeObserver === "function" ? new ResizeObserver(fit) : null;
    observer?.observe(panel);
    observer?.observe(content);
    window.addEventListener("resize", fit);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", fit);
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousHtmlOverflow;
    };
  }, [visible, occasion]);

  useEffect(() => {
    if (!visible) return undefined;
    const previouslyFocused = document.activeElement;
    closeRef.current?.focus();
    const onKeyDown = (event) => {
      if (event.key === "Tab") {
        const focusable = [...(panelRef.current?.querySelectorAll("a[href], button:not([disabled])") || [])];
        if (!focusable.length) return;
        const first = focusable[0], last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
      if (event.key === "Escape") {
        try { sessionStorage.setItem(seenKey(occasion), "1"); } catch { /* storage is optional */ }
        setDismissed(true);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      if (previouslyFocused?.isConnected && typeof previouslyFocused.focus === "function") previouslyFocused.focus();
    };
  }, [visible, occasion]);

  if (!visible) return null;

  const dismiss = () => {
    try { sessionStorage.setItem(seenKey(occasion), "1"); } catch { /* storage is optional */ }
    setDismissed(true);
  };

  return (
    <div className="mcct-occasion-overlay" role="presentation">
      <section
        ref={panelRef}
        className="mcct-occasion-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="mcct-occasion-title"
        aria-describedby="mcct-occasion-message"
      >
        <button ref={closeRef} className="mcct-occasion-close" type="button" onClick={dismiss} aria-label="Close greeting and continue to website">×</button>
        <div className="mcct-occasion-ambient" aria-hidden="true" />
        <div ref={contentRef} className="mcct-occasion-content">
          <div className="mcct-occasion-logo-frame"><img className="mcct-occasion-logo" src={mamtaCareLogo} alt="Official Mamta Care Charitable Trust logo" /></div>
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
