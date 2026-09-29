// src/lib/scripture-refs.mjs
//
// Turns plain-text scripture references in rendered HTML into links:
// "Romans 2:24" → <a class="sref" href="/romans-2/#v24">Romans 2:24</a>. The
// Hebrew Bible links out to Sefaria (<a class="sefaria-ref">, with the verse
// numbers mapped by sefaria-refs.mjs) and the apocrypha to the World English
// Bible on eBible.org (<a class="ebible-ref">, ebible-refs.mjs).
//
// Website render only. It runs over footnote, intro, article, glossary and
// release-note HTML as the page is built, and never over anything the apps
// or the changelog read: chapter JSON, intros on disk, release-notes.json and
// the glossary feed all keep their plain text. See "Scripture references" in
// CLAUDE.md.
//
// Pure: no fs. The build shell (scripture-refs-data.mjs) supplies `hasVerse`
// and `isDraft` from the chapter files.
//
// What it links, deliberately conservative:
//   - an explicit book name or SBL abbreviation followed by a chapter
//     ("John 3"), chapter:verse ("John 3:16"), or a range of either
//     ("John 3:16–18", "Hebrews 6–9", "Galatians 5:25–6:1");
//   - list continuations after one ("John 3:35; 5:20", "10:23, 33",
//     "1 Corinthians 11 and 14");
//   - a book title set in italics, with its numbers ("<em>Sirach</em> 24"),
//     the italics kept inside the link.
// What it leaves alone:
//   - relative forms ("vv. 9–11", "verse 10", a bare "(1:20–25)"): a footnote
//     can be stored in two chapters and mean a third, so the host chapter is
//     not a safe assumption;
//   - a chapter or verse the book doesn't have (Psalm 151, "Daniel 3:35" in
//     the Greek numbering), and a book neither site carries (1 Enoch);
//   - a reference tagged with another translation ("Mark 7:21–22 ESV"): it
//     cites that translation's wording, and linking it to the LIT text would
//     misattribute the quotation. The tag covers the whole list before it.
//     A reference that links to another site also stays plain when tagged
//     with a text whose numbering or wording isn't the one shown there (LXX,
//     MT, Alter's translation), since the link would open a different verse
//     or wording;
//   - anything already inside <a>, <script>, <style>, <code> or <pre>.

import { BOOKS, BOOK_ORDER, BOOK_ABBREVIATIONS, bookKeyToLabel } from "../data/books.js";
import { HB_BOOKS, chapterCount as hbChapterCount, sefariaHref } from "./sefaria-refs.mjs";
import { APOCRYPHA, chapterCount as apocryphaChapterCount, ebibleHref } from "./ebible-refs.mjs";

// Abbreviations beyond BOOK_ABBREVIATIONS that the corpus or SBL style uses.
const EXTRA_NAMES = {
  philemon: ["Philem"],
  james: ["Jas"],
};

// Tags naming another translation. "LIT" is ours and is not here.
const OTHER_TRANSLATIONS = [
  "NRSVue", "NRSV", "RSV", "ESV", "CEB", "NIV", "TNIV", "KJV", "NKJV", "NASB",
  "NLT", "NET", "CSB", "HCSB", "NABRE", "NAB", "NJB", "JB", "MSG", "AMP", "ASV",
  "CEV", "YLT", "DBH",
];

const SP = String.raw`(?:\s|\u00a0|&nbsp;|&#160;)+`;
const DASH = String.raw`(?:-|\u2013|&ndash;|&#8211;)`;

// Books that link to another site, keyed by a prefix on the book key. And the
// texts whose numbering or wording isn't the one those sites show, so a
// reference tagged with them stays plain.
const OUTBOUND = {
  "sefaria:": { books: HB_BOOKS, chapterCount: hbChapterCount, href: sefariaHref, cls: "sefaria-ref" },
  "ebible:": { books: APOCRYPHA, chapterCount: apocryphaChapterCount, href: ebibleHref, cls: "ebible-ref" },
};
const OUTBOUND_TAGS = [...OTHER_TRANSLATIONS, "LXX", "MT", "Septuagint", "Masoretic", "Alter", "JPS", "NJPS"];

const NAME_TO_KEY = new Map();
for (const key of BOOK_ORDER) {
  const names = [bookKeyToLabel(key), BOOK_ABBREVIATIONS[key], ...(EXTRA_NAMES[key] ?? [])];
  for (const name of names) if (name && !NAME_TO_KEY.has(name)) NAME_TO_KEY.set(name, key);
}
// Names that are ordinary words too ("Wisdom") count only with a verse.
const VERSE_ONLY = new Set();
for (const [prefix, { books }] of Object.entries(OUTBOUND)) {
  for (const book of books) {
    for (const name of book.names) if (!NAME_TO_KEY.has(name)) NAME_TO_KEY.set(name, prefix + book.key);
    for (const name of book.verseOnly ?? []) VERSE_ONLY.add(name);
  }
}

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Longest first, so "1 Thessalonians" is tried before "1 Thess".
const NAME_ALT = [...NAME_TO_KEY.keys()]
  .sort((a, b) => b.length - a.length)
  .map((n) => escapeRe(n).replace(/ /g, SP))
  .join("|");

// A book title set in italics ("<em>Wisdom of Solomon</em> 7:1–2") has a tag
// between the name and its numbers, which the per-run pass can't see across.
// linkScriptureRefs swaps such a title's tags for these two private-use
// characters first, so the reference reads as one run, and swaps them back
// after, inside the link. Only a known book name directly followed by a
// number is swapped; any other italic title is left exactly as it was.
const EM_OPEN = "\uE000";
const EM_CLOSE = "\uE001";
const EM_TITLE_RE = new RegExp(String.raw`<em>(${NAME_ALT})</em>(?=${SP}\d)`, "g");

// A book name, optionally followed by a period, then the chapter-or-verse
// number and an optional range. Not preceded by a letter, digit, or a number
// and space (so the "John" inside "1 John" is never matched on its own).
const REF_RE = new RegExp(
  String.raw`(?<![A-Za-z0-9])(?<![123]${SP})${EM_OPEN}?(${NAME_ALT})${EM_CLOSE}?\.?${SP}` +
    String.raw`(\d{1,3})(?::(\d{1,3}))?([a-c])?` +
    String.raw`(?:${DASH}(\d{1,3})(?::(\d{1,3}))?([a-c])?)?` +
    String.raw`(?![0-9A-Za-z]|:\d)`,
  "g"
);

// A continuation right after a reference: a separator, then C:V or a bare
// number, with an optional range. Anchored at the continuation's start.
const CONT_RE = new RegExp(
  String.raw`^(\s*,\s*(?:and${SP})?|\s*;\s*|${SP}and${SP})` +
    String.raw`(\d{1,3})(?::(\d{1,3}))?([a-c])?` +
    String.raw`(?:${DASH}(\d{1,3})(?::(\d{1,3}))?([a-c])?)?` +
    String.raw`(?![0-9A-Za-z]|:\d)`
);

// A numbered book's number ("and 1 Samuel", "and 1 Enoch") is not a verse
// continuing the list before it, though it parses as one.
const NUMBERED_BOOK_AHEAD = /^(?:\s|\u00a0|&nbsp;)+[A-Z]/;

// An outbound reference qualified from in front ("LXX Ps 51:4") cites that
// text's numbering or wording, so it stays plain like a tagged one.
const QUALIFIER_BEHIND = /(?:LXX|MT|Septuagint|Masoretic)(?:\s|\u00a0|&nbsp;)*$/;

const tagRe = (tags) =>
  new RegExp(String.raw`^,?(?:\s|\u00a0|&nbsp;)*\(?(?:${tags.join("|")})(?![A-Za-z])`);
const TAG_RE = tagRe(OTHER_TRANSLATIONS);
const OUTBOUND_TAG_RE = tagRe(OUTBOUND_TAGS);

/**
 * Resolves one parsed reference to a link target, or null when it isn't a
 * valid reference. `prev` is the reference this one continues, if any.
 */
function resolve(key, nums, ctx = {}, opts) {
  const colon = key.indexOf(":");
  if (colon >= 0) return resolveOutbound(OUTBOUND[key.slice(0, colon + 1)], key.slice(colon + 1), nums, ctx);
  const { sep = null, prev = null } = ctx;
  const [a, b, , c, d] = nums;
  const n = (x) => (x == null ? null : parseInt(x, 10));
  let chapter, verse = null, endVerse = null;
  const single = BOOKS[key] === 1;

  if (b != null) {
    // C:V, with an optional end verse (same chapter) or end C:V (next chapter).
    chapter = n(a);
    verse = n(b);
    if (c != null && d == null) endVerse = n(c);
  } else if (prev) {
    // A bare number continuing a list.
    if (prev.verse != null) {
      // After a verse, a comma or "and" adds a verse of the same chapter. After
      // a semicolon a bare number could be a chapter or a verse; leave it.
      if (sep === ";") return null;
      chapter = prev.chapter;
      verse = n(a);
      if (c != null && d == null) endVerse = n(c);
    } else {
      chapter = n(a);
    }
  } else if (single) {
    // "Philemon 9", "Jude 5–7": a one-chapter book's number is a verse.
    chapter = 1;
    verse = n(a);
    if (c != null && d == null) endVerse = n(c);
  } else {
    chapter = n(a);
  }

  if (!(chapter >= 1 && chapter <= BOOKS[key])) return null;
  if (verse != null && verse < 1) return null;

  let hash = "";
  if (verse != null) {
    if (opts.hasVerse(key, chapter, verse)) {
      hash = `#v${verse}`;
      if (endVerse != null && endVerse > verse && opts.hasVerse(key, chapter, endVerse)) {
        hash += `-${endVerse}`;
      }
    } else if (prev && prev.verse != null && b == null) {
      // A continuation verse that doesn't exist ("John 3:16, 1995") is not a
      // reference at all.
      return null;
    }
  }
  return {
    key,
    chapter,
    verse,
    href: `/${key}-${chapter}/${hash}`,
    draft: opts.isDraft(key, chapter),
  };
}

/**
 * The same parse for a book on another site, read in English numbering; the
 * address comes from that site's module (for Sefaria, with the numbering
 * mapped). A range keeps its end for the module to use: Sefaria shows the
 * passage ("Isaiah 52:13–53:12"), eBible opens at its first verse.
 */
function resolveOutbound(source, key, nums, { sep = null, prev = null } = {}) {
  const [a, b, , c, d] = nums;
  const n = (x) => (x == null ? null : parseInt(x, 10));
  let start;
  let end = null;

  if (b != null) {
    start = { chapter: n(a), verse: n(b) };
    if (c != null) end = d != null ? { chapter: n(c), verse: n(d) } : { chapter: start.chapter, verse: n(c) };
  } else if (prev) {
    if (prev.verse != null) {
      if (sep === ";") return null;
      start = { chapter: prev.chapter, verse: n(a) };
      if (c != null && d == null) end = { chapter: start.chapter, verse: n(c) };
    } else {
      start = { chapter: n(a), verse: null };
      if (c != null && d == null) end = { chapter: n(c), verse: null };
    }
  } else if (source.chapterCount(key) === 1) {
    // "Obadiah 15": a one-chapter book's number is a verse.
    start = { chapter: 1, verse: n(a) };
    if (c != null && d == null) end = { chapter: 1, verse: n(c) };
  } else {
    start = { chapter: n(a), verse: null };
    if (c != null) end = d != null ? { chapter: n(c), verse: n(d) } : { chapter: n(c), verse: null };
  }

  // A range that runs backwards isn't a range.
  if (end) {
    const backwards =
      end.chapter < start.chapter ||
      (end.chapter === start.chapter && (end.verse == null || start.verse == null || end.verse <= start.verse));
    if (backwards) end = null;
  }
  const href = source.href(key, start, end);
  return href ? { key, chapter: start.chapter, verse: start.verse, href, outbound: source.cls } : null;
}

function anchor(target, text) {
  if (target.outbound) return `<a class="${target.outbound}" href="${target.href}">${text}</a>`;
  const draft = target.draft ? " data-draft" : "";
  return `<a class="sref" href="${target.href}"${draft}>${text}</a>`;
}

/** Links the references in one run of text (no tags inside it). */
function linkText(text, opts) {
  let out = "";
  let last = 0;
  REF_RE.lastIndex = 0;
  let m;
  while ((m = REF_RE.exec(text))) {
    const name = m[1].replace(/(?:\s|\u00a0|&nbsp;|&#160;)+/g, " ");
    const key = NAME_TO_KEY.get(name);
    if (VERSE_ONLY.has(name) && m[3] == null) continue;
    const first = key ? resolve(key, m.slice(2, 8), {}, opts) : null;
    if (!first) continue;
    if (first.outbound && QUALIFIER_BEHIND.test(text.slice(0, m.index))) continue;

    // Collect the list this reference opens.
    const parts = [{ start: m.index, end: m.index + m[0].length, target: first }];
    let pos = m.index + m[0].length;
    let prev = first;
    for (;;) {
      const cm = CONT_RE.exec(text.slice(pos));
      if (!cm) break;
      const bare = cm[3] == null && cm[5] == null && /^[1-4]$/.test(cm[2]);
      if (bare && NUMBERED_BOOK_AHEAD.test(text.slice(pos + cm[0].length))) break;
      const sepRaw = cm[1].trim();
      const sep = sepRaw.startsWith(";") ? ";" : ",";
      const target = resolve(key, cm.slice(2, 8), { sep, prev }, opts);
      if (!target) break;
      const numStart = pos + cm[1].length;
      parts.push({ start: numStart, end: pos + cm[0].length, target });
      pos += cm[0].length;
      prev = target;
    }
    REF_RE.lastIndex = pos;

    // Tagged with another translation: the whole list stays plain.
    if ((first.outbound ? OUTBOUND_TAG_RE : TAG_RE).test(text.slice(pos))) continue;

    for (const p of parts) {
      out += text.slice(last, p.start) + anchor(p.target, text.slice(p.start, p.end));
      last = p.end;
    }
  }
  return out + text.slice(last);
}

const SKIP_TAGS = new Set(["a", "script", "style", "code", "pre"]);

/**
 * Applies `fn` to every run of text in an HTML string that sits outside the
 * skipped elements, leaving tags, comments and skipped content untouched.
 */
export function mapHtmlText(html, fn, skip = SKIP_TAGS) {
  const tokens = String(html).split(/(<!--[\s\S]*?-->|<[^>]*>)/);
  const open = [];
  let out = "";
  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i];
    if (i % 2 === 1) {
      const tm = tok.match(/^<(\/?)([a-zA-Z][a-zA-Z0-9-]*)/);
      if (tm) {
        const name = tm[2].toLowerCase();
        if (skip.has(name) && !/\/>$/.test(tok)) {
          if (tm[1]) {
            const at = open.lastIndexOf(name);
            if (at !== -1) open.splice(at, 1);
          } else {
            open.push(name);
          }
        }
      }
      out += tok;
    } else {
      out += open.length || !tok ? tok : fn(tok);
    }
  }
  return out;
}

/**
 * Links every scripture reference in `html`: the New Testament to this site,
 * the Hebrew Bible to Sefaria, and the apocrypha to eBible.org.
 *
 * @param {string} html
 * @param {object} [opts]
 * @param {(key: string, chapter: number, verse: number) => boolean} [opts.hasVerse]
 *   Whether the chapter page carries #vN. A reference to a verse that doesn't
 *   (a draft, or a verse the source text omits) links to the chapter instead.
 * @param {(key: string, chapter: number) => boolean} [opts.isDraft]
 *   Draft chapters get `data-draft`, which the preview reads.
 */
export function linkScriptureRefs(html, opts = {}) {
  const o = {
    hasVerse: opts.hasVerse ?? (() => true),
    isDraft: opts.isDraft ?? (() => false),
  };
  const src = String(html);
  if (src.includes(EM_OPEN) || src.includes(EM_CLOSE)) return mapHtmlText(src, (text) => linkText(text, o));
  return mapHtmlText(src.replace(EM_TITLE_RE, `${EM_OPEN}$1${EM_CLOSE}`), (text) => linkText(text, o))
    .replaceAll(EM_OPEN, "<em>")
    .replaceAll(EM_CLOSE, "</em>");
}
