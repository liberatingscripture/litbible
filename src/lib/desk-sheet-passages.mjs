// src/lib/desk-sheet-passages.mjs
//
// Passages on a sheet (STUDY-DESK-FORMAT.md, "Sheets (kind 9)", `passage`;
// STUDY-DESK.md, "Order of work", 3f): making one from a verse menu, a
// selection or a notebook record, naming it, and finding its words in today's
// text. Pure: the chapter is anchor-core's shape ({ verses, spans, text }),
// built by whoever has the page.
//
// Rule 1 of the format holds here: a passage is a reference, plus a quote
// only when it starts or ends inside a verse. Its words are read from the
// live text whenever it is shown; `verseCopy` is kept for comparison only
// (S2), never shown.

import { BOOKS, bookKeyToLabel } from "../data/books.js";
import { makeAnchor, rangeOf, resolveAnchor } from "./anchor-core.mjs";
import { verseCopyFor } from "./desk-records.mjs";
import { readingPart } from "./desk-sheet-templates.mjs";

/** The passage's verses, as a plain reference: "Romans 5:6–10", never "6a". */
export function passageReference(p) {
  const end = p.endVerse ?? p.verse;
  return `${bookKeyToLabel(p.bookKey)} ${p.chapter}:${p.verse}${end > p.verse ? "–" + end : ""}`;
}

/** The comparison copy every passage carries, when the chapter can give it. */
function copyFields(chapter, verse, endVerse, contentVersion) {
  const verseCopy = chapter ? verseCopyFor(chapter, verse, endVerse) : null;
  return verseCopy == null ? {} : { verseCopy, verseCopyAsOf: contentVersion };
}

/**
 * Whole verses, as a passage module's fields (without id or type). `chapter`
 * may be null when the text isn't to hand, and then no copy is kept.
 *
 * @param {{ bookKey: string, chapter: number }} where
 */
export function passageFromVerses(chapter, where, verse, endVerse = verse, contentVersion = null) {
  const first = Math.min(verse, endVerse);
  const last = Math.max(verse, endVerse);
  return {
    bookKey: where.bookKey,
    chapter: where.chapter,
    verse: first,
    endVerse: last,
    ...copyFields(chapter, first, last, contentVersion),
  };
}

/**
 * A typed reference as a passage ("+ Passage"), checked against the chapter:
 * { fields } to add, or { problem } to show the reader. `ref` is
 * parseReference's ({ bookKey, chapter, verse, rangeEnd }); `chapter` is the
 * chapter's anchor text, or null when it couldn't be read.
 *
 * A chapter alone is all of it. A verse the LIT doesn't have is refused, past
 * the chapter's end or in a gap (Matthew 17:21); a range's end is brought back
 * to the last verse there is, so the reference never names a missing verse.
 * Nothing is added without the chapter, since nothing could be checked (BA127).
 */
export function passageForReference(chapter, ref, contentVersion = null) {
  const name = (verse) => passageReference({ bookKey: ref.bookKey, chapter: ref.chapter, verse });
  const chapters = BOOKS[ref.bookKey];
  if (chapters && ref.chapter > chapters) {
    const book = bookKeyToLabel(ref.bookKey);
    return { problem: chapters === 1 ? `${book} has only one chapter.` : `${book} has ${chapters} chapters.` };
  }
  const verses = chapter?.verses;
  if (!verses?.size) {
    return { problem: `${bookKeyToLabel(ref.bookKey)} ${ref.chapter} couldn’t be read just now. Check the connection and try again.` };
  }
  const numbers = [...verses.keys()];
  const last = Math.max(...numbers);
  const verse = ref.verse ?? Math.min(...numbers);
  if (verse > last) return { problem: `${name(verse)} isn’t in the LIT; that chapter ends at verse ${last}.` };
  if (!verses.has(verse)) return { problem: `${name(verse)} isn’t in the LIT.` };
  let end = Math.min(ref.verse == null ? last : ref.rangeEnd ?? verse, last);
  while (end > verse && !verses.has(end)) end--;
  return { fields: passageFromVerses(chapter, ref, verse, end, contentVersion) };
}

/**
 * Chapter text [start, end) as a passage: its verses, and a quote only when
 * it starts or ends inside a verse. A selection that covers whole verses is a
 * passage of those verses, so it reads and prints as a verse menu's would.
 */
export function passageFromOffsets(chapter, where, start, end, contentVersion = null) {
  const a = makeAnchor(chapter, start, end);
  const whole = rangeOf(chapter, a.verse, a.endVerse);
  const fields = passageFromVerses(chapter, where, a.verse, a.endVerse, contentVersion);
  if (whole && whole[0] === start && whole[1] === end) return fields;
  return { ...fields, quote: { exact: a.exact, prefix: a.prefix, suffix: a.suffix } };
}

/**
 * A notebook record's place as a passage: a note, highlight or bookmark on
 * scripture (anything else is null). A record's quote is kept as the
 * passage's when the chapter can't settle it; with the chapter, it is read
 * again (passageFromOffsets), so a quote that now covers whole verses drops.
 */
export function passageFromRecord(record, chapter = null, contentVersion = null) {
  if (!record?.bookKey || !Number.isInteger(record.chapter) || !Number.isInteger(record.verse)) return null;
  const where = { bookKey: record.bookKey, chapter: record.chapter };
  const endVerse = record.endVerse ?? record.verse;
  if (record.quote?.exact && chapter) {
    const found = resolveAnchor(chapter, { ...record.quote, verse: record.verse, endVerse });
    if (found.start != null && (found.status === "found" || found.status === "moved")) {
      return passageFromOffsets(chapter, where, found.start, found.end, contentVersion);
    }
  }
  const fields = passageFromVerses(chapter, where, record.verse, endVerse, contentVersion);
  if (record.quote?.exact && !chapter) {
    fields.quote = { exact: record.quote.exact, prefix: record.quote.prefix ?? "", suffix: record.quote.suffix ?? "" };
  }
  return fields;
}

/**
 * Where a passage's words are in today's chapter: { status, start, end }.
 * Whole verses are "found" while any of them exists; a quote follows
 * resolveAnchor ("found", "moved", "changed", "verse" or "lost"). `start`
 * and `end` are null when nothing can be shown.
 */
export function locatePassage(chapter, p) {
  const endVerse = p.endVerse ?? p.verse;
  if (p.quote?.exact) return resolveAnchor(chapter, { ...p.quote, verse: p.verse, endVerse });
  const r = rangeOf(chapter, p.verse, endVerse);
  return r ? { status: "found", start: r[0], end: r[1] } : { status: "lost", start: null, end: null };
}

/**
 * Where a passage goes when no part of the sheet has been worked in yet
 * (BA69): after the sheet's last passage, so passages added one after
 * another stay in order; on a sheet with none, after the template's reading
 * part (readingPart), so the first lands under "Reading" and not after
 * "Closing", in a sheet made just now or days ago; else at the end.
 */
export function passageInsertIndex(sheet) {
  const modules = sheet?.modules ?? [];
  for (let i = modules.length - 1; i >= 0; i--) if (modules[i]?.type === "passage") return i + 1;
  const reading = readingPart(sheet);
  return reading ? modules.indexOf(reading) + 1 : modules.length;
}

/** Whether two passage fields name the same words (for "already on the sheet"). */
export function samePassage(a, b) {
  return (
    a?.bookKey === b?.bookKey &&
    a?.chapter === b?.chapter &&
    a?.verse === b?.verse &&
    (a?.endVerse ?? a?.verse) === (b?.endVerse ?? b?.verse) &&
    (a?.quote?.exact ?? null) === (b?.quote?.exact ?? null)
  );
}

/** A sheet's name for a list: its title, or "Untitled sheet". */
export const sheetName = (sheet) => (sheet?.title?.trim() ? sheet.title.trim() : "Untitled sheet");

/** Sheets for a chooser: newest change first, then by name. */
export function sortSheets(sheets) {
  return [...sheets].sort(
    (a, b) => String(b.modified ?? "").localeCompare(String(a.modified ?? "")) || sheetName(a).localeCompare(sheetName(b)),
  );
}
