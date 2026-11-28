/* MCCT_PHOTO_WHATSAPP_FIX_20261118
 * UI/render only. No changes to donor, photo, certificate, Sheet or outbox data.
 * Official registration photographs use registration ID + front/back.
 * Separately uploaded before/after photos use internal donor UUID.
 */
const MCCT_FIX18_PREV_MESSAGE=mcFreeWhatsAppMessage;
mcFreeWhatsAppMessage=function(donor){
 const result=MCCT_FIX18_PREV_MESSAGE(donor);
 if(!result.reason){
  // Direct browser navigation works across desktop Web WhatsApp and supported mobile clients.
  try{
   const prior=new URL(result.url);
   if(prior.hostname==='wa.me'){
    const phone=prior.pathname.replace(/^\/+/,'');
    const message=prior.searchParams.get('text');
    if(/^\d{8,15}$/.test(phone)&&message)
     return {...result,url:'https://api.whatsapp.com/send?phone='+phone+'&text='+encodeURIComponent(message)};
   }
  }catch(_){}
  return result;
 }
 if(result.reason!=='Waiting for the digital certificate link.' &&
    result.reason!=='A valid HTTPS certificate link is required.')return result;
 const clean=v=>String(v??'').trim();
 if(clean(donor.verification_status).toUpperCase()!=='VERIFIED')return result;
 const name=clean(donor.full_name),id=clean(donor.registration_id);
 if(!name||!id)return {reason:'Official donor name and registration number are required.'};
 let phone=clean(donor.phone).replace(/[\s().-]/g,'');
 if(/^[6-9]\d{9}$/.test(phone))phone='91'+phone;
 else if(phone.startsWith('+'))phone=phone.slice(1);
 else if(phone.startsWith('00'))phone=phone.slice(2);
 else if(!/^91[6-9]\d{9}$/.test(phone))return {reason:'Check the donor WhatsApp number before sending.'};
 if(!/^[1-9]\d{7,14}$/.test(phone))return {reason:'Check the donor WhatsApp number before sending.'};
 const hardCopyUrl=HARD_COPY_URL+'?registration_id='+encodeURIComponent(id);
 const lines=['Dear '+name+',','','Thank you for supporting cancer patients by donating your hair through Mamta Care Charitable Trust. Your hair donation has been verified.','','*Registration ID: '+id+'*'];
 if(clean(donor.city))lines.push('City: '+clean(donor.city));
 lines.push('','*Digital certificate:* The download link is not yet recorded. We will share it separately once issued.','',
 'For hard-copy certificate information, please use the official request page:',hardCopyUrl,'',
 'With gratitude,','Mamta Care Charitable Trust');
 const message=lines.join('\n');
 return {message,url:'https://api.whatsapp.com/send?phone='+phone+'&text='+encodeURIComponent(message),hardCopyUrl,certificatePending:true};
};
const MCCT_FIX18_PREV_CARD=mcFreeWhatsAppCard;
mcFreeWhatsAppCard=function(donor){
 const result=mcFreeWhatsAppMessage(donor);
 let html=MCCT_FIX18_PREV_CARD(donor);
 if(!result.reason){
  // Use same-tab navigation so installed PWAs and browsers do not block a new tab.
  html=html.replace(/(href="https:\/\/api\.whatsapp\.com\/send\?[^"]+") target="_blank"/,'$1 target="_self"');
  try{
   const u=new URL(result.url),phone=u.searchParams.get('phone'),message=u.searchParams.get('text');
   if(/^\d{8,15}$/.test(phone||'')&&message){
    const web='https://web.whatsapp.com/send?phone='+phone+'&text='+encodeURIComponent(message);
    const secondary='<a class="btn soft" href="'+MP3_ESC(web)+'" target="_blank" rel="noopener noreferrer" referrerpolicy="no-referrer" style="display:inline-block;margin:10px 0 0 10px">Use WhatsApp Web</a>';
    html=html.replace('</section>',secondary+'</section>');
   }
  }catch(_){}
 }
 if(result.certificatePending){
   html=html.replace('<h2>Certificate message</h2>','<h2>Verified donation message</h2><p class="help" role="status">The official response currently has no digital certificate URL. WhatsApp will open with an accurate verification message; it will not claim a certificate download is available.</p>');
   const id=String(donor?.registration_id||'').trim();
   if(id){
    const direct=HARD_COPY_URL+'?registration_id='+encodeURIComponent(id);
    html=html.replace('</section>','<a class="mcct-hardcopy" href="'+MP3_ESC(direct)+'" target="_blank" rel="noopener noreferrer" referrerpolicy="no-referrer">Open hard-copy request</a><p class="help">The digital PDF is not recorded yet. Confirm certificate issuance before completing any hard-copy payment.</p></section>');
   }
 }
 return html;
};
const MCCT_FIX18_PREV_DONOR=mp3DonorDetails;
mp3DonorDetails=async function(env,id){
 let html=await MCCT_FIX18_PREV_DONOR(env,id);
 const marker='<section class="mcct-photo-panel">';
 const begin=html.indexOf(marker);
 if(begin<0)return html;
 const end=html.indexOf('</section>',begin);
 if(end<0)return html;
 let reg='';
 try{
  const d=await env.DB.prepare('SELECT registration_id FROM donors WHERE id=? LIMIT 1').bind(id).first();
  reg=String(d?.registration_id||'').trim();
 }catch(_){return html;}
 let pics={front:0,back:0,before:0,after:0};
 try{
  // Registration photos are keyed by official ID, never the internal UUID.
  const row=await env.DB.prepare(
   "SELECT EXISTS(SELECT 1 FROM website_hair_photos WHERE donor_id=? AND side='front') AS front,"+
   " EXISTS(SELECT 1 FROM website_hair_photos WHERE donor_id=? AND side='back') AS back,"+
   " EXISTS(SELECT 1 FROM mcx_before_photos WHERE donor_id=?) AS before,"+
   " EXISTS(SELECT 1 FROM mcx_after_photos WHERE donor_id=?) AS after"
  ).bind(reg,reg,id,id).first();
  pics=row||pics;
 }catch(_){return html;}
 const base='/api/donors/'+encodeURIComponent(id)+'/';
 const parts=[
  ['front','At registration · Front hair',base+'website-photo/front'],
  ['back','At registration · Back hair',base+'website-photo/back'],
  ['before','Before haircut · Additional photo',base+'before-photo'],
  ['after','After haircut · Collected photo',base+'after-photo']
 ];
 const cards=parts.filter(([side])=>!!pics[side]).map(([side,label,path])=>
  '<a class="mcct-photo-box" href="'+path+'" target="_self"><strong>'+MP3_ESC(label)+'</strong><img src="'+path+'" loading="eager" decoding="async" alt="'+MP3_ESC(label)+' private donor photograph"><span style="display:block;padding:0 12px 11px;color:#6c4c5c;font-size:12px">Open full photograph</span></a>'
 ).join('');
 const finalCards=cards||'<p class="mcct-photo-empty">There are no linked registration or follow-up photographs for this donor yet. Please check the original Donor Desk.</p>';
 const extra=!pics.after?'<p class="mcct-photo-help">An after-haircut photograph has not been linked to this donor yet. Registration photos should not be mistaken for after-haircut evidence.</p>':'';
 const panel='<section class="mcct-photo-panel"><h2>Hair donation photographs</h2><p class="mcct-photo-help">Original registration photos and separately collected before/after haircut photos. Tap an image for full size.</p><div class="mcct-photo-grid">'+finalCards+'</div>'+extra+'</section>';
 return html.slice(0,begin)+panel+html.slice(end+'</section>'.length);
};
/* End MCCT_PHOTO_WHATSAPP_FIX_20261118 */
