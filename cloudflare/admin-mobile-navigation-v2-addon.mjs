/* Mamta Care Premium Administrator Navigation v2 · 2026-11-16
 * Display-only enhancement for the existing signed-in admin '/' and '/app' shell.
 * No D1 SQL, no new cron, no edits to donor/staff auth or original functional pages.
 * Original page markup, roles, routes, and scripts remain intact.
 */
const MCUX_ADMIN_CSS=__MCUX_CSS_JSON__;
const MCUX_ADMIN_JS=__MCUX_JS_JSON__;
const MCUX_ADMIN_MARKER='MCUX_ADMIN_MOBILE_COMMAND_CENTER_V2_20261116';
const MCUX_NAV_PREVIOUS_FETCH=launch_wig_maker_portal_worker_default.fetch;
launch_wig_maker_portal_worker_default.fetch=async function(req,env,ctx){
 const path=new URL(req.url).pathname;
 if(req.method!=='GET'||(path!=='/'&&path!=='/app'))return MCUX_NAV_PREVIOUS_FETCH.call(this,req,env,ctx);
 const response=await MCUX_NAV_PREVIOUS_FETCH.call(this,req,env,ctx);
 if(!response.ok||!String(response.headers.get('content-type')||'').includes('text/html'))return response;
 try{
  const original=await response.clone().text();
  // The role is rendered by the original auth-protected mcctPage, never user-supplied.
  if(!original.includes('const MC_ROLE="admin"')||original.includes('data-mcux-admin="v2"'))return response;
  if(!original.includes('id="navs"')||!original.includes('id="main"')||!original.includes('id="heading"')||!original.includes('data-mcst-link'))return response;
  if(!original.includes('</head>')||!original.includes('</body>'))return response;
  const styled=original.replace('</head>','<style data-mcux-admin="v2">'+MCUX_ADMIN_CSS+'</style></head>');
  const html=styled.replace('</body>','<script data-mcux-admin="v2">'+MCUX_ADMIN_JS+'</script></body>');
  const headers=new Headers(response.headers);
  headers.delete('content-length');headers.delete('etag');
  headers.set('cache-control','private,no-store');
  return new Response(html,{status:response.status,statusText:response.statusText,headers});
 }catch(e){
  console.error('MCUX_ADMIN_NAV_RENDER',String(e?.name||'Error'));
  // Fail safely by returning the existing screen unchanged.
  return response;
 }
};
/* MCUX_ADMIN_MOBILE_COMMAND_CENTER_V2_20261116 */
