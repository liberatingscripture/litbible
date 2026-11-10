// src/scripts/desk/pane-move.js
//
// Dragging a /desk pane by its header (E25; BVJ, 2026-11-02): over another
// pane, an edge band splits it and the middle swaps the two (`dropZone`,
// `splitPane`, `swapPanes` in desk-layout.mjs, which are the rules); the drop
// box names which, and over nothing a pane can land on a label by the pointer
// says so, and letting go announces "not moved." The pane menu's Move left,
// right, up and down are the keyboard's way (kind-menu.js). Cut from
// desk-page.js's `start()` (Audit 8, LG8-8), which hands in the layout, its
// boxes and `commit`.

import { NEEDS_TEXT, dropZone, findPane, kindLabel, needs, panes, splitPane, swapPanes } from "../../lib/desk-layout.mjs";
import { el } from "./dom.js";

// What the drop box says each zone does (E25). `kind` is the target pane's.
const DROP_TEXT = {
  swap: (kind) => `Swap with ${kind}`,
  left: (kind) => `Left of ${kind}`,
  right: (kind) => `Right of ${kind}`,
  top: (kind) => `Above ${kind}`,
  bottom: (kind) => `Below ${kind}`,
};

/**
 * Start dragging pane `movingId` by its header (the `pointerdown` event `e`):
 * past 5px it moves, the drop box shows what letting go would make, and a
 * drop commits it. Escape or a cancelled pointer drops nothing.
 * @param {PointerEvent} e
 * @param {string} movingId
 * @param {{ getLayout: () => object, panesBox: HTMLElement, paneEls: Map<string, { el: HTMLElement }>,
 *   drop: HTMLElement, miss: HTMLElement, commit: (layout: object) => void,
 *   announce: (text: string) => void }} page
 */
export function startPaneMove(e, movingId, { getLayout, panesBox, paneEls, drop, miss, commit, announce }) {
  if (e.button !== 0 || e.target.closest("button, .desk-pane__menu")) return;
  if (panes(getLayout().root).length < 2) return;
  const head = e.currentTarget;
  const x0 = e.clientX;
  const y0 = e.clientY;
  let moving = false;
  let pick = null; // { zone, targetId }: the drop shown now, if it would work
  let seen = null; // { zone, targetId }: the zone the pointer is in, for dropZone to hold
  head.setPointerCapture(e.pointerId);
  // What dropping on a zone of a pane would make, from the layout as it is
  // now: a swap always fits (each slot keeps its size), a split may not.
  const plan = (zone, targetId) => {
    const layout = getLayout();
    const swap = zone === "swap";
    const next = swap ? swapPanes(layout, movingId, targetId) : splitPane(layout, targetId, zone, movingId);
    const box = panesBox.getBoundingClientRect();
    const why = next === layout ? "larger" : swap ? null : needs(next.root, box.width, box.height);
    return { swap, next, why };
  };
  const stop = () => {
    head.removeEventListener("pointermove", move);
    head.removeEventListener("pointerup", up);
    head.removeEventListener("pointercancel", cancel);
    document.removeEventListener("keydown", key, true);
    drop.hidden = true;
    miss.hidden = true;
    document.documentElement.classList.remove("desk-ws--moving");
    paneEls.get(movingId)?.el.classList.remove("desk-pane--moving");
  };
  const move = (ev) => {
    if (!moving) {
      if (Math.hypot(ev.clientX - x0, ev.clientY - y0) < 5) return;
      moving = true;
      document.documentElement.classList.add("desk-ws--moving");
      paneEls.get(movingId)?.el.classList.add("desk-pane--moving");
    }
    const target = document.elementsFromPoint(ev.clientX, ev.clientY)
      .map((n) => n.closest?.(".desk-pane"))
      .find((n) => n && panesBox.contains(n));
    if (!target || target.dataset.paneId === movingId) {
      drop.hidden = true;
      pick = null;
      seen = null;
      // Nothing here to land on: say so beside the pointer.
      const box = panesBox.getBoundingClientRect();
      miss.textContent = "Drop on another pane to move this one";
      miss.style.left = `${ev.clientX - box.left + 14}px`;
      miss.style.top = `${ev.clientY - box.top + 14}px`;
      miss.hidden = false;
      return;
    }
    miss.hidden = true;
    const rect = target.getBoundingClientRect();
    const targetId = target.dataset.paneId;
    const held = seen?.targetId === targetId ? seen.zone : null;
    const zone = dropZone(rect.width, rect.height, ev.clientX - rect.left, ev.clientY - rect.top, held);
    seen = { zone, targetId };
    const { swap, why } = plan(zone, targetId);
    const box = panesBox.getBoundingClientRect();
    pick = why ? null : { zone, targetId };
    // A swap shows the whole target, the pane the dragged one will take
    // the place of; a split shows the half it will take.
    const half = {
      swap: [rect.left, rect.top, rect.width, rect.height],
      left: [rect.left, rect.top, rect.width / 2, rect.height],
      right: [rect.left + rect.width / 2, rect.top, rect.width / 2, rect.height],
      top: [rect.left, rect.top, rect.width, rect.height / 2],
      bottom: [rect.left, rect.top + rect.height / 2, rect.width, rect.height / 2],
    }[zone];
    Object.assign(drop.style, {
      left: `${half[0] - box.left}px`,
      top: `${half[1] - box.top}px`,
      width: `${half[2]}px`,
      height: `${half[3]}px`,
    });
    drop.classList.toggle("desk-ws__drop--refused", Boolean(why));
    drop.classList.toggle("desk-ws__drop--swap", swap);
    const name = kindLabel(findPane(getLayout().root, targetId)?.kind);
    // The words sit on a chip of their own, or the pane's text under the
    // box's faint tint would run through them.
    drop.replaceChildren(el("span", "desk-ws__drop-label", why
      ? (NEEDS_TEXT[why] ? `No room here (${NEEDS_TEXT[why].toLowerCase()})` : "No room here")
      : DROP_TEXT[zone](name)));
    drop.hidden = false;
  };
  const up = () => {
    stop();
    if (!moving) return;
    // A drop that lands nowhere (or where there is no room; the box said why)
    // changes nothing: say so, since the panes look the same as before.
    if (!pick) {
      announce(`${kindLabel(findPane(getLayout().root, movingId)?.kind)} not moved.`);
      return;
    }
    // Planned again from the layout as it is now, not as it was at the last
    // pointer move: a pane's place (a scroll, say) may have been saved
    // since, and committing the old tree would undo it.
    const { swap, next, why } = plan(pick.zone, pick.targetId);
    if (why) return;
    const name = kindLabel(findPane(getLayout().root, movingId)?.kind);
    const other = swap && kindLabel(findPane(getLayout().root, pick.targetId)?.kind);
    commit(next);
    announce(swap ? `${name} swapped with ${other}.` : `${name} moved.`);
  };
  const cancel = () => stop();
  const key = (ev) => {
    if (ev.key !== "Escape") return;
    ev.preventDefault();
    ev.stopPropagation();
    stop();
  };
  head.addEventListener("pointermove", move);
  head.addEventListener("pointerup", up);
  head.addEventListener("pointercancel", cancel);
  document.addEventListener("keydown", key, true);
}
