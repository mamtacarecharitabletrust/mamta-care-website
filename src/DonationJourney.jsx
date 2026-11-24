import React, {useState} from 'react';

const stages = [
  ['Hair Donation Completed','Donation registered'],
  ['Hair Received by Mamta Care','Awaiting hair receipt'],
  ['Hair in Transit','Awaiting transit update'],
  ['Received at Fabrication Centre','Awaiting fabrication centre receipt'],
  ['Hair Processing','Processing not started'],
  ['Wig Making','Wig making not started'],
  ['Hair Implantation','Hair implantation not started'],
  ['Wig Completion','Wig completion pending'],
  ['Final Wig Donation','Final donation pending']
];
const fields=[['donor','Donor name'],['donationDate','Donation date'],['certificateType','Certificate type'],['city','City'],['length','Hair length'],['hairType','Hair type'],['status','Certificate status'],['receivedDate','Received date'],['centre','Fabrication centre'],['updated','Last updated']];
function progress(result) {
  const d=result.certificate||{};
  const steps=stages.map(([title,detail])=>({title,detail,state:'Upcoming'}));
  const set=(n,detail,state='Completed')=>{steps[n-1]={...steps[n-1],detail,state};};
  set(1,'Donation registered');
  const matches=(v,re)=>v && !/estimated|awaiting|pending|not started|not received|not completed/i.test(v) && re.test(v);
  if(matches(d.hairReceived,/rec[ie]+ved|recived/i))set(2,'Hair received by Mamta Care');
  if(matches(d.transit,/transit/i)||matches(d.hairReceived,/transit/i))set(3,'Hair is currently in transit','In progress');
  if(matches(d.transit,/fabrication.*recei?ved|recei?ved.*fabrication/i))set(4,d.centre||'Hair received at fabrication centre');
  for(const [n,key,re] of [[5,'processing',/processing/i],[6,'making',/wig making|^completed$/i],[7,'implantation',/implant/i],[8,'completion',/wig completed/i],[9,'final',/^(completed|donated)$/i]]) {
    const v=d[key]; if(matches(v,re))set(n,n===9?'Wig donated to the beneficiary':v,/completed|implanted|donated/i.test(v)?'Completed':'In progress');
    else if(v && /^estimated/i.test(v))steps[n-1].detail=v;
  }
  const c=result.current;
  if(c?.phase==='collected' || c?.phase==='received')set(2,c.label);
  if(c?.phase==='transit' && steps[2].state==='Upcoming')set(3,c.label,'In progress');
  if(c?.phase==='fabrication' && /at the fabrication centre/i.test(c.label) && steps[3].state==='Upcoming')set(4,c.label);
  if(c?.phase==='fabrication' && /allocated/i.test(c.label) && steps[5].state==='Upcoming')set(6,c.label,'In progress');
  let last=steps.reduce((max,s,i)=>s.state==='Upcoming'?max:i,0);
  for(let i=1;i<last;i++)if(steps[i].state!=='Completed')set(i+1,i===2?'Transit completed':'Stage passed', 'Completed');
  if(last<8 && steps[last].state==='Completed')steps[last+1].state='Next stage';
  return steps;
}
export default function DonationJourney({result,onSync,busy}) {
  const [visible,setVisible]=useState(true);
  const d=result.certificate||{};
  if(result.current?.phase==='closed')return <section><h2>Application status</h2><p>{result.current.label}</p></section>;
  return <section aria-live="polite" className="mc-journey">
    <h2>Donation record</h2><p>Registration ID · {result.registration_id}</p>
    <dl>{fields.filter(([k])=>d[k]).map(([k,label])=><div key={k}><dt>{label}</dt><dd>{d[k]}</dd></div>)}</dl>
    <div className="journey-actions"><button type="button" aria-expanded={visible} onClick={()=>setVisible(!visible)}>{visible?'Hide tracking':'View tracking journey'}</button><button type="button" disabled={busy} onClick={onSync}>{busy?'Checking…':'Sync now'}</button></div>
    {visible && <><h2>Hair donation tracking journey</h2><ol>{progress(result).map((s,i)=><li key={s.title} data-state={s.state} aria-current={s.state==='In progress'||s.state==='Next stage'?'step':undefined}><span className="journey-dot" aria-hidden="true">{s.state==='Completed'?'✓':i+1}</span><div><h3>{s.title}</h3><small>{s.state}</small><p>{s.detail}</p></div></li>)}</ol></>}
  </section>;
}