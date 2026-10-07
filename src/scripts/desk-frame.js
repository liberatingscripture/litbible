// src/scripts/desk-frame.js
//
// What the rest of the page needs to know about the Study Desk's Notebook
// panel, without loading the desk (STUDY-DESK.md, audit C12: the panel is
// part of the page frame, and floating panels keep clear of it). Tiny on
// purpose: lit-panel.js and the desk's gate import it on every page.

/** Matches the panel and anything inside it. */
export const DOCK_SELECTOR = "[data-desk-dock]";

/**
 * The pages the Notebook appears on, which are the ones with a reading
 * column and a margin beside it for the panel (BVJ, 2026-10-06: not on pages
 * without one; and the glossary gains a reading column for it, the same
 * day). Each gives its column, whose first selector also identifies
 * the page, and the page's heading, which the panel's "Notebook" heading
 * lines up with (BVJ, 2026-10-06), and optionally the element whose bottom
 * ends the panel's travel down the page (`end`; otherwise the end of <main>,
 * less the panel's usual gap). Read View's column is its toolbar and its
 * text together, since the toolbar is the wider.
 *
 * global.css hides the Notebook button on every other page with a :has()
 * rule naming the same first selectors; test/desk-frame.test.js holds the
 * two to each other. /search uses Study View's column class too, so Study
 * View is told apart by its layout's type.
 */
export const READING_SURFACES = [
  { column: [".scripture-layout--scripture .scripture-main"], title: "#chapter-title" },
  { column: [".scripture-layout--intro .scripture-main"], title: "#chapter-title" },
  { column: [".rm-page .rm-reader", ".rm-page .rm-toolbar"], title: ".rm-page .rm-title" },
  // The panel's travel ends at the bottom of the article's card, not at the
  // footer (BVJ, 2026-10-06). Elsewhere it ends EDGE above the footer.
  { column: [".article__card"], title: ".article__title", end: ".article__card" },
  // Its reading column exists only with the desk on (pages/glossary.css),
  // which is the only time this list is read. The panel lines up with the
  // first entry's heading, not the page's title (BVJ, 2026-10-06).
  { column: [".glossary-entries .entries-wrap"], title: ".glossary-entries .entry-title" },
];

/** This page's reading surface, or null when the Notebook has no place here. */
export function readingSurface(doc = document) {
  return READING_SURFACES.find((s) => doc.querySelector(s.column[0])) ?? null;
}

/**
 * How much of the window's width, from its right edge, the open panel keeps
 * clear for itself, in px: from the panel's left edge to the window's edge,
 * set by src/scripts/desk/margin.js. 0 when it's closed.
 */
export function dockWidth() {
  if (!document.documentElement.hasAttribute("data-desk-panel")) return 0;
  const v = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--desk-dock-width"));
  return Number.isFinite(v) ? v : 0;
}

/** Whether an event target sits inside the panel. */
export function inDock(target) {
  return target instanceof Element && Boolean(target.closest(DOCK_SELECTOR));
}
