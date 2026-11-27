// src/lib/news.mjs
//
// News in the header (SITE-FEATHERBOA.md, "News in the header" and "Nothing
// interrupts the reader"; NX-26, NX-27, NX-29, HD-31, HD-32). Ordinary news
// is marked on the place it is about: a dot on the header menu that holds
// what changed, and "New" beside its row inside, both gone once the reader
// has opened that menu. A menu carrying a mark ends with "See what's new →,"
// to the What's New page. A launch is the announcement window's, not this
// list's (src/components/CLAUDE.md, "The announcement popover").
//
// The list is empty until there is news, and then the header draws nothing.
// An entry:
//
//   {
//     id: "sheets-share-2027-01", // unique and never reused: what a reader
//                                 // has seen is kept by id
//     place: "study",             // the menu it marks: "study," "learn," or
//                                 // "about" (Read has no menu)
//     row: "sheets",              // the row "New" stands beside, a row's key
//                                 // in src/lib/places.mjs
//     until: "2027-01-31",        // optional: the last day it shows
//   }
//
// A new article or episode marks Learn, a Study feature marks Study
// (NX-27), and an app update marks About's Apps row (HD-32). Text changes
// are Release Notes', never news (HD-28). What the news says is the What's
// New page's; this list only says where it is.
//
// BEFORE THE FIRST ENTRY: the What's New page must exist, since
// every marked menu links it, and /privacy must name SEEN_KEY, the one key
// the marks write. test/news.test.js fails on either until it is so.
//
// Pure: no DOM, no storage. src/scripts/header-menus.js does the reading
// and writing, and SiteHeader.astro draws the marks, hidden, from NEWS.

/** The news, newest first. Empty until there is some. */
export const NEWS = Object.freeze([]);

/** The What's New page, which every marked menu links. */
export const WHATS_NEW_HREF = "/whats-new";

/** Where a browser keeps the ids of the news its reader has seen: a JSON
 *  array, written only once NEWS holds an entry. */
export const SEEN_KEY = "lit-news-seen";

/** The places news may mark: the ones with a menu. */
export const NEWS_PLACES = Object.freeze(["study", "learn", "about"]);

/** A day as YYYY-MM-DD in the reader's own time, for `until`. */
export function dayOf(date = new Date()) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** The entries still showing on `day` (YYYY-MM-DD): those with no `until`,
 *  and those whose last day it hasn't passed. */
export function liveNews(news, day) {
  return news.filter((entry) => !entry.until || entry.until >= day);
}

/** The entries a reader hasn't seen, given the ids they have. */
export function unseen(news, seen) {
  const have = new Set(seen);
  return news.filter((entry) => !have.has(entry.id));
}

/** The places whose menus carry a mark, in the order news names them. */
export function markedPlaces(news, seen) {
  return [...new Set(unseen(news, seen).map((entry) => entry.place))];
}

/** The rows that say "New," as "place:row". */
export function markedRows(news, seen) {
  return [...new Set(unseen(news, seen).map((entry) => `${entry.place}:${entry.row}`))];
}

/**
 * What the reader has seen once they open `place`'s menu: what they had,
 * less any id no longer in the news (so the note never grows), and every
 * entry of that place.
 */
export function seenAfterOpening(news, seen, place) {
  const ids = new Set(news.map((entry) => entry.id));
  const kept = [...new Set(seen)].filter((id) => ids.has(id));
  for (const entry of news) if (entry.place === place && !kept.includes(entry.id)) kept.push(entry.id);
  return kept;
}

/** The stored note read back: an array of ids, or none for anything else. */
export function parseSeen(text) {
  if (typeof text !== "string" || text === "") return [];
  try {
    const value = JSON.parse(text);
    return Array.isArray(value) ? value.filter((id) => typeof id === "string") : [];
  } catch {
    return [];
  }
}

/** What is wrong with a list of news, given the places (src/lib/places.mjs):
 *  one sentence per problem, none for a good list. */
export function checkNews(news, places) {
  const problems = [];
  const ids = new Set();
  for (const entry of news) {
    const id = entry?.id;
    if (typeof id !== "string" || !/^[a-z0-9][a-z0-9-]*$/.test(id)) problems.push(`${JSON.stringify(id)} is not an id (lowercase letters, digits, and hyphens)`);
    else if (ids.has(id)) problems.push(`${id} is used twice`);
    else ids.add(id);
    if (!NEWS_PLACES.includes(entry?.place)) {
      problems.push(`${id}: ${JSON.stringify(entry?.place)} is not a place news may mark (${NEWS_PLACES.join(", ")})`);
      continue;
    }
    const place = places.find((p) => p.key === entry.place);
    if (!place?.rows.some((row) => row.key === entry.row && !row.also)) {
      problems.push(`${id}: ${JSON.stringify(entry.row)} is not a row of ${entry.place}`);
    }
    if (entry.until !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(entry.until)) {
      problems.push(`${id}: until is a day written YYYY-MM-DD`);
    }
    const extra = Object.keys(entry).filter((k) => !["id", "place", "row", "until"].includes(k));
    if (extra.length) problems.push(`${id}: ${extra.join(", ")} is not part of an entry`);
  }
  return problems;
}
