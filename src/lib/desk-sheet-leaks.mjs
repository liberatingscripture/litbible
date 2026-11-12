// src/lib/desk-sheet-leaks.mjs
//
// The "what prints" check of the participant version (STUDY-DESK-AUDIT-5.md,
// recommendation 8; BVJ, 2026-11-08), and the answer key's rows (E102). Pure.
//
// Leader only parts and a question's answer already stay off the participant
// version by design. What can still hand an answer over is a blank's own words
// printing elsewhere on that version: in the title or subtitle, a text part, a
// question, another passage that shows them unblanked, or a footnote the leader
// chose to print. This reports each case; the page shows it as a quiet notice
// and never blocks printing.
//
// Words are matched as blanks are matched elsewhere: case-insensitive and
// whole-word with diacritics folded (word-stem's foldDiacritics) for the text
// surfaces, and by desk-sheet-lit's blanksGivenAway (shared stems, short words
// whole, a blank's `telltale`) for a footnote, so the two checks can't disagree
// about when a footnote gives a blank away.

import { blanksGivenAway } from "./desk-sheet-lit.mjs";
import { tellingForms } from "./term-words.mjs";
import { foldDiacritics } from "./word-stem.mjs";

// Words that say nothing on their own: a blank on "the" is not a leak
// wherever "the" prints. A phrase with no other word is left out.
const GRAMMATICAL = new Set(
  ("a an the and or nor but so yet of to in on at by for as is be am are was it its he she we you i me my his her " +
    "our us him not no do did has had if who how why can may too any out off per via")
    .split(" "),
);

// Hebrew points and cantillation marks are combining marks that \p{L} does not
// match, so pointed Hebrew split into fragments and never met its unpointed
// form (DK6-4); they are folded away with the Latin and Greek accents.
const tokens = (text) =>
  foldDiacritics(String(text ?? ""))
    .replace(/[\u0591-\u05C7]/g, "")
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);

// A phrase's tokens, or null when it says nothing on its own.
const wantOf = (phrase) => {
  const want = tokens(phrase);
  return !want.length || want.every((w) => GRAMMATICAL.has(w) || w.length < 2) ? null : want;
};

// Whether the already-tokenized `want` appears in a row in `have`.
function hasRun(have, want) {
  for (let i = 0; i + want.length <= have.length; i++) {
    if (want.every((w, k) => have[i + k] === w)) return true;
  }
  return false;
}

// The phrase without its possessives, or null when it has none: a blank on
// "God’s" is given away by a question asking "What does God want?" (GF8c-4;
// BVJ, 2026-11-10), since the apostrophe splits off an "s" no question repeats.
const baseOf = (phrase) => {
  const base = String(phrase ?? "").replace(/(\p{L})['’]s(?![\p{L}\p{N}])/gu, "$1");
  return base === String(phrase ?? "") ? null : wantOf(base);
};

/** Whether the words of `phrase` appear in a row, whole, in `text` (a possessive also matches its word alone). */
export function containsPhrase(text, phrase) {
  const have = tokens(text);
  return [wantOf(phrase), baseOf(phrase)].some((want) => !!want && hasRun(have, want));
}

/**
 * Every place a blank's words print on the participant version.
 *
 * @param {{ passageId: string, ref: string, exact: string, telltale?: string, also?: string }[]} blanks
 *   the blanks that print, with the passage each is in (`telltale` and `also`
 *   are desk-sheet-lit's blankWords')
 * @param {{ kind: "title" | "subtitle" | "text" | "question" | "passage" | "footnote",
 *           where: string, text: string, passageId?: string }[]} surfaces
 *   what else prints: `where` is how a sentence names it ("question 2");
 *   a passage's surface is its unblanked words, a footnote's its own text
 *   (held against every blank on the sheet, as the editor's flag is)
 * @returns {{ words: string, ref: string, where: string, kind: string, telltale?: string }[]}
 *   `telltale` is set when it was the traditional word, not the blank's own,
 *   that printed, and names that word: of a blank's several ("faith /
 *   believe", "gehenna/hell"; a slash offers alternatives), the one found
 */
export function findLeaks(blanks, surfaces) {
  const out = [];
  const seen = new Set();
  const add = (b, s, telltale = null) => {
    const key = `${foldDiacritics(b.exact).toLowerCase()}|${b.ref}|${s.where}`;
    if (seen.has(key)) return;
    seen.add(key);
    const leak = { words: b.exact, ref: b.ref, where: s.where, kind: s.kind };
    if (telltale) leak.telltale = telltale;
    out.push(leak);
  };
  // Each blank's phrases are tokenized once, and each surface once (DK6-3).
  // A telltale's alternatives are each a phrase of their own (E85): "faith /
  // believe" in a row is found nowhere, and either word alone gives it away.
  // So is a phrase's telling word without the ones that carry it ("mercy"
  // for "have mercy"), and the entry's own word (`also`), which told before
  // each Greek word had its own and still does.
  const wants = (blanks ?? []).map((b) => ({
    b,
    exact: wantOf(b.exact),
    base: baseOf(b.exact),
    tells: [...tellingForms(b.telltale), ...tellingForms(b.also)]
      .map((word) => ({ word, want: wantOf(word) }))
      .filter((t) => t.want),
  }));
  for (const s of surfaces ?? []) {
    if (!s?.text) continue;
    if (s.kind === "footnote") {
      // Held against every blank on the sheet, as the editor's flag is (GF8b-7):
      // a footnote anywhere could give one away. `where` still names its own passage.
      for (const b of blanksGivenAway(s.text, blanks ?? [])) add(b, s);
      continue;
    }
    const have = tokens(s.text);
    // A phrase can only be in a row if its first word is anywhere: one set lookup
    // keeps a long sheet from scanning every token for every blank (LG8-4).
    const seenWords = new Set(have);
    const runs = (want) => seenWords.has(want[0]) && hasRun(have, want);
    for (const { b, exact, base, tells } of wants) {
      if (s.kind === "passage" && s.passageId === b.passageId) continue;
      if ((exact && runs(exact)) || (base && runs(base))) {
        add(b, s);
        continue;
      }
      // The traditional word a hint doesn't show gives the blank away just the
      // same (DK6-5), as it does in a footnote. Not in a passage: its own
      // verses carry that word as a matter of course.
      if (s.kind === "passage") continue;
      const tell = tells.find((t) => runs(t.want));
      if (tell) add(b, s, tell.word);
    }
  }
  return out;
}

/** One case as a sentence: “deviation,” blanked in Romans 3:23, also prints in question 2. */
export function leakSentence(l) {
  // A period closes inside a closing quote, so a place named by a quotation takes it there.
  const end = (w) => (w.endsWith("”") ? `${w.slice(0, -1)}.”` : `${w}.`);
  if (l.telltale) return `“${l.words},” blanked in ${l.ref}, is given away by “${l.telltale}” in ${end(l.where)}`;
  return `“${l.words},” blanked in ${l.ref}, also prints in ${end(l.where)}`;
}

/**
 * The answer key's groups (E102; BVJ, 2026-11-11, Fable's option B): the
 * key is the group's, the last page of the participant's version, so each
 * answer is found by the verse it is in, which the sheet already prints. A
 * passage with no blank that prints is left out; within one, a verse's
 * answers share its line in reading order. No numbers and no hints: the
 * hint is under the blank already.
 *
 * @param {{ ref: string, blanks: { verse: number, start: number, answer: string }[] }[]} passages
 * @returns {{ ref: string, verses: { verse: number, answers: string[] }[] }[]}
 */
export function answerKeyGroups(passages) {
  const out = [];
  for (const p of passages ?? []) {
    const blanks = (p.blanks ?? [])
      .map((b) => ({ ...b, answer: String(b.answer ?? "").trim().replace(/\s+/g, " ") }))
      .filter((b) => b.answer && Number.isInteger(b.verse))
      .sort((a, b) => a.start - b.start);
    const verses = [];
    for (const b of blanks) {
      const last = verses.at(-1);
      if (last && last.verse === b.verse) last.answers.push(b.answer);
      else verses.push({ verse: b.verse, answers: [b.answer] });
    }
    if (verses.length) out.push({ ref: p.ref, verses });
  }
  return out;
}

/** A verse's line of the key, as Copy and the files write it: "v. 35: hungry, stranger". */
export function answerKeyLine({ verse, answers }) {
  return `v. ${verse}: ${answers.join(", ")}`;
}
