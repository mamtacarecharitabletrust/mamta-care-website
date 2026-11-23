/*
 * TEMPORARY staging-only, no-write verification of the production Google Apps
 * Script secret. Never include this code in a production Worker.
 * The supplied key is never logged or stored. This endpoint can only submit an
 * invalid registration ID and an unknown action to the pinned Google URL.
 */
const GOOGLE_PRODUCTION_BRIDGE="https://script.google.com/macros/s/AKfycbxwFsJBYmHYBuMdDIOgMZ7oriDQXeD2-PeNlm9vKjUNjc61bhh6qOsbLdT17mVLDCgaaA/exec";
const PROD_KEY_HASH_SHA256="16f0e4daf4becf42f70b634e6029a94b330c622f2835f98cc8a01c82f31a792e";
const reply=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{"content-type":"application/json","cache-control":"no-store","x-content-type-options":"nosniff"}});
function hashEqual(a,b){if(a.length!==b.length)return false;let mismatch=0;for(let i=0;i<a.length;i++)mismatch|=a.charCodeAt(i)^b.charCodeAt(i);return mismatch===0;}
export async function verifyProductionWigBridgeNoWrite(req,env){
 if(new URL(req.url).pathname!=="/internal/wig-production-bridge-test")return null;
 if(req.method!=="POST")return reply({ok:false,error:"Method not supported"},405);
 if(env.MC_WIG_ENABLED!=="false")return reply({ok:false,error:"Staging feature must remain disabled"},503);
 if(!String(req.headers.get("content-type")||"").startsWith("application/json"))return reply({ok:false,error:"JSON required"},400);
 if(Number(req.headers.get("content-length")||0)>500)return reply({ok:false,error:"Invalid request size"},413);
 const key=String(req.headers.get("X-Mamta-Wig-Bridge-Test")||"");
 if(key.length<48||key.length>300)return reply({ok:false,error:"Unauthorized"},403);
 const digest=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(key));
 const hex=Array.from(new Uint8Array(digest),x=>x.toString(16).padStart(2,"0")).join("");
 if(!hashEqual(hex,PROD_KEY_HASH_SHA256))return reply({ok:false,error:"Production key does not match configured verification identity"},403);
 try{
  const r=await fetch(GOOGLE_PRODUCTION_BRIDGE,{
   method:"POST",headers:{"content-type":"application/json"},
   body:JSON.stringify({secret:key,action:"MAMTA_WIG_AUTH_ONLY_NO_WRITE",record:{registration_id:"VERIFY-NO-WRITE"}}),
   redirect:"follow",signal:AbortSignal.timeout(16000)
  });
  let result=null;
  try{const text=await r.text();if(text.length<3000)result=JSON.parse(text)}catch{}
  const accepted=r.ok&&result?.ok===false&&result?.error==="Invalid registration ID";
  return reply({
   ok:accepted,productionAppsScriptReached:r.ok,productionKeyAccepted:accepted,
   cloudflareToGoogleConnection:accepted?"CONNECTED":"NOT VERIFIED",
   realPatientRecordsModified:false,sheetsWritten:false,emailsSent:false,
   note:accepted?"Google accepted the production key, then rejected an intentionally invalid ID before any writes":"No-write test did not confirm that Google accepted the production key"
  },accepted?200:502);
 }catch(e){return reply({ok:false,error:"Google Apps Script connection failed",kind:e?.name||"Error",sheetsWritten:false,emailsSent:false},502)}
}
