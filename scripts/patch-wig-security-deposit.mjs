// Patch a private downloaded worker.js copy, not a production deployment.
// Usage: node scripts/patch-wig-security-deposit.mjs /private/staging/worker.js
import {readFileSync,writeFileSync} from 'node:fs';
const path=process.argv[2];if(!path)throw Error('Provide a private staging worker.js path');
let s=readFileSync(path,'utf8');
function replaceOne(old,next){const n=s.split(old).length-1;if(n!==1)throw Error('Expected one integration anchor; found '+n);s=s.replace(old,next)}
if(s.includes('handleWigSecurityDeposit'))throw Error('Already patched');
const anchor=' if(path==="/api/public/wig-v8"||path==="/admin-wig-v8"||path.startsWith("/api/admin/wig-v8")){';
replaceOne(anchor,' if(path==="/admin-wig-security-deposit"||path==="/api/admin/wig-security-deposit"||path.startsWith("/api/admin/wig-security-deposit/")){\n  const user=await currentUser(req,env.DB);return await handleWigSecurityDeposit(req,env,user);\n }\n'+anchor);
const nav='<a class="mc186-category" href="/admin-wig-v8" aria-label="Review Wig Assistance applications">';
replaceOne(nav,'<a class="mc186-category" href="/admin-wig-security-deposit" aria-label="Wig Security Deposit"><span class="mc185-disc" aria-hidden="true" style="background:#70203e">₹</span><span class="mc185-name">Wig Security Deposit</span></a>'+nav);
s='import {handleWigSecurityDeposit} from "./wig-security-deposit.mjs";\n'+s;
writeFileSync(path,s);
