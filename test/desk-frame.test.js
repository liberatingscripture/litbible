// test/desk-frame.test.js
//
// src/scripts/desk-frame.js: which pages the Notebook appears on. Two places
// name them, since one runs before paint and the other is script: the
// READING_SURFACES list (the desk's gate and its placement, and through
// hasPanel the pre-paint stamps) and global.css's :has() rule that hides the
// Notebook button everywhere else. A page in one and not the other would show
// a button that does nothing, or a panel with no button to close it.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  ALL_SURFACES, MIN_PANEL_ROOM, PROSE_NOTES, READING_SURFACES, hasPanel, panelRoom, readingSurface, shiftClearOfDock, standDown,
} from "../src/scripts/desk-frame.js";
import { PROSE_NOTES as NOTES_SWITCH } from "../src/scripts/desk/page-kind.js";

const css = readFileSync(new URL("../src/styles/global.css", import.meta.url), "utf8");
const rule = /body:not\(:has\(([^)]*)\)\)\s*button\[data-desk-toggle\]/.exec(css);

test("global.css hides the Notebook button on exactly the pages READING_SURFACES leaves out", () => {
  assert.ok(rule, "the :has() rule wasn't found in global.css; update this test with it");
  const inCss = rule[1].split(",").map((s) => s.trim());
  assert.deepEqual(inCss, READING_SURFACES.map((s) => s.column[0]));
});

/** A document that has exactly these selectors. */
const docWith = (...present) => ({ querySelector: (sel) => (present.includes(sel) ? {} : null) });

const INTRO = ".scripture-layout--intro .scripture-main";
const ARTICLE = ".article__card";
const GLOSSARY = ".glossary-entries .entries-wrap";

test("readingSurface finds Chapter View and Read View, and nothing else", () => {
  assert.equal(readingSurface(docWith(".scripture-layout--scripture .scripture-main")), READING_SURFACES[0]);
  assert.equal(readingSurface(docWith(".rm-page .rm-reader")).title, ".rm-page .rm-title");
  // /search uses .scripture-main inside its own layout type, and the home
  // page and the articles list have no reading column at all.
  assert.equal(readingSurface(docWith(".scripture-layout--search .scripture-main")), null);
  assert.equal(readingSurface(docWith()), null);
});

// E124 (BVJ, 2026-11-12): the panel was on these three pages for notes on them
// (N11), which version 1 leaves out, so it did nothing there.
test("book introductions, articles and the glossary have no Notebook panel while N11 is off (E124)", () => {
  assert.equal(PROSE_NOTES, false);
  assert.equal(NOTES_SWITCH, PROSE_NOTES, "one switch for the notes and the panel");
  for (const [kind, column] of [["intro", INTRO], ["article", ARTICLE], ["glossary", GLOSSARY]]) {
    assert.equal(readingSurface(docWith(column)), null, kind);
    assert.equal(hasPanel(kind), false, `Layout's pre-paint stamps nothing for the panel on a ${kind}`);
    assert.ok(!rule[1].includes(column), `global.css hides the Notebook buttons on a ${kind}`);
  }
  assert.equal(hasPanel("chapter"), true);
  assert.equal(hasPanel("read"), true);
  assert.equal(hasPanel(undefined), false, "a page that names no surface");
  // Chapter View stays first: margin.js tells it by its place.
  assert.equal(READING_SURFACES[0].kind, "chapter");
  assert.deepEqual(READING_SURFACES.map((s) => s.kind), ["chapter", "read"]);
});

// Version 2 turns PROSE_NOTES on; their entries are kept whole for it, and are
// held to the same rules as the pages that have the panel now.
test("the three pages' entries are kept for version 2, each with its kind and its own placement", () => {
  const prose = ALL_SURFACES.filter((s) => s.prose).map((s) => s.kind);
  assert.deepEqual(prose, ["intro", "article", "glossary"]);
  assert.equal(new Set(ALL_SURFACES.map((s) => s.kind)).size, ALL_SURFACES.length, "each kind once");
  const find = (column) => ALL_SURFACES.find((s) => s.column[0] === column);
  assert.equal(find(GLOSSARY).title, ".glossary-entries .entry-title");
  assert.equal(find(INTRO).title, "#chapter-title");
  assert.equal(find(ARTICLE).start, ".article__card", "an article's panel starts level with its card");
});

test("each page names the elements that make up its column, and never a full-width band", () => {
  for (const s of ALL_SURFACES) {
    assert.ok(Array.isArray(s.move) && s.move.length > 0, s.column[0]);
    for (const sel of s.move) {
      assert.doesNotMatch(sel, /scripture-disclaimer|entries-panel|entries-top|glossary-entries$/, `${sel} would move a band`);
    }
  }
});

test("each page names where its reading area ends; the license band counts as footer", () => {
  const ends = Object.fromEntries(ALL_SURFACES.map((s) => [s.column[0], s.end]));
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

/* ── When the desk fails to start (BA29) ─────────────────────────────── */

/**
 * A page as the pre-paint script and the Notebook leave it: the desk's
 * attributes and properties on <html>, a rail and width handles, and the
 * column moved left. `surface` is the column's selector, if the page has one.
 */
function deskPage(surface = ".scripture-layout--scripture .scripture-main") {
  const attrs = new Map([
    ["data-desk", "on"], ["data-desk-panel", "open"], ["data-desk-expanded", ""], ["data-desk-widths", ""],
    ["data-desk-no-notebook", ""], ["data-theme", "dark"], ["data-size", "lg"],
  ]);
  const props = new Map([
    ["--desk-measure", "50"], ["--desk-width", "360px"], ["--desk-dock-width", "380px"], ["--desk-bar-center", "400px"], ["color-scheme", "dark"],
  ]);
  const removed = [];
  const el = (name) => ({ name, style: { translate: "-40px 0" }, remove: () => removed.push(name) });
  const column = el("column");
  const extras = [el("rail"), el("gutters")];
  const trayRows = [el("tray row"), el("tray key line")];
  let described = true;
  const doc = {
    documentElement: {
      removeAttribute: (k) => attrs.delete(k),
      style: { removeProperty: (k) => props.delete(k) },
    },
    querySelector: (sel) => {
      if (sel === "#fontTray [aria-describedby='deskVerseNumbersHint']") return { removeAttribute: () => { described = false; } };
      return sel === surface ? column : null;
    },
    querySelectorAll: (sel) => {
      if (sel === ".desk-rail, .desk-gutters") return extras;
      if (sel === "#fontTray [data-desk]") return trayRows;
      return sel === surface ? [column] : [];
    },
  };
  return { doc, attrs, props, removed, column, described: () => described };
}

test("standDown puts the page back as it is without the desk", () => {
  const page = deskPage();
  standDown(page.doc);
  assert.deepEqual([...page.attrs.keys()], ["data-theme", "data-size"], "only the desk's own attributes go");
  assert.deepEqual([...page.props.keys()], ["color-scheme"], "only the desk's own properties go");
  assert.deepEqual(page.removed, ["rail", "gutters", "tray row", "tray key line"], "the tray's Notebook rows go too (NB6-2)");
  assert.equal(page.described(), false, "and the verse-numbers box stops pointing at the removed hint");
  assert.equal(page.column.style.translate, "", "the column moves back");
});

test("standDown works on a page with no reading column", () => {
  const page = deskPage(null);
  standDown(page.doc);
  assert.deepEqual([...page.attrs.keys()], ["data-theme", "data-size"]);
  assert.equal(page.column.style.translate, "-40px 0");
});

// The gate runs as it is imported, so it is given a page where the desk is
// off: it then only defines loadShell (Audit 3, LG3-12).
async function gate() {
  const before = globalThis.document;
  globalThis.document = { documentElement: { dataset: {} }, querySelector: () => null };
  try {
    return await import("../src/scripts/desk-gate.js");
  } finally {
    globalThis.document = before;
  }
}

test("the gate stands the page down when the desk doesn't load or doesn't start, and not when it does", async () => {
  const { loadShell } = await gate();
  const quiet = console.error;
  console.error = () => {};
  try {
    let stood = 0;
    const stand = () => { stood += 1; };
    await loadShell(() => Promise.reject(new Error("offline")), stand);
    assert.equal(stood, 1, "the import failed");
    await loadShell(async () => ({ start: async () => { throw new Error("no rail"); } }), stand);
    assert.equal(stood, 2, "the first stage threw as it started");
    let started = 0;
    await loadShell(async () => ({ start: async () => { started += 1; } }), stand);
    assert.equal(stood, 2);
    assert.equal(started, 1);
  } finally {
    console.error = quiet;
  }
});

test("the shell stands down when the Notebook fails before it is up, and each tab is built on its own", () => {
  // Read as text: the shell's ?inline stylesheet can't be imported here.
  // loadStageTwo's own test (desk-first-stage.test.js) runs the other half.
  const read = (p) => readFileSync(new URL(p, import.meta.url), "utf8");
  assert.match(read("../src/scripts/desk/shell.js"), /if \(!panelUp\) standDown\(\);/);
  assert.match(read("../src/scripts/desk/panel.js"), /try \{\s*t\.view = t\.make\(\);\s*\} catch/);
});
