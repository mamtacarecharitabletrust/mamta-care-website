import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const code=fs.readFileSync(new URL('../apps-script/MamtaWigAgreementRelay.gs',import.meta.url),'utf8');
function fixture(){
 const ledger=[],sent=[],props={WIG_AGREEMENT_RELAY_SECRET:'x'.repeat(48),WIG_AGREEMENT_RELAY_ENABLED:'YES',WIG_AGREEMENT_ALLOWED_ORIGIN:'https://demo.example.invalid',WIG_AGREEMENT_LEDGER_SHEET_ID:'fictional'};
 const sheet={getLastRow:()=>ledger.length,appendRow:r=>ledger.push(r),setFrozenRows(){},hideSheet(){},getRange(row,col,n,m){return {getDisplayValues:()=>ledger.slice(row-1,row-1+n).map(r=>r.slice(col-1,col-1+m).map(String)),setValues(v){v.forEach((r,i)=>r.forEach((x,j)=>ledger[row-1+i][col-1+j]=x));}}}};
 let made=false,fail=false;
 const context={ContentService:{MimeType:{JSON:'json'},createTextOutput:s=>({setMimeType(){return JSON.parse(s)}})},PropertiesService:{getScriptProperties:()=>({getProperty:k=>props[k]})},LockService:{getScriptLock:()=>({tryLock:()=>true,releaseLock(){}})},SpreadsheetApp:{openById:()=>({getSheetByName:()=>made?sheet:null,insertSheet:()=>{made=true;return sheet}}),flush(){}},MailApp:{getRemainingDailyQuota:()=>50,sendEmail:m=>{sent.push(m);if(fail)throw Error('synthetic uncertain send')}},Utilities:{base64Decode:s=>Array.from(Buffer.from(s,'base64')),computeDigest:(a,s)=>Array.from(Buffer.from(s).subarray(0,32)),newBlob:()=>({}),DigestAlgorithm:{SHA_256:1},Charset:{UTF_8:1}}};
 vm.createContext(context);vm.runInContext(code,context);const run=p=>context.mcWigAgreementRelayPost_(p);
 const msg={secret:props.WIG_AGREEMENT_RELAY_SECRET,action:'wig_agreement_send',message_id:'fictional-agreement-001:agreement',kind:'AGREEMENT',to:'test@example.invalid',patient_name:'Sample Patient',registration_id:'DEMO',link:props.WIG_AGREEMENT_ALLOWED_ORIGIN+'/wig-agreement/accept/'+'a'.repeat(64),otp:'123456',pdf_base64:Buffer.from('%PDF-'+'.'.repeat(120)).toString('base64')};
 return {run,msg,sent,ledger,props,fail:()=>fail=true};
}
test('authorized agreement uses first-email template and avoids payment instructions',()=>{const f=fixture();assert.equal(f.run(f.msg).sent,true);assert.equal(f.sent.length,1);assert.match(f.sent[0].body,/do not make any payment now/i);assert.equal(f.sent[0].attachments.length,1);assert.equal(f.run(f.msg).already_sent,true);assert.equal(f.sent.length,1);});
test('bad secret, disabled relay, invalid origin, invalid pdf rejected',()=>{const f=fixture();assert.equal(f.run({...f.msg,secret:'bad'}).ok,false);assert.equal(f.run({...f.msg,link:'https://wrong.invalid/a'}).ok,false);assert.equal(f.run({...f.msg,pdf_base64:'notpdf'}).ok,false);f.props.WIG_AGREEMENT_RELAY_ENABLED='NO';assert.equal(f.run(f.msg).ok,false);assert.equal(f.sent.length,0)});
test('payment blocked before consent or verified destination',()=>{const f=fixture(),p={...f.msg,kind:'PAYMENT',message_id:'fictional-agreement-001:payment',link:f.props.WIG_AGREEMENT_ALLOWED_ORIGIN+'/wig-agreement/payment/'+'b'.repeat(64),amount:10000,accepted:true,acceptance_reference:'DEMO',destination_verified:true};assert.equal(f.run({...p,accepted:false}).ok,false);assert.equal(f.run({...p,destination_verified:false}).ok,false);assert.equal(f.run(p).sent,true);assert.equal(f.sent.length,1)});
test('uncertain provider outcome never automatically replays',()=>{const f=fixture();f.fail();assert.equal(f.run(f.msg).uncertain,true);assert.equal(f.run(f.msg).uncertain,true);assert.equal(f.sent.length,1)});
