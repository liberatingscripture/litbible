// src/lib/greek-detect.mjs
//
// The few pieces of the Greek search that run before it has loaded (LG-6).
// Telling that a query is Greek (its letters, a Strong's number, the command
// words) is on every page through search-core.js; the rest is what the Study
// Desk's Greek tab needs to draw a word. Keep this small: greek-search.mjs,
// greek-query.mjs and greek-commands-ui.mjs re-export these with the rest of
// their rules, and anything else belongs there. Pure.

const GREEK_LETTER = /[Ͱ-Ͽἀ-῿]/;

/** True when the text has a Greek letter in it. */
export const hasGreek = (s) => GREEK_LETTER.test(String(s ?? ""));

const STRONG_RE = /^(?:strong(?:['’]?s)?\s*:?\s*g?|g)\s*0*(\d{1,5})$/i;

/** "G4102" for any way of typing a Strong's number, else null. */
export function parseStrong(text) {
  const m = STRONG_RE.exec(String(text ?? "").trim());
  return m ? `G${Number(m[1])}` : null;
}

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

const FILTER_BY_WORD = new Map(FILTERS.flatMap((f) => f.words.map((w) => [w, f])));

/** The filter a typed word names ("gen", "Genitive"), or null. */
export const filterFor = (word) => FILTER_BY_WORD.get(String(word ?? "").toLowerCase()) ?? null;

// Where each axis sits in a code ("V-2AAD-P--").
const AT = { person: 2, tense: 3, voice: 4, mood: 5, case: 6, number: 7, gender: 8, degree: 9 };

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

/** The kinds of filter in the order a query reads best: part of speech, tense, voice, mood, case, person, number, gender, degree. */
export const QUERY_AXES = ["pos", "tense", "voice", "mood", "case", "person", "number", "gender", "degree"];

/**
 * The query a word's parsing starts: "*." and every filter word of its part
 * of speech and parsing ("*.aor.act.impv.2nd.pl"). A verb's part of speech is
 * left out, since its tense and mood already say it. Null for a word with no
 * parsing to search by. `pos` is MorphGNT's two characters ("V-"), `parse`
 * the eight that follow.
 */
export function parsingQuery(pos, parse) {
  const code = String(pos ?? "").padEnd(2, "-") + String(parse ?? "").padEnd(8, "-");
  const words = [];
  for (const axis of QUERY_AXES) {
    if (axis === "pos" && code.startsWith("V-")) continue;
    for (const f of FILTERS) {
      if (f.axis === axis && codeFits([f], code)) words.push(f.words[0]);
    }
  }
  return words.length ? `*.${words.join(".")}` : null;
}

/** The word a `greek` parameter names ({ verse, t }), or null. */
export function parseGreekParam(value) {
  const m = /^(\d{1,3})\.(\d{1,3})$/.exec(String(value ?? ""));
  return m ? { verse: Number(m[1]), t: Number(m[2]) } : null;
}
