/**
 * MAMTA CARE — Courier website bridge.
 * Add this file to the EXISTING Apps Script project alongside CourierPortal.gs.
 * DO NOT add another doPost(): an existing doPost router handles other live flows.
 * DO NOT change CourierPortal.gs, HardCopyCertificate.gs, or donor sheets.
 *
 * Extend the existing doPost(e) JSON router BEFORE its social bridge fallback:
 *
 *   if (payload && /^courier_(code|verify|submit|status)$/.test(String(payload.action || ''))) {
 *     return mcCourierWebsiteBridgePost_(payload);
 *   }
 *
 * Production access requires the EXISTING Script Property:
 * WEBSITE_FORM_BRIDGE_SECRET
 * (Same secret already used by Mamta's website registration bridge.)
 *
 * Action -> existing verified courier functions:
 * courier_code   -> mcCourierRequestCode(id,email)
 * courier_verify -> mcCourierVerifyCode(id,code)
 * courier_submit -> mcCourierSubmit(token,carrier,tracking)
 * courier_status -> mcCourierStatus(token)
 */
function mcCourierWebsiteBridgePost_(payload) {
  const reply = function(result) {
    return ContentService.createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);
  };

  try {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload) ||
        JSON.stringify(payload).length > 3500) {
      return reply({ok:false,error:'Invalid courier request'});
    }

    // Never authorize by Origin or request body alone. This shared server-side
    // secret stays only in Cloudflare Worker and Apps Script Script Properties.
    const provided = String(payload.secret || '');
    const expected = String(PropertiesService.getScriptProperties()
      .getProperty('WEBSITE_FORM_BRIDGE_SECRET') || '');
    if (expected.length < 32 || provided.length !== expected.length ||
        !mcCourierWebEqual_(provided, expected)) {
      return reply({ok:false,error:'Not authorized'});
    }

    const action = String(payload.action || '');
    let value;
    switch (action) {
      case 'courier_code':
        value = mcCourierRequestCode(
          String(payload.registration_id || '').slice(0, 80),
          String(payload.email || '').slice(0, 254)
        );
        break;
      case 'courier_verify':
        value = mcCourierVerifyCode(
          String(payload.registration_id || '').slice(0, 80),
          String(payload.code || '').slice(0, 8)
        );
        break;
      case 'courier_submit':
        value = mcCourierSubmit(
          String(payload.token || '').slice(0, 100),
          String(payload.carrier || '').slice(0, 30),
          String(payload.tracking || '').slice(0, 40)
        );
        break;
      case 'courier_status':
        value = mcCourierStatus(String(payload.token || '').slice(0, 100));
        break;
      default:
        return reply({ok:false,error:'Unsupported courier action'});
    }
    return reply({ok:true,data:value || {}});
  } catch (err) {
    // Do not reveal donor information, spreadsheet identifiers or internal stack.
    const message = String(err && err.message || 'Courier request failed')
      .replace(/[\r\n]+/g,' ').slice(0,220);
    return reply({ok:false,error:message});
  }
}

function mcCourierWebEqual_(a,b) {
  const d1 = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,a);
  const d2 = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,b);
  let different = 0;
  for (let i = 0; i < d1.length; i++) different |= d1[i] ^ d2[i];
  return different === 0;
}
