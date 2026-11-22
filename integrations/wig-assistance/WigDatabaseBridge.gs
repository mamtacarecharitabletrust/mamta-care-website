/**
 * Mamta Care Wig Donation Database bridge (deployment required).
 * Bound to the existing Wig Donation Database; preserve Form Responses 1 A:AT.
 * NEVER make an Apps Script web-app deployment public without the 48+ character
 * WIG_SHEET_BRIDGE_SECRET Script Property; use a dedicated signed HTTPS request.
 * Required property: WIG_SHEET_BRIDGE_SECRET.
 */
var MC_WIG_SHEET_ID='1faqjVEw9R58IplJ9HouHf-ndMdXbPEx_9XX2mJoCrBI';
var MC_WIG_DATA_TAB='Form Responses 1';
var MC_WIG_LEDGER_TAB='WIG Automation Ledger';
function wigJson_(o){return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON)}
function wigSafe_(value,max){return String(value==null?'':value).trim().slice(0,max||500)}
function wigEq_(a,b){a=String(a||'');b=String(b||'');if(a.length!==b.length)return false;var match=0;for(var i=0;i<a.length;i++)match|=a.charCodeAt(i)^b.charCodeAt(i);return match===0}
function wigDate_(){return Utilities.formatDate(new Date(),'Asia/Kolkata','yyyy-MM-dd HH:mm:ss')}
function wigData_(){var ss=SpreadsheetApp.openById(MC_WIG_SHEET_ID);var sh=ss.getSheetByName(MC_WIG_DATA_TAB);if(!sh)throw Error('Original Form Responses 1 tab not found');return {ss:ss,sh:sh}}
function wigLedger_(ss){var sh=ss.getSheetByName(MC_WIG_LEDGER_TAB);if(!sh){sh=ss.insertSheet(MC_WIG_LEDGER_TAB);sh.getRange(1,1,1,7).setValues([['Action key','Registration ID','Action','State','Updated IST','Detail','Attempt']]);sh.setFrozenRows(1)}return sh}
function wigFind_(sh,reg){var col=36;var last=sh.getLastRow();if(last<2)return 0;var values=sh.getRange(2,col,last-1,1).getDisplayValues();for(var i=0;i<values.length;i++)if(String(values[i][0]).trim()===reg)return i+2;return 0}
function wigLedgerRow_(sh,key){var last=sh.getLastRow();if(last<2)return 0;var values=sh.getRange(2,1,last-1,1).getValues();for(var i=0;i<values.length;i++)if(values[i][0]===key)return i+2;return 0}
function wigLog_(sh,key,reg,action,state,detail,attempt){var row=wigLedgerRow_(sh,key);var vals=[[key,reg,action,state,wigDate_(),wigSafe_(detail,700),attempt||0]];if(row)sh.getRange(row,1,1,7).setValues(vals);else sh.getRange(sh.getLastRow()+1,1,1,7).setValues(vals)}
function wigMail_(email,subject,html){if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw Error('Invalid patient email');MailApp.sendEmail({to:email,subject:subject,htmlBody:html,name:'Mamta Care Charitable Trust'})}
function wigEsc_(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}

function wigSummary_(ss,c,status){
 var sh=ss.getSheetByName('Sheet1');
 if(!sh)throw Error('Original Sheet1 summary missing');
 var last=sh.getLastRow(),row=0;
 if(last>1){var list=sh.getRange(2,1,last-1,1).getDisplayValues();for(var i=0;i<list.length;i++)if(String(list[i][0]).trim()===c.registration_id){row=i+2;break}}
 if(!row)row=Math.max(2,last+1);
 sh.getRange(row,1,1,6).setValues([[c.registration_id,c.patient_name,c.city,c.applied_day_ist,status,wigDate_()]]);
 return row;
}
function wigMakerSync_(book,ledger,c){
 var version=Number(c.maker_version);
 if(!Number.isInteger(version)||version<1||version>100000)return {ok:false,error:'Invalid maker status version'};
 var allowed=['assigned','in_progress','ready','received','cancelled'];
 var state=wigSafe_(c.maker_status,30).toLowerCase();
 if(allowed.indexOf(state)===-1)return {ok:false,error:'Unknown manufacturing status'};
 var record=wigFind_(book.sh,c.registration_id);
 if(!record)throw Error('Patient case is missing from the original Wig Donation Database');
 var key='MAKER_LATEST:'+c.registration_id,last=wigLedgerRow_(ledger,key);
 var lastVersion=last?Number(ledger.getRange(last,7).getValue()):0;
 if(lastVersion>=version)return {ok:true,already_synced:true,version:lastVersion};
 var names={assigned:'Assigned to CINE WIGS',in_progress:'Wig fabrication in progress',ready:'Wig ready at CINE WIGS',received:'Wig received by Mamta Care',cancelled:'Manufacturing order cancelled'};
 var status=names[state];
 book.sh.getRange(record,39).setValue(status);
 book.sh.getRange(record,40).setValue(wigDate_());
 wigSummary_(book.ss,c,status);
 wigLog_(ledger,key,c.registration_id,'MAKER_LATEST','DONE',status,version);
 return {ok:true,updated:true,status:status,version:version};
}

function wigCreate_(sh,c,p){
 var existing=wigFind_(sh,c.registration_id);if(existing)return {ok:true,row:existing,already_exists:true};
 var vals=Array(46).fill('');
 var put=function(n,v){vals[n-1]=v==null?'':v};
 put(1,new Date());put(2,c.patient_name);put(3,p.age);put(4,p.gender);
 put(5,c.city);put(6,p.state);put(7,p.pin);put(8,p.guardian);put(9,p.relationship);
 put(10,c.phone);put(11,p.whatsapp);put(12,c.email);put(13,p.language);
 put(14,p.cancerRelated);put(15,p.diagnosis);put(16,p.treatment);put(17,p.hospital);put(18,p.doctor);
 put(19,p.hairLoss);put(20,p.wigType);put(21,p.wigLength);put(22,p.wigColor);put(23,p.texture);
 put(24,'Four patient fitting photographs in private Donor Desk storage (front/back/left/right)');
 put(25,p.medical_document_present?'Provided securely':'Pending / not provided');
 put(26,p.capSize?'Yes':'No');put(27,p.capSize);put(28,p.virtualFitting);
 put(29,p.delivery);put(30,p.address);put(31,p.callTime);put(32,p.urgency);put(33,p.notes);
 put(34,'Consented to application and private verification');
 put(35,'Training: '+(p.mediaTraining?'YES':'NO')+'; Public awareness: '+(p.mediaPublic?'YES':'NO'));
 put(36,c.registration_id);put(37,c.applied_day_ist);
 put(38,'PENDING REVIEW');put(39,'APPLICATION RECEIVED');put(40,wigDate_());
 put(44,'NOT SENT');
 put(46,'Website Wig Portal | '+(p.hairSource||'donated')+' hair | ID: '+c.registration_id);
 var row=Math.max(2,sh.getLastRow()+1);
 sh.getRange(row,1,1,46).setValues([vals]);
 wigSummary_(SpreadsheetApp.openById(MC_WIG_SHEET_ID),c,'APPLICATION RECEIVED');
 return {ok:true,row:row,created:true}
}
function wigApprove_(sh,c){
 var row=wigFind_(sh,c.registration_id);if(!row)throw Error('Registration is missing from the original Google Sheet');
 sh.getRange(row,38).setValue('APPROVED');sh.getRange(row,39).setValue('APPROVED - MAKER ASSIGNED');sh.getRange(row,40).setValue(wigDate_());
 var note=wigSafe_(sh.getRange(row,46).getDisplayValue(),700);
 sh.getRange(row,46).setValue(note+' | Maker: CINE WIGS | Order ref: '+wigSafe_(c.maker_job_id,45));
 wigSummary_(SpreadsheetApp.openById(MC_WIG_SHEET_ID),c,'APPROVED - MAKER ASSIGNED');
 return {ok:true,row:row,updated:true};
}
function wigSendMail_(ledger,action,c){
 var key=action+':'+c.registration_id;
 var row=wigLedgerRow_(ledger,key),prev=row?ledger.getRange(row,4).getDisplayValue():'';
 if(prev==='SENT')return {ok:true,already_sent:true};
 if(prev==='SENDING')return {ok:false,needs_manual_review:true,error:'Previous email attempt uncertain; manual review required to prevent duplicate messages'};
 wigLog_(ledger,key,c.registration_id,action,'SENDING','Email send started',1);
 var safeName=wigEsc_(c.patient_name),safeReg=wigEsc_(c.registration_id);
 var html,subject;
 if(action==='APPROVAL_EMAIL'){
  subject='Your Free Wig Assistance Request Has Been Approved — Mamta Care';
  html='<p>Dear '+safeName+',</p><p>We are pleased to inform you that your free wig assistance request has been approved.</p><p><b>Registration number:</b> '+safeReg+'</p><p>The wig itself is provided without a purchase price. Our team will contact you about fabrication, fitting and next steps. If applicable, refundable deposit and courier conditions will be disclosed in writing before any payment is requested.</p><p>With warm regards,<br><b>Mamta Care Charitable Trust</b></p>';
 }else{
  subject='We Have Received Your Wig Assistance Request — Mamta Care';
  html='<p>Dear '+safeName+',</p><p>We have received your application for free wig assistance.</p><p><b>Registration number:</b> '+safeReg+'</p><p>Your application is pending verification. Submission does not guarantee approval. Please keep your registration number for future correspondence.</p><p>With warm regards,<br><b>Mamta Care Charitable Trust</b></p>';
 }
 try{wigMail_(c.email,subject,html);wigLog_(ledger,key,c.registration_id,action,'SENT','Patient email sent',1);return {ok:true,sent:true}}
 catch(e){wigLog_(ledger,key,c.registration_id,action,'FAILED',String(e),1);throw e}
}
function doPost(e){
 var input;try{input=JSON.parse(e.postData.contents||'{}')}catch{return wigJson_({ok:false,error:'Invalid JSON'})}
 var secret=PropertiesService.getScriptProperties().getProperty('WIG_SHEET_BRIDGE_SECRET')||'';
 if(secret.length<48||!wigEq_(input.secret,secret))return wigJson_({ok:false,error:'Not authorized'});
 var action=wigSafe_(input.action,40),c=input.record||{};
 var reg=wigSafe_(c.registration_id,45);
 if(!/^\d{4}\/\d{4}\d{2,}$/.test(reg))return wigJson_({ok:false,error:'Invalid registration ID'});
 if(!['GOOGLE_SHEET_CREATE','GOOGLE_SHEET_APPROVE','REGISTRATION_EMAIL','APPROVAL_EMAIL'].includes(action)&&!/^MAKER_STATUS_V[1-9][0-9]{0,5}$/.test(action))return wigJson_({ok:false,error:'Unknown action'});
 var lock=LockService.getScriptLock();
 try{lock.waitLock(25000)}catch{return wigJson_({ok:false,error:'Busy; retry later'})}
 try{
  var book=wigData_(),ledger=wigLedger_(book.ss),key=action+':'+reg;
  var already=wigLedgerRow_(ledger,key);
  if(already&&ledger.getRange(already,4).getDisplayValue()==='DONE')return wigJson_({ok:true,already_done:true});
  var result;
  if(action==='GOOGLE_SHEET_CREATE')result=wigCreate_(book.sh,c,c.payload||{});
  else if(action==='GOOGLE_SHEET_APPROVE')result=wigApprove_(book.sh,c);
  else if(action.indexOf('MAKER_STATUS_V')===0)result=wigMakerSync_(book,ledger,c);
  else result=wigSendMail_(ledger,action,c);
  if(result.ok){wigLog_(ledger,key,reg,action,'DONE',JSON.stringify(result),1);}
  return wigJson_(result);
 }catch(err){return wigJson_({ok:false,error:wigSafe_(String(err),280)})}
 finally{lock.releaseLock()}
}