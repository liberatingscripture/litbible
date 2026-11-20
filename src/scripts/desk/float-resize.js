// src/scripts/desk/float-resize.js
//
// The floating notebook's draggable left edge (BVJ, 2026-10-14). Where the
// margin is too narrow and the expanded panel lies over the text, a handle
// down the panel's left edge changes its width: the right edge stays EDGE
// from the window's, so only the left edge moves. The rules are
// floatBounds/floatWidth/dragFloatEdge in src/lib/desk-margin.mjs; margin.js
// places the panel at the width kept here.
//
// Like the margin's handles (widths.js), nothing shows at rest: the pointer
// on the edge gets the resize cursor and a small grip beside it, and a
// hairline shows while dragging. It is wired as every draggable line is
// (`wireLine`, line-menu.js; E189): a focusable separator the arrow keys move
// (left widens, right narrows) and Home and End take to its ends, and a press
// that doesn't move, or Enter, opens its menu of steps (XA8-1), for a reader
// who can click but not drag. The width is kept
// in sessionStorage for the visit and forgotten by "Reset widths".
//
// The handle is a child of the panel, so it sticks and scrolls with it.
// margin.js shows it only while the panel floats expanded.

import { dragFloatEdge, floatBounds } from "../../lib/desk-margin.mjs";
import { WIDTHS_EVENT, keepFloatWidth, keptAny, resetWidths } from "./widths.js";
import { closeLineMenu, wireLine } from "./line-menu.js";

const STEP = 16;
// A step of its menu: three of the arrow key's.
const MENU_STEP = 3 * STEP;

/**
 * @param {HTMLElement} panel the Notebook panel
 * @param {() => void} onChange places everything again (margin.js)
 * @returns {{ update: (s: { visible: boolean, width: number, viewport: number }) => void }}
 */
export function createFloatResize(panel, onChange) {
  const handle = document.createElement("div");
  handle.className = "desk-panel__edge";
  handle.hidden = true;
  handle.setAttribute("role", "separator");
  handle.setAttribute("aria-orientation", "vertical");
  handle.setAttribute("aria-label", "Resize the Notebook");
  handle.tabIndex = 0;
  handle.innerHTML = `<span class="desk-panel__edge-grip" aria-hidden="true"></span>`;
  panel.append(handle);

  let viewport = 0;
  const widthNow = () => Math.round(panel.getBoundingClientRect().width);

  let frame = 0;
  const set = (width) => {
    keepFloatWidth(width);
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      onChange();
      document.dispatchEvent(new CustomEvent(WIDTHS_EVENT, { detail: { kept: true } }));
    });
  };

  // As every draggable line is (line-menu.js): left widens and right narrows,
  // as the edge itself moves, Shift takes bigger steps, Home and End go as far
  // as it goes, and a click or Enter opens its menu (XA8-1).
  wireLine(handle, {
    draggingClass: "desk-panel__edge--dragging",
    begin: (e) => ({ width: widthNow(), x0: e.clientX }),
    drag: (s, ev) => set(dragFloatEdge({ width: s.width, dx: ev.clientX - s.x0, viewport })),
    nudge: (dir, big) => set(dragFloatEdge({ width: widthNow(), dx: dir * (big ? 5 : 1) * STEP, viewport })),
    toEnd: (dir) => set(dragFloatEdge({ width: widthNow(), dx: dir * viewport, viewport })),
    menu: () => ({
      label: "Notebook width",
      more: "Wider Notebook",
      less: "Narrower Notebook",
      step: (dir) => set(dragFloatEdge({ width: widthNow(), dx: -dir * MENU_STEP, viewport })),
      reset: { label: "Reset widths", run: resetWidths, shown: keptAny },
    }),
  });

  return {
    update({ visible, width, viewport: v }) {
      viewport = v;
      handle.hidden = !visible;
      if (!visible) {
        closeLineMenu(handle);
        return;
      }
      const { min, max } = floatBounds(v);
      handle.setAttribute("aria-valuemin", String(min));
      handle.setAttribute("aria-valuemax", String(max));
      handle.setAttribute("aria-valuenow", String(width));
      handle.setAttribute("aria-valuetext", `Notebook ${width} pixels wide`);
    },
  };
}
