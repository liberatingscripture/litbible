// Chapter/verse extraction over a master .docx, adapted from the v1 audit's
// docx-audit/lib/docx-verses.mjs (session scratchpad, left untouched so v1
// stays reproducible for the Phase 1 gate - see scripts/reconcile/README.md).
//
// Two independent signals locate verse boundaries, and BOTH must agree:
//
//   1. The blind digit-adjacency scan, copied verbatim from v1
//      (isStandaloneDigitsAt/findStandaloneNumber/findAdjacentPair/
//      scanVerses): treats verse numbers as plain digit tokens in the prose
//      stream, oblivious to any Word formatting. This is what v1 always did.
//   2. The superscript-run scan from docx-runs.mjs
//      (segmentSuperscriptVerses): treats <w:vertAlign w:val="superscript"/>
//      runs as the structural verse-marker signal, oblivious to the digit
//      scan's adjacency heuristic.
//
// Where they disagree about the verse SET a chapter contains, that is the
// audit's single largest silent-confidence risk turned loud: `extractMaster
// Chapters` throws rather than silently trusting one signal. See "Phase 1"
// in the approved plan.
//
// Verse/chapter text is sliced from docx-runs.mjs's entry list against a
// "blind" plain-text projection (verse-marker digits contribute their
// literal characters, exactly like v1's undifferentiated text stream) whose
// offsets are mapped back to entries. MOST verse markers are their own
// isolated run (a `verseMarker` entry, zero-width, so a boundary next to one
// always lands exactly on an entry edge) - but not all: the master
// occasionally glues a verse number into an ordinary, unstyled run alongside
// punctuation (observed: Mark 7:37 as a single run whose <w:t> is literally
// ". 37 ", no <w:vertAlign> at all - the SAME anomaly the superscript cross-
// check already flags for that chapter). For those, a boundary falls MID-
// entry. `sliceBlindRange` below splits an entry's PLAIN text at that exact
// character offset and re-escapes the two pieces independently, which is
// safe ONLY when the entry carries no markup (verified by the entry's own
// html containing no `<`- a plain-escaped string can never contain one
// unless this module put a tag there). A mid-entry boundary that DOES fall
// inside formatted markup can't be split safely; the whole entry is kept on
// one side and a warning is raised so that verse pair is forced to
// hand-review rather than silently risking a corrupted tag.
import { scanDocumentEntries, scanFootnoteRecords, segmentSuperscriptVerses, escapeHtml } from "./docx-runs.mjs";
import { pathToFileURL } from "node:url";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BRACKET_MODULE = pathToFileURL(
  path.resolve(__dirname, "../../../src/lib/bracket-markers.mjs"),
).href;
const { stripBracketMarkers: stripBracketMarkersReal } = await import(BRACKET_MODULE);

/** Parameterized per plan Phase 1 item 5: comparison needs markers stripped,
 *  restoration (splicing master text into the JSON) does not. */
function applyBracketStrip(text, stripBrackets) {
  return stripBrackets ? stripBracketMarkersReal(text) : text;
}

const MAX_STEP = 3; // current+1 (normal), +2/+3 (documented single/double gaps)

/** Delimiter for the footnote-reference placeholders sliceBlindRange emits
 *  under {refMarkers}. U+0000 cannot occur in extracted document text, so a
 *  placeholder can never collide with content. */
const REF_MARK = String.fromCharCode(0);

// ---------------------------------------------------------------------
// Blind digit-adjacency scan - COPIED, not reimplemented, from v1's
// docx-audit/lib/docx-verses.mjs so it stays a genuine independent check.
// ---------------------------------------------------------------------

function isStandaloneDigitsAt(text, index, length) {
  const before = text[index - 1];
  const after = text[index + length];
  if (before !== undefined && /[A-Za-z0-9]/.test(before)) return false;
  if (after !== undefined && !/\s/.test(after)) return false;
  return true;
}

function findStandaloneNumber(text, value, from, to) {
  const needle = String(value);
  let idx = from;
  while (true) {
    idx = text.indexOf(needle, idx);
    if (idx === -1 || idx >= to) return null;
    if (isStandaloneDigitsAt(text, idx, needle.length)) {
      return { start: idx, end: idx + needle.length };
    }
    idx += 1;
  }
}

function findAdjacentPair(text, first, second, from, to) {
  let searchFrom = from;
  while (true) {
    const firstHit = findStandaloneNumber(text, first, searchFrom, to);
    if (!firstHit) return null;
    const secondHit = findStandaloneNumber(text, second, firstHit.end, Math.min(to, firstHit.end + 20));
    if (secondHit) {
      const between = text.slice(firstHit.end, secondHit.start);
      if (/^\s+$/.test(between)) {
        return { chapterStart: firstHit.start, chapterEnd: firstHit.end, verseStart: secondHit.start, verseEnd: secondHit.end };
      }
    }
    searchFrom = firstHit.start + 1;
  }
}

function scanVerses(text, spanStart, spanEnd, v1DigitStart, v1DigitEnd) {
  const markers = [{ verse: 1, digitStart: v1DigitStart, textStart: v1DigitEnd }];
  let current = 1;
  let searchFrom = v1DigitEnd;
  const gapsUsed = [];
  while (true) {
    let found = null;
    for (let step = 1; step <= MAX_STEP; step++) {
      const target = current + step;
      const hit = findStandaloneNumber(text, target, searchFrom, spanEnd);
      if (hit) {
        found = { verse: target, step, ...hit };
        break;
      }
    }
    if (!found) break;
    if (found.step > 1) gapsUsed.push({ from: current, to: found.verse });
    markers.push({ verse: found.verse, digitStart: found.start, textStart: found.end });
    current = found.verse;
    searchFrom = found.end;
  }
  return { markers, gapsUsed };
}

// ---------------------------------------------------------------------
// "Blind" plain-text projection of the entry list, matching v1's
// undifferentiated character stream (verse-marker digits ARE part of the
// text, exactly as v1 saw them via <w:t> alone) - this is what feeds the
// digit-adjacency scan above. Track each entry's [start,end) range in this
// stream so a scan result (a character offset) can be mapped back to the
// entry it falls in for slicing.
// ---------------------------------------------------------------------

function buildBlindStream(entries) {
  let text = "";
  const ranges = new Array(entries.length);
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    const start = text.length;
    if (e.kind === "text") text += e.plain;
    else if (e.kind === "break") text += " ";
    else if (e.kind === "verseMarker") text += e.digits;
    // footnoteRef / footnoteMarker: zero-width, exactly like v1 (footnote
    // references never contributed to rawText there either).
    ranges[i] = { start, end: text.length };
  }
  return { text, ranges };
}

/** Smallest entry index i with ranges[i].start >= offset (entries.length if none). */
function entryIndexAtOrAfter(ranges, offset) {
  for (let i = 0; i < ranges.length; i++) {
    if (ranges[i].start >= offset) return i;
  }
  return ranges.length;
}

/** Entry index i with ranges[i].start <= offset <= ranges[i].end. */
function entryIndexContaining(ranges, offset) {
  for (let i = 0; i < ranges.length; i++) {
    if (offset >= ranges[i].start && offset <= ranges[i].end) return i;
  }
  return -1;
}

/**
 * Slice the blind stream's [startOffset, endOffset) span into { plain, html },
 * splitting an entry's PLAIN text at an exact character offset when a
 * boundary falls inside it (see the module header for why this is
 * necessary and when it's safe). Returns a `warning` string when a boundary
 * fell inside a FORMATTED entry and had to be kept whole instead.
 */
function sliceBlindRange(entries, ranges, startOffset, endOffset, refMarkers = false) {
  let plain = "";
  let html = "";
  let warning = null;
  for (let i = 0; i < entries.length; i++) {
    const r = ranges[i];
    if (r.end <= startOffset || r.start >= endOffset) continue; // entirely outside the span
    if (r.start === r.end) {
      // Zero-width: verseMarker / footnoteRef / footnoteMarker.
      //
      // A footnote reference carries no characters, which is right for
      // comparing WORDING but wrong for rebuilding a verse's HTML: the repo
      // marks the same reference with a visible <sup class="fn-ref"> anchor,
      // and a verse rebuilt from anchor-less master text silently drops every
      // anchor inside it. The footnote then survives in footnotes[] with
      // nothing pointing at it - unreachable to readers, and invisible to
      // validate-chapters.mjs, which only checks anchor -> footnote.
      //
      // Under {refMarkers} the html stream keeps a NUL-delimited placeholder
      // where each reference sits, so a caller can substitute the repo's own
      // anchor markup back in at the right position. It rides through the
      // bracket strip, the trim, and quote curling as ordinary text, which is
      // why this is a marker rather than a character offset - an offset would
      // have to be re-based after each of those. `plain` never gets one: it is
      // the text-comparison surface and must stay clean.
      if (refMarkers && entries[i].kind === "footnoteRef") html += `${REF_MARK}${entries[i].id}${REF_MARK}`;
      continue;
    }
    const e = entries[i];
    const lo = Math.max(startOffset, r.start);
    const hi = Math.min(endOffset, r.end);
    if (lo === r.start && hi === r.end) {
      // Whole entry falls inside the span.
      if (e.kind === "text") {
        plain += e.plain;
        html += e.html;
      } else if (e.kind === "break") {
        plain += " ";
        html += " ";
      }
      continue;
    }
    // Partial overlap: a boundary lands mid-entry. Only `text` entries have
    // characters to cut through ("break" is a single space, atomic).
    if (e.kind !== "text") continue;
    const relLo = lo - r.start;
    const relHi = hi - r.start;
    const part = e.plain.slice(relLo, relHi);
    if (part === "") continue;
    if (!e.html.includes("<")) {
      // Unformatted - a plain-text character cut is unambiguous. Re-escape
      // independently rather than slicing e.html itself, so this never has
      // to reason about escaped-entity boundaries.
      plain += part;
      html += escapeHtml(part);
    } else {
      // Cutting through markup isn't safe - keep the WHOLE entry on this
      // side and flag it. (Not observed in this corpus as of the Phase 1
      // gate; kept as a safety net.)
      plain += e.plain;
      html += e.html;
      warning = `verse boundary falls inside a formatted run (${JSON.stringify(e.plain)}) - kept whole, hand-review this verse pair`;
    }
  }
  return { plain, html, warning };
}

/** True if the entry at `entryIdx` is the first non-whitespace content of
 *  its containing paragraph (mirrors v1's paragraph-initial confidence check). */
function isEntryParagraphInitial(entries, paragraphs, entryIdx) {
  const para = paragraphs.find((p) => entryIdx >= p.start && entryIdx < p.end);
  if (!para) return false;
  for (let i = para.start; i < entryIdx; i++) {
    const e = entries[i];
    if (e.kind === "text" && e.plain.trim() !== "") return false;
  }
  return true;
}

/**
 * Assign each footnoteRef in the blind-stream span [spanStart, spanEnd) to the
 * nearest preceding DIGIT-SCAN marker - the same rule, on the same signal, as
 * v1's assignFootnotes (docx-audit/lib/docx-verses.mjs).
 *
 * It deliberately does NOT walk `verseMarker` entries, even though those read
 * as the more structural signal. A verse number is not always its own
 * superscript run: eight chapters type one as ordinary body text (Mark 7:7 and
 * 7:37, Mark 12:14, Mark 5:39 as a *subscript*, 1 Timothy 6:5, 2 Corinthians
 * 8:14, Luke 4:39, Luke 21:31, Acts 1:2-4 - the same set the superscript
 * cross-check flags). Anchoring on verseMarker entries walks straight past
 * those and files every following footnote under the previous verse, which is
 * how the Phase 1 gate first came back with five spurious "anchored to a
 * different verse" findings in Mark 7 and Mark 12. The digit scan sees all of
 * them, so verse text was never affected - only this map was.
 */
function assignFootnotesByOffset(entries, ranges, markers, spanStart, spanEnd) {
  const result = [];
  let orderIndex = 0;
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    if (e.kind !== "footnoteRef") continue;
    const offset = ranges[i].start; // zero-width entry: start === end
    if (offset < spanStart || offset >= spanEnd) continue;
    let verse = null;
    for (const mk of markers) {
      if (mk.digitStart <= offset) verse = mk.verse;
      else break;
    }
    orderIndex++;
    result.push({ id: e.id, verse, orderIndex, offset });
  }
  return result;
}

/**
 * Full per-book master extraction (v2). Mirrors v1's extractMasterChapters
 * shape/contract exactly (see docx-audit/lib/docx-verses.mjs) so run-all's
 * comparison logic can be replayed unchanged in gate-report.mjs, but each
 * verse/footnote's text is now `{ plain, html }` instead of a bare string,
 * and every chapter's verse SET is cross-checked against the superscript
 * scan before being accepted.
 *
 * @param {string} documentXml  raw word/document.xml
 * @param {number} chapterCount from BOOKS[bookKey]
 * @param {{ stripBrackets?: boolean, warnings?: string[] }} [opts]
 * @returns {{
 *   ok: boolean, reason?: string,
 *   chapters: Map<number, {
 *     verses: Map<number, {plain:string, html:string}>,
 *     gapsUsed: Array<{from:number,to:number}>,
 *     paragraphInitial: boolean,
 *     footnotes: Array<{id:string, verse:number|null, orderIndex:number}>,
 *   }>,
 *   superscriptCheck: {
 *     ok: boolean,
 *     perChapter: Array<{ chapter:number, digitSet:number[], superscriptSet:number[], agree:boolean }>,
 *   },
 * }}
 */
export function extractMasterChapters(documentXml, chapterCount, opts = {}) {
  const { stripBrackets = true, warnings = [], refMarkers = false } = opts;
  const { entries, paragraphs } = scanDocumentEntries(documentXml, { warnings });
  const { text, ranges } = buildBlindStream(entries);

  const chapters = new Map();
  const superscriptByBlock = segmentSuperscriptVerses(entries); // one array per detected chapter, document order

  function finalizeChapter(chapterNum, bound, spanEnd) {
    const { markers, gapsUsed } = scanVerses(text, bound.chapterStart, spanEnd, bound.v1DigitStart, bound.v1DigitEnd);
    const verses = new Map();
    for (let j = 0; j < markers.length; j++) {
      const startOffset = markers[j].textStart;
      const endOffset = j + 1 < markers.length ? markers[j + 1].digitStart : spanEnd;
      const { plain, html, warning } = sliceBlindRange(entries, ranges, startOffset, endOffset, refMarkers);
      if (warning) {
        warnings.push(`chapter ${chapterNum} verse ${markers[j].verse}: ${warning}`);
      }
      // Trim the slice's own edges. A verse slice runs from just after its
      // number's digits to just before the next number's, so it ALWAYS opens
      // with the space Word puts after the marker and usually closes with the
      // one before the next - pure extraction artifact, present on no repo
      // string. Left untrimmed it makes every one of the 6,318 verses differ
      // from its repo counterpart at the raw level, which files the whole
      // corpus under "cosmetic" and buries the 263 real findings. Trim after
      // the bracket strip, per the strip-before-whitespace rule in CLAUDE.md.
      verses.set(markers[j].verse, {
        plain: applyBracketStrip(plain, stripBrackets).trim(),
        html: applyBracketStrip(html, stripBrackets).trim(),
      });
    }
    const chapterEntryIdx = entryIndexContaining(ranges, bound.chapterStart);
    const spanEndEntryIdx = entryIndexAtOrAfter(ranges, spanEnd);
    const startIdx = chapterEntryIdx === -1 ? 0 : chapterEntryIdx;
    chapters.set(chapterNum, {
      verses,
      gapsUsed,
      paragraphInitial: chapterEntryIdx === -1 ? false : isEntryParagraphInitial(entries, paragraphs, chapterEntryIdx),
      footnotes: assignFootnotesByOffset(entries, ranges, markers, bound.chapterStart, spanEnd),
      digitScanVerseSet: markers.map((m) => m.verse),
      entryRange: { start: startIdx, end: spanEndEntryIdx },
    });
  }

  let result;
  if (chapterCount === 1) {
    let v1 = null;
    // Single-chapter book: verse 1 starts a paragraph, no chapter-number prefix.
    for (const span of paragraphs) {
      if (span.start >= span.end) continue; // empty paragraph, nothing to check
      const paraStart = ranges[span.start].start;
      const paraEnd = ranges[span.end - 1].end;
      const paraText = text.slice(paraStart, paraEnd);
      const trimmedStart = paraStart + (paraText.match(/^\s*/)?.[0].length ?? 0);
      const m = /^(\d+)(\s+)\S/.exec(text.slice(trimmedStart, paraEnd));
      if (m && m[1] === "1") {
        v1 = { start: trimmedStart, end: trimmedStart + 1 };
        break;
      }
    }
    if (!v1) {
      result = { ok: false, reason: "could not locate verse 1 opening marker", chapters };
    } else {
      finalizeChapter(1, { chapterStart: v1.start, v1DigitStart: v1.start, v1DigitEnd: v1.end }, text.length);
      result = { ok: true, chapters };
    }
  } else {
    let searchFrom = 0;
    let prevBound = null;
    let failReason = null;
    for (let c = 1; c <= chapterCount; c++) {
      const pair = findAdjacentPair(text, c, 1, searchFrom, text.length);
      if (!pair) {
        if (prevBound) finalizeChapter(prevBound.chapter, prevBound, text.length);
        failReason = `could not locate chapter ${c} opening marker ("${c} 1")`;
        break;
      }
      const bound = { chapter: c, chapterStart: pair.chapterStart, v1DigitStart: pair.verseStart, v1DigitEnd: pair.verseEnd };
      if (prevBound) finalizeChapter(prevBound.chapter, prevBound, bound.chapterStart);
      prevBound = bound;
      searchFrom = pair.verseEnd;
    }
    if (!failReason && prevBound) finalizeChapter(prevBound.chapter, prevBound, text.length);
    result = failReason ? { ok: false, reason: failReason, chapters } : { ok: true, chapters };
  }

  // ---- Cross-check: digit-scan verse SET vs. superscript-scan verse SET,
  // per chapter, in the order chapters were actually finalized above. The
  // superscript segmentation is positional (one array per chapter in
  // document order) and doesn't know chapter NUMBERS, so pair them up by
  // order against the chapters the digit scan actually produced.
  const digitChapterNums = [...chapters.keys()].sort((a, b) => a - b);
  const perChapter = [];
  let allAgree = true;
  for (let i = 0; i < digitChapterNums.length; i++) {
    const chapterNum = digitChapterNums[i];
    const digitSet = [...new Set(chapters.get(chapterNum).digitScanVerseSet)].sort((a, b) => a - b);
    const superscriptVerses = superscriptByBlock[i] || [];
    const superscriptSet = [...new Set(superscriptVerses)].sort((a, b) => a - b);
    const agree = digitSet.length === superscriptSet.length && digitSet.every((v, idx) => v === superscriptSet[idx]);
    if (!agree) allAgree = false;
    perChapter.push({
      chapter: chapterNum,
      digitSet,
      superscriptSet,
      agree,
      entryRange: chapters.get(chapterNum).entryRange,
    });
  }

  return {
    ...result,
    superscriptCheck: { ok: allAgree, perChapter },
    // Exposed for diagnostic tooling (gate-report.mjs) that needs to trace a
    // specific disagreement back to raw XML formatting - not needed for
    // ordinary extraction use.
    entries,
    paragraphs,
  };
}

/** Master footnote text records (id -> {plain, html, warning}), bracket
 *  markers stripped per the same {stripBrackets} rule as verse text. */
export function extractMasterFootnotes(footnotesXml, opts = {}) {
  const { stripBrackets = true, warnings = [] } = opts;
  const raw = scanFootnoteRecords(footnotesXml, { warnings });
  const out = new Map();
  for (const [id, rec] of raw) {
    // Trailing trim for the same reason the verse slices get one: Word leaves
    // a space at the end of most footnote bodies (the leading separator space
    // is already dropped upstream in scanFootnoteRecords). No repo footnote
    // carries one, so leaving it in makes the footnote differ raw and land in
    // the cosmetic bucket on a difference that isn't there.
    out.set(id, {
      plain: applyBracketStrip(rec.plain, stripBrackets).trim(),
      html: applyBracketStrip(rec.html, stripBrackets).trim(),
      paragraphCount: rec.paragraphCount,
      warning: rec.warning,
    });
  }
  return out;
}

export { MAX_STEP, REF_MARK };
