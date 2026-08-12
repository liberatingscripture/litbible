// Re-checks every DECIDED record in src/data/alignment/ against the current
// scripture text, and reports the ones that no longer describe their verse.
//
// RUN IT WHENEVER THE TEXT HAS CHANGED, before committing review decisions.
// A reviewed record survives a rescan whole (mergeScanWithExisting keeps
// non-`auto` records intact), so a reworded verse leaves its record silently
// stale and `build:alignment` never mentions it — it reports dropped SCAN
// records only. Deliberately NOT part of CI or the pre-commit hook, and not
// part of `npm run build` (owner decision): it is a judgment prompt, not a
// gate. See "The Alignment Dataset" in CLAUDE.md.
//
// WHAT TO DO WITH A FINDING. Delete the stale record rather than marking it
// `rejected` — isDecided treats ANY non-`auto` record as settling the verse, so
// rejecting buries it from the review queue permanently, while deleting returns
// it to be decided. Repair in place only when the wording is unchanged and just
// the characters moved (a straight apostrophe turning curly).
//
// This is the fs/CLI shell: it walks the files and hands plain Maps to
// lib/alignment-audit-core.mjs, which holds the actual check.
//
//   node scripts/audit-alignment.mjs [--all]
//
//   --all   list every finding (the default caps the detail at 25)
//
// Exits 1 when anything is stale, so it can be chained if you want it to stop a
// script; the report is the point, though, not the exit code.

import { promises as fs } from "node:fs";
import path from "node:path";

import { splitChapterVerses } from "./lib/verse-text.mjs";
import { auditChapterRecords } from "./lib/alignment-audit-core.mjs";

const ROOT = process.cwd();
const CHAPTERS_DIR = path.join(ROOT, "src", "data", "chapters");
const ALIGNMENT_DIR = path.join(ROOT, "src", "data", "alignment");

const DETAIL_CAP = 25;

/** Read a chapter's verses, or null when the chapter file is missing. */
async function readChapterVerses(bookKey, chapter) {
  const file = path.join(CHAPTERS_DIR, `${bookKey}-${chapter}.json`);
  let raw;
  try {
    raw = await fs.readFile(file, "utf8");
  } catch (err) {
    if (err.code === "ENOENT") return null;
    throw err;
  }
  return splitChapterVerses(JSON.parse(raw).paragraphs);
}

async function main() {
  const showAll = process.argv.includes("--all");

  let files;
  try {
    files = (await fs.readdir(ALIGNMENT_DIR)).filter((f) => f.endsWith(".json")).sort();
  } catch (err) {
    if (err.code === "ENOENT") {
      console.error(`No alignment data at ${path.relative(ROOT, ALIGNMENT_DIR)}.`);
      process.exit(1);
    }
    throw err;
  }

  let checked = 0;
  const stale = [];
  const orphaned = [];

  for (const file of files) {
    const match = file.match(/^(.+)-(\d+)\.json$/);
    if (!match) continue;
    const [, bookKey, chapterText] = match;
    const chapter = Number(chapterText);

    const data = JSON.parse(await fs.readFile(path.join(ALIGNMENT_DIR, file), "utf8"));
    const verses = await readChapterVerses(bookKey, chapter);
    if (verses === null) {
      orphaned.push(file);
      continue;
    }

    const result = auditChapterRecords({ chapter, records: data.records, verses });
    checked += result.checked;
    stale.push(...result.stale);
  }

  console.log(`Alignment files      : ${files.length}`);
  console.log(`Decided records      : ${checked}`);
  console.log(`Stale                : ${stale.length}`);

  if (orphaned.length) {
    console.log(
      `\nNo chapter file for ${orphaned.length} alignment file(s): ${orphaned.join(", ")}`,
    );
  }

  const shown = showAll ? stale : stale.slice(0, DETAIL_CAP);
  for (const finding of shown) {
    console.log(
      `\n  ${finding.ref}  want "${finding.text}" ` +
        `(n=${finding.n}, form "${finding.form}") — ${finding.reason}`,
    );
    if (finding.verseText) console.log(`    text: ${finding.verseText.slice(0, 175)}`);
  }
  if (stale.length > shown.length) {
    console.log(`\n  …and ${stale.length - shown.length} more. Re-run with --all.`);
  }

  if (stale.length) {
    console.log(
      "\nDelete a stale record rather than rejecting it — a rejected record still " +
        "counts as decided and never returns to the review queue.",
    );
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
