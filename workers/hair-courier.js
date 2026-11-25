// Installed as an ES module in the existing Donor Desk Worker.
import { donorPage, adminPage } from './hair-courier-pages.js';
const base='/courier-my-hair', desk='/app/hair-courier-reviews';
const slots={hair:6,parcel:6,video:30};
const reply=(payload,status=200)=>Response.json(payload,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
const fail=(message,status=400)=>reply({error:message},status);
const cleanPhone=v=>String(v||'').replace(/\D/g,'').slice(-10);
const hex=bytes=>Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,'0')).join('');
async function sign(env,value){
 const enc=new TextEncoder();
 const key=await crypto.subtle.importKey('raw',enc.encode(env.SESSION_SECRET),{name:'HMAC',hash:'SHA-256'},false,['sign']);
 return hex(await crypto.subtle.sign('HMAC',key,enc.encode(value)));
}
async function identity(req,env){
 const ip=req.headers.get('CF-Connecting-IP')||'local';
 const window=Math.floor(Date.now()/600000);
 const bucket=await sign(env,'courier-limit|'+window+'|'+ip);
 const cap=await env.DB.prepare('INSERT INTO mc_hair_courier_limits VALUES(?,1,?) ON CONFLICT(bucket) DO UPDATE SET hits=hits+1 RETURNING hits').bind(bucket,(window+1)*600).first();
 if(cap.hits>20)return fail('Too many attempts. Try again in ten minutes.',429);
 const input=await req.json();
 const reg=String(input.registration||'').trim().toUpperCase(), phone=String(input.phone||'').trim();
 if(!/^[A-Z0-9][A-Z0-9/_-]{2,79}$/.test(reg)||!/^\d{10}$/.test(phone))return fail('Enter your registration ID and registered ten-digit mobile number.');
 const rows=await env.DB.prepare('SELECT d.id,d.phone FROM donors d WHERE upper(trim(registration_id))=? AND NOT EXISTS(SELECT 1 FROM mc_donor_recycle r WHERE r.donor_id=d.id) LIMIT 2').bind(reg).all();
 const d=rows.results.length===1?rows.results[0]:null;
 if(!d||cleanPhone(d.phone)!==phone)return fail('The registration details could not be verified. Check them or call Mamta Care.',404);
 const db=env.DB;
 await db.prepare('INSERT OR IGNORE INTO mc_hair_courier_requests(id,donor_id) VALUES(?,?)').bind(crypto.randomUUID(),d.id).run();
 const row=await db.prepare("SELECT id,state,hair,parcel,video,carrier,awb,dispatch_date FROM mc_hair_courier_requests WHERE donor_id=? AND state IN ('draft','pending','approved')").bind(d.id).first();
 const previous=await db.prepare("SELECT reason FROM mc_hair_courier_requests WHERE donor_id=? AND state='changes_requested' ORDER BY reviewed_at DESC LIMIT 1").bind(d.id).first();
 return reply({id:row.id,state:row.state,token:await sign(env,'hair-upload|'+row.id),files:Object.keys(slots).filter(k=>row[k]),reason:row.state==='draft'?previous?.reason:null,carrier:row.carrier,awb:row.awb});
}
function mediaType(bytes,video){
 const at=(pos,chars)=>chars.split('').every((c,i)=>bytes[pos+i]===c.charCodeAt(0));
 if(video){if(at(4,'ftyp'))return at(8,'qt  ')?'video/quicktime':'video/mp4';if(bytes[0]===26&&bytes[1]===69&&bytes[2]===223&&bytes[3]===163)return 'video/webm';}
 else{if(bytes[0]===255&&bytes[1]===216&&bytes[2]===255)return 'image/jpeg';if(bytes[0]===137&&at(1,'PNG')&&bytes[4]===13&&bytes[5]===10&&bytes[6]===26&&bytes[7]===10)return 'image/png';if(at(0,'RIFF')&&at(8,'WEBP'))return 'image/webp';}
 return '';
}
async function upload(req,env,row,slot){
 if(!Object.hasOwn(slots,slot))return fail('Unknown upload.',404);
 if(row.state!=='draft')return fail('This request has already been submitted.',409);
 const length=Number(req.headers.get('content-length')),limit=slots[slot]*1048576;
 if(!Number.isSafeInteger(length)||length<12||length>limit)return fail('This file is empty or too large.',413);
 const data=await req.arrayBuffer();
 if(data.byteLength!==length)return fail('Incomplete upload. Retry this file.');
 const type=mediaType(new Uint8Array(data,0,12),slot==='video');
 if(!type)return fail('Choose a JPEG, PNG or WebP photo, or an MP4, MOV or WebM video.');
 const key='hair-courier/'+row.id+'/'+crypto.randomUUID();
 await env.DONOR_PHOTOS.put(key,data,{httpMetadata:{contentType:type}});
 let result;
 try{result=await env.DB.prepare('UPDATE mc_hair_courier_requests SET '+slot+'=? WHERE id=? AND state=\'draft\' AND '+slot+' IS ?').bind(key,row.id,row[slot]).run();}
 catch(e){await env.DONOR_PHOTOS.delete(key);throw e;}
 if(!result.meta.changes){await env.DONOR_PHOTOS.delete(key);return fail('This request changed. Reopen it before retrying.',409);}
 if(row[slot])await env.DONOR_PHOTOS.delete(row[slot]);
 return reply({ok:true});
}
export async function courierRoute(req,env,helpers){
 const url=new URL(req.url),p=url.pathname;
 if(!(p===base||p.startsWith(base+'/')||p===desk||p.startsWith(desk+'/')))return null;
 try{
 if(req.method!=='GET'&&req.headers.get('Origin')!==url.origin)return fail('Reopen the form to continue.',403);
 if(p===base&&req.method==='GET')return donorPage(Object.keys(helpers.carriers));
 if(p===base+'/verify'&&req.method==='POST')return await identity(req,env);
 if(p.startsWith(desk)){
  const actor=await helpers.currentUser(req,env.DB);if(actor?.role!=='admin')return fail('Sign in to Donor Desk as an administrator.',actor?403:401);
  if(p===desk&&req.method==='GET'){
   const rows=await env.DB.prepare("SELECT r.id,r.carrier,r.awb,r.dispatch_date,d.registration_id FROM mc_hair_courier_requests r JOIN donors d ON d.id=r.donor_id WHERE r.state='pending' ORDER BY r.submitted_at").all();return adminPage(rows.results);
  }
  const m=p.slice(desk.length).match(/^\/([a-f0-9-]{36})\/(hair|parcel|video|approve|changes)$/);
  if(!m)return fail('Unknown review.',404);
  const row=await env.DB.prepare('SELECT * FROM mc_hair_courier_requests WHERE id=?').bind(m[1]).first();if(!row)return fail('Request unavailable.',404);
  if(Object.hasOwn(slots,m[2])&&req.method==='GET'){
   if(!row[m[2]])return fail('File unavailable.',404);
   const file=await env.DONOR_PHOTOS.get(row[m[2]]);if(!file)return fail('File unavailable.',404);
   return new Response(file.body,{headers:{'Content-Type':file.httpMetadata.contentType,'Cache-Control':'private,no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; sandbox"}});
  }
  if(req.method!=='POST'||!['approve','changes'].includes(m[2]))return fail('Unsupported action.',405);
  const approved=m[2]==='approve',state=approved?'approved':'changes_requested';
  if(row.state===state)return reply({ok:true,state});
  let reason='';if(!approved){reason=String((await req.json()).reason||'').trim();if(!reason||reason.length>500)return fail('Give a short correction for the donor.');}
  const done=await env.DB.prepare("UPDATE mc_hair_courier_requests SET state=?,reviewer=?,reviewed_at=unixepoch(),reason=? WHERE id=? AND state='pending'").bind(state,actor.username,reason,row.id).run();
  return done.meta.changes?reply({ok:true,state}):fail('The review has already changed. Refresh the list.',409);
 }
 const m=p.slice(base.length).match(/^\/([a-f0-9-]{36})\/(hair|parcel|video|submit)$/);
 if(!m||req.method!=='POST')return fail('Unknown upload route.',404);
 const expected=await sign(env,'hair-upload|'+m[1]);if(req.headers.get('Authorization')!=='Bearer '+expected)return fail('Verify your registration again.',403);
 const row=await env.DB.prepare('SELECT * FROM mc_hair_courier_requests WHERE id=?').bind(m[1]).first();if(!row)return fail('Verify your registration again.',404);
 if(m[2]!=='submit')return await upload(req,env,row,m[2]);
 if(['pending','approved'].includes(row.state))return reply({ok:true,state:row.state,id:row.id});
 const input=await req.json(),awb=String(input.awb||'').trim().toUpperCase(),date=String(input.date||'');
 const today=new Date(Date.now()+19800000).toISOString().slice(0,10);
 if(typeof input.carrier!=='string'||!Object.hasOwn(helpers.carriers,input.carrier)||!/^[A-Z0-9][A-Z0-9 /-]{4,64}$/.test(awb)||!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date))||new Date(date).toISOString().slice(0,10)!==date||date>today||input.consent!==true)return fail('Check the carrier, tracking number, dispatch date and consent.');
 const write=await env.DB.prepare("UPDATE mc_hair_courier_requests SET state='pending',carrier=?,awb=?,dispatch_date=?,submitted_at=unixepoch() WHERE id=? AND state='draft' AND hair IS NOT NULL AND parcel IS NOT NULL AND video IS NOT NULL").bind(input.carrier,awb,date,row.id).run();
 return write.meta.changes?reply({ok:true,state:'pending',id:row.id}):fail('Check that both photos and the video finished uploading.',409);
 }catch(e){return String(e).includes('shipment_conflict')?fail('An existing courier, hand collection or receipt conflicts with this shipment. Reconcile the donor record first.',409):fail('The service could not finish this request. Please retry.',503);}
}
