/* MCCT_SAFE_UI_V160_20261118
 * Read-only donor presentation on top of the restored original Worker.
 * No mutation of registration, verification, Apps Script, Sheet sync, auth, cron, or WhatsApp.
 * Original classic /app?classic=1 remains unmodified and available.
 */
const MCCT_SAFE_CSS=[
':root{--deep:#5b2b42;--green:#712e4d;--muted:#74616a;--line:#eadce2;--focus:#c39955}',
'body{background:#fbf7f5;color:#322630}.bg-glow{background:radial-gradient(circle,#f5e8eb,transparent 70%)}',
'.sidebar{background:linear-gradient(155deg,#672b48,#431d33);color:#fff8fb}',
'.brand img{background:#fff;object-fit:contain;padding:4px;border-radius:12px}',
'.nav-group h2{color:#edbed0}.nav-group a{color:#ffeef4}',
'.nav-group a:hover,.nav-group a[aria-current="page"]{background:#ffffff25;color:white}',
'.top{background:#fffbf8;border-color:#efdee4}.top-title,.page-intro h1{color:#5e2946}',
'.top-label,.top-user,.lead{color:#76616c}.avatar{background:#faedf1;color:#6b2b48}',
'.hero{background:linear-gradient(115deg,#742f51,#4b1e38);box-shadow:0 18px 40px #531e3522}',
'.hero p,.hero .eyebrow{color:#ffe4ee}.tile,.card,.table-wrap{border-color:#eadde2}',
'.btn.soft{color:#6b2a49;background:#f9eef2;border-color:#ecd7df}',
'.mcct-ui-status,.mcct-ui-photos{margin:16px 0;padding:18px;border:1px solid #ead4de;background:#fffafc;border-radius:17px;box-shadow:0 6px 24px #54203808}',
'.mcct-ui-status h2,.mcct-ui-photos h2{margin:0 0 14px;color:#622a46;font-size:18px}',
'.mcct-ui-metrics{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}',
'.mcct-ui-metrics div{background:#fff;border:1px solid #eddee6;border-radius:12px;padding:13px;min-width:0}',
'.mcct-ui-metrics small{display:block;color:#76616d;font-size:12px;margin-bottom:6px}',
'.mcct-ui-metrics strong{display:block;color:#432a38;overflow-wrap:anywhere;font-size:14px}',
'.mcct-ui-metrics .is-ready{border-color:#afd8c1;background:#f6fcf8}',
'.mcct-ui-status p,.mcct-ui-photos p{color:#75636c;line-height:1.6;font-size:13px;margin:12px 0 0}',
'.mcct-ui-gallery{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}',
'.mcct-ui-photo{padding:12px;border:1px solid #eedde5;background:white;border-radius:12px;min-width:0}',
'.mcct-ui-photo b{color:#612945;font-size:13px;display:block;margin-bottom:9px}',
'.mcct-ui-photo img{display:block;width:100%;height:180px;object-fit:contain;border-radius:8px;background:#f6eff1}',
'.mcct-ui-empty{padding:18px;border:1px dashed #dec9d4;color:#75636d;border-radius:8px;font-size:12px;text-align:center}',
'@media(max-width:650px){.mcct-ui-metrics,.mcct-ui-gallery{grid-template-columns:1fr}.mcct-ui-status,.mcct-ui-photos{padding:14px}.mcct-ui-photo img{height:225px}}'
].join('');
const MCCT_UI_PREVIOUS_LAYOUT=mp3Layout;
mp3Layout=function(user,current,body,title){
 const html=MCCT_UI_PREVIOUS_LAYOUT(user,current,body,title);
 // Inject into the existing nonce-protected stylesheet (preserves strict CSP).
 return html.replace('</style></head>',MCCT_SAFE_CSS+'</style></head>');
};
const MCCT_UI_PREVIOUS_DONOR=mp3DonorDetails;
mp3DonorDetails=async function(env,id){
 const original=await MCCT_UI_PREVIOUS_DONOR(env,id);
 if(!MP3_ID.test(id))return original;
 let d;
 try{
   d=await env.DB.prepare("SELECT d.id,d.registration_id,d.verification_status,d.certificate_url,d.certificate_email_status, "+
     "EXISTS(SELECT 1 FROM website_hair_photos p WHERE p.donor_id=d.registration_id AND p.side='front') AS front, "+
     "EXISTS(SELECT 1 FROM website_hair_photos p WHERE p.donor_id=d.registration_id AND p.side='back') AS back, "+
     "EXISTS(SELECT 1 FROM mcx_before_photos p WHERE p.donor_id=d.id) AS before_haircut, "+
     "EXISTS(SELECT 1 FROM mcx_after_photos p WHERE p.donor_id=d.id) AS after_haircut "+
     "FROM donors d WHERE d.id=? LIMIT 1").bind(id).first();
 }catch(e){
   console.warn('MCCT_SAFE_DISPLAY_READ_UNAVAILABLE',String(e?.name||'Error'));
   return original;
 }
 if(!d)return original;
 const verified=String(d.verification_status||'').trim().toUpperCase()==='VERIFIED';
 const emailSent=String(d.certificate_email_status||'').trim().toUpperCase()==='SENT';
 let pdf='';
 try{const u=new URL(String(d.certificate_url||''));if(u.protocol==='https:'&&!u.username&&!u.password)pdf=u.href}catch(_){}
 const metric=(label,value,ready)=>'<div'+(ready?' class="is-ready"':'')+'><small>'+MP3_ESC(label)+'</small><strong>'+MP3_ESC(value)+'</strong></div>';
 const status='<section class="mcct-ui-status" aria-label="Verified certificate status"><h2>Donation verification and certificate</h2><div class="mcct-ui-metrics">'+
   metric('Google Sheet verification',verified?'VERIFIED':'Not verified',verified)+
   metric('Digital certificate',pdf?'Official PDF link recorded':verified?'Not yet synced or generated':'Awaiting verification',!!pdf)+
   metric('Certificate email',emailSent?'Marked SENT':'Not confirmed sent',emailSent)+
   '</div><p>These stages are distinct. If Google Sheets shows a PDF but Donor Desk does not, allow its existing synchronization to run. Do not change the donor back to PENDING to obtain a PDF.</p>'+
   (pdf?'<p>'+mp3Link(pdf,'Open official digital certificate','btn soft','target="_blank" rel="noopener noreferrer" referrerpolicy="no-referrer"')+'</p>':'')+'</section>';
 const photo=(label,available,kind)=>{
   const path='/api/donors/'+id+'/'+(kind==='front'||kind==='back'?'website-photo/'+kind:kind+'-photo');
   return '<div class="mcct-ui-photo"><b>'+MP3_ESC(label)+'</b>'+
   (available?'<a href="'+path+'" target="_blank" rel="noopener noreferrer" referrerpolicy="no-referrer"><img loading="lazy" decoding="async" src="'+path+'" alt="'+MP3_ESC(label)+' private donor photo"></a>':'<div class="mcct-ui-empty">No photo linked</div>')+
   '</div>';
 };
 const images='<section class="mcct-ui-photos" aria-label="Private donor photographs"><h2>Hair donation photos</h2><div class="mcct-ui-gallery">'+
   photo('Registration · Front',!!d.front,'front')+photo('Registration · Back',!!d.back,'back')+
   photo('Before haircut · Additional photo',!!d.before_haircut,'before')+
   photo('After haircut · Collected photo',!!d.after_haircut,'after')+
   '</div><p>Registration photos are not mislabeled as after-haircut evidence. All photos use the existing authorized private routes.</p></section>';
 const anchor='<div class="feature-grid">';
 return original.includes(anchor)?original.replace(anchor,status+images+anchor):original+status+images;
};
/* End MCCT_SAFE_UI_V160_20261118 */
