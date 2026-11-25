import React, { useEffect, useState } from 'react';
import './styles/donor-appreciations.css';

const feed = 'https://mamta-website-content-control.bharathairseva-in.workers.dev/api/appreciations';

export default function DonorAppreciations() {
  const [offset, setOffset] = useState(0);
  const [retry, setRetry] = useState(0);
  const [page, setPage] = useState(null);
  const [failed, setFailed] = useState(false);
  const [total, setTotal] = useState(null);
  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/hair-impact', { signal: controller.signal }).then(r => r.json()).then(data => {
      if (data.ok && Number.isSafeInteger(data.completed)) setTotal(data.completed);
    }).catch(() => {});
    return () => controller.abort();
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    setFailed(false);
    fetch(feed + '?offset=' + offset, { signal: controller.signal, cache: 'no-store' })
      .then(r => { if (!r.ok) throw Error(); return r.json(); })
      .then(data => { if (!controller.signal.aborted) setPage(data); })
      .catch(() => { if (!controller.signal.aborted) setFailed(true); });
    return () => controller.abort();
  }, [offset, retry]);
  return <section className="mc-appreciations" aria-labelledby="mc-appreciations-title">
    <header><div><h2 id="mc-appreciations-title">Thank you to our hair donors</h2><p>Notes of appreciation from Mamta Care for verified hair donations.</p></div>
      <div className="mc-appreciation-counts">{page && <span><b>{page.today.toLocaleString('en-IN')}</b> recorded as verified today (IST)</span>}
      {total !== null && <span><b>{total.toLocaleString('en-IN')}</b> completed donations to date</span>}</div></header>
    {failed ? <p role="status">Donor appreciations could not be loaded. <button type="button" onClick={()=>setRetry(retry+1)}>Try again</button></p> :
      !page ? <p role="status">Loading donor appreciations…</p> :
      page.items.length ? <ul>{page.items.map(card=><li key={card.id}><small>Donor appreciation · {card.id}</small><h3>{card.label}</h3><p>{card.quote}</p><span>— Mamta Care Charitable Trust</span></li>)}</ul> :
      <p>There are no more donor appreciations to display.</p>}
    <nav aria-label="Donor appreciation pages">{offset>0 && <button type="button" onClick={()=>{setPage(null);setOffset(Math.max(0,offset-6));}}>Previous</button>}
      {page?.more && !failed && <button type="button" onClick={()=>{setPage(null);setOffset(offset+6);}}>More donor appreciations</button>}</nav>
  </section>;
}