// src/scripts/desk/sync/stopped-notice.js
//
// A sync that stops is never silent (BVJ's standing requirement for sync,
// with "never lost work"; the plan's step 4g). The status line says where the
// sync stands, but it sits in the Notebook's Settings tab and on the notebook
// page, and a reader who was signed out while reading a chapter is looking at
// neither. So when a pass ends in a state only the reader can settle (signed
// out, this computer removed, the account's notebook replaced, keys that
// don't open it; `needsReader`), the page they are on says so:
//
//   - a dot on the Notebook's tab and buttons, the Settings tab, and /desk's
//     title and its My Notebook line, for as long as the stop lasts
//     (`<html data-desk-sync="stopped">`, drawn by desk-sync.css). It is the
//     dot a backup that is due shows (reminder.js), in the same places;
//   - the notebook's notice bar (undo-bar.js), with the status line's own
//     sentence and "Reconnect": once for each stop in each tab that is open,
//     and again a day later if it still stands (`shouldTell`). The bar stays
//     until it is answered or closed. What was said is kept with the sync's
//     own state (the `told` value in ./sync-db.js), so the next page doesn't
//     say it again.
//
// The bar never comes up over a tour or a print, never over a sheet's own
// page (present mode is never interrupted, as the backup reminder's rule
// is), never on the account page (which shows the stop and its step
// itself), and never replaces another notice: it waits its turn.
//
// "Reconnect" keeps its word and opens the account page (BVJ, 2026-11-24),
// which names the real step for the stop: sign in again, join again, or
// decide about a replaced notebook. Another pass would only end the same way.
//
// The wording and the day are Claude's, and BVJ said yes to both (2026-11-24).

import { SLOT_EVENT } from "../../../lib/desk-sync-link.mjs";
import { ACCOUNT_PAGE, STOPPED_WORDS, needsReader, shouldTell, statusWords } from "../../../lib/desk-sync-status.mjs";

/** On `<html>` while the sync is stopped and needs the reader. */
export const STOPPED_ATTR = "data-desk-sync";

// What carries the dot (the backup reminder's places, reminder.js).
const DOT_TARGETS = [
  ".desk-tab",
  "button[data-desk-toggle]",
  '.desk-panel__tabs [data-tab="settings"]',
  ".desk-title__button",
  "[data-desk-notebook-item]",
].join(", ");

/** How long the bar waits for a tour, a print or another notice to be over, and how many times. */
const WAIT_MS = 5000;
const WAIT_TIMES = 24;

async function loadBar(doc) {
  const bar = await import("../undo-bar.js");
  // The bar is drawn by desk.css, which a page still in its first stage hasn't loaded (reminder.js).
  if (!doc.querySelector("style[data-desk]")) (await import("../boot.js")).addDeskStyle();
  return bar;
}

/**
 * @param {{ status: () => object, subscribe: (fn: (s: object) => void) => () => void }} connector
 * @param {{ db: { getAll: (keys: string[]) => Promise<object>, set: (values: object) => Promise<void> },
 *   doc?: Document, win?: Window, nowMs?: () => number, bar?: () => Promise<object>, go?: (href: string) => void,
 *   setTimer?: (fn: () => void, ms: number) => unknown, clearTimer?: (t: unknown) => void,
 *   log?: (...args: unknown[]) => void }} env
 *   `db` is the sync's storage; `bar` replaces the notice bar's loading in tests
 * @returns {() => void} the way to take it off
 */
export function mountStoppedNotice(connector, env) {
  const {
    db,
    doc = globalThis.document,
    win = globalThis.window,
    nowMs = () => Date.now(),
    bar: getBar = () => loadBar(doc),
    go = (href) => win?.location?.assign(href),
    setTimer = (fn, ms) => setTimeout(fn, ms),
    clearTimer = (t) => clearTimeout(t),
    log = (...args) => console.error("Study Desk sync:", ...args),
  } = env;
  if (!doc?.documentElement) return () => {};
  const root = doc.documentElement;

  let off = false;
  let ui = null; // undo-bar.js, once it was needed
  let number = null; // our notice's number while it may be the one showing
  let said = null; // the state that notice is about
  let handled = null; // the state this tab has dealt with: said, or found said already
  let working = false;
  let timer = null;
  let waits = 0;

  function paint(stopped) {
    if (stopped) root.setAttribute(STOPPED_ATTR, "stopped");
    else root.removeAttribute(STOPPED_ATTR);
    for (const el of doc.querySelectorAll(DOT_TARGETS)) {
      if (stopped) {
        if (!el.hasAttribute("aria-description")) el.setAttribute("aria-description", STOPPED_WORDS);
      } else if (el.getAttribute("aria-description") === STOPPED_WORDS) {
        el.removeAttribute("aria-description");
      }
    }
  }

  /** May the bar come up now? */
  function free() {
    if (root.hasAttribute("data-desk-tour") || doc.querySelector("[data-sheet-page]")) return false;
    let params = null;
    try {
      params = new URLSearchParams(win?.location?.search ?? "");
    } catch {
      /* no address to read */
    }
    if (params && (params.has("desk-tour") || params.has("sheet-tour") || params.has("print"))) return false;
    return !ui?.barShowing();
  }

  function later() {
    if (off || timer || waits >= WAIT_TIMES) return;
    waits++;
    timer = setTimer(() => {
      timer = null;
      settle(connector.status());
    }, WAIT_MS);
  }

  function show(status) {
    const words = statusWords(status);
    said = status.state;
    number = ui.showChoices(
      [words.line, ...words.detail].join(" "),
      [
        {
          label: "Reconnect",
          primary: true,
          // Another pass would end the same way: the step is the reader's, and the account page names it.
          onPress: () => go(ACCOUNT_PAGE),
        },
      ],
      { onClose: () => {} },
    );
  }

  /** What the bar does for one status that is no longer on its way somewhere. */
  async function once(status) {
    const state = status.state;
    if (!needsReader(state)) {
      handled = null;
      waits = 0;
      // Ours comes down: what it said is no longer so.
      if (number !== null) ui?.hideUndo(number);
      number = null;
      if (state === "upToDate") {
        const { told } = await db.getAll(["told"]);
        if (told) await db.set({ told: undefined });
      }
      return;
    }
    // One stop became another while ours was up (signed out, and after signing in again this computer
    // turns out to be removed): ours says what is no longer so, and comes down whatever is said next.
    // hideUndo does nothing when another notice has taken ours's place.
    if (number !== null && said !== state) {
      ui?.hideUndo(number);
      number = null;
    }
    if (handled === state) return;
    // The account page shows the stop and its step itself. Nothing is recorded, so the next page still says it.
    if (doc.querySelector("[data-account-page]")) {
      handled = state;
      return;
    }
    const { told } = await db.getAll(["told"]);
    if (!shouldTell(told, state, nowMs())) {
      handled = state;
      return;
    }
    ui ??= await getBar();
    if (off) return;
    // Never over a tour, a print or another notice: it waits its turn.
    if (!free()) {
      later();
      return;
    }
    handled = state;
    waits = 0;
    show(status);
    await db.set({ told: { state, at: nowMs() } });
  }

  let missed = false;
  /** One status at a time; one that arrives meanwhile is dealt with after, from the latest. */
  async function settle(status) {
    if (off) return;
    const state = status?.state;
    if (!state || state === "starting" || state === "syncing") return;
    if (working) {
      missed = true;
      return;
    }
    working = true;
    try {
      await once(status);
    } catch (err) {
      log("the notice that the sync stopped couldn’t be shown", err);
    } finally {
      working = false;
    }
    if (missed) {
      missed = false;
      settle(connector.status());
    }
  }

  const hear = (status) => {
    paint(needsReader(status?.state));
    settle(status);
  };
  // A tab or a button built late takes its description when the page says a slot is there.
  const repaint = () => paint(needsReader(connector.status()?.state));
  doc.addEventListener(SLOT_EVENT, repaint);
  const stop = connector.subscribe(hear);
  hear(connector.status());

  return () => {
    off = true;
    stop();
    doc.removeEventListener(SLOT_EVENT, repaint);
    if (timer) clearTimer(timer);
    timer = null;
    if (number !== null) ui?.hideUndo(number);
    paint(false);
  };
}
