// src/lib/anchor-core.mjs
//
// The pure half of the Study Desk's anchor text (STUDY-DESK-FORMAT.md): the
// normalization every client applies, how an anchor is made from a stretch of
// chapter text, and how it is found again after the wording moves.
//
// Lives in src/lib/ (not scripts/lib/) because both worlds need it, the same
// arrangement as bracket-markers.mjs: scripts/lib/anchor-text.mjs, the
// reference implementation the apps' test vectors come from, builds a chapter
// from its JSON paragraphs; src/lib/desk-anchor-dom.mjs builds the same chapter
// from the page the reader is looking at. Both hand the result to the functions
// here, so the website and the vectors can't disagree on how a mark is placed.
//
// A "chapter" here is { verses, spans, text }: each verse's anchor text, the
// [start, end) of each verse in the chapter text, and the chapter text itself
// (verses in order, joined by one space). Offsets are UTF-16 code units, which
// is how JavaScript, Kotlin and Swift's `utf16` view all count; they exist for
// tests and drawing, and are never stored in a shared record.

import { stripBracketMarkers } from "./bracket-markers.mjs";

// 2 since audit FA1-f (2026-10-26): rule e's guards, MIN_CONTEXT and CHANGED_GROWTH.
export const ANCHOR_SPEC_VERSION = 2;

/** Characters of context stored either side of the quoted words. */
export const CONTEXT_LENGTH = 32;

// Zero-width space, non-joiner, joiner, word joiner, BOM, soft hyphen.
export const INVISIBLE = /[​-‍⁠﻿­]/g;

/**
 * The normalization every client applies to verse text AND to a stored quote
 * before comparing them. Quotes and dashes are kept exactly as written.
 */
export function normalizeAnchorText(text) {
  return stripBracketMarkers(
    String(text ?? "")
      .normalize("NFC")
      .replace(INVISIBLE, ""),
  )
    // Strip before collapsing (src/lib/bracket-markers.mjs, rule 1). `\s`
    // covers U+00A0, so a literal no-break space becomes a plain space here.
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * A chapter from its verses' anchor text: the verses in number order, joined
 * by one space, with each verse's span. Verses that are empty are left out.
 *
 * @param {Map<number, string>} verses verse number -> normalized anchor text
 */
export function assembleChapter(verses) {
  const ordered = new Map(
    [...verses].filter(([, t]) => t).sort((a, b) => a[0] - b[0]),
  );
  const spans = new Map();
  let text = "";
  for (const [n, t] of ordered) {
    if (text) text += " ";
    spans.set(n, [text.length, text.length + t.length]);
    text += t;
  }
  return { verses: ordered, spans, text };
}

/** The [start, end) range of chapter text covering verses `from`..`to`. */
export function rangeOf(chapter, from, to) {
  let start = null;
  let end = null;
  for (const [n, [s, e]] of chapter.spans) {
    if (n < from || n > to) continue;
    if (start === null) start = s;
    end = e;
  }
  return start === null ? null : [start, end];
}

/** The verse a chapter-text position falls in (the one before a gap). */
export function verseAt(chapter, pos) {
  let found = null;
  for (const [n, [s]] of chapter.spans) {
    if (s <= pos) found = n;
    else break;
  }
  return found;
}

/**
 * Make an anchor for chapter text [start, end): the verses it touches, the
 * quoted words, and up to CONTEXT_LENGTH characters either side. Context may
 * run across verse boundaries; it never runs past the chapter.
 */
export function makeAnchor(chapter, start, end) {
  const exact = chapter.text.slice(start, end);
  return {
    verse: verseAt(chapter, start),
    endVerse: verseAt(chapter, Math.max(start, end - 1)),
    exact,
    prefix: chapter.text.slice(Math.max(0, start - CONTEXT_LENGTH), start),
    suffix: chapter.text.slice(end, end + CONTEXT_LENGTH),
  };
}

function commonSuffix(a, b) {
  let i = 0;
  while (i < a.length && i < b.length && a[a.length - 1 - i] === b[b.length - 1 - i]) i++;
  return i;
}

function commonPrefix(a, b) {
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  return i;
}

/** Every start of `needle` in text[from, to). */
function occurrences(text, needle, from, to) {
  const out = [];
  if (!needle) return out;
  for (let i = text.indexOf(needle, from); i !== -1 && i + needle.length <= to; i = text.indexOf(needle, i + 1)) {
    out.push(i);
  }
  return out;
}

/**
 * Context that must agree, both ends together: for `changed`, what survives of
 * the stored context; for `found` and `moved`, what picks one of several
 * occurrences of the quoted words (rule e's context floor).
 */
export const MIN_CONTEXT = 8;

/**
 * Rule e's size limit: a `changed` region may be at most twice the quoted
 * words' length plus this many characters, so a short quote is never carried
 * to a whole clause.
 */
export const CHANGED_GROWTH = 16;

/**
 * The occurrence whose surroundings agree most with the stored context; the
 * first on a tie. With more than one occurrence, a choice is trusted only when
 * at least MIN_CONTEXT characters of context agree ("Amen." twice in a verse);
 * otherwise null, and resolveAnchor tries its next step. Null too for none.
 */
function bestByContext(chapter, starts, anchor) {
  let best = null;
  let bestScore = -1;
  for (const s of starts) {
    const e = s + anchor.exact.length;
    const score =
      commonSuffix(chapter.text.slice(Math.max(0, s - anchor.prefix.length), s), anchor.prefix) +
      commonPrefix(chapter.text.slice(e, e + anchor.suffix.length), anchor.suffix);
    if (score > bestScore) {
      best = s;
      bestScore = score;
    }
  }
  if (starts.length > 1 && bestScore < MIN_CONTEXT) return null;
  return best;
}

/**
 * Find an anchor in today's text. Every client runs these steps in this order
 * and shows the result; none writes a result back to the stored record unless
 * the reader acts on it (STUDY-DESK-FORMAT.md, "Finding a mark again").
 *
 *   found    the quoted words, in the anchor's verses
 *   moved    the quoted words, elsewhere in the chapter
 *   changed  the words are gone; the text now between the stored context,
 *            inside the anchor's verses, is shown instead and flagged
 *   verse    nothing usable; the mark falls back to its whole verse range
 *   lost     the anchor's verses no longer exist in the chapter
 *
 * Rule e's two guards (BDR, 2026-10-09; spec version 2): where the words occur
 * more than once, an occurrence is taken only when MIN_CONTEXT characters of
 * its context agree; and a `changed` region is never longer than twice the
 * quoted words plus CHANGED_GROWTH. Past either, that step doesn't succeed.
 *
 * @returns {{status: string, start: number|null, end: number|null}}
 */
export function resolveAnchor(chapter, anchor) {
  const exact = normalizeAnchorText(anchor.exact);
  const prefix = normalizeAnchorText(anchor.prefix);
  const suffix = normalizeAnchorText(anchor.suffix);
  // Normalizing trims, so restore the single space that separated the quote
  // from its context.
  const a = {
    exact,
    prefix: prefix && /\s$/.test(anchor.prefix) ? prefix + " " : prefix,
    suffix: suffix && /^\s/.test(anchor.suffix) ? " " + suffix : suffix,
  };
  const range = rangeOf(chapter, anchor.verse, anchor.endVerse ?? anchor.verse);

  // A step that finds something its guard won't trust doesn't succeed, and
  // the next step is tried (rule e).
  if (range && exact) {
    const s = bestByContext(chapter, occurrences(chapter.text, exact, range[0], range[1]), a);
    if (s !== null) return { status: "found", start: s, end: s + exact.length };
  }
  if (exact) {
    const s = bestByContext(chapter, occurrences(chapter.text, exact, 0, chapter.text.length), a);
    if (s !== null) return { status: "moved", start: s, end: s + exact.length };
  }
  if (!range) return { status: "lost", start: null, end: null };

  const between = textBetweenContext(chapter, a, range);
  if (between && between.end - between.start <= 2 * exact.length + CHANGED_GROWTH) {
    return { status: "changed", ...between };
  }
  return { status: "verse", start: range[0], end: range[1] };
}

/**
 * The words are gone. If what's left of the context still brackets some text
 * inside the anchor's verses, that text is the likeliest new wording: shown
 * and flagged, never adopted without the reader. The context's inner ends are
 * the ones kept, since a rewording usually eats into the edges of the context
 * too: the longest tail of the prefix and the longest head of the suffix that
 * still occur, in order, inside the range.
 */
function textBetweenContext(chapter, a, range) {
  const [lo, hi] = range;
  const window = chapter.text.slice(lo, hi);
  for (let sufLen = a.suffix.length; sufLen > 0; sufLen--) {
    const head = a.suffix.slice(0, sufLen).trim();
    if (!head) break;
    const q = window.indexOf(head);
    if (q === -1) continue;
    for (let preLen = a.prefix.length; preLen > 0; preLen--) {
      const tail = a.prefix.slice(a.prefix.length - preLen).trim();
      if (!tail) break;
      if (tail.length + head.length < MIN_CONTEXT) break;
      const p = window.lastIndexOf(tail, q - tail.length);
      if (p === -1) continue;
      let s = p + tail.length;
      let e = q;
      while (s < e && window[s] === " ") s++;
      while (e > s && window[e - 1] === " ") e--;
      if (e > s) return { start: lo + s, end: lo + e };
    }
    if (head.length < MIN_CONTEXT) break;
  }
  return null;
}
