/* Mamta Care Hair Stock V1 — additive, cookie-authenticated, indexed chain-of-custody.
   Compiled onto existing Worker; never replace existing routes, donor statuses or maker login. */
const MCST_HTML=__MCST_HTML_JSON__;
const MCST_UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MCST_KINDS=['staff','volunteer','maker'];
const mcstTime=()=>Math.floor(Date.now()/1000);
const mcstJson=(x,n=200)=>mcctJSON(x,n);
const mcstFail=(message,n=400)=>mcstJson({ok:false,error:message},n);
const mcstResult=x=>Number(x?.meta?.changes||0);
const mcstWeight=(x)=>x==null||x===''?null:Number.isSafeInteger(Number(x))&&Number(x)>0&&Number(x)<=10000000?Number(x):NaN;
const mcstText=(x,n=240)=>String(x||'').trim().slice(0,n);
async function mcstPerson(req,env,path){
 if(path.startsWith('/maker-api/stock/')||path==='/maker-api/hair-stock'){
  const m=await currentMaker(req,env.DB);
  return m?{kind:'maker',id:m.id,name:m.display_name,admin:false}:null;
 }
 if(path.startsWith('/volunteer-api/stock/')){
  const v=await mcvCurrent(req,env);
  return v?{kind:'volunteer',id:v.id,name:v.full_name,admin:false}:null;
 }
 const s=await currentUser(req,env.DB);
 if(s)return {kind:'staff',id:s.username,name:s.display_name,admin:s.role==='admin'};
 if(path.startsWith('/api/stock/'))return null;
 const v=await mcvCurrent(req,env);
 return v?{kind:'volunteer',id:v.id,name:v.full_name,admin:false}:null;
}
async function mcstRoster(db){
 const [staff,vol,makers]=await Promise.all([
  db.prepare("SELECT username AS id,display_name AS name FROM staff WHERE active=1 ORDER BY display_name LIMIT 80").all(),
  db.prepare("SELECT p.id,p.full_name AS name FROM mcvol_people p JOIN mcvol_accounts a ON a.person_id=p.id WHERE p.status='active' AND p.agreement_received=1 AND p.valid_until>=? AND a.login_enabled=1 ORDER BY p.full_name LIMIT 140").bind(mcvToday()).all(),
  db.prepare("SELECT id,display_name AS name FROM maker_accounts WHERE active=1 ORDER BY display_name LIMIT 80").all()
 ]);
 return [...(staff.results||[]).map(x=>({...x,kind:'staff'})),
 ...(vol.results||[]).map(x=>({...x,kind:'volunteer'})),
 ...(makers.results||[]).map(x=>({...x,kind:'maker'})),
 {id:'nashik',name:'Nashik Fabrication Center',kind:'center'}];
}
async function mcstOverview(req,env,person){
 const db=env.DB,admin=person.admin;
 const [lots,transfers,people,alerts]=await Promise.all([
  (admin?db.prepare("SELECT l.*,d.registration_id,d.full_name AS donor_name FROM mcst_lots l JOIN donors d ON d.id=l.donor_id ORDER BY l.updated_at DESC LIMIT 300"):
   db.prepare("SELECT l.*,d.registration_id,d.full_name AS donor_name FROM mcst_lots l JOIN donors d ON d.id=l.donor_id WHERE l.holder_kind=? AND l.holder_id=? ORDER BY l.updated_at DESC LIMIT 200").bind(person.kind,person.id)).all(),
  (admin?db.prepare("SELECT t.*,(SELECT COUNT(*) FROM mcst_transfer_items i WHERE i.transfer_id=t.id) AS packages FROM mcst_transfers t ORDER BY t.created_at DESC LIMIT 100"):
   db.prepare("SELECT t.*,(SELECT COUNT(*) FROM mcst_transfer_items i WHERE i.transfer_id=t.id) AS packages FROM mcst_transfers t WHERE (t.from_kind=? AND t.from_id=?) OR (t.to_kind=? AND t.to_id=?) ORDER BY t.created_at DESC LIMIT 90").bind(person.kind,person.id,person.kind,person.id)).all(),
  mcstRoster(db),
  admin?db.prepare("SELECT id,transfer_id,alert_type,created_at,read_at FROM mcst_admin_alerts ORDER BY created_at DESC LIMIT 30").all():Promise.resolve({results:[]})
 ]);
 const list=(lots.results||[]).map(x=>({...x,donor_name:person.kind==='maker'?'':x.donor_name,registration_id:person.kind==='maker'?'':x.registration_id}));
 const all=(transfers.results||[]).map(x=>({...x,sender:people.find(p=>p.kind===x.from_kind&&p.id===x.from_id)?.name||'Authorized custodian',receiver:people.find(p=>p.kind===x.to_kind&&p.id===x.to_id)?.name||'Receiving custodian'}));
 const onHand=list.filter(x=>x.holder_kind===person.kind&&x.holder_id===person.id&&['held','reserved'].includes(x.stage));
 const metric={with_me:onHand.length,ready:onHand.filter(x=>x.stage==='held').length,transferring:onHand.filter(x=>x.stage==='reserved').length,
 incoming:all.filter(x=>x.to_kind===person.kind&&x.to_id===person.id&&x.stage==='approved').length,
 approval_needed:admin?all.filter(x=>x.stage==='pending').length:0,
 differences:admin?all.filter(x=>x.stage==='received_difference').length:0,
 all_lots:admin?list.length:undefined,unweighed:admin?list.filter(x=>x.weight_grams==null).length:undefined,
 on_team:admin?list.filter(x=>['staff','volunteer'].includes(x.holder_kind)&&['held','reserved'].includes(x.stage)).length:undefined,
 in_transit:admin?list.filter(x=>x.holder_kind==='transit').length:undefined,
 wig_maker:admin?list.filter(x=>x.holder_kind==='maker'&&x.stage==='held').length:undefined};
 return mcstJson({ok:true,person,metric,lots:list,transfers:all,recipients:people.filter(x=>x.kind!==person.kind||x.id!==person.id),
 notifications:alerts.results||[]});
}
async function mcstImportNew(env,source,id){
 if(!MCST_UUID.test(id))return;
 let q;
 if(source==='staff')q=env.DB.prepare("INSERT OR IGNORE INTO mcst_lots(donor_id,source_kind,source_ref,origin_id,holder_kind,holder_id,stage,created_at,updated_at) SELECT h.donor_id,'staff',h.id,h.collector_username,'staff',h.collector_username,'held',h.collected_at,h.collected_at FROM mcct_staff_hand_collections h JOIN donors d ON d.id=h.donor_id WHERE h.donor_id=? AND h.status='collected' AND d.registration_id IS NOT NULL AND TRIM(d.registration_id)<>''").bind(id);
 else if(source==='volunteer')q=env.DB.prepare("INSERT OR IGNORE INTO mcst_lots(donor_id,source_kind,source_ref,origin_id,holder_kind,holder_id,stage,created_at,updated_at) SELECT h.donor_id,'volunteer',h.id,h.volunteer_id,'volunteer',h.volunteer_id,'held',h.collected_at,h.collected_at FROM mcct_hand_collections h JOIN donors d ON d.id=h.donor_id WHERE h.id=? AND h.status='collected' AND NOT EXISTS(SELECT 1 FROM mcct_hand_collection_cancellations c WHERE c.handover_id=h.id) AND d.registration_id IS NOT NULL AND TRIM(d.registration_id)<>''").bind(id);
 if(q)await q.run();
}
async function mcstReconcileOld(env){
 const x=await env.DB.batch([
 env.DB.prepare("INSERT OR IGNORE INTO mcst_lots(donor_id,source_kind,source_ref,origin_id,holder_kind,holder_id,stage,created_at,updated_at) SELECT h.donor_id,'staff',h.id,h.collector_username,'staff',h.collector_username,'held',h.collected_at,h.collected_at FROM mcct_staff_hand_collections h JOIN donors d ON d.id=h.donor_id WHERE h.status='collected' AND d.registration_id IS NOT NULL AND TRIM(d.registration_id)<>''"),
 env.DB.prepare("INSERT OR IGNORE INTO mcst_lots(donor_id,source_kind,source_ref,origin_id,holder_kind,holder_id,stage,created_at,updated_at) SELECT h.donor_id,'volunteer',h.id,h.volunteer_id,'volunteer',h.volunteer_id,'held',h.collected_at,h.collected_at FROM mcct_hand_collections h JOIN donors d ON d.id=h.donor_id WHERE h.status='collected' AND NOT EXISTS(SELECT 1 FROM mcct_hand_collection_cancellations c WHERE c.handover_id=h.id) AND d.registration_id IS NOT NULL AND TRIM(d.registration_id)<>''")
 ]);
 return (x||[]).map(mcstResult).reduce((a,b)=>a+b,0);
}
async function mcstRecipient(db,kind,id){
 if(kind==='center'&&id==='nashik')return {kind,id,name:'Nashik Fabrication Center'};
 if(kind==='staff'){
  const r=await db.prepare('SELECT display_name AS name FROM staff WHERE username=? AND active=1').bind(id).first();
  return r?{kind,id,name:r.name}:null;
 }
 if(kind==='volunteer'){
  const r=await db.prepare("SELECT full_name AS name FROM mcvol_people p WHERE id=? AND status='active' AND agreement_received=1 AND valid_until>=? AND EXISTS(SELECT 1 FROM mcvol_accounts a WHERE a.person_id=p.id AND a.login_enabled=1)").bind(id,mcvToday()).first();
  return r?{kind,id,name:r.name}:null;
 }
 if(kind==='maker'){
  const r=await db.prepare("SELECT display_name AS name FROM maker_accounts WHERE id=? AND active=1").bind(id).first();
  return r?{kind,id,name:r.name}:null;
 }
 return null;
}
async function mcstSend(req,env,p){
 let d;try{d=await req.json()}catch{return mcstFail('Check your transfer form.',400)}
 const ids=d.lot_ids;
 if(!Array.isArray(ids)||ids.length<1||ids.length>30||new Set(ids).size!==ids.length||!ids.every(x=>typeof x==='string'&&MCST_UUID.test(x)))return mcstFail('Select between 1 and 30 hair packages.',400);
 const kind=String(d.to_kind||''),toId=String(d.to_id||'');
 if(![...MCST_KINDS,'center'].includes(kind)||toId.length<1||toId.length>100||(kind===p.kind&&toId===p.id))return mcstFail('Select a different staff member, volunteer or wig maker.',400);
 const to=await mcstRecipient(env.DB,kind,toId);
 if(!to)return mcstFail('Recipient account is not currently active.',409);
 const weight=mcstWeight(d.dispatch_weight_grams);
 if(Number.isNaN(weight))return mcstFail('Enter a valid measured weight in grams, or leave it blank.',400);
 const values=ids.map(()=>'?').join(',');
 const available=await env.DB.prepare('SELECT donor_id FROM mcst_lots WHERE donor_id IN ('+values+") AND holder_kind=? AND holder_id=? AND stage='held' AND lock_transfer=''").bind(...ids,p.kind,p.id).all();
 if((available.results||[]).length!==ids.length)return mcstFail('Some packages are already transferred, or are not with you. Refresh your list.',409);
 const id=crypto.randomUUID(),ts=mcstTime();
 const lock=await env.DB.prepare("UPDATE mcst_lots SET stage='reserved',lock_transfer=?,updated_at=?,version=version+1 WHERE donor_id IN ("+values+") AND holder_kind=? AND holder_id=? AND stage='held' AND lock_transfer=''").bind(id,ts,...ids,p.kind,p.id).run();
 if(mcstResult(lock)!==ids.length){
  await env.DB.prepare("UPDATE mcst_lots SET stage='held',lock_transfer='',updated_at=?,version=version+1 WHERE lock_transfer=? AND stage='reserved'").bind(mcstTime(),id).run();
  return mcstFail('The stock changed while you were working. Please refresh.',409);
 }
 const note=mcstText(d.note,240);
 try{
  const ops=[
   env.DB.prepare("INSERT INTO mcst_transfers(id,from_kind,from_id,to_kind,to_id,stage,dispatch_weight_grams,note,created_at,updated_at) VALUES(?,?,?,?,?,'pending',?,?,?,?)").bind(id,p.kind,p.id,kind,toId,weight,note,ts,ts),
   ...ids.map(donor=>env.DB.prepare("INSERT INTO mcst_transfer_items(transfer_id,donor_id) VALUES(?,?)").bind(id,donor)),
   env.DB.prepare("INSERT INTO mcst_events(id,transfer_id,actor_kind,actor_id,action,detail,created_at) VALUES(?,?,?,?,'sent',?,?)").bind(crypto.randomUUID(),id,p.kind,p.id,note,ts),
   env.DB.prepare("INSERT INTO mcst_admin_alerts(id,transfer_id,alert_type,created_at) VALUES(?,?,'sent',?)").bind(crypto.randomUUID(),id,ts)
  ];
  await env.DB.batch(ops);
 }catch(e){
  await env.DB.prepare("UPDATE mcst_lots SET stage='held',lock_transfer='',updated_at=?,version=version+1 WHERE lock_transfer=? AND stage='reserved'").bind(mcstTime(),id).run();
  console.error('MCST_SEND',String(e?.name||'Error'));
  return mcstFail('Could not submit the transfer. No hair was moved.',503);
 }
 return mcstJson({ok:true,transfer_id:id,status:'pending',message:'Administrator notified. Hair remains in your custody until approved.'},201);
}
async function mcstDecide(req,env,p){
 if(!p.admin)return mcstFail('Administrator only.',403);
 let d;try{d=await req.json()}catch{return mcstFail('Invalid request.',400)}
 if(!MCST_UUID.test(d.transfer_id||'')||!['approve','reject'].includes(d.action))return mcstFail('Invalid transfer or decision.',400);
 const id=d.transfer_id,ts=mcstTime(),approve=d.action==='approve';
 const current=await env.DB.prepare("SELECT * FROM mcst_transfers WHERE id=? AND stage='pending'").bind(id).first();
 if(!current)return mcstFail('This request is already processed. Refresh the list.',409);
 const count=await env.DB.prepare("SELECT COUNT(*) AS n FROM mcst_transfer_items WHERE transfer_id=?").bind(id).first();
 if(!count?.n)return mcstFail('Transfer has no hair packages. Contact the administrator.',409);
 const sql=approve?"UPDATE mcst_transfers SET stage='approved',approved_by=?,approved_at=?,updated_at=? WHERE id=? AND stage='pending'":"UPDATE mcst_transfers SET stage='rejected',approved_by=?,approved_at=?,updated_at=? WHERE id=? AND stage='pending'";
 const statements=[
  env.DB.prepare(sql).bind(p.id,ts,ts,id),
  approve?
   env.DB.prepare("UPDATE mcst_lots SET stage='transit',holder_kind='transit',holder_id=?,updated_at=?,version=version+1 WHERE lock_transfer=? AND stage='reserved' AND holder_kind=? AND holder_id=? AND EXISTS(SELECT 1 FROM mcst_transfers t WHERE t.id=? AND t.stage='approved')").bind(id,ts,id,current.from_kind,current.from_id,id):
   env.DB.prepare("UPDATE mcst_lots SET stage='held',lock_transfer='',updated_at=?,version=version+1 WHERE lock_transfer=? AND stage='reserved' AND holder_kind=? AND holder_id=? AND EXISTS(SELECT 1 FROM mcst_transfers t WHERE t.id=? AND t.stage='rejected')").bind(ts,id,current.from_kind,current.from_id,id),
  env.DB.prepare("INSERT INTO mcst_events(id,transfer_id,actor_kind,actor_id,action,detail,created_at) VALUES(?,?,?,?,?,?,?)").bind(crypto.randomUUID(),id,'staff',p.id,d.action,mcstText(d.note,240),ts)
 ];
 const out=await env.DB.batch(statements);
 if(mcstResult(out?.[0])!==1)return mcstFail('This request has already been handled.',409);
 if(mcstResult(out?.[1])!==Number(count.n)){
  console.error('MCST_APPROVAL_STOCK_MISMATCH',{transfer:id,expected:count.n,changed:mcstResult(out?.[1])});
  return mcstFail('Transfer requires review: stock count did not match. Contact an administrator.',503);
 }
 return mcstJson({ok:true,status:approve?'approved':'rejected',message:approve?'Approved. Hair is now in transit until the receiver confirms.':'Transfer rejected; stock is available again.'});
}
async function mcstReceive(req,env,p){
 let d;try{d=await req.json()}catch{return mcstFail('Invalid receipt details.',400)}
 if(!MCST_UUID.test(d.transfer_id||''))return mcstFail('Invalid transfer ID.',400);
 const id=d.transfer_id,now=mcstTime();
 const t=await env.DB.prepare("SELECT * FROM mcst_transfers WHERE id=? AND stage='approved'").bind(id).first();
 if(!t)return mcstFail('Transfer not approved or already received.',409);
 if(!(t.to_kind===p.kind&&t.to_id===p.id)&&!(t.to_kind==='center'&&p.admin&&t.to_id==='nashik'))return mcstFail('Only the named receiver can confirm the hair.',403);
 const weight=mcstWeight(d.receipt_weight_grams);
 if(Number.isNaN(weight))return mcstFail('Enter a valid net weight in grams.',400);
 if(t.to_kind==='maker'&&weight===null)return mcstFail('Wig maker must enter the measured hair weight in grams.',400);
 const diff=weight!=null&&t.dispatch_weight_grams!=null&&weight!==t.dispatch_weight_grams;
 const stage=diff?'received_difference':'received';
 const count=await env.DB.prepare("SELECT COUNT(*) AS n FROM mcst_transfer_items WHERE transfer_id=?").bind(id).first();
 if(!count?.n)return mcstFail('No packages attached to this transfer.',409);
 const statements=[
  env.DB.prepare("UPDATE mcst_transfers SET stage=?,receipt_weight_grams=?,receive_note=?,received_at=?,updated_at=? WHERE id=? AND stage='approved'").bind(stage,weight,mcstText(d.note,240),now,now,id),
  env.DB.prepare("UPDATE mcst_lots SET stage='held',holder_kind=?,holder_id=?,lock_transfer='',updated_at=?,version=version+1 WHERE lock_transfer=? AND stage='transit' AND holder_kind='transit' AND holder_id=? AND EXISTS(SELECT 1 FROM mcst_transfers t WHERE t.id=? AND t.stage IN ('received','received_difference'))").bind(t.to_kind,t.to_id,now,id,id,id),
  env.DB.prepare("INSERT INTO mcst_events(id,transfer_id,actor_kind,actor_id,action,detail,created_at) VALUES(?,?,?,?,?,?,?)").bind(crypto.randomUUID(),id,p.kind,p.id,stage,mcstText(d.note,240),now)
 ];
 if(diff)statements.push(env.DB.prepare("INSERT OR IGNORE INTO mcst_admin_alerts(id,transfer_id,alert_type,created_at) VALUES(?,?,'received_difference',?)").bind(crypto.randomUUID(),id,now));
 const results=await env.DB.batch(statements);
 if(mcstResult(results?.[0])!==1)return mcstFail('This receipt was already processed.',409);
 if(mcstResult(results?.[1])!==Number(count.n)){
  console.error('MCST_RECEIPT_STOCK_MISMATCH',{transfer:id,expected:count.n,changed:mcstResult(results?.[1])});
  return mcstFail('Stock mismatch requires administrator review.',503);
 }
 return mcstJson({ok:true,status:stage,weight_difference_grams:diff?weight-t.dispatch_weight_grams:0,message:diff?'Received and administrator notified of the weight difference.':'Hair received. Stock is now with the recipient.'});
}
async function mcstMeasure(req,env,p){
 let d;try{d=await req.json()}catch{return mcstFail('Invalid entry.',400)}
 const donor=String(d.donor_id||'');
 if(!MCST_UUID.test(donor))return mcstFail('Invalid hair package.',400);
 const braids=Number(d.braids);
 const length=d.length_cm==null||d.length_cm===''?null:Number(d.length_cm);
 const weight=mcstWeight(d.weight_grams);
 if(!Number.isInteger(braids)||braids<1||braids>100||Number.isNaN(weight)||length!==null&&(!Number.isInteger(length)||length<1||length>200))
  return mcstFail('Enter package count and optional length / measured weight accurately.',400);
 const r=await env.DB.prepare("UPDATE mcst_lots SET braids=?,weight_grams=?,length_cm=?,updated_at=?,version=version+1 WHERE donor_id=? AND holder_kind=? AND holder_id=? AND stage='held' AND lock_transfer=''").bind(braids,weight,length,mcstTime(),donor,p.kind,p.id).run();
 return mcstResult(r)===1?mcstJson({ok:true,message:'Hair package details saved.'}):mcstFail('Hair is not currently available with you.',409);
}
async function mcstMarkLegacy(env,kind,sourceId,action){
 const now=mcstTime(),target=action==='dispatch'?'legacy_in_transit':'center',owner=action==='dispatch'?'transit':'center',ownerId=action==='dispatch'?'legacy-'+sourceId:'nashik';
 if(action==='dispatch')await env.DB.prepare("UPDATE mcst_lots SET stage='legacy_in_transit',holder_kind='transit',holder_id=?,updated_at=?,version=version+1 WHERE source_kind=? AND source_ref=? AND stage='held' AND lock_transfer=''").bind(ownerId,now,kind,sourceId).run();
 else await env.DB.prepare("UPDATE mcst_lots SET stage='center',holder_kind='center',holder_id='nashik',updated_at=?,version=version+1 WHERE source_kind=? AND source_ref=? AND stage='legacy_in_transit'").bind(now,kind,sourceId).run();
}
async function mcstApi(req,env,person,endpoint){
 const method=req.method;
 if(method==='GET'&&endpoint==='dashboard')return mcstOverview(req,env,person);
 if(method==='GET'&&endpoint==='alerts-count'){
  if(!person.admin)return mcstFail('Administrator only.',403);
  const [pending,unread]=await Promise.all([
   env.DB.prepare("SELECT COUNT(*) AS n FROM mcst_transfers WHERE stage='pending'").first(),
   env.DB.prepare("SELECT COUNT(*) AS n FROM mcst_admin_alerts WHERE read_at=0").first()
  ]);
  return mcstJson({ok:true,pending:Number(pending?.n||0),unread:Number(unread?.n||0)});
 }
 if(method!=='POST')return mcstFail('Method not permitted.',405);
 if(!allowedWrite(req))return mcstFail('Request origin verification failed.',403);
 if(endpoint==='send')return mcstSend(req,env,person);
 if(endpoint==='decide')return mcstDecide(req,env,person);
 if(endpoint==='receive')return mcstReceive(req,env,person);
 if(endpoint==='measure')return mcstMeasure(req,env,person);
 if(endpoint==='sync-existing'){
  if(!person.admin)return mcstFail('Administrator only.',403);
  const n=await mcstReconcileOld(env);
  return mcstJson({ok:true,imported:n,message:'Existing collected hair records included, without duplicates.'});
 }
 if(endpoint==='alerts-seen'){
  if(!person.admin)return mcstFail('Administrator only.',403);
  await env.DB.prepare('UPDATE mcst_admin_alerts SET read_at=? WHERE read_at=0').bind(mcstTime()).run();
  return mcstJson({ok:true});
 }
 return mcstFail('Not found.',404);
}
const MCST_PREVIOUS_FETCH=launch_wig_maker_portal_worker_default.fetch;
launch_wig_maker_portal_worker_default.fetch=async function(req,env,ctx){
 const path=new URL(req.url).pathname;
 const route=/^\/(api|volunteer-api|maker-api)\/stock\/([a-z-]+)$/.exec(path);
 if(route){
  try{
   const person=await mcstPerson(req,env,path);
   if(!person)return mcstFail('Please sign in with your Mamta Care account.',401);
   return await mcstApi(req,env,person,route[2]);
  }catch(e){console.error('MCST_STOCK_API',String(e?.name||'Error'));return mcstFail('Hair Stock temporarily unavailable; other donor features are unchanged.',503)}
 }
 if(req.method==='GET'&&(path==='/hair-stock'||path==='/maker-api/hair-stock')){
  try{
   const person=await mcstPerson(req,env,path);
   if(!person)return mcctSecure('<!doctype html><html><head><title>Hair Stock sign in</title></head><body><h2>Please sign in to Mamta Care</h2><a href="/app">Staff or volunteer login</a> | <a href="/maker">Wig maker login</a></body></html>',401);
   const api=person.kind==='maker'?'/maker-api/stock':person.kind==='volunteer'?'/volunteer-api/stock':'/api/stock';
   const html=MCST_HTML.replaceAll('__MCST_API__',api).replaceAll('__MCST_BACK__',person.kind==='maker'?'/maker':person.kind==='volunteer'?'/volunteer':'/app');
   return mcctWigV3SecureHTML(html,false);
  }catch(e){console.error('MCST_PAGE',String(e?.name||'Error'));return mcstFail('Stock view unavailable. Your previous Donor Desk remains available.',503)}
 }
 const collection= req.method==='POST'&&(
  path==='/api/hand-collections/self-collect'||
  /^\/volunteer-api\/hand-collections\/[0-9a-f-]{36}\/(collect|dispatch)$/.test(path)||
  /^\/api\/hand-collections\/(?:staff\/)?[0-9a-f-]{36}\/(dispatch|receive)$/.test(path));
 if(collection){
  const originalData=path==='/api/hand-collections/self-collect'?await req.clone().json().catch(()=>({})):null;
  const previous=await MCST_PREVIOUS_FETCH.call(this,req,env,ctx);
  if(previous.ok){
   try{
    const data=await previous.clone().json();
    if(data.ok){
     if(path==='/api/hand-collections/self-collect'&&originalData?.donor_id)await mcstImportNew(env,'staff',originalData.donor_id);
     else{
      const match=path.match(/^\/(volunteer-api\/hand-collections|api\/hand-collections(?:\/staff)?)\/([0-9a-f-]{36})\/(collect|dispatch|receive)$/);
      if(match){
       const source=match[1].startsWith('volunteer')?'volunteer':'staff',id=match[2],action=match[3];
       if(source==='volunteer'&&action==='collect')await mcstImportNew(env,'volunteer',id);
       else if(action==='dispatch'||action==='receive')await mcstMarkLegacy(env,source,id,action);
      }
     }
    }
   }catch(e){console.error('MCST_COLLECTION_BRIDGE',String(e?.name||'Error'))}
  }
  return previous;
 }
 if(req.method==='GET'&&['/app','/','/volunteer','/maker'].includes(path)){
  const previous=await MCST_PREVIOUS_FETCH.call(this,req,env,ctx);
  if(!previous.ok||!String(previous.headers.get('content-type')||'').includes('text/html'))return previous;
  try{
   let html=await previous.text();
   if(html.includes('data-mcst-link'))return new Response(html,{status:previous.status,headers:previous.headers});
   const url=path==='/maker'?'/maker-api/hair-stock':'/hair-stock';
   const link='<a data-mcst-link="1" href="'+url+'" style="display:inline-block;margin:10px;padding:12px 16px;background:#12644d;color:#fff;border-radius:12px;font:700 15px system-ui;text-decoration:none">📦 Hair Stock</a>';
   html=html.includes('</header>')?html.replace('</header>',link+'</header>'):html.replace('</body>',link+'</body>');
   const headers=new Headers(previous.headers);headers.delete('content-length');headers.delete('etag');headers.set('cache-control','private,no-store');
   return new Response(html,{status:previous.status,headers});
  }catch(e){console.error('MCST_NAV',String(e?.name||'Error'));return previous}
 }
 return MCST_PREVIOUS_FETCH.call(this,req,env,ctx);
};
/* MCST_HAIR_STOCK_CHAIN_OF_CUSTODY_V1_20261116 */
