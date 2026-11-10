// src/scripts/desk/command-row.js
//
// /desk's row of worded commands under the header (E68; STUDY-DESK-FIXES.md,
// 2026-11-10): Add pane ▾, Layout…, New sheet…, Print… and Help, where a
// first look at the page finds them. Until then every command was in the
// title menu ("Study Desk ▾", E15), and NN/g found hidden commands used far
// less, and more slowly, than visible ones. The title menu keeps the rest
// (Display options, Full screen, the notebook page, the tour, feedback).
//
// - `row` the element the commands go in (desk-page.js puts it above the
//   panes); the Layout and Print windows hang from it too.
// - `getLayout()` the page's current layout; `commit(layout)` makes one the
//   page's; `panesBox` the room Add pane is judged in; `announce(text)`.
// - `inTour(node)` whether a node is in a tour's card, which the closers
//   must not count as elsewhere.
// - `layoutWindow`, `printWindow`: `{ open(), close({ focus }) }`.
//
// Add pane is a menu button whose menu asks "Add column" or "Add row", then
// which kind of pane, in the same menu (E14; BVJ, 2026-11-02), with a
// "‹ Add column" line to go back. New sheet… acts at once (SH5-5): it uses
// the desk's Sheets pane, or adds one as a column (else a row), then sends
// `desk:sheet-new` with the pane's id. Each is disabled, not hidden, when the
// page can't take a pane, with the reason in its tooltip and its description.
// The pure rules are in src/lib/desk-layout.mjs.
//
// Returns `{ el, addButton, addMenu, layoutButton, printButton, hang(win, button),
// showAddKinds(direction), closeAdd({ focus }), newSheet(), refresh() }`.

import { KINDS, addPane, addPaneNeeds, addWhy, panes, sheetPaneFor, whyText } from "../../lib/desk-layout.mjs";
import { HELP_HREF } from "../../lib/desk-first-use.mjs";
import { el } from "./dom.js";
import { newTabMark } from "./glyphs.js";
import { describeUnavailable } from "./menu-reasons.js";
import { setTip } from "../tip.js";

const ICON_CARET = `<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor"
  stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
  <path d="M6 9l6 6 6-6" /></svg>`;

const DIRECTIONS = [
  { id: "column", label: "Add column" },
  { id: "row", label: "Add row" },
];

export function createCommandRow({ row, getLayout, panesBox, commit, announce, inTour, layoutWindow, printWindow }) {
  row.classList.add("desk-cmdrow");
  row.setAttribute("role", "group");
  row.setAttribute("aria-label", "Study Desk commands");

  const command = (label, tag = "button") => {
    const b = el(tag, "desk-cmdrow__btn");
    if (tag === "button") b.type = "button";
    b.append(el("span", "desk-cmdrow__label", label));
    return b;
  };

  // A disabled command keeps its place and says why: in its tooltip for the
  // eye, and in a hidden description for a screen reader.
  let whyCount = 0;
  const setDisabled = (b, why) => {
    let note = b.querySelector(".desk-cmdrow__why");
    if (!note) {
      note = el("span", "sr-only desk-cmdrow__why");
      note.id = `deskCmdWhy-${++whyCount}`;
      b.append(note);
    }
    note.textContent = why ? `Unavailable: ${why}` : "";
    if (why) {
      b.setAttribute("aria-disabled", "true");
      b.setAttribute("aria-describedby", note.id);
    } else {
      b.removeAttribute("aria-disabled");
      b.removeAttribute("aria-describedby");
    }
    setTip(b, why ?? "");
  };
  const isOff = (b) => b.getAttribute("aria-disabled") === "true";

  // ---- Add pane ▾ ----

  const addSub = el("div", "desk-cmdrow__sub");
  const addButton = command("Add pane");
  addButton.insertAdjacentHTML("beforeend", ICON_CARET);
  addButton.setAttribute("aria-haspopup", "menu");
  addButton.setAttribute("aria-expanded", "false");
  addButton.setAttribute("aria-controls", "deskAddMenu");
  const addMenu = el("div", "desk-ws__menu desk-title__menu desk-cmdrow__menu");
  addMenu.id = "deskAddMenu";
  addMenu.setAttribute("role", "menu");
  addMenu.setAttribute("aria-label", "Add pane");
  addMenu.hidden = true;
  addSub.append(addButton, addMenu);
  const addReasons = describeUnavailable(addMenu, { id: "deskAddMenuWhy" });

  const newSheetButton = command("New sheet…");
  const layoutButton = command("Layout…");
  layoutButton.setAttribute("aria-haspopup", "dialog");
  const printButton = command("Print…");
  printButton.setAttribute("aria-haspopup", "dialog");
  const help = command("Help", "a");
  help.href = HELP_HREF;
  help.target = "_blank";
  help.rel = "noopener noreferrer";
  help.append(newTabMark(), el("span", "sr-only", " (opens in a new tab)"));

  row.append(addSub, layoutButton, newSheetButton, printButton, help);

  /** A window opened from a command hangs under it, inside the window's width. */
  function hang(win, button) {
    const rowBox = row.getBoundingClientRect();
    const at = button.getBoundingClientRect().left - rowBox.left;
    const room = Math.max(0, document.documentElement.clientWidth - 16 - rowBox.left - win.offsetWidth);
    win.style.left = `${Math.max(0, Math.min(at, room))}px`;
  }

  // ---- the add menu's lines ----

  let hintCount = 0;
  let addStep = null; // null, or the direction chosen, once the menu asks for a kind
  const addRoom = () => panesBox.getBoundingClientRect();
  const enabled = () => Array.from(addMenu.children).filter((b) => b.getAttribute("aria-disabled") !== "true");

  const item = (label) => {
    const b = el("button", "desk-title__item");
    b.type = "button";
    b.setAttribute("role", "menuitem");
    b.tabIndex = -1;
    b.append(el("span", "desk-title__label", label));
    return b;
  };
  const setItemDisabled = (b, why) => {
    let hint = b.querySelector(".desk-title__hint");
    if (!hint) {
      hint = el("span", "desk-title__hint");
      hint.id = `deskAddHint-${++hintCount}`;
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

  /** Why a direction can't take a pane, for the hint; null when it can. */
  function directionWhy(direction) {
    const { width, height } = addRoom();
    return whyText(addPaneNeeds(getLayout(), direction, width, height));
  }

  /** Draw the menu's step: column or row, then the kinds replacing them. */
  function drawAdd() {
    addMenu.replaceChildren();
    if (addStep) {
      const back = item(`‹ ${DIRECTIONS.find((d) => d.id === addStep).label}`);
      back.addEventListener("click", () => { addStep = null; drawAdd(); enabled()[0]?.focus(); });
      addMenu.append(back);
      for (const k of KINDS) {
        const b = item(k.label);
        // The kind's one line, greyed under its name and heard as its description (SH5-5).
        if (k.about) {
          const about = el("span", "desk-title__hint desk-title__hint--about", k.about);
          about.id = `deskAddHint-${++hintCount}`;
          about.setAttribute("aria-hidden", "true");
          b.querySelector(".desk-title__label").after(about);
          b.setAttribute("aria-describedby", about.id);
        }
        b.addEventListener("click", () => {
          const { width, height } = addRoom();
          const direction = addStep;
          const layout = getLayout();
          const next = addPane(layout, direction, k.kind, width, height);
          closeAdd();
          if (next === layout) return;
          commit(next);
          announce(`Added a ${direction} showing ${k.label}.`);
        });
        addMenu.append(b);
      }
    } else {
      for (const d of DIRECTIONS) {
        const b = item(d.label);
        setItemDisabled(b, directionWhy(d.id));
        b.addEventListener("click", () => {
          if (isOff(b)) return;
          addStep = d.id;
          drawAdd();
          addMenu.children[1]?.focus();
        });
        addMenu.append(b);
      }
    }
    addReasons.refresh();
  }

  function openAdd({ focus = true } = {}) {
    if (isOff(addButton)) return;
    layoutWindow.close({ focus: false });
    printWindow.close({ focus: false });
    addStep = null;
    drawAdd();
    addMenu.hidden = false;
    addButton.setAttribute("aria-expanded", "true");
    if (focus) (enabled()[0] ?? addMenu.children[0])?.focus();
  }

  function closeAdd({ focus = false } = {}) {
    if (addMenu.hidden) return;
    addMenu.hidden = true;
    addStep = null;
    addButton.setAttribute("aria-expanded", "false");
    if (focus) addButton.focus();
  }

  /** The menu at its second step, as the tour shows it (E24): the kinds a column could show. */
  function showAddKinds(direction) {
    openAdd({ focus: false });
    addStep = direction;
    drawAdd();
  }

  /** Whether Add pane and New sheet… can act, and why not; read as either opens and as the layout changes. */
  function refresh() {
    const { width, height } = addRoom();
    const layout = getLayout();
    const reasons = DIRECTIONS.map((d) => addPaneNeeds(layout, d.id, width, height));
    setDisabled(addButton, addWhy(reasons));
    const hasSheet = panes(layout.root).some((p) => p.kind === "sheet");
    setDisabled(newSheetButton, hasSheet ? null : addWhy(reasons));
  }

  // Also the tour's (E59), which calls it without a press.
  function newSheet() {
    const { width, height } = addRoom();
    const layout = getLayout();
    const { layout: next, paneId } = sheetPaneFor(layout, width, height);
    closeAdd();
    if (!paneId) return null;
    if (next !== layout) commit(next);
    // The Sheets pane listens and opens its template chooser (sheet-pane.js).
    // This relies on `commit` having built the new pane, and so registered its
    // listener, before it returns: a pane drawn lazily would miss the event,
    // and the leader would see the list without the chooser (DK6-10).
    document.dispatchEvent(new CustomEvent("desk:sheet-new", { detail: { paneId } }));
    announce("New sheet: choose a template.");
    return paneId;
  }

  // ---- presses and keys ----

  addButton.addEventListener("click", () => {
    refresh();
    if (addMenu.hidden) openAdd();
    else closeAdd({ focus: true });
  });
  addButton.addEventListener("keydown", (e) => {
    if ((e.key === "ArrowDown" || e.key === "ArrowUp") && addMenu.hidden) {
      e.preventDefault();
      refresh();
      openAdd();
      if (e.key === "ArrowUp") enabled().at(-1)?.focus();
    }
  });
  newSheetButton.addEventListener("click", () => {
    refresh();
    if (!isOff(newSheetButton)) newSheet();
  });
  layoutButton.addEventListener("click", () => { closeAdd(); layoutWindow.open(); });
  printButton.addEventListener("click", () => { closeAdd(); printWindow.open(); });

  addMenu.addEventListener("keydown", (e) => {
    const list = enabled();
    const i = list.indexOf(document.activeElement);
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      list[(i + (e.key === "ArrowDown" ? 1 : list.length - 1)) % list.length]?.focus();
    } else if (e.key === "Home" || e.key === "End") {
      e.preventDefault();
      list[e.key === "Home" ? 0 : list.length - 1]?.focus();
    } else if ((e.key === "ArrowLeft" || e.key === "Escape") && addStep) {
      // One step back: from the kinds to column and row.
      e.preventDefault();
      e.stopPropagation();
      addStep = null;
      drawAdd();
      enabled()[0]?.focus();
    } else if (e.key === "Escape") {
      e.stopPropagation();
      closeAdd({ focus: true });
    } else if (e.key === "Tab") {
      closeAdd();
    }
  });
  // Tabbing or clicking out of it closes it.
  addSub.addEventListener("focusout", (e) => {
    const to = e.relatedTarget;
    if (to instanceof Node && !addSub.contains(to) && !inTour(to)) closeAdd();
  });
  document.addEventListener("pointerdown", (e) => {
    if (!addMenu.hidden && !addSub.contains(e.target) && !inTour(e.target)) closeAdd();
  });
  addEventListener("resize", refresh);
  refresh();

  return { el: row, addButton, addMenu, layoutButton, printButton, hang, showAddKinds, closeAdd, newSheet, refresh };
}
