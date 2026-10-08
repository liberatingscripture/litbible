// src/scripts/desk/margin.js
//
// Puts the Notebook panel in the right margin beside the reading column
// (src/lib/desk-margin.mjs has the rules). The panel sits in a "rail": an
// absolutely positioned strip running down the margin to just above the seam
// where the page meets the footer's colour (a license band above the footer
// counts as footer; on an article it ends at the bottom of the card; see
// desk-frame.js). It starts so that the panel's "Notebook" heading lines up
// with the top of the page's own heading ("Romans 8"; BVJ, 2026-10-06).
// Inside it the panel is sticky, so it starts there and pins EDGE from the
// top of the window as the reader scrolls. Its height is set so its bottom
// stays EDGE above the bottom of the window, or at the rail's end once that
// comes into view.
//
// The rail is re-placed whenever the column or the page changes size (a new
// text size from the Display tray, a window resize, the header's search strip
// opening). When the margin is too narrow, the column's own elements (the
// page's `move` list) are translated left only as far as the panel needs.
// Nothing reflows, so the reader's line stays put, and full-width bands such
// as the license band keep their full width.
//
// Where even that leaves no room (a narrow window), the notebook floats
// (BVJ, 2026-10-07): expanded, the panel lies over the ends of the lines;
// collapsed, the rail holds only a tab at the window's edge, clear of the
// text. Either way the column moves only as far as the tab needs, so
// expanding and collapsing never moves the text.
//
// Only loaded on a page with a reading column (desk-gate.js checks
// readingSurface first).

import { EDGE, nextCollapsed, panelHeight, placeFloating, placeInMargin } from "../../lib/desk-margin.mjs";
import { readingSurface } from "../desk-frame.js";

/**
 * @param {HTMLElement} panel the Notebook panel, which this moves into the rail
 * @param {HTMLElement} tab the collapsed notebook's tab, likewise
 * @param {(state: { floating: boolean, collapsed: boolean }) => void} onChange
 *   told whenever the notebook starts or stops floating, or collapses or
 *   expands, including when a placement does it (a window narrowed under it)
 * @returns {{ show: (opts?: { expand?: boolean }) => void, hide: () => void,
 *   collapse: () => void, expand: () => void,
 *   state: () => { floating: boolean, collapsed: boolean } }}
 */
export function createRail(panel, tab, onChange = () => {}) {
  const root = document.documentElement;
  const main = document.querySelector("main");
  const surface = readingSurface();
  const columnEls = surface.column.map((s) => document.querySelector(s)).filter(Boolean);
  // Where the panel starts: its "Notebook" heading level with the page's
  // heading, or (`start`) its top edge level with an element's top edge.
  const startEl = surface.start ? document.querySelector(surface.start) : null;
  const titleEl = (surface.title && document.querySelector(surface.title)) || main;
  // An element inside another one that moves would move twice, and the next
  // placement would then measure the double move and undo it (the glossary's
  // entries sit inside its hero's wrap), so only the outermost are kept.
  const moveEls = surface.move
    .flatMap((s) => [...document.querySelectorAll(s)])
    .filter((el, _, all) => !all.some((other) => other !== el && other.contains(el)));
  // Where the panel's travel ends, in document coordinates: the page's seam
  // (desk-frame.js), or EDGE above the end of <main> where it has none.
  const endEl = surface.end ? document.querySelector(surface.end.selector) : null;
  const endY = () => {
    if (!endEl) return main.getBoundingClientRect().bottom + window.scrollY - EDGE;
    const box = endEl.getBoundingClientRect();
    return (surface.end.at === "top" ? box.top : box.bottom) + window.scrollY - surface.end.gap;
  };

  const rail = document.createElement("div");
  rail.className = "desk-rail";
  rail.hidden = true;
  rail.append(panel, tab);
  document.body.append(rail);
  const panelTitle = panel.querySelector(".desk-panel__title") ?? panel;

  let open = false;
  let shift = 0;
  // Floating (the margin can't hold the panel) and collapsed to its tab.
  // `opening` is the reader pressing Notebook, which asks to see it.
  let floating = false;
  let collapsed = false;
  let opening = false;

  // The top of the capital letters on an element's first line, in the
  // window: the box of its first character, moved down by the space its font
  // leaves above a capital. Two headings of different sizes then line up by
  // their capitals, the way the eye compares them, rather than by their boxes
  // (a larger font leaves more room above its capitals).
  const measure = document.createElement("canvas").getContext("2d");
  // Text a reader doesn't see is skipped: the glossary's entry headings open
  // with an off-screen label for the site search (.sr-only), which would
  // otherwise stand in for the heading's first letter.
  const visibleText = (n) =>
    /\S/.test(n.nodeValue) && !n.parentElement?.closest(".sr-only, [hidden]");
  const capTop = (el) => {
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, {
      acceptNode: (n) => (visibleText(n) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP),
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

  function setShift(next) {
    if (next === shift) return;
    shift = next;
    for (const el of moveEls) el.style.translate = next ? `${-next}px 0` : "";
  }

  // Down to EDGE above the bottom of the window, wherever the panel's top is.
  function fitHeight() {
    panel.style.height = `${panelHeight(rail.getBoundingClientRect(), window.innerHeight)}px`;
  }

  function place() {
    const before = { floating, collapsed };
    if (!open) {
      setShift(0);
      rail.hidden = true;
      floating = collapsed = false;
      root.style.removeProperty("--desk-dock-width");
      root.style.removeProperty("--desk-bar-center");
      report(before);
      return;
    }
    const viewport = root.clientWidth;
    const m = { viewport, column: columnBox(), main: main.getBoundingClientRect(), shift };
    const at = placeInMargin(m);
    const wasFloating = floating;
    floating = at.over;
    collapsed = nextCollapsed({ floating, wasFloating, collapsed, opening });
    opening = false;
    let box = at;
    if (floating) {
      const f = placeFloating(m);
      box = { ...(collapsed ? f.tab : f.panel), shift: f.shift };
    }
    setShift(box.shift);

    // Measured after the move, in document coordinates. The panel is shown
    // first so its own heading can be measured: the rail starts that far
    // above the page's heading. The collapsed tab starts level with the top
    // of the heading's capitals.
    rail.style.left = `${box.left + window.scrollX}px`;
    rail.style.width = `${box.width}px`;
    rail.classList.toggle("desk-rail--floating", floating);
    rail.classList.toggle("desk-rail--collapsed", collapsed);
    rail.hidden = false;
    const top = startEl
      ? startEl.getBoundingClientRect().top + window.scrollY
      : collapsed
        ? capTop(titleEl) + window.scrollY
        : capTop(titleEl) + window.scrollY - (capTop(panelTitle) - panel.getBoundingClientRect().top);
    const bottom = endY();
    rail.style.top = `${top}px`;
    rail.style.height = `${Math.max(0, bottom - top)}px`;
    if (!collapsed) fitHeight();

    // For the floating panels (desk-frame.js) and the undo bar. From the
    // window's edge, scrollbar included, since that's what lit-panel.js
    // measures against (window.innerWidth).
    root.style.setProperty("--desk-dock-width", `${window.innerWidth - box.left}px`);
    const col = columnBox();
    root.style.setProperty("--desk-bar-center", `${(col.left + col.right) / 2}px`);
    report(before);
  }

  function report(before) {
    if (before.floating !== floating || before.collapsed !== collapsed) onChange({ floating, collapsed });
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
      if (!open || collapsed || fitting) return;
      fitting = true;
      requestAnimationFrame(() => {
        fitting = false;
        fitHeight();
      });
    },
    { passive: true },
  );

  return {
    // `expand`: the reader asked to see it, so it opens expanded even in a
    // narrow window. Restoring it on a new page doesn't.
    show({ expand = false } = {}) {
      open = true;
      opening = expand;
      place();
    },
    hide() {
      open = false;
      place();
    },
    collapse() {
      if (!floating || collapsed) return;
      collapsed = true;
      place();
      onChange({ floating, collapsed });
    },
    expand() {
      if (!collapsed) return;
      collapsed = false;
      place();
      onChange({ floating, collapsed });
    },
    state: () => ({ floating, collapsed }),
  };
}
