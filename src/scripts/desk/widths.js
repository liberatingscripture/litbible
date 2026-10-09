// src/scripts/desk/widths.js
//
// Widths the reader can drag (BVJ, 2026-10-08; "Decisions", the Greek tab,
// item 13, with the recommended details): on a Study View chapter with the
// notebook open in the margin, two handles trade width between neighbours,
// one between the notes' margin and the LIT, one between the LIT and the
// notebook. src/lib/desk-margin.mjs holds the rules (placeWithWidths and the
// two drags); margin.js asks this module where things go and places them.
//
// Nothing shows between the columns at rest (BVJ: a line there distracts).
// The pointer in a gap gets the resize cursor and a small grip beside it,
// and a hairline shows only while dragging. Each handle is a focusable
// separator the arrow keys move a character at a time (the ARIA
// window-splitter pattern), so it isn't mouse-only.
//
// What is kept is the LIT's measure and the notebook's width, in
// sessionStorage (lit-desk-measure, lit-desk-width), so every page and reload
// in this tab keeps them and the next visit starts from the defaults (BVJ:
// "the widths last for the visit"). Layout.astro's pre-paint script stamps
// them on <html> (data-desk-widths, --desk-measure, --desk-width) before the
// page first paints, and global.css sets the column from them, so a page
// opening with them never jumps. Where the window is too narrow for them,
// placeWithWidths gives way in order and this writes what fits over the
// stamped values, keeping what the reader chose for a wider window.
// "Reset widths" forgets them.

import {
  MIN_MEASURE,
  MIN_WIDTH,
  dragNotebookEdge,
  dragTextEdge,
  placeWithWidths,
  widestMeasure,
  widthsFromLayout,
} from "../../lib/desk-margin.mjs";
import { keepReadingPlace } from "../keep-reading-place.js";

const MEASURE_KEY = "lit-desk-measure";
const WIDTH_KEY = "lit-desk-width";
/** Sent when the kept widths change or are forgotten. */
export const WIDTHS_EVENT = "desk:widths";

/** The widths kept for this visit, or null. */
export function keptWidths() {
  try {
    const measure = parseFloat(sessionStorage.getItem(MEASURE_KEY));
    const width = parseFloat(sessionStorage.getItem(WIDTH_KEY));
    if (Number.isFinite(measure) && Number.isFinite(width)) return { measure, width };
  } catch (_) {}
  return null;
}

function keep({ measure, width }) {
  try {
    sessionStorage.setItem(MEASURE_KEY, String(measure));
    sessionStorage.setItem(WIDTH_KEY, String(width));
  } catch (_) {}
}

/** Forget the reader's widths: the page goes back to the defaults. */
export function resetWidths() {
  try {
    sessionStorage.removeItem(MEASURE_KEY);
    sessionStorage.removeItem(WIDTH_KEY);
  } catch (_) {}
  document.dispatchEvent(new CustomEvent(WIDTHS_EVENT, { detail: { kept: false } }));
}

/**
 * A "Reset widths" button that shows only while widths are kept. `className`
 * is the host's own button style (the panel's foot, the Display tray).
 */
export function resetWidthsButton(className) {
  const b = document.createElement("button");
  b.type = "button";
  b.className = className;
  b.textContent = "Reset widths";
  const sync = () => {
    b.hidden = !keptWidths();
  };
  sync();
  document.addEventListener(WIDTHS_EVENT, sync);
  b.addEventListener("click", () => keepReadingPlace(resetWidths));
  return b;
}

/**
 * @param {{ column: HTMLElement, panel: HTMLElement, onChange: () => void }} options
 *   `column` is Study View's column (.scripture-main), `panel` the Notebook
 *   panel, and `onChange` places everything again (margin.js).
 */
export function createWidths({ column, panel, onChange }) {
  const root = document.documentElement;

  // One --ch at the column's text size, measured rather than computed, since
  // --ch is an em fraction per font (global.css).
  const probe = document.createElement("span");
  probe.setAttribute("aria-hidden", "true");
  probe.style.cssText =
    "position:absolute;visibility:hidden;pointer-events:none;height:0;overflow:hidden;width:calc(100 * var(--ch))";
  column.append(probe);
  const measures = () => {
    const cs = getComputedStyle(column);
    const parent = column.parentElement;
    const ps = getComputedStyle(parent);
    return {
      viewport: root.clientWidth,
      parentLeft: parent.getBoundingClientRect().left + parseFloat(ps.paddingLeft || "0"),
      ch: probe.getBoundingClientRect().width / 100 || 10,
      pad: parseFloat(cs.paddingLeft || "0") + parseFloat(cs.paddingRight || "0"),
    };
  };

  /** Where everything goes with the kept widths, or null with none kept. */
  function layout() {
    const kept = keptWidths();
    return kept ? placeWithWidths({ ...measures(), ...kept }) : null;
  }

  /** Put a placement's widths on the page (what fits, which may be less than what's kept). */
  function apply(lay) {
    root.setAttribute("data-desk-widths", "");
    root.style.setProperty("--desk-measure", String(lay.measure));
    root.style.setProperty("--desk-width", `${lay.width}px`);
  }

  function clear() {
    if (!root.hasAttribute("data-desk-widths")) return;
    root.removeAttribute("data-desk-widths");
    root.style.removeProperty("--desk-measure");
    root.style.removeProperty("--desk-width");
  }

  /* ── The handles ─────────────────────────────────────────────────── */

  const gutters = document.createElement("div");
  gutters.className = "desk-gutters";
  gutters.hidden = true;
  gutters.setAttribute("data-desk-dock", "");
  const textEdge = handle("text", "Resize the text and your notes’ margin");
  const bookEdge = handle("book", "Resize the text and the notebook");
  gutters.append(textEdge, bookEdge);
  document.body.append(gutters);

  function handle(which, label) {
    const h = document.createElement("div");
    h.className = `desk-gutter desk-gutter--${which}`;
    h.setAttribute("role", "separator");
    h.setAttribute("aria-orientation", "vertical");
    h.setAttribute("aria-label", label);
    h.tabIndex = 0;
    h.innerHTML = `<span class="desk-gutter__line" aria-hidden="true"></span><span class="desk-gutter__grip" aria-hidden="true"></span>`;
    return h;
  }

  // The widths a drag or a key starts from: the kept ones, or the page as it
  // stands.
  function startingWidths() {
    const kept = keptWidths();
    if (kept) {
      const lay = layout();
      return lay && !lay.over ? { measure: lay.measure, width: lay.width } : kept;
    }
    const measure = parseFloat(getComputedStyle(root).getPropertyValue("--reading-measure")) || 48;
    return widthsFromLayout({ viewport: root.clientWidth, measure, panelLeft: panel.getBoundingClientRect().left });
  }

  function next(which, start, dx) {
    const m = measures();
    if (which === "text") {
      const maxMeasure = widestMeasure({ ...m, width: start.width });
      return { measure: dragTextEdge({ measure: start.measure, dx, ch: m.ch, maxMeasure }), width: start.width };
    }
    return dragNotebookEdge({ measure: start.measure, width: start.width, dx, ch: m.ch });
  }

  let frame = 0;
  function set(widths) {
    keep(widths);
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      keepReadingPlace(onChange);
      document.dispatchEvent(new CustomEvent(WIDTHS_EVENT, { detail: { kept: true } }));
    });
  }

  for (const h of [textEdge, bookEdge]) {
    const which = h === textEdge ? "text" : "book";

    // The grip sits beside the pointer, at its height.
    h.addEventListener("pointermove", (e) => {
      h.style.setProperty("--grip-y", `${e.clientY - h.getBoundingClientRect().top}px`);
    });
    h.addEventListener("focus", () => {
      const box = h.getBoundingClientRect();
      const mid = (Math.max(0, box.top) + Math.min(window.innerHeight, box.bottom)) / 2;
      h.style.setProperty("--grip-y", `${mid - box.top}px`);
    });

    h.addEventListener("pointerdown", (e) => {
      if (e.button !== 0) return;
      e.preventDefault(); // no text selection
      const start = startingWidths();
      const x0 = e.clientX;
      try {
        h.setPointerCapture(e.pointerId);
      } catch (_) {
        /* a synthetic event has no live pointer */
      }
      h.classList.add("desk-gutter--dragging");
      const move = (ev) => set(next(which, start, ev.clientX - x0));
      const end = () => {
        h.removeEventListener("pointermove", move);
        h.removeEventListener("pointerup", end);
        h.removeEventListener("pointercancel", end);
        h.classList.remove("desk-gutter--dragging");
      };
      h.addEventListener("pointermove", move);
      h.addEventListener("pointerup", end);
      h.addEventListener("pointercancel", end);
    });

    // A character at a time with the arrow keys, ten with Shift.
    h.addEventListener("keydown", (e) => {
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      e.preventDefault();
      const { ch } = measures();
      const step = (e.shiftKey ? 10 : 1) * ch * (e.key === "ArrowLeft" ? -1 : 1);
      set(next(which, startingWidths(), step));
    });
  }

  /**
   * Show the handles in the gaps, over the reading area (the rail's run):
   * `column` is the column's box in the window, `panelLeft` the notebook's
   * left edge.
   */
  function placeHandles({ top, height, column: col, panelLeft }) {
    gutters.hidden = false;
    gutters.style.top = `${top}px`;
    gutters.style.height = `${Math.max(0, height)}px`;
    const sx = window.scrollX;
    // Between the margin notes, which end 8px left of the column's box, and
    // the text, which starts 16px inside it.
    textEdge.style.left = `${col.left + sx - 6}px`;
    textEdge.style.width = "18px";
    // From just inside the column's padding to the notebook.
    bookEdge.style.left = `${col.right + sx - 6}px`;
    bookEdge.style.width = `${Math.max(12, panelLeft - col.right + 6)}px`;

    const m = measures();
    const now = keptWidths() ? layout() : null;
    const measure =
      now && !now.over
        ? now.measure
        : parseFloat(getComputedStyle(root).getPropertyValue("--reading-measure")) || 48;
    const width = Math.round(now && !now.over ? now.width : root.clientWidth - 16 - panelLeft);
    const widest = widestMeasure({ ...m, width });
    textEdge.setAttribute("aria-valuemin", String(MIN_MEASURE));
    textEdge.setAttribute("aria-valuemax", String(Math.max(MIN_MEASURE, Math.floor(widest))));
    textEdge.setAttribute("aria-valuenow", String(Math.round(measure)));
    textEdge.setAttribute("aria-valuetext", `Text ${Math.round(measure)} characters wide`);
    bookEdge.setAttribute("aria-valuemin", String(MIN_WIDTH));
    bookEdge.setAttribute("aria-valuemax", String(Math.round(width + (measure - MIN_MEASURE) * m.ch)));
    bookEdge.setAttribute("aria-valuenow", String(width));
    bookEdge.setAttribute("aria-valuetext", `Notebook ${width} pixels wide`);
  }

  function hideHandles() {
    gutters.hidden = true;
  }

  return { layout, apply, clear, placeHandles, hideHandles };
}
