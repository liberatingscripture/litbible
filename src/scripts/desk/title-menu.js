// src/scripts/desk/title-menu.js
//
// The /desk page's title is a menu (E15; BVJ, 2026-11-02): Add pane with its
// flyout (E14), Layout…, New sheet… (SH5-5; after Layout…, BVJ 2026-11-08),
// Print…, Display options, Full screen (E43), then the
// notebook page, Take the tour (E24) and Help. Taken out of desk-page.js's
// `start()` (Audit 3, LG3-3, second sitting), as the pane menu was before it
// (kind-menu.js), so the next bug in it means reading this file.
//
// It takes what it needs and reaches for nothing else. The layout and the
// tour are read through `getLayout()` and `getTour()` at the moment they are
// wanted: the layout is replaced on every change, and the tour is made after
// the panes, once this menu exists. The pure rules are in
// src/lib/desk-layout.mjs (`addPane`, `addPaneNeeds`, `addWhy`, `whyText`).
//
// - `wrap` the title's wrapper (`.desk-title`), which holds the h1, the Layout
//   and Print windows and this menu; focus leaving it closes the menu.
// - `titleButton` the h1's button that opens the menu and takes focus back.
// - `getLayout()` the page's current layout.
// - `panesBox` the element holding the panes (the room Add pane is judged in).
// - `commit(layout)` makes a layout the page's, saved and drawn.
// - `announce(text)` says what happened to a screen reader.
// - `getTour()` the Study Desk tour, or null before it is made.
// - `inTour(node)` whether a node is in the tour's card, which the closers
//   must not count as elsewhere.
// - New sheet… needs nothing more: it adds or finds a Sheets pane through
//   `getLayout`, `commit` and `panesBox` (which pane is `sheetPaneFor`, in
//   desk-layout.mjs), then sends `desk:sheet-new` (with the
//   pane's id) for the Sheets pane to open its template chooser.
// - `layoutWindow`, `printWindow`: `{ open(), close({ focus }) }` for the two
//   windows the menu's Layout… and Print… lines open, and which opening the
//   menu closes.
//
// Returns `{ el, addFly, open, close({ focus }), showAddKinds(direction),
// refreshTourLine }`: `el` and `addFly` are the menu and its flyout, which the
// tour points at; `showAddKinds` opens the flyout at its second step for the
// tour; `refreshTourLine` redraws the quiet "Take the tour" line.

import { KINDS, addPane, addPaneNeeds, addWhy, panes, sheetPaneFor, whyText } from "../../lib/desk-layout.mjs";
import { HELP_HREF } from "../../lib/desk-first-use.mjs";
import { el } from "./dom.js";
import { describeUnavailable } from "./menu-reasons.js";

export function createTitleMenu({ wrap, titleButton, getLayout, panesBox, commit, announce, getTour, inTour, layoutWindow, printWindow }) {
  const titleMenu = el("div", "desk-ws__menu desk-title__menu");
  titleMenu.id = "deskTitleMenu";
  titleMenu.setAttribute("role", "menu");
  titleMenu.setAttribute("aria-label", titleButton.firstElementChild.textContent);
  titleMenu.hidden = true;
  wrap.append(titleMenu);
  // A line that is unavailable is passed over by the arrow keys, so the menu
  // names it and says why when a screen reader enters it (menu-reasons.js).
  const titleReasons = describeUnavailable(titleMenu, { id: "deskTitleMenuWhy" });

  let hintCount = 0;
  const item = (label, tag = "button") => {
    const b = el(tag, "desk-title__item");
    if (tag === "button") b.type = "button";
    b.setAttribute("role", "menuitem");
    b.tabIndex = -1;
    b.append(el("span", "desk-title__label", label));
    return b;
  };
  /** A disabled item carries the reason beside it (and for a screen reader). */
  const setDisabled = (b, why) => {
    let hint = b.querySelector(".desk-title__hint");
    if (!hint) {
      hint = el("span", "desk-title__hint");
      hint.id = `deskTitleHint-${++hintCount}`;
      b.querySelector(".desk-title__label").after(hint);
    }
    hint.textContent = why ?? "";
    if (why) {
      b.setAttribute("aria-disabled", "true");
      b.setAttribute("aria-describedby", hint.id);
    } else {
      b.removeAttribute("aria-disabled");
      b.removeAttribute("aria-describedby");
    }
  };
  const enabled = (list) => list.filter((b) => b.getAttribute("aria-disabled") !== "true");

  // Add pane: a flyout to the right that asks "Add column" or "Add row" and
  // then, in the same flyout, which kind of pane to show (BVJ, 2026-11-02). A
  // column is a pane the page's full height at the right edge, a row one the
  // full width along the bottom (addPane). Disabled, not hidden, when the page
  // can't take one, with the reason beside it.
  const addItem = item("Add pane");
  addItem.setAttribute("aria-haspopup", "menu");
  addItem.setAttribute("aria-expanded", "false");
  const more = el("span", "desk-title__more");
  more.innerHTML = `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor"
    stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
    <path d="M9 6l6 6-6 6" /></svg>`;
  addItem.append(more);
  const addFly = el("div", "desk-ws__menu desk-title__fly");
  addFly.setAttribute("role", "menu");
  addFly.setAttribute("aria-label", "Add pane");
  addFly.hidden = true;
  const addSub = el("div", "desk-title__sub");
  addSub.append(addItem, addFly);
  const addFlyReasons = describeUnavailable(addFly, { id: "deskAddFlyWhy" });

  // New sheet… (SH5-5): the way to a sheet for someone who doesn't yet know a
  // Sheet is a kind of pane. It acts at once (no flyout): it uses the Sheet
  // pane the desk already has, or adds one the way Add pane would (a column,
  // else a row), then asks that pane to open its template chooser. Disabled,
  // with the reason beside it, only when there is no Sheets pane and neither a
  // column nor a row can be added.
  const newSheetItem = item("New sheet…");

  const layoutItem = item("Layout…");
  layoutItem.setAttribute("aria-haspopup", "dialog");
  const printItem = item("Print…");
  printItem.setAttribute("aria-haspopup", "dialog");
  // Aa is the Display tray's own button, moved here whole so the tray's
  // listeners stay on it. It hangs the tray from the title (SiteHeader's
  // data-tray-anchor), since this menu closes as the tray opens.
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
  const notebookItem = item("My notebook page", "a");
  notebookItem.href = "/notebook/";
  // The Study Desk tour runs here, in place (E24); the notebook's runs on a
  // chapter page and starts from the Notebook's foot and the help page.
  const tourItem = item("Take the tour");
  tourItem.addEventListener("click", () => { closeTitleMenu({ focus: false }); getTour()?.start(); });
  const helpItem = item("Help for the Study Desk", "a");
  helpItem.href = HELP_HREF;
  // Each leaves the desk, so they open beside it.
  const links = [notebookItem, helpItem];
  for (const link of links) {
    link.target = "_blank";
    link.rel = "noopener noreferrer";
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
  titleMenu.append(addSub, layoutItem, newSheetItem, printItem);
  if (displayItem) titleMenu.append(displayItem);
  if (fullItem) titleMenu.append(fullItem);
  titleMenu.append(el("div", "desk-title__rule"), notebookItem, tourItem, helpItem);
  const baseItems = [
    addItem, layoutItem, newSheetItem, printItem,
    ...(displayItem ? [displayItem] : []), ...(fullItem ? [fullItem] : []),
    notebookItem, tourItem, helpItem,
  ];
  // A disabled line is passed over by the arrow keys, Home and End, as in
  // every menu (DK3-7; BVJ, 2026-11-07): its reason is drawn beside it.
  const topItems = () => enabled(tourLine.hidden ? baseItems : [tourLineGo, tourLineNo, ...baseItems]);

  const DIRECTIONS = [
    { id: "column", label: "Add column" },
    { id: "row", label: "Add row" },
  ];
  let addStep = null; // null, or the direction chosen, once the flyout asks for a kind

  const addRoom = () => panesBox.getBoundingClientRect();

  /** Why a direction can't take a pane, for the hint; null when it can. */
  function directionWhy(direction) {
    const { width, height } = addRoom();
    return whyText(addPaneNeeds(getLayout(), direction, width, height));
  }

  function refreshAdd() {
    const { width, height } = addRoom();
    const layout = getLayout();
    const reasons = DIRECTIONS.map((d) => addPaneNeeds(layout, d.id, width, height));
    setDisabled(addItem, addWhy(reasons));
    const hasSheet = panes(layout.root).some((p) => p.kind === "sheet");
    setDisabled(newSheetItem, hasSheet ? null : addWhy(reasons));
    titleReasons.refresh();
  }

  /** Draw the flyout's step: column or row, then the kinds replacing them. */
  function drawAddFly() {
    addFly.replaceChildren();
    if (addStep) {
      const back = item(`‹ ${DIRECTIONS.find((d) => d.id === addStep).label}`);
      back.addEventListener("click", () => { addStep = null; drawAddFly(); enabled(Array.from(addFly.children))[0]?.focus(); });
      addFly.append(back);
      for (const k of KINDS) {
        const b = item(k.label);
        // The kind's one line, greyed under its name and heard as its description (SH5-5).
        if (k.about) {
          const about = el("span", "desk-title__hint desk-title__hint--about", k.about);
          about.id = `deskTitleHint-${++hintCount}`;
          about.setAttribute("aria-hidden", "true");
          b.querySelector(".desk-title__label").after(about);
          b.setAttribute("aria-describedby", about.id);
        }
        b.addEventListener("click", () => {
          const { width, height } = addRoom();
          const direction = addStep;
          const layout = getLayout();
          const next = addPane(layout, direction, k.kind, width, height);
          closeTitleMenu();
          if (next === layout) return;
          commit(next);
          announce(`Added a ${direction} showing ${k.label}.`);
        });
        addFly.append(b);
      }
    } else {
      for (const d of DIRECTIONS) {
        const b = item(d.label);
        setDisabled(b, directionWhy(d.id));
        b.addEventListener("click", () => {
          if (b.getAttribute("aria-disabled") === "true") return;
          addStep = d.id;
          drawAddFly();
          addFly.children[1].focus();
        });
        addFly.append(b);
      }
    }
    addFlyReasons.refresh();
  }

  function openAddFly({ focus = true } = {}) {
    if (addItem.getAttribute("aria-disabled") === "true") return;
    addStep = null;
    drawAddFly();
    addFly.hidden = false;
    // Beside the menu where there is room to its right, else to its left.
    addFly.classList.remove("desk-title__fly--left");
    if (titleMenu.getBoundingClientRect().right + 6 + addFly.offsetWidth > window.innerWidth - 8) {
      addFly.classList.add("desk-title__fly--left");
    }
    addItem.setAttribute("aria-expanded", "true");
    if (focus) (enabled(Array.from(addFly.children))[0] ?? addFly.children[0]).focus();
  }

  function closeAddFly({ focus = false } = {}) {
    if (addFly.hidden) return;
    addFly.hidden = true;
    addStep = null;
    addItem.setAttribute("aria-expanded", "false");
    if (focus) addItem.focus();
  }

  /** The flyout at its second step, as the tour shows it (E24): the kinds a column could show. */
  function showAddKinds(direction) {
    openTitleMenu();
    openAddFly();
    addStep = direction;
    drawAddFly();
  }

  function openTitleMenu() {
    layoutWindow.close({ focus: false });
    printWindow.close({ focus: false });
    refreshAdd();
    refreshTourLine();
    titleMenu.hidden = false;
    titleButton.setAttribute("aria-expanded", "true");
    const items = topItems();
    items[0]?.focus();
  }

  function closeTitleMenu({ focus = true } = {}) {
    if (titleMenu.hidden) return;
    closeAddFly();
    titleMenu.hidden = true;
    titleButton.setAttribute("aria-expanded", "false");
    if (focus) titleButton.focus();
  }

  titleButton.addEventListener("click", () => (titleMenu.hidden ? openTitleMenu() : closeTitleMenu()));
  // Hover may have opened it already, so a click then moves into it.
  addItem.addEventListener("click", () => {
    if (addFly.hidden) openAddFly();
    else (enabled(Array.from(addFly.children))[0] ?? addFly.children[0]).focus();
  });
  // Hover opens the flyout without taking focus, and leaving the item and the
  // flyout closes it after a beat, so the pointer can cross the gap between them.
  let addLeave = 0;
  addSub.addEventListener("mouseenter", () => {
    clearTimeout(addLeave);
    if (addFly.hidden && !titleMenu.hidden) openAddFly({ focus: false });
  });
  addSub.addEventListener("mouseleave", () => {
    clearTimeout(addLeave);
    addLeave = setTimeout(() => {
      if (!addFly.contains(document.activeElement)) closeAddFly();
    }, 250);
  });
  // Also the tour's (E59), which calls it without opening the menu.
  function startNewSheet() {
    const { width, height } = addRoom();
    const layout = getLayout();
    const { layout: next, paneId } = sheetPaneFor(layout, width, height);
    closeTitleMenu();
    if (!paneId) return;
    if (next !== layout) commit(next);
    // The Sheets pane listens and opens its template chooser (sheet-pane.js).
    // This relies on `commit` having built the new pane, and so registered its
    // listener, before it returns: a pane drawn lazily would miss the event,
    // and the leader would see the list without the chooser (DK6-10).
    if (paneId) document.dispatchEvent(new CustomEvent("desk:sheet-new", { detail: { paneId } }));
    announce("New sheet: choose a template.");
    return paneId;
  }
  newSheetItem.addEventListener("click", () => {
    if (newSheetItem.getAttribute("aria-disabled") === "true") return;
    startNewSheet();
  });
  layoutItem.addEventListener("click", () => { closeTitleMenu({ focus: false }); layoutWindow.open(); });
  printItem.addEventListener("click", () => { closeTitleMenu({ focus: false }); printWindow.open(); });
  // The tray's own listener (first on this button) has placed it under the title.
  displayItem?.addEventListener("click", () => closeTitleMenu({ focus: false }));
  // Both open a new tab, so the title button takes focus back, not the page (DK8-4).
  for (const link of links) link.addEventListener("click", () => closeTitleMenu());

  titleMenu.addEventListener("keydown", (e) => {
    const inFly = addFly.contains(document.activeElement);
    const list = inFly ? enabled(Array.from(addFly.children)) : topItems();
    const i = list.indexOf(document.activeElement);
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      list[(i + (e.key === "ArrowDown" ? 1 : list.length - 1)) % list.length]?.focus();
    } else if (e.key === "Home" || e.key === "End") {
      e.preventDefault();
      list[e.key === "Home" ? 0 : list.length - 1]?.focus();
    } else if (e.key === "ArrowRight" && document.activeElement === addItem) {
      e.preventDefault();
      if (addFly.hidden) openAddFly();
    } else if ((e.key === "ArrowLeft" || e.key === "Escape") && inFly) {
      // One step back: from the kinds to column and row, then closed.
      e.preventDefault();
      e.stopPropagation();
      if (addStep) {
        addStep = null;
        drawAddFly();
        enabled(Array.from(addFly.children))[0]?.focus();
      } else {
        closeAddFly({ focus: true });
      }
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

  return { el: titleMenu, addFly, open: openTitleMenu, close: closeTitleMenu, showAddKinds, newSheet: startNewSheet, refreshTourLine };
}
