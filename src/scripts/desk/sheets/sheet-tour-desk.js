// src/scripts/desk/sheets/sheet-tour-desk.js
//
// The Sheets tour's host on /desk (STUDY-DESK-FIXES.md E63): what the tour
// (sheet-tour.js, the same on both pages it runs on) does through the Study
// Desk's own pieces, which desk-page.js hands in as `api`, as it does for the
// Study Desk tour. The Sheets page's host is in sheet-page.js. What is only
// the desk's lives here, so the tour itself never loads it on /sheets:
//
// - **A Sheets pane, on a frozen layout.** `begin` closes the title and Layout
//   menus and puts the desk in its original layout with a Sheets pane added (a
//   column where there is room, else the first pane that isn't the LIT turned
//   to Sheets, as the Study Desk tour's Sheets step does), with the page's
//   `freeze` on, so `lit-desk-layout` is never written. `finish` ends the
//   editor's example mode, commits the reader's own layout back, takes the
//   freeze off, and ends the example once more for a pane of the reader's
//   layout with the tour's pane's id and kind, which keeps its editor through
//   that redraw and must show what the layout says, never the tour's sheet.
// - **The pane's editor is the tour's.** Its list and template chooser are the
//   editor's own (my-sheets.js), and its header's "Print or share…" and
//   "Present…" are the last two steps' links.
// - **The LIT pane's verse menu**, opened as a reader opens it, with a click on
//   a verse number in view (else the first, brought into view in the LIT
//   pane's own scroller, which `later` puts back). Its Sheets row exists only
//   for the pane that counts as the target, so the tour's pane is made the
//   target first (`useAsTarget`, sheet-pane.js).
// - **The passage** is the leading LIT pane's chapter, from the verse it is at
//   (`litPassage`).
// - **The offer** sits beside the Sheets pane, and is made only while one is
//   on the desk and the Study Desk tour's offer isn't up; desk-page.js asks 1.6
//   seconds after a draw, and not while the layout is frozen.

import { addPane, addPaneNeeds, originalLayout, panes, setKind } from "../../../lib/desk-layout.mjs";
import { closePanel, currentPanel } from "../../lit-panel.js";
import { waitFor } from "../tour-runner.js";
import { useAsTarget } from "./sheet-pane.js";
import { bringIntoView, createSheetTour } from "./sheet-tour.js";

const frame = () => new Promise((r) => requestAnimationFrame(() => r()));

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
 * @returns {{ start: (o?: { only?: string[] | null }) => void, maybeOffer: () => void,
 *   running: () => boolean, offering: () => boolean }}
 */
export function createDeskSheetTour(api) {
  let state = null; // { mine: the reader's layout, paneId: the tour's Sheets pane } while it runs

  const recOf = (id) => (id ? api.paneEls.get(id) ?? null : null);
  /** The tour's Sheets pane's editor in example mode (a pane turned back to Sheets mid-tour is a new one), or null. */
  const tourEditor = () => {
    const ed = recOf(state?.paneId)?.inst?.editor ?? null;
    ed?.setExample(true);
    return ed;
  };
  /** Beside the Sheets pane's name, where a step's thing isn't there. */
  const paneCard = () => {
    const rec = recOf(state?.paneId);
    return rec ? { el: rec.kindButton, marks: [rec.kindButton] } : null;
  };

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

  /** The first Sheets pane on the desk, or null. */
  function sheetsPane() {
    const pane = panes(api.getLayout().root).find((p) => p.kind === "sheet");
    const rec = recOf(pane?.id);
    return rec?.el?.isConnected ? rec.el : null;
  }

  /** The editor's list (and its chooser), drawn unless it is already on screen. */
  async function editorList(ed, selector) {
    if (ed.sheet() || !ed.el.querySelector(selector)) ed.showList();
    return waitFor(() => ed.el.querySelector(selector));
  }

  const host = {
    view: "desk",
    canKeep: api.canKeep,

    begin() {
      const mine = api.getLayout();
      const { layout: base, paneId } = withSheetsPane(originalLayout(mine.place));
      if (!paneId) return false;
      state = { mine, paneId };
      api.closeMenus();
      api.freeze(true);
      api.setLayout(base);
      tourEditor();
      return true;
    },

    // The pane's own editor; it is never made here, so `onMade` isn't called.
    editor: () => tourEditor(),

    async showList() {
      const ed = tourEditor();
      if (!ed) return null;
      const head = await editorList(ed, ".desk-sheet__list-head");
      if (!head) return paneCard();
      const fresh = head.querySelector("button");
      return { el: head, side: "left", marks: fresh ? [fresh] : [] };
    },

    async openChooser() {
      const ed = tourEditor();
      if (!ed) return null;
      const chooser = await editorList(ed, ".desk-sheet__templates");
      if (!chooser) return paneCard();
      if (chooser.hidden) chooser.toggle();
      return {
        el: chooser,
        side: "left",
        marks: [chooser],
        undo: () => {
          if (chooser.isConnected && !chooser.hidden) chooser.toggle();
        },
      };
    },

    async verseMenu({ live, later, editor }) {
      useAsTarget(editor);
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
      const menu = live() ? currentPanel()?.el ?? null : null;
      if (!menu) return null;
      const add = addButton(menu);
      return { el: menu, side: "right", marks: add ? [add] : [] };
    },

    // The sheet header's "Print or share…" or "Present…".
    control(ed, which) {
      const start = which === "present" ? "Present" : "Print";
      const link = Array.from(ed.el.querySelectorAll(".desk-sheet__top a")).find((a) => a.textContent.trim().startsWith(start));
      return link ? { el: link, side: "left", marks: [link] } : null;
    },

    passage: () => api.litPassage(),
    where: paneCard,

    finish() {
      const { mine, paneId } = state;
      try {
        recOf(paneId)?.inst?.editor?.endExample();
        api.setLayout(mine);
      } finally {
        api.freeze(false);
        state = null;
      }
      recOf(paneId)?.inst?.editor?.endExample();
    },

    // Where focus was went with the tour's layout (the list's link, in a pane
    // that layout didn't keep): the first Sheets pane's name instead.
    returnFallback() {
      const all = panes(api.getLayout().root);
      return recOf((all.find((p) => p.kind === "sheet") ?? all[0])?.id)?.kindButton ?? null;
    },

    /**
     * Beside the Sheets pane, its foot level with the pane's: to the left where
     * there is room, else to the right, else over the pane under its header,
     * centered. Level with the pane's top it covered the next pane's header,
     * its lock and × (E73).
     */
    placeOffer(w) {
      const p = sheetsPane()?.getBoundingClientRect();
      if (!p) return;
      const GAP = 12;
      const EDGE = 8;
      const width = Math.min(300, innerWidth - 2 * EDGE);
      w.style.width = `${width}px`; // first, since its height follows from it
      const foot = Math.min(innerHeight, p.bottom) - GAP;
      w.style.top = `${Math.max(EDGE, p.top + 56, foot - w.offsetHeight)}px`;
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
    },

    // Unlike the Study Desk tour's, made at load, this offer can come while the
    // reader works (a Sheets pane just added, a sheet's title being typed).
    working() {
      const at = document.activeElement;
      return at instanceof HTMLElement && at !== document.body &&
        (at.isContentEditable || at.matches("input, textarea, select") || Boolean(at.closest(".desk-pane")));
    },

    canOffer: () => Boolean(sheetsPane()),
    otherOffer: () => api.otherOffer(),
  };

  return createSheetTour({ host });
}
