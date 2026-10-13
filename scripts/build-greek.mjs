/**
 * build-greek.mjs
 *
 * `npm run build:greek` writes public/greek/, the data behind the Study Desk's
 * Greek tab (STUDY-DESK.md, "Decisions", 2026-10-08; phase 1f):
 *
 *   text/<book>-<chapter>.json   the SBLGNT, word by word, for all 260 chapters
 *   ubs/<NN>.json               the UBS Greek NT Dictionary, in 64 shards
 *   step/<NN>.json              STEPBible's brief lexicon, in 64 shards
 *   lsj/<NNN>.json              STEPBible's formatted LSJ, in 128 shards
 *   LICENSE.txt                 what each directory is built from, and its licence
 *
 * A website asset: it never moves under public/api/ (the apps don't read it).
 * Not part of `npm run build`: the sources live outside the repo, the output is
 * committed, and a build must never rewrite source (the same call as
 * build:favicons and build:alignment). Run it by hand when a source or the
 * rules change; the output is deterministic, so a rerun with nothing new
 * changes nothing.
 *
 * Sources, none of them in the repo (see scripts/lib/greek-core.mjs for how
 * they are joined; every rule that decides what a file says lives there):
 *
 *   GREEK_SOURCES_DIR   (default C:\Users\bcjoh\GitHub\greek-sources)
 *     sblgnt/             SBL's SBLGNT v1.2: the text of record, and its apparatus
 *     macula-greek/       MACULA Greek (SBLGNT and Nestle 1904 TSVs)
 *     ubs/                the UBS Greek NT Dictionary
 *     stepbible/Lexicons/ TBESG and TFLSJ
 *   MORPHGNT_DIR          MorphGNT's SBLGNT clone, as for build:alignment
 *
 * Prints a report: every disagreement between the sources is listed, never
 * resolved by guessing.
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { BOOKS, BOOK_ORDER, bookKeyToLabel } from "../src/data/books.js";
import { OSIS_BOOKS } from "../src/lib/osis.mjs";
import { loadMorphGnt } from "./lib/morphgnt.mjs";
import {
  BORROWED_DOXOLOGY,
  BORROWED_JOHN,
  MACULA_BOOKS,
  UBS_FIRST_BOOK,
  buildBook,
  dropDuplicateEntries,
  countSenses,
  headword,
  lsjEntries,
  lsjShard,
  makeLemmaResolver,
  maculaToMorph,
  newReport,
  pairMaculaWithMorph,
  parseApparatusXml,
  parseMaculaTsv,
  parseSblXml,
  parseStepLexicon,
  pickGloss,
  posHints,
  shardEntries,
  stepEntries,
  stepShard,
  strongByLemma,
  ubsEntryShard,
  ubsLemmaIndex,
  ubsSenseRefs,
  ubsShard,
} from "./lib/greek-core.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "public", "greek");
const SOURCES = process.env.GREEK_SOURCES_DIR || "C:\\Users\\bcjoh\\GitHub\\greek-sources";
const MORPHGNT_DIR = process.env.MORPHGNT_DIR || path.join(ROOT, ".morphgnt");

const sblDir = path.join(SOURCES, "sblgnt", "data", "sblgnt", "xml");
const appDir = path.join(SOURCES, "sblgnt", "data", "sblgntapp", "xml");
const maculaSbl = path.join(SOURCES, "macula-greek", "SBLGNT", "tsv", "macula-greek-SBLGNT.tsv");
const maculaNestle = path.join(SOURCES, "macula-greek", "Nestle1904", "tsv", "macula-greek-Nestle1904.tsv");
const ubsFile = path.join(SOURCES, "ubs", "dictionaries", "greek", "JSON", "UBSGreekNTDic-v1.1-en.JSON");
const lexDir = path.join(SOURCES, "stepbible", "Lexicons");

const exists = (p) => fs.access(p).then(() => true, () => false);

/** The SBLGNT file name for each book key: the OSIS name, which SBL's files share. */
const sblFile = (bookKey) => `${OSIS_BOOKS[bookKey]}.xml`;

async function lexiconFiles() {
  let names = [];
  try {
    names = await fs.readdir(lexDir);
  } catch {
    return {};
  }
  const find = (re) => names.find((n) => re.test(n));
  return {
    tbesg: find(/^TBESG/),
    lsjMain: find(/^TFLSJ\s+0-5624/),
    lsjExtra: find(/^TFLSJ extra/),
  };
}

async function checkSources() {
  const lex = await lexiconFiles();
  const needs = [
    [sblDir, "SBLGNT text (sblgnt/data/sblgnt/xml)"],
    [appDir, "SBLGNT apparatus (sblgnt/data/sblgntapp/xml)"],
    [maculaSbl, "MACULA SBLGNT TSV"],
    [maculaNestle, "MACULA Nestle 1904 TSV"],
    [ubsFile, "UBS Greek NT Dictionary JSON"],
    [lex.tbesg && path.join(lexDir, lex.tbesg), "STEPBible TBESG lexicon"],
    [lex.lsjMain && path.join(lexDir, lex.lsjMain), "STEPBible TFLSJ 0-5624 lexicon"],
    [lex.lsjExtra && path.join(lexDir, lex.lsjExtra), "STEPBible TFLSJ extra lexicon"],
  ];
  const missing = [];
  for (const [p, what] of needs) if (!p || !(await exists(p))) missing.push(`  ${what}: ${p ?? lexDir}`);
  for (const key of BOOK_ORDER) {
    if (!(await exists(path.join(sblDir, sblFile(key))))) missing.push(`  SBLGNT ${sblFile(key)} in ${sblDir}`);
    if (!(await exists(path.join(appDir, sblFile(key))))) missing.push(`  apparatus ${sblFile(key)} in ${appDir}`);
  }
  if (missing.length) {
    console.error(
      `build:greek needs the Greek sources, which live outside the repo, and cannot find:\n${missing.join("\n")}\n\n` +
        `Set GREEK_SOURCES_DIR to the folder holding sblgnt/, macula-greek/, ubs/ and stepbible/ (now: ${SOURCES}),\n` +
        `and MORPHGNT_DIR to a MorphGNT SBLGNT clone (now: ${MORPHGNT_DIR}).`,
    );
    process.exit(1);
  }
  return lex;
}

const readText = (p) => fs.readFile(p, "utf8").then((s) => s.replace(/^\uFEFF/, ""));

/** Compact, deterministic JSON, in NFC. */
const json = (v) => `${JSON.stringify(v).normalize("NFC")}\n`;

async function writeJson(file, value) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, json(value), "utf8");
}

async function dirStats(dir) {
  let files = 0;
  let bytes = 0;
  for (const name of await fs.readdir(dir).catch(() => [])) {
    const stat = await fs.stat(path.join(dir, name));
    files++;
    bytes += stat.size;
  }
  return { files, bytes };
}

const kb = (n) => (n < 1048576 ? `${(n / 1024).toFixed(0)} KB` : `${(n / 1048576).toFixed(1)} MB`);
const sample = (list, n = 12) => (list.length > n ? [...list.slice(0, n), `… and ${list.length - n} more`] : list);

async function main() {
  const lex = await checkSources();

  // ---- load
  console.log("Reading the sources…");
  const morph = await loadMorphGnt(MORPHGNT_DIR, OSIS_BOOKS, { withTokens: true });
  if (!morph) {
    console.error(`build:greek needs MorphGNT's SBLGNT files (…-morphgnt.txt) in MORPHGNT_DIR (now: ${MORPHGNT_DIR}).`);
    process.exit(1);
  }
  const macula = parseMaculaTsv(await readText(maculaSbl));
  const nestle = parseMaculaTsv(await readText(maculaNestle));
  const ubs = JSON.parse(await readText(ubsFile));
  const tbesgRows = parseStepLexicon(await readText(path.join(lexDir, lex.tbesg)));
  const lsjRows = [
    ...parseStepLexicon(await readText(path.join(lexDir, lex.lsjMain))),
    ...parseStepLexicon(await readText(path.join(lexDir, lex.lsjExtra))),
  ];

  // ---- the bridges between sources
  // MACULA's SBLGNT words, paired with MorphGNT's wherever a verse agrees:
  // that gives each lemma its Strong's number, and teaches the part-of-speech
  // hints for the borrowed passages.
  const pairs = [];
  let verseDisagree = 0;
  for (const [ref, tokens] of morph.tokensByRef) {
    const [osis, chapter, verse] = ref.split(".");
    const bookKey = Object.keys(OSIS_BOOKS).find((k) => OSIS_BOOKS[k] === osis);
    const code = MACULA_BOOKS[BOOK_ORDER.indexOf(bookKey)];
    const got = pairMaculaWithMorph(macula.get(`${code} ${chapter}:${verse}`), tokens);
    if (got) pairs.push(...got);
    else verseDisagree++;
  }
  const lemmaStrong = strongByLemma(pairs);
  const hints = posHints(pairs.map(([m, t]) => [m, t.pos]));
  let posAgree = 0;
  let parseAgree = 0;
  for (const [m, t] of pairs) {
    const conv = maculaToMorph(m, hints);
    if (conv.pos === t.pos) posAgree++;
    if (conv.parse === t.parse) parseAgree++;
  }

  const ubsIndex = ubsLemmaIndex(ubs);
  const refsCache = new Map();
  const ubsRefs = (entry) => {
    let refs = refsCache.get(entry.MainId);
    if (!refs) refsCache.set(entry.MainId, (refs = ubsSenseRefs(entry)));
    return refs;
  };

  const tbesgGloss = new Map();
  const tbesgByGreek = new Map();
  for (const r of tbesgRows) {
    if (r.gloss && !tbesgGloss.has(r.key)) tbesgGloss.set(r.key, r.gloss);
    const h = headword(r.greek);
    if (h && !tbesgByGreek.has(h)) tbesgByGreek.set(h, r.key);
  }

  const lemmaStats = {};
  const resolveLemma = makeLemmaResolver({ lemmaStrong, ubsIndex, tbesgByGreek, tbesgGloss, stats: lemmaStats });

  // ---- text/
  console.log("Building the 260 chapters…");
  // Only what this script writes, so nothing else placed in public/greek/ is lost.
  for (const dir of ["text", "ubs", "step", "lsj"]) await fs.rm(path.join(OUT, dir), { recursive: true, force: true });
  const report = newReport();
  const usedStrongs = new Set();
  const docs = [];
  for (const [i, bookKey] of BOOK_ORDER.entries()) {
    const code = MACULA_BOOKS[i];
    const osis = OSIS_BOOKS[bookKey];
    const chapters = buildBook({
      bookKey,
      chapters: BOOKS[bookKey],
      sbl: parseSblXml(await readText(path.join(sblDir, sblFile(bookKey)))),
      apparatus: parseApparatusXml(await readText(path.join(appDir, sblFile(bookKey)))),
      morphVerse: (c, v) => morph.tokensByRef.get(`${osis}.${c}.${v}`),
      maculaVerse: (c, v) => macula.get(`${code} ${c}:${v}`),
      nestleVerse: (c, v) => nestle.get(`${code} ${c}:${v}`),
      hints,
      resolveLemma,
      ubsRefs,
      ubsBook: UBS_FIRST_BOOK + i,
      report,
    });
    docs.push(...chapters);
  }

  // A lemma's gloss is the first gloss of the sense the whole corpus gives it
  // most often, so it can only be set once every chapter is built.
  const senseCounts = countSenses(docs);
  for (const doc of docs) {
    for (const lemma of doc.lemmas) {
      const info = resolveLemma(lemma[0]);
      lemma[3] = pickGloss(info.entry, senseCounts.get(lemma[0]), info.gloss);
      if (lemma[1]) usedStrongs.add(lemma[1]);
    }
    await writeJson(path.join(OUT, "text", `${doc.book}-${doc.chapter}.json`), doc);
  }
  const chapterCount = docs.length;

  // ---- ubs/
  const refLabel = (book, chapter, verse) => {
    const key = BOOK_ORDER[book - UBS_FIRST_BOOK];
    return key ? `${bookKeyToLabel(key)} ${chapter}:${verse}` : null;
  };
  const unknownMarkup = {};
  const ubsByShard = new Map();
  const usedUbs = [...lemmaStats.usedUbs].sort();
  const ubsEntries = new Map(ubs.map((e) => [e.MainId, e]));
  for (const id of usedUbs) {
    const name = ubsShard(id);
    let shard = ubsByShard.get(name);
    if (!shard) ubsByShard.set(name, (shard = {}));
    shard[id] = ubsEntryShard(ubsEntries.get(id), refLabel, unknownMarkup);
  }
  for (const [name, shard] of ubsByShard) await writeJson(path.join(OUT, "ubs", `${name}.json`), shard);

  // ---- step/ and lsj/
  const stepAll = stepEntries(tbesgRows);
  const stepDropped = dropDuplicateEntries(stepAll, usedStrongs);
  const stepShards = shardEntries(stepAll, stepShard, usedStrongs);
  for (const [name, shard] of stepShards) await writeJson(path.join(OUT, "step", `${name}.json`), shard);
  const lsjAll = lsjEntries(lsjRows);
  const lsjDropped = dropDuplicateEntries(lsjAll, usedStrongs);
  const lsjShards = shardEntries(lsjAll, lsjShard, usedStrongs);
  for (const [name, shard] of lsjShards) await writeJson(path.join(OUT, "lsj", `${name}.json`), shard);
  const lacking = (map) => [...usedStrongs].filter((k) => !map.has(k)).sort((a, b) => Number(a.slice(1)) - Number(b.slice(1)));

  await fs.writeFile(path.join(OUT, "LICENSE.txt"), LICENSE_TEXT, "utf8");

  // ---- report
  const sizes = {};
  for (const dir of ["text", "ubs", "step", "lsj"]) sizes[dir] = await dirStats(path.join(OUT, dir));
  const noStrong = [...lemmaStats.noStrong].sort();
  const noUbs = [...lemmaStats.noUbs].sort();
  const senseTotal = Object.values(report.senses).reduce((a, b) => a + b, 0);
  const lines = [
    "",
    "build:greek report",
    "==================",
    `chapters written: ${chapterCount} (of ${Object.values(BOOKS).reduce((a, b) => a + b, 0)})`,
    `words: ${report.wordsFromMorphgnt} from MorphGNT, ${report.wordsFromMacula} borrowed from MACULA SBLGNT (${BORROWED_JOHN}), ${report.wordsFromNestle} parsed from MACULA Nestle 1904 (${BORROWED_DOXOLOGY})`,
    "",
    `SBL against MorphGNT: ${report.mismatches.length} verses disagree in word count or form`,
    ...sample(report.mismatches).map((l) => `  ${l}`),
    `MorphGNT verses SBL lacks: ${report.morphOnly.length}`,
    ...sample(report.morphOnly).map((l) => `  ${l}`),
    `SBL verses MorphGNT lacks and MACULA could not supply: ${report.borrowFailed.length}`,
    ...sample(report.borrowFailed).map((l) => `  ${l}`),
    `borrowed verses parsed only in part (the other edition words them differently): ${report.borrowPartial.length}`,
    ...sample(report.borrowPartial).map((l) => `  ${l}`),
    `chapters with no SBL words: ${report.emptyChapters.length}`,
    `Romans 16:25–27 words with no Nestle 1904 match (left unparsed): ${report.doxologyUnmatched.length}`,
    ...sample(report.doxologyUnmatched).map((l) => `  ${l}`),
    "",
    `MACULA code conversion, over ${pairs.length} words MACULA and MorphGNT both parse (${verseDisagree} verses skipped as not agreeing):`,
    `  part of speech identical to MorphGNT: ${((posAgree / pairs.length) * 100).toFixed(1)}% (with hints learned from the same words)`,
    `  parsing identical to MorphGNT: ${((parseAgree / pairs.length) * 100).toFixed(1)}%`,
    "",
    `Strong's numbers by source: ${JSON.stringify(lemmaStats.strongFrom)}`,
    `lemmas with no Strong's number: ${noStrong.length} ${sample(noStrong, 20).join(" ")}`,
    `lemmas with no UBS entry: ${noUbs.length} ${sample(noUbs, 20).join(" ")}`,
    `UBS entries written: ${usedUbs.length} of ${ubs.length}; unknown markup removed: ${JSON.stringify(unknownMarkup)}`,
    `UBS senses by word: ${report.senses.assigned} assigned (${((report.senses.assigned / senseTotal) * 100).toFixed(1)}% of lemma words), ` +
      `${report.senses.noRefs} null (entry has no citation in the verse), ${report.senses.ambiguous} null (counts differ, senses mixed), ` +
      `${report.senses.noEntry} null (no UBS entry)`,
    `identical lexicon entries dropped within a Strong's number: ${stepDropped} in step/, ${lsjDropped} in lsj/`,
    `Strong's numbers used: ${usedStrongs.size}; missing from the brief lexicon: ${lacking(stepAll).length} ${sample(lacking(stepAll), 20).join(" ")}; ` +
      `missing from LSJ: ${lacking(lsjAll).length} ${sample(lacking(lsjAll), 20).join(" ")}`,
    "",
    ...["text", "ubs", "step", "lsj"].map((d) => `public/greek/${d}: ${sizes[d].files} files, ${kb(sizes[d].bytes)}`),
    "",
  ];
  console.log(lines.join("\n"));
}

const LICENSE_TEXT = `The Greek tab's data. Nothing from the LIT is in these files.

text/
  The Greek New Testament word by word, one file per chapter.
  The text is the SBL Greek New Testament (SBLGNT), edited by Michael W.
  Holmes, copyright 2010 Society of Biblical Literature and Logos Bible
  Software, CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/;
  https://sblgnt.com). Lemmas and parsing are from MorphGNT's SBLGNT
  (https://github.com/morphgnt/sblgnt), CC BY-SA 3.0, with Strong's numbers
  and the parsing of John 7:53-8:11 and Romans 16:25-27 from MACULA Greek
  (Clear Bible, https://github.com/Clear-Bible/macula-greek), CC BY 4.0. The
  Greek of Romans 16:25-27 is from the SBLGNT apparatus.
  Sense numbers point into the UBS dictionary below.
  This directory is licensed CC BY-SA 4.0.

ubs/
  Entries of the UBS Greek New Testament Dictionary (United Bible Societies,
  CC BY-SA 4.0), built from the semantic-domain dictionary based on Louw and
  Nida. Inline markup is reduced to plain text. This directory is licensed
  CC BY-SA 4.0.

step/
  The Translators Brief lexicon of Extended Strongs for Greek (TBESG), from
  STEPBible.org, Tyndale House Cambridge, CC BY 4.0, based on Abbott-Smith.
  Reformatted for the Greek tab: markup reduced to bold, italic and line
  breaks, and references made plain text.

lsj/
  The Translators Formatted full LSJ lexicon, from STEPBible.org, Tyndale
  House Cambridge, CC BY 4.0, edited from Liddell, Scott and Jones.
  Reformatted for the Greek tab: markup reduced to bold, italic and line
  breaks, references made plain text, and each source reference kept as
  hover text.

  STEPBible asks that its data be taken from its own source, where
  corrections arrive, rather than passed on by others. These two
  directories are formatted for the Greek tab and are not a copy of the
  data: to use the lexicons yourself, get them from
  https://github.com/STEPBible/STEPBible-Data (CC BY 4.0).
`;

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
