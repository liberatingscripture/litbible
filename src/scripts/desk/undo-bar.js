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

import { busy, isBusy } from "./focus-keep.js";

let root = null;

// Counts the notices shown. A button's action may put up a notice of its own
// (the history does: pressing Undo shows "Undone: ..." with Redo), and the
// bar must then leave that one standing instead of closing it as "done".
let shown = 0;

/** How long a notice stays before the bar closes by itself. */
export const CLOSE_AFTER_MS = 10_000;

let clock = 0;
let returnTo = null; // where focus was when the notice came up, for when the bar closes with focus in it
let held = false; // the pointer is over the bar, or focus is in it
let stays = false; // the notice showing is a keyless one: no closing time (E131)
let onCloseHandler = null; // what the × does besides closing, for a bar of choices (E113)

/** The modifier the reader presses: ⌘ on a Mac, Ctrl elsewhere. For labels and the spoken notice. */
export function undoModifier() {
  const platform = navigator.userAgentData?.platform || navigator.platform || "";
  return /mac/i.test(platform) ? "⌘" : "Ctrl";
}

/** Start the closing time again for whichever notice is showing. */
function startClock() {
  clearTimeout(clock);
  if (held || stays) return;
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
  el.querySelector(".desk-undo__close").addEventListener("click", () => {
    // A bar of choices (showChoices) answers its ×, as "Remind me tomorrow" does.
    const closing = onCloseHandler;
    onCloseHandler = null;
    hideUndo();
    closing?.();
  });
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
const DONE = { Undo: "Undone.", Redo: "Redone.", "Show notes": "Notes showing.", "Show bookmarks": "Bookmarks showing.", "Move it here": "Moved.", "Open the Notebook": "The Notebook is open." };

/** Whether the bar is up now, with a notice a newer one would replace (E74 never does). */
export function barShowing() {
  return Boolean(root && !root.querySelector(".desk-undo__bar")?.hidden);
}

/**
 * Show the bar for one change, with a button that takes it back or does it
 * again. `onAction` runs when the button is pressed; it may return a promise,
 * and the bar says so if that rejects. When it finishes, the bar closes, unless
 * `onAction` put up a notice of its own, which is left alone.
 *
 * @param {string} message
 * @param {() => unknown} onAction
 * @param {{ label?: string, link?: { label: string, href: string } | null, keyless?: boolean }} [options]
 *   `label` is the button's name, "Undo" by default; `link` puts a link after
 *   it that opens in a new tab ("Open the sheet", S12), for this notice only;
 *   `keyless` is for a bar whose Undo is not on Ctrl+Z (a layout change writes
 *   no history entry, E131): it never names the key and never closes by
 *   itself, only on Close, its button, or the next notice
 * @returns {number} this notice's number, for hideUndo to take down just it
 */
export function showUndo(message, onAction, { label = "Undo", link = null, keyless = false } = {}) {
  initUndo();
  noteFocus();
  const mine = ++shown;
  stays = keyless;
  onCloseHandler = null;
  dropLink();
  const bar = root.querySelector(".desk-undo__bar");
  const text = root.querySelector(".desk-undo__text");
  // A fresh button each time, so an older notice's handler can't linger.
  const fresh = document.createElement("button");
  fresh.type = "button";
  fresh.className = "desk-undo__undo";
  fresh.setAttribute("aria-describedby", "deskUndoText");
  fresh.textContent = label;
  const old = root.querySelector(".desk-undo__undo");
  const hadFocus = document.activeElement === old;
  old.replaceWith(fresh);
  // A keyboard Undo that puts up a Redo keeps its place on the bar.
  if (hadFocus) fresh.focus({ preventScroll: true });
  if (link) fresh.after(linkEl(link));
  fresh.addEventListener("click", async () => {
    // aria-disabled, not disabled: the button is focused, and a focused button
    // that is disabled loses focus in some browsers (NB3-8).
    if (isBusy(fresh)) return;
    const idle = busy(fresh);
    try {
      await onAction();
      if (shown === mine) {
        hideUndo();
        announce(DONE[label] ?? "Done.");
      }
    } catch (err) {
      console.error(`Study Desk: ${label.toLowerCase()} failed`, err);
      if (shown !== mine) return;
      text.textContent = `That couldn’t be ${label === "Redo" ? "redone" : "undone"}, so nothing changed. Try again.`;
      announce(text.textContent);
      idle();
    }
  });
  text.textContent = message;
  bar.hidden = false;
  // The bar is the last thing in the page, out of a keyboard reader's reach
  // in ten seconds, so what is spoken names the key that is (NB-5).
  const mod = undoModifier();
  announce(label === "Undo" && !keyless ? `${message} Press ${mod === "Ctrl" ? "Ctrl+Z" : "⌘Z"} to undo.` : message);
  startClock();
  return mine;
}

/**
 * Show the bar with several buttons, then an optional quiet link, then the ×
 * (E113's backup reminder). Each choice is `{ label, primary?, quiet?, onPress }`;
 * a primary one is the bar's one green button, a quiet one reads as a link.
 * `onPress` may return a promise. When it finishes the bar closes, unless it
 * put up a notice of its own, which is left alone; one that rejects says so
 * on the bar and leaves the choices to try again. `onClose` runs when the ×
 * is pressed. The bar stays until answered, closed or replaced (as
 * `keyless` does), and wraps its buttons to further lines in a narrow window.
 *
 * @param {string} message
 * @param {Array<{ label: string, primary?: boolean, quiet?: boolean, onPress: () => unknown }>} choices
 * @param {{ onClose?: (() => void) | null }} [options]
 * @returns {number} this notice's number, for hideUndo to take down just it
 */
export function showChoices(message, choices, { onClose = null } = {}) {
  initUndo();
  noteFocus();
  const mine = ++shown;
  stays = true;
  dropLink();
  const bar = root.querySelector(".desk-undo__bar");
  const text = root.querySelector(".desk-undo__text");
  const old = root.querySelector(".desk-undo__undo");
  const gone = document.createElement("button");
  gone.type = "button";
  gone.className = "desk-undo__undo";
  gone.hidden = true;
  old.replaceWith(gone);
  const group = document.createElement("div");
  group.className = "desk-undo__choices";
  group.setAttribute("role", "group");
  group.setAttribute("aria-label", "Choices");
  const buttons = choices.map((c) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = c.quiet ? "desk-undo__quiet" : c.primary ? "desk-undo__choice--primary" : "desk-undo__choice";
    b.setAttribute("aria-describedby", "deskUndoText");
    b.textContent = c.label;
    b.addEventListener("click", async () => {
      if (isBusy(b)) return;
      const idle = busy(b);
      try {
        await c.onPress();
        if (shown === mine) hideUndo();
      } catch (err) {
        console.error(`Study Desk: ${c.label.toLowerCase()} failed`, err);
        if (shown !== mine) return;
        text.textContent = "That didn’t work. Try again.";
        announce(text.textContent);
        idle();
      }
    });
    return b;
  });
  group.append(...buttons);
  gone.after(group);
  onCloseHandler = onClose;
  text.textContent = message;
  bar.hidden = false;
  announce(message);
  startClock();
  return mine;
}

/** A link for the bar: opens in a new tab, and says so to a screen reader. */
function linkEl(link) {
  const a = document.createElement("a");
  a.className = "desk-undo__link";
  a.href = link.href;
  a.target = "_blank";
  a.rel = "noopener noreferrer";
  a.textContent = link.label;
  const tab = document.createElement("span");
  tab.className = "sr-only";
  tab.textContent = " (opens in a new tab)";
  a.append(tab);
  return a;
}

/**
 * Show the bar with just a notice and the close button: for a change that
 * can't be taken back or done again (it was overtaken), which a sighted
 * reader who pressed Ctrl+Z needs to see. Returns the notice's number, as
 * showUndo does. `link` puts a link after the words, as showUndo's does (E127:
 * "or open it on its page").
 */
export function showNotice(message, { link = null } = {}) {
  initUndo();
  noteFocus();
  shown++;
  stays = false;
  onCloseHandler = null;
  dropLink();
  const button = root.querySelector(".desk-undo__undo");
  // Replaced rather than hidden in place, so a press already under way can't
  // act on a notice that is no longer its own.
  const gone = document.createElement("button");
  gone.type = "button";
  gone.className = "desk-undo__undo";
  gone.hidden = true;
  const hadFocus = document.activeElement === button;
  button.replaceWith(gone);
  if (link) gone.after(linkEl(link));
  if (hadFocus) root.querySelector(".desk-undo__close").focus({ preventScroll: true });
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
  const bar = root?.querySelector(".desk-undo__bar");
  if (!bar) return;
  const hadFocus = bar.contains(document.activeElement);
  bar.setAttribute("hidden", "");
  if (hadFocus) giveFocusBack();
}

/** Take away the last notice's link and choices, if it had any; focus on one moves to Close. */
function dropLink() {
  for (const old of root.querySelectorAll(".desk-undo__link, .desk-undo__choices")) {
    if (old.contains(document.activeElement)) root.querySelector(".desk-undo__close").focus({ preventScroll: true });
    old.remove();
  }
}

/** Remember where focus is as a notice comes up (not in the bar, not on the page's body). */
function noteFocus() {
  const a = document.activeElement;
  if (a && a !== document.body && !root.contains(a)) returnTo = a;
  else if (!a || a === document.body) returnTo = null;
}

/**
 * The bar closed with focus on one of its buttons (a keyboard Undo, or Close),
 * which would leave focus on a hidden element and so on the page's body
 * (NB3-8). It goes back to where it was when the notice came up if that is
 * still showing, else to the page's main region, as the skip link does.
 */
function giveFocusBack() {
  const back = returnTo;
  returnTo = null;
  if (back?.isConnected && back.getClientRects().length && !back.closest("[hidden]")) {
    back.focus({ preventScroll: true });
    if (document.activeElement === back) return;
  }
  const main = document.getElementById("main-content");
  if (!main) return;
  if (!main.hasAttribute("tabindex")) main.setAttribute("tabindex", "-1");
  main.focus({ preventScroll: true });
}
