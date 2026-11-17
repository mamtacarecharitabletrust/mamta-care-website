import test from "node:test";
import assert from "node:assert/strict";
import worker from "../cloudflare/mamta-website-hair-registration.mjs";
import {readFileSync} from "node:fs";

const origin="https://mamta-care-website.vercel.app";
const uuid="12345678-1234-4234-a234-123456789abc";
const officialId="2026-101104/M/2022";

function harness(mode="done"){
  const intakes=new Map(),photos=new Map(),objects=new Map(),actions=[],deferred=[];
  const db={
    prepare(sql){
      return {bind(...args){return {
        async run(){
          if(sql.startsWith("INSERT OR IGNORE INTO website_form_intakes")){
            if(intakes.has(args[0]))return {meta:{changes:0}};
            intakes.set(args[0],{submission_uuid:args[0],state:args[1],front_key:args[2],back_key:args[3],created_at:args[4],updated_at:args[5],registration_id:null});
            return {meta:{changes:1}};
          }
          if(sql.startsWith("UPDATE website_form_intakes SET state='FORM_SYNC_PENDING'")){
            const row=intakes.get(args[1]);if(row){row.state="FORM_SYNC_PENDING";row.updated_at=args[0];}
            return {meta:{changes:row?1:0}};
          }
          if(sql.startsWith("UPDATE website_form_intakes SET state='COMPLETE'")){
            const [id,now,submissionId,frontId,frontKey,backId,backKey]=args;
            const row=intakes.get(submissionId);
            const matching=photos.get(frontId+"|front")?.key===frontKey&&photos.get(backId+"|back")?.key===backKey;
            if(!row||!matching||row.state==="COMPLETE")return {meta:{changes:0}};
            row.state="COMPLETE";row.registration_id=id;row.updated_at=now;
            return {meta:{changes:1}};
          }
          if(sql.startsWith("UPDATE website_form_intakes SET updated_at=?")){
            const row=intakes.get(args[1]);if(!row||row.updated_at!==args[2]||!["PHOTOS_STORED","FORM_SYNC_PENDING"].includes(row.state))return {meta:{changes:0}};
            row.updated_at=args[0];return {meta:{changes:1}};
          }
          if(sql.startsWith("INSERT OR IGNORE INTO website_hair_photos")){
            const [id,side,key,mime,size]=args,name=id+"|"+side;
            if(photos.has(name))return {meta:{changes:0}};
            photos.set(name,{key,mime,size});return {meta:{changes:1}};
          }
          if(sql.startsWith("UPDATE website_form_intakes SET state='RESERVED'"))return {meta:{changes:0}};
          throw Error("Unexpected query: "+sql);
        },
        async first(){
          if(sql.startsWith("SELECT")&&sql.includes("FROM website_form_intakes"))
            return intakes.get(args[0])?{...intakes.get(args[0])}:null;
          throw Error("Unexpected SELECT: "+sql);
        }
      }}};
    },
    async batch(statements){const out=[];for(const st of statements)out.push(await st.run());return out;}
  };
  const env={
    DB:db,
    DONOR_PHOTOS:{
      async put(key,bytes,metadata){objects.set(key,{bytes,size:bytes.byteLength,httpMetadata:metadata.httpMetadata});},
      async head(key){return objects.get(key)||null;}
    },
    REGISTRATION_ENABLED:"true",INTEGRATION_VERIFIED:"true",
    TURNSTILE_SECRET:"test-secret",GOOGLE_FORM_BRIDGE_SECRET:"test-bridge-secret",
    GOOGLE_FORM_BRIDGE_URL:"https://script.google.com/macros/s/syntheticTestOnly123/exec"
  };
  const oldFetch=globalThis.fetch;
  globalThis.fetch=async(url,opts={})=>{
    if(String(url).includes("challenges.cloudflare.com/turnstile"))return Response.json({success:true,hostname:"mamta-care-website.vercel.app"});
    if(String(url).includes("script.google.com/macros/s/")){
      const p=JSON.parse(opts.body);actions.push(p.action);
      if(p.action==="website_submit")return Response.json(mode==="done"?{ok:true,registration_id:officialId}:{ok:false,pending:true});
      if(p.action==="website_status")return Response.json(mode==="done"?{ok:true,registration_id:officialId}:{ok:false,pending:true});
    }
    throw Error("Unexpected fetch "+url);
  };
  return {
    intakes,photos,objects,actions,deferred,env,
    setMode(next){mode=next;},restore(){globalThis.fetch=oldFetch;},
    async request(){
      const data=new FormData();
      Object.entries({submission_uuid:uuid,turnstile:"synthetic",full_name:"Example Donor",phone:"9999999999",email:"example@example.test",gender:"FEMALE",hair_length:"14-16INCHES",city:"Test City",hair_type:"STRAIGHT",guidance:"YES",readiness:"planning to donate",referral_source:"FRIENDS/FAMILY",method:"haircut",voluntary:"yes",private_photos:"yes"}).forEach(([k,v])=>data.append(k,v));
      const bytes=new Uint8Array([255,216,255,100,200]);
      data.append("front",new File([bytes],"front.jpg",{type:"image/jpeg"}));
      data.append("back",new File([bytes],"back.jpg",{type:"image/jpeg"}));
      return worker.fetch(new Request("https://worker.test/api/register",{method:"POST",headers:{Origin:origin},body:data}),env,{waitUntil(p){deferred.push(p);}});
    },
    status(){return worker.fetch(new Request("https://worker.test/api/registration-status?submission_uuid="+uuid,{headers:{Origin:origin}}),env);}
  };
}

test("fast photo receipt returns the real original Form ID when available",async()=>{
  const h=harness("done");
  try{
    const res=await h.request(),x=await res.json();
    assert.equal(res.status,201);assert.equal(x.registration_id,officialId);
    assert.equal(h.objects.size,2);assert.equal(h.photos.size,2);
    assert.equal(h.intakes.get(uuid).state,"COMPLETE");
    assert.deepEqual(h.actions,["website_submit"]);
    await Promise.all(h.deferred);
  }finally{h.restore();}
});

test("pending Google Form does not block photo acknowledgement or make up an ID; later status links it once",async()=>{
  const h=harness("pending");
  try{
    const started=Date.now();
    const first=await h.request(),x=await first.json();
    assert.equal(first.status,202);
    assert.equal(x.photos_received,true);
    assert.equal(x.registration_id,undefined);
    assert.ok(Date.now()-started<4000,"receipt should not wait on Google");
    assert.equal(h.intakes.get(uuid).state,"FORM_SYNC_PENDING");
    assert.equal(h.objects.size,2);
    await Promise.all(h.deferred);
    h.intakes.get(uuid).updated_at=Date.now()-15000;
    h.setMode("done");
    const status=await h.status(),y=await status.json();
    assert.equal(status.status,200);
    assert.equal(y.registration_id,officialId);
    assert.equal(h.photos.size,2);
    assert.equal(h.intakes.get(uuid).state,"COMPLETE");
    const actionsBefore=h.actions.length;
    const again=await h.status();
    assert.equal(again.status,200);
    assert.equal(h.actions.length,actionsBefore,"completed records must not call Google again");
    const duplicate=await h.request(),z=await duplicate.json();
    assert.equal(duplicate.status,200);
    assert.equal(z.registration_id,officialId);
    assert.equal(h.actions.length,actionsBefore,"same UUID must not create another Form response");
  }finally{h.restore();}
});

test("the Worker never invents donor IDs or sends confirmation emails itself",()=>{
  const src=readFileSync("cloudflare/mamta-website-hair-registration.mjs","utf8");
  assert.match(src,/ctx\.waitUntil\(sync\)/);
  assert.match(src,/DONOR_PHOTOS\.put\(key1/);
  assert.match(src,/DONOR_PHOTOS\.put\(key2/);
  assert.match(src,/action:"website_status"/);
  assert.doesNotMatch(src,/MailApp\.sendEmail|INSERT INTO donors|new Date\(\)\.getFullYear\(\).+M\/2022/);
});
