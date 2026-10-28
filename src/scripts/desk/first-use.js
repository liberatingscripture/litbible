// src/scripts/desk/first-use.js
//
// The notebook's first use (STUDY-DESK.md D6, C18 and D8; phase 1d). Three
// pieces, all built from the rules in src/lib/desk-first-use.mjs:
//   - `card`, at the top of the My Notes tab: until the reader answers "Where
//     should your notebook live?" it shows that question;
//   - the tour offer, a window beside the panel (float-window.js) the first
//     time the reader expands the Notebook with that question answered;
//   - `foot`, in the panel's foot: where the notebook is kept and when a copy
//     was last saved, a reminder to save one when the reader asked for it, the
//     plain line for Safari, and the Help, Tell us what's missing, and Take
//     the tour links.
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
//
// Where the browser keeps no notebook (`store` null: IndexedDB refused, as
// some private windows do), none of this applies, so My Notes' own line
// saying so stands alone: no question, no offer, and of the foot only its
// links (BA34).

import { liveRecords } from "../../lib/desk-store-core.mjs";
import {
  BACKUP_HREF, CONTACT_HREF, HELP_HREF, SAFARI_LINE, WAYS_HREF,
  isDesktopSafari, readHome, readLastExport, reminderDue, reminderText,
  localDay, parseTourState, savedLine, tourOffer, wantsReminder, withLater, withNever, withOffered,
} from "../../lib/desk-first-use.mjs";
import { createFloatWindow } from "../float-window.js";

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
 * @param {{ store: object | null, reveal?: () => void,
 *   panelEl?: () => HTMLElement | null, panelShown?: () => boolean }} options
 *   `reveal` asks the panel to show itself (once the reader first writes
 *   something and has not yet answered); `panelEl` and `panelShown` say
 *   where the panel is and whether it is expanded, for the tour offer.
 * @returns {{ card: HTMLElement, foot: HTMLElement,
 *   refresh: (opts?: { shown?: boolean }) => Promise<void>,
 *   panelChanged: () => void }}
 *   `refresh({ shown: true })` is the panel saying My Notes was just drawn;
 *   `panelChanged()` is the panel saying it was shown, minimized or closed.
 */
export function createFirstUse({ store, reveal = () => {}, panelEl = () => null, panelShown = () => false }) {
  const safari = isDesktopSafari(navigator.userAgent);
  const canKeep = Boolean(store);

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

  card.append(choice);

  /* ── The tour offer ───────────────────────────────────────────── */

  // A window beside the Notebook, opened the first time the reader expands
  // it once "Where should your notebook live?" is answered (BVJ,
  // 2026-10-14). Over the Notebook instead where there is no room beside
  // it. Three answers: take the tour now; remind me later, which is also
  // what the ×, Escape, closing or minimizing the Notebook, and simply
  // leaving the page mean, and brings it back on a later day; or don't show
  // this again, which also ends the offers of new tour steps. The tour
  // itself stays in the foot, the help page, and the "tour" command.
  const offerWin = createFloatWindow({
    heading: "Notebook tour",
    title: "Take a short tour of the notebook?",
    className: "desk-offer",
    // Inside the dock: a click in it never folds a floating notebook away,
    // and the page's shortcuts stand down while focus is in it.
    attrs: { "data-desk-dock": "" },
    place: placeOffer,
    onClose: offerClosed,
  });
  const offerText = el("p", "desk-offer__lead");
  const offerRow = el("div", "desk-offer__row");
  const yes = el("button", "desk-offer__go", "Take the tour now");
  yes.type = "button";
  const later = el("button", "desk-offer__later", "Remind me later");
  later.type = "button";
  const never = el("button", "desk-offer__never", "Don’t show this again");
  never.type = "button";
  offerRow.append(yes, later);
  offerWin.body.append(offerText, offerRow, never);

  let offer = null; // { kind, ids } while the offer is up

  const touring = () => document.documentElement.hasAttribute("data-desk-tour");
  const today = () => localDay(new Date());

  /** Offer the tour if there is one to make and the Notebook is showing. */
  function maybeOffer() {
    if (offer || !canKeep || !getHome() || !panelShown() || touring()) return;
    const o = tourOffer(getTourRaw(), { today: today() });
    if (!o.kind) return;
    // Until it's answered, an offer shown counts as "remind me later," so
    // leaving it, or going on to the next page, never brings it straight back.
    saveTourList(withLater(o.list, today()));
    offer = o;
    offerWin.title.textContent = o.kind === "first" ? "Take a short tour of the notebook?" : "There’s something new in the tour.";
    offerText.textContent =
      o.kind === "first"
        ? "It takes a minute and shows you notes, highlights, bookmarks, and the Greek. Nothing it shows is saved in your notebook."
        : "Want a look at what’s new?";
    yes.textContent = o.kind === "first" ? "Take the tour now" : "Show me what’s new";
    offerWin.show();
  }

  /** Beside the Notebook, its top level with the Notebook's; over it where there is no room. */
  function placeOffer(w) {
    const p = panelEl()?.getBoundingClientRect();
    if (!p) return;
    const GAP = 12;
    const EDGE = 8;
    const width = Math.min(300, innerWidth - 2 * EDGE);
    if (p.left - GAP - width >= EDGE) {
      w.style.width = `${width}px`;
      w.style.left = `${p.left - GAP - width}px`;
      w.style.top = `${Math.max(EDGE, p.top)}px`;
    } else {
      const inner = Math.max(200, Math.min(width, p.width - 24));
      w.style.width = `${inner}px`;
      w.style.left = `${p.left + (p.width - inner) / 2}px`;
      w.style.top = `${Math.max(EDGE, p.top + 56)}px`;
    }
  }

  yes.addEventListener("click", () => {
    const o = offer;
    offerWin.close("take");
    const { list } = parseTourState(getTourRaw());
    saveTourList(o?.kind === "new" ? withOffered(list, o.ids) : withOffered(list));
    requestTour(o?.kind === "new" ? o.ids : null);
  });
  later.addEventListener("click", () => offerWin.close("later"));
  never.addEventListener("click", () => {
    saveTourList(withNever(parseTourState(getTourRaw()).list));
    offerWin.close("never");
  });

  function offerClosed(reason) {
    offer = null;
    // Back into the Notebook, unless the tour or the Notebook itself moved on.
    if (reason !== "take" && reason !== "panel" && panelShown()) panelEl()?.focus({ preventScroll: true });
  }

  /**
   * The panel saying it was shown, minimized, or closed. The offer waits two
   * frames after a showing, so the panel is in the page and placed first.
   */
  let pending = 0;
  function panelChanged() {
    cancelAnimationFrame(pending);
    if (!panelShown()) offerWin.close("panel");
    else pending = requestAnimationFrame(() => { pending = requestAnimationFrame(maybeOffer); });
  }

  // A tour started some other way (the foot, the search box) takes over.
  document.addEventListener(COMMAND_EVENT, (e) => {
    if (e.detail?.id === "tour") offerWin.close("take");
  });

  function drawCard() {
    choice.hidden = !canKeep || Boolean(getHome());
  }

  /** The reader's answer: kept, the card goes, and the tour is offered if it hasn't been. */
  function choose(value) {
    setHome(value);
    drawCard();
    maybeOffer();
    // The button the reader pressed is gone: focus goes to what comes next.
    if (!offerWin.isOpen()) (card.closest(".desk-panel__body") ?? card).focus({ preventScroll: true });
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

  // Without a notebook, only the links (`hidden` wouldn't do for the remind
  // box: .desk-setting sets its display).
  if (canKeep) foot.append(remindLabel, kept, nag, safariLine);
  foot.append(links);

  let seq = 0;
  /** Bring the foot up to date: the choice, when a copy was last saved, whether the notebook holds anything. */
  async function refresh({ shown = false } = {}) {
    if (!canKeep) return;
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
  return { card, foot, refresh, panelChanged };
}
