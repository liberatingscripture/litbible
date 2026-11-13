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
//   Greek, Footnotes, and Book Intro follow it unless their "Stay here" is
//   pressed (Book Intro by its book, E53).
// - **Each LIT pane keeps where its reader is** (`at`, 3e), and the active
//   one's is the passage the following panes share, `layout.place`, so they
//   follow it. They lead back too: a following pane's picker, This verse's
//   Previous and Next, a footnote's verse, or scrolling the Greek move the
//   active LIT pane, which moves the rest. With no LIT pane open they share
//   the place among themselves (3d, BVJ's option A). "Stay here" gives a pane
//   its own passage, `pin.at`, which only it moves. The place starts at the
//   reader's Continue reading place, or Matthew 1.
// - **A bookmark that moves as the reader reads follows the leading LIT pane**
//   (E28; BVJ, 2026-11-06), by a chapter page's rules (bookmark-follow.js):
//   every commit that moves the leading pane's place reports it (`hear`), and
//   one that makes another pane the leading one reports it as a new lead
//   (`lead`), which pauses the follow. Other LIT panes never move it, the
//   page's opening place isn't reported, and the tour reports nothing. That
//   reporting is desk-lead.js, and dragging a pane by its header is
//   pane-move.js (Audit 8, LG8-8); `start()` hands each the layout.
//
// The layout is kept in localStorage['lit-desk-layout'] (named in /privacy's
// paragraph), written on every change: the last layout, the reader's own
// default, and which of the two opens the page. The default is an
// arrangement, not a passage (BA53): it opens where the reader last was.

import { recordReference } from "../../lib/desk-store-core.mjs";
import {
  ARRANGEMENTS,
  NEEDS_TEXT,
  HANDLE,
  LAYOUT_KEY,
  MIN_HEIGHT,
  applyArrangement,
  arrangementOf,
  closePane,
  evenOut,
  findPane,
  fitSizes,
  isFollower,
  kindLabel,
  leavesReading,
  marksTurned,
  needs,
  nodeAt,
  makeWayFor,
  originalLayout,
  paneHides,
  paneScope,
  setPaneScope,
  panes,
  readSaved,
  readingArrival,
  regionNames,
  resize,
  setActive,
  setPin,
  setPlace,
  showIntroIn,
  placeFor,
  litPlace,
  setLitAt,
  setPaneMark,
  setPaneSheet,
  showSheet,
  sizingFor,
  writeSaved,
} from "../../lib/desk-layout.mjs";
import { markNames } from "../../lib/desk-lit-marks.mjs";
import { noWayLinkLabel, noWayMessage, replacedMessage } from "../../lib/desk-search-pane.mjs";
import { bookKeyToLabel } from "../../data/books.js";
import { chapterPath, formatPassage, introPath, parseIntroParam, parsePassage, parsePlaceParam, passageLabel, sameChapter, startingPassage } from "../../lib/desk-passage.mjs";
import { createPrintMenu } from "./print-menu.js";
import { loadLastRead } from "../last-read.js";
import { initActions } from "./actions.js";
import { createHighlights } from "./highlights.js";
import { createVerseLabels } from "./verse-labels.js";
import { addDeskStyle, deskCtx as ctx } from "./boot.js";
import { createDeskTour } from "./desk-tour.js";
import { createDeskSheetTour } from "./sheets/sheet-tour-desk.js";
import { mountPane } from "./desk-panes.js";
import { createHistory } from "./history.js";
import { initNoteSettings } from "./note-settings.js";
import { undoOldReading } from "./lit-marks.js";
import { openBookmarkForm } from "./bookmark-form.js";
import { openNoteEditor } from "./note-editor.js";
import { initPins } from "./pins.js";
import { openStore } from "./store.js";
import { initUndo, showNotice, showUndo } from "./undo-bar.js";
import { el } from "./dom.js";
import { createKindMenu } from "./kind-menu.js";
import { createTitleMenu } from "./title-menu.js";
import { createCommandRow } from "./command-row.js";
import { setTip } from "../tip.js";
import { createLeadReporter } from "./desk-lead.js";
import { startPaneMove } from "./pane-move.js";

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
// follows the LIT pane, and the pressed tint the footnote Pin takes (E67),
// since an open and a closed lock differ by a few pixels at 14px. (The
// thumbtack is the footnote Pin's alone, pins.js.)
const ICON_LOCK = `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor"
  stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
  <rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></svg>`;

const ICON_UNLOCK = `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor"
  stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
  <rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 7.5-2" /></svg>`;

// "Greek, The LIT, and My Notes": the Oxford comma, as the site writes lists.
const LIST = new Intl.ListFormat("en-US", { type: "conjunction" });

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
  // A Reading left on from before each pane kept its own marks (E108).
  undoOldReading();
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
  // One rule for a pane the desk opens by itself (E127; BVJ, 2026-11-12;
  // `makeWayFor` in desk-layout.mjs): a pane of the kind open is used, else a
  // new one opens where there is room, else it takes the place of the last
  // pane that isn't a LIT pane, the pane that asked and a pane set to "Stay
  // here" excepted. The undo bar says what it replaced, with Undo for the whole
  // layout; with no pane to give its place, nothing changes and a notice says
  // why, with a link to the page.
  const noWay = (kind, reason, { search = false, what = "", href = null } = {}) =>
    showNotice(noWayMessage(kind, reason, { search }), href ? { link: { label: noWayLinkLabel(kind, what), href } } : {});
  const sayReplaced = (text, before) => showUndo(text, () => commit(before, { quiet: true }));
  const passageHref = (p) => {
    const path = chapterPath(p.bookKey, p.chapter);
    return path ? `${path}${p.verse ? `#v${p.verse}` : ""}` : null;
  };
  // A passage shown in the LIT pane being read (or, with none, in the panes
  // that follow), as a picker would move it.
  // `beside` is a pane (the Search pane) that a result came from: with no LIT
  // pane open, one opens to its left where there is room, else takes the place
  // of another pane (E127), so a verse found still lands. Returns what
  // happened, for the Search pane to tell the reader (E34): "moved" (the
  // leading LIT pane), "opened" (a new LIT pane), "replaced" (one took
  // another pane's place; the undo bar says so), "placed" (none could open:
  // only the following panes moved; a notice says why) or null for a
  // passage that isn't one. `quiet` leaves the bar and the notice to the
  // caller, which then reads `lastWay`; `keep` is one more pane that mustn't
  // give its place (a Greek result's Greek pane).
  let lastWay = null;
  const showPassage = (passage, { beside = null, keep = null, quiet = false } = {}) => {
    const at = formatPassage(passage);
    lastWay = null;
    if (!at) return null;
    if (findPane(layout.root, layout.active)?.kind === "lit") {
      commit(setLitAt(layout, layout.active, at), { draw: false });
      return "moved";
    }
    const placed = setPlace(layout, at);
    if (beside) {
      const room = panesBox.getBoundingClientRect();
      const way = makeWayFor(placed, "lit", { keep: [beside, keep], beside, edge: "left", width: room.width, height: room.height });
      lastWay = way;
      if (way.outcome !== "none") {
        const next = setLitAt(setActive(way.layout, way.paneId), way.paneId, at);
        const before = layout;
        if (way.outcome === "opened") {
          commit(next);
          return "opened";
        }
        commit(next, { quiet: true });
        if (!quiet) sayReplaced(replacedMessage("lit", way.replaced.kind, { at: passageLabel(passage) }), before);
        return "replaced";
      }
      commit(placed, { draw: false });
      if (!quiet) noWay("lit", way.reason, { search: true, what: passageLabel(passage), href: passageHref(passage) });
      return "placed";
    }
    commit(placed, { draw: false });
    return "placed";
  };
  // A new sheet shown in a Sheets pane, as "Open it in the Study Desk" does
  // (M5): from the Search pane's "Make a sheet of these verses". That pane
  // keeps its place (its results would be lost). Returns what showSheet says,
  // `{ outcome, replaced, reason, ... }` plus `changed` and `undoLayout`, with
  // the layout already committed; the caller (the Search pane) puts the words
  // in its own undo bar, so there is one.
  const showSheetPane = (sheetId, keep) => {
    const before = layout;
    const way = showSheet(layout, sheetId, panesBox.getBoundingClientRect().width, keep);
    if (way.layout !== layout) commit(way.layout, { quiet: way.outcome === "replaced" });
    // `undoLayout` puts the layout back as it was (quietly), for the one Undo
    // that takes back both the sheet and where it showed.
    return { ...way, changed: way.layout !== before, undoLayout: () => commit(before, { quiet: true }) };
  };
  // A Greek search result (3m): its word in an unpinned Greek pane, else a
  // Greek pane by the one rule above; the LIT pane moves to the verse either
  // way. One bar says both, with Undo for the whole of it.
  const openGreekHit = (hit, searchId) => {
    const passage = { bookKey: hit.book, chapter: hit.chapter, verse: hit.verse };
    const before = layout;
    let greek = panes(layout.root).find((p) => p.kind === "greek" && !p.pin);
    let replaced = null;
    let none = null;
    if (!greek) {
      const room = panesBox.getBoundingClientRect();
      const way = makeWayFor(layout, "greek", { keep: searchId, beside: searchId, width: room.width, height: room.height });
      if (way.outcome === "none") none = way;
      else {
        commit(way.layout, { quiet: way.outcome === "replaced" });
        greek = findPane(layout.root, way.paneId);
        replaced = way.replaced;
      }
    }
    if (greek) paneEls.get(greek.id)?.inst?.goToWord?.(passage, hit.t);
    // The Greek pane keeps its place: the LIT pane mustn't take it.
    showPassage(passage, { beside: searchId, keep: greek?.id ?? null, quiet: true });
    const lit = lastWay?.outcome === "replaced" ? lastWay.replaced : null;
    const said = [];
    if (replaced) said.push(replacedMessage("greek", replaced.kind));
    if (lit) said.push(replacedMessage("lit", lit.kind, { at: passageLabel(passage) }));
    if (said.length) sayReplaced(said.join(" "), before);
    else if (none) {
      // greekHref's address (greek-search.mjs), written out: that module is
      // the Greek search's, which this page never imports statically.
      const base = chapterPath(passage.bookKey, passage.chapter);
      noWay("greek", none.reason, { search: true, href: base ? `${base}?greek=${passage.verse}.${hit.t}#v${passage.verse}` : null });
    }
  };
  // A book's introduction in a Book Intro pane (E53): from a Search pane's
  // intro result, which keeps its place. Returns showIntroIn's { outcome,
  // moved } for the Search pane to tell the reader; a replacement or a no-room
  // outcome is said here, in the undo bar or the notice (E127).
  const showIntro = (bookKey, { beside = null } = {}) => {
    const room = panesBox.getBoundingClientRect();
    const before = layout;
    const result = showIntroIn(layout, bookKey, room.width, room.height, beside);
    if (result.layout !== layout) commit(result.layout, { draw: result.outcome === "opened" || result.outcome === "replaced", quiet: result.outcome === "replaced" });
    if (result.outcome === "replaced") {
      const extra = result.moved ? `The LIT moved to ${passageLabel(parsePassage(result.moved))}.` : "";
      sayReplaced(replacedMessage("intro", result.replaced.kind, { extra }), before);
    } else if (result.outcome === "none" && result.reason) {
      noWay("intro", result.reason, { search: Boolean(beside), what: bookKeyToLabel(bookKey), href: introPath(bookKey) });
    }
    return { outcome: result.outcome, moved: result.moved };
  };
  const env = { store, storeError, onEdit, ctx, openGreekWord, drafts, showPassage, showSheet: showSheetPane, showIntro, openGreekHit };

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
  // ignored, and the parameter is stripped below either way. With
  // `&layout=reading` (E114, the links that stood for Read View) it opens in
  // Reading, as if the row were chosen (readingArrival), said once drawn.
  const arrivalParams = new URLSearchParams(location.search);
  const arrivalPlace = parsePlaceParam(arrivalParams.get("place"));
  const arrival = readingArrival(saved, arrivalPlace, reading, arrivalParams.get("layout"));
  let layout = arrival.layout;
  if (!parsePassage(layout.place)) layout = setPlace(layout, reading);

  // ---- what the leading LIT pane tells the page (desk-lead.js) ----

  // A bookmark that moves as the reader reads (E28) and Continue reading
  // follow the leading LIT pane; told after each commit.
  const leading = createLeadReporter({ store, ctx, drafts, getLayout: () => layout, frozen: () => layoutFrozen });
  const tellFollower = leading.tell;

  // ---- the title menu ----

  // The page's title is a menu (E15; BVJ, 2026-11-02). Since E68 it holds
  // what the command row doesn't (title-menu.js): Display options, Full
  // screen, the notebook page, the tour and feedback.
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

  // The command row under the header (E68): Add pane, Layout…, New sheet…,
  // Print… and Help, worded and in view (command-row.js, built below once
  // the panes box exists). The Layout and Print windows hang from it, each
  // under its own button, and Escape in one returns focus to that button.
  const cmdRow = el("div");
  let commands = null;
  const homeOf = (win) => (win === "print" ? commands?.printButton : commands?.layoutButton) ?? titleButton;

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
  cmdRow.append(menu);

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
      commit(next, { quiet: true });
      tellArrangement(a, before, next);
      closeMenu();
    });
    shapesBox.append(b);
    return b;
  });
  /**
   * Say what a change to arrangement `a` did, from `before` to `next`, already
   * committed: a Layout row, or a link arriving in Reading (E114). A smaller
   * layout closes panes from the end: say which, and offer to bring them back
   * (DK-9). Reading also clears the marks off its pane's text, and leaving it
   * puts back the ones it cleared. Both are in the layout itself
   * (readingLayout, desk-layout.mjs), so this only names them, and Undo is
   * `before`. The bar announces itself.
   */
  function tellArrangement(a, before, next) {
    const stays = new Set(panes(next.root).map((p) => p.id));
    const closed = panes(before.root).filter((p) => !stays.has(p.id)).map((p) => kindLabel(p.kind));
    const turned = marksTurned(before, next);
    const marks = markNames(a.id === "reading" ? turned.off : arrangementOf(before) === "reading" ? turned.on : []);
    const said = [`Layout: ${a.label}.`];
    if (closed.length) said.push(`Closed ${LIST.format(closed)}.`);
    if (marks.length) said.push(`${a.id === "reading" ? "Turned off" : "Turned on"} ${LIST.format(marks)}.`);
    if (said.length > 1) {
      showUndo(said.join(" "), () => commit(before, { quiet: true }));
    } else announce(said[0]);
  }
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
    // The panes go back; the reader's place stays (BA55). The original
    // layout's LIT pane shows every mark, which is said on the way out of
    // Reading, where they were off.
    const next = originalLayout(layout.place);
    const marks = arrangementOf(layout) === "reading" ? markNames(marksTurned(layout, next).on) : [];
    commit(next, { quiet: true });
    announce(`Back to the original layout: the LIT beside My Notes.${marks.length ? ` Turned on ${LIST.format(marks)}.` : ""}`);
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
    closePrintMenu({ focus: false });
    refreshMenu();
    menu.hidden = false;
    commands?.hang(menu, commands.layoutButton);
    (shapesBox.querySelector('[aria-pressed="true"]') ?? shapeButtons[0]).focus();
  }

  function closeMenu({ focus = true } = {}) {
    if (menu.hidden) return;
    menu.hidden = true;
    if (focus) homeOf("layout").focus();
  }

  menu.addEventListener("keydown", (e) => {
    if (e.key === "Escape") { e.stopPropagation(); closeMenu(); }
  });
  // Tabbing out of the window closes it, as a click elsewhere does (BA63).
  // Focus going nowhere (another window, a click on nothing focusable) leaves
  // it to the click.
  menu.addEventListener("focusout", (e) => {
    const to = e.relatedTarget;
    if (to instanceof Node && !menu.contains(to) && !cmdRow.contains(to) && !inTour(to)) closeMenu({ focus: false });
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
  cmdRow.append(printMenu);

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
    commands?.hang(printMenu, commands.printButton);
    printContents.focusTarget().focus?.();
  }

  function closePrintMenu({ focus = true } = {}) {
    if (printMenu.hidden) return;
    printMenu.hidden = true;
    if (focus) homeOf("print").focus();
  }

  printMenu.addEventListener("keydown", (e) => {
    if (e.key === "Escape") { e.stopPropagation(); closePrintMenu(); }
  });
  // Escape from the title button, where focus can sit while a window is open
  // (Shift+Tab back to it, or a window with nothing to focus), closes the
  // window as it does from inside (DK-13). These windows are popups that close
  // when focus leaves them (BA63), not modal dialogs, so there is no trap to
  // wrap Tab (RC-7); the title button is the one control focus can go back to.
  cmdRow.addEventListener("keydown", (e) => {
    if (e.key !== "Escape" || e.defaultPrevented) return;
    if (!menu.hidden) { e.stopPropagation(); closeMenu(); }
    else if (!printMenu.hidden) { e.stopPropagation(); closePrintMenu(); }
  });
  printMenu.addEventListener("focusout", (e) => {
    const to = e.relatedTarget;
    if (to instanceof Node && !printMenu.contains(to) && !cmdRow.contains(to) && !inTour(to)) closePrintMenu({ focus: false });
  });

  // ---- the title menu ----

  // Built below, once the panes box and `announce` exist (title-menu.js).
  let tour = null; // the Study Desk tour, made once the panes exist (below)
  let sheetTour = null; // the Sheets tour (E63), made with it
  let sheetOfferTimer = 0;

  // ---- the panes ----

  const panesBox = el("div", "desk-ws__panes");
  const drop = el("div", "desk-ws__drop");
  drop.hidden = true;
  // Beside the pointer while a dragged pane is over nothing it could land on
  // (a line, the gutter, itself), so a missed drop isn't silent (E25, 9).
  const miss = el("div", "desk-ws__miss");
  miss.hidden = true;
  const status = el("p", "sr-only");
  status.setAttribute("role", "status");
  const announce = (text) => { status.textContent = ""; requestAnimationFrame(() => { status.textContent = text; }); };
  if (bar.isConnected) root.append(cmdRow, panesBox, status);
  else root.append(bar, cmdRow, panesBox, status);

  const paneEls = new Map(); // id → { el, body, kind, inst, ... }
  // The tree as drawn: the layout's, with sizes fitted to the room there is
  // (fit). The layout keeps the reader's own sizes, so a narrow window
  // squeezes the panes only while it is narrow (BA61).
  let drawn = layout.root;
  // The pane menu (kind-menu.js). It reads the layout through `getLayout`,
  // since `layout` is replaced on every change.
  const kindMenu = createKindMenu({ getLayout: () => layout, panesBox, paneEls, commit, announce, sizePane });
  // The title menu and its Add pane flyout (title-menu.js). It reads the
  // layout and the tour when it needs them, since both are replaced later,
  // and opens and closes the Layout and Print windows above through these.
  const titleMenu = createTitleMenu({
    wrap, titleButton, announce, getTour: () => tour, inTour,
    layoutWindow: { open: openMenu, close: closeMenu },
    printWindow: { open: openPrintMenu, close: closePrintMenu },
  });
  commands = createCommandRow({
    row: cmdRow, getLayout: () => layout, panesBox, commit, announce, inTour,
    layoutWindow: { open: openMenu, close: closeMenu },
    printWindow: { open: openPrintMenu, close: closePrintMenu },
  });

  function save() {
    if (layoutFrozen) return;
    // The key holds three things, and another tab may have changed the
    // default or the opening choice since this one loaded: this tab writes
    // only `last` over what is there now (DK-11).
    const { mine, start } = readSaved(readKey());
    saved = { ...saved, mine, start, last: layout };
    writeKey(writeSaved(saved));
  }

  /**
   * Leaving Reading by any way at all (Add pane, a drag, a pane's kind, a
   * link's sheet or introduction, as well as the Layout window) turns back on
   * the marks it turned off (DK3-2; BVJ, 2026-11-07). The layout does that
   * itself, whatever changed it (desk-layout.mjs, settleActive); this is the
   * names of the marks that came back, for the page to say, or null. The
   * Layout window says them in its own message (`quiet`), and nothing is said
   * while the tour is changing the layout.
   */
  function leaveReading(before, next = layout) {
    if (layoutFrozen || !leavesReading(before, next)) return null;
    const names = markNames(marksTurned(before, next).on);
    return names.length ? names : null;
  }

  /** Say that leaving Reading turned its marks back on, with Undo for both. */
  function tellMarks(names, before) {
    showUndo(`Left Reading: turned on ${LIST.format(names)}.`, () => commit(before, { quiet: true }));
  }

  /** Take a new layout: kept at once, and drawn (or only re-marked). `quiet`: the caller says what leaving Reading did. */
  function commit(next, { draw: redraw = true, quiet = false } = {}) {
    if (next === layout) return;
    const before = layout;
    layout = next;
    const marks = quiet ? null : leaveReading(before);
    save();
    if (redraw) {
      draw();
      offerSheetTour();
    } else mark();
    follow();
    tellFollower();
    if (marks) tellMarks(marks, before);
  }

  /**
   * The Sheets tour's offer (E63), asked for 1.6 seconds after a draw that
   * leaves a Sheets pane on the desk (past the Study Desk tour's 1.2 at load,
   * which comes first), and never while a tour has the layout frozen. The
   * tour checks the rest when the time comes.
   */
  function offerSheetTour() {
    if (!panes(layout.root).some((p) => p.kind === "sheet")) return;
    clearTimeout(sheetOfferTimer);
    sheetOfferTimer = setTimeout(() => {
      if (!layoutFrozen) sheetTour?.maybeOffer();
    }, 1600);
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
      lead.setAttribute("aria-label", "Leading pane: My Notes, This verse, Greek, Footnotes, and Book Intro follow it");
      setTip(lead, "Leading: My Notes, This verse, Greek, Footnotes, and Book Intro follow this pane");
      const pin = el("button", "desk-pane__pin");
      pin.type = "button";
      // A glyph, and "Stay here" beside it where the header is wide enough
      // (E72; desk.css's container query); mark() paints the lock and sets
      // its name. The word is the name already, so it is hidden from a screen
      // reader, which hears aria-label.
      const pinGlyph = el("span", "desk-pane__pin-glyph");
      pinGlyph.innerHTML = ICON_UNLOCK;
      const pinWord = el("span", "desk-pane__pin-word", "Stay here");
      pinWord.setAttribute("aria-hidden", "true");
      pin.append(pinGlyph, pinWord);
      // Where a My Notes pane is (E69): the passage it follows, or the one it
      // stays on, in muted type after its name. The other following kinds
      // name theirs in their own passage or book bar.
      const at = el("span", "desk-pane__at");
      at.hidden = true;
      const close = el("button", "desk-pane__close");
      close.type = "button";
      close.innerHTML = ICON_CLOSE;
      head.append(grip, h2, at, lead, pin, close);
      const body = el("div", "desk-pane__body");
      section.append(head, body);
      rec = { el: section, head, body, kindButton, lead, pin, close, place: at, kind: null, inst: null, at: null };
      paneEls.set(pane.id, rec);

      kindButton.addEventListener("click", () => kindMenu.open(pane.id, kindButton));
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
    // The header is the handle, and says so on hover once there is a pane to move
    // it beside (E25, 7).
    rec.head.title = panes(layout.root).length > 1 ? "Drag to move this pane" : "";
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
        // What a LIT pane's text shows is its own (E108), kept with it here.
        getHide: () => paneHides(layout, pane.id),
        // A My Notes pane's choice, This chapter or Everything (E119).
        getScope: () => paneScope(layout, pane.id),
        setScope: (scope) => commit(setPaneScope(layout, pane.id, scope), { draw: false }),
        setMark: (id, on) => commit(setPaneMark(layout, pane.id, id, on), { draw: false }),
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
    // Reading sets the LIT as a page of a book, justified and hyphenated
    // (desk.css; E106). The rewrap moves every line, so the stamp goes on
    // after each pane's place is noted and before it is put back.
    root.toggleAttribute("data-desk-reading", arrangementOf(layout) === "reading");
    fit();
    const focused = panesBox.contains(document.activeElement) ? document.activeElement : null;
    const tree = build(drawn, []);
    tree.style.flex = "1 1 0px";
    panesBox.replaceChildren(tree, drop, miss);
    for (const back of putBack) back?.();
    if (focused?.isConnected) focused.focus({ preventScroll: true });
    mark();
    follow();
  }

  /** The parts of each pane's header that change without redrawing. */
  function mark() {
    commands?.refresh();
    const all = panes(layout.root);
    const lits = all.filter((p) => p.kind === "lit").length;
    const regions = regionNames(layout);
    for (const pane of all) {
      const rec = paneEls.get(pane.id);
      if (!rec) continue;
      // What a LIT pane's text shows, from the layout (its "Show," Reading,
      // an undo): the pane does nothing when it already shows this.
      if (pane.kind === "lit") rec.inst?.setMarks?.(paneHides(layout, pane.id));
      const name = kindLabel(pane.kind);
      rec.kindButton.querySelector(".desk-pane__name").textContent = name;
      rec.kindButton.setAttribute("aria-label", `${name} pane: show something else here, or move it`);
      // The region is named by its kind, and its place where the kind repeats
      // (DK3-8); the instruction stays on the button (DK-7).
      rec.el.setAttribute("aria-label", regions.get(pane.id) ?? name);
      const leading = pane.kind === "lit" && lits > 1 && layout.active === pane.id;
      rec.lead.hidden = !leading;
      rec.el.classList.toggle("desk-pane--leading", leading);
      rec.pin.hidden = !isFollower(pane.kind);
      rec.pin.setAttribute("aria-pressed", String(Boolean(pane.pin)));
      // Pressed means it stays, so the lock is closed. The name is "Stay here"
      // either way (aria-pressed carries the state), and the tooltip says the
      // state too, never the press to come (E67: it read "Follow the LIT pane"
      // while pressed, which named one thing and showed another).
      rec.pin.setAttribute("aria-label", "Stay here");
      setTip(rec.pin, pane.pin ? "Stay here (on)" : "Stay here");
      const locked = Boolean(pane.pin);
      if (rec.pin.dataset.locked !== String(locked)) {
        rec.pin.dataset.locked = String(locked);
        rec.pin.firstElementChild.innerHTML = locked ? ICON_LOCK : ICON_UNLOCK;
      }
      // My Notes names the chapter it is on (E69); its rows already say
      // which verse each record is on, so the verse isn't repeated here.
      const where = pane.kind === "mine" ? passageLabel({ ...passageOf(pane.id), verse: null }) : "";
      if (rec.place.textContent !== where) rec.place.textContent = where;
      rec.place.hidden = !where;
      rec.close.hidden = all.length <= 1;
      rec.close.setAttribute("aria-label", `Close the ${name.replace(/^The /, "")} pane`);
      setTip(rec.close, `Close the ${name.replace(/^The /, "")} pane`);
    }
  }

  // ---- "show in this pane": kind-menu.js; the size step it asks for ----

  function sizePane(id, z) {
    const at = sizingFor(layout.root, id, z);
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

  document.addEventListener("pointerdown", (e) => {
    if (!inTour(e.target)) {
      if (!wrap.contains(e.target)) titleMenu.close({ focus: false });
      if (!cmdRow.contains(e.target)) {
        closeMenu({ focus: false });
        closePrintMenu({ focus: false });
      }
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

  // ---- dragging a pane to split another (pane-move.js) ----

  function startMove(e, movingId) {
    startPaneMove(e, movingId, { getLayout: () => layout, panesBox, paneEls, drop, miss, commit, announce });
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

  // Kept as the move it is (with `layout`, E114, as the change to Reading,
  // saved as the last layout and never as "My default"), then taken off the
  // address so a reload doesn't pull the desk back to it.
  if (arrivalParams.has("place") || arrivalParams.has("layout")) {
    try {
      const url = new URL(location.href);
      url.searchParams.delete("place");
      url.searchParams.delete("layout");
      history.replaceState(history.state, "", url);
    } catch (_) {}
    if (arrivalPlace) save();
  }

  // ---- a sheet named in the address (M5: "Open it in the Study Desk") ----

  // /desk/?sheet=<id> shows that sheet in a Sheets pane: the first one open,
  // else a new one beside the active pane. A sheet that isn't in this
  // notebook is ignored without a word. The parameter is stripped either way,
  // so a reload doesn't pull the pane back.
  const arrivedAs = layout; // before a sheet or an introduction in the address moves panes
  // What a sheet or an introduction in the address did (E127): the sentences
  // for a pane that took another's place, and the first that found no room.
  const arrivalSaid = [];
  let arrivalNoWay = null;
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
      // By the one rule (E127): beside the active pane where the window has
      // room for another column, else in place of the last pane that isn't a
      // LIT pane (BA60), else a notice, with the sheet's page.
      const way = showSheet(layout, record.id, panesBox.getBoundingClientRect().width);
      if (way.layout !== layout) {
        layout = way.layout;
        save();
      }
      if (way.outcome === "replaced") arrivalSaid.push(replacedMessage("sheet", way.replaced.kind));
      else if (way.outcome === "none" && way.reason) {
        arrivalNoWay ??= { kind: "sheet", reason: way.reason, what: "", href: `/sheets/?id=${encodeURIComponent(record.id)}` };
      }
    }
  }

  // ---- a book's introduction named in the address (E53) ----

  // /desk/?intro=romans (an introduction page's "Open in Study Desk", with
  // ?place= at its chapter 1) shows it in a Book Intro pane: one already open,
  // else a new one beside the active pane where the width holds it, as ?sheet=
  // does. Stripped either way.
  const introBook = parseIntroParam(new URLSearchParams(location.search).get("intro"));
  if (new URLSearchParams(location.search).has("intro")) {
    try {
      const url = new URL(location.href);
      url.searchParams.delete("intro");
      history.replaceState(history.state, "", url);
    } catch (_) {}
    if (introBook) {
      const result = showIntroIn(layout, introBook, panesBox.getBoundingClientRect().width);
      if (result.layout !== layout) {
        layout = result.layout;
        save();
      }
      // A replacement or no room: said once the panes are drawn, as the
      // Search pane says them (DK3-3; BVJ, 2026-11-07; E127).
      if (result.outcome === "replaced") {
        const extra = result.moved ? `The LIT moved to ${passageLabel(parsePassage(result.moved))}.` : "";
        arrivalSaid.push(replacedMessage("intro", result.replaced.kind, { extra }));
      } else if (result.outcome === "none" && result.reason) {
        arrivalNoWay ??= { kind: "intro", reason: result.reason, what: bookKeyToLabel(introBook), href: introPath(introBook) };
      }
    }
  }
  // A sheet or an introduction may have opened a pane beside Reading's one.
  const arrivalMarks = leaveReading(arrivedAs);

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
    // By the one rule (E127): room, else the place of the last pane that
    // isn't a LIT pane, else a notice with the search page.
    const room = panesBox.getBoundingClientRect();
    const before = layout;
    const way = makeWayFor(layout, "search", { width: room.width, height: room.height });
    if (way.outcome === "none") {
      noWay("search", way.reason, { href: "/search/" });
      return;
    }
    commit(way.layout, { quiet: way.outcome === "replaced" });
    if (way.outcome === "replaced") sayReplaced(replacedMessage("search", way.replaced.kind), before);
    paneEls.get(way.paneId)?.inst?.focusField();
  });

  // ← → and [ ] (keyboard-shortcuts.js): the previous or next chapter in the
  // pane being read, as its passage bar's arrows would move it. That is the
  // pane holding focus where it has a passage bar (a LIT pane there is the
  // leading one already, since working in it makes it lead), else the leading
  // LIT pane, else the first pane that follows (with no LIT pane, the
  // following panes share one passage). A step past Matthew 1 or Revelation 22
  // is taken and does nothing, as the bar's disabled arrow does.
  document.addEventListener("lit:desk-chapter", (e) => {
    const dir = e.detail?.step < 0 ? "-1" : "1";
    const stepOf = (id) => paneEls.get(id)?.el.querySelector(`.desk-passage__step[data-step="${dir}"]`) ?? null;
    const all = panes(layout.root);
    const holding = all.find((p) => paneEls.get(p.id)?.el.contains(document.activeElement));
    const leading = findPane(layout.root, layout.active)?.kind === "lit" ? layout.active : null;
    const id = [holding?.id, leading, ...all.filter((p) => isFollower(p.kind) && !p.pin).map((p) => p.id)]
      .find((candidate) => candidate && stepOf(candidate));
    const button = id ? stepOf(id) : null;
    if (!button) return;
    e.preventDefault();
    if (button.getAttribute("aria-disabled") === "true") return;
    // The arrow's title names where it goes ("John 4"); said, since nothing
    // else tells a screen reader the pane moved.
    const to = button.title;
    button.click();
    if (to) announce(to);
  });

  fitHeight();
  draw();
  if (arrivalMarks) tellMarks(arrivalMarks, arrivedAs);
  // A link that arrived in Reading says so as the row does, with Undo back to
  // what the page would have opened at that place (E114).
  else if (arrival.layout !== arrival.before && layout === arrivedAs) {
    tellArrangement(ARRANGEMENTS.find((a) => a.id === "reading"), arrival.before, layout);
  } else if (arrivalSaid.length || arrivalNoWay) {
    // What a sheet or an introduction in the address did, in one bar: Undo
    // puts the layout back as the page opened it. A notice too, if one found
    // no room, rides along with its link (E127).
    const way = arrivalNoWay;
    const text = [...arrivalSaid, ...(way ? [noWayMessage(way.kind, way.reason)] : [])].join(" ");
    const link = way?.href ? { label: noWayLinkLabel(way.kind, way.what), href: way.href } : null;
    if (arrivalSaid.length) showUndo(text, () => commit(arrivedAs, { quiet: true }), { link });
    else showNotice(text, { link });
  }

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
    titleMenu: titleMenu.el,
    commandRow: cmdRow,
    addMenu: commands.addMenu,
    openTitleMenu: titleMenu.open,
    closeTitleMenu: titleMenu.close,
    showAddKinds: commands.showAddKinds,
    closeAdd: commands.closeAdd,
    newSheet: commands.newSheet,
    layoutMenu: menu,
    openLayoutMenu: openMenu,
    closeLayoutMenu: closeMenu,
    refreshLayoutMenu: refreshMenu,
    shapeButtons,
    onLineChange: titleMenu.refreshTourLine,
  });

  // ---- the Sheets tour (E63) ----

  // Started from `?sheet-tour` on the address (the help page links to it),
  // "Take the Sheets tour" at the foot of a Sheets pane's list
  // (`desk:sheet-tour`), the Study Desk tour's Sheets card, or its offer. Like
  // the Study Desk tour it acts through the page's own pieces and freezes the
  // layout's saving while it runs (sheets/sheet-tour.js, through its desk
  // host, sheets/sheet-tour-desk.js).
  sheetTour = createDeskSheetTour({
    canKeep: Boolean(store),
    getLayout: () => layout,
    setLayout: (next) => commit(next),
    freeze: (on) => { layoutFrozen = on; },
    closeMenus: () => {
      titleMenu.close({ focus: false });
      commands.closeAdd();
      closeMenu({ focus: false });
      closePrintMenu({ focus: false });
    },
    paneEls,
    panesBox,
    // Where the tour's passage comes from: the first LIT pane's place, else the shared one.
    litPassage: () => {
      const lit = panes(layout.root).find((p) => p.kind === "lit");
      return lit ? passageOf(lit.id) : parsePassage(layout.place);
    },
    otherOffer: () => tour.offering(),
  });
  document.addEventListener("desk:sheet-tour", () => sheetTour.start());

  const params = new URLSearchParams(location.search);
  const wantsTour = params.has("desk-tour");
  const wantsSheetTour = params.has("sheet-tour");
  if (wantsTour || wantsSheetTour) {
    try {
      const url = new URL(location.href);
      url.searchParams.delete("desk-tour");
      url.searchParams.delete("sheet-tour");
      history.replaceState(history.state, "", url);
    } catch (_) {}
    // Once the panes have settled, as the notebook tour waits for its panel;
    // neither tour's offer then.
    setTimeout(() => (wantsTour ? tour : sheetTour).start(), 600);
  } else {
    // The first time /desk opens, an offer; a window the reader can put off.
    setTimeout(() => tour.maybeOffer(), 1200);
    // The Sheets tour's, when the desk opens with a Sheets pane.
    offerSheetTour();
  }
}

start();
