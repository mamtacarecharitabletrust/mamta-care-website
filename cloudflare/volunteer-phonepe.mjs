const base='/volunteer-checkout';
const origin='https://api.phonepe.com/apis/';
const fee=99900;
const cache={'Cache-Control':'private,no-store','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff'};
const json=(data,status=200)=>Response.json(data,{status,headers:cache});
export const enabled=e=>Boolean(e.PHONEPE_CLIENT_ID&&e.PHONEPE_CLIENT_SECRET&&e.PHONEPE_CLIENT_VERSION);
const token=req=>req.headers.get('cookie')?.match(/(?:^|; *)__Host-mc_vol_pay=([a-f0-9]{64})(?:;|$)/)?.[1];
export async function sessionHash(req){
 const s=token(req);if(!s)return null;
 return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s))),v=>v.toString(16).padStart(2,'0')).join('');
}
export function prepareForm(req,res,env){
 if(!enabled(env)||token(req))return res;
 const out=new Response(res.body,res);out.headers.append('Set-Cookie','__Host-mc_vol_pay='+crypto.randomUUID().replaceAll('-','')+crypto.randomUUID().replaceAll('-','')+'; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=604800');return out;
}
export const orderId=()=>'VOL'+crypto.randomUUID().replaceAll('-','');
let access;
async function api(env,path,body){
 if(!access||access.until<Date.now()||access.client!==env.PHONEPE_CLIENT_ID){
  const r=await fetch(origin+'identity-manager/v1/oauth/token',{method:'POST',body:new URLSearchParams({grant_type:'client_credentials',client_id:env.PHONEPE_CLIENT_ID,client_version:env.PHONEPE_CLIENT_VERSION,client_secret:env.PHONEPE_CLIENT_SECRET}),signal:AbortSignal.timeout(8000)});
  if(!r.ok)throw Error('Authentication unavailable');const d=await r.json();if(!d.access_token)throw Error('Authentication incomplete');access={client:env.PHONEPE_CLIENT_ID,value:d.access_token,until:Number(d.expires_at)*1000-60000};
 }
 const r=await fetch(origin+'pg/checkout/v2/'+path,{method:body?'POST':'GET',headers:{Authorization:'O-Bearer '+access.value,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(10000)});
 if(r.status===401)access=null;
 const data=await r.json();if(!r.ok){if(!body&&['ORDER_NOT_FOUND','TRANSACTION_NOT_FOUND'].includes(data.code))return null;throw Error('PhonePe temporarily unavailable')}
 return data;
}
const now=()=>Math.floor(Date.now()/1000);
const query=(env,sql,...args)=>env.DB.prepare(sql).bind(...args);
function allowedUrl(value){try{const u=new URL(value);return u.protocol==='https:'&&(u.hostname==='phonepe.com'||u.hostname.endsWith('.phonepe.com'))}catch{return false}}
async function sync(env,row){
 const d=await api(env,'order/'+row.merchant_order+'/status?details=true');
 if(!d){if(row.state==='starting'&&row.started<now()-90)await query(env,"UPDATE mc_vol_phonepe SET state='new' WHERE merchant_order=? AND state='starting'",row.merchant_order).run();return}
 if(d.merchantOrderId&&d.merchantOrderId!==row.merchant_order||row.provider_order&&row.provider_order!==d.orderId||!d.orderId)return;
 if(d.state==='FAILED'){await query(env,"UPDATE mc_vol_phonepe SET state='failed',checkout_url=NULL WHERE merchant_order=? AND state IN ('starting','open')",row.merchant_order).run();return}
 if(d.state!=='COMPLETED'||d.amount!==fee)return;
 const detail=d.paymentDetails?.find(x=>x.state==='COMPLETED'&&x.amount===fee&&x.transactionId);
 if(!detail)return;
 const utr=detail.rail?.utr||detail.splitInstruments?.find(x=>x.rail?.utr)?.rail.utr;
 const ref=String(utr||detail.transactionId);
 await env.DB.batch([
 query(env,"UPDATE mc_vol_phonepe SET state='paid',provider_order=?,reference=?,reference_type=?,checkout_url=NULL WHERE merchant_order=? AND state IN ('starting','open')",d.orderId,ref,utr?'UTR':'PhonePe transaction ID',row.merchant_order),
 query(env,"INSERT INTO mc_volunteer_payments(referral_id,utr,amount,verified_by,verified_at) SELECT referral_id,reference,999,'PhonePe',unixepoch() FROM mc_vol_phonepe WHERE merchant_order=? AND changes()=1",row.merchant_order),
 query(env,"UPDATE mca_referrals SET status='pending' WHERE id=? AND status='payment_draft' AND EXISTS(SELECT 1 FROM mc_vol_phonepe WHERE referral_id=? AND state='paid')",row.referral_id,row.referral_id)
 ]);
}
async function check(env,row){
 if(!['starting','open'].includes(row.state))return;
 const lock=await query(env,"UPDATE mc_vol_phonepe SET next_check=? WHERE merchant_order=? AND next_check<=? AND state IN ('starting','open')",now()+20,row.merchant_order,now()).run();
 if(lock.meta.changes)await sync(env,row);
}
export async function reconcile(env){
 if(!enabled(env))return;const rows=await query(env,"SELECT * FROM mc_vol_phonepe WHERE state IN ('starting','open') AND next_check<=? ORDER BY next_check LIMIT 8",now()).all();
 await Promise.allSettled(rows.results.map(row=>check(env,row)));
}
export async function checkoutRoute(req,env){
 const url=new URL(req.url);if(![base,base+'/status',base+'/pay'].includes(url.pathname))return null;
 if(!enabled(env))return json({error:'Mobile checkout is not connected.'},503);
 const hash=await sessionHash(req);const lookup=()=>query(env,'SELECT * FROM mc_vol_phonepe WHERE session_hash=?',hash).first();
 let row=hash&&await lookup();if(!row)return json({error:'Open the application in the same browser used to start payment.'},404);
 if(url.pathname===base&&req.method==='GET')return checkoutPage();
 if(req.method!=='POST'||(req.headers.get('origin')!==url.origin&&req.headers.get('origin')!=='https://mamta-care-website.vercel.app'))return json({error:'Request unavailable'},403);
 try{
 await check(env,row);row=await lookup();
 if(url.pathname===base+'/pay'&&['failed','new'].includes(row.state)){
  const id=row.state==='failed'?orderId():row.merchant_order;
  const lock=await query(env,"UPDATE mc_vol_phonepe SET merchant_order=?,state='starting',started=?,next_check=?,provider_order=NULL,checkout_url=NULL WHERE merchant_order=? AND state=?",id,now(),now()+20,row.merchant_order,row.state).run();
  if(lock.meta.changes){
   const d=await api(env,'pay',{merchantOrderId:id,amount:fee,expireAfter:1200,paymentFlow:{type:'PG_CHECKOUT',message:'Mamta Care volunteer application scrutiny',merchantUrls:{redirectUrl:req.headers.get('origin')+base}}});
   if(!allowedUrl(d.redirectUrl)||!d.orderId)throw Error('Checkout unavailable');
   await query(env,"UPDATE mc_vol_phonepe SET state='open',provider_order=?,checkout_url=? WHERE merchant_order=? AND state='starting'",d.orderId,d.redirectUrl,id).run();
  }
  row=await lookup();
 }
 return json({state:row.state,reference:row.reference,referenceType:row.reference_type,application:row.referral_id.slice(0,8).toUpperCase(),checkout:url.pathname===base+'/pay'&&row.state==='open'&&allowedUrl(row.checkout_url)?row.checkout_url:undefined});
 }catch{return json({error:'Payment status is temporarily unavailable. Check again before paying.'},503)}
}
function checkoutPage(){
 const nonce=crypto.randomUUID();return new Response('<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Volunteer payment | Mamta Care</title><style nonce="'+nonce+'">body{background:#fff8f4;color:#452737;font:17px/1.55 system-ui;max-width:36rem;margin:8vh auto;padding:20px}button,input{padding:12px;font:inherit}button{background:#682642;color:white;border:0;border-radius:8px;margin:4px}</style><h1>Volunteer scrutiny fee</h1><p>₹999 covers application review. Volunteer status requires separate approval.</p><p id="msg" role="status">Checking payment…</p><label hidden id="ref"></label><button id="pay" hidden>Pay ₹999</button><button id="check">Check payment status</button><script nonce="'+nonce+'">('+client.toString()+')()</script></html>',{headers:{...cache,'Content-Type':'text/html; charset=utf-8','Content-Security-Policy':"default-src 'none'; script-src 'nonce-"+nonce+"'; style-src 'nonce-"+nonce+"'; connect-src 'self'; frame-ancestors 'none'"}});
}
function client(){
 const el=id=>document.getElementById(id),pay=el('pay'),check=el('check');let busy=false,timer;
 async function update(action){if(busy)return;busy=true;pay.disabled=check.disabled=true;clearTimeout(timer);
 try{const r=await fetch('/volunteer-checkout/'+action,{method:'POST'}),d=await r.json();if(!r.ok)throw Error(d.error);if(d.checkout){location.assign(d.checkout);return}
 const paid=d.state==='paid',failed=d.state==='failed',fresh=d.state==='new';pay.hidden=!['new','open','failed'].includes(d.state);pay.textContent=d.state==='open'?'Continue existing payment':failed?'Retry payment':'Pay ₹999';
 el('msg').textContent=paid?'₹999 received · Application '+d.application+' under review.':failed?'Payment failed. You can retry for the same application.':fresh?'Application saved. Your payment is ready to start.':'Awaiting payment confirmation for your existing order.';
 if(paid){const label=el('ref'),input=document.createElement('input');input.readOnly=true;input.value=d.reference;label.replaceChildren(d.referenceType+' ',input);label.hidden=false;check.hidden=true}
 if(!paid&&!fresh&&!failed)timer=setTimeout(()=>update('status'),22000);
 }catch(e){el('msg').textContent=e.message;pay.hidden=true}finally{busy=false;pay.disabled=check.disabled=false}}
 pay.onclick=()=>update('pay');check.onclick=()=>update('status');update('status');
}
