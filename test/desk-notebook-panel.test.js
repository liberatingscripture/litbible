// test/desk-notebook-panel.test.js
//
// Audit 3, session 2 (the Notebook panel). These are mostly focus and
// event-order rules that need a browser to run, so what is held here is the
// source that carries each one: a later edit that drops a listener or
// reorders a pair fails here rather than silently in a reader's hands.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const dir = "src/scripts/desk/";

test("margin pills: the document holds Add a note before Pin, and nothing draws them reversed (decision 13)", () => {
  const pins = read(`${dir}pins.js`);
  assert.match(pins, /footnotePills\(label, \[addNoteButton\(li\.id, label\), button\]\)/);
  const css = read("src/styles/desk.css");
  const pillRules = css.match(/\.desk-fn-pills[^{]*\{[^}]*\}/g) ?? [];
  assert.ok(pillRules.length > 0);
  for (const rule of pillRules) assert.doesNotMatch(rule, /row-reverse|column-reverse/, rule);
});

test("a margin redraw that moves a footnote's pills keeps focus on one that shows (NB3-3)", () => {
  const margin = read(`${dir}notes-margin.js`);
  assert.match(margin, /keepPillFocus\(\(\) => \{[\s\S]*data-desk-fn-margin/);
  assert.match(read(`${dir}footnote-pills.js`), /export function keepPillFocus/);
});

test("every list that filters by the search box hears the browser's own clear (LV3-1)", () => {
  for (const file of ["tab-mine.js", "kept-list.js"]) {
    const src = read(`${dir}${file}`);
    // Typing is debounced (NB8-4, GF8b-8); the browser's clear is drawn at once.
    assert.match(src, /queryBox\.addEventListener\("input", \(\) => \{[\s\S]*?setTimeout\(takeQuery, QUERY_DELAY_MS\)/, file);
    assert.match(src, /for \(const type of \["search", "change"\]\) queryBox\.addEventListener\(type, takeQuery\)/, file);
  }
  assert.match(read(`${dir}search-pane.js`), /input\.addEventListener\("search"/);
});

test("Escape in a search field that holds words clears it and does not fold the Notebook (NB3-6)", () => {
  const src = read(`${dir}panel.js`);
  const handler = src.slice(src.indexOf('panel.addEventListener("keydown"'));
  const clear = handler.indexOf('t.type === "search"');
  const fold = handler.indexOf("collapse();");
  assert.ok(clear > 0 && fold > clear, "the search-field check comes before collapse()");
});

// The reveal that NB3-9 kept from moving focus no longer opens the panel at
// all (E74): the first write marks the tab and offers it in the bar.
test("E74: the first write marks the Notebook and offers it, and never opens it or moves focus itself", () => {
  const src = read(`${dir}panel.js`);
  assert.match(src, /reveal: \(\) => nudgePanel\(\)/);
  const nudge = src.slice(src.indexOf("function nudgePanel"), src.indexOf("function setNudge")).replace(/\/\/.*$/gm, "");
  const before = nudge.slice(0, nudge.indexOf("showUndo("));
  assert.doesNotMatch(before, /\bopen\(|expand\(|rail\.|\.focus\(/, "nothing opens, expands or takes focus before the reader presses");
  assert.match(before, /barShowing\(\)/, "a record's own Undo is never replaced");
  assert.match(src, /if \(shown\(\)\) setNudge\(false\);/, "the mark goes once the panel is open");
});

test("a hand fold or expand cancels what Hide my marks remembered (NB3-7)", () => {
  const src = read(`${dir}panel.js`);
  assert.match(src, /createRail\(panel, tab, \(state\) => \{\s*if \(!foldingByHide\) foldedByHide = false;/);
});

test("three buttons that used to disable themselves keep focus (NB3-8)", () => {
  assert.doesNotMatch(read(`${dir}trash-list.js`), /\.disabled = /);
  assert.doesNotMatch(read(`${dir}undo-bar.js`), /\.disabled = /);
  assert.doesNotMatch(read(`${dir}panel.js`), /ask\.disabled = /);
});

test("a second Save while the first is in flight is ignored (NB3-13)", () => {
  const src = read(`${dir}note-editor.js`);
  assert.match(src, /async function save\(\) \{\s*if \(saving\) return;\s*saving = true;/);
});

test("the skip link is out of the tab order when the Notebook is off, and the menu makes every skip link inert (NB3-10)", () => {
  assert.match(read(`${dir}panel.js`), /setAttribute\("data-desk-skip", ""\)/);
  assert.match(read("src/styles/desk-tab.css"), /html\[data-desk-show="off"\] \.skip-link\[data-desk-skip\]\s*\{\s*display: none;/);
  const header = read("src/components/SiteHeader.astro");
  assert.match(header, /\.\.\.document\.querySelectorAll\("\.skip-link"\)/);
  assert.match(header, /for \(const el of bgRegions\(\)\) el\.inert = open;/);
});

test("My Notes leaves sheets out before anything is counted (LV3-3)", () => {
  const src = read(`${dir}tab-mine.js`);
  assert.match(src, /const everything = withoutSheets\(/);
});
