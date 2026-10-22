/**
 * Mamta Care website -> ORIGINAL Google Form bridge.
 * Add this as a SEPARATE .gs file to the existing spreadsheet-bound Apps Script.
 * In the existing doPost(e), route website_submit and website_status to
 * mcWebsiteBridgePost_(payload) BEFORE the other existing actions.
 * The original onFormSubmit and email/certificate triggers remain unchanged.
 * Script Property: WEBSITE_FORM_BRIDGE_SECRET (random >=48 characters).
 */
const MC_WEB_SHEET_ID = "1IdEIAQEsaJ9QDmOQJiZ7C-rVHYZxDMvA8exoFxOBkWA";
const MC_WEB_TAB = "Form Responses 1";
const MC_WEB_LEDGER = "MC_Web_Intake_Ledger";
const MC_WEB_KEYS = ["full_name","phone","gender","hair_length","city","hair_type",
  "guidance","readiness","referral_source","consent","email"];

function mcWebsiteReply_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
function mcWebsiteSecretOK_(given) {
  const actual = PropertiesService.getScriptProperties().getProperty("WEBSITE_FORM_BRIDGE_SECRET") || "";
  given = String(given || "");
  if (actual.length < 48 || actual.length !== given.length) return false;
  let n=0;
  for(let i=0;i<actual.length;i++) n |= actual.charCodeAt(i)^given.charCodeAt(i);
  return n === 0;
}
function mcWebsiteLedger_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (ss.getId() !== MC_WEB_SHEET_ID) throw Error("This is not the original response spreadsheet");
  let ledger = ss.getSheetByName(MC_WEB_LEDGER);
  if (!ledger) {
    ledger = ss.insertSheet(MC_WEB_LEDGER);
    ledger.appendRow(["Submission UUID","State","Form Response ID","Response Sheet Row",
      "Official Registration ID","Updated At","Notes"]);
    ledger.setFrozenRows(1);
    ledger.hideSheet();
  }
  return ledger;
}
function mcWebsiteFindLedger_(ledger,id) {
  const last=ledger.getLastRow();
  if(last<2)return 0;
  const ids=ledger.getRange(2,1,last-1,1).getDisplayValues();
  let found=0;
  for(let i=0;i<ids.length;i++) if(String(ids[i][0])===id) {
    if(found)throw Error("Duplicate bridge ledger key");
    found=i+2;
  }
  return found;
}
function mcWebsiteUpdateLedger_(ledger,row,state,formResponseId,sheetRow,officialId,note) {
  ledger.getRange(row,2,1,6).setValues([[
    state,formResponseId||"",sheetRow||"",officialId||"",new Date(),note||""
  ]]);
  SpreadsheetApp.flush();
}
function mcWebsiteValues_(data) {
  if (!data || typeof data!=="object" || Array.isArray(data)) throw Error("Missing donor details");
  const v={};
  for(const k of MC_WEB_KEYS) v[k]=String(data[k]??"").trim().slice(0,200);
  if(v.full_name.length<2 || !/^[0-9]{10}$/.test(v.phone) ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.email) ||
    !v.gender||!v.city||!v.hair_length||!v.hair_type||!v.guidance||
    !v.readiness||!v.referral_source||!v.consent)
    throw Error("Incomplete donor form");
  return v;
}
function mcWebsiteCanonical_(v){return String(v||"").trim().replace(/\s+/g," ").toLowerCase();}

function mcWebsiteItemResponse_(item,value) {
  const type=item.getType(), t=FormApp.ItemType;
  const normalized=mcWebsiteCanonical_(value);
  if(type===t.TEXT) return item.asTextItem().createResponse(value);
  if(type===t.PARAGRAPH_TEXT)return item.asParagraphTextItem().createResponse(value);
  if(type===t.MULTIPLE_CHOICE||type===t.LIST||type===t.CHECKBOX){
    const x=type===t.MULTIPLE_CHOICE?item.asMultipleChoiceItem():
      type===t.LIST?item.asListItem():item.asCheckboxItem();
    const choices=x.getChoices().map(a=>a.getValue());
    const exact=choices.find(s=>mcWebsiteCanonical_(s)===normalized);
    if(!exact)throw Error("Google Form option mismatch: "+item.getTitle().slice(0,65));
    return type===t.CHECKBOX?x.createResponse([exact]):x.createResponse(exact);
  }
  throw Error("Unsupported required Google Form item: "+item.getTitle().slice(0,65));
}
function mcWebsiteBuildResponse_(form,sheet,v) {
  const headings=sheet.getRange(1,2,1,11).getDisplayValues()[0];
  const mapping=new Map();
  for(let i=0;i<headings.length;i++){
    const h=mcWebsiteCanonical_(headings[i]);
    if(mapping.has(h))throw Error("Ambiguous Google Sheet headings");
    mapping.set(h,v[MC_WEB_KEYS[i]]);
  }
  const response=form.createResponse();
  const used=new Set();
  for(const item of form.getItems()){
    const key=mcWebsiteCanonical_(item.getTitle());
    if(!mapping.has(key)){
      if(item.getType()===FormApp.ItemType.SECTION_HEADER||
        item.getType()===FormApp.ItemType.PAGE_BREAK||
        item.getType()===FormApp.ItemType.IMAGE||
        item.getType()===FormApp.ItemType.VIDEO)continue;
      throw Error("Unknown Google Form question: "+item.getTitle().slice(0,65));
    }
    if(used.has(key))throw Error("Duplicate Form question");
    used.add(key);
    response.withItemResponse(mcWebsiteItemResponse_(item,mapping.get(key)));
  }
  if(used.size!==MC_WEB_KEYS.length)throw Error("Google Form questions do not match original Sheet");
  return response;
}
function mcWebsiteFindResponseRow_(sheet,startRow,values,submissionDate) {
  const last=sheet.getLastRow();
  if(last<startRow)return 0;
  const rows=sheet.getRange(startRow,1,last-startRow+1,19).getValues();
  let found=0;
  for(let i=0;i<rows.length;i++){
    const r=rows[i];
    if(!(r[0] instanceof Date)||Math.abs(r[0].getTime()-submissionDate.getTime())>180000)continue;
    if(MC_WEB_KEYS.some((k,j)=>mcWebsiteCanonical_(r[j+1])!==mcWebsiteCanonical_(values[k])))continue;
    if(String(r[18]||"").trim())continue;
    if(found)throw Error("Ambiguous Google Form response; manual reconciliation required");
    found=startRow+i;
  }
  return found;
}
/**
 * Existing doPost(e) must route only:
 * const p=JSON.parse(e.postData.contents);
 * if (p.action==="website_submit"||p.action==="website_status")
 *   return mcWebsiteBridgePost_(p);
 */
function mcWebsiteBridgePost_(p){
  const reply=mcWebsiteReply_;
  try{
    if(!p||!mcWebsiteSecretOK_(p.secret))return reply({ok:false,error:"Not authorized"});
    const id=String(p.submission_uuid||"");
    if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))
      return reply({ok:false,error:"Invalid submission reference"});
    if(!["website_submit","website_status"].includes(p.action))
      return reply({ok:false,error:"Invalid action"});
    const lock=LockService.getScriptLock();
    if(!lock.tryLock(25000))return reply({ok:false,pending:true,error:"Bridge is busy"});
    let sheet,ledger,row,values,formResponseId="",responseRow=0,officialId="";
    let mustGenerate=false,submissionDate=null;
    try {
      const ss=SpreadsheetApp.getActiveSpreadsheet();
      sheet=ss.getSheetByName(MC_WEB_TAB);
      if(!sheet)throw Error("Original response tab missing");
      ledger=mcWebsiteLedger_();
      row=mcWebsiteFindLedger_(ledger,id);
      if(row){
        const v=ledger.getRange(row,2,1,5).getValues()[0];
        if(v[0]==="DONE")return reply({ok:true,existing:true,registration_id:String(v[3]||""),row:v[2]});
        // An interrupted Form submission MUST NOT be automatically resubmitted.
        return reply({ok:false,pending:true,error:"Submission is awaiting reconciliation; no second Form response was created"});
      }
      if(p.action==="website_status")return reply({ok:false,error:"Submission reference not found"});
      values=mcWebsiteValues_(p.values);
      const formUrl=ss.getFormUrl();
      if(!formUrl)throw Error("Original Google Form is not linked");
      const form=FormApp.openByUrl(formUrl);
      const response=mcWebsiteBuildResponse_(form,sheet,values);
      // Prepare and lock a durable idempotency marker BEFORE contacting Forms.
      ledger.appendRow([id,"SUBMITTING","","","",new Date(),"Do not resubmit automatically"]);
      row=mcWebsiteFindLedger_(ledger,id);
      SpreadsheetApp.flush();
      const start=sheet.getLastRow()+1;
      const submitted=response.submit();
      submissionDate=submitted.getTimestamp();
      formResponseId=submitted.getId();
      mcWebsiteUpdateLedger_(ledger,row,"FORM_SUBMITTED",formResponseId,"","","Find response row");
      for(let attempt=0;attempt<5&&!responseRow;attempt++){
        SpreadsheetApp.flush();
        responseRow=mcWebsiteFindResponseRow_(sheet,start,values,submissionDate);
        if(!responseRow)Utilities.sleep(650);
      }
      if(!responseRow) return reply({ok:false,pending:true,error:"Form accepted, but Sheet row needs reconciliation"});
      // Column S is currently the extra marker. Never overwrite an existing marker.
      if(sheet.getRange(responseRow,19).getValue())throw Error("Response marker already occupied");
      sheet.getRange(responseRow,19).setValue("WEBSITE:"+id);
      mcWebsiteUpdateLedger_(ledger,row,"ROW_MATCHED",formResponseId,responseRow,"","Ready for original ID generator");
      mustGenerate=true;
    } finally {lock.releaseLock();}
    if(mustGenerate){
      // onFormSubmit uses its own ScriptLock; never call while ours is held.
      if(typeof onFormSubmit!=="function")return reply({ok:false,pending:true,error:"Original ID generator unavailable"});
      onFormSubmit({range:sheet.getRange(responseRow,1)});
      officialId=String(sheet.getRange(responseRow,13).getDisplayValue()||"").trim();
      if(!officialId)return reply({ok:false,pending:true,error:"Waiting for original registration ID"});
      const lock2=LockService.getScriptLock();
      lock2.waitLock(25000);
      try {mcWebsiteUpdateLedger_(ledger,row,"DONE",formResponseId,responseRow,officialId,"Official ID generated; existing email automation retained");}
      finally{lock2.releaseLock();}
      return reply({ok:true,registration_id:officialId,row:responseRow});
    }
    return reply({ok:false,pending:true,error:"Not finalized"});
  } catch(ex) {
    console.error("Website registration bridge: "+String(ex?.message||ex).slice(0,180));
    return reply({ok:false,pending:true,error:"Registration needs Administrator reconciliation; please do not resubmit"});
  }
}
