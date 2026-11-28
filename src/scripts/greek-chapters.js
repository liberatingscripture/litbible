// src/scripts/greek-chapters.js
//
// The one loader for a chapter's Greek (public/greek/text/<book>-<chapter>.json).
// Study's Greek pane and This verse (desk/greek-data.js) and the Greek search
// (search-greek.js) both read it, and used to keep a cache each, so a chapter
// on screen was fetched and parsed twice (Audit 2, GK-20). Each chapter is
// kept as a promise, so two askers share one request; a failed fetch is
// forgotten, so a retry asks again. A caller gets a rejected promise and
// decides what to say. Small on purpose: both of its callers load it lazily
// or with the desk, and it imports nothing.
//
// `fresh` starts a new request even while one is pending: the Greek tab's
// Try again, when a request has stalled (E133). The stalled one is left to
// settle by itself, and its failure never forgets the newer one.

const chapters = new Map();

/**
 * @param {string} base the site's base path ("/")
 * @param {string} book a book key
 * @param {number | string} chapter
 * @param {{ fresh?: boolean }} [opts]
 * @returns {Promise<object>} { paragraphs, lemmas, apparatus, ... }
 */
export function fetchGreekChapter(base, book, chapter, { fresh = false } = {}) {
  const key = `${book}-${chapter}`;
  let p = fresh ? null : chapters.get(key);
  if (!p) {
    p = fetch(`${base}greek/text/${key}.json`).then((res) => {
      if (!res.ok) throw new Error(`greek/text/${key}.json: ${res.status}`);
      return res.json();
    });
    const mine = p;
    chapters.set(key, mine);
    mine.catch(() => {
      if (chapters.get(key) === mine) chapters.delete(key);
    });
  }
  return p;
}
