// src/scripts/search-core.js
//
// Shared search logic used by BOTH the SearchBar tray (searchbar.js) and the
// full /search page (search.js). Everything here is framework-free and
// side-effect-free: reference parsing, book aliases, Pagefind query building,
// result-location math, and the topics-index loader.
//
// Rule of thumb: if a behavior must agree between the tray and the full page
// (what counts as a reference, how a query is quoted, which anchors are
// content vs meta), it lives here. Page-specific rendering stays in the
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
 * Build the Pagefind query for a raw user query.
 * - Explicitly quoted queries pass through (single-token gets exact matching).
 * - Hyphenated single tokens are rewritten to match the index's
 *   "word- word" tokenization (see injectHyphenWordbreaks in [slug].astro).
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

  if (!/\s+/.test(canon) && /[\p{L}\p{N}]-(?=[\p{L}\p{N}])/u.test(canon)) {
    const pfPhrase = canon.replace(
      /([\p{L}\p{N}])-([\p{L}\p{N}])/gu,
      "$1- $2",
    );
    return { pfQuery: `"${pfPhrase}"`, exactSingleToken: false, exactToken: "" };
  }

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

export function isWordChar(ch) {
  if (!ch) return false;
  return /[\p{L}\p{N}_]/u.test(ch);
}

export function textHasWholeWord(text, term) {
  if (!text || !term) return false;

  const s = String(text).toLowerCase();
  const t = escapeRegExp(String(term).toLowerCase());

  const re = new RegExp(`(^|[^\\p{L}\\p{N}_])${t}([^\\p{L}\\p{N}_]|$)`, "u");
  return re.test(s);
}

export function textHasPhrase(text, phrase) {
  if (!text || !phrase) return false;
  return normalizePhrase(text).includes(normalizePhrase(phrase));
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

/** True when the excerpt contains a <mark>ed term as a whole word. */
export function excerptHasWholeWordMarkedTerm(excerptHtml, term) {
  if (!excerptHtml || !term) return false;

  const s = String(excerptHtml)
    .replace(/<mark>/gi, "\u0001")
    .replace(/<\/mark>/gi, "\u0002")
    .replace(/<[^>]+>/g, "");

  const t = String(term).toLowerCase();

  for (let i = 0; i < s.length; i++) {
    if (s[i] !== "\u0001") continue;

    const start = i + 1;
    const end = s.indexOf("\u0002", start);
    if (end === -1) break;

    const marked = s.slice(start, end);
    if (marked.toLowerCase() === t) {
      const before = s[i - 1];
      const after = s[end + 1];
      if (!isWordChar(before) && !isWordChar(after)) return true;
    }

    i = end;
  }

  return false;
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

/**
 * Meta-like hidden zones (topics/subjects/tags spans) as a UNION of word
 * ranges. Matches inside these zones are not "real" body matches.
 */
export function getMetaRangesFromAnchors(anchors) {
  if (!Array.isArray(anchors)) return [];

  const pairs = [
    ["pf-subjects-start", "pf-subjects-end"],
    ["pf-tags-start", "pf-tags-end"],
  ];

  const ranges = [];

  for (const [startId, endId] of pairs) {
    const start = anchors.find((a) => a?.id === startId)?.location;
    const end = anchors.find((a) => a?.id === endId)?.location;
    if (typeof start === "number" && typeof end === "number") {
      ranges.push(start <= end ? { start, end } : { start: end, end: start });
    }
  }

  ranges.sort((a, b) => a.start - b.start);

  const merged = [];
  for (const r of ranges) {
    const last = merged[merged.length - 1];
    if (!last || r.start > last.end) merged.push({ ...r });
    else last.end = Math.max(last.end, r.end);
  }

  return merged;
}

export function isInAnyRange(n, ranges) {
  return (ranges || []).some((r) => n >= r.start && n <= r.end);
}

export function hasNonMetaMatch(locs, metaRanges) {
  if (!metaRanges || metaRanges.length === 0) return true;
  return (locs || []).some((n) => !isInAnyRange(n, metaRanges));
}

export function pickBestNonMetaLocation(locs, metaRanges) {
  if (!Array.isArray(locs) || !locs.length) return null;
  if (!metaRanges || metaRanges.length === 0) return locs[0];

  const nonMeta = locs.filter((n) => !isInAnyRange(n, metaRanges));
  return nonMeta.length ? nonMeta[0] : locs[0];
}

/** Content anchors only (meta-zone markers removed), sorted by location. */
export function contentAnchors(anchors) {
  return (Array.isArray(anchors) ? [...anchors] : [])
    .filter((a) => {
      const id = a?.id ? String(a.id) : "";
      if (!id) return false;
      if (id.startsWith("pf-topics-")) return false;
      if (id.startsWith("pf-tags-")) return false;
      if (id.startsWith("pf-subjects-")) return false;
      return true;
    })
    .sort((a, b) => (a?.location ?? 0) - (b?.location ?? 0));
}

/**
 * The nearest content anchor at/before the first non-meta match, or null
 * when there is nothing to anchor to.
 */
export function pickContentAnchor(d, metaRanges, locs) {
  const chosenLoc = pickBestNonMetaLocation(locs, metaRanges);

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
 * Deep link to the nearest content anchor at/before the first non-meta
 * match. Falls back to the page URL when there is nothing to anchor to.
 */
export function pickAnchorHref(d, metaRanges, locs) {
  const chosen = pickContentAnchor(d, metaRanges, locs);
  return chosen?.id ? `${d.url}#${chosen.id}` : d.url;
}

/* ── Per-occurrence expansion ────────────────────────────────────────── */

/**
 * Scan a result's raw content for whole-word matches of the term and group
 * them by their nearest content anchor. Returns a Map(anchorId → { anchor,
 * matches }) or null when the content can't be scanned or nothing matches
 * (callers treat null as "one occurrence: the item itself").
 */
function scanOccurrenceGroups(item, searchTerm) {
  const content = item?.content || "";
  const anchors = Array.isArray(item?.anchors) ? item.anchors : [];
  const term = String(searchTerm || "")
    .toLowerCase()
    .trim();

  if (!content || !term || term.length < 2) {
    return null;
  }

  const sortedAnchors = contentAnchors(anchors);

  const escapedTerm = escapeRegExp(term);
  const regex = new RegExp(
    `(?<![\\p{L}\\p{N}_])${escapedTerm}(?![\\p{L}\\p{N}_])`,
    "giu",
  );

  // Pagefind anchor locations are word indexes, not character offsets.
  function charIndexToWordIndex(charIdx) {
    let words = 0;
    for (let i = 0; i < charIdx && i < content.length; i++) {
      if (content[i] === " " && i > 0 && content[i - 1] !== " ") {
        words++;
      }
    }
    return words;
  }

  const matchPositions = [];
  let m;
  while ((m = regex.exec(content)) !== null) {
    matchPositions.push({
      index: m.index, // character position (for excerpt slicing)
      length: m[0].length,
      wordIndex: charIndexToWordIndex(m.index), // word position (for anchors)
    });
  }

  if (matchPositions.length === 0) {
    return null;
  }

  function findNearestAnchor(wordIndex) {
    let best = null;
    for (const a of sortedAnchors) {
      if (typeof a.location !== "number") continue;
      if (a.location <= wordIndex) best = a;
      else break;
    }
    return best;
  }

  // Group matches by anchor ID — one "occurrence" per anchor region
  const groups = new Map();
  for (const pos of matchPositions) {
    const anchor = findNearestAnchor(pos.wordIndex);
    const key = anchor?.id || "__no_anchor__";
    if (!groups.has(key)) {
      groups.set(key, { anchor, matches: [] });
    }
    groups.get(key).matches.push(pos);
  }

  return groups;
}

/**
 * Count per-occurrence keyword matches without building excerpt cards —
 * the tray's status line only needs the number. Matches
 * expandToOccurrences' grouping exactly (unscannable content counts as 1).
 */
export function countOccurrences(item, searchTerm) {
  const groups = scanOccurrenceGroups(item, searchTerm);
  return groups ? groups.size : 1;
}

/**
 * Expand one Pagefind result into per-occurrence cards (deep-link URL,
 * highlighted excerpt) — one card per anchor group. Returns [item]
 * unchanged when the content can't be scanned.
 */
export function expandToOccurrences(item, searchTerm) {
  const groups = scanOccurrenceGroups(item, searchTerm);
  if (!groups) {
    return [item];
  }

  const content = item.content;
  const escapedTerm = escapeRegExp(
    String(searchTerm || "")
      .toLowerCase()
      .trim(),
  );

  const baseUrl = (item.url || "").replace(/#.*$/, "");
  const results = [];
  let occIdx = 0;

  for (const [anchorId, group] of groups) {
    const hash = anchorId !== "__no_anchor__" && anchorId ? `#${anchorId}` : "";
    const url = `${baseUrl}${hash}`;

    // Excerpt from the FIRST match in this group, with a window of context
    const firstMatch = group.matches[0];
    const WINDOW = 80; // chars before and after the match
    let excerptStart = Math.max(0, firstMatch.index - WINDOW);
    let excerptEnd = Math.min(
      content.length,
      firstMatch.index + firstMatch.length + WINDOW,
    );

    // Snap to word boundaries
    if (excerptStart > 0) {
      const spaceAfter = content.indexOf(" ", excerptStart);
      if (spaceAfter !== -1 && spaceAfter < firstMatch.index) {
        excerptStart = spaceAfter + 1;
      }
    }
    if (excerptEnd < content.length) {
      const spaceBefore = content.lastIndexOf(" ", excerptEnd);
      if (spaceBefore > firstMatch.index + firstMatch.length) {
        excerptEnd = spaceBefore;
      }
    }

    const excerptText = content.slice(excerptStart, excerptEnd);

    // Highlight ALL occurrences of the term within the excerpt window
    const excerptEscaped = escapeHtml(excerptText);
    const highlightRegex = new RegExp(
      `(?<![\\p{L}\\p{N}_])(${escapedTerm})(?![\\p{L}\\p{N}_])`,
      "giu",
    );
    const highlighted = excerptEscaped.replace(highlightRegex, "<mark>$1</mark>");

    const prefix = excerptStart > 0 ? "…" : "";
    const suffix = excerptEnd < content.length ? "…" : "";
    const excerptHtml = `${prefix}${highlighted}${suffix}`;

    // Strip leading verse numbers from the excerpt for cleaner display.
    const cleanedExcerpt = excerptHtml.replace(/^(…?)(\d{1,3})\s/, "$1");

    results.push({
      url,
      excerpt: cleanedExcerpt,
      meta: item.meta,
      title: item.title,
      content: item.content,
      anchors: item.anchors,
      filters: item.filters,
      __relevanceRank: item.__relevanceRank ?? 9999,
      __occurrenceIndex: occIdx,
      __baseUrl: baseUrl,
      __anchorId: anchorId,
      __matchCount: group.matches.length,
    });
    occIdx++;
  }

  return results;
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
 * Takes the same precomputed metaRanges/locs as pickAnchorHref so the term
 * label and the deep link are guaranteed to name the same entry.
 */
export function glossaryTermFromResult(d, metaRanges, locs, fallback = "") {
  const anchor = pickContentAnchor(d, metaRanges, locs);
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
 * - metaRanges/locs: where the matches sit relative to hidden meta zones
 *   (accepted precomputed so callers that already derived them — e.g. for
 *   pickAnchorHref — keep a single source of truth)
 * - subjectHit: the query exactly matches one of the page's topics/tags
 * - contentHit: the query appears in the visible excerpt text
 * - wholeWordOk: exact single-token queries matched as a whole word
 */
export function enrichSearchResult(
  d,
  relevanceRank,
  { qPhrase, exactSingleToken, exactToken, metaRanges, locs },
) {
  metaRanges = metaRanges ?? getMetaRangesFromAnchors(d?.anchors);
  locs = locs ?? getMatchLocations(d);

  const subjects = [
    ...parseMetaList(d?.meta?.topics),
    ...parseMetaList(d?.meta?.tags),
  ];

  const excerptText = stripTags(d?.excerpt);
  const isSingleToken = !!qPhrase && !qPhrase.includes(" ");

  const wholeWordOk =
    !exactSingleToken ||
    excerptHasWholeWordMarkedTerm(d?.excerpt, exactToken) ||
    textHasWholeWord(excerptText, exactToken);

  const contentHit = !qPhrase
    ? false
    : isSingleToken
      ? textHasWholeWord(excerptText, qPhrase)
      : textHasPhrase(excerptText, qPhrase);

  const subjectHit =
    !!qPhrase && subjects.map(normalizePhrase).includes(qPhrase);

  return { d, relevanceRank, metaRanges, locs, subjectHit, contentHit, wholeWordOk };
}

/** Enriched-item shape for docs that come from the topics index, not Pagefind. */
export function topicsIndexSubjectItem(d) {
  return {
    d,
    metaRanges: [],
    locs: [],
    subjectHit: true,
    contentHit: false,
    wholeWordOk: true,
  };
}

/**
 * The filter → dedupe → bucket orchestration shared by the tray and the
 * /search page. Takes enriched items (see enrichSearchResult) and returns
 * { glossary, subject, article, keyword }:
 *
 * - glossary: exclusive bucket, Pagefind relevance order
 * - subject: exact topic hits (plus/instead of `extraSubjectItems` from the
 *   topics index — `replaceSubject` replaces Pagefind subject hits when
 *   extras exist, otherwise extras merge in with URL dedupe), Bible order
 * - article: every non-scripture non-glossary URL from either source,
 *   relevance order
 * - keyword: real body matches only (non-meta location, not an intro, not a
 *   topics-only hit, whole word when the query demands it), relevance order
 */
export function bucketSearchResults(
  enriched,
  { extraSubjectItems = [], replaceSubject = false } = {},
) {
  const glossary = [];
  const nonGlossary = [];
  for (const it of enriched) {
    (isGlossaryResult(it.d) ? glossary : nonGlossary).push(it);
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

  let keyword = nonGlossary.filter((it) => {
    if (String(it.d?.meta?.type || "") === "intro") return false;
    if (!hasNonMetaMatch(it.locs, it.metaRanges)) return false;
    if (it.subjectHit && !it.contentHit) return false;
    // wholeWordOk is always true for non-exact queries.
    return it.wholeWordOk;
  });

  const article = [];
  const articleSeen = new Set();
  const collectArticle = (it) => {
    const url = it.d?.url || "";
    if (!isArticleResultUrl(url) || articleSeen.has(url)) return;
    articleSeen.add(url);
    article.push(it);
  };
  // Scan ALL non-glossary hits (not just bucket survivors) so articles
  // aren't lost by the stricter keyword filters, then any article URLs
  // that only came in via the topics index.
  for (const it of nonGlossary) collectArticle(it);
  for (const it of subject) collectArticle(it);

  subject = subject.filter((it) => !isArticleResultUrl(it.d?.url || ""));
  keyword = keyword.filter((it) => !isArticleResultUrl(it.d?.url || ""));

  subject.sort((a, b) =>
    bibleOrderCompareHref(a.d?.url || "", b.d?.url || ""),
  );
  keyword.sort((a, b) => (a.relevanceRank ?? 9999) - (b.relevanceRank ?? 9999));
  article.sort((a, b) => (a.relevanceRank ?? 9999) - (b.relevanceRank ?? 9999));

  return { glossary, subject, article, keyword };
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
