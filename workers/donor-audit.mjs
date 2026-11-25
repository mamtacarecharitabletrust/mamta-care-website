import {timestamp} from './donor-directory.mjs';

const path='/app/premium/donor-audit';
const previous='/app/premium/donors?view=previous';
const safe=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const dates=new Intl.DateTimeFormat('en-IN',{timeZone:'Asia/Kolkata',day:'numeric',month:'short',year:'numeric'});
const stamp=ms=>Number.isFinite(ms)?dates.format(ms):'Unavailable';
const headers={'Cache-Control':'private,no-store','Referrer-Policy':'same-origin','X-Content-Type-Options':'nosniff'};
const style=`*{box-sizing:border-box}body{margin:0;background:#fcf7f3;color:#432536;font:16px/1.5 system-ui,sans-serif}main{max-width:52rem;margin:auto;padding:24px 16px}a{color:#65263e}h1,h2,p{margin:0 0 .7em}form,.sheet{background:white;padding:20px;border:1px solid #dccfd4;border-radius:12px}.bar{display:flex;align-items:center;gap:1rem;flex-wrap:wrap;margin-bottom:12px}.bar button{margin-left:auto}button{min-height:44px;padding:8px 16px;border:0;border-radius:8px;color:white;background:#68263f;font:inherit;cursor:pointer}button:disabled{opacity:.5}label{cursor:pointer}input[type=checkbox]{width:19px;height:19px;accent-color:#68263f}.row{display:flex;align-items:center;gap:12px;padding:10px 0;border-top:1px solid #eadfe3}.row small{display:block}.intro{margin:1rem 0}.sheet{margin:1rem 0 0}.brand{font-weight:700;color:#68263f}.sheet dl{display:grid;grid-template-columns:minmax(8rem,1fr) 2fr;gap:0;margin:1rem 0}.sheet dt,.sheet dd{padding:9px 0;border-bottom:1px solid #ded8db;margin:0;overflow-wrap:anywhere}.sheet footer{font-size:.9rem;color:#5b5055}@page{size:A4;margin:16mm}@media print{body{background:white;color:black}main{max-width:none;margin:0;padding:0}.controls{display:none!important}.sheet{padding:0;margin:0;border:0;border-radius:0;break-inside:avoid}.sheet+.sheet{break-before:page;page-break-before:always}}`;
function page(content,script,title){
 const nonce=crypto.randomUUID();
 return new Response('<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+safe(title)+'</title><style nonce="'+nonce+'">'+style+'</style></head><body><main>'+content+'</main><script nonce="'+nonce+'">'+script+'</script></body></html>',{headers:{...headers,'Content-Type':'text/html; charset=utf-8','Content-Security-Policy':"default-src 'none'; style-src 'nonce-"+nonce+"'; script-src 'nonce-"+nonce+"'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'"}});
}
function selection(){
 const form=document.querySelector('form'),all=form.elements.all,boxes=Array.from(form.querySelectorAll('input[name="donor"]')),button=form.querySelector('button'),out=form.querySelector('output');
 function sync(){const count=boxes.filter(box=>box.checked).length;all.checked=count>0&&count===boxes.length;all.indeterminate=count>0&&count<boxes.length;button.disabled=!count;out.value=count+' selected'}
 all.addEventListener('change',()=>{for(const box of boxes)box.checked=all.checked;sync()});form.addEventListener('change',sync);window.addEventListener('pageshow',sync);sync();
}
function printing(){const print=()=>window.print();document.querySelector('button').addEventListener('click',print);window.addEventListener('load',()=>setTimeout(print,100),{once:true})}
export async function donorAudit(req,env,currentUser){
 if(new URL(req.url).pathname!==path)return null;
 const u=await currentUser(req,env.DB);if(!u)return new Response(null,{status:302,headers:{...headers,Location:'/app'}});
 const error=(text,status)=>new Response(text,{status,headers});if(!['admin','team'].includes(u.role))return error('Access denied',403);
 const batch=req.method==='POST';if(!batch&&req.method!=='GET')return error('Method not allowed',405);
 if(batch&&req.headers.get('origin')!==new URL(req.url).origin)return error('Origin mismatch',403);
 let ids;if(batch){const form=await req.formData();ids=new Set(form.getAll('donor'));if(!ids.size)return error('Select at least one donor.',400)}
 const fields=batch?'d.id,d.full_name,d.registration_id,d.city,d.registered_at,d.hair_length,d.hair_type':'d.id,d.full_name,d.registration_id,d.city';
 const sql='SELECT '+fields+" FROM donors d WHERE upper(trim(coalesce(d.verification_status,'')))='VERIFIED' AND NOT EXISTS(SELECT 1 FROM mc_donor_recycle r WHERE r.donor_id=d.id)"+(u.role==='team'?' AND d.assigned_to=?':'')+' ORDER BY d.full_name COLLATE NOCASE,d.registration_id,d.id';
 let statement=env.DB.prepare(sql);if(u.role==='team')statement=statement.bind(u.username);
 const {results}=await statement.all(),link='<a href="'+previous+'">← Previous donors</a>';
 if(!batch){
 const rows=results.map(d=>'<label class="row"><input type="checkbox" name="donor" value="'+safe(d.id)+'"><span><strong>'+safe(d.full_name||'Name unavailable')+'</strong><small>'+safe([d.registration_id,d.city].filter(Boolean).join(' · '))+'</small></span></label>').join('');
 return page(link+'<h1 class="intro">Donor audit</h1><p><strong>'+results.length+'</strong> verified donors'+(u.role==='team'?' assigned to you':'')+'. Select the records to print.</p><form method="post" action="'+path+'"><div class="bar"><label><input type="checkbox" name="all"> Select all</label><output aria-live="polite">0 selected</output><button disabled>Print selected</button></div>'+rows+'</form>','('+selection.toString()+')()','Donor audit · Mamta Care');
 }
 const chosen=results.filter(d=>ids.has(d.id));if(chosen.length!==ids.size)return error('The selection changed. Return to Audit and select the available verified donors again.',409);
 const recorded=stamp(Date.now()),n=chosen.length;
 const sheets=chosen.map((d,i)=>{const fields=[['Registration ID',d.registration_id],['Application date',stamp(timestamp(d.registered_at))],['City',d.city],['Recorded hair length',d.hair_length],['Hair type',d.hair_type],['Verification status','Verified']];return '<article class="sheet"><p class="brand">Mamta Care Charitable Trust</p><p>Verified hair donation · Audit record</p><h2>'+safe(d.full_name||'Name unavailable')+'</h2><dl>'+fields.map(([key,value])=>'<dt>'+key+'</dt><dd>'+safe(value||'Not recorded')+'</dd>').join('')+'</dl><footer>Prepared '+recorded+' · Record '+(i+1)+' of '+n+'</footer></article>'}).join('');
 return page('<div class="controls"><a href="'+path+'">← Donor audit</a><h1>Selected audit records</h1><p>'+n+' selected out of '+results.length+' verified donors. Choose a printer or Save as PDF in the print dialog.</p><button type="button">Print again</button></div>'+sheets,'('+printing.toString()+')()','Mamta Care donor audit - '+recorded);
}