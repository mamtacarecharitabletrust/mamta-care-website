/**
 * Mamta Care Website Registration — SAFE preflight and recovery.
 * Add beside MamtaWebsiteGoogleFormBridge.gs in the EXISTING Apps Script project.
 *
 * Run mcWebsitePreflightReadOnly_ BEFORE authorizing any donor submissions.
 * Preflight does not create a Form response, Sheet row, registration ID or email.
 */
function mcWebsitePreflightReadOnly_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss || ss.getId() !== MC_WEB_SHEET_ID) throw Error("Wrong spreadsheet");
  const sheet = ss.getSheetByName(MC_WEB_TAB);
  if (!sheet) throw Error("Form Responses 1 not found");
  const formUrl = ss.getFormUrl();
  if (!formUrl) throw Error("Existing Google Form not linked");
  const form = FormApp.openByUrl(formUrl);
  const columns = sheet.getRange(1, 2, 1, 11).getDisplayValues()[0].map(mcWebsiteCanonical_);
  const excluded = [FormApp.ItemType.SECTION_HEADER,FormApp.ItemType.PAGE_BREAK,
    FormApp.ItemType.IMAGE,FormApp.ItemType.VIDEO];
  const supported = [FormApp.ItemType.TEXT,FormApp.ItemType.PARAGRAPH_TEXT,
    FormApp.ItemType.MULTIPLE_CHOICE,FormApp.ItemType.LIST,FormApp.ItemType.CHECKBOX];
  const questions = form.getItems().filter(item => !excluded.includes(item.getType()));
  const names = questions.map(item => mcWebsiteCanonical_(item.getTitle()));
  const duplicates = names.filter((n,i) => names.indexOf(n) !== i);
  const missing = columns.filter(n => !names.includes(n));
  const unexpected = names.filter(n => !columns.includes(n));
  const unsupported = questions.filter(q => !supported.includes(q.getType()))
    .map(q => q.getTitle());
  const report = {
    ready: columns.length===11 && questions.length===11 && duplicates.length===0 &&
      missing.length===0 && unexpected.length===0 && unsupported.length===0,
    form_questions:questions.length, sheet_fields:columns.length,
    missing, unexpected, duplicates, unsupported
  };
  console.log(JSON.stringify(report));
  return report;
}
/**
 * Reconcile a PREVIOUSLY submitted Form response; never resubmit the Form.
 * Requires a stored FormResponse ID in the bridge ledger.
 * If the ledger says SUBMITTING and has no Form ID, stop for manual review.
 */
function mcWebsiteReconcileExisting_(uuid) {
  const id = String(uuid||"").trim();
  if (!/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(id))
    throw Error("Invalid submission ID");
  const lock = LockService.getScriptLock();
  lock.waitLock(25000);
  let ss, sheet, ledger, ledgerRow, formId, sheetRow, currentId;
  try {
    ss = SpreadsheetApp.getActiveSpreadsheet();
    if (!ss || ss.getId() !== MC_WEB_SHEET_ID) throw Error("Wrong response spreadsheet");
    sheet = ss.getSheetByName(MC_WEB_TAB);
    ledger = mcWebsiteLedger_();
    ledgerRow = mcWebsiteFindLedger_(ledger,id);
    if (!ledgerRow) return {ok:false,pending:true,reason:"No ledger entry"};
    const saved = ledger.getRange(ledgerRow,2,1,5).getValues()[0];
    if (saved[0] === "DONE") return {ok:true,already_complete:true,registration_id:String(saved[3]||"")};
    formId = String(saved[1]||"");
    sheetRow = Number(saved[2])||0;
    if (!formId) return {ok:false,pending:true,manual_review:true,
      reason:"Submission may have completed without ledger acknowledgement"};
    const form = FormApp.openByUrl(ss.getFormUrl());
    const formResponse = form.getResponse(formId);
    if (!formResponse) return {ok:false,pending:true,manual_review:true,reason:"Form response ID missing"};
    const answerMap = new Map(formResponse.getItemResponses().map(x=>
      [mcWebsiteCanonical_(x.getItem().getTitle()),
       mcWebsiteCanonical_(x.getResponse())]));
    const header = sheet.getRange(1,2,1,11).getDisplayValues()[0].map(mcWebsiteCanonical_);
    if (!sheetRow) {
      // No name-only or phone-only matching, and no silent choice when ambiguous.
      const last = sheet.getLastRow(), candidates = [];
      if (last >= 2) {
        const rows = sheet.getRange(2,1,last-1,19).getValues();
        for(let i=0;i<rows.length;i++) {
          const row=rows[i];
          if (!(row[0] instanceof Date) ||
              Math.abs(row[0].getTime()-formResponse.getTimestamp().getTime())>180000) continue;
          if (header.some((h,j)=>mcWebsiteCanonical_(row[j+1])!==answerMap.get(h))) continue;
          const marker = String(row[18]||"").trim();
          if (marker && marker!=="WEBSITE:"+id) continue;
          candidates.push(i+2);
        }
      }
      if (candidates.length!==1) return {ok:false,pending:true,manual_review:true,
        reason:"Response row matching is ambiguous or incomplete",matches:candidates.length};
      sheetRow=candidates[0];
    }
    const marker = String(sheet.getRange(sheetRow,19).getDisplayValue()||"").trim();
    if (marker && marker!=="WEBSITE:"+id)
      return {ok:false,pending:true,manual_review:true,reason:"Response row claimed by another intake"};
    if (!marker) sheet.getRange(sheetRow,19).setValue("WEBSITE:"+id);
    currentId=String(sheet.getRange(sheetRow,13).getDisplayValue()||"").trim();
    mcWebsiteUpdateLedger_(ledger,ledgerRow,"ROW_MATCHED",formId,sheetRow,currentId,"Reconciled existing response");
    if (currentId) {
      mcWebsiteUpdateLedger_(ledger,ledgerRow,"DONE",formId,sheetRow,currentId,"Recovered existing ID");
      return {ok:true,already_generated:true,registration_id:currentId};
    }
  } finally {lock.releaseLock();}
  // The original registration ID generator takes its own ScriptLock.
  if(typeof onFormSubmit !== "function") throw Error("Original ID generator unavailable");
  onFormSubmit({range:sheet.getRange(sheetRow,1)});
  const official=String(sheet.getRange(sheetRow,13).getDisplayValue()||"").trim();
  if (!official) return {ok:false,pending:true,reason:"Registration ID not yet available"};
  const doneLock=LockService.getScriptLock();
  doneLock.waitLock(25000);
  try {mcWebsiteUpdateLedger_(ledger,ledgerRow,"DONE",formId,sheetRow,official,"Recovered existing response");}
  finally{doneLock.releaseLock();}
  return {ok:true,registration_id:official};
}
