import React, { useEffect, useRef, useState } from 'react';
import './styles/donor-appreciations.css';

const feed = 'https://mamta-website-content-control.bharathairseva-in.workers.dev/api/appreciations';

export default function DonorAppreciations() {
  const [page, setPage] = useState(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    setFailed(false);
    fetch(feed, { signal: controller.signal, cache: 'no-store' })
      .then(r => { if (!r.ok) throw Error(); return r.json(); })
      .then(data => { if (!controller.signal.aborted) setPage(data); })
      .catch(() => { if (!controller.signal.aborted) setFailed(true); });
    return () => controller.abort();
  }, []);
  // The public feed may also contain anonymous appreciation records.
  const portraits = (page?.items || []).filter(card =>
    card.publicPortrait?.url && card.publicPortrait.displayName && card.publicPortrait.city
  );
  const track = useRef(null);
  const [edges, setEdges] = useState({ first: true, last: true });

  useEffect(() => {
    const list = track.current;
    if (!list) return;
    const update = () => setEdges({
      first: list.scrollLeft < 2,
      last: list.scrollLeft + list.clientWidth >= list.scrollWidth - 2
    });
    update();
    const observer = new ResizeObserver(update);
    observer.observe(list);
    list.addEventListener('scroll', update, { passive: true });
    return () => {
      observer.disconnect();
      list.removeEventListener('scroll', update);
    };
  }, [portraits.length]);

  function slide(direction) {
    const list = track.current;
    if (!list) return;
    const left = list.getBoundingClientRect().left;
    const cards = Array.from(list.children);
    const target = direction > 0
      ? cards.find(card => card.getBoundingClientRect().left > left + 2)
      : cards.reverse().find(card => card.getBoundingClientRect().left < left - 2);
    if (target) list.scrollBy({
      left: target.getBoundingClientRect().left - left,
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth'
    });
  }

  if (failed || !portraits.length) return null;
  return <section className="mc-appreciations" aria-labelledby="mc-appreciations-title">
    <header><h2 id="mc-appreciations-title">Thank you to our hair donors</h2>
      {(!edges.first || !edges.last) && <div className="mc-gallery-controls">
        <button type="button" aria-label="Previous donor" aria-controls="mc-donor-row" disabled={edges.first} onClick={() => slide(-1)}>←</button>
        <button type="button" aria-label="Next donor" aria-controls="mc-donor-row" disabled={edges.last} onClick={() => slide(1)}>→</button>
      </div>}
    </header>
    <ul id="mc-donor-row" ref={track} tabIndex={0} aria-label="Hair donors">{portraits.map(({ id, publicPortrait, quote }) => <li key={id}>
      <img src={publicPortrait.url} width="220" height="220" loading="lazy" alt={publicPortrait.displayName} />
      <h3>{publicPortrait.displayName}</h3><small>{publicPortrait.city}</small>
      <p>{quote}</p><span>— Mamta Care</span>
    </li>)}</ul>
  </section>;
}
