
import {directory as donorDirectory,directoryCss as donorDirectoryCss} from './donor-directory.mjs';
import {donorAudit} from './donor-audit.mjs';
const adminDonorDirectory=(db,params)=>donorDirectory(db,{role:'admin'},params);
mc174Donors=adminDonorDirectory;
mc174Queue=adminDonorDirectory;
const priorDirectoryLayout=mc174Layout;
mc174Layout=function(...args){const html=priorDirectoryLayout(...args);return args[3]?.includes('md-directory')?html.replace('</style>',()=>donorDirectoryCss+'</style>'):html};
const priorDirectoryFetch=launch_wig_maker_portal_worker_default.fetch;
launch_wig_maker_portal_worker_default.fetch=async function(req,env,ctx){
 const url=new URL(req.url);
 if(url.pathname==='/app/premium/donor-audit')return donorAudit(req,env,currentUser);
 if(req.method==='GET'&&['/app/premium/donors','/app/premium/queue'].includes(url.pathname)){
  const user=await currentUser(req,env.DB);
  if(user?.role==='team'){const body=await donorDirectory(env.DB,user,url.searchParams);return mp3SafePage(mc174Layout(user,'donors',url.searchParams.get('view')==='previous'?'Previous donors':'Current donors',body))}
 }
 const res=await priorDirectoryFetch.call(this,req,env,ctx);
 if(req.method==='GET'&&['/app/premium/workspace','/app/premium','/app/premium/'].includes(url.pathname)&&res.ok&&res.headers.get('content-type')?.includes('text/html')){
  const html=await res.text();
  const shortcuts='<a class="mc186-category" href="/app/premium/donors"><span class="mc185-disc" aria-hidden="true">👥</span><span class="mc185-name">Current donors</span></a><a class="mc186-category" href="/app/premium/donors?view=previous"><span class="mc185-disc" aria-hidden="true">🗂️</span><span class="mc185-name">Previous donors</span></a><a class="mc186-category" href="/app/premium/donor-audit"><span class="mc185-disc" aria-hidden="true">📋</span><span class="mc185-name">Audit</span></a>';
  let page=html;if(html.includes('class="mc186-categories"'))page=html.replace(/<div class="mc186-categories"[^>]*>/,m=>m+shortcuts);
  else if(html.includes('id="mc-desk-navigation"'))page=html.replace(/<nav id="mc-desk-navigation"[^>]*>/,m=>m+'<a href="/app/premium/donors">👥 Current donors</a><a href="/app/premium/donors?view=previous">🗂️ Previous donors</a><a href="/app/premium/donor-audit">📋 Audit</a>');
  return new Response(page,{status:res.status,headers:res.headers});
 }
 return res;
};