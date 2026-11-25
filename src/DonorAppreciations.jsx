import React, { useEffect, useState } from 'react';
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
  if (failed || !portraits.length) return null;
  return <section className="mc-appreciations" aria-labelledby="mc-appreciations-title">
    <header><h2 id="mc-appreciations-title">Thank you to our hair donors</h2></header>
    <ul>{portraits.map(({ id, publicPortrait, quote }) => <li key={id}>
      <img src={publicPortrait.url} width="96" height="96" loading="lazy" alt={publicPortrait.displayName} style={{objectFit:'cover',borderRadius:8}} />
      <h3>{publicPortrait.displayName}</h3><small>{publicPortrait.city}</small>
      <p>{quote}</p><span>— Mamta Care</span>
    </li>)}</ul>
  </section>;
}
