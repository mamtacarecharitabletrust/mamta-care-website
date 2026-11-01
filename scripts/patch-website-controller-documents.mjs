// Mamta Care: small, explicit source patch for the EXISTING Website Content Control Worker.
// Review and test the full resulting Worker before deploying. No API secrets are included.
// Usage: node scripts/patch-website-controller-documents.mjs < current-worker.mjs > candidate-worker.mjs
import fs from "node:fs";

let source = fs.readFileSync(0,"utf8");
const replaceOnce=(before,after,label)=>{
  const first=source.indexOf(before);
  if(first<0||source.indexOf(before,first+before.length)!==-1)throw Error("Unexpected source layout: "+label);
  source=source.slice(0,first)+after+source.slice(first+before.length);
};

const documentPanel=`
<div class="panel"><h2>Official Documents &amp; Registration</h2><p class="tiny">Upload only authentic PDFs approved for public release, after redacting PAN numbers, signatures and personal details.</p>
<div id="mcDocsList"></div><div class="grid"><div><label>Document category</label><select id="mcDocCategory"><option value="trust_registration">Trust registration certificate</option><option value="trust_deed">Trust deed</option><option value="darpan">NGO Darpan</option><option value="pan">PAN (redacted)</option><option value="tax_12ab">12AB</option><option value="tax_80g">80G</option><option value="other">Other</option></select></div><div><label>Document title</label><input id="mcDocTitle" maxlength="110"></div><div><label>Issuing authority</label><input id="mcDocIssuer" maxlength="110"></div><div><label>Public reference (optional)</label><input id="mcDocReference" maxlength="80"></div><div><label>Issue date</label><input id="mcDocIssuedOn" type="date"></div><div><label>PDF (max 5MB)</label><input type="file" id="mcDocFile" accept=".pdf,application/pdf"></div></div>
<label>Public verification note</label><textarea id="mcDocNote" maxlength="300"></textarea>
<label><input type="checkbox" id="mcDocConsent"> I confirm this is an authentic, redacted document authorized for publication.</label><div class="actions"><button class="secondary" id="mcDocUpload" type="button">Upload private draft</button><button id="mcDocPublish" type="button">Publish reviewed documents</button></div><p class="tiny" id="mcDocMessage" role="status"></p>
</div>`;

const documentUI=`
const mcDocMsg=(s)=>{$('mcDocMessage').textContent=s};
async function mcDocsRefresh(){
 try{const r=await api('/api/admin/documents'),host=$('mcDocsList');host.replaceChildren();const published=new Set((r.published||[]).map(d=>d.id));for(const doc of (r.draft||[])){
 const tile=document.createElement('div');tile.className='tile';const title=document.createElement('span');title.textContent=doc.title+' · '+doc.issuer+' · '+(published.has(doc.id)?'PUBLISHED':'DRAFT');const view=document.createElement('a');view.href='/api/admin/documents/file/'+doc.id;view.target='_blank';view.rel='noopener noreferrer';view.textContent='Review PDF';const remove=document.createElement('button');remove.className='danger';remove.textContent='Remove';remove.onclick=async()=>{if(!confirm('Remove from draft? Publish to remove from public site.'))return;await api('/api/admin/documents/remove',{method:'POST',headers:{'x-mcct-admin':'1','content-type':'application/json'},body:JSON.stringify({id:doc.id})});mcDocsRefresh()};tile.append(title,view,remove);host.append(tile)}
 if(!host.childElementCount)host.textContent='No approved documents in draft.';}catch(e){mcDocMsg(e.message)}
}
$('mcDocUpload').onclick=async()=>{const f=$('mcDocFile').files[0];if(!f||f.type!=='application/pdf'||f.size>5000000||f.size<100||!$('mcDocConsent').checked||!$('mcDocTitle').value.trim()||!$('mcDocIssuer').value.trim()){mcDocMsg('Select a redacted PDF under 5MB, title, authority and approval.');return}
 const form=new FormData();form.append('file',f);for(const k of ['Category','Title','Issuer','Reference','IssuedOn','Note'])form.append(k.toLowerCase(),$('mcDoc'+k).value);form.append('approved','yes');try{await api('/api/admin/documents/upload',{method:'POST',headers:{'x-mcct-admin':'1'},body:form});$('mcDocFile').value='';$('mcDocConsent').checked=false;await mcDocsRefresh();mcDocMsg('Uploaded to draft. Not public until published.')}catch(e){mcDocMsg(e.message)}
};
$('mcDocPublish').onclick=async()=>{if(!confirm('Publish the reviewed document list publicly?'))return;try{const r=await api('/api/admin/documents/publish',{method:'POST',headers:{'x-mcct-admin':'1','content-type':'application/json'},body:'{}'});await mcDocsRefresh();mcDocMsg('Published '+r.count+' documents.')}catch(e){mcDocMsg(e.message)}};
`;

const documentAPI=`
const MC_DOCUMENT_ROUTE=/^\\/documents\\/([0-9a-f-]{36})\\.pdf$/i;
const MC_DOCUMENT_TYPES=new Set(['trust_registration','trust_deed','darpan','pan','tax_12ab','tax_80g','other']);
const mcDocsDraft=async(env)=>await env.CONTENT.get('official_documents_draft','json')||[];
const mcDocsPublished=async(env)=>await env.CONTENT.get('official_documents_published','json')||[];
function mcDocsValidated(d){if(!MC_DOCUMENT_TYPES.has(d.category)||!d.title||!d.issuer||!MC_DOCUMENT_ROUTE.test(d.url)||(d.issuedOn&&!/^\\d{4}-\\d{2}-\\d{2}$/.test(d.issuedOn)))throw Error('Invalid document details');return d;}
`;
const routePublic=`const docRoute=MC_DOCUMENT_ROUTE.exec(path);
 if(docRoute&&method==='GET'){if(!(await mcDocsPublished(env)).some(x=>x.id===docRoute[1]))return new Response('Not found',{status:404});const obj=await env.MEDIA.get(docRoute[1]+'.pdf');if(!obj)return new Response('Not found',{status:404});return new Response(obj.body,{headers:{'content-type':'application/pdf','content-disposition':'inline; filename="mamta-care-document.pdf"','cache-control':'public,max-age=120','x-content-type-options':'nosniff','content-security-policy':"default-src 'none'; sandbox"}})}
`;
const privateRead=`
 if(path==='/api/admin/documents'&&method==='GET')return json({ok:true,draft:await mcDocsDraft(env),published:await mcDocsPublished(env)});
 const adminPdf=/^\\/api\\/admin\\/documents\\/file\\/([0-9a-f-]{36})$/i.exec(path);
 if(adminPdf&&method==='GET'){const known=[...await mcDocsDraft(env),...await mcDocsPublished(env)];if(!known.some(x=>x.id===adminPdf[1]))return json({ok:false,error:'Not found'},404);const o=await env.MEDIA.get(adminPdf[1]+'.pdf');if(!o)return json({ok:false,error:'File missing'},404);return new Response(o.body,{headers:{'content-type':'application/pdf','cache-control':'no-store','content-security-policy':"default-src 'none'; sandbox",'x-content-type-options':'nosniff'}})}
`;
const privateWrite=`
 if(path==='/api/admin/documents/upload'){
  if(!(req.headers.get('content-type')||'').includes('multipart/form-data'))return json({ok:false,error:'Multipart upload required'},415);
  let form;try{form=await req.formData()}catch{return json({ok:false,error:'Invalid request'},400)}
  const f=form.get('file');if(!f||typeof f.arrayBuffer!=='function'||f.type!=='application/pdf'||f.size<100||f.size>5000000||form.get('approved')!=='yes')return json({ok:false,error:'Approved PDF only, max 5MB'},400);
  const id=crypto.randomUUID(),val=(key,max)=>safe(form.get(key),max);
  let doc;try{doc=mcDocsValidated({id,url:'/documents/'+id+'.pdf',category:val('category',35),title:val('title',110),issuer:val('issuer',110),reference:val('reference',80),issuedOn:val('issuedon',10),note:val('note',300)})}catch(e){return json({ok:false,error:safe(e.message)},400)}
  const draft=await mcDocsDraft(env);if(draft.length>=16)return json({ok:false,error:'Maximum 16 documents'},409);
  const bytes=new Uint8Array(await f.arrayBuffer());if(String.fromCharCode(...bytes.slice(0,5))!=='%PDF-')return json({ok:false,error:'Invalid PDF file'},400);
  await env.MEDIA.put(id+'.pdf',bytes,{httpMetadata:{contentType:'application/pdf'}});
  try{await env.CONTENT.put('official_documents_draft',JSON.stringify([...draft,doc]))}catch(e){await env.MEDIA.delete(id+'.pdf');throw e}
  return json({ok:true,document:doc});
 }
 if(path==='/api/admin/documents/remove'){let d;try{d=await req.json()}catch{return json({ok:false,error:'Invalid request'},400)}const arr=await mcDocsDraft(env),next=arr.filter(x=>x.id!==d.id);if(arr.length===next.length)return json({ok:false,error:'Not found'},404);await env.CONTENT.put('official_documents_draft',JSON.stringify(next));if(!(await mcDocsPublished(env)).some(x=>x.id===d.id))await env.MEDIA.delete(d.id+'.pdf');return json({ok:true})}
 if(path==='/api/admin/documents/publish'){const docs=(await mcDocsDraft(env)).map(mcDocsValidated);const previous=await mcDocsPublished(env);await env.CONTENT.put('official_documents_published',JSON.stringify(docs));let failed=0;const kept=new Set(docs.map(d=>d.id));for(const x of previous.filter(d=>!kept.has(d.id))){try{await env.MEDIA.delete(x.id+'.pdf')}catch{failed++}}return json({ok:true,count:docs.length,cleanupFailures:failed})}
`;

replaceOnce("</div></div><script>",documentPanel+"</div></div><script>","controller panel");
replaceOnce("boot();\n</script></body></html>\x60;",documentUI+"\nconst oldBoot=boot;boot=async()=>{await oldBoot();if(!$('editing').hidden)await mcDocsRefresh()};\nboot();\n</script></body></html>\x60;","controller UI");
replaceOnce("export default{async fetch(req,env){",documentAPI+"export default{async fetch(req,env){","handler");
const publicLine=source.split("\n").find(line=>line.includes("if(path==='/api/public'&&method==='GET')"));
if(!publicLine)throw Error("Missing public feed");
replaceOnce(publicLine,publicLine.replace("...value,total:","...value,documents:await mcDocsPublished(env),total:"),"public feed");
replaceOnce("if(path==='/api/admin/login'&&method==='POST')",routePublic+"if(path==='/api/admin/login'&&method==='POST')","public file");
replaceOnce("if(method!=='POST')return json({ok:false,error:'Method not allowed'},405);",privateRead+"if(method!=='POST')return json({ok:false,error:'Method not allowed'},405);","admin read");
replaceOnce("if(path==='/api/admin/save')",privateWrite+"if(path==='/api/admin/save')","admin write");
process.stdout.write(source);
