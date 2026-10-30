import React, { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";

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
  const reduceMotion = useReducedMotion();
  return (
    <div className="mcct-public-stat">
      <motion.strong
        initial={reduceMotion ? false : { opacity: 0, y: 12 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.42 }}
      >
        {Number.isSafeInteger(amount) ? numberFormat.format(amount) : "—"}
      </motion.strong>
      <span>{label}</span>
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
