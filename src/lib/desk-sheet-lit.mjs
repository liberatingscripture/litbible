// src/lib/desk-sheet-lit.mjs
//
// What a sheet knows about the LIT (STUDY-DESK.md, "Order of work", 3h): the
// key terms box (S3), blanks (S10), which footnotes print and which would give
// a blank away (C15), and the commercial-quotation check (S7). The rules only;
// the sheet pane reads the chapters and draws (src/scripts/desk/sheet-lit.js).
// Pure: a chapter is anchor-core's shape ({ verses, spans, text }), built from
// the chapter's Study View page by whoever has it, and the term data is that
// page's own #term-lens-data.
//
// Everything here is worked out live from today's text, as the format asks
// (STUDY-DESK-FORMAT.md, "Sheets (kind 9)"): the key terms box stores only the
// terms the leader took out, a blank stores its words and their context, and
// a footnote choice stores the footnote's text, never its letter.

import { BOOKS } from "../data/books.js";
import { makeAnchor, rangeOf, resolveAnchor } from "./anchor-core.mjs";
import { wordingKey } from "./desk-wording.mjs";
import { foldDiacritics, stemWord } from "./word-stem.mjs";

/* ── Key terms ──────────────────────────────────────────────────────── */

/**
 * A term's traditional word as a sheet prints it: lowercase, without the
 * glossary's own disambiguator ("Good [2]" is "good"), which tells two entries
 * apart on /glossary and means nothing on a handout.
 */
export function traditionalWord(term) {
  return String(term?.traditional ?? "").replace(/\s*\[\d+\]\s*$/, "").toLowerCase();
}

/**
 * The term lens's marks for one chapter as [start, end) offsets in the
 * chapter's anchor text, in reading order. A mark is "the kth
 * case-insensitive occurrence of this text in verse v" (term-lens.mjs); this
 * finds it in the verse's anchor text, which reads the verse the way the lens
 * does (verse numbers and footnote letters out, spacing collapsed). As on the
 * page, two marks claiming the same words keep the first, and a mark whose
 * text isn't where the build said is skipped, never guessed.
 *
 * @param {{ text: string, spans: Map<number, [number, number]> }} chapter
 * @param {{ marks?: { v: number, text: string, k: number, id: string, form?: string, g?: number }[] } | null} termData
 * @returns {{ start: number, end: number, id: string, v: number, g?: number }[]}
 */
export function termMarkOffsets(chapter, termData) {
  const out = [];
  for (const mark of termData?.marks ?? []) {
    const range = rangeOf(chapter, mark.v, mark.v);
    if (!range || !mark.text) continue;
    const hay = chapter.text.slice(range[0], range[1]).toLowerCase();
    const needle = String(mark.text).replace(/\s+/g, " ").toLowerCase();
    let at = -1;
    for (let k = 0, from = 0; k <= mark.k; k++) {
      at = hay.indexOf(needle, from);
      if (at === -1) break;
      from = at + 1;
    }
    if (at === -1) continue;
    const start = range[0] + at;
    const end = start + needle.length;
    if (out.some((m) => start < m.end && m.start < end)) continue;
    out.push(mark.g === undefined ? { start, end, id: mark.id, v: mark.v } : { start, end, id: mark.id, v: mark.v, g: mark.g });
  }
  return out.sort((a, b) => a.start - b.start);
}

/** The marks that overlap chapter text [start, end). */
export function marksInRange(marks, start, end) {
  return marks.filter((m) => m.start < end && start < m.end);
}

/**
 * The key terms box's terms, in the order the sheet's passages first use
 * them. Each passage hands in the marks it covers and its chapter's term
 * data; the words printed for a mark are read from its chapter's text. A
 * rendering split by another word (one record, several marks sharing `g`)
 * reads as its pieces joined, "speaks about … contemptuously", as on the
 * term lens's card. Renderings repeat once each, compared without case; the
 * first casing met is kept.
 *
 * @param {{ chapter: { text: string }, marks: { start: number, end: number, id: string, g?: number }[],
 *   terms: Record<string, { traditional: string, greek: string, title?: string }> }[]} passages
 * @param {string[]} [omit] glossary ids the leader took out
 * @returns {{ id: string, renderings: string[], traditional: string, greek: string, title: string, omitted: boolean }[]}
 */
export function collectKeyTerms(passages, omit = []) {
  const byId = new Map();
  for (const { chapter, marks, terms } of passages) {
    const seenGroups = new Set();
    for (const m of marks) {
      const info = terms?.[m.id];
      if (!info) continue;
      let words;
      if (m.g === undefined) {
        words = chapter.text.slice(m.start, m.end);
      } else {
        if (seenGroups.has(m.g)) continue;
        seenGroups.add(m.g);
        words = marks
          .filter((x) => x.g === m.g)
          .map((x) => chapter.text.slice(x.start, x.end))
          .join(" … ");
      }
      let term = byId.get(m.id);
      if (!term) {
        term = {
          id: m.id,
          renderings: [],
          traditional: traditionalWord(info),
          greek: info.greek ?? "",
          title: info.title ?? "",
          omitted: omit.includes(m.id),
        };
        byId.set(m.id, term);
      }
      if (!term.renderings.some((r) => r.toLowerCase() === words.toLowerCase())) term.renderings.push(words);
    }
  }
  return [...byId.values()];
}

/**
 * One term as the box prints it: "self-preservation, traditionally flesh,
 * sarx" (S3). Several renderings are joined with " / ".
 */
export function keyTermLine(term) {
  const parts = [term.renderings.join(" / ")];
  if (term.traditional) parts.push(`traditionally ${traditionalWord(term)}`);
  if (term.greek) parts.push(term.greek);
  return parts.join(", ");
}

/* ── Blanks ─────────────────────────────────────────────────────────── */

/**
 * A blank over chapter text [start, end), as the format stores it:
 * { id, verse, exact, prefix, suffix, hint, hintText? }.
 *
 * @param {{ id: string, hint?: "none" | "traditional" | "custom", hintText?: string }} opts
 */
export function blankFromOffsets(chapter, start, end, { id, hint = "none", hintText } = {}) {
  const a = makeAnchor(chapter, start, end);
  const blank = { id, verse: a.verse, exact: a.exact, prefix: a.prefix, suffix: a.suffix, hint };
  if (hint === "custom") blank.hintText = hintText ?? "";
  return blank;
}

/**
 * Where a blank's words are today, inside its passage: { status, start, end,
 * prints }. `status` is resolveAnchor's; a blank found outside the passage's
 * words counts as "lost". It prints unless its words can't be found
 * ("verse" or "lost"); a "changed" blank prints over the closest match, and
 * the editor says so.
 *
 * @param {{ start: number, end: number }} passageAt where the passage's words are (locatePassage)
 * @param {number} endVerse the passage's last verse
 */
export function locateBlank(chapter, blank, passageAt, endVerse) {
  const r = resolveAnchor(chapter, {
    exact: blank.exact,
    prefix: blank.prefix ?? "",
    suffix: blank.suffix ?? "",
    verse: blank.verse,
    endVerse: Math.max(blank.verse, endVerse ?? blank.verse),
  });
  const inside = r.start != null && passageAt?.start != null && r.start >= passageAt.start && r.end <= passageAt.end;
  if ((r.status === "found" || r.status === "moved" || r.status === "changed") && inside) {
    return { ...r, prints: true };
  }
  if (r.status === "verse") return { status: "verse", start: null, end: null, prints: false };
  return { status: "lost", start: null, end: null, prints: false };
}

/** Whether chapter text [start, end) overlaps any of the located blanks. */
export function overlapsBlank(located, start, end) {
  return located.some((b) => b.start != null && b.start < end && start < b.end);
}

/**
 * The hint printed beneath a blank, or null for none: the leader's own words,
 * or "traditionally sin" for the glossary term the blanked words render,
 * looked up from today's term data so it never goes stale (format, "blank").
 * A traditional hint whose words no longer carry a term prints nothing.
 *
 * @param {{ start: number, end: number } | null} at where the blank is now
 * @param {{ start: number, end: number, id: string }[]} marks the chapter's term marks
 * @param {Record<string, { traditional: string }>} terms
 */
export function blankHint(blank, at, marks, terms) {
  if (blank.hint === "custom") return blank.hintText?.trim() || null;
  if (blank.hint !== "traditional" || at?.start == null) return null;
  const term = termForWords(at.start, at.end, marks, terms);
  return term ? `traditionally ${term.traditional}` : null;
}

/**
 * The glossary term the words [start, end) carry, from the first mark they
 * overlap: { id, traditional } or null, `traditional` as traditionalWord gives it.
 */
export function termForWords(start, end, marks, terms) {
  for (const m of marksInRange(marks, start, end)) {
    const t = terms?.[m.id];
    if (t?.traditional) return { id: m.id, traditional: traditionalWord(t) };
  }
  return null;
}

/* ── Footnotes that give a blank away ───────────────────────────────── */

// Short and common words never decide it: "the" in a note gives nothing away.
const MIN_LETTERS = 4;
const COMMON = new Set(
  ("that this with from they them their have will were what when your which into than then there these those " +
    "been also because about would could should upon unto shall does were being some such only even very more " +
    "most other over each them same just like").split(" "),
);

/** The stems of a text's words that are long and uncommon enough to give a blank away. */
export function telltaleStems(text) {
  const stems = new Set();
  for (const raw of foldDiacritics(String(text ?? "")).toLowerCase().split(/[^\p{L}]+/u)) {
    if (raw.length < MIN_LETTERS || COMMON.has(raw)) continue;
    stems.add(stemWord(raw));
  }
  return stems;
}

/**
 * The blanks a footnote would give away: those with a word whose stem the
 * footnote shares ("deviating" is given away by a note reading "people
 * characterized by deviation"). Errs toward flagging, since a flag only asks
 * the leader to decide (C15).
 *
 * @param {string} footnoteText
 * @param {{ exact: string }[]} blanks
 */
export function blanksGivenAway(footnoteText, blanks) {
  const inNote = telltaleStems(footnoteText);
  if (!inNote.size) return [];
  return blanks.filter((b) => [...telltaleStems(b.exact)].some((s) => inNote.has(s)));
}

/* ── Which footnotes print ──────────────────────────────────────────── */

/**
 * A footnote's key in a passage's choices, as a pin names it (desk-footnotes,
 * pinFields): its verse, its full text and `n` among identical notes in that
 * verse, never its letter.
 *
 * @param {{ id: string, verse: number, text: string }[]} list the chapter's footnotes
 */
export function footnoteKey(list, id) {
  const note = list.find((f) => f.id === id);
  if (!note) return null;
  const twins = list.filter((f) => f.verse === note.verse && f.text === note.text);
  return { verse: note.verse, footnote: note.text, ...(twins.length > 1 ? { n: twins.indexOf(note) + 1 } : {}) };
}

const sameKey = (choice, key) =>
  choice.verse === key.verse && wordingKey(choice.footnote) === wordingKey(key.footnote) && (choice.n ?? 1) === (key.n ?? 1);

/**
 * The passage's footnotes with whether each prints. With no choice made, a
 * footnote prints unless it gives a blank away, in which case it is flagged
 * and left out until the leader decides (format, "footnote choices"). A
 * choice whose footnote has gone is ignored.
 *
 * @param {{ id: string, verse: number, text: string }[]} list the chapter's footnotes
 * @param {string[]} ids the footnotes in the passage, in order
 * @param {object[]} choices the passage module's `footnotes`
 * @param {{ exact: string }[]} blanks every blank on the sheet that prints
 * @returns {{ id: string, verse: number, text: string, print: boolean, decided: boolean, givesAway: object[] }[]}
 */
export function footnoteRows(list, ids, choices, blanks) {
  const rows = [];
  for (const id of ids) {
    const key = footnoteKey(list, id);
    if (!key) continue;
    const choice = (choices ?? []).find((c) => sameKey(c, key));
    const givesAway = blanksGivenAway(key.footnote, blanks);
    rows.push({
      id,
      verse: key.verse,
      text: key.footnote,
      print: choice ? choice.print === true : givesAway.length === 0,
      decided: !!choice,
      givesAway,
    });
  }
  return rows;
}

/**
 * The passage's choices with the leader's decision for some footnotes
 * written in (Select all and Unselect all pass every footnote of the
 * passage). Other choices are kept as they are.
 *
 * @param {object[]} choices
 * @param {{ id: string, verse: number, text: string }[]} list the chapter's footnotes
 * @param {string[]} ids
 * @param {boolean} print
 */
export function setFootnoteChoices(choices, list, ids, print) {
  const next = [...(choices ?? [])];
  for (const id of ids) {
    const key = footnoteKey(list, id);
    if (!key) continue;
    const at = next.findIndex((c) => sameKey(c, key));
    const choice = { ...key, print };
    if (at >= 0) next[at] = choice;
    else next.push(choice);
  }
  return next;
}

/* ── The commercial check ───────────────────────────────────────────── */

/** The share of a commercial work the license lets LIT material be (S7). */
export const COMMERCIAL_LIT_LIMIT = 0.5;

/** Words in plain text: runs between spaces that hold a letter or a digit. */
export function countWords(text) {
  return String(text ?? "")
    .split(/\s+/)
    .filter((t) => /[\p{L}\p{N}]/u.test(t)).length;
}

/** A sheet's formatted text as plain text, for counting (sanitized HTML only). */
export function htmlToText(html) {
  return String(html ?? "")
    .replace(/<(?:br|\/?(?:p|h2|h3|blockquote|ul|ol|li|hr))(?:\s[^>]*)?\/?>/gi, " ")
    .replace(/<[^>]*>/g, "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&");
}

/**
 * How much of the work is LIT material: { lit, own, total, share, over }.
 * `share` is null for an empty sheet; `over` is true past the 50% the terms
 * allow.
 */
export function commercialShare(lit, own) {
  const total = lit + own;
  const share = total ? lit / total : null;
  return { lit, own, total, share, over: share != null && share > COMMERCIAL_LIT_LIMIT };
}

/**
 * The books every one of whose chapters a passage touches. Only these can be
 * quoted whole, so only their verses need reading (completeBooks).
 *
 * @param {{ bookKey: string, chapter: number }[]} passages
 */
export function booksToCheck(passages) {
  const chapters = new Map();
  for (const p of passages) {
    if (!chapters.has(p.bookKey)) chapters.set(p.bookKey, new Set());
    chapters.get(p.bookKey).add(p.chapter);
  }
  return [...chapters].filter(([book, set]) => BOOKS[book] && set.size === BOOKS[book]).map(([book]) => book);
}

/**
 * The books the passages quote whole: every verse of every chapter. A passage
 * starting or ending inside a verse counts that verse, so this errs toward
 * saying a book is complete. A chapter whose verses aren't known (a draft, or
 * not loaded) keeps its book from counting.
 *
 * @param {{ bookKey: string, chapter: number, verse: number, endVerse?: number }[]} passages
 * @param {(bookKey: string, chapter: number) => number[] | null} versesOf
 */
export function completeBooks(passages, versesOf) {
  const out = [];
  for (const book of booksToCheck(passages)) {
    let whole = true;
    for (let c = 1; c <= BOOKS[book] && whole; c++) {
      const verses = versesOf(book, c);
      if (!verses?.length) {
        whole = false;
        break;
      }
      const covered = new Set();
      for (const p of passages) {
        if (p.bookKey !== book || p.chapter !== c) continue;
        for (let v = p.verse; v <= (p.endVerse ?? p.verse); v++) covered.add(v);
      }
      whole = verses.every((v) => covered.has(v));
    }
    if (whole) out.push(book);
  }
  return out;
}
