// src/scripts/greek-chapters.js
//
// The one loader for a chapter's Greek (public/greek/text/<book>-<chapter>.json).
// The Notebook's Greek tab (desk/greek-data.js) and the Greek search
// (search-greek.js) both read it, and used to keep a cache each, so a chapter
// on screen was fetched and parsed twice (Audit 2, GK-20). Each chapter is
// kept as a promise, so two askers share one request; a failed fetch is
// forgotten, so a retry asks again. A caller gets a rejected promise and
// decides what to say. Small on purpose: both of its callers load it lazily
// or with the desk, and it imports nothing.

const chapters = new Map();

/**
 * @param {string} base the site's base path ("/")
 * @param {string} book a book key
 * @param {number | string} chapter
 * @returns {Promise<object>} { paragraphs, lemmas, apparatus, ... }
 */
export function fetchGreekChapter(base, book, chapter) {
  const key = `${book}-${chapter}`;
  let p = chapters.get(key);
  if (!p) {
    p = fetch(`${base}greek/text/${key}.json`).then((res) => {
      if (!res.ok) throw new Error(`greek/text/${key}.json: ${res.status}`);
      return res.json();
    });
    chapters.set(key, p);
    p.catch(() => chapters.delete(key));
  }
  return p;
}
