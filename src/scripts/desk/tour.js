// src/scripts/desk/tour.js
//
// The tour (STUDY-DESK.md D8; BVJ: "a tutorial sequence ... that runs on a
// user's first encounter and can be replayed later"). A short run of small
// cards, each beside the thing it is about on the page in front of the
// reader: the My Notebook row in the menus, the margin, the Notebook panel,
// the search box and where the notebook is kept.
//
// It never starts by itself. It starts when the reader asks: "Yes" on the
// quiet offer made right after the first-time choice (first-use.js), "Take
// the tour" at the panel's foot, the search box's `tour` command (a
// `lit:desk-command` event on `document`), or `?desk-tour` on a chapter's
// address, which the help page links to. Anywhere the reader is mid-reading
// it is therefore their own doing, never over scripture unasked (CLAUDE.md,
// "One announcement popover at a time", whose spirit this keeps; the tour is
// not an announcement and doesn't use that slot).
//
// It makes nothing real: every card is words about a control, and no step
// writes a record. Steps whose target isn't on this page are left out
// (tour.js decides that; desk-first-use.mjs numbers what remains). It opens
// the Notebook for its own steps and puts it back as it found it.
//
// Keyboard and screen readers: each card is a non-modal dialog that takes
// focus, Back / Next / Done and Skip are real buttons, Escape ends the tour,
// and focus goes back to where the reader was. Reduced motion is respected
// (the card doesn't animate in and the page jumps to a target instead of
// scrolling). The card is part of the desk's frame (data-desk-dock), so
// clicks in it don't close a floating panel and the single-key shortcuts
// stand down while focus is in it.
//
// "Seen" (localStorage['lit-desk-tour']) is the list of step ids; every step
// of a run is marked as the run starts, so closing early is the same as
// finishing, and a later phase that adds a step offers just that.

import { closePanel } from "../lit-panel.js";
import { readingSurface } from "../desk-frame.js";
import { WAYS_HREF, parseTourState, planTour, stepBody, withSeen, TOUR_STEPS } from "../../lib/desk-first-use.mjs";
import { COMMAND_EVENT, getTourRaw, saveTourList } from "./first-use.js";
import { pageChapter } from "./page.js";

const GAP = 12;
const EDGE = 12;

const reduced = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const visible = (e) => Boolean(e && e.getClientRects().length && e.getBoundingClientRect().width > 4);

/** "study" (a chapter), "read" (Read View) or "prose" (an article or the glossary). */
function viewOfPage() {
  if (document.querySelector("[data-rm-root]")) return "read";
  return pageChapter() ? "study" : "prose";
}

/**
 * @param {{ panel: { el: HTMLElement, open: Function, close: Function,
 *   isOpen: () => boolean, showTab: (id: string) => void } }} options
 */
export function createTour({ panel }) {
  let run = null;

  /* ── Where each step points ───────────────────────────────────── */

  const column = () => {
    const surface = readingSurface();
    return surface ? document.querySelector(surface.column[0]) : null;
  };

  const inView = (e) => {
    const r = e.getBoundingClientRect();
    return r.top >= 90 && r.bottom <= window.innerHeight - 40;
  };

  // A target, and which side its card prefers ("below" unless said).
  const TARGETS = {
    actions: () => {
      const number = Array.from(document.querySelectorAll("sup.vn")).find((e) => visible(e) && inView(e));
      return number ? { el: number } : column() && { el: column(), side: "right" };
    },
    margin: () => {
      if (!document.querySelector("aside.desk-notes")) return null;
      const note = Array.from(document.querySelectorAll("aside.desk-notes .desk-note")).find((e) => visible(e) && inView(e));
      return note ? { el: note, side: "left" } : column() && { el: column(), side: "right" };
    },
    panel: () => ({ el: panel.el, side: "left" }),
    search: () => {
      const input = document.getElementById("site-search-input");
      return visible(input) ? { el: input } : null;
    },
    kept: () => {
      const foot = panel.el.querySelector(".desk-home");
      return foot ? { el: foot, side: "left" } : { el: panel.el, side: "left" };
    },
  };

  const available = () => {
    const ids = new Set(["panel", "kept"]);
    for (const id of ["actions", "margin", "search"]) if (TARGETS[id]()) ids.add(id);
    return ids;
  };

  /* ── Starting and ending ──────────────────────────────────────── */

  function start({ only = null } = {}) {
    if (run) return;
    closePanel(); // a verse menu or note card open over the text would sit under the tour
    const steps = planTour({ available: available(), only });
    if (!steps.length) return;

    // Seen from the moment it starts, so ending early is the same as ending.
    saveTourList(withSeen(parseTourState(getTourRaw()).list, TOUR_STEPS.map((s) => s.id)));

    run = {
      steps,
      index: 0,
      returnTo: document.activeElement instanceof HTMLElement ? document.activeElement : null,
      panelWasOpen: panel.isOpen(),
      card: null,
      marked: null,
      frame: 0,
      placeFrame: 0,
      target: null,
    };
    const card = document.createElement("div");
    card.className = "desk-tour";
    card.setAttribute("role", "dialog");
    card.setAttribute("aria-modal", "false");
    card.setAttribute("data-desk-dock", "");
    card.tabIndex = -1;
    card.innerHTML = `
      <p class="desk-tour__count"></p>
      <h3 class="desk-tour__title" id="deskTourTitle"></h3>
      <p class="desk-tour__body" id="deskTourBody"></p>
      <p class="desk-tour__more" hidden><a href="${WAYS_HREF}">Ways to keep your notebook</a></p>
      <div class="desk-tour__row">
        <button type="button" class="desk-tour__skip">Skip the tour</button>
        <span class="desk-tour__nav">
          <button type="button" class="desk-tour__back">Back</button>
          <button type="button" class="desk-tour__next"></button>
        </span>
      </div>`;
    card.setAttribute("aria-labelledby", "deskTourTitle");
    card.setAttribute("aria-describedby", "deskTourBody");
    run.card = card;
    document.body.append(card);

    card.querySelector(".desk-tour__skip").addEventListener("click", () => end());
    card.querySelector(".desk-tour__back").addEventListener("click", () => go(run.index - 1));
    card.querySelector(".desk-tour__next").addEventListener("click", () => {
      if (run.index === run.steps.length - 1) end();
      else go(run.index + 1);
    });
    document.addEventListener("keydown", onKey, true);
    window.addEventListener("resize", queuePlace);
    window.addEventListener("scroll", queuePlace, { passive: true });
    go(0);
  }

  function onKey(e) {
    if (e.key !== "Escape" || !run) return;
    e.preventDefault();
    e.stopPropagation();
    end();
  }

  function end() {
    if (!run) return;
    const { card, returnTo, panelWasOpen } = run;
    document.removeEventListener("keydown", onKey, true);
    window.removeEventListener("resize", queuePlace);
    window.removeEventListener("scroll", queuePlace);
    cancelAnimationFrame(run.frame);
    cancelAnimationFrame(run.placeFrame);
    unmark();
    card.remove();
    run = null;
    // The Notebook goes back as the tour found it.
    if (!panelWasOpen && panel.isOpen()) panel.close();
    if (returnTo && returnTo.isConnected) returnTo.focus({ preventScroll: true });
  }

  /* ── One step ─────────────────────────────────────────────────── */

  function go(i) {
    const step = run.steps[Math.max(0, Math.min(i, run.steps.length - 1))];
    run.index = run.steps.indexOf(step);
    // The panel's own steps need it open, on My Notes.
    if (step.id === "panel" || step.id === "kept") {
      if (!panel.isOpen()) panel.open(null, { focus: false });
      panel.showTab("mine");
    }
    const card = run.card;
    card.querySelector(".desk-tour__count").textContent = `Step ${step.number} of ${step.of}`;
    card.querySelector(".desk-tour__title").textContent = step.title;
    card.querySelector(".desk-tour__body").textContent = stepBody(step, viewOfPage());
    card.querySelector(".desk-tour__more").hidden = step.id !== "kept";
    card.querySelector(".desk-tour__back").hidden = run.index === 0;
    card.querySelector(".desk-tour__next").textContent = run.index === run.steps.length - 1 ? "Done" : "Next";

    // The page may still be settling (the panel opening reflows a Study View
    // chapter), so the target is found after a frame.
    cancelAnimationFrame(run.frame);
    run.frame = requestAnimationFrame(() => {
      if (!run) return;
      const target = TARGETS[step.id]();
      unmark();
      if (target?.el) {
        const r = target.el.getBoundingClientRect();
        // A small target scrolled out of sight is brought into view first.
        if (r.height < window.innerHeight * 0.5 && (r.bottom < 0 || r.top > window.innerHeight)) {
          target.el.scrollIntoView({ block: "center", behavior: reduced() ? "auto" : "smooth" });
        }
        if (r.height < window.innerHeight * 0.5) mark(target.el);
      }
      run.target = target;
      place();
      card.classList.add("desk-tour--on");
      card.focus({ preventScroll: true });
    });
  }

  function mark(e) {
    run.marked = e;
    e.classList.add("desk-tour-target");
  }

  function unmark() {
    run?.marked?.classList.remove("desk-tour-target");
    if (run) run.marked = null;
  }

  /* ── Placing the card beside its target ───────────────────────── */

  function queuePlace() {
    if (!run) return;
    cancelAnimationFrame(run.placeFrame);
    run.placeFrame = requestAnimationFrame(place);
  }

  function place() {
    if (!run?.card) return;
    const card = run.card;
    const vw = document.documentElement.clientWidth;
    const vh = window.innerHeight;
    const cw = card.offsetWidth;
    const ch = card.offsetHeight;
    const clamp = (v, lo, hi) => Math.max(lo, Math.min(v, Math.max(lo, hi)));
    let x = (vw - cw) / 2;
    let y = (vh - ch) / 2;
    const t = run.target;
    if (t?.el?.isConnected) {
      const r = t.el.getBoundingClientRect();
      const tall = r.height > vh * 0.5 || r.width > vw * 0.5;
      const roomRight = vw - r.right;
      const roomLeft = r.left;
      const sideX = () => {
        const wantRight = t.side === "right" ? roomRight >= cw + GAP || roomRight >= roomLeft : t.side === "left" ? roomLeft < cw + GAP && roomRight > roomLeft : roomRight >= roomLeft;
        return wantRight ? r.right + GAP : r.left - cw - GAP;
      };
      if (tall || t.side) {
        x = clamp(sideX(), EDGE, vw - cw - EDGE);
        y = clamp(Math.max(r.top, 0) + 8, EDGE, vh - ch - EDGE);
      } else if (r.bottom + GAP + ch <= vh - EDGE) {
        x = clamp(r.left, EDGE, vw - cw - EDGE);
        y = r.bottom + GAP;
      } else if (r.top - GAP - ch >= EDGE) {
        x = clamp(r.left, EDGE, vw - cw - EDGE);
        y = r.top - GAP - ch;
      } else {
        x = clamp(sideX(), EDGE, vw - cw - EDGE);
        y = clamp(r.top, EDGE, vh - ch - EDGE);
      }
    }
    card.style.left = `${Math.round(x)}px`;
    card.style.top = `${Math.round(y)}px`;
  }

  /* ── The ways in ──────────────────────────────────────────────── */

  document.addEventListener(COMMAND_EVENT, (e) => {
    if (e.detail?.id !== "tour") return;
    start({ only: Array.isArray(e.detail.only) ? e.detail.only : null });
  });

  // `?desk-tour` on an address: take it off, and start once the page and the
  // panel have settled.
  try {
    const url = new URL(window.location.href);
    if (url.searchParams.has("desk-tour")) {
      url.searchParams.delete("desk-tour");
      history.replaceState(history.state, "", url.pathname + url.search + url.hash);
      const later = () => setTimeout(() => start(), 600);
      if (document.readyState === "complete") later();
      else window.addEventListener("load", later, { once: true });
    }
  } catch (_) {}

  return { start };
}
