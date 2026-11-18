/* MCCT_VERIFICATION_WA_CANDIDATE_20261118
 * Isolated feature: auth-gated verification progress and human-confirmed WhatsApp handoff.
 * Does not change existing verification bridge, Apps Script, certificate generator,
 * Sheet-sync cron, email dispatch, login, donor photos or stock workflows.
 * Requires a separately reviewed D1 migration before deployment.
 */
const MCWA_PATH_PREFIX='/app/verification-flow/';
const MCWA_API_PREFIX='/api/admin/verification-flow/';
const MCWA_REVIEW_URL='https://g.page/r/CWjiEMhbzg_4EBM/review';
const MCWA_HARDCOPY_URL='https://script.google.com/macros/s/AKfycbzacLAZ3N75p97BVeCnetvCjTaEMcPtdu_37oUrPR8un96UIdA_z59W9dGHorQMyG4jQw/exec';
const MCWA_REGEXP=/^\d{4}-\d{4}\d+\/M\/2022$/;
const MCWA_UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MCWA_TABLE_SQL=`CREATE TABLE IF NOT EXISTS mc_wa_communications(
 donor_id TEXT PRIMARY KEY,
 registration_id TEXT NOT NULL,
 state TEXT NOT NULL CHECK(state IN ('OPENED','CONFIRMED')),
 opened_by TEXT NOT NULL,
 opened_at INTEGER NOT NULL,
 consent_asserted_at INTEGER NOT NULL,
 confirmed_by TEXT,
 confirmed_at INTEGER,
 last_modified INTEGER NOT NULL
)`;
function mcwaPhone(raw){
 let number=String(raw||'').trim().replace(/[\s().-]/g,'');
 if(number.startsWith('+'))number=number.slice(1);
 else if(number.startsWith('00'))number=number.slice(2);
 if(/^[6-9]\d{9}$/.test(number))number='91'+number;
 return /^91[6-9]\d{9}$/.test(number)?number:'';
}
function mcwaCertificateUrl(raw){
 try{
  const u=new URL(String(raw||'').trim());
  if(u.protocol!=='https:'||u.username||u.password||!['drive.google.com','docs.google.com'].includes(u.hostname))return '';
  return u.href;
 }catch{return ''}
}
function mcwaReady(d){
 const verified=String(d?.verification_status||'').toUpperCase().trim()==='VERIFIED';
 const pdf=mcwaCertificateUrl(d?.certificate_url);
 const emailSent=String(d?.certificate_email_status||'').toUpperCase().trim()==='SENT';
 const validID=MCWA_REGEXP.test(String(d?.registration_id||'').trim());
 const phone=mcwaPhone(d?.phone);
 const complete=!!(verified&&pdf&&emailSent&&validID&&phone&&String(d?.full_name||'').trim());
 return {verified,certificateReady:!!(verified&&pdf),emailSent:!!(verified&&pdf&&emailSent),pdf,phone,validID,complete};
}
function mcwaMessage(d){
 const r=mcwaReady(d);if(!r.complete)throw new Error('Official certificate and email must finish first');
 const name=String(d.full_name).trim(),id=String(d.registration_id).trim();
 const city=String(d.city||'Not recorded').trim()||'Not recorded';
 const length=String(d.hair_length||'Not recorded').trim()||'Not recorded';
 const email=String(d.email||'').trim();
 const hardCopy=MCWA_HARDCOPY_URL+'?registration_id='+encodeURIComponent(id);
 const body=[
  'Dear '+name+',','',
  'Thank you for choosing *Mamta Care Charitable Trust* as your trusted platform for donating your hair to support cancer patients. ❤️','',
  'We sincerely appreciate your kindness and generosity.','',
  '🌸 *Donor Name:* '+name,
  '✂️ *Hair Donated:* '+length,
  '📍 *City:* *'+city+'*',
  '🆔 *Registration Number:* *'+id+'*','',
  '✅ Your hair donation has been verified.',
  '📧 Your official digital certificate has been issued and sent to your registered email address'+(email?' ('+email+')':'')+'.','',
  '📜 *Download Your Digital Certificate:*',r.pdf,'',
  '📦 *Get a Hard Copy Certificate:*',hardCopy,'',
  '⭐ *Share Your Valuable Feedback on Google:*',MCWA_REVIEW_URL,
  'Your honest feedback is welcome. Leaving a review is optional.','',
  'With gratitude,','*Team Mamta Care Charitable Trust*','*Your Hair, Someone’s Hope.*'
 ].join('\n');
 return {body,href:'https://wa.me/'+r.phone+'?text='+encodeURIComponent(body),hardCopy,certificate:r.pdf};
}
async function mcwaLoadDonor(env,id){
 return getDonor(env.DB,id);
}
async function mcwaLoadRecord(env,id){
 return env.DB.prepare('SELECT donor_id,registration_id,state,opened_by,opened_at,consent_asserted_at,confirmed_by,confirmed_at FROM mc_wa_communications WHERE donor_id=?').bind(id).first();
}
function mcwaData(d,record){
 const s=mcwaReady(d);
 return {ok:true,donor:{
   id:d.id,full_name:d.full_name,hair_length:d.hair_length||'',city:d.city||'',
   registration_id:d.registration_id||'',email:d.email||'',phone:d.phone||'',
   verification_status:d.verification_status||'',certificate_url:s.pdf,
   certificate_email_status:d.certificate_email_status||'',followup_status:d.followup_status||'',source:d.source||'',version:d.version
 },stages:{verified:s.verified,certificateReady:s.certificateReady,emailSent:s.emailSent,whatsappReady:s.complete,
  confirmed:record?.state==='CONFIRMED'},
 communication:record?{state:record.state,opened_at:record.opened_at,
   confirmed_at:record.confirmed_at||null,confirmed_by:record.confirmed_by||null,
   opened_by:record.opened_by}:null};
}
async function mcwaApi(req,env,id,op,user){
 if(!user)return error('Sign in required',401);
 if(user.role!=='admin')return error('Administrator only',403);
 if(!MCWA_UUID.test(id))return error('Invalid donor ID',400);
 if(!env.DB)return error('Donor database unavailable',503);
 const donor=await mcwaLoadDonor(env,id);
 if(!donor)return error('Donor record not found',404);
 if(req.method==='GET'&&op==='status'){
  if(donor.source!=='google_sheet')return error('Official Sheet registration required',400);
  const record=await mcwaLoadRecord(env,id);
  return json(mcwaData(donor,record));
 }
 if(req.method!=='POST'||!allowedWrite(req))return error('Request not permitted',403);
 if(donor.source!=='google_sheet'||!MCWA_REGEXP.test(String(donor.registration_id||'')))return error('Official Sheet registration required',400);
 const input=await body(req);
 const ready=mcwaReady(donor);
 if(op==='open'){
  if(!ready.complete)return error('Certificate PDF or certificate email not ready. Check the official Sheet sync.',409);
  if(input?.consent_confirmed!==true)return error('Confirm the donor has agreed to WhatsApp contact',400);
  const prev=await mcwaLoadRecord(env,id);
  if(prev?.state==='CONFIRMED')return json({...mcwaData(donor,prev),already_confirmed:true});
  const ts=now();
  await env.DB.prepare(`INSERT INTO mc_wa_communications(donor_id,registration_id,state,opened_by,opened_at,consent_asserted_at,last_modified)
   VALUES (?,?,?,?,?,?,?) ON CONFLICT(donor_id) DO UPDATE SET
   state=CASE WHEN mc_wa_communications.state='CONFIRMED' THEN 'CONFIRMED' ELSE 'OPENED' END,
   opened_by=CASE WHEN mc_wa_communications.state='CONFIRMED' THEN mc_wa_communications.opened_by ELSE excluded.opened_by END,
   opened_at=CASE WHEN mc_wa_communications.state='CONFIRMED' THEN mc_wa_communications.opened_at ELSE excluded.opened_at END,
   consent_asserted_at=CASE WHEN mc_wa_communications.state='CONFIRMED' THEN mc_wa_communications.consent_asserted_at ELSE excluded.consent_asserted_at END,
   last_modified=CASE WHEN mc_wa_communications.state='CONFIRMED' THEN mc_wa_communications.last_modified ELSE excluded.last_modified END`).bind(id,donor.registration_id,'OPENED',user.username,ts,ts,ts).run();
  const record=await mcwaLoadRecord(env,id);
  return json({...mcwaData(donor,record),wa_url:mcwaMessage(donor).href});
 }
 if(op==='confirm'){
  if(!ready.complete)return error('Certificate state changed; cannot confirm',409);
  if(input?.sent_confirmed!==true)return error('Explicit administrator confirmation required',400);
  const record=await mcwaLoadRecord(env,id);
  if(record?.state==='CONFIRMED')return json({...mcwaData(donor,record),already_confirmed:true});
  if(record?.state!=='OPENED')return error('Open WhatsApp first',409);
  // Prevent an unrelated account confirming a message it did not open.
  if(record.opened_by!==user.username)return error('Confirm with the administrator who opened WhatsApp',403);
  if(now()-record.opened_at>86400)return error('WhatsApp task expired; reopen the message first',409);
  const ts=now();
  const result=await env.DB.batch([
   env.DB.prepare("UPDATE mc_wa_communications SET state='CONFIRMED',confirmed_by=?,confirmed_at=?,last_modified=? WHERE donor_id=? AND state='OPENED' AND opened_by=?").bind(user.username,ts,ts,id,user.username),
   env.DB.prepare(`INSERT INTO donor_events(id,donor_id,actor,action,detail_json,happened_at)
     SELECT ?,?,?,?, ?,? WHERE changes()=1`).bind(crypto.randomUUID(),id,user.username,'whatsapp_admin_confirmed_sent',JSON.stringify({registration_id:donor.registration_id,channel:'manual_wa_me',delivery_verified:false}),ts)
  ]);
  if(result[0]?.meta?.changes!==1){
   const cur=await mcwaLoadRecord(env,id);
   if(cur?.state==='CONFIRMED')return json({...mcwaData(donor,cur),already_confirmed:true});
   return error('Could not record WhatsApp confirmation',409);
  }
  return json(mcwaData(donor,await mcwaLoadRecord(env,id)));
 }
 return error('Unknown operation',404);
}
function mcwaEsc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
const MCWA_CSS=String.raw`
:root{font-family:system-ui,-apple-system,Segoe UI,sans-serif;color:#352b34;background:#f7f0f4;--wine:#692b47;--green:#218257}
*{box-sizing:border-box}body{margin:0}button,input{font:inherit}button{cursor:pointer}
.shell{width:min(440px,100%);margin:auto;background:#fffaf9;min-height:100vh;box-shadow:0 14px 60px #4a28341b}
.top{background:linear-gradient(125deg,#73324f,#442036);color:white;padding:20px 18px 24px}
.brand{display:flex;align-items:center;gap:11px}.brand img{height:61px;width:61px;border-radius:10px;object-fit:contain;background:white}
.brand strong{font-size:15px;line-height:1.3}.brand small{display:block;color:#f1cede;font-size:11px;margin-top:5px}
.top h1{font-size:23px;margin:20px 0 5px;color:white}.top p{font-size:12px;color:#f7d9e6;margin:0}
.body{padding:15px}.panel{border:1px solid #e9dbe3;border-radius:15px;background:white;padding:15px;margin-bottom:12px}
.eyebrow{font-size:10px;text-transform:uppercase;letter-spacing:.12em;color:#a56f89;font-weight:800}
.person{font-size:19px;color:#59293e;font-weight:800;margin:4px 0 8px}.facts{color:#7a6070;font-size:12px;line-height:1.6}
.reg{margin-top:11px;border-radius:10px;background:#f9edf2;color:#622b45;font-weight:800;padding:10px;overflow-wrap:anywhere}
.headline{display:flex;align-items:center;justify-content:space-between;gap:8px;font-size:15px;font-weight:800;color:#452b3b}
.progress{height:6px;background:#f0e7ec;border-radius:30px;overflow:hidden;margin:14px 0 20px}
.fill{height:100%;background:#299363;transition:width .3s ease;width:0}
.step{display:grid;grid-template-columns:38px 1fr;gap:9px;position:relative;min-height:69px}
.step:last-child{min-height:42px}.step:not(:last-child):before{content:"";position:absolute;top:36px;bottom:0;left:18px;width:2px;background:#e9e1e6}
.step.done:not(:last-child):before{background:#329b69}
.dot{width:38px;height:38px;display:grid;place-items:center;background:#f8f4f6;border:2px solid #e9e0e5;border-radius:50%;font-weight:850;color:#aa9aa4;position:relative;z-index:1}
.step.done .dot{border-color:#278c5b;background:#278c5b;color:white}.step.active .dot{background:#f9eaf1;border-color:#bc839e}
.step b{display:block;color:#443444;font-size:12px;padding-top:2px}.step.done b{color:#23784c}
.step p{margin:4px 0;font-size:11px;color:#867682;line-height:1.4}
.spinner{width:19px;height:19px;border:2px solid #eac5d4;border-top-color:#702b4c;border-radius:50%;animation:mcwa-rotate .7s linear infinite}
@keyframes mcwa-rotate{to{transform:rotate(360deg)}}@media(prefers-reduced-motion:reduce){.spinner{animation:none}.fill{transition:none}}
.status{font-size:12px;line-height:1.55;background:#f9f1f5;color:#72455e;border:1px solid #ecd8e4;border-radius:12px;padding:12px;margin:10px 0}
.status.good{background:#f0faf4;color:#26734e;border-color:#c4dfce}.status.bad{background:#fff3ed;color:#985342;border-color:#f0d4c5}
.action{background:#702d49;color:#fff;width:100%;min-height:48px;border:0;border-radius:11px;font-weight:800;padding:12px;margin-top:10px}
.action.green{background:#18784b}.action.ghost{background:#faeff4;color:#632d46;border:1px solid #e9d6e1}
.action:disabled{opacity:.5;cursor:not-allowed}
.message{background:#eaf7ee;border:1px solid #cce2d3;padding:12px;line-height:1.5;white-space:pre-wrap;overflow-wrap:anywhere;border-radius:12px;font-size:12px;max-height:420px;overflow-y:auto}
.consent{display:flex;align-items:flex-start;gap:8px;padding:12px;border-radius:10px;background:#fff7eb;border:1px solid #ebd9b8;margin-top:13px;font-size:12px;line-height:1.55}
.consent input{margin-top:3px;accent-color:#1b7e54}.hint{color:#876d7d;font-size:11px;line-height:1.6}
.footer{margin:15px 0;text-align:center;font-size:10px;color:#967f8b}.hidden,[hidden]{display:none!important}
a{color:inherit}a:focus-visible,button:focus-visible{outline:3px solid #dbb76d;outline-offset:3px}
`;
const MCWA_BROWSER=String.raw`(function(){
'use strict';
const root=document.getElementById('mcwa-root');if(!root)return;
const $=id=>document.getElementById(id),id=root.dataset.donorId;
const mk=(tag,text)=>{const el=document.createElement(tag);if(text!=null)el.textContent=String(text);return el};
let data=null,verifiedPosted=false,posting=false,opened=false,pollTimer=null,attempts=0;
const stages=[['Verification submitted','Google Apps Script request accepted'],['Verified in Google Sheets','Existing official verification status'],['Digital certificate generated','Official PDF link synced'],['Certificate email sent','Google Sheet email status SENT'],['WhatsApp prepared','All donor details and links available'],['WhatsApp sent confirmed','Administrator confirmation saved']];
function log(msg,kind=''){const el=$('mcwa-status');el.textContent=msg;el.className='status'+(kind?' '+kind:'');}
function render(){if(!data)return;
 const s=data.stages,record=data.communication||{},donor=data.donor||{};
 const flags=[verifiedPosted||s.verified,s.verified,s.certificateReady,s.emailSent,s.whatsappReady,s.confirmed];
 const container=$('mcwa-steps');container.replaceChildren();
 let allPrevious=true;
 stages.forEach((item,i)=>{
  const done=!!flags[i],active=!done&&allPrevious&&(posting||i>0);
  const el=mk('div');el.className='step'+(done?' done':active?' active':'');
  const dot=mk('div');dot.className='dot';if(done)dot.textContent='✓';else if(active){const spinner=mk('span');spinner.className='spinner';dot.appendChild(spinner)}else dot.textContent=String(i+1);
  const info=mk('div'),title=mk('b',item[0]),description=mk('p',done?'Confirmed':active?'Waiting for recorded result…':item[1]);info.append(title,description);el.append(dot,info);container.appendChild(el);
  if(!done)allPrevious=false;
 });
 $('mcwa-fill').style.width=Math.round(flags.filter(Boolean).length/stages.length*100)+'%';
 $('mcwa-verify').hidden=posting||s.verified||donor.source!=='google_sheet'||donor.followup_status!=='Completed';
 $('mcwa-verify').disabled=posting;
 $('mcwa-panel').hidden=!s.whatsappReady||s.confirmed;
 $('mcwa-confirm').disabled=!s.whatsappReady||record.state!=='OPENED';
 $('mcwa-confirmed').hidden=!s.confirmed;
 $('mcwa-contact').textContent=donor.full_name||'Donor';
 $('mcwa-facts').textContent='✂ '+(donor.hair_length||'Not recorded')+' · 📍 '+(donor.city||'Not recorded')+' · ✉ '+(donor.email||'Not recorded');
 $('mcwa-registration').textContent=donor.registration_id||'Not recorded';
 if(s.whatsappReady){
  const body=window.mcwaCompose?window.mcwaCompose(donor):null;
  $('mcwa-message').textContent=body?.text||'Certificate information ready. Open WhatsApp to prepare the message.';
 }
 if(s.confirmed)log('✓ Administrator confirmed WhatsApp sent. The donor communication task is completed.','good');
 else if(s.whatsappReady)log(record.state==='OPENED'?'WhatsApp opened; send the message, then confirm it here.':'Certificate and email confirmed. WhatsApp communication is ready.','good');
 else if(s.verified&&!s.certificateReady)log('Google Sheet verified. Waiting for the official digital certificate link; do not verify again.');
 else if(s.certificateReady&&!s.emailSent)log('Certificate PDF ready. Waiting for certificate email status SENT.');
 else if(posting)log('Submitting verification through the original Google Sheet bridge…');
 else log('Ready for official verification.');
}
function cleanPhone(x){let v=String(x||'').trim().replace(/[\s().-]/g,'');if(v.startsWith('+'))v=v.slice(1);else if(v.startsWith('00'))v=v.slice(2);if(/^[6-9]\d{9}$/.test(v))v='91'+v;return /^91[6-9]\d{9}$/.test(v)?v:'';}
function whatsapp(d){
 const name=String(d.full_name||'').trim(),id=String(d.registration_id||'').trim(),email=String(d.email||'').trim();
 const hard='${'${MCWA_HARDCOPY_URL}'}'+'?registration_id='+encodeURIComponent(id);
 const lines=['Dear '+name+',','','Thank you for choosing *Mamta Care Charitable Trust* as your trusted platform for donating your hair to support cancer patients. ❤️','','We sincerely appreciate your kindness and generosity.','','🌸 *Donor Name:* '+name,'✂️ *Hair Donated:* '+(d.hair_length||'Not recorded'),'📍 *City:* *'+(d.city||'Not recorded')+'*','🆔 *Registration Number:* *'+id+'*','','✅ Your hair donation has been verified.','📧 Your official digital certificate has been issued and sent to your registered email address'+(email?' ('+email+')':'')+'.','','📜 *Download Your Digital Certificate:*',d.certificate_url,'','📦 *Get a Hard Copy Certificate:*',hard,'','⭐ *Share Your Valuable Feedback on Google:*','${'${MCWA_REVIEW_URL}'}','Your honest feedback is welcome. Leaving a review is optional.','','With gratitude,','*Team Mamta Care Charitable Trust*','*Your Hair, Someone’s Hope.*'];
 const text=lines.join('\n'),phone=cleanPhone(d.phone);
 return {text,url:phone?'https://wa.me/'+phone+'?text='+encodeURIComponent(text):''};
}
window.mcwaCompose=whatsapp;
async function request(path,opts){const response=await fetch(path,{credentials:'same-origin',cache:'no-store',...(opts||{})});const result=await response.json().catch(()=>({ok:false,error:'Invalid response'}));if(!response.ok||!result.ok)throw Error(result.error||'Request failed');return result;}
async function poll(){if(!document.getElementById('mcwa-root'))return;
 try{data=await request('/api/admin/verification-flow/'+id);render();attempts=0;}
 catch(e){attempts++;log('Status refresh unavailable: '+e.message,'bad');}
 if(!data?.stages?.confirmed){pollTimer=setTimeout(poll,attempts>2?20000:9000)}
}
$('mcwa-verify').addEventListener('click',async()=>{
 if(posting||!data?.donor||data.stages.verified)return;
 if(!confirm('Verify through the original Google Sheets Apps Script? This may send the certificate email.'))return;
 posting=true;render();
 try{const p=await request('/api/admin/verify-donor',{method:'POST',headers:{'Content-Type':'application/json','X-Mamta-Desk':'1'},body:JSON.stringify({id,version:data.donor.version})});
  if(p.verified!==true)throw Error('Google Sheet verification not confirmed');
  verifiedPosted=true;
 }catch(e){log('Verification not confirmed: '+e.message,'bad');}
 finally{posting=false;await poll()}
});
$('mcwa-open').addEventListener('click',async()=>{
 if(!data?.stages.whatsappReady)return;
 if(!$('mcwa-consent').checked){log('Please confirm the donor agreed to receive this WhatsApp communication.','bad');return}
 const w=window.open('about:blank','_blank');
 try{const result=await request('/api/admin/verification-flow/'+id+'/open',{method:'POST',headers:{'Content-Type':'application/json','X-Mamta-Desk':'1'},body:JSON.stringify({consent_confirmed:true})});
  data=result;render();const msg=whatsapp(data.donor);if(!msg.url)throw Error('WhatsApp number is invalid');
  if(w)w.location.href=msg.url;else{const el=$('mcwa-fallback');el.href=msg.url;el.hidden=false;}
 }catch(e){if(w)w.close();log('Could not open WhatsApp: '+e.message,'bad')}
});
$('mcwa-confirm').addEventListener('click',async()=>{
 if(!data?.stages.whatsappReady||data.communication?.state!=='OPENED')return;
 if(!confirm('Have you actually sent the WhatsApp message to the donor? This records your confirmation, not delivery proof.'))return;
 const button=$('mcwa-confirm');button.disabled=true;
 try{data=await request('/api/admin/verification-flow/'+id+'/confirm',{method:'POST',headers:{'Content-Type':'application/json','X-Mamta-Desk':'1'},body:JSON.stringify({sent_confirmed:true})});render()}
 catch(e){log('Confirmation could not be saved: '+e.message,'bad');button.disabled=false}
});
$('mcwa-refresh').addEventListener('click',()=>{if(pollTimer)clearTimeout(pollTimer);poll()});
window.addEventListener('pagehide',()=>{if(pollTimer)clearTimeout(pollTimer)});
poll();
})();`;
function mcwaScreen(id){
 const h=mcwaEsc(id);
 const nonceBytes=new Uint8Array(16);crypto.getRandomValues(nonceBytes);
 const nonce=Array.from(nonceBytes).map(x=>x.toString(16).padStart(2,'0')).join('');
 const markup=`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><meta name="theme-color" content="#692b47"><title>Verify Donor · Mamta Care</title><style nonce="${nonce}">${MCWA_CSS}</style></head><body><main id="mcwa-root" class="shell" data-donor-id="${h}">
 <header class="top"><div class="brand"><img src="/volunteer-logo.jpeg" alt="Original Mamta Care Charitable Trust logo"><div><strong>Mamta Care Charitable Trust</strong><small>Administrator · Donor Desk</small></div></div><h1>Verify Hair Donation</h1><p>Google Sheet → Digital Certificate → WhatsApp</p></header>
 <div class="body"><div class="panel"><span class="eyebrow">OFFICIAL DONOR RECORD</span><div id="mcwa-contact" class="person">Loading…</div><div id="mcwa-facts" class="facts"></div><div id="mcwa-registration" class="reg">Loading registration…</div></div>
 <div class="panel"><div class="headline"><span>Verification progress</span><span class="eyebrow">LIVE STATUS</span></div><div class="progress"><div class="fill" id="mcwa-fill"></div></div><div id="mcwa-steps"></div></div>
 <div class="status" id="mcwa-status" role="status">Checking official donor status…</div>
 <button type="button" id="mcwa-verify" class="action" hidden>✓ Verify Donor</button>
 <section class="panel" id="mcwa-panel" hidden><div class="headline"><span>WhatsApp certificate message</span><span>💬</span></div><p class="hint">Prepared from the official donor record after certificate and email confirmation. Opens your normal WhatsApp app with a single prefilled message.</p><div class="message" id="mcwa-message"></div>
 <label class="consent"><input type="checkbox" id="mcwa-consent"><span>I confirm the donor agreed to receive certificate information by WhatsApp at their registered number.</span></label>
 <button type="button" class="action green" id="mcwa-open">Open WhatsApp with Message</button><a id="mcwa-fallback" class="action green" target="_blank" rel="noopener noreferrer" href="#" hidden>Tap to open WhatsApp</a>
 <button type="button" id="mcwa-confirm" class="action" disabled>✓ I Have Sent the WhatsApp Message</button>
 <p class="hint">Opening WhatsApp does not prove sending or delivery. Only your explicit confirmation completes the administrative communication task.</p></section>
 <section id="mcwa-confirmed" class="panel" hidden><div class="status good">✓ WhatsApp message manually confirmed sent and saved in Donor Desk. The donor's original verification and certificate records remain unchanged.</div></section>
 <button id="mcwa-refresh" type="button" class="action ghost">↻ Refresh Status</button><a class="action ghost" href="/app/premium/donors">← Back to Donors</a>
 <p class="footer">Mamta Care Charitable Trust · Administrator-only · Original certificate workflow preserved</p></div></main>
 <script nonce="${nonce}">${MCWA_BROWSER.replaceAll('${MCWA_HARDCOPY_URL}',MCWA_HARDCOPY_URL).replaceAll('${MCWA_REVIEW_URL}',MCWA_REVIEW_URL)}</script></body></html>`;
 return new Response(markup,{status:200,headers:{
  'content-type':'text/html; charset=utf-8','cache-control':'private,no-store',
  'x-content-type-options':'nosniff','referrer-policy':'no-referrer',
  'x-frame-options':'DENY','x-robots-tag':'noindex,nofollow',
  'content-security-policy':`default-src 'none'; style-src 'nonce-${nonce}'; script-src 'nonce-${nonce}'; connect-src 'self'; img-src 'self'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'`
 }});
}
const MCWA_OLD_DETAIL=mp3DonorDetails;
mp3DonorDetails=async function(env,id){
 const html=await MCWA_OLD_DETAIL(env,id);
 if(!MCWA_UUID.test(id))return html;
 const d=await env.DB.prepare('SELECT source,followup_status,verification_status FROM donors WHERE id=?').bind(id).first();
 if(!d||d.source!=='google_sheet'||(d.followup_status!=='Completed'&&String(d.verification_status).toUpperCase()!=='VERIFIED'))return html;
 return html+'<div class="card"><h2>Certificate & WhatsApp verification</h2><p class="help">Open the original verification workflow with real certificate and email checks. WhatsApp remains pending until you confirm sending.</p>'+mp3Link(MCWA_PATH_PREFIX+id,'Open verification progress','btn soft')+'</div>';
};
const MCWA_FETCH_ORIGINAL=launch_wig_maker_portal_worker_default.fetch;
launch_wig_maker_portal_worker_default.fetch=async function(req,env,ctx){
 const url=new URL(req.url),path=url.pathname;
 const m=path.match(/^\/app\/verification-flow\/([0-9a-f-]{36})$/i);
 const a=path.match(/^\/api\/admin\/verification-flow\/([0-9a-f-]{36})(?:\/(open|confirm))?$/i);
 if(!m&&!a)return MCWA_FETCH_ORIGINAL.call(this,req,env,ctx);
 if(!env.DB)return error('Donor database unavailable',503);
 let user;try{user=await currentUser(req,env.DB)}catch{return error('Sign-in check unavailable',503)}
 if(!user)return error('Sign in required',401);
 if(user.role!=='admin')return error('Administrator only',403);
 if(m){
  if(req.method!=='GET')return error('Method not allowed',405);
  if(!MCWA_UUID.test(m[1]))return error('Invalid donor ID',400);
  const donor=await mcwaLoadDonor(env,m[1]);
  if(!donor)return error('Donor not found',404);
  if(donor.source!=='google_sheet')return error('Only official Sheet donor records supported',400);
  return mcwaScreen(m[1]);
 }
 if(a)return mcwaApi(req,env,a[1],a[2]||'status',user);
 return error('Not found',404);
};
/* END MCCT_VERIFICATION_WA_CANDIDATE_20261118 */