/* Staging-only signed, no-write diagnostic. Do NOT include in live Worker. */
const textEncoder=new TextEncoder();
function secureEqual(a,b){
  const aa=textEncoder.encode(String(a||"")),bb=textEncoder.encode(String(b||""));
  if(aa.length!==bb.length||aa.length<48)return false;
  let mismatch=0;for(let i=0;i<aa.length;i++)mismatch|=aa[i]^bb[i];
  return mismatch===0;
}
export async function testWigBridgeFromStaging(request,env){
  const p=new URL(request.url).pathname;
  if(p!=="/internal/wig-bridge-test"||request.method!=="POST")return null;
  const key=String(env.WIG_SHEET_BRIDGE_SECRET||"");
  if(!secureEqual(request.headers.get("X-Mamta-Wig-Bridge-Test"),key))
    return new Response(JSON.stringify({ok:false,error:"Diagnostic authorization failed"}),{status:403,headers:{"content-type":"application/json","cache-control":"no-store"}});
  const target=String(env.WIG_SHEET_BRIDGE_URL||"");
  let url;try{url=new URL(target)}catch{return new Response(JSON.stringify({ok:false,error:"Bridge URL missing"}),{status:503,headers:{"content-type":"application/json","cache-control":"no-store"}})}
  if(url.protocol!=="https:"||url.hostname!=="script.google.com"||!/^\/macros\/s\/[^/]+\/exec$/.test(url.pathname))
    return new Response(JSON.stringify({ok:false,error:"Bridge URL has unexpected format"}),{status:503,headers:{"content-type":"application/json","cache-control":"no-store"}});
  try{
    // The deployed Apps Script checks the shared key *before* checking the action.
    // "Unknown action" is the expected response for this authenticated no-op probe.
    const response=await fetch(url.toString(),{
      method:"POST",headers:{"content-type":"application/json"},
      body:JSON.stringify({action:"MAMTA_NO_WRITE_CONNECTION_DIAGNOSTIC",secret:key,record:{registration_id:"2099/010101"}}),
      redirect:"follow",signal:AbortSignal.timeout(15000)
    });
    const body=await response.text();
    let data;try{data=JSON.parse(body)}catch{
      return new Response(JSON.stringify({ok:false,check:"cloudflare_to_google",error:"Apps Script returned non-JSON; check Web App access and deployment",upstreamStatus:response.status}),{status:502,headers:{"content-type":"application/json","cache-control":"no-store"}});
    }
    const connected=response.ok&&data?.ok===false&&data?.error==="Unknown action";
    return new Response(JSON.stringify({ok:connected,check:"cloudflare_to_google",securityKeyMatch:connected,googleReachable:response.ok,diagnosticOnly:true,sheetsWritten:false,emailSent:false,reason:connected?"Shared key accepted by deployed Apps Script":data?.error==="Not authorized"?"Apps Script did not accept the security key":"Unexpected Google bridge response"}),{
      status:connected?200:502,headers:{"content-type":"application/json","cache-control":"no-store","x-content-type-options":"nosniff"}
    });
  }catch(e){
    return new Response(JSON.stringify({ok:false,check:"cloudflare_to_google",error:"Cloudflare could not reach deployed Apps Script",kind:e?.name||"Error"}),{
      status:502,headers:{"content-type":"application/json","cache-control":"no-store"}
    });
  }
}