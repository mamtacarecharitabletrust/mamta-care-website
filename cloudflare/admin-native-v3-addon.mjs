/* MAMTA CARE · Reliable Admin Navigation V3 · 2026-11-16
 * New opt-in admin-only /app/premium screen and read-only native pages.
 * Important: / and /app remain UNCHANGED, allowing actual signed-in acceptance
 * before any future home-screen replacement. Existing donor editing, couriers,
 * certificates, inventory, staff accounts, scheduled tasks, and routes untouched.
 * All navigation uses ordinary HTML links and browser-native forms: no JS and no iframes.
 */
const MP3_CSS=__MP3_CSS_JSON__;
const MP3_HOME='/app/premium';
const MP3_ROUTES=[
 {id:'donors',name:'Donor Records',icon:'👥',description:'Find donor registrations and open their details',href:'/app/premium/donors',group:'Everyday work'},
 {id:'queue',name:'Pending Donations',icon:'☷',description:'Pending and verified donor applications',href:'/app/premium/queue',group:'Everyday work'},
 {id:'stock',name:'Hair Stock',icon:'📦',description:'Hair held, transferred and received',href:'/hair-stock',group:'Everyday work'},
 {id:'hand',name:'Hair Collections',icon:'🤝',description:'Collected by staff and volunteers',href:'/app/hand-collections',group:'Everyday work'},
 {id:'couriers',name:'Courier Tracking',icon:'🚚',description:'Saved AWB and courier records',href:'/app/premium/couriers',group:'Everyday work'},
 {id:'receipts',name:'Parcel Receiving',icon:'▥',description:'Scan and record received parcels',href:'/app/receipts',group:'Everyday work'},
 {id:'donor-edit',name:'Edit Donors',icon:'✎',description:'Open the original full Donor Desk to make updates',href:'/app/workspace/desk',group:'Everyday work'},
 {id:'wigs',name:'Wigs & Fabrication',icon:'✂',description:'Wig requests, inventory and orders',href:'/premium-v3/wigs',group:'Wigs and certificates'},
 {id:'maker',name:'Wig Maker Login',icon:'🧵',description:'Authorized wig-maker account and production jobs',href:'/maker',group:'Wigs and certificates'},
 {id:'hospital',name:'Hospital Requests',icon:'🏥',description:'Hospitals, referrals and free wig requests',href:'/v3-partner/clinical',group:'Wigs and certificates'},
 {id:'print',name:'Print Certificates',icon:'🖨',description:'Certificates, courier stickers and batch printing',href:'/app/print-studio',group:'Wigs and certificates'},
 {id:'donor-photos',name:'Donor Photographs',icon:'▧',description:'Private donor photograph records',href:'/premium-v3/photos',group:'Wigs and certificates'},
 {id:'certificate-sync',name:'Certificate Courier Sync',icon:'⇆',description:'Courier AWB synchronization to certificates',href:'/app/courier-certificate-sync',group:'Wigs and certificates'},
 {id:'team',name:'Staff & Volunteers',icon:'🪪',description:'Authorized people, team access and identity cards',href:'/premium-v3/people',group:'Team and partners'},
 {id:'referrals',name:'Volunteer Referrals',icon:'🙋',description:'Review pending volunteer introductions',href:'/premium-v3/volunteer-review',group:'Team and partners'},
 {id:'salons',name:'Salons & Partners',icon:'🏪',description:'Salon and partner applications',href:'/v3-partner/admin',group:'Team and partners'},
 {id:'registration',name:'Registration Sync',icon:'↻',description:'Website registrations and official Sheet matching',href:'/admin-registration-sync',group:'Administration'},
 {id:'ops',name:'Admin Operations',icon:'⚙',description:'Operations console and pending checks',href:'/admin-ops',group:'Administration'},
 {id:'operations',name:'Operations Desk',icon:'▣',description:'Existing internal operations records',href:'/app/operations',group:'Administration'},
 {id:'website',name:'Website Controls',icon:'🌐',description:'Posters, drives, campaigns and website content',href:'https://mamta-website-content-control.bharathairseva-in.workers.dev/admin',group:'Administration'},
 {id:'classic',name:'Original Donor Desk',icon:'↩',description:'Your previous administrator dashboard, always available',href:'/app',group:'Administration'}
];
const MP3_GROUPS=['Everyday work','Wigs and certificates','Team and partners','Administration'];
const MP3_ESC=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const MP3_LIMIT=80;
const MP3_ID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function mp3Link(target,label,cls='',attr=''){
 return '<a href="'+MP3_ESC(target)+'"'+(cls?' class="'+MP3_ESC(cls)+'"':'')+(attr?' '+attr:'')+'>'+label+'</a>';
}
function mp3FeatureCard(f){
 return '<a class="tile'+(['queue','couriers','wigs'].includes(f.id)?' blue':['stock','print','receipts'].includes(f.id)?' gold':'')+'" href="'+MP3_ESC(f.href)+'"><span class="symbol" aria-hidden="true">'+MP3_ESC(f.icon)+'</span><strong>'+MP3_ESC(f.name)+'</strong><small>'+MP3_ESC(f.description)+'</small></a>';
}
function mp3FeatureLink(f){
 return '<a class="feature-link" href="'+MP3_ESC(f.href)+'"><span class="symbol" aria-hidden="true">'+MP3_ESC(f.icon)+'</span><span class="copy"><strong>'+MP3_ESC(f.name)+'</strong><small>'+MP3_ESC(f.description)+'</small></span><span class="chev" aria-hidden="true">›</span></a>';
}
function mp3Groups(find=''){
 const term=find.toLowerCase().trim();
 let found=0;
 const html=MP3_GROUPS.map(group=>{
  const items=MP3_ROUTES.filter(f=>f.group===group&&(!term||(f.name+' '+f.description+' '+f.group).toLowerCase().includes(term)));
  if(!items.length)return '';
  found+=items.length;
  return '<section class="feature-section"><h2>'+MP3_ESC(group)+'</h2>'+items.map(mp3FeatureLink).join('')+'</section>';
 }).join('');
 return {found,html:html||'<p class="message">No matching feature. Try a simpler word like hair, wig, courier or donor.</p>'};
}
function mp3Layout(u,current,body,title='Admin Home'){
 const nav=[{name:'Home',href:MP3_HOME,icon:'⌂',id:'home'},
 {name:'Donors',href:MP3_HOME+'/donors',icon:'👥',id:'donors'},
 {name:'Donation Queue',href:MP3_HOME+'/queue',icon:'☷',id:'queue'},
 {name:'Hair Stock',href:'/hair-stock',icon:'📦',id:'stock'},
 {name:'Courier Tracking',href:MP3_HOME+'/couriers',icon:'🚚',id:'couriers'},
 {name:'All Features',href:MP3_HOME+'/all',icon:'▦',id:'all'}];
 const display=MP3_ESC(u.display_name||u.username||'Administrator');
 const initial=MP3_ESC((u.display_name||u.username||'A').trim().slice(0,1).toUpperCase());
 const sidemenu=nav.map(n=>'<a href="'+n.href+'"'+(current===n.id?' aria-current="page"':'')+'><span class="symbol" aria-hidden="true">'+n.icon+'</span>'+MP3_ESC(n.name)+'</a>').join('');
 const bottom=[
  {name:'Home',href:MP3_HOME,icon:'⌂',active:current==='home'},
  {name:'Donors',href:MP3_HOME+'/donors',icon:'👥',active:current==='donors'||current==='donor'},
  {name:'Hair Stock',href:'/hair-stock',icon:'📦',active:current==='stock'},
  {name:'All Features',href:MP3_HOME+'/all',icon:'▦',active:current==='all'}
 ].map(n=>'<a href="'+n.href+'"'+(n.active?' aria-current="page"':'')+'><span class="symbol" aria-hidden="true">'+n.icon+'</span>'+MP3_ESC(n.name)+'</a>').join('');
 return '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="theme-color" content="#123f32"><meta name="robots" content="noindex,nofollow"><link rel="apple-touch-icon" href="/apple-touch-icon.png"><link rel="manifest" href="/manifest.webmanifest"><title>'+MP3_ESC(title)+' | Mamta Care</title><style nonce="__MP3_NONCE__">'+MP3_CSS+'</style></head><body><div class="bg-glow" aria-hidden="true"></div><div class="frame"><aside class="sidebar"><a href="'+MP3_HOME+'" class="brand"><img src="/volunteer-logo.jpeg" alt="Mamta Care official logo"><span><b>MAMTA CARE</b><small>Charitable Trust · Donor Desk</small></span></a><div class="nav-group"><h2>Quick navigation</h2>'+sidemenu+'</div><div class="nav-group"><h2>More</h2><a href="/app/hand-collections"><span class="symbol">🤝</span>Hair Collections</a><a href="/app/print-studio"><span class="symbol">🖨</span>Print Certificates</a><a href="/premium-v3/people"><span class="symbol">🪪</span>Staff & Volunteers</a><a href="/app"><span class="symbol">↩</span>Original Donor Desk</a></div><p class="sidebar-foot">Your existing Mamta Care accounts and records are unchanged. Select a named option to open it directly.</p></aside><div class="workspace"><header class="top"><div><div class="top-title">Mamta Care · Administrator</div><div class="top-label">Simple, organized workspaces</div></div><div class="top-profile"><span class="top-user"><span class="avatar" aria-hidden="true">'+initial+'</span>'+display+'</span><a href="/app" class="top-link">Classic view</a></div></header><main>'+body+'<p class="footer">Private administrator workspace · Existing donor and wig data remains in its original system. Links open the original authorized functions.</p></main></div></div><nav class="mobilebar" aria-label="Mobile quick navigation">'+bottom+'</nav></body></html>';
}
function mp3SafePage(html){
 const bytes=new Uint8Array(16);crypto.getRandomValues(bytes);
 const nonce=Array.from(bytes).map(x=>x.toString(16).padStart(2,'0')).join('');
 return new Response(html.replaceAll('__MP3_NONCE__',nonce),{
  status:200,headers:{
   'content-type':'text/html; charset=utf-8',
   'cache-control':'private,no-store',
   'referrer-policy':'no-referrer',
   'x-content-type-options':'nosniff',
   'x-frame-options':'DENY',
   'content-security-policy':"default-src 'none'; style-src 'nonce-"+nonce+"'; img-src 'self'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'",
   'x-robots-tag':'noindex,nofollow'
  }
 });
}
function mp3Intro(title,desc,eyebrow='YOUR WORKSPACE'){
 return '<section class="page-intro"><div><span class="eyebrow">'+MP3_ESC(eyebrow)+'</span><h1>'+MP3_ESC(title)+'</h1><p class="lead">'+MP3_ESC(desc)+'</p></div><span class="priv-badge">🔒 Administrator only</span></section>';
}
function mp3Number(num,label){
 return '<div class="stat"><strong>'+Number(num||0).toLocaleString('en-IN')+'</strong><small>'+MP3_ESC(label)+'</small></div>';
}
function mp3HeaderCard(label,info){
 return '<div class="notice"><span aria-hidden="true">ℹ</span><span><strong>'+MP3_ESC(label)+'</strong><br>'+MP3_ESC(info)+'</span></div>';
}
function mp3Name(row){return MP3_ESC(row?.full_name||'Donor')}
function mp3RowStatus(status){
 const s=String(status||'Pending').trim();
 const verified=s.toUpperCase()==='VERIFIED';
 return '<span class="pill'+(verified?'':' warn')+'">'+MP3_ESC(s)+'</span>';
}
function mp3DonorTable(rows,empty='No matching donor records.'){
 if(!rows.length)return '<div class="message">'+MP3_ESC(empty)+'</div>';
 return '<div class="table-wrap"><table><thead><tr><th>Donor</th><th>Registration</th><th>City</th><th>Status</th><th>Open</th></tr></thead><tbody>'+
 rows.map(r=>'<tr><td><strong>'+mp3Name(r)+'</strong><small>'+MP3_ESC(r.assigned_to||'Not assigned')+'</small></td><td>'+MP3_ESC(r.registration_id||'Not confirmed')+'</td><td>'+MP3_ESC(r.city||'—')+'</td><td>'+mp3RowStatus(r.verification_status)+'</td><td>'+mp3Link(MP3_HOME+'/donor/'+encodeURIComponent(r.id),'View','textlink')+'</td></tr>').join('')+
 '</tbody></table></div>';
}
async function mp3Home(env,u){
 const db=env.DB;
 const row=await db.prepare("SELECT (SELECT COUNT(*) FROM donors) AS donors,(SELECT COUNT(*) FROM mcq_donor_couriers) AS couriers,(SELECT COUNT(*) FROM mcst_lots WHERE holder_kind='staff' OR holder_kind='volunteer') AS team_stock,(SELECT COUNT(*) FROM mcst_transfers WHERE stage='pending') AS transfers").first();
 const main=['donors','stock','queue','hand','couriers','wigs','receipts','print'].map(id=>mp3FeatureCard(MP3_ROUTES.find(f=>f.id===id))).join('');
 const hero='<section class="hero"><span class="eyebrow">MAMTA CARE · ADMIN COMMAND CENTER</span><h2>Everything you need. Easy to find.</h2><p>No hidden menus. Just tap the job you want to do: find a donor, check hair stock, approve handovers, track a parcel or manage wigs.</p><div class="hero-actions">'+mp3Link(MP3_HOME+'/donors','👥 Find a donor','btn')+mp3Link(MP3_HOME+'/all','▦ See every feature','btn secondary')+'</div></section>';
 return mp3Intro('Welcome to Mamta Care','Your main daily actions are right here. Tap a large card to open the actual tool.')+hero+
 '<div class="section-head"><h2>Quick actions</h2><span>One tap to open</span></div><section class="tiles">'+main+'</section>'+
 '<div class="section-head"><h2>Today’s overview</h2><span>Current saved records</span></div><div class="stats">'+
 mp3Number(row?.donors,'Registered donors')+mp3Number(row?.couriers,'Saved couriers')+mp3Number(row?.team_stock,'Hair packages with team')+mp3Number(row?.transfers,'Hair transfers awaiting approval')+
 '</div><div class="section-head"><h2>Need something else?</h2><span>All modules are kept</span></div><div class="card"><p class="help">Open the full list to find volunteer management, certificates, photo records, hospitals, salons, registrations and website controls.</p>'+mp3Link(MP3_HOME+'/all','▦ Open all features','btn soft')+'</div>'+
 '<details class="help-details"><summary>How do I use this app?</summary><p>Choose a big button. If you want to see all options, tap All Features at the bottom. If something does not open, the Original Donor Desk remains available from the All Features page.</p></details>';
}
async function mp3Donors(env,params){
 const text=String(params.get('q')||'').trim().slice(0,65);
 let sql="SELECT id,full_name,registration_id,city,assigned_to,verification_status,followup_status FROM donors";
 const q=text?' WHERE full_name LIKE ? OR registration_id LIKE ? OR phone LIKE ?':'';
 sql+=q+' ORDER BY created_at DESC LIMIT '+MP3_LIMIT;
 const pattern='%'+text+'%';
 const out=await (text?env.DB.prepare(sql).bind(pattern,pattern,pattern).all():env.DB.prepare(sql).all());
 const body=mp3Intro('Find a donor','Search by donor name, phone number or registration ID. This list is view-only; existing donor editing remains available.')+
 '<form class="search-form" method="GET" action="'+MP3_HOME+'/donors"><label>Donor name, phone or registration number<input type="search" name="q" value="'+MP3_ESC(text)+'" maxlength="65" placeholder="Enter name or registration ID" enterkeyhint="search"></label><button class="btn soft" type="submit">🔍 Search</button></form>'+
 '<div class="section-head"><h2>Donor records</h2><span>Showing up to '+MP3_LIMIT+' recent or matching records</span></div>'+mp3DonorTable(out.results||[])+
 '<div class="card"><p class="help">To edit a donor, assign staff, verify a donation or issue a certificate, use the original Donor Desk. That screen remains available while this easier list is introduced.</p>'+mp3Link('/app/workspace/desk','✎ Open Donor Desk for editing','btn soft')+'</div>';
 return body;
}
async function mp3Queue(env,params){
 const verified=params.get('status')==='verified';
 const sql="SELECT id,full_name,registration_id,city,assigned_to,verification_status,followup_status FROM donors WHERE "+(verified?"UPPER(TRIM(COALESCE(verification_status,'')))='VERIFIED'":"UPPER(TRIM(COALESCE(verification_status,'')))!='VERIFIED'")+" ORDER BY created_at ASC LIMIT "+MP3_LIMIT;
 const out=await env.DB.prepare(sql).all();
 const header=mp3Intro('Donation queue','Pending cases and verified donors are clearly separated. Tap any donor to see their record.')+
 '<div class="hero-actions" style="margin:4px 0 18px">'+mp3Link(MP3_HOME+'/queue','Pending donors','btn'+(!verified?' soft':''))+mp3Link(MP3_HOME+'/queue?status=verified','Verified donors','btn'+(verified?' soft':''))+'</div>';
 return header+'<div class="section-head"><h2>'+(verified?'Verified donors':'Pending verification')+'</h2><span>Oldest first · Up to '+MP3_LIMIT+'</span></div>'+mp3DonorTable(out.results||[],'No donors in this queue.')+
 '<div class="card"><p class="help">To change a status or assign a team member, open the existing Donor Desk.</p>'+mp3Link('/app/workspace/desk','Open donor editing','btn soft')+'</div>';
}
async function mp3Couriers(env,params){
 const text=String(params.get('q')||'').trim().slice(0,55);
 let sql="SELECT d.id,d.full_name,d.registration_id,c.carrier,c.awb,c.status,c.dispatch_date FROM mcq_donor_couriers c JOIN donors d ON d.id=c.donor_id";
 if(text)sql+=" WHERE d.full_name LIKE ? OR d.registration_id LIKE ? OR c.awb LIKE ?";
 sql+=" ORDER BY c.updated_at DESC LIMIT 100";
 const pattern='%'+text+'%';
 const rows=await (text?env.DB.prepare(sql).bind(pattern,pattern,pattern).all():env.DB.prepare(sql).all());
 const table=(rows.results||[]).length?'<div class="table-wrap"><table><thead><tr><th>Donor</th><th>Courier</th><th>Tracking number</th><th>Status</th><th>Open</th></tr></thead><tbody>'+
 (rows.results||[]).map(r=>'<tr><td><strong>'+MP3_ESC(r.full_name)+'</strong><small>'+MP3_ESC(r.registration_id||'No official ID')+'</small></td><td>'+MP3_ESC(r.carrier||'Not specified')+'</td><td>'+MP3_ESC(r.awb||'—')+'</td><td><span class="pill neutral">'+MP3_ESC(r.status||'Recorded')+'</span></td><td>'+mp3Link(MP3_HOME+'/donor/'+encodeURIComponent(r.id),'Details','textlink')+'</td></tr>').join('')+
 '</tbody></table></div>':'<div class="message">No matching courier records.</div>';
 return mp3Intro('Courier tracking','See the courier details already recorded by your team. Status is not claimed to be live unless officially verified.')+
 '<form class="search-form" method="GET" action="'+MP3_HOME+'/couriers"><label>Donor name, registration number or AWB<input type="search" name="q" value="'+MP3_ESC(text)+'" maxlength="55" placeholder="Search recorded courier" enterkeyhint="search"></label><button type="submit" class="btn soft">🔍 Search</button></form>'+
 '<div class="section-head"><h2>Courier records</h2><span>Latest 100 saved records</span></div>'+table+
 '<div class="card"><p class="help">To edit or add a courier, open the existing donor record. For certificate tracking synchronization use the original certificate courier bridge.</p>'+mp3Link('/app/workspace/desk','✎ Update donor courier','btn soft')+' '+mp3Link('/app/courier-certificate-sync','⇆ Certificate courier sync','btn soft')+'</div>';
}
async function mp3DonorDetails(env,id){
 const row=await env.DB.prepare('SELECT id,full_name,registration_id,city,hair_length,followup_status,verification_status,assigned_to,created_at FROM donors WHERE id=? LIMIT 1').bind(id).first();
 if(!row)return mp3Intro('Donor not found','This registration is not available.')+mp3Link(MP3_HOME+'/donors','← Back to donors','btn soft');
 const hair=await env.DB.prepare('SELECT stage,holder_kind,holder_id,weight_grams,braids,length_cm FROM mcst_lots WHERE donor_id=?').bind(id).first();
 const items=[['Official registration',row.registration_id||'Awaiting official registration'],['City',row.city||'Not recorded'],['Hair length',row.hair_length||'Not recorded'],['Assigned to',row.assigned_to||'Not allocated'],['Follow-up',row.followup_status||'Pending'],['Verification',row.verification_status||'Not verified']];
 const details='<div class="feature-grid">'+items.map(([k,v])=>'<div class="stat"><small>'+MP3_ESC(k)+'</small><strong style="font-size:16px;margin-top:7px;overflow-wrap:anywhere">'+MP3_ESC(v)+'</strong></div>').join('')+'</div>';
 const custody=hair?'<div class="card"><h2>Recorded hair custody</h2><p class="help">Stock status: <b>'+MP3_ESC(hair.stage)+'</b>. Location type: <b>'+MP3_ESC(hair.holder_kind)+'</b>. Recorded weight: <b>'+(hair.weight_grams==null?'Not weighed':MP3_ESC(hair.weight_grams)+' grams')+'</b>. Packages: <b>'+MP3_ESC(hair.braids)+'</b>.</p>'+mp3Link('/hair-stock','📦 Open Hair Stock','btn soft')+'</div>':'<div class="card"><h2>Hair custody</h2><p class="help">No Hair Stock package has been recorded for this donor in the new inventory ledger.</p></div>';
 return mp3Intro(row.full_name,'Read-only donor summary. Use Donor Desk when you need to edit, verify, attach photographs or issue a certificate.')+details+custody+
 '<div class="card"><h2>What would you like to do?</h2><div class="hero-actions">'+mp3Link('/app/workspace/desk','✎ Edit donor in Donor Desk','btn soft')+mp3Link(MP3_HOME+'/donors','← Back to donor list','btn')+'</div></div>';
}
function mp3All(params){
 const text=String(params.get('find')||'').trim().slice(0,60);
 const groups=mp3Groups(text);
 return mp3Intro('All features','Every existing tool has a clear name and a direct link. You can find what you need without hunting through menus.')+
 '<form class="search-form" method="GET" action="'+MP3_HOME+'/all"><label>Find a feature<input type="search" name="find" value="'+MP3_ESC(text)+'" maxlength="60" placeholder="Try hair, donor, wig, certificate…" enterkeyhint="search"></label><button class="btn soft" type="submit">🔍 Find</button></form>'+
 '<p class="directory-search-note">'+groups.found+' tools found. Every option below is a normal clickable link.</p><div class="feature-grid" id="features">'+groups.html+'</div>'+
 '<div class="card"><h2>Keep the original app available</h2><p class="help">The previous Donor Desk is unchanged while this premium interface is being checked. You can return at any time.</p>'+mp3Link('/app','↩ Open original Donor Desk','btn soft')+'</div>';
}
const MP3_PREVIOUS_FETCH=launch_wig_maker_portal_worker_default.fetch;
launch_wig_maker_portal_worker_default.fetch=async function(req,env,ctx){
 const url=new URL(req.url),path=url.pathname;
 if(path!==MP3_HOME&&!path.startsWith(MP3_HOME+'/'))return MP3_PREVIOUS_FETCH.call(this,req,env,ctx);
 if(req.method!=='GET')return new Response('Method not permitted',{status:405,headers:{'cache-control':'no-store'}});
 let admin;
 try{admin=await currentUser(req,env.DB)}
 catch(e){return new Response('Sign-in verification temporarily unavailable',{status:503,headers:{'cache-control':'no-store'}})}
 if(!admin)return new Response(null,{status:302,headers:{'location':'/app','cache-control':'no-store','referrer-policy':'no-referrer'}});
 if(admin.role!=='admin')return new Response('Administrator access required',{status:403,headers:{'cache-control':'no-store'}});
 try{
  let content,current='home',title='Admin Home';
  if(path===MP3_HOME)content=await mp3Home(env,admin);
  else if(path===MP3_HOME+'/donors'){content=await mp3Donors(env,url.searchParams);current='donors';title='Donor Records'}
  else if(path===MP3_HOME+'/queue'){content=await mp3Queue(env,url.searchParams);current='queue';title='Donation Queue'}
  else if(path===MP3_HOME+'/couriers'){content=await mp3Couriers(env,url.searchParams);current='couriers';title='Courier Tracking'}
  else if(path===MP3_HOME+'/all'){content=mp3All(url.searchParams);current='all';title='All Features'}
  else {
   const match=new RegExp('^'+MP3_HOME+'/donor/([0-9a-f-]{36})$','i').exec(path);
   if(!match||!MP3_ID.test(match[1]))return new Response('Not found',{status:404,headers:{'cache-control':'no-store'}});
   content=await mp3DonorDetails(env,match[1]);current='donor';title='Donor Details';
  }
  return mp3SafePage(mp3Layout(admin,current,content,title));
 }catch(e){console.error('MP3_SAFE_ADMIN_HOME',String(e?.name||'Error'));
  return mp3SafePage(mp3Layout(admin,'home',mp3Intro('Unable to load this section','Your original Donor Desk and hair inventory are still available.')+
    '<div class="card"><p class="help">A temporary data error occurred. No donor information was changed.</p>'+
    mp3Link('/app','Open original Donor Desk','btn soft')+' '+mp3Link(MP3_HOME+'/all','Browse tools','btn soft')+'</div>','Unavailable section'))}
};
/* MCCT_ADMIN_NATIVE_HOME_V3_20261116 */
