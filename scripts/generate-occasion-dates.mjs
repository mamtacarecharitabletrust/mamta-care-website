/**
 * Compile calculated India public holiday candidates into future-year cache.
 * Sources: Python holidays 0.108 (MIT) plus explicit government-date overrides.
 * The official 2026–27 overrides always win. Moon sighting remains provisional.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { OCCASIONS, FIXED_ANNUAL } from "../src/lib/occasionCatalog.js";

const cacheFile = resolve("src/data/occasionComputedDates.json");
const candidatesPath = resolve(".holiday-tools/holiday-candidates.json");
if(!existsSync(candidatesPath)) throw new Error("Python holiday candidate data missing; refusing to publish an empty schedule.");
const candidates = JSON.parse(readFileSync(candidatesPath,"utf8"));
if(!Array.isArray(candidates)||candidates.length<100)throw new Error("Insufficient holiday candidates; refusing to publish.");
const PATTERNS = [
  ["eid-ul-fitr",/\b(eid|id)[ -]?(ul|al)?[ -]?fitr|ram(z|a)an eid/i],
  ["eid-ul-adha",/\b(eid|id)[ -]?(ul|al)?[ -]?(adha|zuha)|bakrid/i],
  ["milad-un-nabi",/milad|prophet.*birthday/i],
  ["maha-shivratri",/maha.*shivaratri|shiva.*ratri/i],
  ["holi",/\bholi\b|dol.*purnima/i],
  ["ram-navami",/ram(a)?[ -]?navami/i],
  ["mahavir-jayanti",/mahavir.*(jayanti|janma)/i],
  ["good-friday",/good friday/i],
  ["easter",/easter sunday/i],
  ["buddha-purnima",/buddha.*(purnima|jayanti)/i],
  ["muharram",/muharram|ashura/i],
  ["rath-yatra",/rath(a)?[ -]?yatra/i],
  ["janmashtami",/janmashtami|krishna jayanti/i],
  ["ganesh-chaturthi",/ganesh.*chaturthi|vinayaka chaturthi/i],
  ["onam",/\bonam\b/i],
  ["raksha-bandhan",/raksha.*bandhan|rakhi/i],
  ["durga-puja",/durga puja|maha ashtami/i],
  ["dussehra",/dus(s|h)ehra|vijayadashami|vijaya dashami/i],
  ["diwali",/diwali|deepavali/i],
  ["naraka-chaturdashi",/naraka chaturdashi/i],
  ["govardhan-puja",/govardhan/i],
  ["bhai-dooj",/bhai.*(dooj|duj)/i],
  ["chhath-puja",/chhath/i],
  ["guru-nanak",/guru nanak/i],
  ["ugadi",/ugadi/i],
  ["gudi-padwa",/gudi padwa|chaitra.*sukladi/i],
  ["vaisakhi",/baisakhi|vaisakhi/i],
  ["vishu",/\bvishu\b/i],
  ["bengali-new-year",/bengali new year|poila boishakh/i],
  ["tamil-new-year",/tamil new year|puthandu/i],
  ["karva-chauth",/kar(v|w)a chauth/i],
  ["basant-panchami",/vasant panchami|basant panchami/i],
  ["magh-bihu",/magh bihu/i],
  ["pongal",/\bpongal\b/i],
  ["makar-sankranti",/makar sankranti|makara sankranti/i],
];
const identify = name => PATTERNS.find(([,pattern])=>pattern.test(name))?.[0] || null;
const dates={};
const year = new Date().getUTCFullYear();
const minYear = Math.max(2028, year);
const maxYear = minYear + 5;
const stats = {};
for(const item of candidates){
  const date=String(item.date||"").slice(0,10);
  if(!/^\\d{4}-\\d{2}-\\d{2}$/.test(date))continue;
  const itemYear=Number(date.slice(0,4));
  if(itemYear<minYear||itemYear>maxYear)continue;
  const id=identify(String(item.name||"").trim());
  if(!id||!OCCASIONS[id])continue;
  if(FIXED_ANNUAL[date.slice(5)]===id)continue;
  const source=String(item.source||"IN");
  const score=source==="IN"?10:1;
  if(!dates[date]||dates[date].score<score){
    dates[date]={id,source,score,note:"Computed holiday; subject to state notifications and lunar observation."};
  }
  stats[itemYear]=(stats[itemYear]||0)+1;
}
const coverage=Array.from({length:6},(_,i)=>minYear+i).map(y=>({year:y,dates:Object.keys(dates).filter(k=>k.startsWith(String(y)+"-")).length}));
process.stdout.write("Future holiday coverage "+JSON.stringify(coverage)+"\\n");
if(coverage.some(item=>item.dates<5))throw new Error("Calendar incomplete for at least one future year; no partial schedule will be published.");
const rows=Object.fromEntries(Object.entries(dates).sort(([a],[b])=>a.localeCompare(b)).map(([d,x])=>[d,{id:x.id,source:x.source,note:x.note}]));
if(Object.keys(rows).length<20)throw new Error("Holiday calendar incomplete; refusing to publish sparse cache");
const before=existsSync(cacheFile)?JSON.parse(readFileSync(cacheFile,"utf8")):{};
if(JSON.stringify(before.entries||{})===JSON.stringify(rows)){
  process.stdout.write("Holiday data unchanged; no site deployment needed.\n");
}else{
  const next={
    schemaVersion:1,
    generatedAt:new Date().toISOString(),
    generator:"python-holidays@0.108 (calculated, not an official notice)",
    note:"Islamic and some Hindu lunar dates are provisional; official government and moon-sighting announcements take precedence.",
    entries:rows,
  };
  writeFileSync(cacheFile,JSON.stringify(next,null,2)+"\n");
  process.stdout.write("Refreshed "+Object.keys(rows).length+" scheduled occasion dates for "+minYear+"-"+maxYear+"\n");
}
