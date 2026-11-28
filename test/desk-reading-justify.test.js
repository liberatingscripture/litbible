// test/desk-reading-justify.test.js
//
// The Display tray's Justify (RP-36 to RP-39, RP-44): with the switch on,
// the Read page's prose and every one of Study's LIT panes is justified and
// hyphenated, by E106's rule, which was the Reading layout's alone until
// Featherboa made it the switch everywhere. It is CSS alone, and a
// stylesheet has no behavior to run in node (happy-dom lays nothing out), so
// what is held here is the source that carries each of BVJ's three limits,
// the switch it hangs on, and the one line of script Reading still stamps.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const desk = read("src/styles/desk.css");
const readPage = read("src/styles/reading-page.css");
const page = read("src/scripts/desk/desk-page.js");
const layout = read("src/layouts/Layout.astro");

/** The one rule in a stylesheet that justifies, with its selector. */
function justifyRule(css, name) {
  const all = [...css.matchAll(/([^{}]+)\{([^{}]*text-align:\s*justify[^{}]*)\}/g)];
  assert.equal(all.length, 1, `${name} justifies in one rule only`);
  return { selector: all[0][1].trim(), body: all[0][2], at: all[0].index };
}

const RULES = [
  { name: "reading-page.css", css: readPage, container: "readText", column: /html\[data-justify\] \.scripture-layout--scripture \.chapter-paragraphs\s*\{\s*container:\s*readText \/ inline-size;/ },
  { name: "desk.css", css: desk, container: "deskLitText", column: /html\[data-justify\] \.desk-lit__text\s*\{\s*container:\s*deskLitText \/ inline-size;/ },
];

test("the switch justifies and hyphenates the Read page and every LIT pane, and only with the switch on", () => {
  for (const { name, css } of RULES) {
    const { selector, body } = justifyRule(css, name);
    assert.match(selector, /^html\[data-justify\]/, name);
    assert.match(body, /hyphens:\s*auto/, name);
    // A short word is never split, and no two-letter stub is left on a line.
    assert.match(body, /hyphenate-limit-chars:\s*6 3 3/, name);
  }
  assert.match(justifyRule(readPage, "reading-page.css").selector, /\.scripture-layout--scripture \.chapter-paragraphs p/);
  assert.match(justifyRule(desk, "desk.css").selector, /\.desk-lit \.chapter-paragraphs p/);
});

test("Reading no longer justifies by itself: the switch does, in every layout (RP-44)", () => {
  assert.doesNotMatch(justifyRule(desk, "desk.css").selector, /data-desk-reading/);
  assert.doesNotMatch(desk, /\[data-desk-reading\] \.desk-lit__text\s*\{\s*container/);
});

test("poetry keeps its lines", () => {
  // A poetry line is a <p> inside blockquote.hbq, so the rule must say so.
  for (const { name, css } of RULES) assert.match(justifyRule(css, name).selector, /p:not\(blockquote p\)$/, name);
});

test("the accessibility fonts keep the ragged edge and whole words", () => {
  // data-font is absent for the default fonts, and set for Atkinson and
  // OpenDyslexic alike (src/styles/CLAUDE.md, the reader font).
  for (const { name, css } of RULES) assert.match(justifyRule(css, name).selector, /^html\[data-justify\]:not\(\[data-font\]\) /, name);
});

test("a short line stays left-aligned: the rule sits in a container query on the column", () => {
  for (const { name, css, container, column } of RULES) {
    const { at } = justifyRule(css, name);
    const before = css.slice(0, at);
    const query = before.lastIndexOf(`@container ${container} (min-width: 22em)`);
    assert.ok(query > -1, `${name}: the rule is inside the ${container} query`);
    // Nothing closes the query between its opening and the rule.
    assert.doesNotMatch(before.slice(query).replace(/^[^{]*\{/, ""), /\}/, name);
    // The column is the container, so the em is the reading size's, and it
    // is a container only with the switch on.
    assert.match(css, column, name);
  }
});

test("Justify is off by default and stamped before first paint (RP-39)", () => {
  assert.match(layout, /j=s\.getItem\('lit-justify'\)/);
  assert.match(layout, /if\(j==='on'\)d\.setAttribute\('data-justify',j\)/);
  // Nothing else stamps it on, so a fresh profile is left-aligned.
  assert.equal([...layout.matchAll(/data-justify/g)].length, 1);
});

test("the page still stamps Reading after noting each pane's place and before putting it back", () => {
  // Reading still turns the marks off (Phase 9 retires it), and that rewrap
  // moves every line above the reader's, so the order is the fix: note (old
  // wrap), stamp, restore (new wrap).
  const draw = page.slice(page.indexOf("function draw()"), page.indexOf("function mark()"));
  const note = draw.indexOf("keepScroll(rec)");
  const stamp = draw.indexOf('root.toggleAttribute("data-desk-reading", arrangementOf(layout) === "reading")');
  const restore = draw.indexOf("for (const back of putBack) back?.()");
  assert.ok(note > -1 && stamp > -1 && restore > -1, "draw() notes, stamps and restores");
  assert.ok(note < stamp && stamp < restore, "in that order");
});
