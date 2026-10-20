// src/scripts/desk/footnote-notes.js
//
// Notes on a footnote (STUDY-DESK.md, M11). A note may hang on a footnote
// instead of on the words of a verse: it names its footnote exactly as a pinned
// footnote does (the verse that holds the letter, the footnote's full text, and
// `n` among identical ones), never by its letter, so findPin
// (src/lib/desk-footnotes.mjs) finds it again however the letters shift. The
// pure rules (the record, the change notice, the words) are in src/lib; this
// file is the pieces of page that make and show such notes:
//
//   - "Add a note" beside Pin, under each note in Study View's Footnotes list,
//     in the popover a footnote letter opens, in the Notebook's "This verse"
//     tab and in /desk's Footnotes pane;
//   - the reader's notes on a footnote, listed under it where there is room
//     (the tab and the pane, in full) or in two compact rows with "and N more
//     in My Notes" (the popover);
//   - the footnote element a note sits beside on Study View, for the margin
//     (note-sources.js), "Show in the footnotes" and printing.
//
// Like pins.js, nothing here touches the footnote's text: buttons and lists sit
// beside `.fn-body`, never inside it, so the popover, the handout and the
// desk's own reading of a footnote (page.js footnoteList) copy only the
// footnote. Lists are found in the document by their `data-desk-fnn` attribute
// whenever the notebook changes, so a popover that has closed or a tab that has
// redrawn leaves nothing to clean up.
//
// The notes of a chapter are kept in memory (`cache`), read again on every
// change to the notebook, so the popover, which is placed the moment it opens,
// can draw its rows at once instead of growing after it has been positioned.

import { findPin, pinFields } from "../../lib/desk-footnotes.mjs";
import { shortQuote } from "../../lib/desk-notes.mjs";
import { onFootnote } from "../../lib/desk-records.mjs";
import { forChapter, recordReference } from "../../lib/desk-store-core.mjs";
import { currentPanel } from "../lit-panel.js";
import { loadChapterPage, loadedChapterPage } from "./chapter-page.js";
import { glyph } from "./glyphs.js";
import { openNoteEditor } from "./note-editor.js";
import { fillNoteWords } from "./note-words.js";
import { footnoteList, pageChapter } from "./page.js";

/** What the buttons need: the notebook and what a write is stamped with. */
let env = null;

/** "john 3" -> that chapter's notes on footnotes (live records), as last read. */
const cache = new Map();

/** "john 3" -> how many reads of that chapter have begun, so an older one can tell it has been overtaken. */
const reads = new Map();

const keyOf = (where) => `${where.bookKey} ${where.chapter}`;
const whereOfEl = (el, prefix) => ({
  bookKey: el.dataset[`${prefix}Book`],
  chapter: Number(el.dataset[`${prefix}Chapter`]),
});

/* ── Reading the footnotes and the notes ─────────────────────────── */

/** A chapter's footnotes as the pin rules read them, if they can be had at once: the page's own, else a fetched page already read. */
export function footnoteListNow(where) {
  const here = pageChapter();
  if (here && here.bookKey === where.bookKey && here.chapter === where.chapter) return footnoteList();
  return loadedChapterPage(where.bookKey, where.chapter)?.footnoteList() ?? null;
}

/** The same, fetching the chapter's page when it isn't the page's own and hasn't been read. Null if unavailable. */
export async function footnoteListFor(where) {
  const now = footnoteListNow(where);
  if (now) return now;
  try {
    return (await loadChapterPage(where.bookKey, where.chapter)).footnoteList();
  } catch (_) {
    return null;
  }
}

/** Read one chapter's notes on footnotes from the notebook into the cache. */
async function readNotes(where) {
  const k = keyOf(where);
  const n = (reads.get(k) ?? 0) + 1;
  reads.set(k, n);
  const records = forChapter(await env.store.byChapter(where.bookKey, where.chapter), where.bookKey, where.chapter).filter(onFootnote);
  if (reads.get(k) === n) cache.set(k, records);
  return cache.get(k) ?? records;
}

/**
 * Footnote id -> the notes on it, oldest first, for a chapter's footnote list
 * and its notes on footnotes. A note whose footnote is gone (findPin says lost)
 * is on none; found, moved and changed all name the footnote they stand on now.
 *
 * @returns {Map<string, object[]>}
 */
export function notesByFootnote(list, records) {
  const map = new Map();
  for (const r of records ?? []) {
    if (!onFootnote(r)) continue;
    const at = findPin(list, r);
    if (at.status === "lost" || !at.id) continue;
    if (!map.has(at.id)) map.set(at.id, []);
    map.get(at.id).push(r);
  }
  for (const rs of map.values()) rs.sort((a, b) => String(a.created ?? "").localeCompare(String(b.created ?? "")));
  return map;
}

/**
 * The element of this page's Footnotes list a note on a footnote sits on now,
 * or null: the note is another chapter's, the page has no such list, or the
 * footnote is lost. Study View only.
 */
export function footnoteElementFor(record) {
  const here = pageChapter();
  if (!here || here.bookKey !== record.bookKey || here.chapter !== record.chapter) return null;
  const list = footnoteList();
  if (!list) return null;
  const at = findPin(list, record);
  return at.id ? document.getElementById(at.id) : null;
}

/* ── Making and editing a note ───────────────────────────────────── */

/** Where the editor opens from a button: beside the panel the button is in, if it is in one (the popover is replaced by the editor). */
function openedFrom(button) {
  const panel = button.closest(".lit-panel") ? currentPanel() : null;
  return { trigger: panel?.trigger ?? button, restoreFocus: panel ? panel.restoreFocus ?? null : button };
}

/** Open the editor on a new note for the footnote with this id in this chapter. */
async function addNote(id, where, button) {
  const list = await footnoteListFor(where);
  if (!list || !list.some((f) => f.id === id)) return;
  const draft = { bookKey: where.bookKey, chapter: where.chapter, ...pinFields(list, id) };
  const { trigger, restoreFocus } = openedFrom(button);
  openNoteEditor({ trigger, store: env.store, ctx: env.ctx, ref: recordReference(draft), draft, restoreFocus });
}

/**
 * An "Add a note" button for a footnote. `id` is the footnote's id in its
 * chapter's page (`fn-a`) and `label` its letter, which names it for a screen
 * reader and is never stored. `where` is the chapter, `{ bookKey, chapter }`:
 * the page's own by default, a pane's on /desk. Null where there is no notebook.
 *
 * @returns {HTMLButtonElement | null}
 */
export function addNoteButton(id, label, where = pageChapter()) {
  if (!env || !where?.bookKey || !where.chapter) return null;
  const at = { bookKey: where.bookKey, chapter: where.chapter };
  const button = document.createElement("button");
  button.type = "button";
  // Looks as Pin does (desk.css), and is hidden from print the same way.
  button.className = "desk-pin desk-fn-add";
  button.dataset.deskFnAdd = id;
  button.textContent = "Add a note";
  // The visible words lead the name (label in name); the letter says which.
  button.setAttribute("aria-label", `Add a note on footnote ${label}`);
  button.addEventListener("click", async (e) => {
    e.stopPropagation();
    if (button.disabled) return;
    button.disabled = true;
    try {
      await addNote(id, at, button);
    } catch (err) {
      console.error("Study Desk: the note on a footnote couldn't be started", err);
    } finally {
      button.disabled = false;
    }
  });
  return button;
}

/** Open the editor on an existing note on a footnote. */
function editNote(record, button) {
  const { trigger, restoreFocus } = openedFrom(button);
  openNoteEditor({ trigger, store: env.store, ctx: env.ctx, ref: recordReference(record), record, restoreFocus });
}

/* ── The notes under a footnote ──────────────────────────────────── */

/** How many of a footnote's notes the compact list shows before "and N more". */
const COMPACT_ROWS = 2;
const COMPACT_WORDS = 12;

function noteRow(record, compact) {
  const li = document.createElement("li");
  li.className = "desk-fnn__item";
  li.insertAdjacentHTML("beforeend", glyph(record.marker, "desk-glyph desk-fnn__glyph"));
  const words = document.createElement("span");
  words.className = "desk-fnn__words";
  if (record.body) {
    if (compact) words.textContent = shortQuote(record.body, COMPACT_WORDS);
    else fillNoteWords(words, record.body);
  } else {
    // A marker with no words: the glyph says it to the eye.
    words.className += " sr-only";
    words.textContent = "(the marker only)";
  }
  const edit = document.createElement("button");
  edit.type = "button";
  edit.className = "desk-fnn__edit";
  edit.innerHTML = `Edit<span class="sr-only"> my note on a footnote in ${escapeHtml(recordReference(record))}</span>`;
  edit.addEventListener("click", (e) => {
    e.stopPropagation();
    editNote(record, edit);
  });
  li.append(words, edit);
  return li;
}

/** Fill a list from the cache; false if the chapter's notes or footnotes haven't been read yet. */
function fillList(block) {
  const where = whereOfEl(block, "deskFnn");
  const records = cache.get(keyOf(where));
  const list = footnoteListNow(where);
  if (!records || !list) return false;
  const limit = Number(block.dataset.deskFnnLimit) || 0;
  const mine = notesByFootnote(list, records).get(block.dataset.deskFnn) ?? [];
  const sig = `${limit}|${mine.map((r) => `${r.id}:${r.modified ?? ""}:${r.marker}:${(r.body ?? "").length}`).join(",")}`;
  if (block.dataset.sig === sig) return true;
  block.dataset.sig = sig;
  block.hidden = mine.length === 0;
  if (!mine.length) {
    block.replaceChildren();
    return true;
  }
  const shown = limit ? mine.slice(0, limit) : mine;
  const ul = document.createElement("ul");
  ul.className = "desk-fnn__list";
  for (const r of shown) ul.append(noteRow(r, limit > 0));
  const parts = [ul];
  if (mine.length > shown.length) {
    const more = document.createElement("p");
    more.className = "desk-fnn__more";
    more.textContent = `and ${mine.length - shown.length} more in My Notes`;
    parts.push(more);
  }
  block.replaceChildren(...parts);
  return true;
}

/** Fill a list whose chapter hasn't been read: read the notes and the footnotes, then draw. */
async function fillLater(block) {
  const where = whereOfEl(block, "deskFnn");
  if (!cache.has(keyOf(where))) await readNotes(where);
  await footnoteListFor(where);
  fillList(block);
}

/**
 * The reader's notes on one footnote, as a list that keeps itself in step with
 * the notebook while it is in the document: each note's marker, its words and
 * Edit. Hidden while there are none. `compact` (the popover) shows the first
 * two with their words shortened and "and N more in My Notes" after; otherwise
 * every note is shown in full. Null where there is no notebook.
 *
 * @param {string} id the footnote's id in its chapter's page
 * @param {{ bookKey: string, chapter: number } | null} [where]
 * @param {{ compact?: boolean }} [options]
 * @returns {HTMLElement | null}
 */
export function footnoteNotes(id, where = pageChapter(), { compact = false } = {}) {
  if (!env || !where?.bookKey || !where.chapter) return null;
  const block = document.createElement("div");
  block.className = "desk-fnn";
  block.hidden = true;
  block.dataset.deskFnn = id;
  block.dataset.deskFnnBook = where.bookKey;
  block.dataset.deskFnnChapter = String(where.chapter);
  block.dataset.deskFnnLimit = compact ? String(COMPACT_ROWS) : "0";
  // Drawn at once from what has been read, so the popover is placed at its
  // true height; otherwise as soon as the notebook has been read.
  if (!fillList(block)) fillLater(block).catch((err) => console.error("Study Desk: the notes on a footnote couldn't be listed", err));
  return block;
}

/**
 * Read the notebook and bring every list on the page up to date: the page's
 * own chapter on Study View, and every chapter a list is drawn for on /desk.
 */
export async function refreshFootnoteNotes() {
  if (!env) return;
  const where = new Map();
  const here = pageChapter();
  if (here) where.set(keyOf(here), { bookKey: here.bookKey, chapter: here.chapter });
  for (const k of cache.keys()) {
    const [bookKey, chapter] = k.split(" ");
    where.set(k, { bookKey, chapter: Number(chapter) });
  }
  const blocks = Array.from(document.querySelectorAll("[data-desk-fnn]"));
  for (const b of blocks) {
    const w = whereOfEl(b, "deskFnn");
    where.set(keyOf(w), w);
  }
  await Promise.all(Array.from(where.values(), readNotes));
  await Promise.all(blocks.map((b) => footnoteListFor(whereOfEl(b, "deskFnn"))));
  for (const b of blocks) fillList(b);
}

/**
 * Start notes on footnotes: called by initPins once the notebook is open, so
 * it runs where pins do (a Study View chapter, and /desk).
 */
export function initFootnoteNotes({ store, ctx }) {
  env = { store, ctx };
  // This tab's own changes and other tabs' alike.
  store.subscribe(() => refreshFootnoteNotes());
  refreshFootnoteNotes();
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
}
