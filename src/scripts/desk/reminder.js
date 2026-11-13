// src/scripts/desk/reminder.js
//
// The backup reminder (STUDY-DESK-FIXES.md, E113; BVJ, 2026-11-13): a bar
// with four choices when a backup is due, and a dot that says so on the
// Notebook's tab, its Settings tab and /desk's title and menu. The rules
// (when it is due, what the put-off means, the words) are
// src/lib/desk-reminder.mjs; the Settings tab's notice is first-use.js.
//
// It runs on Chapter View chapters and Read View (started by first-stage.js,
// before the shell, from a read-only look at the notebook; that file loads
// this one only for a reader who asked to be reminded) and on /desk
// (desk-page.js, from its own store); never on /notebook, /sheets (present
// mode is never interrupted), /search or any other page. So this file imports
// only light modules: the bar (undo-bar.js) and the rules. The bar's look is
// desk.css, which a page still in its first stage loads only when the bar is
// due (`deskStyle`), and "Back up now" loads backup-file.js, which makes the
// file, when pressed.
//
// The reader's put-off is `localStorage['lit-desk-remind']`, and a choice in
// one tab reaches the others through the `storage` event.

import {
  HOME_KEY, REMIND_KEY, TOMORROW_SAID, WEEK_SAID,
  backedUpSaid, putOffValue, readLastExport, reminderState, remindersOffSaid,
} from "../../lib/desk-reminder.mjs";
import { announce, barShowing, hideUndo, showChoices, showNotice } from "./undo-bar.js";

/** Fired on `document` whenever what the reminder shows may have changed (first-use.js redraws its notice). */
export const REMINDER_EVENT = "lit:desk-reminder";

/** The dot, drawn by desk-tab.css and desk.css. Not E74's `data-desk-nudge`, which opening the Notebook clears. */
export const DOT_ATTR = "data-desk-due";
export const DOT_WORDS = "Backup due";

// What carries the dot: the minimized tab and the Read View button, the
// panel's Settings tab, and on /desk the title button and its My Notebook item.
const DOT_TARGETS = [
  ".desk-tab",
  "button[data-desk-toggle]",
  '.desk-panel__tabs [data-tab="settings"]',
  ".desk-title__button",
  "[data-desk-notebook-item]",
].join(", ");

const readKey = (key) => {
  try { return localStorage.getItem(key); } catch (_) { return null; }
};
const writeKey = (key, value) => {
  try { localStorage.setItem(key, value); } catch (_) {}
};
const dropKey = (key) => {
  try { localStorage.removeItem(key); } catch (_) {}
};

let run = null; // { surface, getFacts, backUp, now, facts, noticeNumber, ... } while started
let current = { due: false, bar: false, dots: false, text: "", putOff: null };

/** What the reminder says now (the Settings notice reads it). */
export const reminderNow = () => current;

/**
 * Put the dot on, or take it off, every place that carries it that is in the
 * page now. Called after each change, and by whatever builds one of those
 * places late (the panel after the shell's hand-over, /desk's title menu).
 */
export function paintDots(scope = document) {
  const on = current.dots;
  for (const el of scope.querySelectorAll(DOT_TARGETS)) {
    if (on) {
      el.setAttribute(DOT_ATTR, "");
      if (!el.hasAttribute("aria-description")) el.setAttribute("aria-description", DOT_WORDS);
    } else if (el.hasAttribute(DOT_ATTR)) {
      el.removeAttribute(DOT_ATTR);
      if (el.getAttribute("aria-description") === DOT_WORDS) el.removeAttribute("aria-description");
    }
  }
}

/**
 * The facts the rules need, from a notebook the page already has open (the
 * Settings notice and /desk): `{ lastExport, hasRecords, oldest }`, or null
 * when it can't tell. `oldest` is the oldest live record's `created`.
 */
export async function factsFromStore(store) {
  try {
    const records = await store.all();
    let oldest = null;
    let hasRecords = false;
    for (const r of records) {
      if (!r || r.kind === "trash") continue;
      hasRecords = true;
      if (typeof r.created === "string" && (oldest === null || r.created < oldest)) oldest = r.created;
    }
    const lastExport = readLastExport(await store.getMeta?.("lastExport"));
    return { lastExport, hasRecords, oldest };
  } catch (_) {
    return null;
  }
}

/** The state from the page's own record of the reader's choices and the facts. */
function compute(facts, now) {
  if (!facts) return { due: false, bar: false, dots: false, text: "", putOff: null };
  return reminderState({
    home: readKey(HOME_KEY),
    lastExport: facts.lastExport,
    oldest: facts.oldest,
    hasRecords: facts.hasRecords,
    putOff: readKey(REMIND_KEY),
    now,
  });
}

/** Work the state out again from what is held, redraw the dots, and tell the listeners. */
function recompute() {
  if (!run) return;
  current = compute(run.facts, run.now());
  paintDots();
  // A bar that is no longer wanted (answered in another tab) comes down.
  if (!current.bar && run.noticeNumber !== null) {
    hideUndo(run.noticeNumber);
    run.noticeNumber = null;
  }
  document.dispatchEvent(new CustomEvent(REMINDER_EVENT, { detail: current }));
}

/** The reader changed the reminder's switch: work the state out again. */
export function refreshReminder() {
  recompute();
}

/** Put the reminder off: until tomorrow, or for a week. */
function putOff(kind) {
  writeKey(REMIND_KEY, putOffValue(kind, run ? run.now() : new Date()));
  run && (run.noticeNumber = null);
  recompute();
  announce(kind === "tomorrow" ? TOMORROW_SAID : WEEK_SAID);
}

function turnOff() {
  writeKey(HOME_KEY, "browser");
  dropKey(REMIND_KEY);
  const onDesk = run?.surface === "desk";
  recompute();
  run && (run.noticeNumber = null);
  showNotice(remindersOffSaid(onDesk));
}

/**
 * Make the full backup (the same file /notebook's makes), then clear every
 * put-off and sign: the next reminder is a week away. `store` is the page's
 * notebook where it has one. Used by the bar and by the Settings notice.
 */
export async function backUp({ store = null } = {}) {
  const make = run?.backUp ?? (async (s) => (await import("./backup-file.js")).backUpNow({ store: s }));
  const { exported, name } = await make(store);
  dropKey(REMIND_KEY);
  if (run) {
    run.facts = { ...(run.facts ?? {}), lastExport: exported, hasRecords: true, oldest: run.facts?.oldest ?? null };
    run.noticeNumber = null;
    recompute();
  } else {
    current = { due: false, bar: false, dots: false, text: "", putOff: null };
    paintDots();
    document.dispatchEvent(new CustomEvent(REMINDER_EVENT, { detail: current }));
  }
  return { exported, name };
}

/**
 * The bar is drawn by desk.css, which a reading page adds only once the shell
 * loads (boot.js), so a page still in its first stage adds it here, and only
 * when the bar is wanted: stage one stays light the rest of the time.
 */
async function deskStyle() {
  if (document.querySelector("style[data-desk]")) return;
  (await import("./boot.js")).addDeskStyle();
}

/** May the bar come up now? Not over a tour, a print, or another notice. */
function barFree() {
  if (!run || !current.bar) return false;
  if (document.documentElement.hasAttribute("data-desk-tour") || barShowing()) return false;
  const params = new URLSearchParams(window.location.search);
  return !(params.has("desk-tour") || params.has("print"));
}

/** The bar, once, when the reminder is due and not put off. */
async function drawBar() {
  if (!barFree()) return;
  const mine = run;
  try {
    await (mine.addStyle ?? deskStyle)();
  } catch (err) {
    // A bar without its look would be worse than none; the dots still say it.
    console.error("Study Desk: the backup reminder’s bar couldn’t be drawn", err);
    return;
  }
  if (run !== mine || !barFree()) return;
  run.noticeNumber = showChoices(
    current.text,
    [
      {
        label: "Back up now",
        primary: true,
        onPress: async () => {
          const { name } = await backUp({ store: run?.store ?? null });
          showNotice(backedUpSaid(name));
        },
      },
      { label: "Remind me tomorrow", onPress: () => putOff("tomorrow") },
      { label: "Not this week", onPress: () => putOff("week") },
      { label: "Turn off reminders", quiet: true, onPress: turnOff },
    ],
    { onClose: () => putOff("tomorrow") },
  );
}

/**
 * Start the reminder on this page (once). Resolves when the first look has
 * been made and the bar shown if it was wanted.
 *
 * @param {{ surface: "reading" | "desk", getFacts: () => Promise<object | null>,
 *   store?: object | null, backUp?: (store: object | null) => Promise<{ exported: string }>,
 *   now?: () => Date, addStyle?: () => Promise<void> }} options
 *   `getFacts` is what to read the notebook with (a peek on a reading page, the
 *   store on /desk); `backUp` and `addStyle` replace the file-making step and
 *   the stylesheet's loading in tests
 */
export async function startReminder({ surface, getFacts, store = null, backUp: make = null, now = () => new Date(), addStyle = null }) {
  if (run) return run.first;
  run = { surface, getFacts, store, backUp: make, addStyle, now, facts: null, noticeNumber: null, first: null };
  const mine = run;
  mine.first = (async () => {
    mine.facts = await getFacts();
    if (run !== mine) return;
    recompute();
    await drawBar();
  })();

  window.addEventListener("storage", (e) => {
    if (run !== mine) return;
    if (e.key === null || e.key === HOME_KEY || e.key === REMIND_KEY) recompute();
  });
  // A backup made in another tab or on /notebook, or notes written meanwhile.
  window.addEventListener("focus", async () => {
    if (run !== mine) return;
    const facts = await getFacts();
    if (run !== mine || !facts) return;
    mine.facts = facts;
    recompute();
  });
  return mine.first;
}

/** Forget the page's reminder (tests; and the shell's failure path never needs it). */
export function stopReminder() {
  run = null;
  current = { due: false, bar: false, dots: false, text: "", putOff: null };
  paintDots();
}
