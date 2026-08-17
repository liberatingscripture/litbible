#!/usr/bin/env node
// Repair verse markers that lost the whitespace separating them from the
// preceding text during an earlier restore.
//
// WHAT HAPPENED. locateVerseSpanInParagraphs ends a verse's span AT the next
// verse's marker, so the single space standing between `…sheep.` and
// `<span class="vglue">` lives inside the span a restore replaces. The Word
// master has no such space - it has no marker to separate from - so a span
// rebuilt from master text simply lacks it, and the page renders `sheep.12 The`
// with the verse number welded to the previous sentence.
//
// Nothing reported it. `sup.vn` is `inline-block` and no rule in global.css or
// read-mode.css supplies a gap, so the separator has to be in the text; but the
// page still lays out, validate-chapters.mjs checks references and prose rather
// than spacing, and apply.mjs's structural fingerprint did not look. The corpus
// holds 4,159 correctly separated markers against 3 that were already like this
// before the reconciliation began, so the convention is not in doubt.
//
// This is splitTrailingBlockClose's defect one level down, and it shipped the
// same way: 3 before the restores, 46 after "Restore punctuation and dropped
// wording on 71 verses", 120 after "Apply the hand review". build-ledger.mjs no
// longer produces it (splitTrailingSeparator) and apply.mjs now fails on it
// (unseparatedMarkers), so this script is a one-off for what already shipped -
// kept in the tree because it documents the defect and is safe to re-run.
//
// HOW IT REPAIRS. Never by assuming a space: every marker is looked up by
// VERSE NUMBER in the pre-restore revision, and repaired only if the separator
// is visible there, with exactly the whitespace that revision used. A marker
// that was already unseparated then is left alone - that is the author's text,
// not our damage. Looking up by verse rather than by paragraph index means a
// paragraph that has since been split or joined cannot mis-target the repair.
//
// Byte-level splice throughout (lib/json-splice.mjs), never a reserialize -
// build-api-manifest.mjs hashes chapter files by raw bytes, so a
// JSON.parse -> stringify round-trip would move all 260 hashes and force every
// app install to re-download the corpus for no content change.
//
// Usage:
//   node scripts/reconcile/repair-verse-separators.mjs [--write] [--base=<rev>]
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

import { spliceValue } from "./lib/json-splice.mjs";
import { findUnseparatedVerseMarkers } from "./lib/verse-span.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "../..");
const CHAPTERS_DIR = path.resolve(REPO_ROOT, "src/data/chapters");

const WRITE = process.argv.includes("--write");
const argValue = (flag, fallback) => {
  const pref = `--${flag}=`;
  const found = process.argv.find((a) => a.startsWith(pref));
  return found ? found.slice(pref.length) : fallback;
};
// The last revision before the verse restores landed. Used only to CHECK the
// inferred repair, never to source text - the wording has legitimately changed.
const BASE = argValue("base", "2cf906a~1");

function baseVersion(relPath) {
  try {
    return JSON.parse(
      execFileSync("git", ["show", `${BASE}:${relPath}`], { cwd: REPO_ROOT, encoding: "utf8", maxBuffer: 1 << 28 }),
    );
  } catch {
    return null;
  }
}

/** The whitespace immediately preceding verse `n`'s marker anywhere in these
 *  paragraphs, or null if the verse isn't found / isn't separated there. */
function separatorInBase(paragraphs, n) {
  const needle = `<span class="vglue"><sup id="v${n}" class="vn">`;
  for (const p of paragraphs || []) {
    const at = String(p).indexOf(needle);
    if (at === -1) continue;
    const ws = /\s+$/.exec(String(p).slice(0, at));
    return ws ? ws[0] : null;
  }
  return null;
}

const findings = [];
let repaired = 0;
for (const file of readdirSync(CHAPTERS_DIR).filter((f) => f.endsWith(".json")).sort()) {
  const full = path.join(CHAPTERS_DIR, file);
  const raw = readFileSync(full, "utf8");
  const parsed = JSON.parse(raw);
  const hits = findUnseparatedVerseMarkers(parsed.paragraphs || []);
  if (hits.length === 0) continue;

  const base = baseVersion(`src/data/chapters/${file}`);
  if (base === null) {
    for (const h of hits) findings.push({ file, verse: h.verse, problem: `no ${BASE} version of this file to check against - left alone` });
    continue;
  }

  // Group by paragraph: one splice per string value, however many markers it
  // holds, since each splice invalidates offsets computed before it.
  const byParagraph = new Map();
  for (const h of hits) {
    const sep = separatorInBase(base.paragraphs, h.verse);
    if (sep === null) {
      findings.push({ file, verse: h.verse, problem: `verse ${h.verse} carried no separator at ${BASE} either - author's text, left alone` });
      continue;
    }
    if (!byParagraph.has(h.paragraphIndex)) byParagraph.set(h.paragraphIndex, []);
    byParagraph.get(h.paragraphIndex).push({ verse: h.verse, sep });
  }
  if (byParagraph.size === 0) continue;

  let out = raw;
  for (const [pi, edits] of byParagraph) {
    const oldValue = parsed.paragraphs[pi];
    let newValue = oldValue;
    for (const e of edits) {
      const needle = `<span class="vglue"><sup id="v${e.verse}" class="vn">`;
      const at = newValue.indexOf(needle);
      if (at === -1 || newValue.indexOf(needle, at + 1) !== -1) {
        findings.push({ file, verse: e.verse, problem: `marker is missing or not unique in paragraphs[${pi}] - left alone` });
        continue;
      }
      newValue = newValue.slice(0, at) + e.sep + newValue.slice(at);
      repaired++;
      console.log(`${WRITE ? "repaired" : "would repair"} ${file} paragraphs[${pi}] v${e.verse} += ${JSON.stringify(e.sep)} before its marker`);
    }
    if (newValue !== oldValue) out = spliceValue(out, ["paragraphs", pi], oldValue, newValue);
  }
  if (WRITE && out !== raw) writeFileSync(full, out, "utf8");
}

console.log(`\n${WRITE ? "repaired" : "would repair"}: ${repaired} marker(s)`);
for (const f of findings) console.log(`SKIPPED ${f.file} v${f.verse}: ${f.problem}`);
if (!WRITE) console.log("\nNothing was written. Re-run with --write to repair.");
