// src/scripts/desk/print-menu.js
//
// The Print menu (STUDY-DESK.md, E16), one piece of code for /desk's header
// and the Notebook's Settings tab: a chapter to print, picked in the same
// passage field the panes use, then the three prints (the chapter plainly,
// with my notes, with room to write). The picker starts at `start()` each
// time the menu opens and changes only what is printed; it never moves a pane
// or the page. What each choice does for the chapter picked is
// `printMenuState` (src/lib/desk-print-notes.mjs, pure and tested):
//   - a chapter other than this page's opens its Chapter View address in a new
//     tab with `?print=<kind>`, which prints itself (print-link.js);
//   - this page's own chapter (`here`, the Notebook on Chapter View) prints in
//     place with `inPlace`, as the Notebook's buttons always did;
//   - in Read View (`book`) there is no picker: the menu prints the book on
//     the page, in place.
// The host owns the button that opens it and the closing (Escape, focus); the
// menu is `el`, `open()` fills it for a fresh look, `focusTarget()` says where
// focus belongs once it is shown.

import { printMenuState } from "../../lib/desk-print-notes.mjs";
import { createPassageBar } from "./passage-bar.js";

/**
 * @param {{ id: string,
 *   start?: (() => { bookKey: string, chapter: number } | null) | null,
 *   drafts?: Record<string, number[]>,
 *   notebook?: boolean,
 *   here?: { bookKey: string, chapter: number } | null,
 *   book?: string | null,
 *   inPlace?: { plain?: () => unknown, notes?: () => unknown, room?: () => unknown } | null,
 *   onChoose?: (() => void) | null }} options
 *   `id` keeps the picker's ids apart from other menus'. `onChoose` runs when
 *   a print is chosen, so the host can close the menu.
 * @returns {{ el: HTMLElement, open: () => void, focusTarget: () => HTMLElement }}
 */
export function createPrintMenu({
  id,
  start = null,
  drafts = {},
  notebook = true,
  here = null,
  book = null,
  inPlace = null,
  onChoose = null,
}) {
  const el = document.createElement("div");
  el.className = "desk-print-menu";

  let chosen = null;
  const bar = book
    ? null
    : createPassageBar({
        id: `print-${id}`,
        set: (p) => {
          chosen = p;
          bar.update(p);
          render();
        },
      });
  if (bar) {
    // The bar is a search landmark among the panes; here it is a choice of chapter.
    bar.el.removeAttribute("role");
    bar.el.setAttribute("role", "group");
    bar.el.setAttribute("aria-label", "Chapter to print");
    bar.el.classList.add("desk-print-menu__picker");
    bar.el.querySelector(".desk-passage__field").placeholder = "John 3";
    el.append(bar.el);
  }

  const message = document.createElement("p");
  message.className = "desk-print-menu__message";
  message.setAttribute("role", "status");
  const choices = document.createElement("div");
  choices.className = "desk-print-menu__choices";
  const note = document.createElement("p");
  note.className = "desk-print-menu__note";
  note.textContent = book
    ? "Prints this book from this page."
    : here
      ? "This page’s chapter prints here. Another opens in a new tab, ready to print."
      : "Each opens the chapter in a new tab, ready to print.";
  el.append(message, choices, note);

  // `a` where a choice is an address, `button` where it prints in place only.
  const items = ["plain", "notes", "room"].map((kind) => {
    const item = document.createElement(book ? "button" : "a");
    if (book) item.type = "button";
    else {
      item.target = "_blank";
      item.rel = "noopener";
    }
    item.dataset.print = kind;
    item.addEventListener("click", (e) => {
      const c = state.choices.find((x) => x.kind === kind);
      if (!c || c.state !== "on") {
        e.preventDefault();
        return;
      }
      const run = c.inPlace ? inPlace?.[kind] : null;
      if (c.inPlace && !run) {
        // Nothing to print in place (the page can't): keep the reader here.
        e.preventDefault();
        return;
      }
      if (run) {
        e.preventDefault();
        onChoose?.();
        Promise.resolve()
          .then(run)
          .catch((err) => console.error("Study Desk: the chapter didn't print", err));
      } else {
        onChoose?.();
      }
    });
    choices.append(item);
    return item;
  });

  let state = { message: null, choices: [] };

  function render() {
    state = printMenuState({ passage: chosen, drafts, notebook, here, book });
    message.hidden = !state.message;
    message.textContent = state.message ?? "";
    for (const item of items) {
      const c = state.choices.find((x) => x.kind === item.dataset.print);
      item.textContent = c.label;
      item.hidden = c.state === "hidden";
      item.setAttribute("aria-disabled", String(c.state === "off"));
      if (c.href) item.setAttribute("href", c.href);
      else if (!book) item.removeAttribute("href");
    }
  }

  function open() {
    chosen = book ? null : start?.() ?? null;
    bar?.update(chosen);
    render();
  }

  function focusTarget() {
    const first = items.find((i) => !i.hidden && i.getAttribute("aria-disabled") !== "true");
    return first ?? bar?.el.querySelector(".desk-passage__field") ?? el;
  }

  render();
  return { el, open, focusTarget };
}
