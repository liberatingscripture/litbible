// How a glossary rendering is matched against verse text, and how the `n` in
// an alignment record's `english[{ text, n }]` is counted.
//
// Shared by build-alignment.mjs (which emits the records) and the review tool
// (which confirms and adds to them). They MUST count identically: `n` is part
// of a record's identity key, so a review record that numbered an occurrence
// differently from the scanner would key differently, survive the next rescan
// as an "unmatched review record", and duplicate the scanner's own record for
// the same span.

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Match a surface form as a whole word, allowing a plural or possessive tail.
 * Lookarounds rather than \b because forms contain hyphens ("life-breath"),
 * where \b would happily match inside a longer hyphenated compound.
 */
export function formPattern(form) {
  return new RegExp(`(?<![\\w-])${escapeRe(form)}(?:['’]s|e?s)?(?![\\w-])`, "gi");
}

/**
 * Every occurrence of `form` in `verseText`, numbered.
 *
 * `n` counts ALL matches of the form in the verse, in order — including ones a
 * caller goes on to discard. build-alignment.mjs drops matches whose span a
 * longer form of the same term already claimed ("faithful trust" suppressing a
 * bare "trust"), but the discarded match still consumed its number, so the
 * surviving records keep the numbering a reader would arrive at by counting
 * the word in the verse.
 *
 * @param {string} verseText plain text (see verse-text.mjs)
 * @param {string} form a glossary rendering, e.g. "life-breath"
 * @returns {{ text: string, start: number, end: number, n: number }[]}
 */
export function findFormMatches(verseText, form) {
  const out = [];
  if (!form) return out;
  let n = 0;
  for (const m of String(verseText).matchAll(formPattern(form))) {
    n++;
    out.push({ text: m[0], start: m.index, end: m.index + m[0].length, n });
  }
  return out;
}
