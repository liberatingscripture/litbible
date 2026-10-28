// src/scripts/greek-commands.js
//
// The Greek search commands window (STUDY-DESK.md, "Order of work", 2a). One
// small window lists every command a Greek search understands, builds a word
// from pickers, and offers example searches; clicking a command puts it into
// the search field it was opened from, at the cursor. The commands, their
// words and the examples are greek-query.mjs's COMMANDS and EXAMPLES, so what
// the window teaches and what a query accepts are one list.
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
import { COMMANDS, EXAMPLES, FILTERS } from "../lib/greek-query.mjs";
import { builderQuery, insertAtCursor } from "../lib/greek-commands-ui.mjs";
import { hasGreek } from "../lib/greek-search.mjs";
import { dockWidth } from "./desk-frame.js";
import { setPickedMode } from "./search-core.js";

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

/** The open window: { win, field, source, typeSelect, status }, or null. */
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

/**
 * A list of example searches as buttons, each running its query when pressed.
 * `run(query)` is the caller's; a button never takes focus from the field on
 * a mouse press, so the field keeps its cursor.
 */
export function exampleList(examples, run) {
  const ul = make("ul", "greek-examples");
  for (const ex of examples) {
    const li = make("li");
    const b = make("button", "greek-ex");
    b.type = "button";
    const q = make("span", "greek-ex__query", ex.query);
    if (hasGreek(ex.query)) q.lang = "grc";
    b.append(q, make("span", "greek-ex__says", ex.says));
    b.addEventListener("mousedown", (e) => e.preventDefault());
    b.addEventListener("click", () => run(ex.query));
    li.append(b);
    ul.append(li);
  }
  return ul;
}

/** A "See all search commands" kind of button: it reads as a link and opens the window. */
export function commandsLinkButton(label, open) {
  const b = make("button", "greek-cmd-link", label);
  b.type = "button";
  b.addEventListener("click", () => open(b));
  return b;
}

/* ── Putting a command in the field ───────────────────────────────── */

function announce(text) {
  if (!current) return;
  current.status.textContent = "";
  // A moment later, so a screen reader hears it again for the same words.
  window.setTimeout(() => { if (current) current.status.textContent = text; }, 30);
}

/** Add `text` at the field's cursor; a mouse press keeps focus in the field. */
function insert(text, { byMouse = false } = {}) {
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
  field.value = value;
  if (byMouse) field.focus({ preventScroll: true });
  try { field.setSelectionRange(caret, caret); } catch (_) {}
  field.dispatchEvent(new Event("input", { bubbles: true }));
  announce(`Added ${text.trim()} to the search.`);
}

/** Put an example in the field and run it (in the Greek type, where the page has one). */
function runExample(query) {
  if (!current) return;
  const { field, typeSelect } = current;
  if (typeSelect && typeSelect.value !== "greek") {
    setPickedMode(typeSelect, "greek");
    typeSelect.dispatchEvent(new Event("change", { bubbles: true }));
  }
  field.value = query;
  field.focus({ preventScroll: true });
  try { field.setSelectionRange(query.length, query.length); } catch (_) {}
  field.dispatchEvent(new Event("input", { bubbles: true }));
}

/* ── The window's contents ────────────────────────────────────────── */

function buildBuilder() {
  const box = make("div", "greek-build");
  const word = make("input");
  word.type = "text";
  word.placeholder = "Word, or leave empty for any";
  word.setAttribute("aria-label", "Word");
  word.autocomplete = "off";
  word.spellcheck = false;
  word.autocapitalize = "off";

  const row = make("div", "greek-build__row");
  const selects = [];
  for (const [axis, label] of [["case", "Case"], ["tense", "Tense"], ["mood", "Mood"], ["pos", "Part of speech"]]) {
    const sel = make("select");
    sel.setAttribute("aria-label", label);
    sel.append(new Option(label, ""));
    for (const f of FILTERS.filter((x) => x.axis === axis)) sel.append(new Option(f.name, f.words[0]));
    selects.push(sel);
    row.append(sel);
  }

  const add = make("button", "greek-build__add", "Add to the search");
  add.type = "button";
  const query = () => builderQuery(word.value, selects.map((s) => s.value));
  const refresh = () => add.setAttribute("aria-disabled", String(!query()));
  refresh();
  word.addEventListener("input", refresh);
  for (const s of selects) s.addEventListener("change", refresh);
  const press = (byMouse) => {
    const q = query();
    if (!q) {
      word.focus({ preventScroll: true });
      return;
    }
    insert(q, { byMouse });
  };
  add.addEventListener("mousedown", (e) => e.preventDefault());
  add.addEventListener("click", (e) => press(e.detail > 0));
  word.addEventListener("keydown", (e) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    press(false);
  });
  box.append(word, row, add);
  return box;
}

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
  b.addEventListener("click", (e) => insert(item.insert, { byMouse: e.detail > 0 }));
  return b;
}

function fillBody(body) {
  body.append(make("h3", "greek-cmds__heading", "Build a word"), buildBuilder());
  body.append(make("h3", "greek-cmds__heading", "Try one"), exampleList(EXAMPLES, runExample));
  for (const group of COMMANDS) {
    body.append(make("h3", "greek-cmds__heading", group.title));
    const ul = make("ul", "greek-cmds__list");
    for (const item of group.items) {
      const li = make("li");
      li.append(buildCommand(item));
      ul.append(li);
    }
    body.append(ul);
  }
}

/** Scroll the button for a filter (by its word or its name) into view and mark it. */
function showTarget(filter, { focus = true } = {}) {
  if (!current || !filter) return;
  const root = current.win.el;
  const btn = Array.from(root.querySelectorAll("button.greek-cmd")).find(
    (b) => b.dataset.filter === filter || b.dataset.name === filter,
  );
  if (!btn) return;
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
  // No room beside the field: below it, against the right edge.
  if (left + w > right - EDGE || left < EDGE) {
    left = right - w - GAP;
    top = box.bottom + 10;
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
 */
export function openGreekCommands({ field, source = "page", focus = true, filter = null, typeSelect = null, remember = true }) {
  if (!field) return;
  if (remember) markSeen();
  if (current) {
    // Already up: it follows the field that asked, and points at the filter.
    const moved = current.field !== field || current.source !== source;
    current.field = field;
    current.source = source;
    current.typeSelect = typeSelect;
    if (moved) current.win.reposition();
    if (filter) showTarget(filter, { focus });
    else if (focus) current.win.title.focus({ preventScroll: true });
    return;
  }

  const win = createFloatWindow({
    heading: "Greek search",
    title: "Search commands",
    className: "greek-cmds",
    // A click in it never closes the Notebook when that floats, nor the tray.
    attrs: { "data-desk-dock": "", "data-greek-commands": "" },
    place,
    onMoved: savePos,
    onClose: (reason) => {
      const was = current;
      current = null;
      document.removeEventListener(NOTEBOOK_EVENT, onNotebook);
      window.removeEventListener("pagehide", onPageHide);
      if (reason === "close" && was?.field.isConnected) was.field.focus({ preventScroll: true });
    },
  });

  const lead = make("p", "greek-cmds__lead", "Click a command to add it where your cursor is. Each has a word you can type instead. This stays open while you type.");
  const status = make("p", "sr-only");
  status.setAttribute("role", "status");
  win.body.before(lead);
  fillBody(win.body);
  win.body.append(status);

  current = { win, field, source, typeSelect, status };
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

/** Close the window (for the reason given: "close", "page", "notebook", "field"). */
export function closeGreekCommands(reason = "page") {
  current?.win.close(reason);
}

/** Whether the window is open for this field. */
export function greekCommandsOpenFor(field) {
  return Boolean(current && current.field === field);
}
