// src/lib/desk-footnotes.mjs
//
// Pinned footnotes, the Study Desk's tenth kind (STUDY-DESK.md, "Draft 4d";
// BDR, 2026-10-09). This is the pure half: a chapter's footnotes as a list the
// desk can pin from and find a pin in, and the rule for finding a pin again
// after the wording moves. The Pin buttons and the Notebook's list are
// src/scripts/desk/pins.js; the change notice for a rewritten footnote is in
// desk-change.mjs, which calls findPin.
//
// A pin names its footnote by the verse that holds the footnote's letter and
// the footnote's full text, **never its letter**: letters shift whenever a
// footnote is added earlier in the chapter. Several notes in one verse may
// read alike (a shared note repeated), so a pin also keeps `n`, its place among
// that verse's identical notes, written only when there are two or more.
//
// The text is the footnote's anchor text. It is read the way a verse is
// (STUDY-DESK-FORMAT.md, "Anchor text", steps 3 to 7): every block boundary is
// a space, every other tag vanishes, entities decode, then normalizeAnchorText.
// The same string comes from the chapter JSON the apps read (footnotesFromChapter)
// and from the page the reader sees (footnotesFromDom), which has been through
// the reference linker and the browser's own re-serializing, so a pin made on
// the website matches the one an app made. test/desk-footnotes.test.js holds
// the two to it across the published corpus.
//
// Finding a pin again (findPin) follows the format's spirit for marks:
//   found    the same verse holds a footnote reading the same
//   moved    another verse of the chapter does (the nearest), and the pin
//            follows it without a word; nothing is written back
//   changed  nothing reads the same, but a footnote in the pin's verse keeps
//            at least half of the pinned words: the reader is told, shown what
//            changed, and decides (desk-change.mjs)
//   lost     nothing is left
// "Reads the same" ignores quotes, dashes and spacing, as a mark's change
// notice does (desk-wording.mjs), so a punctuation pass never raises a notice.

import { normalizeAnchorText } from "./anchor-core.mjs";
import { wordingDiff, wordingKey } from "./desk-wording.mjs";

/** The share of a pinned footnote's words that must survive for a rewritten footnote to be offered as the same note. */
export const CHANGED_THRESHOLD = 0.5;

/* ── Reading a footnote's text ───────────────────────────────────────── */

// Block edges separate words (the page's BLOCK set in desk-anchor-dom.mjs).
const BLOCK_TAG = /<\/?(?:p|blockquote|br|div|li|ul|ol|h[1-6]|section|article)(?=[\s/>])(?:[^>"']|"[^"]*"|'[^']*')*>/gi;
// Any other tag, comment included. Quoted attribute values may hold a ">".
const ANY_TAG = /<!--[\s\S]*?-->|<\/?[a-zA-Z](?:[^>"']|"[^"]*"|'[^']*')*>/g;

const NAMED = {
  nbsp: String.fromCodePoint(0xa0),
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  mdash: "—",
  ndash: "–",
  hellip: "…",
  lsquo: "‘",
  rsquo: "’",
  ldquo: "“",
  rdquo: "”",
  thinsp: String.fromCodePoint(0x2009),
  zwj: String.fromCodePoint(0x200d),
  zwnj: String.fromCodePoint(0x200c),
  shy: String.fromCodePoint(0xad),
};

function decodeEntities(s) {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, e) => {
    if (e[0] === "#") {
      const code = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : Number(e.slice(1));
      return Number.isInteger(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : whole;
    }
    return NAMED[e.toLowerCase()] ?? whole;
  });
}

/**
 * A footnote's text in the shared normalized form: the string a pin stores and
 * is matched on. `html` is the footnote body as the chapter JSON holds it, or
 * as the page shows it (links added, entities re-serialized) with the
 * back-link already taken out.
 */
export function footnoteText(html) {
  const stripped = String(html ?? "").replace(BLOCK_TAG, " ").replace(ANY_TAG, "");
  return normalizeAnchorText(decodeEntities(stripped));
}

/* ── A chapter's footnotes as a list ─────────────────────────────────── */

/**
 * @typedef {{ id: string, verse: number, text: string }} ChapterFootnote
 *   `id` is the footnote's own id on the page (`fn-a`), good for this visit
 *   only and never stored; `verse` the verse whose text holds its letter.
 */

// A note with a letter ahead of the chapter's first verse marker (Colossians 4
// opens on one) belongs to that first verse: the chapter has nowhere earlier
// to put it, and a pin has to name a verse.
function backfill(entries, firstVerse) {
  if (firstVerse == null) return entries.filter((e) => e.verse != null);
  return entries.map((e) => (e.verse == null ? { ...e, verse: firstVerse } : e));
}

/**
 * A chapter's footnotes from its JSON, in the order their letters stand in the
 * text. A footnote with no letter in the text can't be pinned and is left out,
 * as is a letter whose note is missing.
 *
 * @param {{ paragraphs?: string[], footnotes?: { id: string, html: string }[] }} chapter
 * @param {(html: string) => string} [prepare] how the page changes a note
 *   before showing it (the reference linker), for tests that compare the two
 * @returns {ChapterFootnote[]}
 */
export function footnotesFromChapter(chapter, prepare = (html) => html) {
  const htmlById = new Map((chapter?.footnotes ?? []).map((f) => [f.id, f.html]));
  const joined = (chapter?.paragraphs ?? []).join(" ");
  const entries = [];
  const seen = new Set();
  let verse = null;
  let firstVerse = null;
  // Verse markers and footnote letters, in the order they stand.
  const token = /<sup\b[^>]*\bid="v(\d+)"[^>]*>|<sup\b[^>]*\bclass=(["'])[^"']*\bfn-ref\b[^"']*\2[^>]*>\s*<a\b[^>]*\bhref="#(fn-[^"]+)"/g;
  for (const m of joined.matchAll(token)) {
    if (m[1] !== undefined) {
      verse = Number(m[1]);
      firstVerse ??= verse;
      continue;
    }
    const id = m[3];
    if (seen.has(id) || !htmlById.has(id)) continue;
    seen.add(id);
    entries.push({ id, verse, text: footnoteText(prepare(htmlById.get(id))) });
  }
  return backfill(entries, firstVerse);
}

const ELEMENT = 1;
const lower = (el) => String(el.tagName).toLowerCase();
const hasClass = (el, name) => ` ${el.getAttribute("class") ?? ""} `.includes(` ${name} `);

/**
 * The same list from the page: every footnote letter in the given blocks, in
 * document order, with the verse span (`data-verse`) it sits in. `bodyHtml(id)`
 * gives the note's HTML with its back-link taken out, or null when the page
 * has no such note; it is the one thing that needs the live document, so this
 * runs unchanged on any DOM with `childNodes`, `tagName`, `nodeType` and
 * `getAttribute`.
 *
 * @param {Iterable<Node>} blocks Study View's scripture blocks
 * @param {(id: string) => string | null} bodyHtml
 * @returns {ChapterFootnote[]}
 */
export function footnotesFromDom(blocks, bodyHtml) {
  const entries = [];
  const seen = new Set();
  let firstVerse = null;
  const walk = (node, verse, inFnRef) => {
    if (node.nodeType !== ELEMENT) return;
    const tag = lower(node);
    const v = node.getAttribute("data-verse");
    const here = v != null && /^\d+$/.test(v) ? Number(v) : verse;
    if (v != null && here === Number(v)) firstVerse ??= here;
    if (tag === "a" && inFnRef) {
      const id = (node.getAttribute("href") ?? "").replace(/^#/, "");
      const html = id && !seen.has(id) ? bodyHtml(id) : null;
      if (html != null) {
        seen.add(id);
        entries.push({ id, verse: here, text: footnoteText(html) });
      }
    }
    const fnRef = inFnRef || (tag === "sup" && hasClass(node, "fn-ref"));
    for (const child of node.childNodes) walk(child, here, fnRef);
  };
  for (const b of blocks) walk(b, null, false);
  return backfill(entries, firstVerse);
}

/* ── Making and finding a pin ────────────────────────────────────────── */

/**
 * The fields a pin keeps for a footnote: its verse, its text, and `n`, its
 * place among that verse's footnotes with identical text, when there are two
 * or more. Throws for an id the list doesn't hold.
 *
 * @param {ChapterFootnote[]} list
 * @param {string} id
 * @returns {{ verse: number, footnote: string, n?: number }}
 */
export function pinFields(list, id) {
  const note = list.find((f) => f.id === id);
  if (!note) throw new Error(`desk-footnotes: no footnote "${id}" in this chapter`);
  const twins = list.filter((f) => f.verse === note.verse && f.text === note.text);
  return {
    verse: note.verse,
    footnote: note.text,
    ...(twins.length > 1 ? { n: twins.indexOf(note) + 1 } : {}),
  };
}

const nth = (twins, n) => twins[Math.min(Number.isInteger(n) && n >= 1 ? n : 1, twins.length) - 1];

function countWords(text) {
  return text.split(/\s+/).filter(Boolean).length;
}

// wordingDiff gives up on texts past its token limit and reports them
// replaced whole, which would call a one-word edit to a long note (one runs
// to about 600 words) "lost". Past that size, count the old words still
// present instead, ignoring order.
const LONG_NOTE_WORDS = 500;

function bagSurvival(before, now) {
  const words = (t) => wordingKey(t).toLowerCase().split(/\s+/).filter(Boolean);
  const left = new Map();
  for (const w of words(now)) left.set(w, (left.get(w) ?? 0) + 1);
  const old = words(before);
  let kept = 0;
  for (const w of old) {
    const n = left.get(w) ?? 0;
    if (n > 0) {
      kept += 1;
      left.set(w, n - 1);
    }
  }
  return old.length ? kept / old.length : 0;
}

/** The share of the old footnote's words that stand in the new one, in order. */
function survival(before, now) {
  if (countWords(before) > LONG_NOTE_WORDS || countWords(now) > LONG_NOTE_WORDS) return bagSurvival(before, now);
  let kept = 0;
  let total = 0;
  for (const run of wordingDiff(before, now)) {
    const words = countWords(run.text);
    if (run.op === "same") kept += words;
    if (run.op !== "ins") total += words;
  }
  return total ? kept / total : 0;
}

/**
 * Where a pin is in today's footnotes.
 *
 * @param {ChapterFootnote[]} list the chapter's footnotes as the text has them now
 * @param {{ verse: number, footnote: string, n?: number }} record
 * @returns {{ status: "found" | "moved" | "changed" | "lost",
 *   id: string | null, text: string | null, verse: number | null }}
 *   `id`, `text` and `verse` are the footnote the pin sits on now (all null
 *   when it is lost); for `changed` it is the one that stands closest to what
 *   was pinned
 */
export function findPin(list, record) {
  const hit = (status, f) => ({ status, id: f.id, text: f.text, verse: f.verse });
  const want = wordingKey(record.footnote);
  const same = list.filter((f) => wordingKey(f.text) === want);

  if (same.length) {
    const here = same.filter((f) => f.verse === record.verse);
    if (here.length) return hit("found", nth(here, record.n));
    // Another verse reads the same: the nearest, the earlier on a tie.
    const distance = (f) => Math.abs(f.verse - record.verse);
    const nearest = same.reduce((a, b) => (distance(b) < distance(a) ? b : a));
    return hit("moved", nth(same.filter((f) => f.verse === nearest.verse), record.n));
  }

  let best = null;
  let bestScore = 0;
  for (const f of list) {
    if (f.verse !== record.verse) continue;
    const score = survival(record.footnote, f.text);
    if (score > bestScore) {
      best = f;
      bestScore = score;
    }
  }
  if (best && bestScore >= CHANGED_THRESHOLD) return hit("changed", best);
  return { status: "lost", id: null, text: null, verse: null };
}

/**
 * Every pin among `records`, each with where it is in `list` today:
 * `[{ record, found }]`, `found` being findPin's answer. Records of other kinds
 * are skipped.
 */
export function placePins(list, records) {
  const out = [];
  for (const record of records ?? []) {
    if (record?.kind !== "footnotePin" || typeof record.footnote !== "string") continue;
    out.push({ record, found: findPin(list, record) });
  }
  return out;
}
