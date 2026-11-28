/**
 * Patient agreement email relay, additive to the existing Apps Script project.
 * Requires WIG_AGREEMENT_RELAY_SECRET, WIG_AGREEMENT_RELAY_ENABLED=YES,
 * WIG_AGREEMENT_ALLOWED_ORIGIN, WIG_AGREEMENT_LEDGER_SHEET_ID.
 * Existing authenticated doPost dispatcher calls mcWigAgreementRelayPost_(payload).
 * No production activation until verified synthetic delivery and policy adoption.
 */
function mcWigAgreementRelayPost_(p){
 const reply=v=>ContentService.createTextOutput(JSON.stringify(v)).setMimeType(ContentService.MimeType.JSON);
 const prop=PropertiesService.getScriptProperties();
 const secret=String(prop.getProperty('WIG_AGREEMENT_RELAY_SECRET')||''), given=String(p&&p.secret||'');
 if(secret.length<48||given.length!==secret.length)return reply({ok:false,error:'Unauthorized'});
 let diff=0;for(let i=0;i<secret.length;i++)diff|=secret.charCodeAt(i)^given.charCodeAt(i);
 if(diff)return reply({ok:false,error:'Unauthorized'});
 const enabled=prop.getProperty('WIG_AGREEMENT_RELAY_ENABLED')==='YES';
 const action=String(p.action||'');
 if(action==='wig_agreement_health')return reply({ok:true,ready_send:enabled&&!!prop.getProperty('WIG_AGREEMENT_ALLOWED_ORIGIN')&&!!prop.getProperty('WIG_AGREEMENT_LEDGER_SHEET_ID'),quota:MailApp.getRemainingDailyQuota(),simple_agreement_v1:true});
 if(!['wig_agreement_send','wig_agreement_status'].includes(action))return reply({ok:false,error:'Unsupported action'});
 const id=String(p.message_id||'');
 if(!/^[a-zA-Z0-9_-]{16,100}:(agreement|payment)$/.test(id))return reply({ok:false,error:'Invalid message ID'});
 const lock=LockService.getScriptLock();
 if(!lock.tryLock(15000))return reply({ok:false,retryable:true,error:'Relay busy'});
 try{
  const ss=SpreadsheetApp.openById(String(prop.getProperty('WIG_AGREEMENT_LEDGER_SHEET_ID')||''));
  let sheet=ss.getSheetByName('MC_Wig_Agreement_Dispatch');
  if(!sheet){if(action==='wig_agreement_status')return reply({ok:true,state:'NOT_FOUND',message_id:id});sheet=ss.insertSheet('MC_Wig_Agreement_Dispatch');sheet.appendRow(['Message ID','Kind','Content fingerprint','State','Updated']);sheet.setFrozenRows(1);sheet.hideSheet()}
  const rows=sheet.getLastRow()>1?sheet.getRange(2,1,sheet.getLastRow()-1,4).getDisplayValues():[];
  const found=rows.map((r,i)=>[r,i+2]).filter(([r])=>r[0]===id);
  if(found.length>1)return reply({ok:false,error:'Duplicate ledger entry'});
  const old=found[0];
  if(action==='wig_agreement_status')return reply({ok:true,message_id:id,state:old?old[0][3]:'NOT_FOUND',sent:!!old&&old[0][3]==='SENT'});
  if(!enabled)return reply({ok:false,error:'Sending disabled'});
  const kind=String(p.kind||''),to=String(p.to||'').trim(),name=String(p.patient_name||'').trim(),reg=String(p.registration_id||'').trim();
  if(!['AGREEMENT','PAYMENT'].includes(kind)||!id.endsWith(':'+kind.toLowerCase())||!name||name.length>150||!reg||reg.length>120||!/^[^\s@<>"(),;]+@[^\s@<>"(),;]+\.[a-z]{2,}$/i.test(to)||to.length>180)return reply({ok:false,error:'Invalid recipient or message'});
  const origin=String(prop.getProperty('WIG_AGREEMENT_ALLOWED_ORIGIN')||'').replace(/\/$/,'');
  if(!/^https:\/\/[a-z0-9.-]+(?::\d+)?$/i.test(origin))return reply({ok:false,error:'Invalid approved origin'});
  const link=String(p.link||'');const expected=kind==='AGREEMENT'?'/wig-agreement/accept/':'/wig-agreement/payment/';
  if(!link.startsWith(origin+expected)||!/^[a-f0-9]{64}$/.test(link.slice((origin+expected).length)))return reply({ok:false,error:'Invalid secure link'});
  const pdf=String(p.pdf_base64||'');
  if(!pdf||pdf.length>7000000||!/^[A-Za-z0-9+/]+={0,2}$/.test(pdf))return reply({ok:false,error:'Agreement PDF required'});
  const bytes=Utilities.base64Decode(pdf);
  if(bytes.length<100||bytes.length>5000000||bytes.slice(0,5).map(x=>String.fromCharCode(x&255)).join('')!=='%PDF-')return reply({ok:false,error:'Invalid PDF'});
  let subject,body,htmlBody,inlineImages;
  if(kind==='AGREEMENT'){
   if(p.acceptance_mode!=='secure_link_v1')return reply({ok:false,error:'Secure link version required'});
   const deposit=p.deposit,expenses=p.expenses,total=deposit+expenses;
   if(!Number.isSafeInteger(deposit)||deposit<0||deposit>8000||!Number.isSafeInteger(expenses)||expenses<0||expenses>2000)return reply({ok:false,error:'Invalid agreement amounts'});
   const esc=x=>String(x).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
   const money=n=>'₹'+String(n).replace(/\B(?=(\d{3})+(?!\d))/g,',');
   const test=p.test_only===true;
   if(test&&(deposit!==0||expenses!==0||reg.indexOf('QA-')!==0))return reply({ok:false,error:'Invalid test amounts'});
   subject=(test?'TEST ONLY — ':'')+'Wig Assistance Agreement | Mamta Care Charitable Trust';
   body='Dear '+name+',\n\n'+(test?'This is a fictional test. No payment is due.\n\n':'')+'Registration: '+reg+'. Your personalized agreement is attached. Wig purchase and manufacturing charge: ₹0.\nTotal initial payment: '+money(total)+'\nProcessing and logistics: '+money(expenses)+'\nRefundable security deposit: '+money(deposit)+'\n\nRead the agreement, then open '+link+' and select Accept Agreement. No OTP or typing is required. The link expires after 48 hours. No payment is requested now.';
   const logoId=String(prop.getProperty('WIG_AGREEMENT_LOGO_FILE_ID')||'');
   if(!logoId)return reply({ok:false,error:'Official Trust logo is not configured'});
   let logo;try{logo=DriveApp.getFileById(logoId).getBlob();if(!['image/jpeg','image/png'].includes(logo.getContentType())||logo.getBytes().length>500000)throw Error('Invalid logo')}catch(e){return reply({ok:false,error:'Official Trust logo unavailable'})}
   inlineImages={mamtaCareLogo:logo};
   htmlBody='<div style="max-width:600px;margin:auto;font-family:Arial,sans-serif;color:#252525;line-height:1.65"><div style="background:#70203e;color:#ffffff;padding:22px;border-radius:12px 12px 0 0"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="color:#ffffff"><tr><td width="96" style="vertical-align:middle"><img src="cid:mamtaCareLogo" width="78" alt="Official Mamta Care Charitable Trust logo" style="display:block;width:78px;height:auto;background:#ffffff;border-radius:8px;padding:5px"></td><td style="vertical-align:middle;padding-left:12px"><strong style="font-size:16px">MAMTA CARE CHARITABLE TRUST</strong><br><span>Wig Assistance Department</span></td></tr></table></div><div style="padding:24px;border:1px solid #e3d6d9;border-top:0">'+(test?'<p><strong>TEST ONLY — fictional beneficiary; no payment due.</strong></p>':'')+'<h2 style="color:#70203e;margin-top:0">Your wig assistance agreement</h2><p>Dear '+esc(name)+',</p><p>Registration: <strong>'+esc(reg)+'</strong></p><p>Your personalized agreement is attached. The wig is provided without purchase or manufacturing charges.</p><table role="presentation" width="100%" cellpadding="12" cellspacing="0" style="border:1px solid #e5e5e5;border-radius:8px;background:#fbfaf9"><tr><td>Total initial payment</td><td align="right" style="font-weight:bold;font-size:23px;color:#111111">'+money(total)+'</td></tr><tr><td>Processing &amp; logistics charges</td><td align="right" style="font-weight:bold;font-size:21px;color:#b42318">'+money(expenses)+'</td></tr><tr><td>Refundable security deposit</td><td align="right" style="font-weight:bold;font-size:21px;color:#137333">'+money(deposit)+'</td></tr></table><p>The refundable amount is subject to the agreement’s return and inspection conditions. Normal wear is accepted.</p><p>Please read the attached agreement and confirm your acceptance.</p><p style="text-align:center;margin:28px 0"><a href="'+esc(link)+'" style="display:inline-block;background:#70203e;color:#fff;font-size:18px;font-weight:bold;text-decoration:none;padding:15px 30px;border-radius:8px">Accept Agreement</a></p><p style="font-size:13px;color:#555">The secure link expires after 48 hours. No payment is requested at this stage.</p><hr style="border:0;border-top:1px solid #eee"><strong>Reduce · Reuse · Recycle</strong><br>Mamta Care Charitable Trust</div></div>';
  }else{
   const amount=p.amount,deposit=p.deposit,expenses=p.expenses;
   if(p.accepted!==true||!p.acceptance_reference||!Number.isSafeInteger(amount)||amount<0||amount>10000||!Number.isSafeInteger(deposit)||deposit<0||deposit>8000||!Number.isSafeInteger(expenses)||expenses<0||expenses>2000||deposit+expenses!==amount)return reply({ok:false,error:'Verified acceptance and exact amount required'});
   if(amount===0){
    if(p.waived!==true)return reply({ok:false,error:'Waiver not confirmed'});
    subject='Agreement accepted — payment waived | Mamta Care Charitable Trust';
    body='Dear '+name+',\n\nYour agreement has been accepted. Registration: '+reg+'. No payment is due. Your acceptance document is attached. Our team will coordinate wig allotment.';
   }else{
    if(p.destination_verified!==true)return reply({ok:false,error:'Verified Trust destination required'});
    subject='Agreement accepted — payment instructions | Mamta Care Charitable Trust';
    body='Dear '+name+',\n\nYour wig assistance agreement has been accepted. Registration: '+reg+'.\nWig purchase or manufacturing charge: INR 0\nRefundable deposit: INR '+deposit+'\nProcessing and logistics: INR '+expenses+'\nTotal: INR '+amount+'.\n\nUse the official payment page '+link+' for the verified Trust QR and PhonePe/UPI instructions. Payment is confirmed only after bank verification. Your acceptance document is attached.';
   }
  }
  body+='\n\nReduce, Reuse and Recycle\nWig Assistance Department\nMamta Care Charitable Trust';
  const fingerprint=Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,JSON.stringify([kind,to,subject,body,htmlBody||'',pdf])+secret,Utilities.Charset.UTF_8).map(b=>('0'+(b&255).toString(16)).slice(-2)).join('');
  if(old){if(old[0][1]!==kind||old[0][2]!==fingerprint)return reply({ok:false,error:'Message content mismatch'});if(old[0][3]==='SENT')return reply({ok:true,sent:true,already_sent:true,message_id:id});return reply({ok:false,uncertain:true,error:'Previous attempt requires reconciliation'})}
  if(MailApp.getRemainingDailyQuota()<1)return reply({ok:false,retryable:true,error:'Mail quota exhausted'});
  sheet.appendRow([id,kind,fingerprint,'RESERVED',new Date()]);const row=sheet.getLastRow();SpreadsheetApp.flush();
  try{
   MailApp.sendEmail({to,subject,body,...(htmlBody?{htmlBody}:{}),...(inlineImages?{inlineImages}:{}),name:'Mamta Care Charitable Trust',attachments:[Utilities.newBlob(bytes,'application/pdf',kind==='AGREEMENT'?'Wig-Assistance-Agreement.pdf':'Accepted-Wig-Agreement.pdf')]});
   sheet.getRange(row,4,1,2).setValues([['SENT',new Date()]]);SpreadsheetApp.flush();
   return reply({ok:true,sent:true,message_id:id,delivered:false});
  }catch(e){try{sheet.getRange(row,4,1,2).setValues([['UNKNOWN',new Date()]]);SpreadsheetApp.flush()}catch(_){}return reply({ok:false,uncertain:true,error:'Mail outcome uncertain; check Sent Mail before retrying'})}
 }catch(e){return reply({ok:false,error:'Agreement relay unavailable'})}finally{lock.releaseLock()}
}
