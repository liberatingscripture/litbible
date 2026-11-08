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
// where an empty `words` is "any word". Each card's menus list only what the
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
import { OCC_STRIDE, hasGreek, parseStrong } from "./greek-search.mjs";

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
  if (!text) return { cards: [], gap: 3, anyOrder: false };
  const quoted = /["“”]/.test(text);
  if (!quoted && !/\s/.test(text) && !/[.,/*=~&]/.test(text)) {
    return { cards: [{ words: [text], filters: [] }], gap: 3, anyOrder: false };
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
const COMMAND_WORD = /^(?:any|exact(?:ly)?|and|or|within|next|anywhere|order|first|second|third)$/i;

/** Whether a word, written bare, would be read as a command and not as the word. */
export const needsQuotes = (word) => /[\s.,/*=~&]/.test(word) || COMMAND_WORD.test(word) || Boolean(filterFor(word));

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
 * commas, then how close and in what order once there are two words. An empty
 * card writes nothing, so it can wait in the window for its word.
 */
export function writeBuilder({ cards, gap = 3, anyOrder = false }) {
  const parts = cards.map(writeCard).filter(Boolean).slice(0, MAX_TERMS);
  let q = parts.join(", ");
  if (parts.length > 1) {
    if (gap === Infinity) q += " ~v";
    else if (gap !== 3) q += ` ~${gap}`;
    if (anyOrder) q += " &";
  }
  return q;
}

/** A word as typed in a card, which can't hold a space or a symbol the notation uses ("/" separates alternatives). */
export const cleanWord = (s) => String(s ?? "").replace(/[\s.,*=~&"“”]/g, "");

/** The words a card's text box holds: "Ἰησοῦς/Χριστός" is two. */
export const splitWords = (s) => usableWords(String(s ?? "").split("/").map(cleanWord).filter(Boolean));

/**
 * What a card's text box holds once typed in: { words, draft, note }. `draft`
 * is what the box shows (a "/" waiting for the next word stays), and `note` a
 * sentence when something typed was left out, since the reader would
 * otherwise only see the text change (GK3-15): a space or symbol the notation
 * uses, or a word that is also a command, which can't be joined with "/".
 */
export function readCardText(value) {
  const text = String(value ?? "");
  const stripped = text.replace(/[\s.,*=~&"“”]/g, "");
  const parts = stripped.split("/").filter(Boolean);
  const words = usableWords(parts);
  const draft = words.join("/") + (words.length && text.trim().endsWith("/") ? "/" : "");
  let note = "";
  if (words.length < parts.length) {
    note = "A word that is also a command can’t be joined with a slash, so it was left out. Quote it on its own, or use the field.";
  } else if (stripped.length < text.trim().length) {
    note = "A word here can’t hold a space or a symbol the search uses, so they were left out. Use “+ Then another word” for a second word.";
  }
  return { words, draft, note };
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
 * The lemmas a card's words name, from the index: { ids } or { error } (the
 * word isn't one the index knows) or { any: true } for no word at all.
 */
export function resolveCard(index, card, { bridge = null } = {}) {
  if (!card.words.length) return { any: true };
  const resolved = resolveGreekQuery(index, {
    terms: [{ words: card.words, exact: false, literal: false, filters: [] }],
    gap: 3,
    anyOrder: false,
  }, { bridge });
  if (resolved.error) return { error: resolved.error };
  return { ids: resolved.terms[0].lemmaIds };
}

/** How often a lemma's words take each code: Map(code → number), from its shard entry. */
export function codeCounts(entry) {
  const counts = new Map();
  if (!Array.isArray(entry)) return counts;
  const [, flat = [], codes = []] = entry;
  for (let i = 0; i + OCC_STRIDE - 1 < flat.length; i += OCC_STRIDE) {
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
