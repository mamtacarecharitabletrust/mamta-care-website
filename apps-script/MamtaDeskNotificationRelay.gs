/**
 * Mamta Care — verified donor email relay for existing Apps Script.
 * ADDITIVE source file, not deployed until the existing Apps Script owner
 * installs it in the original spreadsheet-bound project.
 *
 * In the project's SINGLE existing doPost(e), add:
 *   if (payload && [
 *     'desk_notification_health','desk_notification_status',
 *     'desk_notification_send'
 *   ].includes(payload.action)) return mcDeskNotificationRelayPost_(payload);
 *
 * Keep every existing social, website and desk verification handler.
 *
 * PropertiesService Script Properties:
 * - MC_DESK_SHARED_SECRET: same existing strong secret used by Donor Desk
 * - MCCT_NOTIFICATION_RELAY_ENABLE_SEND: YES only after real test approval
 *
 * No OAuth tokens or passwords are placed in source control.
 * No automatic marketing; only follow-up and expiry notices from official IDs.
 */
const MCCT_NOTIFICATION_ORIGINAL_RESPONSES = '1IdEIAQEsaJ9QDmOQJiZ7C-rVHYZxDMvA8exoFxOBkWA';
const MCCT_NOTIFICATION_LEDGER = 'MC_Desk_Notification_Dispatch_Ledger';
const MCCT_NOTIFICATION_ALLOWED = ['FEEDBACK_EMAIL','EXPIRY_EMAIL'];

function mcDeskNotificationReply_(value){
  return ContentService.createTextOutput(JSON.stringify(value))
    .setMimeType(ContentService.MimeType.JSON);
}
function mcDeskNotificationEqual_(supplied,actual){
  if(actual.length<48||supplied.length!==actual.length)return false;
  let diff=0;for(let i=0;i<actual.length;i++)diff|=actual.charCodeAt(i)^supplied.charCodeAt(i);
  return diff===0;
}
function mcDeskNotificationLedger_(create){
  const ss=SpreadsheetApp.getActiveSpreadsheet();
  if(!ss||ss.getId()!==MCCT_NOTIFICATION_ORIGINAL_RESPONSES)
    throw Error('Notification relay is not bound to original Mamta Care response Sheet');
  let sh=ss.getSheetByName(MCCT_NOTIFICATION_LEDGER);
  if(!sh&&create){
    sh=ss.insertSheet(MCCT_NOTIFICATION_LEDGER);
    sh.appendRow(['Outbox UUID','Kind','Recipient Signature','State','Updated','Note']);
    sh.setFrozenRows(1);
    sh.hideSheet();
  }
  return sh;
}
function mcDeskNotificationFind_(sh,id){
  if(!sh||sh.getLastRow()<2)return 0;
  const ids=sh.getRange(2,1,sh.getLastRow()-1,1).getDisplayValues();
  let match=0;
  for(let i=0;i<ids.length;i++)if(ids[i][0]===id){
    if(match)throw Error('Duplicate ledger outbox ID');
    match=i+2;
  }
  return match;
}
function mcDeskNotificationRecipientHash_(email,secret){
  const bytes=Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,
    email.toLowerCase()+':'+secret,Utilities.Charset.UTF_8);
  return bytes.map(b=>('0'+(b<0?b+256:b).toString(16)).slice(-2)).join('');
}
function mcDeskNotificationTemplate_(p){
  const id=String(p.registration_id||'').trim();
  const who=String(p.donor_name||'').trim().slice(0,100);
  const first=who||'Hair Donor';
  if(!/^\d{4}-\d{4}\d+\/M\/2022$/.test(id)||first.length<2)
    throw Error('Original official registration ID required');
  if(p.kind==='FEEDBACK_EMAIL'){
    return {
      subject:'Thank you for your hair donation — Mamta Care Charitable Trust',
      body:'Dear '+first+',\n\nThank you for supporting Mamta Care Charitable Trust through your hair donation.\n\nOfficial registration ID: '+id+
      '\n\nWe would appreciate feedback about your experience with our donation coordination. You can reply directly to this email with your suggestions or any concerns.\n\nThank you for spreading hope through your generosity.\n\nMamta Care Charitable Trust\nContact: +91 8500012190'
    };
  }
  if(p.kind==='EXPIRY_EMAIL'){
    return {
      subject:'Your Mamta Care hair donation application requires renewal',
      body:'Dear '+first+',\n\nWe have not recorded a donation or recent update for your registration '+id+
      ' within the applicable 30-day period. We are closing the inactive application so our team can focus on active donation requests. Your previous records will remain in Mamta Care history.\n\nTo register again, please use the official hair donation form:\nhttps://forms.gle/VpKSKJoichRqyTvH9\n\nIf you already donated or your hair is in transit, please contact us before re-registering so we can correct the status.\n\nMamta Care Charitable Trust\nContact: +91 8500012190'
    };
  }
  throw Error('Unsupported notification kind');
}
function mcDeskNotificationRelayPost_(p){
  const response=mcDeskNotificationReply_;
  try{
    const prop=PropertiesService.getScriptProperties();
    const secret=String(prop.getProperty('MC_DESK_SHARED_SECRET')||'');
    const given=String(p?.secret||'');
    if(!mcDeskNotificationEqual_(given,secret))return response({ok:false,error:'Unauthorized'});
    const action=String(p.action||'');
    if(!['desk_notification_health','desk_notification_send','desk_notification_status'].includes(action))
      return response({ok:false,error:'Unsupported notification action'});
    const enabled=prop.getProperty('MCCT_NOTIFICATION_RELAY_ENABLE_SEND')==='YES';
    if(action==='desk_notification_health'){
      return response({ok:true,relay:'mamta_donor_notification_v1',
        configured:enabled,ready_send:enabled,
        remaining_recipients:Math.max(0,MailApp.getRemainingDailyQuota()),
        ledger_exists:!!mcDeskNotificationLedger_(false)});
    }
    const id=String(p.outbox_id||'').trim();
    if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))
      return response({ok:false,error:'Invalid outbox reference'});
    const lock=LockService.getScriptLock();
    if(!lock.tryLock(15000))return response({ok:false,pending:true,error:'Email relay is busy'});
    try{
      const ledger=mcDeskNotificationLedger_(false);
      let row=mcDeskNotificationFind_(ledger,id);
      if(action==='desk_notification_status'){
        if(!row)return response({ok:true,outbox_id:id,state:'NOT_FOUND',sent:false});
        const state=String(ledger.getRange(row,4).getDisplayValue()||'');
        return response({ok:true,outbox_id:id,state,sent:state==='SENT',uncertain:['RESERVED','UNKNOWN'].includes(state)});
      }
      if(!enabled)return response({ok:false,error:'Relay sending is disabled'});
      const kind=String(p.kind||'');
      if(MCCT_NOTIFICATION_ALLOWED.indexOf(kind)<0)return response({ok:false,error:'Notification type not authorized'});
      const to=String(p.email||'').trim().toLowerCase();
      if(!/^[^\s@<>"(),;]+@[^\s@<>"(),;]+\.[a-z]{2,}$/i.test(to)||to.length>180)
        return response({ok:false,error:'Invalid recipient'});
      const template=mcDeskNotificationTemplate_(p);
      const signature=mcDeskNotificationRecipientHash_(to,secret);
      if(row){
        const old=ledger.getRange(row,2,1,3).getDisplayValues()[0];
        if(old[0]!==kind||old[1]!==signature)
          return response({ok:false,error:'Existing outbox ID belongs to another recipient or kind'});
        if(old[2]==='SENT')return response({ok:true,sent:true,already_sent:true,outbox_id:id});
        return response({ok:false,pending:true,uncertain:true,state:old[2],
          error:'Previous attempt needs review; duplicate email prevented'});
      }
      if(MailApp.getRemainingDailyQuota()<1)
        return response({ok:false,retryable:true,quota:true,error:'Daily mail quota reached'});
      const writable=mcDeskNotificationLedger_(true);
      writable.appendRow([id,kind,signature,'RESERVED',new Date(),'Reserved before sending; never automatically replay']);
      row=mcDeskNotificationFind_(writable,id);
      SpreadsheetApp.flush();
      try{
        MailApp.sendEmail({to,subject:template.subject,body:template.body,name:'Mamta Care Charitable Trust'});
        writable.getRange(row,4,1,3).setValues([['SENT',new Date(),'MailApp accepted the send call; delivery is not guaranteed']]);
        SpreadsheetApp.flush();
        return response({ok:true,sent:true,outbox_id:id,mailapp_accepted:true,delivered:false});
      }catch(err){
        // MailApp may have succeeded before an exception; DO NOT re-send.
        try{writable.getRange(row,4,1,3).setValues([['UNKNOWN',new Date(),'Uncertain outcome. Check Sent Mail; do not auto retry']]);}
        catch(_){}
        console.error('Mamta relay uncertain outcome; outbox end '+id.slice(-6));
        return response({ok:false,pending:true,uncertain:true,
          error:'Delivery state uncertain; manual reconciliation required before retry'});
      }
    }finally{lock.releaseLock();}
  }catch(err){
    console.error('Mamta notification relay failed: '+String(err?.name||'Error'));
    return response({ok:false,pending:true,error:'Notification bridge unavailable'});
  }
}
