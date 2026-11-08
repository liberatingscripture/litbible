// src/scripts/desk/sheets/insert-menu.js
//
// The menu under a sheet card's gap "Add" pill (BVJ, 2026-11-08): the parts
// the add bar offers, each added right after that card, so a long sheet needn't
// be scrolled to its end. Taken out of sheet-pane.js's `createSheetPane`
// (Audit 6, LG6-2), as kind-menu.js and title-menu.js were out of
// desk-page.js's `start()`, so the next bug in it means reading this file, not
// 1,600 lines of shared locals.
//
// It takes what it needs and reaches for nothing else. What a pick does is the
// pane's (`onPick(type)`: "Passage…" opens the passage form under the card,
// anything else adds that part after it); the menu only closes first. One key
// terms box per sheet, as in the bar, so the caller says whether the sheet has
// one. Arrow keys, Home and End move, passing over the disabled line (DK3-7);
// Escape returns to the pill; a click elsewhere, Tab, focus leaving, a scroll
// or a resize closes it (DK6-2).
//
// - `button` the pill; it gets `aria-expanded` and `aria-controls`, and focus
//   back on Escape.
// - `id` the menu's element id (unique per pane and card).
// - `name` what the card is called, for the menu's accessible name.
// - `hasTerms` whether the sheet already holds a key terms box.
// - `onPick(type)` a part was chosen, after the menu closed.
// - `onClose(close)` the menu is closing; `close` is the handle's own, so the
//   pane can tell whether the menu it holds is this one.
//
// Returns `{ close(refocus) }`.

import { make } from "../dom.js";
import { describeUnavailable } from "../menu-reasons.js";

/**
 * The menu's lines, in order: label, part type, and for the key terms box
 * whether it is disabled and why.
 *
 * @param {boolean} hasTerms the sheet already holds a key terms box
 * @returns {{ label: string, type: string, disabled: boolean, why: string | null }[]}
 */
export function insertItems(hasTerms) {
  const line = (label, type, disabled = false, why = null) => ({ label, type, disabled, why });
  return [
    line("Passage…", "passage"),
    line("Your text", "text"),
    line("Question", "question"),
    line("Space to write", "space"),
    line("Page break", "pageBreak"),
    line("Key terms box", "keyTerms", !!hasTerms, hasTerms ? "already on the sheet" : null),
  ];
}

/**
 * Where the menu goes, in window pixels: under the pill where it fits, else
 * above it; kept 8px inside the window's sides.
 *
 * @param {{ left: number, top: number, bottom: number }} at the pill's rectangle
 * @param {number} w the menu's width
 * @param {number} h the menu's height
 * @param {{ width: number, height: number }} view the window's size
 */
export function insertMenuPlace(at, w, h, view) {
  const left = Math.max(8, Math.min(at.left, view.width - w - 8));
  const top = at.bottom + h + 8 <= view.height ? at.bottom + 4 : Math.max(8, at.top - h - 4);
  return { left, top };
}

export function openInsertMenu({ button, id, name, hasTerms, onPick, onClose }) {
  const menu = make("div", "desk-pane__menu desk-sheet__insert-menu");
  menu.setAttribute("role", "menu");
  menu.setAttribute("aria-label", `Add a part after ${name}`);
  menu.id = id;
  const items = [];
  // Removing the menu blurs its focused item, and the focusout below closes
  // too, so the second close must find nothing to do before the first has
  // removed anything, or remove() throws and the pick never runs (SH5-1).
  let closed = false;
  let reasons = null;
  const close = (refocus) => {
    if (closed) return;
    closed = true;
    onClose?.(close);
    document.removeEventListener("pointerdown", outside, true);
    document.removeEventListener("scroll", away, true);
    window.removeEventListener("resize", away);
    reasons?.destroy();
    menu.remove();
    button.setAttribute("aria-expanded", "false");
    button.removeAttribute("aria-controls");
    if (refocus) button.focus();
  };
  const outside = (e) => { if (!menu.contains(e.target) && e.target !== button) close(false); };
  // The menu is placed once, so any scroll or resize leaves it floating
  // away from its pill: close, as the pane menus do (DK6-2).
  const away = (e) => { if (!menu.contains(e.target)) close(false); };
  for (const { label, type, disabled, why } of insertItems(hasTerms)) {
    const b = make("button", "desk-pane__menu-item");
    b.type = "button";
    b.tabIndex = -1;
    b.setAttribute("role", "menuitem");
    b.append(make("span", "desk-title__label", label));
    if (disabled) {
      const hint = make("span", "desk-title__hint", why);
      hint.id = `${menu.id}-why`;
      b.append(hint);
      b.setAttribute("aria-disabled", "true");
      b.setAttribute("aria-describedby", hint.id);
    }
    b.addEventListener("click", () => {
      if (disabled) return;
      close(false);
      onPick(type);
    });
    menu.append(b);
    items.push(b);
  }
  // The arrow keys, Home and End pass over a disabled line (DK3-7).
  const live = () => items.filter((b) => b.getAttribute("aria-disabled") !== "true");
  menu.addEventListener("keydown", (e) => {
    const on = live();
    const i = on.indexOf(document.activeElement);
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      on[(i + (e.key === "ArrowDown" ? 1 : on.length - 1)) % on.length].focus();
    } else if (e.key === "Home" || e.key === "End") {
      e.preventDefault();
      on[e.key === "Home" ? 0 : on.length - 1].focus();
    } else if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      close(true);
    } else if (e.key === "Tab") {
      close(false);
    }
  });
  menu.addEventListener("focusout", (e) => { if (!menu.contains(e.relatedTarget)) close(false); });
  document.body.append(menu);
  // The disabled line's reason is also the menu's description (aa2cb9e1).
  reasons = describeUnavailable(menu, { id: `${menu.id}-reasons` });
  const { left, top } = insertMenuPlace(button.getBoundingClientRect(), menu.offsetWidth, menu.offsetHeight, { width: window.innerWidth, height: window.innerHeight });
  menu.style.left = `${left}px`;
  menu.style.top = `${top}px`;
  button.setAttribute("aria-expanded", "true");
  button.setAttribute("aria-controls", menu.id);
  document.addEventListener("pointerdown", outside, true);
  document.addEventListener("scroll", away, true);
  window.addEventListener("resize", away);
  live()[0].focus();
  return { close };
}
