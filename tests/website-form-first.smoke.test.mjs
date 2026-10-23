import test from "node:test";
import assert from "node:assert/strict";
import worker from "../cloudflare/website-form-first-worker.mjs";

const base="https://example.workers.dev";
const origin="https://mamta-care-website.vercel.app";
const config={REGISTRATION_ENABLED:"false",INTEGRATION_VERIFIED:"false",
 GOOGLE_FORM_BRIDGE_URL:"https://script.google.com/macros/s/AKfycbTESTabc123/exec",
 GOOGLE_FORM_BRIDGE_SECRET:"FAKE_SMOKE_TEST_ONLY"};

test("health reports website intake disabled",async()=>{
 const r=await worker.fetch(new Request(base+"/health"),config);
 assert.equal(r.status,200);
 const j=await r.json();
 assert.equal(j.ok,true);
 assert.equal(j.accepting_submissions,false);
});

test("POST cannot accept real submissions while disabled",async()=>{
 const r=await worker.fetch(new Request(base+"/api/register",{method:"POST",
 headers:{Origin:origin},body:"not-a-real-form"}),config);
 assert.equal(r.status,503);
 assert.equal((await r.json()).ok,false);
});

test("CORS permits official website only",async()=>{
 for(const originValue of [origin,"https://unapproved.example.com"]){
  const r=await worker.fetch(new Request(base+"/api/register",{method:"OPTIONS",
   headers:{Origin:originValue}}),config);
  assert.equal(r.status,204);
  assert.equal(r.headers.get("access-control-allow-origin")===originValue,originValue===origin);
 }
});

test("unknown routes fail closed",async()=>{
 const r=await worker.fetch(new Request(base+"/unlisted"),config);
 assert.equal(r.status,404);
});
