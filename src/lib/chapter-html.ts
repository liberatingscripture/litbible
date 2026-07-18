// Server-side (build-time) HTML transforms for scripture chapter paragraphs.
//
// The raw chapter JSON `paragraphs` are the mobile-app contract and are never
// modified; these transforms run only when rendering the website. Two views
// consume them with different needs:
//
// - Study View (/[slug].astro): one page per chapter. Keeps `#vN` verse ids,
//   adds OSIS ids and Pagefind indexing helpers.
// - Reading Mode (/read/[book].astro): all chapters of a book on one page.
//   Strips footnote refs, namespaces verse ids to `<book>-<ch>-vN`, and moves
//   each verse id onto a standalone anchor span so highlighting/anchoring
//   works in the continuous layout.
//
// Use `prepareStudyParagraph` / `prepareReadParagraph`; the individual passes
// are private so the two views can't drift apart again.

/* ── Shared passes ───────────────────────────────────────────────────── */

/**
 * When a verse spans a paragraph break, the verse number is intentionally
 * repeated at the start of the continuation paragraph (e.g. Mark 14:62).
 * Keep the visible number but drop the duplicate id so HTML stays valid and
 * anchors target only the first occurrence. Both views run this on raw
 * `v<N>` ids (Reading Mode dedupes BEFORE namespacing them).
 */
function dropDuplicateVerseIds(html: string, seen: Set<string>): string {
  return html.replace(
    /<sup\b([^>]*?)\s*id="(v\d+)"([^>]*)>/g,
    (match, before: string, vid: string, after: string) => {
      if (seen.has(vid)) return `<sup${before}${after}>`;
      seen.add(vid);
      return match;
    },
  );
}

/**
 * Re-glue Hebrew-poetry (`hbq-line`) verse openings: the verse number sticks
 * to only the FIRST word (wrapped in `.hbq-first`) so long poetry lines can
 * wrap, instead of gluing the number to the entire line.
 */
function normalizeHbqVerseGlue(html: string): string {
  const source = String(html ?? "");
  if (!source.includes("hbq-line") || !source.includes('class="vglue"')) {
    return source;
  }

  return source.replace(
    /<p\b[^>]*class=(['"])[^'"]*\bhbq-line\b[^'"]*\1[^>]*>[\s\S]*?<\/p>/gi,
    (lineHtml: string) => {
      if (lineHtml.includes("hbq-first") || lineHtml.includes("hbq-rest")) {
        return lineHtml;
      }

      return lineHtml.replace(
        /^(<p\b[^>]*class=(['"])[^'"]*\bhbq-line\b[^'"]*\2[^>]*>\s*(?:<span class="rm-verse-anchor"[^>]*>\s*<\/span>\s*)*)<span class="vglue">\s*(<sup\b[^>]*\bclass=(['"])[^'"]*\bvn\b[^'"]*\4[^>]*>[\s\S]*?<\/sup>)\s*(?:&nbsp;|\s)\s*([\s\S]*?)<\/span>([\s\S]*?)(<\/p>)$/i,
        (
          _match: string,
          lineOpen: string,
          _lineQuote: string,
          sup: string,
          _supQuote: string,
          firstChunk: string,
          tailChunk: string,
          lineClose: string,
        ) => {
          const combined = `${String(firstChunk ?? "")}${String(tailChunk ?? "")}`;
          const combinedTrimmed = combined.replace(/^\s+/, "");
          const firstMatch = combinedTrimmed.match(
            /^((?:<[^>]+>\s*)*)(\S+)([\s\S]*)$/,
          );

          if (!firstMatch) {
            return lineHtml;
          }

          const leadingTags = firstMatch[1] ?? "";
          const firstWord = `${leadingTags}${firstMatch[2] ?? ""}`;
          const rest = firstMatch[3] ?? "";
          const restHtml = rest ? `<span class="hbq-rest">${rest}</span>` : "";

          return `${lineOpen}<span class="vglue">${sup}&#8288;<span class="hbq-first">${firstWord}</span></span>${restHtml}${lineClose}`;
        },
      );
    },
  );
}

/* ── Study View passes ───────────────────────────────────────────────── */

/**
 * Normalize `.vglue` whitespace so the verse number stays glued to the verse's
 * first word.
 *
 * The separator between `</sup>` and the first word may be an `&nbsp;` entity
 * (the corpus convention — all vglue spans use it today) or any literal
 * whitespace; `\s` covers a real U+00A0 as well. Whatever it is, it is rewritten
 * to `&nbsp;`. Accepting a plain space matters because nothing validates the
 * `&nbsp;` convention: a hand-edited chapter using a plain space would otherwise
 * fail this pattern entirely and pass through unglued.
 */
function normalizeStudyVerseGlue(html: string): string {
  return String(html ?? "").replace(
    /<span class="vglue">\s*(<sup\b[^>]*\bclass=(['"])[^'"]*\bvn\b[^'"]*\2[^>]*>[\s\S]*?<\/sup>)\s*(?:&nbsp;|\s)\s*([\s\S]*?)<\/span>/gi,
    (_match, sup: string, _quote: string, text: string) => {
      return `<span class="vglue">${sup}&nbsp;${text}</span>`;
    },
  );
}

/**
 * Wrap each verse's inline content in `<span data-verse="N">` so verse
 * boundaries are DOM containers (CSS-targetable highlighting, trivial text
 * extraction in chapter-tools.js) instead of runtime TreeWalker
 * reconstructions. A verse that spans block boundaries (paragraph breaks,
 * poetry lines) gets one span per block, all sharing the same data-verse.
 *
 * Splitting each `<p>`'s inner HTML at `<span class="vglue">` openings is
 * nesting-safe by corpus convention: every vglue sits at tag-depth 0 within
 * its block and every block is balanced, so each segment is complete markup.
 * (This is a convention the authored JSON follows, not something the chapter
 * validator currently enforces — it checks only `indexed` and verse-id
 * uniqueness.) Text before a chapter's first verse marker is left unwrapped.
 *
 * `state.currentVerse` threads the active verse across paragraphs — pass
 * one state object per chapter.
 */
export type StudyVerseState = { currentVerse: number | null };

function wrapVerseSegments(html: string, state: StudyVerseState): string {
  const wrapSeg = (seg: string, verse: number) =>
    `<span data-verse="${verse}">${seg}</span>`;

  return String(html ?? "").replace(
    /(<p\b[^>]*>)([\s\S]*?)(<\/p>)/gi,
    (_match, open: string, inner: string, close: string) => {
      const starts = [...inner.matchAll(/<span class="vglue">/g)].map(
        (m) => m.index as number,
      );

      // No verse marker in this block: the whole line continues the
      // current verse (e.g. an unnumbered poetry line).
      if (!starts.length) {
        return state.currentVerse && inner.trim()
          ? open + wrapSeg(inner, state.currentVerse) + close
          : _match;
      }

      let out = open;

      const pre = inner.slice(0, starts[0]);
      out +=
        state.currentVerse && pre.trim()
          ? wrapSeg(pre, state.currentVerse)
          : pre;

      for (let i = 0; i < starts.length; i++) {
        const seg = inner.slice(starts[i], starts[i + 1] ?? inner.length);
        const vm = seg.match(
          /<sup\b[^>]*\bclass=(['"])[^'"]*\bvn\b[^'"]*\1[^>]*>(\d+)/i,
        );
        const verse = vm ? Number(vm[2]) : state.currentVerse;

        if (verse) {
          out += wrapSeg(seg, verse);
          state.currentVerse = verse;
        } else {
          out += seg;
        }
      }

      return out + close;
    },
  );
}

/**
 * Inject ARIA semantics onto Hebrew-poetry blockquote blocks.
 * Adds role="group" and aria-label="Poetry" so screen readers
 * identify these as grouped poetic content.
 */
function addHbqAria(html: string): string {
  return String(html ?? "").replace(
    /<blockquote\s+class="hbq"/g,
    '<blockquote class="hbq" role="group" aria-label="Poetry" aria-describedby="hbq-description"',
  );
}

/**
 * OSIS book abbreviation map (standard SBL/OSIS identifiers for the NT).
 * Used to generate data-osis="Book.Chapter.Verse" on verse number elements.
 */
const OSIS_BOOKS: Record<string, string> = {
  matthew: "Matt", mark: "Mark", luke: "Luke", john: "John", acts: "Acts",
  romans: "Rom", "1corinthians": "1Cor", "2corinthians": "2Cor",
  galatians: "Gal", ephesians: "Eph", philippians: "Phil", colossians: "Col",
  "1thessalonians": "1Thess", "2thessalonians": "2Thess",
  "1timothy": "1Tim", "2timothy": "2Tim", titus: "Titus", philemon: "Phlm",
  hebrews: "Heb", james: "Jas", "1peter": "1Pet", "2peter": "2Pet",
  "1john": "1John", "2john": "2John", "3john": "3John", jude: "Jude",
  revelation: "Rev",
};

/**
 * Inject data-osis="Book.Chapter.Verse" onto verse number <sup> elements.
 * Only targets <sup id="vN" class="vn"> — footnote refs use a different structure.
 */
function addOsisIds(html: string, osisBook: string, chapter: number): string {
  if (!osisBook || !chapter) return String(html ?? "");
  return String(html ?? "").replace(
    /<sup\b([^>]*)id="v(\d+)"([^>]*)>/g,
    (match, before, verse, after) => {
      if (match.includes("data-osis=")) return match;
      return `<sup${before}id="v${verse}"${after} data-osis="${osisBook}.${chapter}.${verse}">`;
    },
  );
}

/* ── Reading Mode passes ─────────────────────────────────────────────── */

function removeFootnoteRefs(html: string): string {
  return String(html || "").replace(
    /<sup\b[^>]*class=(['"])[^'"]*\bfn-ref\b[^'"]*\1[^>]*>[\s\S]*?<\/sup>/gi,
    "",
  );
}

/** Namespace `#vN` ids/links to `<book>-<ch>-vN` so a whole book can share one page. */
function rewriteVerseIdsAndAnchors(
  html: string,
  bookKey: string,
  chapter: number,
): string {
  return String(html || "")
    .replace(
      /\bid=(['"])v(\d+)\1/gi,
      (_match, quote: string, verse: string) =>
        `id=${quote}${bookKey}-${chapter}-v${verse}${quote}`,
    )
    .replace(
      /\bhref=(['"])#v(\d+)\1/gi,
      (_match, quote: string, verse: string) =>
        `href=${quote}#${bookKey}-${chapter}-v${verse}${quote}`,
    );
}

/**
 * Reading Mode's verse glue: like the Study version, but the verse id moves
 * off the <sup> onto an empty `.rm-verse-anchor` span placed before the
 * glued pair, so anchor targeting doesn't depend on the sup staying visible
 * (verse numbers can be toggled off in Reading Mode).
 */
function normalizeReadVerseGlue(html: string): string {
  return String(html || "").replace(
    /<span class="vglue">\s*(<sup\b[^>]*\bclass=(['"])[^'"]*\bvn\b[^'"]*\2[^>]*>[\s\S]*?<\/sup>)\s*(?:&nbsp;|\s)\s*([\s\S]*?)<\/span>/gi,
    (_match, sup: string, _quote: string, text: string) => {
      const idMatch = sup.match(/\bid=(['"])([^'"]+)\1/i);
      const verseId = idMatch?.[2] ? String(idMatch[2]) : "";
      const safeVerseId = verseId.replace(/[^A-Za-z0-9:_-]/g, "");
      const supWithoutId = safeVerseId
        ? sup.replace(/\s*\bid=(['"])[^'"]*\1/i, "")
        : sup;
      const verseAnchor = safeVerseId
        ? `<span class="rm-verse-anchor" id="${safeVerseId}" aria-hidden="true"></span>`
        : "";

      return `${verseAnchor}<span class="vglue">${supWithoutId}&nbsp;</span>${text}`;
    },
  );
}

/* ── Entry points ────────────────────────────────────────────────────── */

/**
 * Full Study View pipeline for one paragraph. `seenVerseIds` and
 * `verseState` must be fresh per chapter (duplicate verse ids are only
 * dropped — and the current verse only carries — within a chapter).
 */
export function prepareStudyParagraph(
  html: string,
  bookKey: string,
  chapter: number,
  seenVerseIds: Set<string>,
  verseState: StudyVerseState,
): string {
  const osisBook = OSIS_BOOKS[bookKey] ?? "";
  return wrapVerseSegments(
    addOsisIds(
      addHbqAria(
        normalizeHbqVerseGlue(
          normalizeStudyVerseGlue(dropDuplicateVerseIds(html, seenVerseIds)),
        ),
      ),
      osisBook,
      chapter,
    ),
    verseState,
  );
}

/**
 * Full Reading Mode pipeline for one paragraph. `seenVerseIds` must be a
 * fresh Set per chapter.
 */
export function prepareReadParagraph(
  html: string,
  bookKey: string,
  chapter: number,
  seenVerseIds: Set<string>,
): string {
  // Dedupe before namespacing: vN → <book>-<ch>-vN is one-to-one within a
  // chapter, so dropping duplicate vN ids first is equivalent and lets both
  // views share the same v\d+ matcher.
  const noFootnotes = removeFootnoteRefs(html);
  const deduped = dropDuplicateVerseIds(noFootnotes, seenVerseIds);
  return normalizeHbqVerseGlue(
    normalizeReadVerseGlue(
      rewriteVerseIdsAndAnchors(deduped, bookKey, chapter),
    ),
  );
}
