// Local staging patch only. No deployment or credential access.
import {readFileSync,writeFileSync,copyFileSync} from 'node:fs';
import {dirname,join} from 'node:path';
const [workerPath,depositPath]=process.argv.slice(2);
if(!workerPath||!depositPath)throw Error('Provide staging worker.js and wig-security-deposit.mjs paths');
let w=readFileSync(workerPath,'utf8'),d=readFileSync(depositPath,'utf8');
const once=(s,a,b)=>{if(s.split(a).length!==2)throw Error('Integration anchor missing or ambiguous: '+a.slice(0,100));return s.replace(a,()=>b)};
if(w.includes('handleWigAgreementPublic')||d.includes('beneficiaryAgreementPanel'))throw Error('Already patched');
const anchor=' if(path==="/admin-wig-security-deposit"||path==="/api/admin/wig-security-deposit"||path.startsWith("/api/admin/wig-security-deposit/")){';
w=once(w,anchor,' if(path.startsWith("/wig-agreement/accept/")||path.startsWith("/wig-agreement/payment/"))return await handleWigAgreementPublic(req,env);\n if(path.startsWith("/api/admin/wig-beneficiary-agreements/")){const user=await currentUser(req,env.DB);return await handleWigAgreementAdmin(req,env,user);}\n'+anchor);
w='import {handleWigAgreementAdmin,handleWigAgreementPublic} from "./wig-beneficiary-worker.mjs";\n'+w;
const panel=readFileSync(new URL('../cloudflare/wig-beneficiary-admin-panel.js',import.meta.url),'utf8').trim();
d=once(d,' function show(){',panel+'\n function show(){');
const recordAnchor=' if(r.legacy&&!r.state){';
d=once(d,recordAnchor,' beneficiaryAgreementPanel(a,r);\n'+recordAnchor);
writeFileSync(workerPath+'.before-agreement',readFileSync(workerPath));writeFileSync(depositPath+'.before-agreement',readFileSync(depositPath));
writeFileSync(workerPath,w);writeFileSync(depositPath,d);
for(const file of ['wig-beneficiary-worker.mjs','wig-beneficiary-agreement.mjs'])copyFileSync(new URL('../cloudflare/'+file,import.meta.url),join(dirname(workerPath),file));
console.log('Local staging integration prepared. Production unchanged.');
