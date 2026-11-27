// src/lib/places.mjs
//
// The four places (SITE-FEATHERBOA.md, "Four places: the header"): Read,
// Study, Learn, and About, each with the pages it lists, and which place a
// page is in. The header (SiteHeader.astro), the line under it
// (PlaceLine.astro), and the footer (SiteFooter.astro) all read this, so a
// page joins or leaves a place here and nowhere else. Pure: no DOM, no Astro.
// test/places.test.js holds every page under src/pages to an answer.
//
// - Read has no menu: the header's Read is a link to /read until Phase 4 has
//   it open the passage picker (FP-15). Its rows are the footer's Read group:
//   the books, and Release Notes, which sits at the foot of Read's picker as
//   well as under About (HD-29). Release Notes is About's page, so a row
//   listed in two places names its home with `also`.
// - Study's rows are the Study sidebar's places (HD-07), and "Help for study
//   tools" until Phase 9 moves it to the sidebar's foot (HD-09). Study shows
//   only on a computer with the Study preview on.
// - A page in no menu marks no place (HD-22): Home, Privacy, the Terms of
//   Use, the account pages, the 404 page, and Courses until a course opens
//   (HD-27). The line under the header names such a page alone.
// - A menu's names are the names of the pages they open (HD-23, BP-04),
//   never with "My."

import { BOOKS } from "../data/books.js";

/** The License page (BP-04, FP-18). The old addresses on /read forward to it. */
export const LICENSE_HREF = "/license";

/** Study's first page. A chapter or an introduction puts its own address
 *  here (?place=) in the header, so the header and the page agree. */
export const STUDY_HREF = "/desk/";

/**
 * A row of a place's menu and of its group in the footer.
 * @typedef {object} Row
 * @property {string} key
 * @property {string} label
 * @property {string} href
 * @property {boolean} [separate] set apart from the rows above by a line
 * @property {boolean} [also] another place's page, listed here too
 */

/**
 * A place.
 * @typedef {object} Place
 * @property {string} key
 * @property {string} label
 * @property {string} [href] where the header's link goes, for a place with no menu
 * @property {boolean} menu
 * @property {boolean} [study] shown only with the Study preview, on a computer
 * @property {readonly Row[]} rows
 */

/**
 * @template T
 * @param {T} value
 * @returns {T}
 */
function deepFreeze(value) {
  if (value && typeof value === "object") {
    for (const v of Object.values(value)) deepFreeze(v);
    Object.freeze(value);
  }
  return value;
}

/**
 * The four places, in the header's order. Each: `key`, `label`, `menu` (the
 * header opens a menu of its rows, or links straight to `href`), `study`
 * (shown only with the Study preview, on a computer), and `rows`, each
 * `{ key, label, href }`, with `separate` for a row set apart by a line and
 * `also` for a row whose page is another place's.
 * @type {readonly Place[]}
 */
export const PLACES = deepFreeze([
  {
    key: "read",
    label: "Read",
    href: "/read",
    menu: false,
    rows: [
      { key: "books", label: "Books", href: "/read" },
      { key: "release-notes", label: "Release Notes", href: "/release-notes", also: true },
    ],
  },
  {
    key: "study",
    label: "Study",
    href: STUDY_HREF,
    menu: true,
    study: true,
    rows: [
      { key: "scripture", label: "Scripture", href: STUDY_HREF },
      { key: "notebook", label: "Notebook", href: "/notebook/" },
      { key: "sheets", label: "Sheets", href: "/sheets/" },
      { key: "collections", label: "Collections", href: "/collections/" },
      { key: "help", label: "Help for study tools", href: "/desk/help/", separate: true },
    ],
  },
  {
    key: "learn",
    label: "Learn",
    menu: true,
    rows: [
      { key: "glossary", label: "Glossary", href: "/glossary" },
      { key: "articles", label: "Articles", href: "/articles" },
      { key: "podcast", label: "Podcast", href: "/found-in-translation-podcast" },
    ],
  },
  {
    key: "about",
    label: "About",
    menu: true,
    rows: [
      { key: "lit", label: "The LIT", href: "/about" },
      { key: "commitments", label: "Commitments", href: "/translation-commitments" },
      { key: "license", label: "License", href: LICENSE_HREF },
      { key: "collective", label: "The Collective", href: "/liberating-scripture-collective" },
      { key: "apps", label: "Apps", href: "/apps" },
      { key: "release-notes", label: "Release Notes", href: "/release-notes" },
      { key: "support", label: "Support", href: "/support" },
      { key: "contact", label: "Contact", href: "/contact" },
    ],
  },
]);

/**
 * The pages under the footer's groups, after them: the two in no place.
 * @type {readonly Row[]}
 */
export const LEGAL = deepFreeze([
  { key: "privacy", label: "Privacy", href: "/privacy" },
  { key: "terms", label: "Terms of Use", href: "/terms" },
]);

/**
 * Pages in no menu, by path: the name the line under the header gives each,
 * and for a page inside another (a thank-you page, a step of the account),
 * that page's address, so the name leads back to it. /search, /app-support,
 * /unsubscribe, and the thank-you pages are in no menu either; the record
 * doesn't place them (the queue's entry says so).
 */
const NO_PLACE = deepFreeze({
  "/privacy": { name: "Privacy" },
  "/terms": { name: "Terms of Use" },
  "/account": { name: "Account" },
  "/account/connect": { name: "Account", up: "/account/" },
  "/delete-account": { name: "Delete account" },
  "/404": { name: "Page not found" },
  "/courses": { name: "Courses" },
  "/search": { name: "Search" },
  "/app-support": { name: "App support" },
  "/app-support/thanks": { name: "App support", up: "/app-support" },
  "/unsubscribe": { name: "Unsubscribe" },
  "/colophon": { name: "How this site is made" },
});

/** Pages inside a place's row: the row they belong to, which the line names
 *  as a link back to it. An article is under Articles. */
const INSIDE = deepFreeze([
  { pattern: /^\/articles\/.+$/, place: "learn", row: "articles" },
  { pattern: /^\/contact\/thanks$/, place: "about", row: "contact" },
]);

/** A path as the site serves it: no query or fragment, no index.html, and
 *  no trailing slash (but the root's). */
export function normalizePath(path) {
  let p = String(path ?? "/").split(/[?#]/)[0] || "/";
  p = p.replace(/\/index\.html$/, "/").replace(/\.html$/, "");
  if (p.length > 1) p = p.replace(/\/+$/, "");
  return p || "/";
}

/** The book key of a chapter (/john-3), an introduction (/john-intro), or
 *  Read View (/read/john), or null: the Read page. */
export function readPageBook(path) {
  const p = normalizePath(path);
  let m = /^\/([a-z0-9]+)-(\d+)$/.exec(p);
  if (m && BOOKS[m[1]] && Number(m[2]) >= 1 && Number(m[2]) <= BOOKS[m[1]]) return m[1];
  m = /^\/([a-z0-9]+)-intro$/.exec(p);
  if (m && BOOKS[m[1]]) return m[1];
  m = /^\/read\/([a-z0-9]+)$/.exec(p);
  if (m && BOOKS[m[1]]) return m[1];
  return null;
}

/**
 * A place by its key.
 * @param {string} key
 * @returns {Place | null}
 */
export function placeBy(key) {
  return PLACES.find((place) => place.key === key) ?? null;
}

/**
 * A row of a place by their keys.
 * @param {string} placeKey
 * @param {string} rowKey
 * @returns {Row | null}
 */
export function rowOf(placeKey, rowKey) {
  return placeBy(placeKey)?.rows.find((row) => row.key === rowKey) ?? null;
}

/**
 * Where a page is, for the header, the line under it, and the footer:
 *
 * - `place`: the place's key, underlined in the header, or null for a page
 *   in no place (HD-22);
 * - `row`: the key of the row the page is, or is inside, in that place;
 * - `current`: "page" where the page is that row's own page, "true" where it
 *   is inside it (an article, under Articles), for aria-current;
 * - `name`: what the line under the header calls the page;
 * - `up`: where that name links, for a page inside another, or null;
 * - `line`: whether the line shows (never on Home, the Read page, or
 *   Study's pages, whose title row is their line in Phase 9);
 * - `readPage`: a chapter, an introduction, or Read View, which has no
 *   header magnifier (HD-13);
 * - `home`: the front page.
 *
 * @param {string} path
 * @returns {{ place: string | null, row: string | null,
 *   current: "page" | "true" | null, name: string | null, up: string | null,
 *   line: boolean, readPage: boolean, home: boolean }}
 */
export function placeOf(path) {
  const p = normalizePath(path);
  const where = { place: null, row: null, current: null, name: null, up: null, line: false, readPage: false, home: false };
  if (p === "/") return { ...where, home: true };
  if (readPageBook(p)) return { ...where, place: "read", readPage: true };

  for (const place of PLACES) {
    for (const row of place.rows) {
      if (row.also || normalizePath(row.href) !== p) continue;
      return {
        ...where,
        place: place.key,
        row: row.key,
        current: "page",
        name: row.label,
        // Study's pages have no line until Phase 9 makes their title row it.
        line: !place.study,
      };
    }
  }
  for (const inside of INSIDE) {
    if (!inside.pattern.test(p)) continue;
    const row = rowOf(inside.place, inside.row);
    return { ...where, place: inside.place, row: row.key, current: "true", name: row.label, up: row.href, line: true };
  }
  const alone = NO_PLACE[p];
  if (alone) return { ...where, name: alone.name, up: alone.up ?? null, line: true };
  return where;
}
