// src/lib/greek-search.mjs
//
// Searching the Greek (STUDY-DESK.md, "Order of work", 1h): the one set of
// matching rules behind the search bar's tray, /search and the Notebook's
// Greek tab, the way search-core.js keeps the two search UIs agreeing. Pure,
// and shared with the build: scripts/lib/greek-core.mjs folds forms with
// foldGreek when it writes public/greek/search/, so the index and the query
// are folded by the same function.
//
// A query is sorted into one kind:
//   greek    anything with a Greek letter: one word, any form, accents,
//            breathings and case optional. Finds the word's lemma, and every
//            form of it. A lemma typed directly finds that lemma alone.
//   strong   G plus digits (also g4102, strong:4102, Strong's 4102, G04102).
//   latin    other text, tried both as a transliteration of a lemma
//            (agreuō = agreuo, Christos = Khristos = xristos) and as an
//            English lexicon gloss ("faith" finds πίστις).
//
// The index (public/greek/search/lemmas.json, format 1) is
//   { format: 1, shards: 64, lemmas: [entry, …] }
// where an entry is
//   [lemma, strong | null, gloss | null, count, forms, also?, brief?, senses?]
// `forms` is the lemma's folded forms joined by spaces, `also` the other
// Strong's numbers MACULA gives its words, `brief` STEPBible's brief gloss
// where it differs from `gloss` (πίστις: "to believe in", brief "faith"), and
// `senses` the heads (glossHead) of every other UBS sense gloss, joined by "|". Trailing empty fields are left off. An entry's place in
// the list is its id. Occurrences are in public/greek/search/occ/<id % shards>.json:
//   { "<id>": [[form, …], [book, chapter, verse, t, formIndex, …]] }
// with `book` an index into BOOK_ORDER and `formIndex` into that list of
// exact forms, in Bible order.

import { levenshtein } from "./levenshtein.mjs";

export const GREEK_SEARCH_FORMAT = 1;

/* ── Folding ─────────────────────────────────────────────────────── */

const GREEK_LETTER = /[Ͱ-Ͽἀ-῿]/;
const COMBINING = /[̀-ͯ]/g;
const NOT_GREEK = /[^α-ω]/g;

/** True when the text has a Greek letter in it. */
export const hasGreek = (s) => GREEK_LETTER.test(String(s ?? ""));

/**
 * A Greek word as search compares it: accents, breathings, diaeresis and iota
 * subscript gone, lowercase, final sigma as σ, and anything that isn't a
 * Greek letter (punctuation, the elision mark, a text-critical sign) dropped.
 * ἦν, ἥν and ην fold alike, which is the point.
 */
export function foldGreek(s) {
  return String(s ?? "")
    .normalize("NFD")
    .replace(COMBINING, "")
    .toLowerCase()
    .replace(/ς/g, "σ")
    .replace(/ϲ/g, "σ")
    .replace(NOT_GREEK, "");
}

/* ── Transliteration ─────────────────────────────────────────────── */

const LETTERS = {
  α: "a", β: "b", γ: "g", δ: "d", ε: "e", ζ: "z", η: "e", θ: "th", ι: "i",
  κ: "k", λ: "l", μ: "m", ν: "n", ξ: "x", ο: "o", π: "p", ρ: "r", σ: "s",
  τ: "t", υ: "u", φ: "f", χ: "ch", ψ: "ps", ω: "o",
};

/**
 * The transliteration key of a Greek word: its letters in Latin, with every
 * spelling that means one sound collapsed to one (φ is "f", χ "ch", ξ and κσ
 * "x", a nasal γ "n", η and ω the plain vowels) and no breathing, so the key
 * a reader's typing makes (latinKeys) can be compared with it as a string.
 */
export function greekKey(greek) {
  // γ before γ, κ, ξ or χ is a nasal: ἄγγελος angelos, ἐγχρίω enchriō.
  const folded = foldGreek(greek).replace(/γ(?=[γκξχ])/g, "ν");
  let out = "";
  for (const ch of folded) out += LETTERS[ch] ?? "";
  return out.replace(/ks/g, "x");
}

/**
 * The keys a Latin query can mean: lowercase, every mark stripped (ō = o,
 * ē = e), kh = ch, ph = f, y = u, ks = x, a g before g, k, x or ch = n
 * (egchriō = enchriō), rh = r, and a breathing's h dropped. An x can be ξ or a Greek keyboard's χ ("xristos"),
 * so each x is read both ways; the list is never empty for a word.
 */
export function latinKeys(text) {
  let s = String(text ?? "")
    .normalize("NFD")
    .replace(COMBINING, "")
    .toLowerCase()
    .replace(/[^a-z]/g, "");
  if (!s) return [];
  s = s
    .replace(/kh/g, "ch")
    .replace(/ph/g, "f")
    .replace(/y/g, "u")
    .replace(/ks/g, "x")
    .replace(/g(?=g|k|x|ch)/g, "n")
    .replace(/rh/g, "r");
  // A breathing's h, at the front or (as STEPBible writes it) after the
  // first vowel of a diphthong: haima, ahima.
  s = s.replace(/^h/, "").replace(/^([aeiou]{1,2})h(?=[aeiou])/, "$1");
  let keys = [s];
  const xs = (s.match(/x/g) ?? []).length;
  if (xs && xs <= 3) {
    keys = [""];
    for (const ch of s) {
      if (ch !== "x") keys = keys.map((k) => k + ch);
      else keys = keys.flatMap((k) => [`${k}x`, `${k}ch`]);
    }
  }
  return [...new Set(keys)].filter(Boolean);
}

const SHOWN = {
  α: "a", β: "b", γ: "g", δ: "d", ε: "e", ζ: "z", η: "ē", θ: "th", ι: "i",
  κ: "k", λ: "l", μ: "m", ν: "n", ξ: "x", ο: "o", π: "p", ρ: "r", σ: "s",
  ς: "s", τ: "t", φ: "ph", χ: "ch", ψ: "ps", ω: "ō",
};
const ROUGH = "̔";

/**
 * A Greek word in Latin letters as readers see it in search, in the SBL
 * Handbook's style: πίστις pistis, ψυχή psychē, υἱός huios, οὗτος houtos,
 * ἄγγελος angelos, Ῥώμη Rhōmē. Accents are dropped; a rough breathing is an h.
 */
export function transliterate(greek) {
  const letters = [];
  for (const ch of String(greek ?? "").normalize("NFC")) {
    const parts = ch.normalize("NFD");
    const base = parts[0].toLowerCase();
    if (!/[α-ως]/.test(base)) continue;
    letters.push({ base, rough: parts.includes(ROUGH), upper: parts[0] !== base });
  }
  let out = "";
  letters.forEach((l, i) => {
    const prev = letters[i - 1]?.base;
    const next = letters[i + 1]?.base;
    if (l.base === "υ") out += "αεηο".includes(prev ?? "-") || next === "ι" ? "u" : "y";
    else if (l.base === "γ" && "γκξχ".includes(next ?? "-")) out += "n";
    else if (l.base === "ρ" && (l.rough || prev === "ρ")) out += "rh";
    else out += SHOWN[l.base];
  });

  if (letters.slice(0, 2).some((l) => l.rough && l.base !== "ρ")) out = `h${out}`;
  return letters[0]?.upper ? out.charAt(0).toUpperCase() + out.slice(1) : out;
}

/* ── Strong's numbers ────────────────────────────────────────────── */

const STRONG_RE = /^(?:strong(?:['’]?s)?\s*:?\s*g?|g)\s*0*(\d{1,5})$/i;

/** "G4102" for any way of typing a Strong's number, else null. */
export function parseStrong(text) {
  const m = STRONG_RE.exec(String(text ?? "").trim());
  return m ? `G${Number(m[1])}` : null;
}

/* ── Glosses ─────────────────────────────────────────────────────── */

const foldLatin = (s) => String(s ?? "").normalize("NFD").replace(COMBINING, "").toLowerCase();
const words = (s) => foldLatin(s).match(/[a-z0-9]+/g) ?? [];

/**
 * A gloss's head: its first sense, without anything in parentheses, and
 * without a leading "to", "a", "an" or "the" ("(in the singular) person,
 * human being" → "person"; "to catch" → "catch").
 */
export function glossHead(gloss) {
  const first = foldLatin(gloss).replace(/\([^)]*\)/g, " ").split(/[,;:]/)[0];
  return words(first).join(" ").replace(/^(?:to|a|an|the) /, "");
}

/* ── The index ───────────────────────────────────────────────────── */

const push = (map, key, id) => {
  const list = map.get(key);
  if (!list) map.set(key, [id]);
  else if (!list.includes(id)) list.push(id);
};

/**
 * The lemma list made ready to search: each lemma with its fold, key and
 * gloss words, and maps from a folded form, a fold, a Strong's number and a
 * key to the lemmas they name. Null for anything that isn't format 1.
 */
export function prepareIndex(json) {
  if (json?.format !== GREEK_SEARCH_FORMAT || !Array.isArray(json.lemmas)) return null;
  const lemmas = [];
  const byForm = new Map();
  const byFold = new Map();
  const byStrong = new Map();
  const byKey = new Map();
  json.lemmas.forEach((entry, id) => {
    const [lemma, strong, gloss, count, forms, also, brief, senses] = entry;
    const fold = foldGreek(lemma);
    const key = greekKey(lemma);
    const item = {
      id, lemma, strong: strong ?? null, gloss: gloss ?? "", translit: transliterate(lemma),
      count: count ?? 0, fold, key,
      glossWords: new Set([...words(gloss), ...words(brief)]),
      glossHeads: [glossHead(gloss), glossHead(brief)].filter(Boolean),
      senseHeads: new Set(String(senses ?? "").split("|").filter(Boolean)),
    };
    item.glossHead = item.glossHeads[0] ?? "";
    // What a lemma's line shows: the brief lexicon's gloss where it has one
    // (πίστις "faith"), since UBS's commonest sense can be a phrase about
    // another word ("to believe in").
    item.shortGloss = brief || item.glossHead || item.gloss;
    lemmas.push(item);
    push(byFold, fold, id);
    push(byKey, key, id);
    for (const f of String(forms ?? "").split(" ")) if (f) push(byForm, f, id);
    for (const s of [strong, ...(also ?? [])]) if (s) push(byStrong, s, id);
  });
  return { lemmas, byForm, byFold, byStrong, byKey, shards: json.shards ?? 64 };
}

/* ── The glossary bridge ─────────────────────────────────────────── */

/**
 * The glossary bridge (public/search/greek-bridge.json, written by
 * build:greek-bridge from the gated alignment records): the LIT's renderings
 * of the glossary terms, each with the term's lemmas and the verses where the
 * LIT renders them that way. Made ready to look a phrase up. Null for
 * anything that isn't format 1.
 */
export function prepareBridge(json) {
  if (json?.format !== 1 || !Array.isArray(json.terms)) return null;
  const byPhrase = new Map();
  for (const term of json.terms) {
    for (const r of term.renderings ?? []) {
      const key = words(r.form).join(" ");
      if (!key) continue;
      const list = byPhrase.get(key) ?? [];
      list.push({ term, rendering: r });
      byPhrase.set(key, list);
    }
  }
  return { byPhrase };
}

/**
 * The lemmas a phrase reaches as a LIT rendering, each with `lit`:
 * { id, title, form, count, verses } (verses flat [book, chapter, verse, …]).
 * Renderings differing only in case ("Torah", "torah") are joined.
 */
function bridgeMatches(index, bridge, phrase) {
  const found = bridge?.byPhrase.get(phrase);
  if (!found) return [];
  const byLemma = new Map();
  for (const { term, rendering } of found) {
    for (const lemma of term.lemmas) {
      for (const id of index.byFold.get(foldGreek(lemma)) ?? []) {
        if (index.lemmas[id].lemma !== lemma.normalize("NFC")) continue;
        const had = byLemma.get(id);
        if (had) {
          had.lit.count += rendering.count;
          had.lit.verses = had.lit.verses.concat(rendering.verses);
        } else {
          byLemma.set(id, {
            id,
            how: "lit",
            lit: { id: term.id, title: term.title, form: rendering.form, count: rendering.count, verses: rendering.verses },
          });
        }
      }
    }
  }
  return [...byLemma.values()];
}

/** The verses a LIT rendering names, as a Set of "book.chapter.verse" (book an index). */
export function litVerseKeys(lit) {
  const out = new Set();
  const v = lit?.verses ?? [];
  for (let i = 0; i + 2 < v.length; i += 3) out.add(`${v[i]}.${v[i + 1]}.${v[i + 2]}`);
  return out;
}

/** The occurrence file a lemma's verses are in ("07"). */
export const occShard = (index, id) => String(id % (index?.shards ?? 64)).padStart(2, "0");

/* ── Matching ────────────────────────────────────────────────────── */

const byCount = (index) => (a, b) =>
  index.lemmas[b.id].count - index.lemmas[a.id].count || a.id - b.id;

/**
 * What a query finds:
 *   { kind, lemmas: [{ id, how }], form }
 * `kind` is "greek", "strong", "latin" or null (nothing to search). `how` says
 * why each lemma matched: "lemma" (the lemma itself was typed), "form",
 * "strong", "translit", "near" (a transliteration one or two letters off),
 * "gloss" (its gloss or brief gloss) or "sense" (another UBS sense's gloss).
 * `form` is the folded Greek form typed, for "exact form only". Lemmas come
 * best first: the LIT's own rendering ("lit", from the glossary bridge, with
 * `lit` saying which), exact keys, a gloss that *is* the query, near misses,
 * other glosses, then a sense gloss that is the query; the more frequent
 * first within each.
 *
 * `bridge` is prepareBridge()'s result, or null to leave the LIT out.
 *
 * Options: `near` (default true) allows near misses, which the tray doesn't.
 */
export function matchGreek(index, raw, { near = true, bridge = null } = {}) {
  const none = { kind: null, lemmas: [], form: null };
  const q = String(raw ?? "").trim().replace(/^["“”']+|["“”']+$/g, "");
  if (!index || !q) return none;

  if (hasGreek(q)) {
    if (/\s/.test(q)) return { ...none, kind: "greek" }; // one word at a time
    const form = foldGreek(q);
    if (!form) return none;
    const asLemma = index.byFold.get(form);
    const ids = asLemma ?? index.byForm.get(form) ?? [];
    const how = asLemma ? "lemma" : "form";
    return {
      kind: "greek",
      form,
      lemmas: ids.map((id) => ({ id, how })).sort(byCount(index)),
    };
  }

  const strong = parseStrong(q);
  if (strong) {
    const ids = index.byStrong.get(strong) ?? [];
    return { kind: "strong", form: null, lemmas: ids.map((id) => ({ id, how: "strong" })).sort(byCount(index)) };
  }

  const qWords = words(q);
  if (!qWords.length || qWords.length > 3) return none;
  const seen = new Set();
  const out = [];
  const add = (list) => {
    for (const m of list.sort(byCount(index))) {
      if (seen.has(m.id)) continue;
      seen.add(m.id);
      out.push(m);
    }
  };

  const phrase = qWords.join(" ");
  const inGloss = index.lemmas.filter((item) => qWords.every((w) => item.glossWords.has(w)));
  // The LIT's own rendering comes first: a reader typing it means it.
  add(bridgeMatches(index, bridge, phrase));
  // A transliteration is one word (a lemma); a gloss can be up to three.
  const keys = qWords.length === 1 ? latinKeys(q) : [];
  add(keys.flatMap((k) => (index.byKey.get(k) ?? []).map((id) => ({ id, how: "translit" }))));
  add(inGloss.filter((item) => item.glossHeads.includes(phrase)).map((item) => ({ id: item.id, how: "gloss" })));
  if (near && keys.some((k) => k.length >= 5)) {
    const close = [];
    for (const item of index.lemmas) {
      if (seen.has(item.id) || Math.abs(item.key.length - keys[0].length) > 2) continue;
      const limit = item.key.length >= 8 ? 2 : 1;
      if (keys.some((k) => k.length >= 5 && levenshtein(k, item.key) <= limit)) {
        close.push({ id: item.id, how: "near" });
      }
    }
    add(close);
  }
  add(inGloss.map((item) => ({ id: item.id, how: "gloss" })));
  // Another sense counts only as a whole gloss, by its head: the senses are
  // many, and a word inside one is loose ("faith" in "father of the faith").
  add(index.lemmas.filter((item) => item.senseHeads.has(phrase)).map((item) => ({ id: item.id, how: "sense" })));
  return { kind: "latin", form: null, query: phrase, lemmas: out };
}

/**
 * The lemmas the search bar's tray shows (BVJ, 2026-10-13): for Greek and a
 * Strong's number, what matched; for Latin text, only an exact
 * transliteration of a lemma or a gloss that *is* the query, at most three,
 * so every English search doesn't grow a Greek group.
 */
export function trayLemmas(index, match) {
  if (!match?.kind) return [];
  if (match.kind !== "latin") return match.lemmas;
  return match.lemmas
    .filter((m) => m.how === "translit" || (m.how === "gloss" && index.lemmas[m.id].glossHeads.includes(match.query)))
    .slice(0, 3);
}

/** matchGreek without near misses, and the lemmas of it the tray shows. */
export function matchForTray(index, raw) {
  const match = matchGreek(index, raw, { near: false });
  return { match, lemmas: trayLemmas(index, match) };
}

/* ── Occurrences ─────────────────────────────────────────────────── */

/**
 * A lemma's occurrences from its shard entry, as
 * [{ book, chapter, verse, t, form }] in Bible order. `bookKeys` is
 * BOOK_ORDER. `bookKey` keeps one book; `form` (a folded form) keeps only the
 * words of that form.
 */
export function decodeOccurrences(entry, bookKeys, { bookKey = "", form = null } = {}) {
  if (!Array.isArray(entry)) return [];
  const [forms, flat] = entry;
  const keep = form ? new Set(forms.map((f, i) => (foldGreek(f) === form ? i : -1)).filter((i) => i >= 0)) : null;
  const out = [];
  for (let i = 0; i + 4 < flat.length; i += 5) {
    const book = bookKeys[flat[i]];
    if (bookKey && book !== bookKey) continue;
    if (keep && !keep.has(flat[i + 4])) continue;
    out.push({ book, chapter: flat[i + 1], verse: flat[i + 2], t: flat[i + 3], form: forms[flat[i + 4]] });
  }
  return out;
}

/** True when a lemma has words of more than one form, so "exact form only" means something. */
export function hasOtherForms(entry, form) {
  if (!Array.isArray(entry) || !form) return false;
  return entry[0].some((f) => foldGreek(f) !== form);
}

/* ── Links ───────────────────────────────────────────────────────── */

/**
 * The link a Greek result opens: the ordinary verse link with one parameter
 * naming the word, `/john-3/?greek=16.7#v16`. The Notebook reads it, opens
 * the Greek tab at that word, and takes the parameter off the address.
 */
export function greekHref({ book, chapter, verse, t }) {
  return `/${book}-${chapter}/?greek=${verse}.${t}#v${verse}`;
}

/** The word a `greek` parameter names ({ verse, t }), or null. */
export function parseGreekParam(value) {
  const m = /^(\d{1,3})\.(\d{1,3})$/.exec(String(value ?? ""));
  return m ? { verse: Number(m[1]), t: Number(m[2]) } : null;
}

/** One line for a lemma: "πίστις · pistis · G4102 · faith · 243 times". */
export function lemmaLine(item) {
  const times = (n) => `${n} time${n === 1 ? "" : "s"}`;
  return [
    item.lemma,
    item.translit,
    item.strong,
    item.shortGloss,
    // Found by a LIT rendering: how often it occurs in the verses so rendered
    // (counted by searchGreek, which knows the occurrences).
    item.lit
      ? `in the LIT “${item.lit.form}”${Number.isInteger(item.lit.counted) ? `, ${times(item.lit.counted)}` : ""}`
      : times(item.count),
  ]
    .filter(Boolean)
    .join(" · ");
}
