// src/scripts/desk/desk-tour.js
//
// The Study Desk tour (STUDY-DESK-FIXES.md E24; BVJ, 2026-11-02): a tour of /desk
// itself, apart from the notebook tour (tour.js), which stays on the chapter
// pages. Nine cards in two parts (what is on the desk, then changing it), run
// by the same card as the notebook's (tour-runner.js), each beside the thing it
// is about and each showing it working.
//
// **It leaves nothing behind, and writes nothing while it runs** (BVJ, 2026-11-02:
// "make sure everything is in the default layout, then begin the
// demonstration. At the end of the tour, it should put everything back the way
// it found it"). It starts by putting the desk in its original layout and ends
// by putting the reader's own back, and in between every change it makes is
// the page's own `commit`, so panes are really added, locked and rearranged
// on screen. What keeps that from reaching storage is `freeze(true)`: desk-page.js
// writes neither the last layout nor the default while it is on, so a reload or
// a closed tab mid-tour leaves `lit-desk-layout` exactly as it was (BA33's
// trap, which the notebook tour avoids by opening things with `remember:
// false`). Nothing else is written either: the steps press no record-keeping
// control, and `data-desk-tour` keeps Continue reading and a moving bookmark
// from recording the places it passes.
//
// The tour is started by the reader: "Take the tour" in the page's title menu,
// `?desk-tour` on /desk's address (the help page links to it), or "Take the
// tour now" in the offer. The offer is a window (float-window.js, as the
// notebook's) the first time /desk opens; "Remind me later", the ×, Escape, or
// leaving all mean the same, and leave a quiet line at the top of the title
// menu (`lineWanted`) until the tour is taken or the reader says "Not now."
// "Don't show this again" is `never`, which also ends the offers of new steps.
//
// "Seen" is its own list, `lit-desk-page-tour` (first-use.js), in the notebook
// tour's shape, so finishing one tour says nothing about the other.
//
// /desk has a second tour, the Sheets tour (sheets/sheet-tour.js, E63), with a
// runner of its own, so each refuses to start while any tour is running
// (`data-desk-tour` on <html>; Audit 7, TR7-6), and either one starting takes
// the other's offer down. The Sheets card's link opens that tour (TR7-5).

import {
  DESK_TOUR_PARTS, DESK_TOUR_STEPS, SHEET_TOUR_LINK, TOUR_LINK, localDay, parseTourState, planTour,
  tourOffer, withLater, withNever, withOffered, withSeen,
} from "../../lib/desk-first-use.mjs";
import { addPane, addPaneNeeds, applyArrangement, arrangementOf, isFollower, needs, originalLayout, panes, setActive, setKind } from "../../lib/desk-layout.mjs";
import { createFloatWindow } from "../float-window.js";
import { getDeskTourRaw, saveDeskTourList } from "./first-use.js";
import { createTourRunner, waitFor } from "./tour-runner.js";

// The arrangements the Layout step tries, best demonstration first: more than
// two panes, so it shows the window doing something the Add pane step didn't.
const DEMO_ARRANGEMENTS = ["one-left-two", "two-one-right", "cols-3", "one-over-two", "rows-2", "cols-2"];

const el = (tag, className, text) => {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (text !== undefined) e.textContent = text;
  return e;
};
const today = () => localDay(new Date());
/** Whether a tour is running on this page, this one or the Sheets tour (the runner sets it). */
const touring = () => document.documentElement.hasAttribute("data-desk-tour");
/** A card's link to another tour: My Notes' to the notebook tour, Sheets' to the Sheets tour. */
const MORE_LINKS = { mine: TOUR_LINK, sheets: SHEET_TOUR_LINK };

/**
 * @param {{ canKeep: boolean, getLayout: () => object, setLayout: (next: object) => void,
 *   freeze: (on: boolean) => void, paneEls: Map<string, object>, panesBox: HTMLElement,
 *   titleButton: HTMLElement, titleMenu: HTMLElement, addFly: HTMLElement,
 *   openTitleMenu: () => void, closeTitleMenu: (o?: object) => void, showAddKinds: (direction: string) => void,
 *   newSheet: () => string | null,
 *   layoutMenu: HTMLElement, openLayoutMenu: () => void, closeLayoutMenu: (o?: object) => void,
 *   refreshLayoutMenu: () => void, shapeButtons: HTMLElement[],
 *   onLineChange?: () => void }} api
 *   The page's own pieces, so the tour acts through the same code a reader's
 *   clicks do. `setLayout` is the page's `commit`; `freeze` stops its saving.
 */
export function createDeskTour(api) {
  const runner = createTourRunner();
  let state = null; // { mine: the reader's layout, base: the original layout the tour runs on }

  const room = () => api.panesBox.getBoundingClientRect();
  const paneOf = (kind, layout = api.getLayout()) => panes(layout.root).find((p) => p.kind === kind);
  const later = (fn) => runner.later(fn);
  // Back to the tour's own starting layout, undoing a step.
  const toBase = () => api.setLayout(state.base);

  /* ── What the steps do ────────────────────────────────────────── */

  const STEPS = {
    async panes() {
      // The cards sit beside a name, not a whole header, which in a narrow
      // window is wider than half the screen and would send the card aside.
      const names = Array.from(api.panesBox.querySelectorAll(".desk-pane__kind"));
      return names.length ? { el: names[0], marks: names } : null;
    },

    async mine() {
      const rec = api.paneEls.get(paneOf("mine")?.id);
      return rec ? { el: rec.kindButton, marks: [rec.kindButton] } : null;
    },

    // A second LIT pane, so the badge the words name is on the screen.
    async sync() {
      const layout = api.getLayout();
      const before = new Set(panes(layout.root).map((p) => p.id));
      const { width, height } = room();
      const next = addPane(layout, "column", "lit", width, height);
      if (next !== layout) {
        api.setLayout(next);
        const made = panes(next.root).find((p) => !before.has(p.id));
        if (made) api.setLayout(setActive(api.getLayout(), made.id));
        later(toBase);
      }
      const now = api.getLayout();
      const rec = api.paneEls.get(now.active);
      if (!rec) return null;
      return { el: rec.lead.hidden ? rec.kindButton : rec.lead, marks: rec.lead.hidden ? [] : [rec.lead] };
    },

    // The lock pressed, as a reader would press it, on the first pane that follows.
    async stay() {
      const pane = panes(api.getLayout().root).find((p) => isFollower(p.kind));
      const rec = api.paneEls.get(pane?.id);
      if (!rec || rec.pin.hidden) return null;
      rec.pin.click();
      later(toBase);
      return { el: rec.pin, marks: [rec.pin] };
    },

    // A Sheets pane shown (E59): a column where there is room, else the first
    // pane that isn't the LIT turned to Sheets for the step. Its list is empty
    // or the reader's own; nothing is opened or made.
    async sheets() {
      const layout = api.getLayout();
      const { width, height } = room();
      const before = new Set(panes(layout.root).map((p) => p.id));
      let next = addPane(layout, "column", "sheet", width, height);
      let id = next !== layout ? panes(next.root).find((p) => !before.has(p.id))?.id : null;
      if (!id) {
        const give = panes(layout.root).find((p) => p.kind !== "lit") ?? panes(layout.root)[0];
        next = setKind(layout, give.id, "sheet");
        id = give.id;
      }
      if (next !== layout) {
        api.setLayout(next);
        later(toBase);
      }
      const rec = api.paneEls.get(id);
      return rec ? { el: rec.kindButton, marks: [rec.kindButton] } : null;
    },

    async title() {
      api.openTitleMenu();
      later(() => api.closeTitleMenu({ focus: false }));
      return { el: api.titleMenu, side: "right", marks: [api.titleMenu] };
    },

    // The flyout at its second step, and a Footnotes pane added behind it.
    async add() {
      api.openTitleMenu();
      api.showAddKinds("column");
      later(() => {
        api.closeTitleMenu({ focus: false });
        toBase();
      });
      const { width, height } = room();
      const next = addPane(api.getLayout(), "column", "footnotes", width, height);
      if (next !== api.getLayout()) api.setLayout(next);
      // Below the flyout, so the card leaves the menu it hangs from in view.
      return { el: api.addFly, marks: [api.addFly] };
    },

    // "New sheet…" done as the menu does it (E59): a Sheets pane added and its
    // template chooser opened, the card beside the chooser. Choosing nothing,
    // the step makes nothing; undoing it takes the pane away, chooser and all.
    async newsheet() {
      const paneId = api.newSheet();
      later(toBase);
      const rec = paneId ? api.paneEls.get(paneId) : null;
      if (!rec) return null;
      const chooser = await waitFor(() => {
        const box = rec.el.querySelector(".desk-sheet__templates");
        return box && !box.hidden ? box : null;
      });
      return chooser ? { el: chooser, marks: [chooser] } : { el: rec.kindButton, marks: [rec.kindButton] };
    },

    // The Layout window, and the first arrangement that fits applied.
    async layout() {
      api.openLayoutMenu();
      later(() => {
        api.closeLayoutMenu({ focus: false });
        toBase();
      });
      const { width, height } = room();
      const layout = api.getLayout();
      const pick = DEMO_ARRANGEMENTS.find((id) => id !== arrangementOf(layout) && !needs(id, width, height));
      let marks = [api.layoutMenu];
      if (pick) {
        api.setLayout(applyArrangement(layout, pick));
        api.refreshLayoutMenu();
        marks = [api.shapeButtons.find((b) => b.dataset.arrangement === pick)].filter(Boolean);
      }
      return { el: api.layoutMenu, side: "right", marks };
    },
  };

  // Whether a step can be shown on the layout the tour starts from.
  function available(base) {
    const ids = new Set(DESK_TOUR_STEPS.map((s) => s.id));
    const { width, height } = room();
    if (!panes(base.root).some((p) => isFollower(p.kind))) ids.delete("stay");
    if (addPaneNeeds(base, "column", width, height)) ids.delete("add");
    // "Reading in sync" shows the second LIT pane's flag, so it needs the column
    // that pane is added in; its card says two panes are open "as here" (DK8-3).
    if (addPaneNeeds(base, "column", width, height)) ids.delete("sync");
    // New sheet… needs room for a Sheets pane, a column or a row.
    if (addPaneNeeds(base, "column", width, height) && addPaneNeeds(base, "row", width, height)) ids.delete("newsheet");
    return ids;
  }

  /* ── Starting and ending ──────────────────────────────────────── */

  function start({ only = null } = {}) {
    // Not over the Sheets tour, whose run this runner doesn't know (TR7-6).
    if (runner.running() || touring()) return;
    offerWin.close("take");
    const mine = api.getLayout();
    const base = originalLayout(mine.place);
    const steps = planTour({
      available: available(base), only, canKeep: api.canKeep, steps: DESK_TOUR_STEPS, parts: DESK_TOUR_PARTS,
    });
    if (!steps.length) return;

    // Seen from the moment it starts, so ending early is the same as ending.
    saveDeskTourList(withSeen(parseTourState(getDeskTourRaw(), DESK_TOUR_STEPS).list, DESK_TOUR_STEPS.map((s) => s.id)));
    api.onLineChange?.();
    state = { mine, base };
    api.closeTitleMenu({ focus: false });
    api.closeLayoutMenu({ focus: false });
    api.freeze(true);
    api.setLayout(base);
    runner.start({
      steps,
      act: (step) => STEPS[step.id]?.() ?? null,
      more: (step) => (step.more && MORE_LINKS[step.id] ? { href: MORE_LINKS[step.id], text: step.more, external: true } : null),
      returnTo: api.titleButton,
      // The reader's own layout back, then saving on again.
      finish: () => {
        try {
          api.setLayout(state.mine);
        } finally {
          api.freeze(false);
        }
      },
    });
  }

  /* ── The offer ────────────────────────────────────────────────── */

  const offerWin = createFloatWindow({
    heading: "Study Desk tour",
    title: "Take a short tour of the Study Desk?",
    className: "desk-offer",
    attrs: { "data-desk-dock": "" },
    place: placeOffer,
    onClose: () => {
      offer = null;
      api.onLineChange?.();
    },
  });
  const offerText = el("p", "desk-offer__lead");
  const offerRow = el("div", "desk-offer__row");
  const yes = el("button", "desk-offer__go", "Take the tour now");
  yes.type = "button";
  const later_ = el("button", "desk-offer__later", "Remind me later");
  later_.type = "button";
  const never = el("button", "desk-offer__never", "Don’t show this again");
  never.type = "button";
  offerRow.append(yes, later_);
  offerWin.body.append(offerText, offerRow, never);

  let offer = null; // { kind, ids } while the offer is up

  // A tour starting takes the offer down: the Sheets tour, from its link in a
  // Sheets pane, while this offer is still up. It was written as "later" when
  // it was shown, so it comes back on a later day as if put off.
  new MutationObserver(() => {
    if (offer && touring()) offerWin.close("tour");
  }).observe(document.documentElement, { attributes: true, attributeFilter: ["data-desk-tour"] });

  /** The offer is made when /desk has opened and nothing is in the way. */
  function maybeOffer() {
    if (offer || runner.running() || touring()) return;
    const o = tourOffer(getDeskTourRaw(), { today: today(), steps: DESK_TOUR_STEPS });
    if (!o.kind) return;
    // Until it's answered, an offer shown counts as "remind me later," so
    // leaving it, or going on to the next page, never brings it straight back.
    saveDeskTourList(withLater(o.list, today()));
    offer = o;
    offerWin.title.textContent = o.kind === "first" ? "Take a short tour of the Study Desk?" : "There’s something new in the tour.";
    offerText.textContent =
      o.kind === "first"
        ? "It takes a minute and shows you the panes, sheets, the title menu, and the layouts. Nothing it does is saved."
        : "Want a look at what’s new?";
    yes.textContent = o.kind === "first" ? "Take the tour now" : "Show me what’s new";
    offerWin.show();
    api.onLineChange?.();
  }

  /** Near the top right of the panes, out of the way of the title and its menus. */
  function placeOffer(w) {
    const GAP = 16;
    const width = Math.min(300, innerWidth - 2 * GAP);
    const top = Math.max(GAP, room().top + GAP);
    w.style.width = `${width}px`;
    w.style.left = `${innerWidth - width - GAP}px`;
    w.style.top = `${top}px`;
  }

  yes.addEventListener("click", () => {
    const o = offer;
    offerWin.close("take");
    const { list } = parseTourState(getDeskTourRaw(), DESK_TOUR_STEPS);
    saveDeskTourList(o?.kind === "new" ? withOffered(list, o.ids) : withOffered(list));
    start({ only: o?.kind === "new" ? o.ids : null });
  });
  later_.addEventListener("click", () => offerWin.close("later"));
  never.addEventListener("click", () => {
    saveDeskTourList(withNever(parseTourState(getDeskTourRaw(), DESK_TOUR_STEPS).list));
    offerWin.close("never");
  });

  /* ── The quiet line in the title menu ─────────────────────────── */

  /**
   * Whether the title menu carries its line: there is a tour to offer (never
   * taken, or with steps the reader hasn't seen), the reader hasn't said "Not
   * now" or "Don't show this again," and the offer isn't on the screen.
   */
  const lineWanted = () =>
    !offer && !runner.running() && Boolean(tourOffer(getDeskTourRaw(), { steps: DESK_TOUR_STEPS }).kind);

  /** "Not now": the same as "Don't show this again." */
  function declineLine() {
    saveDeskTourList(withNever(parseTourState(getDeskTourRaw(), DESK_TOUR_STEPS).list));
    api.onLineChange?.();
  }

  // `offering` is for the Sheets tour's offer, which waits while this one is up.
  return { start, maybeOffer, lineWanted, declineLine, running: runner.running, offering: () => Boolean(offer) };
}
