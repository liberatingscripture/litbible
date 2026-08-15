// Run-aware .docx XML parsing for the master-reconciliation tooling.
//
// v1 (docx-audit/lib/docx-xml.mjs, in the session scratchpad, untouched) scans
// only <w:t>/<w:tab>/<w:br>/<w:footnoteReference> tokens, so every <w:i/> run
// is silently flattened to plain text — results.json contains zero `<`
// characters. This module scans <w:r> (and <w:hyperlink>) blocks instead, so
// italics/bold survive as <em>/<b>, matching the chapter JSON's own markup
// convention (see "Chapter JSON Format" in CLAUDE.md).
//
// Output is a flat, paragraph-ordered list of "entries" per document/footnote.
// Each entry carries BOTH a plain-text form (untagged, used for the blind
// digit-adjacency verse/chapter boundary scan copied from v1) and an html
// form (tagged, used to build the actual restoration text) with matching
// entry boundaries — so slicing a verse's text is just "concatenate entries
// [i, j)", never a character-offset cut through a tag. See docx-verses.mjs
// for how the two scans (digit-adjacency vs. superscript) cross-check.
//
// Entry kinds:
//   { kind: "text", plain, html }              - ordinary run content
//   { kind: "verseMarker", verse }              - a <w:vertAlign superscript>
//                                                  run whose text is bare
//                                                  digits (zero-width: no
//                                                  plain/html contribution)
//   { kind: "footnoteRef", id }                 - a body-text citation point
//                                                  (<w:footnoteReference>,
//                                                  document.xml only)
//   { kind: "footnoteMarker" }                  - a footnote's own leading
//                                                  number (<w:footnoteRef/>,
//                                                  footnotes.xml only) -
//                                                  dropped by the footnote
//                                                  extractor, never reaches
//                                                  the flat entry list callers see
//   { kind: "break" }                           - paragraph boundary
//                                                  (plain/html both a single
//                                                  space, matching v1's
//                                                  inter-paragraph joiner)

export function decodeEntities(s) {
  return String(s)
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

/** Escape &/</> unconditionally - applied to decoded run text before it is
 *  ever placed back into an HTML string, since decoding can reintroduce a
 *  literal "&" (from "&amp;") that must not leak into the output raw. */
export function escapeHtml(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** True if `tag` is present and ON in this run's <w:rPr> inner XML.
 *  Bare `<w:TAG/>` = on. `<w:TAG w:val="0|false"/>` = explicitly off.
 *  Anything else (`w:val="1"`, `"true"`, or an unrecognized value) = on.
 *  The tag-name boundary is exact ("i" must not match "iCs"): the regex
 *  requires the next character after the tag name to be whitespace (for an
 *  attribute) or `/` (self-close) - "iCs" has "C" there, so it can never
 *  match when TAG is "i" or "b". */
function readToggle(rPrInner, tag) {
  const re = new RegExp(`<w:${tag}(?:\\s+w:val="([^"]*)")?\\s*/>`);
  const m = re.exec(rPrInner);
  if (!m) return false;
  if (m[1] === undefined) return true;
  return !/^(?:0|false)$/i.test(m[1]);
}

/** Parse a run's <w:rPr>...</w:rPr> inner XML (or "" if absent) into flags. */
function parseRunProps(rPrInner) {
  return {
    italic: readToggle(rPrInner, "i"),
    bold: readToggle(rPrInner, "b"),
    superscript: /<w:vertAlign\s+w:val="superscript"\s*\/>/.test(rPrInner),
    isFootnoteRefStyle: /<w:rStyle\s+w:val="FootnoteReference"\s*\/>/.test(rPrInner),
  };
}

/** Wrap trimmed core text in <em>/<b> per italic/bold, whitespace hoisted
 *  OUTSIDE the tag ("<em>Kurios</em> in Greek", never "<em>Kurios </em>in
 *  Greek") so adjacent runs of mixed formatting read naturally. */
function wrapFormatted(plain, italic, bold, warnings, contextLabel) {
  const trimmed = plain.trim();
  if (trimmed === "") return escapeHtml(plain);
  const leadWs = plain.slice(0, plain.length - plain.trimStart().length);
  const trailWs = plain.slice(plain.trimEnd().length);
  let core = escapeHtml(trimmed);
  if (italic && bold) {
    core = `<b><em>${core}</em></b>`;
    warnings.push(`${contextLabel}: run has BOTH italic and bold ("${trimmed}") - verify <b><em> nesting by hand`);
  } else if (italic) {
    core = `<em>${core}</em>`;
  } else if (bold) {
    core = `<b>${core}</b>`;
  }
  return escapeHtml(leadWs) + core + escapeHtml(trailWs);
}

const ABS_URL_RE = /^https?:\/\/\S+$/;

// A run's content, after its <w:rPr>, is a sequence of zero or more
// self-closing "structural" children (Word inserts <w:lastRenderedPageBreak/>
// freely, and a manual <w:br/>/<w:tab/>/<w:noBreakHyphen/>/<w:softHyphen/>
// can sit right before the run's own <w:t>) followed by at most one <w:t>.
// Scanned as a loop rather than a single fixed pattern so any combination/
// order of these siblings is tolerated.
const STRUCTURAL_ELEM_RE = /^<w:(lastRenderedPageBreak|br|tab|noBreakHyphen|softHyphen)\b[^>]*\/>/;
const T_EMPTY_RE = /^<w:t(?:\s[^>]*)?\/>/;
const T_RE = /^<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/;

/** Parse a run's post-rPr content into plain text. Returns { plain, leftover }
 *  - `leftover` is whatever couldn't be consumed (empty string on full success). */
function parseRunContent(rest) {
  let plain = "";
  let cursor = 0;
  while (cursor < rest.length) {
    const remaining = rest.slice(cursor);
    let m = STRUCTURAL_ELEM_RE.exec(remaining);
    if (m) {
      const tag = m[1];
      if (tag === "br" || tag === "tab") plain += " ";
      else if (tag === "noBreakHyphen") plain += "-";
      // lastRenderedPageBreak, softHyphen: invisible, contribute nothing
      cursor += m[0].length;
      continue;
    }
    m = T_EMPTY_RE.exec(remaining);
    if (m) {
      cursor += m[0].length;
      continue;
    }
    m = T_RE.exec(remaining);
    if (m) {
      plain += decodeEntities(m[1]);
      cursor += m[0].length;
      continue;
    }
    break;
  }
  return { plain, leftover: rest.slice(cursor) };
}

/** Parse one <w:r ...>...</w:r> block's INNER xml (without the <w:r>/</w:r>
 *  wrapper) into zero or more flat entries. rPr, if present, is anchored at
 *  the START of the run's inner content. */
function parseRunInner(runInner, warnings, contextLabel) {
  const rPrMatch = /^<w:rPr>([\s\S]*?)<\/w:rPr>/.exec(runInner);
  const rPrInner = rPrMatch ? rPrMatch[1] : "";
  const rest = rPrMatch ? runInner.slice(rPrMatch[0].length) : runInner;
  const props = parseRunProps(rPrInner);

  if (props.isFootnoteRefStyle) {
    const refMatch = /<w:footnoteReference\b[^>]*\bw:id="(-?\d+)"[^>]*\/?>/.exec(rest);
    if (refMatch) return [{ kind: "footnoteRef", id: refMatch[1] }];
    if (/<w:footnoteRef\s*\/>/.test(rest)) return [{ kind: "footnoteMarker" }];
    // A FootnoteReference-styled run with neither element (observed: a lone
    // preserved space) carries no citation - fall through and treat its
    // content as ordinary text rather than dropping it silently.
  }

  const { plain: rawPlain, leftover } = parseRunContent(rest);
  let plain = rawPlain;
  if (leftover !== "") {
    warnings.push(`${contextLabel}: unrecognized run content: ${JSON.stringify(rest.slice(0, 80))}`);
  }
  plain = plain.replace(/ /g, " ");

  if (props.superscript && /^\s*\d+\s*$/.test(plain) && plain.trim() !== "") {
    const digitMatch = /^(\s*)(\d+)(\s*)$/.exec(plain);
    const [, lead, digits, trail] = digitMatch;
    const entries = [];
    if (lead) entries.push({ kind: "text", plain: lead, html: escapeHtml(lead) });
    entries.push({ kind: "verseMarker", verse: Number(digits) });
    if (trail) entries.push({ kind: "text", plain: trail, html: escapeHtml(trail) });
    return entries;
  }

  const html = wrapFormatted(plain, props.italic, props.bold, warnings, contextLabel);
  return [{ kind: "text", plain, html }];
}

/** Parse a <w:hyperlink ...>...</w:hyperlink> block's inner XML (the runs it
 *  wraps) into one entry. Emits <a href> only when the visible text IS an
 *  absolute http(s) URL (the href is the visible text itself - docx doesn't
 *  expose the relationship target to a string scan, and every observed
 *  master hyperlink's visible text already is its own target URL); otherwise
 *  plain text plus a warning forcing hand-review. */
function parseHyperlinkInner(innerXml, warnings, contextLabel) {
  const RUN_RE = /<w:r\b[^>]*\/>|<w:r\b[^>]*>([\s\S]*?)<\/w:r>/g;
  let plain = "";
  let m;
  RUN_RE.lastIndex = 0;
  while ((m = RUN_RE.exec(innerXml))) {
    if (m[1] === undefined) continue;
    for (const entry of parseRunInner(m[1], warnings, contextLabel)) {
      if (entry.kind === "text") plain += entry.plain;
      // verseMarker/footnoteRef/footnoteMarker inside a hyperlink run would be
      // extraordinary; fold their absence into the text (nothing to add).
    }
  }
  const trimmed = plain.trim();
  if (ABS_URL_RE.test(trimmed)) {
    const leadWs = plain.slice(0, plain.length - plain.trimStart().length);
    const trailWs = plain.slice(plain.trimEnd().length);
    const href = escapeHtml(trimmed);
    return [{ kind: "text", plain, html: `${escapeHtml(leadWs)}<a href="${href}">${href}</a>${escapeHtml(trailWs)}` }];
  }
  warnings.push(`${contextLabel}: hyperlink visible text is not an absolute http(s) URL: ${JSON.stringify(trimmed.slice(0, 120))}`);
  return [{ kind: "text", plain, html: escapeHtml(plain) }];
}

// Top-level paragraph/footnote-body scanner: hyperlink blocks OR standalone
// runs, in document order. Alternation tries hyperlink first, so nested runs
// inside a matched hyperlink are consumed with it (lastIndex advances past
// them) rather than being re-matched as standalone runs.
const TOPLEVEL_RE =
  /<w:hyperlink\b[^>]*>([\s\S]*?)<\/w:hyperlink>|<w:r\b[^>]*\/>|<w:r\b[^>]*>([\s\S]*?)<\/w:r>/g;

/** Parse one paragraph's inner XML (the content of <w:p>...</w:p>, pPr
 *  included - it never contains a literal <w:r> or <w:hyperlink>, so it is
 *  harmless to leave in scope) into a flat entry list, hyperlinks resolved,
 *  verse markers split out, footnote refs/markers preserved as entries. */
export function parseParagraphEntries(pInner, { warnings = [], contextLabel = "" } = {}) {
  const entries = [];
  TOPLEVEL_RE.lastIndex = 0;
  let m;
  while ((m = TOPLEVEL_RE.exec(pInner))) {
    if (m[1] !== undefined) {
      entries.push(...parseHyperlinkInner(m[1], warnings, contextLabel));
    } else if (m[2] !== undefined) {
      entries.push(...parseRunInner(m[2], warnings, contextLabel));
    }
    // self-closing <w:r/> (no captured groups) contributes nothing.
  }
  return entries;
}

/**
 * Word occasionally splits ONE verse number across multiple back-to-back
 * superscript runs with no other content between them (observed: Mark 1:35
 * as separate <w:t>3</w:t> / <w:t>5</w:t> runs under different w:rsidR
 * attributes - a revision-boundary artifact, not two verses). Merge any run
 * of directly-adjacent `verseMarker` entries (zero entries between them) by
 * string-concatenating their digits, so downstream code sees one marker.
 */
export function coalesceSplitVerseMarkers(entries) {
  const out = [];
  for (const e of entries) {
    const prev = out[out.length - 1];
    if (e.kind === "verseMarker" && prev && prev.kind === "verseMarker") {
      prev.verse = Number(`${prev.verse}${e.verse}`);
      prev.digits = `${prev.digits}${e.verse}`;
      continue;
    }
    out.push(e.kind === "verseMarker" ? { kind: "verseMarker", verse: e.verse, digits: String(e.verse) } : e);
  }
  return out;
}

const PARA_RE = /<w:p\b[^>]*>([\s\S]*?)<\/w:p>/g;

/**
 * Scan a word/document.xml string into one flat, document-ordered entry
 * list, with a `{ kind: "break" }` entry between paragraphs (mirrors v1's
 * inter-paragraph space so blind digit-adjacency scanning is unaffected).
 * @returns {{ entries: Array, paragraphs: Array<{start:number,end:number,xmlStart:number,xmlEnd:number}> }}
 *   paragraphs gives each <w:p>'s [start,end) range in `entries` (end
 *   exclusive of that paragraph's own trailing break entry), for
 *   paragraph-initial checks, PLUS its own [xmlStart,xmlEnd) byte range in
 *   `documentXml` (relative to the <w:body> match, i.e. `body`, not the raw
 *   input) - diagnostic tooling (gate-report.mjs) uses this to scope a raw-
 *   XML search for a specific paragraph's formatting without re-deriving
 *   offsets from scratch.
 */
export function scanDocumentEntries(documentXml, { warnings = [] } = {}) {
  const bodyMatch = documentXml.match(/<w:body>([\s\S]*)<\/w:body>/);
  const body = bodyMatch ? bodyMatch[1] : documentXml;
  const entries = [];
  const paragraphs = [];
  PARA_RE.lastIndex = 0;
  let m;
  let paraIdx = 0;
  while ((m = PARA_RE.exec(body))) {
    const start = entries.length;
    const paraEntries = coalesceSplitVerseMarkers(
      parseParagraphEntries(m[1], { warnings, contextLabel: `paragraph ${paraIdx}` }),
    );
    entries.push(...paraEntries);
    paragraphs.push({ start, end: entries.length, xmlStart: m.index, xmlEnd: m.index + m[0].length });
    entries.push({ kind: "break" });
    paraIdx++;
  }
  return { entries, paragraphs, body };
}

const FOOTNOTE_RE = /<w:footnote\b([^>]*)>([\s\S]*?)<\/w:footnote>/g;
const FOOTNOTE_PARA_RE = /<w:p\b[^>]*>([\s\S]*?)<\/w:p>/g;

/**
 * Scan a word/footnotes.xml string into Map<id, record>, skipping the
 * separator footnotes (id -1/0). Drops the leading FootnoteReference-styled
 * marker run, then left-trims (5,539 of 5,552 master footnotes start with
 * Word's own separator space once that marker is gone). A footnote whose
 * body spans more than one <w:p> gets `warning` set, forcing hand-review -
 * its paragraphs are still joined (with a break entry) on a best-effort basis.
 * @returns {Map<string, { plain: string, html: string, paragraphCount: number, warning: string|null, warnings: string[] }>}
 */
export function scanFootnoteRecords(footnotesXml, { warnings: globalWarnings = [] } = {}) {
  const map = new Map();
  FOOTNOTE_RE.lastIndex = 0;
  let m;
  while ((m = FOOTNOTE_RE.exec(footnotesXml))) {
    const attrs = m[1];
    const idMatch = attrs.match(/w:id="(-?\d+)"/);
    if (!idMatch) continue;
    const id = idMatch[1];
    if (id === "-1" || id === "0") continue;

    const inner = m[2];
    const localWarnings = [];
    const contextLabel = `footnote ${id}`;
    const paraInners = [];
    FOOTNOTE_PARA_RE.lastIndex = 0;
    let pm;
    while ((pm = FOOTNOTE_PARA_RE.exec(inner))) paraInners.push(pm[1]);

    let entries = [];
    for (let i = 0; i < paraInners.length; i++) {
      if (i > 0) entries.push({ kind: "break" });
      entries.push(...parseParagraphEntries(paraInners[i], { warnings: localWarnings, contextLabel }));
    }
    // Drop the footnote's own leading marker run(s) wherever they occur.
    entries = entries.filter((e) => e.kind !== "footnoteMarker");

    let plain = "";
    let html = "";
    for (const e of entries) {
      if (e.kind === "text") {
        plain += e.plain;
        html += e.html;
      } else if (e.kind === "break") {
        plain += " ";
        html += " ";
      }
      // a footnoteRef inside a footnote body (a footnote citing another
      // footnote) contributes nothing - not observed in this corpus, but
      // harmless to skip rather than crash on.
    }
    plain = plain.replace(/^\s+/, "");
    html = html.replace(/^\s+/, "");

    let warning = null;
    if (paraInners.length > 1) {
      warning = `multi-paragraph footnote (${paraInners.length} <w:p> blocks) - force hand-review`;
    }
    if (localWarnings.length) {
      warning = warning ? `${warning}; ${localWarnings.join("; ")}` : localWarnings.join("; ");
    }
    if (warning) globalWarnings.push(`footnote ${id}: ${warning}`);

    map.set(id, { plain, html, paragraphCount: paraInners.length, warning, warnings: localWarnings });
  }
  return map;
}

/**
 * Independent cross-check signal (plan Phase 1 item 3): the ordered sequence
 * of verse numbers as marked by <w:vertAlign w:val="superscript"/> runs,
 * segmented into per-chapter arrays by watching for a reset back to 1 (a
 * verse number that is NOT a small step above the running total, but IS
 * exactly 1, starts a new chapter - mirrors how verse numbers restart at
 * each chapter without needing to separately locate a bold chapter heading).
 * Deliberately does NOT consult the blind digit-adjacency scan in any way -
 * the two must be free to disagree, or the cross-check proves nothing.
 * @param {Array} entries from scanDocumentEntries
 * @returns {Array<number[]>} one array of verse numbers per detected chapter, in document order
 */
export function segmentSuperscriptVerses(entries, { maxStep = 3 } = {}) {
  const chapters = [];
  let current = [];
  let runningVerse = 0;
  for (const e of entries) {
    if (e.kind !== "verseMarker") continue;
    const v = e.verse;
    if (current.length === 0) {
      current.push(v);
      runningVerse = v;
      continue;
    }
    if (v > runningVerse && v <= runningVerse + maxStep) {
      current.push(v);
      runningVerse = v;
      continue;
    }
    if (v === 1) {
      chapters.push(current);
      current = [v];
      runningVerse = v;
      continue;
    }
    // Doesn't fit either pattern (out-of-order or too big a jump). Keep it
    // in the current chapter anyway so the anomaly surfaces as a verse-set
    // mismatch against the digit scan rather than vanishing silently.
    current.push(v);
    runningVerse = v;
  }
  if (current.length) chapters.push(current);
  return chapters;
}
