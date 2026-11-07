// src/scripts/greek-commands.js
//
// The search commands window: the one place that lists what the search box
// understands (E31). It has two sections. "Notebook and page commands" lists the
// Study Desk's own commands (desk-commands.mjs: the ones a ">" in the box
// lists), asked of the desk's search module, so it is empty of them where the
// desk is off. The Greek section is the Greek search commands (STUDY-DESK.md,
// "Order of work", 2a, and E5), and is left out where the Greek isn't searched
// (greekSearchEnabled), so the window works with the Greek off. Which comes
// first follows where it was opened from: the Greek's own places (the Greek
// group's foot, the Greek type, an error pointing at a command) put the Greek
// first, the plain "Search commands" links put the desk's.
//
// The Greek section: one small window builds a search from menus (greek-builder.js: a card for each
// word, each offering only what that word takes), lists every command a Greek
// search understands, and offers example searches; clicking a command puts it
// into the search field it was opened from, at the cursor. The commands, their
// words and the examples are greek-query.mjs's COMMANDS and EXAMPLES, so what
// the window teaches and what a query accepts are one list. The builder and the
// field are one search: the field is the record, and the builder reads it.
//
// It is a float-window.js window, so it stays open while the reader types or
// clicks elsewhere. It closes on its ×, on Escape inside it (focus goes back
// to the field), when the page is left and, when it was opened from the
// Notebook's Greek tab, when the Notebook is closed or minimized or the tab is
// switched away from Greek (BVJ, 2026-10-14). The Notebook says so with the
// `lit:notebook-state` event (desk/panel.js), so nothing here reads the
// panel's insides.
//
// Where it sits: beside the field if there is room to its right, else below it
// against the window's right edge; from the Greek tab, to the left of the
// Notebook, and from a Greek pane on /desk, which closes it with the pane or
// on moving to another chapter, beside the pane. A reader who drags it keeps it there for the visit
// (sessionStorage), and the first time the reader picks "Greek" as the search
// type on /search it opens by itself, once (localStorage, no focus taken).
//
// Nothing here is loaded for a reader without the Study Desk preview: the
// three search surfaces only call it when the Greek is being searched.

import { createFloatWindow } from "./float-window.js";
import { COMMANDS, EXAMPLES } from "../lib/greek-query.mjs";
import { editSpan, insertAtCursor } from "../lib/greek-commands-ui.mjs";
import { hasGreek } from "../lib/greek-search.mjs";
import { dockWidth } from "./desk-frame.js";
import { greekSearchEnabled, isGreekQuery, loadDeskSearch, setPickedMode } from "./search-core.js";
import { exampleList } from "./search-greek.js";
import { createGreekBuilder } from "./greek-builder.js";

const POS_KEY = "lit-greek-commands-pos";
const SEEN_KEY = "lit-greek-commands";
/** Sent by the Notebook panel whenever it is shown, minimized, closed, or changes tab. */
export const NOTEBOOK_EVENT = "lit:notebook-state";

const GAP = 16;
const EDGE = 8;
// The window's height: no taller than the stylesheet's cap, and no shorter
// than enough to show the builder and a few commands.
const MAX_HEIGHT = 620;
const MIN_HEIGHT = 280;

/** The open window: { win, field, source, typeSelect, status, builder, more, desk }, or null.
 *  `builder` and `more` are null with the Greek off; `desk` is the desk's section. */
let current = null;

/* ── What is kept ──────────────────────────────────────────────────── */

function readPos() {
  try {
    const v = JSON.parse(sessionStorage.getItem(POS_KEY) ?? "null");
    return v && Number.isFinite(v.left) && Number.isFinite(v.top) ? v : null;
  } catch (_) {
    return null;
  }
}

function savePos(at) {
  try { sessionStorage.setItem(POS_KEY, JSON.stringify({ left: Math.round(at.left), top: Math.round(at.top) })); } catch (_) {}
}

function hasBeenSeen() {
  try { return localStorage.getItem(SEEN_KEY) === "seen"; } catch (_) { return false; }
}

function markSeen() {
  try { localStorage.setItem(SEEN_KEY, "seen"); } catch (_) {}
}

/* ── Small builders ────────────────────────────────────────────────── */

function make(tag, className, text) {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (text !== undefined) e.textContent = text;
  return e;
}

/* ── Putting a command in the field ───────────────────────────────── */

function announce(text) {
  if (!current) return;
  current.status.textContent = "";
  // A moment later, so a screen reader hears it again for the same words.
  window.setTimeout(() => { if (current) current.status.textContent = text; }, 30);
}

/** One full stop at the end of a spoken phrase, never two. */
function sentence(s) {
  return /\.$/.test(s) ? s : `${s}.`;
}

/**
 * Make the field's text `value` as typing would (BA147): select what changed
 * and insert over it with execCommand, which keeps the field's undo (setting
 * `value` empties it) and fires `input` itself. Only in a field that has
 * focus, since that is where execCommand types; false where it can't, and
 * the caller sets the value as before.
 */
function typeInto(field, value) {
  if (document.activeElement !== field || typeof document.execCommand !== "function") return false;
  const { start, end, text } = editSpan(field.value, value);
  let typed = false;
  try {
    field.setSelectionRange(start, end);
    typed = document.execCommand("insertText", false, text);
  } catch (_) {
    typed = false;
  }
  return typed && field.value === value;
}

/**
 * Add `text` at the field's cursor; a mouse press keeps focus in the field.
 * `name` is what a screen reader hears it as (a command's meaning); without
 * one it hears the text itself, as the builder's query.
 */
function insert(text, { byMouse = false, name = null } = {}) {
  if (!current) return;
  const { field } = current;
  // Its field is gone (a /desk pane closed or redrawn): so is the window (BA114).
  if (!field.isConnected) {
    closeGreekCommands("field");
    return;
  }
  const start = field.selectionStart ?? field.value.length;
  const end = field.selectionEnd ?? start;
  const { value, caret } = insertAtCursor(field.value, start, end, text);
  if (byMouse) field.focus({ preventScroll: true });
  // Pressed by keyboard inside the window, the field hasn't focus, and moving
  // it there and back would be heard twice: the value is set as before.
  const typed = typeInto(field, value);
  if (!typed) field.value = value;
  try { field.setSelectionRange(caret, caret); } catch (_) {}
  if (!typed) field.dispatchEvent(new Event("input", { bubbles: true }));
  announce(`Added: ${sentence(name ?? text.trim())}`);
}

/**
 * Make the field's whole text `text` as the builder's choices do: typed when the
 * field has focus (Ctrl+Z still works), set otherwise. A search that is not
 * plainly Greek is put in the page's Greek type, where it has one, as an
 * example is: a builder search is one. False when the field is gone (the
 * window closes with it).
 */
function putSearch(text, { byMouse = false } = {}) {
  if (!current) return false;
  const { field, typeSelect } = current;
  if (!field.isConnected) {
    closeGreekCommands("field");
    return false;
  }
  if (text && typeSelect && typeSelect.value !== "greek" && !isGreekQuery(text)) {
    setPickedMode(typeSelect, "greek");
    typeSelect.dispatchEvent(new Event("change", { bubbles: true }));
  }
  if (byMouse) field.focus({ preventScroll: true });
  const typed = typeInto(field, text);
  if (!typed) field.value = text;
  try { field.setSelectionRange(text.length, text.length); } catch (_) {}
  if (!typed) field.dispatchEvent(new Event("input", { bubbles: true }));
  return true;
}

/** Put an example in the field and run it (in the Greek type, where the page has one). */
function runExample(query) {
  if (!current) return;
  const { field, typeSelect } = current;
  if (typeSelect && typeSelect.value !== "greek") {
    setPickedMode(typeSelect, "greek");
    typeSelect.dispatchEvent(new Event("change", { bubbles: true }));
  }
  field.focus({ preventScroll: true });
  const typed = typeInto(field, query);
  if (!typed) field.value = query;
  try { field.setSelectionRange(query.length, query.length); } catch (_) {}
  if (!typed) field.dispatchEvent(new Event("input", { bubbles: true }));
}

/* ── The window's contents ────────────────────────────────────────── */

function buildCommand(item) {
  const code = make("span", "greek-cmd__code");
  code.append(item.code);
  if (item.greek) code.lang = "grc";
  if (item.word) code.append(make("span", "greek-cmd__word", `“${item.word}”`));
  const means = make("span", "greek-cmd__means", item.means);
  if (item.note) means.append(make("span", "greek-cmd__note", item.note));

  // An item with nothing to insert is shown, not a button.
  if (!item.insert) {
    const row = make("div", "greek-cmd");
    row.append(code, means);
    return row;
  }
  const b = make("button", "greek-cmd");
  b.type = "button";
  b.dataset.insert = item.insert;
  if (item.filter) b.dataset.filter = item.filter;
  b.dataset.name = item.means;
  b.append(code, means);
  b.addEventListener("mousedown", (e) => e.preventDefault());
  b.addEventListener("click", (e) => insert(item.insert, { byMouse: e.detail > 0, name: item.means }));
  return b;
}

/** The Greek's section: the builder, then the list and examples under it. */
function fillGreek(section, builder) {
  section.append(make("h3", "greek-cmds__heading", "Build a search"), builder.el);
  // The list the builder is made from, for typing the notation by hand: kept
  // under one heading so the window opens short.
  const more = make("details", "greek-cmds__more");
  more.append(make("summary", "greek-cmds__summary", "Examples and all commands"));
  more.append(make("p", "greek-cmds__lead", "Select a command to add it where your cursor is. Each has a word you can type instead. This stays open while you type."));
  more.append(make("h3", "greek-cmds__heading", "Try one"), exampleList(EXAMPLES, runExample));
  for (const group of COMMANDS) {
    more.append(make("h3", "greek-cmds__heading", group.title));
    const ul = make("ul", "greek-cmds__list");
    for (const item of group.items) {
      const li = make("li");
      li.append(buildCommand(item));
      ul.append(li);
    }
    more.append(ul);
  }
  section.append(more);
  return more;
}

/* ── The Study Desk's commands (desk-commands.mjs) ─────────────────── */

/** The desk section's empty shell; drawDesk fills it once the desk's search module has loaded. */
function makeDesk() {
  const el = make("section", "greek-cmds__section");
  // Hidden until there is something to list: with the desk off, never shown.
  el.hidden = true;
  el.append(
    make("h3", "greek-cmds__section-title", "Notebook and page commands"),
    make("p", "greek-cmds__lead", "Type “>” in the search box to list these, or the start of a few of their words, such as “hide marks.” Select one here to run it."),
  );
  const list = make("ul", "greek-cmds__list");
  const more = make("p", "greek-cmds__lead");
  more.hidden = true;
  el.append(list, more);
  return { el, list, more };
}

function deskRow(command, desk) {
  const row = make(command.href ? "a" : "button", "search-cmd");
  if (command.href) {
    row.href = command.href;
  } else {
    row.type = "button";
    row.addEventListener("click", () => {
      desk.runCommand(command.id);
      // As the box does, it is done with once chosen.
      closeGreekCommands("command");
    });
  }
  row.append(make("span", "search-cmd__name", command.name));
  if (command.hint) row.append(make("span", "search-cmd__hint", command.hint));
  const li = make("li");
  li.append(row);
  return li;
}

/** Fill the desk section with the commands offered on this page. */
function drawDesk(box, desk) {
  const { here, more } = desk.commandList();
  box.list.replaceChildren(...here.map((c) => deskRow(c, desk)));
  box.more.textContent = more ? "More appear when you are reading a chapter." : "";
  box.more.hidden = !more;
  box.el.hidden = !here.length;
}

function refreshDesk(loadDesk) {
  const box = current?.desk;
  const loading = loadDesk?.();
  if (!box || !loading) return;
  loading
    .then((desk) => {
      if (desk && current?.desk === box) drawDesk(box, desk);
    })
    .catch((err) => console.error("Search commands: the Study Desk's commands couldn't load", err));
}

/** Scroll the button for a filter (by its word or its name) into view and mark it. */
function showTarget(filter, { focus = true } = {}) {
  if (!current || !filter) return;
  const root = current.win.el;
  const btn = Array.from(root.querySelectorAll("button.greek-cmd")).find(
    (b) => b.dataset.filter === filter || b.dataset.name === filter,
  );
  if (!btn) return;
  if (current.more) current.more.open = true;
  root.querySelector(".greek-cmd.is-target")?.classList.remove("is-target");
  btn.classList.add("is-target");
  btn.scrollIntoView({ block: "center" });
  if (focus) btn.focus({ preventScroll: true });
}

/* ── Where it sits ─────────────────────────────────────────────────── */

function place(el) {
  if (!current) return;
  const saved = readPos();
  if (saved) {
    el.style.left = `${saved.left}px`;
    el.style.top = `${saved.top}px`;
    return;
  }
  const w = el.offsetWidth || 340;
  const box = (current.field.closest("form") ?? current.field).getBoundingClientRect();
  // The room the Notebook keeps for itself, when it is open, is not ours.
  const dock = dockWidth();
  const panel = document.getElementById("deskPanel")?.getBoundingClientRect();
  const right = dock ? innerWidth - dock : current.source === "notebook" && panel ? panel.left : innerWidth;
  let left = box.right + GAP;
  let top = box.top;
  // From the Notebook's own tab: to the left of the Notebook.
  if (current.source === "notebook") left = right - w - GAP;
  // From a Greek pane on /desk, which has no Notebook: beside the pane, to its
  // left where that has room, else to its right (BA114).
  const pane = current.source === "notebook" && !panel ? current.field.closest(".desk-pane")?.getBoundingClientRect() : null;
  if (pane) left = pane.left - w - GAP >= EDGE ? pane.left - w - GAP : pane.right + GAP;
  // No room beside the field: against the right edge. At the top of the window
  // when that clears the field itself (BVJ, 2026-11-04), so the field and the
  // builder show together without scrolling; below the field when it doesn't.
  if (left + w > right - EDGE || left < EDGE) {
    left = right - w - GAP;
    const clear = left >= current.field.getBoundingClientRect().right + GAP;
    top = clear && current.source !== "notebook" ? EDGE : box.bottom + 10;
  }
  top = Math.max(EDGE, top);
  el.style.left = `${left}px`;
  el.style.top = `${top}px`;
  // Shorter rather than higher: a window pushed up to fit would cover the
  // field it serves. It scrolls inside itself instead, down to a floor.
  const room = innerHeight - top - EDGE;
  el.style.maxHeight = room >= MIN_HEIGHT ? `${Math.min(room, MAX_HEIGHT)}px` : "";
}

/* ── Opening and closing ───────────────────────────────────────────── */

function onNotebook(e) {
  if (!current || current.source !== "notebook") return;
  if (!e.detail?.shown || e.detail?.tab !== "greek") closeGreekCommands("notebook");
}

const onPageHide = () => closeGreekCommands("page");

/**
 * Open the window for a search field.
 * @param {{ field: HTMLInputElement, source?: "page" | "notebook",
 *   focus?: boolean, filter?: string | null, typeSelect?: HTMLSelectElement | null,
 *   remember?: boolean }} options
 *   `source: "notebook"` is the Greek tab's field: it sits left of the
 *   Notebook and closes with it. `focus: false` leaves focus where it is (the
 *   window opened by itself). `filter` is a parsing word (or name) to scroll
 *   to and mark, which an error points to. `typeSelect` is the page's search
 *   type menu, which an example sets to "Greek". `remember: false` opens it
 *   without marking it seen (the tour's showing of it leaves no trace).
 *   `section: "desk"` puts the Notebook and page commands first and brings them
 *   into view (the plain "Search commands" links); otherwise the Greek's comes
 *   first. `loadDesk` is where the desk's commands come from (a promise of
 *   { commandList, runCommand }, or null where the desk is off); the default is
 *   the desk's search module.
 */
export function openGreekCommands({
  field,
  source = "page",
  focus = true,
  filter = null,
  typeSelect = null,
  remember = true,
  section = null,
  loadDesk = loadDeskSearch,
}) {
  if (!field) return;
  if (remember) markSeen();
  if (current) {
    // Already up: it follows the field that asked, and points at the filter.
    const moved = current.field !== field || current.source !== source;
    current.field = field;
    current.source = source;
    current.typeSelect = typeSelect;
    current.builder?.follow(field);
    if (moved) current.win.reposition();
    refreshDesk(loadDesk);
    if (filter) showTarget(filter, { focus });
    else {
      if (section === "desk") current.desk.el.scrollIntoView?.({ block: "start" });
      if (focus) current.win.title.focus({ preventScroll: true });
    }
    return;
  }

  const win = createFloatWindow({
    heading: "Search",
    title: "Search commands",
    className: "greek-cmds",
    // A click in it never closes the Notebook when that floats, nor the tray.
    attrs: { "data-desk-dock": "", "data-greek-commands": "" },
    place,
    onMoved: savePos,
    onClose: (reason) => {
      const was = current;
      current = null;
      was?.builder?.destroy();
      document.removeEventListener(NOTEBOOK_EVENT, onNotebook);
      window.removeEventListener("pagehide", onPageHide);
      if (reason === "close" && was?.field.isConnected) was.field.focus({ preventScroll: true });
    },
  });

  const status = make("p", "sr-only");
  status.setAttribute("role", "status");

  // The Greek's section, only where the Greek is searched.
  let builder = null;
  let more = null;
  let greekEl = null;
  if (greekSearchEnabled()) {
    greekEl = make("section", "greek-cmds__section");
    greekEl.append(
      make("h3", "greek-cmds__section-title", "Greek search"),
      make("p", "greek-cmds__lead", "Choose here and your search field shows the command it makes. Type in the field and this follows. They are always the same search."),
    );
    builder = createGreekBuilder({ put: putSearch, announce });
    more = fillGreek(greekEl, builder);
  }
  const desk = makeDesk();
  const sections = section === "desk" || !greekEl ? [desk.el, greekEl] : [greekEl, desk.el];
  win.body.append(...sections.filter(Boolean), status);

  current = { win, field, source, typeSelect, status, builder, more, desk };
  builder?.follow(field);
  refreshDesk(loadDesk);
  document.addEventListener(NOTEBOOK_EVENT, onNotebook);
  window.addEventListener("pagehide", onPageHide);
  win.show({ focus: focus && !filter });
  if (filter) showTarget(filter, { focus });
}

/**
 * Open the window the first time only (the reader picked "Greek" as the type
 * on /search), without taking focus. Later calls do nothing.
 */
export function openGreekCommandsOnce(options) {
  if (hasBeenSeen() || current) return;
  openGreekCommands({ ...options, focus: false });
}

/** Close the window (for the reason given: "close", "page", "notebook", "field", "command"). */
export function closeGreekCommands(reason = "page") {
  current?.win.close(reason);
}

/** Whether the window is open for this field. */
export function greekCommandsOpenFor(field) {
  return Boolean(current && current.field === field);
}
