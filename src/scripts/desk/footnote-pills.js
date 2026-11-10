// src/scripts/desk/footnote-pills.js
//
// Where a footnote's Pin (pins.js) sits in Chapter View's Footnotes list
// (STUDY-DESK-FIXES.md, E49; BVJ, 2026-11-06). The rule is
// src/lib/desk-footnote-pills.mjs (pure, unit-tested); this builds the pill's
// holder and applies the answer, the way margin.js does for the Notebook.
//
// Each footnote gets one `.desk-fn-pills` after its `.fn-body`, so reading
// order and tab order are the note, then its Pin, wherever Pin is drawn. The
// list carries `data-desk-fn-pills="row" | "inline"` (desk.css draws each):
//   row     Pin in the left margin, level with the footnote's first line;
//   inline  on the note's line, on its right, as before E49.
// A footnote with one of the reader's margin notes beside it (notes-margin.js
// sets `data-desk-fn-margin` on it) takes the inline placement, since a margin
// note sits in the same left margin. Moving between the two only moves Pin, so
// focus on it is never lost.
//
// Until 2026-11-10 "Add a note" sat beside Pin and a third mode folded the two
// behind one "⋯" button; notes on a footnote can no longer be added (BVJ,
// 2026-11-10; STUDY-DESK-FIXES.md, E79), and one pill has nothing to fold.
//
// Nothing here adds text to the scripture or to the footnote: Pin sits beside
// `.fn-body`, never in it.

import { footnotePillMode } from "../../lib/desk-footnote-pills.mjs";

const ATTR = "data-desk-fn-pills";

/**
 * The holder for one footnote's Pin.
 *
 * @param {HTMLElement} pin the footnote's Pin button
 * @returns {HTMLElement}
 */
export function footnotePills(pin) {
  const wrap = document.createElement("div");
  wrap.className = "desk-fn-pills";
  wrap.append(pin);
  return wrap;
}

/**
 * Measure the Footnotes list and keep its mode current, on load and whenever
 * the margin could have changed: a resize, the column moving for the Notebook
 * (`desk:column-moved`), the Display tray's text width, size and face, and the
 * list itself resizing.
 *
 * @param {Element | null} list the `ol.footnotes`
 */
export function initFootnotePills(list) {
  if (!list || list.dataset.deskFnPillsInit) return;
  list.dataset.deskFnPillsInit = "";

  const measure = () => {
    let width;
    for (const pin of list.querySelectorAll(".desk-fn-pills > .desk-pin")) {
      const w = pin.getBoundingClientRect().width;
      if (w > 0) {
        width = w;
        break;
      }
    }
    // The list's left edge is the margin Pin has: the column as the page has
    // it now, moved or not.
    const mode = footnotePillMode({ free: list.getBoundingClientRect().left, width });
    if (list.getAttribute(ATTR) !== mode) list.setAttribute(ATTR, mode);
  };

  let frame = 0;
  const schedule = () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(measure);
  };
  measure();
  window.addEventListener("resize", schedule);
  window.addEventListener("load", schedule);
  document.addEventListener("desk:column-moved", schedule);
  document.fonts?.addEventListener?.("loadingdone", schedule);
  document.fonts?.ready.then(schedule);
  if (window.ResizeObserver) new ResizeObserver(schedule).observe(list);
  new MutationObserver(schedule).observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-size", "data-leading", "data-font", "data-vn", "data-fn", "data-desk-panel", "data-desk-expanded"],
  });
}
