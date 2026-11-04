// test/desk-hostile-records.test.js
//
// SEC Q2 (audit 2, BVJ's answer 2026-11-04, option B): a record this code
// can't edit (a newer schema, an unknown kind) is kept whatever its own fields
// hold, so the places that DRAW those fields check their type. These feed
// hostile values through the pure drawing helpers.

import { test } from "node:test";
import assert from "node:assert/strict";

import { glyph } from "../src/scripts/desk/glyphs.js";
import { noteBodyHtml } from "../src/lib/desk-chains.mjs";

const HOSTILE = ["constructor", "__proto__", "toString", "hasOwnProperty", 12345, null, undefined, {}, ["note"], "<img src=x onerror=alert(1)>"];

test("a marker that isn't one of the seven draws the plain note's glyph, never other text (SEC Q2)", () => {
  const plain = glyph("note");
  for (const marker of HOSTILE) {
    const svg = glyph(marker);
    assert.equal(svg, plain, `marker ${String(marker)}`);
    assert.ok(!/function|\[object|onerror|undefined/.test(svg));
  }
});

test("a class name built from a marker's draw can't be steered by it (SEC Q2)", () => {
  assert.match(glyph("emphasis", "desk-glyph"), /^<svg class="desk-glyph"/);
});

test("a note body that isn't text, or holds markup, never becomes markup (SEC Q2)", () => {
  const html = noteBodyHtml("<img src=x onerror=alert(1)> John 3:16");
  assert.ok(!/<img/.test(html));
  assert.match(html, /&lt;img/);
});
