// The term lens: where, in one chapter, each glossary term the alignment
// dataset can vouch for sits in the text, so Study View can mark it.
//
// Pure. The shell that reads the files is term-lens-data.mjs.
//
// Which records count is the display gate (alignment-gate.mjs): a chapter only
// marks terms /glossary would show, so the lens never makes a claim the
// glossary page doesn't. A record says "the nth occurrence of this text in
// this verse", counted by computeOccurrenceN, the same function both writers
// of the dataset use. The page can't re-run that count on the DOM without
// shipping the review tool's matcher, so each mark is handed over as the kth
// plain case-insensitive occurrence of its text in the verse, which the
// client can find with indexOf. Both sides read the same verse, so the kth
// occurrence is the same span on both.

import { computeOccurrenceN } from "../../scripts/alignment-review/review-core.mjs";

/** Every start index of `needle` in `hay`, case-insensitively, as a substring. */
export function candidateStarts(hay, needle) {
  const out = [];
  const h = String(hay).toLowerCase();
  const n = String(needle).toLowerCase();
  if (!n) return out;
  for (let i = h.indexOf(n); i !== -1; i = h.indexOf(n, i + 1)) out.push(i);
  return out;
}

/**
 * Where a record's span sits in its verse, or null when today's text has no
 * position the record's numbering describes (a stale record; see
 * npm run audit:alignment).
 *
 * @param {string} verseText plain text, as splitChapterVerses gives it
 * @param {{ text: string, n: number }} span  english[0] of the record
 * @param {string|null} form  term.form
 * @returns {{ start: number, k: number } | null} `k` counts from 0
 */
export function locateSpan(verseText, span, form) {
  const starts = candidateStarts(verseText, span.text);
  const numbered = [];
  for (let k = 0; k < starts.length; k++) {
    const n = computeOccurrenceN({ verseText, form, text: span.text, start: starts[k] });
    if (n === span.n) numbered.push({ start: starts[k], k });
  }
  // The count's substring fallback can number two positions alike: in Romans
  // 3:5, "justness" is occurrence 1 both inside "unjustness" and as "God's
  // justness". A reader means the whole word, so prefer one standing alone.
  const whole = numbered.find(({ start }) => standsAlone(verseText, start, start + span.text.length));
  return whole ?? numbered[0] ?? null;
}

const WORD_CHAR = /[\p{L}\p{N}]/u;

function standsAlone(text, start, end) {
  return !WORD_CHAR.test(text[start - 1] ?? "") && !WORD_CHAR.test(text[end] ?? "");
}

/**
 * Group the gated occurrences by chapter, keyed "bookKey-chapter".
 *
 * @param {Map<string, Map<string, { bookKey: string, chapter: number, verse: number, record: object }[]>>} gated
 *   from gatedOccurrences()
 */
export function occurrencesByChapter(gated) {
  const out = new Map();
  for (const [id, forms] of gated) {
    for (const [form, list] of forms) {
      for (const occ of list) {
        const key = `${occ.bookKey}-${occ.chapter}`;
        if (!out.has(key)) out.set(key, []);
        out.get(key).push({ id, form, verse: occ.verse, record: occ.record });
      }
    }
  }
  return out;
}

/**
 * Each term's renderings across the whole corpus, most frequent first, for
 * the card's "Also rendered" line. Counts are occurrences, as /glossary's are.
 *
 * @returns {Map<string, { form: string, count: number }[]>}
 */
export function renderingCounts(gated) {
  const out = new Map();
  for (const [id, forms] of gated) {
    out.set(
      id,
      [...forms.entries()]
        .map(([form, list]) => ({ form, count: list.length }))
        .sort((a, b) => b.count - a.count),
    );
  }
  return out;
}

/**
 * The marks for one chapter, in reading order.
 *
 * @param {{ id: string, form: string, verse: number, record: object }[]} occurrences
 *   this chapter's entry from occurrencesByChapter()
 * @param {Map<number, string>} verses  splitChapterVerses(paragraphs)
 * @returns {{
 *   marks: { v: number, text: string, k: number, id: string, form: string }[],
 *   unresolved: { ref: string, text: string, n: number }[],
 * }}
 */
export function chapterMarks(occurrences, verses) {
  const found = [];
  const unresolved = [];
  for (const { id, form, verse, record } of occurrences ?? []) {
    const text = verses.get(verse);
    // Phase 1 records carry one span each, but the schema allows several.
    for (const span of record.english ?? []) {
      if (!span?.text) continue;
      const at = text == null ? null : locateSpan(text, span, form);
      if (!at) {
        unresolved.push({ ref: record.ref, text: span.text, n: span.n });
        continue;
      }
      found.push({ v: verse, start: at.start, text: span.text, k: at.k, id, form });
    }
  }
  found.sort((a, b) => a.v - b.v || a.start - b.start);
  return {
    marks: found.map(({ v, text, k, id, form }) => ({ v, text, k, id, form })),
    unresolved,
  };
}
