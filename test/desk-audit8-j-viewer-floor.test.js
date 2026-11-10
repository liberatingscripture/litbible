// test/desk-audit8-j-viewer-floor.test.js
//
// Audit 8 LG8-9, decision 10 (BVJ, 2026-11-10): a shared sheet's phone viewer
// has a floor of Safari 16.4. The gate asks before it imports the viewer, and
// below the floor says the browser is too old, not that the connection failed.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

import { viewerSupported } from "../src/lib/sheet-viewer-floor.mjs";
import { xmlEscape } from "../src/lib/desk-sheet-doc.mjs";

const read = (p) => fs.readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

test("LG8-9: the viewer runs where DecompressionStream and lookbehind exist, and not without the stream", () => {
  assert.equal(viewerSupported(), true, "this Node has both");
  assert.equal(viewerSupported({}), false);
  assert.equal(viewerSupported({ DecompressionStream: function () {} }), true);
});

test("LG8-9: the gate asks before importing, and says the browser is too old", () => {
  const src = read("src/scripts/sheet-share-gate.js");
  assert.ok(src.indexOf("viewerSupported()") < src.indexOf('import("./desk/sheets/sheet-page.js")'));
  assert.match(src, /This browser is too old to open a shared sheet\. Update it, or copy the link and open it on a computer\./);
});

test("LG8-9: xmlEscape keeps a surrogate pair and drops a lone half, with no lookbehind", () => {
  assert.equal(xmlEscape("a😀b"), "a😀b");
  assert.equal(xmlEscape("a\uD83Db\uDE00c\uDE00\uD83D"), "abc");
  assert.equal(xmlEscape("\uD83D😀"), "😀");
  assert.doesNotMatch(read("src/lib/desk-sheet-doc.mjs"), /\(\?<[=!]/);
});
