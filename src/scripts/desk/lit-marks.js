// src/scripts/desk/lit-marks.js
//
// A LIT pane's marks on the page (E108). The table and the list a layout
// keeps are src/lib/desk-lit-marks.mjs; this is the page's half: the pane's
// own element carries one attribute for each mark its "Show" has turned off
// (`data-vn="off"` and the rest, absent for a mark it shows), which desk.css
// and whatever draws on the pane's text go by. Each LIT pane has its own
// (BVJ, 2026-11-12), so nothing here is on <html>, where Chapter View's
// switches are; a pane's text opts out of those (`data-own-marks`,
// global.css).

import { MARK_IDS } from "../../lib/desk-lit-marks.mjs";
import { allHidden, setSetting } from "./note-settings.js";

const ATTRS = { vn: "data-vn", fn: "data-fn", terms: "data-terms", highlights: "data-highlights" };

/** Stamp the marks a pane hides on its element. */
export function stampMarks(el, hidden) {
  for (const id of MARK_IDS) {
    if (hidden.includes(id)) el.setAttribute(ATTRS[id], "off");
    else el.removeAttribute(ATTRS[id]);
  }
}

/**
 * Whether the pane holding `node` draws the reader's highlights: its own
 * switch, and never while "Hide my marks" has everything of the reader's
 * hidden (note-settings.js, the key H), which is for a shared screen and
 * stands above every pane.
 */
export const highlightsShownIn = (node) =>
  !allHidden() && node?.closest?.(".desk-lit")?.getAttribute(ATTRS.highlights) !== "off";

/**
 * Until each pane kept its own (E108), the Reading arrangement turned Chapter
 * View's own switches off and kept a list of the ones it turned off under
 * this key, to turn them back on when it ended. A list left by a visit before
 * that is undone once, as leaving Reading would have, so the chapter pages
 * aren't left without their numbers; then the key is gone. (The saved Reading
 * layout keeps its look: desk-layout.mjs, checkLayout.) Named in /privacy
 * while this reads it.
 */
const OLD_READING_KEY = "lit-desk-reading-off";
const PAGE_SWITCHES = { vn: ["data-vn", "lit-verse-numbers"], fn: ["data-fn", "lit-fn-letters"], terms: ["data-terms", "lit-terms"] };

export function undoOldReading() {
  let ids = null;
  try {
    const kept = localStorage.getItem(OLD_READING_KEY);
    if (kept === null) return;
    localStorage.removeItem(OLD_READING_KEY); // whatever it holds
    ids = JSON.parse(kept);
  } catch (_) {}
  if (!Array.isArray(ids)) return;
  for (const id of ids) {
    if (id === "highlights") setSetting("highlights", "on");
    const [attr, key] = PAGE_SWITCHES[id] ?? [];
    if (!attr) continue;
    document.documentElement.removeAttribute(attr);
    try { localStorage.removeItem(key); } catch (_) {}
  }
}
