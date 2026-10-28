// src/lib/desk-greek.mjs
//
// The pure half of the Notebook's Greek tab (STUDY-DESK.md, phase 1f): how a
// chapter's Greek words are read as a verse's text, which file holds a
// lexicon entry, which UBS sense comes first, which glossary term a word
// belongs to, and where the arrow keys go. Import-free, so the tab
// (src/scripts/desk/tab-greek.js) and node --test share it.
//
// A word is the array the Greek files carry (public/greek/text/, written by
// scripts/build-greek.mjs):
//   [verse, t, text, pre, post, lemma, pos, parse, sense]
// Joining pre + text + post over a chapter's words gives SBL's text.

/** The text-critical signs the SBLGNT puts before and after words. */
export const SIGNS = "⸀⸁⸂⸃⸄⸅";

/** Where each part of a word sits in its array. */
export const W = { verse: 0, t: 1, text: 2, pre: 3, post: 4, lemma: 5, pos: 6, parse: 7, sense: 8 };

/** Every word of a chapter in reading order, each with its paragraph and place. */
export function flattenWords(paragraphs) {
  const flat = [];
  (paragraphs ?? []).forEach((words, p) => {
    for (const w of words) flat.push({ w, p, verse: w[W.verse] });
  });
  return flat;
}

/** The verses a chapter's words belong to, in the order they appear. */
export function versesOf(flat) {
  const out = [];
  for (const { verse } of flat) if (out[out.length - 1] !== verse && !out.includes(verse)) out.push(verse);
  return out;
}

/** A verse's Greek as plain text: pre + text + post, trimmed. */
export function verseGreek(flat, verse) {
  let s = "";
  for (const { w } of flat) if (w[W.verse] === verse) s += `${w[W.pre]}${w[W.text]}${w[W.post]}`;
  return s.replace(/\s+/g, " ").trim();
}

/**
 * Text split into plain runs and text-critical signs, so a sign can be drawn
 * as a button of its own: "⸂τῷ" -> [{ text: "⸂", sign: true }, ...].
 */
export function splitSigns(text) {
  const out = [];
  let run = "";
  for (const ch of String(text ?? "")) {
    if (SIGNS.includes(ch)) {
      if (run) out.push({ text: run, sign: false });
      run = "";
      out.push({ text: ch, sign: true });
    } else {
      run += ch;
    }
  }
  if (run) out.push({ text: run, sign: false });
  return out;
}

/**
 * Where the arrow keys go from word `i`: Left and Right to the neighbouring
 * word, Home and End to the chapter's first and last, Up and Down to the
 * first word of the previous or next verse. Returns an index, or null where
 * the key means nothing (or the move would leave the chapter).
 */
export function moveFrom(flat, i, key) {
  if (!flat.length) return null;
  const last = flat.length - 1;
  switch (key) {
    case "ArrowLeft": return i > 0 ? i - 1 : null;
    case "ArrowRight": return i < last ? i + 1 : null;
    case "Home": return 0;
    case "End": return last;
    case "ArrowUp": {
      const verses = versesOf(flat);
      const at = verses.indexOf(flat[i].verse);
      return at > 0 ? firstWordOf(flat, verses[at - 1]) : null;
    }
    case "ArrowDown": {
      const verses = versesOf(flat);
      const at = verses.indexOf(flat[i].verse);
      return at >= 0 && at < verses.length - 1 ? firstWordOf(flat, verses[at + 1]) : null;
    }
    default: return null;
  }
}

/** The index of a verse's first word, or -1. */
export function firstWordOf(flat, verse) {
  return flat.findIndex((x) => x.verse === verse);
}

/** The index of the word at verse `verse`, position `t`, or -1. */
export function indexOfWord(flat, verse, t) {
  return flat.findIndex((x) => x.verse === verse && x.w[W.t] === t);
}

/* ── Which file holds an entry ───────────────────────────────────── */

const two = (n) => String(n).padStart(2, "0");
const three = (n) => String(n).padStart(3, "0");

/** The UBS shard for an entry: its MainId's first six digits, mod 64. */
export function ubsShard(mainId) {
  const n = Number(String(mainId).slice(0, 6));
  return Number.isFinite(n) ? two(n % 64) : null;
}

/** The number in a Strong's code ("G4561" -> 4561), or null. */
export function strongNumber(strong) {
  const m = /^G(\d+)$/.exec(String(strong ?? ""));
  return m ? Number(m[1]) : null;
}

/** The STEPBible brief-lexicon shard for a Strong's code, or null. */
export function stepShard(strong) {
  const n = strongNumber(strong);
  return n == null ? null : two(n % 64);
}

/** The LSJ shard for a Strong's code, or null. */
export function lsjShard(strong) {
  const n = strongNumber(strong);
  return n == null ? null : three(n % 128);
}

/* ── UBS senses ──────────────────────────────────────────────────── */

/**
 * An entry's senses with the one UBS gives at this word first. `sense` is the
 * word's 0-based index into the entry's senses, or null. Every sense keeps the
 * index it has in the entry, so a caller can still say which it was.
 *
 * @returns {{ here: { sense: object, index: number } | null,
 *   others: { sense: object, index: number }[] }}
 */
export function orderSenses(senses, sense) {
  const all = (senses ?? []).map((s, index) => ({ sense: s, index }));
  const at = Number.isInteger(sense) ? all.findIndex((x) => x.index === sense) : -1;
  if (at < 0) return { here: null, others: all };
  const here = all[at];
  return { here, others: all.filter((_, i) => i !== at) };
}

/* ── The page's glossary terms ───────────────────────────────────── */

const nfc = (s) => String(s ?? "").normalize("NFC");

/**
 * The page's glossary terms (#term-lens-data) that govern a Greek lemma:
 * [{ id, title, traditional }]. A page without the data, or an entry without
 * lemmas, matches nothing.
 */
export function termsForLemma(termData, lemma) {
  const want = nfc(lemma);
  if (!want || !termData?.terms) return [];
  const out = [];
  for (const [id, term] of Object.entries(termData.terms)) {
    if (!Array.isArray(term?.lemmas)) continue;
    if (term.lemmas.some((l) => nfc(l) === want)) {
      out.push({ id, title: term.title ?? id, traditional: term.traditional ?? "" });
    }
  }
  return out;
}

/**
 * How a verse renders a term: the distinct renderings its marks carry in
 * that verse ("self-preservation"), in reading order, case-insensitively
 * distinct. Empty where the verse has none.
 */
export function renderingsIn(termData, id, verse) {
  const seen = new Set();
  const out = [];
  for (const m of termData?.marks ?? []) {
    if (m.id !== id || m.v !== verse || !m.form) continue;
    const key = m.form.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(m.form);
  }
  return out;
}

/** "a", "a and b", "a, b, and c" (the Oxford comma from three on). */
export function joinAnd(items) {
  if (items.length < 2) return items.join("");
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
}

/**
 * The borrowed passage a verse belongs to ([first, last, source] in the
 * chapter file), or null.
 */
export function borrowedFor(borrowed, verse) {
  for (const b of borrowed ?? []) if (verse >= b[0] && verse <= b[1]) return b;
  return null;
}
