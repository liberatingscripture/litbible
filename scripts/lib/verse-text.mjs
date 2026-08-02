// Turns a chapter's paragraph HTML into per-verse plain text.
//
// Shared by build-verse-index.mjs (the shipped scripture search index),
// build-alignment.mjs, and the alignment review tool — three readers of the
// same chapter JSON that must agree on where a verse starts and ends, or a
// record's character offsets stop pointing at the text the reader saw.
//
// NOT the only splitter in the repo, and deliberately so: release-notes-core.mjs
// splits on `<span class="vglue">` with a richer entity table because it
// compares two revisions of the SAME verse to produce a diff, where an entity
// left as a literal would read as an edit. It also backs an app-facing
// contract. Don't merge the two.

/** Strip markup down to plain text (chapters only use a few entities). */
export function htmlToPlainText(html) {
  return String(html || "")
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
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Split one chapter's paragraphs into a Map(verseNumber -> plain text).
 *
 * A verse that spans a paragraph break repeats its `id="vN"` sup at the start
 * of the continuation paragraph; the continuation text is appended to the
 * verse's first chunk (mirroring dropDuplicateVerseIds at render time).
 *
 * @param {string[]} paragraphs
 * @returns {Map<number, string>}
 */
export function splitChapterVerses(paragraphs) {
  const joined = (paragraphs || []).join(" ");
  const parts = joined.split(/<sup\b[^>]*\bid="v(\d+)"[^>]*>/);

  // parts = [before-verse-1, "1", chunk, "2", chunk, ...]
  const byVerse = new Map();
  for (let i = 1; i < parts.length; i += 2) {
    const verse = Number(parts[i]);
    if (!Number.isFinite(verse) || verse <= 0) continue;

    // The chunk still starts with the sup's own text: "N</sup>…".
    const text = htmlToPlainText(
      String(parts[i + 1] || "").replace(/^\d+<\/sup>/, ""),
    );
    if (!text) continue;

    byVerse.set(verse, byVerse.has(verse) ? `${byVerse.get(verse)} ${text}` : text);
  }
  return byVerse;
}
