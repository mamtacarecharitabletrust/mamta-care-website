import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { OCCASIONS, FIXED_ANNUAL, MOVABLE_OFFICIAL } from "../src/lib/occasionCatalog.js";
import { occasionOn, occasionForKey, calendarForYear } from "../src/lib/occasionCalendar.js";

test("every published calendar entry has its own unique branding-safe artwork brief",()=>{
 const ids=[...Object.values(FIXED_ANNUAL),...Object.values(MOVABLE_OFFICIAL)];
 assert.ok(Object.keys(OCCASIONS).length>=60,"expected at least 60 unique named occasions");
 for(const id of ids) assert.ok(OCCASIONS[id]?.artworkId,"missing artwork identity: "+id);
 const arts=Object.values(OCCASIONS).map(e=>e.artworkId);
 assert.equal(new Set(arts).size,arts.length);
});

test("Christmas launches at midnight IST and expires at next midnight",()=>{
 assert.notEqual(occasionOn(new Date("2026-12-24T18:29:59Z"))?.id,"christmas");
 assert.equal(occasionOn(new Date("2026-12-24T18:30:00Z"))?.id,"christmas");
 assert.equal(occasionOn(new Date("2026-12-25T18:29:59Z"))?.id,"christmas");
 assert.notEqual(occasionOn(new Date("2026-12-25T18:30:00Z"))?.id,"christmas");
});

test("central India holidays and important regional observances are covered in 2027",()=>{
 const calendar=calendarForYear(2027);
 assert.ok(calendar.length>=50,"expanded calendar has too few dates");
 assert.equal(occasionForKey("2027-01-26").id,"republic-day");
 assert.equal(occasionForKey("2027-03-10").id,"eid-ul-fitr");
 assert.equal(occasionForKey("2027-03-23").id,"holi");
 assert.equal(occasionForKey("2027-04-07").id,"ugadi");
 assert.ok(occasionForKey("2027-04-07").alsoObserved.some(e=>e.id==="gudi-padwa"));
 assert.equal(occasionForKey("2027-08-15").id,"independence-day");
 assert.equal(occasionForKey("2027-10-29").id,"diwali");
 assert.equal(occasionForKey("2027-11-14").id,"childrens-day-guru-nanak");
 assert.equal(occasionForKey("2027-12-25").id,"christmas");
});

test("fixed annual dates continue beyond currently published festival tables",()=>{
 assert.equal(occasionForKey("2029-01-26")?.id,"republic-day");
 assert.equal(occasionForKey("2035-02-04")?.id,"world-cancer-day");
 assert.equal(occasionForKey("2040-08-15")?.id,"independence-day");
 assert.equal(occasionForKey("2040-12-25")?.id,"christmas");
});

test("unknown dates and malformed keys never invent a festival",()=>{
 assert.equal(occasionForKey("garbage"),null);
 assert.equal(occasionForKey("2027-13-40"),null);
 assert.equal(occasionForKey("2026-12-10"),null);
 assert.equal(occasionForKey("2028-02-30"),null);
});

test("original Mamta Care logo is a separate asset, not part of generated artwork",()=>{
 const premium=readFileSync("src/PremiumOccasionWelcome.jsx","utf8");
 const wrapper=readFileSync("src/OccasionWelcome.jsx","utf8");
 assert.match(premium,/import officialLogo from "\.\/assets\/mamta-care-logo\.jpeg"/);
 assert.match(premium,/src=\{officialLogo\}/);
 assert.match(wrapper,/import PremiumOccasionWelcome/);
 assert.doesNotMatch(premium,/data:image\/jpeg;base64/i);
 assert.match(premium,/Register to Donate Hair/);
 assert.match(premium,/Continue to Website/);
});
