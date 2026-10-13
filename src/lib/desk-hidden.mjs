// src/lib/desk-hidden.mjs
//
// The hidden passage's rules (STUDY-DESK.md, N8; STUDY-DESK-FORMAT.md kind 3,
// `hidden`): which verses of a chapter the reader's `hidden` records cover,
// how overlapping records merge into one passage for display, what the veil
// over a passage says, and what a new record holds. Pure: no DOM, no storage.
// The page-side half is src/scripts/desk/hidden.js.
//
// Decisions the rules carry:
//   - Records on other chapters never touch a chapter; a record whose verses
//     aren't whole numbers is ignored rather than guessed at.
//   - Two records that share a verse are one passage on the page (one veil,
//     one Show). Records that merely sit side by side stay two passages.
//   - "Show" is for this page view only. `revealed` is the set of record ids
//     the reader has shown since the page loaded; a passage is shown when
//     every record in it is, so a record made after a Show hides again.
//   - "Hide my notes" (M1) keeps passages hidden but never prints the note to
//     self, since that is the reader's private writing and M1 is for a shared
//     screen.

import { bookKeyToLabel } from "../data/books.js";

/** What a preview or the verse menu says where a hidden verse's words would be. */
export const HIDDEN_NOTICE = "Hidden by your note.";

/** The hidden records of a notebook, optionally of one chapter only. */
export function hiddenRecords(records, bookKey = null, chapter = null) {
  return (records ?? []).filter(
    (r) =>
      r?.kind === "hidden" &&
      Number.isInteger(r.verse) &&
      r.verse >= 1 &&
      (r.endVerse == null || (Number.isInteger(r.endVerse) && r.endVerse >= r.verse)) &&
      (bookKey == null || r.bookKey === bookKey) &&
      (chapter == null || r.chapter === chapter),
  );
}

/** A record's last verse. */
const lastOf = (r) => r.endVerse ?? r.verse;

/**
 * One chapter's hidden passages, overlapping records merged.
 *
 * @param {object[]} records any records; only the chapter's hidden ones count
 * @param {{ bookKey: string, chapter: number, verses?: number[] | null,
 *   revealed?: Set<string> }} options `verses` is the verse numbers the page
 *   has (a verse the text lacks, Matthew 17:21, hides nothing); left out, a
 *   passage covers every number in its range.
 * @returns {{ ids: string[], start: number, end: number, verses: number[],
 *   notes: string[], revealed: boolean }[]} in verse order. `notes` are the
 *   non-empty notes to self, in the order the records were made, each once.
 */
export function planHidden(records, { bookKey, chapter, verses = null, revealed = new Set() }) {
  const mine = hiddenRecords(records, bookKey, chapter).sort(
    (a, b) => a.verse - b.verse || lastOf(a) - lastOf(b) || String(a.created).localeCompare(String(b.created)),
  );
  const groups = [];
  for (const r of mine) {
    const last = groups[groups.length - 1];
    if (last && r.verse <= last.end) {
      last.end = Math.max(last.end, lastOf(r));
      last.records.push(r);
    } else {
      groups.push({ start: r.verse, end: lastOf(r), records: [r] });
    }
  }
  const have = verses ? new Set(verses) : null;
  return groups.map((g) => {
    const inRange = [];
    for (let v = g.start; v <= g.end; v++) if (!have || have.has(v)) inRange.push(v);
    const notes = [];
    for (const r of [...g.records].sort((a, b) => String(a.created).localeCompare(String(b.created)))) {
      const note = typeof r.body === "string" ? r.body.trim() : "";
      if (note && !notes.includes(note)) notes.push(note);
    }
    return {
      ids: g.records.map((r) => r.id),
      start: g.start,
      end: g.end,
      verses: inRange,
      notes,
      revealed: g.records.every((r) => revealed.has(r.id)),
    };
  });
}

/** The verses of a chapter that are hidden right now: every verse of every passage not shown. */
export function hiddenVerses(groups) {
  const out = new Set();
  for (const g of groups) if (!g.revealed) for (const v of g.verses) out.add(v);
  return out;
}

/**
 * Whether any verse from `start` to `end` of a chapter is hidden now. What a
 * verse menu, a reference preview, a search result and a margin note ask.
 */
export function coversRange(records, bookKey, chapter, start, end = start, revealed = new Set()) {
  const hidden = hiddenVerses(planHidden(records, { bookKey, chapter, revealed }));
  for (let v = start; v <= end; v++) if (hidden.has(v)) return true;
  return false;
}

/** The passage a verse is in, or null. */
export function groupAt(groups, verse) {
  return groups.find((g) => verse >= g.start && verse <= g.end) ?? null;
}

/** "John 3:3" or "John 3:3–5" for a passage. */
export function passageRef(bookKey, chapter, start, end = start) {
  const base = `${bookKeyToLabel(bookKey)} ${chapter}:${start}`;
  return end > start ? `${base}–${end}` : base;
}

/**
 * What the veil over a passage says. `hideNotes` is M1: the passage stays
 * hidden but the reader's note to self is not shown.
 *
 * @returns {{ title: string, ref: string, note: string, name: string }}
 *   `name` is the one phrase a screen reader hears at the passage's start.
 */
export function veilText(group, { bookKey, chapter, hideNotes = false }) {
  const ref = passageRef(bookKey, chapter, group.start, group.end);
  const title = hideNotes ? "Passage hidden" : "Passage hidden by your note";
  const note = hideNotes ? "" : group.notes.join("\n\n");
  return { title, ref, note, name: `${title}, ${ref}` };
}

/**
 * The fields a new `hidden` record keeps (createRecord adds the rest). The
 * note is plain text, trimmed, and left off when empty.
 */
export function hiddenFields({ bookKey, chapter, start, end = start, note = "" }) {
  const lo = Math.min(start, end);
  const hi = Math.max(start, end);
  const body = String(note ?? "").trim();
  return { bookKey, chapter, verse: lo, endVerse: hi, ...(body ? { body } : {}) };
}

/**
 * What the early step in desk-gate.js reads before the notebook has opened:
 * { "john-3": [[3, 5], …] }, each chapter's records as [verse, endVerse].
 * Only where each passage sits, never a note to self.
 */
export function earlyCache(records) {
  const out = {};
  for (const r of hiddenRecords(records)) {
    const key = `${r.bookKey}-${r.chapter}`;
    (out[key] ??= []).push([r.verse, lastOf(r)]);
  }
  return out;
}
