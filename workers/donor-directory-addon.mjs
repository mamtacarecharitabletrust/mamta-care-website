
import {directory as donorDirectory,directoryCss as donorDirectoryCss} from './donor-directory.mjs';
import {donorAudit} from './donor-audit.mjs';
const adminDonorDirectory=(db,params)=>donorDirectory(db,{role:'admin'},params);
mc174Donors=adminDonorDirectory;
mc174Queue=adminDonorDirectory;
const priorDirectoryLayout=mc174Layout;
mc174Layout=function(...args){const html=priorDirectoryLayout(...args);return args[3]?.includes('md-directory')?html.replace('</style>',()=>donorDirectoryCss+'</style>'):html};
function liveDonorSearch(){
 const root=document.querySelector('.md-directory'),form=root?.querySelector('form'),input=form?.elements.q;if(!input)return;
 const message=root.querySelector('.md-search-message'),matches=root.querySelector('.md-matches');
 let timer,controller,version=0;
 function search(immediate){
  const request=++version;clearTimeout(timer);controller?.abort();
  const url=new URL(form.action,location.href),fields=new FormData(form);
  for(const [key,value] of fields)if(value)url.searchParams.set(key,value);
  const visible=url.pathname+url.search;url.searchParams.set('live','1');
  matches.setAttribute('aria-busy','true');
  async function update(){
   controller=new AbortController();
   try{
    const response=await fetch(url,{signal:controller.signal,cache:'no-store'});
    if(!response.ok||response.headers.get('X-Donor-Directory')!=='1')throw Error();
    const html=await response.text();if(request!==version)return;
    const next=new DOMParser().parseFromString(html,'text/html');
    for(const selector of ['.md-tabs','.md-filters','.md-matches']){
     const old=root.querySelector(selector),replacement=next.querySelector(selector);if(old&&replacement)old.replaceChildren(...replacement.childNodes)
    }
    history.replaceState(null,'',visible);const count=matches.querySelectorAll('.md-record').length;
    message.textContent=input.value.trim()?count+' matching donor'+(count===1?'':'s'):'';
   }catch(e){if(request===version&&e.name!=='AbortError')message.textContent='Search could not refresh. Press Search to reload.'}
   finally{if(request===version)matches.setAttribute('aria-busy','false')}
  }
  if(immediate)update();else timer=setTimeout(update,180);
 }
 input.addEventListener('input',()=>search(false));
 form.addEventListener('submit',()=>{clearTimeout(timer);++version;controller?.abort()});
}
async function liveDirectoryResponse(res){
 if(!res.ok||!res.headers.get('content-type')?.includes('text/html'))return res;
 const nonce=crypto.randomUUID(),headers=new Headers(res.headers),rules=(headers.get('content-security-policy')||"default-src 'none'").split(';').map(s=>s.trim()).filter(Boolean);
 for(const [key,value] of [['script-src',"'nonce-"+nonce+"'"],['connect-src',"'self'"]]){
  const i=rules.findIndex(s=>s.split(/\s+/)[0]===key);
  if(i<0)rules.push(key+' '+value);else rules[i]=rules[i].replace(/\s+'none'/g,'')+' '+value;
 }
 headers.set('content-security-policy',rules.join('; '));headers.delete('content-length');
 return new HTMLRewriter().on('.md-directory',{element(el){el.append('<script nonce="'+nonce+'">('+liveDonorSearch.toString()+')()</script>',{html:true})}}).transform(new Response(res.body,{status:res.status,headers}));
}
const priorDirectoryFetch=launch_wig_maker_portal_worker_default.fetch;
launch_wig_maker_portal_worker_default.fetch=async function(req,env,ctx){
 const url=new URL(req.url);
 if(url.pathname==='/app/premium/donor-audit')return donorAudit(req,env,currentUser);
 if(req.method==='GET'&&['/app/premium/donors','/app/premium/queue'].includes(url.pathname)){
  const user=await currentUser(req,env.DB);
  if(url.searchParams.get('live')==='1'){
   if(!user||!['admin','team'].includes(user.role))return new Response(null,{status:403});
   return new Response(await donorDirectory(env.DB,user,url.searchParams),{headers:{'content-type':'text/html; charset=utf-8','Cache-Control':'private,no-store','X-Donor-Directory':'1','Content-Security-Policy':"default-src 'none'; frame-ancestors 'none'"}});
  }
  if(user?.role==='team'){const body=await donorDirectory(env.DB,user,url.searchParams);return liveDirectoryResponse(mp3SafePage(mc174Layout(user,'donors',url.searchParams.get('view')==='previous'?'Previous donors':'Current donors',body)))}
 }
 const res=await priorDirectoryFetch.call(this,req,env,ctx);
 if(req.method==='GET'&&['/app/premium/donors','/app/premium/queue'].includes(url.pathname))return liveDirectoryResponse(res);
 if(req.method==='GET'&&['/app/premium/workspace','/app/premium','/app/premium/'].includes(url.pathname)&&res.ok&&res.headers.get('content-type')?.includes('text/html')){
  const html=await res.text();
  const shortcuts='<a class="mc186-category" href="/app/premium/donors"><span class="mc185-disc" aria-hidden="true">👥</span><span class="mc185-name">Current donors</span></a><a class="mc186-category" href="/app/premium/donors?view=previous"><span class="mc185-disc" aria-hidden="true">🗂️</span><span class="mc185-name">Previous donors</span></a><a class="mc186-category" href="/app/premium/donor-audit"><span class="mc185-disc" aria-hidden="true">📋</span><span class="mc185-name">Audit</span></a>';
  let page=html;if(html.includes('class="mc186-categories"'))page=html.replace(/<div class="mc186-categories"[^>]*>/,m=>m+shortcuts);
  else if(html.includes('id="mc-desk-navigation"'))page=html.replace(/<nav id="mc-desk-navigation"[^>]*>/,m=>m+'<a href="/app/premium/donors">👥 Current donors</a><a href="/app/premium/donors?view=previous">🗂️ Previous donors</a><a href="/app/premium/donor-audit">📋 Audit</a>');
  return new Response(page,{status:res.status,headers:res.headers});
 }
 return res;
};