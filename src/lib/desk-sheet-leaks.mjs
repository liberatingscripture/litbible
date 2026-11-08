// src/lib/desk-sheet-leaks.mjs
//
// The "what prints" check of the participant version (STUDY-DESK-AUDIT-5.md,
// recommendation 8; BVJ, 2026-11-08), and the answer key's rows. Pure.
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
import { foldDiacritics } from "./word-stem.mjs";

// Words that say nothing on their own: a blank on "the" is not a leak
// wherever "the" prints. A phrase with no other word is left out.
const GRAMMATICAL = new Set(
  ("a an the and or nor but so yet of to in on at by for as is be am are was it its he she we you i me my his her " +
    "our us him not no do did has had if who how why can may too any out off per via")
    .split(" "),
);

const tokens = (text) => foldDiacritics(String(text ?? "")).toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean);

/** Whether the words of `phrase` appear in a row, whole, in `text`. */
export function containsPhrase(text, phrase) {
  const want = tokens(phrase);
  if (!want.length || want.every((w) => GRAMMATICAL.has(w) || w.length < 2)) return false;
  const have = tokens(text);
  for (let i = 0; i + want.length <= have.length; i++) {
    if (want.every((w, k) => have[i + k] === w)) return true;
  }
  return false;
}

/**
 * Every place a blank's words print on the participant version.
 *
 * @param {{ passageId: string, ref: string, exact: string, telltale?: string }[]} blanks
 *   the blanks that print, with the passage each is in
 * @param {{ kind: "title" | "subtitle" | "text" | "question" | "passage" | "footnote",
 *           where: string, text: string, passageId?: string }[]} surfaces
 *   what else prints: `where` is how a sentence names it ("question 2");
 *   a passage's surface is its unblanked words, a footnote's its own text
 *   (held against that passage's blanks only)
 * @returns {{ words: string, ref: string, where: string, kind: string }[]}
 */
export function findLeaks(blanks, surfaces) {
  const out = [];
  const seen = new Set();
  const add = (b, s) => {
    const key = `${foldDiacritics(b.exact).toLowerCase()}|${b.ref}|${s.where}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ words: b.exact, ref: b.ref, where: s.where, kind: s.kind });
  };
  for (const s of surfaces ?? []) {
    if (!s?.text) continue;
    if (s.kind === "footnote") {
      const mine = (blanks ?? []).filter((b) => b.passageId === s.passageId);
      for (const b of blanksGivenAway(s.text, mine)) add(b, s);
      continue;
    }
    for (const b of blanks ?? []) {
      if (s.kind === "passage" && s.passageId === b.passageId) continue;
      if (containsPhrase(s.text, b.exact)) add(b, s);
    }
  }
  return out;
}

/** One case as a sentence: “deviation,” blanked in Romans 3:23, also prints in question 2. */
export function leakSentence(l) {
  return `“${l.words},” blanked in ${l.ref}, also prints in ${l.where}.`;
}

/**
 * The answer key's rows: each passage with blanks that print, its blanks in
 * order. A hint is what the participant sees beneath the blank.
 *
 * @param {{ ref: string, blanks: { answer: string, hint?: string }[] }[]} passages
 */
export function answerKeyRows(passages) {
  return (passages ?? [])
    .map((p) => ({ ref: p.ref, blanks: (p.blanks ?? []).filter((b) => String(b.answer ?? "").trim()) }))
    .filter((p) => p.blanks.length);
}

/** One passage's row as a line: “Romans 3:23: 1. deviation (hint); 2. …” */
export function answerKeyLine(row) {
  const parts = row.blanks.map((b, i) => `${i + 1}. ${b.answer.trim()}${b.hint ? ` (${b.hint})` : ""}`);
  return `${row.ref}: ${parts.join("; ")}`;
}
