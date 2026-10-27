// src/lib/desk-chains.mjs
//
// Your own chains (STUDY-DESK.md N4, phase 2a): a scripture reference the
// reader types in a note becomes a link with a preview, through the same
// linker the footnotes use (src/lib/scripture-refs.mjs), and the verse it
// cites can say "Mentioned in your note on Romans 8:3–4." Pure: a note's body
// in, HTML or a list of cited verses out. Nothing is written to a record; the
// links are worked out each time a note is drawn, so a chain costs the
// notebook nothing and goes away cleanly if the feature does.
//
// Two rules:
//   - The body is the reader's own words, so it is escaped first and only
//     then linked. The linker reads text nodes and writes only <a> tags, so
//     nothing the reader typed can become markup.
//   - A chain is read off the links the linker writes (`a.sref` hrefs), never
//     re-parsed separately, so what is underlined and what counts as a
//     mention can't disagree. The Hebrew Bible and apocrypha link out
//     (Sefaria, eBible.org) and are not chains: only the LIT's verses are.
//
// The browser has no chapter files to ask whether a verse exists, so the
// linker's defaults stand: every verse is taken to exist (a gap like
// Matthew 17:21 lands on its chapter page, which is harmless).

import { linkScriptureRefs } from "./scripture-refs.mjs";
import { openExternalLinks } from "./external-links.mjs";
import { onFootnote, proseTarget } from "./desk-records.mjs";

/** Escapes text for HTML. */
export function escapeText(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * A note's body as HTML: the reader's text, escaped, with its scripture
 * references linked (`a.sref` to this site, which ref-preview.js previews;
 * Sefaria and eBible links open in a new tab). Line breaks stay as typed;
 * the element showing it keeps `white-space: pre-wrap` as before.
 */
export function noteBodyHtml(body) {
  return openExternalLinks(linkScriptureRefs(escapeText(body)));
}

const SREF_HREF = /<a class="sref" href="\/([a-z0-9]+)-(\d+)\/(?:#v(\d+)(?:-(\d+))?)?"/g;

/**
 * The LIT verses a note's body cites, in order, without repeats:
 * `{ bookKey, chapter, from, to }`, with `from` and `to` null for a whole
 * chapter ("John 3").
 */
export function citedRefs(body) {
  const out = [];
  const seen = new Set();
  for (const m of linkScriptureRefs(escapeText(body)).matchAll(SREF_HREF)) {
    const from = m[3] ? Number(m[3]) : null;
    const to = m[3] ? Number(m[4] ?? m[3]) : null;
    const key = `${m[1]}-${m[2]}:${from}-${to}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ bookKey: m[1], chapter: Number(m[2]), from, to });
  }
  return out;
}

/** Whether a note sits on these verses itself (so citing them isn't a chain). */
function sitsOn(note, bookKey, chapter, from, to) {
  if (note.bookKey !== bookKey || note.chapter !== chapter || !Number.isInteger(note.verse)) return false;
  if (from == null) return true;
  const end = note.endVerse ?? note.verse;
  return note.verse <= to && from <= end;
}

/** Live notes with a body: notes on verses, glossary entries and articles alike. */
function notesWithBodies(records) {
  return (records ?? []).filter(
    (r) => r && r.kind === "note" && !r.deleted && typeof r.body === "string" && r.body.trim(),
  );
}

/**
 * The reader's notes that cite a verse (or, with `verse` null, any part of a
 * chapter), other than notes sitting on that verse themselves (a note on one
 * of its footnotes sits on the footnote, so it is listed). A citation of
 * a whole chapter counts for every verse in it. Returns `{ record, ref }`,
 * `ref` being the citation that matched, in the records' own order.
 *
 * @param {object[]} records the notebook
 * @param {{ bookKey: string, chapter: number, verse?: number | null }} where
 */
export function notesCiting(records, { bookKey, chapter, verse = null }) {
  const out = [];
  for (const record of notesWithBodies(records)) {
    const ref = citedRefs(record.body).find(
      (c) =>
        c.bookKey === bookKey &&
        c.chapter === chapter &&
        (verse == null || c.from == null || (c.from <= verse && verse <= c.to)),
    );
    if (!ref) continue;
    // A note on a footnote sits on the footnote, not its verse, so citing
    // that verse is a chain like any other (rule 23; BA20).
    if (!proseTarget(record) && !onFootnote(record) && sitsOn(record, bookKey, chapter, verse ?? ref.from, verse ?? ref.to)) continue;
    out.push({ record, ref });
  }
  return out;
}
