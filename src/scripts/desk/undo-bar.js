// src/scripts/desk/undo-bar.js
//
// The notebook's one notice bar. A deletion never asks first; it says what went
// and offers Undo from here (STUDY-DESK.md, phase 1b: Android's practice,
// A-M12). Since the history (history.js) took over, the bar speaks for every
// change that is taken back or done again as well: "Undone: note on Romans 8:3
// added." with a Redo button, "Redone: ..." with Undo, and a plain notice with
// no button when a change can't be taken back any more. Ctrl+Z and the bar's
// button are the same thing; the bar only asks the history.
//
// It closes by itself after CLOSE_AFTER_MS (BVJ, 2026-10-09), and never
// while the pointer is over it or focus is on its buttons; it starts the full
// time again when they leave. It had no timeout at first, because it was the
// only way back from a deletion and an undo that disappears on a timer is one
// a slow reader or a screen-reader user can miss (WCAG 2.2.1). Ctrl+Z
// (history.js) changed that: the bar going takes nothing away, since the
// same undo stays on the key for the rest of the visit, and the trash record
// keeps a deletion for 30 days either way.
//
// What it says is announced through a live region that is always in the page
// and never hidden: a region that appears at the moment it speaks, or sits
// inside something just unhidden, often isn't announced. The caller decides
// where focus goes.

let root = null;

// Counts the notices shown. A button's action may put up a notice of its own
// (the history does: pressing Undo shows "Undone: ..." with Redo), and the
// bar must then leave that one standing instead of closing it as "done".
let shown = 0;

/** How long a notice stays before the bar closes by itself. */
export const CLOSE_AFTER_MS = 10_000;

let clock = 0;
let held = false; // the pointer is over the bar, or focus is in it

/** Start the closing time again for whichever notice is showing. */
function startClock() {
  clearTimeout(clock);
  if (held) return;
  const notice = shown;
  clock = setTimeout(() => {
    // Asked again when the time is up, not only by the events below: a
    // focus or pointer event can go missing (a window without focus fires
    // none), and a bar in use must never close under the reader.
    const bar = root?.querySelector(".desk-undo__bar");
    if (bar && (bar.matches(":hover") || bar.contains(document.activeElement))) {
      startClock();
      return;
    }
    hideUndo(notice);
  }, CLOSE_AFTER_MS);
}

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
      <button type="button" class="desk-undo__undo" aria-describedby="deskUndoText" hidden></button>
      <button type="button" class="desk-undo__close" aria-label="Close">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor"
             stroke-width="2" stroke-linecap="round" aria-hidden="true" focusable="false">
          <path d="M6 6l12 12M18 6 6 18" />
        </svg>
      </button>
    </div>`;
  document.body.appendChild(el);
  el.querySelector(".desk-undo__close").addEventListener("click", () => hideUndo());
  // Held open while it is being read or used. Checked after the event, since
  // focus moving between the bar's own buttons passes through "out".
  const bar = el.querySelector(".desk-undo__bar");
  const hold = () => {
    held = true;
    clearTimeout(clock);
  };
  const release = () =>
    setTimeout(() => {
      held = bar.matches(":hover") || bar.contains(document.activeElement);
      if (!held && !bar.hidden) startClock();
    });
  bar.addEventListener("pointerenter", hold);
  bar.addEventListener("focusin", hold);
  bar.addEventListener("pointerleave", release);
  bar.addEventListener("focusout", release);
  return el;
}

/** Put the bar in the page ahead of the first deletion (see above). */
export function initUndo() {
  root ??= build();
}

/**
 * Say something through the live region alone, with no bar: for a keypress
 * that did nothing ("Nothing to undo.") and so has nothing to offer.
 */
export function announce(message) {
  initUndo();
  const live = root.querySelector("[data-undo-live]");
  // Emptied first, so the same message twice is still announced. A timeout
  // rather than a frame: a frame never comes in a tab that isn't showing.
  live.textContent = "";
  setTimeout(() => { live.textContent = message; }, 50);
}

/** What the bar says when its button has done its work and put up nothing else. */
const DONE = { Undo: "Undone.", Redo: "Redone." };

/**
 * Show the bar for one change, with a button that takes it back or does it
 * again. `onAction` runs when the button is pressed; it may return a promise,
 * and the bar says so if that rejects. When it finishes, the bar closes, unless
 * `onAction` put up a notice of its own, which is left alone.
 *
 * @param {string} message
 * @param {() => unknown} onAction
 * @param {{ label?: string }} [options] the button's name; "Undo" by default
 * @returns {number} this notice's number, for hideUndo to take down just it
 */
export function showUndo(message, onAction, { label = "Undo" } = {}) {
  initUndo();
  const mine = ++shown;
  const bar = root.querySelector(".desk-undo__bar");
  const text = root.querySelector(".desk-undo__text");
  // A fresh button each time, so an older notice's handler can't linger.
  const fresh = document.createElement("button");
  fresh.type = "button";
  fresh.className = "desk-undo__undo";
  fresh.setAttribute("aria-describedby", "deskUndoText");
  fresh.textContent = label;
  root.querySelector(".desk-undo__undo").replaceWith(fresh);
  fresh.addEventListener("click", async () => {
    fresh.disabled = true;
    try {
      await onAction();
      if (shown === mine) {
        hideUndo();
        announce(DONE[label] ?? "Done.");
      }
    } catch (err) {
      console.error(`Study Desk: ${label.toLowerCase()} failed`, err);
      if (shown !== mine) return;
      text.textContent = `That couldn’t be ${label === "Redo" ? "redone" : "undone"}.`;
      announce(text.textContent);
      fresh.disabled = false;
    }
  });
  text.textContent = message;
  bar.hidden = false;
  announce(message);
  startClock();
  return mine;
}

/**
 * Show the bar with just a notice and the close button: for a change that
 * can't be taken back or done again (it was overtaken), which a sighted
 * reader who pressed Ctrl+Z needs to see. Returns the notice's number, as
 * showUndo does.
 */
export function showNotice(message) {
  initUndo();
  shown++;
  const button = root.querySelector(".desk-undo__undo");
  // Replaced rather than hidden in place, so a press already under way can't
  // act on a notice that is no longer its own.
  const gone = document.createElement("button");
  gone.type = "button";
  gone.className = "desk-undo__undo";
  gone.hidden = true;
  button.replaceWith(gone);
  root.querySelector(".desk-undo__text").textContent = message;
  root.querySelector(".desk-undo__bar").hidden = false;
  announce(message);
  startClock();
  return shown;
}

/**
 * Close the bar. Given the number showUndo or showNotice returned, it closes
 * the bar only if that notice is still the one showing, so a caller taking
 * down its own notice can't close a newer one.
 */
export function hideUndo(notice) {
  if (notice !== undefined && notice !== shown) return;
  clearTimeout(clock);
  root?.querySelector(".desk-undo__bar")?.setAttribute("hidden", "");
}
