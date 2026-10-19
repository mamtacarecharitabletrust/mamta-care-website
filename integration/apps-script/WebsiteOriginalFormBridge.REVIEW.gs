/**
 * Mamta Care WEBSITE -> ORIGINAL GOOGLE FORM bridge.
 * REVIEW ONLY. NOT DEPLOYED. Use with TEST Form, TEST Sheet and fictional donors first.
 * Add to the existing Apps Script project; do NOT create a second doPost.
 *
 * Script Properties (server-side only):
 * MC_WEB_FORM_ID      Google Form EDIT ID (must refer to the form linked to the expected sheet)
 * MC_WEB_BRIDGE_KEY   Random secret with 32+ characters; same as Cloudflare Worker secret
 *
 * This intentionally DOES NOT upload photos or write to Google Drive.
 * WEBSITE: marker in Column S is separate from SOCIAL:; normal Google Form
 * registrations must not be incorrectly blocked by the social-approval mail guard.
 * Keep Column N unchanged for native Form responses (no approval required).
 * Programmatic FormApp submission does NOT run ordinary Form submit triggers;
 * we call the existing onFormSubmit({range: ...}) explicitly.
 *
 * CAUTION: A Form may asynchronously append linked Sheet rows. If a submitted
 * FormResponse cannot be unambiguously matched to its row, the bridge FAILS CLOSED.
 * It NEVER resubmits after an uncertain outcome. Operator reconciliation needed.
 */
function mcWebFormBridge_(e) {
  const answer = x => ContentService.createTextOutput(JSON.stringify(x))
    .setMimeType(ContentService.MimeType.JSON);
  try {
    if (!e || !e.postData || typeof e.postData.contents !== 'string' || e.postData.contents.length > 16000)
      return answer({ok:false,error:'Invalid request'});
    const req = JSON.parse(e.postData.contents);
    if (!req || req.action !== 'website_register_form' || !req.values)
      return answer({ok:false,error:'Invalid action'});
    const props = PropertiesService.getScriptProperties();
    const key = String(props.getProperty('MC_WEB_BRIDGE_KEY') || '');
    if (key.length < 32 || !mcWebBridgeEqual_(String(req.secret || ''), key))
      return answer({ok:false,error:'Not authorized'});
    const donorId = String(req.donor_id || '');
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(donorId))
      return answer({ok:false,error:'Invalid reference'});
    const formId = props.getProperty('MC_WEB_FORM_ID');
    if (!formId) return answer({ok:false,error:'Form integration is not configured'});
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Form Responses 1');
    if (!sheet || sheet.getMaxColumns() < 19)
      return answer({ok:false,error:'Form response sheet requires review'});
    const v = mcWebFormValues_(req.values);
    const choices={
      hair_length:['14-16INCHES','18-20INCHES','21-26INCHES','BALD(FULL LENGTH)'],
      gender:['MALE','FEMALE'],
      hair_type:['STRAIGHT','CURLY','WAVY','COILY','MIXED/COMBINATION'],
      guidance:['YES','ALREADY AWARE'],
      readiness:['planning to donate','Already cut and ready to donate','Need guidance before cutting'],
      referral_source:['INSTAGRAM','FACEBOOK','WHATSAPP','FRIENDS/FAMILY'],
      consent:['STRONGLY AGREE']
    };
    Object.keys(choices).forEach(k=>{if(!choices[k].includes(v[k]))throw Error('Original Form choice mismatch: '+k);});

    const marker = 'WEBSITE:' + donorId + '|SOURCE:WEBSITE';
    const lock = LockService.getScriptLock();
    lock.waitLock(30000);
    let row = 0;
    try {
      const saved = mcWebBridgeRead_(props, donorId);
      if (saved.status === 'SYNCED')
        return answer({ok:true,existing:true,registration_id:saved.registration_id,row:saved.row});
      row = mcWebBridgeFindMarker_(sheet, marker);
      if (!row && (saved.status === 'SUBMITTED' || saved.status === 'RESERVED')) {
        // An earlier call may have submitted a FormResponse. NEVER submit again.
        if (saved.status === 'SUBMITTED' && saved.submitted_at)
          row = mcWebBridgeFindResponseRow_(sheet, v, new Date(saved.submitted_at), marker);
        if (!row) return answer({ok:false,pending:true,error:'Previous submission requires reconciliation; duplicate prevented'});
      }
      if (!row) {
        // Resolve every original Google Form item BEFORE submitting anything.
        const form = FormApp.openById(formId);
        if (!form.isAcceptingResponses()) return answer({ok:false,error:'Original form is not accepting responses'});
        const formResponse = form.createResponse();
        const items = form.getItems();
        const matches = mcWebBridgeMatchItems_(items, v);
        matches.forEach(m => formResponse.withItemResponse(mcWebBridgeItemResponse_(m.item,m.value)));
        props.setProperty('MC_WEB_REF_' + donorId, JSON.stringify({status:'RESERVED',at:new Date().toISOString()}));
        // Once we call submit, we must NOT repeat it on timeout or exceptions.
        const submitted = formResponse.submit();
        const submittedAt = submitted.getTimestamp();
        props.setProperty('MC_WEB_REF_' + donorId, JSON.stringify({
          status:'SUBMITTED', submitted_at:submittedAt.toISOString(),
          response_id:submitted.getId() || ''
        }));
        SpreadsheetApp.flush();
        // Allow the linked Form response sheet to receive the new row.
        for (let i=0;i<4 && !row;i++) {
          row = mcWebBridgeFindResponseRow_(sheet,v,submittedAt,marker);
          if (!row) Utilities.sleep(600);
        }
        if (!row) return answer({ok:false,pending:true,error:'Form response submitted; awaiting linked sheet row'});
      }
      const colS = String(sheet.getRange(row,19).getDisplayValue() || '').trim();
      if (colS && !colS.startsWith('WEBSITE:' + donorId))
        return answer({ok:false,pending:true,error:'Response row is already linked to another registration'});
      sheet.getRange(row,19).setValue(marker);
      SpreadsheetApp.flush();
    } finally {
      try { lock.releaseLock(); } catch (_) {}
    }

    // Original generator has its own ScriptLock; never hold another one here.
    if (typeof onFormSubmit !== 'function')
      return answer({ok:false,pending:true,error:'Original ID generator unavailable'});
    onFormSubmit({range:sheet.getRange(row,1)});
    const finalLock = LockService.getScriptLock();
    finalLock.waitLock(30000);
    try {
      const located = mcWebBridgeFindMarker_(sheet,marker);
      if (!located) return answer({ok:false,pending:true,error:'Form response row not linked'});
      const id = String(sheet.getRange(located,13).getDisplayValue()).trim();
      if (!/^\d{4}-\d{6,}\/M\/2022$/.test(id))
        return answer({ok:false,pending:true,error:'Registration ID generation pending'});
      SpreadsheetApp.flush();
      props.setProperty('MC_WEB_REF_'+donorId,JSON.stringify({
        status:'SYNCED',row:located,registration_id:id
      }));
      // Existing checkAndSendRegistrationEmails(): normal Form rows are eligible
      // based on timestamp, email, registration ID and Column P != SENT.
      // Do not change Column N or apply social approval rules to these rows.
      // SENT check isn't transactional with sendEmail; test timeouts carefully.
      // DO NOT call the email function here.
      return answer({ok:true,registration_id:id,row:located,email_eligible:true});
    } finally {
      try { finalLock.releaseLock(); } catch (_) {}
    }
  } catch(err) {
    console.error('Website Google Form bridge: '+String(err && err.message || err).slice(0,140));
    return answer({ok:false,pending:true,error:'Google Form synchronization needs retry or reconciliation'});
  }
}
function mcWebBridgeRead_(props,id) {
  try {return JSON.parse(props.getProperty('MC_WEB_REF_'+id)||'{}');}
  catch (_) {return {};}
}
function mcWebBridgeEqual_(a,b) {
  if(a.length!==b.length)return false;
  let diff=0;for(let i=0;i<a.length;i++)diff|=a.charCodeAt(i)^b.charCodeAt(i);
  return diff===0;
}
function mcWebFormValues_(d) {
  const pick=(k,n)=>String(d[k] == null ? '' : d[k]).trim().slice(0,n);
  const v={
    full_name:pick('full_name',160),phone:pick('phone',30),gender:pick('gender',40),
    hair_length:pick('hair_length',100),city:pick('city',120),
    hair_type:pick('hair_type',60),guidance:pick('guidance',150),
    readiness:pick('readiness',150),referral_source:pick('referral_source',100),
    consent:pick('consent',250),email:pick('email',180).toLowerCase()
  };
  if(v.full_name.length<2 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.email) ||
     !/^\+?[0-9 ()-]{10,22}$/.test(v.phone) || !v.city || !v.hair_length ||
     !v.gender || !v.hair_type || !v.guidance || !v.readiness || !v.referral_source ||
     !/voluntar/i.test(v.consent))
    throw Error('Incomplete registration data');
  return v;
}
function mcWebBridgeTitle_(s) {
  return String(s||'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
}
function mcWebBridgeMatchItems_(items,v) {
  // Check original Google Form question labels before enabling in TEST.
  const config=[
    [/^full name/,v.full_name,'name'],[/^contact no/,v.phone,'phone'],
    [/^gender/,v.gender,'gender'],[/^length that you prefer to donate/,v.hair_length,'length'],
    [/^city/,v.city,'city'],[/^hair type/,v.hair_type,'type'],
    [/would you lo.ke guidance|would you like guidance/,v.guidance,'guidance'],
    [/have you already cut|planning to donate/,v.readiness,'readiness'],
    [/how did you hear/,v.referral_source,'referral'],
    [/i voluntarily wish/,v.consent,'consent'],[/^email address/,v.email,'email']
  ];
  const out=[];
  config.forEach(([pattern,value,label])=>{
    const found=items.filter(x=>pattern.test(mcWebBridgeTitle_(x.getTitle())));
    if(found.length!==1)throw Error('Form item mapping ambiguous: '+label);
    out.push({item:found[0],value});
  });
  return out;
}
function mcWebBridgeItemResponse_(item,value) {
  const t=item.getType();
  if(t===FormApp.ItemType.TEXT)return item.asTextItem().createResponse(value);
  if(t===FormApp.ItemType.PARAGRAPH_TEXT)return item.asParagraphTextItem().createResponse(value);
  if(t===FormApp.ItemType.MULTIPLE_CHOICE) {
    const x=item.asMultipleChoiceItem();
    const exact=x.getChoices().find(c=>mcWebBridgeTitle_(c.getValue())===mcWebBridgeTitle_(value));
    if(!exact)throw Error('Existing Form choice mismatch for '+item.getTitle());
    return x.createResponse(exact.getValue());
  }
  if(t===FormApp.ItemType.CHECKBOX) {
    const x=item.asCheckboxItem();
    const exact=x.getChoices().find(c=>mcWebBridgeTitle_(c.getValue())===mcWebBridgeTitle_(value));
    if(!exact)throw Error('Existing Form checkbox choice mismatch: '+item.getTitle());
    return x.createResponse([exact.getValue()]);
  }
  if(t===FormApp.ItemType.LIST) {
    const x=item.asListItem();
    const exact=x.getChoices().find(c=>mcWebBridgeTitle_(c.getValue())===mcWebBridgeTitle_(value));
    if(!exact)throw Error('Existing Form list choice mismatch for '+item.getTitle());
    return x.createResponse(exact.getValue());
  }
  throw Error('Unsupported existing Google Form item type: '+item.getTitle());
}
function mcWebBridgeFindMarker_(sheet,marker) {
  const last=sheet.getLastRow();
  if(last<2)return 0;
  const cells=sheet.getRange(2,19,last-1,1).getDisplayValues();
  const hits=[];
  cells.forEach((r,i)=>{if(String(r[0]||'').startsWith(marker))hits.push(i+2);});
  if(hits.length>1)throw Error('Duplicate marker requires review');
  return hits[0]||0;
}
function mcWebBridgeFindResponseRow_(sheet,v,submittedAt,marker) {
  const n=sheet.getLastRow();
  if(n<2)return 0;
  const start=Math.max(2,n-250);
  const rows=sheet.getRange(start,1,n-start+1,19).getValues();
  const match=[];
  rows.forEach((r,i)=>{
    if(!(r[0] instanceof Date) || Math.abs(r[0].getTime()-submittedAt.getTime())>300000)return;
    const cols=[v.full_name,v.phone,v.gender,v.hair_length,v.city,v.hair_type,v.guidance,
      v.readiness,v.referral_source,v.consent,v.email];
    if(cols.some((expected,j)=>String(r[j+1]||'').trim().toLowerCase()!==expected.toLowerCase()))return;
    const s=String(r[18]||'').trim();
    if(s&&!s.startsWith(marker))return;
    match.push(start+i);
  });
  if(match.length>1)throw Error('Ambiguous Form response row: manual reconciliation needed');
  return match[0]||0;
}
