// src/scripts/desk-frame.js
//
// What the rest of the page needs to know about the Study Desk's Notebook
// panel, without loading the desk (STUDY-DESK.md, audit C12: the panel is
// part of the page frame, and floating panels keep clear of it). Tiny on
// purpose: lit-panel.js imports it on every page.

/** Matches the docked panel and anything inside it. */
export const DOCK_SELECTOR = "[data-desk-dock]";

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

/** Whether an event target sits inside the docked panel. */
export function inDock(target) {
  return target instanceof Element && Boolean(target.closest(DOCK_SELECTOR));
}
