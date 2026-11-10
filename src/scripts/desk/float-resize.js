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
// hairline shows while dragging. It is a focusable separator the arrow keys
// move (left widens, right narrows), so it isn't mouse-only, and a press that
// doesn't move, or Enter, opens its menu of steps (line-menu.js; XA8-1), for a
// reader who can click but not drag. The width is kept
// in sessionStorage for the visit and forgotten by "Reset widths".
//
// The handle is a child of the panel, so it sticks and scrolls with it.
// margin.js shows it only while the panel floats expanded.

import { dragFloatEdge, floatBounds } from "../../lib/desk-margin.mjs";
import { WIDTHS_EVENT, keepFloatWidth, keptAny, resetWidths } from "./widths.js";
import { clickOrDrag, closeLineMenu, isMenuKey, toggleLineMenu } from "./line-menu.js";

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

  // The grip sits beside the pointer, at its height.
  handle.addEventListener("pointermove", (e) => {
    handle.style.setProperty("--grip-y", `${e.clientY - handle.getBoundingClientRect().top}px`);
  });
  handle.addEventListener("focus", () => {
    const box = handle.getBoundingClientRect();
    const mid = (Math.max(0, box.top) + Math.min(window.innerHeight, box.bottom)) / 2;
    handle.style.setProperty("--grip-y", `${mid - box.top}px`);
  });

  handle.addEventListener("pointerdown", (e) => {
    if (e.button !== 0) return;
    e.preventDefault(); // no text selection
    const start = widthNow();
    const x0 = e.clientX;
    clickOrDrag(handle, e, {
      move: (ev) => {
        handle.classList.add("desk-panel__edge--dragging");
        set(dragFloatEdge({ width: start, dx: ev.clientX - x0, viewport }));
      },
      end: () => handle.classList.remove("desk-panel__edge--dragging"),
      click: (ev) => openMenu({ x: ev.clientX, y: ev.clientY }),
    });
  });

  // Left widens and right narrows, as the edge itself moves; Shift takes
  // bigger steps. Enter or Space opens the menu.
  handle.addEventListener("keydown", (e) => {
    if (isMenuKey(e)) {
      e.preventDefault();
      openMenu(null);
      return;
    }
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    const dx = (e.shiftKey ? 5 : 1) * STEP * (e.key === "ArrowLeft" ? -1 : 1);
    set(dragFloatEdge({ width: widthNow(), dx, viewport }));
  });

  // The click-only way to do what dragging does (XA8-1).
  function openMenu(at) {
    toggleLineMenu(handle, {
      label: "Notebook width",
      more: "Wider Notebook",
      less: "Narrower Notebook",
      step: (dir) => set(dragFloatEdge({ width: widthNow(), dx: -dir * MENU_STEP, viewport })),
      reset: { label: "Reset widths", run: resetWidths, shown: keptAny },
      at,
    });
  }

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
