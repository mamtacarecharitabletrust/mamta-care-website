import React, { useEffect, useRef, useState } from "react";
import { motion, useInView, useReducedMotion } from "framer-motion";

/**
 * Website-only impact content. This feed never queries the private Donor Desk
 * or handles donor records. Publishing is controlled independently.
 */
const FEED = "https://mamta-website-content-control.bharathairseva-in.workers.dev/api/public";
const HAIR_METRICS_FEED = "/api/hair-impact";
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
        item && /^\/media\/[0-9a-f-]{36}\.(?:webp|jpg|png)$/.test(String(item.url || "")) &&
        typeof item.caption === "string"
      )
    : [];
  const announcements = Array.isArray(payload.announcements) ? payload.announcements.slice(0, 8).filter((x) => x && typeof x.title === "string" && typeof x.message === "string") : [];
  const promotions = Array.isArray(payload.promotions) ? payload.promotions.slice(0, 12).filter((x) => x && typeof x.title === "string" && /^\/media\/[0-9a-f-]{36}\.(?:webp|jpg|png)$/.test(String(x.url || ""))) : [];
  if (!hasCounts && !drives.length && !photos.length && !announcements.length && !promotions.length) return null;
  const wigsDonated = Number.isSafeInteger(payload.wigsDonated) && payload.wigsDonated >= 0 ? payload.wigsDonated : null;
  return { hasCounts, completed, pending, drives, photos, announcements, promotions, wigsDonated, updatedAt: payload.updatedAt || null };
}

const numberFormat = new Intl.NumberFormat("en-IN");
const dateFormat = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });

function usePublishedWebsiteUpdates() {
  const [content, setContent] = useState(null);
  const [metrics, setMetrics] = useState(null);
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
  useEffect(() => {
    let active = true;
    const update = async () => {
      try {
        const r = await fetch(HAIR_METRICS_FEED, { cache: "no-store" });
        if (!r.ok) return;
        const data = await r.json();
        if (active && data.ok && Number.isSafeInteger(data.total) &&
            Number.isSafeInteger(data.completed) && Number.isSafeInteger(data.pending) &&
            data.total === data.completed + data.pending) setMetrics(data);
      } catch { /* retain most recent valid totals */ }
    };
    update();
    const interval = setInterval(update, 120000);
    return () => { active = false; clearInterval(interval); };
  }, []);
  return { content, metrics };
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

export default function WebsiteUpdates() {
  const { content, metrics } = usePublishedWebsiteUpdates();
  const designPreview = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("mcct_preview") === "1";
  if (!content && !metrics && !designPreview) return null;
  const published = { ...(content || { drives: [], photos: [] }), hasCounts: Boolean(metrics) || designPreview, completed: metrics?.completed ?? null, pending: metrics?.pending ?? null };
  const total = Number.isSafeInteger(published.completed) && Number.isSafeInteger(published.pending) ? published.completed + published.pending : null;
  const wigsDonated = Number.isSafeInteger(content?.wigsDonated) ? content.wigsDonated : 242;
  const indiaDateParts = new Intl.DateTimeFormat("en-GB", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: "Asia/Kolkata" }).formatToParts(new Date());
  const indiaPart = (type) => indiaDateParts.find((part) => part.type === type)?.value || "";
  const indiaToday = `${indiaPart("year")}-${indiaPart("month")}-${indiaPart("day")}`;
  const upcoming = (published.drives || [])
    .filter((drive) => drive.date >= indiaToday)
    .sort((a,b) => a.date.localeCompare(b.date))
    .slice(0, 4);
  const recentCutoff = new Date(Date.now() - 31 * 86400000).toISOString().slice(0, 10);
  const recent = (published.drives || [])
    .filter((drive) => drive.date < indiaToday && drive.date >= recentCutoff)
    .sort((a,b) => b.date.localeCompare(a.date))
    .slice(0, 4);

  return (
    <section className="mcct-public-impact" aria-labelledby="mcct-public-impact-title">
      <div className="mcct-public-impact-inner">
        {designPreview && !metrics && (
          <p className="mcct-public-preview-note" role="note">Design preview · Connected donation figures are unavailable.</p>
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

        {(published.hasCounts || designPreview) && (
          <div className="mcct-public-wigs" aria-label="Wigs donated to date">
            <div className="mcct-public-wigs-icon" aria-hidden="true">♡</div>
            <div className="mcct-public-wigs-info">
              <p className="mcct-public-overline">A LITTLE COMFORT. A LOT OF HOPE.</p>
              <h3>Wigs donated to date</h3>
              <p>Bringing confidence and care to cancer patients.</p>
            </div>
            <div className="mcct-public-wigs-number"><ImpactNumber amount={wigsDonated} label="Wigs donated" /></div>
          </div>
        )}

        {!!(published.announcements || []).length && (
          <div className="mcct-public-announcements" aria-label="Latest Mamta Care announcements">
            {published.announcements.map((announcement) => (
              <article className="mcct-public-announcement" key={announcement.id}>
                <span className="mcct-public-overline">TRUST ANNOUNCEMENT</span>
                <h3>{announcement.title}</h3>
                <p>{announcement.message}</p>
                {safeLink(announcement.link) && <a href={safeLink(announcement.link)} target="_blank" rel="noopener noreferrer">Read more</a>}
              </article>
            ))}
          </div>
        )}

        {!!(published.promotions || []).length && (
          <div className="mcct-public-block">
            <div className="mcct-public-block-heading"><p className="mcct-public-overline">MAMTA CARE UPDATES</p><h2>Campaign posters &amp; highlights</h2></div>
            <div className="mcct-public-promotions">
              {published.promotions.map((promo) => <article className="mcct-public-promotion" key={promo.id}>
                <img src={PUBLIC_MEDIA_BASE + promo.url} alt={promo.title} loading="lazy" decoding="async" />
                <div><h3>{promo.title}</h3>{promo.caption && <p>{promo.caption}</p>}
                {safeLink(promo.link) && <a href={safeLink(promo.link)} target="_blank" rel="noopener noreferrer">Learn more</a>}</div>
              </article>)}
            </div>
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

        {!!recent.length && (
          <div className="mcct-public-block">
            <div className="mcct-public-block-heading"><p className="mcct-public-overline">PAST 30 DAYS</p><h2>Recent hair donation drives</h2></div>
            <div className="mcct-public-drives">{recent.map((drive) => <article key={drive.id} className="mcct-public-drive">
              <div className="mcct-public-drive-date">{dateFormat.format(new Date(drive.date + "T12:00:00+05:30"))} · CONCLUDED</div>
              <h3>{drive.title}</h3><p className="mcct-public-location">{drive.city}</p>
              {drive.note && <p className="mcct-public-note">{drive.note}</p>}
              {safeLink(drive.link) && <a href={safeLink(drive.link)} target="_blank" rel="noopener noreferrer">View details</a>}
            </article>)}</div>
          </div>
        )}

        {!!(published.photos || []).length && (
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
