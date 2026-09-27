// src/lib/scripture-refs.mjs
//
// Turns plain-text New Testament references in rendered HTML into links:
// "Romans 2:24" → <a class="sref" href="/romans-2/#v24">Romans 2:24</a>.
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
//     "1 Corinthians 11 and 14").
// What it leaves alone:
//   - relative forms ("vv. 9–11", "verse 10", a bare "(1:20–25)"): a footnote
//     can be stored in two chapters and mean a third, so the host chapter is
//     not a safe assumption;
//   - Hebrew Bible books (only NT books are in the table);
//   - a reference tagged with another translation ("Mark 7:21–22 ESV"): it
//     cites that translation's wording, and linking it to the LIT text would
//     misattribute the quotation. The tag covers the whole list before it.
//   - anything already inside <a>, <script>, <style>, <code> or <pre>.

import { BOOKS, BOOK_ORDER, BOOK_ABBREVIATIONS, bookKeyToLabel } from "../data/books.js";

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

const NAME_TO_KEY = new Map();
for (const key of BOOK_ORDER) {
  const names = [bookKeyToLabel(key), BOOK_ABBREVIATIONS[key], ...(EXTRA_NAMES[key] ?? [])];
  for (const name of names) if (name && !NAME_TO_KEY.has(name)) NAME_TO_KEY.set(name, key);
}

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Longest first, so "1 Thessalonians" is tried before "1 Thess".
const NAME_ALT = [...NAME_TO_KEY.keys()]
  .sort((a, b) => b.length - a.length)
  .map((n) => escapeRe(n).replace(/ /g, SP))
  .join("|");

// A book name, optionally followed by a period, then the chapter-or-verse
// number and an optional range. Not preceded by a letter, digit, or a number
// and space (so the "John" inside "1 John" is never matched on its own).
const REF_RE = new RegExp(
  String.raw`(?<![A-Za-z0-9])(?<![123]${SP})(${NAME_ALT})\.?${SP}` +
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

const TAG_RE = new RegExp(
  String.raw`^,?(?:\s|\u00a0|&nbsp;)*\(?(?:${OTHER_TRANSLATIONS.join("|")})(?![A-Za-z])`
);

/**
 * Resolves one parsed reference to a link target, or null when it isn't a
 * valid NT reference. `prev` is the reference this one continues, if any.
 */
function resolve(key, nums, { sep = null, prev = null } = {}, opts) {
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

function anchor(target, text) {
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
    const key = NAME_TO_KEY.get(m[1].replace(/(?:\s|\u00a0|&nbsp;|&#160;)+/g, " "));
    const first = key ? resolve(key, m.slice(2, 8), {}, opts) : null;
    if (!first) continue;

    // Collect the list this reference opens.
    const parts = [{ start: m.index, end: m.index + m[0].length, target: first }];
    let pos = m.index + m[0].length;
    let prev = first;
    for (;;) {
      const cm = CONT_RE.exec(text.slice(pos));
      if (!cm) break;
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
    if (TAG_RE.test(text.slice(pos))) continue;

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
 * Links every New Testament reference in `html`.
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
  return mapHtmlText(html, (text) => linkText(text, o));
}
