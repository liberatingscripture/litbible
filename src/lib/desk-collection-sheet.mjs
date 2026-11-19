// src/lib/desk-collection-sheet.mjs
//
// A collection onto a sheet (STUDY-DESK.md, D13: decisions 7, 8 and 20,
// "Collections and sheets", and step 7 of its order of work): a collection's
// members turned into the parts to add to a sheet, a new one ("Make a sheet")
// or one the reader has ("Add to sheet ▸", and the Collection choice in
// "+ From my notes…"). Pure: no DOM, no store, no fetch, no clock; the only
// randomness is makeModule's ids. The caller reads the chapters first
// (`collectionChapters` lists them, as add-forms.js reads a highlight's before
// "+ From my notes…" adds it) and hands them in, then runs
// `collectionSheetParts` again inside its change over the sheet as saved, as
// add-forms.js runs `notAlreadyOn` and `fitModules` there (PC8B-1), so a part
// another tab added meanwhile isn't added twice. Where the block goes is the
// caller's (the end, or after the part last worked in, as "+ From my notes…"
// puts its parts); for "Make a sheet", hand the parts to createSheet as its
// `modules`, so the sheet doesn't open with Blank canvas's empty text part.
//
// The rules, and why:
//
//   - The order is the collection page's (`collectionRows`, the same call
//     collection-view.js makes): Bible order, By type or My order, as the
//     collection is set, a rule's bookmarks where the page shows them.
//     Headings are only in My order, as on the page. By type's group names
//     ("Passages," "Highlights") and Bible order's "Sheets" are labels the
//     page draws, not members, so they make no part.
//   - Each member becomes (decision 8 and "Collections and sheets"):
//       a passage   a passage part of whole verses;
//       a bookmark  a passage, then a text part naming its name and its
//                   labels, whichever it has ("Bookmark “Hope,” labeled
//                   Advent"); one with neither is the passage alone, since a
//                   line saying only "Bookmark" would tell a reader nothing;
//       a highlight a passage, then a text part naming its color
//                   ("Highlighted yellow");
//       a note      a question part when marked a question, else a text part,
//                   and a pinned footnote a text part, made by
//                   desk-sheet-from-notes.mjs's own `partsFor` (its reference
//                   in bold, then the words), so the two ways in never drift.
//                   A note on a glossary entry or an article has no verse but
//                   is in the collection, so it comes too, named by its page;
//       a heading   a text part holding it as an <h2> (below);
//       a sheet     nothing: sheets aren't merged (version 2). It is named
//                   where it sat in a Leader only text part ("Also in this
//                   collection: the sheet “Advent week 1.”"), which the leader
//                   can untick when it points to a handout the group is given
//                   (decision 7), and listed in `skippedSheets` so the reader
//                   is told (`skippedSheetsNote`).
//     The text parts are ordinary ones, edited or deleted like any other, and
//     nothing links a part back to its record.
//   - Every passage is whole verses (decision 20). A passage member that
//     arrives with an old `quote` is shown as whole verses, and a highlight's
//     passage covers the whole verses its words are in today (passageFromRecord
//     follows words that moved), never only the words.
//   - One passage per verse range. Neighbors share it: when a bookmark's or a
//     highlight's text part comes right after the passage just made for its
//     verses (nothing else added between), it goes under that passage (one
//     passage part, then each text part), whichever member made the passage.
//     The order wins over gathering: a record on verses this block put
//     further up, or the sheet already holds, makes no second passage, and its
//     text part stays at its own place in the order, opening with its
//     reference in bold (as a note's does), so it never reads as part of the
//     passage above it. The sheet's existing passages are left where the
//     leader put them: the new parts are one block, never threaded into it.
//     "The same verses" is book, chapter, first and last verse; a passage on
//     the sheet with a `quote` (part of a verse) counts as holding its verses,
//     since repeats are checked by verses.
//   - Repeats are checked against the sheet (`notAlreadyOn` checks records,
//     not verses, and passes bookmarks over, so it can't be used here): a
//     passage whose verses the sheet holds is left out; a text part whose words
//     the sheet holds already (anywhere, or, for a bookmark's or highlight's
//     line, among the text parts right under a passage of the same verses, up
//     to the next heading) is
//     left out; and a heading the sheet holds already is left out when nothing
//     under it is new. Adding the same collection twice adds nothing the
//     second time. Within the block, a line a group already has isn't
//     repeated (two yellow highlights on one verse say so once).
//   - A heading is an <h2> that a template never takes for its "Reading"
//     part. A sheet marks no part as the reading; the editor finds it by its
//     heading's words alone (`readingPart`: "Reading," "Read," "The text,"
//     "The reading"), and while the sheet has no passage it opens the passage
//     form under that part and puts the first passage after it. So a heading
//     with one of those words gets an invisible word joiner (U+2060) after
//     them: it looks, prints and copies the same, but is not a template's
//     reading part. Any other heading is the plain <h2>.
//   - The sheet's limits: a group (a passage and the text parts under it)
//     never splits. Parts are added in order until one doesn't fit (300
//     parts, SHEET_LIMITS.modules, or the sheet's 512 KB, less 2 KB kept for
//     the sheet's own fields to change as it is written); the block stops
//     before it, and what is left is counted in `leftOut`. A heading is never
//     the last thing added when what follows it didn't fit.
//
// What `collectionSheetParts` returns:
//   parts          the modules to add, in order (one change, so one undo)
//   added          how many of the collection's passages and records are on
//                  the sheet because of these parts (one with a part of its
//                  own, or one riding on a passage the block makes)
//   alreadyOn      how many add nothing because the sheet holds them already
//   leftOut        how many didn't fit the sheet's limits
//   skippedSheets  each sheet in the collection, as { id, title }; sheets are
//                  never added, whatever else fits
//   limit          null, or the limit that stopped the block: "parts" or
//                  "size"
// added + alreadyOn + leftOut + skippedSheets.length is the count the
// collection's page shows, less any record nothing can be made of (a bookmark
// or highlight with no verse, a pinned footnote with no words), which is
// passed over.

import { COLORS } from "./desk-records.mjs";
import { collectionRows } from "./desk-collections.mjs";
import { labelMap, shownLabels } from "./desk-labels.mjs";
import { SHEET_LIMITS, sanitizeSheetHtml } from "./desk-sheet-format.mjs";
import { noteHtml, partsFor } from "./desk-sheet-from-notes.mjs";
import { passageFromRecord, passageFromVerses, passageReference } from "./desk-sheet-passages.mjs";
import { readingPart } from "./desk-sheet-templates.mjs";
import { makeModule } from "./desk-sheets.mjs";

const isInt = Number.isInteger;
const escapeHtml = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const oneLine = (s) => (typeof s === "string" ? s.replace(/\s+/g, " ").trim() : "");

/** Whether a record or member sits on verses (a note on a glossary entry or an article doesn't). */
const onVerse = (x) => typeof x?.bookKey === "string" && isInt(x?.chapter) && isInt(x?.verse);

/** The key a chapter is looked up by in a Map of chapters: "john 3", as add-forms.js keys them. */
export const chapterKey = (bookKey, chapter) => `${bookKey} ${chapter}`;

/** A passage's verses as one key: book, chapter, first and last verse (a quote doesn't count). */
const rangeKey = (p) => `${p.bookKey} ${p.chapter} ${p.verse} ${isInt(p.endVerse) ? p.endVerse : p.verse}`;

/**
 * The chapters a collection's parts need read first, each once, in Bible
 * order: those of its passages, bookmarks and highlights (rule bookmarks
 * included). A note's part doesn't need its chapter.
 *
 * @param {object} collection a record of kind "collection"
 * @param {object[]} records the notebook's records
 * @returns {{ bookKey: string, chapter: number }[]}
 */
export function collectionChapters(collection, records) {
  const seen = new Set();
  const out = [];
  for (const row of collectionRows(collection, records ?? [], { order: "bible" }).rows) {
    const x = row.type === "passage" ? row.member : row.type === "record" && (row.record.kind === "bookmark" || row.record.kind === "highlight") ? row.record : null;
    if (!onVerse(x)) continue;
    const key = chapterKey(x.bookKey, x.chapter);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ bookKey: x.bookKey, chapter: x.chapter });
  }
  return out;
}

/** "Advent", "Advent and Lent", "Advent, Lent, and Easter" (the Oxford comma). */
function listOf(words) {
  if (words.length < 3) return words.join(" and ");
  return `${words.slice(0, -1).join(", ")}, and ${words[words.length - 1]}`;
}

/**
 * The line a bookmark's text part holds (decision 8): its name and its labels,
 * whichever it has. "Bookmark “Hope,” labeled Advent", "Bookmark “Hope”",
 * "Bookmark labeled Advent and Lent", or "" when it has neither. `labels` is
 * labelMap's Map, or the records to make one from.
 *
 * @param {object} bookmark
 * @param {Map<string, object> | object[]} labels
 * @returns {string}
 */
export function bookmarkWords(bookmark, labels) {
  const name = oneLine(bookmark?.label);
  const names = shownLabels(bookmark, labels ?? []).map((l) => oneLine(l.name)).filter(Boolean);
  const labeled = names.length ? `labeled ${listOf(names)}` : "";
  if (!name) return labeled ? `Bookmark ${labeled}` : "";
  if (!labeled) return `Bookmark “${name}”`;
  // The comma goes inside the closing quote, unless the name ends in a mark of its own.
  const lead = /[!?…]$/.test(name) ? name : `${name.replace(/[.,;:]$/, "")},`;
  return `Bookmark “${lead}” ${labeled}`;
}

/** The line a highlight's text part holds (decision 8): "Highlighted yellow", or "Highlighted" for a color the format doesn't know. */
export function highlightWords(highlight) {
  return COLORS.includes(highlight?.color) ? `Highlighted ${highlight.color}` : "Highlighted";
}

/** The Leader only line naming a sheet left out where it sat (decision 7). */
export function skippedSheetWords(sheet) {
  const title = oneLine(sheet?.title);
  if (!title) return "Also in this collection: an untitled sheet.";
  return /[.!?…]$/.test(title) ? `Also in this collection: the sheet “${title}”` : `Also in this collection: the sheet “${title}.”`;
}

/** What the reader is told about the sheets left out: "2 sheets weren’t added; each is a sheet of its own." "" for none. */
export function skippedSheetsNote(count) {
  if (!(count > 0)) return "";
  return count === 1 ? "1 sheet wasn’t added; it is a sheet of its own." : `${count} sheets weren’t added; each is a sheet of its own.`;
}

/** A line as a text part's html, in the canonical form; with `ref`, the reference in bold first, as a note's. */
const lineHtml = (words, ref = "") => sanitizeSheetHtml(`<p>${ref ? `<strong>${escapeHtml(ref)}</strong> ` : ""}${escapeHtml(words)}</p>`);

/** Put after a heading's words when a template would read them as its reading part's: zero-width, never a break. */
const WORD_JOINER = "\u2060";

/**
 * A collection heading as a text part's html: its words as an <h2>, never
 * one a template takes for its "Reading" part (readingPart), so a heading of
 * "Reading" gets an invisible word joiner after the word. "" for a heading
 * with no words.
 *
 * @param {string} text
 * @returns {string}
 */
export function headingHtml(text) {
  const words = oneLine(text);
  if (!words) return "";
  const plain = sanitizeSheetHtml(`<h2>${escapeHtml(words)}</h2>`);
  const probe = { type: "text", html: plain };
  return readingPart({ modules: [probe] }) === probe ? sanitizeSheetHtml(`<h2>${escapeHtml(words)}${WORD_JOINER}</h2>`) : plain;
}

/** A text part that opens with a heading, which ends the run of lines under a passage. */
const isHeadingPart = (m) => m?.type === "text" && typeof m.html === "string" && /^<h[1-6][ >]/.test(m.html);

/**
 * What the sheet holds: its passages' verses, its text and question parts'
 * html, and the lines under each passage (the text parts right after it, up
 * to anything else or a heading).
 */
function sheetHolds(modules) {
  const ranges = new Set();
  const texts = new Set();
  const under = new Map();
  modules.forEach((m, i) => {
    if (m?.type === "passage" && onVerse(m)) {
      const key = rangeKey(m);
      ranges.add(key);
      if (!under.has(key)) under.set(key, new Set());
      for (let j = i + 1; modules[j]?.type === "text" && !isHeadingPart(modules[j]); j++) {
        if (typeof modules[j].html === "string") under.get(key).add(modules[j].html);
      }
    } else if ((m?.type === "text" || m?.type === "question") && typeof m.html === "string") {
      texts.add(m.html);
    }
  });
  return { ranges, texts, under };
}

/** The chapter lookup the caller gave: a function of (bookKey, chapter), a Map keyed by chapterKey, or nothing. */
function lookup(chapters) {
  if (typeof chapters === "function") return (bookKey, chapter) => chapters(bookKey, chapter) ?? null;
  if (chapters instanceof Map) return (bookKey, chapter) => chapters.get(chapterKey(bookKey, chapter)) ?? null;
  return () => null;
}

function jsonBytes(value) {
  try {
    return new TextEncoder().encode(JSON.stringify(value)).length;
  } catch {
    return Infinity;
  }
}

/** Room left for the sheet's own fields to change as it is written (its title, `modified`, `client`). */
const SIZE_MARGIN = 2048;

/**
 * The parts a collection becomes on a sheet, in the collection page's order,
 * and what became of each member (see the header for the rules and the
 * result). `sheet` is the sheet as saved now (null for one not made yet);
 * `chapters` gives a chapter's anchor text, from `collectionChapters`' list,
 * as a function of (bookKey, chapter) or a Map keyed by `chapterKey`, null
 * where it couldn't be read (the passage is then made without its comparison
 * copy, as "+ From my notes…" makes one). `lines` is a question's lines to
 * write on; `order` overrides the collection's own.
 *
 * @param {object} collection a record of kind "collection"
 * @param {object[]} records the notebook's records
 * @param {{ modules: object[] } | null} sheet
 * @param {{ chapters?: Function | Map<string, object> | null, contentVersion?: string | null, lines?: number, order?: string }} [opts]
 * @returns {{ parts: object[], added: number, alreadyOn: number, leftOut: number, skippedSheets: { id: string, title: string }[], limit: null | "parts" | "size" }}
 */
export function collectionSheetParts(collection, records, sheet, { chapters = null, contentVersion = null, lines = 3, order } = {}) {
  const list = Array.isArray(records) ? records : [];
  const { rows } = collectionRows(collection, list, { order });
  const labels = labelMap(list.filter((r) => r?.kind !== "trash"));
  const chapterOf = lookup(chapters);
  const modules = Array.isArray(sheet?.modules) ? sheet.modules : [];
  const held = sheetHolds(modules);

  /** Whole verses for a passage member, or a bookmark's or highlight's verses today. */
  const wholeVerses = (x, follow) => {
    const chapter = chapterOf(x.bookKey, x.chapter);
    const at = follow ? passageFromRecord(x, chapter, contentVersion) : x;
    if (!at) return null;
    const where = { bookKey: x.bookKey, chapter: x.chapter };
    return passageFromVerses(chapter, where, at.verse, isInt(at.endVerse) ? at.endVerse : at.verse, contentVersion);
  };

  // The block is built as units, each added whole or not at all: a group (a
  // passage and the text parts under it), a heading, or a single part.
  const units = [];
  const statuses = []; // one per passage or record shown (sheets aside): { unit } or { on: true }
  const skippedSheets = [];
  const groups = new Map(); // a verse range this block makes a passage for → its group
  const lineUnits = new Map(); // a line made in this block, with its reference → its unit
  let open = null; // the group just made, which a neighbor on its verses joins
  let section = null; // the heading unit the rows fall under, in My order

  const unit = (parts, extra = {}) => {
    const u = { parts, fits: false, ...extra };
    units.push(u);
    if (section && !u.heading) section.fresh += 1;
    return u;
  };
  const startGroup = (key, fields) => {
    const group = { key, unit: unit([makeModule("passage", fields)], { group: true }), lines: new Set() };
    groups.set(key, group);
    open = group;
    return group;
  };
  const addLine = (group, html) => {
    if (!html || group.lines.has(html)) return;
    group.lines.add(html);
    group.unit.parts.push(makeModule("text", { html }));
  };

  for (const row of rows) {
    if (row.type === "group") continue;

    if (row.type === "heading") {
      open = null;
      const html = headingHtml(row.text);
      section = html ? unit([makeModule("text", { html })], { heading: true, html, fresh: 0 }) : null;
      continue;
    }

    if (row.type === "passage") {
      const fields = wholeVerses(row.member, false);
      const key = rangeKey(fields);
      if (open?.key === key) statuses.push({ unit: open.unit });
      else if (held.ranges.has(key)) statuses.push({ on: true });
      else if (groups.has(key)) statuses.push({ unit: groups.get(key).unit });
      else statuses.push({ unit: startGroup(key, fields).unit });
      continue;
    }

    const r = row.record;
    if (r.kind === "sheet") {
      skippedSheets.push({ id: r.id, title: oneLine(r.title) || "Untitled sheet" });
      const html = lineHtml(skippedSheetWords(r));
      if (!held.texts.has(html)) {
        unit([makeModule("text", { html, leaderOnly: true })]);
        open = null;
      }
      continue;
    }

    if (r.kind === "note" || r.kind === "footnotePin") {
      if (r.kind === "footnotePin" && typeof r.footnote !== "string") continue;
      if (held.texts.has(noteHtml(r))) {
        statuses.push({ on: true });
        continue;
      }
      const kind = r.kind === "footnotePin" ? "footnote" : r.marker === "question" ? "question" : "note";
      statuses.push({ unit: unit(partsFor([{ record: r, kind }], { lines })) });
      open = null;
      continue;
    }

    // A bookmark or a highlight: a passage, and its line under it.
    if (!onVerse(r)) continue;
    const fields = wholeVerses(r, true);
    if (!fields) continue;
    const key = rangeKey(fields);
    const words = r.kind === "bookmark" ? bookmarkWords(r, labels) : highlightWords(r);
    if (open?.key === key) {
      addLine(open, words && lineHtml(words));
      statuses.push({ unit: open.unit });
      continue;
    }
    if (!held.ranges.has(key) && !groups.has(key)) {
      const group = startGroup(key, fields);
      addLine(group, words && lineHtml(words));
      statuses.push({ unit: group.unit });
      continue;
    }
    // Its verses are on the sheet already, or further up this block: no second passage.
    const above = groups.get(key) ?? null;
    const grouped = words && lineHtml(words);
    const alone = words && lineHtml(words, passageReference(fields));
    if (!words || above?.lines.has(grouped) || lineUnits.has(alone)) {
      const rides = above?.unit ?? lineUnits.get(alone) ?? null;
      statuses.push(rides ? { unit: rides } : { on: true });
    } else if (held.texts.has(alone) || held.under.get(key)?.has(grouped)) {
      statuses.push({ on: true });
    } else {
      const u = unit([makeModule("text", { html: alone })]);
      lineUnits.set(alone, u);
      statuses.push({ unit: u });
      open = null;
    }
  }

  // A heading the sheet holds already, with nothing new under it, is left out.
  for (const u of units) if (u.heading && u.fresh === 0 && held.texts.has(u.html)) u.parts = [];

  // Fit to the sheet's limits, a unit whole or not at all, stopping at the first that doesn't fit.
  let room = Math.max(0, SHEET_LIMITS.modules - modules.length);
  let bytes = (sheet ? jsonBytes(sheet) : 0) + SIZE_MARGIN;
  let limit = null;
  const fitted = [];
  for (const u of units) {
    if (!u.parts.length) {
      u.fits = true;
      continue;
    }
    const size = u.parts.reduce((n, m) => n + jsonBytes(m) + 1, 0);
    if (u.parts.length > room) limit = "parts";
    else if (bytes + size > SHEET_LIMITS.bytes) limit = "size";
    if (limit) break;
    room -= u.parts.length;
    bytes += size;
    u.fits = true;
    fitted.push(u);
  }
  // A heading never ends the block when what follows it didn't fit.
  if (limit) while (fitted.length && fitted[fitted.length - 1].heading) fitted.pop().fits = false;

  let added = 0;
  let alreadyOn = 0;
  let leftOut = 0;
  for (const s of statuses) {
    if (!s.unit) alreadyOn += 1;
    else if (s.unit.fits) added += 1;
    else leftOut += 1;
  }
  return { parts: fitted.flatMap((u) => u.parts), added, alreadyOn, leftOut, skippedSheets, limit };
}
