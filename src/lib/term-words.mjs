// src/lib/term-words.mjs
//
// Which traditional word and which Greek word stand behind one key-term mark.
//
// A glossary entry governs a family of Greek words (pistis, pistos, pisteuo)
// and names one of them: `traditional: Faith`, `greek: pistis`. Said of every
// marked word, that pair is wrong wherever the verse holds another word of the
// family: "trusted" renders pisteuo, traditionally "believe". About a third of
// the marks in the text sit on such a word (BVJ, 2026-11-10;
// STUDY-DESK-FIXES.md, E85).
//
// So the page's term data (#term-lens-data, written by term-lens-data.mjs)
// carries, for each term, every family word's own pair in `words`, parallel
// to `lemmas` (scripts/lib/glossary-lemmas.mjs, LEMMA_WORDS), and for each
// mark the family words its verse holds, as indexes into both: `w`.
//
// One word in the verse: that is the mark's. Several: nothing yet says which
// of them the rendering renders (that is word-level alignment, phase 2), and
// nobody guesses, the entry's own word included: in 16 marks it is not even
// in the verse. Each half is still known where the candidates agree on it:
// hamartia and hamartano are both "sin". Where they differ, the term lens's
// card names each ("faith or believe") and a sheet offers them for its leader
// to choose. No `w` (a page built before this, a verse the Greek text lacks):
// the entry's own pair, as it always was.
//
// The word is the usual traditional word for the Greek word, in dictionary
// form. It makes no claim about what a given translation prints in a given
// verse: "holy" stands on a word many Bibles print as "saints" there.
//
// Pure and import-free: the term lens (every reader), the Study Desk's sheets
// and node --test share it.

/**
 * An entry's traditional word, lowercase and without the glossary's own
 * disambiguator ("Good [2]" is "good"), which tells two entries apart on
 * /glossary and means nothing elsewhere. The entries are headings ("Faith"),
 * so this is how one reads in a sentence where the page carries no list, and
 * what a word is compared by. To print an entry's word, use ownTraditional:
 * the list keeps the capital of a name ("Satan").
 *
 * @param {{ traditional?: string } | null | undefined} term
 */
export function traditionalWord(term) {
  return String(term?.traditional ?? "").replace(/\s*\[\d+\]\s*$/, "").toLowerCase();
}

/**
 * An entry's own traditional word as it is printed beside a word of
 * scripture: the list's spelling of it where the page carries the list
 * ("Satan", "Gentiles"), and traditionalWord's where it doesn't.
 *
 * @param {{ traditional?: string, words?: [string, string][] } | null | undefined} term
 */
export function ownTraditional(term) {
  const own = traditionalWord(term);
  const line = (term?.words ?? []).find((pair) => Array.isArray(pair) && String(pair[0]).toLowerCase() === own);
  return line ? String(line[0]) : own;
}

/**
 * The family words a mark's verse holds, as { traditional, greek }, in the
 * family's order, each pair once. Empty where the page says nothing.
 *
 * @param {{ words?: [string, string][] } | null | undefined} term  terms[id] of the page's data
 * @param {{ w?: number[] } | null | undefined} mark
 * @returns {{ traditional: string, greek: string }[]}
 */
export function markChoices(term, mark) {
  const out = [];
  for (const i of Array.isArray(mark?.w) ? mark.w : []) {
    const pair = term?.words?.[i];
    if (!Array.isArray(pair) || !pair[0]) continue;
    const choice = { traditional: String(pair[0]), greek: String(pair[1] ?? "") };
    if (!out.some((c) => c.traditional === choice.traditional && c.greek === choice.greek)) out.push(choice);
  }
  return out;
}

// One half of every choice, each value once, in the family's order.
function each(choices, key) {
  const seen = [];
  for (const c of choices) if (c[key] && !seen.includes(c[key])) seen.push(c[key]);
  return seen;
}

/**
 * The traditional words a mark could carry, each once, in the family's order:
 * one where the verse leaves no doubt (or its words agree), several where it
 * holds more than one, and the entry's own where the page says nothing.
 *
 * @returns {string[]}
 */
export function traditionalChoices(term, mark) {
  const seen = each(markChoices(term, mark), "traditional");
  if (seen.length) return seen;
  const own = ownTraditional(term);
  return own ? [own] : [];
}

/**
 * What the term lens's card says of a mark, each half as a list: one word
 * wherever the verse leaves no doubt about that half, every candidate where
 * it holds family words that differ on it (the card joins them with "or"),
 * and the entry's own where the page says nothing of the verse.
 *
 * @returns {{ traditional: string[], greek: string[] }}
 */
export function markOrigin(term, mark) {
  const choices = markChoices(term, mark);
  const traditional = each(choices, "traditional");
  const greek = each(choices, "greek");
  const own = ownTraditional(term);
  const ownGreek = String(term?.greek ?? "");
  return {
    traditional: traditional.length ? traditional : own ? [own] : [],
    greek: greek.length ? greek : ownGreek ? [ownGreek] : [],
  };
}

/** A traditional word as a hint prints it: "traditionally believe". */
export function traditionalHint(word) {
  return `traditionally ${word}`;
}

/**
 * The alternatives a slashed word offers ("forgive/leave", "faith / believe"),
 * trimmed, for whatever tests a text against the word: either side is it.
 *
 * @returns {string[]}
 */
export function wordAlternatives(word) {
  return String(word ?? "")
    .split("/")
    .map((s) => s.trim())
    .filter(Boolean);
}

// The small words that only carry the telling one in a list phrase: "have
// mercy" is given away by "mercy", "make atonement" by "atonement", and a
// note that says "makes" gives nothing away.
const CARRIERS = new Set(["be", "have", "make", "call", "show", "commit", "the", "with"]);

// An alternative without its carriers, or itself where nothing else is left.
function withoutCarriers(alternative) {
  const words = alternative.split(/\s+/);
  const kept = words.filter((w) => !CARRIERS.has(w.toLowerCase()));
  return kept.length ? kept.join(" ") : alternative;
}

/**
 * What in a traditional word gives a blank away, as phrases to look for: each
 * alternative as written, and the alternative without its carrier words where
 * it has any ("have mercy" and "mercy"), each once.
 *
 * @returns {string[]}
 */
export function tellingForms(word) {
  const out = [];
  for (const alternative of wordAlternatives(word)) {
    for (const form of [alternative, withoutCarriers(alternative)]) if (!out.includes(form)) out.push(form);
  }
  return out;
}

/**
 * The same as one text for a check that compares words rather than phrases:
 * the alternatives without their carriers, " / " between.
 */
export function tellingText(word) {
  return wordAlternatives(word).map(withoutCarriers).join(" / ");
}

/* ── At build ────────────────────────────────────────────────────────── */

// Lemmas compared as the Greek files write them, whatever their source: NFC,
// and without case, since two borrowed passages take theirs from another
// dataset (public/greek/LICENSE.txt).
const fold = (s) => String(s ?? "").normalize("NFC").toLowerCase();

/**
 * Which of a term's family words a verse holds: indexes into `family`, in the
 * family's order. Empty where the verse has none, or isn't in the Greek.
 *
 * @param {string[]} family  the term's lemmas (GLOSSARY_LEMMAS[id])
 * @param {Iterable<string> | null | undefined} verseLemmas  the verse's lemmas
 * @returns {number[]}
 */
export function familyWordsIn(family, verseLemmas) {
  if (!verseLemmas) return [];
  const have = new Set([...verseLemmas].map(fold));
  const out = [];
  (family ?? []).forEach((lemma, i) => {
    if (have.has(fold(lemma))) out.push(i);
  });
  return out;
}
