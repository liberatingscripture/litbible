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
//   place         its name (a reading place another client kept)
//   footnotePin   the pinned footnote's text
//   anything      the names of the labels it carries
// A `hidden` record is never a result: its note is the reader's preparation
// for a hard passage, and a search box on a shared screen shouldn't read it
// out. A trash record is never a result either.
//
// Matching is by word beginning, with case and accents ignored (the same
// folding the verse search uses, and a final ς read as σ): "lib" finds
// "Liberation", and every word of the query has to be somewhere in the record
// or its labels. Results are in Bible order, then notes on the glossary, then
// notes on articles.

import { BOOK_ORDER } from "../data/books.js";
import { foldDiacritics } from "./word-stem.mjs";
import { kindName, recordHref, recordReference } from "./desk-store-core.mjs";

// Combining marks belong to the word, so a note typed in NFD (an accent as a
// mark of its own) is one word, as its NFC twin is (GK-5).
const WORD_RE = /[\p{L}\p{N}\p{M}]+/gu;

// A final sigma is a sigma (BA40): "πιστισ" typed with σ finds "πίστις", and so
// does a lunate ϲ; Hebrew points and cantillation (U+0591 to U+05C7) fall away
// as accents do.
const fold = (s) =>
  foldDiacritics(String(s || "").toLowerCase())
    .replace(/[֑-ׇ]/g, "")
    .replace(/[ςϲ]/g, "σ");

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
      return [record.body, record.targetTitle, record.footnote];
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

/** What a reader calls this record in a result. */
function labelFor(record) {
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
        // A bookmark's result says whether it moves, as its row does (BVJ,
        // 2026-11-04), since opening it from here starts or stops following.
        label: r.kind === "bookmark" ? `${labelFor(r)} · ${r.follow === true ? "Moves" : "Stays put"}` : labelFor(r),
        reference: recordReference(r) || (r.glossaryId ? `Glossary: ${r.glossaryId}` : labelFor(r)),
        href: recordHref(r) ?? (typeof r.glossaryId === "string" ? `/glossary/#${r.glossaryId}` : null),
        // A bookmark's result opens it like its row does (follow or stop): see
        // desk/notebook-search.js.
        ...(r.kind === "bookmark" ? { bookKey: r.bookKey, follow: r.follow === true } : {}),
        parts,
      },
    });
  }
  return found.sort((a, b) => compareKeys(a.sort, b.sort)).map((f) => f.hit);
}

const MATCH_NOUNS = {
  note: ["note match", "note matches"],
  highlight: ["highlight match", "highlight matches"],
  bookmark: ["bookmark match", "bookmark matches"],
  footnotePin: ["pinned footnote match", "pinned footnote matches"],
};

/**
 * What to call the notebook matches in a count ("1 bookmark match"): the kind's
 * own word when every hit is of one kind (BVJ, 2026-11-04), else "notebook
 * match". Returns [one, many].
 */
export function matchNouns(hits) {
  const kinds = new Set((hits ?? []).map((h) => h.kind));
  if (kinds.size === 1) {
    const nouns = MATCH_NOUNS[[...kinds][0]];
    if (nouns) return nouns;
  }
  return ["notebook match", "notebook matches"];
}

/**
 * The notebook group's heading above its matches: "Bookmark labels" when every
 * hit is a bookmark (a bookmark is found by its name; BVJ, 2026-11-04), else
 * "Your notebook".
 */
export function matchTitle(hits) {
  return hits?.length && hits.every((h) => h.kind === "bookmark") ? "Bookmark labels" : "Your notebook";
}

/** The notebook page's address for a query (D2's "N more in your notebook"). */
export function notebookSearchHref(query) {
  const q = String(query || "").trim();
  return q ? `/notebook/?q=${encodeURIComponent(q)}` : "/notebook/";
}
