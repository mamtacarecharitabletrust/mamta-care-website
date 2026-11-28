/**
 * Staged Apps Script PDF rendering action. No sending and no external data access.
 * Integrate with the same authenticated agreement dispatcher.
 * WIG_AGREEMENT_LOGO_FILE_ID must point to the official Trust logo in Drive.
 * Review a synthetic PDF before enabling production.
 */
function mcWigAgreementRenderPost_(p){
 const response=v=>ContentService.createTextOutput(JSON.stringify(v)).setMimeType(ContentService.MimeType.JSON);
 try{
 const properties=PropertiesService.getScriptProperties();
 const secret=String(properties.getProperty('WIG_AGREEMENT_RELAY_SECRET')||''),given=String(p&&p.secret||'');
 if(secret.length<48||secret.length!==given.length)return response({ok:false,error:'Unauthorized'});
 let diff=0;for(let i=0;i<secret.length;i++)diff|=secret.charCodeAt(i)^given.charCodeAt(i);
 if(diff)return response({ok:false,error:'Unauthorized'});
 if(p.action!=='wig_agreement_render')return response({ok:false,error:'Invalid render action'});
 const a=p.agreement||{},name=String(a.patientName||'').trim(),reg=String(a.registrationId||'').trim(),ref=String(a.reference||'').trim();
 if(!name||name.length>150||!reg||reg.length>120||!ref||ref.length>120||a.policyVersion!=='WIG-2026-11-DRAFT-1'||!Number.isSafeInteger(a.deposit)||a.deposit<0||a.deposit>8000||!Number.isSafeInteger(a.expenses)||a.expenses<0||a.expenses>2000||!Number.isSafeInteger(a.createdAt))return response({ok:false,error:'Invalid approved agreement snapshot'});
 const accepted=a.status==='ACCEPTED';
 if(!['DRAFT','ACCEPTED'].includes(a.status)||accepted&&(!a.acceptanceReference||!Number.isSafeInteger(a.acceptedAt)||a.acceptedAt<a.createdAt))return response({ok:false,error:'Invalid acceptance record'});
 const logoId=properties.getProperty('WIG_AGREEMENT_LOGO_FILE_ID');if(!logoId)return response({ok:false,error:'Original Trust logo configuration missing'});
 const logo=DriveApp.getFileById(logoId).getBlob(),mt=logo.getContentType(),lb=logo.getBytes();if(!['image/png','image/jpeg'].includes(mt)||lb.length>500000)return response({ok:false,error:'Original logo must be a small JPEG or PNG'});
 const esc=v=>String(v==null?'':v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const dt=v=>Utilities.formatDate(new Date(v),'Asia/Kolkata','dd MMM yyyy, HH:mm z');
 const rows=[['Patient name',name],['Registration number',reg],['Agreement reference',ref],['Policy version',a.policyVersion],['Prepared on',dt(a.createdAt)],['Wig purchase/manufacturing charge','INR 0'],['Refundable security deposit','INR '+a.deposit],['Processing and logistics expenses','INR '+a.expenses],['Initial amount payable','INR '+(a.deposit+a.expenses)],['Return period','Six calendar months from confirmed delivery']];
 const terms=[
 ['Charitable purpose','The wig is supplied without purchase or manufacturing charge; the verified human-hair specification is confirmed at handover. The security deposit is not a purchase price.'],
 ['Use and care','Do not sell, rent, transfer, cut, colour, chemically treat or heat-style the wig without written permission. Follow the cleaning and storage instructions supplied with it.'],
 ['Return','Return the wig within six calendar months of actual delivery. Contact the Trust to arrange return or request a medical extension.'],
 ['Refund','The refundable deposit is returned following inspection, less reasonable, documented damage beyond ordinary wear. Unused processing expense balances are reconciled. No automatic forfeiture or ownership transfer.'],
 ['Hardship and questions','Ask the Trust about financial hardship, extensions or any terms before accepting. Payment instructions will be sent separately only after verified acceptance.'],
 ['Consent','Acceptance is voluntary. The Trust records the verified electronic consent reference and timestamp. Electronic consent is not described as a certified digital signature.']
 ];
 const acceptance=accepted?'<h2>Verified electronic acceptance</h2><p>Reference: '+esc(a.acceptanceReference)+'</p><p>Accepted on: '+esc(dt(a.acceptedAt))+'</p>':'<h2>Beneficiary acknowledgement</h2><p>Awaiting verified electronic acceptance. Do not pay before payment instructions are issued separately.</p>';
 const html='<!doctype html><html><head><meta charset="UTF-8"><style>@page{size:A4;margin:18mm}body{font:11pt Arial,sans-serif;color:#30292b;line-height:1.45}header{text-align:center;border-bottom:3px solid #70203e;padding-bottom:12px}h1{font-size:19pt;color:#70203e;margin:4px}h2{font-size:13pt;color:#70203e;margin:16px 0 6px}table{width:100%;border-collapse:collapse}td{border-bottom:1px solid #e3d9dd;padding:6px;vertical-align:top}td:first-child{width:43%;font-weight:bold}footer{margin-top:20px;border-top:1px solid #70203e;text-align:center;font-weight:bold;color:#70203e}img{width:88px;height:auto}</style></head><body><header><img src="data:'+mt+';base64,'+Utilities.base64Encode(lb)+'"><h1>MAMTA CARE CHARITABLE TRUST</h1><p>Government Registered NGO | Wig Assistance Department</p></header><h2>Wig Assistance and Refundable Security Deposit Agreement</h2><table>'+rows.map(([k,v])=>'<tr><td>'+esc(k)+'</td><td>'+esc(v)+'</td></tr>').join('')+'</table>'+terms.map(([k,v])=>'<h2>'+esc(k)+'</h2><p>'+esc(v)+'</p>').join('')+acceptance+'<footer>REDUCE · REUSE · RECYCLE</footer></body></html>';
 const pdf=Utilities.newBlob(html,'text/html','wig-agreement.html').getAs('application/pdf').setName('Wig-Assistance-Agreement.pdf');
 const bytes=pdf.getBytes();if(bytes.length<100||bytes.length>5000000)return response({ok:false,error:'PDF rendering failed'});
 const digest=Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,bytes).map(b=>('0'+(b&255).toString(16)).slice(-2)).join('');
 return response({ok:true,reference:ref,pdf_base64:Utilities.base64Encode(bytes),document_digest:digest});
 }catch(e){return response({ok:false,error:'Agreement PDF renderer unavailable'})}
}
