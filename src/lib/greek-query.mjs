// src/lib/greek-query.mjs
//
// Searching the Greek with commands (STUDY-DESK.md, "Order of work", 2a):
// by parsing ("any aorist imperative", "πίστις.gen") and by construction
// (πίστις in the genitive followed by Ἰησοῦς or Χριστός in the genitive).
// Pure: the search bar, /search and the Notebook's Greek tab read queries
// with it, and the commands window lists COMMANDS from it, so what the window
// teaches and what a query accepts are one list. Single words still go
// through greek-search.mjs's matchGreek, which this builds on.
//
// A query is one or more words joined by "," or "and". A word is
//   πίστις, pistis, G4102   any form of that word (a lemma, a form, a
//                           transliteration, a Strong's number, or an
//                           English gloss that is the whole query word)
//   Ἰησοῦς/Χριστός          either word ("or" too)
//   =πίστεως                that form only ("exact" too)
//   *                       any word ("any" too); it needs a filter
// followed by filters, joined to it with dots (πίστις.gen, *.aor.impv) or
// typed after it as words (pistis genitive, any aorist imperative). Two
// filters of one kind joined by "/" or "or" are either one (πίστις.gen/dat,
// "pistis genitive or dative"); joined by a dot they would ask for a word
// that is both, which is an error. How
// close the words must be is one setting for the whole query: within 3
// words (~3, the default), next to each other (~0), anywhere in the verse
// (~v), and in any order (&); each has its words too.
//
// Two rules keep commands from taking over a word someone meant:
//   - A query of one bare word is always a word: "any", "exact", "and",
//     "perfect" and "genitive" are searched as English glosses. Two words
//     ("aorist imperative") or a symbol ("*.pf") make it a command query.
//   - Quotes always mean the word itself: πίστις and "and".
// A command word or symbol at the end is still being typed, and waits for
// what follows, so results don't jump about mid-query.
//
// Words are matched against MorphGNT codes (greek-search.mjs, "A code is"):
// ten characters, the part of speech then person, tense, voice, mood, case,
// number, gender and degree.

import { foldGreek, hasGreek, matchGreek, parseGroup } from "./greek-search.mjs";
import { levenshtein } from "./levenshtein.mjs";

/* ── Filters ─────────────────────────────────────────────────────── */

// Where each axis sits in a code ("V-2AAD-P--").
const AT = { person: 2, tense: 3, voice: 4, mood: 5, case: 6, number: 7, gender: 8, degree: 9 };

/**
 * Every filter: its axis, the code it matches, what it is called (`name`,
 * which the readback uses) and the words a reader can type for it, the
 * shortcut first. Parts of speech match the code's first two characters;
 * "pronoun" matches every pronoun but the article.
 */
export const FILTERS = [
  { axis: "pos", code: "N-", name: "noun", words: ["noun"] },
  { axis: "pos", code: "V-", name: "verb", words: ["verb"] },
  { axis: "pos", code: "A-", name: "adjective", words: ["adj", "adjective"] },
  { axis: "pos", code: "RA", name: "article", words: ["art", "article"] },
  { axis: "pos", code: "R*", name: "pronoun", words: ["pron", "pronoun"] },
  { axis: "pos", code: "P-", name: "preposition", words: ["prep", "preposition"] },
  { axis: "pos", code: "C-", name: "conjunction", words: ["conj", "conjunction"] },
  { axis: "pos", code: "D-", name: "adverb", words: ["adv", "adverb"] },
  { axis: "pos", code: "X-", name: "particle", words: ["particle"] },
  { axis: "pos", code: "I-", name: "interjection", words: ["interjection"] },
  { axis: "tense", code: "P", name: "present", words: ["pres", "present"] },
  { axis: "tense", code: "I", name: "imperfect", words: ["impf", "imperfect"] },
  { axis: "tense", code: "F", name: "future", words: ["fut", "future"] },
  { axis: "tense", code: "A", name: "aorist", words: ["aor", "aorist"] },
  { axis: "tense", code: "X", name: "perfect", words: ["pf", "perf", "perfect"] },
  { axis: "tense", code: "Y", name: "pluperfect", words: ["plpf", "pluperfect"] },
  { axis: "voice", code: "A", name: "active", words: ["act", "active"] },
  { axis: "voice", code: "M", name: "middle", words: ["mid", "middle"] },
  { axis: "voice", code: "P", name: "passive", words: ["pass", "passive"] },
  { axis: "mood", code: "I", name: "indicative", words: ["ind", "indicative"] },
  { axis: "mood", code: "D", name: "imperative", words: ["impv", "imperative"] },
  { axis: "mood", code: "S", name: "subjunctive", words: ["subj", "subjunctive"] },
  { axis: "mood", code: "O", name: "optative", words: ["opt", "optative"] },
  { axis: "mood", code: "N", name: "infinitive", words: ["inf", "infinitive"] },
  { axis: "mood", code: "P", name: "participle", words: ["ptc", "ptcp", "participle"] },
  { axis: "case", code: "N", name: "nominative", words: ["nom", "nominative"] },
  { axis: "case", code: "G", name: "genitive", words: ["gen", "genitive"] },
  { axis: "case", code: "D", name: "dative", words: ["dat", "dative"] },
  { axis: "case", code: "A", name: "accusative", words: ["acc", "accusative"] },
  { axis: "case", code: "V", name: "vocative", words: ["voc", "vocative"] },
  { axis: "number", code: "S", name: "singular", words: ["sg", "sing", "singular"] },
  { axis: "number", code: "P", name: "plural", words: ["pl", "plural"] },
  { axis: "gender", code: "M", name: "masculine", words: ["masc", "masculine"] },
  { axis: "gender", code: "F", name: "feminine", words: ["fem", "feminine"] },
  { axis: "gender", code: "N", name: "neuter", words: ["neut", "neuter"] },
  { axis: "person", code: "1", name: "1st person", words: ["1st"] },
  { axis: "person", code: "2", name: "2nd person", words: ["2nd"] },
  { axis: "person", code: "3", name: "3rd person", words: ["3rd"] },
  { axis: "degree", code: "C", name: "comparative", words: ["comp", "comparative"] },
  { axis: "degree", code: "S", name: "superlative", words: ["superl", "superlative"] },
];

/** The order an axis is named in, in the readback and the commands window. */
export const AXES = ["pos", "person", "tense", "voice", "mood", "case", "number", "gender", "degree"];

const FILTER_BY_WORD = new Map(FILTERS.flatMap((f) => f.words.map((w) => [w, f])));

/** The filter a typed word names ("gen", "Genitive"), or null. */
export const filterFor = (word) => FILTER_BY_WORD.get(String(word ?? "").toLowerCase()) ?? null;

/** The filter word a mistyped one was probably meant to be ("genetive" → "genitive"), or null. */
export function nearestFilter(word) {
  const w = String(word ?? "").toLowerCase();
  if (w.length < 4) return null;
  let best = null;
  for (const f of FILTERS) {
    for (const name of f.words) {
      if (name.length < 4) continue;
      const d = levenshtein(w, name);
      if (d <= (name.length >= 8 ? 2 : 1) && (!best || d < best.d)) best = { d, word: f.words[f.words.length - 1] };
    }
  }
  return best?.word ?? null;
}

const fitsOne = (f, c) =>
  f.axis === "pos" ? (f.code === "R*" ? c[0] === "R" && c[1] !== "A" : c.slice(0, 2) === f.code) : c[AT[f.axis]] === f.code;

/**
 * True when a ten-character code fits `filters` (a list of FILTERS entries):
 * one of each kind given, so two of one kind ("gen/dat") mean either.
 */
export function codeFits(filters, code) {
  const c = String(code ?? "");
  const axes = new Set(filters.map((f) => f.axis));
  for (const axis of axes) {
    if (!filters.some((f) => f.axis === axis && fitsOne(f, c))) return false;
  }
  return true;
}

/* ── The commands window ─────────────────────────────────────────── */

/**
 * What the commands window lists, in its groups (BVJ, 2026-10-14: one window
 * holds the instructions and examples, so the pages don't grow them). Each
 * item: `code` the shortcut, `word` what can be typed instead, `means`, an
 * optional `note`, and `insert`, what clicking it adds at the cursor.
 * `filter` names the parsing word an error can point to.
 */
export const COMMANDS = [
  {
    title: "Building a search",
    items: [
      { code: "πίστις", greek: true, means: "Any form of a word", note: "In Greek, transliterated (pistis) or by Strong’s number (G4102)", insert: "" },
      { code: ",", word: "and", means: "Then another word", note: "πίστις.gen, Χριστός.gen: found together, in that order. Up to four words", insert: ", " },
      { code: ".gen", means: "Narrow the word before it", note: "Join several: *.aor.impv", insert: ".gen" },
      { code: "*", word: "any", means: "Any word", note: "Needs a filter: *.gen.noun is any genitive noun", insert: "*" },
      { code: "/", word: "or", means: "Either one", note: "Two words, Ἰησοῦς/Χριστός, or two filters of one kind, πίστις.gen/dat", insert: "/" },
      { code: "=", word: "exact", means: "This form only", note: "=πίστεως leaves out the word’s other forms", insert: "=" },
      { code: "\"any\"", means: "The word itself", note: "Quotes search for “any,” “exact,” “and,” or “or” as a word", insert: "\"" },
    ],
  },
  {
    title: "How close",
    items: [
      { code: "~3", word: "within 3", means: "Within 3 words", note: "The default", insert: "~3" },
      { code: "~0", word: "next to", means: "Next to each other", insert: "~0" },
      { code: "~v", word: "anywhere", means: "Anywhere in the verse", insert: "~v" },
      { code: "&", word: "any order", means: "In any order", insert: "&" },
    ],
  },
  ...[
    ["Part of speech", "pos"], ["Tense", "tense"], ["Voice", "voice"], ["Mood", "mood"], ["Case", "case"],
    ["Number", "number"], ["Gender", "gender"], ["Person", "person"], ["Degree", "degree"],
  ].map(([title, axis]) => ({
    title,
    items: FILTERS.filter((f) => f.axis === axis).map((f) => {
      const short = f.words[0];
      const long = f.words[f.words.length - 1];
      return { code: `.${short}`, word: long === short ? null : long, means: f.name, insert: `.${short}`, filter: long };
    }),
  })),
];

/** Examples the window and an empty search offer, each run as written. */
export const EXAMPLES = [
  { query: "πίστις.gen, Ἰησοῦς/Χριστός.gen", says: "πίστις in the genitive, then Jesus or Christ in the genitive" },
  { query: "*.aor.impv", says: "Every aorist imperative" },
  { query: "πίστις.gen", says: "Every genitive of πίστις" },
  { query: "pistis genitive and Iesous or Christos genitive", says: "The first search in words alone, without Greek letters" },
];

/* ── Reading a query ─────────────────────────────────────────────── */

/** The most words a construction joins (BA44), which keeps matchConstruction fast. */
export const MAX_TERMS = 4;

const QUOTED = /["“”]([^"“”]+)["“”]/g;
const LITERAL = "\u0001";
const COMMAND_WORD = /^(?:any|exact(?:ly)?|and|or)$/i;
// A command still being typed at the end, which waits for what follows.
const PENDING = /(?:(?:^|\s+)(?:and|or|exact(?:ly)?|any|within|next)|\s*[,/=.]|(?:^|\s+)[*~])\s*$/i;
// Words that make a query of plain words a command query.
const COMMAND_WORDS = /^(?:and|or|any|exact(?:ly)?|within|next|anywhere|order)$/i;

/**
 * Whether a query is for this module rather than matchGreek: a symbol a
 * command uses, or several words of which one is Greek, a command word or a
 * filter word. One bare word is always a word, and plain English words ("son
 * of man") stay a gloss search; when that finds nothing, a caller may try
 * them here as a construction (pistis Christos).
 */
export function isCommandQuery(raw) {
  const q = String(raw ?? "").trim().replace(QUOTED, " x ").trim();
  if (!q) return false;
  if (/[.,/*=~&]/.test(q)) return true;
  const toks = q.split(/\s+/);
  if (toks.length < 2) return false;
  return toks.some((t) => hasGreek(t) || COMMAND_WORDS.test(t) || filterFor(t)) || /\b(?:first|second|third)\s+person\b/i.test(q);
}

/** True when a read query is one plain word, which matchGreek searches better (lemma choice, "exact form only"). */
export function isSimpleQuery(parsed) {
  const t = parsed?.terms;
  return Boolean(t?.length === 1 && t[0].words?.length === 1 && !t[0].exact && !t[0].filters.length);
}

/**
 * A query read into terms, before any word is looked up:
 *   { terms: [term, …], gap, anyOrder }
 * where a term is { words: [string] | null (any word), exact, literal,
 * filters: [FILTERS entry] }, `gap` is how many words may come between two
 * terms (Infinity for anywhere in the verse) and `anyOrder` whether they may
 * come in either order. Or { error } (see errorMessage), or { terms: [] }
 * while there is nothing to search yet.
 */
export function parseGreekQuery(raw) {
  let q = String(raw ?? "").trim();
  if (!q) return { terms: [], gap: 3, anyOrder: false };

  const literals = [];
  const keep = (w) => `${LITERAL}${literals.push(w.trim()) - 1}`;
  q = q.replace(QUOTED, (_, w) => ` ${keep(w)} `).replace(/["“”]/g, " ").trim();
  // One bare word is a word, even a command or parsing word ("any", "perfect").
  if (COMMAND_WORD.test(q) || (!/[\s.,/*=~&]/.test(q) && !q.startsWith(LITERAL))) {
    return { terms: [{ words: [q.startsWith(LITERAL) ? literals[Number(q.slice(1))] : q], exact: false, literal: true, filters: [] }], gap: 3, anyOrder: false };
  }
  while (q && PENDING.test(q) && !new RegExp(`^${LITERAL}\\d+$`).test(q)) q = q.replace(PENDING, "").trim();
  if (!q) return { terms: [], gap: 3, anyOrder: false };

  q = q
    .replace(/\bexact(?:ly)?\s+/gi, "=")
    .replace(/\s+and\s+/gi, " , ")
    .replace(/\bwithin\s+(\d+)(?:\s+words?)?\b/gi, "~$1")
    .replace(/\bnext\s+to(?:\s+each\s+other)?\b/gi, "~0")
    .replace(/\banywhere(?:\s+in\s+the\s+verse)?\b/gi, "~v")
    .replace(/\b(?:in\s+)?any\s+order\b/gi, "&")
    .replace(/\b(1st|2nd|3rd|first|second|third)\s+person\b/gi, (_, p) => `${p[0] === "f" || p[0] === "1" ? "1st" : p[0] === "s" || p[0] === "2" ? "2nd" : "3rd"}`)
    .replace(/\s+or\s+/gi, "/")
    .replace(/\s*\/\s*/g, "/")
    .replace(/,/g, " , ");

  const terms = [];
  let gap = 3;
  let anyOrder = false;
  const last = () => terms[terms.length - 1];
  const close = () => { if (terms.length) last().closed = true; };
  // Each name is a filter, or several of one kind joined by "/" ("gen/dat"),
  // which a word may match any of (BVJ, 2026-10-15). Two of one kind joined
  // by a dot ("gen.dat") ask for a word that is both, and are an error.
  const addFilters = (term, names) => {
    for (const name of names) {
      const parts = name.split("/").filter(Boolean);
      const found = [];
      for (const part of parts) {
        const f = filterFor(part);
        if (!f) {
          const near = nearestFilter(part);
          return near ? { kind: "near", word: part, near } : { kind: "notCommand", word: part };
        }
        if (!found.includes(f)) found.push(f);
      }
      if (new Set(found.map((f) => f.axis)).size > 1) {
        return { kind: "mixedAxes", word: name, names: found.map((f) => f.name) };
      }
      const clash = term.filters.find((g) => g.axis === found[0].axis && !found.includes(g));
      if (clash) return { kind: "conflict", word: parts[0], other: clash.name, name: found[0].name };
      for (const f of found) if (!term.filters.includes(f)) term.filters.push(f);
    }
    return null;
  };
  const isFilterSpec = (s) => Boolean(s) && s.split("/").every((p) => p && filterFor(p));

  for (const tok of q.split(/\s+/).filter(Boolean)) {
    if (tok === ",") { close(); continue; }
    if (/^~\d+$/.test(tok)) { gap = Number(tok.slice(1)); close(); continue; }
    if (tok === "~v") { gap = Infinity; close(); continue; }
    if (tok === "&") { anyOrder = true; close(); continue; }
    const [head, ...rest] = tok.split(".");

    // ".gen" after a space narrows the word before it; with no word before
    // it, it is "*.gen" (BA48: it was dropped without a word).
    if (head === "" && terms.length) {
      const err = addFilters(last(), rest.filter(Boolean));
      if (err) return { error: err };
      continue;
    }
    // A filter typed as a word narrows the word before it, or starts "any word".
    if (isFilterSpec(head) && rest.every(isFilterSpec)) {
      let term = last();
      if (!term || term.closed) terms.push((term = { words: null, exact: false, literal: false, filters: [], closed: false }));
      const err = addFilters(term, [head, ...rest]);
      if (err) return { error: err };
      continue;
    }

    close();
    const term = { words: null, exact: false, literal: false, filters: [], closed: false };
    if (head.startsWith(LITERAL)) {
      term.words = [literals[Number(head.slice(1))]];
      term.literal = true;
    } else if (head !== "" && head !== "*" && head.toLowerCase() !== "any") {
      term.exact = head.startsWith("=");
      term.words = (term.exact ? head.slice(1) : head).split(/[/|]/).filter(Boolean);
      if (!term.words.length) continue;
      // "pistis genetive": a misspelled filter, if it turns out not to be a word.
      if (term.words.length === 1 && !hasGreek(head) && !rest.length && terms.length) term.nearFilter = nearestFilter(head);
    }
    const err = addFilters(term, rest.filter(Boolean));
    if (err) return { error: err };
    terms.push(term);
  }

  for (const t of terms) delete t.closed;
  if (terms.some((t) => !t.words && !t.filters.length)) return { error: { kind: "bareAny" } };
  if (terms.length > MAX_TERMS) return { error: { kind: "tooMany" } };
  return { terms, gap, anyOrder };
}

/* ── Looking words up ────────────────────────────────────────────── */

/**
 * Each term's lemmas, from the index (prepareIndex): every lemma a Greek form
 * can be (ἦν is εἰμί or ὅς), a lemma typed directly alone, a Strong's
 * number's lemmas, and for Latin text an exact transliteration or a gloss
 * that is the word (the tray's rule, trayLemmas). Adds to each term
 *   lemmaIds: [id] | null (any word), form: folded form for "=", and
 *   shown: what the readback names it by.
 * Returns { terms, gap, anyOrder } or { error }.
 */
export function resolveGreekQuery(index, parsed, { bridge = null } = {}) {
  if (!parsed || parsed.error) return parsed;
  const terms = [];
  for (const term of parsed.terms) {
    if (!term.words) {
      terms.push({ ...term, lemmaIds: null, form: null, shown: [] });
      continue;
    }
    const ids = [];
    const shown = [];
    let form = null;
    for (const w of term.words) {
      const match = matchGreek(index, w, { near: false, bridge });
      // Latin text: the LIT's own rendering, an exact transliteration, or a
      // gloss that is the whole word, at most three (the tray's rule, with
      // the LIT added).
      let found = match.kind === "latin"
        ? match.lemmas
          .filter((m) => m.how === "lit" || m.how === "translit" || (m.how === "gloss" && index.lemmas[m.id].glossHeads.includes(match.query)))
          .slice(0, 3)
        : match.lemmas;
      if (term.exact) {
        if (!hasGreek(w)) return { error: { kind: "exactGreek", word: w } };
        form = foldGreek(w);
        found = (index.byForm.get(form) ?? []).map((id) => ({ id }));
      }
      if (!found.length) {
        return { error: term.nearFilter ? { kind: "near", word: w, near: term.nearFilter } : { kind: "unknown", word: w } };
      }
      for (const m of found) if (!ids.includes(m.id)) ids.push(m.id);
      shown.push({ word: w, lemmas: found.map((m) => index.lemmas[m.id].lemma), gloss: match.kind === "latin" && !found.some((m) => m.how === "translit") ? w : null });
    }
    const { nearFilter, ...rest } = term;
    terms.push({ ...rest, lemmaIds: ids, form, shown });
  }
  return { ...parsed, terms };
}

/**
 * The parse groups (search/parse.json's names) an any-word term needs: those
 * that can hold a word with every filter. Leaves out only what can't match;
 * codeFits decides each word. The groups are split by part of speech and
 * case, or tense and mood, so number, gender and person alone narrow nothing:
 * "*.sg" loads 54 of the 57 files, about 600 KB compressed, once a visit.
 * Accepted (BVJ, 2026-10-27; BA49) rather than asking for a part of speech.
 */
export function groupsForFilters(filters, groupNames) {
  // Each kind of filter given, with the codes a word may have for it.
  const want = {};
  for (const f of filters) (want[f.axis] ??= []).push(f.code);
  const posFits = (pos, code) => (code === "R*" ? pos.startsWith("r") && pos !== "ra" : pos === code.replace("-", "").toLowerCase());
  return groupNames.filter((name) => {
    const [pos, rest = ""] = name.split("-");
    const isVerb = pos === "v";
    const cased = !isVerb && rest.length === 1;
    if (want.pos && !want.pos.some((code) => posFits(pos, code))) return false;
    if (isVerb) {
      const [tense, mood] = rest.toUpperCase();
      if (want.tense && !want.tense.includes(tense)) return false;
      if (want.mood && !want.mood.includes(mood)) return false;
      if ((want.case || want.gender) && mood !== "P") return false;
      if (want.person && !"IDSO".includes(mood)) return false;
      if (want.degree) return false;
      return true;
    }
    // MorphGNT marks person on verbs alone (ἡμεῖς is RP----NP--).
    if (want.tense || want.voice || want.mood || want.person) return false;
    if (cased) return !want.case || want.case.includes(rest.toUpperCase());
    return !want.case && !want.number && !want.gender && !want.degree;
  });
}

/* ── Matching ────────────────────────────────────────────────────── */

/**
 * Where the terms occur together. `lists` holds, for each term in order, its
 * words: [{ book, chapter, verse, t }] with `book` a BOOK_ORDER index or key.
 * A match is one occurrence of the first term with a word of each later term
 * after it (before it too with anyOrder), each no more than `gap` words from
 * the one before. Every word of the first term that has a match counts once,
 * and its match marks every later word that could pair with it.
 *
 * Returns [{ book, chapter, verse, matches: [[t, …]] }] in Bible order.
 */
export function matchConstruction(lists, { gap = 3, anyOrder = false, bookOrder = null } = {}) {
  if (!lists.length) return [];
  const key = (w) => `${w.book}|${w.chapter}|${w.verse}`;
  const byVerse = lists.map((list) => {
    const m = new Map();
    for (const w of list) {
      const k = key(w);
      const at = m.get(k);
      if (at) at.push(w.t);
      else m.set(k, [w.t]);
    }
    return m;
  });
  if (lists.length > MAX_TERMS) throw new RangeError(`at most ${MAX_TERMS} terms`);
  // Whether `t` may follow `prev`: after it unless in any order, and no more
  // than `gap` words between.
  const near = (prev, t) => t !== prev && (anyOrder || t > prev) && Math.abs(t - prev) - 1 <= gap;
  const out = [];
  for (const [k, firsts] of byVerse[0]) {
    if (byVerse.some((m) => !m.has(k))) continue;
    const later = byVerse.slice(1).map((m) => [...new Set(m.get(k))]);
    const matches = [];
    for (const t0 of [...new Set(firsts)].sort((a, b) => a - b)) {
      const marked = marksFrom(t0, later, near);
      if (marked) matches.push([...marked].sort((a, b) => a - b));
    }
    if (!matches.length) continue;
    const [book, chapter, verse] = k.split("|");
    out.push({ book: /^\d+$/.test(book) ? Number(book) : book, chapter: Number(chapter), verse: Number(verse), matches });
  }
  const rank = (b) => (typeof b === "number" ? b : bookOrder ? bookOrder.indexOf(b) : 0);
  return out.sort((a, b) => rank(a.book) - rank(b.book) || a.chapter - b.chapter || a.verse - b.verse);
}

/**
 * Every word on some match from first word `t0`, or null when there is
 * none. A match is a chain t0, w1, …, of distinct words, one from each later
 * list, each `near` the one before. Walking every chain grew exponentially
 * (BA44: five "*.sg" in any order took minutes), so a chain is built round
 * its middle: at most three later terms (MAX_TERMS) keep this cubic in a
 * verse's words.
 */
function marksFrom(t0, later, near) {
  const marked = new Set([t0]);
  if (!later.length) return marked;
  const [l1, l2, l3] = later.map((list) => list.filter((t) => t !== t0));
  if (later.length === 1) {
    for (const w1 of l1) if (near(t0, w1)) marked.add(w1);
  } else if (later.length === 2) {
    for (const w1 of l1) {
      if (!near(t0, w1)) continue;
      const w2s = l2.filter((w2) => w2 !== w1 && near(w1, w2));
      if (!w2s.length) continue;
      marked.add(w1);
      for (const w2 of w2s) marked.add(w2);
    }
  } else {
    for (const w2 of l2) {
      const w1s = l1.filter((w1) => w1 !== w2 && near(t0, w1) && near(w1, w2));
      if (!w1s.length) continue;
      const w3s = l3.filter((w3) => w3 !== w2 && near(w2, w3));
      // A w1 needs some w3 other than itself.
      const ok = w1s.filter((w1) => w3s.some((w3) => w3 !== w1));
      if (!ok.length) continue;
      marked.add(w2);
      for (const w1 of ok) marked.add(w1);
      // A w3 needs some w1 other than itself.
      for (const w3 of w3s) if (ok.length > 1 || ok[0] !== w3) marked.add(w3);
    }
  }
  return marked.size > 1 ? marked : null;
}

/* ── Saying it back ──────────────────────────────────────────────── */

const MOOD_PLURAL = { I: "indicatives", D: "imperatives", S: "subjunctives", O: "optatives", N: "infinitives", P: "participles" };
const CASE_PLURAL = { N: "nominatives", G: "genitives", D: "datives", A: "accusatives", V: "vocatives" };
const POS_PLURAL = {
  "N-": "nouns", "V-": "verbs", "A-": "adjectives", RA: "articles", "R*": "pronouns", "P-": "prepositions",
  "C-": "conjunctions", "D-": "adverbs", "X-": "particles", "I-": "interjections",
};
const singular = (plural) => plural.replace(/ies$/, "y").replace(/s$/, "");

/**
 * The query in plain English, as the results' first line says it back
 * ("Genitives of πίστις, followed within 3 words by a genitive of Ἰησοῦς or
 * Χριστός"). `greek` wraps each Greek word (the caller escapes and marks its
 * language); every other piece passes through `text`, for escaping.
 */
export function describeGreekQuery(resolved, { greek = (s) => s, text = (s) => s } = {}) {
  if (!resolved?.terms?.length) return "";
  const parts = resolved.terms.map((term, i) => describeTerm(term, i === 0, greek, text));
  let out = parts[0].charAt(0).toUpperCase() + parts[0].slice(1);
  const { gap, anyOrder } = resolved;
  // Each later word is placed from the one before it, so each says how far
  // (BA50); in any order there is no "then".
  const how = (i) => {
    if (gap === Infinity) return "anywhere in the verse";
    if (gap === 0) return anyOrder ? (i > 1 ? "next to that" : "next to it") : "directly";
    return `within ${gap} ${gap === 1 ? "word" : "words"}${anyOrder && i > 1 ? " of that" : ""}`;
  };
  for (let i = 1; i < parts.length; i++) {
    if (anyOrder) out += `${i > 1 ? " and" : ", with"} ${parts[i]} ${how(i)}`;
    else out += `, ${i > 1 ? "then" : "followed"} ${how(i)} by ${parts[i]}`;
  }
  if (anyOrder && parts.length > 1) out += parts.length > 2 ? ", in any order" : ", in either order";
  return out;
}

function describeTerm(term, lead, greek, text) {
  // Every filter of a kind; two or more of one kind are "either".
  const get = (axis) => term.filters.filter((f) => f.axis === axis);
  const either = (fs) => fs.map((f) => f.name).join(" or ");
  const mood = get("mood");
  const cas = get("case");
  const pos = get("pos");
  // "Genitive participles", "aorist active imperatives", then person,
  // gender, number and degree in parentheses: "(2nd person plural)".
  const adj = ["tense", "voice"].map(get).filter((fs) => fs.length).map(either);
  let nouns = null;
  if (mood.length) {
    nouns = mood.map((f) => MOOD_PLURAL[f.code]);
    if (cas.length) adj.push(either(cas));
  } else if (cas.length && pos.length) {
    adj.push(either(cas));
    nouns = pos.map((f) => POS_PLURAL[f.code]);
  } else if (cas.length) nouns = cas.map((f) => CASE_PLURAL[f.code]);
  else if (pos.length) nouns = pos.map((f) => POS_PLURAL[f.code]);
  const plural = nouns ? nouns.join(" or ") : null;
  const more = ["person", "gender", "number", "degree"].map(get).filter((fs) => fs.length).map(either);
  if (!plural && !adj.length && more.length) adj.push(...more.splice(0));
  const tail = more.length ? text(` (${more.join(" ")})`) : "";

  let word = null;
  if (term.lemmaIds) {
    word = term.shown
      .map((s) => {
        const names = term.exact ? [s.word] : s.lemmas;
        const g = names.map(greek).join(text(" or "));
        return s.gloss ? `${g}${text(` (“${s.gloss}”)`)}` : g;
      })
      .join(text(" or "));
    if (term.exact) word = `${text("the form ")}${word}`;
  }

  if (!plural && !adj.length) return word ? (term.exact || !lead ? word : `${text("any form of ")}${word}`) : text("any word");
  const noun = lead ? plural ?? "forms" : nouns ? nouns.map(singular).join(" or ") : "form";
  const head = text([...adj, noun].join(" "));
  const phrase = (word ? `${head}${text(" of ")}${word}` : head) + tail;
  if (lead) return phrase;
  return `${text(/^[aeiou]/i.test([...adj, noun][0]) ? "an " : "a ")}${phrase}`;
}

/** How many matches and verses, as the readback ends ("6 matches in 5 verses"). */
export function countLine(hits) {
  const m = hits.reduce((n, h) => n + h.matches.length, 0);
  const v = hits.length;
  return `${m.toLocaleString("en-US")} ${m === 1 ? "match" : "matches"} in ${v.toLocaleString("en-US")} ${v === 1 ? "verse" : "verses"}`;
}

/**
 * What went wrong, for the reader: `text` is the sentence, and `suggest` and
 * `filter` what the error can offer (the word to put in, the command to show
 * in the window).
 */
export function errorMessage(error) {
  switch (error?.kind) {
    case "near":
      return { text: `“${error.word}” isn’t a command. Did you mean ${error.near}?`, suggest: error.near, replace: error.word, filter: error.near };
    case "notCommand":
      return { text: `“${error.word}” isn’t a command.`, filter: null };
    case "conflict":
      return { text: `A word can’t be both ${error.other} and ${error.name}. For either one, join them with a slash, like gen/dat.`, filter: error.name };
    case "mixedAxes":
      return { text: `A slash joins two of one kind, like gen/dat or aor/pres, not ${error.names.join(" and ")}.`, filter: null };
    case "tooMany":
      return { text: `A search can join at most ${MAX_TERMS} words.`, filter: null };
    case "bareAny":
      return { text: "“Any word” needs a filter after it, like any genitive noun.", filter: null };
    case "exactGreek":
      return { text: `“Exact” needs the form in Greek letters, like =πίστεως.`, filter: null };
    case "unknown":
      return { text: `No Greek word matches “${error.word}.”`, filter: null };
    default:
      return { text: "That search couldn’t be read.", filter: null };
  }
}

export { parseGroup };
