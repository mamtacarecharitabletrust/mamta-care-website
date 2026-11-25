import TrustNotice from "./TrustNotice";
import React, { useEffect, useRef, useState } from 'react';
import './DonationTracker.css';
import {TrustStory, DonationImpact} from './TrackingImpact';
import DonationJourney from './DonationJourney';

const endpoint = 'https://mamta-public-donation-tracking.bharathairseva-in.workers.dev/lookup';
let scriptReady;
function loadTurnstile() {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  if (!scriptReady) scriptReady = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    script.onload = () => window.turnstile ? resolve(window.turnstile) : reject(new Error('Verification could not start. Reload this page to retry.'));
    script.onerror = () => { scriptReady = null; script.remove(); reject(new Error('Verification could not load. Check your connection and refresh this page.')); };
    document.head.appendChild(script);
  });
  return scriptReady;
}

export default function DonationTracker({initialId}) {
  const [id,setId] = useState(initialId);
  const [digits,setDigits] = useState('');
  const [token,setToken] = useState('');
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState('');
  const [result,setResult] = useState(null);
  const box = useRef(null);
  const widget = useRef(null);
  useEffect(() => {
    let active = true;
    loadTurnstile().then(api => {
      if (!active) return;
      widget.current = api.render(box.current,{sitekey:'0x4AAAAAAFU1GOT32HyjtR0p',theme:'light',
        callback: value=>{setToken(value);setError('');},
        'expired-callback':()=>setToken(''),
        'error-callback':()=>{setToken('');setError('Security verification could not finish. Please retry the check.');}
      });
    }).catch(e=>{if(active)setError(e.message);});
    return ()=>{active=false;if(widget.current!==null){window.turnstile?.remove(widget.current);widget.current=null;}};
  },[]);
  async function lookup(event) {
    event.preventDefault();
    if(busy)return;
    if(!token){setError('Complete the Cloudflare check below your mobile digits, then check your status again.');return;}
    setBusy(true);setError('');
    try {
      const res = await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json','X-Mamta-Public':'1'},
        body:JSON.stringify({registration_id:id.trim(),phone_last4:digits,cf_turnstile_response:token}),signal:AbortSignal.timeout(25000)});
      const data = await res.json();
      if(!res.ok || !data.ok){setResult(null);throw new Error(data.error || 'Tracking is temporarily unavailable.');}
      setResult(data);
    } catch(e) {setError(e.name==='TypeError' || e.name==='TimeoutError' ? 'Unable to reach tracking. Please try again.' : e.message);}
    finally {setBusy(false);setToken('');if(widget.current!==null)window.turnstile?.reset(widget.current);}
  }
  return <main className="mc-track-layout"><div className="mc-track">
    <h1>Track your hair donation</h1>
    <TrustNotice />
    <p>Enter the registration ID from your confirmation or certificate and the last four digits of your registered mobile number.</p>
    <p>Sending your donation by courier? <a href="/courier-my-hair">Courier my hair</a></p>
    <form onSubmit={lookup}>
      <label>Official registration ID<input required maxLength={75} value={id} disabled={busy} autoCapitalize="characters" spellCheck={false} onChange={e=>{setId(e.target.value);setResult(null);setError('');}} /></label>
      <label>Last four mobile digits<input required type="text" inputMode="numeric" pattern="[0-9]{4}" maxLength={4} value={digits} disabled={busy} onChange={e=>{setDigits(e.target.value.replace(/\D/g,''));setResult(null);setError('');}} /></label>
      <div aria-label="Cloudflare verification" ref={box}></div>
      <button disabled={busy}>{busy?'Checking…':'Check donation status'}</button>
    </form>
    {error && <p role="alert">{error}</p>}
    {result && <DonationJourney key={result.registration_id} result={result} onSync={lookup} busy={busy} />}
  </div><TrustStory /><DonationImpact /></main>;
}