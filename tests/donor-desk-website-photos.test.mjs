import test from "node:test";
import assert from "node:assert/strict";
import {handleWebsiteDonorPhotos} from "../cloudflare/donor-desk-website-photos.mjs";

const donor={id:"sheet-1",source:"google_sheet",registration_id:"2026-231001/M/2022",assigned_to:"sai"};
const mock=()=>{
 const queries=[];
 const env={DB:{prepare(sql){const q={bind(...args){this.args=args;return this},async first(){queries.push({sql,args:this.args});return donor},async all(){queries.push({sql,args:this.args});return {results:[
  {side:"front",object_key:"secret-front",mime:"image/jpeg",size_bytes:2048},
  {side:"back",object_key:"secret-back",mime:"image/png",size_bytes:2048}
 ]}}};return q;}},DONOR_PHOTOS:{async get(k){return {body:new Uint8Array([1,2,3]),key:k}}}};
 return {env,queries};
};
const url=(p="")=>"https://desk.example/api/donors/sheet-1/website-photos"+p;
const request=p=>new Request(url(p));
test("unrelated paths are not intercepted",async()=>{const {env}=mock();assert.equal(await handleWebsiteDonorPhotos(new Request("https://desk.example/api/me"),env,{username:"sai",role:"team"}),null)});
test("unauthenticated users cannot fetch photo details",async()=>{
 const {env,queries}=mock();const r=await handleWebsiteDonorPhotos(request("/front"),env,null);
 assert.equal(r.status,401);assert.equal(queries.length,0);
});
test("unassigned staff are forbidden",async()=>{
 const {env,queries}=mock();const r=await handleWebsiteDonorPhotos(request("/back"),env,{username:"other",role:"team"});
 assert.equal(r.status,403);assert.equal(queries.length,1);
});
test("assigned staff can see photo existence without storage paths",async()=>{
 const {env}=mock();const r=await handleWebsiteDonorPhotos(request(),env,{username:"sai",role:"team"});
 assert.equal(r.status,200);const data=await r.json();
 assert.deepEqual(data,{ok:true,has_front:true,has_back:true});
 assert.equal(JSON.stringify(data).includes("secret-front"),false);
});
test("administrator can view front and back securely",async()=>{
 const {env}=mock();for(const side of ["front","back"]){
 const r=await handleWebsiteDonorPhotos(request("/"+side),env,{username:"administrator",role:"admin"});
 assert.equal(r.status,200);assert.equal(r.headers.get("cache-control"),"private, no-store");
 assert.equal(r.headers.get("content-type"),side==="front"?"image/jpeg":"image/png");
 }
});
test("write methods are rejected",async()=>{
 const {env}=mock();const req=new Request(url("/front"),{method:"POST"});
 const r=await handleWebsiteDonorPhotos(req,env,{username:"sai",role:"team"});
 assert.equal(r.status,405);
});
