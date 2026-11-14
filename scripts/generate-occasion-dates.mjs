/**
 * Completely unattended date cache generator for the India holiday engine.
 * Install isolated parser in CI with:
 * npm install --prefix .holiday-tools --no-save --ignore-scripts --no-package-lock date-holidays@3.39.1
 *
 * Future Hindu and Islamic lunar-calendar dates are estimates. For 2026/27,
 * verified government notices in occasionCatalog.js override this cache.
 * Never treat these dates as an official government holiday notification.
 */
import { createRequire } from "node:module";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { OCCASIONS, FIXED_ANNUAL } from "../src/lib/occasionCatalog.js";

const require = createRequire(import.meta.url);
const cacheFile = resolve("src/data/occasionComputedDates.json");
const dependencyPath = resolve(".holiday-tools/node_modules/date-holidays");
if (!existsSync(dependencyPath)) throw new Error("Isolated holiday library not installed. See workflow.");
const Holidays = require(dependencyPath);
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
const base = new Holidays("IN");
base.setLanguages("en");
const states = Object.keys(base.getStates("IN") || {}).filter(code=>/^[A-Z]{2}$/.test(code));
const year = new Date().getUTCFullYear();
const minYear = Math.max(2028, year);
const maxYear = minYear + 5;
const nameKey = name => String(name||"").trim();
for(let y=minYear;y<=maxYear;y++){
  const sources=[{name:"IN",code:null},...states.map(code=>({name:"IN-"+code,code}))];
  for(const source of sources){
    const h = source.code ? new Holidays("IN",source.code) : base;
    h.setLanguages("en");
    const list = h.getHolidays(y) || [];
    for(const item of list){
      const id=identify(nameKey(item.name));
      if(!id||!OCCASIONS[id])continue;
      const date=String(item.date||"").slice(0,10);
      if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!date.startsWith(String(y)+"-"))continue;
      if(FIXED_ANNUAL[date.slice(5)] === id)continue;
      const score=(source.code?0:10)+(item.type==="public"?5:0)+(item.type==="optional"?2:0);
      // Stable preference for nationwide holidays over regional estimates.
      if(!dates[date] || dates[date].score<score){
        dates[date]={id,source:source.name,score,note:"Computed; lunar and regional dates may vary."};
      }
    }
  }
}
const rows=Object.fromEntries(Object.entries(dates).sort(([a],[b])=>a.localeCompare(b)).map(([d,x])=>[d,{id:x.id,source:x.source,note:x.note}]));
if(Object.keys(rows).length<20)throw new Error("Holiday calendar incomplete; refusing to publish sparse cache");
const before=existsSync(cacheFile)?JSON.parse(readFileSync(cacheFile,"utf8")):{};
if(JSON.stringify(before.entries||{})===JSON.stringify(rows)){
  process.stdout.write("Holiday data unchanged; no site deployment needed.\n");
}else{
  const next={
    schemaVersion:1,
    generatedAt:new Date().toISOString(),
    generator:"date-holidays@3.39.1 (calculated, not an official notice)",
    note:"Islamic and some Hindu lunar dates are provisional; official government and moon-sighting announcements take precedence.",
    entries:rows,
  };
  writeFileSync(cacheFile,JSON.stringify(next,null,2)+"\n");
  process.stdout.write("Refreshed "+Object.keys(rows).length+" scheduled occasion dates for "+minYear+"-"+maxYear+"\n");
}
