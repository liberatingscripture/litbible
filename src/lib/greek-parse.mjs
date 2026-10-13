// src/lib/greek-parse.mjs
//
// MorphGNT's part-of-speech and parsing codes, put in words for display only.
// Pure and import-free, so the browser can use it (the Study Desk's Greek tab)
// as well as the Node tools (scripts/alignment-words/core.mjs re-exports
// describeParse, and store.mjs reads it through core). The code positions are
// MorphGNT's own: person, tense, voice, mood, case, number, gender, degree. An
// unknown letter is left out rather than guessed.

const POS = {
  "A-": "adjective", "C-": "conjunction", "D-": "adverb", "I-": "interjection",
  "N-": "noun", "P-": "preposition", RA: "article", RD: "demonstrative pronoun",
  RI: "interrogative/indefinite pronoun", RP: "personal pronoun",
  RR: "relative pronoun", "V-": "verb", "X-": "particle",
};
const PERSON = { 1: "1st", 2: "2nd", 3: "3rd" };
const TENSE = { P: "present", I: "imperfect", F: "future", A: "aorist", X: "perfect", Y: "pluperfect" };
const VOICE = { A: "active", M: "middle", P: "passive" };
const MOOD = { I: "indicative", D: "imperative", S: "subjunctive", O: "optative", N: "infinitive", P: "participle" };
const CASE = { N: "nominative", G: "genitive", D: "dative", A: "accusative", V: "vocative" };
const NUMBER = { S: "singular", P: "plural" };
const GENDER = { M: "masculine", F: "feminine", N: "neuter" };
const DEGREE = { C: "comparative", S: "superlative" };

/**
 * MorphGNT's part-of-speech and parsing codes in words, for display only:
 * "V- 3AAI-S--" -> "verb, aorist active indicative, 3rd person singular".
 */
export function describeParse(pos, parse) {
  const c = String(parse || "").padEnd(8, "-");
  const verbal = [TENSE[c[1]], VOICE[c[2]], MOOD[c[3]]].filter(Boolean).join(" ");
  const nominal = [CASE[c[4]], GENDER[c[6]], NUMBER[c[5]]].filter(Boolean).join(" ");
  const personal = PERSON[c[0]] ? `${PERSON[c[0]]} person ${NUMBER[c[5]] ?? ""}`.trim() : "";
  return [POS[pos] ?? pos, verbal, personal || nominal, DEGREE[c[7]]].filter(Boolean).join(", ");
}
