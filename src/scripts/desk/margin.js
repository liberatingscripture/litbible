// src/scripts/desk/margin.js
//
// Puts the Notebook panel in the right margin beside the reading column
// (src/lib/desk-margin.mjs has the rule). The panel sits in a "rail": an
// absolutely positioned strip running from the top of the reading area to the
// bottom of <main>, in the margin. Inside it the panel is sticky, so it starts
// level with the text, below the header and Study View's tool row, pins to
// the top of the window as the reader scrolls, and goes up with the page at
// its end, before the footer. Native scrolling does all of that; nothing runs
// on scroll.
//
// The rail is re-placed whenever the column or the page changes size (a new
// text size from the Display tray, a window resize, the header's search strip
// opening). When the margin is too narrow, <main> takes padding on the right
// so the column moves left only as far as the panel needs; the reader's line
// is held through that move (keepReadingPlace).

import { placeInMargin } from "../../lib/desk-margin.mjs";
import { keepReadingPlace } from "../keep-reading-place.js";

// The reading column on each kind of page, and where the reading area starts.
// Read View's column is its toolbar and its text together, since the toolbar
// is wider than the text. A page that matches none has no margin to fill.
const SURFACES = [
  { column: [".scripture-main"], top: ".scripture-main" },
  { column: [".rm-page .rm-toolbar", ".rm-page .rm-reader"], top: ".rm-page" },
  { column: [".article__card"], top: ".article__card" },
];

/**
 * @param {HTMLElement} panel the Notebook panel, which this moves into the rail
 * @returns {{ show: (keepPlace?: boolean) => void, hide: (keepPlace?: boolean) => void }}
 */
export function createRail(panel) {
  const root = document.documentElement;
  const main = document.querySelector("main");
  const surface = SURFACES.find((s) => document.querySelector(s.column[0]));
  const columnEls = surface ? surface.column.map((s) => document.querySelector(s)).filter(Boolean) : [];
  const topEl = (surface && document.querySelector(surface.top)) || main;

  const rail = document.createElement("div");
  rail.className = "desk-rail";
  rail.hidden = true;
  rail.append(panel);
  document.body.append(rail);

  let open = false;
  let pad = 0;

  const columnBox = () => {
    if (!columnEls.length) return null;
    const rects = columnEls.map((el) => el.getBoundingClientRect());
    return { left: Math.min(...rects.map((r) => r.left)), right: Math.max(...rects.map((r) => r.right)) };
  };

  function setPad(next, keepPlace) {
    if (next === pad) return;
    const change = () => {
      pad = next;
      main.style.paddingRight = next ? `${next}px` : "";
    };
    if (keepPlace) keepReadingPlace(change);
    else change();
  }

  function place(keepPlace = false) {
    if (!open || !main) {
      setPad(0, keepPlace);
      rail.hidden = true;
      root.style.removeProperty("--desk-dock-width");
      root.style.removeProperty("--desk-bar-center");
      return;
    }
    const viewport = root.clientWidth;
    const at = placeInMargin({ viewport, column: columnBox(), main: main.getBoundingClientRect(), pad });
    setPad(at.pad, keepPlace);

    // Measured after the padding, in document coordinates.
    const top = topEl.getBoundingClientRect().top + window.scrollY;
    const bottom = main.getBoundingClientRect().bottom + window.scrollY;
    rail.style.left = `${at.left + window.scrollX}px`;
    rail.style.width = `${at.width}px`;
    rail.style.top = `${top}px`;
    rail.style.height = `${Math.max(0, bottom - top)}px`;
    rail.classList.toggle("desk-rail--over", at.over);
    rail.hidden = false;

    // For the floating panels (desk-frame.js) and the undo bar. From the
    // window's edge, scrollbar included, since that's what lit-panel.js
    // measures against (window.innerWidth).
    root.style.setProperty("--desk-dock-width", `${window.innerWidth - at.left}px`);
    const col = columnBox();
    root.style.setProperty("--desk-bar-center", `${col ? (col.left + col.right) / 2 : at.left / 2}px`);
  }

  // One placement per frame, however many observers fire.
  let queued = false;
  const schedule = () => {
    if (queued || !open) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      place();
    });
  };
  const observer = new ResizeObserver(schedule);
  for (const el of [main, ...columnEls, document.querySelector(".site-header")]) if (el) observer.observe(el);
  window.addEventListener("resize", schedule);
  window.addEventListener("load", schedule);

  return {
    show(keepPlace = false) {
      open = true;
      place(keepPlace);
    },
    hide(keepPlace = false) {
      open = false;
      place(keepPlace);
    },
  };
}
