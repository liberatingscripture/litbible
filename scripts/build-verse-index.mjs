// Generates public/search/verses.json — the verse-level plain-text index the
// client uses for scripture KEYWORD search (see searchVerses in
// src/scripts/search-core.js). Scripture chapter pages are intentionally NOT
// indexed by Pagefind; this file is the search surface for Bible text, while
// Pagefind covers articles/glossary and public/topics-index.json covers
// topics.
//
// Shape (index 0 = verse 1; "" for verse numbers with no content):
//   {
//     "verses": { "<bookKey>": { "<chapter>": ["verse 1 text", ...] } },
//     "vocab":  ["abandon", "abandoned", ...]
//   }
//
// `vocab` is every distinct word in the included verses, sorted. The client
// (search-core.js) derives BOTH search niceties from it at load time:
// related-form matching ("liberation" also finds "liberate" — it stems the
// vocabulary with src/lib/word-stem.mjs and groups shared stems) and
// typo correction ("jeribulem" → results for "jerusalem" — nearest vocab
// word by edit distance when a query has no hits). Shipping the raw
// vocabulary rather than precomputed stem groups keeps the stemmer in ONE
// place (the client) so build and query can never disagree.
//
// Draft chapters ("indexed": false) are excluded so search never surfaces
// untranslated stubs. Output is deterministic (canonical book order, numeric
// chapter order, sorted vocab, no timestamps). This file is a website asset,
// NOT part of the mobile-app API contract — it must never move under
// public/api/.
//
// This module is the fs/CLI half only. The paragraph-HTML → per-verse plain-text
// extraction lives in ./lib/verse-index-core.mjs so it can be unit-tested
// directly (test/build-verse-index.test.js) — same split, same reason, as
// draft-release-notes.mjs and ./lib/release-notes-core.mjs.

import { promises as fs } from "node:fs";
import path from "node:path";
import { BOOK_ORDER } from "../src/data/books.js";
import { foldDiacritics } from "../src/lib/word-stem.mjs";
import { extractVerses } from "./lib/verse-index-core.mjs";

const ROOT = process.cwd();
const CHAPTERS_DIR = path.join(ROOT, "src", "data", "chapters");
const OUT_FILE = path.join(ROOT, "public", "search", "verses.json");

const BOOK_RANK = new Map(BOOK_ORDER.map((k, i) => [k, i]));

async function main() {
  const files = (await fs.readdir(CHAPTERS_DIR)).filter((f) =>
    f.endsWith(".json"),
  );

  const byBook = new Map(); // bookKey -> Map(chapter -> verses[])
  let chapterCount = 0;
  let verseCount = 0;

  for (const f of files) {
    const raw = await fs.readFile(path.join(CHAPTERS_DIR, f), "utf8");

    let data;
    try {
      data = JSON.parse(raw);
    } catch {
      continue;
    }

    if (data.indexed === false) continue; // draft/stub chapter

    const bookKey = String(data.bookKey || "");
    const chapter = data.chapter;
    if (!BOOK_RANK.has(bookKey) || !Number.isFinite(chapter)) continue;

    const verses = extractVerses(data.paragraphs);
    if (!verses) continue;

    if (!byBook.has(bookKey)) byBook.set(bookKey, new Map());
    byBook.get(bookKey).set(chapter, verses);
    chapterCount++;
    verseCount += verses.filter(Boolean).length;
  }

  // Deterministic order: canonical books, numeric chapters. No timestamps —
  // byte-stable output when the underlying text hasn't changed.
  const versesObj = {};
  for (const bookKey of BOOK_ORDER) {
    const chapters = byBook.get(bookKey);
    if (!chapters) continue;
    const bookObj = {};
    for (const ch of [...chapters.keys()].sort((a, b) => a - b)) {
      bookObj[ch] = chapters.get(ch);
    }
    versesObj[bookKey] = bookObj;
  }

  // Corpus vocabulary: every distinct word in the included verses,
  // diacritics folded to match the client's token comparison.
  const vocabSet = new Set();
  for (const chapters of byBook.values()) {
    for (const verses of chapters.values()) {
      for (const text of verses) {
        for (const m of text.matchAll(/[\p{L}\p{N}]+/gu)) {
          vocabSet.add(foldDiacritics(m[0].toLowerCase()));
        }
      }
    }
  }
  const vocab = [...vocabSet].sort();

  await fs.mkdir(path.dirname(OUT_FILE), { recursive: true });
  await fs.writeFile(
    OUT_FILE,
    JSON.stringify({ verses: versesObj, vocab }),
    "utf8",
  );
  console.log(
    `Wrote ${OUT_FILE} (${chapterCount} chapters, ${verseCount} verses, ${vocab.length} vocabulary words)`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
