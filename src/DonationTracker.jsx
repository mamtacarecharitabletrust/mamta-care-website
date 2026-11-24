import React, { useEffect, useRef, useState } from 'react';
import './DonationTracker.css';

const endpoint = 'https://mamta-public-donation-tracking.bharathairseva-in.workers.dev/lookup';
let scriptReady;
function loadTurnstile() {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  if (!scriptReady) scriptReady = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    script.onload = () => window.turnstile.ready(() => resolve(window.turnstile));
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
    if(busy || !token)return;
    setBusy(true);setError('');setResult(null);
    try {
      const res = await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json','X-Mamta-Public':'1'},
        body:JSON.stringify({registration_id:id.trim(),phone_last4:digits,cf_turnstile_response:token}),signal:AbortSignal.timeout(25000)});
      const data = await res.json();
      if(!res.ok || !data.ok) throw new Error(data.error || 'Tracking is temporarily unavailable.');
      setResult(data);
    } catch(e) {setError(e.name==='TypeError' || e.name==='TimeoutError' ? 'Unable to reach tracking. Please try again.' : e.message);}
    finally {setBusy(false);setToken('');if(widget.current!==null)window.turnstile?.reset(widget.current);}
  }
  return <main className="mc-track">
    <h1>Track your hair donation</h1>
    <p>Enter the registration ID from your confirmation or certificate and the last four digits of your registered mobile number.</p>
    <form onSubmit={lookup}>
      <label>Official registration ID<input required maxLength={75} value={id} disabled={busy} autoCapitalize="characters" spellCheck={false} onChange={e=>{setId(e.target.value);setResult(null);setError('');}} /></label>
      <label>Last four mobile digits<input required type="text" inputMode="numeric" pattern="[0-9]{4}" maxLength={4} value={digits} disabled={busy} onChange={e=>{setDigits(e.target.value.replace(/\D/g,''));setResult(null);setError('');}} /></label>
      <div ref={box}></div>
      <button disabled={busy||!token}>{busy?'Checking…':'Check donation status'}</button>
    </form>
    {error && <p role="alert">{error}</p>}
    {result && <section aria-live="polite">
      <h2>Latest recorded update</h2><strong>{result.latest}</strong><p>Registration ID · {result.registration_id}</p>
      {result.history.length>0 && <><h3>Hair donation history</h3><ol>{result.history.map(label=><li key={label}>{label}</li>)}</ol></>}
      {result.current && <p>Donor Desk application status · {result.current.status}</p>}
    </section>}
  </main>;
}