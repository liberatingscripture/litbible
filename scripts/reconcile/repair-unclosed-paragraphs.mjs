#!/usr/bin/env node
// Repair paragraphs whose closing block tag was lost by an earlier restore.
//
// WHAT HAPPENED. locateVerseSpanInParagraphs gives the LAST verse in a
// paragraph a span that runs to the end of the string - closing tags included,
// because they come after that verse's text and nothing else claims them. The
// Word master carries no markup at all, so rebuilding that span from master
// text wrote content where `</p>` used to be. 59 paragraphs across 57 files
// lost a closing tag that way: 28 in "Restore punctuation and dropped wording
// on 71 verses" and 31 more in "Apply the hand review". The corpus had zero
// before those two.
//
// Nothing reported it. A browser closes a dangling `<p>` at the next block
// element, so the rendered page looks very nearly right; validate-chapters.mjs
// checks references and prose, not tag balance; and apply.mjs's structural
// fingerprint checked verse markers, anchors and footnotes but not this.
// build-ledger.mjs no longer produces it (splitTrailingBlockClose) and
// apply.mjs now fails on it (blockBalance), so this script is a one-off for
// what already shipped - kept in the tree because it documents the defect and
// is safe to re-run.
//
// HOW IT REPAIRS. Every damaged string is well-nested up to a truncated tail,
// so the missing tags are exactly the unclosed openers in reverse order. That
// inference is then CHECKED against git: the same paragraph before the damage
// ended in some run of closing tags, and the repair has to reproduce it. A
// paragraph whose two answers disagree is reported and left alone.
//
// Byte-level splice throughout (lib/json-splice.mjs), never a reserialize -
// build-api-manifest.mjs hashes chapter files by raw bytes, so a
// JSON.parse -> stringify round-trip would move all 260 hashes and force every
// app install to re-download the corpus for no content change.
//
// Usage:
//   node scripts/reconcile/repair-unclosed-paragraphs.mjs [--write] [--base=<rev>]
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

import { spliceValue } from "./lib/json-splice.mjs";
import { missingClosers, trailingBlockClose } from "./lib/block-structure.mjs";

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
// inferred repair, never to source text - the paragraphs' content has
// legitimately changed since.
const BASE = argValue("base", "2cf906a~1");

function baseVersion(relPath) {
  try {
    return JSON.parse(execFileSync("git", ["show", `${BASE}:${relPath}`], { cwd: REPO_ROOT, encoding: "utf8", maxBuffer: 1 << 28 }));
  } catch {
    return null;
  }
}

const findings = [];
for (const file of readdirSync(CHAPTERS_DIR).filter((f) => f.endsWith(".json")).sort()) {
  const full = path.join(CHAPTERS_DIR, file);
  const raw = readFileSync(full, "utf8");
  const parsed = JSON.parse(raw);
  const relPath = `src/data/chapters/${file}`;
  let base = null;

  const repairs = [];
  (parsed.paragraphs || []).forEach((s, i) => {
    const missing = missingClosers(s);
    if (missing === null) {
      findings.push({ file, index: i, problem: "block tags are mis-nested, not merely truncated - left alone" });
      return;
    }
    if (missing === "") return;

    if (base === null) base = baseVersion(relPath) ?? false;
    const wasBefore = base ? trailingBlockClose(base.paragraphs?.[i] ?? "") : undefined;
    const expected = trailingBlockClose(s + missing);
    if (base && wasBefore !== undefined && wasBefore !== expected) {
      findings.push({
        file,
        index: i,
        problem: `inferred repair ${JSON.stringify(missing)} does not reproduce the pre-damage ending ${JSON.stringify(wasBefore)} - left alone`,
      });
      return;
    }
    repairs.push({ index: i, oldValue: s, newValue: s + missing, missing, corroborated: base !== false });
  });

  if (repairs.length === 0) continue;
  let out = raw;
  for (const r of repairs) out = spliceValue(out, ["paragraphs", r.index], r.oldValue, r.newValue);
  if (WRITE) writeFileSync(full, out, "utf8");
  for (const r of repairs) {
    console.log(`${WRITE ? "repaired" : "would repair"} ${file} paragraphs[${r.index}] += ${r.missing}${r.corroborated ? "" : "  (NOT corroborated against git)"}`);
  }
}

console.log("");
for (const f of findings) console.log(`SKIPPED ${f.file} paragraphs[${f.index}]: ${f.problem}`);
if (!WRITE) console.log("\nNothing was written. Re-run with --write to repair.");
process.exit(findings.length ? 1 : 0);
