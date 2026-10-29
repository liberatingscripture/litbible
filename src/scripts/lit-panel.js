// src/scripts/lit-panel.js
//
// The floating panel shared by every reader tool: the Study View verse menu,
// footnote popovers and selection panel (chapter-tools.js), and scripture
// reference previews (ref-preview.js). ONE panel is open at a time across all
// of them: opening any panel closes the last, and an outside click or Escape
// closes it. Moved here unchanged from chapter-tools.js when the previews
// arrived (2026-09), so two modules could not each believe they owned the
// screen. Styles are the .lit-panel rules in global.css.
//
// The Study Desk's docked panel is not one of these: it is part of the page
// frame (audit C12). A click inside it doesn't close a floating panel, and a
// floating panel is placed clear of it.

import { inDock, panelRoom, shiftClearOfDock } from "./desk-frame.js";

let openPanel = null;

/**
 * The open panel's record ({ el, trigger, restoreFocus, onClose, ...extra }),
 * or null. Callers may set fields on it (restoreFocus, acting); it is the live
 * object, not a copy.
 */
export function currentPanel() {
  return openPanel;
}

/**
 * Move the open panel left, clear of the Notebook, after the Notebook grew
 * under it (BA28): desk/margin.js calls this when a placement widens the room
 * the Notebook keeps (expanding from its tab, a wider floating width). Moved,
 * not closed, since the panel may be a note editor holding unsaved words. A
 * bottom sheet spans the window and stays, as does a panel where the room left
 * is too small to hold one (panelRoom), and one the reader is dragging, whose
 * next move would put it back under the pointer.
 */
export function keepClearOfDock() {
  const el = openPanel?.el;
  if (!el || el.classList.contains("lit-panel--sheet") || el.classList.contains("lit-panel--dragging")) return;
  const by = shiftClearOfDock(el.getBoundingClientRect(), panelRoom());
  if (by) el.style.left = `${(parseFloat(el.style.left) || 0) - by}px`;
}

export function closePanel() {
  if (!openPanel) return;
  const { el, restoreFocus, onClose } = openPanel;
  openPanel = null;
  el.remove();
  if (onClose) onClose();
  if (restoreFocus && document.contains(restoreFocus)) restoreFocus.focus();
}

// An outside click closes without restoring focus: the reader has just put
// focus somewhere else (the search box, say), and handing it back to the
// trigger would steal it and scroll the page back to where the panel was.
// A panel opened with `extra: { stay: true }` (the Study Desk's note editor,
// which may hold unsaved words) ignores outside clicks; its own buttons and
// Escape close it.
document.addEventListener("click", (e) => {
  if (inDock(e.target)) return;
  if (openPanel?.stay) return;
  if (openPanel && !openPanel.el.contains(e.target) && e.target !== openPanel.trigger && !openPanel.trigger?.contains?.(e.target)) {
    openPanel.restoreFocus = null;
    closePanel();
  }
});

let escapeFallback = null;

/** What Escape does when no panel is open (Study View clears its highlight). */
export function setEscapeFallback(fn) {
  escapeFallback = fn;
}

document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape") return;
  if (openPanel) closePanel();
  else if (escapeFallback) escapeFallback();
});

export function isSmallScreen() {
  return window.matchMedia("(max-width: 640px)").matches;
}

/**
 * Show a panel near an inline trigger element (or as a bottom sheet on
 * small screens). Returns the panel element. The trigger only needs
 * getBoundingClientRect, so a selection can stand in for an element. `place`
 * overrides both layouts: it gets the attached panel and returns its
 * document-relative {left, top}. `sheet: false` keeps a small screen on the
 * floating layout, for a panel a mouse opened.
 *
 * A panel opened from text that scrolls inside its own box (a LIT pane on
 * /desk, marked `[data-panels-pin]`) is pinned to the screen where it opens,
 * as a dragged verse menu is, since its place in the document wouldn't move
 * with that text anyway (BA125; BVJ, 2026-10-26). `pinned` asks for the same
 * where the trigger is no element (a selection's rectangle).
 */
export function showPanel(trigger, el, { restoreFocus = null, onClose = null, extra = null, preferAbove = false, place = null, sheet = true, pinned = false } = {}) {
  closePanel();
  el.classList.add("lit-panel");

  if (place) {
    document.body.appendChild(el);
    const { left, top } = place(el);
    el.style.left = left + "px";
    el.style.top = top + "px";
  } else if (sheet && isSmallScreen()) {
    el.classList.add("lit-panel--sheet");
    document.body.appendChild(el);
  } else {
    document.body.appendChild(el);
    const rect = trigger.getBoundingClientRect();
    const room = panelRoom();
    const panelWidth = Math.min(380, room - 24);
    el.style.maxWidth = panelWidth + "px";
    const width = el.offsetWidth;
    let left = window.scrollX + rect.left + rect.width / 2 - width / 2;
    left = Math.max(window.scrollX + 12, Math.min(left, window.scrollX + room - width - 12));
    const height = el.offsetHeight;
    const fitsAbove = rect.top > height + 16;
    const fitsBelow = rect.bottom + height + 16 <= window.innerHeight;
    let top;
    if (preferAbove ? fitsAbove : !fitsBelow && fitsAbove) {
      // Above the trigger (the verse menu prefers this so the text that
      // follows — where the user taps to extend a selection — stays clear)
      top = window.scrollY + rect.top - height - 8;
    } else {
      top = window.scrollY + rect.bottom + 8;
    }
    // Final clamp: keep the panel fully inside the viewport even when
    // neither side has room (e.g. very long footnotes)
    top = Math.max(
      window.scrollY + 12,
      Math.min(top, window.scrollY + window.innerHeight - height - 12)
    );
    el.style.left = left + "px";
    el.style.top = top + "px";
  }

  const pin = pinned || (trigger instanceof Node && trigger.parentElement?.closest("[data-panels-pin]"));
  if (pin && !el.classList.contains("lit-panel--sheet")) {
    el.style.left = parseFloat(el.style.left) - window.scrollX + "px";
    el.style.top = parseFloat(el.style.top) - window.scrollY + "px";
    el.classList.add("lit-panel--pinned");
  }

  // Keep Tab cycling inside the panel while it's open (it's appended to the
  // end of <body>, so without this Tab would silently leave the dialog).
  // Escape closes and, for keyboard-opened panels, restores focus.
  el.addEventListener("keydown", (e) => {
    if (e.key !== "Tab") return;
    const focusables = el.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    if (!focusables.length) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (e.shiftKey && (document.activeElement === first || document.activeElement === el)) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  });

  openPanel = { el, trigger, restoreFocus, onClose, ...extra };
  return el;
}
