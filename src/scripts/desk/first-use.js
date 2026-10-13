// src/scripts/desk/first-use.js
//
// The notebook's first use (STUDY-DESK.md D6, C18 and D8; phase 1d). Two
// pieces for the panel, both built from the rules in src/lib/desk-first-use.mjs:
//   - `card`, at the top of the My Notes tab: until the reader answers "Where
//     should your notebook live?" it shows that question; right after they
//     answer it may show a quiet offer of the tour, once;
//   - `foot`, in the panel's foot: where the notebook is kept and when a copy
//     was last saved, a reminder to save one when the reader asked for it, the
//     plain line for Safari, and the Help, Tell us what's missing and Take the
//     tour links.
//
// The choice is a per-browser setting (localStorage['lit-desk-home'], absent
// until answered), like the display settings: it never syncs. Both choices
// keep the notebook in this browser. Saving into a chosen file waits on a
// decision (T3), and accounts are not mentioned or promised.
//
// "The first time the reader opens the Notebook panel or uses a desk action":
// the card is simply what My Notes shows until there is an answer, and the
// first thing the reader writes (a note, a bookmark, a highlight) asks the
// panel to show itself, once a visit, so a reader who never opens it still
// meets the question.
//
// The tour itself is tour.js. This only offers it, by sending the same
// `lit:desk-command` event the search box's "tour" command sends.

import { liveRecords } from "../../lib/desk-store-core.mjs";
import {
  BACKUP_HREF, CONTACT_HREF, HELP_HREF, SAFARI_LINE, WAYS_HREF,
  isDesktopSafari, readHome, readLastExport, reminderDue, reminderText,
  savedLine, tourOffer, wantsReminder, withOffered,
} from "../../lib/desk-first-use.mjs";

const HOME_KEY = "lit-desk-home";
export const TOUR_KEY = "lit-desk-tour";
export const COMMAND_EVENT = "lit:desk-command";

/* ── What is kept in this browser ─────────────────────────────────── */

export function getHome() {
  try { return readHome(localStorage.getItem(HOME_KEY)); } catch (_) { return null; }
}

function setHome(value) {
  try { localStorage.setItem(HOME_KEY, value); } catch (_) {}
}

/** The tour's raw state (tour.js reads and writes it through these). */
export function getTourRaw() {
  try { return localStorage.getItem(TOUR_KEY); } catch (_) { return null; }
}

export function saveTourList(list) {
  try { localStorage.setItem(TOUR_KEY, JSON.stringify(list)); } catch (_) {}
}

/** Ask for the tour, as the search box's "tour" command does. */
export function requestTour(only = null) {
  document.dispatchEvent(new CustomEvent(COMMAND_EVENT, { detail: only ? { id: "tour", only } : { id: "tour" } }));
}

/* ── Small builders ───────────────────────────────────────────────── */

function el(tag, className, text) {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (text !== undefined) e.textContent = text;
  return e;
}

function link(href, text) {
  const a = el("a", "desk-home__link", text);
  a.href = href;
  return a;
}

/**
 * @param {{ store: object | null, reveal?: () => void }} options
 *   `reveal` asks the panel to show itself (once the reader first writes
 *   something and has not yet answered).
 * @returns {{ card: HTMLElement, foot: HTMLElement,
 *   refresh: (opts?: { shown?: boolean }) => Promise<void> }}
 *   `refresh({ shown: true })` is the panel saying My Notes was just drawn.
 */
export function createFirstUse({ store, reveal = () => {} }) {
  const safari = isDesktopSafari(navigator.userAgent);

  /* ── The card ─────────────────────────────────────────────────── */

  const card = el("div", "desk-home-wrap");

  const choice = el("section", "desk-home-card");
  choice.setAttribute("aria-labelledby", "deskHomeTitle");
  const choiceTitle = el("h3", "desk-home-card__title", "Where should your notebook live?");
  choiceTitle.id = "deskHomeTitle";
  choiceTitle.tabIndex = -1;
  choice.append(
    choiceTitle,
    el("p", "desk-home-card__lead", "Your notebook is kept in this browser, on this computer. Nothing is sent anywhere."),
  );
  const options = el("ul", "desk-home-card__options");
  const add = (value, label, text) => {
    const li = el("li", "desk-home-card__option");
    const b = el("button", "desk-home-card__choose", label);
    b.type = "button";
    const note = el("p", "desk-home-card__note", text);
    note.id = `deskHome-${value}`;
    b.setAttribute("aria-describedby", note.id);
    b.addEventListener("click", () => choose(value));
    li.append(b, note);
    options.append(li);
  };
  add(
    "browser",
    "Keep it in this browser",
    "You save a copy yourself when you want one. If this browser’s data for this site is cleared, the notebook is gone unless you have a copy.",
  );
  add(
    "browser-remind",
    "Keep it in this browser, and remind me to save a copy",
    "The same, and the panel reminds you when it has been a week since your last copy. Clearing the browser’s data still removes the notebook, but your copy is safe.",
  );
  choice.append(options);
  if (safari) choice.append(el("p", "desk-home-card__safari", SAFARI_LINE));
  const more = el("p", "desk-home-card__more");
  more.append(
    "Other ways to keep it, across your computers and the apps, are being planned. ",
    link(WAYS_HREF, "Ways to keep your notebook"),
  );
  choice.append(more);

  const offerBox = el("section", "desk-home-card desk-home-card--offer");
  offerBox.hidden = true;
  const offerTitle = el("h3", "desk-home-card__title");
  offerTitle.id = "deskOfferTitle";
  offerTitle.tabIndex = -1;
  offerBox.setAttribute("aria-labelledby", offerTitle.id);
  const offerText = el("p", "desk-home-card__lead");
  const offerRow = el("div", "desk-home-card__row");
  const yes = el("button", "desk-home-card__choose", "Take the tour");
  yes.type = "button";
  const notNow = el("button", "desk-home-card__skip", "Not now");
  notNow.type = "button";
  offerRow.append(yes, notNow);
  offerBox.append(offerTitle, offerText, offerRow);

  card.append(choice, offerBox);

  let offer = null; // { kind, ids } while the offer card is up
  let offerChecked = false;

  /** Show the tour offer if there is one to make, marking it made so it is never repeated unasked. */
  function maybeOffer() {
    if (offerChecked || !getHome()) return;
    offerChecked = true;
    const o = tourOffer(getTourRaw());
    if (!o.kind) return;
    saveTourList(o.kind === "first" ? withOffered(o.list) : withOffered(o.list, o.ids));
    offer = o;
    offerTitle.textContent = o.kind === "first" ? "Take a short tour of the notebook?" : "There’s something new in the tour.";
    offerText.textContent =
      o.kind === "first"
        ? "It takes a minute, and nothing it shows is saved in your notebook."
        : "Want a look at what’s new?";
    yes.textContent = o.kind === "first" ? "Take the tour" : "Show me what’s new";
    notNow.textContent = "Not now";
  }

  yes.addEventListener("click", () => {
    const o = offer;
    closeOffer();
    requestTour(o?.kind === "new" ? o.ids : null);
  });
  notNow.addEventListener("click", () => closeOffer({ focus: true }));

  function closeOffer({ focus = false } = {}) {
    offer = null;
    drawCard();
    if (focus) card.closest(".desk-panel__body")?.focus({ preventScroll: true });
  }

  function drawCard() {
    choice.hidden = Boolean(getHome());
    offerBox.hidden = !offer;
  }

  /** The reader's answer: kept, the card goes, and the tour is offered if it hasn't been. */
  function choose(value) {
    setHome(value);
    maybeOffer();
    drawCard();
    // The button the reader pressed is gone: focus goes to what comes next.
    (offer ? offerTitle : card.closest(".desk-panel__body") ?? card).focus({ preventScroll: true });
    refresh();
  }

  /* ── The foot ─────────────────────────────────────────────────── */

  const foot = el("div", "desk-home");
  const remindLabel = el("label", "desk-setting desk-home__remind");
  const remindBox = el("input", "desk-setting__input");
  remindBox.type = "checkbox";
  remindLabel.append(remindBox, el("span", "desk-setting__label", "Remind me to save a copy"));
  remindBox.addEventListener("change", () => {
    setHome(remindBox.checked ? "browser-remind" : "browser");
    maybeOffer();
    drawCard();
    refresh();
  });

  const kept = el("p", "desk-panel__kept");
  const nag = el("p", "desk-home__reminder");
  const safariLine = el("p", "desk-home__safari");
  safariLine.hidden = !safari;
  if (safari) safariLine.append(`${SAFARI_LINE} `, link(BACKUP_HREF, "Save a copy"));

  const links = el("p", "desk-home__links");
  const tour = el("button", "desk-home__tour", "Take the tour");
  tour.type = "button";
  tour.addEventListener("click", () => requestTour());
  links.append(tour, link(HELP_HREF, "Help"), link(CONTACT_HREF, "Tell us what’s missing"));

  foot.append(remindLabel, kept, nag, safariLine, links);

  let seq = 0;
  /** Bring the foot up to date: the choice, when a copy was last saved, whether the notebook holds anything. */
  async function refresh({ shown = false } = {}) {
    const mine = ++seq;
    const home = getHome();
    remindBox.checked = wantsReminder(home);
    // An offer of what's new is made when the panel is actually on screen.
    if (shown) maybeOffer();
    drawCard();

    let last;
    let hasRecords = false;
    try { if (typeof store?.getMeta === "function") last = readLastExport(await store.getMeta("lastExport")); } catch (_) {}
    try { if (store) hasRecords = liveRecords(await store.all()).length > 0; } catch (_) {}
    if (mine !== seq) return;

    const now = new Date();
    const due = reminderDue({ home, lastExport: last, now, hasRecords });
    kept.replaceChildren();
    nag.replaceChildren();
    nag.hidden = !due;
    if (due) {
      kept.textContent = "Kept in this browser.";
      nag.append(`${reminderText(last, now)} `, link(BACKUP_HREF, "Save a copy"));
    } else {
      kept.append(`Kept in this browser. ${savedLine(last, now)} `);
      if (hasRecords) kept.append(link(BACKUP_HREF, "Save a copy"));
    }
  }

  /* ── Keeping in step ──────────────────────────────────────────── */

  // A copy saved on the notebook page, or an answer given in another tab.
  window.addEventListener("focus", () => refresh());
  window.addEventListener("storage", (e) => {
    if (e.key === HOME_KEY) refresh();
  });

  // The first write the reader makes this visit, with no answer yet: show
  // the panel so the question is met (once, so it never nags).
  let revealed = false;
  store?.onEntry(() => {
    if (revealed || getHome()) return;
    revealed = true;
    reveal();
  });

  drawCard();
  refresh();
  return { card, foot, refresh };
}
