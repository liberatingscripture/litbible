// src/scripts/desk/tour-runner.js
//
// What the tours share (E24, BVJ 2026-11-02): the card, the way through its
// steps, where it sits beside what a step points at, and how a tour ends. The
// notebook tour (tour.js, on a chapter page), the Study Desk tour
// (desk-tour.js, on /desk) and the Sheets tour (sheets/sheet-tour.js, on /desk
// too; E63) each bring their own steps and their own acts; this does not know
// what any of them opens.
//
// A step's `act(step)` opens whatever the step shows and returns where its card
// goes: `{ el, side?, marks? }`, or null for a card in the middle. `el` places
// the card; `marks` are outlined (default: `el`, when small). What a step opens
// is undone by a function it hands to `later`, which runs before the next step
// and at the end. The tour ends by calling `finish`, where the caller puts its
// own page back, then the scroll goes back and focus returns.
//
// While a tour runs `data-desk-tour` is on <html>, so `saveLastRead` records
// nothing; it comes off 900ms after the end, past last-read.js's wait after a
// scroll, so the scroll back records nothing either (BA36).
//
// Keyboard and screen readers: each card is a non-modal dialog that takes
// focus, Back / Next / Done, "Skip this part" and "Skip the tour" are real
// buttons, Escape ends the tour, and focus goes back to where the reader was.
// Reduced motion is respected. The card is part of the desk's frame
// (data-desk-dock), so clicks in it don't close a floating panel and the
// single-key shortcuts stand down while focus is in it.

import { stepBody } from "../../lib/desk-first-use.mjs";

const GAP = 12;
const EDGE = 12;

const reduced = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const frame = () => new Promise((r) => requestAnimationFrame(() => r()));

/**
 * Waits for `find()` to return something, up to `ms`, polling each frame:
 * for a step whose target is drawn a moment after it acts (a template chooser,
 * a list read from the notebook, a passage's blanks). Both /desk tours use it.
 */
export const waitFor = (find, ms = 2000) =>
  new Promise((resolve) => {
    const end = performance.now() + ms;
    const tick = () => {
      const got = find();
      if (got || performance.now() > end) resolve(got ?? null);
      else requestAnimationFrame(tick);
    };
    tick();
  });

export function createTourRunner() {
  let run = null;

  /**
   * @param {{ steps: object[], view?: string | null,
   *   act: (step: object) => Promise<object | null>,
   *   finish?: () => void, afterUndo?: () => void,
   *   more?: (step: object) => ({ href: string, text: string, external?: boolean } | null),
   *   returnTo?: HTMLElement | null, returnFallback?: () => (HTMLElement | null) }} options
   *   `steps` is a planned tour (`planTour`). `view` picks a step's wording.
   *   `afterUndo` runs after each step's `later` functions. `more` gives a
   *   step's link under its words, if it has one.
   *   `returnFallback` names where focus goes at the end when `returnTo` is
   *   gone or hidden by then (a button in a window the tour closed, or in a
   *   panel it folded away), so focus never drops to the page (LV3-4).
   */
  function start({ steps, view = null, act, finish = () => {}, afterUndo = () => {}, more = () => null, returnTo = null, returnFallback = null }) {
    if (run || !steps.length) return false;
    document.documentElement.setAttribute("data-desk-tour", "");

    run = {
      steps,
      view,
      act,
      finish,
      afterUndo,
      more,
      index: 0,
      // Nothing focused (a tour started by its address) is `body`, which is no
      // place to return to: the fallback takes over then (Audit 7, TR7-9).
      returnTo: returnTo ?? (document.activeElement instanceof HTMLElement && document.activeElement !== document.body ? document.activeElement : null),
      returnFallback,
      scroll: { x: window.scrollX, y: window.scrollY },
      undo: [],
      card: null,
      marked: [],
      token: 0,
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
      <p class="desk-tour__more" hidden><a></a></p>
      <div class="desk-tour__row">
        <span class="desk-tour__skips">
          <button type="button" class="desk-tour__skip">Skip the tour</button>
          <button type="button" class="desk-tour__skip desk-tour__skip-part">Skip this part</button>
        </span>
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
    card.querySelector(".desk-tour__skip-part").addEventListener("click", () => {
      const next = run.steps[run.index].nextPart;
      if (next === null) end();
      else go(next);
    });
    card.querySelector(".desk-tour__back").addEventListener("click", () => go(run.index - 1));
    card.querySelector(".desk-tour__next").addEventListener("click", () => {
      if (run.index === run.steps.length - 1) end();
      else go(run.index + 1);
    });
    document.addEventListener("keydown", onKey, true);
    window.addEventListener("resize", queuePlace);
    window.addEventListener("scroll", queuePlace, { passive: true });
    go(0);
    return true;
  }

  function onKey(e) {
    if (e.key !== "Escape" || !run) return;
    e.preventDefault();
    e.stopPropagation();
    end();
  }

  // What a step opened, to undo before the next step and at the end.
  function later(fn) {
    run?.undo.push(fn);
  }

  function undoStep() {
    if (!run) return;
    unmark();
    const fns = run.undo.splice(0).reverse();
    for (const fn of fns) {
      try {
        fn();
      } catch (_) {}
    }
    run.afterUndo();
  }

  function end() {
    if (!run) return;
    const { card, returnTo, returnFallback, scroll, finish } = run;
    run.token++;
    document.removeEventListener("keydown", onKey, true);
    window.removeEventListener("resize", queuePlace);
    window.removeEventListener("scroll", queuePlace);
    cancelAnimationFrame(run.placeFrame);
    undoStep();
    card.remove();
    run = null;
    // Everything back as the tour found it: the caller's page first (the
    // Notebook's width can move the text), then the place on the page, then
    // focus.
    try {
      finish();
    } catch (err) {
      console.error("Study Desk: the tour couldn’t put the page back", err);
    }
    requestAnimationFrame(() => {
      window.scrollTo({ left: scroll.x, top: scroll.y, behavior: "instant" });
      // Back to where the reader was if that is still showing, else the
      // tour's own fallback: the card is gone, and focus on it would drop to
      // the page's body (LV3-4).
      const showing = (el) =>
        el instanceof HTMLElement && el.isConnected && el.getClientRects().length > 0 && getComputedStyle(el).visibility !== "hidden";
      let back = showing(returnTo) ? returnTo : null;
      if (!back) {
        try {
          const fallback = returnFallback?.() ?? null;
          back = showing(fallback) ? fallback : null;
        } catch (_) {}
      }
      back?.focus({ preventScroll: true });
      // Held past last-read.js's 500ms wait after a scroll, so the scroll
      // back records nothing, not even a new time on the same verse. A tour
      // started again meanwhile keeps it (BA36).
      setTimeout(() => {
        if (!run) document.documentElement.removeAttribute("data-desk-tour");
      }, 900);
    });
  }

  /* ── One step ─────────────────────────────────────────────────── */

  async function go(i) {
    const step = run.steps[Math.max(0, Math.min(i, run.steps.length - 1))];
    run.index = run.steps.indexOf(step);
    const token = ++run.token;
    undoStep();

    const card = run.card;
    card.querySelector(".desk-tour__count").textContent = `${step.partName} · Step ${step.number} of ${step.of}`;
    card.querySelector(".desk-tour__title").textContent = step.title;
    card.querySelector(".desk-tour__body").textContent = stepBody(step, run.view);
    const extra = run.more(step);
    const moreEl = card.querySelector(".desk-tour__more");
    moreEl.hidden = !extra;
    if (extra) {
      const a = moreEl.querySelector("a");
      a.href = extra.href;
      a.textContent = extra.text;
      if (extra.external) {
        a.target = "_blank";
        a.rel = "noopener noreferrer";
      } else {
        a.removeAttribute("target");
        a.removeAttribute("rel");
      }
    }
    card.querySelector(".desk-tour__back").hidden = run.index === 0;
    card.querySelector(".desk-tour__skip-part").hidden = step.nextPart === null;
    card.querySelector(".desk-tour__next").textContent = run.index === run.steps.length - 1 ? "Done" : "Next";

    let target = null;
    try {
      target = (await run.act(step)) ?? null;
    } catch (err) {
      console.error("Study Desk: a tour step couldn't show itself", err);
    }
    // The reader moved on while this step was opening.
    if (!run || token !== run.token) return;
    // The page may still be settling (a panel opening reflows a chapter), so
    // the target is placed after a frame.
    await frame();
    if (!run || token !== run.token) return;
    if (target?.el) {
      const r = target.el.getBoundingClientRect();
      // A small target scrolled out of sight is brought into view first.
      if (r.height < window.innerHeight * 0.5 && (r.bottom < 0 || r.top > window.innerHeight)) {
        target.el.scrollIntoView({ block: "center", behavior: reduced() ? "auto" : "smooth" });
      }
      const marks = target.marks ?? (r.height < window.innerHeight * 0.5 ? [target.el] : []);
      mark(marks);
    }
    run.target = target;
    place();
    card.classList.add("desk-tour--on");
    card.focus({ preventScroll: true });
  }

  function mark(els) {
    run.marked = els.filter(Boolean);
    for (const e of run.marked) e.classList.add("desk-tour-target");
  }

  function unmark() {
    for (const e of run?.marked ?? []) e.classList.remove("desk-tour-target");
    if (run) run.marked = [];
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

  return { start, end, later, running: () => Boolean(run) };
}
