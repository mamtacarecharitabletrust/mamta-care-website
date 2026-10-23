import test from "node:test";
import assert from "node:assert/strict";
import registrationWorker from "../cloudflare/website-form-first-worker.mjs";
import {handleWebsiteDonorPhotos} from "../cloudflare/donor-desk-website-photos.mjs";

// Fully synthetic integration: Google Form and Turnstile are mocked.
// The original Google Form, production D1, real emails and R2 are never touched.
const regId="2026-231001/M/2022";
const requestId="11111111-1111-4111-8111-111111111111";
const host="https://mamta-care-website.vercel.app";
const image=new Uint8Array([137,80,78,71,13,10,26,10,0,0,0,13,73,72,68,82,0,0,0,1,0,0,0,1]);
function setup(){
 const intakes=new Map(),photoRows=[],objects=new Map(),upstream=[];
 const donor={id:"import-001",source:"google_sheet",registration_id:regId,assigned_to:"sai"};
 const DB={
   prepare(sql){
    let args=[];
    return {
     bind(...values){args=values;return this;},
     async run(){
      if(sql.startsWith("INSERT OR IGNORE INTO website_form_intakes")){
       const id=args[0];if(intakes.has(id))return {meta:{changes:0}};
       intakes.set(id,{state:args[1],registration_id:null});
       return {meta:{changes:1}};
      }
      if(sql.startsWith("UPDATE website_form_intakes")){
       const row=intakes.get(args[args.length-1]);
       row.state=sql.includes("state='COMPLETE'")?"COMPLETE":args[0];
       if(sql.includes("registration_id=?"))row.registration_id=args[0];
       return {meta:{changes:1}};
      }
      if(sql.startsWith("INSERT OR IGNORE INTO website_hair_photos")){
       if(photoRows.some(p=>p.donor_id===args[0]&&p.side===args[1]))return {meta:{changes:0}};
       photoRows.push({donor_id:args[0],side:args[1],object_key:args[2],mime:args[3],size_bytes:args[4]});
       return {meta:{changes:1}};
      }
      throw Error("Unexpected database write: "+sql);
     },
     async first(){
      if(sql.includes("FROM website_form_intakes"))return intakes.get(args[0])||null;
      if(sql.includes("FROM donors WHERE id=?"))return args[0]===donor.id?donor:null;
      throw Error("Unexpected database read: "+sql);
     },
     async all(){
      if(sql.includes("FROM website_form_photo_link")){
       return {results:intakes.get(requestId)?.state==="COMPLETE"
          ?photoRows.filter(p=>p.donor_id===donor.registration_id).map(p=>({...p,donor_id:donor.id})):[]};
      }
      throw Error("Unexpected database query: "+sql);
     }
    };
   },
   async batch(stmts){return Promise.all(stmts.map(x=>x.run()));}
 };
 const DONOR_PHOTOS={
  async put(key,bytes,{httpMetadata}){
   objects.set(key,{body:bytes,mime:httpMetadata.contentType});
  },
  async get(key){return objects.get(key)||null;}
 };
 const env={DB,DONOR_PHOTOS,TURNSTILE_SECRET:"FAKE_TURNSTILE",
  REGISTRATION_ENABLED:"true",INTEGRATION_VERIFIED:"true",
  GOOGLE_FORM_BRIDGE_SECRET:"FAKE_BRIDGE_SECRET",
  GOOGLE_FORM_BRIDGE_URL:"https://script.google.com/macros/s/FAKE_TEST/exec"};
 const form=()=>{
  const body=new FormData();
  Object.entries({
   submission_uuid:requestId,turnstile:"FAKE_SECURITY_TOKEN",method:"haircut",
   full_name:"MAMTA QA FICTIONAL DONOR",phone:"0000000000",email:"qa@example.invalid",
   gender:"FEMALE",hair_length:"14-16INCHES",city:"TEST CITY",
   hair_type:"STRAIGHT",guidance:"YES",readiness:"planning to donate",
   referral_source:"INSTAGRAM",voluntary:"yes",private_photos:"yes",terms_accepted:"yes"
  }).forEach(([k,v])=>body.set(k,v));
  body.set("front",new File([image],"test-front.png",{type:"image/png"}));
  body.set("back",new File([image],"test-back.png",{type:"image/png"}));
  return body;
 };
 return {env,intakes,photoRows,objects,upstream,donor,form};
}

test("synthetic full flow: original form response -> official ID -> two R2 photos -> authorized Donor Desk",async()=>{
 const env=setup();
 const oldFetch=globalThis.fetch;
 globalThis.fetch=async (url,opts)=>{
  if(String(url).includes("challenges.cloudflare.com")){
   return Response.json({success:true,hostname:"mamta-care-website.vercel.app"});
  }
  if(String(url).startsWith("https://script.google.com/")){
   const payload=JSON.parse(opts.body);
   assert.equal(payload.action,"website_submit");
   assert.equal(payload.secret,"FAKE_BRIDGE_SECRET");
   assert.equal(payload.values.full_name,"MAMTA QA FICTIONAL DONOR");
   env.upstream.push(payload);
   return Response.json({ok:true,registration_id:regId});
  }
  throw Error("Unexpected external request");
 };
 try{
  const request=new Request("https://example.workers.dev/api/register",{
   method:"POST",headers:{Origin:host},body:env.form()});
  const result=await registrationWorker.fetch(request,env.env);
  assert.equal(result.status,201);
  const data=await result.json();
  assert.equal(data.ok,true);assert.equal(data.registration_id,regId);
  assert.equal(data.photos_received,true);
  assert.equal(env.upstream.length,1);
  assert.equal(env.photoRows.length,2);
  assert.equal(env.objects.size,2);
  assert.equal(env.intakes.get(requestId).state,"COMPLETE");
  const status=await handleWebsiteDonorPhotos(
    new Request("https://desk.example/api/donors/import-001/website-photos"),
    env.env,{username:"sai",role:"team"});
  assert.deepEqual(await status.json(),{ok:true,has_front:true,has_back:true});
  for(const side of ["front","back"]){
   const photo=await handleWebsiteDonorPhotos(
    new Request("https://desk.example/api/donors/import-001/website-photos/"+side),
    env.env,{username:"sai",role:"team"});
   assert.equal(photo.status,200);
   assert.equal(photo.headers.get("content-type"),"image/png");
  }
  const outsider=await handleWebsiteDonorPhotos(
   new Request("https://desk.example/api/donors/import-001/website-photos/front"),
   env.env,{username:"another",role:"team"});
  assert.equal(outsider.status,403);
  const repeated=await registrationWorker.fetch(new Request("https://example.workers.dev/api/register",{
   method:"POST",headers:{Origin:host},body:env.form()}),env.env);
  assert.equal(repeated.status,200);
  assert.equal((await repeated.json()).existing,true);
  assert.equal(env.upstream.length,1,"duplicate request must not resubmit the Google Form");
 }finally{globalThis.fetch=oldFetch;}
});
