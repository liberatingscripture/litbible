// Build-time shell for the term lens (term-lens.mjs) and for anything else a
// chapter page shows from the alignment dataset: reads src/data/alignment/
// once per build and applies the display gate.
//
// Reads with node:fs from the working directory, like scripture-refs-data.mjs
// and for the same reason (Vite rewrites import.meta.url in frontmatter).

import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { gatedOccurrences } from "./alignment-gate.mjs";
import { chapterMarks, occurrencesByChapter, renderingCounts } from "./term-lens.mjs";
import { familyWordsIn } from "./term-words.mjs";
import { splitChapterVerses } from "../../scripts/lib/verse-text.mjs";
import { GLOSSARY_LEMMAS, lemmaWords } from "../../scripts/lib/glossary-lemmas.mjs";

function resolveAlignmentDir() {
  const fromCwd = path.resolve(process.cwd(), "src/data/alignment");
  if (existsSync(fromCwd)) return fromCwd;
  return fileURLToPath(new URL("../data/alignment", import.meta.url));
}

function resolveGreekTextDir() {
  const fromCwd = path.resolve(process.cwd(), "public/greek/text");
  if (existsSync(fromCwd)) return fromCwd;
  return fileURLToPath(new URL("../../public/greek/text", import.meta.url));
}

// Where a word's verse and lemma sit in a Greek chapter file's word arrays
// (public/greek/text/, format 1; src/lib/desk-greek.mjs names every field as
// `W`, which a page's build can't import: it is the Study Desk's).
const WORD_VERSE = 0;
const WORD_LEMMA = 5;

const greekCache = new Map();

/**
 * One chapter's Greek as verse -> the lemmas in it, or null where the chapter
 * has no Greek file. Read so a mark can say which word of its term's family
 * its verse holds (term-words.mjs); only the choice among the owner's own
 * words goes on the page, never a lemma, which stays in public/greek/ under
 * its own license.
 *
 * @returns {Map<number, Set<string>> | null}
 */
export function chapterVerseLemmas(bookKey, chapter) {
  const key = `${bookKey}-${chapter}`;
  if (greekCache.has(key)) return greekCache.get(key);
  let out = null;
  const file = path.join(resolveGreekTextDir(), `${key}.json`);
  if (existsSync(file)) {
    const data = JSON.parse(readFileSync(file, "utf-8"));
    out = new Map();
    for (const words of data.paragraphs ?? []) {
      for (const word of words) {
        const lemma = data.lemmas?.[word[WORD_LEMMA]]?.[0];
        if (!lemma) continue;
        const verse = word[WORD_VERSE];
        if (!out.has(verse)) out.set(verse, new Set());
        out.get(verse).add(lemma);
      }
    }
  }
  greekCache.set(key, out);
  return out;
}

let cache = null;

function load() {
  if (cache) return cache;
  const dir = resolveAlignmentDir();
  const files = readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .map((f) => JSON.parse(readFileSync(path.join(dir, f), "utf-8")));
  const gated = gatedOccurrences(files);
  cache = {
    gated,
    byChapter: occurrencesByChapter(gated),
    renderings: renderingCounts(gated),
  };
  return cache;
}

/** The glossary ids a chapter shows at least one gated rendering of. */
export function gatedTermIds(bookKey, chapter) {
  const list = load().byChapter.get(`${bookKey}-${chapter}`) ?? [];
  return [...new Set(list.map((o) => o.id))];
}

/**
 * Everything the page hands the client for one chapter.
 *
 * @param {string} bookKey
 * @param {number} chapter
 * @param {string[]} paragraphs  the chapter JSON's raw paragraphs
 * @param {Map<string, { traditional: string, greek: string, litMenu: string }>} entries
 *   the published glossary entries by id; a term whose entry is a draft is
 *   left out, as /glossary leaves it out
 */
export function termLensFor(bookKey, chapter, paragraphs, entries) {
  const { byChapter, renderings } = load();
  const occurrences = (byChapter.get(`${bookKey}-${chapter}`) ?? []).filter((o) =>
    entries.has(o.id),
  );
  const { marks: placed, unresolved } = chapterMarks(occurrences, splitChapterVerses(paragraphs));
  // Which word of its term's family each mark's verse holds (`w`, indexes
  // into the term's `lemmas` and `words`), so the card and a sheet's hint
  // name that word's traditional rendering, not the entry's for every mark.
  // A verse with none (or a chapter with no Greek file) carries no `w`, and
  // the entry's own words stand, as before.
  const greek = chapterVerseLemmas(bookKey, chapter);
  const marks = placed.map((m) => {
    const w = familyWordsIn(GLOSSARY_LEMMAS[m.id] ?? [], greek?.get(m.v));
    return w.length ? { ...m, w } : m;
  });
  const terms = {};
  for (const id of new Set(marks.map((m) => m.id))) {
    const e = entries.get(id);
    terms[id] = {
      traditional: e.traditional,
      greek: e.greek,
      title: e.litMenu,
      renderings: (renderings.get(id) ?? []).slice(0, 6),
      // The Greek words the entry governs, so the Study Desk's Greek tab can
      // say how this verse renders one. They stay in the page's own data,
      // never in the share-alike Greek files (STUDY-DESK.md, 1f).
      lemmas: GLOSSARY_LEMMAS[id] ?? [],
      // Each of those words' own [traditional, Greek in Latin letters], in
      // the same order (LEMMA_WORDS; term-words.mjs reads them).
      words: lemmaWords(id),
    };
  }
  return { marks, terms, unresolved };
}
