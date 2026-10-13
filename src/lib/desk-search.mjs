// src/lib/desk-search.mjs
//
// Searching the reader's own notebook from the site's search (STUDY-DESK.md,
// D2). Pure: the records
// come in as an array, hits go out as plain objects, and the DOM and the
// database are src/scripts/desk/notebook-search.js's.
//
// What matches, per kind of record:
//   note          the body, and the title of the entry or article it is on
//   highlight     the words highlighted
//   bookmark      its label
//   place         its name (a ribbon or a reading place)
//   footnotePin   the pinned footnote's text
//   anything      the names of the labels it carries
// A `hidden` record is never a result: its note is the reader's preparation
// for a hard passage, and a search box on a shared screen shouldn't read it
// out. A trash record is never a result either.
//
// Matching is by word beginning, with case and accents ignored (the same
// folding the verse search uses): "lib" finds "Liberation", and every word of
// the query has to be somewhere in the record or its labels. Results are in
// Bible order, then notes on the glossary, then notes on articles.

import { BOOK_ORDER } from "../data/books.js";
import { foldDiacritics } from "./word-stem.mjs";
import { kindName, recordHref, recordReference } from "./desk-store-core.mjs";

const WORD_RE = /[\p{L}\p{N}]+/gu;

const fold = (s) => foldDiacritics(String(s || "").toLowerCase());

/**
 * The words of a query, folded. A single letter is dropped when the query has
 * other words ("God’s reign" would otherwise need an "s" in every record).
 */
export function searchTokens(query) {
  const all = [...String(query || "").matchAll(WORD_RE)].map((m) => fold(m[0]));
  const longer = all.filter((t) => t.length > 1);
  return longer.length ? longer : all;
}

/** The words of a text with their places in it: [{ w (folded), start, end }]. */
function wordsOf(text) {
  return [...text.matchAll(WORD_RE)].map((m) => ({ w: fold(m[0]), start: m.index, end: m.index + m[0].length }));
}

const startsWithToken = (word, tokens) => tokens.some((t) => word.startsWith(t));

/**
 * A short piece of `text` around its first match, as parts to draw
 * ([{ text, mark }]): the matched words marked, the rest plain, with an
 * ellipsis where the text was cut. Built as parts, never HTML, because the
 * text is the reader's own words and is only ever drawn as text. Whitespace
 * is collapsed first (a note may run to several lines), so offsets index the
 * collapsed text. Null when no word of the text matches.
 */
export function snippetParts(text, tokens, { width = 100, lead = 28 } = {}) {
  const flat = String(text || "").replace(/\s+/g, " ").trim();
  const words = wordsOf(flat);
  const first = words.find((x) => startsWithToken(x.w, tokens));
  if (!first) return null;

  let from = Math.max(0, first.start - lead);
  // Begin at a word, not in the middle of one.
  if (from > 0) {
    const space = flat.indexOf(" ", from);
    from = space === -1 || space >= first.start ? first.start : space + 1;
  }
  let to = Math.min(flat.length, from + width);
  if (to < flat.length) {
    const space = flat.lastIndexOf(" ", to);
    to = space > first.end ? space : to;
  }

  const parts = [];
  let at = from;
  for (const x of words) {
    if (x.end <= from || x.start >= to || !startsWithToken(x.w, tokens)) continue;
    if (x.start > at) parts.push({ text: flat.slice(at, x.start), mark: false });
    parts.push({ text: flat.slice(x.start, Math.min(x.end, to)), mark: true });
    at = Math.min(x.end, to);
  }
  if (at < to) parts.push({ text: flat.slice(at, to), mark: false });
  if (from > 0) parts[0] = { ...parts[0], text: `…${parts[0].text}` };
  if (to < flat.length) parts[parts.length - 1] = { ...parts[parts.length - 1], text: `${parts[parts.length - 1].text}…` };
  return parts;
}

/** The pieces of text a record can be found by, in the order a snippet prefers them. */
function fieldsOf(record) {
  const quote = typeof record.quote?.exact === "string" ? record.quote.exact : "";
  switch (record.kind) {
    case "note":
      return [record.body, record.targetTitle];
    case "highlight":
      return [quote];
    case "bookmark":
      return [record.label];
    case "place":
      return [record.name];
    case "footnotePin":
      return [record.footnote];
    default:
      return [];
  }
}

/** What a reader calls this record in a result: a ribbon is not a "Place". */
function labelFor(record) {
  if (record.kind === "place" && record.ribbon) return "Ribbon";
  return kindName(record.kind);
}

const KIND_ORDER = ["note", "highlight", "bookmark", "place", "footnotePin"];
const bookIndex = (key) => {
  const i = BOOK_ORDER.indexOf(key);
  return i === -1 ? Infinity : i;
};

/**
 * Where a record sorts: on the text first (in Bible order), then notes on the
 * glossary, then notes on articles, then anything else.
 */
function sortKey(r) {
  const group = typeof r.glossaryEntry === "string" ? 1 : typeof r.article === "string" ? 2 : r.bookKey && r.chapter ? 0 : 3;
  return [
    group,
    group === 0 ? bookIndex(r.bookKey) : 0,
    group === 0 ? r.chapter ?? 0 : 0,
    group === 0 ? r.verse ?? 0 : 0,
    group === 1 || group === 2 ? String(r.targetTitle || r[group === 1 ? "glossaryEntry" : "article"]).toLowerCase() : "",
    Math.max(0, KIND_ORDER.indexOf(r.kind)),
    String(r.created ?? ""),
  ];
}

function compareKeys(a, b) {
  for (let i = 0; i < a.length; i++) {
    if (a[i] === b[i]) continue;
    return typeof a[i] === "string" ? a[i].localeCompare(b[i]) : a[i] - b[i];
  }
  return 0;
}

/**
 * The records that match a query, as results:
 * { id, kind, label (what to call its kind), reference ("Romans 8:3"), href
 * (or null), parts (the snippet) }. `bookKey` narrows to one book's records,
 * for the search box's book filter. An empty query finds nothing.
 */
export function searchNotebook(records, query, { bookKey = "" } = {}) {
  const tokens = searchTokens(query);
  if (!tokens.length) return [];

  const labelNames = new Map();
  for (const r of records) {
    if (r?.kind === "label" && typeof r.name === "string" && r.name) labelNames.set(r.id, r.name);
  }

  const found = [];
  for (const r of records) {
    if (!r || !KIND_ORDER.includes(r.kind)) continue;
    if (bookKey && r.bookKey !== bookKey) continue;

    const names = (Array.isArray(r.labels) ? r.labels : []).map((id) => labelNames.get(id)).filter(Boolean);
    const fields = fieldsOf(r).filter((f) => typeof f === "string" && f.trim());
    const pieces = [...fields, ...names];
    if (!pieces.length) continue;

    const words = pieces.flatMap((p) => wordsOf(p).map((x) => x.w));
    if (!tokens.every((t) => words.some((w) => w.startsWith(t)))) continue;

    // The snippet comes from the first field with a match; when only a label
    // matches, it is the labels, named as such.
    let parts = null;
    for (const f of fields) {
      parts = snippetParts(f, tokens);
      if (parts) break;
    }
    if (!parts) {
      const shown = snippetParts(names.join(", "), tokens);
      parts = shown ? [{ text: names.length > 1 ? "Labels: " : "Label: ", mark: false }, ...shown] : [];
    }

    found.push({
      sort: sortKey(r),
      hit: {
        id: r.id,
        kind: r.kind,
        label: labelFor(r),
        reference: recordReference(r) || (r.glossaryId ? `Glossary: ${r.glossaryId}` : labelFor(r)),
        href: recordHref(r) ?? (typeof r.glossaryId === "string" ? `/glossary/#${r.glossaryId}` : null),
        parts,
      },
    });
  }
  return found.sort((a, b) => compareKeys(a.sort, b.sort)).map((f) => f.hit);
}

/** The notebook page's address for a query (D2's "N more in your notebook"). */
export function notebookSearchHref(query) {
  const q = String(query || "").trim();
  return q ? `/notebook/?q=${encodeURIComponent(q)}` : "/notebook/";
}
