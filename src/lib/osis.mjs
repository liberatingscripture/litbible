// src/lib/osis.mjs
//
// The OSIS book abbreviations (the standard SBL/OSIS identifiers) for the New
// Testament, keyed by the site's book keys. One table, because two places need
// it: chapter-html.ts stamps data-osis="Book.Chapter.Verse" on verse numbers,
// and the Study Desk's export (desk-export.mjs) writes the same references
// into the notebook's W3C Web Annotation file (STUDY-DESK-FORMAT.md: OSIS is
// derived, never stored). Pure.

export const OSIS_BOOKS = {
  matthew: "Matt", mark: "Mark", luke: "Luke", john: "John", acts: "Acts",
  romans: "Rom", "1corinthians": "1Cor", "2corinthians": "2Cor",
  galatians: "Gal", ephesians: "Eph", philippians: "Phil", colossians: "Col",
  "1thessalonians": "1Thess", "2thessalonians": "2Thess",
  "1timothy": "1Tim", "2timothy": "2Tim", titus: "Titus", philemon: "Phlm",
  hebrews: "Heb", james: "Jas", "1peter": "1Pet", "2peter": "2Pet",
  "1john": "1John", "2john": "2John", "3john": "3John", jude: "Jude",
  revelation: "Rev",
};

/**
 * "Rom.8.3" for a verse, "Rom.8.3-Rom.8.4" for a range (OSIS writes both ends
 * in full), "Rom.8" for a whole chapter; "" when the book has no OSIS name.
 */
export function osisRef(bookKey, chapter, verse = null, endVerse = null) {
  const book = OSIS_BOOKS[bookKey];
  if (!book || !Number.isInteger(chapter)) return "";
  if (!Number.isInteger(verse)) return `${book}.${chapter}`;
  const start = `${book}.${chapter}.${verse}`;
  return Number.isInteger(endVerse) && endVerse !== verse ? `${start}-${book}.${chapter}.${endVerse}` : start;
}
