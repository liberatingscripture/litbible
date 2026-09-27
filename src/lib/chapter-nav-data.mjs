// src/lib/chapter-nav-data.mjs
//
// Build shell for chapter-nav.mjs: the reading sequence with today's drafts
// filled in from draft-chapters.mjs. Built once per build.

import { readingSequence, neighbours } from "./chapter-nav.mjs";
import { scanDraftChapters, scanDraftIntros } from "./draft-chapters.mjs";

let sequence = null;

function pages() {
  if (sequence) return sequence;
  const { noindexSlugs } = scanDraftChapters();
  const draftIntros = scanDraftIntros();
  sequence = readingSequence({
    isDraftChapter: (bookKey, chapter) => noindexSlugs.has(`${bookKey}-${chapter}`),
    isDraftIntro: (bookKey) => draftIntros.has(bookKey),
  });
  return sequence;
}

/** @param {number | "intro"} chapter */
export function navFor(bookKey, chapter) {
  return neighbours(pages(), bookKey, chapter);
}

export function isDraftIntro(bookKey) {
  return scanDraftIntros().has(bookKey);
}
