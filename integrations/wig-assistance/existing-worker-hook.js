/*
 * Mamta Care Wig V8 integration hook.
 * For Cloudflare module deployment, prepend:
 *   import {handleMamtaWigV8,wigProductionGuard,drainMamtaWigOutbox} from "./mcwig-v8.js";
 * to the existing bundled worker.js, include mcwig-v8.js as a second module,
 * then append this hook AFTER all existing Donor Desk patches.
 *
 * IMPORTANT: Keep original Worker bindings (including all secrets), schedules,
 * routes, donor desk data and sessions unchanged. Roll back if tests fail.
 */
const mcwigPriorFetch=launch_wig_maker_portal_worker_default.fetch;
launch_wig_maker_portal_worker_default.fetch=async function mcwigV8Fetch(req,env,ctx){
 const path=new URL(req.url).pathname;
 const method=req.method;
 if(path==="/api/public/wig-v8"||path==="/admin-wig-v8"||path.startsWith("/api/admin/wig-v8")){
  const user=path.startsWith("/api/admin/")||path==="/admin-wig-v8"?await currentUser(req,env.DB):null;
  const response=await handleMamtaWigV8(req,env,user);
  if(response)return response;
 }
 const makerJob=/^\/maker-api\/jobs\/([0-9a-f-]{36})$/i.exec(path);
 if(method==="PATCH"&&makerJob){
  const requestBody=await req.clone().json().catch(()=>null);
  if(requestBody?.action==="start"){
   const allowed=await wigProductionGuard(env.DB,makerJob[1]);
   if(!allowed)return new Response(JSON.stringify({ok:false,error:"This patient order is awaiting Mamta Care production release."}),{status:409,headers:{"content-type":"application/json","cache-control":"no-store"}});
  }
 }
 return mcwigPriorFetch.call(this,req,env,ctx);
};
const mcwigPriorScheduled=launch_wig_maker_portal_worker_default.scheduled;
launch_wig_maker_portal_worker_default.scheduled=function mcwigV8Scheduled(event,env,ctx){
 const result=typeof mcwigPriorScheduled==="function"?mcwigPriorScheduled.call(this,event,env,ctx):undefined;
 if(env.MC_WIG_ENABLED==="true"&&env.WIG_SHEET_BRIDGE_URL&&env.WIG_SHEET_BRIDGE_SECRET){
  ctx.waitUntil(drainMamtaWigOutbox(env,8).catch(e=>console.error("WIG_OUTBOX",e?.name||"Error")));
 }
 return result;
};
const mcwigPriorPage=mcctPage;
mcctPage=function mcwigV8Page(user){
 const html=mcwigPriorPage(user);
 if(user?.role==="admin"&&typeof html==="string"){
  return html.replace("</nav>",'<a class="nav" href="/admin-wig-v8" title="Cancer Patient Applications">🎗 Cancer Patients</a></nav>');
 }
 return html;
};
