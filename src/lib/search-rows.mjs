// src/lib/search-rows.mjs
//
// The rows of search, drawn once for the three places that show them: /search,
// the results under a reading page's Search (the place line, and the phone's
// top row), and the header's magnifier (SITE-FEATHERBOA.md, "Search," "The
// same rows everywhere"; SE-31). The tray (searchbar.js) and the page
// (search.js) each find what matched; this file draws it, so a verse looks the
// same wherever it comes up.
//
// What it draws:
// - the row of tabs, each with its count (renderTabs) and which one a search
//   opens on (openingTab);
// - a verse as reading: the reference, then the verse in the book face with
//   the matched word bold and underlined (verseRowHtml), under a book's name
//   only in Bible order (bookHeadingHtml);
// - a chapter, a glossary entry, an article, or an introduction as a title row
//   (titleRowHtml);
// - the answers that come first: the reference's rows (referenceRowsHtml),
//   the one line for the chapters, and the one for the glossary.
//
// It is plain strings and a little DOM, with no search logic and no fetching.
// Anything it is given as `html` is already escaped by the caller (the verse
// index's highlightVerseHit, Pagefind's excerpt); everything else it escapes.

import { BOOKS } from "../data/books.js";

/* ── The tabs ───────────────────────────────────────────────────────── */

/**
 * The tabs in their order. `mode` is the address's `mode` for the tab (the
 * page and the tray keep the tab there), `needs` is what must be on for the
 * tab to show: "desk" is the Study preview (the reader's own notebook), and
 * "greek" is where the Greek search runs (the same switch).
 */
export const TABS = [
  { id: "keyword", mode: "keyword", label: "Scripture" },
  { id: "subject", mode: "subject", label: "Chapters about it" },
  { id: "glossary", mode: "glossary", label: "Glossary" },
  { id: "article", mode: "article", label: "Articles" },
  { id: "intro", mode: "intro", label: "Introductions" },
  { id: "notebook", mode: "notebook", label: "Notebook", needs: "desk" },
  { id: "greek", mode: "greek", label: "Greek", needs: "greek" },
];

/** The tabs a page shows: the notebook's with the Study preview, the Greek's where it is searched. */
export function visibleTabs({ desk = false, greek = false } = {}) {
  return TABS.filter((t) => !t.needs || (t.needs === "desk" ? desk : greek));
}

/** The tab id for an address's `mode` ("all" and anything unknown: null, meaning "open on the first with results"). */
export function tabForMode(mode) {
  return TABS.find((t) => t.mode === mode)?.id ?? null;
}

/** The address's `mode` for a tab id ("all" for none). */
export function modeForTab(id) {
  return TABS.find((t) => t.id === id)?.mode ?? "all";
}

/**
 * The tab a search opens on when the reader hasn't chosen one: Scripture, or
 * the first tab with results when Scripture has none ("Search"; SE-08). The
 * Greek has no count to read here, so it is never the first.
 *
 * @param {Record<string, number>} counts  tab id -> its count
 */
export function openingTab(counts) {
  for (const tab of TABS) {
    if (tab.id !== "greek" && (counts[tab.id] ?? 0) > 0) return tab.id;
  }
  return "keyword";
}

/** "75 results" (or "1 result"), the count at the field's end. */
export function resultsCount(n) {
  return `${n.toLocaleString("en-US")} ${n === 1 ? "result" : "results"}`;
}

/**
 * Draws the row of tabs into `host` (a role="tablist" element), replacing what
 * is in it. A tab with no results reads 0 and is dimmed, and still opens. The
 * row is one tab stop, moved by the arrow keys, Home and End.
 *
 * @param {HTMLElement} host
 * @param {{ tabs: typeof TABS, counts: Record<string, number|null>, active: string,
 *   onPick: (id: string) => void, idPrefix?: string }} options
 *   `counts[id]` of null or undefined draws the tab with no number (the Greek's,
 *   which is searched only when it is chosen).
 */
export function renderTabs(host, { tabs, counts, active, onPick, idPrefix = "tab" }) {
  const doc = host.ownerDocument;
  host.replaceChildren();
  host.setAttribute("role", "tablist");
  const buttons = [];
  for (const tab of tabs) {
    const n = counts[tab.id];
    const b = doc.createElement("button");
    b.type = "button";
    b.id = `${idPrefix}-${tab.id}`;
    b.className = "kit-tab search-tab";
    b.dataset.tab = tab.id;
    b.setAttribute("role", "tab");
    const on = tab.id === active;
    b.setAttribute("aria-selected", on ? "true" : "false");
    b.tabIndex = on ? 0 : -1;
    b.append(tab.label);
    if (typeof n === "number") {
      const count = doc.createElement("span");
      count.className = "search-tab__count";
      count.textContent = n.toLocaleString("en-US");
      b.append(" ", count);
      // "Scripture, 75 results" is what a screen reader hears, with no stray digits.
      b.setAttribute("aria-label", `${tab.label}, ${n === 0 ? "no results" : resultsCount(n)}`);
      if (n === 0) b.classList.add("kit-tab--none");
    }
    b.addEventListener("click", () => onPick(tab.id));
    buttons.push(b);
    host.append(b);
  }
  host.onkeydown = (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const at = buttons.indexOf(doc.activeElement);
    if (at < 0) return;
    const next =
      e.key === "ArrowRight" ? (at + 1) % buttons.length
      : e.key === "ArrowLeft" ? (at - 1 + buttons.length) % buttons.length
      : e.key === "Home" ? 0
      : e.key === "End" ? buttons.length - 1
      : -1;
    if (next < 0) return;
    e.preventDefault();
    buttons[at].tabIndex = -1;
    buttons[next].tabIndex = 0;
    buttons[next].focus();
  };
  return buttons;
}

/* ── Escaping ───────────────────────────────────────────────────────── */

const ESC = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ESC[c]);

/* ── The rows ───────────────────────────────────────────────────────── */

/**
 * A verse, as reading: "John 3:16" above the verse in the book face, the matched
 * word in <mark> (bold with a green underline, never a highlight: yellow
 * means "yours").
 *
 * @param {{ label: string, href: string, html: string, ref?: { bookKey: string, chapter: number, verse: number },
 *   pick?: boolean }} row
 *   `html` is the verse's escaped text with its matches in <mark>. `pick` adds
 *   Select's box (the page's Select; the tray never has it).
 */
export function verseRowHtml({ label, href, html, ref = null, pick = false }) {
  const box = pick && ref
    ? `<input type="checkbox" class="kit-check search-row__pick" data-pick="${esc(`${ref.bookKey} ${ref.chapter}:${ref.verse}`)}" aria-label="Choose ${esc(label)}" />`
    : "";
  return `<li class="search-row search-row--verse">${box}<a class="search-row__link" href="${esc(href)}"><span class="search-row__ref">${esc(label)}</span> <span class="search-row__text">${html}</span></a></li>`;
}

/** A book's name over the verses of it, in Bible order only (SE-12). */
export function bookHeadingHtml(label) {
  return `<li class="search-heading"><h3 class="search-heading__title">${esc(label)}</h3></li>`;
}

/**
 * A chapter, glossary entry, article, introduction, or notebook match: its
 * title, what matched after it, and its excerpt (Pagefind's, with its matches
 * in <mark>).
 *
 * @param {{ title: string, href: string, aside?: string, excerptHtml?: string,
 *   ref?: { bookKey: string, chapter: number }, pick?: boolean }} row
 */
export function titleRowHtml({ title, href, aside = "", excerptHtml = "", ref = null, pick = false }) {
  const box = pick && ref
    ? `<input type="checkbox" class="kit-check search-row__pick" data-pick="${esc(`${ref.bookKey} ${ref.chapter}`)}" aria-label="Choose ${esc(title)}" />`
    : "";
  return `<li class="search-row search-row--title">${box}<a class="search-row__link" href="${esc(href)}"><span class="search-row__title">${esc(title)}</span>${aside ? `<span class="search-row__aside"> · ${esc(aside)}</span>` : ""}${excerptHtml ? `<span class="search-row__excerpt">${excerptHtml}</span>` : ""}</a></li>`;
}

/**
 * The verses of one page as rows. In Bible order a book's name stands over its
 * verses; under Relevance each verse stands with its reference alone.
 *
 * @param {Array<{ bookKey: string, bookLabel: string, label: string, href: string, html: string,
 *   ref?: { bookKey: string, chapter: number, verse: number } }>} verses
 * @param {{ bibleOrder: boolean, pick?: boolean }} options
 */
export function verseRowsHtml(verses, { bibleOrder, pick = false }) {
  let out = "";
  let book = null;
  for (const v of verses) {
    if (bibleOrder && v.bookKey !== book) {
      book = v.bookKey;
      out += bookHeadingHtml(v.bookLabel);
    }
    out += verseRowHtml({ ...v, pick });
  }
  return out;
}

/* ── The answers that come first ────────────────────────────────────── */

/**
 * Where "Study John 3:16" goes: the Study desk at the passage, with the
 * reader's own layout kept (RP-45; desk-passage.mjs's deskPlaceHref, written
 * out because shared reader code never imports desk code). A book opens at its
 * chapter 1, and so does a chapter the book lacks; a range opens at its first
 * verse. Null for a book's introduction, which no pane shows (E173).
 *
 * @param {{ kind?: string, bookKey: string, chapter?: number, verse?: number|null, intro?: boolean }} jump
 */
export function studyHrefFor(jump) {
  if (jump.kind === "book" && jump.intro === true) return null;
  const real = jump.kind !== "book" && jump.chapter <= (BOOKS[jump.bookKey] || 0);
  const at = real ? `${jump.chapter}${jump.verse ? `:${jump.verse}` : ""}` : "1";
  return `/desk/?place=${jump.bookKey}-${at}`;
}

/**
 * The first rows when a reference is typed (SE-17, ST-15): "Go to John 3:16,"
 * and with the Study preview "Study John 3:16." A book's introduction has only
 * the first.
 *
 * @param {{ label: string, goHref: string, studyHref: string|null, intro?: boolean }} answer
 * @param {{ desk: boolean }} options
 */
export function referenceRowsHtml({ label, goHref, studyHref, intro = false }, { desk }) {
  const go = `<a class="kit-row search-answer__link" href="${esc(goHref)}" data-answer="go"><span>Go to <strong>${esc(label)}</strong></span></a>`;
  const study = desk && studyHref && !intro
    ? `<a class="kit-row search-answer__link" href="${esc(studyHref)}" data-answer="study"><span>Study <strong>${esc(label)}</strong></span></a>`
    : "";
  return `${go}${study}`;
}

/**
 * Over the verses, one line for the chapters (SE-20): "John 1 is one of 6
 * chapters about light," with "See all 6 →" for the tab. One chapter reads
 * "John 1 is a chapter about light."
 *
 * @param {{ first: string, count: number, query: string, href?: string }} line
 *   `href` is where "See all" goes (the tray: /search on the tab); on the page it is "#" and a script takes it.
 * @returns {string} the sentence (escaped), then the link's words
 */
export function chaptersLineHtml({ first, count, query, href = "#" }) {
  const lead = count === 1
    ? `${esc(first)} is a chapter about ${esc(query)}.`
    : `${esc(first)} is one of ${count.toLocaleString("en-US")} chapters about ${esc(query)}.`;
  return count === 1 ? lead : `${lead} <a class="kit-inline search-line__go" href="${esc(href)}" data-line-tab="subject">See all ${count.toLocaleString("en-US")} →</a>`;
}

/**
 * The word a glossary line names, or null: the line is for a glossary term
 * that matches what was typed (SE-21), not for an entry that only uses the
 * word in its prose. The query must be one of the entry's own words, its
 * traditional word, one of its LIT words, or its transliteration, and is named
 * as the entry writes it: "trust" in "trust / faithfulness" gives "Trust,"
 * "faith" gives "Faith," "pistis" gives "Pistis."
 *
 * @param {string} query what the reader typed
 * @param {{ traditional?: string, lit?: string, greek?: string } | null | undefined} entry
 * @returns {string | null}
 */
export function glossaryLineTerm(query, entry) {
  if (!entry) return null;
  const q = String(query || "").replace(/["“”]/g, "").trim().toLowerCase();
  if (!q) return null;
  const names = [entry.traditional, ...String(entry.lit || "").split(/\s*[/,]\s*/), entry.greek]
    .map((s) => String(s || "").trim())
    .filter(Boolean);
  const hit = names.find((s) => s.toLowerCase() === q);
  return hit ? hit.charAt(0).toUpperCase() + hit.slice(1) : null;
}

/**
 * The entries a glossary line names, in the term map's order: each whose own
 * word is what was typed (glossaryLineTerm), with the address of its place on
 * /glossary. Read from the map SearchBar embeds in every page ({ id:
 * { traditional, lit, greek } }), never from search results: Pagefind indexes
 * /glossary as one page and names its entries only as sub-results, so a
 * result's own address never says which entry it is.
 *
 * @param {string} query what the reader typed
 * @param {Record<string, { traditional?: string, lit?: string, greek?: string }> | null | undefined} terms
 * @param {string} [basePath] the site's base, "/" by default
 * @returns {{ id: string, term: string, href: string }[]}
 */
export function glossaryLineEntries(query, terms, basePath = "/") {
  const out = [];
  for (const [id, entry] of Object.entries(terms || {})) {
    const term = glossaryLineTerm(query, entry);
    if (term) out.push({ id, term, href: `${basePath.replace(/\/?$/, "/")}glossary/#${encodeURIComponent(id)}` });
  }
  return out;
}

/**
 * Over the verses, one line for a glossary term that matched (SE-21): "Trust is
 * in the glossary →," a link to the entry. With more than one match the others
 * wait in the tab: "Trust and 2 more are in the glossary →."
 *
 * @param {{ term: string, href: string, count: number }} line
 */
export function glossaryLineHtml({ term, href, count }) {
  const name = term.charAt(0).toUpperCase() + term.slice(1);
  const words = count > 1
    ? `${esc(name)} and ${count - 1} more are in the glossary`
    : `${esc(name)} is in the glossary`;
  return `<a class="kit-inline search-line__go" href="${esc(href)}">${words} →</a>`;
}

/** The address of /search for a query on a tab: `?q=…&mode=…&book=…` (the same tab, SE-32). */
export function seeAllHref(basePath, { q, mode = "all", book = "" }) {
  const params = new URLSearchParams();
  params.set("q", q);
  if (mode && mode !== "all") params.set("mode", mode);
  if (book) params.set("book", book);
  return `${basePath.replace(/\/?$/, "/")}?${params}`;
}
