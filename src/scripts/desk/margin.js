// src/scripts/desk/margin.js
//
// Puts the Notebook panel in the right margin beside the reading column
// (src/lib/desk-margin.mjs has the rules). The panel sits in a "rail": an
// absolutely positioned strip running down the margin to EDGE above the end
// of <main> (on an article, to the bottom of its card). It starts so that the panel's "Notebook" heading lines up with the
// top of the page's own heading ("Romans 8"; BVJ, 2026-10-06). Inside it the
// panel is sticky, so it starts there and pins EDGE from the top of the
// window as the reader scrolls. Its height is set so
// its bottom stays EDGE above the bottom of the window (BVJ, 2026-10-06), or
// at the rail's end once the footer comes into view.
//
// The rail is re-placed whenever the column or the page changes size (a new
// text size from the Display tray, a window resize, the header's search strip
// opening). When the margin is too narrow, <main> takes padding on the right
// so the column moves left only as far as the panel needs; the reader's line
// is held through that move (keepReadingPlace).
//
// Only loaded on a page with a reading column (desk-gate.js checks
// readingSurface first).

import { EDGE, panelHeight, placeInMargin } from "../../lib/desk-margin.mjs";
import { readingSurface } from "../desk-frame.js";
import { keepReadingPlace } from "../keep-reading-place.js";

/**
 * @param {HTMLElement} panel the Notebook panel, which this moves into the rail
 * @returns {{ show: (keepPlace?: boolean) => void, hide: (keepPlace?: boolean) => void }}
 */
export function createRail(panel) {
  const root = document.documentElement;
  const main = document.querySelector("main");
  const surface = readingSurface();
  const columnEls = surface.column.map((s) => document.querySelector(s)).filter(Boolean);
  const titleEl = document.querySelector(surface.title) || main;
  // Where the panel's travel ends: the article's card, or EDGE above the end
  // of <main> (the footer's seam), the gap it keeps on the right.
  const endEl = surface.end ? document.querySelector(surface.end) : null;

  const rail = document.createElement("div");
  rail.className = "desk-rail";
  rail.hidden = true;
  rail.append(panel);
  document.body.append(rail);
  const panelTitle = panel.querySelector(".desk-panel__title") ?? panel;

  let open = false;
  let pad = 0;

  // The top of the capital letters on an element's first line, in the
  // window: the box of its first character, moved down by the space its font
  // leaves above a capital. Two headings of different sizes then line up by
  // their capitals, the way the eye compares them, rather than by their boxes
  // (a larger font leaves more room above its capitals).
  const measure = document.createElement("canvas").getContext("2d");
  const capTop = (el) => {
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, {
      acceptNode: (n) => (/\S/.test(n.nodeValue) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP),
    });
    const node = walker.nextNode();
    if (!node) return el.getBoundingClientRect().top;
    const i = node.nodeValue.search(/\S/);
    const range = document.createRange();
    range.setStart(node, i);
    range.setEnd(node, i + 1);
    const top = range.getBoundingClientRect().top;
    const cs = getComputedStyle(node.parentElement);
    measure.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
    const m = measure.measureText(node.nodeValue[i]);
    const above = m.fontBoundingBoxAscent - m.actualBoundingBoxAscent;
    return top + (Number.isFinite(above) ? above : 0);
  };

  const columnBox = () => {
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

  // Down to EDGE above the bottom of the window, wherever the panel's top is.
  function fitHeight() {
    panel.style.height = `${panelHeight(rail.getBoundingClientRect(), window.innerHeight)}px`;
  }

  function place(keepPlace = false) {
    if (!open) {
      setPad(0, keepPlace);
      rail.hidden = true;
      root.style.removeProperty("--desk-dock-width");
      root.style.removeProperty("--desk-bar-center");
      return;
    }
    const viewport = root.clientWidth;
    const at = placeInMargin({ viewport, column: columnBox(), main: main.getBoundingClientRect(), pad });
    setPad(at.pad, keepPlace);

    // Measured after the padding, in document coordinates. The panel is shown
    // first so its own heading can be measured: the rail starts that far
    // above the page's heading.
    rail.style.left = `${at.left + window.scrollX}px`;
    rail.style.width = `${at.width}px`;
    rail.classList.toggle("desk-rail--over", at.over);
    rail.hidden = false;
    const inset = capTop(panelTitle) - panel.getBoundingClientRect().top;
    const top = capTop(titleEl) + window.scrollY - inset;
    const bottom = endEl
      ? endEl.getBoundingClientRect().bottom + window.scrollY
      : main.getBoundingClientRect().bottom + window.scrollY - EDGE;
    rail.style.top = `${top}px`;
    rail.style.height = `${Math.max(0, bottom - top)}px`;
    fitHeight();

    // For the floating panels (desk-frame.js) and the undo bar. From the
    // window's edge, scrollbar included, since that's what lit-panel.js
    // measures against (window.innerWidth).
    root.style.setProperty("--desk-dock-width", `${window.innerWidth - at.left}px`);
    const col = columnBox();
    root.style.setProperty("--desk-bar-center", `${(col.left + col.right) / 2}px`);
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
  // The headings are measured by their fonts' capitals, so place again once
  // the web fonts are in.
  document.fonts?.ready.then(schedule);

  // Scrolling moves the panel's top (natively, being sticky) until it pins,
  // and brings the rail's end into view at the footer; the height follows.
  let fitting = false;
  window.addEventListener(
    "scroll",
    () => {
      if (!open || fitting) return;
      fitting = true;
      requestAnimationFrame(() => {
        fitting = false;
        fitHeight();
      });
    },
    { passive: true },
  );

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
