// Pure logic for the alignment review tool. No fs, no http, no argv — all of
// that lives in store.mjs and server.mjs, so everything here is unit-testable
// with plain objects (see test/alignment-review-core.test.js).
//
// THE INVERSION THIS IMPLEMENTS. build-alignment.mjs scans ENGLISH: it looks
// for the renderings the glossary lists, so it can only ever find what it was
// told to look for. That caps it at 54% coverage, and pins two terms at 0% —
// `metanoia` is glossed "reorienting the mind" but the text reads
// "transformation of the mind"; `blasphemia` is glossed "disrespectfulness"
// but reads "contemptuous speech". Neither word is wrong; the glossary's `lit`
// field is a HEADLINE, not a rendering inventory.
//
// So the review queue is seeded from the GREEK instead: every verse where the
// term's lemma occurs. That list is complete by construction, and the reviewer
// classifies rather than discovers. A verse the scanner already matched arrives
// with a proposal; the rest arrive blank, which is the point.

import { findFormMatches } from "../lib/alignment-forms.mjs";

/**
 * Word spans in a verse, for the UI's click-to-select.
 * Apostrophes and hyphens stay INSIDE a word ("Yeshua's", "life-breath") —
 * they are part of renderings, and splitting on them would make the commonest
 * spans un-clickable.
 */
export function tokenizeWords(text) {
  const out = [];
  for (const m of String(text).matchAll(/[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu)) {
    out.push({ text: m[0], start: m.index, end: m.index + m[0].length });
  }
  return out;
}

/**
 * Which occurrence of this rendering the span is, 1-based.
 *
 * Counted through findFormMatches so it agrees EXACTLY with the scanner —
 * `n` is part of a record's identity key, and a review record that numbered a
 * span differently would fail to match the scanner's record for the same span
 * on the next rescan, surviving as a duplicate rather than merging with it.
 *
 * The fallback covers a span the form pattern can't reproduce (a reviewer
 * grouping "transformation of the mind" under the form "reorienting the mind",
 * say). The scanner cannot emit such a record at all, so there is nothing to
 * collide with; it only needs to be stable.
 */
export function computeOccurrenceN({ verseText, form, text, start }) {
  if (form) {
    const hit = findFormMatches(verseText, form).find((m) => m.start === start);
    if (hit) return hit.n;
  }
  const needle = String(text).toLowerCase();
  if (!needle) return 0;
  const hay = String(verseText).toLowerCase();
  let n = 1;
  for (let i = hay.indexOf(needle); i !== -1 && i < start; i = hay.indexOf(needle, i + 1)) {
    n++;
  }
  return n;
}

/**
 * The scanner's own guess for a verse, if it has one: the longest of the term's
 * glossary renderings that matches. `forms` must already be longest-first (as
 * loadTerms sorts them), so "faithful trust" beats a bare "trust".
 *
 * Returns null for the cold-start case — the reviewer picks words by hand, and
 * whatever they pick becomes a rendering the glossary never knew about.
 */
export function buildAutoProposal({ verseText, forms }) {
  for (const form of forms || []) {
    const [first] = findFormMatches(verseText, form);
    if (first) return { ...first, form };
  }
  return null;
}

/**
 * Every published verse where this term's Greek occurs, in canonical order.
 * Draft chapters are excluded so an untranslated stub never reads as a gap.
 *
 * @param {object} args
 * @param {string[]} args.lemmas from GLOSSARY_LEMMAS
 * @param {Map<string, string[]>} args.refsByLemma from loadMorphGnt
 * @param {Set<string>} args.publishedChapters "Rom.8" keys
 * @param {Map<string, number>} args.osisRank OSIS abbreviation -> canonical index
 */
export function versesInScopeForTerm({ lemmas, refsByLemma, publishedChapters, osisRank }) {
  const refs = new Set();
  for (const lemma of lemmas || []) {
    for (const ref of refsByLemma.get(lemma) || []) {
      if (publishedChapters.has(ref.slice(0, ref.lastIndexOf(".")))) refs.add(ref);
    }
  }
  return [...refs].sort((a, b) => compareRefs(a, b, osisRank));
}

export function compareRefs(a, b, osisRank) {
  const [ab, ac, av] = a.split(".");
  const [bb, bc, bv] = b.split(".");
  return (
    (osisRank.get(ab) ?? 999) - (osisRank.get(bb) ?? 999) ||
    Number(ac) - Number(bc) ||
    Number(av) - Number(bv)
  );
}

/**
 * Field order mirrors the scanner's records exactly, so diffs stay readable.
 * @param {{text: string, start: number, form?: string}} args.span
 */
export function buildConfirmRecord({ ref, term, span, verseText, lemma = "present" }) {
  const form = span.form || span.text;
  return {
    ref,
    english: [
      {
        text: span.text,
        n: computeOccurrenceN({ verseText, form, text: span.text, start: span.start }),
      },
    ],
    greek: [], // phase 2 territory; review never fills it
    term: {
      greek: term.greek,
      traditional: term.traditional,
      glossary: term.id,
      form,
    },
    // Deliberately null, not "distinctive". `confidence` answers "is this
    // English string unambiguous OUT of context" — a scanner heuristic. A
    // reviewed record has a better answer than a heuristic, and overloading the
    // field would destroy the scanner's own signal. Display keys off `status`.
    confidence: null,
    lemma,
    source: "review",
    status: "confirmed",
  };
}

/**
 * "The Greek is here and the translation has no distinct rendering for it."
 * A first-class answer, not a skip: it's how a term reaches 100% reviewed
 * without inventing renderings for verses that genuinely have none.
 */
export function buildNoRenderingRecord({ ref, term, lemma = "present" }) {
  return {
    ref,
    english: [],
    greek: [],
    term: {
      greek: term.greek,
      traditional: term.traditional,
      glossary: term.id,
      form: null,
    },
    confidence: null,
    lemma,
    source: "review",
    status: "no-rendering",
  };
}

/**
 * Confirming a span the SCANNER already found should not throw away the fact
 * that the scanner found it. Where a freshly built record collides with an
 * existing one, keep the existing record and just flip its status — so
 * `source: "glossary-scan"` and its `confidence` survive, and the bulk-accept
 * path and the one-verse path produce identical rows for identical decisions.
 */
export function reconcileConfirmations({ existing, built, recordKey }) {
  const prior = new Map((existing || []).map((r) => [recordKey(r), r]));
  return built.map((r) => {
    // Only a confirmation reconciles. A `no-rendering` record keys as
    // `<ref>|<glossary>||0`, so re-submitting one would match the prior
    // no-rendering record and this would stamp it `confirmed` — a record
    // asserting a rendering while carrying `english: []`. Guard here rather
    // than trusting every caller to remember.
    if (r.status !== "confirmed") return r;
    const match = prior.get(recordKey(r));
    return match ? { ...match, status: "confirmed" } : r;
  });
}

/** Has this (verse, term) pair been decided? Any non-auto record settles it. */
export function isDecided(records) {
  return (records || []).some((r) => r.status && r.status !== "auto");
}

export function progressForTerm({ queue, recordsByRef }) {
  let done = 0;
  for (const ref of queue) if (isDecided(recordsByRef.get(ref))) done++;
  return { total: queue.length, done, remaining: queue.length - done };
}

/**
 * The Absent tab's grouping. Records whose lemma check contradicts the English
 * match cluster hard by (term, rendering) — 185 of the 447 are `flesh-body` /
 * "family", every one a vocative ἀδελφοί the scan mistook for σάρξ — so
 * grouping this way turns most of the tab into a single decision. Outliers
 * split out on their own by construction: Luke 9:23's "self-preservation" is a
 * different mistake and gets its own group.
 */
export function groupAbsentRecordsByPattern(records) {
  const groups = new Map();
  for (const r of records) {
    if (r.lemma !== "absent" || r.status === "rejected") continue;
    const glossary = r.term?.glossary ?? "";
    const form = r.term?.form ?? "";
    const id = `${glossary}|${form}`;
    let g = groups.get(id);
    if (!g) groups.set(id, (g = { id, glossary, form, records: [] }));
    g.records.push(r);
  }
  return [...groups.values()].sort((a, b) => b.records.length - a.records.length);
}
