// The Study Desk's buttons are the kit's (Featherboa's Phase 2; ledger
// CT-25). E126's four kinds of button (BVJ, 2026-11-12, the "Raised" look)
// and E159's pills are gone: every control the desk draws takes exactly one of
// kit.css's levels (filled, tinted, plain, danger, row, tab, inline, field,
// dot), by name, and the desk's own rules say only where a control sits and
// how big it is. test/featherboa-kit.test.js holds the kit itself and that no
// stylesheet draws a control's look; this holds the desk's inventory to its
// levels, the desk's modifiers to drawing nothing over them, and what the
// kinds' rules carried that still holds (E116 and E117's strips, E168's
// square, E169's swatches).

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { allNames, namesOf } from "../scripts/lib/kit-lists.mjs";

const read = (f) => readFileSync(new URL(`../src/styles/${f}`, import.meta.url), "utf8");
const desk = read("desk.css");
const search = read("desk-search.css");
const kit = read("kit.css");

/** Asserts each name is one of a level's names in kit.css. */
function takes(level, names) {
  const list = namesOf(kit, level);
  for (const n of names) assert.ok(list.includes(n), `${n} is the kit's ${level}`);
}

// BVJ's inventory (E126), each at its level. Filled is a view's one main
// action; tinted the usual next step and a set's chips; plain everything
// else; red words delete.
const FILLED = [
  ".desk-sheet__btn--primary", // a sheet's primary (its own looks are desk-sheet-view.css's until Phase 11)
  ".desk-editor__save",
  ".desk-notice__keep",
  ".desk-tour__next",
  ".desk-offer__go",
  ".desk-rich-link__button--primary",
  ".desk-undo__choice--primary",
  ".desk-backup__import",
  ".desk-gather__btn--primary:not(.desk-gather__go)", // /search's chooser: New sheet
];
const TINTED = [
  ".desk-pin", // Pin, on when pinned (E159)
  ".desk-mine__label", // label chips
  ".desk-greek__show-sources",
  ".desk-sheet__chip", // a sheet's blank chips
  ".desk-search__btn--primary", // the Search pane's strip: Add to sheet, New sheet
  ".desk-gather__go", // /search's head rows: one to a group, and a page shows several
  '.desk-swatch[data-choice="all"]', // the color filters' "All", a chip with words
  ".desk-lit__back", // E168's way back: quiet, the arrow alone was easy to miss (queue Q19)
];
const PLAIN = [
  ".desk-cmdrow__btn", // the command row, its New sheet… included
  ".desk-lit__show", // the LIT pane's Show ▾
  ".desk-pane__pin", // Stay here, a toggle
  ".desk-pane__page", // the Sheets and Collections panes' page link (E180)
  ".desk-item__edit",
  ".desk-verse__step", // This verse's Previous and Next (E141)
  ".desk-mine__more-button",
  ".desk-note__more", // a margin stack's "N more notes" (E147)
  ".desk-note__edit", // a margin note's Edit
  ".desk-np__more",
  ".desk-mine__add",
  ".desk-editor__cancel",
  ".desk-greek__goto",
  ".desk-greek__back",
  ".desk-greek__retry",
  ".desk-greek__choices-more",
  ".desk-greek__hits-more",
  ".desk-dp__retry",
  ".desk-search__btn:not(.desk-search__btn--primary)", // Bible order, a toggle
  '.desk-sheet__btn:not(.desk-sheet__btn--primary, [data-focus-key^="delete"])', // E121's Cancel among them
  ".desk-tour__back",
  ".desk-offer__later", // the tour offer's Later
  ".desk-labels__add",
  ".desk-ws__menu-actions button",
  ".desk-rich-link__button:not(.desk-rich-link__button--primary)",
  ".desk-gather__btn:not(.desk-gather__btn--primary, .desk-gather__btn--quiet)", // /search's Cancel and Undo
  ".desk-tab", // the minimized Notebook (its panel's controls carry the kit's classes)
  ".desk-sync__again", // the sync's Reconnect
  ".desk-circle", // a margin note's glyph
];
const DANGER = [
  ".desk-item__delete",
  ".desk-verse__remove",
  ".desk-notice__delete", // the change notice's Delete
  ".desk-editor__delete", // the note editor's Delete
  ".desk-editor__discard",
  '.desk-sheet__btn[data-focus-key^="delete"]',
];
// A command, a template, a sheet to add to, a print: each a list row.
const ROW = [".desk-cmds__row", ".desk-command", ".desk-sheet__from-item", ".desk-gather__sheet", ".desk-print-menu__choices > :is(a, button)"];
// A row of choices, each a tab: the chosen one underlined and heavier.
const TAB = [".desk-seg__option", ".desk-greek__choice", ".desk-search__choice", ".desk-ws__shape", ".desk-editor__marker"];
// A press inside a line of words.
const INLINE = [".desk-search__pick-clear", ".desk-gather__btn--quiet"];

test("every button in the desk's inventory takes one level of the kit", () => {
  takes("filled", FILLED);
  takes("tinted", TINTED);
  takes("plain", PLAIN);
  takes("danger", DANGER);
  takes("row", ROW);
  takes("tab", TAB);
  takes("inline", INLINE);
  // A toggle is a button with aria-pressed, which the kit draws on: Stay
  // here, Bible order and the Greek's word choices among them.
  takes("tab-on", [".desk-seg__option:has(:checked)", ".desk-editor__marker:has(:checked)"]);
});

test("the desk keeps none of E126's kinds: no rules, no tokens, no lift", () => {
  for (const [name, css] of [["desk.css", desk], ["desk-search.css", search]]) {
    assert.doesNotMatch(css, /Four kinds of button/, `${name}: the kinds' section is gone`);
    assert.doesNotMatch(css, /--desk-(control|btn-[\w-]+|primary-[\w-]+)\b/, `${name}: the buttons' tokens are gone`);
    assert.doesNotMatch(css, /@media \(prefers-reduced-motion: reduce\) \{\s*:root \{[^}]*--desk-btn-lift-y/, `${name}: nothing lifts, so reduced motion has nothing to take away`);
  }
  // A row whose checkbox is checked keeps the desk's own tint, in both dark
  // selectors alike (desk-search.css's rows on /search draw a rule only).
  const block = (head) => {
    const at = desk.indexOf(head);
    assert.ok(at >= 0, `no ${head} block`);
    return desk.slice(at, desk.indexOf("}", at));
  };
  const tint = (head) => block(head).match(/--desk-pick-tint:\s*([^;]+);/)?.[1];
  assert.ok(tint(":root {"), "--desk-pick-tint in :root");
  const followed = tint(':root:not([data-theme="light"]) {');
  assert.ok(followed, "--desk-pick-tint in the followed dark block");
  assert.equal(tint(':root[data-theme="dark"] {'), followed, "the same in both dark selectors");
  assert.notEqual(followed, tint(":root {"), "with a dark value of its own");
});

/** The subject of a selector (its last compound), with :not() and :has() taken out. */
function subjectOf(sel) {
  const last = sel.trim().split(/\s*[>+~]\s*|\s+(?![^(]*\))/).filter(Boolean).pop() || "";
  return last.replace(/:(?:not|has|is|where)\((?:[^()]|\([^()]*\))*\)/g, "");
}

test("no desk rule paints a control's edge, fill or shadow, a modifier's included", () => {
  // The kit's names are read at a class's weight, so a modifier or a second
  // class on the same button (.desk-flag--row, .desk-pin--glyph) would draw
  // over the kit unseen by the kit's own test, which knows controls by name.
  // A control is a name's subject: in `.desk-np__ask button` the box is not
  // one. A transparent edge, forced colors' system colors, and a mark drawn
  // in a ::before or ::after (a dot that says something is due) are allowed;
  // showing and hiding by opacity is not a look, and fading what can't be
  // used is the kit test's to catch.
  const classes = new Set(
    Object.values(allNames(kit)).flat()
      .flatMap((n) => [...subjectOf(n).matchAll(/\.(desk-[\w-]+|account__[\w-]+)/g)].map((m) => m[1])),
  );
  const base = (c) => c.replace(/--[\w-]+$/, "");
  const found = [];
  for (const [name, css] of [["desk.css", desk], ["desk-search.css", search]]) {
    let screen = css.replace(/\/\*[\s\S]*?\*\//g, "");
    // Forced colors' and print's rules are their own.
    for (const at of ["@media (forced-colors: active)", "@media print"]) {
      for (let i = screen.indexOf(at); i >= 0; i = screen.indexOf(at, i + 1)) {
        let depth = 0;
        let j = screen.indexOf("{", i);
        for (; j < screen.length; j++) {
          if (screen[j] === "{") depth++;
          else if (screen[j] === "}" && --depth === 0) break;
        }
        screen = screen.slice(0, i) + screen.slice(j + 1);
      }
    }
    for (const m of screen.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      for (const sel of m[1].split(/,(?![^(]*\))/)) {
        if (/::?(before|after)\b/.test(sel)) continue;
        const subject = subjectOf(sel);
        const hit = [...subject.matchAll(/\.([\w-]+)/g)].map((c) => c[1]).find((c) => classes.has(c) || classes.has(base(c)));
        if (!hit) continue;
        for (const d of m[2].split(";").map((x) => x.trim()).filter(Boolean)) {
          const [prop, value = ""] = d.split(/:\s*/, 2);
          if (!/^(border(-top|-bottom|-left|-right)?(-color)?|background(-color|-image)?|box-shadow|filter)$/.test(prop)) continue;
          if (/^(0|none|transparent)$|transparent|Highlight|ButtonText|ButtonBorder|GrayText|Canvas/.test(value)) continue;
          found.push(`${name}: ${sel.trim().replace(/\s+/g, " ")} { ${d} } (.${hit})`);
        }
      }
    }
  }
  assert.deepEqual(found, []);
});

test("E159: a row of choices is the kit's tabs; .desk-seg draws no pill of its own", () => {
  const seg = desk.match(/\n\.desk-seg\s*\{([^}]*)\}/);
  assert.ok(seg, "no .desk-seg rule");
  assert.match(seg[1], /display:\s*inline-flex/);
  assert.match(seg[1], /flex-wrap:\s*wrap/, "a row that wraps, as the kit's choices do");
  assert.doesNotMatch(seg[1], /background|border|box-shadow/, "no fill or edge: each choice is a tab");
  // The hidden radio's focus is drawn on its words, in the one ring.
  assert.match(desk, /\.desk-seg__input:focus-visible \+ \.desk-seg__text \{[^}]*outline:\s*2px solid var\(--focus-ring\)[^}]*outline-offset:\s*2px/);
});

test("E169: a highlight color's swatch is the kit's color dot, and paints no fill or edge of its own", () => {
  // The menus' Highlight row and the color filters drew the menu's own
  // surface inside a faint edge, so the button was the color behind it. Now
  // each color is the kit's dot, filled with its color through --kit-dot,
  // and "All", a chip with words, is the kit's tinted.
  takes("dot", [".desk-swatch:where(button)[data-color]"]);
  takes("tinted", ['.desk-swatch[data-choice="all"]']);
  for (const color of ["yellow", "green", "blue", "pink"]) {
    assert.match(desk, new RegExp(`\\.desk-swatch\\[data-color="${color}"\\] \\{\\s*--kit-dot:\\s*var\\(--desk-hl-${color}\\);`), color);
  }
  const plain = desk.replace(/\/\*[\s\S]*?\*\//g, "");
  for (const m of plain.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    if (!m[1].split(",").some((sel) => /\.desk-swatch(?![\w-])/.test(sel) && !/\.desk-swatch__sample/.test(sel))) continue;
    assert.doesNotMatch(m[2], /(^|;)\s*(border(-color)?|background(-color)?|box-shadow)\s*:/, `${m[1].trim()} paints its own`);
  }
});

test("E141: a button's corner is the kit's, so the arrows, every Pin and the lock are never a circle or a pill", () => {
  // BVJ, 2026-11-17: "The next/previous and pin buttons in the notebook are
  // still circles/ovals instead of rounded rectangles." The kit gives every
  // button and chip the pressed corner (6px); no desk rule sets its own.
  for (const anchor of ["kit-btn--plain", "kit-btn--tinted"]) {
    const m = kit.match(new RegExp(`\\n:is\\(\\.${anchor}, [^{]*\\)\\) \\{([^}]*)\\}`));
    assert.ok(m, `no look rule for .${anchor}`);
    assert.match(m[1], /border-radius:\s*var\(--radius-press\)/, anchor);
  }
  const plain = desk.replace(/\/\*[\s\S]*?\*\//g, "");
  const radii = (sel) =>
    [...plain.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
      .filter((m) => m[1].split(",").some((s) => new RegExp(`${sel.replace(/\./g, "\\.")}(?![\\w-])`).test(s) && !/::?(before|after)/.test(s)))
      .flatMap((m) => [...m[2].matchAll(/border-radius:\s*([^;]+)/g)].map((r) => r[1].trim()));
  for (const sel of [".desk-verse__step", ".desk-pin", ".desk-pane__pin", ".desk-greek__show-sources", ".desk-mine__label", ".desk-sheet__chip"]) {
    assert.deepEqual(radii(sel), [], `${sel} takes the kit's corner`);
  }
});

test("E168: the way back as the arrow alone is the bar's square, and the kit's tinted button at every width", () => {
  // BVJ, 2026-11-19, found the arrow alone, quiet, "subtle and easy to miss"
  // and asked for it to read as a button. Its look is the kit's tinted level
  // (a box at rest) at every width (queue Q19); the bar's width only decides
  // whether its place's name shows.
  takes("tinted", [".desk-lit__back"]);
  const rule = (css, sel) => {
    const at = css.indexOf(`${sel} {`);
    assert.ok(at >= 0, `no rule ${sel}`);
    return css.slice(at + sel.length + 2, css.indexOf("}", at));
  };
  const decl = (body, prop) => body.match(new RegExp(`(?:^|;)\\s*${prop}:\\s*([^;]+);`))?.[1].replace(/\s+/g, " ").trim();
  for (const [query, sel] of [
    ["@container deskLitBar (max-width: 32em) {", ".desk-lit__back"],
    ['@container deskLitBar (max-width: 38em) {', 'html[data-font="dyslexic"] .desk-lit__back'],
  ]) {
    assert.ok(desk.includes(query), `the bar's ${query}`);
    const shape = rule(desk.slice(desk.indexOf(query)), sel);
    assert.equal(decl(shape, "width"), "30px", "the square of the bar's other controls");
    for (const prop of ["background", "border", "border-radius", "box-shadow", "color"]) {
      assert.equal(decl(shape, prop), undefined, `${sel} ${prop}: the kit's`);
    }
  }
  const named = rule(desk, ".desk-lit__back");
  for (const prop of ["background", "border", "border-radius", "box-shadow", "color"]) {
    assert.equal(decl(named, prop), undefined, `.desk-lit__back ${prop}: the kit's`);
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
