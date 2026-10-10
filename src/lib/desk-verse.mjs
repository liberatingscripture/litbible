// src/lib/desk-verse.mjs
//
// The pure rules for the Notebook's "This verse" tab (STUDY-DESK.md N10) and
// for a verse number naming the reader's notes and highlights (STUDY-DESK.md,
// "Still open": "How a screen reader learns a verse has notes"; the highlights
// came in phase 1c). Positions and records in, answers out, so Node can test
// what the page does. The page side is src/scripts/desk/verse-labels.js for the
// verse numbers, and the panel's "This verse" tab for the rest.
//
// A record on the text carries `bookKey`, `chapter`, `verse` and, for a range,
// `endVerse`. An absent `endVerse`, or one equal to `verse`, is a single verse.
// Everything here works on one chapter's records, already narrowed by the
// caller (desk-store-core's forChapter).

import { COLORS } from "./desk-records.mjs";

/** A record's verses as { from, to }, or null for one with no verse to speak of. */
function span(record) {
  const from = record?.verse;
  if (typeof from !== "number" || !Number.isFinite(from)) return null;
  const end = record.endVerse;
  const to = typeof end === "number" && Number.isFinite(end) ? Math.max(from, end) : from;
  return { from, to };
}

/**
 * The records whose verses cover `verse`, in the order given. A record with no
 * numeric `verse` (a label, a sheet, a note on the whole chapter) covers none.
 */
export function recordsOnVerse(records, verse) {
  return (records ?? []).filter((r) => {
    const s = span(r);
    return s !== null && s.from <= verse && verse <= s.to;
  });
}

/**
 * The verse beside `verse` on the page, for stepping through "This verse".
 * `verses` is the list of verse numbers the page actually has, which may skip
 * (Matthew 17 has no verse 21) and need not arrive sorted. `step` is -1 for the
 * verse before and +1 for the one after. Null at the chapter's edge. `verse`
 * need not be in the list: the answer is then the nearest one in that direction.
 */
export function adjacentVerse(verses, verse, step) {
  const have = (verses ?? []).filter((v) => typeof v === "number" && Number.isFinite(v)).sort((a, b) => a - b);
  if (step < 0) {
    for (let i = have.length - 1; i >= 0; i--) if (have[i] < verse) return have[i];
    return null;
  }
  if (step > 0) {
    for (const v of have) if (v > verse) return v;
  }
  return null;
}

/**
 * How many of the reader's notes cover each verse: a Map from verse number to
 * count. Only notes count (a bookmark marks a place and says nothing), and a
 * note on verses 3 to 5 counts once on each of 3, 4 and 5. A verse no note
 * covers is not in the map.
 */
export function noteCounts(records) {
  const counts = new Map();
  for (const r of records ?? []) {
    if (r?.kind !== "note") continue;
    const s = span(r);
    if (!s) continue;
    for (let v = s.from; v <= s.to; v++) counts.set(v, (counts.get(v) ?? 0) + 1);
  }
  return counts;
}

/**
 * Which highlight colours cover each verse: a Map from verse number to the
 * colours, each once, in COLORS order (yellow, green, blue, pink). Only
 * highlights count, and only one with a colour in COLORS: a note or bookmark
 * says nothing about colour, and an unknown colour is not one the page draws. A
 * highlight on verses 3 to 5 covers each of 3, 4 and 5. A verse no highlight
 * covers is not in the map.
 */
export function highlightColors(records) {
  const seen = new Map(); // verse -> Set of colours
  for (const r of records ?? []) {
    if (r?.kind !== "highlight" || !COLORS.includes(r.color)) continue;
    const s = span(r);
    if (!s) continue;
    for (let v = s.from; v <= s.to; v++) {
      if (!seen.has(v)) seen.set(v, new Set());
      seen.get(v).add(r.color);
    }
  }
  const colors = new Map();
  for (const [v, set] of seen) colors.set(v, COLORS.filter((c) => set.has(c)));
  return colors;
}

/** "yellow", "yellow and pink", "yellow, green and pink": no comma before the last "and". */
function joinWords(words) {
  if (words.length < 2) return words.join("");
  return `${words.slice(0, -1).join(", ")} and ${words[words.length - 1]}`;
}

/**
 * A Study View verse number's accessible name. It names the reader's highlights
 * and notes on the verse, colours first: "Verse 1", "Verse 1, highlighted
 * yellow", "Verse 1, 1 note of mine", "Verse 1, highlighted yellow and pink, 2
 * notes of mine". `colors` is a list of colour names as highlightColors gives
 * them. A missing or empty list, and a missing count, are none. Colours are
 * named in COLORS order whatever order they arrive in, and a name not in COLORS
 * is left out, so the label always matches what the page draws.
 *
 * `changed` is how many of those marks carry a change notice (N3, the wording
 * moved since the reader marked it), counted by the caller from the same marks
 * that supply the colours and the note count. Last in the label, because it
 * qualifies what came before: "Verse 3, highlighted yellow, 1 note of mine, 1
 * changed since I marked it" or "… 2 changed since I marked them". None adds
 * nothing.
 */
export function verseLabel(verse, noteCount, colors = [], changed = 0) {
  const n = Number(noteCount) || 0;
  const c = Number(changed) || 0;
  const shown = COLORS.filter((color) => (colors ?? []).includes(color));
  const parts = [`Verse ${verse}`];
  if (shown.length) parts.push(`highlighted ${joinWords(shown)}`);
  if (n > 0) parts.push(`${n} ${n === 1 ? "note" : "notes"} of mine`);
  if (c > 0) parts.push(`${c} changed since I marked ${c === 1 ? "it" : "them"}`);
  return parts.join(", ");
}
