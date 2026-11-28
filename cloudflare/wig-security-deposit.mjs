/* Mamta Care: admin-only additive deposit module. Financial actions default OFF.
 * Existing approval, maker assignment and inventory remain authoritative.
 */
export const POLICY='MC-WIG-DEPOSIT-v1';
export const TOTAL=10000, FEE=2000, DEPOSIT=8000;
const prefix='/api/admin/wig-security-deposit', page='/admin-wig-security-deposit';
const states=['AWAITING_PAYMENT','PAID','WAIVED','WITH_PATIENT','RETURNED','INSPECTED','REFUND_APPROVED','REFUNDED','RETENTION_REVIEW','RETAINED'];
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const json=(x,status=200)=>new Response(JSON.stringify(x),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'}});
const err=(error,status=400)=>json({ok:false,error},status);
const clean=(s,n=500)=>String(s??'').trim().slice(0,n);
export function istToday(now=new Date()){return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kolkata',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);}
export function validDate(s){if(!/^\d{4}-\d{2}-\d{2}$/.test(s||''))return false;const d=new Date(s+'T00:00:00Z');return Number.isFinite(+d)&&d.toISOString().slice(0,10)===s;}
export function sixMonths(s){if(!validDate(s))throw Error('Invalid delivery date');const d=new Date(s+'T00:00:00Z'),day=d.getUTCDate();d.setUTCDate(1);d.setUTCMonth(d.getUTCMonth()+6);const max=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,0)).getUTCDate();d.setUTCDate(Math.min(day,max));return d.toISOString().slice(0,10);}
export function daysLeft(deadline,today=istToday()){return validDate(deadline)&&validDate(today)?Math.round((Date.parse(deadline)-Date.parse(today))/86400000):null;}
export function maskUtr(v){return v?'••••'+String(v).slice(-4):'—';}
export function normalizeUtr(v){const s=String(v??'').trim().toUpperCase();if(!/^[A-Z0-9]{8,40}$/.test(s))throw Error('Enter the full bank-verified transaction reference (8–40 letters/digits).');return s;}
function reason(v){const s=clean(v);if(s.length<8)throw Error('A documented reason or evidence reference is required.');return s;}
function past(v,today){if(!validDate(v)||v>today)throw Error('Enter a valid date not in the future.');return v;}
function requireState(r,allowed){if(!allowed.includes(r.state))throw Error('This action is not available in the current state. Refresh the record.');}
export function transition(r,b,today=istToday()){
 const action=b.action;
 switch(action){
 case 'pay': requireState(r,['AWAITING_PAYMENT']);if(b.bank_verified!==true||Number(b.amount)!==TOTAL)throw Error('Confirm the actual ₹10,000 bank credit.');{const p=past(b.date,today);if(p<r.accepted_at.slice(0,10))throw Error('Payment precedes agreement acceptance.');return {state:'PAID',amount:TOTAL,payment_utr:normalizeUtr(b.utr),payment_date:p,receipt_no:'MC-WIG-'+r.case_id};}
 case 'waive': requireState(r,['AWAITING_PAYMENT']);return {state:'WAIVED',settlement_note:reason(b.note)};
 case 'deliver': requireState(r,['PAID','WAIVED']);if(b.delivery_verified!==true||b.human_hair_verified!==true)throw Error('Confirm actual receipt and 100% human-hair specification.');{const d=past(b.date,today);if(d<(r.payment_date||r.accepted_at.slice(0,10)))throw Error('Delivery predates payment or acceptance.');return {state:'WITH_PATIENT',delivery_date:d,deadline:sixMonths(d)};}
 case 'extend': requireState(r,['WITH_PATIENT']);if(!validDate(b.date)||b.date<=r.deadline||b.date<today)throw Error('Extension must be later than the existing deadline and today.');return {deadline:b.date,extension_reason:reason(b.note)};
 case 'request_return': requireState(r,['WITH_PATIENT']);if(r.return_requested_date)throw Error('Return request already recorded.');{const d=past(b.date,today);if(d<r.delivery_date||d>r.deadline)throw Error('Request is outside the agreed return period; review an extension first.');return {return_requested_date:d};}
 case 'return': requireState(r,['WITH_PATIENT','RETENTION_REVIEW']);{const d=past(b.date,today);if(d<r.delivery_date||d<(r.return_requested_date||r.delivery_date))throw Error('Return precedes delivery or return request.');if(!r.return_requested_date&&d>r.deadline)throw Error('Late return: approve an extension or resolve manually first.');return {state:'RETURNED',returned_date:d,return_requested_date:r.return_requested_date||d};}
 case 'inspect': requireState(r,['RETURNED']);{const n=Number(b.damage_cost);if(b.damage_cost===''||b.damage_cost==null||!Number.isInteger(n)||n<0||n>DEPOSIT||(r.amount===0&&n!==0))throw Error('Invalid documented damage deduction.');if(b.normal_wear===true&&n!==0)throw Error('Normal wear cannot be charged.');return {state:'INSPECTED',inspection_note:reason(b.note),damage_cost:n};}
 case 'approve_refund': requireState(r,['INSPECTED']);if(b.reviewed!==true)throw Error('Confirm inspection and documented reasonable deductions.');return {state:'REFUND_APPROVED',refund_amount:r.amount===TOTAL?DEPOSIT-r.damage_cost:0};
 case 'refund': requireState(r,['REFUND_APPROVED']);if(b.bank_verified!==true||Number(b.amount)!==r.refund_amount)throw Error('Verify exact approved refund amount against the bank.');if(r.refund_amount===0)return {state:'REFUNDED',refund_date:past(b.date,today),settlement_note:reason(b.note)};{const d=past(b.date,today);if(d<r.returned_date)throw Error('Refund precedes return.');const u=normalizeUtr(b.utr);if(u===r.payment_utr)throw Error('Refund must have its own transaction reference.');return {state:'REFUNDED',refund_date:d,refund_utr:u};}
 case 'retention_review': requireState(r,['WITH_PATIENT']);if(today<=r.deadline||r.return_requested_date)throw Error('Return period is active or a return request exists.');return {state:'RETENTION_REVIEW',settlement_note:reason(b.note)};
 case 'retain': requireState(r,['RETENTION_REVIEW']);if(b.legal_reviewed!==true||b.patient_agreed!==true)throw Error('Legal approval and documented beneficiary agreement required.');return {state:'RETAINED',settlement_note:reason(b.note)};
 default: throw Error('Unknown action.');
 }
}
export function mailText(kind,name,reg,r){
 const greeting='Dear '+clean(name,150)+',\n\nGreetings from Mamta Care Charitable Trust.\nRegistration ID: '+clean(reg,100)+'\n\n';
 const purpose='The wig itself is provided free of cost: no purchase or manufacturing charge. Our programme uses precious donated human hair, with 100% human-hair specification confirmed before handover. Your support helps our charitable trust follow Reduce, Reuse and Recycle.';
 const split='Total initial payment: ₹10,000 (₹2,000 disclosed processing, packaging and courier charges; ₹8,000 refundable security deposit). The deposit protects the wig and is not a wig price. Financial hardship assistance is available.';
 const care='Do not sell, rent, transfer, cut, colour, chemically treat, heat-style or aggressively brush the wig; follow the supplied cleaning and storage instructions. Return within six months for inspection and refund, subject only to reasonable documented damage beyond normal wear. Contact us for medical extensions. No automatic deposit forfeiture or transfer of ownership.';
 const bodies={
 DEPOSIT_REQUEST:'Your wig assistance has been approved. '+purpose+'\n\n'+split+'\n\nPlease accept the return and payment terms before paying. '+care,
 PAYMENT_RECEIVED:'We confirm verified receipt of ₹10,000 on '+r.payment_date+'. Receipt: '+r.receipt_no+'. Transaction: '+maskUtr(r.payment_utr)+'.\n\n'+purpose+'\n\n'+split+'\n\nThe return period begins upon delivery.',
 WAIVER_CONFIRMED:'Your approved payment waiver has been recorded. '+purpose,
 DELIVERY_CONFIRMED:'Your wig was received on '+r.delivery_date+'. Return deadline: '+r.deadline+'. Refundable deposit: ₹'+(r.amount===TOTAL?DEPOSIT:0)+'.\n\n'+purpose+'\n\n'+care,
 EXTENSION_CONFIRMED:'Your return deadline has been extended to '+r.deadline+'. '+care,
 RETURN_RECEIVED:'Your wig was received on '+r.returned_date+'. We will inspect it and inform you of the refund decision.',
 REFUND_CONFIRMED:'Your deposit settlement of ₹'+r.refund_amount+' has been recorded on '+r.refund_date+'. Transaction: '+maskUtr(r.refund_utr)+'.',
 RETENTION_SETTLEMENT:'Your retention settlement has been recorded following review and your agreement. Please retain the separately issued settlement document.'
 };
 if(!bodies[kind])throw Error('Unknown mail type');
 return greeting+bodies[kind]+'\n\nWarm regards,\nWig Assistance Department\nMamta Care Charitable Trust\nGovernment Registered NGO | Women-led Charitable Trust';
}
const listSql="SELECT c.id AS case_id,c.registration_id,c.patient_name,c.city,c.approved_at,coalesce(w.urgency,'Normal') AS urgency,j.status AS maker_status,d.state,d.revision,d.amount,d.delivery_date,d.deadline,d.return_requested_date,d.returned_date,d.refund_amount,d.damage_cost,d.payment_date,d.refund_date,substr(d.payment_utr,-4) AS payment_last4,substr(d.refund_utr,-4) AS refund_last4 FROM mcwig_cases_v1 c LEFT JOIN wig_requests w ON w.id=c.id LEFT JOIN maker_jobs j ON j.id=c.maker_job_id LEFT JOIN mcwig_deposit_v1 d ON d.case_id=c.id WHERE c.status='APPROVED' ORDER BY CASE WHEN lower(coalesce(w.urgency,''))='urgent' THEN 0 ELSE 1 END,c.approved_at,c.id";
const live=env=>env.MC_WIG_DEPOSIT_LIVE==='true'&&/^\d{10}$/.test(String(env.MC_WIG_DEPOSIT_EFFECTIVE_AT||''));
const writeOK=req=>req.headers.get('Origin')===new URL(req.url).origin&&req.headers.get('X-Mamta-Desk')==='1'&&/^application\/json(?:;|$)/i.test(req.headers.get('Content-Type')||'');
const allowedColumns=new Set(['state','amount','payment_utr','payment_date','receipt_no','delivery_date','deadline','return_requested_date','returned_date','inspection_note','damage_cost','refund_amount','refund_utr','refund_date','extension_reason','settlement_note']);
export async function handleWigSecurityDeposit(req,env,user){
 const u=new URL(req.url),p=u.pathname;
 if(p!==page&&p!==prefix&&!p.startsWith(prefix+'/'))return null;
 if(user?.role!=='admin'||!user.username)return err('Administrator session required',401);
 if(env.MC_WIG_DEPOSIT_ENABLED!=='true')return err('Wig Security Deposit is not activated',503);
 try{
 if(req.method==='GET'&&p===page)return renderPage();
 if(req.method==='GET'&&p===prefix){
 const rows=(await env.DB.prepare(listSql).all()).results||[];
 const today=istToday();return json({ok:true,live:live(env),today,rows:rows.map(r=>({...r,days_remaining:daysLeft(r.deadline,today),legacy:Number(r.approved_at)<Number(env.MC_WIG_DEPOSIT_EFFECTIVE_AT||Infinity)}))});
 }
 if(req.method!=='POST'||!writeOK(req))return err('Invalid method or origin',403);
 if(!live(env))return err('Financial workflow is disabled pending policy and end-to-end review',503);
 const id=p.slice(prefix.length+1);if(!/^[a-f0-9-]{36}$/i.test(id))return err('Invalid case',400);
 const b=await req.json().catch(()=>null);if(!b||typeof b!=='object')return err('Invalid request');
 const c=await env.DB.prepare("SELECT c.id,c.approved_at,j.status AS maker_status FROM mcwig_cases_v1 c LEFT JOIN maker_jobs j ON j.id=c.maker_job_id WHERE c.id=? AND c.status='APPROVED'").bind(id).first();
 if(!c)return err('Approved case not found',404);
 const r=await env.DB.prepare('SELECT * FROM mcwig_deposit_v1 WHERE case_id=?').bind(id).first();
 if(b.action==='enrol'){
 if(r)return err('Already enrolled',409);
 if(!Number.isFinite(Number(c.approved_at))||Number(c.approved_at)<Number(env.MC_WIG_DEPOSIT_EFFECTIVE_AT))return err('Historical approval: no retrospective billing',409);
 if(b.accepted!==true||b.policy!==POLICY)return err('Versioned beneficiary acceptance is required');
 const evidence=reason(b.note),accepted=past(b.date,istToday());
 const result=await env.DB.prepare("INSERT INTO mcwig_deposit_v1(case_id,state,policy_version,accepted_at,accepted_evidence,actor) VALUES(?,'AWAITING_PAYMENT',?,?,?,?) ON CONFLICT(case_id) DO NOTHING").bind(id,POLICY,accepted,evidence,user.username).run();
 return result.meta.changes===1?json({ok:true}):err('Already enrolled',409);
 }
 if(!r||Number(b.revision)!==r.revision)return err('Refresh this record before making changes',409);
 if(b.action==='deliver'&&c.maker_status!=='received')return err('Finished wig must first be received from the maker',409);
 const patch=transition(r,b);const keys=Object.keys(patch);if(keys.some(k=>!allowedColumns.has(k)))throw Error('Invalid update');
 const result=await env.DB.prepare('UPDATE mcwig_deposit_v1 SET '+keys.map(k=>k+'=?').join(',')+',revision=revision+1,actor=?,updated_at=unixepoch() WHERE case_id=? AND revision=?').bind(...keys.map(k=>patch[k]),user.username,id,r.revision).run();
 return result.meta.changes===1?json({ok:true}):err('Record changed; refresh before retrying',409);
 }catch(e){if(/UNIQUE constraint|constraint failed/i.test(String(e?.message)))return err('Duplicate or invalid transaction; no change saved',409);if(/D1_ERROR|SQLITE|no such table/i.test(String(e?.message)))return err('Deposit service unavailable; no payment should be collected',503);return err(clean(e?.message||'Unable to complete request',200),400);}
}
function renderPage(){
 const nonce=crypto.randomUUID().replaceAll('-','');
 const html='<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Wig Security Deposit · Mamta Care</title><style nonce="'+nonce+'">body{margin:0;background:#faf6f3;color:#33252b;font:15px system-ui}header{background:#70203e;color:#fff;padding:20px}header a{color:white}main{max-width:1100px;margin:auto;padding:18px}h1{margin:4px 0}article,section{background:#fff;border:1px solid #e3d6d9;border-radius:12px;padding:16px;margin:12px 0}input,select,button,textarea{font:inherit;padding:10px;border:1px solid #bfa9b3;border-radius:8px;max-width:100%;box-sizing:border-box}button{background:#70203e;color:white;cursor:pointer}button:disabled{opacity:.45}label{display:block;margin:9px 0}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(145px,1fr));gap:10px}.grid article{margin:0}strong{color:#70203e}.muted{color:#66545c}.warning{color:#9b3019}pre{white-space:pre-wrap}a{color:#70203e}</style><body><header><small>MAMTA CARE CHARITABLE TRUST</small><h1>Wig Security Deposit</h1><a href="/app/premium">Donor Desk</a> · <a href="/admin-wig-v8">Wig Assistance</a> · <a href="/premium-v3/wigs?tab=requests">Wig Stock &amp; Allotment</a></header><main><section><b>₹0 wig price · ₹2,000 disclosed charges · ₹8,000 refundable deposit</b><p>Reduce, Reuse and Recycle · 100% human-hair specification verified before handover.</p><p id="gate" role="status"></p><div id="summary" class="grid"></div></section><section><label>Find approved beneficiary <input id="q" placeholder="Name, registration ID or city"></label><label>Status <select id="filter"><option value="">All</option><option>AWAITING_PAYMENT</option><option>PAID</option><option>WAIVED</option><option>WITH_PATIENT</option><option>RETURNED</option><option>INSPECTED</option><option>REFUND_APPROVED</option><option>REFUNDED</option><option>RETENTION_REVIEW</option><option>RETAINED</option><option value="NOT_ENROLLED">NOT_ENROLLED</option></select></label><p id="notice" role="status"></p><div id="records"></div></section></main><script nonce="'+nonce+'">('+client.toString()+')();</script></body></html>';
 return new Response(html,{headers:{'content-type':'text/html; charset=utf-8','cache-control':'no-store','referrer-policy':'no-referrer','x-content-type-options':'nosniff','content-security-policy':"default-src 'none'; script-src 'nonce-"+nonce+"'; style-src 'nonce-"+nonce+"'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'"}});
}
function client(){
 const $=id=>document.getElementById(id),base='/api/admin/wig-security-deposit';let data={rows:[],live:false,today:''};
 const el=(tag,text,host)=>{const e=document.createElement(tag);if(text!=null)e.textContent=text;if(host)host.append(e);return e;};
 const label=(host,name,type='text')=>{const l=el('label',name+' ',host),i=el('input',null,l);i.type=type;return i};
 const actions={AWAITING_PAYMENT:['pay','waive'],PAID:['deliver'],WAIVED:['deliver'],WITH_PATIENT:['extend','request_return','return','retention_review'],RETURNED:['inspect'],INSPECTED:['approve_refund'],REFUND_APPROVED:['refund'],RETENTION_REVIEW:['retain','return'],NOT_ENROLLED:['enrol']};
 const labels={pay:'Confirm bank payment',waive:'Approve hardship waiver',deliver:'Record actual delivery',extend:'Extend return deadline',request_return:'Record return request',return:'Mark returned',inspect:'Record inspection',approve_refund:'Approve refund',refund:'Mark refunded',retention_review:'Review retention',retain:'Record reviewed ownership settlement',enrol:'Record accepted policy'};
 function show(){
 const rows=data.rows,counts=[['Approved beneficiaries',rows.length],['Awaiting payment',rows.filter(r=>r.state==='AWAITING_PAYMENT').length],['Not enrolled',rows.filter(r=>!r.state).length],['Paid',rows.filter(r=>r.state==='PAID').length],['With patient',rows.filter(r=>r.state==='WITH_PATIENT').length],['Return due ≤30 days',rows.filter(r=>r.state==='WITH_PATIENT'&&r.days_remaining!=null&&r.days_remaining<=30).length],['Refund pending',rows.filter(r=>['RETURNED','INSPECTED','REFUND_APPROVED'].includes(r.state)).length]];
 $('summary').replaceChildren();for(const [name,n] of counts){const a=el('article',null,$('summary'));el('strong',String(n),a);el('div',name,a)}
 $('records').replaceChildren();const q=$('q').value.toLowerCase(),f=$('filter').value;
 for(const r of rows.filter(r=>(!f||(r.state||'NOT_ENROLLED')===f)&&[r.patient_name,r.city,r.registration_id].some(v=>String(v||'').toLowerCase().includes(q)))){
 const a=el('article',null,$('records'));el('strong',r.patient_name+' · '+r.registration_id,a);el('p',[r.city,r.urgency==='Urgent'?'High priority':'Standard priority',r.state||'Not enrolled','Maker: '+(r.maker_status||'Not assigned')].join(' · '),a);
 if(r.deadline)el('p','Received: '+r.delivery_date+' · Return deadline: '+r.deadline+' · '+Math.max(0,r.days_remaining)+' days left'+(r.days_remaining<0?' (overdue)':''),a);
 if(r.payment_last4)el('p','Payment: ₹'+r.amount+' · UTR ending '+r.payment_last4,a);
 if(r.refund_amount!=null)el('p','Approved refund: ₹'+r.refund_amount+(r.refund_last4?' · UTR ending '+r.refund_last4:''),a);
 if(r.legacy&&!r.state){el('p','Historical approval · no retrospective charges',a);continue;}
 for(const action of (actions[r.state||'NOT_ENROLLED']||[])){
 const button=el('button',labels[action],a);button.disabled=!data.live;button.onclick=()=>form(a,r,action);
 }
 }
 }
 function form(a,r,action){a.querySelector('form')?.remove();const f=el('form',null,a),fields={};
 const add=(key,name,type)=>fields[key]=label(f,name,type);
 const note=()=>add('note','Evidence / reason');
 if(action==='enrol'){add('date','Agreement date','date');note();add('accepted','Beneficiary accepted policy v1','checkbox')}
 if(action==='pay'||action==='refund'){add('date','Verified bank date','date');add('amount','Exact amount (₹)','number');fields.amount.value=action==='pay'?10000:r.refund_amount;add('utr','Full transaction reference');add('bank_verified','Bank verified','checkbox');if(action==='refund'&&r.refund_amount===0)note()}
 if(action==='deliver'){add('date','Actual delivery date','date');add('delivery_verified','Actual receipt verified','checkbox');add('human_hair_verified','100% human hair verified','checkbox')}
 if(['return','request_return','extend'].includes(action))add('date',action==='extend'?'New return deadline':'Actual date','date');
 if(['waive','extend','inspect','retention_review','retain'].includes(action))note();
 if(action==='inspect'){add('damage_cost','Documented damage cost (₹)','number');fields.damage_cost.value=0;add('normal_wear','Only normal wear','checkbox')}
 if(action==='approve_refund')add('reviewed','Inspection and deduction reviewed','checkbox');
 if(action==='retain'){add('legal_reviewed','Legal settlement reviewed','checkbox');add('patient_agreed','Patient agreed in writing','checkbox')}
 const save=el('button','Save '+labels[action],f);save.type='submit';f.onsubmit=async e=>{e.preventDefault();save.disabled=true;try{const body={action,revision:r.revision,policy:'MC-WIG-DEPOSIT-v1'};for(const [k,v] of Object.entries(fields))body[k]=v.type==='checkbox'?v.checked:v.value;const res=await fetch(base+'/'+r.case_id,{method:'POST',headers:{'Content-Type':'application/json','X-Mamta-Desk':'1'},body:JSON.stringify(body)}),d=await res.json();if(!res.ok||!d.ok)throw Error(d.error||'Save failed');await load();$('notice').textContent='Record updated. Email held pending verified relay activation.'}catch(e){$('notice').textContent=e.message;save.disabled=false}};
 }
 async function load(){try{const res=await fetch(base,{cache:'no-store'});data=await res.json();if(!res.ok||!data.ok)throw Error(data.error||'Unable to load');$('gate').textContent=data.live?'Financial workflow enabled. Verify all transactions against the bank.':'Read-only mode: no new deposit collection, refund or email sending.';show()}catch(e){$('notice').textContent=e.message}}
 $('q').oninput=show;$('filter').onchange=show;load();
}
