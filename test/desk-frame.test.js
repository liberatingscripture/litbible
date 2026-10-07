// test/desk-frame.test.js
//
// src/scripts/desk-frame.js: which pages the Notebook appears on. Two places
// name them, since one runs before paint and the other is script: the
// READING_SURFACES list (the desk's gate and its placement) and global.css's
// :has() rule that hides the Notebook button everywhere else. A page in one
// and not the other would show a button that does nothing, or a panel with
// no button to close it.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { READING_SURFACES, readingSurface } from "../src/scripts/desk-frame.js";

const css = readFileSync(new URL("../src/styles/global.css", import.meta.url), "utf8");
const rule = /body:not\(:has\(([^)]*)\)\)\s*\[data-desk-toggle\]/.exec(css);

test("global.css hides the Notebook button on exactly the pages READING_SURFACES leaves out", () => {
  assert.ok(rule, "the :has() rule wasn't found in global.css; update this test with it");
  const inCss = rule[1].split(",").map((s) => s.trim());
  assert.deepEqual(inCss, READING_SURFACES.map((s) => s.column[0]));
});

/** A document that has exactly these selectors. */
const docWith = (...present) => ({ querySelector: (sel) => (present.includes(sel) ? {} : null) });

test("readingSurface finds Study View, intros, Read View, articles and the glossary, and nothing else", () => {
  assert.equal(readingSurface(docWith(".glossary-entries .entries-wrap")).title, ".glossary-entries .entry-title");
  assert.equal(readingSurface(docWith(".scripture-layout--scripture .scripture-main")), READING_SURFACES[0]);
  assert.equal(readingSurface(docWith(".scripture-layout--intro .scripture-main")), READING_SURFACES[1]);
  assert.equal(readingSurface(docWith(".rm-page .rm-reader")).title, ".rm-page .rm-title");
  assert.equal(readingSurface(docWith(".article__card")).start, ".article__card", "an article's panel starts level with its card");
  // /search uses .scripture-main inside its own layout type, and the home
  // page and the articles list have no reading column at all.
  assert.equal(readingSurface(docWith(".scripture-layout--search .scripture-main")), null);
  assert.equal(readingSurface(docWith()), null);
});

test("each page names the elements that make up its column, and never a full-width band", () => {
  for (const s of READING_SURFACES) {
    assert.ok(Array.isArray(s.move) && s.move.length > 0, s.column[0]);
    for (const sel of s.move) {
      assert.doesNotMatch(sel, /scripture-disclaimer|entries-panel|entries-top|glossary-entries$/, `${sel} would move a band`);
    }
  }
});

test("each page names where its reading area ends; the license band counts as footer", () => {
  const ends = Object.fromEntries(READING_SURFACES.map((s) => [s.column[0], s.end]));
  for (const page of [".scripture-layout--scripture .scripture-main", ".scripture-layout--intro .scripture-main", ".rm-page .rm-reader"]) {
    assert.deepEqual(ends[page], { selector: ".scripture-disclaimer", at: "top", gap: 16 }, page);
  }
  assert.deepEqual(ends[".article__card"], { selector: ".article__card", at: "bottom", gap: 0 });
  assert.equal(ends[".glossary-entries .entries-wrap"].at, "bottom");
});
