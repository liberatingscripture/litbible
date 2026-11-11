// src/scripts/desk/footnote-pills.js
//
// Where a footnote's Pin (pins.js) sits in Chapter View's Footnotes list
// (STUDY-DESK-FIXES.md, E49; BVJ, 2026-11-06). The rule is
// src/lib/desk-footnote-pills.mjs (pure, unit-tested); this builds the pill's
// holder and applies the answer, the way margin.js does for the Notebook.
//
// Each footnote gets one `.desk-fn-pills` after its `.fn-body`, so reading
// order and tab order are the note, then its Pin, wherever Pin is drawn. The
// list carries `data-desk-fn-pills="row" | "glyph"` (desk.css draws each):
//   row    Pin in the left margin, level with the footnote's first line;
//   glyph  the same place, without the word "Pin", where the margin is tight.
// Pin never moves to the note's right (BVJ, 2026-11-10; E81). Where the window
// leaves no margin even for the thumbtack, the list is indented by what is
// missing (`--desk-fn-indent`). Neither change touches the button, so focus
// on it is never lost.
//
// Until 2026-11-10 "Add a note" sat beside Pin, a third mode folded the two
// behind one "⋯" button, and a footnote with a margin note beside it kept Pin
// on its line; notes on a footnote were removed then (BVJ, 2026-11-10;
// STUDY-DESK-FIXES.md, E79), and one pill has nothing to fold.
//
// Nothing here adds text to the scripture or to the footnote: Pin sits beside
// `.fn-body`, never in it.

import { footnotePillPlace } from "../../lib/desk-footnote-pills.mjs";

const ATTR = "data-desk-fn-pills";
const INDENT = "--desk-fn-indent";

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
    const pin = list.querySelector("li.desk-fn > .desk-fn-pills > .desk-pin");
    const li = pin?.closest("li");
    if (!li) return;
    // Pin's width with its word, which only "row" shows.
    if (list.getAttribute(ATTR) !== "row") list.setAttribute(ATTR, "row");
    const width = pin.getBoundingClientRect().width || undefined;
    // The footnote's left edge is the margin Pin has: the column as the page
    // has it now, moved or not, less any indent already given.
    const indented = parseFloat(list.style.getPropertyValue(INDENT)) || 0;
    const { mode, indent } = footnotePillPlace({ free: li.getBoundingClientRect().left - indented, width });
    if (mode !== "row") list.setAttribute(ATTR, mode);
    if (indent !== indented) {
      if (indent) list.style.setProperty(INDENT, `${indent}px`);
      else list.style.removeProperty(INDENT);
    }
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
