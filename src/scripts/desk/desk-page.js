// src/scripts/desk/desk-page.js
//
// The Study Desk as a page of its own, /desk/ (STUDY-DESK.md, D9; "Order of
// work", 3c). Loaded by desk-gate.js on a computer with the preview switched
// on, when the page carries [data-desk-page]. It is not a reading surface, so
// there is no Notebook panel here: the page is panes, one to four, and this
// module opens the notebook for them.
//
// The rules are src/lib/desk-layout.mjs (pure, unit-tested); this draws them:
// - **The page's title is a menu** (E15 and E14, 2026-11-02): Add pane (a
//   column or a row, then the kind of pane), Layout, Print, Display options,
//   the notebook's page, the tour and the help page.
// - **The Layout window** offers every arrangement BVJ kept (2026-10-18: all
//   mocked but four rows), each drawn as a small diagram and grayed out, with
//   the reason, when the window can't give every pane 280 by 160 pixels. It
//   also holds which layout the page opens with ("My last layout" or "My
//   default"), "Make this my default" and "Reset to the original layout".
// - **Dragging a pane by its header** to an edge band of another splits that
//   one, and to its middle swaps the two, each shown and named before the
//   drop; a split that would leave a pane too small is refused. Escape
//   cancels. The pane's menu has Move left, right, up, and down for the
//   keyboard (a swap with the pane beside it; E25).
// - **The lines between panes move**, by pointer or by the arrow keys
//   (Shift for bigger steps); double-clicking one shares the room evenly.
// - **Each pane's name is a menu** for showing another kind in it, which is
//   also the keyboard's way to put any pane anywhere. × closes a pane.
// - **The LIT pane last scrolled, clicked or typed in is the active one**,
//   flagged "Leading" when more than one is open, and My Notes, This verse,
//   Greek, and Footnotes follow it unless their "Stay here" is pressed.
// - **Each LIT pane keeps where its reader is** (`at`, 3e), and the active
//   one's is the passage the following panes share, `layout.place`, so they
//   follow it. They lead back too: a following pane's picker, This verse's
//   Previous and Next, a footnote's verse, or scrolling the Greek move the
//   active LIT pane, which moves the rest. With no LIT pane open they share
//   the place among themselves (3d, BVJ's option A). "Stay here" gives a pane
//   its own passage, `pin.at`, which only it moves. The place starts at the
//   reader's Continue reading place, or Matthew 1.
//
// The layout is kept in localStorage['lit-desk-layout'] (named in /privacy's
// paragraph), written on every change: the last layout, the reader's own
// default, and which of the two opens the page. The default is an
// arrangement, not a passage (BA53): it opens where the reader last was.

import { recordReference } from "../../lib/desk-store-core.mjs";
import {
  ARRANGEMENTS,
  HANDLE,
  KINDS,
  LAYOUT_KEY,
  MIN_HEIGHT,
  addPane,
  addPaneNeeds,
  applyArrangement,
  arrangementOf,
  arrivalLayout,
  addBeside,
  addBesideNeeds,
  closePane,
  dropZone,
  evenOut,
  findPane,
  fitSizes,
  isFollower,
  kindLabel,
  needs,
  neighborIn,
  nodeAt,
  pathTo,
  openKind,
  openLitBeside,
  openingLayout,
  originalLayout,
  panes,
  readSaved,
  resize,
  setActive,
  setKind,
  setPin,
  setPlace,
  placeFor,
  litPlace,
  setLitAt,
  setPaneSheet,
  showSheet,
  splitPane,
  swapPanes,
  writeSaved,
} from "../../lib/desk-layout.mjs";
import { formatPassage, parsePassage, parsePlaceParam, sameChapter, startingPassage } from "../../lib/desk-passage.mjs";
import { createPrintMenu } from "./print-menu.js";
import { HELP_HREF } from "../../lib/desk-first-use.mjs";
import { loadLastRead } from "../last-read.js";
import { initActions } from "./actions.js";
import { createHighlights } from "./highlights.js";
import { createVerseLabels } from "./verse-labels.js";
import { addDeskStyle, deskCtx as ctx } from "./boot.js";
import { createDeskTour } from "./desk-tour.js";
import { mountPane } from "./desk-panes.js";
import { createHistory } from "./history.js";
import { initNoteSettings } from "./note-settings.js";
import { openBookmarkForm } from "./bookmark-form.js";
import { openNoteEditor } from "./note-editor.js";
import { initPins } from "./pins.js";
import { openStore } from "./store.js";
import { initUndo, showUndo } from "./undo-bar.js";

const NEEDS_TEXT = {
  wider: "Needs a wider window",
  taller: "Needs a taller window",
  larger: "Needs a larger window",
};

const ICON_CARET = `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor"
  stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
  <path d="M6 9l6 6 6-6" /></svg>`;

const ICON_CLOSE = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor"
  stroke-width="2" stroke-linecap="round" aria-hidden="true" focusable="false"><path d="M6 6l12 12M18 6 6 18" /></svg>`;

const ICON_GRIP = `<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true"
  focusable="false"><circle cx="9" cy="6" r="1.6" /><circle cx="15" cy="6" r="1.6" /><circle cx="9" cy="12" r="1.6" />
  <circle cx="15" cy="12" r="1.6" /><circle cx="9" cy="18" r="1.6" /><circle cx="15" cy="18" r="1.6" /></svg>`;

// The flag on the leading LIT pane, where there are two or more.
const ICON_FLAG = `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor"
  stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
  <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" /><path d="M4 22v-7" /></svg>`;

// A pane's "Stay here": a closed lock when it stays, an open one when it
// follows the LIT pane. (The thumbtack is the footnote Pin's alone, pins.js.)
const ICON_LOCK = `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor"
  stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
  <rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></svg>`;

const ICON_UNLOCK = `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor"
  stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
  <rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 7.5-2" /></svg>`;

// A pane's "Move" items, in the order the menu lists them (E25).
const MOVES = [
  { direction: "left", label: "Move left" },
  { direction: "right", label: "Move right" },
  { direction: "up", label: "Move up" },
  { direction: "down", label: "Move down" },
];

// "Greek, The LIT, and My Notes": the Oxford comma, as the site writes lists.
const LIST = new Intl.ListFormat("en-US", { type: "conjunction" });

function el(tag, className, text) {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (text != null) e.textContent = text;
  return e;
}

function readKey() {
  try { return localStorage.getItem(LAYOUT_KEY); } catch (_) { return null; }
}

// While the Study Desk tour runs the desk changes its layout on the screen and
// writes none of it (E24, desk-tour.js): the reader's own is put back at the end,
// and a reload mid-tour finds the layout it left.
let layoutFrozen = false;

function writeKey(text) {
  if (layoutFrozen) return;
  try { localStorage.setItem(LAYOUT_KEY, text); } catch (_) {}
}

/** Inside the tour's card, which the menus' own "click elsewhere" closing must not count as elsewhere. */
const inTour = (node) => node instanceof Element && Boolean(node.closest(".desk-tour"));

/** A small picture of an arrangement, for the Layout menu. */
function diagram(shape) {
  const W = 40;
  const H = 26;
  const G = 2;
  const rects = [];
  const walk = (node, x, y, w, h) => {
    if (node.slot) { rects.push([x, y, w, h]); return; }
    const n = node.children.length;
    node.children.forEach((child, i) => {
      if (node.split === "columns") {
        const cw = (w - G * (n - 1)) / n;
        walk(child, x + i * (cw + G), y, cw, h);
      } else {
        const ch = (h - G * (n - 1)) / n;
        walk(child, x, y + i * (ch + G), w, ch);
      }
    });
  };
  walk(shape, 1, 1, W - 2, H - 2);
  return `<svg class="desk-ws__shape-svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" aria-hidden="true" focusable="false">${rects
    .map(([x, y, w, h]) => `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" rx="1.5" />`)
    .join("")}</svg>`;
}

async function start() {
  const root = document.querySelector("[data-desk-page]");
  if (!root) return;
  addDeskStyle();
  initNoteSettings();
  initUndo();

  let store = null;
  let storeError = null;
  try {
    store = await openStore({ ctx });
  } catch (err) {
    storeError = err;
    console.error("Study Desk: the notebook didn’t open", err);
  }
  if (store) createHistory({ store, ctx });
  // The LIT pane's verse menu and selection panel get the "My Notebook" row
  // (3f, 3g): Add a note, Bookmark and Highlight.
  if (store) initActions({ store, ctx });
  // Pin / Unpin on the LIT pane's footnotes, This verse and the Footnotes
  // pane (3g).
  initPins({ store, ctx, desk: true });
  // The reader's highlights on the LIT panes, and the verse numbers' names
  // for them (3g).
  if (store) {
    createHighlights({ store });
    createVerseLabels({ store });
  }
  const onEdit = store
    ? (record, trigger) =>
        record.kind === "bookmark"
          ? openBookmarkForm({ trigger, store, ctx, record, restoreFocus: trigger })
          : openNoteEditor({ trigger, store, ctx, ref: recordReference(record), record, restoreFocus: trigger })
    : null;
  // A word in This verse's Greek opens in a Greek pane showing its chapter.
  const openGreekWord = (passage, t) => {
    const greek = Array.from(paneEls.values()).find((r) => r.kind === "greek" && sameChapter(r.inst?.chapter?.(), passage));
    if (greek) greek.inst.selectWord(passage.verse, t, { focus: true });
    else announce("Open a Greek pane on this chapter to see the word.");
  };
  // The draft chapters of each book, written at build (desk.astro), so the
  // LIT pane shows a run of them as one stub without fetching each.
  let drafts = {};
  try { drafts = JSON.parse(document.getElementById("desk-drafts")?.textContent || "{}") ?? {}; } catch (_) {}
  // A sheet's passage shown in the LIT pane being read (or, with none, in the
  // panes that follow), as a picker would move it.
  // `beside` is a pane (the Search pane) that a result came from: with no LIT
  // pane open, one opens to its left where there is room (3m), so a verse
  // found still lands.
  const showPassage = (passage, { beside = null } = {}) => {
    const at = formatPassage(passage);
    if (!at) return;
    if (findPane(layout.root, layout.active)?.kind === "lit") {
      commit(setLitAt(layout, layout.active, at), { draw: false });
      return;
    }
    const placed = setPlace(layout, at);
    if (beside) {
      const room = panesBox.getBoundingClientRect();
      const next = openLitBeside(placed, beside, room.width, room.height);
      if (next !== placed) {
        commit(next);
        return;
      }
    }
    commit(placed, { draw: false });
  };
  // A new sheet shown in a Sheet pane, as "Open it on the Study Desk" does
  // (M5): from the Search pane's "Make a sheet of these verses". That pane and
  // the LIT panes keep their places; false when no other pane could show it.
  const showSheetPane = (sheetId, keep) => {
    const next = showSheet(layout, sheetId, panesBox.getBoundingClientRect().width, keep);
    if (next === layout) return false;
    commit(next);
    return true;
  };
  // A Greek search result (3m): its word in an unpinned Greek pane, else a
  // Greek pane opened beside the search where there is room; the LIT pane
  // moves to the verse either way.
  const openGreekHit = (hit, searchId) => {
    const passage = { bookKey: hit.book, chapter: hit.chapter, verse: hit.verse };
    const unpinned = () => panes(layout.root).find((p) => p.kind === "greek" && !p.pin);
    let greek = unpinned();
    if (!greek) {
      const room = panesBox.getBoundingClientRect();
      const before = new Set(panes(layout.root).map((p) => p.id));
      const next = openKind(layout, "greek", room.width, room.height, searchId);
      if (next !== layout) {
        commit(next);
        greek = panes(layout.root).find((p) => !before.has(p.id));
      }
    }
    if (greek) paneEls.get(greek.id)?.inst?.goToWord?.(passage, hit.t);
    else announce("Open a Greek pane to see the word.");
    showPassage(passage, { beside: searchId });
  };
  const env = { store, storeError, onEdit, ctx, openGreekWord, drafts, showPassage, showSheet: showSheetPane, openGreekHit };

  document.documentElement.dataset.deskWorkspace = "";
  root.replaceChildren();
  root.classList.add("desk-ws");

  let saved = readSaved(readKey());
  // Where the reader last read (Continue reading), or Matthew 1: where a
  // layout with no place of its own starts, and where "My default" opens
  // when the desk has no last place (BA53).
  let lastRead = null;
  try { lastRead = loadLastRead(); } catch (_) {}
  const reading = formatPassage(startingPassage(lastRead));
  // /desk/?place=romans-8 (E8) is a link that carries a passage: the layout
  // the page would have opened (last, default, or the original) stays, and
  // only the leading LIT pane moves. A value that names no passage is
  // ignored, and the parameter is stripped below either way.
  const arrivalPlace = parsePlaceParam(new URLSearchParams(location.search).get("place"));
  let layout = arrivalPlace ? arrivalLayout(saved, arrivalPlace, reading) : openingLayout(saved, reading);
  if (!parsePassage(layout.place)) layout = setPlace(layout, reading);

  // ---- the title menu ----

  // The page's title is a menu (E15; BVJ, 2026-11-02) gathering what the bar
  // held: Add pane (E14), Layout, Print and Display options, then the tour and
  // the help page. The Layout and Print windows below open under the title, as
  // they opened under their buttons, and Escape in one returns focus to it.
  const bar = document.querySelector("[data-desk-header-tools]") ?? el("div", "desk-ws__bar");
  const titleHost = document.querySelector(".site-header__page-title");
  const wrap = el("div", "desk-title");
  const titleButton = el("button", "desk-title__button");
  titleButton.type = "button";
  titleButton.setAttribute("aria-haspopup", "menu");
  titleButton.setAttribute("aria-expanded", "false");
  titleButton.setAttribute("aria-controls", "deskTitleMenu");
  titleButton.innerHTML = `<span></span>${ICON_CARET}`;
  titleButton.firstElementChild.textContent = titleHost?.textContent.trim() || "Study Desk";
  if (titleHost) {
    // The heading keeps its place and its type; the menus sit beside it in
    // the header's own type, not the heading's.
    const heading = el("h1", titleHost.className);
    heading.append(titleButton);
    wrap.prepend(heading);
    titleHost.replaceWith(wrap);
  } else {
    wrap.append(titleButton);
    bar.append(wrap);
  }

  // ---- the Layout window ----

  const menu = el("div", "desk-ws__menu");
  menu.id = "deskLayoutMenu";
  menu.setAttribute("role", "dialog");
  menu.setAttribute("aria-label", "Layout");
  menu.tabIndex = -1; // takes focus itself when it has nothing to hand it to (DK-13)
  menu.hidden = true;
  menu.innerHTML = `
    <div class="desk-ws__shapes" role="group" aria-label="Arrange the panes"></div>
    <p class="desk-ws__menu-note">Or drag a pane by its header: to an edge of another to split it, to its middle to swap places. A pane’s name menu has Move left, right, up, and down for the keyboard.</p>
    <fieldset class="desk-ws__start">
      <legend>When this page opens, show</legend>
      <label><input type="radio" name="desk-ws-start" value="last" /> My last layout</label>
      <label><input type="radio" name="desk-ws-start" value="default" /> My default</label>
    </fieldset>
    <div class="desk-ws__menu-actions">
      <button type="button" data-ws-make-default>Make this my default</button>
      <button type="button" data-ws-reset>Reset to the original layout</button>
    </div>`;
  wrap.append(menu);

  const shapesBox = menu.querySelector(".desk-ws__shapes");
  const shapeButtons = ARRANGEMENTS.map((a) => {
    const b = el("button", "desk-ws__shape");
    b.type = "button";
    b.dataset.arrangement = a.id;
    b.innerHTML = `${diagram(a.shape)}<span class="desk-ws__shape-name"></span><span class="desk-ws__shape-needs"></span>`;
    b.querySelector(".desk-ws__shape-name").textContent = a.label;
    b.querySelector(".desk-ws__shape-needs").id = `deskWsNeeds-${a.id}`;
    b.addEventListener("click", () => {
      if (b.getAttribute("aria-disabled") === "true") return;
      const before = layout;
      const next = applyArrangement(layout, a.id);
      const stays = new Set(panes(next.root).map((p) => p.id));
      const closed = panes(before.root).filter((p) => !stays.has(p.id)).map((p) => kindLabel(p.kind));
      commit(next);
      // A smaller layout closes panes from the end: say which, and offer to
      // bring them back (DK-9). The bar announces itself.
      if (closed.length) showUndo(`Layout: ${a.label}. Closed ${LIST.format(closed)}.`, () => commit(before));
      else announce(`Layout: ${a.label}.`);
      closeMenu();
    });
    shapesBox.append(b);
    return b;
  });
  const startRadios = Array.from(menu.querySelectorAll('input[name="desk-ws-start"]'));
  for (const radio of startRadios) {
    radio.addEventListener("change", () => {
      if (!radio.checked || layoutFrozen) return;
      saved = { ...readSaved(readKey()), start: radio.value };
      writeKey(writeSaved(saved));
    });
  }
  const makeDefault = menu.querySelector("[data-ws-make-default]");
  makeDefault.addEventListener("click", () => {
    if (layoutFrozen) return;
    saved = { ...readSaved(readKey()), mine: layout };
    writeKey(writeSaved(saved));
    refreshMenu();
    announce("This layout is now your default.");
  });
  menu.querySelector("[data-ws-reset]").addEventListener("click", () => {
    // The panes go back; the reader's place stays (BA55).
    commit(originalLayout(layout.place));
    announce("Back to the original layout: the LIT beside My Notes.");
    closeMenu();
  });

  function refreshMenu() {
    const { width, height } = panesBox.getBoundingClientRect();
    const current = arrangementOf(layout);
    for (const b of shapeButtons) {
      const why = needs(b.dataset.arrangement, width, height);
      const note = b.querySelector(".desk-ws__shape-needs");
      note.textContent = why ? NEEDS_TEXT[why] : "";
      if (why) {
        b.setAttribute("aria-disabled", "true");
        b.setAttribute("aria-describedby", note.id);
      } else {
        b.removeAttribute("aria-disabled");
        b.removeAttribute("aria-describedby");
      }
      b.setAttribute("aria-pressed", String(b.dataset.arrangement === current));
    }
    const defaultRadio = startRadios.find((r) => r.value === "default");
    defaultRadio.disabled = !saved.mine;
    for (const r of startRadios) r.checked = r.value === (saved.mine ? saved.start : "last");
  }

  function openMenu() {
    refreshMenu();
    menu.hidden = false;
    (shapesBox.querySelector('[aria-pressed="true"]') ?? shapeButtons[0]).focus();
  }

  function closeMenu({ focus = true } = {}) {
    if (menu.hidden) return;
    menu.hidden = true;
    if (focus) titleButton.focus();
  }

  menu.addEventListener("keydown", (e) => {
    if (e.key === "Escape") { e.stopPropagation(); closeMenu(); }
  });
  // Tabbing out of the window closes it, as a click elsewhere does (BA63).
  // Focus going nowhere (another window, a click on nothing focusable) leaves
  // it to the click.
  menu.addEventListener("focusout", (e) => {
    const to = e.relatedTarget;
    if (to instanceof Node && !menu.contains(to) && !wrap.contains(to) && !inTour(to)) closeMenu({ focus: false });
  });

  // ---- the Print menu ----

  // The shared Print menu (print-menu.js; E16): a chapter to print, which
  // starts at the one the leading LIT pane shows (else the place the panes
  // share) and can be changed to any other, then the three prints. Each choice
  // opens that chapter in a new tab, which prints itself (print-link.js; BVJ,
  // 2026-10-29). A draft has no text to print.
  const printMenu = el("div", "desk-ws__menu desk-ws__print-menu");
  printMenu.id = "deskPrintMenu";
  printMenu.setAttribute("role", "dialog");
  printMenu.setAttribute("aria-label", "Print");
  printMenu.tabIndex = -1;
  printMenu.hidden = true;
  wrap.append(printMenu);

  /** The chapter to start from: the leading LIT pane's, else the shared place. */
  function printChapter() {
    const active = findPane(layout.root, layout.active);
    const p = active?.kind === "lit" ? passageOf(active.id) : parsePassage(layout.place);
    return p?.bookKey && p.chapter ? p : null;
  }

  const printContents = createPrintMenu({
    id: "desk",
    start: printChapter,
    drafts,
    notebook: Boolean(store),
    onChoose: () => closePrintMenu({ focus: false }),
  });
  printMenu.append(printContents.el);

  function openPrintMenu() {
    closeMenu({ focus: false });
    printContents.open();
    printMenu.hidden = false;
    printContents.focusTarget().focus?.();
  }

  function closePrintMenu({ focus = true } = {}) {
    if (printMenu.hidden) return;
    printMenu.hidden = true;
    if (focus) titleButton.focus();
  }

  printMenu.addEventListener("keydown", (e) => {
    if (e.key === "Escape") { e.stopPropagation(); closePrintMenu(); }
  });
  // Escape from the title button, where focus can sit while a window is open
  // (Shift+Tab back to it, or a window with nothing to focus), closes the
  // window as it does from inside (DK-13). These windows are popups that close
  // when focus leaves them (BA63), not modal dialogs, so there is no trap to
  // wrap Tab (RC-7); the title button is the one control focus can go back to.
  wrap.addEventListener("keydown", (e) => {
    if (e.key !== "Escape" || e.defaultPrevented) return;
    if (!menu.hidden) { e.stopPropagation(); closeMenu(); }
    else if (!printMenu.hidden) { e.stopPropagation(); closePrintMenu(); }
  });
  printMenu.addEventListener("focusout", (e) => {
    const to = e.relatedTarget;
    if (to instanceof Node && !printMenu.contains(to) && !wrap.contains(to) && !inTour(to)) closePrintMenu({ focus: false });
  });

  // ---- the title menu's items ----

  const titleMenu = el("div", "desk-ws__menu desk-title__menu");
  titleMenu.id = "deskTitleMenu";
  titleMenu.setAttribute("role", "menu");
  titleMenu.setAttribute("aria-label", titleButton.firstElementChild.textContent);
  titleMenu.hidden = true;
  wrap.append(titleMenu);

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
  // The notebook's page (BVJ, 2026-11-02). No Settings window, and no "where
  // it is kept" item (it would only link to a section of that page): nothing
  // else of the Notebook's settings applies here.
  const notebookItem = item("My notebook page", "a");
  notebookItem.href = "/notebook/";
  // The Study Desk tour runs here, in place (E24); the notebook's runs on a
  // chapter page and starts from the Notebook's foot and the help page.
  let tour = null; // the Study Desk tour, made once the panes exist (below)
  const tourItem = item("Take the tour");
  tourItem.addEventListener("click", () => { closeTitleMenu({ focus: false }); tour?.start(); });
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
  tourLineGo.addEventListener("click", () => { closeTitleMenu({ focus: false }); tour?.start(); });
  const tourLineNo = item("Not now");
  tourLineNo.classList.add("desk-title__line-no");
  tourLineNo.addEventListener("click", () => { tour?.declineLine(); refreshTourLine(); tourItem.focus(); });
  tourLine.append(tourLineGo, tourLineNo);
  tourLine.hidden = true;
  function refreshTourLine() {
    tourLine.hidden = !tour?.lineWanted();
  }
  titleMenu.append(tourLine);
  titleMenu.append(addSub, layoutItem, printItem);
  if (displayItem) titleMenu.append(displayItem);
  titleMenu.append(el("div", "desk-title__rule"), notebookItem, tourItem, helpItem);
  const baseItems = [addItem, layoutItem, printItem, ...(displayItem ? [displayItem] : []), notebookItem, tourItem, helpItem];
  const topItems = () => (tourLine.hidden ? baseItems : [tourLineGo, tourLineNo, ...baseItems]);

  const DIRECTIONS = [
    { id: "column", label: "Add column" },
    { id: "row", label: "Add row" },
  ];
  let addStep = null; // null, or the direction chosen, once the flyout asks for a kind

  const addRoom = () => panesBox.getBoundingClientRect();

  /** Why a direction can't take a pane, for the hint; null when it can. */
  function addWhy(direction) {
    const { width, height } = addRoom();
    const why = addPaneNeeds(layout, direction, width, height);
    return why === "full" ? "Four is the most" : why ? NEEDS_TEXT[why] : null;
  }

  function refreshAdd() {
    const reasons = DIRECTIONS.map((d) => addWhy(d.id));
    if (!reasons.every(Boolean)) return setDisabled(addItem, null);
    setDisabled(addItem, reasons.includes("Four is the most") ? "Four is the most" : NEEDS_TEXT.larger);
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
        b.addEventListener("click", () => {
          const { width, height } = addRoom();
          const direction = addStep;
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
        setDisabled(b, addWhy(d.id));
        b.addEventListener("click", () => {
          if (b.getAttribute("aria-disabled") === "true") return;
          addStep = d.id;
          drawAddFly();
          addFly.children[1].focus();
        });
        addFly.append(b);
      }
    }
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
    closeMenu({ focus: false });
    closePrintMenu({ focus: false });
    refreshAdd();
    refreshTourLine();
    titleMenu.hidden = false;
    titleButton.setAttribute("aria-expanded", "true");
    const items = topItems();
    (enabled(items)[0] ?? items[0]).focus();
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
  layoutItem.addEventListener("click", () => { closeTitleMenu({ focus: false }); openMenu(); });
  printItem.addEventListener("click", () => { closeTitleMenu({ focus: false }); openPrintMenu(); });
  // The tray's own listener (first on this button) has placed it under the title.
  displayItem?.addEventListener("click", () => closeTitleMenu({ focus: false }));
  for (const link of links) link.addEventListener("click", () => closeTitleMenu({ focus: false }));

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

  // ---- the panes ----

  const panesBox = el("div", "desk-ws__panes");
  const drop = el("div", "desk-ws__drop");
  drop.hidden = true;
  const status = el("p", "sr-only");
  status.setAttribute("role", "status");
  const announce = (text) => { status.textContent = ""; requestAnimationFrame(() => { status.textContent = text; }); };
  if (bar.isConnected) root.append(panesBox, status);
  else root.append(bar, panesBox, status);

  const paneEls = new Map(); // id → { el, body, kind, inst, ... }
  // The tree as drawn: the layout's, with sizes fitted to the room there is
  // (fit). The layout keeps the reader's own sizes, so a narrow window
  // squeezes the panes only while it is narrow (BA61).
  let drawn = layout.root;
  let kindMenu = null; // the open "show in this pane" menu, if any

  function save() {
    if (layoutFrozen) return;
    // The key holds three things, and another tab may have changed the
    // default or the opening choice since this one loaded: this tab writes
    // only `last` over what is there now (DK-11).
    const { mine, start } = readSaved(readKey());
    saved = { ...saved, mine, start, last: layout };
    writeKey(writeSaved(saved));
  }

  /** Take a new layout: kept at once, and drawn (or only re-marked). */
  function commit(next, { draw: redraw = true } = {}) {
    if (next === layout) return;
    layout = next;
    save();
    if (redraw) draw();
    else mark();
    follow();
  }

  /** The passage a pane shows now: a LIT pane's own, a following pane's own or the shared one. */
  const passageOf = (id) => parsePassage(litPlace(layout, id) ?? placeFor(layout, id))
    ?? parsePassage(layout.place) ?? startingPassage(null);

  /**
   * A pane's passage changed. A LIT pane is telling where its reader is; a
   * following pane that stays put moves only itself; one that follows moves
   * the active LIT pane (or, with none open, the shared place), and with it
   * every pane that follows.
   */
  function setPassageOf(id, passage) {
    const at = formatPassage(passage);
    const pane = findPane(layout.root, id);
    if (!at || !pane) return;
    if (pane.kind === "lit") {
      const rec = paneEls.get(id);
      if (rec) rec.at = at; // it is already there
      commit(setLitAt(layout, id, at), { draw: false });
    } else if (pane.pin) {
      commit(setPin(layout, id, true, at), { draw: false });
    } else if (findPane(layout.root, layout.active)?.kind === "lit") {
      commit(setLitAt(layout, layout.active, at), { draw: false });
    } else {
      commit(setPlace(layout, at), { draw: false });
    }
  }

  /** Give each pane that is moved (LIT and following) its passage, when it has changed. */
  function follow() {
    for (const pane of panes(layout.root)) {
      const rec = paneEls.get(pane.id);
      if (!rec?.inst?.setPassage) continue;
      const p = passageOf(pane.id);
      const at = formatPassage(p);
      if (rec.at === at) continue;
      rec.at = at;
      rec.inst.setPassage(p);
    }
  }

  function paneRecord(pane) {
    let rec = paneEls.get(pane.id);
    if (!rec) {
      const section = el("section", "desk-pane");
      section.dataset.paneId = pane.id;
      const head = el("header", "desk-pane__head");
      const grip = el("span", "desk-pane__grip");
      grip.innerHTML = ICON_GRIP;
      const h2 = el("h2", "desk-pane__title");
      const kindButton = el("button", "desk-pane__kind");
      kindButton.type = "button";
      kindButton.id = `deskPaneTitle-${pane.id}`;
      kindButton.setAttribute("aria-haspopup", "menu");
      kindButton.setAttribute("aria-expanded", "false");
      kindButton.innerHTML = `<span class="desk-pane__name"></span>${ICON_CARET}`;
      h2.append(kindButton);
      // A flag and no words (BVJ, 2026-11-02); the name is for a screen reader.
      const lead = el("span", "desk-pane__lead");
      lead.innerHTML = ICON_FLAG;
      lead.setAttribute("role", "img");
      lead.setAttribute("aria-label", "Leading pane: My Notes, This verse, Greek, and Footnotes follow it");
      lead.title = "Leading: My Notes, This verse, Greek, and Footnotes follow this pane";
      const pin = el("button", "desk-pane__pin");
      pin.type = "button";
      // A glyph with no words; mark() paints the lock and sets its name.
      pin.innerHTML = ICON_UNLOCK;
      const close = el("button", "desk-pane__close");
      close.type = "button";
      close.innerHTML = ICON_CLOSE;
      head.append(grip, h2, lead, pin, close);
      const body = el("div", "desk-pane__body");
      section.append(head, body);
      rec = { el: section, head, body, kindButton, lead, pin, close, kind: null, inst: null, at: null };
      paneEls.set(pane.id, rec);

      kindButton.addEventListener("click", () => openKindMenu(pane.id, kindButton));
      pin.addEventListener("click", () => {
        const now = findPane(layout.root, pane.id);
        // A pane that stays put keeps the passage it shows; let go, it
        // rejoins the passage the following panes share.
        commit(setPin(layout, pane.id, !now?.pin, now?.pin ? null : formatPassage(passageOf(pane.id))), { draw: false });
        announce(now?.pin ? `${kindLabel(now.kind)} follows the LIT pane again.` : `${kindLabel(now.kind)} stays here.`);
      });
      close.addEventListener("click", () => {
        const name = kindLabel(findPane(layout.root, pane.id)?.kind);
        commit(closePane(layout, pane.id));
        announce(`${name} closed.`);
        panesBox.querySelector(".desk-pane__kind")?.focus();
      });
      head.addEventListener("pointerdown", (e) => startMove(e, pane.id));
      // The LIT pane last worked in leads (D9, "Phase 3a's answers", 6).
      const touch = () => {
        const p = findPane(layout.root, pane.id);
        if (p?.kind === "lit") commit(setActive(layout, pane.id), { draw: false });
      };
      body.addEventListener("pointerdown", touch);
      body.addEventListener("focusin", touch);
      body.addEventListener("keydown", touch);
      // Not "scroll": a LIT pane scrolls itself when it loads a chapter
      // above or is sent somewhere, and that isn't the reader working in it.
      body.addEventListener("wheel", touch, { passive: true });
    }
    if (rec.kind !== pane.kind) {
      rec.inst?.destroy();
      rec.body.replaceChildren();
      rec.kind = pane.kind;
      // A LIT or following pane starts at its passage; follow() moves it after.
      rec.at = isFollower(pane.kind) || pane.kind === "lit" ? formatPassage(passageOf(pane.id)) : null;
      rec.inst = mountPane(pane.kind, rec.body, env, {
        id: pane.id,
        get: () => passageOf(pane.id),
        set: (passage) => setPassageOf(pane.id, passage),
        getSheet: () => findPane(layout.root, pane.id)?.sheet ?? null,
        setSheet: (sheetId) => commit(setPaneSheet(layout, pane.id, sheetId), { draw: false }),
      });
    }
    return rec;
  }

  function build(node, path) {
    if (node.pane) return paneRecord(node.pane).el;
    const box = el("div", `desk-split desk-split--${node.split}`);
    box.dataset.path = path.join(".");
    node.children.forEach((child, i) => {
      if (i) box.append(lineBetween(node, path, i - 1));
      const part = build(child, [...path, i]);
      part.style.flex = `${node.sizes[i]} 1 0px`;
      box.append(part);
    });
    return box;
  }

  /**
   * Note a pane's scrolling before it is moved, and return what puts it back
   * (BA51): every scrolled box in it, then the pane's own `keep`, which a
   * pane whose scrolling tells where its reader is gives (the LIT, the Greek).
   */
  function keepScroll(rec) {
    const boxes = [];
    for (const e of rec.el.querySelectorAll("*")) {
      if (e.scrollTop || e.scrollLeft) boxes.push([e, e.scrollTop, e.scrollLeft]);
    }
    const own = rec.inst?.keep?.();
    return () => {
      for (const [e, top, left] of boxes) {
        e.scrollTop = top;
        e.scrollLeft = left;
      }
      own?.();
    };
  }

  function draw() {
    const live = new Set(panes(layout.root).map((p) => p.id));
    for (const [id, rec] of paneEls) {
      if (!live.has(id)) { rec.inst?.destroy(); paneEls.delete(id); }
    }
    // Moving a pane into its new place takes it off the page for a moment,
    // which resets its scrolling (BA51), so each is noted first; and moving
    // an element blurs it, so the focus is put back after too.
    const putBack = Array.from(paneEls.values(), (rec) => (rec.el.isConnected ? keepScroll(rec) : null));
    fit();
    const focused = panesBox.contains(document.activeElement) ? document.activeElement : null;
    const tree = build(drawn, []);
    tree.style.flex = "1 1 0px";
    panesBox.replaceChildren(tree, drop);
    for (const back of putBack) back?.();
    if (focused?.isConnected) focused.focus({ preventScroll: true });
    mark();
    follow();
  }

  /** The parts of each pane's header that change without redrawing. */
  function mark() {
    const all = panes(layout.root);
    const lits = all.filter((p) => p.kind === "lit").length;
    for (const pane of all) {
      const rec = paneEls.get(pane.id);
      if (!rec) continue;
      const name = kindLabel(pane.kind);
      rec.kindButton.querySelector(".desk-pane__name").textContent = name;
      rec.kindButton.setAttribute("aria-label", `${name} pane: show something else here, or move it`);
      // The region is named by its kind alone; the instruction stays on the button (DK-7).
      rec.el.setAttribute("aria-label", name);
      const leading = pane.kind === "lit" && lits > 1 && layout.active === pane.id;
      rec.lead.hidden = !leading;
      rec.el.classList.toggle("desk-pane--leading", leading);
      rec.pin.hidden = !isFollower(pane.kind);
      rec.pin.setAttribute("aria-pressed", String(Boolean(pane.pin)));
      // Pressed means it stays, so the lock is closed. The name is "Stay here"
      // either way (aria-pressed carries the state); the tooltip says what a
      // press does now.
      rec.pin.setAttribute("aria-label", "Stay here");
      rec.pin.title = pane.pin ? "Follow the LIT pane" : "Stay here";
      const locked = Boolean(pane.pin);
      if (rec.pin.dataset.locked !== String(locked)) {
        rec.pin.dataset.locked = String(locked);
        rec.pin.innerHTML = locked ? ICON_LOCK : ICON_UNLOCK;
      }
      rec.close.hidden = all.length <= 1;
      rec.close.setAttribute("aria-label", `Close the ${name.replace(/^The /, "")} pane`);
    }
  }

  // ---- "show in this pane" ----

  function closeKindMenu({ focus = true } = {}) {
    if (!kindMenu) return;
    const { menuEl, button, fly } = kindMenu;
    clearTimeout(flyTimer);
    kindMenu = null;
    fly?.el.remove();
    menuEl.remove();
    button.setAttribute("aria-expanded", "false");
    if (focus) button.focus();
  }

  // The pane menu's Add pane, Move and Size are flyouts beside it, as the title
  // menu's Add pane is: hover opens one without taking focus, a click or the
  // right arrow moves into it. A flyout is a sibling of the menu, not a child,
  // since the menu scrolls and would clip it.
  let flyTimer = 0;

  const flyButtons = (flyEl) => Array.from(flyEl.querySelectorAll("button")).filter((b) => b.getAttribute("aria-disabled") !== "true");

  function closeFly({ focus = false } = {}) {
    const fly = kindMenu?.fly;
    if (!fly) return;
    fly.el.remove();
    fly.trigger.setAttribute("aria-expanded", "false");
    kindMenu.fly = null;
    if (focus) fly.trigger.focus({ preventScroll: true });
  }

  function closeFlyLater() {
    clearTimeout(flyTimer);
    flyTimer = setTimeout(() => {
      if (kindMenu?.fly && !kindMenu.fly.el.contains(document.activeElement)) closeFly();
    }, 250);
  }

  function openFly(def, trigger, { focus = true } = {}) {
    if (!kindMenu) return;
    clearTimeout(flyTimer);
    const current = kindMenu.fly;
    if (current?.trigger === trigger) {
      if (focus) flyButtons(current.el)[0]?.focus({ preventScroll: true });
      return;
    }
    closeFly();
    const flyEl = el("div", "desk-pane__menu desk-pane__fly");
    flyEl.setAttribute("role", "menu");
    flyEl.setAttribute("aria-label", def.name);
    def.build(flyEl, null);
    kindMenu.head.append(flyEl);
    // Beside the menu, level with its line; on the other side where the
    // window's edge is in the way, and kept inside the window below.
    const m = kindMenu.menuEl.getBoundingClientRect();
    const t = trigger.getBoundingClientRect();
    const edge = 8;
    let left = m.right + 2;
    if (left + flyEl.offsetWidth > window.innerWidth - edge) left = m.left - flyEl.offsetWidth - 2;
    flyEl.style.left = `${Math.max(edge, left)}px`;
    flyEl.style.top = `${Math.max(edge, Math.min(t.top - 4, window.innerHeight - edge - flyEl.offsetHeight))}px`;
    flyEl.addEventListener("mouseenter", () => clearTimeout(flyTimer));
    flyEl.addEventListener("mouseleave", closeFlyLater);
    flyEl.addEventListener("keydown", (e) => {
      const live = flyButtons(flyEl);
      const i = live.indexOf(document.activeElement);
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        live[(i + (e.key === "ArrowDown" ? 1 : live.length - 1)) % live.length]?.focus();
      } else if (e.key === "Home" || e.key === "End") {
        e.preventDefault();
        live[e.key === "Home" ? 0 : live.length - 1]?.focus();
      } else if (e.key === "ArrowLeft" || e.key === "Escape") {
        // One step back: from the kinds to the directions, then out of the flyout.
        e.preventDefault();
        e.stopPropagation();
        if (flyEl.dataset.step) {
          def.build(flyEl, null);
          flyButtons(flyEl)[0]?.focus();
        } else {
          closeFly({ focus: true });
        }
      } else if (e.key === "Tab") {
        closeKindMenu({ focus: false });
      }
    });
    trigger.setAttribute("aria-expanded", "true");
    kindMenu.fly = { el: flyEl, trigger };
    if (focus) flyButtons(flyEl)[0]?.focus({ preventScroll: true });
  }

  let paneHintCount = 0;

  function openKindMenu(id, button) {
    const wasOpen = kindMenu?.button === button;
    closeKindMenu({ focus: false });
    if (wasOpen) return;
    const pane = findPane(layout.root, id);
    const menuEl = el("div", "desk-pane__menu");
    menuEl.setAttribute("role", "menu");
    menuEl.setAttribute("aria-label", "Pane options");
    // The kinds are radios and the moves plain items, so each has a group of
    // its own with its own name.
    const kinds = el("div", "desk-pane__menu-group");
    kinds.setAttribute("role", "group");
    kinds.setAttribute("aria-label", "Show in this pane");
    menuEl.append(kinds);
    for (const k of KINDS) {
      const item = el("button", "desk-pane__menu-item", k.label);
      item.type = "button";
      item.setAttribute("role", "menuitemradio");
      item.setAttribute("aria-checked", String(k.kind === pane.kind));
      item.tabIndex = -1;
      item.addEventListener("click", () => {
        closeKindMenu();
        commit(setKind(layout, id, k.kind));
        announce(`This pane now shows ${k.label}.`);
      });
      kinds.append(item);
    }
    const head = button.closest(".desk-pane__head");
    // A line of the menu or its flyouts: a label, and under it, greyed, the
    // reason it can't be used (as the title menu draws one).
    const menuItem = (label, why) => {
      const b = el("button", "desk-pane__menu-item");
      b.type = "button";
      b.setAttribute("role", "menuitem");
      b.tabIndex = -1;
      b.append(el("span", "desk-title__label", label));
      if (why) {
        const hint = el("span", "desk-title__hint", why);
        hint.id = `deskPaneHint-${id}-${++paneHintCount}`;
        b.append(hint);
        b.setAttribute("aria-disabled", "true");
        b.setAttribute("aria-describedby", hint.id);
      }
      return b;
    };

    // Move this pane (E25): the keyboard's way to do what dragging does. It
    // swaps places with the pane beside it, so "Move left" is only offered
    // where there is one; the panes are asked where they are drawn.
    const rects = panes(layout.root).map((p) => {
      const r = paneEls.get(p.id)?.el.getBoundingClientRect();
      return r ? { id: p.id, left: r.left, top: r.top, right: r.right, bottom: r.bottom } : null;
    }).filter(Boolean);
    const moves = MOVES.map((m) => ({ ...m, other: neighborIn(rects, id, m.direction) })).filter((m) => m.other);
    const buildMove = (fly) => {
      for (const m of moves) {
        const b = menuItem(m.label);
        b.addEventListener("click", () => {
          const name = kindLabel(findPane(layout.root, id)?.kind);
          const other = kindLabel(findPane(layout.root, m.other)?.kind);
          closeKindMenu();
          commit(swapPanes(layout, id, m.other));
          announce(`${name} moved ${m.direction}, swapping with ${other}.`);
        });
        fly.append(b);
      }
    };

    // Add a pane beside this one: the flyout asks which side, then, in the same
    // flyout, the kind, and the others scoot over (addBeside).
    const { width, height } = panesBox.getBoundingClientRect();
    const SIDES = [
      { id: "left", label: "To the left", said: "to the left" },
      { id: "right", label: "To the right", said: "to the right" },
      { id: "above", label: "Above", said: "above" },
      { id: "below", label: "Below", said: "below" },
    ];
    const sideWhy = (s) => {
      const why = addBesideNeeds(layout, id, s, width, height);
      return why === "full" ? "Four is the most" : why ? NEEDS_TEXT[why] : null;
    };
    const buildAdd = (fly, side) => {
      fly.replaceChildren();
      if (side) fly.dataset.step = side; else delete fly.dataset.step;
      if (!side) {
        for (const s of SIDES) {
          const b = menuItem(s.label, sideWhy(s.id));
          b.addEventListener("click", () => {
            if (b.getAttribute("aria-disabled") === "true") return;
            buildAdd(fly, s.id);
            fly.children[1]?.focus();
          });
          fly.append(b);
        }
        return;
      }
      const label = SIDES.find((s) => s.id === side).label;
      const back = menuItem(`‹ ${label}`);
      back.addEventListener("click", () => { buildAdd(fly, null); fly.children[0]?.focus(); });
      fly.append(back);
      for (const k of KINDS) {
        const b = menuItem(k.label);
        b.addEventListener("click", () => {
          const next = addBeside(layout, id, side, k.kind, width, height);
          closeKindMenu();
          if (next === layout) return;
          commit(next);
          announce(`Added a pane ${SIDES.find((x) => x.id === side).said} showing ${k.label}.`);
        });
        fly.append(b);
      }
    };
    const addReasons = SIDES.map((s) => sideWhy(s.id));
    const addWhy = addReasons.every(Boolean) ? (addReasons.includes("Four is the most") ? "Four is the most" : NEEDS_TEXT.larger) : null;

    // Size this pane (DK-8): the click-only way to do what dragging a line
    // does, for a reader who can't drag. Each step is a tenth of the split.
    const sizes = SIZINGS.map((z) => ({ ...z, at: sizingFor(id, z) })).filter((z) => z.at);
    const buildSize = (fly) => {
      for (const z of sizes) {
        const b = menuItem(z.label);
        b.addEventListener("click", () => {
          closeKindMenu();
          sizePane(id, z);
        });
        fly.append(b);
      }
    };

    // The three are lines of the menu that open flyouts.
    const flyDefs = [
      { name: "Add pane", build: buildAdd, why: addWhy },
      ...(moves.length ? [{ name: "Move", build: buildMove }] : []),
      ...(sizes.length ? [{ name: "Size", build: buildSize }] : []),
    ];
    const triggers = new Map();
    const line = el("div", "desk-pane__menu-line");
    line.setAttribute("role", "separator");
    menuEl.append(line);
    for (const def of flyDefs) {
      const b = menuItem(def.name, def.why);
      b.classList.add("desk-pane__menu-item--fly");
      b.setAttribute("aria-haspopup", "menu");
      b.setAttribute("aria-expanded", "false");
      const more = el("span", "desk-title__more");
      more.innerHTML = `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor"
        stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
        <path d="M9 6l6 6-6 6" /></svg>`;
      b.append(more);
      b.addEventListener("click", () => {
        if (b.getAttribute("aria-disabled") !== "true") openFly(def, b);
      });
      triggers.set(b, def);
      menuEl.append(b);
    }
    menuEl.addEventListener("mouseover", (e) => {
      const b = e.target instanceof Element ? e.target.closest("button") : null;
      if (!b) return;
      const def = triggers.get(b);
      if (def && b.getAttribute("aria-disabled") !== "true") openFly(def, b, { focus: false });
      else closeFlyLater();
    });
    menuEl.addEventListener("mouseleave", closeFlyLater);
    const items = Array.from(menuEl.querySelectorAll("button"));
    menuEl.addEventListener("keydown", (e) => {
      const live = items.filter((b) => b.getAttribute("aria-disabled") !== "true");
      const i = live.indexOf(document.activeElement);
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        const n = live.length;
        live[(i + (e.key === "ArrowDown" ? 1 : n - 1)) % n].focus();
      } else if (e.key === "Home" || e.key === "End") {
        e.preventDefault();
        live[e.key === "Home" ? 0 : live.length - 1].focus();
      } else if (e.key === "ArrowRight" && triggers.has(document.activeElement)) {
        e.preventDefault();
        if (document.activeElement.getAttribute("aria-disabled") !== "true") openFly(triggers.get(document.activeElement), document.activeElement);
      } else if (e.key === "Escape") {
        e.stopPropagation();
        closeKindMenu();
      } else if (e.key === "Tab") {
        closeKindMenu({ focus: false });
      }
    });
    head.append(menuEl);
    placeKindMenu(menuEl, button);
    button.setAttribute("aria-expanded", "true");
    kindMenu = { menuEl, button, head, fly: null };
    (items.find((it) => it.getAttribute("aria-checked") === "true") ?? items[0]).focus({ preventScroll: true });
  }

  // "Make this pane wider" and its kin: which way a step goes along which kind of split.
  const SIZINGS = [
    { label: "Make this pane wider", split: "columns", grow: true, word: "wide" },
    { label: "Make this pane narrower", split: "columns", grow: false, word: "wide" },
    { label: "Make this pane taller", split: "rows", grow: true, word: "tall" },
    { label: "Make this pane shorter", split: "rows", grow: false, word: "tall" },
  ];

  /** The nearest split round a pane that runs the way a sizing needs: its path and the pane's place in it. */
  function sizingFor(id, z) {
    const at = pathTo(layout.root, id);
    if (!at) return null;
    for (let d = at.length - 1; d >= 0; d--) {
      const path = at.slice(0, d);
      const node = nodeAt(layout.root, path);
      if (node?.split === z.split) return { path, index: at[d], count: node.children.length };
    }
    return null;
  }

  function sizePane(id, z) {
    const at = sizingFor(id, z);
    const box = at && panesBox.querySelector(`.desk-split[data-path="${at.path.join(".")}"]`);
    if (!at || !box) return;
    const r = box.getBoundingClientRect();
    const length = z.split === "columns" ? r.width : r.height;
    const step = length * 0.1;
    // The line beside the pane that gives way: after it, or before the last pane.
    const line = at.index < at.count - 1 ? at.index : at.index - 1;
    const forward = (at.index < at.count - 1) === z.grow;
    layout = resize(asDrawn(at.path), at.path, line, forward ? step : -step, length);
    fit();
    sizeSplit(at.path);
    save();
    const share = Math.round((nodeAt(drawn, at.path)?.sizes[at.index] ?? 0) * 100);
    announce(`${kindLabel(findPane(layout.root, id)?.kind)} is now ${share} percent of the ${z.word === "wide" ? "width" : "height"} here.`);
  }

  /**
   * The menu is placed on the screen, not in its pane (BA122): the panes box
   * scrolls, so a menu hanging below a bottom-row pane's header was cut off
   * at its foot. It opens below the button where it fits in the window,
   * above where only that fits, and otherwise on the roomier side,
   * scrolling. Anything that scrolls or resizes under it closes it.
   */
  function placeKindMenu(menuEl, button) {
    const r = button.getBoundingClientRect();
    const gap = 2;
    const edge = 8;
    const height = menuEl.offsetHeight;
    const below = window.innerHeight - r.bottom - gap - edge;
    const above = r.top - gap - edge;
    const down = height <= below || (height > above && below >= above);
    if (height > (down ? below : above)) menuEl.style.maxHeight = `${Math.max(down ? below : above, 0)}px`;
    menuEl.style.top = down ? `${r.bottom + gap}px` : `${Math.max(edge, r.top - gap - Math.min(height, above))}px`;
    const left = Math.min(r.left, window.innerWidth - menuEl.offsetWidth - edge);
    menuEl.style.left = `${Math.max(edge, left)}px`;
  }

  // A scroll anywhere but in the menu itself (the page, the panes box, a
  // pane), or a new window size, would leave it beside nothing.
  const kindMenuMoved = (e) => {
    if (kindMenu && !(e.type === "scroll" && (kindMenu.menuEl.contains(e.target) || kindMenu.fly?.el.contains(e.target)))) closeKindMenu({ focus: false });
  };
  window.addEventListener("scroll", kindMenuMoved, { capture: true, passive: true });
  window.addEventListener("resize", kindMenuMoved);

  document.addEventListener("pointerdown", (e) => {
    if (kindMenu && !kindMenu.menuEl.contains(e.target) && !kindMenu.fly?.el.contains(e.target) && e.target !== kindMenu.button && !kindMenu.button.contains(e.target)) {
      closeKindMenu({ focus: false });
    }
    if (!wrap.contains(e.target) && !inTour(e.target)) {
      closeTitleMenu({ focus: false });
      closeMenu({ focus: false });
      closePrintMenu({ focus: false });
    }
  });

  // ---- the lines between panes ----

  function lineBetween(node, path, index) {
    const line = el("div", "desk-split__handle");
    line.setAttribute("role", "separator");
    line.tabIndex = 0;
    // A line between columns stands upright.
    line.setAttribute("aria-orientation", node.split === "columns" ? "vertical" : "horizontal");
    line.setAttribute("aria-valuemin", "0");
    line.setAttribute("aria-valuemax", "100");
    line.setAttribute("aria-valuenow", String(Math.round(node.sizes[index] * 100)));
    const names = [node.children[index], node.children[index + 1]].map((c) => LIST.format(panes(c).map((p) => kindLabel(p.kind))));
    line.setAttribute("aria-label", node.split === "columns"
      ? `Resize: ${names[0]} on the left, ${names[1]} on the right`
      : `Resize: ${names[0]} above, ${names[1]} below`);
    const first = Math.round(node.sizes[index] * 100);
    line.setAttribute("aria-valuetext", `${names[0]} ${first} percent, ${names[1]} ${100 - first} percent`);
    line.style.flexBasis = `${HANDLE}px`;
    const columns = node.split === "columns";
    const lengthOf = () => {
      const r = line.parentElement.getBoundingClientRect();
      return columns ? r.width : r.height;
    };
    line.addEventListener("pointerdown", (e) => {
      if (e.button !== 0) return;
      e.preventDefault();
      line.setPointerCapture(e.pointerId);
      const base = asDrawn(path);
      const from = columns ? e.clientX : e.clientY;
      const length = lengthOf();
      document.documentElement.classList.add(columns ? "desk-ws--resizing-x" : "desk-ws--resizing-y");
      const move = (ev) => {
        layout = resize(base, path, index, (columns ? ev.clientX : ev.clientY) - from, length);
        fit();
        sizeSplit(path);
      };
      const up = () => {
        line.removeEventListener("pointermove", move);
        line.removeEventListener("pointerup", up);
        line.removeEventListener("pointercancel", up);
        document.documentElement.classList.remove("desk-ws--resizing-x", "desk-ws--resizing-y");
        save();
      };
      line.addEventListener("pointermove", move);
      line.addEventListener("pointerup", up);
      line.addEventListener("pointercancel", up);
    });
    line.addEventListener("keydown", (e) => {
      const back = columns ? "ArrowLeft" : "ArrowUp";
      const ahead = columns ? "ArrowRight" : "ArrowDown";
      if (e.key !== back && e.key !== ahead && e.key !== "Home" && e.key !== "End") return;
      e.preventDefault();
      const length = lengthOf();
      // Home and End push the line as far as it goes (DK-8); resize() keeps each pane's minimum.
      const step = e.key === "Home" || e.key === "End" ? length : length * (e.shiftKey ? 0.1 : 0.02);
      layout = resize(asDrawn(path), path, index, e.key === ahead || e.key === "End" ? step : -step, length);
      fit();
      sizeSplit(path);
      save();
    });
    line.addEventListener("dblclick", () => {
      layout = evenOut(layout, path);
      fit();
      sizeSplit(path);
      save();
    });
    return line;
  }

  /**
   * Sizes that give every pane its minimum in the space there is, for drawing
   * only: the layout keeps the reader's, so they come back when the window
   * widens again, and only those are saved (BA61).
   */
  function fit() {
    const { width, height } = panesBox.getBoundingClientRect();
    drawn = width && height ? fitSizes(layout.root, width, height) : layout.root;
  }

  /**
   * The layout with one split's sizes as drawn, for a line the reader moves:
   * the line starts from where it is on the page, and what the reader makes
   * of that split becomes theirs. The other splits keep the reader's sizes.
   */
  function asDrawn(path) {
    const shown = nodeAt(drawn, path);
    if (!shown || shown.pane) return layout;
    const next = structuredClone(layout);
    const node = nodeAt(next.root, path);
    if (!node || node.pane || node.sizes.length !== shown.sizes.length) return layout;
    node.sizes = shown.sizes.slice();
    return next;
  }

  /** Put every split's drawn sizes on the page without redrawing. */
  function sizeAll() {
    const walk = (node, path) => {
      if (node.pane) return;
      sizeSplit(path);
      node.children.forEach((c, i) => walk(c, [...path, i]));
    };
    walk(drawn, []);
  }

  /** Put a split's drawn sizes on the page without redrawing it. */
  function sizeSplit(path) {
    const node = nodeAt(drawn, path);
    const box = panesBox.querySelector(`.desk-split[data-path="${path.join(".")}"]`);
    if (!node || node.pane || !box) return;
    const parts = Array.from(box.children).filter((c) => !c.classList.contains("desk-split__handle"));
    parts.forEach((part, i) => { part.style.flex = `${node.sizes[i]} 1 0px`; });
    Array.from(box.children)
      .filter((c) => c.classList.contains("desk-split__handle"))
      .forEach((line, i) => {
        const first = Math.round(node.sizes[i] * 100);
        line.setAttribute("aria-valuenow", String(first));
        const names = [node.children[i], node.children[i + 1]].map((c) => LIST.format(panes(c).map((p) => kindLabel(p.kind))));
        line.setAttribute("aria-valuetext", `${names[0]} ${first} percent, ${names[1]} ${100 - first} percent`);
      });
  }

  // ---- dragging a pane to split another ----

  // What the drop box says each zone does (E25). `kind` is the target pane's.
  const DROP_TEXT = {
    swap: (kind) => `Swap with ${kind}`,
    left: (kind) => `Left of ${kind}`,
    right: (kind) => `Right of ${kind}`,
    top: (kind) => `Above ${kind}`,
    bottom: (kind) => `Below ${kind}`,
  };

  function startMove(e, movingId) {
    if (e.button !== 0 || e.target.closest("button, .desk-pane__menu")) return;
    if (panes(layout.root).length < 2) return;
    const head = e.currentTarget;
    const x0 = e.clientX;
    const y0 = e.clientY;
    let moving = false;
    let pick = null; // { zone, targetId }: the drop shown now, if it would work
    let seen = null; // { zone, targetId }: the zone the pointer is in, for dropZone to hold
    head.setPointerCapture(e.pointerId);
    // What dropping on a zone of a pane would make, from the layout as it is
    // now: a swap always fits (each slot keeps its size), a split may not.
    const plan = (zone, targetId) => {
      const swap = zone === "swap";
      const next = swap ? swapPanes(layout, movingId, targetId) : splitPane(layout, targetId, zone, movingId);
      const box = panesBox.getBoundingClientRect();
      const why = next === layout ? "larger" : swap ? null : needs(next.root, box.width, box.height);
      return { swap, next, why };
    };
    const stop = () => {
      head.removeEventListener("pointermove", move);
      head.removeEventListener("pointerup", up);
      head.removeEventListener("pointercancel", cancel);
      document.removeEventListener("keydown", key, true);
      drop.hidden = true;
      document.documentElement.classList.remove("desk-ws--moving");
      paneEls.get(movingId)?.el.classList.remove("desk-pane--moving");
    };
    const move = (ev) => {
      if (!moving) {
        if (Math.hypot(ev.clientX - x0, ev.clientY - y0) < 5) return;
        moving = true;
        document.documentElement.classList.add("desk-ws--moving");
        paneEls.get(movingId)?.el.classList.add("desk-pane--moving");
      }
      const target = document.elementsFromPoint(ev.clientX, ev.clientY)
        .map((n) => n.closest?.(".desk-pane"))
        .find((n) => n && panesBox.contains(n));
      if (!target || target.dataset.paneId === movingId) {
        drop.hidden = true;
        pick = null;
        seen = null;
        return;
      }
      const rect = target.getBoundingClientRect();
      const targetId = target.dataset.paneId;
      const held = seen?.targetId === targetId ? seen.zone : null;
      const zone = dropZone(rect.width, rect.height, ev.clientX - rect.left, ev.clientY - rect.top, held);
      seen = { zone, targetId };
      const { swap, why } = plan(zone, targetId);
      const box = panesBox.getBoundingClientRect();
      pick = why ? null : { zone, targetId };
      // A swap shows the whole target, the pane the dragged one will take
      // the place of; a split shows the half it will take.
      const half = {
        swap: [rect.left, rect.top, rect.width, rect.height],
        left: [rect.left, rect.top, rect.width / 2, rect.height],
        right: [rect.left + rect.width / 2, rect.top, rect.width / 2, rect.height],
        top: [rect.left, rect.top, rect.width, rect.height / 2],
        bottom: [rect.left, rect.top + rect.height / 2, rect.width, rect.height / 2],
      }[zone];
      Object.assign(drop.style, {
        left: `${half[0] - box.left}px`,
        top: `${half[1] - box.top}px`,
        width: `${half[2]}px`,
        height: `${half[3]}px`,
      });
      drop.classList.toggle("desk-ws__drop--refused", Boolean(why));
      drop.classList.toggle("desk-ws__drop--swap", swap);
      const name = kindLabel(findPane(layout.root, targetId)?.kind);
      // The words sit on a chip of their own, or the pane's text under the
      // box's faint tint would run through them.
      drop.replaceChildren(el("span", "desk-ws__drop-label", why
        ? (NEEDS_TEXT[why] ? `No room here (${NEEDS_TEXT[why].toLowerCase()})` : "No room here")
        : DROP_TEXT[zone](name)));
      drop.hidden = false;
    };
    const up = () => {
      stop();
      if (!moving || !pick) return;
      // Planned again from the layout as it is now, not as it was at the last
      // pointer move: a pane's place (a scroll, say) may have been saved
      // since, and committing the old tree would undo it.
      const { swap, next, why } = plan(pick.zone, pick.targetId);
      if (why) return;
      const name = kindLabel(findPane(layout.root, movingId)?.kind);
      const other = swap && kindLabel(findPane(layout.root, pick.targetId)?.kind);
      commit(next);
      announce(swap ? `${name} swapped with ${other}.` : `${name} moved.`);
    };
    const cancel = () => stop();
    const key = (ev) => {
      if (ev.key !== "Escape") return;
      ev.preventDefault();
      ev.stopPropagation();
      stop();
    };
    head.addEventListener("pointermove", move);
    head.addEventListener("pointerup", up);
    head.addEventListener("pointercancel", cancel);
    document.addEventListener("keydown", key, true);
  }

  // ---- the page's height ----

  // The panes run from where they start to a gutter above the bottom of the
  // window. The source-text notice follows them, so the page scrolls: as the
  // header scrolls away the panes grow, their foot staying put, until they
  // fill the window less a gutter above and below, the same as the page's
  // side gutter (BVJ, 2026-10-22); scrolling on, they move up with the page
  // to show the notice (BVJ, 2026-10-21). Each pane keeps its own scrolling,
  // so the page scrolls from the header, the gutters, the keyboard or the
  // scrollbar. desk.css turns scroll anchoring off, or the browser would
  // answer the growth with scrolling of its own.
  const gutter = () => parseFloat(getComputedStyle(root.closest(".desk-page") ?? root).paddingLeft) || 16;
  function fitHeight() {
    const gap = gutter();
    const top = Math.max(gap, panesBox.getBoundingClientRect().top);
    const height = `${Math.max(MIN_HEIGHT, window.innerHeight - top - gap)}px`;
    if (panesBox.style.height !== height) panesBox.style.height = height;
  }
  let fitting = false;
  window.addEventListener("scroll", () => {
    if (fitting) return;
    fitting = true;
    requestAnimationFrame(() => {
      fitting = false;
      fitHeight();
    });
  }, { passive: true });
  window.addEventListener("resize", () => {
    fitHeight();
    fit();
    sizeAll();
    if (!menu.hidden) refreshMenu();
  });

  // ---- a place named in the address (E8) ----

  // Kept as the move it is, then taken off the address so a reload doesn't
  // pull the desk back to it.
  if (new URLSearchParams(location.search).has("place")) {
    try {
      const url = new URL(location.href);
      url.searchParams.delete("place");
      history.replaceState(history.state, "", url);
    } catch (_) {}
    if (arrivalPlace) save();
  }

  // ---- a sheet named in the address (M5: "Open it on the Study Desk") ----

  // /desk/?sheet=<id> shows that sheet in a Sheet pane: the first one open,
  // else a new one beside the active pane. A sheet that isn't in this
  // notebook is ignored without a word. The parameter is stripped either way,
  // so a reload doesn't pull the pane back.
  const wanted = new URLSearchParams(location.search).get("sheet");
  if (wanted !== null) {
    try {
      const url = new URL(location.href);
      url.searchParams.delete("sheet");
      history.replaceState(history.state, "", url);
    } catch (_) {}
    let record = null;
    try { record = wanted && store ? await store.get(wanted) : null; } catch (_) {}
    if (record?.kind === "sheet") {
      // Beside the active pane where the window has room for another
      // column, else in a pane that isn't a LIT pane (BA60).
      layout = showSheet(layout, record.id, panesBox.getBoundingClientRect().width);
      save();
    }
  }

  // `/` (keyboard-shortcuts.js): the first Search pane's field, or the one
  // holding focus, else a new Search pane beside the active pane; with no room
  // it says so and does nothing else (3m, BVJ 2026-11-01). The shared reader
  // code only sends the event; nothing of the desk is imported there.
  document.addEventListener("lit:desk-search", (e) => {
    const open = panes(layout.root).filter((p) => p.kind === "search" && paneEls.get(p.id)?.inst?.focusField);
    const holding = open.find((p) => paneEls.get(p.id).el.contains(document.activeElement));
    const use = holding ?? open[0];
    e.preventDefault();
    if (use) {
      paneEls.get(use.id).inst.focusField();
      return;
    }
    const room = panesBox.getBoundingClientRect();
    const before = new Set(panes(layout.root).map((p) => p.id));
    const next = openKind(layout, "search", room.width, room.height);
    if (next === layout) {
      announce("Close a pane to open search.");
      return;
    }
    commit(next);
    const made = panes(layout.root).find((p) => !before.has(p.id));
    paneEls.get(made?.id)?.inst?.focusField();
  });

  fitHeight();
  draw();

  // ---- the Study Desk tour (E24) ----

  // Started from the title menu, `?desk-tour` on the address (the help page
  // links to it) or the offer. It acts through the page's own pieces and
  // freezes the layout's saving while it runs (desk-tour.js).
  tour = createDeskTour({
    canKeep: Boolean(store),
    getLayout: () => layout,
    setLayout: (next) => commit(next),
    freeze: (on) => { layoutFrozen = on; },
    paneEls,
    panesBox,
    titleButton,
    titleMenu,
    addFly,
    openTitleMenu,
    closeTitleMenu,
    showAddKinds,
    layoutMenu: menu,
    openLayoutMenu: openMenu,
    closeLayoutMenu: closeMenu,
    refreshLayoutMenu: refreshMenu,
    shapeButtons,
    onLineChange: refreshTourLine,
  });
  const wantsTour = new URLSearchParams(location.search).has("desk-tour");
  if (wantsTour) {
    try {
      const url = new URL(location.href);
      url.searchParams.delete("desk-tour");
      history.replaceState(history.state, "", url);
    } catch (_) {}
    // Once the panes have settled, as the notebook tour waits for its panel.
    setTimeout(() => tour.start(), 600);
  } else {
    // The first time /desk opens, an offer; a window the reader can put off.
    setTimeout(() => tour.maybeOffer(), 1200);
  }
}

start();
