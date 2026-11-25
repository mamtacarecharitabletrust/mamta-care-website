const queue='/app/premium/online-volunteers';
const headers={'Cache-Control':'private,no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'same-origin'};
const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const message=(text,status)=>new Response(text,{status,headers});
export async function onlineVolunteers(req,env,currentUser){
 const url=new URL(req.url);if(url.pathname!==queue)return null;
 const actor=await currentUser(req,env.DB);if(actor?.role!=='admin')return message('Administrator sign-in required',403);
 if(req.method==='POST'){
  if(req.headers.get('origin')!==url.origin)return message('Origin mismatch',403);
  const form=await req.formData(),id=String(form.get('id')),decision=form.get('decision');
  if(!['approved','rejected'].includes(decision)||!/^[-a-f0-9]{36}$/i.test(id))return message('Invalid decision',400);
  const payable=await env.DB.prepare("SELECT r.status,p.amount FROM mca_referrals r LEFT JOIN mc_volunteer_payments p ON p.referral_id=r.id WHERE r.id=? AND r.referrer_type='public_web' AND r.referrer_id='website_volunteer_form'").bind(id).first();
  if(!payable)return message('Application unavailable',404);
  const approving=decision==='approved';if(approving&&(!payable.amount||form.get('bank_match')!=='yes'))return message('A matched payment is required for approval.',400);
  const statements=[env.DB.prepare("UPDATE mca_referrals SET status=?,reviewed_at=unixepoch(),reviewed_by=? WHERE id=? AND status IN ('pending','contacted','accepted_for_review') AND referrer_type='public_web' AND referrer_id='website_volunteer_form'").bind(decision,actor.username,id)];
  if(approving)statements.push(env.DB.prepare('UPDATE mc_volunteer_payments SET verified_by=?,verified_at=unixepoch() WHERE referral_id=? AND changes()=1').bind(actor.username,id));
  const changes=await env.DB.batch(statements);if(!changes[0].meta.changes)return message('Application already reviewed. Reload the list.',409);
  return new Response(null,{status:303,headers:{...headers,Location:queue}});
 }
 if(req.method!=='GET')return message('Method not allowed',405);
 const offset=Number(url.searchParams.get('offset')||0);if(!Number.isSafeInteger(offset)||offset<0)return message('Invalid page',400);
 const {results}=await env.DB.prepare("SELECT r.id,r.name,r.city,r.phone,r.email,r.note,r.status,r.reviewed_by,p.utr,p.amount FROM mca_referrals r LEFT JOIN mc_volunteer_payments p ON p.referral_id=r.id WHERE r.referrer_type='public_web' AND r.referrer_id='website_volunteer_form' ORDER BY (r.status IN ('pending','contacted','accepted_for_review')) DESC,r.created_at DESC,r.id LIMIT 51 OFFSET ?").bind(offset).all();
 const cards=results.slice(0,50).map(r=>{
  const open=['pending','contacted','accepted_for_review'].includes(r.status);
  const actions=open?'<form method="post"><input type="hidden" name="id" value="'+escape(r.id)+'">'+(r.utr?'<label><input type="checkbox" name="bank_match" value="yes" required> I matched the ₹'+escape(r.amount)+' credit and UPI reference to the Trust’s bank record.</label><button name="decision" value="approved">Approve application</button> ':'')+'<button formnovalidate name="decision" value="rejected">Reject application</button></form>':'';
  return '<article><h2>'+escape(r.name)+'</h2><p>'+escape(r.city)+' · '+escape(r.phone)+' '+escape(r.email)+'</p><p>'+escape(r.note)+'</p><p>'+ (r.utr?'Fee ₹'+escape(r.amount)+' · UPI reference <b>'+escape(r.utr)+'</b>':'Earlier application · no payment reference submitted')+'</p><strong>'+escape(r.status)+'</strong> '+escape(r.reviewed_by)+actions+(r.status==='approved'?' <a href="/app/volunteer-onboarding">Open volunteer onboarding</a>':'')+'</article>'
 }).join('');
 const nonce=crypto.randomUUID();return new Response('<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Online volunteers | Mamta Care</title><style nonce="'+nonce+'">body{margin:auto;max-width:48rem;padding:1rem;background:#fffaf6;color:#462438;font:1rem/1.5 system-ui}article{background:white;border:1px solid #e2cfd6;border-radius:12px;margin:1rem 0;padding:1rem}h2,p{margin:.4rem 0}label{display:block;margin:.8rem 0}button{padding:.7rem 1rem;cursor:pointer}a{color:#762542}</style><main><a href="/app/premium/team-directory?group=volunteers">← Team</a><h1>Online volunteers</h1>'+ (cards||'<p>No online applications yet.</p>')+(offset?'<a href="?offset='+Math.max(0,offset-50)+'">Previous</a> ':'')+(results.length>50?'<a href="?offset='+(offset+50)+'">Next</a>':'')+'</main></html>',{headers:{...headers,'Content-Type':'text/html; charset=utf-8','Content-Security-Policy':"default-src 'none'; form-action 'self'; style-src 'nonce-"+nonce+"'; frame-ancestors 'none'; base-uri 'none'"}});
}