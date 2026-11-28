/* MCCT_CERTIFICATE_READY_GUARD_20261118
 * Restore original certificate-first messaging: a verified donor without
 * Column O URL is not eligible for the final WhatsApp certificate message.
 * This is presentation-only; no verification, email or certificate changes.
 */
const MCCT_CERT_READY_PREV_MESSAGE=mcFreeWhatsAppMessage;
mcFreeWhatsAppMessage=function(donor){
 const verified=String(donor?.verification_status||'').trim().toUpperCase()==='VERIFIED';
 const certificate=String(donor?.certificate_url||'').trim();
 if(verified&&!certificate){
  return {reason:'Google Sheet verification is recorded, but the official digital certificate is not generated yet. Complete the original certificate process before sending the certificate message.'};
 }
 return MCCT_CERT_READY_PREV_MESSAGE(donor);
};
/* End MCCT_CERTIFICATE_READY_GUARD_20261118 */
