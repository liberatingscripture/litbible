// src/scripts/desk/collections/collection-sheet.js
//
// A collection onto a sheet (D13, step 7): a collection's "Add to sheet…" and
// that window's "New sheet" row, which
// makes a sheet of the whole collection (`makeSheetFromCollection`; the
// "Make a sheet" button beside it went with decision 36, BVJ 2026-11-19). The
// rules, and what each part becomes, are
// src/lib/desk-collection-sheet.mjs; this reads the chapters, makes the one
// change and says what happened on the undo bar, in Add to sheet's words
// (sheets/sheet-add.js) with its "Open the sheet" link.
//
// Both read the collection's chapters first (`readChapters`), then run
// `collectionSheetParts` inside the one `store.change` that writes, over the
// notebook (and the sheet) as that transaction reads them, so a part another
// tab added meanwhile isn't added twice, and one Ctrl+Z takes it all back.
// "Add to sheet…" opens E154's pick window (a page button has no menu to open
// a flyout from, so this is the same list as "All sheets…"), with its action
// row "New sheet".

import {
  chapterKey,
  collectionChapters,
  collectionSheetParts,
  skippedSheetsNote,
} from "../../../lib/desk-collection-sheet.mjs";
import { collectionName } from "../../../lib/desk-collections.mjs";
import { SHEET_LIMITS } from "../../../lib/desk-sheet-format.mjs";
import { addableSheets } from "../../../lib/desk-sheet-add.mjs";
import { passageInsertIndex } from "../../../lib/desk-sheet-passages.mjs";
import { addModule, createSheet, planSheetChange, sheetTooBig } from "../../../lib/desk-sheets.mjs";
import { undoEntry } from "../history.js";
import { openPickWindow } from "../pick-window.js";
import { showNotice, showUndo } from "../undo-bar.js";
import { dateWords, plural } from "../desk-text.js";

const BASE = String(import.meta.env.BASE_URL || "/").replace(/\/?$/, "/");

/** The pick window's rows: each sheet's name, and when it was last changed. */
const pickItems = (list) =>
  list.map((s) => ({ id: s.id, name: s.name, detail: s.modified && dateWords(s.modified) ? `Changed ${dateWords(s.modified)}` : "" }));

/**
 * The chapters a collection's parts need, each read once: a Map keyed by
 * `chapterKey`, the value null where a chapter couldn't be read (its passages
 * are then made without a comparison copy).
 *
 * @param {object} collection
 * @param {object[]} records the notebook
 * @param {(bookKey: string, chapter: number) => Promise<object | null>} chapterText
 */
export async function readChapters(collection, records, chapterText) {
  const out = new Map();
  for (const { bookKey, chapter } of collectionChapters(collection, records)) {
    try {
      out.set(chapterKey(bookKey, chapter), await chapterText(bookKey, chapter));
    } catch (_) {
      out.set(chapterKey(bookKey, chapter), null);
    }
  }
  return out;
}

/** What the bar adds to its words about members that weren't put on the sheet. */
export function extras(result, { full = false } = {}) {
  const bits = [];
  if (result.leftOut > 0) {
    bits.push(`${plural(result.leftOut, "item")} ${result.leftOut === 1 ? "wasn’t" : "weren’t"} added; ${full ? "the sheet was full" : "they didn’t fit the sheet"}.`);
  }
  const skipped = skippedSheetsNote(result.skippedSheets.length);
  if (skipped) bits.push(skipped);
  return bits.length ? ` ${bits.join(" ")}` : "";
}

const openLink = (id) => ({ label: "Open the sheet", href: `${BASE}sheets/?id=${encodeURIComponent(id)}` });

/** The notice for a collection that puts nothing on the sheet. */
export function nothingAdded(name, sheetName, result) {
  const where = sheetName === null ? "" : ` “${sheetName}”`;
  const why =
    result.alreadyOn > 0 && result.leftOut === 0
      ? sheetName === null
        ? `Everything in ${name} that can go on a sheet is on one already.`
        : `Everything in ${name} that can go on a sheet is on${where} already.`
      : `${name} has nothing to put on a sheet yet.`;
  return `${why} Nothing was ${sheetName === null ? "made" : "added"}.${extras(result)}`;
}

/**
 * "New sheet" in Add to sheet…'s window: a new sheet named after the
 * collection, holding its parts.
 * Resolves to "made", "nothing" (nothing makes a part; nothing is written) or
 * "failed" (the reader has been told why).
 *
 * @param {{ store: object, ctx: () => object, collectionId: string, chapterText: Function }} options
 */
export async function makeSheetFromCollection({ store, ctx, collectionId, chapterText }) {
  let result = null;
  let name = "That collection";
  let made = null;
  let why = null;
  try {
    const first = await store.all();
    const c = first.find((r) => r?.id === collectionId && r.kind === "collection");
    if (c) name = collectionName(c);
    const chapters = c ? await readChapters(c, first, chapterText) : new Map();
    await store.change(async ({ all }) => {
      const records = await all();
      const col = records.find((r) => r?.id === collectionId && r.kind === "collection" && !r.deleted);
      if (!col) {
        why = "gone";
        return null;
      }
      name = collectionName(col);
      const { contentVersion } = ctx();
      result = collectionSheetParts(col, records, null, { chapters, contentVersion });
      if (!result.parts.length) return null;
      const title = [...name].slice(0, SHEET_LIMITS.title).join("");
      made = createSheet({ title, template: "blank", modules: result.parts }, { now: new Date().toISOString(), ...ctx() });
      return { put: [made], remove: [] };
    });
  } catch (err) {
    if (!sheetTooBig(err)) console.error("Study Desk: the collection couldn’t be made into a sheet", err);
    why = sheetTooBig(err) ? "big" : "failed";
  }
  if (why === "gone") {
    showNotice("That collection couldn’t be read. It may have been deleted. Nothing was made.");
    return "failed";
  }
  if (why) {
    showNotice(
      why === "big"
        ? `${name} is too big for one sheet, so nothing was made.`
        : "The sheet couldn’t be made. Nothing was changed. Try again in a moment.",
    );
    return "failed";
  }
  if (!made) {
    showNotice(nothingAdded(name, null, result));
    return "nothing";
  }
  const entry = store.lastEntry();
  showUndo(`${name} is on a new sheet.${extras(result, { full: result.limit === "parts" })}`, () => undoEntry(entry), { link: openLink(made.id) });
  return "made";
}

/**
 * Add the collection's parts to the sheet `sheetId`, where a passage added
 * from outside goes (after the sheet's last passage, else under its reading
 * part), as one block in one change. Resolves to "added", "nothing" or
 * "failed".
 *
 * @param {{ store: object, ctx: () => object, collectionId: string, sheetId: string, sheetName?: string, chapterText: Function }} options
 */
export async function addCollectionToSheet({ store, ctx, collectionId, sheetId, sheetName = "That sheet", chapterText }) {
  let result = null;
  let sheet = null;
  let name = "That collection";
  let why = null;
  let changed = false;
  try {
    const first = await store.all();
    const c = first.find((r) => r?.id === collectionId && r.kind === "collection");
    if (c) name = collectionName(c);
    const chapters = c ? await readChapters(c, first, chapterText) : new Map();
    await store.change(async ({ all, get }) => {
      const records = await all();
      const col = records.find((r) => r?.id === collectionId && r.kind === "collection" && !r.deleted);
      if (!col) {
        why = "gone-collection";
        return null;
      }
      name = collectionName(col);
      const current = await get(sheetId);
      const opCtx = { now: new Date().toISOString(), ...ctx() };
      const { contentVersion } = opCtx;
      const plan = planSheetChange(current, (s) => {
        result = collectionSheetParts(col, records, s, { chapters, contentVersion });
        if (!result.parts.length) return s;
        let at = passageInsertIndex(s);
        return result.parts.reduce((acc, m) => addModule(acc, m, at++, opCtx), s);
      });
      if (plan.gone) {
        why = "gone-sheet";
        return null;
      }
      if (plan.refused) {
        why = sheetTooBig(plan.refused) ? "full" : "failed";
        return null;
      }
      sheet = plan.sheet;
      changed = plan.changed;
      return plan.changed ? plan : null;
    });
  } catch (err) {
    console.error("Study Desk: the collection couldn’t be added to the sheet", err);
    why = "failed";
  }
  if (why) {
    showNotice(
      why === "gone-collection"
        ? "That collection couldn’t be read. It may have been deleted. Nothing was added."
        : why === "gone-sheet"
          ? `“${sheetName}” couldn’t be changed. It may have been deleted. Nothing was added.`
          : why === "full"
            ? `“${sheetName}” is full, so nothing was added.`
            : "The collection couldn’t be added. Nothing was changed. Try again in a moment.",
    );
    return "failed";
  }
  if (!changed) {
    showNotice(nothingAdded(name, sheetName, result), { link: openLink(sheetId) });
    return "nothing";
  }
  const entry = store.lastEntry();
  showUndo(`${name} added to “${sheetName}.”${extras(result, { full: true })}`, () => undoEntry(entry), { link: openLink(sheetId) });
  return "added";
}

/**
 * "Add to sheet…": E154's pick window over every sheet that can take parts,
 * newest change first, with "New sheet" as its action row. `near` is where
 * the button was, `back` where focus goes when the window closes.
 *
 * @param {{ store: object, ctx: () => object, collection: object, chapterText: Function,
 *   near?: { left: number, top: number } | null, back?: Function | HTMLElement | null }} options
 */
export async function openAddToSheet({ store, ctx, collection, chapterText, near = null, back = null }) {
  let sheets = [];
  try {
    sheets = addableSheets(await store.byKind("sheet"));
  } catch (err) {
    console.error("Study Desk: couldn’t read the sheets", err);
  }
  const name = collectionName(collection);
  const collectionId = collection.id;
  return openPickWindow({
    heading: "Add to sheet",
    title: "Choose a sheet",
    lead: `Choose the sheet for ${name}.`,
    noun: ["sheet", "sheets"],
    items: pickItems(sheets),
    near,
    back,
    // The one way to make a sheet of a collection (D13, decision 36).
    action: { label: "New sheet", onPress: () => makeSheetFromCollection({ store, ctx, collectionId, chapterText }) },
    onPick: (item) => addCollectionToSheet({ store, ctx, collectionId, sheetId: item.id, sheetName: item.name, chapterText }),
  });
}
