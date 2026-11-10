// src/scripts/tip.js
//
// One tooltip for the site's icon-only controls (E72; STUDY-DESK-FIXES.md,
// 2026-11-10). The browser's own (`title`) never shows on keyboard focus or
// on touch and is slow on hover, so a glyph with no words told a keyboard
// reader nothing it could see. This one shows on hover, after a short pause,
// and at once on keyboard focus, and meets WCAG 1.4.13: Escape dismisses it
// without moving focus or the pointer, the pointer can move onto it without
// its closing, and it stays until the pointer or focus leaves (or a press,
// a scroll, or Escape).
//
// A control opts in with `setTip(el, text)`, which sets `data-tip` and an
// empty `title` (two tooltips at once would be the browser's and this; an
// empty one also stops an ancestor's title showing). The
// words are for the eye: the control's accessible name already says what it
// does, so the tooltip is `aria-hidden`. Keep the name and the tip in step;
// a tip may add the state in words ("Pin footnote a (pinned)"), never
// something a screen reader needs and doesn't get.
//
// A finger gets no tooltip (there is no hover, and a tap is the press).
// Listeners go on the document once, the first time a tip is set, so a page
// with no tipped control pays nothing. Reader code and the Study Desk both
// import this; it imports nothing.

const SHOW_DELAY = 350; // ms of hover before the tip shows
const HIDE_GRACE = 120; // ms to cross from the control to the tip
const EDGE = 8;
const GAP = 6;

let tip = null; // the one tooltip element, made on first show
let target = null; // the control it is showing for
let showTimer = 0;
let hideTimer = 0;
let watch = 0;
let installed = false;

/**
 * Give a control a tooltip, or change its words. An empty `text` removes it.
 * @param {Element} el
 * @param {string} text
 */
export function setTip(el, text) {
  if (!el) return;
  if (!text) {
    el.removeAttribute("title");
    el.removeAttribute("data-tip");
    if (target === el) hide();
    return;
  }
  // An empty title, not none: it keeps an ancestor's title (a pane header's
  // "Drag to move this pane") from showing over this tip.
  el.setAttribute("title", "");
  el.setAttribute("data-tip", text);
  if (target === el && tip && !tip.hidden) tip.textContent = text;
  install();
}

const tipped = (node) => (node instanceof Element ? node.closest("[data-tip]") : null);

function make() {
  tip = document.createElement("div");
  tip.className = "lit-tip";
  tip.setAttribute("aria-hidden", "true");
  tip.hidden = true;
  // Hoverable: the pointer can rest on the tip (WCAG 1.4.13).
  tip.addEventListener("pointerenter", () => clearTimeout(hideTimer));
  tip.addEventListener("pointerleave", () => scheduleHide());
  document.body.append(tip);
}

function place() {
  if (!tip || !target) return;
  const r = target.getBoundingClientRect();
  const t = tip.getBoundingClientRect();
  // Below the control, centered on it; above it where there is no room below.
  let top = r.bottom + GAP;
  if (top + t.height > innerHeight - EDGE) top = Math.max(EDGE, r.top - GAP - t.height);
  let left = r.left + r.width / 2 - t.width / 2;
  left = Math.min(Math.max(EDGE, left), Math.max(EDGE, innerWidth - EDGE - t.width));
  tip.style.top = `${Math.round(top)}px`;
  tip.style.left = `${Math.round(left)}px`;
}

function show(el) {
  clearTimeout(showTimer);
  clearTimeout(hideTimer);
  const text = el.getAttribute("data-tip");
  if (!text || !el.isConnected) return;
  if (!tip) make();
  target = el;
  tip.textContent = text;
  tip.hidden = false;
  place();
  // A control taken off the page while its tip shows (a popover closing, a
  // pane redrawn) takes the tip with it.
  clearInterval(watch);
  watch = setInterval(() => {
    if (!target?.isConnected) hide();
  }, 400);
}

function hide() {
  clearTimeout(showTimer);
  clearTimeout(hideTimer);
  clearInterval(watch);
  target = null;
  if (tip) tip.hidden = true;
}

function scheduleHide() {
  clearTimeout(showTimer);
  clearTimeout(hideTimer);
  hideTimer = setTimeout(hide, HIDE_GRACE);
}

function install() {
  if (installed || typeof document === "undefined") return;
  installed = true;
  document.addEventListener("pointerover", (e) => {
    if (e.pointerType === "touch") return;
    const el = tipped(e.target);
    if (tip?.contains(e.target)) return;
    if (!el) return;
    clearTimeout(hideTimer);
    if (el === target && !tip.hidden) return;
    clearTimeout(showTimer);
    // A tip already up moves to the next control at once, as menus' do.
    if (tip && !tip.hidden) show(el);
    else showTimer = setTimeout(() => show(el), SHOW_DELAY);
  });
  document.addEventListener("pointerout", (e) => {
    const el = tipped(e.target);
    if (!el) return;
    const to = e.relatedTarget;
    if (to instanceof Node && (el.contains(to) || tip?.contains(to))) return;
    if (el === target) scheduleHide();
    else clearTimeout(showTimer);
  });
  // Keyboard focus shows it at once; a click's focus doesn't (:focus-visible).
  document.addEventListener("focusin", (e) => {
    const el = tipped(e.target);
    if (el && el === e.target && el.matches(":focus-visible")) show(el);
  });
  document.addEventListener("focusout", (e) => {
    if (target && e.target === target) hide();
  });
  // Dismissible without moving focus. The key still reaches whatever else
  // listens for it (a popover's Escape still closes the popover).
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && target) hide();
  }, true);
  document.addEventListener("pointerdown", (e) => {
    if (!tip?.contains(e.target)) hide();
  }, true);
  addEventListener("scroll", () => target && hide(), { capture: true, passive: true });
  addEventListener("resize", () => target && hide());
}
