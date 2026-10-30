import React, { useEffect, useRef, useState } from "react";
import { motion, useInView, useReducedMotion } from "framer-motion";

/**
 * Website-only impact content. This feed never queries the private Donor Desk
 * or handles donor records. Publishing is controlled independently.
 */
const FEED = "https://mamta-website-content-control.bharathairseva-in.workers.dev/api/public";
const PUBLIC_MEDIA_BASE = "https://mamta-website-content-control.bharathairseva-in.workers.dev";

function safeLink(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.href : "";
  } catch {
    return "";
  }
}

function validContent(payload) {
  if (!payload || payload.ok !== true) return null;
  const completed = payload.impact?.completed;
  const pending = payload.impact?.pending;
  const validCount = (n) => Number.isSafeInteger(n) && n >= 0 && n <= 1_000_000_000;
  const hasCounts = validCount(completed) && validCount(pending);
  const drives = Array.isArray(payload.drives)
    ? payload.drives.slice(0, 12).filter((item) =>
        item && typeof item.title === "string" && typeof item.city === "string" &&
        /^\d{4}-\d{2}-\d{2}$/.test(String(item.date || ""))
      )
    : [];
  const photos = Array.isArray(payload.photos)
    ? payload.photos.slice(0, 24).filter((item) =>
        item && /^\/media\/[0-9a-f-]{36}\.webp$/.test(String(item.url || "")) &&
        typeof item.caption === "string"
      )
    : [];
  if (!hasCounts && !drives.length && !photos.length) return null;
  return { hasCounts, completed, pending, drives, photos, updatedAt: payload.updatedAt || null };
}

const numberFormat = new Intl.NumberFormat("en-IN");
const dateFormat = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });

function usePublishedWebsiteUpdates() {
  const [content, setContent] = useState(null);
  useEffect(() => {
    let live = true;
    let running = false;
    const get = async () => {
      if (!live || running || document.visibilityState === "hidden") return;
      running = true;
      try {
        const response = await fetch(FEED, { cache: "no-store", headers: { Accept: "application/json" } });
        if (!response.ok) return;
        const next = validContent(await response.json());
        if (live) setContent(next);
      } catch {
        // Preserve the last confirmed public update during temporary outages.
      } finally {
        running = false;
      }
    };
    const interval = window.setInterval(get, 300000);
    document.addEventListener("visibilitychange", get);
    get();
    return () => {
      live = false;
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", get);
    };
  }, []);
  return content;
}

function ImpactNumber({ amount, label }) {
  const ref = useRef(null);
  const visible = useInView(ref, { once: true, amount: 0.2 });
  const reduceMotion = useReducedMotion();
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    if (!Number.isSafeInteger(amount) || amount < 0) {
      setDisplay(null);
      return undefined;
    }
    if (!visible) return undefined;
    if (reduceMotion) {
      setDisplay(amount);
      return undefined;
    }
    let frame;
    const start = performance.now();
    const duration = 1250;
    const animate = (now) => {
      const progress = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - progress, 4);
      setDisplay(Math.round(amount * eased));
      if (progress < 1) frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [amount, visible, reduceMotion]);
  return (
    <div ref={ref} className="mcct-public-stat">
      <motion.strong initial={reduceMotion ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
        {Number.isSafeInteger(amount) ? numberFormat.format(display ?? 0) : "—"}
      </motion.strong>
      <span>{label}</span>
    </div>
  );
}

/**
 * Public goal projections, not recorded donations.
 * Campaign model: each India-local calendar day adds goals of
 * 10 registrations, 5 completions and 5 follow-up cases.
 * Verified counts above are NEVER incremented by this model.
 */
const CAMPAIGN_START_UTC = Date.UTC(2026, 9, 30);
function campaignDayInIndia() {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit"
  }).formatToParts(new Date());
  const part = (type) => Number(parts.find((entry) => entry.type === type)?.value);
  const dayUtc = Date.UTC(part("year"), part("month") - 1, part("day"));
  return Math.max(1, Math.floor((dayUtc - CAMPAIGN_START_UTC) / 86400000) + 1);
}
function DailyCampaignTargets() {
  const [day, setDay] = useState(campaignDayInIndia);
  useEffect(() => {
    const interval = setInterval(() => setDay(campaignDayInIndia()), 60000);
    return () => clearInterval(interval);
  }, []);
  return (
    <div className="mcct-daily-campaign" aria-labelledby="mcct-goal-heading">
      <div className="mcct-daily-head">
        <div>
          <p className="mcct-public-overline">DAILY CAMPAIGN · TARGETS</p>
          <h3 id="mcct-goal-heading">Our ambition grows every day.</h3>
          <p>Campaign projection since 30 October 2026 · day {numberFormat.format(day)}</p>
        </div>
        <div className="mcct-daily-pace">+10 <span>planned per day</span></div>
      </div>
      <div className="mcct-daily-targets">
        <ImpactNumber amount={day * 10} label="Target registrations" />
        <ImpactNumber amount={day * 5} label="Target completions" />
        <ImpactNumber amount={day * 5} label="Target follow-ups" />
      </div>
      <div className="mcct-daily-distribution" aria-hidden="true"><span /><span /></div>
      <p className="mcct-daily-explanation">
        Illustrative campaign goals (+10 registrations, +5 completions and +5 follow-ups per day).
        These projections are not actual donor submissions or completed donations.
      </p>
    </div>
  );
}

export default function WebsiteUpdates() {
  const content = usePublishedWebsiteUpdates();
  const designPreview = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("mcct_preview") === "1";
  if (!content && !designPreview) return null;
  const published = content || { hasCounts: true, completed: null, pending: null, drives: [], photos: [] };
  const total = Number.isSafeInteger(published.completed) && Number.isSafeInteger(published.pending) ? published.completed + published.pending : null;
  const upcoming = published.drives
    .filter((drive) => drive.date >= new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }))
    .slice(0, 4);

  return (
    <section className="mcct-public-impact" aria-labelledby="mcct-public-impact-title">
      <div className="mcct-public-impact-inner">
        {designPreview && !content && (
          <p className="mcct-public-preview-note" role="note">Design preview · Actual donation figures have not been published yet.</p>
        )}
        {published.hasCounts && (
          <div className="mcct-public-impact-card">
            <div className="mcct-public-impact-header">
              <div>
                <p className="mcct-public-overline mcct-public-live-label"><span aria-hidden="true" className="mcct-public-live-dot" /> LIVE</p>
                <h2 id="mcct-public-impact-title">Every donation. A step towards hope.</h2>
              </div>
            </div>
            <div className="mcct-public-impact-grid">
              <ImpactNumber amount={total} label="Total recorded" />
              <ImpactNumber amount={published.completed} label="Completed donations" />
              <ImpactNumber amount={published.pending} label="Pending donations" />
            </div>
            <p className="mcct-public-disclaimer">Figures are verified and published by Mamta Care Charitable Trust.</p>
          </div>
        )}

        {!!upcoming.length && (
          <div className="mcct-public-block">
            <div className="mcct-public-block-heading">
              <p className="mcct-public-overline">JOIN OUR NEXT DRIVE</p>
              <h2>Upcoming hair donation drives</h2>
            </div>
            <div className="mcct-public-drives">
              {upcoming.map((drive) => (
                <article key={drive.id} className="mcct-public-drive">
                  <div className="mcct-public-drive-date">{dateFormat.format(new Date(drive.date + "T12:00:00+05:30"))}</div>
                  <h3>{drive.title}</h3>
                  <p className="mcct-public-location">{drive.city}</p>
                  {drive.note && <p className="mcct-public-note">{drive.note}</p>}
                  {safeLink(drive.link) && (
                    <a href={safeLink(drive.link)} target="_blank" rel="noopener noreferrer">
                      Book / Enquire <span aria-hidden="true">↗</span>
                    </a>
                  )}
                </article>
              ))}
            </div>
          </div>
        )}

        {!!published.photos.length && (
          <div className="mcct-public-block">
            <div className="mcct-public-block-heading">
              <p className="mcct-public-overline">MOMENTS THAT MATTER</p>
              <h2>From our community</h2>
            </div>
            <div className="mcct-public-photos">
              {published.photos.slice(0, 8).map((photo) => (
                <figure key={photo.id} className="mcct-public-photo">
                  <img src={PUBLIC_MEDIA_BASE + photo.url} alt={photo.caption} loading="lazy" decoding="async" />
                  <figcaption>{photo.caption}</figcaption>
                </figure>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
