// test/qr-svg.test.js
//
// Unit tests for src/lib/qr-svg.mjs, the shared QR-to-SVG drawing. The first
// case is the one that matters most: the build script's committed output must
// stay byte-identical to what the module draws, so the file only moves when the
// address does.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { qrSvg } from "../src/lib/qr-svg.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const APPS_URL = "https://litbible.net/apps/";

test("the apps address draws the committed public/images/apps-qr.svg", () => {
  const committed = readFileSync(path.join(ROOT, "public", "images", "apps-qr.svg"), "utf8");
  assert.equal(qrSvg(APPS_URL, { quiet: 4, level: "M" }), committed);
});

test("the same input gives the same output", () => {
  assert.equal(qrSvg("https://example.org/a"), qrSvg("https://example.org/a"));
});

test("the viewBox is the module count plus two quiet zones", () => {
  const svg = qrSvg(APPS_URL, { quiet: 4 });
  // The apps address is 25 modules across, so 25 + 4 + 4 = 33 in all.
  assert.match(svg, /viewBox="0 0 33 33"/);
});

test("a larger quiet zone widens the viewBox", () => {
  assert.match(qrSvg(APPS_URL, { quiet: 2 }), /viewBox="0 0 29 29"/);
});

test("the default title is the QR code's text, and it is escaped", () => {
  const svg = qrSvg("a&b<c>\"d\"");
  assert.match(svg, /<title>QR code for a&amp;b&lt;c&gt;&quot;d&quot;<\/title>/);
});

test("a custom title is used, escaped, and replaces the default", () => {
  const svg = qrSvg(APPS_URL, { title: "Scan & <read>" });
  assert.match(svg, /<title>Scan &amp; &lt;read&gt;<\/title>/);
  assert.doesNotMatch(svg, /QR code for/);
});

test("the document ends in a newline and carries the white field and black path", () => {
  const svg = qrSvg(APPS_URL);
  assert.ok(svg.endsWith("</svg>\n"));
  assert.match(svg, /<rect width="33" height="33" fill="#fff"\/>/);
  assert.match(svg, /<path stroke="#000" d="M\d+ [\d.]+h\d+/);
});
