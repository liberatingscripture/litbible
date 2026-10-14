// scripts/lib/greek-bridge-core.mjs
//
// The pure core of `npm run build:greek-bridge`: the LIT's own renderings of
// the glossary terms, each pointing at the Greek lemmas it renders and the
// verses where the LIT renders them that way (STUDY-DESK.md, "Order of work",
// 1h, the glossary bridge). Searching the Greek by English otherwise uses the
// lexicons' English, which is traditional; this lets "self-preservation" or
// "reorienting the mind" reach σάρξ or μετάνοια.
//
// It shows only what /glossary shows: the gated records (alignment-gate.mjs)
// of published entries. It is LIT content, so it is written to
// public/search/greek-bridge.json, never into public/greek/ (whose files are
// CC BY-SA) and never under public/api/. It will widen when alignment phase 2
// covers every word of the NT.
//
// Output, format 1:
//   { format: 1, terms: [{ id, title, traditional, lemmas, renderings }] }
// with renderings [{ form, count, verses }], most frequent first, `verses`
// flat [book, chapter, verse, …] in Bible order, deduplicated, `book` an index
// into BOOK_ORDER.

export const GREEK_BRIDGE_FORMAT = 1;

const byCodePoint = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

/**
 * @param {{
 *   gated: Map<string, Map<string, { bookKey: string, chapter: number, verse: number }[]>>,
 *   entries: Map<string, { title: string, traditional: string }>,
 *   lemmas: Record<string, string[]>,
 *   bookOrder: string[],
 * }} input  gatedOccurrences() of the alignment files; the published glossary
 *   entries; GLOSSARY_LEMMAS; BOOK_ORDER
 */
export function buildGreekBridge({ gated, entries, lemmas, bookOrder }) {
  const terms = [];
  for (const id of [...gated.keys()].sort(byCodePoint)) {
    const entry = entries.get(id);
    const termLemmas = (lemmas[id] ?? []).map((l) => l.normalize("NFC"));
    if (!entry || !termLemmas.length) continue;
    const renderings = [];
    for (const [form, list] of gated.get(id)) {
      const seen = new Set();
      const refs = [];
      for (const o of list) {
        const book = bookOrder.indexOf(o.bookKey);
        if (book < 0) continue;
        const key = `${book}.${o.chapter}.${o.verse}`;
        if (seen.has(key)) continue;
        seen.add(key);
        refs.push([book, o.chapter, o.verse]);
      }
      refs.sort((a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2]);
      renderings.push({ form, count: list.length, verses: refs.flat() });
    }
    renderings.sort((a, b) => b.count - a.count || byCodePoint(a.form, b.form));
    terms.push({ id, title: entry.title, traditional: entry.traditional, lemmas: termLemmas, renderings });
  }
  return { format: GREEK_BRIDGE_FORMAT, terms };
}
