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

import { MIN_PANEL_ROOM, READING_SURFACES, panelRoom, readingSurface, shiftClearOfDock } from "../src/scripts/desk-frame.js";

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

// How much window a floating panel (the verse menu, a footnote popover) may use
// beside the open Notebook (BA27). It gets the window less the dock, unless that
// leaves a sliver, and then it lies over the Notebook instead.

test("a panel may use the whole window when the Notebook is closed", () => {
  assert.equal(panelRoom(1440, 0), 1440);
});

test("a panel uses the window less the Notebook when that leaves real room", () => {
  assert.equal(panelRoom(1440, 400), 1040);
});

test("exactly the minimum room left is enough, so the panel stays beside the Notebook", () => {
  assert.equal(MIN_PANEL_ROOM, 300);
  assert.equal(panelRoom(1000, 700), 300);
});

test("one pixel under the minimum room, the panel gets the whole window", () => {
  assert.equal(panelRoom(1000, 701), 1000);
});

test("a Notebook dragged nearly window-wide no longer squeezes the panel to a sliver (the audit's case)", () => {
  assert.equal(panelRoom(900, 832), 900);
});

// A panel already open when the Notebook grows under it moves left, but only as
// far as it needs to and never off the window's left edge (BA28).

test("a panel already clear of the Notebook doesn't move", () => {
  assert.equal(shiftClearOfDock({ left: 100, right: 500 }, 1000), 0);
  assert.equal(shiftClearOfDock({ left: 100, right: 988 }, 1000), 0, "ending exactly at the edge is clear");
});

test("a panel overlapping the Notebook moves left by the overlap", () => {
  assert.equal(shiftClearOfDock({ left: 600, right: 1000 }, 900), 112);
  assert.equal(shiftClearOfDock({ left: 600, right: 989 }, 1000), 1);
});

test("a panel wider than the room moves only as far as the window's left margin", () => {
  assert.equal(shiftClearOfDock({ left: 100, right: 900 }, 500), 88);
});

test("a panel already at or left of the margin never moves, and never by a negative amount", () => {
  assert.equal(shiftClearOfDock({ left: 12, right: 900 }, 500), 0);
  assert.equal(shiftClearOfDock({ left: 4, right: 900 }, 500), 0);
});

test("shiftClearOfDock honors a custom margin", () => {
  assert.equal(shiftClearOfDock({ left: 600, right: 1000 }, 900, 0), 100);
  assert.equal(shiftClearOfDock({ left: 20, right: 900 }, 500, 20), 0);
  assert.equal(shiftClearOfDock({ left: 100, right: 900 }, 500, 40), 60);
});

// Escape in the Notebook has to ignore float-window.js's windows (the tour offer,
// the Greek commands): they wear the panels' lit-panel class but not
// lit-panel.js's shared slot, so a class check treated them as an open panel and
// Escape did nothing (BA24). The slot is what currentPanel() reports.

test("the Notebook's Escape asks currentPanel(), not whether anything wears the lit-panel class", () => {
  const panel = readFileSync(new URL("../src/scripts/desk/panel.js", import.meta.url), "utf8");
  assert.doesNotMatch(panel, /querySelector\(\s*["'`]\.lit-panel/);
  assert.match(panel, /if \(currentPanel\(\)\) return;/);
});
