// src/scripts/desk/first-use.js
//
// The notebook's first use (STUDY-DESK.md D6, C18 and D8; phase 1d). Three
// pieces, all built from the rules in src/lib/desk-first-use.mjs:
//   - `card`, at the top of the My Notes tab: until the reader answers it,
//     it says where the notebook is kept (or, where accounts are open, asks)
//     and offers the backup reminder;
//   - the tour offer, a window beside the panel (float-window.js) the first
//     time the reader expands the Notebook with the card answered;
//   - `foot`, in the panel's foot: where the notebook is kept and when it was
//     last backed up, the reminder's checkbox, the plain line for Safari, and
//     the Help, Tell us what's missing, and Take the tour links;
//   - `notice`, at the top of the Settings tab's "Keep and print" group while
//     a backup is due and not put off for a week (E113): the reminder's
//     sentence, "Back up now", and the checkbox, which moves in from the foot.
//
// The answer is a per-browser setting (localStorage['lit-desk-home'], absent
// until answered), like the display settings: it never syncs. Both values
// keep the notebook in this browser; one asks for the reminder. Saving into a
// chosen file waits on a decision (T3). The card has two forms (step 4j, BVJ
// 2026-11-25; CARD_WORDS in desk-first-use.mjs): while accounts are closed,
// the statement, which says an account is coming and isn't needed; where
// they are open (html[data-account="open"]), the choice, whose second answer
// is a link to the account pages. A browser whose notebook syncs shows
// neither, and isn't nudged toward them.
//
// "The first time the reader opens the Notebook panel or uses a desk action":
// the card is simply what My Notes shows until there is an answer, and the
// first thing the reader writes (a note, a bookmark, a highlight) asks the
// panel to show itself, once a visit, so a reader who never opens it still
// meets the card.
//
// The tour itself is tour.js. This only offers it, by sending the same
// `lit:desk-command` event the search box's "tour" command sends.
//
// Where the browser keeps no notebook (`store` null: IndexedDB refused, as
// some private windows do), none of this applies, so My Notes' own line
// saying so stands alone: no card, no offer, and of the foot only its
// links (BA34).

import {
  ACCOUNT_HREF, BACKUP_HREF, CARD_WORDS, DESK_TOUR_KEY, FEEDBACK_HREF, FEEDBACK_LABEL, HELP_HREF, HOME_KEY, REMIND_KEY, SAFARI_LINE,
  SHEET_TOUR_KEY, TOUR_KEY, WAYS_HREF,
  backedUpSaid, isDesktopSafari, keptLine, readHome, reminderState,
  localDay, parseTourState, savedLine, tourOffer, wantsReminder, withLater, withNever, withOffered,
} from "../../lib/desk-first-use.mjs";
import { SYNC_META, readLink } from "../../lib/desk-sync-link.mjs";
import { createFloatWindow } from "../float-window.js";
import { REMINDER_EVENT, backUp, factsFromStore, refreshReminder } from "./reminder.js";
import { showNotice } from "./undo-bar.js";

// The three tours' keys are declared with their rules in desk-first-use.mjs,
// so the Sheets page can ask whether to offer its tour without loading this
// file (E63); they are this file's to read and write, under the same names.
export { DESK_TOUR_KEY, SHEET_TOUR_KEY, TOUR_KEY };
export const COMMAND_EVENT = "lit:desk-command";

/* ── What is kept in this browser ─────────────────────────────────── */

/** Whether accounts are open in this browser: Layout.astro's pre-paint stamp (account-gate.js). */
export function accountsOpen(doc = document) {
  return doc.documentElement.getAttribute("data-account") === "open";
}

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
 *   `reveal` asks the panel to point the reader to itself, a mark on its tab
 *   and an offer in the bar (E74), once the reader first writes something
 *   and has not yet answered; `panelEl` and `panelShown` say
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

  /** The reminder's checkbox and its note, one for each form of the card. */
  function remindPart(id) {
    const remind = el("div", "desk-home-card__remind");
    const label = el("label", "desk-setting");
    const box = el("input", "desk-setting__input");
    box.type = "checkbox";
    label.append(box, el("span", "desk-setting__label", CARD_WORDS.remind));
    const note = el("p", "desk-home-card__note", CARD_WORDS.remindNote);
    note.id = id;
    box.setAttribute("aria-describedby", note.id);
    remind.append(label, note);
    return { remind, box };
  }

  function cardTitle(text, id) {
    const h = el("h3", "desk-home-card__title", text);
    h.id = id;
    h.tabIndex = -1;
    return h;
  }

  // While accounts are closed, a statement, not a question, since this
  // browser is the only place to keep it (BVJ, 2026-11-07, Audit 4 FU4-1:
  // it asked "Where should your notebook live?" with two answers that were
  // the same place). The checkbox writes `browser-remind`, so
  // `lit-desk-home` keeps both its values.
  const W = CARD_WORDS.closed;
  const choice = el("section", "desk-home-card");
  choice.setAttribute("aria-labelledby", "deskHomeTitle");
  const closedRemind = remindPart("deskHomeRemindNote");
  choice.append(cardTitle(W.title, "deskHomeTitle"), el("p", "desk-home-card__lead", W.lead), closedRemind.remind);
  if (safari) choice.append(el("p", "desk-home-card__safari", SAFARI_LINE));
  const more = el("p", "desk-home-card__more");
  more.append(`${W.more} `, link(WAYS_HREF, CARD_WORDS.ways));
  const done = el("button", "desk-home-card__choose desk-home-card__done", W.done);
  done.type = "button";
  done.addEventListener("click", () => choose(closedRemind.box.checked ? "browser-remind" : "browser"));
  choice.append(more, done);

  // Where accounts are open, the choice phase 4 brings (step 4j, BVJ
  // 2026-11-25). Keeping it in this browser is the answer stored; the
  // account is a link, since setting one up happens on the account pages,
  // and once this browser syncs the card goes.
  const O = CARD_WORDS.open;
  const ask = el("section", "desk-home-card desk-home-card--ask");
  ask.setAttribute("aria-labelledby", "deskHomeAskTitle");
  const openRemind = remindPart("deskHomeAskRemindNote");
  const keepPart = el("div", "desk-home-card__option");
  keepPart.append(el("p", "desk-home-card__lead", O.keepLead), openRemind.remind);
  if (safari) keepPart.append(el("p", "desk-home-card__safari", SAFARI_LINE));
  const keep = el("button", "desk-home-card__choose", O.keep);
  keep.type = "button";
  keep.addEventListener("click", () => choose(openRemind.box.checked ? "browser-remind" : "browser"));
  keepPart.append(keep);
  const accountPart = el("div", "desk-home-card__option");
  const account = link(ACCOUNT_HREF, O.account);
  account.classList.add("desk-home-card__account");
  accountPart.append(el("p", "desk-home-card__lead", O.accountLead), account);
  const askMore = el("p", "desk-home-card__more");
  askMore.append(`${O.more} `, link(WAYS_HREF, CARD_WORDS.ways));
  ask.append(cardTitle(O.title, "deskHomeAskTitle"), keepPart, accountPart, askMore);

  card.append(choice, ask);

  /* ── The tour offer ───────────────────────────────────────────── */

  // A window beside the Notebook, opened the first time the reader expands
  // it once the card is answered (BVJ,
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

  // Whether this browser's notebook syncs with an account, as `refresh` last
  // read it. Until then it counts as not, so the card is where it always was.
  let linked = false;

  function drawCard() {
    const unanswered = canKeep && !getHome() && !linked;
    const open = accountsOpen();
    choice.hidden = !unanswered || open;
    ask.hidden = !unanswered || !open;
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
  remindLabel.append(remindBox, el("span", "desk-setting__label", "Remind me to back up my notebook"));
  remindBox.addEventListener("change", () => {
    setHome(remindBox.checked ? "browser-remind" : "browser");
    maybeOffer();
    drawCard();
    refresh();
    refreshReminder();
  });

  const kept = el("p", "desk-panel__kept");
  const safariLine = el("p", "desk-home__safari");
  safariLine.hidden = !safari;
  if (safari) safariLine.append(`${SAFARI_LINE} `, link(BACKUP_HREF, "Back up your notebook"));

  // The notice (mock B, E113): a tinted group at the top of "Keep and print"
  // while a backup is due and not put off for a week. The checkbox lives here
  // then, and in the foot otherwise.
  const notice = el("div", "desk-backup-notice");
  notice.setAttribute("role", "group");
  notice.setAttribute("aria-labelledby", "deskBackupNoticeTitle");
  notice.hidden = true;
  const noticeTitle = el("h4", "desk-backup-notice__title", "Time to back up your notebook");
  noticeTitle.id = "deskBackupNoticeTitle";
  const noticeText = el("p", "desk-backup-notice__text");
  const backBtn = (cls) => {
    const b = el("button", cls, "Back up now");
    b.type = "button";
    b.addEventListener("click", async () => {
      if (b.getAttribute("aria-disabled") === "true") return;
      b.setAttribute("aria-disabled", "true");
      try {
        const { name } = await backUp({ store });
        showNotice(backedUpSaid(name));
      } catch (err) {
        console.error("Study Desk: the backup wasn’t made", err);
        showNotice("That didn’t work. Try again.");
      } finally {
        b.removeAttribute("aria-disabled");
      }
      refresh();
    });
    return b;
  };
  const noticeBtn = backBtn("desk-backup-notice__go");
  const quietBtn = backBtn("desk-home__backup");
  notice.append(noticeTitle, noticeText, noticeBtn);

  const links = el("p", "desk-home__links");
  const tour = el("button", "desk-home__tour", "Take the tour");
  tour.type = "button";
  tour.addEventListener("click", () => requestTour());
  // The preview's invitation (Phase 6): it opens beside the page, so the reader
  // keeps what they were looking at while they describe it.
  const feedback = link(FEEDBACK_HREF, FEEDBACK_LABEL);
  feedback.target = "_blank";
  feedback.rel = "noopener noreferrer";
  links.append(tour, link(HELP_HREF, "Help"), feedback);

  // Without a notebook, only the links (`hidden` wouldn't do for the remind
  // box: .desk-setting sets its display).
  if (canKeep) foot.append(remindLabel, kept, safariLine);
  foot.append(links);

  let seq = 0;
  /** Bring the foot and the notice up to date: the choice, when it was last backed up, whether the notebook holds anything. */
  async function refresh({ shown = false } = {}) {
    if (!canKeep) return;
    const mine = ++seq;
    const home = getHome();
    remindBox.checked = wantsReminder(home);
    // An offer of what's new is made when the panel is actually on screen.
    if (shown) maybeOffer();
    drawCard();

    const facts = (await factsFromStore(store)) ?? { lastExport: null, hasRecords: false, oldest: null };
    // A notebook that syncs with an account is in two places, and the line
    // says so (step 4h); the card has nothing to ask it (step 4j).
    let nowLinked = false;
    try {
      nowLinked = readLink(await store.getMeta(SYNC_META)) != null;
    } catch (_) {
      /* the link couldn't be read: the line says what is certain */
    }
    if (mine !== seq) return;
    linked = nowLinked;
    drawCard();
    const now = new Date();
    let putOff = null;
    try { putOff = localStorage.getItem(REMIND_KEY); } catch (_) {}
    const state = reminderState({ home, ...facts, putOff, now });
    // Due and not put off for a week: the notice, with the checkbox inside it.
    notice.hidden = !state.dots;
    if (state.dots) {
      noticeText.textContent = state.text;
      notice.insertBefore(remindLabel, noticeBtn.nextSibling);
      kept.replaceChildren(keptLine(linked));
    } else {
      foot.insertBefore(remindLabel, foot.firstChild);
      kept.replaceChildren(`${keptLine(linked)} ${savedLine(facts.lastExport, now, { linked })} `);
      if (facts.hasRecords) kept.append(quietBtn);
    }
  }

  /* ── Keeping in step ──────────────────────────────────────────── */

  // A backup made on the notebook page, or an answer given in another tab.
  window.addEventListener("focus", () => refresh());
  window.addEventListener("storage", (e) => {
    if (e.key === HOME_KEY || e.key === REMIND_KEY) refresh();
  });
  // The reminder's bar was answered (reminder.js).
  document.addEventListener(REMINDER_EVENT, () => refresh());

  // The first write the reader makes this visit, with no answer yet: point
  // the reader to the panel, where the card is (once, so it never nags). It
  // no longer opens the panel itself (E74): that moved the text.
  let revealed = false;
  store?.onEntry(() => {
    if (revealed || getHome() || linked) return;
    revealed = true;
    reveal();
  });

  drawCard();
  refresh();
  return { card, foot, notice, refresh, panelChanged };
}
