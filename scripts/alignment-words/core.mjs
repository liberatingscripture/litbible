// Pure logic for the word-alignment tool (alignment phase 2). No fs, no http,
// no argv: store.mjs and server.mjs own all of that, so everything here is
// unit-testable with plain objects (test/alignment-words-core.test.js).
//
// WHAT THIS DATASET IS. Every SBLGNT word, linked to the LIT words that render
// it. It is phase 2 of the alignment dataset (CLAUDE.md, "The Alignment
// Dataset"), kept apart from phase 1's glossary records in src/data/alignment/:
// a chapter file there holds a few records per chapter and every site page
// reads all of them, whereas this is one record per Greek word group, roughly
// 138,000 tokens across the New Testament. Separate directory, separate tool,
// same link shape, so neither can swell or disturb the other.
//
//   src/data/alignment-words/<bookKey>-<chapter>.json
//   { "bookKey": "acts", "chapter": 1, "records": [ <one record per line> ] }
//
// A RECORD is one link, many-to-many:
//
//   { "ref": "Acts.1.1",
//     "greek":   [ { "t": 3, "form": "πρῶτον" } ],
//     "english": [ { "text": "first", "n": 1 } ] }
//
//   greek[].t     1-based position of the word in its SBLGNT verse (MorphGNT's
//                 own order), the anchor phase 1 already documents.
//   greek[].form  the word as SBLGNT prints it, punctuation stripped. It is a
//                 checksum as much as a label: if the Greek source ever moves
//                 under a record, the form stops matching and the record is
//                 reported stale instead of silently pointing at another word.
//   english[]     one piece per run of adjacent English words. A rendering split
//                 by words that render something else is ONE record with several
//                 pieces, exactly as in phase 1 ("speaks about … contemptuously").
//   english: []   the Greek has no rendering in the LIT (an article the English
//                 does without, say). A first-class answer, like phase 1's
//                 `no-rendering`.
//   greek: []     English the Greek did not supply ("that", an added "he").
//
// Every record in these files is a human decision, so the phase 1 fields that
// vary there (`status`, `source`, `confidence`, `lemma`) are constant here and
// not written: at 138,000 records they would be most of the file. There is no
// `term` either. A glossary term is JOINED in at read time from the lemma,
// which MorphGNT supplies and which we never copy into committed data, so a
// rendering is stored once and cannot disagree with itself.
//
// `n` is the nth case-insensitive occurrence of `text` within the verse, where
// an occurrence must begin and end on English word boundaries (so "in" is not
// found inside "beginning"). It is counted here, and recounted by the same
// function when a record is read, so a writer and a reader cannot disagree.
//
// A verse is COMPLETE when every Greek word and every English word belongs to
// some record. "Reviewed" is therefore derived, never a flag that can drift.

import { tokenizeWords } from "../alignment-review/review-core.mjs";

export { tokenizeWords };

/** An error the server can turn into a 4xx without importing a class from a module that promises "no http". */
function badRequest(message, statusCode = 400) {
  return Object.assign(new Error(message), { statusCode });
}

const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Every place `text` occurs in the verse that begins and ends on English word
 * boundaries, in order. Overlapping matches are kept ("a a" in "a a a"), since
 * the nth occurrence has to be well defined for any span the reviewer picks.
 */
export function spanMatches(verseText, tokens, text) {
  if (!text) return [];
  const starts = new Set(tokens.map((t) => t.start));
  const ends = new Set(tokens.map((t) => t.end));
  const re = new RegExp(escapeRegExp(text), "giu");
  const out = [];
  for (let m = re.exec(verseText); m; m = re.exec(verseText)) {
    re.lastIndex = m.index + 1;
    if (starts.has(m.index) && ends.has(m.index + m[0].length)) out.push(m.index);
  }
  return out;
}

/** Which occurrence (1-based) of `text` the span starting at `start` is. 0 when it is not on word boundaries. */
export function occurrenceN(verseText, tokens, text, start) {
  const at = spanMatches(verseText, tokens, text).indexOf(start);
  return at === -1 ? 0 : at + 1;
}

/** Where the nth occurrence of `text` begins, or -1 when the verse no longer has it. */
export function locateSpan(verseText, tokens, text, n) {
  const hits = spanMatches(verseText, tokens, text);
  return n >= 1 && n <= hits.length ? hits[n - 1] : -1;
}

/**
 * The inverse of locateSpan, in tokens: the [first, last] token indices a piece
 * covers, or null when the verse no longer carries it.
 */
export function pieceToTokenRange(verseText, tokens, piece) {
  const start = locateSpan(verseText, tokens, piece.text, piece.n);
  if (start === -1) return null;
  const end = start + piece.text.length;
  const first = tokens.findIndex((t) => t.start === start);
  let last = -1;
  for (let i = first; i !== -1 && i < tokens.length; i++) {
    if (tokens[i].end === end) {
      last = i;
      break;
    }
  }
  return first === -1 || last === -1 ? null : [first, last];
}

/** Sort `ranges` and merge any that touch, so two neighbouring picks become one piece. */
function normalizeRanges(ranges, tokenCount) {
  const sorted = [];
  for (const r of ranges || []) {
    if (!Array.isArray(r) || r.length !== 2) throw badRequest("An English piece must be [first, last] token indices");
    const [i, j] = r;
    if (!Number.isInteger(i) || !Number.isInteger(j) || i < 0 || j < i || j >= tokenCount) {
      throw badRequest(`English token range [${i}, ${j}] is outside the verse`);
    }
    sorted.push([i, j]);
  }
  sorted.sort((a, b) => a[0] - b[0]);
  const merged = [];
  for (const r of sorted) {
    const prev = merged[merged.length - 1];
    if (prev && r[0] <= prev[1] + 1) {
      if (r[0] <= prev[1]) throw badRequest("English pieces within one link overlap");
      prev[1] = r[1];
    } else {
      merged.push([...r]);
    }
  }
  return merged;
}

/**
 * Turn the browser's links for one verse into records, validating as it goes.
 * A link is `{ greek: number[], english: [first, last][] }` with English given
 * as token-index ranges, since the browser clicks words and the record stores
 * text. Throws a 400 for anything that would write a record that does not mean
 * what the reviewer saw: an unknown Greek position, a word used by two links,
 * a link with nothing in it.
 *
 * @param {object} args
 * @param {string} args.ref OSIS ref, "Acts.1.1"
 * @param {{greek: number[], english: [number, number][]}[]} args.links
 * @param {{t: number, word: string}[]} args.greekTokens SBLGNT words of the verse
 * @param {string} args.verseText the LIT verse as plain text
 */
export function buildRecords({ ref, links, greekTokens, verseText }) {
  const tokens = tokenizeWords(verseText);
  const wordByT = new Map(greekTokens.map((g) => [g.t, g.word]));
  const usedGreek = new Set();
  const usedEnglish = new Set();
  const built = [];

  for (const link of links || []) {
    const ts = [...new Set(link?.greek || [])].sort((a, b) => a - b);
    const ranges = normalizeRanges(link?.english, tokens.length);
    if (!ts.length && !ranges.length) throw badRequest("A link needs at least one Greek or English word");

    for (const t of ts) {
      if (!wordByT.has(t)) throw badRequest(`${ref} has no Greek word ${t}`);
      if (usedGreek.has(t)) throw badRequest(`Greek word ${t} is in two links`);
      usedGreek.add(t);
    }
    const english = ranges.map(([i, j]) => {
      for (let k = i; k <= j; k++) {
        if (usedEnglish.has(k)) throw badRequest(`English word "${tokens[k].text}" is in two links`);
        usedEnglish.add(k);
      }
      const start = tokens[i].start;
      const text = verseText.slice(start, tokens[j].end);
      return { text, n: occurrenceN(verseText, tokens, text, start) };
    });

    built.push({
      order: [ts.length ? ts[0] : Infinity, ranges.length ? tokens[ranges[0][0]].start : Infinity],
      record: { ref, greek: ts.map((t) => ({ t, form: wordByT.get(t) })), english },
    });
  }

  // Greek order first (it is the order the verse reads in the source), then
  // English position for the links that have no Greek, so a rewrite of the same
  // links produces the same bytes.
  built.sort((a, b) => a.order[0] - b.order[0] || a.order[1] - b.order[1]);
  return built.map((b) => b.record);
}

const nfc = (s) => String(s).normalize("NFC");

/**
 * Read one verse's stored records against today's text: where each link lands
 * in the English tokens, which words nothing covers yet, and which stored
 * records no longer fit (a verse reworded, a different Greek source).
 *
 * @returns {{
 *   englishTokens: {text: string, start: number, end: number}[],
 *   links: {greek: number[], english: [number, number][]}[],
 *   stale: object[],
 *   unlinkedGreek: number[],
 *   unlinkedEnglish: number[],
 *   complete: boolean,
 * }}
 */
export function describeVerse({ verseText, greekTokens, records }) {
  const tokens = tokenizeWords(verseText);
  const wordByT = new Map(greekTokens.map((g) => [g.t, g.word]));
  const coveredGreek = new Set();
  const coveredEnglish = new Set();
  const links = [];
  const stale = [];

  for (const rec of records || []) {
    const ts = (rec.greek || []).map((g) => g.t);
    const greekOk = (rec.greek || []).every(
      (g) => wordByT.has(g.t) && nfc(wordByT.get(g.t)) === nfc(g.form),
    );
    const ranges = (rec.english || []).map((p) => pieceToTokenRange(verseText, tokens, p));
    const englishOk = ranges.every(Boolean);
    const clash =
      ts.some((t) => coveredGreek.has(t)) ||
      ranges.some((r) => r && range(r).some((k) => coveredEnglish.has(k)));

    if (!greekOk || !englishOk || clash || (!ts.length && !ranges.length)) {
      stale.push(rec);
      continue;
    }
    ts.forEach((t) => coveredGreek.add(t));
    ranges.forEach((r) => range(r).forEach((k) => coveredEnglish.add(k)));
    links.push({ greek: ts, english: ranges });
  }

  const unlinkedGreek = greekTokens.map((g) => g.t).filter((t) => !coveredGreek.has(t));
  const unlinkedEnglish = tokens.map((_, i) => i).filter((i) => !coveredEnglish.has(i));
  return {
    englishTokens: tokens,
    links,
    stale,
    unlinkedGreek,
    unlinkedEnglish,
    complete: !stale.length && !unlinkedGreek.length && !unlinkedEnglish.length && tokens.length > 0,
  };
}

function range([i, j]) {
  const out = [];
  for (let k = i; k <= j; k++) out.push(k);
  return out;
}

/**
 * One chapter file's text. Header fields are indented as in the phase 1 files;
 * each record sits on ONE line, so correcting a link is a one-line diff and a
 * book's worth of records stays a size a human can review. The same reasoning
 * as the chapter files' one-line footnotes (scripts/lib/chapter-serialize.mjs).
 */
export function serializeWordsFile({ bookKey, chapter, records }) {
  const lines = records.map((r) => `    ${JSON.stringify(r)}`);
  return (
    `{\n  "bookKey": ${JSON.stringify(bookKey)},\n  "chapter": ${chapter},\n  "records": [\n` +
    lines.join(",\n") +
    `${lines.length ? "\n" : ""}  ]\n}\n`
  );
}
