// test/desk-reading-justify.test.js
//
// E106: in the Reading layout the LIT pane's prose is justified and
// hyphenated. It is CSS alone, and a stylesheet has no behavior to run in
// node (happy-dom lays nothing out), so what is held here is the source that
// carries each of BVJ's three limits, and the one line of script the rule
// hangs on.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const css = read("src/styles/desk.css");
const page = read("src/scripts/desk/desk-page.js");

/** The one rule in desk.css that justifies, with its selector. */
function justifyRule() {
  const all = [...css.matchAll(/([^{}]+)\{([^{}]*text-align:\s*justify[^{}]*)\}/g)];
  assert.equal(all.length, 1, "desk.css justifies in one rule only");
  return { selector: all[0][1].trim(), body: all[0][2], at: all[0].index };
}

test("Reading's prose is justified and hyphenated, and only in Reading", () => {
  const { selector, body } = justifyRule();
  assert.match(selector, /\.desk-ws\[data-desk-reading\] \.desk-lit \.chapter-paragraphs p/);
  assert.match(body, /hyphens:\s*auto/);
  // A short word is never split, and no two-letter stub is left on a line.
  assert.match(body, /hyphenate-limit-chars:\s*6 3 3/);
});

test("poetry keeps its lines", () => {
  // A poetry line is a <p> inside blockquote.hbq, so the rule must say so.
  assert.match(justifyRule().selector, /p:not\(blockquote p\)$/);
});

test("the accessibility fonts keep the ragged edge and whole words", () => {
  // data-font is absent for the default fonts, and set for Atkinson and
  // OpenDyslexic alike (src/styles/CLAUDE.md, the reader font).
  assert.match(justifyRule().selector, /^html:not\(\[data-font\]\) /);
});

test("a short line stays left-aligned: the rule sits in a container query on the column", () => {
  const { at } = justifyRule();
  const before = css.slice(0, at);
  const query = before.lastIndexOf("@container deskLitText (min-width: 22em)");
  assert.ok(query > -1, "the rule is inside the deskLitText query");
  // Nothing closes the query between its opening and the rule.
  assert.doesNotMatch(before.slice(query).replace(/^[^{]*\{/, ""), /\}/);
  // The column is the container, so the em is the reading size's.
  assert.match(css, /\.desk-ws\[data-desk-reading\] \.desk-lit__text\s*\{\s*container:\s*deskLitText \/ inline-size;/);
});

test("the page stamps Reading after noting each pane's place and before putting it back", () => {
  // The rewrap moves every line above the reader's, so the order is the fix:
  // note (old wrap), stamp, restore (new wrap).
  const draw = page.slice(page.indexOf("function draw()"), page.indexOf("function mark()"));
  const note = draw.indexOf("keepScroll(rec)");
  const stamp = draw.indexOf('root.toggleAttribute("data-desk-reading", arrangementOf(layout) === "reading")');
  const restore = draw.indexOf("for (const back of putBack) back?.()");
  assert.ok(note > -1 && stamp > -1 && restore > -1, "draw() notes, stamps and restores");
  assert.ok(note < stamp && stamp < restore, "in that order");
});
