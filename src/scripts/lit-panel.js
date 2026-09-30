// src/scripts/lit-panel.js
//
// The floating panel shared by every reader tool: the Study View verse menu,
// footnote popovers and selection panel (chapter-tools.js), and scripture
// reference previews (ref-preview.js). ONE panel is open at a time across all
// of them: opening any panel closes the last, and an outside click or Escape
// closes it (Escape only, for a persistent one: the verse menu on a phone). Moved here unchanged from chapter-tools.js when the previews
// arrived (2026-09), so two modules could not each believe they owned the
// screen. Styles are the .lit-panel rules in global.css.

let openPanel = null;

/**
 * The open panel's record ({ el, trigger, restoreFocus, onClose, ...extra }),
 * or null. Callers may set fields on it (restoreFocus, acting); it is the live
 * object, not a copy.
 */
export function currentPanel() {
  return openPanel;
}

export function closePanel() {
  if (!openPanel) return;
  const { el, restoreFocus, onClose } = openPanel;
  openPanel = null;
  el.remove();
  if (onClose) onClose();
  if (restoreFocus && document.contains(restoreFocus)) restoreFocus.focus();
}

document.addEventListener("click", (e) => {
  if (openPanel && !openPanel.persistent && !openPanel.el.contains(e.target) && e.target !== openPanel.trigger && !openPanel.trigger?.contains?.(e.target)) {
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
 * document-relative {left, top}. A `persistent` panel ignores outside clicks,
 * so the page stays usable around it; it needs a close button of its own.
 */
export function showPanel(trigger, el, { restoreFocus = null, onClose = null, extra = null, preferAbove = false, place = null, persistent = false } = {}) {
  closePanel();
  el.classList.add("lit-panel");

  if (place) {
    document.body.appendChild(el);
    const { left, top } = place(el);
    el.style.left = left + "px";
    el.style.top = top + "px";
  } else if (isSmallScreen()) {
    el.classList.add("lit-panel--sheet");
    document.body.appendChild(el);
  } else {
    document.body.appendChild(el);
    const rect = trigger.getBoundingClientRect();
    const panelWidth = Math.min(380, window.innerWidth - 24);
    el.style.maxWidth = panelWidth + "px";
    const width = el.offsetWidth;
    let left = window.scrollX + rect.left + rect.width / 2 - width / 2;
    left = Math.max(window.scrollX + 12, Math.min(left, window.scrollX + window.innerWidth - width - 12));
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

  openPanel = { el, trigger, restoreFocus, onClose, persistent, ...extra };
  return el;
}
