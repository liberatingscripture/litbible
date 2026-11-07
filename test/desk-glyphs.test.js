// test/desk-glyphs.test.js
//
// E42: the `ribbon` note marker is an awareness ribbon, drawn apart from the
// bookmark's flag shape, which it shared until then.

import { test } from "node:test";
import assert from "node:assert/strict";

import { glyph } from "../src/scripts/desk/glyphs.js";

test("E42: the ribbon marker has its own drawing, and the bookmark keeps the flag", () => {
  const ribbon = glyph("ribbon");
  const bookmark = glyph("bookmark");
  assert.notEqual(ribbon, bookmark);
  assert.notEqual(ribbon, glyph("note"));
  // One path each, in the 24-unit box every marker is drawn in.
  for (const svg of [ribbon, bookmark]) {
    assert.match(svg, /viewBox="0 0 24 24"/);
    assert.equal((svg.match(/<path /g) ?? []).length, 1);
  }
  assert.match(bookmark, /M6 2\.5h12/);
  assert.ok(!/M6 2\.5h12/.test(ribbon));
});
