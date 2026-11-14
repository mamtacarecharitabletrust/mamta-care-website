import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, statSync } from "node:fs";

const child = readFileSync("src/ChildrensDayWelcome.jsx", "utf8");
const calendar = readFileSync("src/lib/occasionCalendar.js", "utf8");
const parent = readFileSync("src/OccasionWelcome.jsx", "utf8");
const css = readFileSync("src/styles/children-day-welcome.css", "utf8");

test("Children's Day uses the original official logo, as an independent image", () => {
  assert.match(child, /import mamtaCareLogo from "\.\/assets\/mamta-care-logo\.jpeg"/);
  assert.match(child, /src=\{mamtaCareLogo\}/);
  assert.match(css, /\.mcct-child-official-logo\s*\{[^}]*object-fit:\s*contain/s);
  assert.ok(statSync("src/assets/mamta-care-logo.jpeg").size > 0);
});

test("approved children's illustration is a separate small web asset without an embedded logo", () => {
  assert.match(child, /children-day-art\.webp/);
  assert.ok(statSync("src/assets/children-day-art.webp").size > 0);
  assert.ok(statSync("src/assets/children-day-art.webp").size < 50000);
});

test("Children's Day design replaces the generic occasion without affecting other festivals", () => {
  assert.match(parent, /occasion\?\.id === "childrens-day"/);
  assert.match(parent, /<ChildrensDayWelcome/);
  assert.match(calendar, /"11-14":\s*\{ id: "childrens-day"/);
});

test("no overlapping logo labels, stars, or internal popup scrollbars", () => {
  assert.doesNotMatch(child, /mcct-occasion-kicker|mcct-occasion-eyebrow|mcct-occasion-symbol/);
  assert.doesNotMatch(child, /[★✦⭐🌟]/);
  assert.doesNotMatch(css, /overflow-[xy]:\s*(auto|scroll)/);
  assert.match(css, /\.mcct-child-layout\s*\{[^}]*overflow:\s*hidden/s);
  assert.match(parent, /document\.body\.style\.overflow = "hidden"/);
});

test("all actions and minimum hair length reminder remain accessible", () => {
  assert.match(child, /Close Children's Day greeting and continue to website/);
  assert.match(child, /Continue to Website/);
  assert.match(child, /Register to Donate Hair/);
  assert.match(child, /14 inches of usable hair/);
});
