// src/scripts/desk/notebook-menu.js
//
// The Notebook panel's title is a menu, "Notebook ▾" (Featherboa's Phase 5;
// SITE-FEATHERBOA.md, "The Notebook panel": BS-25 to BS-31). It holds what the
// Settings tab held that has no other home beside the text: Print…, the whole
// notebook (the notebook page), Notebook actions, then Take the tour, Help,
// and Feedback. It is the kit's menu, a float of kit rows as the header's
// menus are, hanging from the title over the reader's notes, which stay
// beneath it (BS-31), so closing it leaves the list where it was.
//
// Print… opens the shared Print menu (print-menu.js, E16) in the same place:
// the chapter picker, starting at the chapter in view, and its three prints.
// It is a small window of its own (`role="dialog"`), since it holds a field.
//
// The keys are a menu's (src/scripts/CLAUDE.md, "One set of actions, two ways
// in"): the arrows, Home and End move through the rows, Escape closes and
// gives focus back to the title, and focus leaving it or a press elsewhere
// closes it.
//
// createNotebookMenu({ button, host, print, onTour, beside })
//   → { el, open, close, isOpen, printOpen, closePrint }
//   `button` the title's button (aria-haspopup="menu"); `host` the element
//   the floats hang in (the panel); `print` what the Print menu needs, or null
//   where this page can't print (Print… is left out); `onTour` asks for the
//   tour; `beside` is what the Notebook actions window opens beside.

import { FEEDBACK_HREF, FEEDBACK_LABEL, HELP_HREF } from "../../lib/desk-first-use.mjs";
import { createPrintMenu } from "./print-menu.js";
import { make } from "./dom.js";
import { newTabMark } from "./glyphs.js";

/** The menu's rows, in order: the record's names (BS-30), with Print… first. */
export const MENU_LABELS = Object.freeze({
  print: "Print…",
  notebook: "Whole notebook",
  actions: "Notebook actions",
  tour: "Take the tour",
  help: "Help",
  feedback: FEEDBACK_LABEL,
});

/**
 * @param {{ button: HTMLButtonElement, host: HTMLElement,
 *   print?: { start: () => ({ bookKey: string, chapter: number } | null),
 *     here: (() => ({ bookKey: string, chapter: number } | null)) | { bookKey: string, chapter: number } | null,
 *     notebook: boolean,
 *     inPlace: { plain?: () => unknown, notes?: () => unknown, room?: () => unknown } } | null,
 *   onTour: () => void, beside?: HTMLElement | null }} options
 *   `print.here` is the chapter that prints in place (this page's own while
 *   it is the chapter in view), or a function that says so each time the
 *   Print menu opens (print-menu.js).
 */
export function createNotebookMenu({ button, host, print = null, onTour, beside = null }) {
  const menu = make("div", "desk-panel__menu");
  menu.id = "deskPanelMenu";
  menu.setAttribute("role", "menu");
  menu.setAttribute("aria-label", "Notebook");
  menu.hidden = true;

  const row = (label, tag = "button") => {
    const item = make(tag, "kit-row desk-panel__menu-row");
    if (tag === "button") item.type = "button";
    item.setAttribute("role", "menuitem");
    item.tabIndex = -1;
    item.append(make("span", "desk-panel__menu-label", label));
    return item;
  };
  const rule = () => {
    const r = make("div", "desk-panel__menu-sep");
    r.setAttribute("role", "separator");
    return r;
  };

  const printRow = print ? row(MENU_LABELS.print) : null;
  if (printRow) printRow.setAttribute("aria-haspopup", "dialog");
  const notebookRow = row(MENU_LABELS.notebook, "a");
  notebookRow.href = "/notebook/";
  const actionsRow = row(MENU_LABELS.actions);
  actionsRow.setAttribute("aria-haspopup", "dialog");
  const tourRow = row(MENU_LABELS.tour);
  const helpRow = row(MENU_LABELS.help, "a");
  helpRow.href = HELP_HREF;
  // The preview's invitation opens beside the page, so the reader keeps what
  // they were looking at while they describe it, and says so (E71).
  const feedbackRow = row(MENU_LABELS.feedback, "a");
  feedbackRow.href = FEEDBACK_HREF;
  feedbackRow.target = "_blank";
  feedbackRow.rel = "noopener noreferrer";
  feedbackRow.querySelector(".desk-panel__menu-label").append(newTabMark(), make("span", "sr-only", " (opens in a new tab)"));

  menu.append(...[printRow, notebookRow, actionsRow].filter(Boolean), rule(), tourRow, helpRow, feedbackRow);
  const rows = [printRow, notebookRow, actionsRow, tourRow, helpRow, feedbackRow].filter(Boolean);

  // Print…'s window, in the menu's place.
  const printBox = print ? make("div", "desk-panel__print") : null;
  const printMenu = print
    ? createPrintMenu({
        id: "panel",
        start: print.start,
        notebook: print.notebook,
        here: print.here,
        inPlace: print.inPlace,
        onChoose: () => closePrint({ focus: false }),
      })
    : null;
  if (printBox) {
    printBox.id = "deskPanelPrint";
    printBox.setAttribute("role", "dialog");
    printBox.setAttribute("aria-label", "Print");
    printBox.hidden = true;
    printBox.append(printMenu.el);
    printBox.addEventListener("keydown", (e) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      closePrint();
    });
    printBox.addEventListener("focusout", (e) => {
      const to = e.relatedTarget;
      if (to instanceof Node && !printBox.contains(to) && to !== button) closePrint({ focus: false });
    });
  }

  host.append(menu, ...(printBox ? [printBox] : []));

  const isOpen = () => !menu.hidden;

  function open() {
    closePrint({ focus: false });
    menu.hidden = false;
    button.setAttribute("aria-expanded", "true");
    rows[0]?.focus();
  }

  function close({ focus = true } = {}) {
    if (menu.hidden) return;
    menu.hidden = true;
    button.setAttribute("aria-expanded", "false");
    if (focus) button.focus();
  }

  function openPrint() {
    if (!printBox) return;
    close({ focus: false });
    printMenu.open();
    printBox.hidden = false;
    printMenu.focusTarget()?.focus?.();
  }

  function closePrint({ focus = true } = {}) {
    if (!printBox || printBox.hidden) return;
    printBox.hidden = true;
    if (focus) button.focus();
  }

  button.addEventListener("click", () => (isOpen() ? close() : open()));
  printRow?.addEventListener("click", openPrint);
  actionsRow.addEventListener("click", () => {
    close();
    // The commands the search box understands (E31), in their own window
    // beside the Notebook; it gives focus back to the title when it closes.
    import("./notebook-search.js")
      .then((m) => m.openCommands({ anchor: button, beside, opener: button }))
      .catch((err) => console.error("Study: the Notebook actions couldn't load", err));
  });
  tourRow.addEventListener("click", () => {
    close({ focus: false });
    onTour();
  });
  // A link that opens a new tab gives focus back to the title, not the page.
  feedbackRow.addEventListener("click", () => close());

  menu.addEventListener("keydown", (e) => {
    const i = rows.indexOf(document.activeElement);
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const step = e.key === "ArrowDown" ? 1 : rows.length - 1;
      rows[(Math.max(i, 0) + (i < 0 && step === 1 ? 0 : step)) % rows.length]?.focus();
    } else if (e.key === "Home" || e.key === "End") {
      e.preventDefault();
      rows[e.key === "Home" ? 0 : rows.length - 1]?.focus();
    } else if (e.key === "Escape") {
      // The menu's own Escape: the panel's (which minimizes it) waits.
      e.stopPropagation();
      close();
    } else if (e.key === "Tab") {
      close({ focus: false });
    }
  });
  menu.addEventListener("focusout", (e) => {
    const to = e.relatedTarget;
    if (to instanceof Node && !menu.contains(to) && to !== button) close({ focus: false });
  });
  // A press anywhere else closes either float, leaving focus where the press put it.
  document.addEventListener("pointerdown", (e) => {
    const t = e.target;
    if (!(t instanceof Node) || t === button || button.contains(t)) return;
    if (isOpen() && !menu.contains(t)) close({ focus: false });
    if (printBox && !printBox.hidden && !printBox.contains(t)) closePrint({ focus: false });
  });

  return {
    el: menu,
    open,
    close,
    isOpen,
    /** Whether Print…'s window is open. */
    printOpen: () => Boolean(printBox && !printBox.hidden),
    closePrint,
  };
}
