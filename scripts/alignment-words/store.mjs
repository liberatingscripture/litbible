// All filesystem + corpus state for the word-alignment tool, behind one object.
// server.mjs is routing only; every read comes from the in-memory state built
// here and every write goes through writeChapterFile(), so the copy on disk and
// the copy in memory cannot drift apart mid-session. Same shape as
// scripts/alignment-review/store.mjs, for the same reasons.
//
// LIKE THE GLOSSARY REVIEW TOOL, THIS CANNOT DEGRADE WITHOUT MORPHGNT: the
// Greek words are the thing being aligned, and there is no tool without them.
// createStore() throws, with the fix, rather than opening an empty page.
//
// WHICH ENGLISH IT ALIGNS. Every chapter file that has verses, DRAFTS
// INCLUDED. The glossary tool skips `indexed: false` because a stub must never
// read as a gap in a term's coverage; here the point is to align a book as it
// is being translated, and a stub chapter simply has no verses to offer.
// `--chapters-dir` points the tool at another directory of chapter files, for
// trying it on text that is not in the corpus yet.
//
// WHAT IT NEVER TOUCHES: src/data/alignment/ (phase 1, glossary records).

import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { BOOK_ORDER, bookKeyToLabel } from "../../src/data/books.js";
import { loadMorphGnt } from "../lib/morphgnt.mjs";
import { splitChapterVerses } from "../lib/verse-text.mjs";
import { buildRecords, describeVerse, serializeWordsFile } from "./core.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const DEFAULT_CHAPTERS_DIR = path.join(ROOT, "src", "data", "chapters");
const DEFAULT_OUT_DIR = path.join(ROOT, "src", "data", "alignment-words");
const MORPHGNT_DIR = process.env.MORPHGNT_DIR || path.join(ROOT, ".morphgnt");

/** Copied from scripts/alignment-review/store.mjs, which copies build-alignment.mjs: a ref must be spelled the same by every writer. */
const OSIS_BOOKS = {
  matthew: "Matt", mark: "Mark", luke: "Luke", john: "John", acts: "Acts",
  romans: "Rom", "1corinthians": "1Cor", "2corinthians": "2Cor",
  galatians: "Gal", ephesians: "Eph", philippians: "Phil", colossians: "Col",
  "1thessalonians": "1Thess", "2thessalonians": "2Thess",
  "1timothy": "1Tim", "2timothy": "2Tim", titus: "Titus", philemon: "Phlm",
  hebrews: "Heb", james: "Jas", "1peter": "1Pet", "2peter": "2Pet",
  "1john": "1John", "2john": "2John", "3john": "3John", jude: "Jude",
  revelation: "Rev",
};
const BOOK_KEY_BY_OSIS = Object.fromEntries(Object.entries(OSIS_BOOKS).map(([k, v]) => [v, k]));
const BOOK_RANK = new Map(BOOK_ORDER.map((k, i) => [k, i]));

function httpError(statusCode, message) {
  return Object.assign(new Error(message), { statusCode });
}

/** "Acts.1.3" -> { bookKey: "acts", chapter: 1, verse: 3 }, or null for anything else. */
function parseRef(ref) {
  const m = String(ref).match(/^([0-9A-Za-z]+)\.(\d+)\.(\d+)$/);
  const bookKey = m && BOOK_KEY_BY_OSIS[m[1]];
  return bookKey ? { bookKey, chapter: Number(m[2]), verse: Number(m[3]) } : null;
}

const chapterKey = (bookKey, chapter) => `${bookKey}-${chapter}`;

/** Every chapter file that carries at least one verse, in canonical order. */
async function loadEnglish(chaptersDir) {
  const chapters = new Map();
  for (const f of (await fs.readdir(chaptersDir)).filter((n) => n.endsWith(".json"))) {
    let data;
    try {
      data = JSON.parse(await fs.readFile(path.join(chaptersDir, f), "utf8"));
    } catch {
      continue;
    }
    const bookKey = String(data.bookKey || "");
    if (!BOOK_RANK.has(bookKey) || !Number.isFinite(data.chapter)) continue;
    const verses = splitChapterVerses(data.paragraphs);
    if (!verses.size) continue;
    chapters.set(chapterKey(bookKey, data.chapter), {
      bookKey,
      chapter: data.chapter,
      draft: data.indexed === false,
      verses,
    });
  }
  return new Map(
    [...chapters].sort(
      ([, a], [, b]) => BOOK_RANK.get(a.bookKey) - BOOK_RANK.get(b.bookKey) || a.chapter - b.chapter,
    ),
  );
}

async function loadWords(outDir) {
  const words = new Map();
  let files;
  try {
    files = (await fs.readdir(outDir)).filter((n) => n.endsWith(".json"));
  } catch {
    return words; // nothing aligned yet is the normal first run
  }
  for (const f of files) {
    try {
      const data = JSON.parse(await fs.readFile(path.join(outDir, f), "utf8"));
      if (data?.bookKey && Number.isFinite(data.chapter)) {
        words.set(chapterKey(data.bookKey, data.chapter), Array.isArray(data.records) ? data.records : []);
      }
    } catch (err) {
      console.error(`  cannot read ${f}: ${err.message}`);
    }
  }
  return words;
}

export async function createStore({ chaptersDir = DEFAULT_CHAPTERS_DIR, outDir = DEFAULT_OUT_DIR } = {}) {
  const corpus = await loadMorphGnt(MORPHGNT_DIR, OSIS_BOOKS, { withTokens: true });
  if (!corpus) {
    throw new Error(
      `The word-alignment tool needs a MorphGNT working copy and found none at ${MORPHGNT_DIR}.\n` +
        `  git clone --depth 1 https://github.com/morphgnt/sblgnt.git <somewhere permanent>\n` +
        `then set MORPHGNT_DIR to it (the same variable build-alignment.mjs reads).`,
    );
  }
  const english = await loadEnglish(chaptersDir);
  const words = await loadWords(outDir);

  const greekFor = (ref) => corpus.tokensByRef.get(ref) || [];
  const recordsFor = (ref) => (words.get(ref.key) || []).filter((r) => r.ref === ref.ref);

  function describe(ch, verse) {
    const osis = OSIS_BOOKS[ch.bookKey];
    const ref = `${osis}.${ch.chapter}.${verse}`;
    const greek = greekFor(ref);
    const d = describeVerse({
      verseText: ch.verses.get(verse),
      greekTokens: greek,
      records: recordsFor({ key: chapterKey(ch.bookKey, ch.chapter), ref }),
    });
    return { ref, greek, ...d };
  }

  async function writeChapterFile(ch, records) {
    const key = chapterKey(ch.bookKey, ch.chapter);
    const file = path.join(outDir, `${key}.json`);
    words.set(key, records);
    if (!records.length) {
      await fs.rm(file, { force: true });
      return;
    }
    await fs.mkdir(outDir, { recursive: true });
    const tmp = `${file}.tmp`;
    await fs.writeFile(tmp, serializeWordsFile({ bookKey: ch.bookKey, chapter: ch.chapter, records }), "utf8");
    await fs.rename(tmp, file);
  }

  return {
    chaptersDir,
    outDir,

    getChapters() {
      return [...english.values()].map((ch) => {
        const verses = [...ch.verses.keys()].sort((a, b) => a - b);
        const complete = verses.filter((v) => describe(ch, v).complete).length;
        return {
          key: chapterKey(ch.bookKey, ch.chapter),
          bookKey: ch.bookKey,
          label: `${bookKeyToLabel(ch.bookKey)} ${ch.chapter}`,
          draft: ch.draft,
          verses: verses.length,
          complete,
        };
      });
    },

    getChapter(key) {
      const ch = english.get(key);
      if (!ch) throw httpError(404, `No chapter with English text: ${key}`);
      const osis = OSIS_BOOKS[ch.bookKey];
      const verses = [...ch.verses.keys()]
        .sort((a, b) => a - b)
        .map((verse) => {
          const d = describe(ch, verse);
          return {
            verse,
            ref: d.ref,
            text: ch.verses.get(verse),
            englishTokens: d.englishTokens,
            // The lemma and parse are shown to the reviewer and never stored.
            greek: d.greek.map(({ t, text, word, lemma, pos, parse }) => ({ t, text, word, lemma, pos, parse })),
            links: d.links,
            stale: d.stale,
            unlinkedGreek: d.unlinkedGreek,
            unlinkedEnglish: d.unlinkedEnglish,
            complete: d.complete,
          };
        });
      // Verses SBLGNT has that the English doesn't yet: worth naming, so a
      // verse nobody has translated is not mistaken for a verse with no Greek.
      const greekOnly = [...corpus.verses]
        .filter((r) => r.startsWith(`${osis}.${ch.chapter}.`) && !ch.verses.has(Number(r.split(".")[2])))
        .map((r) => Number(r.split(".")[2]))
        .sort((a, b) => a - b);
      return {
        key,
        bookKey: ch.bookKey,
        label: `${bookKeyToLabel(ch.bookKey)} ${ch.chapter}`,
        draft: ch.draft,
        verses,
        greekOnly,
      };
    },

    /**
     * Replace one verse's records with the browser's links. A verse holding
     * records that no longer fit its text is refused until the reviewer says
     * to discard them, because the replacement would otherwise delete them
     * without a word.
     */
    async saveVerse(ref, body) {
      const parts = parseRef(ref);
      const ch = parts && english.get(chapterKey(parts.bookKey, parts.chapter));
      if (!ch || !ch.verses.has(parts.verse)) throw httpError(404, `No English text for ${ref}`);

      const before = describe(ch, parts.verse);
      if (before.stale.length && !body?.discardStale) {
        throw httpError(409, `${before.stale.length} stored link(s) in ${ref} no longer fit the text`);
      }
      const fresh = buildRecords({
        ref,
        links: body?.links,
        greekTokens: before.greek,
        verseText: ch.verses.get(parts.verse),
      });

      const key = chapterKey(ch.bookKey, ch.chapter);
      const verseOf = (r) => Number(String(r.ref).split(".")[2]);
      const kept = (words.get(key) || []).filter((r) => verseOf(r) !== parts.verse);
      // Verse order across the file; within a verse buildRecords' order stands.
      const merged = [...kept, ...fresh]
        .map((r, i) => ({ r, i }))
        .sort((a, b) => verseOf(a.r) - verseOf(b.r) || a.i - b.i)
        .map((x) => x.r);
      await writeChapterFile(ch, merged);

      const d = describe(ch, parts.verse);
      return {
        ref,
        links: d.links,
        stale: d.stale,
        unlinkedGreek: d.unlinkedGreek,
        unlinkedEnglish: d.unlinkedEnglish,
        complete: d.complete,
      };
    },
  };
}
