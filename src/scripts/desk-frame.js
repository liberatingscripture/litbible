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
 * lines up with (BVJ, 2026-10-06), and where its reading area ends (`end`,
 * below). Read View's column is its toolbar and its text together, since the
 * toolbar is the wider.
 *
 * global.css hides the Notebook button on every other page with a :has()
 * rule naming the same first selectors; test/desk-frame.test.js holds the
 * two to each other. /search uses Study View's column class too, so Study
 * View is told apart by its layout's type.
 */

// Where each page's reading area ends: the seam where the page's own
// background meets the footer's colour, and the panel's travel stops `gap`
// above it (BVJ, 2026-10-06: the same 16px it keeps on the right). On the
// scripture pages the license band right above the footer (the source-text
// notice, SblgntNotice) counts as part of the footer, so the seam is its
// top. On the glossary it is the end of the cream band, and on an article
// the panel stops exactly at the bottom of the card. Without an `end`, or
// if its element is missing, the panel stops 16px above the end of <main>.
const LICENSE_BAND = { selector: ".scripture-disclaimer", at: "top", gap: 16 };

export const READING_SURFACES = [
  { column: [".scripture-layout--scripture .scripture-main"], title: "#chapter-title", end: LICENSE_BAND },
  { column: [".scripture-layout--intro .scripture-main"], title: "#chapter-title", end: LICENSE_BAND },
  { column: [".rm-page .rm-reader", ".rm-page .rm-toolbar"], title: ".rm-page .rm-title", end: LICENSE_BAND },
  { column: [".article__card"], title: ".article__title", end: { selector: ".article__card", at: "bottom", gap: 0 } },
  // Its reading column exists only with the desk on (pages/glossary.css),
  // which is the only time this list is read. The panel lines up with the
  // first entry's heading, not the page's title (BVJ, 2026-10-06).
  {
    column: [".glossary-entries .entries-wrap"],
    title: ".glossary-entries .entry-title",
    end: { selector: ".glossary-entries .entries-panel", at: "bottom", gap: 16 },
  },
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
