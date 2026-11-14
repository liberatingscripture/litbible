// E129: the instruction under an editable passage's words ("Click a word,
// double-click it, …") is drawn as the sheet's other notes are, smaller and
// dimmer, so it never reads as more of the passage. It had a class no rule
// styled, so it took the passage's own size and ink. Reopened (BVJ,
// 2026-11-13): at a larger Display tray size it was larger than the passage,
// so a line above it and italics now set it apart too.
//
// The stylesheet is read as text, as the other CSS tests do. The one source
// check below pairs the paragraph with its class: drawing the passage needs a
// fetched chapter page and a layout engine, which happy-dom doesn't give.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const css = readFileSync(new URL("../src/styles/desk.css", import.meta.url), "utf8")
  .replace(/\/\*[\s\S]*?\*\//g, "");
const lit = readFileSync(new URL("../src/scripts/desk/sheets/sheet-lit.js", import.meta.url), "utf8");

/** The rules whose selector lists name `selector`, as [selectors, body]. */
function rulesFor(selector) {
  const out = [];
  for (const [, sel, body] of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const selectors = sel.split(",").map((s) => s.trim());
    if (selectors.includes(selector)) out.push([selectors, body]);
  }
  return out;
}

test("the instruction shares the sheet's note rule: smaller and dimmer than the words", () => {
  const rules = rulesFor(".desk-sheet__how");
  assert.ok(rules.length > 0, ".desk-sheet__how has a rule");
  const note = rules.find(([selectors]) => selectors.includes(".desk-sheet__empty"));
  assert.ok(note, "it is styled with the “No blanks yet” note");
  assert.match(note[1], /font-size:\s*calc\(0\.875rem \* var\(--sheet-ui, 1\)\)/);
  assert.match(note[1], /color:\s*rgba\(var\(--ink-rgb\), 0\.75\)/);
});

test("a line above the instruction sets it apart from the passage at any text size, and it is italic", () => {
  // Reopened 2026-11-13: in a Sheets pane the notes follow the Display tray and
  // the passage doesn't, so at a larger tray size "smaller" no longer held.
  const own = rulesFor(".desk-sheet__how").find(([selectors]) => selectors.length === 1);
  assert.ok(own, "a rule of its own");
  assert.match(own[1], /border-top:\s*1px solid rgba\(var\(--ink-rgb\), 0\.15\)/, "the Footnotes section's line");
  assert.match(own[1], /font-style:\s*italic/);
  const [, footnotes] = rulesFor(".desk-sheet__notes")[0];
  assert.match(footnotes, /border-top:\s*1px solid rgba\(var\(--ink-rgb\), 0\.15\)/, "the same line as the Footnotes section's");
});

test("the passage's instruction is drawn with that class, not the hint select's", () => {
  const line = lit.split("\n").find((l) => l.includes("Click a word, double-click it"));
  assert.ok(line, "the instruction is still drawn in sheet-lit.js");
  assert.match(line, /make\("p", "desk-sheet__how"/);
});
