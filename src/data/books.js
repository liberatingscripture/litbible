// src/data/books.js

export const BOOKS = {
  matthew: 28,
  mark: 16,
  luke: 24,
  john: 21,
  acts: 28,
  romans: 16,
  "1corinthians": 16,
  "2corinthians": 13,
  galatians: 6,
  ephesians: 6,
  philippians: 4,
  colossians: 4,
  "1thessalonians": 5,
  "2thessalonians": 3,
  "1timothy": 6,
  "2timothy": 4,
  titus: 3,
  philemon: 1,
  hebrews: 13,
  james: 5,
  "1peter": 5,
  "2peter": 3,
  "1john": 5,
  "2john": 1,
  "3john": 1,
  jude: 1,
  revelation: 22,
};

export const BOOK_ORDER = [
  "matthew",
  "mark",
  "luke",
  "john",
  "acts",
  "romans",
  "1corinthians",
  "2corinthians",
  "galatians",
  "ephesians",
  "philippians",
  "colossians",
  "1thessalonians",
  "2thessalonians",
  "1timothy",
  "2timothy",
  "titus",
  "philemon",
  "hebrews",
  "james",
  "1peter",
  "2peter",
  "1john",
  "2john",
  "3john",
  "jude",
  "revelation",
];

// Short labels for compact UI (the ReadMenu book grid). SBL-style, except
// James stays unabbreviated ("Jas" is opaque to readers new to scripture).
export const BOOK_ABBREVIATIONS = {
  matthew: "Matt",
  mark: "Mark",
  luke: "Luke",
  john: "John",
  acts: "Acts",
  romans: "Rom",
  "1corinthians": "1 Cor",
  "2corinthians": "2 Cor",
  galatians: "Gal",
  ephesians: "Eph",
  philippians: "Phil",
  colossians: "Col",
  "1thessalonians": "1 Thess",
  "2thessalonians": "2 Thess",
  "1timothy": "1 Tim",
  "2timothy": "2 Tim",
  titus: "Titus",
  philemon: "Phlm",
  hebrews: "Heb",
  james: "James",
  "1peter": "1 Pet",
  "2peter": "2 Pet",
  "1john": "1 John",
  "2john": "2 John",
  "3john": "3 John",
  jude: "Jude",
  revelation: "Rev",
};

export function bookKeyToLabel(key) {
  const m = String(key).match(/^(\d+)?([a-z]+)$/i);
  if (!m) return String(key);
  const num = m[1] ? `${m[1]} ` : "";
  const word = m[2];
  return num + word.charAt(0).toUpperCase() + word.slice(1);
}
