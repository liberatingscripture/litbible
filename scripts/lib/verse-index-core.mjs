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

import { stripBracketMarkers } from "../../src/lib/bracket-markers.mjs";

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
    // Collapse LAST, once the markers are gone — see the ordering rule in
    // src/lib/bracket-markers.mjs. Stripping here also repairs attribution:
    // an opening `[|` used to land in the PREVIOUS verse's chunk (Mark 16:8
    // carried verse 9's marker, Romans 16:23 carried 16:24's).
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
