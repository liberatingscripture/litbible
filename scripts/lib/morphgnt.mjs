// Reads a local MorphGNT/SBLGNT working copy so build-alignment.mjs can check
// its guesses against the Greek. USED AS A TOOL, NOT REPUBLISHED: the corpus is
// gitignored (see .gitignore), nothing from it is copied into src/ or public/,
// and the only thing that survives into committed data is a per-record verdict
// about OUR OWN text ("the lemma this record claims is / isn't in this verse").
//
//   git clone --depth 1 https://github.com/morphgnt/sblgnt.git .morphgnt
//
// Absent, everything degrades to `lemma: "unchecked"` and prior verdicts on
// disk are preserved — a machine without the clone must never silently
// downgrade the dataset.
//
// Line format is 7 whitespace-separated columns; we need the first (BBCCVV)
// and the last (lemma). BB is 01–27 in NT order, so it indexes BOOK_ORDER
// directly — the 61–87 numbering in the FILENAMES is a whole-Bible scheme and
// is deliberately not used.

import { promises as fs } from "node:fs";
import path from "node:path";
import { BOOK_ORDER } from "../../src/data/books.js";

/**
 * @returns {Promise<null | {
 *   lemmasByRef: Map<string, Set<string>>,   // "Rom.8.3" -> lemmas in that verse
 *   refsByLemma: Map<string, string[]>,      // lemma -> refs, canonical order
 *   verses: Set<string>,                     // every ref SBLGNT actually has
 *   lemmas: Set<string>,
 * }>}
 */
export async function loadMorphGnt(dir, osisByBookKey) {
  let files;
  try {
    files = (await fs.readdir(dir)).filter((f) => f.endsWith("-morphgnt.txt"));
  } catch {
    return null;
  }
  if (!files.length) return null;

  const lemmasByRef = new Map();
  const refsByLemma = new Map();
  const verses = new Set();
  const lemmas = new Set();

  for (const file of files.sort()) {
    const raw = await fs.readFile(path.join(dir, file), "utf8");
    for (const line of raw.split(/\r?\n/)) {
      if (!line.trim()) continue;
      const cols = line.trim().split(/\s+/);
      if (cols.length < 7) continue;
      const bcv = cols[0];
      const lemma = cols[cols.length - 1];

      const bookKey = BOOK_ORDER[Number(bcv.slice(0, 2)) - 1];
      const osis = bookKey && osisByBookKey[bookKey];
      if (!osis) continue;
      const ref = `${osis}.${Number(bcv.slice(2, 4))}.${Number(bcv.slice(4, 6))}`;

      verses.add(ref);
      lemmas.add(lemma);
      let set = lemmasByRef.get(ref);
      if (!set) lemmasByRef.set(ref, (set = new Set()));
      // refsByLemma stays deduped per verse; a lemma twice in one verse is
      // still one verse to review.
      if (!set.has(lemma)) {
        set.add(lemma);
        const refs = refsByLemma.get(lemma);
        if (refs) refs.push(ref);
        else refsByLemma.set(lemma, [ref]);
      }
    }
  }

  return { lemmasByRef, refsByLemma, verses, lemmas };
}
