import React from "react";
import officialLogo from "./assets/mamta-care-logo.jpeg";
import christmasIllustration from "./assets/christmas-care-illustration.webp";
import "./styles/premium-occasion-welcome.css";

function OccasionIllustration({ occasion }) {
  // Event-specific vector artwork, generated locally and never containing the
  // official logo. Each occasion has its own design ID, motif and palette.
  const kind=occasion.visual;
  if (occasion.id==="christmas") {
    return <img className="mcct-premium-christmas-photo" src={christmasIllustration}
      alt="Festive illustration of two smiling children, a gold awareness ribbon and a donated hair braid" />;
  }
  return (
    <svg className="mcct-premium-illustration" viewBox="0 0 560 520" role="img"
      aria-label={"Original "+occasion.title+" themed artwork"} xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="mcct-premium-light" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={occasion.accent} stopOpacity=".75" />
          <stop offset="1" stopColor={occasion.accent} stopOpacity=".08" />
        </linearGradient>
        <radialGradient id="mcct-premium-halo">
          <stop offset="0" stopColor="#fff8d6" stopOpacity=".92" />
          <stop offset="1" stopColor="#fff8d6" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx="285" cy="238" r="224" fill="url(#mcct-premium-halo)" />
      <circle cx="280" cy="248" r="167" fill="none" stroke="url(#mcct-premium-light)" strokeWidth="12" />
      <circle cx="280" cy="248" r="199" fill="none" stroke={occasion.accent} strokeOpacity=".22" strokeWidth="2" />
      {kind==="tricolour" && <>
        <path d="M70 214Q175 156 280 215T490 218" stroke="#f39448" strokeWidth="28" fill="none"/>
        <path d="M70 240Q175 182 280 241T490 244" stroke="#faf7eb" strokeWidth="28" fill="none"/>
        <path d="M70 266Q175 208 280 267T490 270" stroke="#5a995f" strokeWidth="28" fill="none"/>
        <circle cx="280" cy="241" r="20" fill="none" stroke="#2f5b91" strokeWidth="3"/>
        {Array.from({length:12},(_,i)=><line key={i} x1="280" y1="241"
          x2={280+19*Math.cos(i*Math.PI/6)} y2={241+19*Math.sin(i*Math.PI/6)}
          stroke="#2f5b91" strokeWidth="1.4"/>)}
      </>}
      {kind==="diya" && <>
        <path d="M161 269Q280 345 399 269Q382 361 280 361Q178 361 161 269Z" fill="#b8703c" stroke="#e9bc63" strokeWidth="7"/>
        <path d="M280 270Q238 222 280 161Q322 222 280 270Z" fill="#facb58"/>
        <path d="M280 242Q266 225 280 200Q294 225 280 242Z" fill="#fff4af"/>
      </>}
      {kind==="crescent" && <>
        <circle cx="279" cy="239" r="121" fill={occasion.accent} opacity=".9"/>
        <circle cx="325" cy="199" r="114" fill="#134f4d"/>
        <path d="M127 358Q280 322 432 358" stroke={occasion.accent} strokeWidth="7" fill="none" opacity=".65"/>
      </>}
      {kind==="christmas" && <>
        <path d="M280 118L404 320H156Z" fill="#2f7f54" stroke="#dfc482" strokeWidth="7"/>
        <path d="M280 155L375 312H185Z" fill="#4a9a60"/>
        <rect x="267" y="318" width="26" height="47" fill="#8f6544"/>
        <circle cx="235" cy="260" r="12" fill="#e0bc70"/><circle cx="309" cy="296" r="14" fill="#bb5052"/>
        <rect x="130" y="344" width="65" height="52" rx="7" fill="#ddb875"/>
        <rect x="357" y="341" width="68" height="55" rx="7" fill="#dd7472"/>
      </>}
      {kind==="cancer" && <>
        <path d="M287 117C226 117 209 165 246 206L345 337C370 376 427 341 394 309L285 166C262 132 329 108 349 156C370 204 280 313 221 374"
        fill="none" stroke="#d9ad58" strokeWidth="42" strokeLinecap="round"/>
        <path d="M230 354Q279 295 320 245" fill="none" stroke="#f1d991" strokeWidth="13" strokeLinecap="round" opacity=".74"/>
      </>}
      {kind==="harvest" && <>
        <circle cx="280" cy="220" r="84" fill={occasion.accent} opacity=".7"/>
        {Array.from({length:9},(_,i)=><g key={i} transform={"rotate("+((i-4)*16)+" 278 373)"}>
          <path d="M278 390Q238 295 277 217" stroke="#5e8f53" strokeWidth="7" fill="none"/>
          <ellipse cx="252" cy="289" rx="17" ry="32" fill="#88a75e" transform="rotate(-31 252 289)"/>
        </g>)}
      </>}
      {kind==="nature" && <>
        <path d="M280 383Q260 262 280 173" stroke="#377c55" strokeWidth="10" fill="none"/>
        {Array.from({length:8},(_,i)=><ellipse key={i} cx={280+(i%2?48:-48)}
           cy={185+23*i} rx="40" ry="22" fill={i%2?"#91b779":"#55916f"}
           transform={"rotate("+(i%2?-28:28)+" "+(280+(i%2?48:-48))+" "+(185+23*i)+")"}/>)}
      </>}
      {kind==="lotus" && <>
        {Array.from({length:7},(_,i)=><ellipse key={i} cx="280" cy="258" rx="33" ry="95"
          fill={i%2?occasion.accent:"#f4dcad"} opacity=".86"
          transform={"rotate("+((i-3)*24)+" 280 318)"}/>)}
      </>}
      {!["tricolour","diya","crescent","christmas","cancer","harvest","nature","lotus"].includes(kind) &&
        <text x="280" y="286" textAnchor="middle" dominantBaseline="middle"
          fontSize="137" fontFamily="Apple Color Emoji, Segoe UI Emoji, Noto Color Emoji, sans-serif">{occasion.symbol}</text>}
      <path d="M38 410Q164 357 280 406T524 401" stroke={occasion.accent} strokeWidth="5" strokeOpacity=".7" fill="none"/>
      <path d="M30 436Q164 388 280 434T529 433" stroke="#f4dca7" strokeWidth="2" strokeOpacity=".8" fill="none"/>
      <ellipse cx="280" cy="456" rx="186" ry="16" fill="#fff4d5" opacity=".16"/>
    </svg>
  );
}

/**
 * Premium appearance applies to every configured holiday. The underlying
 * event-specific artwork never includes or reproduces the protected logo.
 */
export default function PremiumOccasionWelcome({occasion,registrationUrl,onDismiss,closeRef,contentRef}){
  const themeStyle={"--mcct-premium-primary":occasion.primary,"--mcct-premium-accent":occasion.accent};
  return <>
    <button ref={closeRef} className="mcct-occasion-close mcct-premium-close"
      type="button" onClick={onDismiss} aria-label="Close greeting and continue to website">×</button>
    <div ref={contentRef} className="mcct-occasion-content mcct-premium-layout"
      style={themeStyle} data-artwork={occasion.artworkId}>
      <img className="mcct-premium-mobile-logo" src={officialLogo} alt="Official Mamta Care Charitable Trust logo"/>
      <div className="mcct-premium-art">
        <span className="mcct-premium-orbit" aria-hidden="true" />
        <OccasionIllustration occasion={occasion}/>
        <div className="mcct-premium-art-foot">COMPASSION · DIGNITY · HOPE</div>
      </div>
      <div className="mcct-premium-copy">
        <img className="mcct-premium-official-logo" src={officialLogo}
          alt="Official Mamta Care Charitable Trust logo"/>
        <p className="mcct-premium-date">{new Date(occasion.date+"T12:00:00+05:30").toLocaleDateString("en-IN",{day:"numeric",month:"long",timeZone:"Asia/Kolkata"}).toUpperCase()} · MAMTA CARE</p>
        <h1 id="mcct-occasion-title">{occasion.title}</h1>
        <div className="mcct-premium-divider" aria-hidden="true"><span>♡</span></div>
        <p id="mcct-occasion-message" className="mcct-premium-message">{occasion.message}</p>
        {occasion.alsoObserved?.length>0 &&
          <p className="mcct-premium-also">Also observed: {occasion.alsoObserved.map(e=>e.title).join(" · ")}</p>}
        <p className="mcct-premium-mission">Give hope through hair donation. Minimum <strong>14 inches of usable hair</strong>, excluding split ends, or choose a complete head shave.</p>
        <div className="mcct-premium-actions">
          <a href={registrationUrl} onClick={onDismiss} className="mcct-premium-register">Register to Donate Hair</a>
          <button type="button" className="mcct-premium-continue" onClick={onDismiss}>Continue to Website</button>
        </div>
      </div>
    </div>
  </>;
}
