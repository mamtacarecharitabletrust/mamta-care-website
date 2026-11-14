import test from "node:test";
import assert from "node:assert/strict";
import { indiaDateKey, occasionOn } from "../src/lib/occasionCalendar.js";

test("converts UTC moments to the correct IST calendar day", () => {
  assert.equal(indiaDateKey(new Date("2026-11-13T18:29:59Z")), "2026-11-13");
  assert.equal(indiaDateKey(new Date("2026-11-13T18:30:00Z")), "2026-11-14");
  assert.equal(indiaDateKey(new Date("2026-11-14T18:29:59Z")), "2026-11-14");
  assert.equal(indiaDateKey(new Date("2026-11-14T18:30:00Z")), "2026-11-15");
});

test("Children's Day greeting is active from 00:00 to 23:59 IST", () => {
  assert.equal(occasionOn(new Date("2026-11-13T18:29:59Z")), null);
  assert.equal(occasionOn(new Date("2026-11-13T18:30:00Z"))?.id, "childrens-day");
  assert.equal(occasionOn(new Date("2026-11-14T18:29:59Z"))?.id, "childrens-day");
  assert.equal(occasionOn(new Date("2026-11-14T18:30:00Z")), null);
});

test("Diwali appears only on its configured day", () => {
  assert.equal(occasionOn(new Date("2026-11-07T18:30:00Z"))?.id, "diwali");
  assert.equal(occasionOn(new Date("2026-11-08T18:30:00Z")), null);
  assert.equal(occasionOn(new Date("2027-10-28T18:30:00Z"))?.id, "diwali");
});

test("two events on 2027 Children's Day use a combined message", () => {
  assert.equal(occasionOn(new Date("2027-11-14T05:00:00Z"))?.id, "childrens-day-guru-nanak");
});

test("days without scheduled greetings have no popup", () => {
  assert.equal(occasionOn(new Date("2026-12-10T08:00:00Z")), null);
});
