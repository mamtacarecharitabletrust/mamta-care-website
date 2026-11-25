const opening=[
 'Thank you for growing your hair with someone else in mind.',
 'Your gift brings a personal touch to the work of making a wig.',
 'We appreciate the care you took to keep your donated hair together.',
 'There is time and patience in every strand you shared.',
 'Thank you for choosing to pass your hair on to someone who can use it.',
 'A haircut lasts a moment. Growing the hair takes much longer.',
 'Your donation gives our wig makers material they can work with.',
 'It takes generosity to give something you have spent time growing.',
 'Thank you for making hair donation part of your own story.',
 'Your gift began long before the day you decided to share it.',
 'We are grateful for the trust you placed in Mamta Care.',
 'Your donation is one way of standing beside people going through treatment.'
];
const closing=[
 'We are glad you chose Mamta Care for your donation.',
 'Our team appreciates the person behind this gift.',
 'Thank you for supporting access to wigs during cancer treatment.',
 'We value the thought you put into this act of care.',
 'Your contribution has a place in our community of donors.',
 'We are grateful to carry your kindness forward.',
 'Thank you for taking the time to see your donation through.',
 'We recognise the patience behind your generosity.',
 'Our women-led team sends you its thanks.',
 'Your support matters to the people doing this work.',
 'We appreciate your part in making donated-hair wigs possible.',
 'Thank you for sharing what you could, in your own way.'
];
export function appreciation(seq){
 // Multiplication by a number coprime to the pool length visits every pair once.
 const index=((seq-1)*53)%(opening.length*closing.length);
 const text=opening[index%opening.length]+' '+closing[Math.floor(index/opening.length)];
 return seq<=opening.length*closing.length?text:'With thanks for contribution '+seq+' — '+text;
}
export function donationLabel(raw){
 const value=String(raw||'').trim();
 const full=/^(bald\s*\(full length\)|full head shave|complete head shave|head shave)$/i.test(value);
 if(full)return 'Full head shave';
 const length=/^(\d{1,3}(?:\.\d{1,2})?)(?:\s*(?:-|–|—|to)\s*(\d{1,3}(?:\.\d{1,2})?))?\s*(?:inches|inch|in|["″])$/i.exec(value);
 if(length)return length[1]+(length[2]?'–'+length[2]:'')+' inches';
 return 'Hair donation';
}
const eligible=" FROM mc_public_appreciations a JOIN donors d ON d.id=a.donor_id WHERE upper(trim(d.verification_status))='VERIFIED' AND NOT EXISTS (SELECT 1 FROM mc_donor_recycle r WHERE r.donor_id=d.id)";
const headers={'Cache-Control':'no-store','Access-Control-Allow-Origin':'https://mamta-care-website.vercel.app','X-Content-Type-Options':'nosniff'};
export async function publicCards(req,env){
 const offset=Number(new URL(req.url).searchParams.get('offset')||0);
 if(!Number.isSafeInteger(offset)||offset<0||offset>1000000)return Response.json({error:'Invalid page'},{status:400,headers});
 const start=Math.floor((Date.now()/1000+19800)/86400)*86400-19800;
 const [counts,page]=await env.APPRECIATIONS_DB.batch([
  env.APPRECIATIONS_DB.prepare('SELECT count(*) AS n'+eligible+' AND a.first_verified>=? AND a.first_verified<?').bind(start,start+86400),
  env.APPRECIATIONS_DB.prepare('SELECT a.seq,d.hair_length'+eligible+' AND a.hidden=0 ORDER BY a.first_verified IS NULL,a.first_verified DESC,a.seq DESC LIMIT 7 OFFSET ?').bind(offset)
 ]);
 const items=page.results.slice(0,6).map(r=>({id:r.seq,label:donationLabel(r.hair_length),quote:appreciation(r.seq)}));
 return Response.json({today:counts.results[0].n,items,more:page.results.length>6},{headers});
}
export async function hideCard(req,env){
 const input=await req.json();const number=Number(input.card),reg=String(input.registration||'').trim().toUpperCase();
 let result;if(reg&&reg.length<=80){
  result=await env.APPRECIATIONS_DB.prepare("UPDATE mc_public_appreciations SET hidden=1 WHERE donor_id IN (SELECT id FROM donors WHERE upper(trim(registration_id))=?)").bind(reg).run();
 }else if(Number.isSafeInteger(number)&&number>0){result=await env.APPRECIATIONS_DB.prepare('UPDATE mc_public_appreciations SET hidden=1 WHERE seq=?').bind(number).run();}
 return Response.json(result?.meta?.changes?{ok:true}:{error:'No matching card found'},{status:result?.meta?.changes?200:404,headers:{'Cache-Control':'no-store'}});
}