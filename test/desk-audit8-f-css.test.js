// test/desk-audit8-f-css.test.js
//
// Audit 8, batch F (the desk's CSS). A stylesheet has no behavior to run in
// node, so what is held here is the source that carries each fix: a later edit
// that puts a faint border, a faint ink or a bare `outline: none` back fails
// here rather than in a reader's window.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// desk-search.css holds the search rows' rules and desk-sheet-view.css a
// sheet's text and buttons since LG8-10; read as one sheet.
const css = ["desk.css", "desk-search.css", "desk-sheet-view.css"]
  .map((f) => readFileSync(new URL(`../src/styles/${f}`, import.meta.url), "utf8"))
  .join("\n");

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** The declaration block of the rule whose selector list is exactly `selector`. */
function rule(selector) {
  const re = new RegExp(`(?:^|\\})\\s*${esc(selector)}\\s*\\{([^}]*)\\}`, "m");
  const m = css.match(re);
  assert.ok(m, `no rule for ${selector}`);
  return m[1];
}

test("the Sheets editor's text fields take --field-border (XA8-2, BA144)", () => {
  for (const sel of [".desk-rich-editor", ".desk-sheet__minutes input"]) {
    assert.match(rule(sel), /border:\s*1px solid var\(--field-border\)/, sel);
  }
  assert.match(rule("select.desk-sheet__hint,\n.desk-sheet__hint-text"), /border:\s*1px solid var\(--field-border\)/);
  // Title and Subtitle keep the quiet look but never lose their edge.
  const quiet = rule(".desk-sheet__title,\n.desk-sheet__subtitle");
  assert.match(quiet, /border-bottom-color:\s*var\(--field-border\)/);
  assert.match(rule(".desk-sheet__title:hover,\n.desk-sheet__subtitle:hover,\n.desk-sheet__title:focus,\n.desk-sheet__subtitle:focus"), /border-color:\s*var\(--field-border\)/);
});

test("small secondary text takes ink 0.7, 4.5:1 or more on cream and raised (XA8-3)", () => {
  for (const sel of [".desk-cmds__hint", ".desk-item__kind", ".desk-sheet__saved", ".desk-sheet__from-kind", ".desk-title__hint--about"]) {
    assert.match(rule(sel), /color:\s*rgba\(var\(--ink-rgb\), 0\.7\)/, sel);
  }
});

test("the desk's fields set a placeholder color of their own, ink at 0.7 (XA8-13, LV8-3)", () => {
  const m = css.match(/((?:[^{}]*::placeholder,?\s*)+)\{([^}]*)\}/);
  assert.ok(m, "no ::placeholder rule");
  assert.match(m[2], /color:\s*rgba\(var\(--ink-rgb\), 0\.7\)/);
  assert.match(m[2], /opacity:\s*1/);
  assert.match(m[1], /\[class\*="desk-"\] input::placeholder/);
  assert.match(m[1], /\[class\*="desk-"\] textarea::placeholder/);
  assert.match(m[1], /input\[class\*="desk-"\]::placeholder/);
  // Both themes read the same rule: the dark blocks flip --ink-rgb itself.
  assert.doesNotMatch(m[2], /#|rgb\(\d/);
});

test("a focused element scrolls clear of the undo bar while it is up (XA8-14)", () => {
  assert.match(rule('html:has(.desk-undo__bar:not([hidden]))'), /scroll-padding-bottom:\s*\d+px/);
});

test("the tour card keeps its focus ring where :focus-visible applies (MH8-1)", () => {
  assert.doesNotMatch(css, /\.desk-tour:focus\s*\{/);
  assert.match(rule(".desk-tour:focus:not(:focus-visible)"), /outline:\s*none/);
});

test("a narrow Sheets pane lets a row's buttons wrap under its name (LV8-5)", () => {
  const m = css.match(/@container deskSheets \(max-width: [\d.]+rem\) \{([\s\S]*?)\n  \}\n\}/);
  assert.ok(m, "no container rule");
  assert.match(m[1], /display:\s*flex/);
  assert.match(m[1], /flex-wrap:\s*wrap/);
  assert.match(m[1], /\.desk-sheet__open\s*\{[^}]*flex:\s*1 1 100%/);
});

test("aria-disabled Keep, Delete and the bookmark form's Save look busy (batch request)", () => {
  assert.match(rule('.desk-notice__actions button[aria-disabled="true"]'), /cursor:\s*progress/);
  assert.match(rule('.desk-bookmark-form .desk-editor__save[aria-disabled="true"]'), /cursor:\s*progress/);
  // A busy button doesn't take the hover look either.
  assert.match(css, /\.desk-notice__actions button:hover:not\(:disabled\):not\(\[aria-disabled="true"\]\)/);
});

test("the Sheets editor's states have forced-colors rules (XA8-7)", () => {
  const start = css.indexOf("The Sheets editor's states in forced colors");
  assert.ok(start > 0);
  const end = css.indexOf("M6: Print with my notes", start);
  const block = css.slice(start, end);
  assert.match(block, /@media \(forced-colors: active\)/);
  assert.match(block, /\.desk-sheet__chip\[aria-pressed="true"\]\s*\{[^}]*border:\s*2px solid Highlight/);
  assert.match(block, /\.desk-sheet__drop\s*\{[^}]*border-top:\s*3px solid Highlight/);
  assert.match(block, /\.desk-rich-editor:focus-within\s*\{[^}]*outline:\s*2px solid Highlight/);
  // The primary button's edge is with the buttons, in desk-sheet-view.css (LG8-10).
  const view = readFileSync(new URL("../src/styles/desk-sheet-view.css", import.meta.url), "utf8");
  assert.match(view, /@media \(forced-colors: active\) \{\s*\.desk-sheet__btn--primary\s*\{[^}]*border:\s*2px solid ButtonText/);
  assert.match(block, /\.desk-sheet__after-btn\s*\{[^}]*border:\s*1px solid ButtonText/);
  assert.match(block, /\.desk-sheet__meter > span\s*\{[^}]*background:\s*Highlight/);
});
