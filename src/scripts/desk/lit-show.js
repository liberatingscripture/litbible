// src/scripts/desk/lit-show.js
//
// "Show" on the LIT pane's bar (E108; BVJ, 2026-11-12): the four switches
// that mark up the LIT text (src/lib/desk-lit-marks.mjs: verse and chapter
// numbers, footnote letters, key terms, my highlights), on the pane they
// change. Until then they sat in the Display tray, which on /desk opens from
// the title's menu, a menu inside a menu, where BVJ expected no one to find
// them. The tray keeps what reaches every pane (font, theme, text size, line
// spacing, keyboard).
//
// One worded button at the end of the bar (an eye alone where the pane is
// narrow, so the passage field keeps its room) opens a small menu of four
// checkboxes. A press keeps the menu open, so several can be set in one
// visit, and the text behind it changes at once. **The switches are the
// pane's own** (BVJ, the same day): the pane says what it shows (`isOn`) and
// takes each change (`set`), so two LIT panes side by side can differ, and
// this file keeps nothing.
//
// "My highlights" is checked when the pane draws them: its own switch, and
// not while "Hide my marks" (the key H) has everything of the reader's
// hidden. Checking it then shows highlights again, as turning any one switch
// back on does while everything is hidden (note-settings.js: the most recent
// action wins).
//
// The menu is put on <body>, fixed to the window under its button, since the
// pane clips; a scroll that moves the button, a new window size, a press
// elsewhere, Tab or Escape closes it.

import { LIT_MARKS } from "../../lib/desk-lit-marks.mjs";
import { make } from "./dom.js";
import { describeUnavailable } from "./menu-reasons.js";
import { SETTINGS_EVENT, allHidden, highlightSetting, highlightsSupported, setSetting } from "./note-settings.js";
import { setTip } from "../tip.js";

const ICON_CARET = `<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor"
  stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
  <path d="M6 9l6 6 6-6" /></svg>`;

const ICON_CHECK = `<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor"
  stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
  <path d="M5 12.5l4.5 4.5L19 7.5" /></svg>`;

// An eye, for a pane too narrow for the word (desk.css): the bar's passage
// field keeps the room. Decorative: the button names itself.
const ICON_EYE = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor"
  stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
  <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7z" /><circle cx="12" cy="12" r="3" /></svg>`;

const MENU_NAME = "Show in this pane";

let seq = 0;

/**
 * @param {{ isOn: (id: string) => boolean, set: (id: string, on: boolean) => void }} pane
 *   The pane's own switches, by mark id: whether it shows a mark, and the
 *   change to make.
 * @returns {{ el: HTMLButtonElement, sync: () => void,
 *   close: (options?: { focus?: boolean }) => void, destroy: () => void }}
 *   `el` is the button, for the pane's bar; `sync` reads the pane again, for a
 *   change made elsewhere (the Reading arrangement) while the menu is open.
 */
export function createShowButton({ isOn, set }) {
  const n = ++seq;
  const button = make("button", "desk-lit__show");
  button.type = "button";
  button.setAttribute("aria-haspopup", "menu");
  button.setAttribute("aria-expanded", "false");
  // The name starts with the word on the button, and says what it is about.
  button.setAttribute("aria-label", MENU_NAME);
  const eye = make("span", "desk-lit__show-glyph");
  eye.innerHTML = ICON_EYE;
  const caret = make("span", "desk-lit__show-caret");
  caret.innerHTML = ICON_CARET;
  button.append(eye, make("span", "desk-lit__show-word", "Show"), caret);
  // The name again, for the eye: in a narrow pane the button is a glyph (E72).
  setTip(button, MENU_NAME);

  let open = null; // { menu, items, at, reasons } while the menu is open; `at` is where the button was

  // Highlights are drawn only while "Hide my marks" isn't hiding them.
  const shows = (mark) => isOn(mark.id) && !(mark.id === "highlights" && allHidden());

  function sync() {
    if (!open) return;
    for (const { b, mark } of open.items) b.setAttribute("aria-checked", String(shows(mark)));
  }

  function press(mark) {
    if (shows(mark)) {
      set(mark.id, false);
      return;
    }
    if (!isOn(mark.id)) set(mark.id, true);
    // Hidden with everything else of the reader's: asking for highlights here
    // brings highlights back, as any one switch does (note-settings.js).
    if (mark.id === "highlights" && allHidden()) setSetting(highlightSetting(), "on");
  }

  function close({ focus = true } = {}) {
    if (!open) return;
    const { menu, reasons } = open;
    open = null;
    document.removeEventListener("pointerdown", outside, true);
    document.removeEventListener(SETTINGS_EVENT, sync);
    window.removeEventListener("scroll", moved, true);
    window.removeEventListener("resize", moved);
    reasons.destroy();
    menu.remove();
    button.setAttribute("aria-expanded", "false");
    button.removeAttribute("aria-controls");
    if (focus) button.focus({ preventScroll: true });
  }

  // A press on the button is the button's own: its click toggles.
  const outside = (e) => {
    if (open && !open.menu.contains(e.target) && !button.contains(e.target)) close({ focus: false });
  };
  // The page or the panes box scrolling, or a new window size, would leave
  // the menu beside nothing. A scroll that leaves the button where it was
  // keeps the menu: the pane's own text scrolls under it, and a press here
  // makes the pane put its verse back with a scroll of its own.
  const moved = (e) => {
    if (!open) return;
    if (e.type === "scroll") {
      const r = button.getBoundingClientRect();
      if (Math.abs(r.right - open.at.right) < 1 && Math.abs(r.bottom - open.at.bottom) < 1) return;
    }
    close({ focus: false });
  };

  function place(menu) {
    const r = button.getBoundingClientRect();
    const gap = 2;
    const edge = 8;
    const height = menu.offsetHeight;
    const below = window.innerHeight - r.bottom - gap - edge;
    const above = r.top - gap - edge;
    const down = height <= below || (height > above && below >= above);
    if (height > (down ? below : above)) menu.style.maxHeight = `${Math.max(down ? below : above, 0)}px`;
    menu.style.top = down ? `${r.bottom + gap}px` : `${Math.max(edge, r.top - gap - Math.min(height, above))}px`;
    // Its right edge under the button's, which ends the bar.
    const left = Math.min(r.right - menu.offsetWidth, window.innerWidth - menu.offsetWidth - edge);
    menu.style.left = `${Math.max(edge, left)}px`;
  }

  function show() {
    const menu = make("div", "desk-pane__menu desk-lit-show");
    menu.id = `deskLitShow${n}`;
    menu.setAttribute("role", "menu");
    menu.setAttribute("aria-label", MENU_NAME);
    const items = LIT_MARKS.map((mark) => {
      const b = make("button", "desk-pane__menu-item desk-lit-show__item");
      b.type = "button";
      b.tabIndex = -1;
      b.setAttribute("role", "menuitemcheckbox");
      const box = make("span", "desk-lit-show__box");
      box.setAttribute("aria-hidden", "true");
      box.innerHTML = ICON_CHECK;
      b.append(box, make("span", "desk-title__label", mark.label));
      // This browser can't draw highlights (LG-5): say so rather than offer a
      // switch that does nothing.
      if (mark.id === "highlights" && !highlightsSupported()) {
        b.setAttribute("aria-disabled", "true");
        b.append(make("span", "desk-title__hint", "This browser can’t draw them"));
      }
      b.addEventListener("click", () => {
        if (b.getAttribute("aria-disabled") === "true") return;
        press(mark);
        sync();
      });
      menu.append(b);
      return { b, mark };
    });
    const live = () => items.map((item) => item.b).filter((b) => b.getAttribute("aria-disabled") !== "true");
    menu.addEventListener("keydown", (e) => {
      const on = live();
      const i = on.indexOf(document.activeElement);
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        on[(i + (e.key === "ArrowDown" ? 1 : on.length - 1)) % on.length]?.focus();
      } else if (e.key === "Home" || e.key === "End") {
        e.preventDefault();
        on[e.key === "Home" ? 0 : on.length - 1]?.focus();
      } else if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        close();
      } else if (e.key === "Tab") {
        // Focus goes back to the button first, so Tab moves on from the bar,
        // not from the end of the page, where the menu sits.
        close();
      }
    });
    document.body.append(menu);
    const { right, bottom } = button.getBoundingClientRect();
    open = { menu, items, at: { right, bottom }, reasons: describeUnavailable(menu, { id: `${menu.id}-reasons` }) };
    sync();
    place(menu);
    button.setAttribute("aria-expanded", "true");
    button.setAttribute("aria-controls", menu.id);
    document.addEventListener("pointerdown", outside, true);
    document.addEventListener(SETTINGS_EVENT, sync);
    window.addEventListener("scroll", moved, { capture: true, passive: true });
    window.addEventListener("resize", moved);
    live()[0]?.focus({ preventScroll: true });
  }

  button.addEventListener("click", () => (open ? close() : show()));

  return { el: button, sync, close, destroy: () => close({ focus: false }) };
}
