// test/desk-audit8-d-reading-pages.test.js
//
// Study Desk Audit 8, batch D (reading pages with the desk on: the Notebook
// panel, the margin, marks, bookmarks, change notices, the first stage, the
// shell, the tour). Most of this code needs a browser to run, so what is held
// here is the source that carries the one rule that can't be driven (a reflow's
// read-then-write order, which needs layout), plus the pure parts run for real. The rest are driven in
// test/desk-audit8-dom-reading-*.test.js and desk-audit8-dom-greek-*.test.js.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { MOVE_KIND, NO_CHAPTER_KINDS, hearsChange } from "../src/lib/desk-store-core.mjs";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const dir = "src/scripts/desk/";
const code = (file) => read(`${dir}${file}`).replace(/\/\/.*$/gm, "");

test("NB8-1: what the views' filter hears (the pure rule the driven tests rely on)", () => {
  const filter = { except: [...NO_CHAPTER_KINDS, MOVE_KIND] };
  assert.equal(hearsChange(filter, ["sheet"]), false);
  assert.equal(hearsChange(filter, ["place"]), false);
  assert.equal(hearsChange(filter, [MOVE_KIND]), false);
  assert.equal(hearsChange(filter, ["note"]), true);
  assert.equal(hearsChange(filter, ["sheet", "highlight"]), true);
  assert.equal(hearsChange(filter, null), true);
  assert.equal(hearsChange({ except: NO_CHAPTER_KINDS }, [MOVE_KIND]), true, "the panel still hears a bookmark move");
});

// Source check kept: the order of a reflow's reads and writes needs layout. The
// 150 ms debounce of both lists is driven in desk-audit8-dom-reading-kept-debounce.test.js.
test("NB8-4: My Notes reads every row before writing any when it marks where a row is cut", () => {
  const mine = code("tab-mine.js");
  const body = mine.slice(mine.indexOf("function markCut()"), mine.indexOf("async function remove("));
  const reads = body.indexOf("scrollHeight");
  const writes = body.indexOf("caret.hidden =");
  assert.ok(reads > 0 && writes > reads, "scrollHeight is read before any caret is written");
  assert.doesNotMatch(body.slice(0, writes), /\.hidden =/, "no write before the last read");
});

test("LV8-6: the Greek tab has the close button the tour's step presses", () => {
  // The step itself is driven in desk-audit8-dom-reading-tour.test.js with a fake panel; this holds the fake to the real tab.
  assert.match(code("tab-greek.js"), /class="desk-greek__close"/);
});

test("GF8c-1: a note's notice is counted on the verses it covers, never past its chapter", async () => {
  await import("./helpers/browser-env.mjs");
  const { lastCounted } = await import("../src/scripts/desk/verse-labels.js");
  const john3 = { bookKey: "john", chapter: 3, verse: 16 };
  assert.equal(lastCounted(john3), 16);
  assert.equal(lastCounted({ ...john3, endVerse: 18 }), 18);
  assert.equal(lastCounted({ ...john3, endVerse: 2_000_000 }), 36);
  assert.equal(lastCounted({ ...john3, endVerse: 5 }), 16);
  assert.equal(lastCounted({ ...john3, verse: 90, endVerse: 95 }), 90);
  assert.equal(lastCounted({ bookKey: "nowhere", chapter: 1, verse: 4, endVerse: 9_000_000 }), 4);
  // And the loop uses it.
  assert.match(code("verse-labels.js"), /last = lastCounted\(r\)/);
});

