const base='/app/donor-gallery';
const prefix='/public/donor-portraits/';
const source=" FROM mc_public_appreciations a JOIN donors d ON d.id=a.donor_id LEFT JOIN mcy_donor_media y ON y.donor_id=d.id AND y.stage='after' LEFT JOIN mcx_after_photos x ON x.donor_id=d.id LEFT JOIN mc_gallery_grants g ON g.donor_id=d.id WHERE a.hidden=0 AND upper(trim(d.verification_status))='VERIFIED' AND NOT EXISTS(SELECT 1 FROM mc_donor_recycle r WHERE r.donor_id=d.id) AND coalesce(y.object_key,x.object_key) IS NOT NULL AND length(trim(d.full_name))>0 AND length(trim(d.city))>0";
const columns='SELECT d.id,d.full_name,d.city,a.seq,coalesce(y.object_key,x.object_key) AS photo,coalesce(y.mime,x.mime) AS mime,g.public_id'+source;
const active=' AND g.source_key=coalesce(y.object_key,x.object_key) AND g.display_name=d.full_name AND g.city=d.city';
const headers={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'};
const reply=(s,status=200)=>new Response(s,{status,headers});
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
async function revision(r){const bytes=new TextEncoder().encode(JSON.stringify([r.id,r.photo,r.full_name,r.city]));return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');}
export async function gallery(req,env,currentUser){
 const url=new URL(req.url),path=url.pathname;
 if(path.startsWith(prefix)){
  const id=path.slice(prefix.length); if(req.method!=='GET'||!/^[a-f0-9-]{36}$/.test(id))return reply('',404);
  const row=await env.DB.prepare('SELECT g.public_id'+source+active+' AND g.public_id=?').bind(id).first();
  if(!row)return reply('',404); const obj=await env.DONOR_PHOTOS.get('gallery-portraits/full/'+id+'.jpg') || await env.DONOR_PHOTOS.get('gallery-portraits/'+id+'.jpg');
  return obj?new Response(obj.body,{headers:{...headers,'Content-Type':'image/jpeg'}}):reply('',404);
 }
 if(path!==base&&!path.startsWith(base+'/'))return null;
 const actor=await currentUser(req,env.DB);if(actor?.role!=='admin')return reply('Administrator sign-in required',403);
 if(req.method==='POST'&&req.headers.get('origin')!==url.origin)return reply('Origin mismatch',403);
 if(path===base&&req.method==='GET'){
  const rows=(await env.DB.prepare(columns+' ORDER BY a.seq DESC').all()).results;
  const cards=await Promise.all(rows.map(async r=>{const rev=await revision(r);return '<article data-seq="'+r.seq+'" data-rev="'+rev+'"><img width="100" height="100" loading="lazy" src="'+base+'/preview?id='+r.seq+'&amp;rev='+rev+'" alt="After-haircut photo"><div><strong>'+esc(r.full_name)+'</strong><br>'+esc(r.city)+'</div>'+ (r.public_id?'<button data-action="hide">Remove from website</button>':'<label><input type="checkbox"> I confirm this donor gave permission to publish this photo with this name and city on the Mamta Care website.</label><button data-action="publish">Publish donor card</button>')+'<output aria-live="polite"></output></article>'}));
  const nonce=crypto.randomUUID();return new Response('<!doctype html><html lang="en"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Donor gallery | Mamta Care</title><style nonce="'+nonce+'">body{font:16px/1.5 system-ui;background:#fffaf8;color:#432137;max-width:760px;padding:20px;margin:auto}article{border-bottom:1px solid #decfd4;padding:20px 0;display:grid;grid-template-columns:100px 1fr;align-items:center;gap:12px}img{object-fit:contain;border-radius:8px}label,button,output{grid-column:1/-1}button{width:fit-content;background:#692343;color:white;border:0;border-radius:8px;padding:12px;font:inherit}</style><a href="/app/premium">← Donor Desk</a><h1>Donor gallery</h1><p>Verified donors with an after-haircut photo.</p>'+ (cards.join('')||'<p>No eligible photos.</p>')+'<script nonce="'+nonce+'">'+client.toString()+';client();</script></html>',{headers:{...headers,'Content-Type':'text/html; charset=utf-8','Content-Security-Policy':"default-src 'none'; img-src 'self'; connect-src 'self'; frame-ancestors 'none'; script-src 'nonce-"+nonce+"'; style-src 'nonce-"+nonce+"'"}})
 }
 const seq=Number(url.searchParams.get('id'));if(!Number.isSafeInteger(seq)||seq<=0)return reply('',400);
 const row=await env.DB.prepare(columns+' AND a.seq=?').bind(seq).first();
 if(!row||await revision(row)!==url.searchParams.get('rev'))return reply('Record changed. Reload the gallery.',409);
 if(path===base+'/preview'&&req.method==='GET'){
  if(!/^image\/(jpeg|jpg|png|webp|avif)$/i.test(row.mime))return reply('Unsupported image',415);
  const obj=await env.DONOR_PHOTOS.get(row.photo);return obj?new Response(obj.body,{headers:{...headers,'Content-Type':row.mime}}):reply('',404)
 }
 if(req.method!=='POST')return reply('',405);
 if(path===base+'/hide'){await env.DB.prepare('UPDATE mc_public_appreciations SET hidden=1 WHERE seq=?').bind(seq).run();return reply('Removed');}
 if(path!==base+'/publish'||req.headers.get('x-publication-permission')!=='confirmed'||req.headers.get('content-type')!=='image/jpeg')return reply('',400);
 if(Number(req.headers.get('content-length'))>1000000)return reply('',413);
 const bytes=new Uint8Array(await req.arrayBuffer());if(bytes.length>1000000||bytes[0]!==255||bytes[1]!==216||bytes.at(-2)!==255||bytes.at(-1)!==217)return reply('Invalid thumbnail',400);
 const id=crypto.randomUUID(),key='gallery-portraits/full/'+id+'.jpg';await env.DONOR_PHOTOS.put(key,bytes,{httpMetadata:{contentType:'image/jpeg'}});
 try{const res=await env.DB.prepare('INSERT INTO mc_gallery_grants(donor_id,public_id,source_key,display_name,city,approved_by,approved_at) SELECT d.id,?,coalesce(y.object_key,x.object_key),d.full_name,d.city,?,unixepoch()'+source+' AND a.seq=? AND coalesce(y.object_key,x.object_key)=? AND d.full_name=? AND d.city=? AND g.public_id IS NULL ON CONFLICT(donor_id) DO NOTHING').bind(id,actor.username,seq,row.photo,row.full_name,row.city).run();if(!res.meta.changes){await env.DONOR_PHOTOS.delete(key);return reply('Record changed. Reload the gallery.',409)}}catch(error){await env.DONOR_PHOTOS.delete(key);throw error}
 return reply('Published');
}
function client(){document.addEventListener('click',async event=>{
 const button=event.target.closest('button');if(!button)return;
 const card=button.closest('article'),out=card.querySelector('output'),action=button.dataset.action;
 if(action==='publish'&&!card.querySelector('input').checked){out.textContent='Confirm the publication permission first.';return}
 if(action==='hide'&&!confirm('Remove this donor card from the public website?'))return;
 button.disabled=true;
 try{const opts={method:'POST'};if(action==='publish'){const img=card.querySelector('img');await img.decode();const scale=Math.min(1,960/Math.max(img.naturalWidth,img.naturalHeight));
 const c=document.createElement('canvas');c.width=Math.max(1,Math.round(img.naturalWidth*scale));c.height=Math.max(1,Math.round(img.naturalHeight*scale));
 const context=c.getContext('2d');context.fillStyle='#fff';context.fillRect(0,0,c.width,c.height);context.imageSmoothingQuality='high';context.drawImage(img,0,0,c.width,c.height);
 opts.body=await new Promise(resolve=>c.toBlob(resolve,'image/jpeg',0.92));opts.headers={'content-type':'image/jpeg','x-publication-permission':'confirmed'}}
 const r=await fetch(location.pathname+'/'+action+'?id='+card.dataset.seq+'&rev='+card.dataset.rev,opts);if(!r.ok)throw Error(await r.text()||'Update failed');location.reload()
 }catch(e){out.textContent=e.message;button.disabled=false}
})}
