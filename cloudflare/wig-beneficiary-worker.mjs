// Staged Worker integration. Never enable financial or patient sending gates merely
// because a relay health check succeeds. All real sends require adopted policy.
import {createAgreement,POLICY_VERSION} from './wig-beneficiary-agreement.mjs';
const api='/api/admin/wig-beneficiary-agreements',publicPath='/wig-agreement/accept/';
const ORIGIN='https://mamta-donor-desk-launch-new.bharathairseva-in.workers.dev';
const headers={'cache-control':'private,no-store','referrer-policy':'no-referrer','x-content-type-options':'nosniff','x-robots-tag':'noindex,nofollow'};
const json=(obj,status=200)=>new Response(JSON.stringify(obj),{status,headers:{...headers,'content-type':'application/json; charset=utf-8'}});
const fail=(message,status=400)=>json({ok:false,error:message},status);
const utf8=new TextEncoder();
const hex=b=>Array.from(new Uint8Array(b),x=>x.toString(16).padStart(2,'0')).join('');
const sha=async b=>hex(await crypto.subtle.digest('SHA-256',typeof b==='string'?utf8.encode(b):b));
const randomHex=()=>hex(crypto.getRandomValues(new Uint8Array(32)));
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const norm=s=>String(s??'').normalize('NFKC').trim().replace(/\s+/g,' ').toLowerCase();
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const tokenPattern=/^[a-f0-9]{64}$/;
const sendEnabled=e=>e.WIG_AGREEMENT_SEND_ENABLED==='true'&&e.WIG_AGREEMENT_ADOPTED_POLICY===POLICY_VERSION;
const effective=e=>Number(e.WIG_AGREEMENT_POLICY_EFFECTIVE_AT);
function writeOK(req){return req.headers.get('origin')===ORIGIN&&req.headers.get('x-mamta-desk')==='1'&&/^application\/json(?:;|$)/i.test(req.headers.get('content-type')||'');}
function equal(a,b){if(typeof a!=='string'||typeof b!=='string'||a.length!==b.length)return false;let d=0;for(let i=0;i<a.length;i++)d|=a.charCodeAt(i)^b.charCodeAt(i);return d===0;}
async function otpHash(env,salt,otp){const secret=env.MC_SIGNING_HASH_SECRET;if(typeof secret!=='string'||secret.length<32)throw Error('Signing configuration unavailable');const key=await crypto.subtle.importKey('raw',utf8.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);return hex(await crypto.subtle.sign('HMAC',key,utf8.encode(salt+':'+otp)));}
function makeOtp(){let n;do{n=crypto.getRandomValues(new Uint32Array(1))[0]}while(n>=4294000000);return String(n%1000000).padStart(6,'0');}
async function relay(env,payload){const url=env.WIG_AGREEMENT_RELAY_URL,secret=env.WIG_AGREEMENT_RELAY_SECRET;if(typeof url!=='string'||!/^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(url)||typeof secret!=='string'||secret.length<48)throw Error('Relay unavailable');const res=await fetch(url,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({...payload,secret}),redirect:'follow',signal:AbortSignal.timeout(35000)});if(!res.ok)throw Error('Relay unavailable');return res.json();}
async function render(env,a){const p=await relay(env,{action:'wig_agreement_render',agreement:a});if(p?.ok!==true||typeof p.pdf_base64!=='string'||p.pdf_base64.length>7000000||!tokenPattern.test(p.document_digest||''))throw Error('PDF rendering failed');const bytes=Uint8Array.from(atob(p.pdf_base64),c=>c.charCodeAt(0));if(bytes.length<100||bytes.length>5000000||String.fromCharCode(...bytes.slice(0,5))!=='%PDF-'||await sha(bytes)!==p.document_digest)throw Error('PDF integrity failed');return {bytes,base64:p.pdf_base64,digest:p.document_digest};}
const q=(env,s,...v)=>env.DB.prepare(s).bind(...v);
const changed=r=>Number(r?.meta?.changes||0);
async function row(env,id){return q(env,'SELECT * FROM mcwig_beneficiary_agreement_v1 WHERE id=?',id).first();}
async function currentCase(env,id){return q(env,"SELECT id,registration_id,patient_name,email,approved_at FROM mcwig_cases_v1 WHERE id=? AND status='APPROVED'",id).first();}
async function loadPdf(env,a){const obj=await env.DONOR_PHOTOS.get(a.document_key);if(!obj||obj.size>5000000)throw Error('PDF not found');const bytes=new Uint8Array(await obj.arrayBuffer());if(await sha(bytes)!==a.document_digest)throw Error('PDF integrity failed');return bytes;}
function encodeBytes(bytes){let s='';for(let i=0;i<bytes.length;i+=8192)s+=String.fromCharCode(...bytes.subarray(i,i+8192));return btoa(s);}
const eligible=(env,c)=>sendEnabled(env)&&Number.isFinite(effective(env))&&effective(env)>0&&Number(c.approved_at)>=effective(env);
async function prepare(req,env,user,id){const c=await currentCase(env,id);if(!c)return fail('Approved case not found',404);if(!eligible(env,c))return fail('Policy not activated for this case; no retrospective charges',409);const b=await req.json();if(!Number.isSafeInteger(b.deposit)||!Number.isSafeInteger(b.expenses))return fail('Confirm exact applicable amounts');const old=await q(env,"SELECT id,status FROM mcwig_beneficiary_agreement_v1 WHERE case_id=? AND status!='SUPERSEDED'",id).first();if(old)return fail('An agreement already exists; use its status',409);
 const agreementId=crypto.randomUUID(),reference='MC-WIG-'+agreementId,now=Date.now();
 const a=createAgreement({caseId:id,registrationId:c.registration_id,patientName:c.patient_name,email:c.email,approved:true,deposit:b.deposit,expenses:b.expenses,reference,policyVersion:POLICY_VERSION,policyAdopted:true,now});
 const snapshot={...a,status:'DRAFT'},pdf=await render(env,snapshot),key='wig-agreement-private/'+agreementId+'/original.pdf';
 await env.DONOR_PHOTOS.put(key,pdf.bytes,{httpMetadata:{contentType:'application/pdf'}});
 try{await q(env,"INSERT INTO mcwig_beneficiary_agreement_v1(id,case_id,revision,reference,policy_version,snapshot_json,document_key,document_digest,deposit,expenses,status,created_by,created_at) VALUES(?,?,1,?,?,?,?,?,?,?,'DRAFT',?,?)",agreementId,id,reference,POLICY_VERSION,JSON.stringify(snapshot),key,pdf.digest,a.deposit,a.expenses,user.username,now).run();}catch(e){await env.DONOR_PHOTOS.delete(key);throw e}
 return json({ok:true,id:agreementId,document_digest:pdf.digest,status:'DRAFT'});
}
async function sendFirst(req,env,user,a){if(!sendEnabled(env)||a.status!=='DRAFT')return fail('Agreement not eligible for sending',409);const c=await currentCase(env,a.case_id);if(!c||!eligible(env,c))return fail('Case no longer eligible',409);const b=await req.json(),s=JSON.parse(a.snapshot_json);
 if(b.reviewed!==true||b.document_digest!==a.document_digest||norm(c.email)!==norm(s.email)||norm(c.patient_name)!==norm(s.patientName)||c.registration_id!==s.registrationId)return fail('Review current exact agreement and recipient first',409);
 const h=await relay(env,{action:'wig_agreement_health'});if(h?.ok!==true||h.ready_send!==true||!(h.quota>0))return fail('Email relay sending is disabled or quota exhausted',503);
 const bytes=await loadPdf(env,a),token=randomHex(),salt=randomHex(),otp=makeOtp(),now=Date.now(),id=a.reference+':agreement';
 // Atomic reservation. A duplicate or ambiguous result must never be automatically replayed.
 await env.DB.batch([
 q(env,'INSERT INTO mcwig_beneficiary_challenge_v1(agreement_id,token_hash,otp_hash,otp_salt,expires_at) VALUES(?,?,?,?,?)',a.id,await sha(token),await otpHash(env,salt,otp),salt,now+48*3600000),
 q(env,"INSERT INTO mcwig_beneficiary_mail_v1(message_id,agreement_id,kind,state,created_at,updated_at) VALUES(?,?,'AGREEMENT','PROCESSING',?,?)",id,a.id,now,now)
 ]);
 let response;try{response=await relay(env,{action:'wig_agreement_send',message_id:id,kind:'AGREEMENT',to:s.email,patient_name:s.patientName,registration_id:s.registrationId,link:ORIGIN+publicPath+token,otp,pdf_base64:encodeBytes(bytes)});}catch{}
 if(response?.ok===true&&response.sent===true&&response.message_id===id){
  await env.DB.batch([q(env,"UPDATE mcwig_beneficiary_mail_v1 SET state='SENT',updated_at=? WHERE message_id=? AND state='PROCESSING'",Date.now(),id),q(env,"UPDATE mcwig_beneficiary_agreement_v1 SET status='AWAITING_ACCEPTANCE',sent_at=? WHERE id=? AND status='DRAFT'",Date.now(),a.id)]);
  return json({ok:true,status:'AWAITING_ACCEPTANCE',provider_accepted:true,delivery_confirmed:false});
 }
 await q(env,"UPDATE mcwig_beneficiary_mail_v1 SET state='UNKNOWN',updated_at=? WHERE message_id=? AND state='PROCESSING'",Date.now(),id).run();
 return fail('Send outcome requires reconciliation; do not send again',502);
}
async function reconcile(env,a){const id=a.reference+':agreement',m=await q(env,'SELECT state FROM mcwig_beneficiary_mail_v1 WHERE message_id=?',id).first();if(!m)return fail('No send attempt',404);if(m.state==='SENT')return json({ok:true,status:a.status});if(!['PROCESSING','UNKNOWN'].includes(m.state))return fail('Review send state',409);
 const r=await relay(env,{action:'wig_agreement_status',message_id:id});if(r?.ok!==true||r.message_id!==id||r.sent!==true||r.state!=='SENT')return fail('Provider has not confirmed sending; do not replay',409);
 await env.DB.batch([q(env,"UPDATE mcwig_beneficiary_mail_v1 SET state='SENT',updated_at=? WHERE message_id=? AND state IN ('PROCESSING','UNKNOWN')",Date.now(),id),q(env,"UPDATE mcwig_beneficiary_agreement_v1 SET status='AWAITING_ACCEPTANCE',sent_at=? WHERE id=? AND status='DRAFT'",Date.now(),a.id)]);
 return json({ok:true,status:'AWAITING_ACCEPTANCE',provider_accepted:true,delivery_confirmed:false});
}
function page(body,status=200){return new Response('<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Wig assistance agreement</title><main><h1>Mamta Care Charitable Trust</h1>'+body+'</main></html>',{status,headers:{...headers,'content-type':'text/html; charset=utf-8','content-security-policy':"default-src 'none'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'"}});}

const paymentPath='/wig-agreement/payment/';
function destination(env){
 const upi=String(env.WIG_AGREEMENT_TRUST_UPI_ID||''),payee=String(env.WIG_AGREEMENT_TRUST_PAYEE||''),qr=String(env.WIG_AGREEMENT_TRUST_QR_URL||'');
 if(env.WIG_AGREEMENT_DESTINATION_VERIFIED!=='true'||!/^[a-z0-9._-]+@[a-z0-9.-]+$/i.test(upi)||payee!=='Mamta Care Charitable Trust')return null;
 let u;try{u=new URL(qr)}catch{return null}
 if(u.protocol!=='https:'||u.username||u.password||u.search||u.hash||u.hostname!==String(env.WIG_AGREEMENT_TRUST_QR_HOST||''))return null;
 return {upi,payee,qr};
}
async function destinationDigest(d){return sha(JSON.stringify(d));}
async function releasePayment(env,agreementId){
 const a=await row(env,agreementId);
 if(!a||a.status!=='ACCEPTED'||!a.accepted_at||!a.acceptance_reference)return {ok:false,reason:'acceptance_required'};
 const c=await currentCase(env,a.case_id);
 if(!c||!eligible(env,c))return {ok:false,reason:'policy_or_case_hold'};
 const m=await q(env,"SELECT state FROM mcwig_beneficiary_mail_v1 WHERE agreement_id=? AND kind='PAYMENT'",a.id).first();
 if(!m||m.state!=='HOLD')return {ok:false,reason:'already_reserved_or_needs_review'};
 const s=JSON.parse(a.snapshot_json),amount=a.deposit+a.expenses;
 if(norm(c.email)!==norm(s.email)||norm(c.patient_name)!==norm(s.patientName)||c.registration_id!==s.registrationId)return {ok:false,reason:'recipient_changed'};
 const d=destination(env);
 if(!d&&amount>0)return {ok:false,reason:'verified_trust_destination_required'};
 const h=await relay(env,{action:'wig_agreement_health'});
 if(h?.ok!==true||h.ready_send!==true||!(h.quota>0))return {ok:false,reason:'relay_disabled_or_quota'};
 // The accepted PDF is generated from the immutable original snapshot.
 const accepted=await render(env,{...s,status:'ACCEPTED',acceptedAt:a.accepted_at,acceptanceReference:a.acceptance_reference,originalDocumentDigest:a.document_digest});
 const key='wig-agreement-private/'+a.id+'/accepted-'+crypto.randomUUID()+'.pdf',token=randomHex(),now=Date.now(),id=a.reference+':payment';
 const digest=amount>0?await destinationDigest(d):'WAIVER';
 await env.DONOR_PHOTOS.put(key,accepted.bytes,{httpMetadata:{contentType:'application/pdf'}});
 try{
  await env.DB.batch([
   q(env,"INSERT INTO mcwig_beneficiary_payment_link_v1(agreement_id,token_hash,destination_digest,amount,expires_at) SELECT id,?,?,?,? FROM mcwig_beneficiary_agreement_v1 WHERE id=? AND status='ACCEPTED' AND EXISTS(SELECT 1 FROM mcwig_beneficiary_mail_v1 WHERE agreement_id=? AND kind='PAYMENT' AND state='HOLD')",await sha(token),digest,amount,now+30*86400000,a.id,a.id),
   q(env,"UPDATE mcwig_beneficiary_mail_v1 SET state='PROCESSING',updated_at=? WHERE message_id=? AND state='HOLD' AND EXISTS(SELECT 1 FROM mcwig_beneficiary_payment_link_v1 WHERE agreement_id=? AND token_hash=?)",now,id,a.id,await sha(token)),
   q(env,"UPDATE mcwig_beneficiary_agreement_v1 SET accepted_document_key=? WHERE id=? AND status='ACCEPTED' AND EXISTS(SELECT 1 FROM mcwig_beneficiary_payment_link_v1 WHERE agreement_id=? AND token_hash=?)",key,a.id,a.id,await sha(token))
  ]).then(results=>{if(results.some(x=>changed(x)!==1))throw Error('Reservation conflict')});
 }catch(e){const reserved=await q(env,'SELECT accepted_document_key FROM mcwig_beneficiary_agreement_v1 WHERE id=?',a.id).first().catch(()=>null);if(reserved&&reserved.accepted_document_key!==key)await env.DONOR_PHOTOS.delete(key);return {ok:false,reason:'reservation_needs_review'}}
 let r;try{r=await relay(env,{action:'wig_agreement_send',message_id:id,kind:'PAYMENT',to:s.email,patient_name:s.patientName,registration_id:s.registrationId,link:ORIGIN+paymentPath+token,amount,deposit:a.deposit,expenses:a.expenses,accepted:true,acceptance_reference:a.acceptance_reference,destination_verified:amount>0?true:false,waived:amount===0,pdf_base64:accepted.base64});}catch{}
 if(r?.ok===true&&r.sent===true&&r.message_id===id){
  await env.DB.batch([q(env,"UPDATE mcwig_beneficiary_mail_v1 SET state='SENT',updated_at=? WHERE message_id=? AND state='PROCESSING'",Date.now(),id),q(env,"UPDATE mcwig_beneficiary_agreement_v1 SET status=?,payment_email_sent_at=? WHERE id=? AND status='ACCEPTED'",amount===0?'WAIVED':'AWAITING_PAYMENT',Date.now(),a.id)]);
  return {ok:true,status:amount===0?'WAIVED':'AWAITING_PAYMENT'};
 }
 await q(env,"UPDATE mcwig_beneficiary_mail_v1 SET state='UNKNOWN',updated_at=? WHERE message_id=? AND state='PROCESSING'",Date.now(),id).run();
 return {ok:false,reason:'provider_outcome_requires_reconciliation'};
}
async function paymentPage(req,env,u){
 const token=u.pathname.slice(paymentPath.length);
 if(req.method!=='GET'||u.origin!==ORIGIN||!tokenPattern.test(token))return page('<p>Invalid payment link.</p>',404);
 try{
  const a=await q(env,"SELECT a.status,a.accepted_at,a.reference,l.amount,l.expires_at,l.destination_digest FROM mcwig_beneficiary_payment_link_v1 l JOIN mcwig_beneficiary_agreement_v1 a ON a.id=l.agreement_id WHERE l.token_hash=?",await sha(token)).first();
  if(!a||!a.accepted_at||a.expires_at<=Date.now())return page('<p>This payment link has expired or is unavailable. Contact the Trust.</p>',404);
  if(a.status==='WAIVED')return page('<h2>Payment waived</h2><p>No payment is due.</p>');
  if(a.status==='PAID')return page('<h2>Payment verified</h2><p>No further payment is required.</p>');
  const d=destination(env);
  if(a.status!=='AWAITING_PAYMENT'||!sendEnabled(env)||!d||a.destination_digest!==await destinationDigest(d))return page('<p>Payment is temporarily unavailable. Do not transfer funds. Contact the Trust for assistance.</p>',503);
  const url='upi://pay?pa='+encodeURIComponent(d.upi)+'&pn='+encodeURIComponent(d.payee)+'&am='+encodeURIComponent(a.amount+'.00')+'&cu=INR&tn='+encodeURIComponent(a.reference);
  const qrOrigin=new URL(d.qr).origin;
  const body='<h2>Verified Trust payment instructions</h2><p>Payee: '+escape(d.payee)+'</p><p>UPI ID: '+escape(d.upi)+'</p><p>Amount: INR '+escape(a.amount)+'</p><p><img width="220" height="220" alt="Official Trust UPI QR" src="'+escape(d.qr)+'"></p><p><a href="'+escape(url)+'">Pay using PhonePe or another UPI app</a></p><p>Confirm the displayed recipient and amount in your UPI app. Do not pay twice. Keep the transaction reference and contact the Trust for bank verification. Opening a UPI app does not confirm payment.</p>';
  return new Response('<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Wig assistance payment</title><main><h1>Mamta Care Charitable Trust</h1>'+body+'</main></html>',{headers:{...headers,'content-type':'text/html; charset=utf-8','content-security-policy':"default-src 'none'; img-src "+qrOrigin+"; frame-ancestors 'none'; base-uri 'none'; form-action 'none'"}});
 }catch{return page('<p>Payment service unavailable. Do not transfer funds.</p>',503)}
}

export async function handleWigAgreementPublic(req,env){
 const u=new URL(req.url);if(u.pathname.startsWith(paymentPath))return paymentPage(req,env,u);if(!u.pathname.startsWith(publicPath))return null;if(u.origin!==ORIGIN)return page('<p>Invalid agreement address.</p>',404);
 const token=u.pathname.slice(publicPath.length);if(!tokenPattern.test(token))return page('<p>Invalid or expired agreement link.</p>',404);
 try{
  const a=await q(env,"SELECT a.*,c.otp_hash,c.otp_salt,c.expires_at,c.attempts,c.consumed_at FROM mcwig_beneficiary_challenge_v1 c JOIN mcwig_beneficiary_agreement_v1 a ON a.id=c.agreement_id WHERE c.token_hash=?",await sha(token)).first();
  if(!a||a.status!=='AWAITING_ACCEPTANCE'||a.consumed_at||a.attempts>=5||a.expires_at<=Date.now())return page('<p>This link is unavailable or expired. Contact the Trust for assistance.</p>',404);
  if(req.method==='GET')return page('<p>Read the personalized agreement attached to your email before proceeding. Enter the verification code from that email and your registered name. No payment is required at this step.</p><form method="post"><p><label>Verification code <input name="otp" inputmode="numeric" pattern="[0-9]{6}" maxlength="6" required autocomplete="one-time-code"></label></p><p><label>Registered name <input name="name" maxlength="150" required></label></p><p><label><input name="consent" type="checkbox" value="yes" required> I have read the attached agreement, understand its conditions, and voluntarily accept them.</label></p><button type="submit">Accept agreement</button></form>');
  if(req.method!=='POST'||req.headers.get('origin')!==ORIGIN||!/^application\/x-www-form-urlencoded(?:;|$)/i.test(req.headers.get('content-type')||''))return page('<p>Invalid request.</p>',403);
  const len=Number(req.headers.get('content-length')||0);if(len>4096)return page('<p>Invalid request.</p>',400);const reader=req.body?.getReader();if(!reader)return page('<p>Invalid request.</p>',400);let size=0,chunks=[];while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>4096){await reader.cancel();return page('<p>Invalid request.</p>',400)}chunks.push(value)}const bytes=new Uint8Array(size);let off=0;for(const c of chunks){bytes.set(c,off);off+=c.length}const f=new URLSearchParams(new TextDecoder().decode(bytes));
  const otp=f.get('otp')||'',name=f.get('name')||'',consent=f.get('consent'),snapshot=JSON.parse(a.snapshot_json);
  const correct=/^\d{6}$/.test(otp)&&equal(await otpHash(env,a.otp_salt,otp),a.otp_hash)&&norm(name)===norm(snapshot.patientName)&&consent==='yes';
  // CAS on attempt count prevents concurrent requests from skipping the five-attempt cap.
  const now=Date.now(),ref=crypto.randomUUID();
  if(!correct){await q(env,'UPDATE mcwig_beneficiary_challenge_v1 SET attempts=attempts+1 WHERE agreement_id=? AND consumed_at IS NULL AND attempts=? AND attempts<5 AND expires_at>?',a.id,a.attempts,now).run();return page('<p>Verification failed. Return to the agreement link and check your entries.</p>',400);}
  const results=await env.DB.batch([
   q(env,'UPDATE mcwig_beneficiary_challenge_v1 SET consumed_at=?,attempts=attempts+1 WHERE agreement_id=? AND consumed_at IS NULL AND attempts=? AND attempts<5 AND expires_at>?',now,a.id,a.attempts,now),
   q(env,"UPDATE mcwig_beneficiary_agreement_v1 SET status='ACCEPTED',accepted_at=?,acceptance_reference=? WHERE id=? AND status='AWAITING_ACCEPTANCE' AND EXISTS(SELECT 1 FROM mcwig_beneficiary_challenge_v1 WHERE agreement_id=? AND consumed_at=?)",now,ref,a.id,a.id,now),
   q(env,"INSERT OR IGNORE INTO mcwig_beneficiary_mail_v1(message_id,agreement_id,kind,state,created_at,updated_at) SELECT ?,id,'PAYMENT','HOLD',?,? FROM mcwig_beneficiary_agreement_v1 WHERE id=? AND acceptance_reference=? AND status='ACCEPTED'",a.reference+':payment',now,now,a.id,ref)
  ]);
  if(changed(results[0])!==1||changed(results[1])!==1)return page('<p>The agreement has already been processed or the link has expired.</p>',409);
  // Acceptance is already durably recorded. A failed payment email must never roll it back.
  let followup;try{followup=await releasePayment(env,a.id)}catch{followup={ok:false,reason:'dispatch_pending'}}
  return page('<h2>Agreement accepted</h2><p>Your verified electronic consent has been recorded. Your reference: '+escape(ref)+'. '+(followup.ok?'The follow-up email has been accepted by the mail provider.':'Payment instructions are pending Trust review. Do not transfer funds before receiving verified instructions.')+'</p>');
 }catch{return page('<p>Agreement service temporarily unavailable. Contact the Trust for assistance.</p>',503)}
}
export async function handleWigAgreementAdmin(req,env,user){
 const u=new URL(req.url);if(!u.pathname.startsWith(api+'/'))return null;
 if(user?.role!=='admin'||!user.username)return fail('Administrator session required',401);
 const path=u.pathname.slice(api.length+1).split('/');if(path.length!==2||!uuid.test(path[0]))return fail('Invalid agreement reference',404);
 const [id,action]=path;
 try{
  if(req.method==='POST'&&!writeOK(req))return fail('Invalid request origin',403);
  if(req.method==='POST'&&action==='prepare')return await prepare(req,env,user,id);
  if(req.method==='GET'&&action==='case-status'){
   const c=await currentCase(env,id);if(!c)return fail('Approved case not found',404);
   const a=await q(env,"SELECT id,status,document_digest,deposit,expenses,accepted_at FROM mcwig_beneficiary_agreement_v1 WHERE case_id=? AND status!='SUPERSEDED'",id).first();
   const mail=a?(await q(env,'SELECT kind,state,updated_at FROM mcwig_beneficiary_mail_v1 WHERE agreement_id=?',a.id).all()).results:[];
   return json({ok:true,eligible:eligible(env,c),agreement:a||null,mail});
  }
  const a=await row(env,id);if(!a)return fail('Agreement not found',404);
  if(req.method==='GET'&&action==='status'){const mail=(await q(env,'SELECT kind,state,updated_at FROM mcwig_beneficiary_mail_v1 WHERE agreement_id=?',id).all()).results;return json({ok:true,id,status:a.status,document_digest:a.document_digest,accepted_at:a.accepted_at,mail});}
  if(req.method==='GET'&&action==='pdf')return new Response(await loadPdf(env,a),{headers:{...headers,'content-type':'application/pdf','content-disposition':'attachment; filename="Wig-Assistance-Agreement.pdf"','content-security-policy':'sandbox'}});
  if(req.method==='POST'&&action==='send')return await sendFirst(req,env,user,a);
  if(req.method==='POST'&&action==='reconcile')return await reconcile(env,a);
  if(req.method==='POST'&&action==='reconcile-payment'){
   const id=a.reference+':payment',m=await q(env,'SELECT state FROM mcwig_beneficiary_mail_v1 WHERE message_id=?',id).first();
   if(!m)return fail('No payment email attempt',404);
   if(m.state==='SENT')return json({ok:true,status:a.status});
   if(!['PROCESSING','UNKNOWN'].includes(m.state)||a.status!=='ACCEPTED')return fail('Review payment dispatch state',409);
   const r=await relay(env,{action:'wig_agreement_status',message_id:id});
   if(r?.ok!==true||r.message_id!==id||r.sent!==true||r.state!=='SENT')return fail('Provider has not confirmed sending; do not replay',409);
   const state=a.deposit+a.expenses===0?'WAIVED':'AWAITING_PAYMENT';
   await env.DB.batch([q(env,"UPDATE mcwig_beneficiary_mail_v1 SET state='SENT',updated_at=? WHERE message_id=? AND state IN ('PROCESSING','UNKNOWN')",Date.now(),id),q(env,"UPDATE mcwig_beneficiary_agreement_v1 SET status=?,payment_email_sent_at=? WHERE id=? AND status='ACCEPTED'",state,Date.now(),a.id)]);
   return json({ok:true,status:state,provider_accepted:true,delivery_confirmed:false});
  }
  if(req.method==='POST'&&action==='release-payment'){const result=await releasePayment(env,a.id);return json(result,result.ok?200:409);}
  return fail('Unsupported action',404);
 }catch{return fail('Agreement operation failed; review status before repeating',503)}
}
