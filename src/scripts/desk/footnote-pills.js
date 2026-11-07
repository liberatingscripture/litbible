// src/scripts/desk/footnote-pills.js
//
// Where a footnote's Pin (pins.js) and "+ Note" (footnote-notes.js) sit in
// Chapter View's Footnotes list (STUDY-DESK-FIXES.md, E49; BVJ, 2026-11-06).
// The rule is src/lib/desk-footnote-pills.mjs (pure, unit-tested); this builds
// the row and applies the answer, the way margin.js does for the Notebook.
//
// Each footnote gets one `.desk-fn-pills` after its `.fn-body`, so reading
// order and tab order are the note, then its Pin, then "+ Note", wherever they
// are drawn. The list carries `data-desk-fn-pills="row" | "more" | "inline"`
// (desk.css draws each):
//   row     the two pills in the left margin, level with the footnote's first line;
//   more    one "⋯" pill there, a disclosure button that opens Pin and "+ Note"
//           stacked under it; Escape, a click elsewhere or focus leaving closes it;
//   inline  on the note's line, on its right, as before E49.
// A footnote with one of the reader's margin notes beside it (notes-margin.js
// sets `data-desk-fn-margin` on it) takes the inline placement, since a margin
// note sits in the same left margin.
//
// Nothing here adds text to the scripture or to the footnote: the pills sit
// beside `.fn-body`, never in it.

import { PILL_GAP, footnotePillMode } from "../../lib/desk-footnote-pills.mjs";

const ATTR = "data-desk-fn-pills";
let counter = 0;

const DOTS = `<svg viewBox="0 0 16 4" width="16" height="4" fill="currentColor" aria-hidden="true"
  focusable="false"><circle cx="2" cy="2" r="1.5" /><circle cx="8" cy="2" r="1.5" /><circle cx="14" cy="2" r="1.5" /></svg>`;

/** The pill row whose stack is open now, if any. */
const openRow = () => document.querySelector(".desk-fn-pills[data-open]");

function setOpen(wrap, on) {
  wrap.toggleAttribute("data-open", on);
  wrap.querySelector(".desk-fn-more")?.setAttribute("aria-expanded", String(on));
}

/**
 * The row of pills for one footnote: a "⋯" button (shown only in "more") and
 * the group holding Pin and "+ Note".
 *
 * @param {string} label the footnote's letter, which names the "⋯" button
 * @param {Array<HTMLElement | null>} buttons Pin, then "+ Note" (a null is skipped)
 * @returns {HTMLElement}
 */
export function footnotePills(label, buttons) {
  const wrap = document.createElement("div");
  wrap.className = "desk-fn-pills";
  const group = document.createElement("span");
  group.className = "desk-fn-pills__group";
  group.id = `desk-fn-pills-${++counter}`;
  group.append(...buttons.filter(Boolean));

  const more = document.createElement("button");
  more.type = "button";
  more.className = "desk-fn-more";
  more.setAttribute("aria-label", `Actions for footnote ${label}`);
  more.setAttribute("aria-expanded", "false");
  more.setAttribute("aria-controls", group.id);
  more.title = `Actions for footnote ${label}`;
  more.innerHTML = DOTS;
  more.addEventListener("click", () => {
    const on = !wrap.hasAttribute("data-open");
    const other = openRow();
    if (other && other !== wrap) setOpen(other, false);
    setOpen(wrap, on);
  });

  // Choosing Pin or "+ Note" closes the stack and keeps focus on the "⋯" (the
  // buttons under it are hidden again), before their own handlers run.
  group.addEventListener(
    "click",
    () => {
      if (!wrap.hasAttribute("data-open")) return;
      setOpen(wrap, false);
      more.focus({ preventScroll: true });
    },
    true,
  );
  // Focus leaving for somewhere else closes it. (A null relatedTarget is the
  // window losing focus, which leaves it alone.)
  wrap.addEventListener("focusout", (e) => {
    if (e.relatedTarget && !wrap.contains(e.relatedTarget)) setOpen(wrap, false);
  });

  wrap.append(more, group);
  return wrap;
}

/**
 * Where focus and an editor's trigger belong for a pill: the pill itself, or
 * the "⋯" when its list is in "more", since the pill is hidden again once the
 * stack closes.
 *
 * @param {HTMLElement} button Pin or "+ Note"
 */
export function pillsHome(button) {
  const wrap = button.closest(".desk-fn-pills");
  const more = wrap?.querySelector(".desk-fn-more");
  if (!more) return button;
  const inMore =
    wrap.closest(".footnotes")?.getAttribute(ATTR) === "more" && !wrap.closest("li")?.hasAttribute("data-desk-fn-margin");
  return inMore ? more : button;
}

/** Put focus on a footnote's Pin, or on its "⋯" where the Pin is behind it. */
export function focusPin(li) {
  const pin = li.querySelector(".desk-pin:not(.desk-fn-add)");
  if (pin) pillsHome(pin).focus({ preventScroll: true });
}

let started = false;

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
    let row;
    let stack;
    for (const group of list.querySelectorAll(".desk-fn-pills__group")) {
      const widths = Array.from(group.children, (el) => el.getBoundingClientRect().width);
      if (widths.length && widths.every((w) => w > 0)) {
        row = widths.reduce((a, b) => a + b, 0) + PILL_GAP * (widths.length - 1);
        stack = Math.max(...widths);
        break;
      }
    }
    // The list's left edge is the margin the pills have: the column as the
    // page has it now, moved or not.
    const mode = footnotePillMode({ free: list.getBoundingClientRect().left, row, stack });
    if (list.getAttribute(ATTR) === mode) return;
    list.setAttribute(ATTR, mode);
    if (mode !== "more") for (const wrap of list.querySelectorAll(".desk-fn-pills[data-open]")) setOpen(wrap, false);
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

  if (started) return;
  started = true;
  // A click elsewhere, or Escape, closes an open stack.
  document.addEventListener("pointerdown", (e) => {
    const open = openRow();
    if (open && !open.contains(e.target)) setOpen(open, false);
  });
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape" || e.defaultPrevented) return;
    const open = openRow();
    if (!open) return;
    if (open.contains(document.activeElement)) open.querySelector(".desk-fn-more")?.focus({ preventScroll: true });
    setOpen(open, false);
  });
}
