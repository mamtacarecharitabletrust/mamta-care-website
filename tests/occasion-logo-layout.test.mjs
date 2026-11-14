import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const component = readFileSync("src/OccasionWelcome.jsx", "utf8");
const styles = readFileSync("src/styles/occasion-welcome.css", "utf8");

test("the occasion greeting reuses the exact existing official website logo", () => {
  assert.match(component, /import mamtaCareLogo from "\.\/assets\/mamta-care-logo\.jpeg"/);
  assert.match(component, /src=\{mamtaCareLogo\}/);
  assert.match(component, /alt="Official Mamta Care Charitable Trust logo"/);
  assert.match(styles, /\.mcct-occasion-logo\s*\{[^}]*object-fit:\s*contain/s);
  assert.match(styles, /\.mcct-occasion-logo\s*\{[^}]*object-position:\s*center/s);
});

test("popup locks the background and fits all text without either scroll direction", () => {
  assert.match(component, /document\.body\.style\.overflow = "hidden"/);
  assert.match(component, /document\.documentElement\.style\.overflow = "hidden"/);
  assert.match(component, /Math\.min\(1, availableHeight \/ height, availableWidth \/ width\)/);
  assert.match(component, /--mcct-occasion-fit/);
  assert.match(styles, /\.mcct-occasion-overlay\s*\{[^}]*overflow:\s*hidden/s);
  assert.match(styles, /\.mcct-occasion-panel\s*\{[^}]*overflow:\s*hidden/s);
  assert.doesNotMatch(styles, /overflow-[xy]:\s*(auto|scroll)/);
});

test("close, continue and donation registration actions remain available", () => {
  assert.match(component, /mcct-occasion-close/);
  assert.match(component, /Register to Donate Hair/);
  assert.match(component, /Continue to Website/);
});
