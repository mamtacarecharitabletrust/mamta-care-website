const COOKIE="mc_test_photo_session";
const TARGET_ID="5653cd89-2183-4a27-8d68-802f116ff473";
const json=(data,status=200,headers={})=>new Response(JSON.stringify(data),{status,headers:{"Content-Type":"application/json","Cache-Control":"no-store","X-Content-Type-Options":"nosniff","X-Frame-Options":"DENY",...headers}});
const page=()=>new Response('<!DOCTYPE html><meta name="viewport" content="width=device-width,initial-scale=1"><title>Mamta Care TEST Photo Viewer</title><style>body{font-family:system-ui;max-width:650px;margin:30px auto;padding:15px;color:#163c34}input,button{padding:12px;margin:5px 0;width:100%;box-sizing:border-box}img{width:100%;max-width:320px;border-radius:12px}section{display:grid;grid-template-columns:1fr 1fr;gap:12px}@media(max-width:500px){section{grid-template-columns:1fr}}</style><h2>Mamta Care — TEST Photo Viewer</h2><p>Fictional photos only. Production Donor Desk is not connected.</p><form id="login"><input id="u" placeholder="TEST username" autocomplete="username" required><input id="p" type="password" placeholder="TEST password" autocomplete="current-password" required><button>Sign in</button></form><p id="msg"></p><section id="photos" hidden><div><h3>Front</h3><img id="front"></div><div><h3>Back</h3><img id="back"></div></section><button id="logout" hidden>Sign out</button><script>const $=id=>document.getElementById(id);$("login").onsubmit=async e=>{e.preventDefault();const r=await fetch("/api/login",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({username:$("u").value,password:$("p").value})});const v=await r.json();$("p").value="";if(!v.ok){$("msg").textContent=v.error;return;}$("login").hidden=true;$("logout").hidden=false;$("msg").textContent="Authenticated TEST account: "+v.user.display_name;await Promise.all(["front","back"].map(async side=>{const r=await fetch("/api/photo/"+side);if(r.ok){const blob=await r.blob();$(side).src=URL.createObjectURL(blob);$("photos").hidden=false;}else $("msg").textContent=side+": access denied ("+r.status+")";}));};$("logout").onclick=async()=>{await fetch("/api/logout",{method:"POST"});location.reload()};</script>',{headers:{"Content-Type":"text/html; charset=utf-8","Cache-Control":"no-store","Content-Security-Policy":"default-src 'none'; img-src 'self' blob:; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'","X-Frame-Options":"DENY"}});
const now=()=>Math.floor(Date.now()/1000);
const hex=arr=>Array.from(new Uint8Array(arr),x=>x.toString(16).padStart(2,"0")).join("");
const fromHex=str=>Uint8Array.from(str.match(/../g).map(x=>parseInt(x,16)));
const hash=async x=>hex(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(x)));
async function verify(password,record){const k=await crypto.subtle.importKey("raw",new TextEncoder().encode(password),"PBKDF2",false,["deriveBits"]);const bits=await crypto.subtle.deriveBits({name:"PBKDF2",salt:fromHex(record.salt_hex),iterations:record.iterations,hash:"SHA-256"},k,256);const a=new Uint8Array(bits),b=fromHex(record.password_hash_hex);let diff=a.length^b.length;for(let i=0;i<Math.min(a.length,b.length);i++)diff|=a[i]^b[i];return diff===0;}
const cookie=(req)=>new RegExp("(?:^|;\\s*)"+COOKIE+"=([a-f0-9]{64})(?:;|$)").exec(req.headers.get("Cookie")||"")?.[1];
const setCookie=(value,maxAge)=>COOKIE+"="+value+"; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age="+maxAge;
async function user(req,env){const c=cookie(req);if(!c)return null;return env.DB.prepare("SELECT st.username,st.display_name,st.role FROM sessions se JOIN staff st ON se.username=st.username WHERE se.token_hash=? AND se.expires_at>? AND st.active=1").bind(await hash(c),now()).first();}
const authorized=(u,d)=>u.role==="admin"||d.assigned_to===u.username;
export default {async fetch(req,env){const u=new URL(req.url),path=u.pathname;
if(path==="/"&&req.method==="GET")return page();
if(path==="/health"&&req.method==="GET")return json({ok:true,test:true,private:true});
if(path==="/api/login"&&req.method==="POST"){
if(req.headers.get("Origin")!==u.origin||!/^application\/json/.test(req.headers.get("Content-Type")||""))return json({ok:false,error:"Invalid origin"},403);
if(Number(req.headers.get("Content-Length")||0)>2000)return json({ok:false,error:"Bad request"},413);
let input;try{input=await req.json()}catch{return json({ok:false,error:"Bad request"},400)}
const username=String(input.username||"").trim().toLowerCase(),password=String(input.password||"");
if(!/^[a-z][a-z0-9_.-]{2,39}$/.test(username)||password.length>500)return json({ok:false,error:"Invalid credentials"},401);
const ip=req.headers.get("CF-Connecting-IP")||"unknown",attemptKey=await hash(ip+"|"+username);
const state=await env.DB.prepare("SELECT * FROM login_attempts WHERE attempt_key=?").bind(attemptKey).first();
if(state?.blocked_until>now())return json({ok:false,error:"Too many attempts"},429);
const account=await env.DB.prepare("SELECT s.* FROM staff s JOIN staff_login_names a ON a.username=s.username WHERE a.login_name=?").bind(username).first();
if(!(account?.active===1&&await verify(password,account))){const failures=state&&now()-state.window_started<900?state.failures+1:1;await env.DB.prepare("INSERT INTO login_attempts(attempt_key,failures,window_started,blocked_until) VALUES(?,?,?,?) ON CONFLICT(attempt_key) DO UPDATE SET failures=excluded.failures,window_started=excluded.window_started,blocked_until=excluded.blocked_until").bind(attemptKey,failures,state&&now()-state.window_started<900?state.window_started:now(),failures>=5?now()+900:0).run();return json({ok:false,error:"Invalid credentials"},401)}
await env.DB.prepare("DELETE FROM login_attempts WHERE attempt_key=?").bind(attemptKey).run();
const token=hex(crypto.getRandomValues(new Uint8Array(32)));
await env.DB.prepare("INSERT INTO sessions(token_hash,username,expires_at,created_at) VALUES(?,?,?,?)").bind(await hash(token),account.username,now()+3600,now()).run();
return json({ok:true,user:{display_name:account.display_name,role:account.role}},200,{"Set-Cookie":setCookie(token,3600)});
}
if(path==="/api/logout"&&req.method==="POST"){if(req.headers.get("Origin")!==u.origin)return json({ok:false,error:"Invalid origin"},403);const c=cookie(req);if(c)await env.DB.prepare("DELETE FROM sessions WHERE token_hash=?").bind(await hash(c)).run();return json({ok:true},200,{"Set-Cookie":setCookie("",0)});}
if(path.startsWith("/api/photo/")&&req.method==="GET"){
const actor=await user(req,env);if(!actor)return json({ok:false,error:"Please sign in"},401);
const donor=await env.DB.prepare("SELECT id,assigned_to FROM donors WHERE id=? AND source='website-test'").bind(TARGET_ID).first();
if(!donor)return json({ok:false,error:"Missing TEST donor"},404);
if(!authorized(actor,donor))return json({ok:false,error:"Not permitted"},403);
const side=path.split("/")[3];if(side!=="front"&&side!=="back")return json({ok:false,error:"Unknown side"},404);
const ref=await env.DB.prepare("SELECT object_key,mime_type FROM website_test_photo_refs WHERE donor_id=? AND side=?").bind(donor.id,side).first();
if(!ref)return json({ok:false,error:"Photo not found"},404);
const object=await env.WEBSITE_TEST_PHOTOS.get(ref.object_key);if(!object)return json({ok:false,error:"Photo unavailable"},404);
await env.DB.prepare("INSERT INTO donor_events(id,donor_id,actor,action,detail_json,happened_at) VALUES(?,?,?,?,?,?)").bind(crypto.randomUUID(),donor.id,actor.username,"website_test_photo_viewed",JSON.stringify({side}),now()).run();
return new Response(object.body,{headers:{"Content-Type":ref.mime_type,"Cache-Control":"private,no-store","X-Content-Type-Options":"nosniff","Content-Security-Policy":"default-src 'none'"}});
}
return json({ok:false,error:"Not found"},404);
}};
