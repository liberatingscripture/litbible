// How the release notes page and its RSS feed present release-notes.json.
//
// Pure and unit-tested (test/release-notes-view.test.js). The JSON is the
// apps' Translation Updates feed and does not change for any of this: the
// page reads the same `description` and `detail` strings the apps do, and
// only decides how to show them.

import { BOOK_ORDER, bookKeyToLabel } from "../data/books.js";

/* ── Entry ids ───────────────────────────────────────────────────────────── */

/**
 * One fragment id per entry, for links to it ("/release-notes/#2026-09-26").
 *
 * Usually the date. Two publishes on one day make two entries with the same
 * date (2026-04-12 has two), so the later ones get "-2", "-3". The count runs
 * from the OLDEST entry, because new entries are prepended: counting from the
 * top would renumber an existing entry the next time its day gained another.
 *
 * @param {{date: string}[]} entries newest first, as release-notes.json is
 * @returns {string[]} ids in the same order as `entries`
 */
export function entryIds(entries) {
  const seen = new Map();
  const ids = new Array(entries.length);
  for (let i = entries.length - 1; i >= 0; i--) {
    const date = entries[i].date;
    const n = (seen.get(date) ?? 0) + 1;
    seen.set(date, n);
    ids[i] = n === 1 ? date : `${date}-${n}`;
  }
  return ids;
}

/* ── Months ──────────────────────────────────────────────────────────────── */

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/**
 * Group entries by calendar month, newest month first, keeping each entry's id.
 * @template {{date: string, changes: unknown[]}} T
 * @param {T[]} entries newest first
 * @param {string[]} [ids] from `entryIds(entries)`
 * @returns {{key: string, label: string, count: number,
 *   entries: {entry: T, id: string}[]}[]}
 */
export function groupByMonth(entries, ids = entryIds(entries)) {
  const months = [];
  entries.forEach((entry, i) => {
    const key = entry.date.slice(0, 7);
    let month = months.at(-1);
    if (!month || month.key !== key) {
      const [y, m] = key.split("-");
      month = { key, label: `${MONTHS[Number(m) - 1]} ${y}`, count: 0, entries: [] };
      months.push(month);
    }
    month.entries.push({ entry, id: ids[i] });
    month.count += entry.changes.length;
  });
  return months;
}

/* ── Filters ─────────────────────────────────────────────────────────────── */

/** The kinds a reader can filter by, in the order the menu lists them. */
export const KINDS = [
  ["chapters", "New chapters"],
  ["wording", "Wording"],
  ["footnotes", "Footnotes"],
  ["intros", "Book introductions"],
  ["glossary", "Glossary"],
  ["articles", "Articles"],
];

const KIND_OF_TYPE = {
  chapter_added: "chapters",
  text_updated: "wording",
  footnote_added: "footnotes",
  footnote_updated: "footnotes",
  intro_updated: "intros",
  glossary_added: "glossary",
  glossary_updated: "glossary",
  article_added: "articles",
  article_updated: "articles",
};

/** The filter kind of a change type, or null (the old `metadata_updated`
 *  rows, which only "All changes" shows). */
export function changeKind(type) {
  return KIND_OF_TYPE[type] ?? null;
}

// Longest label first, so "1 John 4:10" is never read as John.
const BOOK_LABELS = BOOK_ORDER.map((key) => [bookKeyToLabel(key), key]).sort(
  (a, b) => b[0].length - a[0].length,
);

/**
 * The book a change belongs to, or null (glossary, articles, and the
 * collapsed "Metadata updated (6 chapters)" row).
 *
 * `location.bookKey` when the drafter wrote one. Older entries predate that
 * field, and intro and new-chapter rows never carry it, so otherwise the book
 * is read off the start of the description, which always leads with its
 * label ("Luke 20 added", "Romans Introduction updated").
 */
export function changeBook(change) {
  const key = change?.location?.bookKey;
  if (key && BOOK_ORDER.includes(key)) return key;
  const description = change?.description ?? "";
  for (const [label, key] of BOOK_LABELS) {
    if (!description.startsWith(label)) continue;
    const next = description.charAt(label.length);
    if (next === "" || next === " ") return key;
  }
  return null;
}

/* ── Details ─────────────────────────────────────────────────────────────── */

// One segment of a `detail` string, as release-notes-core.mjs writes it:
//   [prefix ": "] ( "old" → "new" | added "text" | removed "text"
//                 | minor formatting change )
// where the prefix is "v. 21", "fn. bb" or "fn. bb (v. 37)", and segments
// are joined with "; ". Older entries also end with the footnote relabel note
// ("footnotes formerly t–mm relabeled u–nn") before it moved to `relabel`.
//
// The quoted text is NOT free of straight quotes: the 2026-08 quote cleanup
// logged "old" sides like `""prophecy,""`. So a quotation ends at the first
// `"` that the grammar allows next (` → "`, the next segment, or the end),
// not at the first `"`.
const PREFIX = String.raw`v\. \d+|fn\. [a-z]+(?: \(v\. \d+\))?`;
const END = String.raw`(?=; (?:(?:${PREFIX}): |footnotes? formerly )|$)`;
const SEGMENT = new RegExp(
  String.raw`(?:(${PREFIX}): )?(?:` +
    String.raw`"([\s\S]*?)" → "([\s\S]*?)"${END}` +
    String.raw`|added "([\s\S]*?)"${END}` +
    String.raw`|removed "([\s\S]*?)"${END}` +
    String.raw`|(minor formatting change)${END}` +
    String.raw`|(footnotes? formerly [\s\S]*?)${END})`,
  "y",
);

/**
 * Parse a change's `detail` into its segments, or null when any part of it
 * doesn't follow the drafter's grammar (the page then shows it as plain text,
 * as it always has).
 *
 * @returns {null | {label: string|null,
 *   kind: "change"|"added"|"removed"|"formatting"|"relabel",
 *   old?: string, new?: string, text?: string}[]}
 */
export function parseDetail(detail) {
  if (typeof detail !== "string" || detail === "") return null;
  const segments = [];
  let i = 0;
  for (;;) {
    SEGMENT.lastIndex = i;
    const m = SEGMENT.exec(detail);
    if (!m || m[0] === "") return null;
    const label = m[1] ?? null;
    if (m[2] !== undefined) segments.push({ label, kind: "change", old: m[2], new: m[3] });
    else if (m[4] !== undefined) segments.push({ label, kind: "added", text: m[4] });
    else if (m[5] !== undefined) segments.push({ label, kind: "removed", text: m[5] });
    else if (m[6] !== undefined) segments.push({ label, kind: "formatting" });
    else if (label === null) segments.push({ label, kind: "relabel", text: m[7] });
    else return null;
    i = SEGMENT.lastIndex;
    if (i === detail.length) return segments;
    if (!detail.startsWith("; ", i)) return null;
    i += 2;
  }
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// A screen reader doesn't announce <del>/<ins> on its own, so each carries a
// word that says which it is. `sr-only` hides it on the page; a feed reader
// has no such class and shows it, which reads fine there too.
const removed = (text) =>
  `<del><span class="sr-only">Removed: </span>${escapeHtml(text)}</del>`;
const added = (text) =>
  `<ins><span class="sr-only">Added: </span>${escapeHtml(text)}</ins>`;

const sentence = (text) => text.charAt(0).toUpperCase() + text.slice(1);

/** The footnote relabel note ("footnotes formerly ee–nn relabeled ff–oo") as
 *  its own line. Newer entries carry it as `relabel`; older ones end their
 *  `detail` with it. */
export function renderRelabelHtml(text) {
  return `<span class="rn-diff rn-diff--note">${escapeHtml(sentence(text))}</span>`;
}

/**
 * A change's `detail` as HTML: old text struck through beside the new, one
 * line per verse or footnote. Falls back to the escaped string unchanged.
 * The page lays the segments out as lines with CSS; a feed reader has no CSS,
 * so the feed passes `joiner: "<br>"`.
 */
export function renderDetailHtml(detail, { joiner = "" } = {}) {
  const segments = parseDetail(detail);
  if (!segments) return escapeHtml(detail ?? "");
  return segments
    .map((s) => {
      if (s.kind === "relabel") return renderRelabelHtml(s.text);
      const label = s.label ? `<span class="rn-diff__label">${escapeHtml(s.label)}</span> ` : "";
      const body =
        s.kind === "change" ? `${removed(s.old)} ${added(s.new)}`
        : s.kind === "added" ? added(s.text)
        : s.kind === "removed" ? removed(s.text)
        : "minor formatting change";
      return `<span class="rn-diff">${label}${body}</span>`;
    })
    .join(joiner);
}
