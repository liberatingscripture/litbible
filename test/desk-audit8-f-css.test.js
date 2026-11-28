// test/desk-audit8-f-css.test.js
//
// Audit 8, batch F (the desk's CSS). A stylesheet has no behavior to run in
// node, so what is held here is the source that carries each fix: a later edit
// that puts a faint border, a faint ink or a bare `outline: none` back fails
// here rather than in a reader's window. Since Featherboa's Phase 2 the
// desk's buttons and fields are kit.css's, so a fix that lives in a control's
// look is held where the kit draws it, and the desk's control by its level.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { namesOf } from "../scripts/lib/kit-lists.mjs";

const kit = readFileSync(new URL("../src/styles/kit.css", import.meta.url), "utf8");

/** The body of the rule that draws a level's look: `:is(.kit-x, :where(...)) { ... }`. */
function kitLook(anchor) {
  const m = kit.match(new RegExp(`\\n:is\\(${anchor.replace(/[.-]/g, "\\$&")}, [^{]*\\)\\) \\{([^}]*)\\}`));
  assert.ok(m, `no look rule for ${anchor}`);
  return m[1];
}

/** Asserts each name is one of a level's names in kit.css. */
function takes(level, names) {
  const list = namesOf(kit, level);
  for (const n of names) assert.ok(list.includes(n), `${n} is the kit's ${level}`);
}

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
  // Every field's edge is the kit's: --field-border, all the way round.
  assert.match(kitLook(".kit-field"), /border:\s*1px solid var\(--field-border\)/);
  // The minutes, the sheet's Text size select (E101) and the hint's, and
  // Title and Subtitle (a whole edge since E89; they had a bottom line only).
  takes("field", [".desk-sheet__minutes input", ".desk-sheet__hint", ".desk-sheet__size-select", ".desk-sheet__hint-text", ".desk-sheet__title", ".desk-sheet__subtitle"]);
  // The rich text editor is a field with its toolbar inside, which the kit
  // has no level for, so it draws the field's edge itself.
  assert.match(rule(".desk-rich-editor"), /border:\s*1px solid var\(--field-border\)/);
});

test("the desk's fields, cards and controls stand apart from what they sit on (E89)", () => {
  // Fields take the kit's field fill, the page's own color, on every card and
  // pane; none sets a fill of its own, so no rule's order can give one the
  // card's (E190, E191: the notebook page's raised fill once won on the
  // collections page; BVJ, 2026-11-19: "have the field be white").
  assert.match(kitLook(".kit-field"), /background:\s*var\(--color-page\)/);
  takes("field", [".desk-sheet__minutes input", ".desk-sheet__lines input", ".desk-sheet__ref input", ".desk-passage__field", ".desk-pick__filter", '.desk-np input[type="search"]', '.desk-np input[type="text"]', ".desk-np select"]);
  for (const sel of ['.desk-np input[type="search"],\n.desk-np input[type="text"],\n.desk-np select', ".collection-page__new :is(input, textarea).desk-pick__filter"]) {
    assert.doesNotMatch(rule(sel), /background|border/, sel);
  }
  // The rich text editor draws its own (above): the field's fill on its card.
  assert.match(rule(".desk-rich-editor"), /background:\s*var\(--desk-field\)/);
  // Cards take the card fill and edge.
  // A collection's members are each a sheet's part, in the same rule (E192).
  for (const sel of [".desk-sheet__module,\n.collection-page__member", ".desk-sheet__sheet", ".desk-sheet__passage-form", ".desk-sheet__ask"]) {
    const r = rule(sel);
    assert.match(r, /background:\s*var\(--desk-card\)/, sel);
    assert.match(r, /border:\s*1px solid var\(--desk-card-edge\)/, sel);
  }
  // The Sheets pane keeps a pane's own color (BVJ, 2026-11-11), so there its
  // cards take a color of their own; nothing paints the pane's body. The
  // Collections pane draws its list from the same classes, so its cards match
  // (BVJ, 2026-11-19).
  const paneCards = rule(".desk-pane :is(.desk-sheet, .desk-collections)");
  assert.match(paneCards, /--desk-card:\s*var\(--desk-pane-card\)/);
  assert.doesNotMatch(paneCards, /background/);
  // Controls are the kit's, which holds every state to 4.5:1 words and 3:1
  // edges (test/featherboa-kit.test.js; test/desk-buttons-css.test.js holds
  // the desk's inventory): the template choices are list rows, the command
  // row and the panes' lock plain buttons, and the chips tinted.
  takes("row", [".desk-sheet__from-item"]);
  takes("plain", [".desk-cmdrow__btn", ".desk-pane__pin", ".desk-sheet__btn:not(.desk-sheet__btn--primary, [data-focus-key^=\"delete\"])"]);
  takes("tinted", [".desk-pin", ".desk-sheet__chip"]);
  // The layers' dark values are declared in both of desk.css's dark blocks;
  // the buttons' own (--desk-control and the rest) went with the kinds.
  for (const [dark, count] of [["--desk-pane-card: #262628;", 2], ["--desk-field: var(--surface);", 2], ["--desk-control", 0]]) {
    assert.equal(css.split(dark).length - 1, count, dark);
  }
});

// Featherboa's grays (Phase 1, "Color") put both in the third ink, which is
// 5.1:1 on the page by day and 5.7:1 or more by night.
test("small secondary text takes the third ink, 4.5:1 or more on every surface (XA8-3)", () => {
  for (const sel of [".desk-cmds__hint", ".desk-item__kind", ".desk-sheet__saved", ".desk-sheet__from-kind", ".desk-title__hint--about"]) {
    assert.match(rule(sel), /color:\s*rgba\(var\(--ink-rgb\), var\(--text-3-alpha\)\)/, sel);
  }
});

test("the desk's fields show their placeholder in the third ink (XA8-13, LV8-3)", () => {
  // The kit's field draws it, at full strength (Firefox fades a placeholder
  // by itself); the desk's own rule went once every desk field was the kit's.
  const m = kit.match(/\n:is\(\.kit-field, [^{]*\)\)::placeholder \{([^}]*)\}/);
  assert.ok(m, "no ::placeholder rule in the kit");
  assert.match(m[1], /color:\s*rgba\(var\(--color-text-rgb\), var\(--text-3-alpha\)\)/);
  assert.match(m[1], /opacity:\s*1/);
  // Both themes read the same rule: the dark blocks flip the text's rgb.
  assert.doesNotMatch(m[1], /#|rgb\(\d/);
  assert.doesNotMatch(css, /::placeholder/, "a desk rule of its own would draw over the kit's");
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
  // A busy button doesn't take the hover look either: the notice's Keep and
  // the form's Save are the kit's filled, its Delete the kit's danger, and
  // no level's hover reaches a disabled or aria-disabled button.
  takes("filled", [".desk-notice__keep", ".desk-editor__save"]);
  takes("danger", [".desk-notice__delete"]);
  for (const anchor of [".kit-btn--filled", ".kit-btn--danger"]) {
    // (A hover rule may sit inside @media (hover: hover), indented.)
    assert.match(kit, new RegExp(`\\n\\s*:is\\(${anchor.replace(/[.-]/g, "\\$&")}, [^{]*\\)\\):hover:not\\(:disabled, \\[aria-disabled="true"\\]\\) \\{`), anchor);
  }
});

test("the Sheets editor's states have forced-colors rules (XA8-7)", () => {
  const start = css.indexOf("The Sheets editor's states in forced colors");
  assert.ok(start > 0);
  const end = css.indexOf("M6: Print with my notes", start);
  const block = css.slice(start, end);
  assert.match(block, /@media \(forced-colors: active\)/);
  // A chip that is on, and every button's edge, are the kit's: a 2px edge in
  // Highlight, and ButtonBorder.
  takes("tinted", [".desk-sheet__chip"]);
  takes("plain", [".desk-sheet__after-btn"]);
  const forced = kit.slice(kit.indexOf("@media (forced-colors: active)"));
  assert.match(forced, /:is\(\.kit-btn--tinted, [^{]*\)\)\[aria-pressed="true"\],[^{]*\{\s*border-color:\s*Highlight;\s*border-width:\s*2px;/);
  assert.match(forced, /:is\(\.kit-btn--plain, [^{]*\{\s*border-color:\s*ButtonBorder;/);
  assert.match(block, /\.desk-sheet__drop\s*\{[^}]*border-top:\s*3px solid Highlight/);
  assert.match(block, /\.desk-rich-editor:focus-within\s*\{[^}]*outline:\s*2px solid Highlight/);
  // The main action keeps a thicker edge: the kit's, for every filled
  // button, the Sheets' primary among them.
  takes("filled", [".desk-sheet__btn--primary"]);
  assert.match(forced, /The one main action keeps its weight[^*]*\*\/\s*:is\(\.kit-btn--filled, [^{]*\{\s*border-width:\s*2px;/);
  assert.match(block, /\.desk-sheet__meter > span\s*\{[^}]*background:\s*Highlight/);
});
