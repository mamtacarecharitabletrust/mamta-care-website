import test from 'node:test';
import assert from 'node:assert/strict';
import {handleWigAgreementAdmin,handleWigAgreementPublic} from '../cloudflare/wig-beneficiary-worker.mjs';
const origin='https://mamta-donor-desk-launch-new.bharathairseva-in.workers.dev',id='aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
const url=origin+'/api/admin/wig-beneficiary-agreements/'+id;
test('anonymous and staff cannot access agreements',async()=>{for(const user of [null,{role:'staff',username:'demo'}])assert.equal((await handleWigAgreementAdmin(new Request(url+'/status'),{},user)).status,401)});
test('admin mutations require exact origin and header',async()=>{for(const headers of [{'content-type':'application/json','origin':'https://wrong.invalid','x-mamta-desk':'1'},{'content-type':'application/json','origin':origin}])assert.equal((await handleWigAgreementAdmin(new Request(url+'/prepare',{method:'POST',headers,body:'{}'}),{},{role:'admin',username:'demo'})).status,403)});
test('malformed public links and wrong origin rejected without DB access',async()=>{for(const link of [origin+'/wig-agreement/accept/invalid',origin+'/wig-agreement/payment/invalid','https://wrong.invalid/wig-agreement/accept/'+'a'.repeat(64)])assert.equal((await handleWigAgreementPublic(new Request(link),{})).status,404)});
