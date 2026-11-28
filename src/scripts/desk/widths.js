// src/scripts/desk/widths.js
//
// Widths the reader can drag (BVJ, 2026-10-08; "Decisions", the Greek tab,
// item 13, with the recommended details): on a Chapter View chapter with the
// notebook open in the margin, two handles trade width between neighbours,
// one between the notes' margin and the LIT, one between the LIT and the
// notebook. src/lib/desk-margin.mjs holds the rules (placeWithWidths and the
// two drags); margin.js asks this module where things go and places them.
//
// Nothing shows between the columns at rest (BVJ: a line there distracts).
// The pointer in a gap gets the resize cursor and a small grip beside it,
// and a hairline shows only while dragging. The text's line also shows its
// grip while the pointer is on the bare page anywhere in the sheet's left
// margin (E139), since the line itself is narrow and inside the sheet. Each
// handle is wired as every draggable line is (`wireLine`, line-menu.js; E189):
// a focusable separator the arrow keys move a character at a time and Home and
// End move as far as it goes (the ARIA window-splitter pattern), and a press
// that doesn't move, or Enter, opens its menu of steps (XA8-1), for a reader
// who can click but not drag.
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
// "Reset widths," the last line of each line's menu (DI-25; the Display tray's
// and the Notebook's buttons went in Featherboa's Phase 4), forgets them.
//
// The text drags only within 45 to 75 characters a line (SZ-17, DI-24), in
// the reader's face (measureRange), and its line steps and reads out in that
// face's characters, not in --ch's "0"s: "Text 57 characters wide."

import {
  MIN_WIDTH,
  KEEP_LEFT,
  TEXT_HANDLE,
  dragNotebookEdge,
  dragTextEdge,
  measureChars,
  measureRange,
  placeWithWidths,
  widestMeasure,
  widthsFromLayout,
} from "../../lib/desk-margin.mjs";
import { clampSplit } from "../../lib/desk-greek-split.mjs";
import { keepReadingPlace } from "../keep-reading-place.js";
import { closeLineMenu, wireLine } from "./line-menu.js";

const MEASURE_KEY = "lit-desk-measure";
const WIDTH_KEY = "lit-desk-width";
// The floating notebook's width, dragged by its left edge (float-resize.js).
// Kept the same way, for the visit, and forgotten by "Reset widths" too.
const FLOAT_KEY = "lit-desk-float-width";
// Where the Greek tab's line between the text and the entry sits, the
// entry's share of their room (tab-greek.js), kept the same way.
const GREEK_SPLIT_KEY = "lit-desk-greek-split";
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

/** The width the reader dragged the floating notebook to, or null. */
export function keptFloatWidth() {
  try {
    const width = parseFloat(sessionStorage.getItem(FLOAT_KEY));
    if (Number.isFinite(width)) return width;
  } catch (_) {}
  return null;
}

export function keepFloatWidth(width) {
  try {
    sessionStorage.setItem(FLOAT_KEY, String(width));
  } catch (_) {}
}

/** The entry's share of the Greek tab the reader dragged to, or null. */
export function keptGreekSplit() {
  try {
    return clampSplit(parseFloat(sessionStorage.getItem(GREEK_SPLIT_KEY)));
  } catch (_) {}
  return null;
}

export function keepGreekSplit(share) {
  try {
    sessionStorage.setItem(GREEK_SPLIT_KEY, String(share));
  } catch (_) {}
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
    sessionStorage.removeItem(FLOAT_KEY);
    sessionStorage.removeItem(GREEK_SPLIT_KEY);
  } catch (_) {}
  document.dispatchEvent(new CustomEvent(WIDTHS_EVENT, { detail: { kept: false } }));
}

/** Whether any width the reader dragged is kept for this visit. */
export function keptAny() {
  return Boolean(keptWidths()) || keptFloatWidth() !== null || keptGreekSplit() !== null;
}

/**
 * @param {{ column: HTMLElement, panel: HTMLElement, onChange: () => void }} options
 *   `column` is Chapter View's column (.scripture-main), `panel` the Notebook
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
    const face = root.getAttribute("data-font") || "";
    const ch = probe.getBoundingClientRect().width / 100 || 10;
    return {
      viewport: root.clientWidth,
      parentLeft: parent.getBoundingClientRect().left + parseFloat(ps.paddingLeft || "0"),
      // Room for a footnote's Pin, which the widths never take (E81).
      keepLeft: KEEP_LEFT,
      ch,
      // One of the face's characters, in px: a step of either line.
      char: ch / measureChars(1, face),
      pad: parseFloat(cs.paddingLeft || "0") + parseFloat(cs.paddingRight || "0"),
      // The text's range in this face, read at each use, since the Display
      // tray can change the face under a kept measure.
      face,
      range: measureRange(face),
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
  const bookEdge = handle("book", "Resize the text and the Notebook");
  gutters.append(textEdge, bookEdge);
  document.body.append(gutters);

  // A stylesheet may paint a sheet the text lies on as the column's ::before,
  // reaching past the column's box on both sides. Its
  // edges in the window, given the column's box, or null where none is drawn.
  function sheetEdges(box) {
    const sheet = getComputedStyle(column, "::before");
    if (!sheet || !sheet.content || sheet.content === "none") return null;
    const left = parseFloat(sheet.left);
    const right = parseFloat(sheet.right);
    if (!Number.isFinite(left) || !Number.isFinite(right)) return null;
    return { left: box.left + Math.min(0, left), right: box.right - Math.min(0, right) };
  }

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
      return { measure: dragTextEdge({ measure: start.measure, dx, ch: m.ch, range: m.range, maxMeasure }), width: start.width };
    }
    return dragNotebookEdge({ measure: start.measure, width: start.width, dx, ch: m.ch, range: m.range });
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

  // Each line as every draggable line is (line-menu.js): a character a step
  // with the arrow keys (one of the face's, measures().char), ten with Shift,
  // and Home and End as far as it goes.
  for (const h of [textEdge, bookEdge]) {
    const which = h === textEdge ? "text" : "book";
    wireLine(h, {
      draggingClass: "desk-gutter--dragging",
      begin: (e) => ({ widths: startingWidths(), x0: e.clientX }),
      drag: (s, ev) => set(next(which, s.widths, ev.clientX - s.x0)),
      nudge: (dir, big) => set(next(which, startingWidths(), dir * (big ? 10 : 1) * measures().char)),
      // The whole window's width is past either end; the rules stop it there.
      toEnd: (dir) => set(next(which, startingWidths(), dir * root.clientWidth)),
      menu: () => menuFor(which),
    });
  }

  // The text's line is easy to miss: it lies inside the sheet, against the
  // text, with nothing drawn at rest (E139; BVJ, 2026-11-17: "not intuitive
  // to find"). So its grip also shows while the pointer is anywhere in the
  // sheet's left margin, at the pointer's height, pointing to the line. The
  // press and the resize cursor stay on the line itself, so a footnote's Pin
  // and a note keep their clicks (E83). BVJ: "it shouldn't show when
  // interacting with a margin note or note glyph." So only the bare page
  // counts as the margin: a note, its circle or its popover, a bookmark's
  // mark, a Pin or a panel lying there is none of it. Nor does it show while
  // a circle's popover is open, or while a button is held (a selection being
  // dragged across).
  const NEAR = "desk-gutter--near";
  let pointer = null;

  // Where the margin begins: where the sheet's left edge is with no notes in
  // the margin, at most 49px out from the column (nearer where the window is
  // narrow), or those 49px where no sheet is drawn. A sheet that reaches out
  // under margin notes doesn't take the grip's area with it (E150; BVJ,
  // 2026-11-17: “It should stay the same area where the sheet USED to be”).
  function marginLeft(box) {
    const sheet = sheetEdges(box);
    return Math.max(0, box.left - 49, sheet ? sheet.left : 0);
  }

  const barePage = (t) => t === textEdge || t === column || (t instanceof Node && t.contains(column));

  function hint({ x, y, target, held = false, touch = false }) {
    let near = false;
    if (!gutters.hidden && !touch && !held && barePage(target) && !document.querySelector('.desk-circle[aria-expanded="true"]')) {
      const box = column.getBoundingClientRect();
      const run = textEdge.getBoundingClientRect();
      const textLeft = box.left + parseFloat(getComputedStyle(column).paddingLeft || "0");
      near = x >= marginLeft(box) && x < textLeft && y >= run.top && y <= run.bottom;
      if (near) textEdge.style.setProperty("--grip-y", `${y - run.top}px`);
    }
    textEdge.classList.toggle(NEAR, near);
  }

  document.addEventListener(
    "pointermove",
    (e) => {
      pointer = { x: e.clientX, y: e.clientY, touch: e.pointerType === "touch" };
      hint({ ...pointer, target: e.target, held: e.buttons !== 0 });
    },
    { passive: true },
  );
  // The page scrolling under a still pointer changes what it is over.
  let scrolled = 0;
  window.addEventListener(
    "scroll",
    () => {
      if (!pointer || gutters.hidden) return;
      cancelAnimationFrame(scrolled);
      scrolled = requestAnimationFrame(() => hint({ ...pointer, target: document.elementFromPoint(pointer.x, pointer.y) }));
    },
    { passive: true },
  );
  document.documentElement.addEventListener("pointerleave", () => {
    pointer = null;
    textEdge.classList.remove(NEAR);
  });

  // The click-only way to do what dragging does (XA8-1): four characters a
  // step. On the text's line, dragging right narrows the text; on the
  // Notebook's, dragging right narrows the Notebook.
  const MENU_STEP = 4;
  function menuFor(which) {
    const text = which === "text";
    return {
      label: text ? "Text width" : "Notebook width",
      more: text ? "Wider text" : "Wider Notebook",
      less: text ? "Narrower text" : "Narrower Notebook",
      step: (dir) => {
        const { char } = measures();
        set(next(which, startingWidths(), -dir * MENU_STEP * char));
      },
      reset: { label: "Reset widths", run: () => keepReadingPlace(resetWidths), shown: keptAny },
    };
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
    // Inside the column's padding: right of the margin notes, which end 8px
    // left of the column's box, and of a footnote's Pin, which ends 2px
    // inside it (E83), and left of the text, which starts 16px inside it.
    textEdge.style.left = `${col.left + sx + TEXT_HANDLE.inset}px`;
    textEdge.style.width = `${TEXT_HANDLE.width}px`;
    // From just inside the column's padding to the notebook.
    const bookWidth = Math.max(12, panelLeft - col.right + 6);
    bookEdge.style.left = `${col.right + sx - 6}px`;
    bookEdge.style.width = `${bookWidth}px`;
    // Its grip and hairline are drawn in the narrow space between the sheet
    // and the Notebook, not at the middle of the line's own reach, which
    // begins inside the sheet (BVJ, 2026-11-17: "the field of where the mouse
    // is located when it becomes active is good, but the location of the
    // adjuster itself should be in that narrow space between the sheet and
    // the notebook panel"). With no sheet drawn they keep the middle.
    const sheet = sheetEdges(col);
    if (sheet && panelLeft > sheet.right) {
      const mid = (sheet.right + panelLeft) / 2 - (col.right - 6);
      bookEdge.style.setProperty("--grip-x", `${Math.min(bookWidth - 3, Math.max(3, mid))}px`);
    } else {
      bookEdge.style.removeProperty("--grip-x");
    }

    const m = measures();
    const now = keptWidths() ? layout() : null;
    const measure =
      now && !now.over
        ? now.measure
        : parseFloat(getComputedStyle(root).getPropertyValue("--reading-measure")) || 48;
    const width = Math.round(now && !now.over ? now.width : root.clientWidth - 16 - panelLeft);
    const widest = widestMeasure({ ...m, width });
    // The text's line counts in the face's characters, the unit of its 45 to
    // 75, each value rounded the same way so the menu's steps stop at the ends.
    const chars = (v) => Math.round(measureChars(v, m.face));
    textEdge.setAttribute("aria-valuemin", String(chars(m.range.min)));
    textEdge.setAttribute("aria-valuemax", String(chars(Math.max(m.range.min, widest))));
    textEdge.setAttribute("aria-valuenow", String(chars(measure)));
    textEdge.setAttribute("aria-valuetext", `Text ${chars(measure)} characters wide`);
    bookEdge.setAttribute("aria-valuemin", String(MIN_WIDTH));
    bookEdge.setAttribute("aria-valuemax", String(Math.round(width + Math.max(0, measure - m.range.min) * m.ch)));
    bookEdge.setAttribute("aria-valuenow", String(width));
    bookEdge.setAttribute("aria-valuetext", `Notebook ${width} pixels wide`);
  }

  function hideHandles() {
    gutters.hidden = true;
    textEdge.classList.remove(NEAR);
    closeLineMenu(textEdge);
    closeLineMenu(bookEdge);
  }

  return { layout, apply, clear, placeHandles, hideHandles };
}
