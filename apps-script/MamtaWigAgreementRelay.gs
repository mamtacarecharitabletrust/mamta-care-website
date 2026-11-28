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
 if(action==='wig_agreement_health')return reply({ok:true,ready_send:enabled&&!!prop.getProperty('WIG_AGREEMENT_ALLOWED_ORIGIN')&&!!prop.getProperty('WIG_AGREEMENT_LEDGER_SHEET_ID'),quota:MailApp.getRemainingDailyQuota()});
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
  let subject,body;
  if(kind==='AGREEMENT'){
   if(!/^\d{6}$/.test(String(p.otp||'')))return reply({ok:false,error:'Verification code required'});
   subject='Your wig assistance agreement | Mamta Care Charitable Trust';
   body='Dear '+name+',\n\nYour wig assistance has been approved. Registration: '+reg+'. Please read the attached personalized agreement. To electronically accept its terms, open '+link+' and enter your verification code: '+p.otp+'. Do not share this code. Payment instructions will be sent separately after verified acceptance. Please do not make any payment now.';
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
  const fingerprint=Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,JSON.stringify([kind,to,subject,body,pdf])+secret,Utilities.Charset.UTF_8).map(b=>('0'+(b&255).toString(16)).slice(-2)).join('');
  if(old){if(old[0][1]!==kind||old[0][2]!==fingerprint)return reply({ok:false,error:'Message content mismatch'});if(old[0][3]==='SENT')return reply({ok:true,sent:true,already_sent:true,message_id:id});return reply({ok:false,uncertain:true,error:'Previous attempt requires reconciliation'})}
  if(MailApp.getRemainingDailyQuota()<1)return reply({ok:false,retryable:true,error:'Mail quota exhausted'});
  sheet.appendRow([id,kind,fingerprint,'RESERVED',new Date()]);const row=sheet.getLastRow();SpreadsheetApp.flush();
  try{
   MailApp.sendEmail({to,subject,body,name:'Mamta Care Charitable Trust',attachments:[Utilities.newBlob(bytes,'application/pdf',kind==='AGREEMENT'?'Wig-Assistance-Agreement.pdf':'Accepted-Wig-Agreement.pdf')]});
   sheet.getRange(row,4,1,2).setValues([['SENT',new Date()]]);SpreadsheetApp.flush();
   return reply({ok:true,sent:true,message_id:id,delivered:false});
  }catch(e){try{sheet.getRange(row,4,1,2).setValues([['UNKNOWN',new Date()]]);SpreadsheetApp.flush()}catch(_){}return reply({ok:false,uncertain:true,error:'Mail outcome uncertain; check Sent Mail before retrying'})}
 }catch(e){return reply({ok:false,error:'Agreement relay unavailable'})}finally{lock.releaseLock()}
}
