import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const source=readFileSync(new URL("../apps-script/MamtaWebsiteGoogleFormBridge.gs",import.meta.url),"utf8");
const UUID="11111111-1111-4111-8111-111111111111";
const SECRET="s".repeat(60),OFFICIAL="2026-171101/M/2022";
const SHEET_ID="1IdEIAQEsaJ9QDmOQJiZ7C-rVHYZxDMvA8exoFxOBkWA";
const headers=[
  "FULL NAME:","CONTACT NO:","GENDER:","LENGTH THAT YOU PREFER TO DONATE",
  "CITY:","HAIR TYPE:","Would you loke guidance on how to cut and pack the hair for donation?",
  "Have you already cut your hair or planning to donate?",
  "How did you hear about Mamta Care Charitable Trust?",
  "I voluntarily wish to donate my hair for the noble cause of making wigs for cancer paitients through Mamta Care Charitable Tust",
  "EMAIL ADDRESS:"
];
function mock(state,{idInSheet="",marker="WEBSITE:"+UUID}={}){
  let officialId=idInSheet,ledgerState=state,ledgerId=state==="DONE"?OFFICIAL:"",idCalls=0;
  let ledgerNote="",activeLocks=0;
  const sheet={
    getLastRow:()=>200,
    getRange(r,c,n,m){
      if(r===1&&c===2&&n===1&&m===11)return {getDisplayValues:()=>[headers]};
      if(r===142&&c===19)return {getDisplayValue:()=>marker};
      if(r===142&&c===13)return {getDisplayValue:()=>officialId};
      if(r===142&&c===1)return {row:r};
      throw Error("Unexpected response sheet range "+[r,c,n,m].join(":"));
    }
  };
  const ledger={
    getLastRow:()=>2,
    getRange(r,c,n,m){
      if(r===2&&c===1&&n===1&&m===1)return {getDisplayValues:()=>[[UUID]]};
      if(r===2&&c===2&&n===1&&m===5)
        return {getValues:()=>[[ledgerState,"FORM-RESPONSE-001",142,ledgerId,new Date()]]};
      if(r===2&&c===2&&n===1&&m===6)
        return {setValues([row]){
          [ledgerState,, ,ledgerId,,ledgerNote]=row;
        }};
      throw Error("Unexpected ledger range "+[r,c,n,m].join(":"));
    }
  };
  const spreadsheet={
    getId:()=>SHEET_ID,
    getSheetByName(name){
      if(name==="Form Responses 1")return sheet;
      if(name==="MC_Web_Intake_Ledger")return ledger;
      throw Error("Unexpected tab");
    }
  };
  const context={
    SpreadsheetApp:{getActiveSpreadsheet:()=>spreadsheet,flush(){}},
    PropertiesService:{getScriptProperties:()=>({getProperty:k=>k==="WEBSITE_FORM_BRIDGE_SECRET"?SECRET:""})},
    LockService:{getScriptLock:()=>({
      tryLock:()=>{activeLocks++;return true;},
      waitLock:()=>{activeLocks++;},
      releaseLock:()=>{activeLocks--;}
    })},
    ContentService:{
      MimeType:{JSON:"application/json"},
      createTextOutput(s){return {body:s,setMimeType(){return this;}};}
    },
    onFormSubmit(e){
      assert.equal(e.range.row,142);
      assert.equal(activeLocks,0,"Original generator runs outside the reconciliation lock");
      idCalls++;
      officialId=OFFICIAL;
    },
    console:{error(){}},
    Date
  };
  vm.createContext(context);
  vm.runInContext(source,context,{filename:"MamtaWebsiteGoogleFormBridge.gs"});
  const status=()=>JSON.parse(context.mcWebsiteBridgePost_({
    action:"website_status",submission_uuid:UUID,secret:SECRET
  }).body);
  return {status,state:()=>ledgerState,id:()=>ledgerId,idCalls:()=>idCalls,note:()=>ledgerNote};
}

test("ROW_MATCHED resumes the original ID generator once without resubmitting Google Form",()=>{
  const x=mock("ROW_MATCHED");
  assert.deepEqual({ok:x.status().ok,id:x.id(),state:x.state(),calls:x.idCalls()},
    {ok:true,id:OFFICIAL,state:"DONE",calls:1});
  assert.equal(x.status().registration_id,OFFICIAL);
  assert.equal(x.idCalls(),1,"no duplicate email or ID generator invocation");
});

test("ROW_MATCHED with an existing official ID recovers without running generator",()=>{
  const x=mock("ROW_MATCHED",{idInSheet:OFFICIAL});
  const r=x.status();
  assert.equal(r.ok,true);
  assert.equal(r.registration_id,OFFICIAL);
  assert.equal(x.state(),"DONE");
  assert.equal(x.idCalls(),0);
});

test("ID_GENERATING without an official ID never invokes generator twice",()=>{
  const x=mock("ID_GENERATING");
  const r=x.status();
  assert.equal(r.pending,true);
  assert.equal(x.idCalls(),0);
  assert.equal(x.state(),"ID_GENERATING");
});

test("UUID marker mismatch does not generate or attach an ID",()=>{
  const x=mock("ROW_MATCHED",{marker:"WEBSITE:different"});
  assert.equal(x.status().pending,true);
  assert.equal(x.idCalls(),0);
  assert.equal(x.state(),"ROW_MATCHED");
});

test("SUBMITTING remains guarded against duplicate Form response",()=>{
  const x=mock("SUBMITTING");
  assert.equal(x.status().pending,true);
  assert.equal(x.idCalls(),0);
  assert.equal(x.state(),"SUBMITTING");
});
