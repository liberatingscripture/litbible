// src/scripts/desk-frame.js
//
// What the rest of the page needs to know about the Study Desk's docked
// panel, without loading the desk (STUDY-DESK.md, audit C12: the dock is
// part of the page frame, and floating panels keep clear of it). Tiny on
// purpose: lit-panel.js and the Display tray import it on every page.

/** Matches the docked panel and anything inside it. */
export const DOCK_SELECTOR = "[data-desk-dock]";

/**
 * The width the docked panel takes from the right edge of the window, in px:
 * 0 unless it is open and docked (global.css sets --desk-dock-width only
 * then; a narrow window gets the panel over the text instead).
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
