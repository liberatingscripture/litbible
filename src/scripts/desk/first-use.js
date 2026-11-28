// src/scripts/desk/first-use.js
//
// What the Notebook says about itself, and nothing that speaks first
// (Featherboa's Phase 5; SITE-FEATHERBOA.md, "Nothing interrupts the reader").
// Three pieces, built from the rules in src/lib/desk-first-use.mjs and
// src/lib/desk-reminder.mjs:
//   - `createStartHere`: "Start here: Take the tour," with "I know my way
//     around," the line that heads the Notebook until the tour is taken
//     (NX-19, NX-20). It keeps its place across visits and asks nothing to be
//     dismissed; once it goes, the tour is in the title menu and on the help page;
//   - `createFootLine`: the Notebook's foot line (NX-07, NX-16, NB-34): "Kept
//     in this browser only." with "Back up…", when a backup is due (E113's
//     seven days) when the last was made, and in a browser that syncs the
//     sync's own status line in the same place. It changes its words, never
//     its place;
//   - `replyAtFirstUse`: the first highlight, note, or bookmark adds "New
//     here? Take the tour" to the line the action brings (NX-21).
// They replace the card that asked where the notebook is kept (D6), the
// reminder's checkbox, bar and dots (E113), E74's mark on the tab, and the
// tour's floating offer.
//
// The tours' stored state is read and written here (tour.js, desk-tour.js and
// sheets/sheet-tour.js), and a tour is asked for by the same
// `lit:desk-command` event the search box's "tour" command sends.
//
// Where the browser keeps no notebook (`store` null: IndexedDB refused, as
// some private windows do), the foot line says nothing and Notes' own line
// says why (BA34); "Start here" still offers the tour, which leaves out the
// steps about keeping.

import {
  BACKUP_HREF, DESK_TOUR_KEY, NEW_HERE, SHEET_TOUR_KEY, START_HERE, TOUR_KEY,
  footLine, parseTourState, startHereShown, withNever,
} from "../../lib/desk-first-use.mjs";
import { BACK_UP } from "../../lib/desk-reminder.mjs";
import { SLOT_EVENT } from "../../lib/desk-sync-link.mjs";
import { factsFromStore } from "./reminder.js";
import { addToBar, showNotice } from "./undo-bar.js";

// The three tours' keys are declared with their rules in desk-first-use.mjs,
// so the Sheets page can ask whether to offer its tour without loading this
// file (E63); they are this file's to read and write, under the same names.
export { DESK_TOUR_KEY, SHEET_TOUR_KEY, TOUR_KEY };
export const COMMAND_EVENT = "lit:desk-command";

/** Whether accounts are open in this browser: Layout.astro's pre-paint stamp (account-gate.js). */
export function accountsOpen(doc = document) {
  return doc.documentElement.getAttribute("data-account") === "open";
}

/** The tour's raw state (tour.js reads and writes it through these). */
export function getTourRaw() {
  try { return localStorage.getItem(TOUR_KEY); } catch (_) { return null; }
}

export function saveTourList(list) {
  try { localStorage.setItem(TOUR_KEY, JSON.stringify(list)); } catch (_) {}
}

/** The Study Desk tour's raw state (desk/desk-tour.js reads and writes it through these). */
export function getDeskTourRaw() {
  try { return localStorage.getItem(DESK_TOUR_KEY); } catch (_) { return null; }
}

export function saveDeskTourList(list) {
  try { localStorage.setItem(DESK_TOUR_KEY, JSON.stringify(list)); } catch (_) {}
}

/** The Sheets tour's raw state (desk/sheets/sheet-tour.js reads and writes it through these). */
export function getSheetTourRaw() {
  try { return localStorage.getItem(SHEET_TOUR_KEY); } catch (_) { return null; }
}

export function saveSheetTourList(list) {
  try { localStorage.setItem(SHEET_TOUR_KEY, JSON.stringify(list)); } catch (_) {}
}

/** Ask for the tour, as the search box's "tour" command does. */
export function requestTour(only = null) {
  document.dispatchEvent(new CustomEvent(COMMAND_EVENT, { detail: only ? { id: "tour", only } : { id: "tour" } }));
}

/** This page's own address with the tour asked for, for a link that opens it in a new tab. */
const tourHere = () => `${window.location.pathname}?desk-tour`;

function el(tag, className, text) {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (text !== undefined) e.textContent = text;
  return e;
}

function button(className, text) {
  const b = el("button", className, text);
  b.type = "button";
  return b;
}

/* ── Start here ───────────────────────────────────────────────────── */

/**
 * The line that heads the Notebook until the tour is taken.
 * @param {{ afterSkip?: () => void }} [options] where focus goes once "I know
 *   my way around" has taken the line away (the panel's own heading)
 * @returns {{ el: HTMLElement, refresh: () => void, destroy: () => void }}
 */
export function createStartHere({ afterSkip = () => {} } = {}) {
  const box = el("div", "desk-start");
  box.setAttribute("role", "group");
  box.setAttribute("aria-label", "Start here");
  const lead = el("span", "desk-start__lead", START_HERE.lead);
  const take = button("kit-btn kit-btn--filled desk-start__take", START_HERE.take);
  const skip = button("kit-btn kit-btn--plain desk-start__skip", START_HERE.skip);
  box.append(lead, take, skip);

  const refresh = () => {
    box.hidden = !startHereShown(getTourRaw());
  };
  take.addEventListener("click", () => requestTour());
  skip.addEventListener("click", () => {
    saveTourList(withNever(parseTourState(getTourRaw()).list));
    refresh();
    afterSkip();
  });

  // The tour marks its steps seen as it goes, and a reader may take it, or
  // say they know their way around, in another tab.
  const onStorage = (e) => {
    if (e.key === TOUR_KEY || e.key === null) refresh();
  };
  window.addEventListener("storage", onStorage);
  const touring = new MutationObserver(refresh);
  touring.observe(document.documentElement, { attributes: true, attributeFilter: ["data-desk-tour"] });
  refresh();
  return {
    el: box,
    refresh,
    destroy() {
      window.removeEventListener("storage", onStorage);
      touring.disconnect();
    },
  };
}

/* ── The foot line ────────────────────────────────────────────────── */

/**
 * The Notebook's foot line. Nothing where the browser keeps no notebook.
 * @param {{ store: object | null, now?: () => Date }} options
 * @returns {{ el: HTMLElement, refresh: () => Promise<void>, showSlot: () => void }}
 *   `refresh` reads the notebook again (the panel calls it when the notebook
 *   changes); `showSlot` tells the sync's status line its place is on the
 *   page, once the panel has put the line there
 */
export function createFootLine({ store, now = () => new Date() }) {
  const foot = el("div", "desk-panel__foot");
  if (!store) {
    foot.hidden = true;
    return { el: foot, refresh: async () => {}, showSlot() {} };
  }
  const line = el("p", "desk-panel__foot-line");
  const text = el("span", "desk-panel__foot-text");
  const backUp = el("a", "kit-inline desk-panel__backup", BACK_UP);
  backUp.href = BACKUP_HREF;
  backUp.hidden = true;
  line.append(text, " ", backUp);
  // A browser that syncs draws its status line here (sync/status-line.js,
  // which no other browser loads), in the line's place: the line's own words
  // stand until it has (desk.css hides them beside a slot that isn't hidden).
  const slot = el("div", "desk-panel__sync");
  slot.setAttribute("data-desk-sync-slot", "");
  slot.hidden = true;
  foot.append(line, slot);

  let seq = 0;
  async function refresh() {
    const mine = ++seq;
    const facts = (await factsFromStore(store)) ?? { lastExport: null, hasRecords: false, oldest: null, linked: false };
    if (mine !== seq) return;
    const words = footLine({ ...facts, linked: facts.linked === true, now: now() });
    text.textContent = words.text;
    backUp.hidden = !words.backUp;
    foot.toggleAttribute("data-due", words.due);
  }

  // A backup made on the notebook page, in this tab or another.
  window.addEventListener("focus", () => refresh());
  refresh();
  return {
    el: foot,
    refresh,
    showSlot() {
      document.dispatchEvent(new CustomEvent(SLOT_EVENT));
    },
  };
}

/* ── A reply at the first use ─────────────────────────────────────── */

const MARK_KINDS = ["note", "highlight", "bookmark"];
const SAID = { note: "Note saved.", highlight: "Highlighted.", bookmark: "Bookmark added." };

/**
 * The first highlight, note, or bookmark a reader makes (the notebook held no
 * other) adds "New here? Take the tour" to the line the action brings
 * ("Highlighted · Undo"), while "Start here" still stands: the tour not taken
 * and not declined. A note saved and a bookmark added bring no line of their
 * own (they are announced, BA18), so for them the reply is a line of its own.
 * Once a visit: the first write that isn't the first mark ends the watch.
 * @param {{ store: object | null }} options
 */
export function replyAtFirstUse({ store }) {
  if (!store?.onEntry) return;
  let done = false;
  store.onEntry(async () => {
    if (done) return;
    done = true;
    if (!startHereShown(getTourRaw())) return;
    let marks = [];
    try {
      marks = (await store.all()).filter((r) => r && MARK_KINDS.includes(r.kind));
    } catch (_) {
      return;
    }
    if (marks.length !== 1) return;
    // After the action's own line is up: it comes once the write has been
    // awaited, a task after the entry is recorded.
    setTimeout(() => {
      const link = { label: NEW_HERE, href: tourHere(), open: () => requestTour() };
      if (!addToBar(link)) showNotice(SAID[marks[0].kind] ?? "Saved in your notebook.", { link });
    }, 0);
  });
}
