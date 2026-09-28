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
import { splitChapterVerses } from "../../scripts/lib/verse-text.mjs";

function resolveAlignmentDir() {
  const fromCwd = path.resolve(process.cwd(), "src/data/alignment");
  if (existsSync(fromCwd)) return fromCwd;
  return fileURLToPath(new URL("../data/alignment", import.meta.url));
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
  const { marks, unresolved } = chapterMarks(occurrences, splitChapterVerses(paragraphs));
  const terms = {};
  for (const id of new Set(marks.map((m) => m.id))) {
    const e = entries.get(id);
    terms[id] = {
      traditional: e.traditional,
      greek: e.greek,
      title: e.litMenu,
      renderings: (renderings.get(id) ?? []).slice(0, 6),
    };
  }
  return { marks, terms, unresolved };
}
