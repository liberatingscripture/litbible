// src/lib/desk-sheet-from-notes.mjs
//
// What a sheet can take from the notebook (STUDY-DESK-FIXES.md, E62; BVJ,
// 2026-11-08): the reader's notes, highlights and pinned footnotes, offered
// in the Sheets pane's "+ From my notes…" chooser and brought onto the sheet
// as ordinary parts. It replaces N6's "+ For discussion", which gathered only
// the notes marked as questions, a habit few readers have: "The options for
// sheets need to be more flexible than that, more useful to more people."
//
// The rules:
//   - A record is offered when it sits on verses (a string bookKey and
//     whole-number chapter and verse) and is a note (any marker), a highlight,
//     or a pinned footnote. A note on a glossary entry, an article or a
//     glossary ID has no verse and is left out.
//   - On a sheet with passages, the records offered are those whose verses
//     [verse, endVerse ?? verse] overlap a passage (same book and chapter),
//     in the sheet's order: by the first passage overlapped, then verse, end
//     verse, creation time and id. A record overlapping two passages is
//     offered once. On a sheet with no passage yet, everything eligible is
//     offered, the most recently changed first, at most FROM_NOTES_MAX.
//   - Each kind becomes one part: a note marked `question` a `question`
//     module (its reference in bold, then the words, with lines to write
//     on), any other note or a pinned footnote a `text` module (the
//     reference in bold, then the note's words or the footnote's), and a
//     highlight a `passage` module of its verses (part of a verse kept as
//     the passage's quote, as passageFromRecord does).
//   - A note or footnote whose text is already a module's on the sheet is
//     marked `onSheet`, as is a highlight whose verses a passage module
//     already covers exactly, so the chooser can show it as there already.
//   - The sheet's limit on modules is respected (fitModules): what doesn't
//     fit is counted as `dropped`.
//
// Pure: no DOM, no storage, no clock. The only randomness is makeModule's ids.

import { SHEET_LIMITS, sanitizeSheetHtml } from "./desk-sheet-format.mjs";
import { passageFromRecord } from "./desk-sheet-passages.mjs";
import { makeModule } from "./desk-sheets.mjs";
import { recordReference } from "./desk-store-core.mjs";
import { proseTarget } from "./desk-records.mjs";

/** How many records a sheet with no passage is offered. */
export const FROM_NOTES_MAX = 60;

const isInt = Number.isInteger;

/** A passage module's verses as { bookKey, chapter, first, last }, or null for one that doesn't say. */
function passageSpan(m) {
  if (m?.type !== "passage" || typeof m.bookKey !== "string" || !isInt(m.chapter) || !isInt(m.verse)) return null;
  const last = isInt(m.endVerse) ? m.endVerse : m.verse;
  return { bookKey: m.bookKey, chapter: m.chapter, first: m.verse, last };
}

/** The kind of part a record becomes, or null for one the sheet can't take. */
export function itemKind(r) {
  if (!r || typeof r.bookKey !== "string" || !isInt(r.chapter) || !isInt(r.verse)) return null;
  if (r.kind === "highlight") return "highlight";
  if (r.kind === "footnotePin") return typeof r.footnote === "string" ? "footnote" : null;
  if (r.kind === "note") {
    if (r.glossaryId || proseTarget(r)) return null;
    return r.marker === "question" ? "question" : "note";
  }
  return null;
}

const cmpText = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
const escapeHtml = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Plain words as paragraphs: blank lines start one, a single newline is a break. */
function paragraphsOf(text) {
  const body = typeof text === "string" ? text.replace(/\r\n?/g, "\n").trim() : "";
  return body ? body.split(/\n[ \t]*\n+/).map((p) => escapeHtml(p.trim()).replace(/\n/g, "<br>")) : [];
}

/**
 * A note's or pinned footnote's formatted text: its reference in bold, then
 * its words (the note's, or the pinned footnote's). Always
 * `sanitizeSheetHtml` of itself.
 *
 * @param {object} record a note or footnotePin on verses
 * @returns {string}
 */
export function noteHtml(record) {
  const ref = escapeHtml(recordReference(record));
  const parts = record?.kind === "footnotePin" ? paragraphsOf(record.footnote) : paragraphsOf(record?.body);
  const html = parts.length
    ? parts.map((p, i) => `<p>${i === 0 && ref ? `<strong>${ref}</strong> ` : ""}${p}</p>`).join("")
    : `<p><strong>${ref}</strong></p>`;
  return sanitizeSheetHtml(html);
}

/** The words a chooser shows under a record's reference: a note's, a footnote's, or a highlight's. */
export function itemWords(record) {
  if (record?.kind === "highlight") return typeof record.quote?.exact === "string" ? record.quote.exact : "";
  if (record?.kind === "footnotePin") return typeof record.footnote === "string" ? record.footnote : "";
  return typeof record?.body === "string" ? record.body : "";
}

/**
 * The notebook records a sheet is offered, each as
 * { record, kind, words, onSheet }, in the order the chooser lists them.
 *
 * @param {object} sheet a record of kind "sheet"
 * @param {object[]} records the notebook's records (any kinds)
 * @returns {{ record: object, kind: string, words: string, onSheet: boolean }[]}
 */
export function notebookItems(sheet, records) {
  if (!Array.isArray(sheet?.modules) || !Array.isArray(records)) return [];
  const modules = sheet.modules;
  const spans = modules.map(passageSpan).filter(Boolean);
  const found = [];
  for (const r of records) {
    const kind = itemKind(r);
    if (!kind) continue;
    const end = isInt(r.endVerse) ? r.endVerse : r.verse;
    if (spans.length) {
      const first = spans.findIndex((s) => s.bookKey === r.bookKey && s.chapter === r.chapter && r.verse <= s.last && end >= s.first);
      if (first < 0) continue;
      found.push({ r, kind, first, end });
    } else {
      found.push({ r, kind, first: 0, end });
    }
  }
  if (spans.length) {
    found.sort(
      (a, b) =>
        a.first - b.first ||
        a.r.verse - b.r.verse ||
        a.end - b.end ||
        cmpText(String(a.r.created ?? ""), String(b.r.created ?? "")) ||
        cmpText(String(a.r.id ?? ""), String(b.r.id ?? "")),
    );
  } else {
    found.sort((a, b) => cmpText(String(b.r.modified ?? ""), String(a.r.modified ?? "")) || cmpText(String(a.r.id ?? ""), String(b.r.id ?? "")));
    found.splice(FROM_NOTES_MAX);
  }
  const texts = new Set(modules.filter((m) => (m?.type === "text" || m?.type === "question") && typeof m.html === "string").map((m) => m.html));
  const covered = new Set(spans.map((s) => `${s.bookKey} ${s.chapter} ${s.first} ${s.last}`));
  return found.map(({ r, kind, end }) => ({
    record: r,
    kind,
    words: itemWords(r),
    onSheet: kind === "highlight" ? covered.has(`${r.bookKey} ${r.chapter} ${r.verse} ${end}`) : texts.has(noteHtml(r)),
  }));
}

/**
 * The parts for the items chosen, one each, in the order given. `chapter(record)`
 * gives a highlight's chapter anchor text, or null, so a part-verse highlight
 * keeps its words as the passage's quote; `lines` is a question's lines to
 * write on.
 *
 * @param {{ record: object, kind: string }[]} items
 * @param {{ chapter?: (record: object) => (object | null), contentVersion?: string | null, lines?: number }} [opts]
 * @returns {object[]} modules
 */
export function partsFor(items, { chapter = () => null, contentVersion = null, lines = 3 } = {}) {
  const out = [];
  for (const it of items ?? []) {
    const r = it?.record;
    const kind = it?.kind ?? itemKind(r);
    if (kind === "question") out.push(makeModule("question", { html: noteHtml(r), answer: "", lines }));
    else if (kind === "note" || kind === "footnote") out.push(makeModule("text", { html: noteHtml(r) }));
    else if (kind === "highlight") {
      const fields = passageFromRecord(r, chapter(r), contentVersion);
      if (fields) out.push(makeModule("passage", fields));
    }
  }
  return out;
}

/**
 * The chosen items less any the sheet now holds. The chooser's own box is
 * disabled for these, but its list was read when it opened: a note put on the
 * sheet from another tab (or by an undo) since would be added twice (PC8B-1).
 *
 * @param {object} sheet the sheet as it is now saved
 * @param {object[]} records the notebook's records
 * @param {{ record: object }[]} chosen
 */
export function notAlreadyOn(sheet, records, chosen) {
  const held = new Set(notebookItems(sheet, records).filter((it) => it.onSheet).map((it) => it.record));
  return (chosen ?? []).filter((it) => !held.has(it.record));
}

/**
 * The modules that fit the sheet's limit, and how many didn't.
 *
 * @param {object} sheet a record of kind "sheet"
 * @param {object[]} modules
 * @returns {{ modules: object[], dropped: number }}
 */
export function fitModules(sheet, modules) {
  const have = Array.isArray(sheet?.modules) ? sheet.modules.length : 0;
  const room = Math.max(0, SHEET_LIMITS.modules - have);
  const list = Array.isArray(modules) ? modules : [];
  return { modules: list.slice(0, room), dropped: Math.max(0, list.length - room) };
}
