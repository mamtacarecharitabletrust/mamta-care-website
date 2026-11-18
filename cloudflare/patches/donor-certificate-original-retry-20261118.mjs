/* MCCT_CERTIFICATE_RECOVERY_20261118
 * Administrator-only recovery of the ORIGINAL Apps Script certificate generator.
 * Does not create a PDF, generate an ID, or send email in Cloudflare.
 * Retries only verified + Completed official donors with NO PDF link.
 * Existing Apps Script desk_verify->generateCertificate remains authoritative.
 * Existing D1 verification sync, audits, R2, cron and Sheet bindings unchanged.
 */
const MCCT_CERT_RETRY_PREVIOUS_FETCH=launch_wig_maker_portal_worker_default.fetch;
launch_wig_maker_portal_worker_default.fetch=async function(req,env,ctx){
 const url=new URL(req.url);
 if(url.pathname!=='/api/admin/retry-original-certificate')
  return MCCT_CERT_RETRY_PREVIOUS_FETCH.call(this,req,env,ctx);
 if(req.method!=='POST')return error('Method not permitted',405);
 if(!allowedWrite(req))return error('Invalid request origin or token',403);
 let actor;
 try{actor=await currentUser(req,env.DB)}catch(_){return error('Session verification unavailable',503)}
 if(!actor)return error('Please sign in as Administrator',401);
 if(actor.role!=='admin')return error('Administrator only',403);
 let payload;
 try{payload=await body(req)}catch(_){return error('Invalid request',400)}
 const id=String(payload?.id||'').trim();
 if(!uuidReg.test(id))return error('Invalid donor identifier',400);
 const donor=await getDonor(env.DB,id);
 if(!donor)return error('Donor not found',404);
 if(donor.source!=='google_sheet'||!donor.registration_id||
     donor.followup_status!=='Completed'||
     String(donor.verification_status||'').trim().toUpperCase()!=='VERIFIED')
   return error('Original certificate recovery requires an already verified, completed Google Sheet donor',409);
 if(String(donor.certificate_url||'').trim())
   return json({ok:true,already_issued:true,message:'The official certificate link is already recorded. No retry was made.'});
 if(!Number.isSafeInteger(payload.version)||payload.version!==donor.version)
   return error('Donor record changed. Refresh before retrying.',409);
 if(!env.SOCIAL_BRIDGE_URL||String(env.MC_DESK_SHARED_SECRET||'').length<48)
   return error('Original Google verification bridge not configured',503);
 let uri;
 try{
  uri=new URL(env.SOCIAL_BRIDGE_URL);
  if(uri.protocol!=='https:'||uri.hostname!=='script.google.com'||!/^\/macros\/s\/[^/]+\/exec$/.test(uri.pathname))throw Error('Untrusted URL');
 }catch(_){return error('Original verification bridge URL not approved',503)}
 let result;
 try{
  const response=await fetch(uri.toString(),{
   method:'POST',headers:{'Content-Type':'application/json'},
   body:JSON.stringify({action:'desk_verify',secret:env.MC_DESK_SHARED_SECRET,registration_id:donor.registration_id}),
   redirect:'follow'
  });
  if(!response.ok)return error('Existing Google Apps Script is unavailable',502);
  const raw=await response.text();
  if(raw.length>6000)return error('Unexpected Google Apps Script response',502);
  result=JSON.parse(raw);
 }catch(e){return error('Could not reach the original certificate generator; nothing was marked as issued',502)}
 if(result?.ok!==true||result?.verified!==true)
  return error('Existing Apps Script did not confirm verification. Review its Executions log.',409);
 if(String(result.donor?.registration_id||'').trim().toUpperCase()!==String(donor.registration_id).trim().toUpperCase()||
    String(result.donor?.verification_status||'').trim().toUpperCase()!=='VERIFIED')
  return error('Google Apps Script registration/status mismatch; no local update made',409);
 const urlText=String(result.donor?.certificate_url||'').trim();
 if(!urlText)
  return error('Google Sheet is VERIFIED, but the original certificate generator reported needs_retry. Check Apps Script > Executions for the specific error; no certificate was reported as issued.',409);
 let certURL;
 try{
  certURL=new URL(urlText);
  if(certURL.protocol!=='https:'||certURL.username||certURL.password||urlText.length>600)
   throw Error('Not a valid official link');
 }catch(_){return error('Existing generator returned an invalid certificate URL; no local update made',502)}
 const sheetState=String(result.donor.certificate_email_status||'').trim();
 // Preserve the original Google Sheet -> Donor Desk sync action and audit.
 const request=new Request(url.href,{
  method:'POST',headers:{'Content-Type':'application/json'},
  body:JSON.stringify({secret:env.MC_DESK_SHARED_SECRET,rows:[{
   registration_id:donor.registration_id,verification_status:'VERIFIED',
   certificate_url:certURL.href,certificate_email_status:sheetState
  }]})
 });
 let synced;
 try{synced=await (await mcDeskImportVerification(env,request)).json()}catch(_){}
 if(synced?.ok!==true)
  return error('Google certificate was issued but Donor Desk synchronization requires review. Do not retry issuance; check Column O.',502);
 return json({ok:true,certificate_processing:result.certificate_processing||'unknown',
  certificate_email_status:sheetState||'NOT_RECORDED',
  message:result.certificate_processing==='completed'
    ? 'Original Google certificate was issued and the Donor Desk synchronized.'
    : 'Official PDF link was recorded and synchronized, but email completion was not confirmed. Check Apps Script Executions; do not retry issuance blindly.'});
};

/* Original classic Donor Desk verification, augmented with the smallest
 * safe recovery affordance only after Google Sheet verification already succeeded. */
const MCCT_CERT_RECOVERY_UI=String.raw`
(function(){
 const oldOpen=openDonor;
 openDonor=async function(id){
  await oldOpen(id);
  if(!selected||selected.id!==id||!me||me.role!=='admin')return;
  const d=selected;
  if(d.source!=='google_sheet'||d.followup_status!=='Completed'||
    String(d.verification_status||'').trim().toUpperCase()!=='VERIFIED'||
    String(d.certificate_url||'').trim())return;
  const details=document.getElementById('details');
  if(!details||details.querySelector('[data-mcct-cert-retry]'))return;
  const section=document.createElement('section');
  section.className='mc-verify-panel';
  section.dataset.mcctCertRetry='yes';
  const heading=document.createElement('b');heading.textContent='Original certificate processing needs attention';
  const desc=document.createElement('p');desc.className='muted';
  desc.textContent='Google Sheets verification is recorded, but Column O has no digital certificate URL. Use the original Google Apps Script generator; no separate certificate or email workflow is created.';
  const btn=document.createElement('button');btn.type='button';btn.textContent='Retry existing certificate process';
  const result=document.createElement('p');result.className='notice';result.setAttribute('role','status');
  section.append(heading,desc,btn,result);
  const form=details.querySelector('#editForm');
  if(form)form.after(section);else details.append(section);
  btn.onclick=async()=>{
   if(!confirm('Retry the original Google Apps Script certificate process for this verified donor? If successful, it may send the existing certificate email once.'))return;
   btn.disabled=true;
   result.textContent='Requesting the original certificate generator...';
   try{
    const response=await api('/admin/retry-original-certificate',{
     method:'POST',body:JSON.stringify({id:d.id,version:d.version})
    });
    result.textContent=response.message||'Certificate status updated.';
    await loadDonors();
    await openDonor(id);
   }catch(e){
    result.textContent='The certificate was NOT confirmed: '+String(e.message||e);
    btn.disabled=false;
   }
  };
 };
})();
`;
PAGE=PAGE.replace('</script>',MCCT_CERT_RECOVERY_UI+'</script>');
const MCCT_PREV_RECOVERY_PREMIUM=mp3DonorDetails;
mp3DonorDetails=async function(env,id){
 const html=await MCCT_PREV_RECOVERY_PREMIUM(env,id);
 let donor;
 try{donor=await env.DB.prepare('SELECT verification_status,certificate_url,followup_status FROM donors WHERE id=? LIMIT 1').bind(id).first()}catch(_){return html}
 if(!donor||String(donor.verification_status||'').trim().toUpperCase()!=='VERIFIED'||
   String(donor.certificate_url||'').trim()||donor.followup_status!=='Completed')return html;
 const notice='<div class="card" role="status"><h2>Certificate is awaiting generation</h2><p class="help">Google Sheet verification is recorded, but no official PDF is linked. The original certificate generator can be retried by an Administrator from the classic Donor Desk. No duplicate certificate system is used.</p>'+mp3Link('/app?classic=1','Open original Donor Desk for safe retry','btn soft')+'</div>';
 return html.replace('<div class="feature-grid">',notice+'<div class="feature-grid">');
};
/* End MCCT_CERTIFICATE_RECOVERY_20261118 */
