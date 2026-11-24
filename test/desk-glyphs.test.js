// test/desk-glyphs.test.js
//
// The note markers' drawings, and the bookmark's mark beside them. The
// `ribbon` marker (E42's awareness ribbon; named `bookmark` until E10) left
// the format on 2026-11-23 (step 4d), so it has no drawing of its own.

import { test } from "node:test";
import assert from "node:assert/strict";

import { glyph } from "../src/scripts/desk/glyphs.js";
import { MARKERS } from "../src/lib/desk-records.mjs";

test("every note marker has its own drawing, in the 24-unit box", () => {
  const drawn = MARKERS.map((m) => glyph(m));
  assert.equal(new Set(drawn).size, MARKERS.length);
  for (const svg of drawn) assert.match(svg, /viewBox="0 0 24 24"/);
});

test("4d: the retired ribbon marker draws as the plain note, like any marker this code doesn't know", () => {
  assert.equal(glyph("ribbon"), glyph("note"));
  assert.equal(glyph("spark"), glyph("note"));
  assert.equal(glyph("constructor"), glyph("note"));
  assert.equal(glyph(undefined), glyph("note"));
});

test("the bookmark's mark keeps the flag, and is no note marker", () => {
  const bookmark = glyph("bookmark");
  assert.match(bookmark, /viewBox="0 0 24 24"/);
  assert.equal((bookmark.match(/<path /g) ?? []).length, 1);
  assert.match(bookmark, /M6 2\.5h12/);
  assert.notEqual(bookmark, glyph("note"));
  assert.ok(!MARKERS.includes("bookmark"));
});
