// src/scripts/desk/button-menu.js
//
// A menu that opens under a button and lists what the button can do: the
// sheet gap pill's Add menu (sheets/insert-menu.js) and a collection's "Add ▾"
// (collections/collection-view.js, E177). Drawn as the pane menus are
// (`desk-pane__menu`, no look of its own), with no room for a radio's check
// (`desk-pane__menu--plain`). It was the insert menu's until E177 needed the
// same menu; that file now wraps this one.
//
// It takes what it needs and reaches for nothing else. What a pick does is the
// caller's (`onPick(type)`); the menu only closes first. Arrow keys, Home and
// End move, passing over a disabled line (DK3-7), whose reason shows beside it
// and is the menu's description too (`describeUnavailable`); Escape returns to
// the button; a click elsewhere, Tab, focus leaving, a scroll or a resize
// closes it (DK6-2). It never runs past the window's edge (E179): too tall for
// the room under its button and over it, it takes the roomier side, stops 8px
// from the edge, and scrolls inside itself (`.desk-pane__menu`'s overflow).
//
// - `button` the button; it gets `aria-expanded` and `aria-controls`, and focus
//   back on Escape.
// - `id` the menu's element id (unique on the page).
// - `label` the menu's accessible name.
// - `items` its lines, in order: `{ label, type, disabled?, why?, href? }`. A
//   line with `href` is a link (a click closes the menu and the link goes);
//   the others are buttons whose press closes the menu and calls `onPick(type)`.
// - `className` more classes for the menu.
// - `onPick(type)` a line was chosen, after the menu closed.
// - `onClose(close)` the menu is closing; `close` is the handle's own, so the
//   caller can tell whether the menu it holds is this one.
//
// Returns `{ close(refocus) }`.

import { make } from "./dom.js";
import { describeUnavailable } from "./menu-reasons.js";

/**
 * Where the menu goes, in window pixels: 4px under the button where it fits
 * with 8px to spare, else 4px over it where it fits there; kept 8px inside the
 * window's sides. Where it fits on neither side it goes on the roomier one with
 * `maxHeight`, the room there, and scrolls inside itself (E179).
 *
 * @param {{ left: number, top: number, bottom: number }} at the button's rectangle
 * @param {number} w the menu's width
 * @param {number} h the menu's height
 * @param {{ width: number, height: number }} view the window's size
 * @returns {{ left: number, top: number, maxHeight?: number }}
 */
export function buttonMenuPlace(at, w, h, view) {
  const left = Math.max(8, Math.min(at.left, view.width - w - 8));
  const below = Math.floor(view.height - 8 - (at.bottom + 4));
  const above = Math.floor(at.top - 4 - 8);
  if (h <= below) return { left, top: at.bottom + 4 };
  if (h <= above) return { left, top: at.top - 4 - h };
  if (below >= above) return { left, top: at.bottom + 4, maxHeight: Math.max(0, below) };
  return { left, top: 8, maxHeight: above };
}

/**
 * @param {{ button: HTMLElement, id: string, label: string,
 *   items: { label: string, type: string, disabled?: boolean, why?: string | null, href?: string }[],
 *   className?: string, onPick: (type: string) => void, onClose?: (close: (refocus?: boolean) => void) => void }} options
 * @returns {{ close: (refocus?: boolean) => void }}
 */
export function openButtonMenu({ button, id, label, items, className = "", onPick, onClose }) {
  const menu = make("div", `desk-pane__menu desk-pane__menu--plain ${className}`.trim());
  menu.setAttribute("role", "menu");
  menu.setAttribute("aria-label", label);
  menu.id = id;
  const lines = [];
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
  const outside = (e) => { if (!menu.contains(e.target) && !button.contains(e.target)) close(false); };
  // The menu is placed once, so any scroll or resize leaves it floating
  // away from its button: close, as the pane menus do (DK6-2).
  const away = (e) => { if (!menu.contains(e.target)) close(false); };
  items.forEach(({ label: words, type, disabled = false, why = null, href = null }, i) => {
    const line = make(href && !disabled ? "a" : "button", "desk-pane__menu-item");
    if (line.tagName === "A") line.href = href;
    else line.type = "button";
    line.tabIndex = -1;
    line.setAttribute("role", "menuitem");
    line.append(make("span", "desk-title__label", words));
    if (disabled) {
      const hint = make("span", "desk-title__hint", why ?? "");
      hint.id = `${menu.id}-why-${i}`;
      line.append(hint);
      line.setAttribute("aria-disabled", "true");
      line.setAttribute("aria-describedby", hint.id);
    }
    line.addEventListener("click", (e) => {
      if (disabled) {
        e.preventDefault();
        return;
      }
      close(false);
      // A link goes where it points; the caller hears of it all the same.
      onPick?.(type);
    });
    menu.append(line);
    lines.push(line);
  });
  // The arrow keys, Home and End pass over a disabled line (DK3-7).
  const live = () => lines.filter((b) => b.getAttribute("aria-disabled") !== "true");
  menu.addEventListener("keydown", (e) => {
    const on = live();
    const i = on.indexOf(document.activeElement);
    if ((e.key === "ArrowDown" || e.key === "ArrowUp") && on.length) {
      e.preventDefault();
      on[(i + (e.key === "ArrowDown" ? 1 : on.length - 1)) % on.length].focus();
    } else if ((e.key === "Home" || e.key === "End") && on.length) {
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
  // A disabled line's reason is also the menu's description (aa2cb9e1).
  reasons = describeUnavailable(menu, { id: `${menu.id}-reasons` });
  const { left, top, maxHeight } = buttonMenuPlace(button.getBoundingClientRect(), menu.offsetWidth, menu.offsetHeight, { width: window.innerWidth, height: window.innerHeight });
  menu.style.left = `${left}px`;
  menu.style.top = `${top}px`;
  if (maxHeight !== undefined) menu.style.maxHeight = `${maxHeight}px`;
  button.setAttribute("aria-expanded", "true");
  button.setAttribute("aria-controls", menu.id);
  document.addEventListener("pointerdown", outside, true);
  document.addEventListener("scroll", away, true);
  window.addEventListener("resize", away);
  // Focus starts on the first line that can be used; with none, on the menu
  // itself, so leaving it still closes it.
  const first = live()[0];
  if (first) first.focus();
  else {
    menu.tabIndex = -1;
    menu.focus();
  }
  return { close };
}
