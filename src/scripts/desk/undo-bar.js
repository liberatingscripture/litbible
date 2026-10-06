// src/scripts/desk/undo-bar.js
//
// Deleting in the notebook never asks first; it says what went and offers
// Undo from one bar (STUDY-DESK.md, phase 1b: Android's practice, A-M12).
//
// The bar has no timeout. Until the trash list exists (M7), it is the only
// way back from a deletion, and an undo that disappears on a timer is one a
// slow reader or a screen-reader user can miss (WCAG 2.2.1). It stays until
// it is closed, a later deletion replaces it, or the reader leaves the page.
// The trash record keeps the deletion for 30 days either way.
//
// What it says is announced through a live region that is always in the page
// and never hidden: a region that appears at the moment it speaks, or sits
// inside something just unhidden, often isn't announced. The caller decides
// where focus goes.

let root = null;

function build() {
  const el = document.createElement("div");
  el.className = "desk-undo";
  // Part of the desk's frame: clicks here don't close a floating panel, and
  // the single-key shortcuts stand down while focus is on its buttons.
  el.setAttribute("data-desk-dock", "");
  el.innerHTML = `
    <p class="sr-only" role="status" data-undo-live></p>
    <div class="desk-undo__bar" hidden>
      <p class="desk-undo__text" id="deskUndoText"></p>
      <button type="button" class="desk-undo__undo" aria-describedby="deskUndoText">Undo</button>
      <button type="button" class="desk-undo__close" aria-label="Close">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor"
             stroke-width="2" stroke-linecap="round" aria-hidden="true" focusable="false">
          <path d="M6 6l12 12M18 6 6 18" />
        </svg>
      </button>
    </div>`;
  document.body.appendChild(el);
  el.querySelector(".desk-undo__close").addEventListener("click", hideUndo);
  return el;
}

/** Put the bar in the page ahead of the first deletion (see above). */
export function initUndo() {
  root ??= build();
}

function say(message) {
  const live = root.querySelector("[data-undo-live]");
  // Emptied first, so the same message twice is still announced. A timeout
  // rather than a frame: a frame never comes in a tab that isn't showing.
  live.textContent = "";
  setTimeout(() => { live.textContent = message; }, 50);
}

/**
 * Show the bar for one deletion. `onUndo` runs when Undo is pressed; it may
 * return a promise, and the bar says so if that rejects.
 */
export function showUndo(message, onUndo) {
  initUndo();
  const bar = root.querySelector(".desk-undo__bar");
  const text = root.querySelector(".desk-undo__text");
  const undo = root.querySelector(".desk-undo__undo");
  // A fresh button each time, so an older deletion's handler can't linger.
  const fresh = undo.cloneNode(true);
  undo.replaceWith(fresh);
  fresh.addEventListener("click", async () => {
    fresh.disabled = true;
    try {
      await onUndo();
      hideUndo();
      say("Undone.");
    } catch (err) {
      console.error("Study Desk: undo failed", err);
      text.textContent = "That couldn't be undone.";
      say(text.textContent);
      fresh.disabled = false;
    }
  });
  text.textContent = message;
  bar.hidden = false;
  say(message);
}

export function hideUndo() {
  root?.querySelector(".desk-undo__bar")?.setAttribute("hidden", "");
}
