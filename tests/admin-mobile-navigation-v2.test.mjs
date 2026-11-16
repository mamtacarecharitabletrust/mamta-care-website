import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {Script,createContext} from "node:vm";

const css=readFileSync("cloudflare/admin-mobile-v2.css","utf8");
const js=readFileSync("cloudflare/admin-mobile-v2.js","utf8");
const addon=readFileSync("cloudflare/admin-mobile-navigation-v2-addon.mjs","utf8");
const full=addon.replace('__MCUX_CSS_JSON__',JSON.stringify(css)).replace('__MCUX_JS_JSON__',JSON.stringify(js));

const page=(role)=>'<!doctype html><html><head><title>Mamta Care</title></head><body><div class="rail"><nav id="navs">'+
'<button class="nav" data-view="dashboard">Overview</button>'+
'<button class="nav" data-view="desk">Donor Desk</button>'+
'<a class="nav" data-mcst-link="1" href="/hair-stock">Hair Stock</a></nav></div>'+
'<header class="top"><b id="heading">Overview</b><div class="topright"></div></header>'+
'<main id="main"><div class="pane"><h1 class="h1">One connected NGO workspace</h1><p class="muted">Hello</p>'+
'<div class="grid"><div class="stat">All donors</div></div><div class="card"><h2>Your workspaces</h2></div></div></main>'+
'<script>const MC_ROLE='+JSON.stringify(role)+';</script></body></html>';

function worker(html){
 const ctx=createContext({console,Headers,Response,URL});
 ctx.launch_wig_maker_portal_worker_default={fetch:async()=>new Response(html,{status:200,headers:{'content-type':'text/html; charset=utf-8','cache-control':'no-store','content-security-policy':"default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src 'self'"}})};
 new Script(full).runInContext(ctx);
 return ctx.launch_wig_maker_portal_worker_default.fetch;
}
test("compiled admin stylesheet, JS and Worker wrapper pass JS parsing",()=>{
 assert.doesNotThrow(()=>new Script(js));
 assert.doesNotThrow(()=>new Script(full));
 assert.match(full,/MCUX_ADMIN_MOBILE_COMMAND_CENTER_V2_20261116/);
 assert.match(js,/MC_ROLE!=='admin'/);
 assert.match(addon,/MCUX_NAV_PREVIOUS_FETCH.call\(this,req,env,ctx\)/);
 assert.doesNotMatch(full,/env\.DB\.prepare|DELETE FROM donors|UPDATE donors SET|CREATE TABLE/i);
});
test("mobile UI has no horizontal overflow-only feature navigation",()=>{
 assert.match(css,/\.navs\{display:flex;flex-direction:column;overflow:visible/);
 assert.match(css,/\.mcux-bottom\{position:fixed/);
 assert.match(css,/prefers-reduced-motion:reduce/);
 assert.match(css,/\.mcux-modal/);
 assert.match(js,/Hair Stock & approvals/);
 assert.match(js,/function openSearch/);
 assert.match(js,/function openDrawer/);
 assert.match(js,/function renderHome/);
 assert.match(js,/function makeDirectory/);
 assert.match(js,/document\.body\.classList\.add\('mcux-admin'\)/);
});
test("all native admin workspace views remain discoverable",()=>{
 for(const x of ['dashboard','desk','queue','people','photos','courier','review','referrals','wig','partners','hospital','website']){
  assert.match(js,new RegExp("id:'"+x+"'"));
 }
 for(const url of ['/hair-stock','/app/hand-collections','/app/receipts','/app/print-studio','/admin-registration-sync','/app/courier-certificate-sync','/admin-ops']){
  assert.ok(js.includes("href:'"+url+"'"),url+" must stay findable");
 }
 assert.match(js,/const extras=\[\]/);
 assert.match(js,/Other existing tools/);
 assert.match(js,/navByView\.get\(view\)\.click\(\)/);
});
test("authenticated administrator /app receives additive UI; originals preserved",async()=>{
 const initial=page("admin");
 const fetch=worker(initial);
 const response=await fetch(new Request("https://example.test/app"),{},{});
 const html=await response.text();
 assert.equal(response.status,200);
 assert.match(html,/data-mcux-admin="v2"/);
 assert.match(html,/Hair Stock & approvals/);
 assert.match(html,/data-view="desk"/);
 assert.match(html,/data-mcst-link="1"/);
 assert.match(html,/const MC_ROLE="admin"/);
 assert.match(html,/<style data-mcux-admin="v2">/);
 assert.match(html,/<script data-mcux-admin="v2">/);
 assert.equal(html.split('data-mcux-admin="v2"').length,3);
 assert.ok(html.length>initial.length);
 assert.equal(response.headers.get('cache-control'),'private,no-store');
});
test("existing staff and signed-out sign-in screens stay byte-identical",async()=>{
 for(const role of ["staff","volunteer","maker",""]){
  const existing=page(role);
  const fetch=worker(existing);
  const response=await fetch(new Request("https://example.test/app"),{},{});
  assert.equal(await response.text(),existing);
 }
});
test("all non-shell routes use original handler unchanged",async()=>{
 const initial=page("admin"),fetch=worker(initial);
 for(const route of ['/api/stock/dashboard','/hair-stock','/maker','/app/receipts','/app/print-studio','/app/workspace/desk']){
  const response=await fetch(new Request("https://example.test"+route),{},{});
  assert.equal(await response.text(),initial);
 }
});
test("never inject when the original app layout has changed",async()=>{
 const initial=page("admin").replace('id="navs"','id="changed-nav"');
 const response=await worker(initial)(new Request("https://example.test/app"),{},{});
 assert.equal(await response.text(),initial);
});
