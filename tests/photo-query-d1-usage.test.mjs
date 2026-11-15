import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {Script,runInNewContext} from "node:vm";
import {webcrypto} from "node:crypto";

const source=readFileSync("cloudflare/custom-photo-auto-link-v11-addon.mjs","utf8");
const start=source.indexOf("async function mcctNoReviewV11Backfill(env){");
const end=source.indexOf("async function mcctNoReviewV11Status(db){",start);
assert.ok(start>=0&&end>start,"Required photo function exists");
const code=source.slice(start,end);
const uuid="87654321-5678-4567-a567-123456789abc";
const registration="2026-101104/M/2022";
function fakeDb(donors){
 const queries=[];
 return {queries,prepare(sql){
  queries.push(sql);
  const query=sql;
  return {
   bind(){return this;},
   async run(){return{meta:{changes:1}};},
   async all(){
    if(query.includes("SELECT submission_uuid,front_key,back_key"))
      return{results:[{submission_uuid:uuid,front_key:"private/front.jpg",back_key:"private/back.jpg",registration_id:null}]};
    if(query.includes("SELECT id,source,registration_id,sheet_extra FROM donors"))
      return{results:donors};
    if(query.includes("SELECT submission_uuid,registration_id FROM website_form_intakes"))
      return{results:[]};
    if(query.includes("SELECT side,object_key FROM website_hair_photos"))
      return{results:[{side:"front",object_key:"private/front.jpg"},{side:"back",object_key:"private/back.jpg"}]};
    throw Error("Unexpected query: "+query);
   }
  };
 }};
}
function runner(){
 const ctx={console:{error(){}},Date,Map,Set,Promise,String,Math,Number,JSON,crypto:webcrypto};
 runInNewContext(code,ctx);
 return ctx.mcctNoReviewV11Backfill;
}
test("photo matcher no longer runs correlated donor subqueries",()=>{
 assert.doesNotMatch(code,/SELECT COUNT\(\*\) FROM donors d2|SELECT COUNT\(\*\) FROM donors d3/);
 assert.match(code,/const \[donorIndex,intakeIndex\]/);
 assert.match(code,/const markers=new Map\(\),registrationCounts=new Map\(\),intakeClaims=new Map\(\)/);
 assert.match(source,/getUTCMinutes\(\)%20===0/);
 assert.match(source,/MCCT_PHOTO_QUERY_INDEXED_V13_20261115/);
});
test("exact original Form marker and unique registration can link stored private photo pair",async()=>{
 const db=fakeDb([{id:"one",source:"google_sheet",registration_id:registration,sheet_extra:"WEBSITE:"+uuid}]);
 const result=await runner()({DB:db,DONOR_PHOTOS:{head:async()=>null}});
 assert.equal(result.linked,1);
 assert.equal(result.created_ids,0);
 assert.equal(result.sent_emails,0);
 assert.ok(db.queries.length<=6);
 assert.ok(!db.queries.some(q=>q.includes("COUNT(*) FROM donors")));
});
test("duplicate official IDs must not automatically link a case",async()=>{
 const db=fakeDb([
  {id:"one",source:"google_sheet",registration_id:registration,sheet_extra:"WEBSITE:"+uuid},
  {id:"two",source:"manual",registration_id:registration,sheet_extra:null}
 ]);
 const result=await runner()({DB:db,DONOR_PHOTOS:{head:async()=>null}});
 assert.equal(result.linked,0);
 assert.equal(result.processed,0);
 assert.ok(!db.queries.some(q=>q.includes("INSERT INTO website_hair_photos")));
});
test("wrong website source UUID cannot be matched by phone, name, or proximity",async()=>{
 const db=fakeDb([{id:"one",source:"google_sheet",registration_id:registration,sheet_extra:"WEBSITE:00000000-0000-4000-8000-000000000000"}]);
 const result=await runner()({DB:db,DONOR_PHOTOS:{head:async()=>null}});
 assert.equal(result.linked,0);
 assert.equal(result.created_ids,0);
});
