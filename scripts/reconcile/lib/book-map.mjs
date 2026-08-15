// Copied verbatim from the v1 audit (docx-audit/lib/book-map.mjs in the
// session scratchpad) - no absolute paths or v1-specific assumptions here,
// so nothing needed adapting. See scripts/reconcile/README.md.
//
// docx filename (no extension) -> repo bookKey, and chapter counts.
// Mirrors src/data/books.js BOOKS/BOOK_ORDER exactly (see CLAUDE.md: that
// file is the single source of truth for book keys/chapter counts).

export const BOOKS = {
  matthew: 28, mark: 16, luke: 24, john: 21, acts: 28, romans: 16,
  "1corinthians": 16, "2corinthians": 13, galatians: 6, ephesians: 6,
  philippians: 4, colossians: 4, "1thessalonians": 5, "2thessalonians": 3,
  "1timothy": 6, "2timothy": 4, titus: 3, philemon: 1, hebrews: 13,
  james: 5, "1peter": 5, "2peter": 3, "1john": 5, "2john": 1, "3john": 1,
  jude: 1, revelation: 22,
};

export const BOOK_ORDER = [
  "matthew", "mark", "luke", "john", "acts", "romans", "1corinthians",
  "2corinthians", "galatians", "ephesians", "philippians", "colossians",
  "1thessalonians", "2thessalonians", "1timothy", "2timothy", "titus",
  "philemon", "hebrews", "james", "1peter", "2peter", "1john", "2john",
  "3john", "jude", "revelation",
];

// docx filename (without .docx) -> bookKey, for the 26 books with a master.
export const DOCX_TO_BOOKKEY = {
  "1 Corinthians": "1corinthians", "1 John": "1john",
  "1 Peter": "1peter", "1 Thessalonians": "1thessalonians",
  "1 Timothy": "1timothy", "2 Corinthians": "2corinthians",
  "2 John": "2john", "2 Peter": "2peter",
  "2 Thessalonians": "2thessalonians", "2 Timothy": "2timothy",
  "3 John": "3john", "Acts": "acts",
  "Colossians": "colossians", "Ephesians": "ephesians",
  "Galatians": "galatians", "Hebrews": "hebrews",
  "James": "james", "John": "john",
  "Jude": "jude", "Luke": "luke",
  "Mark": "mark", "Matthew": "matthew",
  "Philemon": "philemon", "Philippians": "philippians",
  "Romans": "romans", "Titus": "titus",
};

// Books with NO master .docx at all (per task setup: no Revelation folder
// exists in the user's OneDrive Bible Translation library).
export const NO_MASTER_BOOKS = ["revelation"];

// Books whose downloaded master .docx is truncated/incomplete (confirmed by
// direct inspection - not a parser bug, see the audit report's "could not be
// compared" section for details). Chapters not in `usableChapters` are
// reported as could-not-compare with reason "master document truncated".
export const TRUNCATED_MASTERS = {
  acts: { usableChapters: [], note: "document.xml contains only Acts 1:1-4 (7.4KB total); chapters 1(rest)-28 absent" },
  luke: { usableChapters: rangeInclusive(1, 21), note: "document.xml ends mid-Luke 21:38; chapters 22-24 absent" },
};

function rangeInclusive(a, b) {
  const out = [];
  for (let i = a; i <= b; i++) out.push(i);
  return out;
}

// CLAUDE.md's documented intentional verse-number gaps (traditional verse
// numbers the SBLGNT source text does not carry, already footnoted at the
// gap boundary in the repo). Both sides agreeing the verse is absent is
// expected, not a finding.
export const DOCUMENTED_GAPS = new Set([
  "matthew-17-21", "matthew-18-11", "matthew-23-14",
  "mark-7-16", "mark-9-44", "mark-9-46", "mark-11-26", "mark-15-28",
  "luke-17-36",
  "john-5-4",
]);
