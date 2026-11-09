// src/scripts/desk/sheets/sheet-tour.js
//
// The Sheets tour (STUDY-DESK-FIXES.md E63; BVJ, 2026-11-09: "I think a third
// tour for Sheets is warranted, though it will likely be shorter"). Eight
// cards in two parts, making a sheet and then using one, run by the card the
// other two tours use (tour-runner.js), each beside the thing it is about and
// each showing it: the list of sheets, the template chooser, a sheet's parts,
// the LIT pane's verse menu with its "Add to" row, a passage's blanks and
// footnotes, the add bar, and the header's "Print or share…" and "Present…".
//
// It runs on /desk, in a Sheets pane, as the Study Desk tour does
// (desk-tour.js), and not on /sheets: the LIT pane's "Add to" row and "Open on
// its own page" are only here, and the desk tour's "New sheet…" step already
// sends people here. Same runner, same offer, same discipline.
//
// **It writes nothing.** It starts by closing the title and Layout menus and
// putting the desk in its original layout with a Sheets pane added (a column
// where there is room, else the first pane that isn't the LIT turned to
// Sheets, as the desk tour's Sheets step does), with the page's `freeze` on,
// so `lit-desk-layout` is never written; and it turns that pane's editor to
// its example mode (`setExample` in sheet-editor.js), where a change is made in
// memory and the sheet shown is never written, by its first change or by
// "Print or share…", "Present…", "Open on its own page" or the LIT pane's "Add
// to" row. So the sheet it starts from the Bible study template, and the
// passage it adds, are the tour's alone. At the end `endExample` drops them and
// the editor shows what the layout says, the reader's own layout comes back,
// and the freeze comes off. All it stores is its seen list, through
// first-use.js. A new step that changes the sheet goes through the editor's
// `change` in example mode and is undone by dropping the sheet at the end,
// never by a write.
//
// **Every step stands on its own**, so Back, "Skip this part" and a tour of
// new steps alone each find what they need: `ensureSheet` starts the tour's
// sheet when the pane shows anything else, and `ensurePassage` adds its
// passage when the sheet has none. The first two steps show the list, which
// drops the sheet; the next step that needs one starts it again. A step's
// `later` undoes only what it opened (the chooser, the verse menu, the LIT
// pane's scroll), never the sheet, which the end drops.
//
// Ways in: `?sheet-tour` on /desk's address (the help page links to it), "Take
// the Sheets tour" at the foot of a Sheets pane's list (my-sheets.js, sent as
// `desk:sheet-tour`), the offer, and the Study Desk tour's Sheets card's link.
// Not the title menu, whose "Take the tour" is the Study Desk tour's. The two
// /desk tours have a runner each, so each refuses to start while
// `data-desk-tour` says a tour is running (Audit 7, TR7-6), and either one
// starting takes the other's offer down.
//
// The offer is a window (float-window.js) beside the Sheets pane, made when a
// Sheets pane is on the desk and nothing is in the way (desk-page.js asks 1.6
// seconds after a draw, and not while the layout is frozen). Its answers are
// the other tours': Take the tour now, Remind me later (also ×, Escape,
// leaving), Don't show this again.
//
// "Seen" is its own list, `lit-desk-sheet-tour` (first-use.js), in the other
// two tours' shape, so finishing one tour says nothing about another.

import {
  SHEET_TOUR_PARTS, SHEET_TOUR_STEPS, localDay, parseTourState, planTour,
  tourOffer, withLater, withNever, withOffered, withSeen,
} from "../../../lib/desk-first-use.mjs";
import { addPane, addPaneNeeds, originalLayout, panes, setKind } from "../../../lib/desk-layout.mjs";
import { passageFromVerses } from "../../../lib/desk-sheet-passages.mjs";
import { verseCount } from "../../../data/verse-counts.js";
import { createFloatWindow } from "../../float-window.js";
import { closePanel, currentPanel } from "../../lit-panel.js";
import { loadChapterPage } from "../chapter-page.js";
import { make } from "../dom.js";
import { getSheetTourRaw, saveSheetTourList } from "../first-use.js";
import { createTourRunner, waitFor } from "../tour-runner.js";
import { useAsTarget } from "./sheet-pane.js";

/** The template the tour's sheet starts from. */
const TEMPLATE = "bible-study";
/** How long a passage's blanks may take to be drawn: its chapter is fetched first. */
const PASSAGE_WAIT = 3000;

const today = () => localDay(new Date());
const frame = () => new Promise((r) => requestAnimationFrame(() => r()));
/** Whether a tour is running on this page, this one or the Study Desk tour (the runner sets it). */
const touring = () => document.documentElement.hasAttribute("data-desk-tour");

/**
 * Brings `target` into view in `scroller` alone, never the window, which the
 * runner puts back only at the end. `center` puts it in the middle.
 */
function bringIntoView(scroller, target, { center = false } = {}) {
  if (!scroller || !target) return;
  const box = scroller.getBoundingClientRect();
  const r = target.getBoundingClientRect();
  const PAD = 12;
  if (center) scroller.scrollTop += r.top - box.top - (box.height - r.height) / 2;
  else if (r.top < box.top + PAD || r.height > box.height - 2 * PAD) scroller.scrollTop += r.top - box.top - PAD;
  else if (r.bottom > box.bottom - PAD) scroller.scrollTop += r.bottom - box.bottom + PAD;
}

/** The Sheets row sheet-pane.js adds to the LIT pane's menus: its "Add to “…”" button. */
function addButton(menu) {
  const head = Array.from(menu.querySelectorAll(".lit-panel__subheading")).find((h) => h.textContent.trim() === "Sheets");
  const row = head?.nextElementSibling;
  return row?.classList.contains("lit-panel__row") ? row.querySelector("button") : null;
}

/**
 * @param {{ canKeep: boolean, getLayout: () => object, setLayout: (next: object) => void,
 *   freeze: (on: boolean) => void, closeMenus: () => void,
 *   paneEls: Map<string, object>, panesBox: HTMLElement,
 *   litPassage: () => ({ bookKey: string, chapter: number, verse: number | null } | null),
 *   otherOffer: () => boolean }} api
 *   The page's own pieces, as the Study Desk tour has them: `setLayout` is the
 *   page's `commit`, `freeze` stops its saving, and `closeMenus` closes the
 *   title and Layout menus. `litPassage` is the passage the first LIT pane
 *   shows, and `otherOffer` whether the Study Desk tour's offer is up.
 */
export function createSheetTour(api) {
  const runner = createTourRunner();
  let state = null; // { mine: the reader's layout, paneId: the tour's Sheets pane, sheetId: the tour's sheet }
  let acting = 0; // counts the steps begun, so a step the reader has moved past stops

  const later = (fn) => runner.later(fn);
  const recOf = (id) => (id ? api.paneEls.get(id) ?? null : null);
  /** The tour's Sheets pane's editor, or null once the pane is gone. */
  const editor = () => recOf(state?.paneId)?.inst?.editor ?? null;
  /** The same, in example mode: a pane turned back to Sheets mid-tour is a new editor. */
  const tourEditor = () => {
    const ed = editor();
    ed?.setExample(true);
    return ed;
  };
  const scrollInPane = (target) => bringIntoView(editor()?.el, target);
  const sheetView = (ed) => ed.el.querySelector(".desk-sheet__sheet-view") ?? ed.el;
  /** Where a card goes when what its step shows isn't there: beside the Sheets pane's name. */
  const paneCard = () => {
    const rec = recOf(state?.paneId);
    return rec ? { el: rec.kindButton, marks: [rec.kindButton] } : null;
  };

  /**
   * The tour's own sheet in its pane, started from the Bible study template in
   * example mode (in memory, never written) when the pane shows anything else:
   * the list, or a sheet the reader opened during the tour.
   */
  function ensureSheet() {
    const ed = tourEditor();
    if (!ed) return null;
    if (!state.sheetId || ed.sheet()?.id !== state.sheetId) {
      ed.startFrom(TEMPLATE);
      state.sheetId = ed.sheet()?.id ?? null;
    }
    return ed;
  }

  /**
   * The tour's passage on its sheet, added in memory when the sheet has none:
   * up to two verses of the first LIT pane's chapter, from the verse it is at,
   * read from the chapter's page as any passage is. Resolves the passage's
   * card, or null.
   */
  async function ensurePassage(ed, live) {
    const card = () => {
      const m = ed.sheet()?.modules.find((x) => x.type === "passage");
      return m ? ed.el.querySelector(`.desk-sheet__module[data-module-id="${CSS.escape(m.id)}"]`) : null;
    };
    if (ed.sheet()?.modules.some((x) => x.type === "passage")) return card();
    const p = api.litPassage();
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
    if (!live() || editor() !== ed || ed.sheet()?.id !== state?.sheetId) return null;
    await ed.addPassage(passageFromVerses(text, { bookKey: p.bookKey, chapter: p.chapter }, start, end, ed.contentVersion()));
    return live() ? card() : null;
  }

  /**
   * The LIT pane's verse menu, opened as a reader opens it: a click on a verse
   * number in view, else the first, brought into view in the LIT pane's own
   * scroller, which `later` puts back. The menu closes with the step.
   */
  async function openVerseMenu(live) {
    const lit = panes(api.getLayout().root).find((p) => p.kind === "lit");
    const body = recOf(lit?.id)?.body;
    if (!body) return null;
    const VERSES = ".desk-lit__chapter .chapter-paragraphs sup.vn";
    // A LIT pane the tour's layout has just drawn may still be reading its chapter.
    if (!(await waitFor(() => body.querySelector(VERSES))) || !live()) return null;
    const numbers = Array.from(body.querySelectorAll(VERSES));
    const scroller = body.querySelector(".desk-lit__scroll") ?? body;
    const box = scroller.getBoundingClientRect();
    const drawn = (n) => n.getBoundingClientRect().height > 0;
    const shown = (n) => {
      const r = n.getBoundingClientRect();
      return r.height > 0 && r.top >= box.top + 24 && r.bottom <= box.bottom - 24;
    };
    let sup = numbers.find(shown);
    if (!sup) {
      sup = numbers.find(drawn) ?? numbers[0];
      const before = scroller.scrollTop;
      later(() => { scroller.scrollTop = before; });
      bringIntoView(scroller, sup, { center: true });
    }
    // Registered before waiting again, so it belongs to this step's undoing.
    later(() => closePanel());
    await frame();
    if (!live()) return null;
    closePanel();
    sup.click();
    await frame();
    return live() ? currentPanel()?.el ?? null : null;
  }

  /** A link in the sheet's header, "Print or share…" or "Present…", marked. */
  function headerLink(start) {
    const ed = ensureSheet();
    if (!ed) return null;
    const link = Array.from(ed.el.querySelectorAll(".desk-sheet__top a")).find((a) => a.textContent.trim().startsWith(start));
    if (!link) return { el: sheetView(ed), side: "left", marks: [] };
    scrollInPane(link);
    return { el: link, side: "left", marks: [link] };
  }

  /* ── What the steps do ────────────────────────────────────────── */

  // Each is handed `live()`, false once the reader has moved on or the tour
  // has ended, so a step that waited does nothing more. The Sheets pane is a
  // column at the right, so the cards go to the left of what they point at.
  const STEPS = {
    // The list, with New sheet marked.
    async list(live) {
      const ed = tourEditor();
      if (!ed) return null;
      if (ed.sheet() || !ed.el.querySelector(".desk-sheet__list-head")) ed.showList();
      const head = await waitFor(() => ed.el.querySelector(".desk-sheet__list-head"));
      if (!live()) return null;
      if (!head) return paneCard();
      const fresh = head.querySelector("button");
      return { el: head, side: "left", marks: fresh ? [fresh] : [] };
    },

    // The template chooser, open as New sheet opens it. Choosing nothing, the
    // step makes nothing; a choice makes a sheet in example mode, unwritten.
    async templates(live) {
      const ed = tourEditor();
      if (!ed) return null;
      if (ed.sheet() || !ed.el.querySelector(".desk-sheet__templates")) ed.showList();
      const chooser = await waitFor(() => ed.el.querySelector(".desk-sheet__templates"));
      if (!live()) return null;
      if (!chooser) return paneCard();
      if (chooser.hidden) chooser.toggle();
      later(() => {
        if (chooser.isConnected && !chooser.hidden) chooser.toggle();
      });
      return { el: chooser, side: "left", marks: [chooser] };
    },

    // The tour's sheet, beside its first part, with that part's header tools
    // (its minutes and Leader only) marked.
    async parts() {
      const ed = ensureSheet();
      const first = ed?.el.querySelector(".desk-sheet__modules > .desk-sheet__module");
      if (!first) return paneCard();
      scrollInPane(first);
      const tools = first.querySelector(".desk-sheet__module-tools");
      return { el: first, side: "left", marks: tools ? [tools] : [] };
    },

    // The LIT pane's verse menu, with its Sheets row's "Add to" marked: the
    // way a passage most often comes in. Where no menu opens (no LIT pane, no
    // verse numbers), the reading part's own passage form.
    async passage(live) {
      const ed = ensureSheet();
      if (!ed) return null;
      useAsTarget(ed);
      const menu = await openVerseMenu(live);
      if (!live()) return null;
      if (menu) {
        const add = addButton(menu);
        return { el: menu, side: "right", marks: add ? [add] : [] };
      }
      const form = ed.el.querySelector(".desk-sheet__insert-form");
      if (!form) return { el: sheetView(ed), side: "left", marks: [] };
      scrollInPane(form);
      return { el: form, side: "left", marks: [form] };
    },

    // A passage added for the tour, beside its blanks, with "Blank the
    // selected words" and the footnotes' summary marked. Offline (no chapter
    // read, so no blanks), beside the passage itself.
    async blanks(live) {
      const ed = ensureSheet();
      if (!ed) return null;
      const card = await ensurePassage(ed, live);
      if (!live()) return null;
      if (!card) return { el: sheetView(ed), side: "left", marks: [] };
      const box = await waitFor(() => card.querySelector(".desk-sheet__blanks"), PASSAGE_WAIT);
      if (!live()) return null;
      if (!box) {
        scrollInPane(card);
        return { el: card, side: "left", marks: [] };
      }
      const summary = await waitFor(() => card.querySelector(".desk-sheet__notes-summary"), 1000);
      if (!live()) return null;
      const pick = Array.from(box.querySelectorAll("button")).find((b) => b.textContent.trim() === "Blank the selected words");
      scrollInPane(box);
      return { el: box, side: "left", marks: [pick, summary ?? card.querySelector(".desk-sheet__notes")].filter(Boolean) };
    },

    // The add bar under the parts (not a passage form's row of the same class).
    async words() {
      const ed = ensureSheet();
      if (!ed) return null;
      const row = ed.el.querySelector(".desk-sheet__add > .desk-sheet__add-row");
      if (!row) return { el: sheetView(ed), side: "left", marks: [] };
      scrollInPane(row);
      return { el: row, side: "left", marks: [row] };
    },

    async print() {
      return headerLink("Print");
    },

    async present() {
      return headerLink("Present");
    },
  };

  /* ── Starting and ending ──────────────────────────────────────── */

  /**
   * The layout the tour runs on: the original layout with a Sheets pane, a
   * column where there is room, else the first pane that isn't the LIT turned
   * to Sheets (the Study Desk tour's Sheets step, E59).
   */
  function withSheetsPane(layout) {
    const { width, height } = api.panesBox.getBoundingClientRect();
    if (!addPaneNeeds(layout, "column", width, height)) {
      const before = new Set(panes(layout.root).map((p) => p.id));
      const next = addPane(layout, "column", "sheet", width, height);
      const id = panes(next.root).find((p) => !before.has(p.id))?.id;
      if (id) return { layout: next, paneId: id };
    }
    const give = panes(layout.root).find((p) => p.kind !== "lit") ?? panes(layout.root)[0];
    return give ? { layout: setKind(layout, give.id, "sheet"), paneId: give.id } : { layout, paneId: null };
  }

  function start({ only = null } = {}) {
    // Not over the Study Desk tour, whose run this runner doesn't know (TR7-6).
    if (runner.running() || touring()) return;
    // Noted before the tour's layout is drawn, which may take it off the page.
    const from = document.activeElement;
    offerWin.close("take");
    // Every step is a `notebook` one: where the browser keeps no notebook,
    // there is no tour.
    const steps = planTour({
      available: new Set(SHEET_TOUR_STEPS.map((s) => s.id)), only, canKeep: api.canKeep,
      steps: SHEET_TOUR_STEPS, parts: SHEET_TOUR_PARTS,
    });
    if (!steps.length) return;
    const mine = api.getLayout();
    const { layout: base, paneId } = withSheetsPane(originalLayout(mine.place));
    if (!paneId) return;

    // Seen from the moment it starts, so ending early is the same as ending.
    saveSheetTourList(withSeen(parseTourState(getSheetTourRaw(), SHEET_TOUR_STEPS).list, SHEET_TOUR_STEPS.map((s) => s.id)));
    state = { mine, paneId, sheetId: null };
    api.closeMenus();
    api.freeze(true);
    api.setLayout(base);
    tourEditor();
    runner.start({
      steps,
      act: (step) => {
        const n = ++acting;
        return STEPS[step.id]?.(() => n === acting && runner.running()) ?? null;
      },
      // `body` (a start by address) is no place to return to: the fallback then (TR7-9).
      returnTo: from instanceof HTMLElement && from !== document.body ? from : null,
      // Where focus was went with the tour's layout (the list's link, in a
      // pane that layout didn't keep): the first Sheets pane's name instead.
      returnFallback: () => {
        const all = panes(api.getLayout().root);
        return recOf((all.find((p) => p.kind === "sheet") ?? all[0])?.id)?.kindButton ?? null;
      },
      finish,
    });
  }

  // The tour's sheet dropped unwritten, the reader's own layout back, then
  // saving on again. A pane of the reader's layout with the tour's pane's id
  // and kind keeps its editor through that redraw, so the editor is told again
  // once the layout says what it shows, and never keeps the tour's sheet.
  function finish() {
    const { mine, paneId } = state;
    try {
      recOf(paneId)?.inst?.editor?.endExample();
      api.setLayout(mine);
    } finally {
      api.freeze(false);
      state = null;
    }
    recOf(paneId)?.inst?.editor?.endExample();
  }

  /* ── The offer ────────────────────────────────────────────────── */

  const offerWin = createFloatWindow({
    heading: "Sheets tour",
    title: "Take a short tour of the Sheets?",
    className: "desk-offer",
    attrs: { "data-desk-dock": "" },
    place: placeOffer,
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

  // A tour starting takes the offer down: the Study Desk tour, from the title
  // menu, while this offer is up. It was written as "later" when it was shown,
  // so it comes back on a later day as if put off.
  new MutationObserver(() => {
    if (offer && touring()) offerWin.close("tour");
  }).observe(document.documentElement, { attributes: true, attributeFilter: ["data-desk-tour"] });

  /** The first Sheets pane on the desk, or null. */
  function sheetsPane() {
    const pane = panes(api.getLayout().root).find((p) => p.kind === "sheet");
    const rec = recOf(pane?.id);
    return rec?.el?.isConnected ? rec.el : null;
  }

  /**
   * The offer, made when a Sheets pane is on the desk and nothing is in the
   * way: no tour running, and the Study Desk tour's offer, which comes first,
   * not up. desk-page.js asks after a draw, and not while the layout is frozen.
   */
  function maybeOffer() {
    if (offer || !api.canKeep || runner.running() || touring() || api.otherOffer() || !sheetsPane()) return;
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
    // Unlike the Study Desk tour's, made at load, this one can come while the
    // reader works (a Sheets pane just added, a sheet's title being typed), so
    // it takes focus only when focus is on nothing in particular.
    const at = document.activeElement;
    const working =
      at instanceof HTMLElement &&
      at !== document.body &&
      (at.isContentEditable || at.matches("input, textarea, select") || Boolean(at.closest(".desk-pane")));
    offerWin.show({ focus: !working });
  }

  /**
   * Beside the Sheets pane, its top level with the pane's: to the left where
   * there is room, else to the right, else over the pane's top, centered, as
   * the notebook tour's offer sits beside the Notebook.
   */
  function placeOffer(w) {
    const p = sheetsPane()?.getBoundingClientRect();
    if (!p) return;
    const GAP = 12;
    const EDGE = 8;
    const width = Math.min(300, innerWidth - 2 * EDGE);
    w.style.width = `${width}px`;
    w.style.top = `${Math.max(EDGE, p.top)}px`;
    if (p.left - GAP - width >= EDGE) {
      w.style.left = `${p.left - GAP - width}px`;
    } else if (p.right + GAP + width <= innerWidth - EDGE) {
      w.style.left = `${p.right + GAP}px`;
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
