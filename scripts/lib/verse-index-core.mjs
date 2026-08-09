// scripts/lib/verse-index-core.mjs
//
// The pure paragraph-HTML → per-verse plain-text core of build-verse-index.mjs.
// Given one chapter's `paragraphs` array it returns the verse-indexed text array
// that ships in public/search/verses.json — with NO fs, argv, or process access
// of its own. The wrapper (scripts/build-verse-index.mjs) walks the chapter
// files, skips drafts, orders the output, and derives the corpus vocabulary.
//
// This split mirrors scripts/lib/release-notes-core.mjs and exists for the same
// reason: the extraction can then be unit-tested directly against in-memory
// fixtures (test/build-verse-index.test.js). verses.json is a website asset
// rather than part of the mobile-app contract, but it backs live scripture
// search, so a silent extraction regression ships straight to readers. Keep all
// extraction logic here, never in the wrapper, so the tests exercise what the
// build actually runs.
//
// Only extractVerses is exported; htmlToPlainText is deliberately internal so
// the tests stay black-box, the same convention test/chapter-html.test.js
// documents for that module's internal passes.

/** Remove the literal `[|` / `|]` markers that wrap contested passages (see
 *  "Bracketed passages" in CLAUDE.md). They are plain characters in the
 *  paragraph text rather than markup, so tag stripping leaves them in place and
 *  they reach the shipped index — a reader landing on Mark 16:8 saw the snippet
 *  end with a bare `[|`.
 *
 *  They also skew attribution. The opening marker leads its paragraph, which
 *  puts it BEFORE that paragraph's first verse marker, so the split in
 *  extractVerses filed it under the PREVIOUS verse: Mark 16:8 carried verse 9's
 *  marker, John 7:52 carried 7:53's, Romans 16:23 carried 16:24's. Removing the
 *  marker fixes that for free — with nothing left in the previous verse's chunk,
 *  there is nothing to misfile.
 *
 *  A deliberate mirror of stripBracketMarkers in
 *  scripts/lib/release-notes-core.mjs, which fixed the same defect in the
 *  changelog path. That copy carries an exception for its paragraph-level
 *  fallback comparison; there is no equivalent fallback here, so this one
 *  applies unconditionally. */
function stripBracketMarkers(text) {
  return String(text ?? "").replace(/\[\||\|\]/g, "");
}

/** Strip markup down to searchable plain text (chapters only use a few entities). */
function htmlToPlainText(html) {
  return stripBracketMarkers(
    String(html || "")
      .replace(
        /<sup\b[^>]*class=(['"])[^'"]*\bfn-ref\b[^'"]*\1[^>]*>[\s\S]*?<\/sup>/gi,
        "",
      )
      // Block boundaries (poetry lines, paragraphs) separate words; inline
      // tags sit inside words' natural whitespace and are dropped outright so
      // punctuation isn't pushed off its word ("meshiah," not "meshiah ,").
      .replace(/<\/?(?:p|blockquote|br)\b[^>]*>/gi, " ")
      .replace(/<[^>]+>/g, "")
      .replace(/&nbsp;/g, " ")
      .replace(/&mdash;/g, "—")
      .replace(/&#39;/g, "'")
      .replace(/&amp;/g, "&"),
  )
    // Collapse LAST, once the markers are gone. A closing marker is not always
    // paragraph-final: John 9:39 reads `Jesus said, |] “I came…`, so the gap a
    // stripped marker leaves behind would otherwise ship as a double space.
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Split one chapter's joined paragraph HTML into per-verse plain text.
 * A verse that spans a paragraph break repeats its `id="vN"` sup at the start
 * of the continuation paragraph; the continuation text is appended to the
 * verse's first chunk (mirroring dropDuplicateVerseIds at render time).
 */
export function extractVerses(paragraphs) {
  const joined = (paragraphs || []).join(" ");
  const parts = joined.split(/<sup\b[^>]*\bid="v(\d+)"[^>]*>/);

  // parts = [before-verse-1, "1", chunk, "2", chunk, ...]
  const byVerse = new Map();
  for (let i = 1; i < parts.length; i += 2) {
    const verse = Number(parts[i]);
    if (!Number.isFinite(verse) || verse <= 0) continue;

    // The chunk still starts with the sup's own text: "N</sup>…".
    const chunkHtml = String(parts[i + 1] || "").replace(/^\d+<\/sup>/, "");
    const text = htmlToPlainText(chunkHtml);
    if (!text) continue;

    byVerse.set(verse, byVerse.has(verse) ? `${byVerse.get(verse)} ${text}` : text);
  }

  if (!byVerse.size) return null;

  const maxVerse = Math.max(...byVerse.keys());
  const verses = [];
  for (let v = 1; v <= maxVerse; v++) verses.push(byVerse.get(v) || "");
  return verses;
}
