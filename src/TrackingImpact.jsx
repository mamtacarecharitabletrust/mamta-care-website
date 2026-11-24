import React, {useEffect, useState} from 'react';
import donationPhoto from './assets/IMG_20260709_142702.jpg.jpeg';

export function TrustStory() {
  return <aside className="mc-story mc-side" aria-labelledby="mc-story-title">
    <img src={donationPhoto} alt="Hair donation at Mamta Care" decoding="async" />
    <div className="mc-side-content">
      <p className="mc-kicker">Jalgaon, Maharashtra · Est. 2022</p>
      <h2 id="mc-story-title">The story behind your donation</h2>
      <p>Mamta Care began in Jalgaon in 2022. Today, our women-led trust brings together hair donors across India to support free wigs for people affected by cancer.</p>
      <p>You may have grown your hair for years. You deserve to know where it goes after the cut. Your registration ID lets you follow the stages our team records, from receiving your hair through wig making and final donation.</p>
      <a href="/official-documents">View the Trust’s official documents <span aria-hidden="true">↗</span></a>
    </div>
  </aside>;
}

export function DonationImpact() {
  const [counts,setCounts]=useState(null);
  const [loading,setLoading]=useState(true);
  useEffect(()=>{
    const lifetime=new AbortController();
    let fetching=false;
    async function refresh(){
      if(fetching || document.hidden || lifetime.signal.aborted)return;
      fetching=true;
      try {
        const res=await fetch('/api/hair-impact',{signal:lifetime.signal,cache:'no-cache'});
        if(!res.ok)throw new Error();
        const data=await res.json();
        if(!data.ok || ![data.total,data.completed,data.pending].every(n=>Number.isSafeInteger(n)&&n>=0) || data.completed+data.pending!==data.total)throw new Error();
        if(!lifetime.signal.aborted)setCounts(data);
      }catch{if(!lifetime.signal.aborted)setCounts(null);}
      finally{fetching=false;if(!lifetime.signal.aborted)setLoading(false);}
    }
    refresh();
    const timer=setInterval(refresh,60000);
    document.addEventListener('visibilitychange',refresh);
    return ()=>{lifetime.abort();clearInterval(timer);document.removeEventListener('visibilitychange',refresh);};
  },[]);
  return <aside className="mc-impact-side" aria-label="Donation impact">
    <div className="mc-side mc-tally"><div className="mc-side-content">
      <p className="mc-kicker">Mamta Care donor records</p><h2>Our donor community</h2>
      {counts ? <dl>{[['total','Registrations'],['completed','Completed donations'],['pending','Pending registrations']].map(([key,label])=><div key={key}><dt>{label}</dt><dd>{counts[key].toLocaleString('en-IN')}</dd></div>)}</dl> : <p role="status">{loading?'Loading donation figures…':'Live donation figures are temporarily unavailable.'}</p>}
    </div></div>
    <div className="mc-side mc-context"><div className="mc-side-content">
      <h2>Why a wig can matter</h2>
      <p><strong>About 4,269 new cancer cases a day</strong> were estimated in India on average in 2024. That figure comes from an annual estimate of 15,62,581 cases.</p>
      <p>For someone who wants a wig after losing their hair, it can mean recognising their reflection again. Thank you for giving someone that choice.</p>
      <a href="https://gco.iarc.who.int/media/globocan/factsheets/populations/356-india-fact-sheet.pdf" target="_blank" rel="noreferrer">IARC · India cancer fact sheet, 2024 <span aria-hidden="true">↗</span></a>
    </div></div>
  </aside>;
}