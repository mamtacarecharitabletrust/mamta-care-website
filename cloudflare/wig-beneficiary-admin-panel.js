function beneficiaryAgreementPanel(host,r){
 const d=el('details',null,host);el('summary','Electronic wig assistance agreement',d);
 const body=el('div',null,d),info=el('p','',body);info.setAttribute('role','status');
 const controls=el('div',null,body);const api='/api/admin/wig-beneficiary-agreements';
 const request=async(id,action,method='GET',payload)=>{const res=await fetch(api+'/'+encodeURIComponent(id)+'/'+action,{method,cache:'no-store',...(method==='POST'?{headers:{'Content-Type':'application/json','X-Mamta-Desk':'1'},body:JSON.stringify(payload||{})}:{})});const result=await res.json();if(!res.ok||!result.ok)throw Error(result.error||result.reason||'Agreement operation unavailable');return result;};
 const button=(title,fn)=>{const b=el('button',title,controls);b.type='button';b.onclick=async()=>{b.disabled=true;info.textContent='Working…';try{await fn();await loadAgreement()}catch(e){info.textContent=e.message}finally{b.disabled=false}};return b;};
 const loadAgreement=async()=>{controls.replaceChildren();info.textContent='Loading agreement status…';try{
 const x=await request(r.case_id,'case-status'),a=x.agreement,mail=x.mail||[];
 info.textContent=a?'Agreement: '+a.status+(a.accepted_at?' · Verified acceptance: '+new Date(a.accepted_at).toLocaleString():''):'No agreement prepared';
 if(!a){if(!x.eligible){el('p','Electronic agreement issuance is not yet enabled for this beneficiary. Historical approvals are not charged retrospectively.',controls);return;}
 const deposit=label(controls,'Refundable deposit (₹)','number'),expenses=label(controls,'Documented expenses (₹)','number');deposit.min=0;deposit.max=8000;deposit.step=1;deposit.value=8000;expenses.min=0;expenses.max=2000;expenses.step=1;expenses.value=0;
 button('Generate personalized PDF',()=>{if(deposit.value===''||expenses.value===''||!deposit.checkValidity()||!expenses.checkValidity())throw Error('Confirm the exact applicable amounts');return request(r.case_id,'prepare','POST',{deposit:Number(deposit.value),expenses:Number(expenses.value)})});return;}
 el('p','Refundable deposit: ₹'+a.deposit+' · Expenses: ₹'+a.expenses+' · Total: ₹'+(a.deposit+a.expenses),controls);
 const link=el('a','Open personalized agreement PDF',controls);link.href=api+'/'+encodeURIComponent(a.id)+'/pdf';link.target='_blank';link.rel='noopener noreferrer';
 for(const m of mail)el('p',m.kind+' email: '+m.state,controls);
 const first=mail.find(m=>m.kind==='AGREEMENT'),second=mail.find(m=>m.kind==='PAYMENT');
 if(a.status==='DRAFT'&&!first&&x.eligible){const reviewed=label(controls,'I reviewed the exact PDF, applicable amounts and registered recipient.','checkbox');button('Approve & Send Agreement',()=>{if(!reviewed.checked)throw Error('Review the PDF and recipient first');return request(a.id,'send','POST',{reviewed:true,document_digest:a.document_digest})});}
 if(first&&['UNKNOWN','PROCESSING'].includes(first.state))button('Check agreement email status',()=>request(a.id,'reconcile','POST'));
 if(a.status==='ACCEPTED'&&second?.state==='HOLD')button('Check and release payment email',()=>request(a.id,'release-payment','POST'));
 if(second&&['UNKNOWN','PROCESSING'].includes(second.state))button('Check payment email status',()=>request(a.id,'reconcile-payment','POST'));
 }catch(e){info.textContent=e.message;}}
 d.ontoggle=()=>{if(d.open)loadAgreement()}; 
}