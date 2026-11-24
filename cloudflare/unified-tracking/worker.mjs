const WEBSITE = 'https://mamta-care-website.vercel.app';
const DESK = 'https://mamta-donor-desk-launch-new.bharathairseva-in.workers.dev';
export default {
  async fetch(request, env) {
    const response = (body, status = 200) => Response.json(body,{status,headers:{
      'Access-Control-Allow-Origin': WEBSITE, 'Access-Control-Allow-Methods':'POST, OPTIONS',
      'Access-Control-Allow-Headers':'Content-Type, X-Mamta-Public', 'Cache-Control':'no-store','Vary':'Origin'
    }});
    if(new URL(request.url).pathname !== '/lookup') return response({},404);
    if(request.headers.get('Origin') !== WEBSITE) return response({},403);
    if(request.method === 'OPTIONS') return response({});
    if(request.method !== 'POST' || request.headers.get('X-Mamta-Public')!=='1' || !request.headers.get('Content-Type')?.startsWith('application/json')) return response({},403);
    try {
      const reader=request.body?.getReader();
      if(!reader) return response({},400);
      const chunks=[]; let size=0;
      while(true){const {value,done}=await reader.read(); if(done)break; size+=value.length;
        if(size>8192){await reader.cancel();return response({},413);} chunks.push(value);}
      let input;try{input=JSON.parse(await new Blob(chunks).text())}catch{return response({},400)}
      const id=String(input?.registration_id||'').trim().toUpperCase();
      const last4=String(input?.phone_last4||'');
      const token=String(input?.cf_turnstile_response||'');
      if(!/^[A-Z0-9][A-Z0-9/_-]{5,74}$/.test(id)||!/^\d{4}$/.test(last4)||!token||token.length>3000) return response({error:'Check your registration ID, mobile digits and security verification.'},400);
      const headers={'Content-Type':'application/json','Origin':DESK,'X-Mamta-Public':'1'};
      const ip=request.headers.get('CF-Connecting-IP');if(ip) headers['CF-Connecting-IP']=ip;
      const upstream=await env.DESK.fetch(DESK+'/api/public/hair-tracking',{method:'POST',headers,body:JSON.stringify({registration_id:id,phone_last4:last4,cf_turnstile_response:token})});
      const current=await upstream.json();
      const noMatch=upstream.status===404 && /^No matching record was verified\./.test(String(current.error||''));
      if(!noMatch && (!upstream.ok || current.ok!==true)){
        const message=upstream.status===429?'Too many attempts. Please try again later.':upstream.status===403?'Complete the security check again.':'Tracking is temporarily unavailable. Please try again.';
        return response({error:message},upstream.status>=400?upstream.status:503);
      }
      const missing=()=>response({error:'No matching record was verified. Check your registration ID and the last four digits of your registered mobile number.'},404);
      if(noMatch){
        // An ambiguous or conflicting current identity always takes precedence.
        const collision=await env.DB.prepare('SELECT 1 FROM donors WHERE UPPER(TRIM(registration_id))=? LIMIT 1').bind(id).first();
        if(collision)return missing();
      }
      const closed=!noMatch && current.phase==='closed';
      const archived=closed?null:await env.DB.prepare('SELECT h.timeline,c.details FROM mc_public_historical_tracking h LEFT JOIN mc_tracking_certificate_view c ON c.registration_id=h.registration_id WHERE h.registration_id=? AND h.phone_last4=?').bind(id,last4).first();
      if(noMatch && !archived)return missing();
      const history=archived?JSON.parse(archived.timeline):[];
      let latest = history.at(-1) || (!noMatch ? current.phase_label : 'Registration recorded. Awaiting a hair movement update.');
      if (!noMatch && (closed || (['received','fabrication'].includes(current.phase) && history.every(label=>/^(Hair received by Mamta Care|Hair in transit)$/.test(label))))) latest=current.phase_label;
      return response({ok:true,registration_id:id,certificate:archived?.details?JSON.parse(archived.details):null,history,current:noMatch?null:{status:current.application_status,phase:current.phase,label:current.phase_label},latest});
    } catch {return response({error:'Tracking is temporarily unavailable. Please try again.'},503);}
  }
};