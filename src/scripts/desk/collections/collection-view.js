// src/scripts/desk/collections/collection-view.js
//
// One collection (STUDY-DESK.md, D13, mock part b), drawn by both of its homes:
// "‹ My collections", its name and description, its actions (Add ▾,
// Add to sheet…, Rename…, Print, Delete), the order switch, and its members,
// each on a sheet of its own in the Sheets editor's part look (E192), as the
// desk's own rows (record-rows.js, as My Notebook draws them). In Bible order
// a record inside a collected passage lies on that passage's sheet (E193).
// There is no "Make a sheet" (D13, decision 36; BVJ, 2026-11-19): Add to
// sheet…'s "New sheet" row makes that sheet.
// Nothing here has a look of its own (decision 25): every class is one the
// site already has, and styles/v2/collections.css only places them.
//
// What is shown comes from `collectionRows` (desk-collections.mjs) in the
// collection's own order: Bible order, By type, or My order. Only My order
// shows headings, and only it has the grip (drag), ↑ and ↓ (and Alt+Up and
// Alt+Down on a row) to move a row; each move is `moveRow`, which switches
// the collection to My order and, for a bookmark that a rule brings in,
// makes it an item. Every write is one `store.change` over the notebook as
// that transaction reads it (`planCollectionChange`), so it is one step of
// the history, and a removal or deletion offers the undo bar.
//
// Rules (a label's bookmarks now and any labeled later, D13 step 5): each has a plain
// line above the members, "Every bookmark labeled Advent · 12", with quiet
// links (`desk-item__stop`) "Stop adding new ones" (the rule becomes the
// bookmarks it holds now) and "Remove" (the rule goes; bookmarks added by hand
// stay). A bookmark a rule brings in says "from Advent", and its button is
// "Leave it out of this collection" (its id goes into the rule's `except`);
// the line then counts "1 left out" and brings each back.
//
// The host. The page (collection-page.js) and, from step 4 of the pane's order
// of work, /desk's Collections pane each hand the view and the list
// (collection-list.js) one object, the shared part of it made by `viewHost`:
// - `store`, `ctx` and `base`;
// - `root`, the host's own element. Everything a view looks for (focus keys,
//   the button a window gives focus back to) is found inside it, never with
//   `document.querySelector`, so two Collections panes never answer for each
//   other;
// - `idSuffix`, which ids, the order switch's radio name and focus keys carry
//   (`focusKey`); none on the page, whose keys are the plain words;
// - `open(id)` and `toList()`, which show one collection or the list (they
//   replace the page's `go(href)`): the page turns them into its address and
//   history, the pane into its layout field;
// - `refresh(focusKeys)`, which draws the view again and puts focus on the
//   first of those keys that is there;
// - optional: `listHref` and `href(id)`, the list's and a collection's
//   addresses, which make "‹ My collections" and a row of the list links
//   (the page); `backLabel`; `headingTag` and `headingClass` for the title;
//   `newTabLinks`, which opens the help link in a new tab;
// - optional, for the two homes' differences (D13, decisions 26, 27, 29, 32
//   and 36): `deskHref(id)`, the page's quiet "Open in the Study Desk" after
//   its actions; `ownPageHref(id)`, the pane's "Open on its own page" (a new
//   tab) in Print's place, since a print from /desk prints the desk;
//   and `goHere`, `{ can(member),
//   go(member) }`, which a plain click on a reference (a passage's or a
//   record's, a sheet's name included) runs in place of following its link,
//   as My Notes' `goHere` does (BA124). A modified click still opens the page;
//   and `listHead`, the list's title and "New collection" in one row, as a
//   Sheets pane's "My sheets" and "New sheet" are (E186), where the page's
//   "New collection…" sits under its title, as /sheets' "New sheet…" does;
//   and `listIntro`, the page's short description of the feature under the
//   list's title, as /sheets has one (E187);
// - optional, the last line of "Add ▾" (E177; BVJ, 2026-11-19: "On
//   /collections it should Go to My Notebook. On /desk, it should open the My
//   Notes pane."): `notebookHref`, the page's "From My Notebook," a link in
//   this tab, or `openNotes()`, the pane's "From My Notes," which opens a My
//   Notes pane beside it;
// - from `viewHost`: `viewState(id)` (what a view keeps while it is drawn
//   again: an open form, a heading being renamed), `listState` (the list's
//   New collection form, E190: open or not, and its words), `openWords` (the passages
//   shown whole, by row key, for the visit), `chapterText` (a chapter's anchor
//   text, for checking a typed reference), `passageText` (a passage's words,
//   read once a place), and `parse` (the reference reader). A test replaces
//   the last three.

import { labelMap } from "../../../lib/desk-labels.mjs";
import { nestRows } from "../../../lib/desk-collection-nest.mjs";
import { COLLECTION_ORDERS, collectionTooBig } from "../../../lib/desk-collection-format.mjs";
import {
  addHeading,
  collectionName,
  collectionRows,
  bringBack,
  editHeading,
  leaveOut,
  leftOutPlace,
  moveRow,
  moveTarget,
  planAddPassage,
  planCollectionChange,
  removeItem,
  removeMember,
  removeRule,
  ruleToItems,
  setCollectionFields,
  setOrder,
} from "../../../lib/desk-collections.mjs";
import { passageForReference, passageReference } from "../../../lib/desk-sheet-passages.mjs";
import { describeRefusal } from "../../../lib/desk-sheet-ref-refusal.mjs";
import { bookKeyToLabel } from "../../../data/books.js";
import { recordHref, recordReference } from "../../../lib/desk-store-core.mjs";
import { undoEntry } from "../history.js";
import { recordRow } from "../record-rows.js";
import { showNotice, showUndo } from "../undo-bar.js";
import { buttons, make } from "../dom.js";
import { setTip } from "../../tip.js";
import { plural } from "../desk-text.js";
import { newTabMark } from "../glyphs.js";
import { parseReference } from "../../search-core.js";
import { openButtonMenu } from "../button-menu.js";
import { labelsToAdd, openAddLabels, openAddSheet, sheetsToAdd } from "./add-records.js";
import { alsoInside } from "./add-passage.js";
import { openAddToSheet } from "./collection-sheet.js";
import { openNameWindow } from "./name-window.js";

const button = buttons("desk-sheet__btn");

const ORDER_NAMES = { bible: "Bible order", type: "By type", mine: "My order" };
const FAILED = "That couldn’t be saved in this browser, so nothing changed. Try again.";
const FULL = "This collection is full, so nothing was added.";
const UNREAD = "These verses couldn’t be read just now.";

// The caret a note and a pinned footnote open with in My Notes (E118).
const ICON_CARET = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor"
  stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
  <path d="M6 9l6 6 6-6" /></svg>`;

// "Add ▾"'s caret, at /sheets' "Save as ▾" size (E177).
const ICON_ADD_CARET = `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor"
  stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
  <path d="M6 9l6 6 6-6" /></svg>`;

/* ── The host's shared part, and what every view looks for in it ──── */

/** A chapter's anchor text, or null when it can't be read. */
async function readChapterText(bookKey, chapter) {
  try {
    const { loadChapterPage } = await import("../chapter-page.js");
    const source = await loadChapterPage(bookKey, chapter);
    return source.textBox ? source.anchorText() : null;
  } catch (_) {
    return null;
  }
}

/**
 * The words of `where` ({ bookKey, chapter, verse, endVerse }) as a scripture
 * page sets them, or null when they can't be read (E171; BVJ, 2026-11-19): an
 * element holding its paragraphs and poetry lines, italics, and verse
 * numbers, with no footnote letters (`passageWords` drops them when asked to
 * keep none). A test may hand back plain text instead.
 */
async function readPassageWords(where) {
  try {
    const { readPassage, passageWords } = await import("../sheets/sheet-lit.js");
    const m = { bookKey: where.bookKey, chapter: where.chapter, verse: where.verse, endVerse: where.endVerse };
    const view = await readPassage(m);
    if (!view.ok) return null;
    // passageWords gives { el, base }: the words are its element.
    return passageWords(view, m)?.el ?? null;
  } catch (err) {
    // Said aloud: a quiet failure here once hid that no live words were ever read.
    console.error("Study Desk: a collection's passage couldn’t be read", err);
    return null;
  }
}

/**
 * The part of a host the page and the pane share (see "The host", above):
 * the readers, each passage's words read once and kept, each collection's
 * view state, and the passages shown whole. The defaults load the chapter
 * pages (chapter-page.js) and read the words as a sheet's passage does
 * (sheets/sheet-lit.js), each only when first asked for, so the list alone
 * loads neither.
 *
 * @param {{ store: object, ctx: () => object, base: string,
 *   chapterText?: Function, passageText?: Function, parse?: Function }} options
 */
export function viewHost({ store, ctx, base, chapterText = readChapterText, passageText = readPassageWords, parse = parseReference }) {
  const words = new Map();
  const states = new Map();
  return {
    store,
    ctx,
    base,
    chapterText,
    parse,
    openWords: new Set(),
    passageText(where) {
      const key = `${where.bookKey} ${where.chapter}:${where.verse}-${where.endVerse ?? where.verse}`;
      if (!words.has(key)) words.set(key, passageText(where));
      return words.get(key);
    },
    viewState(id) {
      if (!states.has(id)) states.set(id, { adding: false, typed: "", heading: false, headingText: "", editing: null });
      return states.get(id);
    },
    // The list's New collection form (E190): open or not, and what is typed in it.
    listState: { open: false, name: "", description: "" },
  };
}

/** A focus key as `host` writes it: the word, with the host's id where it has one. */
export const focusKey = (host, name) => (host.idSuffix ? `${name}--${host.idSuffix}` : name);

/** The control with focus key `name` inside the host's own element, or null. */
export const keyed = (host, name) =>
  host.root?.querySelector(`[data-focus-key="${CSS.escape(focusKey(host, name))}"]`) ?? null;

/** The view's title: the page's h1, or what the host asks for. */
export const heading = (host, text) => make(host.headingTag ?? "h1", host.headingClass ?? "sheets-page__title", text);

/** A plain click on a link runs `run` in place; a modified one is left to the browser (a new tab). */
export function follow(e, run) {
  if (e.ctrlKey || e.metaKey || e.shiftKey || e.altKey || e.button !== 0) return;
  e.preventDefault();
  run();
}

/**
 * "‹ My collections": a link where the host gives the list's address, else a
 * button in the Sheets pane's top row (`desk-sheet__top`), whose spacing puts
 * the title where a sheet's title sits under "‹ All sheets" (the mock).
 */
function backTo(host) {
  const label = host.backLabel ?? "‹ My collections";
  if (host.listHref) {
    const back = make("a", "sheets-page__back", label);
    back.href = host.listHref;
    back.addEventListener("click", (e) => follow(e, () => host.toList()));
    back.dataset.focusKey = focusKey(host, "back");
    return back;
  }
  const back = button(label, "desk-sheet__btn desk-sheet__btn--quiet");
  back.addEventListener("click", () => host.toList());
  back.dataset.focusKey = focusKey(host, "back");
  const top = make("div", "desk-sheet__top");
  top.append(back);
  return top;
}

/** A quiet link in the actions' row: the Sheets pane's "Open on its own page" look. */
function leaveLink(text, href, newTab) {
  const a = make("a", "desk-sheet__btn desk-sheet__btn--quiet desk-sheet__print", text);
  a.href = href;
  if (newTab) {
    a.target = "_blank";
    a.rel = "noopener";
    a.append(newTabMark(), make("span", "sr-only", " (opens in a new tab)"));
  }
  return a;
}

// Each row's words measured again when their box changes size (the window, the
// Display tray's text size, a font arriving), for whether they are cut.
const measures = new WeakMap();
const resized =
  typeof ResizeObserver === "function"
    ? new ResizeObserver((entries) => {
      for (const { target } of entries) {
        if (target.isConnected) measures.get(target)?.();
        else resized.unobserve(target);
      }
    })
    : null;

/** What a write over a collection says when it didn't go through, or null. */
function trouble(plan) {
  if (plan.gone) return "This collection can’t be changed here. It may have been deleted.";
  if (plan.failed) return FAILED;
  if (plan.refused) return collectionTooBig(plan.refused) ? FULL : String(plan.refused.message ?? FAILED);
  return null;
}

/**
 * Write what `plan(records)` makes of the notebook as one transaction reads
 * it: a collection plan (planCollectionChange, planAddPassage). Resolves to
 * that plan, or `{ failed: true }`, or `{ refused }` for a size limit.
 */
export async function writePlan(host, plan) {
  let made = null;
  try {
    await host.store.change(async ({ all }) => {
      made = plan(await all());
      return made.changed ? made : null;
    });
  } catch (err) {
    if (collectionTooBig(err)) return { refused: err };
    console.error("Study Desk: the collection couldn’t be changed", err);
    return { failed: true };
  }
  return made ?? { failed: true };
}

/**
 * Write one change to the collection `id`. `op(collection, records)` returns
 * the changed collection (the same object when it changes nothing).
 */
export const writeCollection = (host, id, op) =>
  writePlan(host, (records) => planCollectionChange(records, id, (c) => op(c, records)));

const opCtx = (host) => ({ now: new Date().toISOString(), ...host.ctx() });

/** The text a row's Remove and move buttons name it by. */
const nameOfRow = (row) =>
  row.type === "heading"
    ? row.text
    : row.type === "passage"
      ? passageReference(row.member)
      : row.record.kind === "sheet"
        ? row.record.title?.trim() || "Untitled sheet"
        : recordReference(row.record) || row.record.kind;

/**
 * The view of collection `id`: { nodes, title, focus }. A collection that
 * isn't there (deleted, or another browser's) is a note with the way back.
 */
export async function collectionView(host, id) {
  const records = await host.store.all();
  const c = records.find((r) => r?.id === id && r.kind === "collection");
  const back = backTo(host);
  const key = (name) => focusKey(host, name);
  if (!c) {
    const title = heading(host, "Collection not found");
    const note = make("p", "desk-np__intro", "This collection isn’t in this browser’s notebook. It may have been deleted.");
    return { nodes: [back, title, note], title: "Collection not found | Liberation and Inclusion Translation", focus: title };
  }
  const name = collectionName(c);
  const shown = collectionRows(c, records);
  const state = host.viewState(id);
  const title = heading(host, name);
  title.dataset.focusKey = key("title");
  // The undo bar leaves out "Open the collection" while it is on screen (E205; add-passage.js).
  title.dataset.collectionShown = id;
  const nodes = [back, title];
  if (c.description) nodes.push(make("p", "desk-np__intro collection-page__description", c.description));

  /* ── Actions ──────────────────────────────────────────────────── */
  const actions = make("div", "collection-page__actions");
  // The page's one primary button (E126): adding is what the page is for (BVJ,
  // 2026-11-19). "Add ▾" (E177) opens a menu of what can go in, its caret
  // drawn as /sheets' "Save as ▾" draws one.
  const add = button("Add", "desk-sheet__btn desk-sheet__btn--primary collection-page__add");
  const caret = make("span", "collection-page__add-more");
  caret.setAttribute("aria-hidden", "true");
  caret.innerHTML = ICON_ADD_CARET;
  add.append(caret);
  add.dataset.focusKey = key("add");
  add.setAttribute("aria-haspopup", "menu");
  add.setAttribute("aria-expanded", "false");
  // "Add to sheet…" makes a new sheet too, from its window's "New sheet" row,
  // so there is no "Make a sheet" beside it (D13, decision 36).
  const toSheet = button("Add to sheet…");
  toSheet.dataset.focusKey = key("add-to-sheet");
  toSheet.setAttribute("aria-haspopup", "dialog");
  const rename = button("Rename…");
  rename.dataset.focusKey = key("rename");
  const print = button("Print");
  print.dataset.focusKey = key("print");
  const del = button("Delete");
  del.dataset.focusKey = key("delete");
  del.setAttribute("aria-label", `Delete ${name}`);
  // Each home offers the other (decision 27). A print from /desk would print
  // the desk, so the pane has "Open on its own page" in Print's place
  // (decisions 32 and 36); the page keeps Print and ends with "Open in the
  // Study Desk", in this tab, as a sheet's page ends with "Edit in Study Desk".
  if (host.ownPageHref) {
    const own = leaveLink("Open on its own page", host.ownPageHref(id), true);
    own.dataset.focusKey = key("own-page");
    actions.append(add, toSheet, rename, del, own);
  } else {
    actions.append(add, toSheet, rename, print, del);
    if (host.deskHref) {
      const desk = leaveLink("Open in the Study Desk", host.deskHref(id), false);
      desk.dataset.focusKey = key("desk");
      actions.append(desk);
    }
  }
  nodes.push(actions);

  const form = passageForm(host, c, state, () => {
    state.adding = false;
    form.hidden = true;
    keyed(host, "add")?.focus();
  });
  form.hidden = !state.adding;
  nodes.push(form);
  // Add toggles its menu. A mouse press on Add while the menu is open takes
  // focus out of it, which closes it before the click, so whether it was open
  // is noted at the press, or the click would open it again.
  let menu = null;
  let openAtPress = false;
  add.addEventListener("pointerdown", () => {
    openAtPress = Boolean(menu);
  });
  add.addEventListener("click", () => {
    const wasOpen = openAtPress || Boolean(menu);
    openAtPress = false;
    menu?.close(true);
    if (wasOpen) return;
    menu = openButtonMenu({
      button: add,
      id: `collectionAddMenu${host.idSuffix ? `-${host.idSuffix}` : ""}`,
      label: `Add to ${name}`,
      items: addLines(host, records),
      onPick: (type) => {
        if (type === "passage") {
          state.adding = true;
          form.hidden = false;
          form.querySelector("input")?.focus();
          return;
        }
        const at = add.getBoundingClientRect();
        const near = { left: at.left, top: at.bottom + 8 };
        const back = () => keyed(host, "add");
        if (type === "sheet") openAddSheet({ store: host.store, ctx: host.ctx, collection: c, near, back });
        else if (type === "label") openAddLabels({ store: host.store, ctx: host.ctx, collection: c, near, back });
        else if (type === "notes") host.openNotes?.();
      },
      onClose: (closing) => {
        if (menu?.close === closing) menu = null;
      },
    });
  });

  toSheet.addEventListener("click", () => {
    const at = toSheet.getBoundingClientRect();
    openAddToSheet({
      store: host.store,
      ctx: host.ctx,
      collection: c,
      chapterText: host.chapterText,
      near: { left: at.left, top: at.bottom + 8 },
      back: () => keyed(host, "add-to-sheet"),
    });
  });

  rename.addEventListener("click", () => {
    const at = rename.getBoundingClientRect();
    openNameWindow({
      heading: "Collection",
      title: "Rename collection",
      submit: "Save",
      fields: [
        { key: "name", label: "Name", value: c.name ?? "", maxLength: 200 },
        { key: "description", label: "Description", value: c.description ?? "", multiline: true, maxLength: 1000 },
      ],
      near: { left: at.left, top: at.bottom + 8 },
      back: () => keyed(host, "rename"),
      onSubmit: async ({ name: n, description }) => {
        const plan = await writeCollection(host, id, (col) => setCollectionFields(col, { name: n, description }, opCtx(host)));
        const said = trouble(plan);
        if (said) return said;
        const entry = plan.changed ? host.store.lastEntry() : null;
        // Say what changed: the window holds the description too.
        const renamed = (n ?? "").trim() !== (c.name ?? "").trim();
        if (entry) showUndo(renamed ? "Collection renamed." : "Description saved.", () => undoEntry(entry));
        host.refresh([key("rename")]);
        return null;
      },
    });
  });

  print.addEventListener("click", () => window.print());

  del.addEventListener("click", async () => {
    let trash = null;
    try {
      trash = await host.store.remove(id);
    } catch (err) {
      console.error("Study Desk: couldn’t delete a collection", err);
      showNotice("The collection couldn’t be deleted in this browser. Try again in a moment.");
      return;
    }
    const entry = trash ? host.store.lastEntry() : null;
    if (entry) showUndo(`${name} deleted.`, () => undoEntry(entry));
    host.toList();
  });

  /* ── The order ────────────────────────────────────────────────── */
  const bar = make("div", "collection-page__bar");
  const seg = make("div", "desk-seg");
  seg.setAttribute("role", "radiogroup");
  seg.setAttribute("aria-label", "Order");
  for (const order of COLLECTION_ORDERS) {
    const label = make("label", "desk-seg__option");
    const input = make("input", "desk-seg__input");
    input.type = "radio";
    // Each host's own group: two panes showing collections must not share one,
    // or choosing My order in one takes it from the other (the mock, 2026-11-19).
    input.name = host.idSuffix ? `collection-order-${host.idSuffix}` : "collection-order";
    input.value = order;
    input.checked = order === shown.order;
    if (input.checked) input.dataset.focusKey = key("order");
    input.addEventListener("change", async () => {
      if (!input.checked) return;
      const plan = await writeCollection(host, id, (col) => setOrder(col, order, opCtx(host)));
      const said = trouble(plan);
      if (said) showNotice(said);
      host.refresh([key("order")]);
    });
    label.append(input, make("span", "desk-seg__text", ORDER_NAMES[order]));
    seg.append(label);
  }
  bar.append(seg);
  const mine = shown.order === "mine";
  nodes.push(bar);
  if (mine) {
    const addHeading = button("Add a heading");
    addHeading.dataset.focusKey = key("heading");
    addHeading.setAttribute("aria-expanded", String(state.heading));
    bar.append(addHeading);
    const hform = headingForm(host, c, state);
    hform.hidden = !state.heading;
    addHeading.addEventListener("click", () => {
      state.heading = !state.heading;
      hform.hidden = !state.heading;
      addHeading.setAttribute("aria-expanded", String(state.heading));
      if (state.heading) hform.querySelector("input")?.focus();
    });
    nodes.push(hform);
  }

  /* ── The rules' lines ─────────────────────────────────────────── */
  for (const info of shown.rules) nodes.push(ruleLine(host, c, info));

  /* ── The members ──────────────────────────────────────────────── */
  // Each member lies on a sheet of its own, the Sheets editor's part
  // (.desk-sheet__module; BVJ, 2026-11-20, E192), on the page and in a pane
  // alike: in a run of one kind the sheets touch, and a change of kind leaves
  // the gap between a sheet's parts. A group's label and a heading lie on the
  // page between them. In Bible order a record wholly inside a passage lies on
  // that passage's sheet, under its words (E193; the rule is nestRows').
  const members = make("div", `collection-page__members${mine ? " collection-page__members--mine" : ""}`);
  if (!shown.rows.length) {
    members.append(make("p", "desk-sheet__empty", "Nothing in this collection yet. Add a passage with the button above."));
  }
  const labels = labelMap(records);
  const rowCtx = { labels, mine, rows: shown.rows, rules: shown.rules };
  const rows = shown.order === "bible" ? nestRows(shown.rows) : shown.rows;
  // My Notebook's serif group heading (E195), a level under the view's title.
  const groupTag = host.headingTag === "h3" ? "h4" : "h2";
  let run = null;
  let runKind = null;
  const endRun = () => {
    run = null;
    runKind = null;
  };
  const group = (text) => {
    endRun();
    members.append(make(groupTag, "desk-np__h3 collection-page__group", text));
  };
  // My order's gap pills (E196): one above the first row, one under each row.
  const gaps = mine ? gapPills(host, c, state, shown.rows) : null;
  if (gaps) {
    members.append(gaps.zone(null));
    if (state.headingAt === TOP) members.append(gaps.form(null));
  }
  // In Bible order the sheets come first, and a label names where the verses begin.
  let byVerse = shown.order === "bible" && rows[0]?.type === "group";
  for (const row of rows) {
    if (row.type === "group") {
      group(row.title);
      continue;
    }
    if (byVerse && !(row.type === "record" && row.record.kind === "sheet")) {
      byVerse = false;
      group("By verse");
    }
    let el;
    if (row.type === "heading") {
      endRun();
      el = headingRow(host, c, row, state, shown.rows);
      members.append(el);
    } else {
      const kind = row.type === "passage" ? "passage" : row.record.kind;
      if (!run || kind !== runKind) {
        run = make("ul", "desk-list collection-page__run");
        runKind = kind;
        members.append(run);
      }
      el = memberRow(host, c, row, rowCtx);
      el.classList.add("collection-page__member");
      if (row.children) {
        const inner = make("ul", "desk-list collection-page__nested");
        for (const child of row.children) inner.append(memberRow(host, c, child, { ...rowCtx, nested: true }));
        el.append(inner);
      }
      run.append(el);
    }
    if (gaps) {
      el.append(gaps.zone(row));
      if (state.headingAt === row.key) {
        endRun();
        members.append(gaps.form(row));
      }
    }
  }
  if (gaps) {
    gaps.sync();
    members.append(gaps.keys);
  }
  if (mine) wireMoves(host, c, members);
  nodes.push(members);
  return { nodes, title: `${name} | Liberation and Inclusion Translation`, focus: title };
}

/* ── My order's gap pills (E196) ────────────────────────────────── */

const TOP = "\u0000top";

/**
 * The sheet editor's gap pill, for headings (BVJ, 2026-11-20, E196): a line
 * with "+ Heading" across the space under each row of My order, and above the
 * first, shown under the pointer or on keyboard focus (`.desk-sheet__after`).
 * It opens a heading's field right there, so a heading lands where it is
 * wanted in one step. As in the sheet editor, the pills are one Tab stop (the
 * one last used, kept in the view's state), and the up and down arrows, Home
 * and End move between them (DK6-1).
 */
function gapPills(host, c, state, rows) {
  const suffix = host.idSuffix ? `-${host.idSuffix}` : "";
  const keysId = `collectionGapKeys${suffix}`;
  const keys = make("span", "sr-only", "Up and down arrows move to the other places between rows.");
  keys.id = keysId;
  const pills = [];
  const at = (row) => (row ? row.key : TOP);
  const sync = () => {
    if (!pills.some((p) => p.dataset.gap === state.gapStop)) state.gapStop = pills[0]?.dataset.gap ?? null;
    for (const p of pills) p.tabIndex = p.dataset.gap === state.gapStop ? 0 : -1;
  };
  const zone = (row) => {
    const z = make("div", "desk-sheet__after collection-page__gap");
    const pill = button("+ Heading", "desk-sheet__after-btn");
    const where = row ? `after ${nameOfRow(row)}` : "at the top";
    pill.setAttribute("aria-label", `Add a heading ${where}`);
    pill.setAttribute("aria-describedby", keysId);
    pill.setAttribute("aria-expanded", String(state.headingAt === at(row)));
    pill.dataset.gap = at(row);
    pill.dataset.focusKey = focusKey(host, `gap-${at(row)}`);
    setTip(pill, "Add a heading here");
    pill.addEventListener("focus", () => {
      state.gapStop = at(row);
      sync();
    });
    pill.addEventListener("click", () => {
      state.headingAt = state.headingAt === at(row) ? null : at(row);
      host.refresh(state.headingAt ? [focusKey(host, "gap-input")] : [pill.dataset.focusKey]);
    });
    pill.addEventListener("keydown", (e) => {
      if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
      const i = pills.indexOf(pill);
      const to = { ArrowDown: i + 1, ArrowUp: i - 1, Home: 0, End: pills.length - 1 }[e.key];
      if (to === undefined) return;
      e.preventDefault();
      e.stopPropagation();
      pills[Math.max(0, Math.min(pills.length - 1, to))]?.focus();
    });
    pills.push(pill);
    z.append(pill);
    return z;
  };
  /** The field the pill under `row` (null: the top one) opens, as the sheet editor's passage form under a part. */
  const form = (row) => {
    const close = () => {
      state.headingAt = null;
      host.refresh([focusKey(host, `gap-${at(row)}`)]);
    };
    const wrap = make("div", "collection-page__form collection-page__gap-form");
    const head = make("div", "desk-sheet__insert-head");
    const title = make("p", "desk-sheet__insert-title", row ? `Add a heading after ${nameOfRow(row)}` : "Add a heading at the top");
    title.id = `collectionGapTitle${suffix}`;
    const shut = button("×", "desk-sheet__icon");
    shut.setAttribute("aria-label", "Close");
    shut.addEventListener("click", () => close());
    head.append(title, shut);
    const f = make("form", "desk-sheet__ref");
    f.setAttribute("aria-labelledby", title.id);
    const input = make("input");
    input.type = "text";
    input.placeholder = "A heading, such as Week 1: Hope";
    input.setAttribute("aria-label", "Heading to add");
    input.maxLength = 200;
    input.dataset.focusKey = focusKey(host, "gap-input");
    input.value = state.headingText;
    input.addEventListener("input", () => (state.headingText = input.value));
    const go = button("Add");
    go.type = "submit";
    f.append(input, go);
    f.addEventListener("submit", async (e) => {
      e.preventDefault();
      const text = input.value.trim();
      if (!text) {
        input.focus();
        return;
      }
      // Before the row that follows this one, else at the end.
      const i = row ? rows.findIndex((r) => r.key === row.key) : -1;
      const before = rows[i + 1]?.key ?? null;
      let made = null;
      const plan = await writeCollection(host, c.id, (col, records) => {
        const next = addHeading(col, text, before, records, opCtx(host));
        made = next.members.find((m) => m?.type === "heading" && !col.members.some((o) => o?.id === m.id))?.id ?? null;
        return next;
      });
      const said = trouble(plan);
      if (said) {
        showNotice(said);
        return;
      }
      const entry = host.store.lastEntry();
      state.headingText = "";
      state.headingAt = null;
      showUndo(`Heading “${text}” added.`, () => undoEntry(entry));
      host.refresh(made ? [focusKey(host, `rename-${made}`)] : [], { reveal: true });
    });
    wrap.addEventListener("keydown", (e) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      e.stopPropagation();
      close();
    });
    wrap.append(head, f);
    return wrap;
  };
  return { zone, form, sync, keys };
}

/* ── A rule's line ──────────────────────────────────────────────── */

// Where each bookmark left out of a collection was among its members, by
// "<collection id> <bookmark id>", so Bring back puts it back there (E201;
// BVJ, 2026-11-20). For this visit only: the record keeps no place for a
// bookmark left out (STUDY-DESK-FORMAT.md), so after a reload it comes back
// at the end, as it always did.
const leftOutPlaces = new Map();

/**
 * "Every bookmark labeled Advent · 12 · 1 left out (John 1:5). Bring it back ·
 * Stop adding new ones · Remove": a plain line with quiet links, one per rule
 * (decision 25). A rule whose label is gone says so, and can only be removed.
 */
function ruleLine(host, c, info) {
  const line = make("p", "desk-np__intro collection-page__rule");
  const id = info.member.id;
  const where = collectionName(c);
  const link = (text, key, label, run) => {
    const b = make("button", "desk-item__stop", text);
    b.type = "button";
    b.dataset.focusKey = focusKey(host, key);
    b.setAttribute("aria-label", label);
    b.addEventListener("click", run);
    return b;
  };
  const write = async (op, said, focus = ["add"]) => {
    const plan = await writeCollection(host, c.id, op);
    const problem = trouble(plan);
    if (problem) {
      showNotice(problem);
      return;
    }
    const entry = plan.changed ? host.store.lastEntry() : null;
    if (entry) showUndo(said, () => undoEntry(entry));
    host.refresh(focus.map((k) => focusKey(host, k)));
  };
  const remove = (label) =>
    link("Remove", `rule-remove-${id}`, `Remove the rule “${label}” from ${where}`, () =>
      write((col) => removeRule(col, id, opCtx(host)), `The rule “${label}” was removed from ${where}. Bookmarks added by hand stay.`),
    );
  if (!info.known) {
    line.textContent = "This collection has a rule from a newer version of the Study Desk, which this version can’t show.";
    return line;
  }
  if (info.gone) {
    line.append("The label for this rule is gone, so it adds no more bookmarks. ", remove("this rule"));
    return line;
  }
  const label = info.label.name;
  line.append(`Every bookmark labeled ${label} · ${info.bookmarks.length}`);
  if (info.leftOut.length) {
    line.append(` · ${info.leftOut.length} left out`);
    for (const b of info.leftOut) {
      const ref = recordReference(b) || "bookmark";
      line.append(
        " · ",
        link(`Bring back ${ref}`, `rule-back-${b.id}`, `Bring ${ref} back into ${where}`, () =>
          write(
            (col) => bringBack(col, b.id, opCtx(host), leftOutPlaces.get(`${c.id} ${b.id}`) ?? null),
            `${ref} brought back into ${where}.`,
            [`rule-stop-${id}`, "add"],
          ),
        ),
      );
    }
  }
  line.append(
    " · ",
    link("Stop adding new ones", `rule-stop-${id}`, `Stop adding new bookmarks labeled ${label} to ${where}`, () =>
      write(
        (col, records) => ruleToItems(col, id, records, opCtx(host)),
        info.bookmarks.length === 1
          ? `${label}’s bookmark stays in ${where}, and new ones won’t be added.`
          : `${label}’s ${plural(info.bookmarks.length, "bookmark", "bookmarks")} stay in ${where}, and new ones won’t be added.`,
      ),
    ),
    " · ",
    remove(label),
  );
  return line;
}

/* ── Add ▾ ──────────────────────────────────────────────────────── */

/**
 * The lines of a collection's "Add ▾" (E177), from the notebook as the view
 * was drawn (it is drawn again on every change): Passage…, Sheet… and A
 * label's bookmarks… (each disabled, with its reason, where there is nothing
 * to choose), then the host's way to the notebook's list, if it has one.
 */
export function addLines(host, records) {
  const lines = [
    { label: "Passage…", type: "passage" },
    sheetsToAdd(records).length
      ? { label: "Sheet…", type: "sheet" }
      : { label: "Sheet…", type: "sheet", disabled: true, why: "no sheets yet" },
    labelsToAdd(records).length
      ? { label: "A label’s bookmarks…", type: "label" }
      : { label: "A label’s bookmarks…", type: "label", disabled: true, why: "no labeled bookmarks yet" },
  ];
  if (host.notebookHref) lines.push({ label: "From My Notebook", type: "notebook", href: host.notebookHref });
  else if (host.openNotes) lines.push({ label: "From My Notes", type: "notes" });
  return lines;
}

/* ── Passage… ──────────────────────────────────────────────────── */

/**
 * The passage field "Add ▾ › Passage…" opens, with a × and Escape that close
 * it (`close`, which hands focus back to Add), as the sheet's passage form
 * under a card does.
 */
function passageForm(host, c, state, close) {
  const form = make("form", "desk-sheet__ref");
  const input = make("input");
  input.type = "text";
  input.placeholder = "A reference, such as John 3:16–18";
  input.setAttribute("aria-label", "Passage to add");
  input.dataset.focusKey = focusKey(host, "add-input");
  input.value = state.typed;
  input.addEventListener("input", () => (state.typed = input.value));
  const go = button("Add");
  go.type = "submit";
  const problem = make("p", "desk-sheet__problem");
  problem.setAttribute("role", "alert");
  const note = make("p", "desk-sheet__empty");
  note.setAttribute("role", "status");
  note.hidden = true;
  form.append(input, go);
  const wrap = make("div", "collection-page__form");
  const head = make("div", "desk-sheet__insert-head");
  const title = make("p", "desk-sheet__insert-title", "Add a passage");
  title.id = `collectionAddTitle${host.idSuffix ? `-${host.idSuffix}` : ""}`;
  const shut = button("×", "desk-sheet__icon");
  shut.setAttribute("aria-label", "Close");
  shut.addEventListener("click", close);
  head.append(title, shut);
  form.setAttribute("aria-labelledby", title.id);
  wrap.append(head, form, problem, note);
  wrap.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    e.preventDefault();
    e.stopPropagation();
    close();
  });
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    note.hidden = true;
    const typed = input.value.replace(/[–—]/g, "-");
    const ref = host.parse(typed);
    if (!ref) {
      problem.textContent =
        describeRefusal(typed, { parse: host.parse, label: bookKeyToLabel }) ??
        "That isn’t a reference the LIT can read. Try a book, a chapter, and verses, such as Romans 5:6–10.";
      return;
    }
    problem.textContent = "";
    const chapter = await host.chapterText(ref.bookKey, ref.chapter);
    const found = passageForReference(chapter, ref, host.ctx().contentVersion);
    if (found.problem) {
      problem.textContent = found.problem;
      return;
    }
    const where = passageReference(found.fields);
    const plan = await writePlan(host, (records) => planAddPassage(records, c.id, found.fields, opCtx(host)));
    const said = trouble(plan);
    if (said) {
      problem.textContent = said;
      return;
    }
    // The same verses already in it: nothing is added, and the reader is told (D13 decision 12).
    if (plan.again) {
      note.textContent = `${where} is already in ${collectionName(c)}.`;
      note.hidden = false;
      return;
    }
    const entry = host.store.lastEntry();
    state.typed = "";
    input.value = "";
    // A passage inside one the collection holds says so (E194).
    showUndo(`${where} added to ${collectionName(c)}.${alsoInside(c, found.fields)}`, () => undoEntry(entry));
    host.refresh([focusKey(host, "add-input")]);
  });
  return wrap;
}

/* ── Headings (My order) ────────────────────────────────────────── */

function headingForm(host, c, state) {
  // Wrapped as Add passage’s field is: .desk-sheet__ref is a flex row, which `hidden` alone can’t close.
  const wrap = make("div", "collection-page__form");
  const form = make("form", "desk-sheet__ref");
  const input = make("input");
  input.type = "text";
  input.placeholder = "A heading, such as Week 1: Hope";
  input.setAttribute("aria-label", "Heading to add");
  input.maxLength = 200;
  input.dataset.focusKey = focusKey(host, "heading-input");
  input.value = state.headingText;
  input.addEventListener("input", () => (state.headingText = input.value));
  const go = button("Add");
  go.type = "submit";
  form.append(input, go);
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text) {
      input.focus();
      return;
    }
    const plan = await writeCollection(host, c.id, (col, records) => addHeading(col, text, null, records, opCtx(host)));
    const said = trouble(plan);
    if (said) {
      showNotice(said);
      return;
    }
    const entry = host.store.lastEntry();
    state.headingText = "";
    showUndo(`Heading “${text}” added.`, () => undoEntry(entry));
    host.refresh([focusKey(host, "heading-input")]);
  });
  wrap.append(form);
  return wrap;
}

const grip = () => {
  const g = make("span", "desk-sheet__grip", "⠿");
  g.setAttribute("aria-hidden", "true");
  g.title = "Drag to move";
  return g;
};

/** A heading in My order: its grip, its words, and its buttons; a field while it is being renamed. */
function headingRow(host, c, row, state, rows) {
  const box = make("div", "collection-page__heading v2-rule");
  box.dataset.rowKey = row.key;
  if (state.editing === row.key) {
    const form = make("form", "desk-sheet__ref");
    const input = make("input");
    input.type = "text";
    input.value = row.text;
    input.maxLength = 200;
    input.setAttribute("aria-label", "Heading");
    input.dataset.focusKey = focusKey(host, `edit-${row.key}`);
    const save = make("button", "desk-item__edit", "Save");
    save.type = "submit";
    const cancel = make("button", "desk-item__edit", "Cancel");
    cancel.type = "button";
    cancel.addEventListener("click", () => {
      state.editing = null;
      host.refresh([focusKey(host, `rename-${row.key}`)]);
    });
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const text = input.value.trim();
      state.editing = null;
      if (text !== row.text) {
        const plan = await writeCollection(host, c.id, (col) => editHeading(col, row.member.id, text, opCtx(host)));
        const said = trouble(plan);
        if (said) showNotice(said);
        else if (plan.changed) {
          const entry = host.store.lastEntry();
          showUndo("Heading changed.", () => undoEntry(entry));
        }
      }
      host.refresh([focusKey(host, `rename-${row.key}`)]);
    });
    form.addEventListener("keydown", (e) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      cancel.click();
    });
    form.append(input, save, cancel);
    box.append(grip(), form);
    return box;
  }
  const tools = make("div", "desk-np-row__buttons");
  const renameBtn = make("button", "desk-item__edit", "Rename");
  renameBtn.type = "button";
  renameBtn.setAttribute("aria-label", `Rename heading ${row.text}`);
  renameBtn.dataset.focusKey = focusKey(host, `rename-${row.key}`);
  renameBtn.addEventListener("click", () => {
    state.editing = row.key;
    host.refresh([focusKey(host, `edit-${row.key}`)]);
  });
  tools.append(...moveButtons(host, c, row, rows), renameBtn, removeButton(host, c, row));
  box.append(grip(), make("h3", null, row.text), tools);
  return box;
}

/* ── A member's row ─────────────────────────────────────────────── */

function removeButton(host, c, row) {
  const name = nameOfRow(row);
  const b = make("button", "desk-item__delete", "Remove");
  b.type = "button";
  b.setAttribute("aria-label", `Remove ${name} from ${collectionName(c)}`);
  b.dataset.focusKey = focusKey(host, `remove-${row.key}`);
  b.addEventListener("click", async () => {
    const keys = neighbors(host, b);
    const plan = await writeCollection(host, c.id, (col) =>
      row.type === "record" ? removeItem(col, row.record.id, opCtx(host)) : removeMember(col, row.member.id, opCtx(host)),
    );
    const said = trouble(plan);
    if (said) {
      showNotice(said);
      return;
    }
    const entry = plan.changed ? host.store.lastEntry() : null;
    if (entry) showUndo(`${name} removed from ${collectionName(c)}.`, () => undoEntry(entry));
    host.refresh(keys);
  });
  return b;
}

/** "Leave it out of this collection": the bookmark's id goes into its rule's `except`, and any item for it goes. */
function leaveOutButton(host, c, row) {
  const name = nameOfRow(row);
  const b = make("button", "desk-item__delete", "Leave it out of this collection");
  b.type = "button";
  b.setAttribute("aria-label", `Leave ${name} out of ${collectionName(c)}`);
  b.dataset.focusKey = focusKey(host, `remove-${row.key}`);
  b.addEventListener("click", async () => {
    const keys = neighbors(host, b);
    let place = null;
    const plan = await writeCollection(host, c.id, (col, records) => {
      place = leftOutPlace(col, row.record.id);
      return leaveOut(col, row.record.id, records, opCtx(host));
    });
    const said = trouble(plan);
    if (said) {
      showNotice(said);
      return;
    }
    if (plan.changed && place) leftOutPlaces.set(`${c.id} ${row.record.id}`, place);
    const entry = plan.changed ? host.store.lastEntry() : null;
    if (entry) showUndo(`${name} left out of ${collectionName(c)}.`, () => undoEntry(entry));
    host.refresh(keys);
  });
  return b;
}

/** Where focus goes when a row is gone: the next row's Remove, else the previous one's. */
function neighbors(host, b) {
  const li = b.closest("[data-row-key]");
  const rows = [...(li?.closest(".collection-page__members")?.querySelectorAll("[data-row-key]") ?? [])];
  const at = rows.indexOf(li);
  return [rows[at + 1], rows[at - 1]]
    .filter(Boolean)
    .map((r) => focusKey(host, `remove-${r.dataset.rowKey}`))
    .concat(focusKey(host, "add"));
}

/**
 * ↑ and ↓ for a row of My order: the sheet editor's own icon buttons, with its
 * tip, and, as there, ↑ off on the first row and ↓ off on the last.
 */
function moveButtons(host, c, row, rows) {
  const name = nameOfRow(row);
  return [
    // The tip names the keys that do the same from anywhere in the row (E200).
    ["up", "↑", "Move up (Alt+↑)"],
    ["down", "↓", "Move down (Alt+↓)"],
  ].map(([where, glyph, tip]) => {
    const b = make("button", "desk-sheet__icon", glyph);
    b.type = "button";
    setTip(b, tip);
    b.disabled = !moveTarget(rows, row.key, where);
    b.setAttribute("aria-label", `Move ${name} ${where}`);
    b.dataset.focusKey = focusKey(host, `${where}-${row.key}`);
    b.addEventListener("click", () => move(host, c, row.key, where));
    return b;
  });
}

/** Move a row by one place (moveTarget, then moveRow), keeping focus on the control used. */
async function move(host, c, key, where, focus = null) {
  const plan = await writeCollection(host, c.id, (col, records) => {
    const to = moveTarget(collectionRows(col, records, { order: "mine" }).rows, key, where);
    return to ? moveRow(col, key, to.before, records, opCtx(host)) : col;
  });
  const said = trouble(plan);
  if (said) showNotice(said);
  // The row is brought into view where it lands (E200).
  host.refresh([focus ?? focusKey(host, `${where}-${key}`), focusKey(host, `${where === "up" ? "down" : "up"}-${key}`)], { reveal: true });
}

/**
 * A passage or record's row. A passage's words are read from its chapter once
 * the row is drawn. A row `nested` on a passage's sheet (E193) leaves out the
 * verse's words a passage or a bookmark would show, since the sheet shows
 * them; a highlight keeps its tinted words and a note its own.
 */
function memberRow(host, c, row, { labels, mine, rows, rules, nested = false }) {
  let li;
  if (row.type === "passage") {
    li = make("li", "desk-item desk-np-row");
    const href = recordHref(row.member);
    const ref = passageReference(row.member);
    const head = make(href ? "a" : "span", "desk-item__ref", ref);
    if (href) head.href = href;
    // In a pane a plain click moves the LIT pane there (decision 29).
    if (href && host.goHere?.can(row.member)) head.addEventListener("click", (e) => follow(e, () => host.goHere.go(row.member)));
    li.append(head, make("span", "desk-item__kind", "Passage"));
    if (!nested) li.append(wordsOf(host, row.member, row.key, ref, row.member.verseCopy));
    li.append(make("div", "desk-np-row__buttons"));
  } else {
    li = recordRow(row.record, { labels, onDelete: () => {}, onLabels: () => {}, goHere: host.goHere ?? null });
    // A collection's rows have Remove alone: the record itself is changed in My Notebook.
    li.querySelector(".desk-np-row__buttons")?.replaceChildren();
    if (row.record.kind === "bookmark" && Number.isInteger(row.record.verse) && !nested) {
      li.append(wordsOf(host, row.record, row.key, recordReference(row.record), row.record.quote?.exact));
    }
    // A pinned footnote is cut at three lines with My Notes' caret (E199),
    // where My Notebook's list shows it whole.
    const pin = row.record.kind === "footnotePin" ? li.querySelector(".desk-np-row__pin") : null;
    if (pin) {
      const ref = recordReference(row.record);
      pin.classList.remove("desk-np-row__pin");
      cutRow(host, pin, `pin:${row.key}`, `the pinned footnote${ref ? ` on ${ref}` : ""}`).measure();
    }
  }
  li.dataset.rowKey = row.key;
  // The buttons come right after the kind, before the words, so the order a
  // keyboard takes is the order a narrow pane shows them in (decision 35: the
  // kind with its buttons, then the words), and a wide row's reading order:
  // the reference, the buttons beside it, then what lies under them.
  const tools = li.querySelector(".desk-np-row__buttons");
  li.querySelector(".desk-item__kind")?.after(tools);
  if (mine) {
    li.prepend(grip());
    tools.append(...moveButtons(host, c, row, rows));
  }
  // A bookmark a rule brings in says so, and is left out rather than removed (D13, step 5).
  const ruled = row.type === "record" ? rules.find((info) => info.member === row.rule) : null;
  if (ruled) {
    li.querySelector(".desk-item__kind")?.append(` · from ${ruled.label?.name ?? "a label"}`);
    tools.append(leaveOutButton(host, c, row));
  } else if (row.type !== "record" || row.member) tools.append(removeButton(host, c, row));
  return li;
}

/**
 * The words of `where` (a passage, or a bookmark's verse) as a scripture page
 * sets them (E171; BVJ, 2026-11-19): paragraphs and poetry lines, italics and
 * verse numbers, with no footnote letters, in a sheet passage's look
 * (`.desk-sheet__words`). Until its chapter is read, and if it can't be, the
 * copy kept with it shows as one plain paragraph. Past three lines the words
 * are cut, with the caret a pinned footnote has (`.desk-item__pin-row`,
 * `.desk-item__more`); shown only when they are cut or open, and kept open
 * for the visit. On paper they are always whole (v2/collections.css).
 */
function wordsOf(host, where, key, ref, fallback = null) {
  const box = make("div", "desk-sheet__words chapter-paragraphs");
  const { row, measure } = cutRow(host, box, key, ref);

  const show = (words) => {
    if (words instanceof Element) box.replaceChildren(...words.cloneNode(true).childNodes);
    else box.replaceChildren(make("p", null, String(words).replace(/\s+/g, " ").trim()));
    measure();
  };
  if (fallback) show(fallback);
  const unread = () => {
    if (!fallback) show(UNREAD);
  };
  host.passageText(where).then((words) => (words ? show(words) : unread()), unread);
  return row;
}

/**
 * Words cut at three lines with the caret a pinned footnote has in My Notes
 * (`.desk-item__pin-row`, `.desk-item__more`; E118): `box` goes in the row,
 * taking its place if it already has one, and the caret shows only while the
 * words are cut or open, opening them for the visit (`host.openWords`, by
 * `key`). `label` names what the caret opens. Resolves to `{ row, measure }`;
 * `measure` checks the cut again, and runs whenever the words' box resizes.
 */
function cutRow(host, box, key, label) {
  const row = make("div", "desk-item__pin-row");
  const more = make("button", "desk-item__more");
  more.type = "button";
  more.hidden = true;
  more.innerHTML = ICON_CARET;
  box.replaceWith?.(row);
  row.append(box, more);

  const measure = () =>
    requestAnimationFrame(() => {
      const open = host.openWords.has(key);
      const cut = !open && box.scrollHeight > box.clientHeight + 1;
      row.classList.toggle("desk-item__pin-row--cut", cut);
      more.hidden = !(open || cut);
    });
  const sync = () => {
    const open = host.openWords.has(key);
    row.classList.toggle("desk-item__pin-row--open", open);
    more.setAttribute("aria-expanded", String(open));
    more.setAttribute("aria-label", `${open ? "Show less of" : "Show all of"} ${label}`);
  };
  more.addEventListener("click", () => {
    if (host.openWords.has(key)) host.openWords.delete(key);
    else host.openWords.add(key);
    sync();
    measure();
  });
  sync();
  measures.set(box, measure);
  resized?.observe(box);
  return { row, measure };
}

/* ── Moving a row: drag, and Alt+Up and Alt+Down ────────────────── */

function wireMoves(host, c, sheet) {
  let dragging = null;
  const marker = make("div", "desk-sheet__drop");
  marker.setAttribute("aria-hidden", "true");
  const rows = () => [...sheet.querySelectorAll("[data-row-key]")].filter((r) => r.dataset.rowKey !== dragging);
  /** The row the pointer is above, or null for the end. */
  const before = (y) =>
    rows().find((r) => {
      const box = r.getBoundingClientRect();
      return y < box.top + box.height / 2;
    }) ?? null;
  // Only a press on the grip makes a row draggable, so text in a row selects as usual.
  sheet.addEventListener("pointerdown", (e) => {
    const row = e.target.closest?.(".desk-sheet__grip")?.closest("[data-row-key]");
    if (!row) return;
    row.draggable = true;
    document.addEventListener("pointerup", () => (row.draggable = false), { once: true });
  });
  sheet.addEventListener("dragstart", (e) => {
    const row = e.target.closest?.("[data-row-key]");
    if (!row || !row.draggable) return;
    dragging = row.dataset.rowKey;
    row.classList.add("is-dragging");
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", row.dataset.rowKey);
    }
  });
  sheet.addEventListener("dragover", (e) => {
    if (!dragging) return;
    e.preventDefault();
    const at = before(e.clientY);
    if (at) at.parentNode.insertBefore(marker, at);
    else sheet.append(marker);
  });
  const end = () => {
    marker.remove();
    sheet.querySelector(".is-dragging")?.classList.remove("is-dragging");
    dragging = null;
  };
  sheet.addEventListener("dragend", end);
  sheet.addEventListener("drop", async (e) => {
    if (!dragging) return;
    e.preventDefault();
    const key = dragging;
    const at = before(e.clientY)?.dataset.rowKey ?? null;
    end();
    const plan = await writeCollection(host, c.id, (col, records) => moveRow(col, key, at, records, opCtx(host)));
    const said = trouble(plan);
    if (said) showNotice(said);
    host.refresh([focusKey(host, `up-${key}`), focusKey(host, `down-${key}`)], { reveal: true });
  });
  // The keyboard's way, beside the buttons: Alt+Up and Alt+Down on a row's control.
  sheet.addEventListener("keydown", (e) => {
    if (!e.altKey || e.ctrlKey || e.metaKey || e.shiftKey || (e.key !== "ArrowUp" && e.key !== "ArrowDown")) return;
    // A gap's pill belongs to the space under a row, not to the row.
    if (e.target.closest?.(".desk-sheet__after")) return;
    const row = e.target.closest?.("[data-row-key]");
    if (!row) return;
    e.preventDefault();
    const focus = e.target.closest?.("[data-focus-key]")?.dataset.focusKey ?? null;
    move(host, c, row.dataset.rowKey, e.key === "ArrowUp" ? "up" : "down", focus);
  });
}
