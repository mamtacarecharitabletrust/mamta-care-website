import { OCCASIONS, FIXED_ANNUAL, MOVABLE_OFFICIAL, DATE_SECONDARY, NATIONAL_IDS } from "./occasionCatalog.js";
import computed from "../data/occasionComputedDates.json" with { type: "json" };

export function indiaDateKey(date=new Date()){
  const parts=new Intl.DateTimeFormat("en-GB",{timeZone:"Asia/Kolkata",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(date);
  const val=t=>parts.find(p=>p.type===t)?.value||"";
  return val("year")+"-"+val("month")+"-"+val("day");
}
export function occasionForKey(key){
  if(!/^\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])$/.test(key)) return null;
  const fixed=FIXED_ANNUAL[key.slice(5)];
  const official=MOVABLE_OFFICIAL[key];
  const derived=key.slice(0,4)>="2028" ? computed.entries?.[key]?.id : null;
  const movable=official||derived;
  const id=fixed&&NATIONAL_IDS.includes(fixed)?fixed:movable||fixed;
  if(!OCCASIONS[id]) return null;
  const secondary=[...(fixed&&fixed!==id?[fixed]:[]),...(movable&&movable!==id?[movable]:[]),...(DATE_SECONDARY[key]||[])].filter((v,i,a)=>v!==id&&OCCASIONS[v]&&a.indexOf(v)===i);
  return {...OCCASIONS[id],date:key,source:official?"official-override":derived?"computed":"annual",computed:!!derived&&!official,alsoObserved:secondary.map(v=>({id:v,title:OCCASIONS[v].title}))};
}
export const occasionOn=(date=new Date())=>occasionForKey(indiaDateKey(date));
export function calendarForYear(year){
  const y=Number(year);
  if(!Number.isInteger(y)||y<2020||y>2100)return [];
  const keys=new Set(Object.keys(FIXED_ANNUAL).map(day=>String(y)+"-"+day));
  for(const source of [MOVABLE_OFFICIAL,computed.entries||{}])for(const date of Object.keys(source))if(date.startsWith(String(y)+"-"))keys.add(date);
  return [...keys].sort().map(occasionForKey).filter(Boolean);
}
