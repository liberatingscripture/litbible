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
// continuation paragraph opens with plain text carrying no marker of its own.
// It does NOT follow that such a paragraph has no marker at all: it usually
// goes on to open the next verse in the same string, and reading that as
// "not a continuation" is what let two verses ship printing their
// continuation sentence twice (see opensWithContinuationText). This
// module handles the common single-paragraph case fully (returns the exact
// [start,end) span to replace) and DETECTS but does not attempt to resolve
// the continuation case - a verse whose content isn't fully contained in one
// paragraph string is reported as `spansMultipleParagraphs: true` rather
// than guessed at, and build-ledger.mjs routes those to hand-review (the
// same disposition a continuation paragraph would get anyway from the
// structured-HTML rule, since CLAUDE.md's own examples of this pattern are
// poetry set in a `<blockquote>`).

import { splitTrailingBlockClose } from "./block-structure.mjs";
import { stripBracketMarkers } from "../../../src/lib/bracket-markers.mjs";

// Re-exported so build-ledger.mjs takes its whole paragraph vocabulary from
// one import; the rule itself belongs with the other block-structure rules.
export { splitTrailingBlockClose };

const VGLUE_MARKER_RE = /<span class="vglue"><sup id="v(\d+)" class="vn">\d+<\/sup>/g;

/**
 * Does this paragraph OPEN with content belonging to the previous verse?
 *
 * This is what makes a paragraph a continuation, and the test cannot be "the
 * paragraph carries no verse marker": most continuation paragraphs go on to
 * open a LATER verse in the same string. `hebrews-2-p4` continues verse 8 and
 * then opens verse 9; `hebrews-8-p3` continues verse 8 as poetry and then
 * opens verse 9. Asking for a marker-free paragraph found 122 of the corpus's
 * 208 continuations and missed the other 86 - and a missed one is not merely
 * unhandled, it is silently MIS-handled: the verse looks single-paragraph, so
 * a restore writes the master's whole verse into the head block while the
 * continuation text stays where it was. That is how hebrews-2:8 and
 * hebrews-8:8 shipped with their continuation sentence printed twice.
 *
 * What actually marks a continuation is reader-visible text standing before
 * the paragraph's first marker. Two things routinely sit there and belong to
 * the FOLLOWING verse rather than the previous one, so both come out before
 * the question is asked: a bracketed passage's opening `[|`, and the footnote
 * anchor that follows it - `john-11-p16` opens
 * `[|<sup class="fn-ref">…w…</sup>` and then verse 28, which is not a
 * continuation of verse 27.
 */
export function opensWithContinuationText(paragraphHtml) {
  const markers = findVerseMarkers(paragraphHtml);
  const lead = markers.length === 0 ? paragraphHtml : paragraphHtml.slice(0, markers[0].start);
  return (
    stripBracketMarkers(lead)
      .replace(/<sup class="fn-ref">[\s\S]*?<\/sup>/g, "")
      .replace(/<[^>]+>/g, "")
      .replace(/&nbsp;/g, " ")
      .trim() !== ""
  );
}

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
 *       AND the very next paragraph OPENS with this verse's text (a
 *       continuation, per CLAUDE.md - see opensWithContinuationText, and note
 *       that such a paragraph usually goes on to open a later verse) - not
 *       auto-locatable as a single string-value patch; `paragraphIndices`
 *       lists the paragraphs a human reviewer needs to look at, not a
 *       resolved span.
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
    // following paragraph continues this verse without a marker of its own -
    // which it does whenever it OPENS with text, whatever markers it carries
    // later on. See opensWithContinuationText.
    const next = paragraphs[pi + 1];
    if (next !== undefined && opensWithContinuationText(next)) {
      return { found: true, spansMultipleParagraphs: true, paragraphIndices: [pi, pi + 1] };
    }
    return { found: true, spansMultipleParagraphs: false, paragraphIndex: pi, start, end: paragraphs[pi].length };
  }
  return { found: false };
}

const OPEN_TAG_RE = /^<[a-z][^>]*>/i;
const TRAILING_CLOSE_RE = /(?:<\/[a-z][^>]*>)+$/i;
const TRAILING_SPACE_RE = /\s+$/;

/**
 * Split the whitespace that SEPARATES this verse from the next off the end of
 * its span, so a restore can only ever rewrite the verse's own content.
 *
 * locateVerseSpanInParagraphs ends a verse at the next verse's marker, so for
 * every verse but the last in a paragraph the span includes the single space
 * standing between `…sheep.` and `<span class="vglue">`. The Word master
 * carries no such space - it has no marker to separate from - so composing a
 * restore from master text drops it, and the page then renders `sheep.12 The`
 * with the verse number glued to the previous sentence. Nothing catches it:
 * `sup.vn` is `inline-block` and no CSS supplies the gap, so the separator has
 * to be in the text, and the corpus agrees 4,159 to 3.
 *
 * This is the same defect as the lost `</p>` that splitTrailingBlockClose
 * exists for, one level down, and it shipped the same way - 117 markers across
 * the two restore PRs before anything looked.
 *
 * Apply AFTER splitTrailingBlockClose and re-append in span order
 * (`content + sep + close`), since a span can end either `text ` or `text </p>`.
 */
export function splitTrailingSeparator(span) {
  const s = String(span ?? "");
  const sep = TRAILING_SPACE_RE.exec(s)?.[0] ?? "";
  return { body: sep ? s.slice(0, -sep.length) : s, sep };
}

/**
 * Every verse marker in `paragraphs` that no whitespace separates from what
 * precedes it. A marker that OPENS its own block is excluded - it is preceded
 * by the block's opening tag and needs no separator.
 * @returns {Array<{paragraphIndex:number, verse:number, before:string}>}
 */
export function findUnseparatedVerseMarkers(paragraphs) {
  const hits = [];
  for (let pi = 0; pi < (paragraphs?.length ?? 0); pi++) {
    const p = String(paragraphs[pi] ?? "");
    VGLUE_MARKER_RE.lastIndex = 0;
    let m;
    while ((m = VGLUE_MARKER_RE.exec(p))) {
      const before = p.slice(0, m.index);
      if (before === "" || /\s$/.test(before) || /<[a-z][^>]*>$/i.test(before)) continue;
      hits.push({ paragraphIndex: pi, verse: Number(m[1]), before: before.slice(-40) });
    }
  }
  return hits;
}


/**
 * Cut a composed continuation verse back into its two paragraphs.
 *
 * A verse spanning a paragraph break is ONE run of text in the Word master and
 * TWO strings in the repo, and the repo's break is authored, not accidental -
 * `ephesians-1`/`2peter-1` open a letter as `From:` / `To:`, `matthew-20`
 * turns a speaker mid-verse. Restoring the master's wording therefore means
 * distributing it across the repo's existing paragraphs, which is a
 * REFORMATTING question, not a question about which side is right.
 *
 * The split point is not searched for in the text: the words at the boundary
 * are exactly the ones a restore may be changing, so matching on them would
 * fail on the only records that matter. Instead the caller composes the two
 * paragraphs TOGETHER against the master (review-core's diff sees the seam
 * markup as a `structural` hunk, since it strips to nothing on both sides, and
 * keeps the repo's), and this function finds the seam the composer preserved.
 *
 * @param {string} composed  repo head-span + tail-paragraph, composed against
 *                           the master
 * @param {string} headSpan  the repo's head paragraph from this verse's marker
 *                           to the end of that string (so it ends in the
 *                           paragraph's own closing tags)
 * @param {string} tailPara  the repo's whole continuation paragraph
 * @returns {{ok:true, head:string, tail:string} | {ok:false, reason:string}}
 *   Every refusal keeps the record held rather than guessing.
 */
export function splitComposedAtParagraphSeam(composed, headSpan, tailPara) {
  const openTag = OPEN_TAG_RE.exec(tailPara)?.[0];
  if (!openTag) {
    return { ok: false, reason: "the continuation paragraph does not begin with an opening tag, so its seam can't be located" };
  }
  const first = composed.indexOf(openTag);
  if (first === -1) {
    return { ok: false, reason: `composition did not preserve the continuation paragraph's opening tag (${openTag})` };
  }
  if (composed.indexOf(openTag, first + 1) !== -1) {
    return { ok: false, reason: `the continuation paragraph's opening tag (${openTag}) occurs more than once in the composition, so the seam is ambiguous` };
  }

  const head = composed.slice(0, first);
  const tail = composed.slice(first);

  // Both sides must still close the way the repo's own strings close. This is
  // what makes the cut safe: the master contributes no markup at all, so if
  // either paragraph lost its closing tags the composition put text somewhere
  // this function would otherwise happily slice through.
  const headClose = TRAILING_CLOSE_RE.exec(headSpan)?.[0];
  const tailClose = TRAILING_CLOSE_RE.exec(tailPara)?.[0];
  if (!headClose || !head.endsWith(headClose)) {
    return { ok: false, reason: `the head paragraph no longer ends with its own closing markup (${headClose ?? "none found"})` };
  }
  if (!tailClose || !tail.endsWith(tailClose)) {
    return { ok: false, reason: `the continuation paragraph no longer ends with its own closing markup (${tailClose ?? "none found"})` };
  }
  if (findVerseMarkers(tail).length !== 0) {
    return { ok: false, reason: "the composition moved a verse marker into the continuation paragraph, which must open with plain text (CLAUDE.md's single-marker convention)" };
  }

  return { ok: true, head, tail };
}
