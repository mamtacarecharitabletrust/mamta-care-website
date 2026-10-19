
const ALLOWED_ORIGIN = "https://mamta-care-website-git-feature-f50fbb-mamtacarecharitabletrust.vercel.app";
const MAX_BYTES = 4 * 1024 * 1024;
const UUID_RE = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const REG_RE = /^\d{4}-\d{6,}\/M\/2022$/;

function base64url(bytes) {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
function unbase64url(value) {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) throw new Error("Invalid encoding");
  return Uint8Array.from(atob(value.replace(/-/g, "+").replace(/_/g, "/")), c => c.charCodeAt(0));
}
async function verifyToken(token, secret) {
  if (!secret || secret.length < 40) throw new Error("Signing key unavailable");
  const parts = String(token).split(".");
  if (parts.length !== 3 || parts[0] !== "mt1" || parts[1].length > 800) throw new Error("Invalid token");
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), {name:"HMAC",hash:"SHA-256"}, false, ["sign"]);
  const signature = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(parts[0]+"."+parts[1])));
  const expected = base64url(signature);
  if (expected.length !== parts[2].length) throw new Error("Wrong signature");
  let diff = 0;
  for (let i=0;i<expected.length;i++) diff |= expected.charCodeAt(i) ^ parts[2].charCodeAt(i);
  if (diff) throw new Error("Wrong signature");
  const details = JSON.parse(new TextDecoder().decode(unbase64url(parts[1])));
  const now = Math.floor(Date.now()/1000);
  if (details.scope !== "mamta-fictional-photos" ||
      !UUID_RE.test(details.uuid) ||
      !REG_RE.test(details.registration_id) ||
      !Number.isInteger(details.exp) || details.exp <= now || details.exp > now + 901) {
    throw new Error("Expired or invalid token");
  }
  return details;
}
function respond(data,status,origin) {
  return new Response(JSON.stringify(data),{status,headers:{
    "Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store",
    "X-Content-Type-Options":"nosniff",
    ...(origin===ALLOWED_ORIGIN?{"Access-Control-Allow-Origin":origin,"Vary":"Origin"}:{})
  }});
}
async function readImage(req) {
  if (!req.body) throw new Error("Missing body");
  const reader = req.body.getReader(), parts=[];
  let bytes=0;
  while (true) {
    const {done,value}=await reader.read();
    if (done) break;
    bytes+=value.byteLength;
    if (bytes>MAX_BYTES) {await reader.cancel();throw new Error("Photo too large");}
    parts.push(value);
  }
  if (bytes<24) throw new Error("Photo too small");
  const result=new Uint8Array(bytes), chunks=parts;
  let offset=0; for(const chunk of chunks){result.set(chunk,offset);offset+=chunk.byteLength;}
  return result;
}
function magicValid(buffer,kind) {
  const b=buffer;
  if(kind==="image/jpeg") return b[0]===255&&b[1]===216&&b[2]===255;
  if(kind==="image/png") return [137,80,78,71,13,10,26,10].every((x,i)=>b[i]===x);
  if(kind==="image/webp") return [82,73,70,70].every((x,i)=>b[i]===x)&&[87,69,66,80].every((x,i)=>b[i+8]===x);
  return false;
}
export default {
  async fetch(req,env) {
    const url=new URL(req.url),origin=req.headers.get("Origin")||"";
    if(url.pathname==="/health"&&req.method==="GET")
      return respond({ok:true,environment:"FICTIONAL_TEST",private_storage:true},200,origin);
    if(url.pathname!=="/api/test-photo"&&url.pathname!=="/api/test-photo-status")
      return respond({ok:false,error:"Not found"},404,origin);
    if(origin!==ALLOWED_ORIGIN) return respond({ok:false,error:"Origin not allowed"},403,origin);
    if(req.method==="OPTIONS") return new Response(null,{status:204,headers:{
      "Access-Control-Allow-Origin":origin,"Access-Control-Allow-Methods":"POST,GET,OPTIONS",
      "Access-Control-Allow-Headers":"Authorization,Content-Type","Access-Control-Max-Age":"600","Vary":"Origin"}});
    const needsPost=url.pathname==="/api/test-photo";
    if(req.method!==(needsPost?"POST":"GET")) return respond({ok:false,error:"Method not allowed"},405,origin);
    let token;
    try {
      const a=req.headers.get("Authorization")||"";
      if(!a.startsWith("Bearer ")||a.length>1400) throw new Error("Missing token");
      token=await verifyToken(a.slice(7),env.PHOTO_UPLOAD_HMAC_SECRET);
    }catch(_) {return respond({ok:false,error:"Photo authorization expired or invalid"},401,origin);}
    if(!env.DB||!env.DONOR_PHOTOS) return respond({ok:false,error:"Storage not configured"},503,origin);
    if(!needsPost){
      const r=await env.DB.prepare("SELECT side FROM photo_uploads WHERE donor_uuid=? AND registration_id=?")
        .bind(token.uuid,token.registration_id).all();
      const sides=(r.results||[]).map(x=>x.side);
      return respond({ok:true,front:sides.includes("front"),back:sides.includes("back")},200,origin);
    }
    const side=url.searchParams.get("side");
    if(side!=="front"&&side!=="back") return respond({ok:false,error:"Invalid photo side"},400,origin);
    const type=(req.headers.get("Content-Type")||"").split(";")[0].toLowerCase();
    if(!["image/jpeg","image/png","image/webp"].includes(type))
      return respond({ok:false,error:"JPG, PNG or WebP required"},415,origin);
    const len=Number(req.headers.get("Content-Length")||0);
    if(len>MAX_BYTES)return respond({ok:false,error:"Maximum 4 MB per photo"},413,origin);
    let buffer;
    try {buffer=await readImage(req);}catch(_){return respond({ok:false,error:"Invalid photo size (maximum 4 MB)"},413,origin);}
    if(!magicValid(buffer,type)) return respond({ok:false,error:"Photo format mismatch"},415,origin);
    const extension=type==="image/jpeg"?"jpg":type==="image/png"?"png":"webp";
    const objectKey="fictional-test/"+token.uuid+"/"+side+"."+extension;
    try {
      const r=await env.DB.prepare("INSERT OR IGNORE INTO photo_uploads(donor_uuid,registration_id,side,object_key,content_type,size_bytes) VALUES(?,?,?,?,?,?)")
        .bind(token.uuid,token.registration_id,side,objectKey,type,buffer.byteLength).run();
      if((r.meta?.changes||0)!==1)
        return respond({ok:false,error:"Photo already registered; duplicate prevented"},409,origin);
      try {
        await env.DONOR_PHOTOS.put(objectKey,buffer,{httpMetadata:{contentType:type},customMetadata:{registration_id:token.registration_id,test_only:"true"}});
      } catch (_) {
        try {await env.DB.prepare("DELETE FROM photo_uploads WHERE donor_uuid=? AND side=? AND object_key=?")
          .bind(token.uuid,side,objectKey).run();}catch(_){}
        return respond({ok:false,error:"Photo storage uncertain; ask an administrator before retrying"},503,origin);
      }
      return respond({ok:true,side,bytes:buffer.byteLength,private:true},201,origin);
    }catch(_) {return respond({ok:false,error:"Photo upload requires review"},503,origin);}
  }
};
