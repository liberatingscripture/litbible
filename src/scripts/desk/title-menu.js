// src/scripts/desk/title-menu.js
//
// The /desk page's title is a menu (E15; BVJ, 2026-11-02). Since E68
// (2026-11-10) the commands a first look should find are a row of worded
// buttons under the header (command-row.js: Add pane, Layout…, New sheet…,
// Print… and Help), and this menu keeps the rest: Display options, Full
// screen (E43), then the notebook page, Take the tour (E24) and feedback.
// Taken out of desk-page.js's `start()` (Audit 3, LG3-3, second sitting), as
// the pane menu was before it (kind-menu.js), so the next bug in it means
// reading this file.
//
// - `wrap` the title's wrapper (`.desk-title`), which holds the h1 and this
//   menu; focus leaving it closes the menu.
// - `titleButton` the h1's button that opens the menu and takes focus back.
// - `announce(text)` says what happened to a screen reader.
// - `getTour()` the Study Desk tour, or null before it is made.
// - `inTour(node)` whether a node is in the tour's card, which the closers
//   must not count as elsewhere.
// - `layoutWindow`, `printWindow`: `{ open(), close({ focus }) }`, the two
//   windows the command row opens, which opening this menu closes.
//
// Returns `{ el, open, close({ focus }), refreshTourLine }`: `el` is the menu,
// which the tour points at; `refreshTourLine` redraws the quiet "Take the
// tour" line.

import { FEEDBACK_HREF, FEEDBACK_LABEL } from "../../lib/desk-first-use.mjs";
import { el } from "./dom.js";
import { newTabMark } from "./glyphs.js";

export function createTitleMenu({ wrap, titleButton, announce, getTour, inTour, layoutWindow, printWindow }) {
  const titleMenu = el("div", "desk-ws__menu desk-title__menu");
  titleMenu.id = "deskTitleMenu";
  titleMenu.setAttribute("role", "menu");
  titleMenu.setAttribute("aria-label", titleButton.firstElementChild.textContent);
  titleMenu.hidden = true;
  wrap.append(titleMenu);

  const item = (label, tag = "button") => {
    const b = el(tag, "desk-title__item");
    if (tag === "button") b.type = "button";
    b.setAttribute("role", "menuitem");
    b.tabIndex = -1;
    b.append(el("span", "desk-title__label", label));
    return b;
  };
  // Aa is the Display tray's own button, moved here whole so the tray's
  // listeners stay on it. It hangs the tray from the title (SiteHeader's
  // data-tray-anchor), since this menu closes as the tray opens. The tray
  // holds only what reaches every pane; what marks up the LIT text is on the
  // LIT pane's bar (E108, lit-show.js), not behind this menu.
  const displayItem = document.querySelector(".site-header__actions [data-font-toggle]");
  if (displayItem) {
    displayItem.className = "desk-title__item";
    displayItem.setAttribute("role", "menuitem");
    displayItem.setAttribute("aria-haspopup", "dialog");
    displayItem.dataset.trayAnchor = ".desk-title__button";
    displayItem.tabIndex = -1;
    displayItem.replaceChildren(el("span", "desk-title__label", "Display options"));
  }
  // Full screen (E43; BVJ, 2026-11-06: the browser's own full screen, nothing
  // more). It presses the Fullscreen API on the whole page, which a browser
  // only allows from a click. F11 is a different thing the page can't see
  // (fullscreenElement stays null under it), so the line says "Exit" only for
  // a full screen it entered, and names the key otherwise. Escape is the
  // browser's way out, and in full screen the page never hears that press.
  // No line where the browser has no Fullscreen API.
  const fullItem = document.fullscreenEnabled ? item("") : null;
  const fullKey = /Mac|iPhone|iPad/.test(navigator.platform) ? "⌃⌘F" : "F11";
  const refreshFull = () => {
    fullItem.querySelector(".desk-title__label").textContent = document.fullscreenElement
      ? "Exit full screen"
      : `Full screen (${fullKey})`;
  };
  if (fullItem) {
    refreshFull();
    document.addEventListener("fullscreenchange", refreshFull);
    fullItem.addEventListener("click", () => {
      // Focus goes back to the title, so a refused request (announced below)
      // doesn't leave it on the page's body (LV3-4).
      closeTitleMenu();
      if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
      else {
        document.documentElement.requestFullscreen?.().catch(() =>
          announce(`This browser didn’t allow full screen. Use the browser’s own command instead (${fullKey}).`),
        );
      }
    });
  }
  // The notebook's page (BVJ, 2026-11-02). No Settings window, and no "where
  // it is kept" item (it would only link to a section of that page): nothing
  // else of the Notebook's settings applies here.
  // "My Notebook," its one name everywhere (E70).
  const notebookItem = item("My Notebook", "a");
  notebookItem.href = "/notebook/";
  // Carries the backup reminder's dot (reminder.js, E113).
  notebookItem.setAttribute("data-desk-notebook-item", "");
  // The Study Desk tour runs here, in place (E24); the notebook's runs on a
  // chapter page and starts from the Notebook's foot and the help page.
  const tourItem = item("Take the tour");
  tourItem.addEventListener("click", () => { closeTitleMenu({ focus: false }); getTour()?.start(); });
  const feedbackItem = item(FEEDBACK_LABEL, "a");
  feedbackItem.href = FEEDBACK_HREF;
  // Each leaves the desk, so they open beside it, and say so: the open-page
  // mark to the eye, the words to a screen reader (E71).
  const links = [notebookItem, feedbackItem];
  for (const link of links) {
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.querySelector(".desk-title__label").append(newTabMark(), el("span", "sr-only", " (opens in a new tab)"));
  }
  // The quiet line (E24): until the reader has taken the tour or said "Not now,"
  // a line at the top of the menu says there is one. Shown when the offer
  // window was put off (or is not on the screen), refreshed as the menu opens.
  const tourLine = el("div", "desk-title__line");
  const tourLineGo = item("New to the Study Desk? Take the tour");
  tourLineGo.classList.add("desk-title__line-go");
  tourLineGo.addEventListener("click", () => { closeTitleMenu({ focus: false }); getTour()?.start(); });
  const tourLineNo = item("Not now");
  tourLineNo.classList.add("desk-title__line-no");
  tourLineNo.addEventListener("click", () => { getTour()?.declineLine(); refreshTourLine(); tourItem.focus(); });
  tourLine.append(tourLineGo, tourLineNo);
  tourLine.hidden = true;
  function refreshTourLine() {
    tourLine.hidden = !getTour()?.lineWanted();
  }
  titleMenu.append(tourLine);
  if (displayItem) titleMenu.append(displayItem);
  if (fullItem) titleMenu.append(fullItem);
  titleMenu.append(el("div", "desk-title__rule"), notebookItem, tourItem, feedbackItem);
  const baseItems = [
    ...(displayItem ? [displayItem] : []), ...(fullItem ? [fullItem] : []),
    notebookItem, tourItem, feedbackItem,
  ];
  const topItems = () => (tourLine.hidden ? baseItems : [tourLineGo, tourLineNo, ...baseItems]);

  function openTitleMenu() {
    layoutWindow.close({ focus: false });
    printWindow.close({ focus: false });
    refreshTourLine();
    titleMenu.hidden = false;
    titleButton.setAttribute("aria-expanded", "true");
    const items = topItems();
    items[0]?.focus();
  }

  function closeTitleMenu({ focus = true } = {}) {
    if (titleMenu.hidden) return;
    titleMenu.hidden = true;
    titleButton.setAttribute("aria-expanded", "false");
    if (focus) titleButton.focus();
  }

  titleButton.addEventListener("click", () => (titleMenu.hidden ? openTitleMenu() : closeTitleMenu()));
  // The tray's own listener (first on this button) has placed it under the title.
  displayItem?.addEventListener("click", () => closeTitleMenu({ focus: false }));
  // Both open a new tab, so the title button takes focus back, not the page (DK8-4).
  for (const link of links) link.addEventListener("click", () => closeTitleMenu());

  titleMenu.addEventListener("keydown", (e) => {
    const list = topItems();
    const i = list.indexOf(document.activeElement);
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      list[(i + (e.key === "ArrowDown" ? 1 : list.length - 1)) % list.length]?.focus();
    } else if (e.key === "Home" || e.key === "End") {
      e.preventDefault();
      list[e.key === "Home" ? 0 : list.length - 1]?.focus();
    } else if (e.key === "Escape") {
      e.stopPropagation();
      closeTitleMenu();
    }
  });
  // Tabbing out of the menu closes it, as a click elsewhere does.
  titleMenu.addEventListener("focusout", (e) => {
    const to = e.relatedTarget;
    if (to instanceof Node && !wrap.contains(to) && !inTour(to)) closeTitleMenu({ focus: false });
  });

  return { el: titleMenu, open: openTitleMenu, close: closeTitleMenu, refreshTourLine };
}
