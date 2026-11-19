// src/lib/greek-builder.mjs
//
// The Greek search builder's rules (STUDY-DESK-FIXES.md, E5): the menu-based way to
// put a command search together, in the commands window. Pure and unit-tested;
// the window (src/scripts/greek-builder.js) only draws what this decides.
//
// The one idea: **the search field is the only record of the search.** The
// builder reads the field with the language's own parser (parseGreekQuery) and
// writes it with `writeBuilder`, so the field and the builder cannot disagree
// about what is being searched, and a reader who types in the field sees the
// builder follow. A search the builder can't show (a quoted word, an exact
// form, a plain word search, one that doesn't read) is said so, never guessed
// at.
//
// A builder holds a list of cards, one per word (at most MAX_TERMS), and how
// close the words must be. A card is
//   { words: [string], filters: [FILTERS entry] }
// where an empty `words` is "any word". A card's box takes what the field
// takes (E162): the word with its filters ("πίστις.gen", "pistis genitive"),
// and a comma or ">" there starts the next card (`readCardBox`). Each card's menus list only what the
// word takes: `builderOffers` reads the codes its lemmas' words carry in the
// index (public/greek/search/occ/), so a noun offers no tense and, once
// "genitive" is chosen, only the numbers and genders the word has in it.

import {
  FILTERS,
  MAX_TERMS,
  codeFits,
  errorMessage,
  filterFor,
  isGreekCommandQuery,
  parseGreekQuery,
  plainLatinWords,
  resolveGreekQuery,
} from "./greek-query.mjs";
import { QUERY_AXES } from "./greek-commands-ui.mjs";
import { OCC_STRIDE, hasGreek, parseStrong, strongFilter } from "./greek-search.mjs";

export { MAX_TERMS as MAX_CARDS, QUERY_AXES as BUILDER_AXES };

/** What each kind of filter is called above its choices. */
export const AXIS_LABELS = {
  pos: "Part of speech", tense: "Tense", voice: "Voice", mood: "Mood", case: "Case",
  person: "Person", number: "Number", gender: "Gender", degree: "Degree",
};

export const emptyCard = () => ({ words: [], filters: [] });

/* ── The field to the builder, and back ──────────────────────────── */

/**
 * What the builder shows for the field's text:
 *   { cards, gap, anyOrder, plain? }  the search it can show (no cards for an empty field)
 *   { cannot: "exact" | "plain" | "error", error? }
 *                                     a search it can't, which the field still runs
 * One bare word is a word card with no filters. Two or three plain Latin
 * words are read as a construction (`plain: true`), as the field runs them
 * when no single word fits; longer plain words ("son of the man") are a word
 * search of their own, so they can't be shown.
 * A quoted word ("perfect".gen) is a card holding that word: quotes are how a
 * word that is also a command is written (see `writeCard`).
 */
export function readBuilder(raw) {
  const text = String(raw ?? "").trim();
  if (!text) return { cards: [], gap: 3, anyOrder: true };
  const quoted = /["“”]/.test(text);
  if (!quoted && !/\s/.test(text) && !/[.,/*=~&>]/.test(text)) {
    return { cards: [{ words: [text], filters: [] }], gap: 3, anyOrder: true };
  }
  // Two or three plain Latin words are what the field runs as a construction
  // when no single word fits them whole ("pistis Christos"); the builder reads
  // them the same way (GK3-5, BVJ 2026-11-07), and says so (`plain`).
  const plain = !quoted && !isGreekCommandQuery(text) && plainLatinWords(text);
  if (!quoted && !plain && !isGreekCommandQuery(text)) return { cannot: "plain" };
  const parsed = parseGreekQuery(text);
  if (parsed.error) return { cannot: "error", error: parsed.error };
  if (parsed.terms.some((t) => t.exact)) return { cannot: "exact" };
  const read = {
    cards: parsed.terms.map((t) => ({ words: t.words ? [...t.words] : [], filters: [...t.filters] })),
    gap: parsed.gap,
    anyOrder: parsed.anyOrder,
  };
  return plain ? { ...read, plain: true } : read;
}

/** The sentence under the builder for a search it can't show. */
export function cannotSay(read) {
  switch (read?.cannot) {
    case "exact":
      return "This search asks for one form only (=), which the builder can’t show. Your field still runs it.";
    case "plain":
      return "This is an ordinary word search, so there is nothing to build. Start a new search to build one.";
    case "error":
      // A too-long search already says to shorten it in the field (GK6-11).
      return read.error?.kind === "tooLong"
        ? `${errorMessage(read.error).text} Or start a new search here.`
        : `${errorMessage(read.error).text} Fix it in the field, or start a new search here.`;
    default:
      return "";
  }
}

/** The text a filter adds to a word: its shortcut, as the commands list shows it. */
const shortcut = (f) => f.words[0];

// The words the parser takes for a command wherever they stand ("and" ends a
// word, "perfect" is a tense), which a card holding one must quote.
const COMMAND_WORD = /^(?:any|exact(?:ly)?|and|or|then|within|next|anywhere|order|first|second|third)$/i;

/** Whether a word, written bare, would be read as a command and not as the word. */
export const needsQuotes = (word) => /[\s.,/*=~&>]/.test(word) || COMMAND_WORD.test(word) || Boolean(filterFor(word));

/**
 * The words a card can hold. A quote can't sit inside "Ἰησοῦς/Χριστός", so a
 * card with several words leaves out the ones that need quotes; one word
 * alone keeps it, and is written quoted.
 */
export const usableWords = (words) => (words.length > 1 ? words.filter((w) => !needsQuotes(w)) : words);

/** One card as typed: πίστις.gen, Ἰησοῦς/Χριστός.gen/dat, *.aor.impv. Empty for an empty card. */
export function writeCard(card) {
  if (!card.words.length && !card.filters.length) return "";
  const by = new Map();
  for (const f of card.filters) {
    if (!by.has(f.axis)) by.set(f.axis, []);
    if (!by.get(f.axis).includes(f)) by.get(f.axis).push(f);
  }
  const tail = QUERY_AXES.filter((ax) => by.has(ax)).map((ax) => `.${by.get(ax).map(shortcut).join("/")}`).join("");
  // One word that would be read as a command is quoted; so is a bare one with
  // a symbol in it, which the box doesn't allow but a field can hold.
  const head = card.words.length === 1 && needsQuotes(card.words[0]) ? `"${card.words[0]}"` : card.words.join("/");
  return (card.words.length ? head : "*") + tail;
}

/**
 * The field's text for a builder: the cards that hold something, joined with
 * commas (any order, the default) or with ">" (in this order; E164), then how
 * close once there are two words. An empty card writes nothing, so it can wait
 * in the window for its word.
 */
export function writeBuilder({ cards, gap = 3, anyOrder = true }) {
  const parts = cards.map(writeCard).filter(Boolean).slice(0, MAX_TERMS);
  let q = parts.join(anyOrder ? ", " : " > ");
  if (parts.length > 1) {
    if (gap === Infinity) q += " ~v";
    else if (gap !== 3) q += ` ~${gap}`;
  }
  return q;
}

/* ── A card's box ────────────────────────────────────────────────── */

// Between two words in a box: a comma or ">", or "and" or "then" with a space
// after it, so a word still being typed ("andr…") is never cut (E162).
const JOINER = /\s*([,>])\s*|\s+(and|then)\s+/gi;
// Settings for the whole search, typed in a box: how close, and any order.
const SAYS_GAP = /~(?:\d|v)|\bwithin\s+\d|\bnext\s+to\b|\banywhere\b/i;
const SAYS_ANY_ORDER = /&|\bany\s+order\b/i;
// A quoted word ("and") is a word, so a joiner inside one is no joiner.
const maskQuoted = (s) => s.replace(/["“”][^"“”]*["“”]/g, (m) => "\u0002".repeat(m.length));

const NOTE_TWO_WORDS = "Two words need a comma or “>” between them, or a slash for either one.";
const NOTE_EXACT = "The builder searches every form of a word, so the “=” was left out. Type it in the search field for that form only.";
const NOTE_COMMAND = "A word that is also a command can’t be joined with a slash, so it was left out. Quote it on its own, or use the field.";

/** One word's text read as the field reads it: { card, note, why }, `card` absent when it doesn't read as one word. */
function readOneWord(text) {
  const parsed = parseGreekQuery(text);
  if (parsed.error) return { why: errorMessage(parsed.error).text };
  if (parsed.terms.length > 1) {
    const near = parsed.terms.find((t) => t.nearFilter);
    return { why: near ? errorMessage({ kind: "near", word: near.words[0], near: near.nearFilter }).text : NOTE_TWO_WORDS };
  }
  // Nothing yet ("*", a setting alone) is the card with no word: any word.
  const t = parsed.terms[0];
  if (!t) return { card: emptyCard(), note: "" };
  const words = t.words ? usableWords(t.words) : [];
  let note = "";
  if (t.words && words.length < t.words.length) note = NOTE_COMMAND;
  if (t.exact) note = NOTE_EXACT;
  return { card: { words, filters: [...t.filters] }, note };
}

/**
 * One word's stretch of a box: { card, raw, clean, note, why, read }. `clean`
 * when all of it reads; otherwise the card is what reads before the word or
 * filter still being typed ("πίστις.ge", "pistis g"), and `why` says what
 * didn't read, for when the reader leaves the box. `note` is about what did
 * read (a "=" left out). `read` is the text the card was read from.
 */
function readStretch(raw) {
  const text = raw.trim();
  if (!text) return { card: emptyCard(), raw: text, clean: true, note: "", why: "", read: "" };
  const whole = readOneWord(text);
  if (whole.card) return { card: whole.card, raw: text, clean: true, note: whole.note, why: "", read: text };
  let head = text;
  for (;;) {
    const cut = Math.max(head.lastIndexOf(" "), head.lastIndexOf("."));
    if (cut <= 0) return { card: emptyCard(), raw: text, clean: false, note: "", why: whole.why, read: "" };
    head = head.slice(0, cut).trimEnd();
    const part = readOneWord(head);
    if (part.card) return { card: part.card, raw: text, clean: false, note: part.note, why: whole.why, read: head };
  }
}

/**
 * What a card's box holds once typed in (E162, replacing GK3-15's letters-only
 * box): { stretches, gap?, anyOrder? }. The box reads as the field does, one
 * stretch per word: a comma, ">", "and" or "then" starts the next, so typing
 * "πίστις, ἀγ" makes two cards. A joiner with nothing before it starts
 * nothing. `gap` and `anyOrder` are there only when the box says so ("~0",
 * a ">" between words, "&"), since they are the whole search's.
 */
export function readCardBox(value) {
  const text = String(value ?? "");
  const masked = maskQuoted(text);
  const parts = [];
  let inOrder = false;
  let from = 0;
  for (const m of masked.matchAll(JOINER)) {
    parts.push(text.slice(from, m.index));
    if ((m[1] ?? m[2]).toLowerCase() !== "," && (m[1] ?? m[2]).toLowerCase() !== "and") inOrder = true;
    from = m.index + m[0].length;
  }
  parts.push(text.slice(from));
  // Only the last stretch may be empty: it is the next word, not typed yet.
  const kept = parts.filter((p, k) => p.trim() || (k > 0 && k === parts.length - 1 && parts.slice(0, k).some((q) => q.trim())));
  const stretches = (kept.length ? kept : [""]).map(readStretch);
  const out = { stretches };
  if (SAYS_ANY_ORDER.test(masked)) out.anyOrder = true;
  else if (inOrder) out.anyOrder = false;
  for (const st of stretches) if (SAYS_GAP.test(maskQuoted(st.read))) out.gap = parseGreekQuery(st.read).gap;
  return out;
}

/** Whether any of a card's words is Latin text, which the LIT's own renderings (the glossary bridge) can name. */
export const needsBridge = (words) => words.some((w) => !hasGreek(w) && !parseStrong(w));

/* ── How close ───────────────────────────────────────────────────── */

/** The "how close" choices; a gap typed in the field that none of them is gets one of its own. */
export function closenessOptions(gap) {
  const options = [
    { label: "Within 3 words", gap: 3 },
    { label: "Next to each other", gap: 0 },
    { label: "Anywhere in the verse", gap: Infinity },
  ];
  if (!options.some((o) => o.gap === gap)) {
    options.splice(1, 0, { label: `Within ${gap} ${gap === 1 ? "word" : "words"}`, gap });
  }
  return options;
}

/* ── What a word takes ───────────────────────────────────────────── */

/**
 * The lemmas a card's words name, from the index: { ids, strongs } or { error }
 * (the word isn't one the index knows) or { any: true } for no word at all.
 * `strongs` is resolveGreekQuery's: for a lemma only a Strong's number
 * reached, the numbers its words must carry (GK8-1), else absent.
 */
export function resolveCard(index, card, { bridge = null } = {}) {
  if (!card.words.length) return { any: true };
  const resolved = resolveGreekQuery(index, {
    terms: [{ words: card.words, exact: false, literal: false, filters: [] }],
    gap: 3,
    anyOrder: false,
  }, { bridge });
  if (resolved.error) return { error: resolved.error };
  const { lemmaIds, strongs } = resolved.terms[0];
  return strongs ? { ids: lemmaIds, strongs } : { ids: lemmaIds };
}

/**
 * How often a lemma's words take each code: Map(code → number), from its shard
 * entry. With `strongs`, only the words carrying one of those numbers count,
 * `primary` being the lemma's own (strongFilter).
 */
export function codeCounts(entry, { strongs = null, primary = null } = {}) {
  const counts = new Map();
  if (!Array.isArray(entry)) return counts;
  const [, flat = [], codes = []] = entry;
  const carries = strongFilter(entry, strongs, primary);
  for (let i = 0; i + OCC_STRIDE - 1 < flat.length; i += OCC_STRIDE) {
    if (carries && !carries(i / OCC_STRIDE)) continue;
    const code = codes[flat[i + 5]];
    if (code) counts.set(code, (counts.get(code) ?? 0) + 1);
  }
  return counts;
}

/**
 * The choices to show on a card, kind by kind: only kinds with something to
 * offer. `rows` is [{ code, n }], every parsing the card's words take and how
 * often, or null for any word (every filter, no counts). Each choice says how
 * many of the word's occurrences it would leave given the card's other kinds
 * of choice, so choosing "genitive" for πίστις leaves only singular and
 * plural, and a choice the word never takes isn't offered. A choice already
 * made is always listed, so it can be taken off whatever the word has become.
 * `only` is set when a kind has one choice and none is made: it is stated, not
 * offered (a noun's part of speech).
 *
 * @returns {{ axis: string, options: { filter: object, n: number | null, on: boolean }[], only: object | null }[]}
 */
export function builderOffers(card, rows) {
  const out = [];
  for (const axis of QUERY_AXES) {
    const others = card.filters.filter((f) => f.axis !== axis);
    const options = [];
    for (const filter of FILTERS) {
      if (filter.axis !== axis) continue;
      const on = card.filters.includes(filter);
      let n = null;
      if (rows) {
        n = 0;
        for (const r of rows) if (codeFits([...others, filter], r.code)) n += r.n;
        if (!n && !on) continue;
      }
      options.push({ filter, n, on });
    }
    if (!options.length) continue;
    const only = rows && options.length === 1 && !options[0].on ? options[0].filter : null;
    out.push({ axis, options, only });
  }
  return out;
}
