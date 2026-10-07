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
  assert.equal(readingSurface(docWith(".article__card")).title, ".article__title");
  // /search uses .scripture-main inside its own layout type, and the home
  // page and the articles list have no reading column at all.
  assert.equal(readingSurface(docWith(".scripture-layout--search .scripture-main")), null);
  assert.equal(readingSurface(docWith()), null);
});
