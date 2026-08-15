// Locate a verse's own HTML span within a chapter's `paragraphs[]` array, so
// build-ledger.mjs can construct a splice-ready patch: json-splice.mjs only
// ever replaces a whole JSON string value (never a substring within one), so
// restoring one verse's wording means replacing its WHOLE containing
// `paragraphs[i]` string, with only that verse's own portion of the HTML
// changed and everything else in the paragraph byte-identical.
//
// Per CLAUDE.md's verse-marker convention, each verse is opened by
// `<span class="vglue"><sup id="vN" class="vn">N</sup>...` and a verse that
// spans a paragraph break carries its marker only ONCE, at its start - the
// continuation paragraph opens with plain text and no marker at all. This
// module handles the common single-paragraph case fully (returns the exact
// [start,end) span to replace) and DETECTS but does not attempt to resolve
// the continuation case - a verse whose content isn't fully contained in one
// paragraph string is reported as `spansMultipleParagraphs: true` rather
// than guessed at, and build-ledger.mjs routes those to hand-review (the
// same disposition a continuation paragraph would get anyway from the
// structured-HTML rule, since CLAUDE.md's own examples of this pattern are
// poetry set in a `<blockquote>`).

const VGLUE_MARKER_RE = /<span class="vglue"><sup id="v(\d+)" class="vn">\d+<\/sup>/g;

/** Every verse marker's verse number and start offset (the `<span
 *  class="vglue">` that opens it) within one paragraph's raw HTML string. */
export function findVerseMarkers(paragraphHtml) {
  const markers = [];
  VGLUE_MARKER_RE.lastIndex = 0;
  let m;
  while ((m = VGLUE_MARKER_RE.exec(paragraphHtml))) {
    markers.push({ verse: Number(m[1]), start: m.index });
  }
  return markers;
}

/**
 * Locate verse `verseNum`'s span across `paragraphs` (the chapter's raw
 * `paragraphs[]` array of HTML strings).
 * @returns
 *   {found:false} - no `id="vN"` marker anywhere in the array
 *   {found:true, spansMultipleParagraphs:false, paragraphIndex, start, end}
 *     - the common case: [start,end) within paragraphs[paragraphIndex] is
 *       exactly this verse's content, from its own marker up to the next
 *       verse marker in the SAME paragraph, or the end of that paragraph's
 *       HTML if this is the last marker in it and no later paragraph
 *       continues it markerless.
 *   {found:true, spansMultipleParagraphs:true, paragraphIndices}
 *     - this verse's marker paragraph has no later verse marker of its own,
 *       AND the very next paragraph has NO verse marker at all (a
 *       continuation, per CLAUDE.md) - not auto-locatable as a single
 *       string-value patch; `paragraphIndices` lists the paragraphs a human
 *       reviewer needs to look at, not a resolved span.
 */
export function locateVerseSpanInParagraphs(paragraphs, verseNum) {
  for (let pi = 0; pi < paragraphs.length; pi++) {
    const markers = findVerseMarkers(paragraphs[pi]);
    const idx = markers.findIndex((mk) => mk.verse === verseNum);
    if (idx === -1) continue;

    const start = markers[idx].start;
    if (idx + 1 < markers.length) {
      return { found: true, spansMultipleParagraphs: false, paragraphIndex: pi, start, end: markers[idx + 1].start };
    }

    // Last marker in this paragraph. Check whether the immediately
    // following paragraph continues this verse without a marker of its own.
    const next = paragraphs[pi + 1];
    if (next !== undefined && findVerseMarkers(next).length === 0) {
      return { found: true, spansMultipleParagraphs: true, paragraphIndices: [pi, pi + 1] };
    }
    return { found: true, spansMultipleParagraphs: false, paragraphIndex: pi, start, end: paragraphs[pi].length };
  }
  return { found: false };
}
