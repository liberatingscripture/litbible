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
  // The sheet's Text size select (E101) is a field like the hint's.
  assert.match(rule("select.desk-sheet__hint,\nselect.desk-sheet__size-select,\n.desk-sheet__hint-text"), /border:\s*1px solid var\(--field-border\)/);
  // Title and Subtitle are fields like the rest since E89: a whole edge and
  // a fill of their own, never the page's (they had a bottom line only).
  const title = rule(".desk-sheet__title,\n.desk-sheet__subtitle");
  assert.match(title, /border:\s*1px solid var\(--field-border\)/);
  assert.match(title, /background:\s*var\(--desk-field\)/);
});

test("the desk's fields, cards and controls stand apart from what they sit on (E89)", () => {
  // Fields take the field fill, never the card's, the pane's or the page's.
  for (const sel of [".desk-rich-editor", ".desk-sheet__minutes input", ".desk-sheet__lines input", ".desk-sheet__ref input", ".desk-passage__field"]) {
    assert.match(rule(sel), /background:\s*var\(--desk-field\)/, sel);
  }
  // Cards take the card fill and edge.
  for (const sel of [".desk-sheet__module", ".desk-sheet__sheet", ".desk-sheet__passage-form", ".desk-sheet__ask"]) {
    const r = rule(sel);
    assert.match(r, /background:\s*var\(--desk-card\)/, sel);
    assert.match(r, /border:\s*1px solid var\(--desk-card-edge\)/, sel);
  }
  // The Sheets pane keeps a pane's own color (BVJ, 2026-11-11), so there its
  // cards take a color of their own; nothing paints the pane's body.
  assert.match(rule(".desk-pane .desk-sheet"), /--desk-card:\s*var\(--desk-pane-card\)/);
  assert.doesNotMatch(rule(".desk-pane .desk-sheet"), /background/);
  // Controls take a 3:1 edge and the control fill: since E126 one rule, the
  // ordinary kind, says it for the template choices, the command row, the
  // panes' lock and every sheet button in the Sheets pane and on /sheets but
  // the primary one, and the pills' rule for the chips
  // (test/desk-buttons-css.test.js holds the whole inventory).
  const ordinary = css.match(/\n:is\((\.desk-cmdrow__btn,[^{]*?)\) \{([^}]*)\}/);
  assert.ok(ordinary, "no rule for the ordinary kind (E126)");
  for (const sel of [".desk-sheet__choice", ".desk-cmdrow__btn", ".desk-pane__pin", ":where(.desk-sheet, .sheets-page) .desk-sheet__btn:where(:not(.desk-sheet__btn--primary))"]) {
    assert.ok(`, ${ordinary[1]}, `.includes(`, ${sel}, `), sel);
  }
  assert.match(ordinary[2], /border:\s*1px solid var\(--field-border\)/);
  assert.match(ordinary[2], /background:\s*var\(--desk-control\)/);
  const pills = css.match(/\n:is\(:where\(\.desk-verse, \.desk-fns\) \.desk-pin, [^{]*\.desk-sheet__chip\) \{([^}]*)\}/);
  assert.ok(pills, "no rule for the pills");
  assert.match(pills[1], /border:\s*1px solid var\(--field-border\)/);
  // The layers' dark values are declared in both of desk.css's dark blocks,
  // and --desk-control in desk-search.css's two as well (/search's own copy).
  for (const [dark, count] of [["--desk-pane-card: #262628;", 2], ["--desk-field: var(--surface);", 2], ["--desk-control: rgba(var(--ink-rgb), 0.07);", 4]]) {
    assert.equal(css.split(dark).length - 1, count, dark);
  }
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
  // A busy button doesn't take the hover look either: the notice's Delete is
  // an ordinary button and its Keep the card's primary (E126), and neither
  // kind's hover reaches a disabled or aria-disabled button.
  assert.match(css, /:where\(\.desk-notice__actions\) button:where\(:not\(\.desk-notice__keep\)\)[^{]*\):hover:not\(:disabled, \[aria-disabled="true"\]/);
  assert.match(css, /\.desk-notice__actions \.desk-notice__keep\):hover:not\(:disabled, \[aria-disabled="true"\], :active\)/);
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
