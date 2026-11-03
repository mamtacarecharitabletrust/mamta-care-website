import test from "node:test";
import assert from "node:assert/strict";
import worker from "../cloudflare/website-form-first-worker.mjs";

const base="https://qa.example.workers.dev",origin="https://mamta-care-website.vercel.app";
const uuid="4f73d8ab-4abc-4bd1-a3fd-d2cbb73d1790",registrationId="2026-241001/M/2022";
const sample={full_name:"Demo Person",phone:"9876543210",gender:"Female",hair_length:"16 inches",city:"Guntur",hair_type:"Straight",guidance:"Yes",readiness:"Ready",referral_source:"Test",email:"demo@example.invalid",method:"haircut",voluntary:"yes",private_photos:"yes",terms_accepted:"yes",turnstile:"test"};
const jpeg=new Uint8Array([0xff,0xd8,0xff,0xdb,0x00,0x43,0x00]);
function payload(){const f=new FormData();for(const [k,v] of Object.entries(sample))f.set(k,v);f.set("submission_uuid",uuid);f.set("front",new File([jpeg],"front.jpg",{type:"image/jpeg"}));f.set("back",new File([jpeg],"back.jpg",{type:"image/jpeg"}));return f;}
function harness(bridgeReplies){
 const calls=[],values=new Map();let state="";let photoRows=0;
 const db={prepare(sql){return {bind(...params){return {async run(){if(sql.startsWith("INSERT OR IGNORE INTO website_form_intakes")){if(state)return {meta:{changes:0}};state="RESERVED";return {meta:{changes:1}};}if(sql.startsWith("UPDATE website_form_intakes")){state=sql.includes("COMPLETE")?"COMPLETE":sql.includes("REVIEW_REQUIRED")?"REVIEW_REQUIRED":"PHOTOS_STORED";return {meta:{changes:1}};}return {meta:{changes:1}};},async first(){return null;}}},async run(){return {meta:{changes:1}}}}},async batch(items){photoRows+=2;return [{meta:{changes:1}},{meta:{changes:1}},{meta:{changes:1}}]}};
 const env={REGISTRATION_ENABLED:"true",INTEGRATION_VERIFIED:"true",DB:db,DONOR_PHOTOS:{async put(){}},TURNSTILE_SECRET:"test",GOOGLE_FORM_BRIDGE_SECRET:"testsecret",GOOGLE_FORM_BRIDGE_URL:"https://script.google.com/macros/s/AKfycbTESTabc123/exec"};
 const original=globalThis.fetch;let i=0;
 globalThis.fetch=async(url,opts)=>{if(String(url).includes("challenges.cloudflare.com"))return new Response(JSON.stringify({success:true,hostname:"mamta-care-website.vercel.app"}),{status:200});let b=JSON.parse(opts.body);calls.push(b.action);return new Response(JSON.stringify(bridgeReplies[Math.min(i++,bridgeReplies.length-1)]),{status:200});};
 return {env,calls,read:()=>({state,photoRows}),restore:()=>globalThis.fetch=original};
}
for(const [label,replies,expected,callsExpected] of [
 ["immediate success",[{ok:true,registration_id:registrationId}],201,["website_submit"]],
 ["delayed status recovery",[{ok:false,pending:true},{ok:true,registration_id:registrationId}],201,["website_submit","website_status"]],
 ["unconfirmed outcome",[{ok:false,pending:true}],202,["website_submit","website_status","website_status"]]
]){
 test(label,async()=>{const h=harness(replies);try{const response=await worker.fetch(new Request(base+"/api/register",{method:"POST",headers:{Origin:origin},body:payload()}),h.env);assert.equal(response.status,expected);assert.deepEqual(h.calls,callsExpected);const body=await response.json();if(expected===201){assert.equal(body.registration_id,registrationId);assert.equal(h.read().state,"COMPLETE");}else{assert.equal(body.pending,true);assert.equal(h.read().state,"REVIEW_REQUIRED");}}finally{h.restore();}});
}
