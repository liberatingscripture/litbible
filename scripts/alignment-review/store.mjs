// All filesystem + corpus state for the alignment review tool, behind one
// object. server.mjs is routing only — it never touches src/data/alignment/
// or the chapters/glossary/corpus directly; every read comes from the
// in-memory state built here, and every write goes through writeChapterFile()
// so the on-disk copy and the in-memory copy never drift apart mid-session.
//
// THIS TOOL CANNOT DEGRADE WITHOUT MORPHGNT, unlike build-alignment.mjs.
// build-alignment.mjs scans English and only uses the corpus to VERIFY a guess
// it already made, so it still produces useful output with the corpus absent.
// This tool's review queue is the corpus: versesInScopeForTerm() is "every
// published verse where the term's Greek lemma occurs," and without that list
// there is nothing to seed a queue from — the entire premise (reviewing from
// the Greek side, not rediscovering from English) collapses. So createStore()
// throws instead of degrading; see the corpus-load step below.
//
// Load order matters for one reason only: everything after the corpus check
// is allowed to assume `corpus` is present and skip the null-checks
// build-alignment.mjs needs.

import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { BOOK_ORDER, bookKeyToLabel } from "../../src/data/books.js";
import { loadMorphGnt } from "../lib/morphgnt.mjs";
import { GLOSSARY_LEMMAS } from "../lib/glossary-lemmas.mjs";
import { splitChapterVerses } from "../lib/verse-text.mjs";
import {
  recordKey,
  sortRecords,
  applyReviewDecision,
  rejectRecordsByKey,
} from "../lib/alignment-merge.mjs";
import {
  tokenizeWords,
  buildAutoProposal,
  versesInScopeForTerm,
  buildConfirmRecord,
  buildNoRenderingRecord,
  reconcileConfirmations,
  isDecided,
  progressForTerm,
  groupAbsentRecordsByPattern,
} from "./review-core.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const CHAPTERS_DIR = path.join(ROOT, "src", "data", "chapters");
const GLOSSARY_DIR = path.join(ROOT, "src", "content", "glossary");
const ALIGNMENT_DIR = path.join(ROOT, "src", "data", "alignment");
const MORPHGNT_DIR = process.env.MORPHGNT_DIR || path.join(ROOT, ".morphgnt");

const BOOK_RANK = new Map(BOOK_ORDER.map((k, i) => [k, i]));

/**
 * OSIS book abbreviations — copied from build-alignment.mjs (matches
 * addOsisIds in src/lib/chapter-html.ts). Keep the two in sync by hand; this
 * tool and the scanner must agree on how a ref is spelled or a record written
 * by one is invisible to the other.
 */
const OSIS_BOOKS = {
  matthew: "Matt", mark: "Mark", luke: "Luke", john: "John", acts: "Acts",
  romans: "Rom", "1corinthians": "1Cor", "2corinthians": "2Cor",
  galatians: "Gal", ephesians: "Eph", philippians: "Phil", colossians: "Col",
  "1thessalonians": "1Thess", "2thessalonians": "2Thess",
  "1timothy": "1Tim", "2timothy": "2Tim", titus: "Titus", philemon: "Phlm",
  hebrews: "Heb", james: "Jas", "1peter": "1Pet", "2peter": "2Pet",
  "1john": "1John", "2john": "2John", "3john": "3John", jude: "Jude",
  revelation: "Rev",
};

/** The inverse of OSIS_BOOKS — "Matt" -> "matthew". Built once at module load. */
const BOOK_KEY_BY_OSIS = Object.fromEntries(
  Object.entries(OSIS_BOOKS).map(([bookKey, osis]) => [osis, bookKey]),
);

/** Attach an HTTP status to a plain Error so server.mjs can translate it without importing an error class from a module that promises "no http". */
function httpError(statusCode, message) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

/** "Rom.8.3" -> { bookKey: "romans", chapter: 8, verse: 3 }. bookKey is undefined for an OSIS abbreviation this repo doesn't publish. */
function refParts(ref) {
  const [osis, chapterStr, verseStr] = String(ref).split(".");
  return {
    bookKey: BOOK_KEY_BY_OSIS[osis],
    chapter: Number(chapterStr),
    verse: Number(verseStr),
  };
}

const alignmentFilePath = (bookKey, chapter) =>
  path.join(ALIGNMENT_DIR, `${bookKey}-${chapter}.json`);

/** Minimal frontmatter reader — the glossary schema is flat key: value. Copied verbatim from build-alignment.mjs so the two stay in lockstep. */
function readFrontmatter(raw) {
  const m = String(raw).match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!m) return null;
  const out = {};
  for (const line of m[1].split(/\r?\n/)) {
    const kv = line.match(/^([A-Za-z][A-Za-z0-9_]*):\s*(.*)$/);
    if (kv) out[kv[1]] = kv[2].trim().replace(/^["'](.*)["']$/, "$1");
  }
  return out;
}

/**
 * Glossary terms, scoped to the ones this tool can seed a queue for: only an
 * id that GLOSSARY_LEMMAS maps to Greek lemmas has anything for
 * versesInScopeForTerm() to find. A glossary entry with no lemma mapping
 * would otherwise show up with an empty, unreviewable queue.
 */
async function loadTerms() {
  const files = (await fs.readdir(GLOSSARY_DIR)).filter((f) => f.endsWith(".md"));
  const terms = [];
  for (const f of files.sort()) {
    const fm = readFrontmatter(await fs.readFile(path.join(GLOSSARY_DIR, f), "utf8"));
    if (!fm?.id || !fm.lit) continue;
    if (!Object.prototype.hasOwnProperty.call(GLOSSARY_LEMMAS, fm.id)) continue;
    const forms = fm.lit
      .split("/")
      .map((s) => s.trim())
      .filter(Boolean)
      // Longest first so "faithful trust" wins over a bare "trust" on the same
      // span — same rule build-alignment.mjs's loadTerms uses, and it has to
      // match: buildAutoProposal() walks `forms` in this order.
      .sort((a, b) => b.length - a.length);
    terms.push({
      id: fm.id,
      greek: fm.greek || "",
      traditional: fm.traditional || "",
      lit: fm.lit,
      forms,
      lemmas: GLOSSARY_LEMMAS[fm.id],
    });
  }
  return terms;
}

/**
 * Plain-text verses for every published chapter, plus the set of published
 * "Matt.12" chapter keys versesInScopeForTerm() filters drafts against.
 * Published-chapter filtering (the `data.indexed === false` skip) is copied
 * from build-alignment.mjs's main loop — an in-progress stub must never read
 * as a reviewable gap.
 */
async function loadPublishedVerses() {
  const files = (await fs.readdir(CHAPTERS_DIR)).filter((f) => f.endsWith(".json"));
  const verseIndex = new Map();
  const publishedChapters = new Set();

  for (const f of files) {
    let data;
    try {
      data = JSON.parse(await fs.readFile(path.join(CHAPTERS_DIR, f), "utf8"));
    } catch {
      continue;
    }
    if (data.indexed === false) continue; // draft/stub chapter

    const bookKey = String(data.bookKey || "");
    const osis = OSIS_BOOKS[bookKey];
    if (!BOOK_RANK.has(bookKey) || !osis || !Number.isFinite(data.chapter)) continue;

    publishedChapters.add(`${osis}.${data.chapter}`);
    for (const [verse, text] of splitChapterVerses(data.paragraphs)) {
      verseIndex.set(`${osis}.${data.chapter}.${verse}`, {
        bookKey,
        chapter: data.chapter,
        verse,
        text,
      });
    }
  }
  return { verseIndex, publishedChapters };
}

/** Every existing src/data/alignment/*.json, keyed "<bookKey>-<chapter>". A missing directory is the legitimate first-run case (nothing reviewed yet), not an error. */
async function loadAlignmentChapters() {
  const chapters = new Map();
  let files;
  try {
    files = (await fs.readdir(ALIGNMENT_DIR)).filter((f) => f.endsWith(".json"));
  } catch {
    return chapters;
  }
  for (const f of files) {
    let data;
    try {
      data = JSON.parse(await fs.readFile(path.join(ALIGNMENT_DIR, f), "utf8"));
    } catch (err) {
      console.error(`  cannot read ${f}: ${err.message}`);
      continue;
    }
    if (!data?.bookKey || !Number.isFinite(data.chapter)) continue;
    chapters.set(`${data.bookKey}-${data.chapter}`, {
      bookKey: data.bookKey,
      chapter: data.chapter,
      records: Array.isArray(data.records) ? data.records : [],
    });
  }
  return chapters;
}

/** OSIS abbreviation -> canonical NT order, for versesInScopeForTerm()'s sort. */
function buildOsisRank() {
  const rank = new Map();
  BOOK_ORDER.forEach((bookKey, i) => {
    const osis = OSIS_BOOKS[bookKey];
    if (osis) rank.set(osis, i);
  });
  return rank;
}

/**
 * All fs-backed state and the operations the HTTP routes need. One instance
 * per server process; every write mutates `this.chapters` in place so the
 * next read sees it without a re-load.
 */
class AlignmentStore {
  constructor({ terms, corpus, osisRank, verseIndex, publishedChapters, chapters }) {
    this.terms = terms;
    this.termsById = new Map(terms.map((t) => [t.id, t]));
    this.corpus = corpus;
    this.osisRank = osisRank;
    this.verseIndex = verseIndex;
    this.publishedChapters = publishedChapters;
    this.chapters = chapters; // "<bookKey>-<chapter>" -> { bookKey, chapter, records }
  }

  // ---- internal helpers ----------------------------------------------

  /** Records currently occupying the (ref, term) slot — what applyReviewDecision() would replace. */
  recordsForRefTerm(ref, termId) {
    const { bookKey, chapter } = refParts(ref);
    if (!bookKey) return [];
    const entry = this.chapters.get(`${bookKey}-${chapter}`);
    if (!entry) return [];
    return entry.records.filter((r) => r.ref === ref && r.term?.glossary === termId);
  }

  refLabel(ref) {
    const { bookKey, chapter, verse } = refParts(ref);
    if (!bookKey) return ref;
    return `${bookKeyToLabel(bookKey)} ${chapter}:${verse}`;
  }

  /** Read-modify-write of ONE chapter file, immediately, keeping the in-memory copy in sync. */
  async writeChapterFile(bookKey, chapter, records) {
    const sorted = sortRecords(records);
    await fs.mkdir(ALIGNMENT_DIR, { recursive: true });
    await fs.writeFile(
      alignmentFilePath(bookKey, chapter),
      `${JSON.stringify({ bookKey, chapter, records: sorted }, null, 2)}\n`,
      "utf8",
    );
    this.chapters.set(`${bookKey}-${chapter}`, { bookKey, chapter, records: sorted });
    return sorted;
  }

  /** Renderings grouped by term.form across CONFIRMED records for this term, count desc. Scans every chapter — cheap at this corpus's size, and simplest to keep exactly in sync with in-place edits. */
  renderingsForTerm(termId) {
    const counts = new Map();
    for (const { records } of this.chapters.values()) {
      for (const r of records) {
        if (r.term?.glossary !== termId || r.status !== "confirmed") continue;
        const form = r.term?.form;
        if (!form) continue;
        counts.set(form, (counts.get(form) ?? 0) + 1);
      }
    }
    return [...counts.entries()]
      .map(([form, count]) => ({ form, count }))
      .sort((a, b) => b.count - a.count);
  }

  /** A verse counts as "double confirmed" for a term when the scanner already found AND the Greek check already agreed — the bulk-accept candidate set. Recomputed from current records, so it self-corrects: once a qualifying record's status leaves "auto" (by review, one way or another), the verse stops counting. */
  hasDoubleConfirmed(records) {
    return records.some(
      (r) => r.status === "auto" && r.source === "glossary-scan" && r.lemma === "present",
    );
  }

  /** Queue + progress + renderings for one term, shared by every route that reports term status. */
  computeTermStats(term) {
    const queue = versesInScopeForTerm({
      lemmas: term.lemmas,
      refsByLemma: this.corpus.refsByLemma,
      publishedChapters: this.publishedChapters,
      osisRank: this.osisRank,
    });
    const recordsByRef = new Map();
    let doubleConfirmedCount = 0;
    for (const ref of queue) {
      const records = this.recordsForRefTerm(ref, term.id);
      recordsByRef.set(ref, records);
      if (this.hasDoubleConfirmed(records)) doubleConfirmedCount++;
    }
    return {
      queue,
      recordsByRef,
      progress: progressForTerm({ queue, recordsByRef }),
      doubleConfirmedCount,
      renderings: this.renderingsForTerm(term.id),
    };
  }

  buildVerseDetail(term, ref, records) {
    const { bookKey, chapter, verse } = refParts(ref);
    const text = this.verseIndex.get(ref)?.text ?? "";
    const greekTokens = (this.corpus.tokensByRef?.get(ref) ?? []).map((t) => ({
      t: t.t,
      text: t.text,
      word: t.word,
      lemma: t.lemma,
    }));
    return {
      ref,
      bookKey,
      chapter,
      verse,
      label: this.refLabel(ref),
      text,
      words: tokenizeWords(text),
      greek: greekTokens,
      records,
      decided: isDecided(records),
      doubleConfirmed: this.hasDoubleConfirmed(records),
      proposal: buildAutoProposal({ verseText: text, forms: term.forms }),
    };
  }

  // ---- routes ----------------------------------------------------------

  getTermsSummary() {
    const summaries = this.terms.map((term) => {
      const stats = this.computeTermStats(term);
      return {
        id: term.id,
        greek: term.greek,
        traditional: term.traditional,
        lit: term.lit,
        forms: term.forms,
        lemmas: term.lemmas,
        total: stats.progress.total,
        done: stats.progress.done,
        remaining: stats.progress.remaining,
        doubleConfirmed: stats.doubleConfirmedCount,
        renderings: stats.renderings,
      };
    });
    summaries.sort((a, b) => {
      const pa = a.total ? a.done / a.total : 0;
      const pb = b.total ? b.done / b.total : 0;
      return pa - pb || b.total - a.total;
    });
    return summaries;
  }

  getTermDetail(id) {
    const term = this.termsById.get(id);
    if (!term) return null;
    const stats = this.computeTermStats(term);
    return {
      term: {
        id: term.id,
        greek: term.greek,
        traditional: term.traditional,
        lit: term.lit,
        forms: term.forms,
        lemmas: term.lemmas,
      },
      renderings: stats.renderings,
      progress: stats.progress,
      doubleConfirmed: stats.doubleConfirmedCount,
      verses: stats.queue.map((ref) =>
        this.buildVerseDetail(term, ref, stats.recordsByRef.get(ref)),
      ),
    };
  }

  /**
   * One reviewer decision about one (verse, term) pair. All spans for a verse
   * must arrive in this one call — applyReviewDecision() treats the slot as
   * fully owned, so a second call would silently drop the first span rather
   * than adding to it. See lib/alignment-merge.mjs's header.
   */
  async applyVerseDecision(termId, ref, body) {
    const term = this.termsById.get(termId);
    if (!term) throw httpError(404, `Unknown term: ${termId}`);
    const { bookKey, chapter } = refParts(ref);
    if (!bookKey) throw httpError(400, `Unrecognized ref: ${ref}`);

    const action = body?.action;
    let builtRecords;

    if (action === "confirm") {
      const spans = Array.isArray(body?.spans) ? body.spans : null;
      if (!spans?.length) throw httpError(400, "confirm requires a non-empty spans array");
      for (const span of spans) {
        if (typeof span?.text !== "string" || !span.text || !Number.isFinite(span.start)) {
          throw httpError(400, "each span needs a { text, start }");
        }
      }
      const verseText = this.verseIndex.get(ref)?.text ?? "";
      const built = spans.map((span) => buildConfirmRecord({ ref, term, span, verseText }));
      // Reconcile ONLY on confirm: a matched prior is a scanner "auto" record
      // whose provenance (source: "glossary-scan", its confidence) is worth
      // keeping. reconcileConfirmations() unconditionally sets status to
      // "confirmed" on a match, which would be wrong for no-rendering (a
      // repeat no-rendering click would otherwise turn a prior no-rendering
      // record into a "confirmed" record with no english span) — so that
      // action builds its record directly instead, below.
      builtRecords = reconcileConfirmations({
        existing: this.recordsForRefTerm(ref, termId),
        built,
        recordKey,
      });
    } else if (action === "no-rendering") {
      builtRecords = [buildNoRenderingRecord({ ref, term })];
    } else {
      throw httpError(400, `Unknown action: ${action}`);
    }

    const existingChapterRecords = this.chapters.get(`${bookKey}-${chapter}`)?.records ?? [];
    const updated = applyReviewDecision({
      existingRecords: existingChapterRecords,
      ref,
      termGlossary: termId,
      records: builtRecords,
    });
    await this.writeChapterFile(bookKey, chapter, updated);

    const finalRecords = this.recordsForRefTerm(ref, termId);
    const stats = this.computeTermStats(term);
    return {
      ok: true,
      ref,
      records: finalRecords,
      progress: stats.progress,
      renderings: stats.renderings,
      decided: isDecided(finalRecords),
    };
  }

  /**
   * Flip every qualifying "auto" record to "confirmed" in place, for every
   * not-yet-decided verse in the term's queue whose scanner match and Greek
   * check already agree. Writes are grouped by chapter file so a term whose
   * queue spans many chapters still writes each file exactly once.
   */
  async acceptDoubleConfirmed(termId) {
    const term = this.termsById.get(termId);
    if (!term) throw httpError(404, `Unknown term: ${termId}`);

    const queue = versesInScopeForTerm({
      lemmas: term.lemmas,
      refsByLemma: this.corpus.refsByLemma,
      publishedChapters: this.publishedChapters,
      osisRank: this.osisRank,
    });

    const touched = new Map(); // "<bookKey>-<chapter>" -> working records array
    let confirmedRecords = 0;
    let verseCount = 0;

    for (const ref of queue) {
      const slot = this.recordsForRefTerm(ref, termId);
      if (isDecided(slot)) continue;
      const qualifying = slot.filter(
        (r) => r.status === "auto" && r.source === "glossary-scan" && r.lemma === "present",
      );
      if (!qualifying.length) continue;

      const { bookKey, chapter } = refParts(ref);
      const chapterKey = `${bookKey}-${chapter}`;
      let working = touched.get(chapterKey);
      if (!working) {
        working = {
          bookKey,
          chapter,
          records: [...(this.chapters.get(chapterKey)?.records ?? [])],
        };
        touched.set(chapterKey, working);
      }
      const qualifyingKeys = new Set(qualifying.map((r) => recordKey(r)));
      // recordKey embeds ref + glossary, so a match against this chapter's
      // full record list can only ever hit records for this exact verse+term.
      working.records = working.records.map((r) =>
        qualifyingKeys.has(recordKey(r)) ? { ...r, status: "confirmed" } : r,
      );
      confirmedRecords += qualifying.length;
      verseCount++;
    }

    for (const { bookKey, chapter, records } of touched.values()) {
      await this.writeChapterFile(bookKey, chapter, records);
    }

    const stats = this.computeTermStats(term);
    return {
      ok: true,
      confirmed: confirmedRecords,
      verses: verseCount,
      progress: stats.progress,
      renderings: stats.renderings,
    };
  }

  getAbsentGroups() {
    const all = [];
    for (const { records } of this.chapters.values()) all.push(...records);
    const groups = groupAbsentRecordsByPattern(all);
    return {
      groups: groups.map((g) => ({
        id: g.id,
        glossary: g.glossary,
        form: g.form,
        count: g.records.length,
        records: g.records.map((r) => ({
          key: recordKey(r),
          ref: r.ref,
          label: this.refLabel(r.ref),
          englishText: r.english?.[0]?.text ?? "",
          text: this.verseIndex.get(r.ref)?.text ?? "",
        })),
      })),
    };
  }

  /** Bulk-reject by identity key, the Absent tab's one action. Keys embed their ref, so writes group naturally by the chapter file that ref belongs to. */
  async bulkReject(recordKeys) {
    if (!Array.isArray(recordKeys) || !recordKeys.length) {
      throw httpError(400, "recordKeys must be a non-empty array");
    }
    const keysByChapter = new Map();
    for (const key of recordKeys) {
      const { bookKey, chapter } = refParts(String(key).split("|")[0]);
      if (!bookKey) continue; // malformed key — skip rather than fail the whole batch
      const chapterKey = `${bookKey}-${chapter}`;
      let set = keysByChapter.get(chapterKey);
      if (!set) keysByChapter.set(chapterKey, (set = new Set()));
      set.add(key);
    }

    let rejected = 0;
    for (const [chapterKey, keys] of keysByChapter) {
      const entry = this.chapters.get(chapterKey);
      if (!entry) continue;
      const { records, changed } = rejectRecordsByKey({ existingRecords: entry.records, keys });
      if (changed) {
        rejected += changed;
        await this.writeChapterFile(entry.bookKey, entry.chapter, records);
      }
    }
    return { ok: true, rejected };
  }
}

/**
 * Load everything and return a ready-to-use store. Throws if MorphGNT is
 * absent — see the file header for why this tool, unlike build-alignment.mjs,
 * cannot fall back to a degraded mode.
 */
export async function createStore() {
  const terms = await loadTerms();
  const corpus = await loadMorphGnt(MORPHGNT_DIR, OSIS_BOOKS, { withTokens: true });
  if (!corpus) {
    throw new Error(
      `No MorphGNT corpus at ${path.relative(ROOT, MORPHGNT_DIR)}. This tool seeds its ` +
        `review queue from the Greek (every verse where a term's lemma occurs), so without ` +
        `the corpus there is nothing to seed from — it can't degrade to English-only the way ` +
        `build-alignment.mjs does. Clone it first:\n` +
        `  git clone --depth 1 https://github.com/morphgnt/sblgnt.git .morphgnt\n` +
        `(MORPHGNT_DIR overrides the location if you keep it elsewhere.)`,
    );
  }

  const osisRank = buildOsisRank();
  const { verseIndex, publishedChapters } = await loadPublishedVerses();
  const chapters = await loadAlignmentChapters();

  return new AlignmentStore({ terms, corpus, osisRank, verseIndex, publishedChapters, chapters });
}
