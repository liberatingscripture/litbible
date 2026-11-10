// src/lib/desk-sheet-lit.mjs
//
// What a sheet knows about the LIT (STUDY-DESK.md, "Order of work", 3h): the
// key terms box (S3), blanks (S10), which footnotes print and which would give
// a blank away (C15), and the commercial-quotation check (S7). The rules only;
// the sheet pane reads the chapters and draws (src/scripts/desk/sheets/sheet-lit.js).
// Pure: a chapter is anchor-core's shape ({ verses, spans, text }), built from
// the chapter's Chapter View page by whoever has it, and the term data is that
// page's own #term-lens-data.
//
// Everything here is worked out live from today's text, as the format asks
// (STUDY-DESK-FORMAT.md, "Sheets (kind 9)"): the key terms box stores only the
// terms the leader took out, a blank stores its words and their context, and
// a footnote choice stores the footnote's text, never its letter.

import { BOOKS } from "../data/books.js";
import { verseCount } from "../data/verse-counts.js";
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

/**
 * The words of chapter text [start, end) as [start, end) pairs, for the
 * keyboard word cursor (DK-1). A word is a run of letters and digits; an
 * apostrophe or hyphen joins two letters, as `wholeWords` in sheet-lit.js
 * snaps a mouse selection.
 */
export function wordSpans(text, start, end) {
  const out = [];
  const re = /[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu;
  const slice = text.slice(start, end);
  for (let m = re.exec(slice); m; m = re.exec(slice)) out.push([start + m.index, start + m.index + m[0].length]);
  return out;
}

/**
 * The word cursor's geometry (pure, so it is tested without a layout engine).
 * `rects` holds one box for each word of `wordSpans`, as the page draws it
 * ({ left, right, top, bottom }, or null where a word has none). A line is a
 * run of words whose vertical middle falls inside the line's own band, in
 * reading order, which is how a wrapped paragraph and a poem's broken lines
 * both come out right. Returns the words' indexes, a line at a time, and which
 * line each word is on.
 */
export function wordLines(rects) {
  const lines = [];
  const lineOf = [];
  let band = null;
  rects.forEach((r, i) => {
    if (!r) {
      lineOf[i] = lines.length ? lines.length - 1 : -1;
      if (lines.length) lines[lines.length - 1].push(i);
      return;
    }
    const mid = (r.top + r.bottom) / 2;
    if (!band || mid < band.top || mid > band.bottom) {
      band = { top: r.top, bottom: r.bottom };
      lines.push([]);
    } else {
      band.top = Math.min(band.top, r.top);
      band.bottom = Math.max(band.bottom, r.bottom);
    }
    lines[lines.length - 1].push(i);
    lineOf[i] = lines.length - 1;
  });
  return { lines, lineOf };
}

/** How far a point `x` is from a box's left and right edges (0 inside). */
function across(r, x) {
  if (!r) return Infinity;
  return x < r.left ? r.left - x : x > r.right ? x - r.right : 0;
}

/** The word of `line` (indexes) nearest across to `x`; the first of a tie. */
function nearestAcross(rects, line, x) {
  let best = line[0];
  let bestD = Infinity;
  for (const i of line) {
    const d = across(rects[i], x);
    if (d < bestD) {
      best = i;
      bestD = d;
    }
  }
  return best;
}

/**
 * The word an Up (`dir` -1) or Down (+1) arrow moves to from word `from`: on
 * the line above or below, the one nearest across to `goalX` (the column the
 * reader started the run of up and down presses at, so a short line doesn't
 * drag the cursor left for good). Past the first or last line it goes to the
 * first or last word, as a text field's arrows do. With no layout to read (no
 * box for `from`) it steps a word.
 */
export function wordOnLine(rects, from, dir, goalX) {
  const last = rects.length - 1;
  if (!rects[from]) return Math.max(0, Math.min(last, from + dir));
  const { lines, lineOf } = wordLines(rects);
  const to = lineOf[from] + dir;
  if (to < 0) return 0;
  if (to >= lines.length) return last;
  return nearestAcross(rects, lines[to], goalX);
}

/**
 * The word under a point, or the nearest one: the line whose band is nearest
 * `y` (the gaps between lines belong to a neighbor), then the word nearest
 * across. Null when there are no boxes at all.
 */
export function wordAtPoint(rects, x, y) {
  const { lines } = wordLines(rects);
  let line = null;
  let lineD = Infinity;
  for (const ln of lines) {
    const boxes = ln.map((i) => rects[i]).filter(Boolean);
    if (!boxes.length) continue;
    const top = Math.min(...boxes.map((r) => r.top));
    const bottom = Math.max(...boxes.map((r) => r.bottom));
    const d = y < top ? top - y : y > bottom ? y - bottom : 0;
    if (d < lineD) {
      line = ln;
      lineD = d;
    }
  }
  return line ? nearestAcross(rects, line, x) : null;
}

/**
 * The words a chosen run of chapter text [start, end) touches, as the first
 * and last word's indexes in `list` (wordSpans' pairs), or null when it
 * touches none (punctuation alone). A mouse selection becomes the keyboard
 * cursor this way, so the arrows carry on from it.
 */
export function wordsTouching(list, start, end) {
  let lo = -1;
  let hi = -1;
  list.forEach(([s, e], i) => {
    if (e > start && s < end) {
      if (lo < 0) lo = i;
      hi = i;
    }
  });
  return lo < 0 ? null : [lo, hi];
}

/** Whether chapter text [start, end) overlaps any of the located blanks. */
export function overlapsBlank(located, start, end) {
  return located.some((b) => b.start != null && b.start < end && start < b.end);
}

/**
 * The blanks that cover any of the words from `start` to `end`, for filling
 * words in again from a selection (BVJ, 2026-11-09: a blank could be removed
 * only from the list below the passage, which no one looked for). A blank is
 * one unit, so a selection touching part of it fills in all of it.
 */
export function blanksTouching(located, start, end) {
  return located.filter((b) => b.start != null && b.start < end && start < b.end);
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

/**
 * The blanks of one passage as the editor lists them (SH5-9): the blanks that
 * render one glossary term share a row, so a key term blanked four times has
 * one hint and one remove, not four. A blank with no term (words chosen by
 * selection or keyboard), a blank that no longer prints, and one whose words
 * changed since it was chosen (it carries a notice of its own) each keep a row
 * of their own. Rows are in order of first occurrence in the passage; a blank
 * that can't be found goes last, in the order given.
 *
 * `key` is stable across redraws, for the focus restore: `term-<id>` for a
 * term's row, `blank-<id>` for a single. `hint` and `hintText` are the
 * blanks' own when they agree and `hint: "mixed"` (no text) when they don't.
 *
 * @param {{ blank: { id: string, verse: number, hint?: string, hintText?: string },
 *   start: number | null, end: number | null, prints: boolean, status?: string }[]} located
 * @param {{ start: number, end: number, id: string }[]} marks the chapter's term marks
 * @param {Record<string, { traditional: string }>} terms
 * @returns {{ key: string, termId: string | null, blanks: object[], verses: number[],
 *   hint: string, hintText: string }[]}
 */
export function groupBlanks(located, marks, terms) {
  const rank = (b) => (b.start == null ? Infinity : b.start);
  const ordered = located
    .map((b, i) => [b, i])
    .sort(([x, i], [y, j]) => {
      const a = rank(x);
      const b = rank(y);
      if (a !== b) return a < b ? -1 : 1;
      return x.blank.verse - y.blank.verse || i - j;
    })
    .map(([b]) => b);
  const groups = [];
  const byTerm = new Map();
  for (const b of ordered) {
    const term = b.prints && b.status !== "changed" ? termForWords(b.start, b.end, marks, terms) : null;
    if (term && byTerm.has(term.id)) {
      byTerm.get(term.id).blanks.push(b);
      continue;
    }
    const group = { key: term ? `term-${term.id}` : `blank-${b.blank.id}`, termId: term ? term.id : null, blanks: [b] };
    groups.push(group);
    if (term) byTerm.set(term.id, group);
  }
  for (const g of groups) {
    g.verses = [...new Set(g.blanks.map((b) => b.blank.verse))].sort((a, b) => a - b);
    const signature = (x) => `${x.blank.hint ?? "none"}|${x.blank.hint === "custom" ? (x.blank.hintText ?? "") : ""}`;
    const same = g.blanks.every((x) => signature(x) === signature(g.blanks[0]));
    g.hint = same ? (g.blanks[0].blank.hint ?? "none") : "mixed";
    g.hintText = same && g.hint === "custom" ? (g.blanks[0].blank.hintText ?? "") : "";
  }
  return groups;
}

/**
 * How many blanks that render the glossary term `termId` stay blank once
 * those with the ids in `removing` are filled in (SH5-17), for the sentence
 * that announces a removal. Counts printing blanks only.
 */
export function termBlanksLeft(located, marks, terms, termId, removing) {
  if (!termId) return 0;
  const gone = new Set(removing);
  return located.filter((b) => b.prints && !gone.has(b.blank.id) && termForWords(b.start, b.end, marks, terms)?.id === termId).length;
}

/**
 * Verse numbers as a short label: "v. 2" for one, "vv. 2, 3" for several, a
 * run of three or more as a range ("vv. 2–4, 7").
 */
export function verseLabel(verses) {
  const list = [...new Set(verses)].sort((a, b) => a - b);
  if (list.length <= 1) return `v. ${list[0] ?? ""}`.trim();
  const parts = [];
  for (let i = 0; i < list.length; ) {
    let j = i;
    while (j + 1 < list.length && list[j + 1] === list[j] + 1) j++;
    if (j - i >= 2) parts.push(`${list[i]}–${list[j]}`);
    else for (let k = i; k <= j; k++) parts.push(String(list[k]));
    i = j + 1;
  }
  return `vv. ${parts.join(", ")}`;
}

/* ── Footnotes that give a blank away ───────────────────────────────── */

// Stems are for words of MIN_LETTERS or more, and common ones never decide it:
// "that" in a note gives nothing away. A shorter word is not stemmed ("sin"
// would match "since"); it is held WHOLE against the note's words, so a blank
// on "God", "joy", "law", "sin" or "Son" is given away by a note that uses the
// word, and is not by "since" or "lawful" (BA76). Only a grammatical word is
// skipped there (SHORT_FUNCTION), never a content word like "god" or "all".
const MIN_LETTERS = 4;
const COMMON = new Set(
  ("that this with from they them their have will were what when your which into than then there these those " +
    "been also because about would could should upon unto shall does were being some such only even very more " +
    "most other over each them same just like").split(" "),
);
// Words under MIN_LETTERS that carry no content, plus the fragments an
// apostrophe leaves ("God's" splits into "god" and "s"; "'ll", "'re", "'ve").
const SHORT_FUNCTION = new Set(
  ("a an the and or nor but so yet of to in on at by for as is be am are was it its he she we you i me my his her " +
    "our us him not no do did has had if who how why can may too any out off per via ll re ve").split(" "),
);

function wordsOf(text) {
  return foldDiacritics(String(text ?? "")).toLowerCase().split(/[^\p{L}]+/u);
}

/** The stems of a text's words that are long and uncommon enough to give a blank away. */
export function telltaleStems(text) {
  const stems = new Set();
  for (const raw of wordsOf(text)) {
    if (raw.length < MIN_LETTERS || COMMON.has(raw)) continue;
    stems.add(stemWord(raw));
  }
  return stems;
}

// A text's short content words, folded, as whole words (BA76).
function shortWordsOf(text) {
  const shorts = new Set();
  for (const raw of wordsOf(text)) {
    if (raw.length >= 2 && raw.length < MIN_LETTERS && !SHORT_FUNCTION.has(raw)) shorts.add(raw);
  }
  return shorts;
}

/**
 * The blanks a footnote would give away: those with a word whose stem the
 * footnote shares ("deviating" is given away by a note reading "people
 * characterized by deviation"), or a short content word the footnote uses
 * whole ("God", "joy", "law"; BA76), or whose `telltale` (blankWords: the
 * traditional word a hint doesn't show) the footnote names. Errs toward
 * flagging, since a flag only asks the leader to decide (C15).
 *
 * @param {string} footnoteText
 * @param {{ exact: string, telltale?: string }[]} blanks
 */
export function blanksGivenAway(footnoteText, blanks) {
  const inNote = wordsInOf(footnoteText);
  if (!inNote.stems.size && !inNote.shorts.size) return [];
  return blanks.filter((b) => sharesWords(inNote, wordsInOf(b.exact)) || (!!b.telltale && sharesWords(inNote, wordsInOf(b.telltale))));
}

// Whether two texts' words (wordsInOf) share a stem or a short content word.
function sharesWords(a, b) {
  for (const s of b.stems) if (a.stems.has(s)) return true;
  for (const w of b.shorts) if (a.shorts.has(w)) return true;
  return false;
}

/**
 * What a printed blank can be given away by (SH5-16): its words, and the
 * traditional word of the glossary term they render when the hint beneath
 * the blank does not already show it. With "No hint," a footnote reading
 * "Traditionally, 'flesh'" beside a blank on "self-preservation" hands the
 * answer over, so that word counts as the blank's too (`telltale`). With the
 * traditional hint it is printed under the blank already, and a leader's own
 * hint that names it says as much, so neither adds one. `b` is one of the
 * passage's located blanks (locateBlanks) and `text` its chapter's anchor text.
 *
 * @param {{ blank: { hint?: string, hintText?: string }, start: number | null, end: number | null }} b
 * @param {{ start: number, end: number, id: string }[]} marks the chapter's term marks
 * @param {Record<string, { traditional: string }>} terms
 * @returns {{ exact: string, telltale?: string }}
 */
export function blankWords(b, text, marks, terms) {
  const exact = text.slice(b.start, b.end);
  if (b.blank.hint === "traditional" || b.start == null) return { exact };
  const term = termForWords(b.start, b.end, marks, terms);
  if (!term) return { exact };
  if (b.blank.hint === "custom" && blanksGivenAway(b.blank.hintText ?? "", [{ exact: term.traditional }]).length) return { exact };
  return { exact, telltale: term.traditional };
}

// The stems and short words of each text, worked out once: every footnote of
// every passage is held against every blank on the sheet on each redraw, so the
// same few thousand blank words were being stemmed again per footnote, per
// passage (BA133). Bounded, and private, so no caller can change a cached set.
const WORDS_CACHE_LIMIT = 10000;
const wordsCache = new Map();

function wordsInOf(text) {
  const key = String(text ?? "");
  let words = wordsCache.get(key);
  if (!words) {
    if (wordsCache.size >= WORDS_CACHE_LIMIT) wordsCache.clear();
    words = { stems: telltaleStems(key), shorts: shortWordsOf(key) };
    wordsCache.set(key, words);
  }
  return words;
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
 * written in (Select all and Clear all pass every footnote of the
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
    .replace(/&amp;/g, "&")
    // Zero-width characters print nothing, so they are no words (GF8b-11).
    .replace(/[​-‍⁠﻿]/g, "");
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
        // A passage runs no further than its chapter (GF8c-1).
        const last = Math.min(p.endVerse ?? p.verse, verseCount(book, c));
        for (let v = p.verse; v <= last; v++) covered.add(v);
      }
      whole = verses.every((v) => covered.has(v));
    }
    if (whole) out.push(book);
  }
  return out;
}
