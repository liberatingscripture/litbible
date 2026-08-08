// scripts/lib/release-notes-core.mjs
//
// The pure diff→changes core of draft-release-notes.mjs. Given the lists of
// added/modified files and two content-lookup callbacks (old content at the
// base ref, current content), it returns the array of release-notes change
// objects — with NO git, fs, argv, or process access of its own. The CLI wrapper
// (scripts/draft-release-notes.mjs) wires real git/fs into buildChanges and
// handles argument parsing, the date/version envelope, and the --write merge.
//
// This split exists so the change-object contract (see the docblock in
// draft-release-notes.mjs and the release-notes.json schema shared with the
// iOS/Android apps) can be unit-tested directly — test/draft-release-notes.test.js
// calls buildChanges with in-memory fixtures. Keep all diff→changes logic here,
// never in the CLI wrapper, so the tests exercise what CI actually runs.

import { basename } from "path";

import { BOOKS, BOOK_ORDER, bookKeyToLabel } from "../../src/data/books.js";

// ── Pure helpers ──────────────────────────────────────────────────────────────

/** Normalize markup so that non-content HTML attributes (target, rel, class,
 *  id, style, role, tabindex, loading, decoding, aria-*, data-*) and
 *  insignificant whitespace don't register as changes. Visible text and
 *  semantic attributes (href, src, alt, title) are preserved, so genuine edits
 *  still count — but mechanical ones (e.g. stripping target="_blank"/rel from a
 *  link) don't. */
function normalizeMarkup(text) {
  return (text ?? "")
    .replace(
      /\s+(?:target|rel|class|id|style|role|tabindex|loading|decoding|aria-[\w-]+|data-[\w-]+)\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi,
      ""
    )
    .replace(/\s+/g, " ")
    .trim();
}

/** Extract all verse numbers found in an HTML string. */
function extractVerses(html) {
  return [...(html ?? "").matchAll(/id="v(\d+)"/g)].map((m) =>
    parseInt(m[1], 10)
  );
}

/** Describe a sorted list of verse numbers as a compact range string.
 *  e.g. [1,2,3,5,6] → "1–3, 5–6" */
function formatVerseRange(verses) {
  if (!verses.length) return "";
  const sorted = [...new Set(verses)].sort((a, b) => a - b);
  const ranges = [];
  let start = sorted[0];
  let end = sorted[0];
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] === end + 1) {
      end = sorted[i];
    } else {
      ranges.push(start === end ? `${start}` : `${start}–${end}`);
      start = end = sorted[i];
    }
  }
  ranges.push(start === end ? `${start}` : `${start}–${end}`);
  return ranges.join(", ");
}

/** The smallest verse number in a list — used as the "anchor" a deep link
 *  targets when a change spans a range of verses. Returns null if none. */
function anchorVerse(verses) {
  const nums = (verses ?? []).filter((v) => Number.isFinite(v));
  return nums.length ? Math.min(...nums) : null;
}

/** Build the platform-neutral `location` object the apps use to deep-link a
 *  change to `bookKey chapter:verse` (see release-notes.json schema). `verse`
 *  is omitted for whole-chapter changes. `footnoteId` is intentionally NOT
 *  emitted yet: a stable, relabel-proof id only helps once the same id is also
 *  anchored in the chapter content JSON, so apps fall back to verse-level
 *  navigation until then. `bookKey` is the website URL-slug the apps already map. */
function scriptureLocation(bookKey, chapter, verse) {
  const loc = { bookKey, chapter };
  if (verse != null) loc.verse = verse;
  return loc;
}

/** Strip all HTML tags and decode common entities to plain text. */
function stripHtml(html) {
  return (html ?? "")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&rdquo;/g, "”")
    .replace(/&ldquo;/g, "“")
    .replace(/&rsquo;/g, "’")
    .replace(/&lsquo;/g, "‘")
    .replace(/&mdash;/g, "—")
    .replace(/&ndash;/g, "–")
    .replace(/&#?\w+;/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Remove footnote-reference superscripts from paragraph HTML so that
 *  text comparisons aren't affected by footnote additions/removals. */
function stripFootnoteRefs(html) {
  return (html ?? "").replace(/<sup class="fn-ref">.*?<\/sup>/g, "");
}

/** Remove the literal `[|` / `|]` markers that wrap contested passages (see
 *  "Bracketed passages" in CLAUDE.md). They are plain characters in the
 *  paragraph text rather than markup, so stripHtml leaves them in place and
 *  they reach reader-facing detail strings as `added "[|"`, which means
 *  nothing to someone reading Translation Updates in the apps.
 *
 *  They also skew attribution. The opening marker leads its paragraph, which
 *  puts it BEFORE that paragraph's first verse marker, so the vglue split in
 *  extractVerseTexts files it under the PREVIOUS verse and reports a verse
 *  that never changed.
 *
 *  Deliberately NOT applied to the paragraph-level fallback comparison in
 *  buildChanges: leaving the markers visible there means a bracket-only edit
 *  still surfaces as a real "text updated" row (with no detail) instead of
 *  vanishing from the changelog altogether. */
function stripBracketMarkers(text) {
  return (text ?? "").replace(/\[\||\|\]/g, "");
}

/** Build a Map<verseNumber, plainText> from an array of paragraph HTML strings.
 *  Footnote references and bracket markers are stripped before extraction so
 *  only body text is compared. */
function extractVerseTexts(paragraphs) {
  const combined = paragraphs.map(stripFootnoteRefs).join("\n");
  const parts = combined.split(/(?=<span class="vglue"><sup id="v\d+)/);
  const verses = new Map();
  for (const part of parts) {
    const m = part.match(/<sup id="v(\d+)"/);
    if (!m) continue;
    const vNum = parseInt(m[1], 10);
    // Collapse whitespace again after removing the markers, so the gap a
    // stripped `[|` leaves behind doesn't read as a text change of its own.
    const text = stripBracketMarkers(stripHtml(part))
      .replace(/\s+/g, " ")
      .replace(/^\d+\s*/, "")
      .trim();
    verses.set(vNum, text);
  }
  return verses;
}

/** Find the verse number that contains the footnote reference with the given label. */
function findFootnoteVerse(paragraphs, fnLabel) {
  const needle = `fnref-${fnLabel}"`;
  for (const para of paragraphs) {
    const idx = para.indexOf(needle);
    if (idx === -1) continue;
    const before = para.substring(0, idx);
    const matches = [...before.matchAll(/id="v(\d+)"/g)];
    if (matches.length) return parseInt(matches[matches.length - 1][1], 10);
    // No verse marker precedes the reference. That is the opening `[|` of a
    // bracketed passage, whose footnote marker leads the paragraph ahead of
    // the first vglue, so the note introduces the verse that FOLLOWS it.
    // Guarded on the bracket rather than falling forward unconditionally: a
    // paragraph that merely continues a verse from the previous paragraph
    // carries no marker of its own (see "unique_verse_ids" in
    // chapter_json_invariants.json), and its notes belong to that earlier
    // verse, not to the next one.
    if (before.includes("[|")) {
      const forward = para.substring(idx).match(/id="v(\d+)"/);
      if (forward) return parseInt(forward[1], 10);
    }
  }
  return null;
}

/** Truncate a string to maxLen characters, adding "…" if needed. */
function truncate(str, maxLen) {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen - 1) + "…";
}

/** Produce a brief human-readable diff between two plain-text strings.
 *  Returns e.g. '"old phrase" → "new phrase"' */
function briefDiff(oldText, newText, maxLen = 120) {
  if (!oldText && !newText) return "";
  if (!oldText) return `added "${truncate(newText, maxLen)}"`;
  if (!newText) return `removed "${truncate(oldText, maxLen)}"`;

  const oldWords = oldText.split(/\s+/);
  const newWords = newText.split(/\s+/);

  let pre = 0;
  while (pre < oldWords.length && pre < newWords.length && oldWords[pre] === newWords[pre]) pre++;

  let suf = 0;
  while (
    suf < oldWords.length - pre &&
    suf < newWords.length - pre &&
    oldWords[oldWords.length - 1 - suf] === newWords[newWords.length - 1 - suf]
  ) suf++;

  const oldDiff = oldWords.slice(pre, oldWords.length - suf).join(" ");
  const newDiff = newWords.slice(pre, newWords.length - suf).join(" ");

  if (oldDiff && newDiff) {
    const half = Math.floor(maxLen / 2);
    return `"${truncate(oldDiff, half)}" → "${truncate(newDiff, half)}"`;
  }
  if (newDiff) return `added "${truncate(newDiff, maxLen)}"`;
  if (oldDiff) return `removed "${truncate(oldDiff, maxLen)}"`;
  return "minor formatting change";
}

// ── Path patterns ─────────────────────────────────────────────────────────────

const CHAPTER_RE = /^src\/data\/chapters\/([\w]+)-(\d+)\.json$/;
const INTRO_RE = /^src\/data\/intros\/([\w]+)-intro\.md$/;
const ARTICLE_RE = /^src\/content\/articles\//;
const GLOSSARY_RE = /^src\/content\/glossary\/(.+)\.md$/;

/**
 * Build the array of release-notes change objects from a set of changed files.
 *
 * @param {object}   opts
 * @param {string[]} opts.addedFiles     Repo-relative paths added between base and HEAD.
 * @param {string[]} opts.modifiedFiles  Repo-relative paths modified between base and HEAD.
 * @param {(file: string) => string | null} opts.readBase  Raw content at the base ref, or null if absent there.
 * @param {(file: string) => string | null} opts.readNow   Current raw content, or null if absent.
 * @returns {object[]} The `changes` array (each object: type, description, and
 *   the additive/optional detail/location/relabel — see draft-release-notes.mjs).
 */
export function buildChanges({ addedFiles, modifiedFiles, readBase, readNow }) {
  /** True if a modified markdown file's reader-facing content changed. Attribute-
   *  only and whitespace-only edits return false, so they don't create a row. */
  function markdownContentChanged(file) {
    const before = readBase(file);
    if (before === null) return true; // no base version — treat as a real change
    const after = readNow(file) ?? "";
    return normalizeMarkup(before) !== normalizeMarkup(after);
  }

  /** Read a glossary entry's `traditional:` frontmatter for a human-readable
   *  description, falling back to the filename. */
  function readGlossaryTraditional(file) {
    const content = readNow(file);
    if (content === null) return basename(file, ".md");
    // Match both quoted forms: `traditional: "Good [1]"` and unquoted: `traditional: Angel`
    const m = content.match(/^traditional:\s*(?:"([^"]+)"|'([^']+)'|(.+?))\s*$/m);
    return m ? (m[1] ?? m[2] ?? m[3]).trim() : basename(file, ".md");
  }

  // ── Categorise changed files ────────────────────────────────────────────────

  const addedChapters = addedFiles.filter((f) => CHAPTER_RE.test(f));
  const modifiedChapters = modifiedFiles.filter((f) => CHAPTER_RE.test(f));
  const addedIntros = addedFiles.filter((f) => INTRO_RE.test(f));
  const modifiedIntros = modifiedFiles.filter((f) => INTRO_RE.test(f));
  const addedGlossary = addedFiles.filter((f) => GLOSSARY_RE.test(f));
  const modifiedGlossary = modifiedFiles.filter((f) => GLOSSARY_RE.test(f));
  const addedArticles = addedFiles.filter((f) => ARTICLE_RE.test(f));
  const modifiedArticles = modifiedFiles.filter((f) => ARTICLE_RE.test(f));

  const changes = [];

  // Metadata-only chapter changes (no reader-visible text/footnote change) are
  // collected here and collapsed into a single entry after the loops, so a
  // repo-wide metadata pass (e.g. the `indexed` flag or a `topics` retag) can't
  // flood the changelog.
  const metadataOnly = [];

  // newByBook collects both brand-new chapter files AND placeholder→real upgrades.
  // It is emitted after both passes so placeholders detected in the modified loop
  // are included in the grouping.
  const newByBook = /** @type {Record<string, number[]>} */ ({});

  // ── Collect newly added chapter files ──────────────────────────────────────

  for (const file of addedChapters) {
    const m = file.match(CHAPTER_RE);
    if (!m) continue;
    const [, bookKey, chStr] = m;
    (newByBook[bookKey] ??= []).push(parseInt(chStr, 10));
  }

  // ── Modified chapters ───────────────────────────────────────────────────────

  for (const file of modifiedChapters) {
    const m = file.match(CHAPTER_RE);
    if (!m) continue;
    const [, bookKey, chStr] = m;
    const chapter = parseInt(chStr, 10);
    const label = bookKeyToLabel(bookKey);

    let oldJson, newJson;
    try {
      const raw = readBase(file);
      if (raw == null) throw new Error("no base content");
      oldJson = JSON.parse(raw);
    } catch {
      changes.push({
        type: "text_updated",
        description: `${label} ${chapter} — updated`,
        location: scriptureLocation(bookKey, chapter),
      });
      continue;
    }

    // Placeholder chapters have "indexed": false. If the old version was a
    // placeholder and the new one is not, treat this as a newly published chapter
    // rather than a content edit.
    if (oldJson.indexed === false) {
      const newIndexed = JSON.parse(readNow(file)).indexed;
      if (newIndexed !== false) {
        (newByBook[bookKey] ??= []).push(chapter);
        continue; // will be handled in the "completed placeholders" pass below
      }
      // Still a placeholder — skip entirely
      continue;
    }
    try {
      const raw = readNow(file);
      if (raw == null) throw new Error("no current content");
      newJson = JSON.parse(raw);
    } catch {
      changes.push({
        type: "text_updated",
        description: `${label} ${chapter} — updated`,
        location: scriptureLocation(bookKey, chapter),
      });
      continue;
    }

    const oldParas = oldJson.paragraphs ?? [];
    const newParas = newJson.paragraphs ?? [];
    const oldFns = oldJson.footnotes ?? [];
    const newFns = newJson.footnotes ?? [];

    // ── Verse-level text comparison ──────────────────────────
    const oldVerses = extractVerseTexts(oldParas);
    const newVerses = extractVerseTexts(newParas);
    const allVerseNums = new Set([...oldVerses.keys(), ...newVerses.keys()]);

    const textDiffs = [];
    for (const v of [...allVerseNums].sort((a, b) => a - b)) {
      const oldText = oldVerses.get(v) ?? "";
      const newText = newVerses.get(v) ?? "";
      if (oldText !== newText) {
        textDiffs.push({ verse: v, diff: briefDiff(oldText, newText) });
      }
    }

    // Fallback: if verse extraction found nothing but paragraphs clearly differ,
    // fall back to paragraph-level detection so we never silently swallow changes.
    // Compare normalized markup (attributes/whitespace stripped) so an attribute-
    // only paragraph edit (e.g. a class/id retag) doesn't fire the fallback and
    // instead collapses to a single "metadata updated" line, matching how the
    // docblock and CLAUDE.md describe attribute-/metadata-only chapter edits.
    // Verse extraction below still reads the RAW paragraph (it needs id="vN").
    const normPara = (p) => normalizeMarkup(stripFootnoteRefs(p ?? ""));
    if (
      textDiffs.length === 0 &&
      JSON.stringify(oldParas.map(normPara)) !== JSON.stringify(newParas.map(normPara))
    ) {
      const changedVerses = new Set();
      const maxLen = Math.max(oldParas.length, newParas.length);
      for (let i = 0; i < maxLen; i++) {
        if (normPara(oldParas[i]) !== normPara(newParas[i])) {
          for (const v of extractVerses(newParas[i] ?? oldParas[i] ?? "")) changedVerses.add(v);
        }
      }
      for (const v of changedVerses) textDiffs.push({ verse: v, diff: "" });
    }

    // ── Individual footnote comparison ───────────────────────
    const oldFnMap = new Map(oldFns.map((f) => [f.id, f]));
    const newFnMap = new Map(newFns.map((f) => [f.id, f]));
    const allFnIds = new Set([...oldFnMap.keys(), ...newFnMap.keys()]);

    const fnDiffs = [];
    for (const id of allFnIds) {
      const oldFn = oldFnMap.get(id);
      const newFn = newFnMap.get(id);
      if (!oldFn && newFn) {
        const verse = findFootnoteVerse(newParas, newFn.label);
        fnDiffs.push({
          label: newFn.label,
          verse,
          action: "added",
          diff: `added "${truncate(stripHtml(newFn.html), 120)}"`,
        });
      } else if (oldFn && !newFn) {
        const verse = findFootnoteVerse(oldParas, oldFn.label);
        fnDiffs.push({
          label: oldFn.label,
          verse,
          action: "removed",
          diff: `removed "${truncate(stripHtml(oldFn.html), 120)}"`,
        });
      } else if (oldFn && newFn && stripHtml(oldFn.html) !== stripHtml(newFn.html)) {
        const verse = findFootnoteVerse(newParas, newFn.label);
        fnDiffs.push({
          label: newFn.label,
          verse,
          action: "updated",
          diff: briefDiff(stripHtml(oldFn.html), stripHtml(newFn.html)),
        });
      }
    }

    // ── Detect footnote relabelings ──────────────────────────
    // When a footnote is inserted or removed, all subsequent labels shift (e.g.
    // old g–q become h–r). The id-based loop above reports every shifted footnote
    // as "updated." Match by HTML content instead to identify pure relabelings and
    // summarize them as a compact range rather than listing each one individually.

    // Build content → label maps using each array's own ordering as the sort key.
    const oldLabelOrder = new Map(oldFns.map((f, i) => [f.label, i]));
    const newLabelOrder = new Map(newFns.map((f, i) => [f.label, i]));
    // Use first-occurrence preference so duplicate HTML values (e.g. the same
    // "Traditionally, 'flesh'" note appearing twice in a chapter) don't get
    // misidentified as relabelings of each other.
    const oldContentToLabel = new Map();
    for (const f of oldFns) if (!oldContentToLabel.has(f.html)) oldContentToLabel.set(f.html, f.label);
    const newContentToLabel = new Map();
    for (const f of newFns) if (!newContentToLabel.has(f.html)) newContentToLabel.set(f.html, f.label);

    const relabelCandidates = []; // { fromLabel, toLabel, shift }

    for (const oldFn of oldFns) {
      // Skip if the footnote at this label is unchanged — it's not being relabeled.
      const sameIdNewFn = newFnMap.get(oldFn.id);
      if (sameIdNewFn?.html === oldFn.html) continue;

      const newLabel = newContentToLabel.get(oldFn.html);
      if (newLabel === undefined || newLabel === oldFn.label) continue;

      // Skip if the target label already held this same content in the old file —
      // that would be coincidental duplicate content, not a cascade relabeling.
      const sameIdOldFn = oldFnMap.get(`fn-${newLabel}`);
      if (sameIdOldFn?.html === oldFn.html) continue;

      const shift =
        (newLabelOrder.get(newLabel) ?? 0) - (oldLabelOrder.get(oldFn.label) ?? 0);
      relabelCandidates.push({ fromLabel: oldFn.label, toLabel: newLabel, shift });
    }

    // A genuine relabeling cascade has a consistent index shift (e.g. all +1 when a
    // footnote is inserted, all -1 when one is removed). Discard candidates where the
    // shift is inconsistent — those are coincidental content duplicates, not relabelings.
    const dominantShift = (() => {
      if (!relabelCandidates.length) return null;
      const freq = new Map();
      for (const { shift } of relabelCandidates)
        freq.set(shift, (freq.get(shift) ?? 0) + 1);
      return [...freq.entries()].sort((a, b) => b[1] - a[1])[0][0];
    })();

    const relabelFromLabels = [];
    const relabelToLabels = [];
    const relabeledFromSet = new Set();
    const relabeledToSet = new Set();

    for (const { fromLabel, toLabel, shift } of relabelCandidates) {
      if (shift !== dominantShift) continue;
      relabelFromLabels.push(fromLabel);
      relabelToLabels.push(toLabel);
      relabeledFromSet.add(fromLabel);
      relabeledToSet.add(toLabel);
    }

    // Remove pure relabelings from per-footnote diffs, and reclassify the one
    // label where the cascade actually started.
    //
    // The id-based loop above compares label-to-label, so at the insertion or
    // removal point it sees "old content X, new content Y" and calls it an edit.
    // It isn't: at that label a note was inserted (or removed) and everything
    // after it shifted. Reporting it as an edit produces a before → after diff
    // between two unrelated notes — e.g. inserting a note at q reads as though
    // the note formerly at q had been rewritten, when it merely moved to r.
    //
    // Four cases for a label-collision "update", by where its two sides came
    // from and went to:
    //   new from elsewhere + old moved elsewhere → pure relabel (drop it)
    //   new is genuinely new + old moved elsewhere → INSERTION at this label
    //   new from elsewhere + old is gone          → REMOVAL at this label
    //   neither                                   → a real edit (keep as-is)
    // The insertion/removal readings only apply when this label participates in
    // a detected cascade; without one, an unrelated rewrite stays an edit.
    const filteredFnDiffs = [];
    for (const d of fnDiffs) {
      if (d.action === "added" && relabeledToSet.has(d.label)) continue;
      if (d.action === "removed" && relabeledFromSet.has(d.label)) continue;
      if (d.action === "updated") {
        const newFn = newFnMap.get(`fn-${d.label}`);
        const oldFn = oldFnMap.get(`fn-${d.label}`);
        if (newFn && oldFn) {
          const newCameFromElsewhere =
            oldContentToLabel.has(newFn.html) &&
            oldContentToLabel.get(newFn.html) !== d.label;
          const oldMovedElsewhere =
            newContentToLabel.has(oldFn.html) &&
            newContentToLabel.get(oldFn.html) !== d.label;

          if (newCameFromElsewhere && oldMovedElsewhere) continue;

          if (!newCameFromElsewhere && oldMovedElsewhere && relabeledFromSet.has(d.label)) {
            filteredFnDiffs.push({
              ...d,
              action: "added",
              diff: `added "${truncate(stripHtml(newFn.html), 120)}"`,
            });
            continue;
          }

          if (newCameFromElsewhere && !oldMovedElsewhere && relabeledToSet.has(d.label)) {
            filteredFnDiffs.push({
              ...d,
              action: "removed",
              // The removed note's verse comes from the OLD paragraphs — this
              // label now points at whichever note shifted up into its place.
              verse: findFootnoteVerse(oldParas, d.label) ?? d.verse,
              diff: `removed "${truncate(stripHtml(oldFn.html), 120)}"`,
            });
            continue;
          }
        }
      }
      filteredFnDiffs.push(d);
    }

    // Summarize relabelings as a range (e.g. "footnotes formerly g–q relabeled h–r").
    // Sort by position in the original footnote arrays, not alphabetically, so that
    // double-letter labels like aa, bb sort correctly after z.
    let relabelSummary = null;
    if (relabelFromLabels.length > 0) {
      const sortedFrom = [...relabelFromLabels].sort(
        (a, b) => (oldLabelOrder.get(a) ?? 0) - (oldLabelOrder.get(b) ?? 0)
      );
      const sortedTo = [...relabelToLabels].sort(
        (a, b) => (newLabelOrder.get(a) ?? 0) - (newLabelOrder.get(b) ?? 0)
      );
      const fromRange =
        sortedFrom.length === 1
          ? sortedFrom[0]
          : `${sortedFrom[0]}–${sortedFrom[sortedFrom.length - 1]}`;
      const toRange =
        sortedTo.length === 1
          ? sortedTo[0]
          : `${sortedTo[0]}–${sortedTo[sortedTo.length - 1]}`;
      relabelSummary = `footnotes formerly ${fromRange} relabeled ${toRange}`;
    }

    // ── Emit change entries ──────────────────────────────────
    const hasTextChanges = textDiffs.length > 0;
    const hasFnChanges = filteredFnDiffs.length > 0 || relabelSummary !== null;

    if (!hasTextChanges && !hasFnChanges) {
      metadataOnly.push({ bookKey, chapter, label });
      continue;
    }

    if (hasTextChanges) {
      const verses = textDiffs.map((d) => d.verse);
      const verseStr = formatVerseRange(verses);
      const ref = verseStr ? `${label} ${chapter}:${verseStr}` : `${label} ${chapter}`;
      const detailParts = textDiffs
        .filter((d) => d.diff)
        .map((d) => (textDiffs.length > 1 ? `v. ${d.verse}: ${d.diff}` : d.diff));
      const entry = {
        type: "text_updated",
        description: `${ref} — text updated`,
      };
      if (detailParts.length) entry.detail = detailParts.join("; ");
      entry.location = scriptureLocation(bookKey, chapter, anchorVerse(verses));
      changes.push(entry);
    }

    if (hasFnChanges) {
      const fnLabels = filteredFnDiffs.map((d) => d.label);
      const fnVerses = filteredFnDiffs.map((d) => d.verse).filter(Boolean);
      const verseStr = fnVerses.length ? formatVerseRange(fnVerses) : "";
      const ref = verseStr ? `${label} ${chapter}:${verseStr}` : `${label} ${chapter}`;
      // When every diff in the bucket agrees on what happened, say so ("added" /
      // "removed" / "updated"); a mixed bucket falls back to the umbrella
      // "updated". `type` stays within the two footnote values the apps already
      // know — a removal is described precisely but still typed
      // footnote_updated, since introducing a third value would be a contract
      // change for a client that may not handle it.
      const actions = new Set(filteredFnDiffs.map((d) => d.action));
      const action = actions.size === 1 ? [...actions][0] : "updated";
      const allAdded = filteredFnDiffs.length > 0 && action === "added";
      const fnWord = filteredFnDiffs.length === 1 ? "footnote" : "footnotes";

      // description stays self-contained (keeps the human verse ref + footnote
      // letters) but drops the relabel clause — that moves to its own `relabel`
      // field so apps can mute or hide the letter-cascade noise.
      const description = filteredFnDiffs.length > 0
        ? `${ref} — ${fnWord} ${fnLabels.join(", ")} ${action}`
        : `${ref} — footnotes relabeled`;

      // detail is the pure before → after. For a single footnote it's just the
      // diff (the row's `location` pinpoints which one); for a bucket of several
      // we keep the `fn. label (v. N):` prefix so the diffs stay disambiguated,
      // since one `location` can't point at each footnote individually.
      let detail;
      if (filteredFnDiffs.length === 1) {
        detail = filteredFnDiffs[0].diff;
      } else if (filteredFnDiffs.length > 1) {
        detail = filteredFnDiffs
          .map((d) => {
            const vRef = d.verse ? ` (v. ${d.verse})` : "";
            return `fn. ${d.label}${vRef}: ${d.diff}`;
          })
          .join("; ");
      }

      // A cascade no longer forces footnote_updated: now that the insertion
      // point is identified rather than read as an edit, an inserted note is a
      // genuine footnote_added and the letter shift rides along in `relabel`.
      const entry = {
        type: allAdded ? "footnote_added" : "footnote_updated",
        description,
      };
      if (detail) entry.detail = detail;
      entry.location = scriptureLocation(bookKey, chapter, anchorVerse(fnVerses));
      if (relabelSummary) entry.relabel = relabelSummary;
      changes.push(entry);
    }
  }

  // ── Emit new/completed chapters (grouped by book) ──────────────────────────

  for (const bookKey of BOOK_ORDER) {
    const chapters = newByBook[bookKey];
    if (!chapters) continue;
    chapters.sort((a, b) => a - b);
    const label = bookKeyToLabel(bookKey);
    const total = BOOKS[bookKey];

    // Deep-link to the first newly added chapter regardless of how many landed.
    const location = scriptureLocation(bookKey, chapters[0]);

    if (chapters.length === total) {
      changes.push({ type: "chapter_added", description: `${label} added`, location });
    } else if (chapters.length === 1) {
      changes.push({
        type: "chapter_added",
        description: `${label} ${chapters[0]} added`,
        location,
      });
    } else {
      changes.push({
        type: "chapter_added",
        description: `${label} chapters ${formatVerseRange(chapters)} added`,
        location,
      });
    }
  }

  // ── Intros ──────────────────────────────────────────────────────────────────

  for (const file of [...addedIntros, ...modifiedIntros]) {
    const m = file.match(INTRO_RE);
    if (!m) continue;
    const isNew = addedIntros.includes(file);
    // Skip modified intros whose reader-facing text didn't actually change.
    if (!isNew && !markdownContentChanged(file)) continue;
    const label = bookKeyToLabel(m[1]);
    changes.push({
      type: "intro_updated",
      description: `${label} Introduction ${isNew ? "added" : "updated"}`,
    });
  }

  // ── Glossary entries ────────────────────────────────────────────────────────
  // Each entry is a separate markdown file; read its frontmatter to get the
  // traditional word for a human-readable description.

  for (const file of addedGlossary) {
    const traditional = readGlossaryTraditional(file);
    changes.push({
      type: "glossary_added",
      description: `Glossary entry for ${traditional} added`,
    });
  }

  for (const file of modifiedGlossary) {
    // Skip modified glossary entries whose reader-facing text didn't change.
    if (!markdownContentChanged(file)) continue;
    const traditional = readGlossaryTraditional(file);
    changes.push({
      type: "glossary_updated",
      description: `Glossary entry for ${traditional} updated`,
    });
  }

  // ── Articles ────────────────────────────────────────────────────────────────

  for (const file of addedArticles) {
    changes.push({
      type: "article_added",
      description: `Article added: ${basename(file, ".md").replace(/-/g, " ")}`,
    });
  }
  for (const file of modifiedArticles) {
    // Skip modified articles whose reader-facing text didn't change (e.g. an
    // attribute-only link cleanup).
    if (!markdownContentChanged(file)) continue;
    changes.push({
      type: "article_updated",
      description: `Article updated: ${basename(file, ".md").replace(/-/g, " ")}`,
    });
  }

  // ── Metadata-only chapter changes (collapsed) ──────────────────────────────
  // One line for a single chapter, a count for many. A bulk metadata pass can
  // never flood the changelog again.
  if (metadataOnly.length === 1) {
    const { bookKey, chapter, label } = metadataOnly[0];
    changes.push({
      type: "metadata_updated",
      description: `${label} ${chapter} — metadata updated`,
      location: scriptureLocation(bookKey, chapter),
    });
  } else if (metadataOnly.length > 1) {
    changes.push({
      type: "metadata_updated",
      description: `Metadata updated (${metadataOnly.length} chapters)`,
    });
  }

  return changes;
}
