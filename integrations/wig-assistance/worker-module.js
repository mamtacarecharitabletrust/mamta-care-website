/* Mamta Care | Private Wig Assistance workflow module.
 * Designed for use INSIDE the existing Donor Desk Worker so that currentUser()
 * enforces its existing secure admin session. Do not deploy as an anonymous admin API.
 * Feature gate MC_WIG_ENABLED must be true only after full E2E tests.
 */
const PHOTOS=["front","back","left","right"];
const json=(x,status=200,extra={})=>new Response(JSON.stringify(x),{status,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store","x-content-type-options":"nosniff",...extra}});
const err=(m,status=400,headers={})=>json({ok:false,error:m},status,headers);
const trim=(v,n=250)=>String(v??"").trim().slice(0,n);
function dayIst(){const parts=new Intl.DateTimeFormat("en-GB",{timeZone:"Asia/Kolkata",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date());const a={};for(const p of parts)a[p.type]=p.value;return {day:a.year+"-"+a.month+"-"+a.day,prefix:a.year+"/"+a.day+a.month};}
function sameOrigin(req,env){const origin=req.headers.get("Origin")||"";const origins=String(env.MC_WIG_ALLOWED_ORIGINS||"").split(",").map(x=>x.trim()).filter(Boolean);return origins.includes(origin)?origin:"";}
function cors(o){return {"access-control-allow-origin":o,"access-control-allow-methods":"POST, OPTIONS","access-control-allow-headers":"X-Mamta-Public, Content-Type","access-control-max-age":"300","vary":"Origin"};}
function validFile(f,medical){if(!f||typeof f.size!=="number")return false;const t=String(f.type||"");return f.size>100&&f.size<=(medical?10:4)*1024*1024&&(medical?t==="application/pdf":["image/jpeg","image/png","image/webp"].includes(t));}
async function magicOK(file,medical){const b=new Uint8Array(await file.slice(0,16).arrayBuffer());if(medical)return b[0]===37&&b[1]===80&&b[2]===68&&b[3]===70;const t=file.type;if(t==="image/jpeg")return b[0]===255&&b[1]===216&&b[2]===255;if(t==="image/png")return b[0]===137&&b[1]===80&&b[2]===78&&b[3]===71;return b[0]===82&&b[1]===73&&b[2]===70&&b[3]===70&&b[8]===87&&b[9]===69&&b[10]===66&&b[11]===80;}
async function captcha(req,env,token){if(!env.TURNSTILE_SECRET_KEY||!token)return false;const body=new URLSearchParams({secret:String(env.TURNSTILE_SECRET_KEY),response:trim(token,3000)});const ip=req.headers.get("CF-Connecting-IP");if(ip)body.set("remoteip",ip);try{const res=await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify",{method:"POST",body,signal:AbortSignal.timeout(9500)});const data=await res.json();return res.ok&&data.success===true;}catch{return false}}
async function apply(req,env){
 const o=sameOrigin(req,env);if(!o)return err("Unapproved website origin",403);
 const h=cors(o);
 if(String(env.MC_WIG_ENABLED)!=="true")return err("Registration is temporarily unavailable",503,h);
 const len=Number(req.headers.get("Content-Length")||0);if(len>28*1024*1024)return err("Upload exceeds size limit",413,h);
 if(!String(req.headers.get("Content-Type")||"").startsWith("multipart/form-data")||req.headers.get("X-Mamta-Public")!=="1")return err("Invalid submission",400,h);
 let data;try{data=await req.formData()}catch{return err("Invalid form data",400,h)}
 let p;try{p=JSON.parse(String(data.get("patient")||""))}catch{return err("Missing patient details",400,h)}
 const name=trim(p.name,130),email=trim(p.email,200).toLowerCase(),phone=trim(p.phone,20).replace(/\D/g,""),city=trim(p.city,120),key=trim(p.idempotency_key,80);
 if(!name||!city||!/^[0-9]{10}$/.test(phone)||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||!p.privacy||!p.terms||!p.cancerRelated||!p.hairLoss||!(/^[0-9a-f-]{36}$/i.test(key)))return err("Complete the required application and consent fields",400,h);
 if(p.hairSource&&p.hairSource!=="donated"&&(!p.hairContributor||!p.contributorConsent))return err("Hair contributor consent is required",400,h);
 for(const side of PHOTOS){const f=data.get(side);if(!validFile(f,false)||!(await magicOK(f,false)))return err("Please provide a valid "+side+" photograph (maximum 4 MB)",400,h)}
 const medical=data.get("medical");if(medical&&(!validFile(medical,true)||!(await magicOK(medical,true))))return err("Medical PDF must be under 10 MB and valid",400,h);
 const verified=await captcha(req,env,trim(data.get("turnstile"),3000));if(!verified)return err("Security verification failed. Please refresh and retry.",403,h);
 const before=await env.DB.prepare("SELECT c.registration_id FROM mcwig_idempotency_v1 i JOIN mcwig_cases_v1 c ON c.id=i.case_id WHERE i.idempotency_key=?").bind(key).first();
 if(before)return json({ok:true,registration_id:before.registration_id,already_received:true},200,h);
 const id=crypto.randomUUID(),ts=Math.floor(Date.now()/1000),dt=dayIst();
 let seq;try{seq=await env.DB.prepare("INSERT INTO mcwig_day_sequence_v1(day_ist,last_sequence) VALUES (?,1) ON CONFLICT(day_ist) DO UPDATE SET last_sequence=last_sequence+1 RETURNING last_sequence").bind(dt.day).first()}catch{return err("Unable to issue registration ID",503,h)}
 const registration=dt.prefix+String(seq.last_sequence).padStart(2,"0");
 const stored=[];const photoRows=[];const privateBase="wig-patient/v1/"+id+"/";
 try{
  for(const view of [...PHOTOS,...(medical?["medical"]:[])]){
   const f=data.get(view),suffix=view==="medical"?"pdf":f.type==="image/jpeg"?"jpg":f.type==="image/png"?"png":"webp";
   const objectKey=privateBase+view+"."+suffix;
   await env.DONOR_PHOTOS.put(objectKey,await f.arrayBuffer(),{httpMetadata:{contentType:f.type},customMetadata:{case_id:id,view}});
   stored.push(objectKey);photoRows.push({view,key:objectKey,type:f.type,size:f.size});
  }
  const payload=JSON.stringify(Object.fromEntries(Object.entries(p).filter(([k])=>!["idempotency_key","turnstile"].includes(k))));
  const statements=[
   env.DB.prepare("INSERT INTO mcwig_cases_v1(id,registration_id,applied_day_ist,daily_sequence,patient_name,email,phone,city,payload_json,status,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,'PENDING_REVIEW',?,?)").bind(id,registration,dt.day,seq.last_sequence,name,email,phone,city,payload,ts,ts),
   env.DB.prepare("INSERT INTO mcwig_idempotency_v1(idempotency_key,case_id,created_at) VALUES(?,?,?)").bind(key,id,ts),
   env.DB.prepare("INSERT INTO mcwig_event_v1(id,case_id,event_type,actor,event_json,created_at) VALUES(?,?,?,?,?,?)").bind(crypto.randomUUID(),id,"PATIENT_REGISTERED","public",JSON.stringify({registration_id:registration}),ts),
   env.DB.prepare("INSERT INTO mcwig_outbox_v1(id,case_id,kind,created_at,updated_at) VALUES(?,?,?,?,?)").bind(crypto.randomUUID(),id,"GOOGLE_SHEET_CREATE",ts,ts),
   env.DB.prepare("INSERT INTO mcwig_outbox_v1(id,case_id,kind,created_at,updated_at) VALUES(?,?,?,?,?)").bind(crypto.randomUUID(),id,"REGISTRATION_EMAIL",ts,ts)
  ];
  for(const ph of photoRows)statements.push(env.DB.prepare("INSERT INTO mcwig_photos_v1(case_id,view,object_key,content_type,byte_size,uploaded_at) VALUES(?,?,?,?,?,?)").bind(id,ph.view,ph.key,ph.type,ph.size,ts));
  await env.DB.batch(statements);
  return json({ok:true,registration_id:registration,status:"PENDING_REVIEW",message:"Application received for verification"},201,h);
 }catch(e){
  for(const k of stored){try{await env.DONOR_PHOTOS.delete(k)}catch{}}
  const existing=await env.DB.prepare("SELECT c.registration_id FROM mcwig_idempotency_v1 i JOIN mcwig_cases_v1 c ON i.case_id=c.id WHERE i.idempotency_key=?").bind(key).first().catch(()=>null);
  if(existing)return json({ok:true,registration_id:existing.registration_id,already_received:true},200,h);
  console.error("MCWIG_CREATE_FAILED",e?.name||"Error");return err("Unable to finalize application; please retry safely",503,h);
 }
}
function adminCheck(req,user){return !!user&&user.role==="admin"&&["GET","POST"].includes(req.method)}
function adminWrite(req){return req.headers.get("Origin")===new URL(req.url).origin&&req.headers.get("X-Mamta-Desk")==="1"&&/^application\/json(?:;|$)/i.test(req.headers.get("Content-Type")||"");}
async function listCases(env){const results=await env.DB.prepare("SELECT id,registration_id,patient_name,email,phone,city,status,maker_id,maker_job_id,approved_by,approved_at,production_released_at,created_at FROM mcwig_cases_v1 ORDER BY created_at DESC LIMIT 150").all();return json({ok:true,cases:results.results||[]});}
async function showCase(env,id){const c=await env.DB.prepare("SELECT * FROM mcwig_cases_v1 WHERE id=?").bind(id).first();if(!c)return err("Application not found",404);const a=await env.DB.prepare("SELECT view FROM mcwig_photos_v1 WHERE case_id=?").bind(id).all();return json({ok:true,case:{...c,payload:JSON.parse(c.payload_json),payload_json:undefined},available_photos:(a.results||[]).map(x=>x.view)});}
async function showPhoto(env,id,view){
 if(!["front","back","left","right","medical"].includes(view))return err("Invalid photograph",400);
 const p=await env.DB.prepare("SELECT object_key,content_type FROM mcwig_photos_v1 WHERE case_id=? AND view=?").bind(id,view).first();
 if(!p)return err("Photograph unavailable",404);
 const object=await env.DONOR_PHOTOS.get(p.object_key);if(!object)return err("Photograph unavailable",404);
 return new Response(object.body,{headers:{"content-type":p.content_type,"cache-control":"private,no-store","x-content-type-options":"nosniff","content-security-policy":"default-src 'none'; sandbox","referrer-policy":"no-referrer","x-frame-options":"DENY"}});
}
async function approve(req,env,user,id){
 if(!adminWrite(req))return err("Invalid request origin",403);
 let input;try{input=await req.json()}catch{return err("Invalid JSON")}
 const reason=trim(input.review_note,500);
 if(reason.length<8||input.confirm_verification!==true)return err("Verification confirmation and review note are required");
 const c=await env.DB.prepare("SELECT * FROM mcwig_cases_v1 WHERE id=?").bind(id).first();if(!c)return err("Application not found",404);
 if(c.status==="APPROVED")return json({ok:true,already_approved:true,maker_job_id:c.maker_job_id,registration_id:c.registration_id});
 if(c.status!=="PENDING_REVIEW")return err("Application is not pending",409);
 const maker=await env.DB.prepare("SELECT id,display_name FROM maker_accounts WHERE LOWER(display_name)='cine wigs' AND active=1 LIMIT 1").first();if(!maker)return err("CINE WIGS maker account is not active",503);
 const payload=JSON.parse(c.payload_json||"{}"),job=crypto.randomUUID(),ts=Math.floor(Date.now()/1000),ref="MC-WIG-"+c.registration_id.replaceAll("/","-");
 // Production is deliberately held until the administrator confirms measurements, hair and agreement.
 const length={"Short":25,"Medium":40,"Long":55}[payload.wigLength]||0;
 const text="PENDING PRODUCTION RELEASE: Check hair arrival, fitting measurements and approved return/courier agreement. Patient identity and medical details are restricted to Mamta Care.";
 const event=crypto.randomUUID();
 const stmts=[
  env.DB.prepare("UPDATE mcwig_cases_v1 SET status='APPROVED',maker_id=?,maker_job_id=?,approved_by=?,approved_at=?,updated_at=? WHERE id=? AND status='PENDING_REVIEW'").bind(maker.id,job,user.username,ts,ts,id),
  env.DB.prepare("INSERT INTO maker_jobs(id,maker_id,reference,hair_material,hair_length_cm,hair_color,texture,cap_size,quantity,due_date,instructions,status,created_by,created_at,updated_at) SELECT ?,?,?, 'Human hair',?,?,?,?,1,NULL,?,'assigned',?,?,? WHERE EXISTS (SELECT 1 FROM mcwig_cases_v1 WHERE id=? AND maker_job_id=? AND status='APPROVED')").bind(job,maker.id,ref,length,trim(payload.wigColor||"To confirm",60),trim(payload.texture||"",40),trim(payload.capSize||"To confirm",40),text,user.username,ts,ts,id,job),
  env.DB.prepare("INSERT INTO maker_events(id,job_id,actor,action,detail_json,happened_at) SELECT ?,?,?,?, ?,? WHERE EXISTS (SELECT 1 FROM maker_jobs WHERE id=?)").bind(crypto.randomUUID(),job,user.username,"maker_job_assigned",JSON.stringify({wig_case_id:id}),ts,job),
  env.DB.prepare("INSERT INTO mcwig_event_v1(id,case_id,event_type,actor,event_json,created_at) SELECT ?,?,?,?,?,? WHERE EXISTS (SELECT 1 FROM maker_jobs WHERE id=?)").bind(event,id,"APPROVED",user.username,JSON.stringify({maker:maker.display_name,job,review_note:reason}),ts,job),
  env.DB.prepare("INSERT OR IGNORE INTO mcwig_outbox_v1(id,case_id,kind,created_at,updated_at) SELECT ?,?,?,?,? WHERE EXISTS (SELECT 1 FROM maker_jobs WHERE id=?)").bind(crypto.randomUUID(),id,"GOOGLE_SHEET_APPROVE",ts,ts,job),
  env.DB.prepare("INSERT OR IGNORE INTO mcwig_outbox_v1(id,case_id,kind,created_at,updated_at) SELECT ?,?,?,?,? WHERE EXISTS (SELECT 1 FROM maker_jobs WHERE id=?)").bind(crypto.randomUUID(),id,"APPROVAL_EMAIL",ts,ts,job)
 ];
 try{
 const res=await env.DB.batch(stmts);
 if((res[0].meta?.changes||0)!==1)return err("Application was updated elsewhere",409);
 if((res[1].meta?.changes||0)!==1)return err("Manufacturing assignment failed",503);
 return json({ok:true,registration_id:c.registration_id,approved:true,maker:maker.display_name,maker_job_id:job,production_status:"AWAITING_RELEASE",notifications:"QUEUED"});
 }catch(e){console.error("MCWIG_APPROVAL_FAILED",e?.name||"Error");return err("Approval could not be completed safely; please retry",503)}
}
async function release(req,env,user,id){
 if(!adminWrite(req))return err("Invalid request origin",403);
 let input;try{input=await req.json()}catch{return err("Invalid JSON",400)}
 if(input.hair_ready!==true||input.fitting_confirmed!==true||input.conditions_confirmed!==true)return err("Confirm hair, fitting and conditions before release");
 const c=await env.DB.prepare("SELECT * FROM mcwig_cases_v1 WHERE id=?").bind(id).first();
 if(!c||c.status!=="APPROVED"||!c.maker_job_id)return err("Approved maker order not found",409);
 if(c.production_released_at)return json({ok:true,already_released:true});
 const ts=Math.floor(Date.now()/1000);
 const result=await env.DB.batch([
  env.DB.prepare("UPDATE mcwig_cases_v1 SET production_released_at=?,updated_at=? WHERE id=? AND production_released_at IS NULL AND status='APPROVED'").bind(ts,ts,id),
  env.DB.prepare("INSERT INTO mcwig_event_v1(id,case_id,event_type,actor,event_json,created_at) SELECT ?,?,?,?,'{}',? WHERE changes()=1").bind(crypto.randomUUID(),id,"PRODUCTION_RELEASED",user.username,ts)
 ]);
 return (result[0].meta?.changes||0)===1?json({ok:true,released:true}):err("The case changed; refresh",409);
}

const MCWIG_ADMIN_HTML="<!doctype html><html lang=\"en\"><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><title>Cancer Patient Review | Mamta Care</title><meta name=\"referrer\" content=\"no-referrer\"><style nonce=\"MCWIG_NONCE\">:root{font:15px/1.5 system-ui,-apple-system,sans-serif;color:#193a35;background:#eef4f1}*{box-sizing:border-box}body{margin:0}header{background:#165747;color:white;padding:22px max(20px,5vw);display:flex;justify-content:space-between;gap:15px;align-items:center}header a{color:white}main{max-width:1100px;margin:28px auto;padding:0 16px}.panel{background:white;border:1px solid #dce7e1;border-radius:15px;padding:20px;margin:14px 0;box-shadow:0 10px 30px #0a40300a}.muted{color:#59746a}h1{font-size:25px;margin:0}h2{font-size:20px}.row{display:flex;gap:10px;align-items:center;flex-wrap:wrap}.cases{display:grid;gap:10px}.case{border:1px solid #cbded5;background:#fff;border-radius:12px;padding:15px;display:flex;align-items:center;justify-content:space-between;gap:12px}.case button,.primary{border:0;background:#145f50;color:white;border-radius:8px;padding:10px 14px;cursor:pointer}button:disabled{opacity:.45;cursor:default}.danger{color:#9b3424}.photos{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}.photos img{width:100%;height:180px;object-fit:cover;border:1px solid #ccd8d2;border-radius:10px}.photos figcaption{font-size:12px;text-align:center}figure{margin:0}input[type=text],textarea{padding:11px;border:1px solid #a9c7b9;border-radius:8px;max-width:100%;width:100%}label{display:block;margin:8px 0}.small{font-size:12px}.hidden{display:none}@media(max-width:640px){.photos{grid-template-columns:repeat(2,minmax(0,1fr))}.case{align-items:stretch;flex-direction:column}header{flex-direction:column;align-items:flex-start}}</style></head><body><header><div><small>MAMTA CARE CHARITABLE TRUST</small><h1>🎗 Cancer Patient Review</h1></div><a href=\"/\">Back to Donor Desk</a></header><main><div class=\"panel\"><b>Patient Wig Requests</b><p class=\"muted\">Restricted to administrators. Approval assigns CINE WIGS automatically. Manufacturing cannot begin until the separate production-release checks are confirmed.</p><button class=\"primary\" id=\"refresh\">Refresh records</button><p id=\"notice\" role=\"status\"></p></div><div id=\"cases\" class=\"cases\" aria-live=\"polite\"></div><section id=\"detail\" class=\"panel hidden\"><h2 id=\"patient\"></h2><p id=\"reference\" class=\"muted\"></p><div id=\"patientInfo\"></div><h3>Fitting photographs</h3><div class=\"photos\" id=\"photos\"></div><div id=\"approvalBlock\"><h3>Administrator approval</h3><label>Review note (at least 8 characters)<textarea id=\"reviewNote\" rows=\"3\" maxlength=\"500\"></textarea></label><label><input type=\"checkbox\" id=\"confirmed\"> I verified the patient's application and required documents.</label><button class=\"primary\" id=\"approve\">Approve and assign CINE WIGS</button></div><div id=\"releaseBlock\"><h3>Release to fabrication</h3><label><input type=\"checkbox\" id=\"hairReady\"> Required hair is available and inspected</label><label><input type=\"checkbox\" id=\"fitting\"> Measurements and fitting confirmed</label><label><input type=\"checkbox\" id=\"conditions\"> Patient's applicable deposit, return and courier conditions confirmed</label><button class=\"primary\" id=\"release\">Release to manufacturing</button></div></section><p class=\"muted small\">Sensitive medical details and photos are restricted to authorized administrators. Do not share screenshots or links externally.</p></main><script nonce=\"MCWIG_NONCE\">(function(){const $=id=>document.getElementById(id);let selected=null;const apiBase='/api/admin/wig-v8';function msg(t,bad){$('notice').textContent=t;$('notice').className=bad?'danger':'';}async function api(path,options){const r=await fetch(apiBase+(path||''),{credentials:'same-origin',cache:'no-store',...options});const j=await r.json().catch(()=>({}));if(!r.ok||!j.ok)throw Error(j.error||'Request failed');return j;}function post(v){return {method:'POST',headers:{'Content-Type':'application/json','X-Mamta-Desk':'1'},body:JSON.stringify(v)}}function element(tag,txt,host){const el=document.createElement(tag);if(txt!=null)el.textContent=String(txt);if(host)host.append(el);return el;}async function load(){try{const d=await api('');const host=$('cases');host.replaceChildren();for(const row of d.cases){const card=element('div',null,host);card.className='case';const left=element('div',null,card);element('b',row.registration_id+' · '+row.patient_name,left);const note=element('div',row.city+' · '+row.status,left);note.className='muted';const button=element('button','Review patient',card);button.onclick=()=>openCase(row.id)}if(!d.cases.length)element('p','No patient applications in this queue.',host);msg(d.cases.length+' case(s) loaded.')}catch(e){msg(e.message,true)}}async function openCase(id){try{const d=await api('/'+id),c=d.case;selected=c;$('detail').classList.remove('hidden');$('patient').textContent=c.patient_name;$('reference').textContent=c.registration_id+' · '+c.status;const info=$('patientInfo');info.replaceChildren();for(const [label,val] of [['Email',c.email],['Phone',c.phone],['City',c.city],['Hair source',c.payload.hairSource||'donated'],['Wig length',c.payload.wigLength||'Not specified'],['Cap size',c.payload.capSize||'To confirm'],['Hospital',c.payload.hospital||'Not provided']]){const p=element('p',null,info);element('b',label+': ',p);element('span',val,p)}const host=$('photos');host.replaceChildren();for(const angle of ['front','back','left','right']){const fig=element('figure',null,host),im=element('img',null,fig);im.src=apiBase+'/'+encodeURIComponent(id)+'/photos/'+angle;im.alt=angle+' patient fitting photograph';element('figcaption',angle.toUpperCase(),fig)}$('approvalBlock').classList.toggle('hidden',c.status!=='PENDING_REVIEW');$('releaseBlock').classList.toggle('hidden',c.status!=='APPROVED'||!!c.production_released_at);window.scrollTo({top:document.getElementById('detail').offsetTop,behavior:'smooth'});}catch(e){msg(e.message,true)}}$('refresh').onclick=load;$('approve').onclick=async()=>{if(!selected)return;const note=$('reviewNote').value.trim();if(note.length<8||!$('confirmed').checked){msg('Confirm verification and provide a meaningful review note.',true);return}if(!confirm('Approve this case, queue the approval email and assign a manufacturing order to CINE WIGS?'))return;try{const d=await api('/'+selected.id+'/approve',post({review_note:note,confirm_verification:true}));msg('Approved and assigned to '+d.maker+'. Email and Sheet updates are queued.');await load();await openCase(selected.id)}catch(e){msg(e.message,true)}};$('release').onclick=async()=>{if(!selected)return;if(!confirm('Confirm that required materials, measurements and patient conditions are ready for manufacturing?'))return;try{await api('/'+selected.id+'/release',post({hair_ready:$('hairReady').checked,fitting_confirmed:$('fitting').checked,conditions_confirmed:$('conditions').checked}));msg('Manufacturing release saved.');await load();await openCase(selected.id)}catch(e){msg(e.message,true)}};load();})();</script></body></html>";
function mcwigAdminPage(){
 const nonce=Array.from(crypto.getRandomValues(new Uint8Array(16)),x=>x.toString(16).padStart(2,"0")).join("");
 const content=MCWIG_ADMIN_HTML.replaceAll("MCWIG_NONCE",nonce);
 return new Response(content,{headers:{"content-type":"text/html; charset=utf-8","cache-control":"no-store","x-frame-options":"DENY","referrer-policy":"no-referrer","x-content-type-options":"nosniff","content-security-policy":"default-src 'none'; script-src 'nonce-"+nonce+"'; style-src 'nonce-"+nonce+"'; img-src 'self'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'"}});
}

export async function handleMamtaWigV8(req,env,currentUser){
 const p=new URL(req.url).pathname,method=req.method;
 if(p==="/api/public/wig-v8"&&method==="OPTIONS"){const o=sameOrigin(req,env);return o?new Response(null,{status:204,headers:cors(o)}):err("Origin not allowed",403);}
 if(p==="/api/public/wig-v8"&&method==="POST")return apply(req,env);
 if(p==="/admin-wig-v8"){if(!adminCheck(req,currentUser))return err("Administrator session required",401);return mcwigAdminPage();}
 if(!p.startsWith("/api/admin/wig-v8"))return null;
 if(!adminCheck(req,currentUser))return err("Administrator session required",401);
 if(method==="GET"&&p==="/api/admin/wig-v8")return listCases(env);
 if(method==="GET"&&p==="/api/admin/wig-v8/outbox"){const rows=await env.DB.prepare("SELECT state,kind,COUNT(*) n FROM mcwig_outbox_v1 GROUP BY state,kind").all();return json({ok:true,counts:rows.results||[]});}
 if(method==="POST"&&p==="/api/admin/wig-v8/drain"){if(!adminWrite(req))return err("Invalid request origin",403);return json(await drainMamtaWigOutbox(env,8));}
 const detail=/^\/api\/admin\/wig-v8\/([0-9a-f-]{36})$/.exec(p);
 if(method==="GET"&&detail)return showCase(env,detail[1]);
 const photo=/^\/api\/admin\/wig-v8\/([0-9a-f-]{36})\/photos\/(front|back|left|right|medical)$/.exec(p);
 if(method==="GET"&&photo)return showPhoto(env,photo[1],photo[2]);
 const act=/^\/api\/admin\/wig-v8\/([0-9a-f-]{36})\/(approve|release)$/.exec(p);
 if(method==="POST"&&act)return act[2]==="approve"?approve(req,env,currentUser,act[1]):release(req,env,currentUser,act[1]);
 return err("Not found",404);
}
export async function wigProductionGuard(db,jobId){
 const row=await db.prepare("SELECT 1 AS hold FROM mcwig_cases_v1 WHERE maker_job_id=? AND production_released_at IS NULL AND status='APPROVED' LIMIT 1").bind(jobId).first();
 return !row;
}

/**
 * Reliable outbox delivery: scheduled job or administrator-triggered.
 * Requires configured WIG_SHEET_BRIDGE_URL and WIG_SHEET_BRIDGE_SECRET.
 * The standalone Apps Script bridge MUST be deployed and authenticated first.
 */
export async function drainMamtaWigOutbox(env,limit=8){
 const secret=String(env.WIG_SHEET_BRIDGE_SECRET||""),endpoint=String(env.WIG_SHEET_BRIDGE_URL||"");
 if(secret.length<48||!endpoint)return {ok:false,configured:false,reason:"Wig Google Sheet bridge not configured"};
 let url;try{url=new URL(endpoint)}catch{return {ok:false,configured:false,reason:"Invalid Wig bridge URL"}}
 if(url.protocol!=="https:"||url.hostname!=="script.google.com"||!/^\/macros\/s\/[^/]+\/exec$/.test(url.pathname))return {ok:false,configured:false,reason:"Unapproved Wig bridge hostname"};
 const results=await env.DB.prepare("SELECT o.id,o.case_id,o.kind,o.attempts,c.registration_id,c.applied_day_ist,c.patient_name,c.email,c.phone,c.city,c.payload_json,c.maker_job_id FROM mcwig_outbox_v1 o JOIN mcwig_cases_v1 c ON c.id=o.case_id WHERE o.state IN ('PENDING','FAILED') AND o.attempts<5 ORDER BY CASE o.kind WHEN 'GOOGLE_SHEET_CREATE' THEN 0 WHEN 'REGISTRATION_EMAIL' THEN 1 WHEN 'GOOGLE_SHEET_APPROVE' THEN 2 WHEN 'APPROVAL_EMAIL' THEN 3 ELSE 4 END,o.created_at LIMIT ?").bind(Math.max(1,Math.min(20,Number(limit)||8))).all();
 const stats={ok:true,configured:true,done:0,failed:0,waiting:0};
 for(const task of results.results||[]){
  const prior=task.kind==="REGISTRATION_EMAIL"?"GOOGLE_SHEET_CREATE":task.kind==="GOOGLE_SHEET_APPROVE"?"GOOGLE_SHEET_CREATE":task.kind==="APPROVAL_EMAIL"?"GOOGLE_SHEET_APPROVE":null;
  if(prior){
   const predecessor=await env.DB.prepare("SELECT state FROM mcwig_outbox_v1 WHERE case_id=? AND kind=?").bind(task.case_id,prior).first();
   if(predecessor?.state!=="DONE"){stats.waiting++;continue}
  }
  const ts=Math.floor(Date.now()/1000),locked=await env.DB.prepare("UPDATE mcwig_outbox_v1 SET state='PROCESSING',attempts=attempts+1,updated_at=? WHERE id=? AND state IN ('PENDING','FAILED')").bind(ts,task.id).run();
  if((locked.meta?.changes||0)!==1)continue;
  const record={registration_id:task.registration_id,applied_day_ist:task.applied_day_ist,patient_name:task.patient_name,email:task.email,phone:task.phone,city:task.city,maker_job_id:task.maker_job_id,payload:JSON.parse(task.payload_json)};
  try{
   const response=await fetch(url.toString(),{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({secret,action:task.kind,record}),redirect:"follow",signal:AbortSignal.timeout(16000)});
   const body=await response.text();if(!response.ok||body.length>8000)throw Error("Bridge failed");
   const reply=JSON.parse(body);
   if(reply.ok!==true){
    if(reply.needs_manual_review)await env.DB.prepare("UPDATE mcwig_outbox_v1 SET state='HOLD',last_error=?,updated_at=? WHERE id=?").bind("Email attempt uncertain; manual verification required",ts,task.id).run();
    else throw Error(String(reply.error||"Wig bridge rejected request").slice(0,200));
    stats.waiting++;continue;
   }
   await env.DB.prepare("UPDATE mcwig_outbox_v1 SET state='DONE',last_error=NULL,updated_at=? WHERE id=?").bind(ts,task.id).run();
   stats.done++;
  }catch(e){
   await env.DB.prepare("UPDATE mcwig_outbox_v1 SET state='FAILED',last_error=?,updated_at=? WHERE id=?").bind(String(e?.message||"Bridge temporarily unavailable").slice(0,230),ts,task.id).run();
   stats.failed++;
  }
 }
 return stats;
}
