// src/scripts/desk/sync/notice-parts.js
//
// What the sync's notices share (./stopped-notice.js, ./account-notice.js):
// the dot, the notebook's notice bar, and the rule for when the bar may come
// up. One painter owns the dot, because the reasons for it overlap on the
// same buttons and each button can say only one of them to a screen reader.

import { NEWS_WORDS, STOPPED_WORDS, WAITING_WORDS } from "../../../lib/desk-sync-status.mjs";

/** On `<html>` while the sync is stopped and needs the reader. */
export const STOPPED_ATTR = "data-desk-sync";

/**
 * On `<html>` while the account has something to say that isn't a stop:
 * "waiting" (a request to delete the account or replace its notebook, which
 * takes the dot to every place a stop's goes) or "news" (a device or a way in
 * the reader hasn't been told of, on the header's account button alone).
 */
export const ACCOUNT_ATTR = "data-desk-account";

/** The header's account button (step 4h), whose menu holds the status line. */
const ACCOUNT_BUTTON = ".site-header__account-btn";

// What carries the dot (the backup reminder's places, reminder.js).
export const DOT_TARGETS = [".desk-tab", "button[data-desk-toggle]", '.desk-panel__tabs [data-tab="settings"]', ".desk-title__button", "[data-desk-notebook-item]", ACCOUNT_BUTTON].join(", ");

const OURS = new Set([STOPPED_WORDS, WAITING_WORDS, NEWS_WORDS]);

/** document → which reasons stand: { stopped, waiting, news } */
const standing = new WeakMap();

/**
 * Says whether one reason for the dot stands, and paints all three: the
 * attributes desk-sync.css draws the dot from, and what each button that
 * carries it says. The most pressing reason speaks: a stop, then a request
 * that waits, then what is new. A description some other code put there is
 * left alone. With no `reason` it only paints again (a tab or a button that
 * was built late takes its words).
 *
 * @param {Document} doc
 * @param {"stopped" | "waiting" | "news"} [reason]
 * @param {boolean} [on]
 */
export function markDots(doc, reason, on) {
  const root = doc?.documentElement;
  if (!root) return;
  const state = standing.get(doc) ?? { stopped: false, waiting: false, news: false };
  standing.set(doc, state);
  if (reason) state[reason] = Boolean(on);

  if (state.stopped) root.setAttribute(STOPPED_ATTR, "stopped");
  else root.removeAttribute(STOPPED_ATTR);
  if (state.waiting) root.setAttribute(ACCOUNT_ATTR, "waiting");
  else if (state.news) root.setAttribute(ACCOUNT_ATTR, "news");
  else root.removeAttribute(ACCOUNT_ATTR);

  for (const el of doc.querySelectorAll(DOT_TARGETS)) {
    const says = state.stopped ? STOPPED_WORDS : state.waiting ? WAITING_WORDS : state.news && el.matches(ACCOUNT_BUTTON) ? NEWS_WORDS : null;
    const has = el.getAttribute("aria-description");
    const ours = has !== null && OURS.has(has);
    if (says) {
      if (has === null || ours) el.setAttribute("aria-description", says);
    } else if (ours) {
      el.removeAttribute("aria-description");
    }
  }
}

/** How long a notice waits for a tour, a print or another notice to be over, and how many times. */
export const WAIT_MS = 5000;
export const WAIT_TIMES = 24;

/** The notebook's notice bar (undo-bar.js), with the stylesheet that draws it. */
export async function loadBar(doc) {
  const bar = await import("../undo-bar.js");
  // The bar is drawn by desk.css, which a page still in its first stage hasn't loaded (reminder.js).
  if (!doc.querySelector("style[data-desk]")) (await import("../boot.js")).addDeskStyle();
  return bar;
}

/**
 * May a notice come up now? Never over a tour or a print, never on a sheet's
 * own page (present mode is never interrupted, as the backup reminder's rule
 * is), and never in place of another notice: it waits its turn.
 *
 * @param {{ doc: Document, win?: Window, ui?: { barShowing: () => boolean } | null }} where
 */
export function barFree({ doc, win, ui }) {
  if (doc.documentElement.hasAttribute("data-desk-tour") || doc.querySelector("[data-sheet-page]")) return false;
  let params = null;
  try {
    params = new URLSearchParams(win?.location?.search ?? "");
  } catch {
    /* no address to read */
  }
  if (params && (params.has("desk-tour") || params.has("sheet-tour") || params.has("print"))) return false;
  return !ui?.barShowing();
}
