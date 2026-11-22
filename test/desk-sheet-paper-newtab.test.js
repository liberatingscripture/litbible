// The paper copy has no new-tab mark (STUDY-DESK-FIXES.md, E215; BVJ,
// 2026-11-21). restyle.css draws one after every link that leaves the site, as
// a box filled with the text color. print.css clears every ::after's
// background, so on paper the mark drew nothing and still held 1.2em of the
// line: a footnote's "Isaiah 56:1–8; 58:6–14" printed with a gap before the
// semicolon. The rule that removes it must also reach the screen, or the
// preview breaks its lines and pages differently from the paper.
//
// A CSS rule is what's being held here, which a layout-free test can't see any
// other way. (Checked in headless Chrome over the real stylesheets: the gap was
// 1.2em in screen and print before, 0 after, and an in-site link had none.)

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");

const sheet = read("../src/styles/pages/sheets-page.css");
const restyle = read("../src/styles/restyle.css");

/** How many blocks are open where `index` falls (0 is the top level). */
function depthAt(css, index) {
  let depth = 0;
  for (let i = 0; i < index; i++) {
    if (css[i] === "{") depth++;
    else if (css[i] === "}") depth--;
  }
  return depth;
}

test("restyle.css still draws its new-tab mark on a link that opens a new tab", () => {
  // If this selector moves, the rule below no longer meets it: look again.
  assert.match(restyle, /a\[target="_blank"\][^{]*::after\s*\{[^}]*display:\s*inline-block/);
});

test("the paper copy hides that mark, on screen as well as on paper", () => {
  const rule = /\.sheet-copy a\[target="_blank"\]::after\s*\{([^}]*)\}/.exec(sheet);
  assert.ok(rule, "a rule names the paper's outside links' ::after");
  assert.match(rule[1], /display:\s*none\s*!important/);
  assert.equal(depthAt(sheet, rule.index), 0, "outside @media print, so the preview matches the paper");
});
