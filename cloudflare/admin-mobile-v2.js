/* Mamta Care Admin Command Center V2. Client-only navigation enhancement.
 * No donor data, passwords, stock values, or session tokens are stored or fetched.
 * All existing navigation buttons remain in the original #navs container. */
(function(){
 'use strict';
 if(typeof MC_ROLE==='undefined'||MC_ROLE!=='admin'||document.body.classList.contains('mcux-admin'))return;
 const $=(selector,root=document)=>root.querySelector(selector);
 const nav=$('#navs'),main=$('#main'),top=$('.top'),rail=$('.rail');
 if(!nav||!main||!top||!rail)return;
 document.body.classList.add('mcux-admin');
 const catalog=[
  {id:'dashboard',name:'Home',hint:'Overview and daily work',icon:'⌂',group:'Daily work',view:'dashboard',keywords:'main home start reports overview'},
  {id:'desk',name:'Donor records',hint:'Search, update and verify donors',icon:'👥',group:'Daily work',view:'desk',keywords:'donor registration verify certificate complete donor desk'},
  {id:'queue',name:'Donation queue',hint:'Pending and completed registrations',icon:'☷',group:'Daily work',view:'queue',keywords:'pending allocation first come'},
  {id:'stock',name:'Hair Stock & approvals',hint:'Where the hair is and who has it',icon:'📦',group:'Daily work',href:'/hair-stock',keywords:'hair collected by me stock inventory transfer approve weigh weight braid ponytail wig maker'},
  {id:'hand',name:'Hand collections',hint:'Staff and volunteer pickups',icon:'🤝',group:'Daily work',href:'/app/hand-collections',keywords:'hair collected by me hand pick up receive'},
  {id:'courier',name:'Courier tracking',hint:'Tracking numbers and consignments',icon:'🚚',group:'Daily work',view:'courier',keywords:'awb dispatch parcels courier tracking'},
  {id:'receipts',name:'Parcel receiving',hint:'Record arrived hair packages',icon:'▤',group:'Daily work',href:'/app/receipts',keywords:'received at center barcode scan parcels'},
  {id:'people',name:'Staff & volunteers',hint:'Accounts, permissions and IDs',icon:'🪪',group:'People & partners',view:'people',keywords:'staff volunteer team access permission id cards'},
  {id:'referrals',name:'Volunteer referrals',hint:'Review people who want to join',icon:'🙋',group:'People & partners',view:'referrals',keywords:'recruit applicant candidate referrals'},
  {id:'partners',name:'Salons & collaborations',hint:'Salon, hospital and partner records',icon:'🏪',group:'People & partners',view:'partners',keywords:'salon collaboration hospitals partner agreements'},
  {id:'hospital',name:'Hospital requests',hint:'Hospitals and free wig requests',icon:'🏥',group:'People & partners',view:'hospital',keywords:'cancer free wigs hospitals'},
  {id:'wig',name:'Wig inventory',hint:'Requests, wigs and fabrication',icon:'✂',group:'Wigs & certificates',view:'wig',keywords:'wig maker orders manufacturing stock'},
  {id:'maker',name:'Wig Maker portal',hint:'Separate authorized maker sign-in',icon:'🧵',group:'Wigs & certificates',href:'/maker',keywords:'fabricator hair stock wig maker login'},
  {id:'print',name:'Certificate Print Studio',hint:'Certificates and printing',icon:'🖨',group:'Wigs & certificates',href:'/app/print-studio',keywords:'certificate stickers labels hard copy 12 18 print qr'},
  {id:'photos',name:'Donor photographs',hint:'Existing donor photo records',icon:'▧',group:'Records & controls',view:'photos',keywords:'images picture front back uploaded'},
  {id:'review',name:'Older photo records',hint:'Legacy photo and sync cases',icon:'🔍',group:'Records & controls',view:'review',keywords:'photo review reconciled'},
  {id:'sync',name:'Registration synchronization',hint:'Official donor IDs and photo association',icon:'↻',group:'Records & controls',href:'/admin-registration-sync',keywords:'form spreadsheet sheets import official ID pending registration'},
  {id:'courier-sync',name:'Certificate courier sync',hint:'Check courier-to-certificate updates',icon:'⇆',group:'Records & controls',href:'/app/courier-certificate-sync',keywords:'awb database google sheet certificate'},
  {id:'ops',name:'Administrator operations',hint:'Operations and pending integrations',icon:'⚙',group:'Records & controls',href:'/admin-ops',keywords:'admin dashboard system operations health'},
  {id:'website',name:'Website control',hint:'Drives, gallery and announcements',icon:'🌐',group:'Records & controls',view:'website',keywords:'website banners posters counters festivals'}
 ];
 const groups=[
  {name:'Daily work',keys:['dashboard','desk','queue','stock','hand','courier','receipts']},
  {name:'Wigs & certificates',keys:['wig','maker','print']},
  {name:'People & partners',keys:['people','referrals','partners','hospital']},
  {name:'Records & controls',keys:['photos','review','sync','courier-sync','ops','website']}
 ];
 const itemById=new Map(catalog.map(x=>[x.id,x]));
 const iconByView=new Map(catalog.filter(x=>x.view).map(x=>[x.view,x.icon]));
 const old=[...nav.children];
 const navByView=new Map(old.filter(x=>x.dataset&&x.dataset.view).map(x=>[x.dataset.view,x]));
 const stock=old.find(x=>x.matches?.('[data-mcst-link]'))||null;
 const make=(tag,attrs={},label)=>{
  const el=document.createElement(tag);
  Object.entries(attrs).forEach(([k,v])=>{if(k==='class')el.className=v;else if(k.startsWith('data-'))el.setAttribute(k,v);else el.setAttribute(k,v)});
  if(label!==undefined)el.textContent=label;
  return el;
 };
 function addIcon(el,icon){
  if(el.querySelector('.mcux-nav-icon'))return;
  const span=make('span',{class:'mcux-nav-icon','aria-hidden':'true'},icon||'•');
  el.prepend(span);
 }
 const extras=[];
 for(const section of groups){
  const group=make('div',{class:'mcux-nav-group'});
  group.append(make('h2',{},section.name));
  for(const key of section.keys){
   const item=itemById.get(key);
   let el=item?.view?navByView.get(item.view):key==='stock'?stock:null;
   if(!el&&item?.href){
    el=make('a',{class:'nav',href:item.href},item.name);
   }
   if(!el)continue;
   if(item?.view&&el.dataset.view) addIcon(el,item.icon);
   else addIcon(el,item?.icon);
   group.append(el);
  }
  nav.append(group);
 }
 for(const link of old)if(link.parentElement===nav)extras.push(link);
 if(extras.length){
  const group=make('div',{class:'mcux-nav-group'});group.append(make('h2',{},'Other existing tools'));
  for(const el of extras){addIcon(el,'◈');group.append(el)}
  nav.append(group);
 }
 nav.prepend(make('button',{type:'button',class:'mcux-findbar','data-mcux-open':'search','aria-label':'Search all features'},'⌕  Find any feature'));
 const railFooter=$('.railfoot');
 if(railFooter)railFooter.textContent='All original tools are preserved. Search by name or task.';
 const mobileMenu=make('button',{type:'button',class:'mcux-menu-toggle','aria-label':'Open all features','aria-expanded':'false','aria-controls':'navs'},'☰');
 const originalHeading=$('#heading');
 if(originalHeading)top.insertBefore(mobileMenu,originalHeading);
 const logo=make('img',{src:'/volunteer-logo.jpeg',class:'mcux-toplogo',alt:'Mamta Care official logo'});
 if(originalHeading)top.insertBefore(logo,originalHeading);
 const topSearch=make('button',{type:'button',class:'mcux-topsearch','data-mcux-open':'search','aria-label':'Find a feature'});
 topSearch.innerHTML='<span aria-hidden="true">⌕</span> Search tools';
 const headerRight=$('.topright');
 if(headerRight)top.insertBefore(topSearch,headerRight);
 else top.append(topSearch);
 const backdrop=make('div',{class:'mcux-shade',hidden:'','aria-hidden':'true'});
 const bottom=make('nav',{class:'mcux-bottom','aria-label':'Mobile quick navigation'});
 bottom.innerHTML='<button type="button" data-mcux-view="dashboard" aria-label="Home"><span class="mcux-bicon" aria-hidden="true">⌂</span>Home</button>'+
  '<button type="button" data-mcux-view="desk" aria-label="Donor records"><span class="mcux-bicon" aria-hidden="true">👥</span>Donors</button>'+
  '<a href="/hair-stock" aria-label="Hair Stock"><span class="mcux-bicon" aria-hidden="true">📦</span>Stock</a>'+
  '<button type="button" class="mcux-more" aria-label="Open all features" aria-expanded="false"><span class="mcux-bicon" aria-hidden="true">☷</span>More</button>';
 const modal=make('div',{class:'mcux-modal',hidden:'',role:'dialog','aria-modal':'true','aria-label':'Find a Mamta Care feature'});
 modal.innerHTML='<div class="mcux-dialog"><div class="mcux-searchhead"><label class="mcux-sr-only" for="mcux-query">Search features</label><input type="search" id="mcux-query" autocomplete="off" placeholder="Try: donor, hair stock, wigs…" aria-label="Search available features"><button type="button" class="mcux-dismiss" aria-label="Close feature search">✕</button></div><div class="mcux-sresults" id="mcux-results" role="list"></div></div>';
 document.body.append(backdrop,bottom,modal);
 const query=$('#mcux-query'),resultBox=$('#mcux-results');
 let focusReturn=null;
 const hidden=el=>el.setAttribute('hidden','');
 const unhide=el=>el.removeAttribute('hidden');
 function closeDrawer(){
  document.body.classList.remove('mcux-drawer-open');
  mobileMenu.setAttribute('aria-expanded','false');
  $('.mcux-more',bottom)?.setAttribute('aria-expanded','false');
  hidden(backdrop);
 }
 function openDrawer(){
  closeSearch();
  document.body.classList.add('mcux-drawer-open');
  mobileMenu.setAttribute('aria-expanded','true');
  $('.mcux-more',bottom)?.setAttribute('aria-expanded','true');
  unhide(backdrop);
  nav.querySelector('.mcux-findbar')?.focus();
 }
 function closeSearch(){
  if(!modal.hasAttribute('hidden')){hidden(modal);focusReturn?.focus?.()}
 }
 function renderResults(){
  const term=query.value.trim().toLowerCase();
  const matched=term?catalog.filter(item=>(item.name+' '+item.hint+' '+item.group+' '+item.keywords).toLowerCase().includes(term)):catalog;
  const list=matched.slice(0,40);
  resultBox.replaceChildren();
  if(!list.length){resultBox.append(make('p',{class:'mcux-empty'},'No matching tool. Try a simpler word such as hair, donor or wig.'));return}
  const heading=make('div',{class:'mcux-sr-only'},list.length+' available features');resultBox.append(heading);
  for(const item of list){
   const el=make(item.href?'a':'button',{class:'mcux-result',...(item.href?{href:item.href}:{type:'button','data-mcux-view':item.view})});
   const ico=make('span',{class:'mcux-result-ico','aria-hidden':'true'},item.icon);
   const text=make('span',{});
   text.append(make('strong',{},item.name),make('small',{},item.hint));
   el.append(ico,text);resultBox.append(el);
  }
 }
 function openSearch(){
  closeDrawer();focusReturn=document.activeElement;query.value='';renderResults();unhide(modal);query.focus();
 }
 function navigate(view){
  if(!view||!navByView.has(view))return;
  navByView.get(view).click();closeDrawer();closeSearch();setActive(view);
  if(window.matchMedia('(max-width:650px)').matches)main.scrollTo({top:0,behavior:'smooth'});
 }
 function setActive(view){
  for(const b of bottom.querySelectorAll('button[data-mcux-view]'))b.classList.toggle('mcux-current',b.dataset.mcuxView===view);
 }
 function tile(item){
  const el=make(item.href?'a':'button',{class:'mcux-tile','data-tone':['stock','print','receipts'].includes(item.id)?'gold':['queue','courier','wig'].includes(item.id)?'blue':'green',...(item.href?{href:item.href}:{type:'button','data-mcux-view':item.view})});
  el.append(make('span',{class:'mcux-tileico','aria-hidden':'true'},item.icon),make('strong',{},item.name),make('small',{},item.hint));
  return el;
 }
 function makeDirectory(){
  const holder=make('div',{class:'mcux-module-directory'});
  for(const group of groups){
   const block=make('div',{class:'mcux-directory-group'});block.append(make('h3',{},group.name));
   for(const id of group.keys){
    const item=itemById.get(id);if(!item)continue;
    if(item.view&&!navByView.has(item.view))continue;
    const el=make(item.href?'a':'button',{class:'mcux-dir-link',...(item.href?{href:item.href}:{type:'button','data-mcux-view':item.view})});
    el.append(make('span',{class:'mcux-dirico','aria-hidden':'true'},item.icon),make('span',{},item.name));block.append(el);
   }
   holder.append(block);
  }
  return holder;
 }
 function greeting(){
  const h=new Date().getHours();
  return h<12?'Good morning':h<17?'Good afternoon':'Good evening';
 }
 function renderHome(){
  if(($('#heading')?.textContent||'').trim()!=='Overview')return;
  const pane=$('#main>.pane');if(!pane||pane.querySelector('#mcux-home'))return;
  const oldHeading=pane.querySelector('.h1');
  if(!oldHeading||!oldHeading.textContent.includes('One connected NGO workspace'))return;
  oldHeading.classList.add('mcux-old-dashboard');
  const oldIntro=oldHeading.nextElementSibling;
  if(oldIntro?.classList.contains('muted'))oldIntro.classList.add('mcux-old-dashboard');
  const previousLinks=[...pane.querySelectorAll('.card')].find(x=>x.querySelector('h2')?.textContent.trim()==='Your workspaces');
  if(previousLinks)previousLinks.classList.add('mcux-old-dashboard');
  const home=make('section',{class:'mcux-home',id:'mcux-home','aria-label':'Administrator home dashboard'});
  const hero=make('div',{class:'mcux-hero'});
  hero.innerHTML='<span class="mcux-eyebrow">Mamta Care · Admin command center</span><h1></h1><p>All your donor, hair stock, wig and team tools in one place. Choose an action below, or search for anything.</p><button type="button" class="mcux-hero-search" data-mcux-open="search">⌕ Find any option</button>';
  hero.querySelector('h1').textContent=greeting()+'. What would you like to do?';
  home.append(hero);
  const head=make('div',{class:'mcux-sectionhead'});head.append(make('h2',{},'Quick actions'),make('span',{},'One tap to open'));
  home.append(head);
  const shortcuts=make('div',{class:'mcux-shortcuts'});
  for(const id of ['desk','stock','queue','hand','wig','courier','people','print']){const item=itemById.get(id);if(item)shortcuts.append(tile(item))}
  home.append(shortcuts);
  const directory=make('details',{class:'mcux-allfeatures'});
  directory.append(make('summary',{},'☷ Browse every available feature'),makeDirectory());
  home.append(directory);
  const statsHeading=make('div',{class:'mcux-sectionhead'});
  statsHeading.append(make('h2',{},'Current activity'),make('span',{},'Your existing live statistics'));
  home.append(statsHeading);
  pane.prepend(home);
 }
 const observer=new MutationObserver(()=>{requestAnimationFrame(renderHome)});
 observer.observe(main,{childList:true});
 renderHome();
 function requestNavClick(e){
  const view=e.target.closest('[data-mcux-view]');
  if(view){e.preventDefault();navigate(view.dataset.mcuxView);return}
  if(e.target.closest('[data-mcux-open="search"]')){e.preventDefault();openSearch();return}
  if(e.target.closest('.mcux-menu-toggle')||e.target.closest('.mcux-more')){
   e.preventDefault();document.body.classList.contains('mcux-drawer-open')?closeDrawer():openDrawer();return;
  }
  if(e.target.closest('.mcux-dismiss')){closeSearch();return}
  if(e.target.closest('#navs [data-view]')||e.target.closest('#navs a[href]')){closeDrawer();const v=e.target.closest('[data-view]')?.dataset.view;if(v)setActive(v);}
 }
 document.addEventListener('click',requestNavClick);
 query.addEventListener('input',renderResults);
 backdrop.addEventListener('click',closeDrawer);
 modal.addEventListener('click',e=>{if(e.target===modal)closeSearch()});
 document.addEventListener('keydown',e=>{
  if(e.key==='Escape'){closeDrawer();closeSearch();return}
  if(e.key==='/'&&modal.hasAttribute('hidden')&&!['INPUT','TEXTAREA'].includes(document.activeElement?.tagName)){
   e.preventDefault();openSearch();return;
  }
  if(!modal.hasAttribute('hidden')&&e.key==='Tab'){
   const focusables=[...modal.querySelectorAll('input,button,a[href]')].filter(x=>x.getClientRects().length>0);
   if(!focusables.length)return;
   const first=focusables[0],last=focusables[focusables.length-1];
   if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus()}
   else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus()}
  }
 });
 window.addEventListener('popstate',()=>{const params=new URLSearchParams(location.search);setActive(params.get('view')||'dashboard')});
 setActive(new URLSearchParams(location.search).get('view')||'dashboard');
})();
