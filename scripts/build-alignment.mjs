// Generates src/data/alignment/<bookKey>-<chapter>.json — phase 1 of the LIT
// alignment dataset: a record for every place a glossary term's LIT rendering
// appears in the published text.
//
// WHY THIS EXISTS: the glossary tells a reader what the LIT renders `pneuma`
// as, but not WHERE, and not that the rendering splits by context. Footnotes
// answer "what happened in this verse" and can never answer "what do you do
// with this word" — that question ranges over the corpus. These records are
// the aggregate the glossary is missing.
//
// Record shape (one schema across both phases; phase 2 fills `greek`):
//   {
//     "ref": "Rom.8.3",
//     "english": [{ "text": "self-preservation", "n": 1 }],
//     "greek": [],                     // phase 2: [{ "t": 12, "form": "σαρκὸς" }]
//     "term": { "greek": "sarx", "traditional": "Flesh", "glossary": "flesh-body" },
//     "confidence": "distinctive",     // editorial: is the ENGLISH unambiguous?
//     "lemma": "present",              // checked: is the GREEK actually here?
//     "source": "glossary-scan",
//     "status": "auto"
//   }
//
// `english` + `greek` is the ALIGNMENT LINK; `term` is the EDITORIAL
// ANNOTATION. Both are arrays because phase 2 needs many-to-many (one Greek
// word rendered as three English words, and the reverse). Phase 2 will also
// emit records for ordinary tokens (καί, δέ) which carry no commitment —
// those get "term": null. Phase 1 records are exactly the inverse: `term`
// populated, `greek` empty.
//
// `n` is the nth case-insensitive match of that form within the verse, while
// `text` preserves the casing as written. That distinction is load-bearing:
// Romans 8:2 renders `nomos` as "Torah" and "torah" in the same verse, on
// purpose, and the pair must stay distinguishable.
//
// TWO SIGNALS, DELIBERATELY SEPARATE. `confidence` is an editorial guess about
// the ENGLISH — is this string unambiguous enough that a match means something.
// `lemma` is a check against the GREEK via a local MorphGNT working copy — does
// the lemma this record claims actually occur in this verse. They disagree
// usefully: Rom 8:12 "Family" is `common` + `absent` (it's vocative ἀδελφοί,
// not σάρξ), which is a false positive no English-side rule could catch.
//   present    lemma occurs in the verse
//   absent     verse exists in SBLGNT, lemma doesn't — probable false positive
//   unchecked  no corpus, no lemma mapping, or the verse isn't in SBLGNT
//              (versification gaps like Rom 16:24 must not read as `absent`)
//
// MorphGNT is a TOOL HERE, NOT A DEPENDENCY AND NOT REPUBLISHED — see
// lib/morphgnt.mjs. Without it the run still works and prior verdicts on disk
// survive untouched.
//
// OUTPUT IS COMMITTED, NOT GENERATED-AND-IGNORED. Unlike the other build
// scripts, these files carry human review state (`status`), so re-running
// MERGES: any record previously marked `confirmed` or `rejected` keeps that
// status. Records whose English no longer matches are reported and dropped.
//
// The inverse of the scan — verses where the lemma occurs but no English record
// was produced, i.e. renderings the glossary doesn't know about — is the real
// work list, written to alignment-coverage.json. That file IS a lemma
// concordance, so it's gitignored rather than committed.
//
// THIS IS NOT THE ONLY WRITER of src/data/alignment/. scripts/alignment-review/
// writes reviewer decisions into the same files, including records for
// renderings this scan structurally cannot find. lib/alignment-merge.mjs holds
// the rules that keep the two from clobbering each other; read its header
// before changing anything about how records are keyed or ordered.

import { promises as fs } from "node:fs";
import path from "node:path";
import { BOOK_ORDER } from "../src/data/books.js";
import { loadMorphGnt } from "./lib/morphgnt.mjs";
import { GLOSSARY_LEMMAS } from "./lib/glossary-lemmas.mjs";
import { splitChapterVerses } from "./lib/verse-text.mjs";
import { findFormMatches } from "./lib/alignment-forms.mjs";
import { mergeScanWithExisting, recordKey } from "./lib/alignment-merge.mjs";

const ROOT = process.cwd();
const CHAPTERS_DIR = path.join(ROOT, "src", "data", "chapters");
const GLOSSARY_DIR = path.join(ROOT, "src", "content", "glossary");
const OUT_DIR = path.join(ROOT, "src", "data", "alignment");
const MORPHGNT_DIR = process.env.MORPHGNT_DIR || path.join(ROOT, ".morphgnt");
const COVERAGE_FILE = path.join(ROOT, "alignment-coverage.json");

const BOOK_RANK = new Map(BOOK_ORDER.map((k, i) => [k, i]));

/** OSIS book abbreviations — matches addOsisIds in src/lib/chapter-html.ts. */
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

// Glossary ids whose LIT rendering is distinctive enough that a string match
// is effectively certain — a coinage ("life-breath"), a multi-word phrase
// ("The Triumphant Message"), or a proper noun ("Torah"). Everything else
// defaults to `common`: ordinary English that may or may not be rendering the
// Greek term ("trust", "sacred", "clean"), so those records still get written
// but are held back from display until reviewed.
//
// This is an editorial judgment, not a derivable rule. Promote to a JSON
// config if it grows per-form or per-book exceptions.
const DISTINCTIVE = new Set([
  "blasphemy-disrespectfulness",
  "confession-open-acknowledgement",
  "devil-false-accuser",
  "gehenna-hinnom-valley",
  "gospel-triumphant-message",
  "hell-hades",
  "law-torah",
  "repentance-reorient-mind",
  "satan-adversary",
  "sin-deviation",
  "spirit-life-breath",
  "trespass-shortfall",
]);

// Individual surface forms that are distinctive even though their glossary
// entry as a whole isn't (sarx also renders as the ordinary word "family").
const DISTINCTIVE_FORMS = new Set(["self-preservation"]);

/** Minimal frontmatter reader — the glossary schema is flat key: value. */
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

async function loadTerms() {
  const files = (await fs.readdir(GLOSSARY_DIR)).filter((f) => f.endsWith(".md"));
  const terms = [];
  for (const f of files.sort()) {
    const fm = readFrontmatter(await fs.readFile(path.join(GLOSSARY_DIR, f), "utf8"));
    if (!fm?.id || !fm.lit) continue;
    const forms = fm.lit
      .split("/")
      .map((s) => s.trim())
      .filter(Boolean)
      // Longest first so "faithful trust" wins over "trust" on the same span.
      .sort((a, b) => b.length - a.length);
    terms.push({
      id: fm.id,
      greek: fm.greek || "",
      traditional: fm.traditional || "",
      forms,
      distinctive: DISTINCTIVE.has(fm.id),
    });
  }
  return terms;
}

/**
 * Does the Greek this record claims actually occur in this verse?
 * Anything the check can't speak to is `unchecked`, never `absent` — a
 * versification gap or an unmapped term must not look like a false positive.
 */
function lemmaVerdict(corpus, ref, glossaryId) {
  if (!corpus) return "unchecked";
  const lemmas = GLOSSARY_LEMMAS[glossaryId];
  if (!lemmas?.length) return "unchecked";
  if (!corpus.verses.has(ref)) return "unchecked";
  const inVerse = corpus.lemmasByRef.get(ref);
  return lemmas.some((l) => inVerse.has(l)) ? "present" : "absent";
}

const alignmentFile = (bookKey, chapter) =>
  path.join(OUT_DIR, `${bookKey}-${chapter}.json`);

const exists = (file) =>
  fs.access(file).then(
    () => true,
    () => false,
  );

/**
 * Prior records for one chapter, keyed for merging.
 *
 * A missing file is the normal first-run case and returns empty. Anything else
 * — malformed JSON, an unreadable file — is REPORTED, never swallowed: an
 * empty map here silently discards every reviewed status in that chapter, and
 * the file is then rewritten without them.
 */
async function readExisting(file) {
  let raw;
  try {
    raw = await fs.readFile(file, "utf8");
  } catch (err) {
    if (err.code !== "ENOENT") {
      console.error(`  cannot read ${path.relative(ROOT, file)}: ${err.message}`);
    }
    return new Map();
  }
  try {
    const data = JSON.parse(raw);
    const map = new Map();
    for (const r of data.records || []) map.set(recordKey(r), r);
    return map;
  } catch (err) {
    console.error(
      `  ${path.relative(ROOT, file)} is not valid alignment JSON (${err.message}) — ` +
        `its review state will be LOST if this run rewrites it. Fix or delete it.`,
    );
    return new Map();
  }
}

/**
 * Fail loudly on a lemma this corpus has never seen — almost always a wrong
 * accent or breathing in glossary-lemmas.mjs, which would otherwise degrade
 * silently into "that term never verifies."
 */
function validateLemmaMap(corpus) {
  const unknown = [];
  for (const [id, lemmas] of Object.entries(GLOSSARY_LEMMAS)) {
    for (const lemma of lemmas) {
      if (!corpus.lemmas.has(lemma)) unknown.push(`${id} → ${lemma}`);
    }
  }
  if (unknown.length) {
    throw new Error(
      `scripts/lib/glossary-lemmas.mjs lists ${unknown.length} lemma(s) absent ` +
        `from the corpus (check accents/breathings):\n  ${unknown.join("\n  ")}`,
    );
  }
}

async function main() {
  const terms = await loadTerms();
  const files = (await fs.readdir(CHAPTERS_DIR)).filter((f) => f.endsWith(".json"));

  const corpus = await loadMorphGnt(MORPHGNT_DIR, OSIS_BOOKS);
  if (corpus) validateLemmaMap(corpus);
  else {
    console.warn(
      `No MorphGNT corpus at ${path.relative(ROOT, MORPHGNT_DIR)} — Greek ` +
        `verification skipped, existing verdicts preserved. To enable:\n` +
        `  git clone --depth 1 https://github.com/morphgnt/sblgnt.git .morphgnt`,
    );
  }

  /** Verses we actually scanned, so coverage doesn't count drafts as gaps. */
  const publishedChapters = new Set();
  const byChapter = [];
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

    const verses = splitChapterVerses(data.paragraphs);
    const records = [];
    publishedChapters.add(`${osis}.${data.chapter}`);

    for (const verse of [...verses.keys()].sort((a, b) => a - b)) {
      const text = verses.get(verse);
      for (const term of terms) {
        // Spans already claimed by a longer form of the SAME term, so
        // "faithful trust" doesn't also emit a bare "trust" record.
        const claimed = [];
        for (const form of term.forms) {
          for (const { text: matched, start, end, n } of findFormMatches(text, form)) {
            if (claimed.some(([s, e]) => start < e && end > s)) continue;
            claimed.push([start, end]);
            const ref = `${osis}.${data.chapter}.${verse}`;
            records.push({
              ref,
              english: [{ text: matched, n }],
              greek: [],
              term: {
                greek: term.greek,
                traditional: term.traditional,
                glossary: term.id,
                // Which of the term's renderings this is. `english[0].text`
                // keeps what was actually written (plural, possessive,
                // capitalised); this keeps which glossary form it belongs to,
                // so "Life-breath", "life-breath", and "life-breaths" group
                // as one rendering without losing the written variant.
                form,
              },
              confidence:
                term.distinctive || DISTINCTIVE_FORMS.has(form.toLowerCase())
                  ? "distinctive"
                  : "common",
              lemma: lemmaVerdict(corpus, ref, term.id),
              source: "glossary-scan",
              status: "auto",
            });
          }
        }
      }
    }

    // Chapters with no scan hits are still carried when a file already exists:
    // that is exactly the motivating case, a chapter whose only records came
    // from review because the glossary lists no form the scan could find.
    if (records.length || (await exists(alignmentFile(bookKey, data.chapter)))) {
      byChapter.push({ bookKey, chapter: data.chapter, records });
    }
  }

  // Canonical order so the on-disk set is stable run to run.
  byChapter.sort(
    (a, b) => BOOK_RANK.get(a.bookKey) - BOOK_RANK.get(b.bookKey) || a.chapter - b.chapter,
  );

  await fs.mkdir(OUT_DIR, { recursive: true });
  let total = 0;
  let preserved = 0;
  let carried = 0;
  let dropped = 0;

  const written = [];
  for (const { bookKey, chapter, records: scanned } of byChapter) {
    const file = alignmentFile(bookKey, chapter);
    const existing = await readExisting(file);
    const merged = mergeScanWithExisting({
      scanned,
      existing,
      corpusAvailable: Boolean(corpus),
    });

    preserved += merged.preserved;
    carried += merged.carried;
    for (const { key, record } of merged.stale) {
      dropped++;
      console.warn(`  stale ${record.status} record no longer matches: ${key}`);
    }

    await fs.writeFile(
      file,
      `${JSON.stringify({ bookKey, chapter, records: merged.records }, null, 2)}\n`,
      "utf8",
    );
    total += merged.records.length;
    written.push(merged.records);
  }

  const all = written.flat();
  // Reviewed records are counted apart from the two confidence buckets, not
  // folded into "common" — `confidence` is null on them by design, and a
  // reviewed record is the opposite of an unreviewed ambiguous one.
  const auto = all.filter((r) => r.status === "auto");
  const reviewed = all.length - auto.length;
  const distinctive = auto.filter((r) => r.confidence === "distinctive").length;
  const common = auto.length - distinctive;
  console.log(
    `Wrote ${byChapter.length} files to ${path.relative(ROOT, OUT_DIR)} — ` +
      `${total} records (${distinctive} distinctive, ${common} common, ` +
      `${reviewed} reviewed), ${preserved} preserved, ${carried} review-only carried` +
      `${dropped ? `, ${dropped} stale` : ""}`,
  );

  if (!corpus) return;

  const count = (v) => all.filter((r) => r.lemma === v).length;
  console.log(
    `Greek check — ${count("present")} present, ${count("absent")} absent, ` +
      `${count("unchecked")} unchecked`,
  );
  await writeCoverage(corpus, all, publishedChapters);
}

/**
 * The gap the English scan structurally cannot see: verses where the lemma is
 * present but no rendering matched, i.e. renderings the glossary doesn't list.
 * Confined to published chapters so drafts don't read as omissions.
 */
async function writeCoverage(corpus, records, publishedChapters) {
  const recordedRefs = new Map(); // glossary id -> Set(ref)
  for (const r of records) {
    if (!r.term?.glossary) continue; // phase 2 will emit term-less tokens
    let set = recordedRefs.get(r.term.glossary);
    if (!set) recordedRefs.set(r.term.glossary, (set = new Set()));
    set.add(r.ref);
  }

  const terms = [];
  for (const [id, lemmas] of Object.entries(GLOSSARY_LEMMAS)) {
    const inScope = new Set();
    for (const lemma of lemmas) {
      for (const ref of corpus.refsByLemma.get(lemma) || []) {
        if (publishedChapters.has(ref.slice(0, ref.lastIndexOf(".")))) inScope.add(ref);
      }
    }
    const recorded = recordedRefs.get(id) || new Set();
    const missing = [...inScope].filter((ref) => !recorded.has(ref));
    const absent = records.filter(
      (r) => r.term?.glossary === id && r.lemma === "absent" && r.status !== "rejected",
    ).length;
    terms.push({
      glossary: id,
      lemmas,
      versesInScope: inScope.size,
      versesRecorded: inScope.size - missing.length,
      coverage: inScope.size ? +(1 - missing.length / inScope.size).toFixed(3) : null,
      recordsContradicted: absent,
      missingRefs: missing,
    });
  }

  // Worst coverage first — that's the reading order for a work list.
  terms.sort((a, b) => (a.coverage ?? 1) - (b.coverage ?? 1));
  await fs.writeFile(
    COVERAGE_FILE,
    `${JSON.stringify({ generated: "from a local MorphGNT working copy; not for redistribution", terms }, null, 2)}\n`,
    "utf8",
  );
  console.log(
    `Coverage work list → ${path.relative(ROOT, COVERAGE_FILE)} ` +
      `(${terms.reduce((a, t) => a + t.missingRefs.length, 0)} verses with the ` +
      `Greek but no matched rendering)`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
