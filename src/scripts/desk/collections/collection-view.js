// src/scripts/desk/collections/collection-view.js
//
// One collection on /collections/?id=<id> (STUDY-DESK.md, D13, mock part b):
// "‹ My collections", its name and description, its actions (Add passage…,
// Make a sheet, Add to sheet…, Rename…, Print, Delete), the order switch, and its members on a Site 2.0
// sheet as the desk's own rows (record-rows.js, as My Notebook draws them).
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
// The page object (collection-page.js) hands in what a view needs: `store`,
// `ctx`, `base`, `refresh(focusKeys)`, `go(href)`, `follow(event, href)`,
// `viewState(id)`, `chapterText` (a chapter's anchor text, for checking a
// typed reference), `passageText` (a passage's words), and `parse` (the
// reference reader). A test replaces the last three.

import { labelMap } from "../../../lib/desk-labels.mjs";
import { COLLECTION_ORDERS, collectionTooBig } from "../../../lib/desk-collection-format.mjs";
import {
  addHeading,
  collectionName,
  collectionRows,
  bringBack,
  editHeading,
  leaveOut,
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
import { makeSheetFromCollection, openAddToSheet } from "./collection-sheet.js";
import { openNameWindow } from "./name-window.js";

const button = buttons("desk-sheet__btn");

const ORDER_NAMES = { bible: "Bible order", type: "By type", mine: "My order" };
const FAILED = "That couldn’t be saved in this browser, so nothing changed. Try again.";
const FULL = "This collection is full, so nothing was added.";
const UNREAD = "These verses couldn’t be read just now.";

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
export async function writePlan(page, plan) {
  let made = null;
  try {
    await page.store.change(async ({ all }) => {
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
export const writeCollection = (page, id, op) =>
  writePlan(page, (records) => planCollectionChange(records, id, (c) => op(c, records)));

const opCtx = (page) => ({ now: new Date().toISOString(), ...page.ctx() });

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
export async function collectionView(page, id) {
  const records = await page.store.all();
  const c = records.find((r) => r?.id === id && r.kind === "collection");
  const back = make("a", "sheets-page__back", "‹ My collections");
  back.href = `${page.base}collections/`;
  back.dataset.focusKey = "back";
  back.addEventListener("click", (e) => page.follow(e, back.href));
  if (!c) {
    const title = make("h1", "sheets-page__title", "Collection not found");
    const note = make("p", "desk-np__intro", "This collection isn’t in this browser’s notebook. It may have been deleted.");
    return { nodes: [back, title, note], title: "Collection not found | Liberation and Inclusion Translation", focus: title };
  }
  const name = collectionName(c);
  const shown = collectionRows(c, records);
  const state = page.viewState(id);
  const title = make("h1", "sheets-page__title", name);
  title.dataset.focusKey = "title";
  const nodes = [back, title];
  if (c.description) nodes.push(make("p", "desk-np__intro collection-page__description", c.description));

  /* ── Actions ──────────────────────────────────────────────────── */
  const actions = make("div", "collection-page__actions");
  // The page's one primary button (E126): adding is what the page is for (BVJ, 2026-11-19).
  const add = button("Add passage…", "desk-sheet__btn desk-sheet__btn--primary");
  add.dataset.focusKey = "add";
  add.setAttribute("aria-expanded", String(state.adding));
  const makeSheet = button("Make a sheet");
  makeSheet.dataset.focusKey = "make-sheet";
  makeSheet.title = "Put this collection on a new sheet";
  const toSheet = button("Add to sheet…");
  toSheet.dataset.focusKey = "add-to-sheet";
  toSheet.setAttribute("aria-haspopup", "dialog");
  const rename = button("Rename…");
  rename.dataset.focusKey = "rename";
  const print = button("Print");
  print.dataset.focusKey = "print";
  const del = button("Delete");
  del.dataset.focusKey = "delete";
  del.setAttribute("aria-label", `Delete ${name}`);
  actions.append(add, makeSheet, toSheet, rename, print, del);
  nodes.push(actions);

  const form = passageForm(page, c, state);
  form.hidden = !state.adding;
  nodes.push(form);
  add.addEventListener("click", () => {
    state.adding = !state.adding;
    form.hidden = !state.adding;
    add.setAttribute("aria-expanded", String(state.adding));
    if (state.adding) form.querySelector("input")?.focus();
  });

  makeSheet.addEventListener("click", async () => {
    makeSheet.disabled = true;
    try {
      await makeSheetFromCollection({ store: page.store, ctx: page.ctx, collectionId: id, chapterText: page.chapterText });
    } finally {
      makeSheet.disabled = false;
    }
  });

  toSheet.addEventListener("click", () => {
    const at = toSheet.getBoundingClientRect();
    openAddToSheet({
      store: page.store,
      ctx: page.ctx,
      collection: c,
      chapterText: page.chapterText,
      near: { left: at.left, top: at.bottom + 8 },
      back: () => document.querySelector('[data-focus-key="add-to-sheet"]'),
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
      back: () => document.querySelector('[data-focus-key="rename"]'),
      onSubmit: async ({ name: n, description }) => {
        const plan = await writeCollection(page, id, (col) => setCollectionFields(col, { name: n, description }, opCtx(page)));
        const said = trouble(plan);
        if (said) return said;
        const entry = plan.changed ? page.store.lastEntry() : null;
        // Say what changed: the window holds the description too.
        const renamed = (n ?? "").trim() !== (c.name ?? "").trim();
        if (entry) showUndo(renamed ? "Collection renamed." : "Description saved.", () => undoEntry(entry));
        page.refresh(["rename"]);
        return null;
      },
    });
  });

  print.addEventListener("click", () => window.print());

  del.addEventListener("click", async () => {
    let trash = null;
    try {
      trash = await page.store.remove(id);
    } catch (err) {
      console.error("Study Desk: couldn’t delete a collection", err);
      showNotice("The collection couldn’t be deleted in this browser. Try again in a moment.");
      return;
    }
    const entry = trash ? page.store.lastEntry() : null;
    if (entry) showUndo(`${name} deleted.`, () => undoEntry(entry));
    page.go(`${page.base}collections/`);
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
    input.name = "collection-order";
    input.value = order;
    input.checked = order === shown.order;
    if (input.checked) input.dataset.focusKey = "order";
    input.addEventListener("change", async () => {
      if (!input.checked) return;
      const plan = await writeCollection(page, id, (col) => setOrder(col, order, opCtx(page)));
      const said = trouble(plan);
      if (said) showNotice(said);
      page.refresh(["order"]);
    });
    label.append(input, make("span", "desk-seg__text", ORDER_NAMES[order]));
    seg.append(label);
  }
  bar.append(seg);
  const mine = shown.order === "mine";
  nodes.push(bar);
  if (mine) {
    const heading = button("Add a heading");
    heading.dataset.focusKey = "heading";
    heading.setAttribute("aria-expanded", String(state.heading));
    bar.append(heading);
    const hform = headingForm(page, c, state);
    hform.hidden = !state.heading;
    heading.addEventListener("click", () => {
      state.heading = !state.heading;
      hform.hidden = !state.heading;
      heading.setAttribute("aria-expanded", String(state.heading));
      if (state.heading) hform.querySelector("input")?.focus();
    });
    nodes.push(hform);
  }

  /* ── The rules' lines ─────────────────────────────────────────── */
  for (const info of shown.rules) nodes.push(ruleLine(page, c, info));

  /* ── The members ──────────────────────────────────────────────── */
  const sheet = make("div", `v2-sheet collection-page__sheet${mine ? " collection-page__sheet--mine" : ""}`);
  if (!shown.rows.length) {
    sheet.append(make("p", "desk-sheet__empty", "Nothing in this collection yet. Add a passage with the button above."));
  }
  const labels = labelMap(records);
  let ul = null;
  // In Bible order the sheets come first, and a label names where the verses begin.
  let byVerse = shown.order === "bible" && shown.rows[0]?.type === "group";
  for (const row of shown.rows) {
    if (row.type === "group") {
      ul = null;
      sheet.append(make("p", "v2-label collection-page__group", row.title));
      continue;
    }
    if (byVerse && !(row.type === "record" && row.record.kind === "sheet")) {
      byVerse = false;
      ul = null;
      sheet.append(make("p", "v2-label collection-page__group", "By verse"));
    }
    if (row.type === "heading") {
      ul = null;
      sheet.append(headingRow(page, c, row, state, shown.rows));
      continue;
    }
    if (!ul) {
      ul = make("ul", "desk-list");
      sheet.append(ul);
    }
    ul.append(memberRow(page, c, row, { labels, mine, rows: shown.rows, rules: shown.rules }));
  }
  if (mine) wireMoves(page, c, sheet);
  nodes.push(sheet);
  return { nodes, title: `${name} | Liberation and Inclusion Translation`, focus: title };
}

/* ── A rule's line ──────────────────────────────────────────────── */

/**
 * "Every bookmark labeled Advent · 12 · 1 left out (John 1:5). Bring it back ·
 * Stop adding new ones · Remove": a plain line with quiet links, one per rule
 * (decision 25). A rule whose label is gone says so, and can only be removed.
 */
function ruleLine(page, c, info) {
  const line = make("p", "desk-np__intro collection-page__rule");
  const id = info.member.id;
  const where = collectionName(c);
  const link = (text, key, label, run) => {
    const b = make("button", "desk-item__stop", text);
    b.type = "button";
    b.dataset.focusKey = key;
    b.setAttribute("aria-label", label);
    b.addEventListener("click", run);
    return b;
  };
  const write = async (op, said, focus = ["add"]) => {
    const plan = await writeCollection(page, c.id, op);
    const problem = trouble(plan);
    if (problem) {
      showNotice(problem);
      return;
    }
    const entry = plan.changed ? page.store.lastEntry() : null;
    if (entry) showUndo(said, () => undoEntry(entry));
    page.refresh(focus);
  };
  const remove = (label) =>
    link("Remove", `rule-remove-${id}`, `Remove the rule “${label}” from ${where}`, () =>
      write((col) => removeRule(col, id, opCtx(page)), `The rule “${label}” was removed from ${where}. Bookmarks added by hand stay.`),
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
          write((col) => bringBack(col, b.id, opCtx(page)), `${ref} brought back into ${where}.`, [`rule-stop-${id}`, "add"]),
        ),
      );
    }
  }
  line.append(
    " · ",
    link("Stop adding new ones", `rule-stop-${id}`, `Stop adding new bookmarks labeled ${label} to ${where}`, () =>
      write(
        (col, records) => ruleToItems(col, id, records, opCtx(page)),
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

/* ── Add passage… ───────────────────────────────────────────────── */

function passageForm(page, c, state) {
  const form = make("form", "desk-sheet__ref");
  const input = make("input");
  input.type = "text";
  input.placeholder = "A reference, such as John 3:16–18";
  input.setAttribute("aria-label", "Passage to add");
  input.dataset.focusKey = "add-input";
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
  wrap.append(form, problem, note);
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    note.hidden = true;
    const typed = input.value.replace(/[–—]/g, "-");
    const ref = page.parse(typed);
    if (!ref) {
      problem.textContent =
        describeRefusal(typed, { parse: page.parse, label: bookKeyToLabel }) ??
        "That isn’t a reference the LIT can read. Try a book, a chapter, and verses, such as Romans 5:6–10.";
      return;
    }
    problem.textContent = "";
    const chapter = await page.chapterText(ref.bookKey, ref.chapter);
    const found = passageForReference(chapter, ref, page.ctx().contentVersion);
    if (found.problem) {
      problem.textContent = found.problem;
      return;
    }
    const where = passageReference(found.fields);
    const plan = await writePlan(page, (records) => planAddPassage(records, c.id, found.fields, opCtx(page)));
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
    const entry = page.store.lastEntry();
    state.typed = "";
    input.value = "";
    showUndo(`${where} added to ${collectionName(c)}.`, () => undoEntry(entry));
    page.refresh(["add-input"]);
  });
  return wrap;
}

/* ── Headings (My order) ────────────────────────────────────────── */

function headingForm(page, c, state) {
  // Wrapped as Add passage’s field is: .desk-sheet__ref is a flex row, which `hidden` alone can’t close.
  const wrap = make("div", "collection-page__form");
  const form = make("form", "desk-sheet__ref");
  const input = make("input");
  input.type = "text";
  input.placeholder = "A heading, such as Week 1: Hope";
  input.setAttribute("aria-label", "Heading to add");
  input.maxLength = 200;
  input.dataset.focusKey = "heading-input";
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
    const plan = await writeCollection(page, c.id, (col, records) => addHeading(col, text, null, records, opCtx(page)));
    const said = trouble(plan);
    if (said) {
      showNotice(said);
      return;
    }
    const entry = page.store.lastEntry();
    state.headingText = "";
    showUndo(`Heading “${text}” added.`, () => undoEntry(entry));
    page.refresh(["heading-input"]);
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
function headingRow(page, c, row, state, rows) {
  const box = make("div", "collection-page__heading v2-rule");
  box.dataset.rowKey = row.key;
  if (state.editing === row.key) {
    const form = make("form", "desk-sheet__ref");
    const input = make("input");
    input.type = "text";
    input.value = row.text;
    input.maxLength = 200;
    input.setAttribute("aria-label", "Heading");
    input.dataset.focusKey = `edit-${row.key}`;
    const save = make("button", "desk-item__edit", "Save");
    save.type = "submit";
    const cancel = make("button", "desk-item__edit", "Cancel");
    cancel.type = "button";
    cancel.addEventListener("click", () => {
      state.editing = null;
      page.refresh([`rename-${row.key}`]);
    });
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const text = input.value.trim();
      state.editing = null;
      if (text !== row.text) {
        const plan = await writeCollection(page, c.id, (col) => editHeading(col, row.member.id, text, opCtx(page)));
        const said = trouble(plan);
        if (said) showNotice(said);
        else if (plan.changed) {
          const entry = page.store.lastEntry();
          showUndo("Heading changed.", () => undoEntry(entry));
        }
      }
      page.refresh([`rename-${row.key}`]);
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
  renameBtn.dataset.focusKey = `rename-${row.key}`;
  renameBtn.addEventListener("click", () => {
    state.editing = row.key;
    page.refresh([`edit-${row.key}`]);
  });
  tools.append(...moveButtons(page, c, row, rows), renameBtn, removeButton(page, c, row));
  box.append(grip(), make("h3", null, row.text), tools);
  return box;
}

/* ── A member's row ─────────────────────────────────────────────── */

function removeButton(page, c, row) {
  const name = nameOfRow(row);
  const b = make("button", "desk-item__delete", "Remove");
  b.type = "button";
  b.setAttribute("aria-label", `Remove ${name} from ${collectionName(c)}`);
  b.dataset.focusKey = `remove-${row.key}`;
  b.addEventListener("click", async () => {
    const keys = neighbors(b);
    const plan = await writeCollection(page, c.id, (col) =>
      row.type === "record" ? removeItem(col, row.record.id, opCtx(page)) : removeMember(col, row.member.id, opCtx(page)),
    );
    const said = trouble(plan);
    if (said) {
      showNotice(said);
      return;
    }
    const entry = plan.changed ? page.store.lastEntry() : null;
    if (entry) showUndo(`${name} removed from ${collectionName(c)}.`, () => undoEntry(entry));
    page.refresh(keys);
  });
  return b;
}

/** "Leave it out of this collection": the bookmark's id goes into its rule's `except`, and any item for it goes. */
function leaveOutButton(page, c, row) {
  const name = nameOfRow(row);
  const b = make("button", "desk-item__delete", "Leave it out of this collection");
  b.type = "button";
  b.setAttribute("aria-label", `Leave ${name} out of ${collectionName(c)}`);
  b.dataset.focusKey = `remove-${row.key}`;
  b.addEventListener("click", async () => {
    const keys = neighbors(b);
    const plan = await writeCollection(page, c.id, (col, records) => leaveOut(col, row.record.id, records, opCtx(page)));
    const said = trouble(plan);
    if (said) {
      showNotice(said);
      return;
    }
    const entry = plan.changed ? page.store.lastEntry() : null;
    if (entry) showUndo(`${name} left out of ${collectionName(c)}.`, () => undoEntry(entry));
    page.refresh(keys);
  });
  return b;
}

/** Where focus goes when a row is gone: the next row's Remove, else the previous one's. */
function neighbors(b) {
  const li = b.closest("[data-row-key]");
  const rows = [...(li?.closest(".collection-page__sheet")?.querySelectorAll("[data-row-key]") ?? [])];
  const at = rows.indexOf(li);
  return [rows[at + 1], rows[at - 1]].filter(Boolean).map((r) => `remove-${r.dataset.rowKey}`).concat("add");
}

/**
 * ↑ and ↓ for a row of My order: the sheet editor's own icon buttons, with its
 * tip, and, as there, ↑ off on the first row and ↓ off on the last.
 */
function moveButtons(page, c, row, rows) {
  const name = nameOfRow(row);
  return [
    ["up", "↑", "Move up"],
    ["down", "↓", "Move down"],
  ].map(([where, glyph, tip]) => {
    const b = make("button", "desk-sheet__icon", glyph);
    b.type = "button";
    setTip(b, tip);
    b.disabled = !moveTarget(rows, row.key, where);
    b.setAttribute("aria-label", `Move ${name} ${where}`);
    b.dataset.focusKey = `${where}-${row.key}`;
    b.addEventListener("click", () => move(page, c, row.key, where));
    return b;
  });
}

/** Move a row by one place (moveTarget, then moveRow), keeping focus on the control used. */
async function move(page, c, key, where, focus = null) {
  const plan = await writeCollection(page, c.id, (col, records) => {
    const to = moveTarget(collectionRows(col, records, { order: "mine" }).rows, key, where);
    return to ? moveRow(col, key, to.before, records, opCtx(page)) : col;
  });
  const said = trouble(plan);
  if (said) showNotice(said);
  page.refresh([focus ?? `${where}-${key}`, `${where === "up" ? "down" : "up"}-${key}`]);
}

/** A passage or record's row. A passage's words are read from its chapter once the row is drawn. */
function memberRow(page, c, row, { labels, mine, rows, rules }) {
  let li;
  if (row.type === "passage") {
    li = make("li", "desk-item desk-np-row");
    const href = recordHref(row.member);
    const head = make(href ? "a" : "span", "desk-item__ref", passageReference(row.member));
    if (href) head.href = href;
    const words = make("p", "desk-item__words");
    li.append(head, make("span", "desk-item__kind", "Passage"), words, make("div", "desk-np-row__buttons"));
    fillWords(page, row.member, words, row.member.verseCopy);
  } else {
    li = recordRow(row.record, { labels, onDelete: () => {}, onLabels: () => {} });
    // A collection's rows have Remove alone: the record itself is changed in My Notebook.
    const tools = li.querySelector(".desk-np-row__buttons");
    tools?.replaceChildren();
    if (row.record.kind === "bookmark" && Number.isInteger(row.record.verse)) {
      const quote = make("blockquote", "desk-np-row__quote");
      tools?.before(quote);
      fillWords(page, row.record, quote, row.record.quote?.exact);
    }
  }
  li.dataset.rowKey = row.key;
  const tools = li.querySelector(".desk-np-row__buttons");
  if (mine) {
    li.prepend(grip());
    tools.append(...moveButtons(page, c, row, rows));
  }
  // A bookmark a rule brings in says so, and is left out rather than removed (D13, step 5).
  const ruled = row.type === "record" ? rules.find((info) => info.member === row.rule) : null;
  if (ruled) {
    li.querySelector(".desk-item__kind")?.append(` · from ${ruled.label?.name ?? "a label"}`);
    tools.append(leaveOutButton(page, c, row));
  } else if (row.type !== "record" || row.member) tools.append(removeButton(page, c, row));
  return li;
}

/** Put the words of `where` (a passage, or a record on verses) in `box`: its chapter's, else the copy kept with it. */
function fillWords(page, where, box, fallback = null) {
  const clean = (s) => String(s ?? "").replace(/\s+/g, " ").trim();
  if (fallback) box.textContent = clean(fallback);
  const unread = () => {
    if (!fallback) box.textContent = UNREAD;
  };
  page.passageText(where).then((words) => (words ? (box.textContent = clean(words)) : unread()), unread);
}

/* ── Moving a row: drag, and Alt+Up and Alt+Down ────────────────── */

function wireMoves(page, c, sheet) {
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
    const plan = await writeCollection(page, c.id, (col, records) => moveRow(col, key, at, records, opCtx(page)));
    const said = trouble(plan);
    if (said) showNotice(said);
    page.refresh([`up-${key}`, `down-${key}`]);
  });
  // The keyboard's way, beside the buttons: Alt+Up and Alt+Down on a row's control.
  sheet.addEventListener("keydown", (e) => {
    if (!e.altKey || e.ctrlKey || e.metaKey || e.shiftKey || (e.key !== "ArrowUp" && e.key !== "ArrowDown")) return;
    const row = e.target.closest?.("[data-row-key]");
    if (!row) return;
    e.preventDefault();
    const focus = e.target.closest?.("[data-focus-key]")?.dataset.focusKey ?? null;
    move(page, c, row.dataset.rowKey, e.key === "ArrowUp" ? "up" : "down", focus);
  });
}
