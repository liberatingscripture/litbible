// E128: the tinted notice bands on /sheets fill their row, and the words inside
// keep a 60-character line. Reads the stylesheet as text, as the other CSS tests do.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const css = readFileSync(new URL("../src/styles/pages/sheets-page.css", import.meta.url), "utf8")
  .replace(/\/\*[\s\S]*?\*\//g, "");

// The declarations of every rule whose selector list contains `selector`, merged.
function bodyOf(selector) {
  const out = [];
  for (const [, sel, body] of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const selectors = sel.split(",").map((s) => s.trim());
    if (selectors.includes(selector)) out.push(body);
  }
  return out.join("\n");
}

const BANDS = [".sheets-page__check", ".sheets-page__key-note", ".sheets-page__leaks", ".sheets-page__shared"];

test("each tinted notice band fills its row: no max-width on the band itself", () => {
  for (const band of BANDS) {
    assert.doesNotMatch(bodyOf(band), /max-width\s*:/, `${band} must not cap its own width`);
  }
  assert.doesNotMatch(bodyOf(".sheets-page__shared--line"), /max-width\s*:/);
});

test("each band's words keep a 60-character line", () => {
  const cap = /max-width:\s*calc\(60 \* var\(--ch\)\)/;
  assert.match(css, new RegExp(String.raw`\.sheets-page__check > \*\s*\{[^}]*` + cap.source));
  assert.match(css, new RegExp(String.raw`\.sheets-page__leaks > \*\s*\{[^}]*` + cap.source));
  assert.match(css, new RegExp(String.raw`\.sheets-page__shared > p\s*\{[^}]*` + cap.source));
  // The key note and the shared sentence are the paragraph itself, so their
  // line is set by right padding that leaves 60 characters of text.
  const pad = /padding-inline-end:\s*max\(1rem,\s*calc\(100% - 60 \* var\(--ch\) - 1rem - 3px\)\)/;
  assert.match(bodyOf(".sheets-page__key-note"), pad);
  assert.match(bodyOf(".sheets-page__shared--line"), pad);
});

test("the untinted text and lists keep their 60-character measure", () => {
  for (const sel of [".sheets-page__off", ".sheets-page__intro", ".sheets-page__empty", ".sheets-page__list", ".desk-sheet__templates"]) {
    // Any rule for these selectors that sets a width keeps the 60-character cap.
    const body = bodyOf(sel);
    if (/max-width\s*:/.test(body)) assert.match(body, /max-width:\s*calc\(60 \* var\(--ch\)\)/, sel);
  }
});
