// src/scripts/desk/sheets/sheet-tour.js
//
// The Sheets tour (STUDY-DESK-FIXES.md E63; BVJ, 2026-11-09: "I think a third
// tour for Sheets is warranted, though it will likely be shorter"). Eight
// cards in two parts, making a sheet and then using one, run by the card the
// other two tours use (tour-runner.js), each beside the thing it is about and
// each showing it: the list of sheets, the template chooser, a sheet's parts,
// where a passage comes from, a passage's blanks and footnotes, the add bar,
// then printing and presenting.
//
// **It runs on two pages, through a host** (BVJ, 2026-11-09): on /desk, in a
// Sheets pane (sheet-tour-desk.js), and on the Sheets page, acting on that
// page's own list, editor and versions view (its host is built in
// sheet-page.js, which owns them). Since header C's Study menu and S12's ways
// in, a reader may meet the Sheets on the Sheets page first; an offer there
// that sent them to /desk was weighed and declined. This file is the tour
// itself, the same on both pages: the steps' order, the tour's sheet and its
// passage, the offer, the seen list and the runner. What differs is the
// host's: where the list and the chooser are, the LIT pane's verse menu (the
// desk's alone), the versions view (the page's alone), and how the page is
// put back. **It imports nothing from lit-panel.js, sheet-pane.js or
// desk-layout.mjs**: those are the desk's, and the Sheets page loads this file
// (by `import()` alone, when it offers or starts the tour) without them. A
// test holds it.
//
// The host (a method may return a promise, which the tour awaits):
//   view: "desk" | "page"             which wording a step takes (stepBody)
//   canKeep                           a notebook to keep sheets in; with none, no tour
//   begin({ onPick })                 the page in the tour's starting state; false when it can't be
//   editor({ onMade, live, show })    the editor the tour acts on, showing (`show: false`
//                                     leaves it where it is); one it has just made is
//                                     handed to `onMade` in the same tick
//   showList({ onPick, live })        the list drawn: { el, side?, marks }
//   openChooser({ onPick, live, waitFor })  the template chooser open:
//                                     { el, side?, marks, undo }; `waitFor` is the
//                                     runner's, so a host needs no copy of it
//   verseMenu?({ live, later, editor })  the desk's: the LIT pane's verse menu, its
//                                     "Add to" button marked, or null
//   versions?(editor)                 the page's: the versions view drawn for the
//                                     tour's sheet, { el, marks, present }
//   control?(editor, "print" | "present")  the desk's: the sheet header's link
//   passage()                         the passage the tour adds, { bookKey, chapter, verse },
//                                     or a promise of it
//   where?()                          where a card goes when a step's thing isn't there
//   finish()                          the page put back; a promise where that is async,
//                                     which the runner waits for before returning focus
//   returnFallback(), placeOffer(w), working(), canOffer(), otherOffer()
//
// **It writes nothing.** The tour's sheet is the editor's example mode
// (`setExample` in sheet-editor.js): a change is made in memory, and the sheet
// is never written, by its first change or by anything that would write a new
// sheet first ("Print or share…", "Present…", "Open on its own page", the LIT
// pane's "Add to" row, Done). The tour turns it on and starts the sheet in the
// tick the editor is made (`onMade`), before the editor's first view would
// show its list. Each host keeps the rest of its page off disk: the desk
// freezes its layout, and the Sheets page never touches the address or
// history and ends with its own `route()`. All the tour stores is its seen
// list, through first-use.js. A new step that changes the sheet goes through
// the editor's `change` in example mode and is undone by dropping the sheet at
// the end, never by a write.
//
// **Every step stands on its own**, so Back, "Skip this part" and a tour of
// new steps alone each find what they need: `ensureSheet` starts the tour's
// sheet when the editor shows anything else, and `ensurePassage` adds its
// passage when the sheet has none. A step's `later` undoes only what it opened
// (the chooser, the verse menu), never the sheet, which the end drops.
//
// The offer is a window (float-window.js), placed by the host and made when
// the host says the page may have it and nothing is in the way. Its answers
// are the other tours': Take the tour now, Remind me later (also ×, Escape,
// leaving), Don't show this again. "Seen" is `lit-desk-sheet-tour`, one list
// for both pages, so the tour taken, put off or declined on either counts on
// both, and a tour of new steps is offered once. The /desk tours refuse to
// start while `data-desk-tour` says a tour is running (Audit 7, TR7-6), and a
// tour starting takes this offer down.

import {
  SHEET_TOUR_PARTS, SHEET_TOUR_STEPS, localDay, parseTourState, planTour,
  tourOffer, withLater, withNever, withOffered, withSeen,
} from "../../../lib/desk-first-use.mjs";
import { passageFromVerses } from "../../../lib/desk-sheet-passages.mjs";
import { verseCount } from "../../../data/verse-counts.js";
import { createFloatWindow } from "../../float-window.js";
import { loadChapterPage } from "../chapter-page.js";
import { make } from "../dom.js";
import { getSheetTourRaw, saveSheetTourList } from "../first-use.js";
import { createTourRunner, waitFor } from "../tour-runner.js";

/** The template the tour's sheet starts from. */
const TEMPLATE = "bible-study";
/** How long a passage's blanks may take to be drawn: its chapter is fetched first. */
const PASSAGE_WAIT = 3000;

const today = () => localDay(new Date());
/** Whether a tour is running on this page (the runner sets it). */
const touring = () => document.documentElement.hasAttribute("data-desk-tour");

/**
 * Brings `target` into view in `scroller` alone, never the window, which the
 * runner puts back only at the end. `center` puts it in the middle.
 */
export function bringIntoView(scroller, target, { center = false } = {}) {
  if (!scroller || !target) return;
  const box = scroller.getBoundingClientRect();
  const r = target.getBoundingClientRect();
  const PAD = 12;
  if (center) scroller.scrollTop += r.top - box.top - (box.height - r.height) / 2;
  else if (r.top < box.top + PAD || r.height > box.height - 2 * PAD) scroller.scrollTop += r.top - box.top - PAD;
  else if (r.bottom > box.bottom - PAD) scroller.scrollTop += r.bottom - box.bottom + PAD;
}

/**
 * Brings a target into view: in the tour's editor's own scroller where that
 * scrolls (a Sheets pane, so the window never moves), else in the window (the
 * Sheets page, whose window scrolls), which the runner puts back at the end.
 */
function bring(ed, target) {
  if (!target) return;
  const box = ed?.el;
  if (box && box.scrollHeight > box.clientHeight + 1) bringIntoView(box, target);
  else target.scrollIntoView({ block: "nearest", behavior: "instant" });
}

/** @param {{ host: object }} options The page's host; see the header. */
export function createSheetTour({ host }) {
  const runner = createTourRunner();
  let state = null; // { sheetId: the tour's sheet } while it runs
  let acting = 0; // counts the steps begun, so a step the reader has moved past stops

  const later = (fn) => runner.later(fn);
  const where = () => host.where?.() ?? null;
  const sheetView = (ed) => ed.el.querySelector(".desk-sheet__sheet-view") ?? ed.el;

  /** The tour's sheet in `ed`: example mode on, then a sheet from `template`, in memory. */
  function startSheet(ed, template = TEMPLATE) {
    ed.setExample(true);
    ed.startFrom(template);
    if (state) state.sheetId = ed.sheet()?.id ?? null;
  }

  /**
   * The tour's editor, showing the tour's own sheet: started from the Bible
   * study template in example mode when the editor shows anything else (the
   * list, or a sheet the reader opened during the tour). `show: false` leaves
   * the editor where it is (the Sheets page's versions view draws over it).
   */
  async function ensureSheet(live, { show = true } = {}) {
    const ed = await host.editor({ onMade: (made) => startSheet(made), live, show });
    if (!ed || !live()) return null;
    ed.setExample(true);
    if (!state.sheetId || ed.sheet()?.id !== state.sheetId) startSheet(ed);
    return ed;
  }

  /**
   * A template chosen in the tour's chooser on the Sheets page, whose "New
   * sheet…" would otherwise open the editor at a new address: the tour's
   * sheet starts from it instead, in memory, and the editor shows it.
   */
  async function pick(template) {
    const live = () => runner.running();
    let made = false;
    const ed = await host.editor({ onMade: (e) => { made = true; startSheet(e, template); }, live });
    if (ed && !made && live()) startSheet(ed, template);
  }

  /**
   * The tour's passage on its sheet, added in memory when the sheet has none:
   * up to two verses of the host's chapter from its verse (the leading LIT
   * pane's on /desk, Continue reading's on the Sheets page), read from the
   * chapter's page as any passage is. Resolves the passage's card, or null.
   */
  async function ensurePassage(ed, live) {
    const card = () => {
      const m = ed.sheet()?.modules.find((x) => x.type === "passage");
      return m ? ed.el.querySelector(`.desk-sheet__module[data-module-id="${CSS.escape(m.id)}"]`) : null;
    };
    if (ed.sheet()?.modules.some((x) => x.type === "passage")) return card();
    const p = await host.passage();
    if (!p) return null;
    const start = p.verse ?? 1;
    const end = Math.max(start, Math.min(start + 1, verseCount(p.bookKey, p.chapter)));
    let text = null;
    try {
      const source = await loadChapterPage(p.bookKey, p.chapter);
      text = source.textBox ? source.anchorText() : null;
    } catch (_) {} // offline: the passage is added unread, and its card says so
    // Only onto the tour's own sheet, while the step is still showing: a
    // step the reader has moved past, or a tour that has ended, adds nothing.
    if (!live() || ed.sheet()?.id !== state?.sheetId) return null;
    await ed.addPassage(passageFromVerses(text, { bookKey: p.bookKey, chapter: p.chapter }, start, end, ed.contentVersion()));
    return live() ? card() : null;
  }

  /**
   * Printing and presenting: the Sheets page's versions view, drawn for the
   * tour's sheet, or on /desk the sheet header's link. `which` is "print" or
   * "present".
   */
  async function using(live, which) {
    const ed = await ensureSheet(live, { show: !host.versions });
    if (!ed) return live() ? where() : null;
    if (host.versions) {
      const v = await host.versions(ed);
      if (!live()) return null;
      if (!v) return where();
      if (which === "present" && v.present) {
        bring(null, v.present);
        return { el: v.present, marks: [v.present] };
      }
      bring(null, v.el);
      return { el: v.el, marks: v.marks };
    }
    const link = host.control?.(ed, which) ?? null;
    if (!link) return { el: sheetView(ed), side: "left", marks: [] };
    bring(ed, link.el);
    return link;
  }

  /* ── What the steps do ────────────────────────────────────────── */

  // Each is handed `live()`, false once the reader has moved on or the tour
  // has ended, so a step that waited does nothing more.
  const STEPS = {
    // The list, with New sheet marked.
    async list(live) {
      const got = await host.showList({ onPick: pick, live });
      return live() ? got ?? where() : null;
    },

    // The template chooser, open as New sheet opens it. Choosing nothing, the
    // step makes nothing; a choice makes the tour's sheet, in memory.
    async templates(live) {
      const got = await host.openChooser({ onPick: pick, live, waitFor });
      if (!live()) {
        got?.undo?.();
        return null;
      }
      if (got?.undo) later(got.undo);
      return got ?? where();
    },

    // The tour's sheet, beside its first part, with that part's header tools
    // (its minutes and Leader only) marked.
    async parts(live) {
      const ed = await ensureSheet(live);
      if (!ed) return live() ? where() : null;
      const first = ed.el.querySelector(".desk-sheet__modules > .desk-sheet__module");
      if (!first) return where();
      bring(ed, first);
      const tools = first.querySelector(".desk-sheet__module-tools");
      return { el: first, side: "left", marks: tools ? [tools] : [] };
    },

    // Where a passage comes from: on /desk the LIT pane's verse menu, with its
    // Sheets row's "Add to" marked; on the Sheets page, or where no menu opens
    // (no LIT pane, no verse numbers), the reading part's own passage form.
    async passage(live) {
      const ed = await ensureSheet(live);
      if (!ed) return live() ? where() : null;
      const menu = host.verseMenu ? await host.verseMenu({ live, later, editor: ed }) : null;
      if (!live()) return null;
      if (menu) return menu;
      const form = ed.el.querySelector(".desk-sheet__insert-form");
      if (!form) return { el: sheetView(ed), side: "left", marks: [] };
      bring(ed, form);
      return { el: form, side: "left", marks: [form] };
    },

    // A passage added for the tour, beside its blanks, with "Blank the
    // selected words" and the footnotes' summary marked. Offline (no chapter
    // read, so no blanks), beside the passage itself.
    async blanks(live) {
      const ed = await ensureSheet(live);
      if (!ed) return live() ? where() : null;
      const card = await ensurePassage(ed, live);
      if (!live()) return null;
      if (!card) return { el: sheetView(ed), side: "left", marks: [] };
      const box = await waitFor(() => card.querySelector(".desk-sheet__blanks"), PASSAGE_WAIT);
      if (!live()) return null;
      if (!box) {
        bring(ed, card);
        return { el: card, side: "left", marks: [] };
      }
      const summary = await waitFor(() => card.querySelector(".desk-sheet__notes-summary"), 1000);
      if (!live()) return null;
      const blank = Array.from(box.querySelectorAll("button")).find((b) => b.textContent.trim() === "Blank the selected words");
      bring(ed, box);
      return { el: box, side: "left", marks: [blank, summary ?? card.querySelector(".desk-sheet__notes")].filter(Boolean) };
    },

    // The add bar under the parts (not a passage form's row of the same class).
    async words(live) {
      const ed = await ensureSheet(live);
      if (!ed) return live() ? where() : null;
      const row = ed.el.querySelector(".desk-sheet__add > .desk-sheet__add-row");
      if (!row) return { el: sheetView(ed), side: "left", marks: [] };
      bring(ed, row);
      return { el: row, side: "left", marks: [row] };
    },

    async print(live) {
      return using(live, "print");
    },

    async present(live) {
      return using(live, "present");
    },
  };

  /* ── Starting and ending ──────────────────────────────────────── */

  function start({ only = null } = {}) {
    // Not over another tour, whose run this runner doesn't know (TR7-6).
    if (runner.running() || touring()) return;
    // Noted before the tour draws its first view, which may take it off the page.
    const from = document.activeElement;
    offerWin.close("take");
    // Every step is a `notebook` one: where the browser keeps no notebook,
    // there is no tour.
    const steps = planTour({
      available: new Set(SHEET_TOUR_STEPS.map((s) => s.id)), only, canKeep: host.canKeep,
      steps: SHEET_TOUR_STEPS, parts: SHEET_TOUR_PARTS,
    });
    if (!steps.length) return;
    if (host.begin({ onPick: pick }) === false) return;

    // Seen from the moment it starts, so ending early is the same as ending.
    saveSheetTourList(withSeen(parseTourState(getSheetTourRaw(), SHEET_TOUR_STEPS).list, SHEET_TOUR_STEPS.map((s) => s.id)));
    state = { sheetId: null };
    runner.start({
      steps,
      view: host.view,
      act: (step) => {
        const n = ++acting;
        return STEPS[step.id]?.(() => n === acting && runner.running()) ?? null;
      },
      // `body` (a start by address, or from the offer) is no place to return to:
      // the host's fallback then (TR7-9).
      returnTo: from instanceof HTMLElement && from !== document.body ? from : null,
      returnFallback: () => host.returnFallback(),
      finish,
    });
  }

  // The tour's sheet dropped unwritten and the page put back, by the host
  // (the Sheets page's returns its redraw's promise, which the runner waits
  // for before it returns focus, TR7-9).
  function finish() {
    state = null;
    return host.finish();
  }

  /* ── The offer ────────────────────────────────────────────────── */

  const offerWin = createFloatWindow({
    heading: "Sheets tour",
    title: "Take a short tour of the Sheets?",
    className: "desk-offer",
    attrs: { "data-desk-dock": "" },
    place: (w) => host.placeOffer(w),
    onClose: () => {
      offer = null;
    },
  });
  const offerText = make("p", "desk-offer__lead");
  const offerRow = make("div", "desk-offer__row");
  const yes = make("button", "desk-offer__go", "Take the tour now");
  yes.type = "button";
  const later_ = make("button", "desk-offer__later", "Remind me later");
  later_.type = "button";
  const never = make("button", "desk-offer__never", "Don’t show this again");
  never.type = "button";
  offerRow.append(yes, later_);
  offerWin.body.append(offerText, offerRow, never);

  let offer = null; // { kind, ids } while the offer is up

  // A tour starting takes the offer down (the Study Desk tour, from the title
  // menu, while this offer is up). It was written as "later" when it was
  // shown, so it comes back on a later day as if put off.
  new MutationObserver(() => {
    if (offer && touring()) offerWin.close("tour");
  }).observe(document.documentElement, { attributes: true, attributeFilter: ["data-desk-tour"] });

  /**
   * The offer, made when the host says the page may have it (a Sheets pane on
   * the desk; the list or a sheet's versions on the Sheets page) and nothing
   * is in the way: no tour running, and no other offer up.
   */
  function maybeOffer() {
    if (offer || !host.canKeep || runner.running() || touring() || host.otherOffer() || !host.canOffer()) return;
    const o = tourOffer(getSheetTourRaw(), { today: today(), steps: SHEET_TOUR_STEPS });
    if (!o.kind) return;
    // Until it's answered, an offer shown counts as "remind me later," so
    // leaving it, or going on to the next page, never brings it straight back.
    saveSheetTourList(withLater(o.list, today()));
    offer = o;
    offerWin.title.textContent = o.kind === "first" ? "Take a short tour of the Sheets?" : "There’s something new in the tour.";
    offerText.textContent =
      o.kind === "first"
        ? "It takes a minute and shows how a sheet is made, from its template to its passages and blanks, and how it is printed, presented, and shared. Nothing it does is saved."
        : "Want a look at what’s new?";
    yes.textContent = o.kind === "first" ? "Take the tour now" : "Show me what’s new";
    // It can come while the reader works (a Sheets pane just added, a sheet's
    // title being typed), so it takes focus only when the host says focus is
    // on nothing of the reader's.
    offerWin.show({ focus: !host.working() });
  }

  yes.addEventListener("click", () => {
    const o = offer;
    offerWin.close("take");
    const { list } = parseTourState(getSheetTourRaw(), SHEET_TOUR_STEPS);
    saveSheetTourList(o?.kind === "new" ? withOffered(list, o.ids) : withOffered(list));
    start({ only: o?.kind === "new" ? o.ids : null });
  });
  later_.addEventListener("click", () => offerWin.close("later"));
  never.addEventListener("click", () => {
    saveSheetTourList(withNever(parseTourState(getSheetTourRaw(), SHEET_TOUR_STEPS).list));
    offerWin.close("never");
  });

  return { start, maybeOffer, running: runner.running, offering: () => Boolean(offer) };
}
