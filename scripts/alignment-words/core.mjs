// Pure logic for the word-alignment tool (alignment phase 2). No fs, no http,
// no argv: store.mjs and server.mjs own all of that, so everything here is
// unit-testable with plain objects (test/alignment-words-core.test.js).
//
// WHAT THIS DATASET IS. Every SBLGNT word, linked to the LIT words that render
// it. It is phase 2 of the alignment dataset (CLAUDE.md, "The Alignment
// Dataset"), kept apart from phase 1's glossary records in src/data/alignment/:
// a chapter file there holds a few records and every site page that touches the
// glossary reads all of them, whereas this is one record per Greek word group,
// roughly 138,000 SBLGNT words across the New Testament.
//
//   src/data/alignment-words/<bookKey>-<chapter>.json
//
//   { "bookKey": "acts", "chapter": 1, "format": 1,
//     "basis":   { "1": "<verse 1's English as it was aligned>", ... },
//     "records": [ <one record per line> ] }
//
// A RECORD is one link, many-to-many:
//
//   { "ref": "Acts.1.1",
//     "greek":   [ { "t": 3, "form": "πρῶτον" } ],
//     "english": [ { "text": "first", "n": 1 } ] }
//
//   ref          the verse that owns the record: the verse of its first Greek
//                word, or of its first English piece when it has no Greek.
//   greek[].t    1-based position of the word in its SBLGNT verse, in MorphGNT's
//                order. The Greek tab and the word bubble must number words the
//                same way, or a link can't be followed.
//   greek[].form the word as SBLGNT prints it, punctuation and apparatus signs
//                (⸀) stripped, NFC. A checksum as much as a label: if the Greek
//                under a record moves, the form stops matching and the record
//                is reported stale instead of pointing at another word. The
//                check (sameGreekWord) ignores what differs between SBLGNT
//                texts without being a different word: the elision mark (’ in
//                MorphGNT, ʼ in SBL's v1.2 data) and capitalization.
//   english[]    one piece per run of adjacent English words. A rendering split
//                by words that render something else is ONE record with several
//                pieces, as in phase 1 ("speaks about … contemptuously").
//   v            on a Greek word or an English piece: the verse it lives in,
//                when that is not the record's own verse. A rendering can cross
//                a verse boundary (the translation moves a phrase into the
//                verse before), so a record may reach into another verse of the
//                same chapter. Absent means the record's verse.
//   english: []  the Greek has no rendering in the LIT (an article the English
//                does without, say). A first-class answer, like phase 1's
//                `no-rendering`.
//   greek: []    English the Greek did not supply ("that", an added "he").
//   stale        written only on a record that no longer fits and is waiting
//                for the reviewer: "english", "greek", "clash", "empty" or
//                "verse". It keeps the record stale even if its old words
//                happen to reappear, since the reviewer has not looked at it.
//
// Each English word belongs to exactly one record, as each Greek word does: an
// English word that carries the sense of two Greek words is one link with both.
//
// `n` is the nth case-insensitive occurrence of `text` in its verse, where an
// occurrence must begin and end on English word boundaries (so "in" is not
// found inside "beginning"). Phase 1's `n` also has a substring fallback; this
// one doesn't, because the tool only writes spans it picked word by word.
//
// THE BASIS is each verse's English as it stood when its links were last saved.
// `n` alone can't survive a revision: insert one "the" early in a verse and
// every later "the" record would quietly resolve to the word before its own,
// with nothing reported. With the basis, a verse whose wording moved is
// compared with its old wording word by word, a record whose words all
// survived is carried across to their new place, and only a record that
// touches a changed word goes stale. The text is normalized as the Study
// Desk's anchors are (normalizeAnchorText: NFC, invisible characters and
// bracket markers removed, spaces collapsed), so a change that moves no letter
// changes nothing.
//
// A verse is COMPLETE when every Greek word and every English word in it
// belongs to a live record and no stale record touches it. "Reviewed" is
// derived, never a flag that can drift. A verse with no SBLGNT words at all is
// outside the source text and is never complete: marking all of its English
// "no Greek" would claim the LIT invented it.
//
// Every record here is a human decision, so phase 1's `status`, `source`,
// `confidence` and `lemma` are not written, and there is no `term`: a glossary
// term is joined in from the lemma at read time. MorphGNT's lemma and parsing
// are shown in the tool and never stored.

import { tokenizeWords } from "../alignment-review/review-core.mjs";
import { normalizeAnchorText } from "../../src/lib/anchor-core.mjs";
import { describeParse } from "../../src/lib/greek-parse.mjs";

export { tokenizeWords };

/** The on-disk format. Bump it, and migrate, when a record's meaning changes. */
export const FORMAT = 1;

/** The verse text every comparison and every stored `n` is counted against. */
export const normalizeVerseText = (text) => normalizeAnchorText(text);

const nfc = (s) => String(s).normalize("NFC");

/**
 * Whether a stored form still names the word at its position. MorphGNT's 2010
 * SBLGNT and SBL's v1.2 data agree word for word outside John 7:53–8:11, but
 * print the elision mark differently (’ U+2019 against ʼ U+02BC, in about 1,100
 * verses) and capitalize two words differently (Matthew 27:24, Titus 3:13).
 * Neither is a different word, so neither may make a record stale, or a move
 * from one text to the other would flag every elided word in the corpus.
 */
const APOSTROPHES = /[’ʼ'ʹ᾽᾿]/g;
export function sameGreekWord(a, b) {
  const fold = (s) => nfc(s).replace(APOSTROPHES, "’").toLowerCase();
  return fold(a ?? "") === fold(b ?? "");
}

/** An error the server can turn into a 4xx without importing a class from a module that promises "no http". */
function badRequest(message, statusCode = 400) {
  return Object.assign(new Error(message), { statusCode });
}

const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// ------------------------------------------------------------ English spans

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

/** Where the nth occurrence of `text` begins, or -1 when the verse doesn't have it. */
export function locateSpan(verseText, tokens, text, n) {
  const hits = spanMatches(verseText, tokens, text);
  return n >= 1 && n <= hits.length ? hits[n - 1] : -1;
}

/** The [first, last] token indices a stored piece covers in this text, or null. */
export function pieceToTokenRange(verseText, tokens, piece) {
  const start = locateSpan(verseText, tokens, piece.text, piece.n);
  if (start === -1) return null;
  const end = start + piece.text.length;
  const first = tokens.findIndex((t) => t.start === start);
  if (first === -1) return null;
  for (let i = first; i < tokens.length; i++) if (tokens[i].end === end) return [first, i];
  return null;
}

/** A stored piece for tokens [first, last] of this text. */
export function pieceFor(verseText, tokens, first, last) {
  const start = tokens[first].start;
  const text = verseText.slice(start, tokens[last].end);
  return { text, n: occurrenceN(verseText, tokens, text, start) };
}

/**
 * Old token index -> new token index, for the words a revision left alone.
 * A longest-common-subsequence match on the words themselves (case and
 * normalization folded), so an inserted or deleted word shifts the rest
 * without breaking them. Verses are short; the quadratic table is fine.
 */
export function mapTokens(oldTokens, newTokens) {
  const key = (t) => nfc(t.text).toLowerCase();
  const a = oldTokens.map(key);
  const b = newTokens.map(key);
  const dp = Array.from({ length: a.length + 1 }, () => new Uint16Array(b.length + 1));
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const map = new Map();
  for (let i = 0, j = 0; i < a.length && j < b.length; ) {
    if (a[i] === b[j]) map.set(i++, j++);
    else if (dp[i + 1][j] >= dp[i][j + 1]) i++;
    else j++;
  }
  return map;
}

/**
 * Where a piece stored against `basisText` lands in `currentText`: its new
 * token range when every word of it survived the revision and still stands
 * together, else null. A word inserted inside the piece ("the first account"
 * becoming "the first written account") is a change the reviewer must see.
 */
export function carryPiece(basisText, currentText, piece) {
  const oldTokens = tokenizeWords(basisText);
  const range = pieceToTokenRange(basisText, oldTokens, piece);
  if (!range) return null;
  const map = mapTokens(oldTokens, tokenizeWords(currentText));
  const moved = [];
  for (let i = range[0]; i <= range[1]; i++) {
    if (!map.has(i)) return null;
    moved.push(map.get(i));
  }
  for (let k = 1; k < moved.length; k++) if (moved[k] !== moved[k - 1] + 1) return null;
  return [moved[0], moved[moved.length - 1]];
}

// ------------------------------------------------------------ reading a chapter

const verseOfRef = (ref) => Number(String(ref).split(".")[2]);

/**
 * Read a chapter's stored records against today's text.
 *
 * @param {object} args
 * @param {Map<number, {text: string, greek: {t: number, word: string}[]}>} args.verses
 *   every verse with English, text already normalized
 * @param {Record<string, string>} [args.basis] verse -> English when aligned
 * @param {object[]} args.records
 * @returns {{
 *   links: {greek: {v: number, t: number}[], english: {v: number, first: number, last: number}[], moved: boolean}[],
 *   stale: {record: object, reason: string, verses: number[], relinkGreek: {v: number, t: number}[]}[],
 *   verses: Map<number, {tokens: object[], unlinkedGreek: number[], unlinkedEnglish: number[],
 *                        changed: boolean, outsideSource: boolean, complete: boolean}>,
 * }}
 */
export function describeChapter({ verses, basis = {}, records }) {
  const tokensOf = new Map([...verses].map(([v, x]) => [v, tokenizeWords(x.text)]));
  const wordAt = (v, t) => verses.get(v)?.greek.find((g) => g.t === t)?.word;
  const covered = new Set(); // "g|v|t" and "e|v|i"
  const links = [];
  const stale = [];

  for (const rec of records || []) {
    const own = verseOfRef(rec.ref);
    const greek = (rec.greek || []).map((g) => ({ v: g.v ?? own, t: g.t, form: g.form }));
    const pieces = (rec.english || []).map((p) => ({ v: p.v ?? own, text: p.text, n: p.n }));
    const touched = [...new Set([own, ...greek.map((g) => g.v), ...pieces.map((p) => p.v)])];
    const relinkGreek = greek
      .filter((g) => verses.has(g.v) && wordAt(g.v, g.t) !== undefined && sameGreekWord(wordAt(g.v, g.t), g.form))
      .map(({ v, t }) => ({ v, t }));
    const fail = (reason) => stale.push({ record: rec, reason, verses: touched, relinkGreek });

    if (rec.stale) {
      fail(rec.stale);
      continue;
    }
    if (!greek.length && !pieces.length) {
      fail("empty");
      continue;
    }
    if (touched.some((v) => !verses.has(v))) {
      fail("verse");
      continue;
    }
    if (relinkGreek.length !== greek.length) {
      fail("greek");
      continue;
    }

    let moved = false;
    const english = [];
    for (const p of pieces) {
      const now = verses.get(p.v).text;
      const then = basis[p.v];
      let range;
      if (then === undefined || then === now) {
        range = pieceToTokenRange(now, tokensOf.get(p.v), p);
      } else {
        range = carryPiece(then, now, p);
        moved = true;
      }
      if (!range) break;
      english.push({ v: p.v, first: range[0], last: range[1] });
    }
    if (english.length !== pieces.length) {
      fail("english");
      continue;
    }

    const keys = [
      ...greek.map((g) => `g|${g.v}|${g.t}`),
      ...english.flatMap((e) => span(e.first, e.last).map((i) => `e|${e.v}|${i}`)),
    ];
    if (keys.some((k) => covered.has(k))) {
      fail("clash");
      continue;
    }
    keys.forEach((k) => covered.add(k));
    links.push({ greek: greek.map(({ v, t }) => ({ v, t })), english, moved });
  }

  const staleVerses = new Set(stale.flatMap((s) => s.verses));
  const summary = new Map();
  for (const [v, x] of verses) {
    const tokens = tokensOf.get(v);
    const unlinkedGreek = x.greek.map((g) => g.t).filter((t) => !covered.has(`g|${v}|${t}`));
    const unlinkedEnglish = tokens.map((_, i) => i).filter((i) => !covered.has(`e|${v}|${i}`));
    const outsideSource = !x.greek.length;
    summary.set(v, {
      tokens,
      unlinkedGreek,
      unlinkedEnglish,
      changed: basis[v] !== undefined && basis[v] !== x.text,
      outsideSource,
      complete:
        !outsideSource && tokens.length > 0 && !unlinkedGreek.length && !unlinkedEnglish.length && !staleVerses.has(v),
    });
  }
  return { links, stale, verses: summary };
}

function span(first, last) {
  const out = [];
  for (let k = first; k <= last; k++) out.push(k);
  return out;
}

// ------------------------------------------------------------ writing a chapter

const byVT = (a, b) => a.v - b.v || a.t - b.t;
const byVFirst = (a, b) => a.v - b.v || a.first - b.first;

/**
 * Turn the browser's links for a whole chapter into records, validating as it
 * goes. A link is `{ greek: [{v, t}], english: [{v, first, last}] }` with
 * English as token ranges, since the browser clicks words and the record
 * stores text. Throws a 400 for anything that would write a record that does
 * not mean what the reviewer saw: an unknown word, a word in two links, a link
 * with nothing in it.
 *
 * @param {object} args
 * @param {string} args.refPrefix "Acts.1"
 * @param {Map<number, {text: string, greek: {t: number, word: string}[]}>} args.verses
 * @param {object[]} args.links
 */
export function buildChapterRecords({ refPrefix, verses, links }) {
  const tokensOf = new Map([...verses].map(([v, x]) => [v, tokenizeWords(x.text)]));
  const used = new Set();
  const take = (key, what) => {
    if (used.has(key)) throw badRequest(`${what} is in two links`);
    used.add(key);
  };
  const built = [];

  for (const link of links || []) {
    const greek = [];
    for (const g of link?.greek || []) {
      const word = verses.get(g?.v)?.greek.find((x) => x.t === g.t)?.word;
      if (word === undefined) throw badRequest(`${refPrefix}.${g?.v} has no Greek word ${g?.t}`);
      take(`g|${g.v}|${g.t}`, `Greek word ${g.v}:${g.t}`);
      greek.push({ v: g.v, t: g.t, form: nfc(word) });
    }
    greek.sort(byVT);

    // Per verse: sort, check, and merge touching ranges into one piece.
    const raw = [...(link?.english || [])].sort(byVFirst);
    const english = [];
    for (const e of raw) {
      const tokens = tokensOf.get(e?.v);
      const ok = tokens && Number.isInteger(e.first) && Number.isInteger(e.last) &&
        e.first >= 0 && e.last >= e.first && e.last < tokens.length;
      if (!ok) throw badRequest(`English range ${e?.v}:[${e?.first}, ${e?.last}] is outside the verse`);
      for (let i = e.first; i <= e.last; i++) take(`e|${e.v}|${i}`, `English word "${tokens[i].text}" (${e.v})`);
      const prev = english[english.length - 1];
      if (prev && prev.v === e.v && e.first === prev.last + 1) prev.last = e.last;
      else english.push({ v: e.v, first: e.first, last: e.last });
    }
    if (!greek.length && !english.length) throw badRequest("A link needs at least one Greek or English word");

    const own = greek.length ? greek[0].v : english[0].v;
    const record = {
      ref: `${refPrefix}.${own}`,
      greek: greek.map(({ v, t, form }) => (v === own ? { t, form } : { v, t, form })),
      english: english.map(({ v, first, last }) => {
        const piece = pieceFor(verses.get(v).text, tokensOf.get(v), first, last);
        return v === own ? piece : { v, ...piece };
      }),
    };
    built.push({
      own,
      g: greek.length ? greek[0] : null,
      e: english.length ? { v: english[0].v, at: tokensOf.get(english[0].v)[english[0].first].start } : null,
      record,
    });
  }

  // Owner verse, then Greek order (the order the source reads in), then English
  // position for links with no Greek, so the same links always make the same bytes.
  built.sort(
    (a, b) =>
      a.own - b.own ||
      (a.g && b.g ? byVT(a.g, b.g) : a.g ? -1 : b.g ? 1 : a.e.v - b.e.v || a.e.at - b.e.at),
  );
  return built.map((b) => b.record);
}

/** A stale record as written: unchanged, with the reason it is waiting. */
export function markStale({ record, reason }) {
  const { stale: _ignored, ...rest } = record;
  return { ...rest, stale: reason };
}

/**
 * The basis a save writes: the current English of every verse any record
 * touches. Verses with no records carry none.
 */
export function basisFor({ verses, records }) {
  const touched = new Set();
  for (const r of records) {
    const own = verseOfRef(r.ref);
    touched.add(own);
    for (const g of r.greek || []) touched.add(g.v ?? own);
    for (const p of r.english || []) touched.add(p.v ?? own);
  }
  const basis = {};
  for (const v of [...touched].sort((a, b) => a - b)) {
    if (verses.has(v)) basis[v] = verses.get(v).text;
  }
  return basis;
}

/**
 * One chapter file's text. The basis has one verse per line and each record
 * sits on ONE line, so correcting a link is a one-line diff and a book stays a
 * size a human can review: the same reasoning as the chapter files' one-line
 * footnotes (scripts/lib/chapter-serialize.mjs).
 */
export function serializeWordsFile({ bookKey, chapter, basis = {}, records }) {
  const basisLines = Object.keys(basis)
    .sort((a, b) => Number(a) - Number(b))
    .map((v) => `    ${JSON.stringify(String(v))}: ${JSON.stringify(basis[v])}`);
  const recordLines = records.map((r) => `    ${JSON.stringify(r)}`);
  const block = (lines) => (lines.length ? `\n${lines.join(",\n")}\n  ` : "");
  return (
    `{\n  "bookKey": ${JSON.stringify(bookKey)},\n  "chapter": ${chapter},\n  "format": ${FORMAT},\n` +
    `  "basis": {${block(basisLines)}},\n` +
    `  "records": [${block(recordLines)}]\n}\n`
  );
}

// ------------------------------------------------------------ MorphGNT codes

// describeParse lives in src/lib/greek-parse.mjs, where the browser's Greek tab
// can use it too. It is re-exported here so every existing caller keeps working.
export { describeParse };
