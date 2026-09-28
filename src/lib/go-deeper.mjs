// "Go deeper" on a chapter page: the episodes, articles, key terms and book
// introduction that belong with it. Pure; go-deeper-data.ts is the shell that
// loads the podcast feed, the articles and the alignment gate.

const CHAPTER_HREF = /href="(?:https?:\/\/(?:www\.)?litbible\.net)?\/([0-9a-z]+)-(\d+)\/?(?:#[^"]*)?"/g;

/**
 * The chapters an article's rendered body links to: the render-time linker's
 * a.sref links and any written by hand. Book keys are checked by the caller.
 *
 * @param {string} html
 * @returns {string[]} "bookKey-chapter" keys, in first-link order
 */
export function chapterLinks(html) {
  const out = new Set();
  for (const m of String(html).matchAll(CHAPTER_HREF)) out.add(`${m[1]}-${Number(m[2])}`);
  return [...out];
}

/**
 * Index items by every chapter they name.
 *
 * @template T
 * @param {T[]} items  in the order a chapter should list them
 * @param {(item: T) => string[]} keysOf  "bookKey-chapter" keys
 * @returns {Map<string, T[]>}
 */
export function byChapter(items, keysOf) {
  const out = new Map();
  for (const item of items) {
    for (const key of new Set(keysOf(item))) {
      if (!out.has(key)) out.set(key, []);
      out.get(key).push(item);
    }
  }
  return out;
}

/**
 * The rows for one chapter. A kind with nothing to show gets no row, so the
 * section never prints an empty heading; with no rows at all it is omitted.
 *
 * Episodes and articles show the first few (`items`) and hold the rest back
 * (`more`) for a "N more" disclosure, so a well-covered chapter keeps a short
 * section without losing anything (owner, 2026-09-28). Key terms and the book
 * always show whole, so their `more` is empty.
 *
 * @param {{ episodes?: object[], articles?: object[], terms?: object[], intro?: object | null }} content
 * @param {{ episodes?: number, articles?: number }} [limits]
 * @returns {{ kind: string, label: string, items: object[], more: object[] }[]}
 */
export function goDeeperRows({ episodes = [], articles = [], terms = [], intro = null }, limits = {}) {
  const { episodes: maxEpisodes = 2, articles: maxArticles = 3 } = limits;
  const split = (/** @type {object[]} */ list, /** @type {number} */ max) => ({
    items: list.slice(0, max),
    more: list.slice(max),
  });
  const rows = [];
  if (episodes.length) rows.push({ kind: "listen", label: "Listen", ...split(episodes, maxEpisodes) });
  if (articles.length) rows.push({ kind: "read", label: "Read", ...split(articles, maxArticles) });
  if (terms.length) rows.push({ kind: "terms", label: "Key terms", items: terms, more: [] });
  if (intro) rows.push({ kind: "book", label: "Book", items: [intro], more: [] });
  return rows;
}
