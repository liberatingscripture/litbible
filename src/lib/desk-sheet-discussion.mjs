// src/lib/desk-sheet-discussion.mjs
//
// Questions as their own kind (STUDY-DESK.md, N6): a note whose marker is
// "question" is a question, and a sheet can gather the ones that fall on its
// passages into a "For discussion" section, in passage order. The format needs
// nothing new (STUDY-DESK-FORMAT.md, "Sheets (kind 9)"): gathering is a
// one-time insertion of ordinary sheet modules, a heading (a `text` module)
// and one `question` module per note, which the reader can then edit, move or
// delete like any other part. Nothing links the modules back to the notes, so
// editing the sheet never touches the notebook, and a note edited later is not
// followed.
//
// The rules, in order:
//   - A question is a note record (kind "note") with marker "question" that
//     sits on verses: a string bookKey and whole-number chapter and verse. A
//     note on a glossary entry, an article, or a glossary ID has no verse and
//     is skipped; a note on a footnote counts by its verse, like any other.
//   - It belongs to the sheet when its verses [verse, endVerse ?? verse]
//     overlap a passage module's (same book and chapter). A note is gathered
//     once even when it overlaps two passages.
//   - Order is the sheet's: by the first passage a note overlaps (in sheet
//     order), then verse, end verse, creation time and id.
//   - A question's text is its reference in bold, then the note's body (plain
//     text, escaped), in the sheet's canonical formatted-text form. Blank lines
//     start a new paragraph, and a single newline is a line break.
//   - Gathering again only adds what is missing: a question whose text already
//     equals a question module's on the sheet is skipped (`already`), and the
//     heading is added again only when no question was already gathered, so a
//     second gather tops up the section rather than repeating it. A question
//     the reader has since reworded no longer matches and will be added anew.
//   - The sheet's limit on modules is respected; what doesn't fit is `dropped`.
//
// Pure: no DOM, no storage, no clock. The only randomness is makeModule's ids.

import { SHEET_LIMITS, sanitizeSheetHtml } from "./desk-sheet-format.mjs";
import { makeModule } from "./desk-sheets.mjs";
import { recordReference } from "./desk-store-core.mjs";
import { proseTarget } from "./desk-records.mjs";

/** The section's heading, already in the canonical form. */
export const DISCUSSION_HEADING = sanitizeSheetHtml("<h2>For discussion</h2>");

const isInt = Number.isInteger;

/** A passage module's verses as { bookKey, chapter, first, last }, or null for one that doesn't say. */
function passageSpan(m) {
  if (m?.type !== "passage" || typeof m.bookKey !== "string" || !isInt(m.chapter) || !isInt(m.verse)) return null;
  const last = isInt(m.endVerse) ? m.endVerse : m.verse;
  return { bookKey: m.bookKey, chapter: m.chapter, first: m.verse, last };
}

/** Whether a record is a question on verses, as the rules above define one. */
function isQuestion(r) {
  return (
    r?.kind === "note" &&
    r.marker === "question" &&
    !r.glossaryId &&
    !proseTarget(r) &&
    typeof r.bookKey === "string" &&
    isInt(r.chapter) &&
    isInt(r.verse)
  );
}

const cmpText = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

/**
 * The question notes that fall on the sheet's passages, in the order the
 * section lists them.
 *
 * @param {object} sheet a record of kind "sheet"
 * @param {object[]} records the notebook's records (any kinds)
 * @returns {object[]}
 */
export function discussionNotes(sheet, records) {
  const spans = (Array.isArray(sheet?.modules) ? sheet.modules : []).map(passageSpan).filter(Boolean);
  if (!spans.length || !Array.isArray(records)) return [];
  const found = [];
  for (const r of records) {
    if (!isQuestion(r)) continue;
    const end = isInt(r.endVerse) ? r.endVerse : r.verse;
    const first = spans.findIndex((s) => s.bookKey === r.bookKey && s.chapter === r.chapter && r.verse <= s.last && end >= s.first);
    if (first >= 0) found.push({ r, first, end });
  }
  found.sort(
    (a, b) =>
      a.first - b.first ||
      a.r.verse - b.r.verse ||
      a.end - b.end ||
      cmpText(String(a.r.created ?? ""), String(b.r.created ?? "")) ||
      cmpText(String(a.r.id ?? ""), String(b.r.id ?? "")),
  );
  return found.map((f) => f.r);
}

const escapeHtml = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/**
 * A question's formatted text: its reference in bold, then the note's words.
 * Always `sanitizeSheetHtml` of itself, which is what a question module needs.
 *
 * @param {object} note a question note
 * @returns {string}
 */
export function questionHtml(note) {
  const ref = escapeHtml(recordReference(note));
  const body = typeof note?.body === "string" ? note.body.replace(/\r\n?/g, "\n").trim() : "";
  const paragraphs = body ? body.split(/\n[ \t]*\n+/) : [""];
  const html = paragraphs
    .map((p, i) => {
      const words = escapeHtml(p.trim()).replace(/\n/g, "<br>");
      const lead = i === 0 && ref ? `<strong>${ref}</strong>${words ? " " : ""}` : "";
      return `<p>${lead}${words}</p>`;
    })
    .join("");
  return sanitizeSheetHtml(html);
}

/**
 * The modules that gather a sheet's question notes into a "For discussion"
 * section: a heading, then one question module per note, each with `lines`
 * lines to write on and no answer. Only what is missing is returned (see the
 * header), so the list is empty when nothing is new.
 *
 * @param {object} sheet a record of kind "sheet"
 * @param {object[]} records the notebook's records
 * @param {{ lines?: number }} [opts]
 * @returns {{ modules: object[], found: number, already: number, dropped: number }}
 *   `found` is the question notes on the sheet's passages, `already` how many
 *   of them the sheet already holds, `dropped` how many didn't fit.
 */
export function discussionModules(sheet, records, { lines = 3 } = {}) {
  const notes = discussionNotes(sheet, records);
  const existing = Array.isArray(sheet?.modules) ? sheet.modules : [];
  const have = new Set(existing.filter((m) => m?.type === "question" && typeof m.html === "string").map((m) => m.html));
  const fresh = notes.filter((n) => !have.has(questionHtml(n)));
  const already = notes.length - fresh.length;
  if (!fresh.length) return { modules: [], found: notes.length, already, dropped: 0 };

  const hasHeading = existing.some((m) => m?.type === "text" && m.html === DISCUSSION_HEADING);
  const needHeading = !(hasHeading && already > 0);
  const room = Math.max(0, SHEET_LIMITS.modules - existing.length - (needHeading ? 1 : 0));
  const take = fresh.slice(0, room);
  const dropped = fresh.length - take.length;
  if (!take.length) return { modules: [], found: notes.length, already, dropped };

  const modules = take.map((n) => makeModule("question", { html: questionHtml(n), answer: "", lines }));
  if (needHeading) modules.unshift(makeModule("text", { html: DISCUSSION_HEADING }));
  return { modules, found: notes.length, already, dropped };
}
