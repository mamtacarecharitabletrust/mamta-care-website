/* MCCT_DESK_BURGUNDY_IVORY_20261118
 * UI-only enhancement. No donor, courier, stock, payment, registration, auth,
 * photo-storage, certificate, cron, or notification writes.
 * Preserve the original Mamta Care logo asset unmodified.
 */
const MCCT_NOV18_CSS = `
:root{--deep:#592239;--green:#752b48;--muted:#735e68;--line:#e7d7d9;--white:#fffaf5;--focus:#c99d54}
body{background:#fbf7f1;color:#2d2028}
.sidebar{background:linear-gradient(160deg,#62243f 0%,#451a30 75%,#391528 100%);color:#fff9f5}
.sidebar a[aria-current="page"],.sidebar .nav-group a:hover{background:#ffffff24!important;color:white!important}
.brand{border-bottom-color:#ffffff2b}.brand img{border-radius:14px;background:#fff;object-fit:contain;padding:3px;box-shadow:0 4px 14px #230c1a45}
.top{background:#fffaf6!important;border-bottom:1px solid #ecdddd!important;color:#4d2436!important}
.top-title{color:#5e2540!important;font-weight:800!important}
.top-label,.top-user,.page-intro .lead{color:#745e67!important}
.top-ident{display:flex;gap:11px;align-items:center}.top-ident img{width:46px;height:46px;border-radius:11px;object-fit:contain;background:#fff;padding:3px;border:1px solid #eadde0}
.top-ident .trust-name{font-size:10px;color:#8a6776;font-weight:750;letter-spacing:.08em}
.page-intro .eyebrow,.eyebrow{color:#8c4d60!important}
.page-intro h1,.section-head h2,.quickhead h2{color:#452135!important}
.hero{background:linear-gradient(135deg,#66263f,#8b4260)!important;color:#fffaf6!important;border:1px solid #73344c!important}
.hero h2,.hero p,.hero .eyebrow{color:white!important}
.card,.tile,.stat,.home-finder,.search-form,.feature-link{background:#fff!important;border-color:#ebdedc!important}
.tile,.feature-link,.card,.home-finder{box-shadow:0 6px 25px #5922390a!important}
.tile:hover,.feature-link:hover{border-color:#bc879d!important;background:#fff8f5!important}
.tile strong,.feature-link strong,.stat strong{color:#592239!important}
.tile .symbol{background:#f7e8ef!important;color:#752b48!important}
.btn,.home-finder button,.search-form button{background:#742d49!important;color:#fff!important;border-color:#742d49!important}
.btn.soft,.btn.secondary{background:#f6e8ed!important;color:#672a42!important;border-color:#ecd0dc!important}
.btn:hover{filter:brightness(.98)}
input,select,textarea,.home-finder input{border-color:#ddc9d0!important;background:#fff!important;color:#35222b!important}
input:focus,button:focus-visible,a:focus-visible{outline:3px solid #c99d54!important;outline-offset:2px}
.mobilebar{background:#fffaf7!important;border-top:1px solid #ecdade!important}
.mobilebar a[aria-current="page"]{background:#f5e6ed!important;color:#6c2945!important}
.feature-grid .stat:first-child{grid-column:span 2;background:linear-gradient(105deg,#fff9f5,#f4e4eb)!important;border-color:#d9b8c6!important}
.feature-grid .stat:first-child strong{font-size:22px!important;letter-spacing:.01em;color:#64263e!important}
.mcct-donor-banner{display:flex;align-items:center;gap:15px;background:linear-gradient(110deg,#fffaf6,#f5e8ed);border:1px solid #e3cbd5;border-radius:20px;padding:18px;margin:10px 0 19px}
.mcct-donor-banner img{width:69px;height:69px;flex:none;object-fit:contain;border-radius:15px;background:#fff;padding:5px;border:1px solid #e3d1d7}
.mcct-donor-banner small{display:block;color:#79596b;font-size:11px;font-weight:800;letter-spacing:.06em}
.mcct-donor-banner strong{display:block;margin:5px 0;font-size:clamp(18px,4vw,25px);letter-spacing:.01em;color:#562138;overflow-wrap:anywhere}
.mcct-donor-banner .mcct-pill{display:inline-flex;padding:5px 10px;border-radius:99px;background:#f8e8df;color:#6e3845;font-size:11px;font-weight:800}
.mcct-donor-banner .mcct-pill.yes{background:#e1f3e9;color:#1c704a}
.mcct-process{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:7px;margin:0 0 17px}
.mcct-process span{border-radius:10px;background:#fff;border:1px solid #eadadf;text-align:center;padding:9px 5px;color:#69465a;font-size:12px;font-weight:750}
.mcct-process span b{display:block;color:#9a5070;margin-bottom:4px}
.mcct-photo-panel{margin:14px 0 19px;padding:17px;background:#fffdf9;border:1px solid #ebdcdd;border-radius:18px}
.mcct-photo-panel h2{margin:0 0 5px;color:#592239}.mcct-photo-panel .mcct-photo-help{color:#7a6370;font-size:13px;margin:0 0 13px}
.mcct-photo-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:13px}
.mcct-photo-box{display:block;overflow:hidden;border:1px solid #ecdee1;background:#fff;border-radius:13px;color:#592239;text-decoration:none}
.mcct-photo-box strong{display:block;padding:10px 12px;font-size:13px}.mcct-photo-box img{display:block;width:100%;height:220px;object-fit:contain;background:#f7f1f0}
.mcct-photo-empty{display:flex;min-height:140px;align-items:center;justify-content:center;text-align:center;padding:16px;background:#f9f5f3;color:#846e79;font-size:13px;border:1px dashed #dbcbd0;border-radius:13px}
.mcct-hardcopy{display:inline-block;margin:12px 10px 3px 0;padding:12px 16px;border-radius:11px;background:#722b48;color:white!important;font-weight:800;text-decoration:none}
@media(max-width:600px){.top-ident img{width:38px;height:38px}.top-ident .trust-name{font-size:8px}.mcct-process{grid-template-columns:repeat(5,minmax(0,1fr));gap:4px}.mcct-process span{font-size:9px;padding:7px 2px}.mcct-donor-banner{padding:14px;gap:10px}.mcct-donor-banner img{width:53px;height:53px}.mcct-photo-box img{height:166px}.feature-grid .stat:first-child{grid-column:span 1}}
@media(max-width:390px){.mcct-photo-grid{grid-template-columns:1fr}.mcct-process span{font-size:8px}}
`;
/* Existing classic Desk remains usable for staff and historical tools. */
PAGE=PAGE.replace('</style>', MCCT_NOV18_CSS.replaceAll('.sidebar','.mcct-premium-sidebar') + `
:root{background:#fbf7f1;color:#402534}body{background:#fbf7f1;color:#402534}
header{background:linear-gradient(115deg,#5c213c,#813d59)!important}
header .brand-mark{background:white}
button:not(.secondary){background:#742d49}
button.secondary{background:#f4e4eb;color:#642940}
.panel{border-color:#ead9df;box-shadow:0 6px 22px #5f21330b}
input:focus,select:focus,textarea:focus{outline-color:#b96f90}
`+'</style>');
const MCCT_NOV18_PREV_LAYOUT = mp3Layout;
mp3Layout=function(admin,current,body,title){
 let html=MCCT_NOV18_PREV_LAYOUT(admin,current,body,title);
 html=html.replace('<div class="top-title">Mamta Care · Administrator</div><div class="top-label">Simple, organized workspaces</div>',
   '<div class="top-ident"><img src="/volunteer-logo.jpeg" alt="Official Mamta Care logo"><div><div class="trust-name">MAMTA CARE CHARITABLE TRUST</div><div class="top-title">Donor Desk · Administrator</div><div class="top-label">Secure donation management</div></div></div>');
 return html.replace('</style></head>', MCCT_NOV18_CSS+'</style></head>');
};
const MCCT_NOV18_PREV_WA_CARD=mcFreeWhatsAppCard;
mcFreeWhatsAppCard=function(donor){
 let html=MCCT_NOV18_PREV_WA_CARD(donor);
 const id=String(donor?.registration_id||'').trim();
 const verified=String(donor?.verification_status||'').trim().toUpperCase()==='VERIFIED';
 let linkOk=false;
 try{const url=new URL(String(donor?.certificate_url||''));linkOk=url.protocol==='https:'&&!url.username&&!url.password}catch(_){}
 if(verified&&id&&linkOk){
   const link=HARD_COPY_URL+'?registration_id='+encodeURIComponent(id);
   html=html.replace('</section>', '<p class="help">Prefer a printed certificate? The existing hard-copy request opens in Google Apps Script.</p><a class="mcct-hardcopy" href="'+MP3_ESC(link)+'" target="_blank" rel="noopener noreferrer" referrerpolicy="no-referrer">Get a hard copy certificate</a></section>');
 }
 return html;
};
const MCCT_NOV18_PREV_DONOR=mp3DonorDetails;
mp3DonorDetails=async function(env,id){
 let html=await MCCT_NOV18_PREV_DONOR(env,id);
 if(html.includes('Donor not found'))return html;
 const donor=await env.DB.prepare('SELECT registration_id,verification_status FROM donors WHERE id=? LIMIT 1').bind(id).first();
 if(!donor)return html;
 const reg=donor.registration_id?MP3_ESC(donor.registration_id):'Awaiting official registration';
 const verified=String(donor.verification_status||'').trim().toUpperCase()==='VERIFIED';
 const banner='<section class="mcct-donor-banner"><img src="/volunteer-logo.jpeg" alt="Original Mamta Care Charitable Trust logo"><div><small>OFFICIAL MAMTA CARE REGISTRATION NUMBER</small><strong>'+reg+'</strong><span class="mcct-pill'+(verified?' yes':'')+'">'+(verified?'Verified donor':'Verification pending')+'</span></div></section>';
 const steps='<section class="mcct-process" aria-label="Donation workflow stages"><span><b>01</b>Register</span><span><b>02</b>Collect</span><span><b>03</b>Complete</span><span><b>04</b>Verify</span><span><b>05</b>Certificate</span></section>';
 let before='',after='';
 try{
  const records=await env.DB.prepare("SELECT 'before' AS side FROM mcx_before_photos WHERE donor_id=? UNION ALL SELECT 'after' AS side FROM mcx_after_photos WHERE donor_id=? UNION ALL SELECT ('website_' || side) AS side FROM website_hair_photos WHERE donor_id=? AND side IN ('before','after')").bind(id,id,id).all();
  const available=new Set((records.results||[]).map(r=>r.side));
  before=available.has('before')?'/api/donors/'+encodeURIComponent(id)+'/before-photo':available.has('website_before')?'/api/donors/'+encodeURIComponent(id)+'/website-photo/before':'';
  after=available.has('after')?'/api/donors/'+encodeURIComponent(id)+'/after-photo':available.has('website_after')?'/api/donors/'+encodeURIComponent(id)+'/website-photo/after':'';
 }catch(e){console.warn('MCCT photo preview availability temporarily unavailable');}
 const photoItem=(src,label)=>src?'<a class="mcct-photo-box" href="'+src+'" target="_blank" rel="noopener noreferrer"><strong>'+label+'</strong><img src="'+src+'" loading="lazy" alt="'+label+' photograph, private donor record"></a>':'<div class="mcct-photo-empty">'+label+' photograph not linked to this donor yet</div>';
 const photos='<section class="mcct-photo-panel"><h2>Hair donation photographs</h2><p class="mcct-photo-help">Before and after haircut · Only recorded, approved photo links are displayed.</p><div class="mcct-photo-grid">'+photoItem(before,'Before haircut')+photoItem(after,'After haircut')+'</div></section>';
 return html.replace('<div class="feature-grid">',banner+steps+photos+'<div class="feature-grid">');
};
/* End MCCT_DESK_BURGUNDY_IVORY_20261118 */
