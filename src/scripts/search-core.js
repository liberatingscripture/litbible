// src/scripts/search-core.js
//
// Shared search logic used by BOTH the SearchBar tray (searchbar.js) and the
// full /search page (search.js): reference parsing, book aliases, the
// verse-index scanner (scripture keyword search), Pagefind query building
// (articles/glossary), result-location math, and the topics-index loader.
//
// Rule of thumb: if a behavior must agree between the tray and the full page
// (what counts as a reference, how a query is quoted, how a verse hit is
// labelled and linked), it lives here. Page-specific rendering stays in the
// respective entry scripts.

import { BOOK_ORDER, bookKeyToLabel } from "../data/books.js";

export { bookKeyToLabel };

export const BOOK_RANK = new Map(BOOK_ORDER.map((k, i) => [k, i]));

/** Bucket labels shared by group titles and active-filter pills. */
export const MODE_LABELS = {
  subject: "Topic matches",
  keyword: "Keyword matches",
  glossary: "Glossary matches",
  article: "Article matches",
  intro: "Book introductions",
};

/* ── Book aliases and reference parsing ─────────────────────────────── */

function slugifyBookName(name) {
  return String(name || "")
    .toLowerCase()
    .replace(/[^0-9a-z]/g, "");
}

const BOOK_ALIAS_ENTRIES = [
  ["matthew", ["matthew", "matt", "mt"]],
  ["mark", ["mark", "mrk", "mk"]],
  ["luke", ["luke", "luk", "lk"]],
  ["john", ["john", "jhn", "jn"]],
  ["acts", ["acts", "act", "ac"]],
  ["romans", ["romans", "rom", "ro"]],
  [
    "1corinthians",
    ["1corinthians", "1 corinthians", "1cor", "1 cor", "1co", "1 co"],
  ],
  [
    "2corinthians",
    ["2corinthians", "2 corinthians", "2cor", "2 cor", "2co", "2 co"],
  ],
  ["galatians", ["galatians", "gal"]],
  ["ephesians", ["ephesians", "eph"]],
  ["philippians", ["philippians", "phil", "php"]],
  ["colossians", ["colossians", "col"]],
  [
    "1thessalonians",
    [
      "1thessalonians",
      "1 thessalonians",
      "1thess",
      "1 thess",
      "1thes",
      "1 thes",
      "1th",
      "1 th",
    ],
  ],
  [
    "2thessalonians",
    [
      "2thessalonians",
      "2 thessalonians",
      "2thess",
      "2 thess",
      "2thes",
      "2 thes",
      "2th",
      "2 th",
    ],
  ],
  ["1timothy", ["1timothy", "1 timothy", "1tim", "1 tim", "1ti", "1 ti"]],
  ["2timothy", ["2timothy", "2 timothy", "2tim", "2 tim", "2ti", "2 ti"]],
  ["titus", ["titus", "tit"]],
  ["philemon", ["philemon", "phm", "phlm"]],
  ["hebrews", ["hebrews", "heb"]],
  ["james", ["james", "jas", "jm"]],
  ["1peter", ["1peter", "1 peter", "1pet", "1 pet", "1pe", "1 pe"]],
  ["2peter", ["2peter", "2 peter", "2pet", "2 pet", "2pe", "2 pe"]],
  ["1john", ["1john", "1 john", "1jn", "1 jn", "1jhn", "1 jhn"]],
  ["2john", ["2john", "2 john", "2jn", "2 jn", "2jhn", "2 jhn"]],
  ["3john", ["3john", "3 john", "3jn", "3 jn", "3jhn", "3 jhn"]],
  ["jude", ["jude", "jud"]],
  ["revelation", ["revelation", "rev", "re"]],
];

const BOOK_ALIASES = new Map();
for (const [bookKey, aliases] of BOOK_ALIAS_ENTRIES) {
  BOOK_ALIASES.set(bookKey, bookKey);
  BOOK_ALIASES.set(slugifyBookName(bookKey), bookKey);
  for (const alias of aliases) {
    BOOK_ALIASES.set(slugifyBookName(alias), bookKey);
  }
}

function resolveBookKey(rawBookPart) {
  const alias = slugifyBookName(rawBookPart);
  const mapped = BOOK_ALIASES.get(alias) || alias;
  return BOOK_RANK.has(mapped) ? mapped : null;
}

function cleanReferenceInput(raw) {
  return String(raw || "")
    .trim()
    .toLowerCase()
    .replace(/[.,;()]/g, " ")
    .replace(/[–—−]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

/** Book-only queries ("Romans", "1 Jn") — enables jumps at 2 letters. */
export function parseBookOnly(raw) {
  const cleaned = cleanReferenceInput(raw);
  if (!cleaned) return null;
  const bookKey = resolveBookKey(cleaned);
  return bookKey ? { bookKey } : null;
}

/** "john 3:16-18" → { bookKey, chapter, verse, rangeEnd } or null. */
export function parseReference(raw) {
  const cleaned = cleanReferenceInput(raw);
  if (!cleaned) return null;

  const m = cleaned.match(/^(.+?)\s*(\d+)(?::(\d+)(?:\s*-\s*(\d+))?)?$/);
  if (!m) return null;

  const bookKey = resolveBookKey(m[1]);
  const chapter = Number(m[2]);
  const verse = m[3] ? Number(m[3]) : null;
  const rangeEnd = m[4] ? Number(m[4]) : null;

  if (!bookKey) return null;
  if (!Number.isFinite(chapter) || chapter <= 0) return null;
  if (verse !== null && (!Number.isFinite(verse) || verse <= 0)) return null;
  if (rangeEnd !== null && (!Number.isFinite(rangeEnd) || rangeEnd <= 0))
    return null;

  return {
    bookKey,
    chapter,
    verse,
    rangeEnd:
      verse !== null && rangeEnd !== null && rangeEnd > verse ? rangeEnd : null,
  };
}

/** null | { kind:"ref", ... } | { kind:"book", bookKey } */
export function parseReferenceJump(raw) {
  const ref = parseReference(raw);
  if (ref) return { kind: "ref", ...ref };

  const bookOnly = parseBookOnly(raw);
  if (bookOnly) return { kind: "book", ...bookOnly };

  return null;
}

export function formatReferenceLabel(ref) {
  const book = bookKeyToLabel(ref.bookKey);
  if (ref.verse) {
    const range = ref.rangeEnd ? `–${ref.rangeEnd}` : "";
    return `${book} ${ref.chapter}:${ref.verse}${range}`;
  }
  return `${book} ${ref.chapter}`;
}

export function makeStudyReferenceHref(ref) {
  const base = `/${ref.bookKey}-${ref.chapter}`;
  if (!ref.verse) return base;
  const range = ref.rangeEnd ? `-${ref.rangeEnd}` : "";
  return `${base}#v${ref.verse}${range}`;
}

export function makeReadReferenceHref(ref) {
  const base = `/read/${ref.bookKey}`;
  const hash = ref.verse
    ? `${ref.bookKey}-${ref.chapter}-v${ref.verse}`
    : `ch-${ref.chapter}`;
  return `${base}#${hash}`;
}

export function makeStudyBookHref(bookKey) {
  return `/${bookKey}-intro`;
}

export function makeReadBookHref(bookKey) {
  return `/read/${bookKey}`;
}

export function referenceJumpLabel(jump) {
  if (!jump) return "";
  return jump.kind === "book"
    ? bookKeyToLabel(jump.bookKey)
    : formatReferenceLabel(jump);
}

export function makeStudyJumpHref(jump) {
  return jump.kind === "book"
    ? makeStudyBookHref(jump.bookKey)
    : makeStudyReferenceHref(jump);
}

export function makeReadJumpHref(jump) {
  return jump.kind === "book"
    ? makeReadBookHref(jump.bookKey)
    : makeReadReferenceHref(jump);
}

/* ── Query normalization + Pagefind query building ───────────────────── */

export function normalizeQuotes(s) {
  return String(s || "")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'");
}

export function isExplicitlyQuoted(q) {
  const s = String(q || "").trim();
  return s.length >= 2 && s.startsWith('"') && s.endsWith('"');
}

export function normalizePhrase(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/\u00a0/g, " ")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Build the Pagefind query for a raw user query. Pagefind only covers
 * articles/glossary/intros now (scripture keyword search runs against the
 * verse index — see searchVerses), but the quoting rules still shape those
 * page-level results:
 * - Explicitly quoted queries pass through (single-token gets exact matching).
 * - Multi-word queries become exact phrases.
 * - Very short tokens (1–4 chars) are quoted for exact-only matching.
 */
export function buildPfQuery(raw) {
  const q0 = normalizeQuotes(raw).trim();
  if (!q0) return { pfQuery: "", exactSingleToken: false, exactToken: "" };

  if (isExplicitlyQuoted(q0)) {
    const inner = q0.slice(1, -1).trim();
    const single = !/\s+/.test(inner);
    return {
      pfQuery: q0,
      exactSingleToken: single,
      exactToken: single ? inner : "",
    };
  }

  // Normalize fancy dashes to "-" for consistent matching.
  const canon = q0.replace(/[‐‑‒–—−]/g, "-");

  if (/\s+/.test(canon)) {
    return { pfQuery: `"${canon}"`, exactSingleToken: false, exactToken: "" };
  }

  if (canon.length >= 1 && canon.length <= 4) {
    return { pfQuery: `"${canon}"`, exactSingleToken: true, exactToken: canon };
  }

  return { pfQuery: canon, exactSingleToken: false, exactToken: "" };
}

/* ── Small text helpers ──────────────────────────────────────────────── */

export function escapeHtml(s) {
  return String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;",
      })[c],
  );
}

export function escapeRegExp(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function stripTags(html) {
  return String(html || "").replace(/<[^>]+>/g, "");
}

/**
 * Split a Pagefind meta value (topics/tags) into trimmed phrases.
 * Accepts an array or a delimited string; "|" and "/" count as commas.
 */
export function parseMetaList(metaValue) {
  if (!metaValue) return [];

  if (Array.isArray(metaValue)) {
    return metaValue
      .map((t) =>
        String(t)
          .replace(/\u00a0/g, " ")
          .trim(),
      )
      .filter(Boolean);
  }

  const raw = String(metaValue)
    .replace(/\u00a0/g, " ")
    .replace(/[|/]+/g, ",")
    .trim();

  if (!raw) return [];

  const parts = raw
    .split(/\s*[;,]\s*/g)
    .map((t) => t.trim())
    .filter(Boolean);

  return parts.length ? parts : [raw];
}

/* ── Fuzzy topic suggestions ─────────────────────────────────────────── */

export function levenshtein(a, b) {
  const m = a.length,
    n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const d = Array.from({ length: m + 1 }, (_, i) => i);
  for (let j = 1; j <= n; j++) {
    let prev = d[0];
    d[0] = j;
    for (let i = 1; i <= m; i++) {
      const temp = d[i];
      d[i] = a[i - 1] === b[j - 1] ? prev : 1 + Math.min(prev, d[i], d[i - 1]);
      prev = temp;
    }
  }
  return d[m];
}

export function fuzzyTopicSuggestions(query, topics, limit) {
  limit = limit || 3;
  const qNorm = normalizePhrase(query);
  if (!qNorm || qNorm.length < 3) return [];
  const scored = [];
  for (const t of topics) {
    const norm = t.norm || String(t);
    if (norm === qNorm) continue;
    if (norm.startsWith(qNorm) || qNorm.startsWith(norm)) {
      scored.push({ label: t.label || t.display || norm, dist: 0 });
      continue;
    }
    if (Math.abs(norm.length - qNorm.length) > 4) continue;
    const dist = levenshtein(qNorm, norm);
    const threshold = Math.max(2, Math.ceil(qNorm.length * 0.3));
    if (dist <= threshold)
      scored.push({ label: t.label || t.display || norm, dist });
  }
  scored.sort((a, b) => a.dist - b.dist);
  return scored.slice(0, limit).map((s) => s.label);
}

/** Whole-word single-token match against a normalized topic phrase. */
export function topicTokenMatches(normTopic, token) {
  if (!token) return false;
  const re = new RegExp(`(?:^|\\s)${escapeRegExp(token)}(?:$|\\s)`, "i");
  return re.test(normTopic);
}

/* ── URL classification ──────────────────────────────────────────────── */

/**
 * Strict scripture-path parser: requires a "-intro" or "-<n>" suffix.
 * "/luke-4" → { bookKey, isIntro, chapter, href }; "/about" → null.
 */
export function parseScripturePath(hrefOrUrl) {
  try {
    const u = new URL(hrefOrUrl, "https://local.invalid");
    const m = u.pathname.match(/^\/([0-9a-z]+)-(intro|\d+)\/?$/);
    if (!m) return null;

    const bookKey = m[1];
    const chapRaw = m[2];

    return {
      bookKey,
      isIntro: chapRaw === "intro",
      chapter: chapRaw === "intro" ? 0 : Number(chapRaw),
      href: u.pathname + u.hash,
    };
  } catch {
    return null;
  }
}

/**
 * Loose book/chapter parser used for ordering: the suffix is optional and
 * the book key is not validated ("/read" parses as bookKey "read").
 * Intro sorts before chapter 1 (chapter 0).
 */
export function parseBookChapterFromUrl(url) {
  try {
    const path = new URL(url, "https://local.invalid").pathname;
    const m = path.match(/^\/([0-9]?[a-z]+)(?:-(intro|\d+))?\/?$/i);
    if (!m) return null;

    const bookKey = String(m[1] || "").toLowerCase();
    const suffix = String(m[2] || "").toLowerCase();

    let chapter = 0;
    if (suffix && suffix !== "intro") {
      const n = Number.parseInt(suffix, 10);
      chapter = Number.isFinite(n) ? n : 0;
    }

    return { bookKey, chapter };
  } catch {
    return null;
  }
}

/**
 * Human title for a scripture result URL ("Luke 4", "Luke — Introduction").
 * Non-scripture URLs return fallbackTitle so each surface can pick its own
 * fallback (the tray shows the raw URL, the full page shows meta title).
 */
export function scriptureResultTitle(url, fallbackTitle = "Result") {
  const parsed = parseScripturePath(url);
  if (!parsed) return fallbackTitle;

  const book = bookKeyToLabel(parsed.bookKey);
  return parsed.isIntro ? `${book} — Introduction` : `${book} ${parsed.chapter}`;
}

export function isGlossaryUrl(hrefOrUrl) {
  const raw = String(hrefOrUrl || "").trim();
  if (!raw) return false;

  const base = raw.split("#")[0].split("?")[0];

  if (base.startsWith("/")) {
    return /\/glossary(\/|$)/i.test(base);
  }

  if (base.startsWith("http://") || base.startsWith("https://")) {
    try {
      const p = new URL(base).pathname.replace(/\/+$/, "");
      return /\/glossary(\/|$)/i.test(p);
    } catch {
      return false;
    }
  }

  return /\/glossary(\/|$)/i.test(base) || /^glossary(\/|$)/i.test(base);
}

export function bibleOrderCompareHref(aHref, bHref) {
  const a = parseScripturePath(aHref);
  const b = parseScripturePath(bHref);

  if (!a && !b) return 0;
  if (!a) return 1;
  if (!b) return -1;

  const ar = BOOK_RANK.get(a.bookKey) ?? 999;
  const br = BOOK_RANK.get(b.bookKey) ?? 999;
  if (ar !== br) return ar - br;

  return a.chapter - b.chapter;
}

/* ── Pagefind result-location math ───────────────────────────────────── */

export function getMatchLocations(d) {
  const wl = Array.isArray(d?.weighted_locations)
    ? d.weighted_locations
        .map((x) => x?.location)
        .filter((n) => typeof n === "number")
    : [];
  if (wl.length) return wl;

  return Array.isArray(d?.locations)
    ? d.locations.filter((n) => typeof n === "number")
    : [];
}

/** Anchors with ids, sorted by word location. */
export function contentAnchors(anchors) {
  return (Array.isArray(anchors) ? [...anchors] : [])
    .filter((a) => !!a?.id)
    .sort((a, b) => (a?.location ?? 0) - (b?.location ?? 0));
}

/**
 * The nearest anchor at/before the first match, or null when there is
 * nothing to anchor to.
 */
export function pickContentAnchor(d, locs) {
  const chosenLoc = Array.isArray(locs) && locs.length ? locs[0] : null;

  if (
    typeof chosenLoc !== "number" ||
    !Array.isArray(d?.anchors) ||
    d.anchors.length === 0
  ) {
    return null;
  }

  let chosen = null;
  for (const a of contentAnchors(d.anchors)) {
    if (!a?.id || typeof a.location !== "number") continue;
    if (a.location <= chosenLoc) chosen = a;
    else break;
  }

  return chosen;
}

/**
 * Deep link to the nearest anchor at/before the first match. Falls back to
 * the page URL when there is nothing to anchor to.
 */
export function pickAnchorHref(d, locs) {
  const chosen = pickContentAnchor(d, locs);
  return chosen?.id ? `${d.url}#${chosen.id}` : d.url;
}

/* ── Verse index (scripture keyword search) ──────────────────────────── */

// Scripture keyword search runs against /search/verses.json (generated by
// scripts/build-verse-index.mjs) instead of Pagefind: the whole NT is small
// enough (~850 KB raw, ~270 KB gzipped) to ship as plain text and scan
// linearly, which gives verse-exact results, true counts, and clean
// `/john-3#v16` deep links. The file is fetched lazily — only when a
// scripture keyword search actually runs — then held in memory and HTTP
// cache.
//
// Matching is whole-word/phrase: both the query and the verse text are
// tokenized on non-alphanumerics (so hyphens and apostrophes act as word
// boundaries: "well" matches "well-known"), and multi-word queries must
// appear as consecutive tokens. Two niceties, both derived client-side
// from the shipped corpus vocabulary, apply to single unquoted tokens of
// 5+ chars (mirroring what buildPfQuery's quoting rules exempted — quoted
// queries, phrases, and 1–4 char tokens stay exact):
// - RELATED FORMS: the vocabulary is stemmed (src/lib/word-stem.mjs) and
//   grouped at load, and a query token expands to its stem group, so
//   "liberation" also finds "liberate" (what Pagefind's stemming gave).
// - TYPO CORRECTION: when a query has zero hits, the nearest vocabulary
//   word by edit distance is searched instead ("jeribulem" → results for
//   "jerusalem"), reported via the hit list's `correction`.

import { stemWord, foldDiacritics } from "../lib/word-stem.mjs";

const WORD_RE = /[\p{L}\p{N}]+/gu;

/** Comparable token: lowercased, diacritics folded ("lemá" → "lema"). */
function foldToken(s) {
  return foldDiacritics(s.toLowerCase());
}

let verseIndexPromise = null;

/**
 * Load /search/verses.json once. Resolves to
 * { verses, vocab, formsByStem } —
 * verses: { bookKey: { chapter: ["verse 1 text", ...] } };
 * vocab: every distinct corpus word (typo-correction candidates);
 * formsByStem: Map(stem → [surface forms]) for related-form expansion —
 * or null on failure (a failed fetch is retried on the next call).
 */
export function loadVerseIndex(base) {
  if (!verseIndexPromise) {
    verseIndexPromise = (async () => {
      try {
        const res = await fetch(`${base}search/verses.json`);
        if (!res.ok) throw new Error(`verses.json missing (${res.status})`);

        const json = await res.json();
        const verses =
          json?.verses && typeof json.verses === "object" ? json.verses : null;
        if (!verses) throw new Error("verses.json has no .verses object.");

        const vocab = Array.isArray(json.vocab) ? json.vocab : [];

        // Group the vocabulary by stem once (~6.4k words, a few ms).
        // Stemming corpus words and query words with the same function is
        // what makes related-form matching correct.
        const formsByStem = new Map();
        for (const word of vocab) {
          const stem = stemWord(word);
          if (!formsByStem.has(stem)) formsByStem.set(stem, []);
          formsByStem.get(stem).push(word);
        }

        return { verses, vocab, formsByStem };
      } catch (e) {
        console.warn("[search] Failed to load verse index:", e);
        verseIndexPromise = null;
        return null;
      }
    })();
  }
  return verseIndexPromise;
}

/** Comparable word tokens of a query ("God’s Reign!" → ["god","s","reign"]). */
export function tokenizeQuery(raw) {
  const tokens = [];
  for (const m of String(raw || "").matchAll(WORD_RE)) {
    tokens.push(foldToken(m[0]));
  }
  return tokens;
}

/**
 * Character ranges of each occurrence of the query-token sequence in one
 * verse's text (offsets index the ORIGINAL text, for highlighting). Each
 * matcher is a string (exact token) or a Set of acceptable tokens (related
 * forms). Occurrences don't overlap: matching resumes after each hit.
 */
function findTokenRuns(text, qMatchers) {
  const words = [];
  for (const m of text.matchAll(WORD_RE)) {
    words.push({
      w: foldToken(m[0]),
      start: m.index,
      end: m.index + m[0].length,
    });
  }

  const runs = [];
  const n = qMatchers.length;

  for (let i = 0; i + n <= words.length; i++) {
    let ok = true;
    for (let j = 0; j < n; j++) {
      const q = qMatchers[j];
      const w = words[i + j].w;
      if (q instanceof Set ? !q.has(w) : w !== q) {
        ok = false;
        break;
      }
    }
    if (ok) {
      runs.push({ start: words[i].start, end: words[i + n - 1].end });
      i += n - 1;
    }
  }

  return runs;
}

/** True when the related-form/typo niceties apply (see section comment). */
function isExpandableQuery(qTokens, rawQuery) {
  return (
    qTokens.length === 1 &&
    qTokens[0].length >= 5 &&
    !isExplicitlyQuoted(normalizeQuotes(rawQuery))
  );
}

/** Token matchers for one query: the token's stem group when expandable. */
function buildMatchers(index, qTokens, expandable) {
  if (expandable) {
    const group = index.formsByStem?.get(stemWord(qTokens[0]));
    if (group) return [new Set([qTokens[0], ...group])];
  }
  return qTokens;
}

/**
 * Nearest vocabulary word to a mistyped token. Auto-showing results for a
 * different word is a high-confidence act, so beyond the fuzzy-topic
 * distance threshold a candidate must look like a genuine misspelling:
 * share the token's first two letters (typos rarely hit a word's start)
 * and be within one character of its length (substitutions/transpositions/
 * a single indel — not wholesale deletions). Distance-3 corrections must
 * additionally share a 3-char suffix: "jeribulem" → "jerusalem" (…lem)
 * passes, but "forgivness" → "foreigners" is refused — the LIT corpus has
 * no word near some queries, and no answer beats a misleading one (the
 * glossary/topic buckets still guide those). Refused queries fall through
 * to the softer "Did you mean" topic pills. Ties prefer the alphabetically
 * first word (vocab is sorted, so first-wins).
 */
function nearestVocabWord(vocab, token) {
  const threshold = Math.max(2, Math.ceil(token.length * 0.3));
  const prefix = token.slice(0, 2);
  const suffix = token.slice(-3);
  let best = null;
  let bestDist = threshold + 1;

  for (const word of vocab || []) {
    if (word === token) continue;
    if (!word.startsWith(prefix)) continue;
    if (Math.abs(word.length - token.length) > 1) continue;
    const dist = levenshtein(token, word);
    if (dist >= bestDist) continue;
    if (dist > 2 && !word.endsWith(suffix)) continue;
    best = word;
    bestDist = dist;
  }

  return bestDist <= threshold ? best : null;
}

function scanVerses(verses, qMatchers, bookKey, exactToken) {
  const hits = [];
  const books = bookKey ? [bookKey] : BOOK_ORDER;

  for (const bk of books) {
    const chapters = verses[bk];
    if (!chapters) continue;

    const chapterNums = Object.keys(chapters)
      .map(Number)
      .sort((a, b) => a - b);

    for (const ch of chapterNums) {
      const verseTexts = chapters[ch];
      if (!Array.isArray(verseTexts)) continue;

      for (let vi = 0; vi < verseTexts.length; vi++) {
        const text = verseTexts[vi];
        if (!text) continue;

        const runs = findTokenRuns(text, qMatchers);
        if (!runs.length) continue;

        // How many runs are the token as typed (vs a related form) —
        // relevance ranks those first, like Pagefind ranked exact matches
        // above stemmed ones.
        const exactRuns = exactToken
          ? runs.filter(
              (r) => foldToken(text.slice(r.start, r.end)) === exactToken,
            ).length
          : runs.length;

        hits.push({
          bookKey: bk,
          chapter: ch,
          verse: vi + 1,
          text,
          runs,
          exactRuns,
        });
      }
    }
  }

  return hits;
}

/**
 * Scan the verse index for a query. Returns { hits, correction }:
 * hits — [{ bookKey, chapter, verse, text, runs }] in canonical Bible
 * order, one per matching verse, `runs` holding the char ranges of every
 * occurrence; correction — the vocabulary word actually searched when the
 * typed token had no hits ("" when the query matched as typed), for the
 * UIs' "showing results for …" note.
 *
 * `index` is loadVerseIndex's { verses, vocab, formsByStem }. Single
 * unquoted tokens of 5+ chars expand to their related-form group and fall
 * back to typo correction; everything else matches exactly.
 */
export function searchVerses(index, rawQuery, { bookKey = "" } = {}) {
  const verses = index?.verses;
  const qTokens = tokenizeQuery(rawQuery);
  if (!verses || !qTokens.length) return { hits: [], correction: "" };

  const expandable = isExpandableQuery(qTokens, rawQuery);

  let hits = scanVerses(
    verses,
    buildMatchers(index, qTokens, expandable),
    bookKey,
    expandable ? qTokens[0] : null,
  );

  if (!hits.length && expandable) {
    const corrected = nearestVocabWord(index.vocab, qTokens[0]);
    if (corrected) {
      hits = scanVerses(
        verses,
        buildMatchers(index, [corrected], true),
        bookKey,
        corrected,
      );
      if (hits.length) return { hits, correction: corrected };
    }
  }

  return { hits, correction: "" };
}

/**
 * Relevance order for verse hits (a NEW array; the input stays in Bible
 * order): verses containing the token as typed rank above related-form
 * matches (like Pagefind ranked exact above stemmed), more occurrences
 * rank above fewer, and Bible order breaks ties. The tray's top results
 * and the /search "Relevance" sort both use this.
 */
export function rankVerseHits(hits) {
  return hits
    .map((hit, bibleIdx) => ({ hit, bibleIdx }))
    .sort((a, b) => {
      const aExact = a.hit.exactRuns > 0 ? 1 : 0;
      const bExact = b.hit.exactRuns > 0 ? 1 : 0;
      if (aExact !== bExact) return bExact - aExact;
      if (a.hit.runs.length !== b.hit.runs.length) {
        return b.hit.runs.length - a.hit.runs.length;
      }
      return a.bibleIdx - b.bibleIdx;
    })
    .map(({ hit }) => hit);
}

/** "John 3:16" label for a verse hit. */
export function verseHitLabel(hit) {
  return formatReferenceLabel({
    bookKey: hit.bookKey,
    chapter: hit.chapter,
    verse: hit.verse,
    rangeEnd: null,
  });
}

/** Study View deep link ("/john-3#v16") for a verse hit. */
export function verseHitHref(hit) {
  return makeStudyReferenceHref({
    bookKey: hit.bookKey,
    chapter: hit.chapter,
    verse: hit.verse,
    rangeEnd: null,
  });
}

/** Escaped verse text with each matched run wrapped in <mark>. */
export function highlightVerseHit(hit) {
  const { text, runs } = hit;
  let out = "";
  let pos = 0;

  for (const r of runs) {
    out += `${escapeHtml(text.slice(pos, r.start))}<mark>${escapeHtml(
      text.slice(r.start, r.end),
    )}</mark>`;
    pos = r.end;
  }

  return out + escapeHtml(text.slice(pos));
}

/* ── Result enrichment + bucketing ───────────────────────────────────── */

/** Glossary results match by URL or by explicit meta type. */
export function isGlossaryResult(d) {
  return isGlossaryUrl(d?.url) || String(d?.meta?.type || "") === "glossary";
}

/**
 * Strict article check: any indexed page that is neither a scripture
 * chapter/intro path nor a glossary page.
 */
export function isArticleResultUrl(url) {
  return !!url && !parseScripturePath(url) && !isGlossaryUrl(url);
}

/** Book-introduction pages (/mark-intro) — bucketed separately so intro
 * hits are never mistaken for scripture chapter results. */
export function isIntroResultUrl(url) {
  return !!parseScripturePath(url)?.isIntro;
}

function cleanGlossaryTitle(s) {
  let t = String(s || "").trim();
  t = t.replace(/^glossary\s*[-—:]\s*/i, "");
  t = t.replace(/\s*[-—:]\s*glossary$/i, "");
  return t.trim();
}

/* Parsed once per page: the embedded map is static build output. */
let glossaryTermsCache;

/**
 * Glossary term metadata embedded by SearchBar.astro as
 * `<script type="application/json" data-glossary-terms>` — a map of entry id
 * (the entry's /glossary heading anchor id) → { traditional, lit } straight
 * from the glossary collection frontmatter. Returns null when the page has
 * no embed or it fails to parse.
 */
export function glossaryTermsFromDom() {
  if (glossaryTermsCache !== undefined) return glossaryTermsCache;
  glossaryTermsCache = null;

  if (typeof document === "undefined") return glossaryTermsCache;

  const el = document.querySelector(
    'script[type="application/json"][data-glossary-terms]',
  );
  if (!el) return glossaryTermsCache;

  try {
    const parsed = JSON.parse(el.textContent || "");
    if (parsed && typeof parsed === "object") glossaryTermsCache = parsed;
  } catch {
    // Malformed embed — callers fall back to anchor-id parsing.
  }

  return glossaryTermsCache;
}

/**
 * Term-level title for a glossary result. The matched entry's heading anchor
 * id is the entry's frontmatter id, so it's first looked up in the embedded
 * term-metadata map (see glossaryTermsFromDom) for the real
 * "Traditional → lit rendering" label. Entries missing from the map fall
 * back to splitting the anchor id on its FIRST hyphen per the
 * `<traditional>-<lit>` filename convention (approximate: breaks for
 * multi-word traditional terms and lossy ids like "hell-hades"), then to
 * explicit meta, then the cleaned page title.
 *
 * Takes the same precomputed locs as pickAnchorHref so the term label and
 * the deep link are guaranteed to name the same entry.
 */
export function glossaryTermFromResult(d, locs, fallback = "") {
  const anchor = pickContentAnchor(d, locs);
  const anchorId =
    anchor && anchor.element === "h2" ? String(anchor.id || "") : "";

  const termMeta = anchorId ? glossaryTermsFromDom()?.[anchorId] : null;
  if (termMeta?.traditional && termMeta?.lit) {
    return `${termMeta.traditional} → ${termMeta.lit}`;
  }

  if (anchorId.includes("-")) {
    const [traditional, ...litParts] = anchorId.split("-");
    const cap = traditional.charAt(0).toUpperCase() + traditional.slice(1);
    return `${cap} → ${litParts.join(" ")}`;
  }

  const metaTerm =
    d?.meta?.glossary_term || d?.meta?.term || d?.meta?.entry || "";

  if (metaTerm) return String(metaTerm).trim();

  const title = d?.meta?.title || d?.title || "";
  const cleaned = cleanGlossaryTitle(title);
  return cleaned || String(fallback || "").trim() || "Glossary";
}

/**
 * Compute the per-result match signals both surfaces bucket on:
 * - locs: match word-locations (accepted precomputed so callers that already
 *   derived them — e.g. for pickAnchorHref — keep a single source of truth)
 * - subjectHit: the query exactly matches one of the page's topics/tags
 */
export function enrichSearchResult(d, relevanceRank, { qPhrase, locs }) {
  locs = locs ?? getMatchLocations(d);

  const subjects = [
    ...parseMetaList(d?.meta?.topics),
    ...parseMetaList(d?.meta?.tags),
  ];

  const subjectHit =
    !!qPhrase && subjects.map(normalizePhrase).includes(qPhrase);

  return { d, relevanceRank, locs, subjectHit };
}

/** Enriched-item shape for docs that come from the topics index, not Pagefind. */
export function topicsIndexSubjectItem(d) {
  return {
    d,
    locs: [],
    subjectHit: true,
  };
}

/**
 * The filter → dedupe → bucket orchestration shared by the tray and the
 * /search page. Takes enriched Pagefind items (see enrichSearchResult) and
 * returns { glossary, subject, article, intro } — the scripture KEYWORD
 * bucket comes from searchVerses, not from Pagefind, so it is not built here:
 *
 * - glossary: exclusive bucket, Pagefind relevance order
 * - intro: exclusive bucket for book-introduction pages (owner decision
 *   2026-07-09: intro prose is Pagefind-indexed, but hits must display
 *   under their own "Book introductions" label so they can't be confused
 *   with scripture results), Bible order
 * - subject: exact topic hits (plus/instead of `extraSubjectItems` from the
 *   topics index — `replaceSubject` replaces Pagefind subject hits when
 *   extras exist, otherwise extras merge in with URL dedupe), Bible order
 * - article: every non-scripture non-glossary URL from either source,
 *   relevance order
 */
export function bucketSearchResults(
  enriched,
  { extraSubjectItems = [], replaceSubject = false } = {},
) {
  const glossary = [];
  const intro = [];
  const nonGlossary = [];
  for (const it of enriched) {
    if (isGlossaryResult(it.d)) glossary.push(it);
    else if (isIntroResultUrl(it.d?.url || "")) intro.push(it);
    else nonGlossary.push(it);
  }

  let subject = nonGlossary.filter((it) => it.subjectHit);

  if (extraSubjectItems.length) {
    if (replaceSubject) {
      subject = extraSubjectItems.slice();
    } else {
      const seen = new Set(subject.map((it) => it.d?.url));
      for (const it of extraSubjectItems) {
        const url = it.d?.url;
        if (!url || seen.has(url)) continue;
        seen.add(url);
        subject.push(it);
      }
    }
  }

  const article = [];
  const articleSeen = new Set();
  const collectArticle = (it) => {
    const url = it.d?.url || "";
    if (!isArticleResultUrl(url) || articleSeen.has(url)) return;
    articleSeen.add(url);
    article.push(it);
  };
  // Scan ALL non-glossary hits, then any article URLs that only came in via
  // the topics index.
  for (const it of nonGlossary) collectArticle(it);
  for (const it of subject) collectArticle(it);

  subject = subject.filter((it) => !isArticleResultUrl(it.d?.url || ""));

  subject.sort((a, b) =>
    bibleOrderCompareHref(a.d?.url || "", b.d?.url || ""),
  );
  article.sort((a, b) => (a.relevanceRank ?? 9999) - (b.relevanceRank ?? 9999));
  intro.sort((a, b) => bibleOrderCompareHref(a.d?.url || "", b.d?.url || ""));

  return { glossary, subject, article, intro };
}

/* ── Topics index loader ─────────────────────────────────────────────── */

/**
 * Load and normalize /topics-index.json once.
 * Returns { topicsList, topicsUrlMap } or null on failure.
 * - topicsList: [{ label, norm, count }] sorted by label — for autocomplete
 *   and fuzzy suggestions. When two labels normalize identically the shorter
 *   label wins.
 * - topicsUrlMap: Map(norm → [{ url, type, book, chapter, title, topic }]).
 *
 * `cache` is a fetch cache mode. The tray passes "force-cache" (speed —
 * suggestions may lag a deploy); the /search page passes "no-store"
 * (freshness for full results). These were the two surfaces' original,
 * deliberate strategies.
 */
export async function loadTopicsIndex(base, { cache } = {}) {
  try {
    const res = await fetch(
      `${base}topics-index.json`,
      cache ? { cache } : undefined,
    );
    if (!res.ok) throw new Error(`topics-index.json missing (${res.status})`);

    const json = await res.json();
    const topicsObj =
      json?.topics && typeof json.topics === "object" ? json.topics : null;
    if (!topicsObj) throw new Error("topics-index.json has no .topics object.");

    const byNorm = new Map();
    const topicsUrlMap = new Map();

    for (const [topicKey, docsRaw] of Object.entries(topicsObj)) {
      const docsArr = Array.isArray(docsRaw) ? docsRaw : [];
      if (!docsArr.length) continue;

      const rawLabel =
        String(
          docsArr[0]?.topicLabel || docsArr[0]?.topic || topicKey || "",
        ).trim() || String(topicKey || "").trim();

      const norm = normalizePhrase(rawLabel);
      if (!norm) continue;

      const docs = docsArr
        .map((d) => ({
          url: String(d?.url || ""),
          type: String(d?.type || ""),
          book: String(d?.book || ""),
          chapter: d?.chapter != null ? String(d.chapter) : "",
          title: String(d?.title || ""),
          topic: rawLabel,
        }))
        .filter((d) => d.url);

      // Merge docs when distinct labels normalize to the same topic
      const prevDocs = topicsUrlMap.get(norm) || [];
      const seen = new Set(prevDocs.map((d) => d.url));
      for (const d of docs) {
        if (!seen.has(d.url)) {
          prevDocs.push(d);
          seen.add(d.url);
        }
      }
      topicsUrlMap.set(norm, prevDocs);

      const count = docsArr.length;
      const prev = byNorm.get(norm);
      if (!prev) {
        byNorm.set(norm, { label: rawLabel, norm, count });
      } else {
        byNorm.set(norm, {
          label:
            rawLabel.length < String(prev.label || "").length
              ? rawLabel
              : prev.label,
          norm,
          count: Math.max(Number(prev.count || 0), count),
        });
      }
    }

    const topicsList = Array.from(byNorm.values()).sort((a, b) =>
      a.label.localeCompare(b.label),
    );

    return { topicsList, topicsUrlMap };
  } catch (e) {
    console.warn("[search] Failed to load topics-index.json:", e);
    return null;
  }
}
