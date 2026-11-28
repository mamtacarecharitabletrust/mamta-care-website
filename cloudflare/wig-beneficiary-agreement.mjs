// Pure, patient-specific agreement/outbox rules. No network, storage or patient data.
export const POLICY_VERSION='WIG-2026-11-DRAFT-1';
export const DEPOSIT_MAX=8000, FEE_MAX=2000;
const rupees=(n)=>Number.isSafeInteger(n)&&n>=0;
const required=(v,message)=>{if(!v)throw new Error(message)};
const validEmail=s=>typeof s==='string'&&s.length<=180&&/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(s);
const clean=s=>String(s??'').trim();
export function createAgreement({caseId,registrationId,patientName,email,approved,deposit=DEPOSIT_MAX,expenses=FEE_MAX,reference,policyVersion,policyAdopted,now}){
 required(approved===true,'Only approved wig beneficiaries are eligible');
 required(policyAdopted===true&&policyVersion===POLICY_VERSION,'Adopt the policy version first');
 required(clean(caseId)&&clean(registrationId)&&clean(patientName)&&clean(reference)&&validEmail(email),'Incomplete beneficiary details');
 required(rupees(deposit)&&deposit<=DEPOSIT_MAX&&rupees(expenses)&&expenses<=FEE_MAX,'Invalid payment breakdown');
 required(Number.isSafeInteger(now)&&now>0,'Invalid clock');
 return Object.freeze({caseId,registrationId,patientName:clean(patientName),email,reference,policyVersion,deposit,expenses,total:deposit+expenses,state:'DRAFT',createdAt:now,agreementSentAt:null,acceptedAt:null,acceptanceReference:null,paymentEmailSentAt:null});
}
export function agreementEmail(a,{secureLink,documentReference}){
 required(a.state==='DRAFT','Agreement is not a new draft');
 required(typeof secureLink==='string'&&secureLink.startsWith('https://')&&documentReference,'A verified HTTPS signing link and document are required');
 return {id:a.reference+':agreement',to:a.email,subject:'Your wig assistance agreement | Mamta Care Charitable Trust',body:'Dear '+a.patientName+',\n\nYour wig assistance has been approved. Registration: '+a.registrationId+'. The wig is provided without purchase or manufacturing charge. Please read the personalized agreement and electronically accept its terms using the secure link below.\n\n'+secureLink+'\n\nThe agreement explains the refundable deposit and applicable processing expenses. Payment instructions will be provided separately only after your verified acceptance.\n\nReduce, Reuse and Recycle\nMamta Care Charitable Trust',documentReference};
}
export function transition(a,event){
 required(event&&Number.isSafeInteger(event.now)&&event.now>=a.createdAt,'Invalid event');
 switch(event.type){
 case 'AGREEMENT_SENT':
 required(a.state==='DRAFT'&&event.adminApproved===true&&event.providerConfirmed===true&&event.documentDigest,'Agreement must be reviewed and delivery acknowledged by provider');
 return {...a,state:'AWAITING_ACCEPTANCE',agreementSentAt:event.now,documentDigest:event.documentDigest};
 case 'ACCEPTED':
 required(a.state==='AWAITING_ACCEPTANCE'&&event.verificationPassed===true&&event.explicitConsent===true&&event.documentDigest===a.documentDigest&&event.acceptanceReference&&event.now>=a.agreementSentAt,'Verified acceptance of the exact agreement is required');
 return {...a,state:'ACCEPTED',acceptedAt:event.now,acceptanceReference:event.acceptanceReference};
 case 'PAYMENT_EMAIL_SENT':
 required(a.state==='ACCEPTED'&&a.acceptanceReference&&event.providerConfirmed===true&&event.now>=a.acceptedAt,'Payment email requires verified acceptance and provider acknowledgment');
 return {...a,state:a.total===0?'WAIVED':'AWAITING_PAYMENT',paymentEmailSentAt:event.now};
 case 'PAYMENT_CONFIRMED':
 required(a.state==='AWAITING_PAYMENT'&&event.bankVerified===true&&event.amount===a.total&&/^[0-9A-Za-z]{10,40}$/.test(String(event.utr||''))&&event.now>=a.paymentEmailSentAt,'Verify the exact bank credit and transaction reference');
 return {...a,state:'PAID',paymentConfirmedAt:event.now};
 default:throw new Error('Unsupported transition');
 }
}
export function paymentEmail(a,{trustDestinationVerified,upiId,qrUrl,paymentPageUrl,acceptedDocumentReference}){
 required(a.state==='ACCEPTED'&&a.acceptanceReference&&a.acceptedAt,'Payment instructions prohibited before verified acceptance');
 required(acceptedDocumentReference,'Accepted agreement receipt required');
 if(a.total===0)return {id:a.reference+':payment',to:a.email,subject:'Agreement accepted — payment waived | Mamta Care Charitable Trust',body:'Dear '+a.patientName+',\n\nYour agreement has been accepted. No payment is due. Our team will coordinate the wig allotment.',documentReference:acceptedDocumentReference};
 required(trustDestinationVerified===true&&/^[a-z0-9._-]+@[a-z0-9.-]+$/i.test(String(upiId||'')),'Verified Trust UPI account required');
 required([qrUrl,paymentPageUrl].every(u=>typeof u==='string'&&u.startsWith('https://')),'Verified HTTPS payment page and QR required');
 return {id:a.reference+':payment',to:a.email,subject:'Agreement accepted — payment instructions | Mamta Care Charitable Trust',body:'Dear '+a.patientName+',\n\nYour agreement has been accepted. Registration: '+a.registrationId+'.\nWig purchase price: INR 0\nRefundable deposit: INR '+a.deposit+'\nProcessing and courier: INR '+a.expenses+'\nTotal payable: INR '+a.total+'\n\nPay using the official Trust UPI instructions: '+paymentPageUrl+'\n\nThe Trust will confirm payment only after verifying the bank credit. Please retain your transaction reference.\n\nReduce, Reuse and Recycle\nMamta Care Charitable Trust',qrUrl,paymentPageUrl,documentReference:acceptedDocumentReference};
}
