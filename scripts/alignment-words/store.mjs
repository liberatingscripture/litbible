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
// THE UNIT OF SAVING IS THE CHAPTER, because a record may reach across a verse
// boundary. Each save carries the revision (a hash of the file) the browser
// loaded, and a save against a file that has moved since is refused: a second
// tab holding an older copy would otherwise write its links over the first's.
//
// WHAT IT NEVER TOUCHES: src/data/alignment/ (phase 1, glossary records).

import { promises as fs } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { BOOK_ORDER, bookKeyToLabel } from "../../src/data/books.js";
import { loadMorphGnt } from "../lib/morphgnt.mjs";
import { splitChapterVerses } from "../lib/verse-text.mjs";
import {
  FORMAT,
  normalizeVerseText,
  describeChapter,
  buildChapterRecords,
  markStale,
  basisFor,
  serializeWordsFile,
  describeParse,
} from "./core.mjs";

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
const BOOK_RANK = new Map(BOOK_ORDER.map((k, i) => [k, i]));

function httpError(statusCode, message) {
  return Object.assign(new Error(message), { statusCode });
}

const chapterKey = (bookKey, chapter) => `${bookKey}-${chapter}`;
const revisionOf = (text) => createHash("sha256").update(text ?? "").digest("hex").slice(0, 16);

/** Every chapter file that carries at least one verse, in canonical order. Verse text is normalized here, once. */
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
    const text = new Map();
    for (const [v, raw] of splitChapterVerses(data.paragraphs)) {
      const normalized = normalizeVerseText(raw);
      if (normalized) text.set(v, normalized);
    }
    if (!text.size) continue;
    chapters.set(chapterKey(bookKey, data.chapter), {
      bookKey,
      chapter: data.chapter,
      draft: data.indexed === false,
      text,
    });
  }
  return new Map(
    [...chapters].sort(
      ([, a], [, b]) => BOOK_RANK.get(a.bookKey) - BOOK_RANK.get(b.bookKey) || a.chapter - b.chapter,
    ),
  );
}

/** Every chapter file of alignment-words/, with the exact text it was read from (its revision is a hash of that text). */
async function loadWords(outDir) {
  const words = new Map();
  let files;
  try {
    files = (await fs.readdir(outDir)).filter((n) => n.endsWith(".json"));
  } catch {
    return words; // nothing aligned yet is the normal first run
  }
  for (const f of files) {
    const raw = await fs.readFile(path.join(outDir, f), "utf8");
    let data;
    try {
      data = JSON.parse(raw);
    } catch (err) {
      throw new Error(`Cannot read ${f}: ${err.message}. Fix the file before aligning, or a save would overwrite it.`);
    }
    if (!data?.bookKey || !Number.isFinite(data.chapter)) continue;
    if (data.format !== undefined && data.format > FORMAT) {
      throw new Error(`${f} is format ${data.format}; this tool reads format ${FORMAT}. Update the tool.`);
    }
    words.set(chapterKey(data.bookKey, data.chapter), {
      raw,
      basis: data.basis && typeof data.basis === "object" ? data.basis : {},
      records: Array.isArray(data.records) ? data.records : [],
    });
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

  /** The chapter as core.mjs reads it: verse -> { text, greek }. */
  function versesOf(ch) {
    const osis = OSIS_BOOKS[ch.bookKey];
    return new Map(
      [...ch.text].map(([v, text]) => [v, { text, greek: corpus.tokensByRef.get(`${osis}.${ch.chapter}.${v}`) || [] }]),
    );
  }

  function describe(ch) {
    const stored = words.get(chapterKey(ch.bookKey, ch.chapter));
    const verses = versesOf(ch);
    return {
      verses,
      stored,
      d: describeChapter({ verses, basis: stored?.basis, records: stored?.records }),
    };
  }

  async function writeChapterFile(ch, records) {
    const key = chapterKey(ch.bookKey, ch.chapter);
    const file = path.join(outDir, `${key}.json`);
    if (!records.length) {
      await fs.rm(file, { force: true });
      words.delete(key);
      return;
    }
    const basis = basisFor({ verses: versesOf(ch), records });
    const raw = serializeWordsFile({ bookKey: ch.bookKey, chapter: ch.chapter, basis, records });
    await fs.mkdir(outDir, { recursive: true });
    const tmp = `${file}.tmp`;
    await fs.writeFile(tmp, raw, "utf8");
    await fs.rename(tmp, file);
    words.set(key, { raw, basis, records });
  }

  function chapterView(key) {
    const ch = english.get(key);
    if (!ch) throw httpError(404, `No chapter with English text: ${key}`);
    const { verses, stored, d } = describe(ch);
    const osis = OSIS_BOOKS[ch.bookKey];
    const verseList = [...verses.keys()].sort((a, b) => a - b).map((v) => {
      const s = d.verses.get(v);
      return {
        verse: v,
        ref: `${osis}.${ch.chapter}.${v}`,
        text: verses.get(v).text,
        englishTokens: s.tokens,
        // Lemma and parsing are shown to the reviewer and never stored.
        greek: verses.get(v).greek.map(({ t, text, word, lemma, pos, parse }) => ({
          t, text, word, lemma, pos, parse, parsed: describeParse(pos, parse),
        })),
        unlinkedGreek: s.unlinkedGreek,
        unlinkedEnglish: s.unlinkedEnglish,
        changed: s.changed,
        outsideSource: s.outsideSource,
        complete: s.complete,
      };
    });
    // Verses SBLGNT has that the English doesn't yet: named, so a verse nobody
    // has translated is not mistaken for a verse with no Greek.
    const greekOnly = [...corpus.verses]
      .filter((r) => r.startsWith(`${osis}.${ch.chapter}.`) && !verses.has(Number(r.split(".")[2])))
      .map((r) => Number(r.split(".")[2]))
      .sort((a, b) => a - b);
    return {
      key,
      bookKey: ch.bookKey,
      label: `${bookKeyToLabel(ch.bookKey)} ${ch.chapter}`,
      draft: ch.draft,
      revision: revisionOf(stored?.raw),
      verses: verseList,
      links: d.links,
      stale: d.stale,
      greekOnly,
    };
  }

  return {
    chaptersDir,
    outDir,

    getChapters() {
      return [...english.values()].map((ch) => {
        const { d } = describe(ch);
        const summaries = [...d.verses.values()];
        return {
          key: chapterKey(ch.bookKey, ch.chapter),
          bookKey: ch.bookKey,
          label: `${bookKeyToLabel(ch.bookKey)} ${ch.chapter}`,
          draft: ch.draft,
          verses: summaries.filter((s) => !s.outsideSource).length,
          complete: summaries.filter((s) => s.complete).length,
          stale: d.stale.length,
          changed: summaries.filter((s) => s.changed).length,
        };
      });
    },

    getChapter: chapterView,

    /**
     * Replace a chapter's live links with the browser's. Stale records are
     * NEVER dropped as a side effect: they are written back, marked, until the
     * reviewer resolves them, by re-linking (the new link arrives with the
     * stale record's index in `dropStale`) or by discarding (`dropStale`
     * alone). Links the tool carried across a revision are written at their
     * new place, and the basis moves to today's English.
     */
    async saveChapter(key, body) {
      const ch = english.get(key);
      if (!ch) throw httpError(404, `No chapter with English text: ${key}`);
      const { verses, stored, d } = describe(ch);
      if (body?.revision !== revisionOf(stored?.raw)) {
        throw httpError(409, `${key} changed since this page loaded it (another tab?). Reload to continue.`);
      }
      const drop = new Set(Array.isArray(body?.dropStale) ? body.dropStale : []);
      for (const i of drop) {
        if (!Number.isInteger(i) || i < 0 || i >= d.stale.length) throw httpError(400, `No stale link ${i}`);
      }
      const fresh = buildChapterRecords({
        refPrefix: `${OSIS_BOOKS[ch.bookKey]}.${ch.chapter}`,
        verses,
        links: body?.links,
      });
      const kept = d.stale.filter((_, i) => !drop.has(i)).map(markStale);
      await writeChapterFile(ch, mergeByVerse(fresh, kept));
      return chapterView(key);
    },

    /**
     * What the audit command reports: every stored record that no longer fits,
     * every link carried across a revision but not yet saved at its new place,
     * and the records of chapters with no English at all.
     */
    getReport() {
      const stale = [];
      const carried = [];
      let verseCount = 0;
      for (const ch of english.values()) {
        const { d } = describe(ch);
        verseCount += d.verses.size;
        for (const s of d.stale) stale.push({ ref: s.record.ref, reason: s.reason, record: s.record });
        const moved = d.links.filter((l) => l.moved).length;
        if (moved) carried.push({ chapter: `${OSIS_BOOKS[ch.bookKey]}.${ch.chapter}`, links: moved });
      }
      for (const [key, stored] of words) {
        if (english.has(key)) continue;
        for (const record of stored.records) stale.push({ ref: record.ref, reason: "verse", record });
      }
      return { stale, carried, verses: verseCount, chapters: english.size };
    },
  };
}

/** Fresh records then the unresolved stale ones, in verse order, each group's own order kept. */
function mergeByVerse(fresh, stale) {
  const verseOf = (r) => Number(String(r.ref).split(".")[2]);
  return [...fresh, ...stale]
    .map((r, i) => ({ r, i }))
    .sort((a, b) => verseOf(a.r) - verseOf(b.r) || a.i - b.i)
    .map((x) => x.r);
}
