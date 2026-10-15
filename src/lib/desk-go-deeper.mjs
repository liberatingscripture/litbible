// src/lib/desk-go-deeper.mjs
//
// A "Your notes here" row for Go deeper (STUDY-DESK.md M10): under a chapter,
// the reader's own notes that belong with it. Pure: the notebook and what Go
// deeper lists in, a list of items out; src/scripts/desk/go-deeper-notes.js
// reads the page and draws the row.
//
// Three kinds of note belong with a chapter:
//   - a note on a glossary entry Go deeper lists under Key terms,
//   - a note on an article it lists under Read,
//   - a note elsewhere whose body cites this chapter (N4's chains, through
//     notesCiting), which is how a note on Romans 4:7 that says "see John 3"
//     turns up under John 3.
// A note on a book introduction would belong too, but the format has no such
// note (a note's targets are verses, glossary entries and articles), so
// there is nothing to look for. Nothing here writes a record.

import { notesCiting } from "./desk-chains.mjs";
import { forProse, liveRecords, recordHref, recordReference } from "./desk-store-core.mjs";

/** An excerpt keeps about this much of a note, cut at a word. */
export const EXCERPT_CHARS = 110;

/**
 * A note's body for a line of a list: whitespace collapsed, cut at a word
 * with an ellipsis when it runs long. Plain text; "" for a marker with no
 * words.
 */
export function excerpt(body, max = EXCERPT_CHARS) {
  const text = String(body ?? "").replace(/\s+/g, " ").trim();
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const word = cut.replace(/\s+\S*$/, "");
  return `${(word.length > max / 2 ? word : cut).replace(/[\s,;:.\-–—]+$/, "")}…`;
}

/** What a note on an entry or an article calls its target in a sentence. */
function proseTitle(record) {
  return record.targetTitle || record.glossaryEntry || record.article || "";
}

/**
 * @typedef {object} NotesHereItem
 * @property {string} id the note's id
 * @property {"term" | "article" | "cites"} kind
 * @property {string} subject "My note on Flesh"
 * @property {string} excerpt the start of the note's words, as text
 * @property {string} href where the note is
 * @property {object} record
 */

/**
 * The reader's notes that belong with a chapter's Go deeper, each once: terms
 * first, in Go deeper's order, then articles, then notes that cite the
 * chapter, in Bible order.
 *
 * @param {object[]} records the notebook
 * @param {{
 *   bookKey: string, chapter: number,
 *   terms?: { id: string, label: string, href: string }[],
 *   articles?: { slug: string, title: string, href: string }[],
 *   renamed?: Record<string, string>,
 * }} where `terms` and `articles` are what Go deeper lists; `renamed` maps
 *   an article's old slug to its new one (src/data/article-slugs.json)
 * @returns {NotesHereItem[]}
 */
export function notesHere(notebook, { bookKey, chapter, terms = [], articles = [], renamed = {} }) {
  const records = notebook ?? [];
  const seen = new Set();
  const out = [];
  const add = (record, kind, subject, href) => {
    if (seen.has(record.id)) return;
    seen.add(record.id);
    out.push({ id: record.id, kind, subject, excerpt: excerpt(record.body), href, record });
  };

  for (const term of terms) {
    for (const r of forProse(records, "glossaryEntry", term.id)) add(r, "term", `My note on ${term.label}`, term.href);
  }
  for (const article of articles) {
    for (const r of forProse(records, "article", article.slug, renamed)) {
      add(r, "article", `My note on “${article.title || proseTitle(r)}”`, article.href);
    }
  }
  const citing = notesCiting(records, { bookKey, chapter, verse: null }).map((c) => c.record);
  for (const r of liveRecords(citing)) {
    const on = r.glossaryEntry || r.article ? `“${proseTitle(r)}”` : recordReference(r);
    add(r, "cites", `My note on ${on} mentions this chapter`, recordHref(r) ?? "");
  }
  return out.filter((item) => item.href);
}
