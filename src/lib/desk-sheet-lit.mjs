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
import {
  markChoices,
  ownTraditional,
  tellingText,
  traditionalChoices,
  traditionalHint,
  traditionalWord,
  wordAlternatives,
} from "./term-words.mjs";
import { foldDiacritics, stemWord } from "./word-stem.mjs";

/* ── Key terms ──────────────────────────────────────────────────────── */

// An entry's traditional word as a sheet prints it ("Good [2]" is "good"),
// and a traditional word as a hint: both are term-words.mjs's, which the term
// lens's card shares, so a sheet and the page can't say different words.
export { traditionalHint, traditionalWord };

/**
 * The term lens's marks for one chapter as [start, end) offsets in the
 * chapter's anchor text, in reading order. A mark is "the kth
 * case-insensitive occurrence of this text in verse v" (term-lens.mjs); this
 * finds it in the verse's anchor text, which reads the verse the way the lens
 * does (verse numbers and footnote letters out, spacing collapsed). As on the
 * page, two marks claiming the same words keep the first, and a mark whose
 * text isn't where the build said is skipped, never guessed. `w`, the words
 * of the term's family the mark's verse holds (term-words.mjs), comes along
 * where the page gives it.
 *
 * @param {{ text: string, spans: Map<number, [number, number]> }} chapter
 * @param {{ marks?: { v: number, text: string, k: number, id: string, form?: string, g?: number, w?: number[] }[] } | null} termData
 * @returns {{ start: number, end: number, id: string, v: number, g?: number, w?: number[] }[]}
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
    const placed = { start, end, id: mark.id, v: mark.v };
    if (mark.g !== undefined) placed.g = mark.g;
    if (Array.isArray(mark.w)) placed.w = mark.w;
    out.push(placed);
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
 * `traditional` and `greek` are the words of the Greek words the passages'
 * verses actually hold, each once, in order of first use and joined with
 * " / ": "trusted" alone gives "believe" and "pisteuo", not its entry's
 * "faith" and "pistis" (term-words.mjs). A verse with two words of the family
 * adds both, since the box lists a term's words and need not say which
 * rendering goes with which. A term whose marks say nothing of their verses
 * keeps its entry's words.
 *
 * @param {{ chapter: { text: string }, marks: { start: number, end: number, id: string, g?: number, w?: number[] }[],
 *   terms: Record<string, { traditional: string, greek: string, title?: string, words?: [string, string][] }> }[]} passages
 * @param {string[]} [omit] glossary ids the leader took out
 * @returns {{ id: string, renderings: string[], traditional: string, greek: string, title: string, omitted: boolean }[]}
 */
export function collectKeyTerms(passages, omit = []) {
  const byId = new Map();
  const own = new Map();
  const add = (list, word) => {
    if (word && !list.includes(word)) list.push(word);
  };
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
          traditional: ownTraditional(info),
          greek: info.greek ?? "",
          title: info.title ?? "",
          omitted: omit.includes(m.id),
        };
        byId.set(m.id, term);
        own.set(m.id, { traditional: [], greek: [] });
      }
      if (!term.renderings.some((r) => r.toLowerCase() === words.toLowerCase())) term.renderings.push(words);
      const held = own.get(m.id);
      for (const choice of markChoices(info, m)) {
        add(held.traditional, choice.traditional);
        add(held.greek, choice.greek);
      }
    }
  }
  for (const term of byId.values()) {
    const held = own.get(term.id);
    if (held.traditional.length) term.traditional = held.traditional.join(" / ");
    if (held.greek.length) term.greek = held.greek.join(" / ");
  }
  return [...byId.values()];
}

/**
 * One term as the box prints it: "self-preservation, traditionally flesh,
 * sarx" (S3). Several renderings are joined with " / ". `term` is one of
 * collectKeyTerms', whose `traditional` is ready to print (a name keeps its
 * capital: "the Adversary, traditionally Satan, Satanas").
 */
export function keyTermLine(term) {
  const parts = [term.renderings.join(" / ")];
  if (term.traditional) parts.push(traditionalHint(term.traditional));
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
 * or "traditionally believe", the traditional word for the Greek word the
 * blanked words render, looked up from today's term data so it never goes
 * stale (format, "blank"). It is that Greek word's own, not its glossary
 * entry's for every blank (E85). A traditional hint prints nothing where the
 * words no longer carry a term, or where their verse holds more than one word
 * of the term's family with different traditional words: nothing says which
 * the blank renders, so the leader chooses one (the editor then stores it as
 * their own hint).
 *
 * @param {{ start: number, end: number } | null} at where the blank is now
 * @param {{ start: number, end: number, id: string, w?: number[] }[]} marks the chapter's term marks
 * @param {Record<string, { traditional: string, words?: [string, string][] }>} terms
 */
export function blankHint(blank, at, marks, terms) {
  if (blank.hint === "custom") return blank.hintText?.trim() || null;
  if (blank.hint !== "traditional" || at?.start == null) return null;
  const term = termForWords(at.start, at.end, marks, terms);
  return term?.traditional ? traditionalHint(term.traditional) : null;
}

/**
 * The glossary term the words [start, end) carry, from the first mark they
 * overlap, with the traditional word of the Greek word they render
 * (term-words.mjs): { id, traditional, choices } or null. `choices` are the
 * traditional words the mark could carry: one where its verse leaves no doubt,
 * and then `traditional` is it; several where the verse holds more than one
 * word of the term's family, and then `traditional` is null.
 *
 * @returns {{ id: string, traditional: string | null, choices: string[] } | null}
 */
export function termForWords(start, end, marks, terms) {
  for (const m of marksInRange(marks, start, end)) {
    const t = terms?.[m.id];
    if (!t?.traditional) continue;
    const choices = traditionalChoices(t, m);
    return { id: m.id, traditional: choices.length === 1 ? choices[0] : null, choices };
  }
  return null;
}

/**
 * Whether a traditional word is the blanked words themselves, compared
 * without case. The LIT keeps the traditional word in places ("faithful",
 * "demon", "clean"), and a hint naming it there would print the answer
 * beneath its own blank. Either side of a slashed word counts ("leave" under
 * "forgive/leave"). Only the word itself: "faithfulness" under "faith" is the
 * contrast a hint is for.
 *
 * @param {string | null | undefined} word a traditional word (termForWords')
 * @param {string} exact the blanked words
 */
export function hintIsAnswer(word, exact) {
  const answer = String(exact ?? "").trim().toLowerCase();
  return !!answer && wordAlternatives(word).some((alternative) => alternative.toLowerCase() === answer);
}

/**
 * The hint a new blank starts with (S10, E85): "traditional" where its words
 * carry a key term, their verse leaves no doubt which traditional word is
 * theirs, and that word is not the answer itself; otherwise "none". The row's
 * menu still offers the word, for a leader who wants it there.
 *
 * @param {string} exact the words to blank
 * @param {{ traditional: string | null } | null | undefined} term termForWords' for them
 * @returns {"traditional" | "none"}
 */
export function startingHint(exact, term) {
  return term?.traditional && !hintIsAnswer(term.traditional, exact) ? "traditional" : "none";
}

/**
 * The blanks of one passage as the editor lists them (SH5-9): the blanks that
 * render one glossary term with one traditional word share a row, so a key
 * term blanked four times has one hint and one remove, not four. A term whose
 * blanks render different words of its family ("trust" for pistis, "trusted"
 * for pisteuo) has a row for each, since one hint can't be true of both (E85).
 * A blank with no term (words chosen by selection or keyboard), a blank that
 * no longer prints, one whose words changed since it was chosen (it carries a
 * notice of its own), and one whose verse leaves its traditional word to be
 * chosen each keep a row of their own. Rows are in order of first occurrence
 * in the passage; a blank that can't be found goes last, in the order given.
 *
 * `key` is stable across redraws, for the focus restore: `term-<id>` for the
 * row of a term's own word, `term-<id>-<word>` for another word's, and
 * `blank-<id>` for a single. `hint` and `hintText` are the blanks' own when
 * they agree and `hint: "mixed"` (no text) when they don't. `termId`,
 * `traditional` and `choices` are termForWords' for the row's blanks: a
 * single with a choice to make has its term and choices and no `traditional`,
 * and any other single has none of the three.
 *
 * @param {{ blank: { id: string, verse: number, hint?: string, hintText?: string },
 *   start: number | null, end: number | null, prints: boolean, status?: string }[]} located
 * @param {{ start: number, end: number, id: string, w?: number[] }[]} marks the chapter's term marks
 * @param {Record<string, { traditional: string, words?: [string, string][] }>} terms
 * @returns {{ key: string, termId: string | null, traditional: string | null, choices: string[],
 *   blanks: object[], verses: number[], hint: string, hintText: string }[]}
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
  const byRow = new Map();
  for (const b of ordered) {
    const term = b.prints && b.status !== "changed" ? termForWords(b.start, b.end, marks, terms) : null;
    if (!term) {
      groups.push({ key: `blank-${b.blank.id}`, termId: null, traditional: null, choices: [], blanks: [b] });
      continue;
    }
    // A choice still to make is each blank's own: two blanks in one verse can
    // render different words of the family ("just" and "justness" in Romans
    // 4:5), so one menu for both could only be right for one of them.
    if (!term.traditional) {
      groups.push({ key: `blank-${b.blank.id}`, termId: term.id, traditional: null, choices: term.choices, blanks: [b] });
      continue;
    }
    // The entry's own word keeps the plain key; another word of the family
    // is named in it.
    const key = term.traditional.toLowerCase() === traditionalWord(terms?.[term.id]) ? `term-${term.id}` : `term-${term.id}-${term.traditional}`;
    if (byRow.has(key)) {
      byRow.get(key).blanks.push(b);
      continue;
    }
    const group = { key, termId: term.id, traditional: term.traditional, choices: term.choices, blanks: [b] };
    groups.push(group);
    byRow.set(key, group);
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
 * whole ("God", "joy", "law"; BA76), or whose `telltale` or `also`
 * (blankWords: the traditional words a hint doesn't show) the footnote names.
 * Of a traditional word that is a phrase, the telling words count and the
 * ones that carry them don't (`tellingText`): "have mercy" is named by
 * "mercy," and a note saying "makes" names nothing of "make atonement." Errs
 * toward flagging, since a flag only asks the leader to decide (C15).
 *
 * @param {string} footnoteText
 * @param {{ exact: string, telltale?: string, also?: string }[]} blanks
 */
export function blanksGivenAway(footnoteText, blanks) {
  const inNote = wordsInOf(footnoteText);
  if (!inNote.stems.size && !inNote.shorts.size) return [];
  return blanks.filter((b) => sharesWords(inNote, wordsInOf(b.exact)) || sharesWords(inNote, wordsInOf(tellsOf(b))));
}

// A blank's traditional words as one text for the comparison: its own and
// its entry's (blankWords), without the words that only carry them. Worked
// out once a blank: every footnote is held against every blank (BA133).
const tellsCache = new WeakMap();
function tellsOf(b) {
  let text = tellsCache.get(b);
  if (text === undefined) {
    text = tellingText([b.telltale, b.also].filter(Boolean).join(" / "));
    tellsCache.set(b, text);
  }
  return text;
}

/**
 * The traditional word a footnote's flag names beside a blank (SH5-16), and
 * whose it is: the blank's own (`telltale`), or its entry's (`also`) where
 * the footnote names that and neither the blank's words nor its own
 * traditional word, since that is then what gave the blank away. Null for a
 * blank with no traditional word to hide.
 *
 * @param {string} footnoteText
 * @param {{ exact: string, telltale?: string, also?: string }} b one of blankWords'
 * @returns {{ word: string, entry: boolean } | null}
 */
export function flaggedWord(footnoteText, b) {
  if (!b?.telltale) return null;
  if (b.also) {
    const inNote = wordsInOf(footnoteText);
    const names = (text) => sharesWords(inNote, wordsInOf(text));
    if (!names(b.exact) && !names(tellingText(b.telltale)) && names(tellingText(b.also))) return { word: b.also, entry: true };
  }
  return { word: b.telltale, entry: false };
}

// Whether two texts' words (wordsInOf) share a stem or a short content word.
function sharesWords(a, b) {
  for (const s of b.stems) if (a.stems.has(s)) return true;
  for (const w of b.shorts) if (a.shorts.has(w)) return true;
  return false;
}

/**
 * What a printed blank can be given away by (SH5-16): its words, and the
 * traditional word of the Greek word they render when the hint beneath the
 * blank does not already show it. With "No hint," a footnote reading
 * "Traditionally, 'flesh'" beside a blank on "self-preservation" hands the
 * answer over, so that word counts as the blank's too (`telltale`). With the
 * traditional hint it is printed under the blank already, and a leader's own
 * hint that names it says as much, so neither adds one. Where the verse holds
 * several words of the term's family, any of their traditional words tells:
 * the telltale is all of them, " / " between (a slash offers alternatives,
 * `wordAlternatives`), and a traditional hint there prints nothing, so it
 * hides none of them.
 *
 * `also` is the entry's own traditional word where the blank's is another
 * ("faith" beside "believe"): the word the glossary and most notes use for
 * the whole family, which gave such a blank away before each Greek word had
 * its own (E85), and still does. It is matched with the telltale and never
 * shown as the blank's word. `b` is one of the passage's located blanks
 * (locateBlanks) and `text` its chapter's anchor text.
 *
 * @param {{ blank: { hint?: string, hintText?: string }, start: number | null, end: number | null }} b
 * @param {{ start: number, end: number, id: string, w?: number[] }[]} marks the chapter's term marks
 * @param {Record<string, { traditional: string, words?: [string, string][] }>} terms
 * @returns {{ exact: string, telltale?: string, also?: string }}
 */
export function blankWords(b, text, marks, terms) {
  const exact = text.slice(b.start, b.end);
  if (b.start == null) return { exact };
  const term = termForWords(b.start, b.end, marks, terms);
  if (!term || !term.choices.length) return { exact };
  if (b.blank.hint === "traditional" && term.traditional) return { exact };
  const telltale = term.choices.join(" / ");
  const own = ownTraditional(terms?.[term.id]);
  let also = own && !term.choices.some((c) => c.toLowerCase() === own.toLowerCase()) ? own : null;
  if (b.blank.hint === "custom") {
    // A leader's hint that names a word shows it, so that word hides nothing.
    const names = (word) => blanksGivenAway(b.blank.hintText ?? "", [{ exact: tellingText(word) }]).length > 0;
    if (names(telltale)) return { exact };
    if (also && names(also)) also = null;
  }
  return also ? { exact, telltale, also } : { exact, telltale };
}

/**
 * The word a leader picked for a blank whose verse leaves its traditional
 * word in doubt, or null. The editor stores the pick as the blank's own hint
 * ("traditionally believe"), the record having nowhere else to say which,
 * and this reads it back, so a picked word behaves as a traditional hint
 * does (the editor's menu, present mode's cover).
 *
 * @param {{ hint?: string, hintText?: string } | null | undefined} blank
 * @param {{ traditional: string | null, choices: string[] } | null | undefined} term termForWords'
 * @returns {string | null}
 */
export function pickedChoice(blank, term) {
  if (blank?.hint !== "custom" || !term || term.traditional) return null;
  const text = blank.hintText?.trim();
  return (term.choices ?? []).find((word) => traditionalHint(word) === text) ?? null;
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
