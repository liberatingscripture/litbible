// The Study Desk's four kinds of button (E126; BVJ, 2026-11-12, the "Raised"
// look): ordinary, toggle, primary, and the quiet and glyph buttons that keep
// their own. A stylesheet has no behavior to run in node, so what is held here
// is the source: one rule per kind in desk.css's "Four kinds of button", the
// inventory each covers, no component rule painting over them, the tokens with
// a dark pair in both dark selectors (and desk-search.css's copy, which is all
// /search loads, in step), and reduced motion taking the lift away.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (f) => readFileSync(new URL(`../src/styles/${f}`, import.meta.url), "utf8");
const desk = read("desk.css");
const search = read("desk-search.css");

const SECTION = "/* ── Four kinds of button (E126)";
const kinds = desk.slice(desk.indexOf(SECTION));
const components = desk.slice(0, desk.indexOf(SECTION));
assert.ok(desk.indexOf(SECTION) > 0, "no “Four kinds of button” section");

/** The selector list inside the first `:is(…)` that opens a rule naming `first`. */
function listFrom(css, first) {
  const at = css.indexOf(`:is(${first}`);
  assert.ok(at >= 0, `no :is( list opening with ${first}`);
  let depth = 0;
  for (let i = at + 3; i < css.length; i++) {
    if (css[i] === "(") depth++;
    else if (css[i] === ")" && --depth === 0) return { list: css.slice(at + 4, i), rest: css.slice(i + 1) };
  }
  throw new Error("unclosed :is(");
}
/** The declaration block of the rule that is exactly the list `:is(L)` plus `tail`. */
function block(css, list, tail = "") {
  const head = `:is(${list})${tail} {`;
  const at = css.indexOf(head);
  assert.ok(at >= 0, `no rule :is(…)${tail}`);
  return css.slice(at + head.length, css.indexOf("}", at));
}

// Every ordinary button in the desk (BVJ's inventory, E126).
const ORDINARY = [
  ".desk-cmdrow__btn", // the command row, its New sheet… included
  ".desk-lit__show", // the LIT pane's Show ▾
  ".desk-pane__pin", // Stay here, a toggle
  ".desk-item__edit",
  ".desk-item__delete",
  ".desk-verse__remove",
  ".desk-mine__more-button",
  ".desk-np__more",
  ".desk-mine__add",
  ":where(.desk-editor__actions) button:where(:not(.desk-editor__save))", // the note editor's Cancel and Delete
  ":where(.desk-notice__actions) button:where(:not(.desk-notice__keep))", // the change notice's Delete
  ".desk-panel__reset",
  ".desk-panel__print-button",
  ".desk-greek__goto",
  ".desk-greek__back",
  ".desk-greek__retry",
  ".desk-greek__choice", // the Greek's word choices, a toggle
  ".desk-greek__choices-more",
  ".desk-greek__hits-more",
  ".desk-dp__retry",
  ".desk-search__btn:where(:not(.desk-search__btn--primary))", // Bible order, a toggle, and the strip's New sheet
  ".desk-search__choice",
  ":where(.desk-sheet, .sheets-page) .desk-sheet__btn:where(:not(.desk-sheet__btn--primary))", // E121's Cancel among them
  ".desk-sheet__choice",
];
const PILLS = [":where(.desk-verse, .desk-fns) .desk-pin", ".desk-mine__label", ".desk-greek__show-sources", ".desk-sheet__chip"];
const PRIMARY = [".desk-sheet__btn--primary", ".desk-search__btn--primary", ".desk-editor__actions .desk-editor__save", ".desk-notice__actions .desk-notice__keep"];
const has = (list, sel) => `, ${list}, `.includes(`, ${sel}, `);

test("E126: the ordinary kind is one rule, and it covers the inventory", () => {
  const { list } = listFrom(kinds, ".desk-cmdrow__btn");
  for (const sel of ORDINARY) assert.ok(has(list, sel), sel);
  const base = block(kinds, list);
  assert.match(base, /border:\s*1px solid var\(--field-border\)/, "E89's 3:1 edge");
  assert.match(base, /border-bottom-color:\s*var\(--desk-btn-edge-low\)/, "a hair darker at the foot");
  assert.match(base, /background:\s*var\(--desk-control\)/, "E89's fill");
  assert.match(base, /box-shadow:\s*var\(--desk-btn-rest\)/, "a shadow at rest");

  const hover = block(kinds, list, ':hover:not(:disabled, [aria-disabled="true"], [aria-pressed="true"], [aria-expanded="true"], :active)');
  assert.match(hover, /transform:\s*translateY\(var\(--desk-btn-lift-y\)\)/, "a 1px lift");
  assert.match(hover, /box-shadow:\s*var\(--desk-btn-lift\)/);

  const sunk = block(kinds, list, ':is(:active, [aria-pressed="true"], [aria-expanded="true"]):not(:disabled, [aria-disabled="true"])');
  assert.match(sunk, /box-shadow:\s*var\(--desk-btn-press\)/, "sunk when pressed, on or open");
  assert.match(sunk, /transform:\s*none/);

  const on = block(kinds, list, ':is([aria-pressed="true"], [aria-expanded="true"]):not(:disabled, [aria-disabled="true"])');
  assert.match(on, /border-color:\s*var\(--green-text\)/, "an on toggle or open menu: the text green's edge");
  assert.match(on, /color:\s*var\(--green-text\)/, "and its words");
  assert.ok(kinds.indexOf(on) > kinds.indexOf(sunk), "after the sunk rule, so its whole edge is green");

  const off = block(kinds, list, ':is(:disabled, [aria-disabled="true"])');
  assert.match(off, /color:\s*rgba\(var\(--ink-rgb\), 0\.7\)/, "words at 70%: 4.5:1 on every surface");
  assert.match(off, /border-color:\s*var\(--field-border\)/, "and still a button's edge");
  assert.match(off, /box-shadow:\s*none/);
  assert.match(off, /opacity:\s*1/, "no faded opacity under it");
});

test("E126: a toggle is an ordinary button with aria-pressed, or a pill", () => {
  const { list } = listFrom(kinds, ".desk-cmdrow__btn");
  for (const sel of [".desk-pane__pin", ".desk-greek__choice", ".desk-search__btn:where(:not(.desk-search__btn--primary))"]) {
    assert.ok(has(list, sel), `${sel} takes the ordinary rule's on state`);
  }
  const pills = listFrom(kinds, PILLS[0]).list;
  for (const sel of PILLS) assert.ok(has(pills, sel), sel);
  const base = block(kinds, pills);
  assert.match(base, /border:\s*1px solid var\(--field-border\)/);
  assert.match(base, /background:\s*var\(--desk-control\)/);
  assert.doesNotMatch(base, /^\s*box-shadow:/m, "flat at rest: a row of chips with shadows reads as noise");
  const on = block(kinds, pills, '[aria-pressed="true"]:not(:disabled)');
  assert.match(on, /border-color:\s*var\(--green-text\)/);
  assert.match(on, /color:\s*var\(--green-text\)/);
});

test("E126: the primary is Deep Green with white words, and disabled it still reads as a button", () => {
  const { list } = listFrom(kinds, PRIMARY[0]);
  for (const sel of PRIMARY) assert.ok(has(list, sel), sel);
  const base = block(kinds, list);
  assert.match(base, /background:\s*var\(--green-deep\)/);
  assert.match(base, /color:\s*#fff/);
  assert.match(base, /border-color:\s*var\(--desk-primary-edge\)/, "in dark the text green at 70%");
  const off = block(kinds, list, ':is(:disabled, [aria-disabled="true"])');
  assert.match(off, /border-color:\s*var\(--desk-primary-edge\)/);
  assert.match(off, /background:\s*var\(--desk-primary-off\)/);
  assert.match(off, /color:\s*var\(--green-text\)/);
  assert.match(off, /opacity:\s*1/);
  // /search's head row and chooser take the same looks from desk-search.css.
  assert.match(search, /\.desk-gather__btn--primary\s*\{[^}]*background:\s*var\(--green-deep\)[^}]*color:\s*#fff/);
  assert.match(search, /\.desk-gather__btn--primary:is\(:disabled, \[aria-disabled="true"\]\)\s*\{[^}]*background:\s*var\(--desk-primary-off\)[^}]*color:\s*var\(--green-text\)/);
  assert.match(search, /\.desk-gather__btn:where\(:not\(\.desk-gather__btn--primary, \.desk-gather__btn--quiet\)\)\s*\{[^}]*border-color:\s*var\(--field-border\)[^}]*background:\s*var\(--desk-control\)/);
});

test("E126: no component rule paints an inventory button's edge, fill or shadow (the old outlines are gone)", () => {
  // Each component rule says its size and shape; the looks are the kinds'. A
  // transparent edge (a width for the kinds to color) and forced colors'
  // system colors are allowed. The reading pages' own Pin (a bare .desk-pin)
  // stays quiet and keeps its rules; only This verse's and the Footnotes
  // pane's are pills.
  const classes = [
    ".desk-cmdrow__btn", ".desk-lit__show", ".desk-pane__pin", ".desk-item__edit", ".desk-item__delete", ".desk-verse__remove",
    ".desk-mine__more-button", ".desk-np__more", ".desk-mine__add", ".desk-editor__actions", ".desk-editor__save",
    ".desk-notice__actions", ".desk-notice__keep", ".desk-panel__reset", ".desk-panel__print-button", ".desk-greek__goto",
    ".desk-greek__back", ".desk-greek__retry", ".desk-greek__choice", ".desk-greek__choices-more", ".desk-greek__hits-more",
    ".desk-dp__retry", ".desk-search__btn", ".desk-search__choice", ".desk-sheet__btn", ".desk-sheet__choice",
    ".desk-mine__label", ".desk-greek__show-sources", ".desk-sheet__chip",
  ];
  const named = (sel) =>
    classes.some((c) => new RegExp(`${c.replace(/\./g, "\\.")}(?![\\w-])`).test(sel)) ||
    (/\.desk-pin(?![\w-])/.test(sel) && /\.desk-(verse|fns)(?![\w-])/.test(sel));
  const plain = components.replace(/\/\*[\s\S]*?\*\//g, "");
  const found = [];
  for (const m of plain.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const sel = m[1].trim();
    if (!named(sel)) continue;
    for (const d of m[2].split(";").map((x) => x.trim())) {
      const [prop, value = ""] = d.split(/:\s*/, 2);
      if (!/^(border(-top|-bottom|-left|-right)?(-color)?|background(-color)?|box-shadow|opacity)$/.test(prop)) continue;
      if (/transparent|Highlight|ButtonText|ButtonBorder|GrayText|Canvas/.test(value)) continue;
      found.push(`${sel.replace(/\s+/g, " ")} { ${d} }`);
    }
  }
  assert.deepEqual(found, []);
  // The faint outlines E126 replaced, by name.
  assert.doesNotMatch(components, /\.desk-cmdrow__btn\s*\{[^}]*rgba\(var\(--ink-rgb\), 0\.(2|3)\d?\)/);
  assert.doesNotMatch(components, /\.desk-search__btn\s*\{[^}]*border:\s*1px solid rgba/);
});

/** The custom properties declared in the first block opening with `head` whose body declares `marker`. */
function tokens(css, head, marker = "--desk-btn-rest") {
  let from = 0;
  for (;;) {
    const at = css.indexOf(head, from);
    assert.ok(at >= 0, `no ${head} block declaring ${marker}`);
    const body = css.slice(at + head.length, css.indexOf("}", at));
    if (body.includes(marker)) return new Map([...body.matchAll(/(--[\w-]+):\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]));
    from = at + head.length;
  }
}

const LIGHT_ONLY = ["--desk-btn-lift-y", "--desk-btn-motion"]; // the same in every theme
const BUTTON_TOKENS = [
  "--desk-control",
  "--desk-btn-edge-low",
  "--desk-btn-rest",
  "--desk-btn-lift",
  "--desk-btn-press",
  "--desk-btn-hover",
  "--desk-btn-down",
  ...LIGHT_ONLY,
  "--desk-primary-edge",
  "--desk-primary-press",
  "--desk-primary-off",
  "--desk-pick-tint",
];

test("E126: both dark selectors carry every token, with a dark pair for every shadow, in desk.css and desk-search.css alike", () => {
  const sets = {};
  for (const [name, css] of [["desk.css", desk], ["desk-search.css", search]]) {
    const light = tokens(css, ":root {");
    const followed = tokens(css, ':root:not([data-theme="light"]) {');
    const forced = tokens(css, ':root[data-theme="dark"] {');
    assert.match(css, /@media \(prefers-color-scheme: dark\) \{\s*:root:not\(\[data-theme="light"\]\) \{[^}]*--desk-btn-rest/, `${name}: the followed dark block is inside the media query`);
    for (const t of BUTTON_TOKENS) {
      assert.ok(light.has(t), `${name}: ${t} in :root`);
      if (LIGHT_ONLY.includes(t)) continue;
      assert.ok(followed.has(t), `${name}: ${t} in the followed dark block`);
      assert.ok(forced.has(t), `${name}: ${t} in [data-theme="dark"]`);
      assert.equal(followed.get(t), forced.get(t), `${name}: ${t} is the same in both dark selectors`);
    }
    for (const t of ["--desk-btn-rest", "--desk-btn-lift", "--desk-btn-press", "--desk-primary-press"]) {
      assert.notEqual(followed.get(t), light.get(t), `${name}: ${t} has a dark value of its own`);
    }
    sets[name] = { light, dark: forced };
  }
  for (const t of BUTTON_TOKENS) {
    assert.equal(sets["desk-search.css"].light.get(t), sets["desk.css"].light.get(t), `${t}: /search's copy matches, light`);
    if (!LIGHT_ONLY.includes(t)) assert.equal(sets["desk-search.css"].dark.get(t), sets["desk.css"].dark.get(t), `${t}: /search's copy matches, dark`);
  }
  // The dark primary's edge is the text green (#3abf6a) at 70%.
  assert.equal(sets["desk.css"].dark.get("--desk-primary-edge"), "rgba(58, 191, 106, 0.7)");
});

test("E126: under reduced motion the lift and the transitions go, and the shadows stay", () => {
  for (const [name, css] of [["desk.css", desk], ["desk-search.css", search]]) {
    const m = css.match(/@media \(prefers-reduced-motion: reduce\) \{\s*:root \{([^}]*)\}\s*\}/);
    assert.ok(m, `${name}: no reduced-motion block`);
    assert.match(m[1], /--desk-btn-lift-y:\s*0px/, name);
    assert.match(m[1], /--desk-btn-motion:\s*0s/, name);
    assert.doesNotMatch(m[1], /shadow/, `${name}: the shadows still say hover and pressed`);
  }
  // Every lift and every transition in the kinds goes through the two tokens.
  for (const t of kinds.matchAll(/transform:\s*([^;]+);/g)) assert.match(t[1], /^(none|translateY\(var\(--desk-btn-lift-y\)\))$/, t[0]);
  for (const t of kinds.matchAll(/transition:([^;]+);/g)) {
    for (const part of t[1].split(",")) assert.match(part, /var\(--desk-btn-motion\)/, part.trim());
  }
});

test("E116, E117: the strips stay in view, a long label ends in “…”, and checked rows take the green rule", () => {
  assert.match(desk, /\.desk-search__pick \{[^}]*position:\s*sticky[^}]*top:\s*0/);
  assert.match(desk, /\.desk-search__pick \{[^}]*background:\s*var\(--desk-pane-card\)/, "the strip is a card in the pane");
  assert.match(search, /\.desk-gather--head \{[^}]*position:\s*sticky[^}]*top:\s*0/);
  // No button wraps inside: one line, cut with "…", over invisible copies
  // of the longest label it can read, so its width never moves.
  assert.match(desk, /\.desk-search__pick-actions \.desk-search__btn \{[^}]*white-space:\s*nowrap/);
  assert.match(desk, /\.desk-search__pick-actions \.desk-search__btn > span \{[^}]*text-overflow:\s*ellipsis/);
  assert.match(desk, /\.desk-search__label-room \{[^}]*visibility:\s*hidden/);
  assert.match(search, /\.desk-gather__go \{[^}]*white-space:\s*nowrap/);
  assert.match(search, /\.desk-gather__go > span \{[^}]*text-overflow:\s*ellipsis/);
  assert.match(search, /\.desk-gather__label-room \{[^}]*visibility:\s*hidden/);
  // The rule: the card's and the checked results' alike.
  assert.match(desk, /\.desk-search__pick--some \{[^}]*box-shadow:\s*inset 3px 0 0 var\(--green-text\)/);
  assert.match(desk, /\.desk-search__row--picked \{[^}]*background:\s*var\(--desk-pick-tint\)[^}]*box-shadow:\s*inset 3px 0 0 var\(--green-text\)/);
  assert.match(search, /\.desk-gather--some \.desk-gather__card \{[^}]*box-shadow:\s*inset 3px 0 0 var\(--green-text\)/);
  assert.match(search, /\.desk-gather__row-item--picked > \.result-link[^{]*\{[^}]*inset 3px 0 0 var\(--green-text\)/);
  // A head row's [hidden] wins over its display: flex.
  assert.match(search, /\.desk-gather\[hidden\] \{[^}]*display:\s*none/);
});
