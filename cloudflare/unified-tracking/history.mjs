export function buildHistory(certIds, stages, newPhones, newIds, oldPhones, oldIds) {
  const normalize = value => String(value || '').trim().toUpperCase();
  const validId = value => /^[A-Z0-9][A-Z0-9/_-]{5,74}$/.test(value);
  const phones = new Map();
  for (const [numbers, ids] of [[newPhones,newIds], [oldPhones,oldIds]]) {
    ids.forEach((row,i) => {
      const id = normalize(row[0]);
      if (!validId(id)) return;
      const digits = String(numbers[i]?.[0] || '').replace(/\D/g,'');
      if (!phones.has(id)) phones.set(id,new Set());
      phones.get(id).add(digits.length >= 10 && digits.length <= 15 ? digits : '');
    });
  }
  const history = new Map();
  for (const [i,row] of certIds.entries()) {
    const id = normalize(row[0]);
    if (!validId(id)) continue;
    if (history.has(id)) { history.set(id,null); continue; }
    const numbers = phones.get(id);
    const suffix = numbers?.size === 1 ? [...numbers][0].slice(-4) : '';
    const cells = stages[i] || [];
    const timeline = [];
    const put = label => { if (!timeline.includes(label)) timeline.push(label); };
    const cell = index => String(cells[index] || '').trim();
    if (/^(hair\s+)?(recived|received)$/i.test(cell(0))) put('Hair received by Mamta Care');
    if (/^in\s+transit$/i.test(cell(2))) put('Hair in transit');
    if (/^received at fabrication cent(?:er|re)$/i.test(cell(2))) {
      const city = /\b(nashik|nasik|banglore|bangalore|bengaluru|ponnur|nidubrole|delhi)\b/i.exec(cell(3))?.[1]?.toLowerCase();
      const cities = {nashik:'Nashik',nasik:'Nashik',banglore:'Bengaluru',bangalore:'Bengaluru',bengaluru:'Bengaluru',ponnur:'Ponnur',nidubrole:'Nidubrole',delhi:'Delhi'};
      put('Received at fabrication centre' + (city ? ' in '+cities[city] : ''));
    }
    for (const [col,pattern,label] of [
      [4,/^under processing$/i,'Hair processing underway'],[4,/^processing completed$/i,'Hair processing completed'],
      [5,/^wig making in (process|progress|progess)$/i,'Wig making underway'],[5,/^(completed|wig making completed)$/i,'Wig making completed'],
      [6,/^hair implantation( in process)?$/i,'Hair implantation underway'],[6,/^hair implanted into wig$/i,'Hair implanted into wig'],
      [7,/^wig completed$/i,'Wig completed'],[8,/^(completed|donated)$/i,'Donation marked complete']
    ]) if(pattern.test(cell(col))) put(label);
    history.set(id,{id,suffix,timeline});
  }
  for(const [id,numbers] of phones) {
    const suffix = numbers.size === 1 ? [...numbers][0].slice(-4) : '';
    if(!history.has(id) && suffix.length===4) history.set(id,{id,suffix,timeline:[]});
  }
  return [...history.values()].filter(row=>row && row.suffix.length===4);
}
export const refreshSql = "WITH fresh AS (SELECT json_extract(value,'$.id') AS id,json_extract(value,'$.suffix') AS suffix,json_extract(value,'$.timeline') AS timeline FROM json_each(?1)) INSERT OR REPLACE INTO mc_public_historical_tracking(registration_id,phone_last4,timeline) SELECT id,suffix,timeline FROM fresh UNION ALL SELECT registration_id,'','[]' FROM mc_public_historical_tracking WHERE phone_last4<>'' AND registration_id NOT IN (SELECT id FROM fresh)";
