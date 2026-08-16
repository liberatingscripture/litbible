#!/usr/bin/env node
// Read-only scan of the Word masters for defects a DIFF cannot see.
//
// WHY A SEPARATE SCRIPT. build-ledger.mjs compares two sides, so it is
// structurally blind to anything wrong on both, and it only ever reports a
// master-side defect that also happens to produce a difference. Of the four
// multi-paragraph footnotes in the masters, exactly one surfaced that way -
// the other three sit in footnotes whose text matches the repo, so nothing
// would ever have mentioned them.
//
// The masters are READ-ONLY from this repo, always. This script reports; the
// fixes belong in Word and land on the back-port list in
// FOLLOW-UP-RECONCILIATION.md.
//
// Usage:
//   node scripts/reconcile/check-master-hygiene.mjs [--master-dir=<path>]
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { DOCX_TO_BOOKKEY } from "./lib/book-map.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function argValue(flag) {
  const pref = `--${flag}=`;
  const found = process.argv.find((a) => a.startsWith(pref));
  return found ? found.slice(pref.length) : undefined;
}

const MASTER_XML_DIR = argValue("master-dir") || process.env.MASTER_XML_DIR;
if (!MASTER_XML_DIR || !existsSync(MASTER_XML_DIR)) {
  console.error(`Master XML directory not found: ${MASTER_XML_DIR ?? "(unset)"}`);
  console.error("Pass --master-dir=<path> or set MASTER_XML_DIR. See scripts/reconcile/README.md.");
  process.exit(1);
}

// w:id -1 and 0 are Word's separator/continuation-separator pseudo-footnotes,
// present in every document and never authored content.
const FOOTNOTE_RE = /<w:footnote\b[^>]*\bw:id="(-?\d+)"[^>]*>([\s\S]*?)<\/w:footnote>/g;
const PARA_RE = /<w:p\b/g;
const TEXT_RE = /<w:t\b[^>]*>([\s\S]*?)<\/w:t>/g;

function footnoteText(xml) {
  let out = "";
  TEXT_RE.lastIndex = 0;
  let m;
  while ((m = TEXT_RE.exec(xml))) out += m[1];
  return out.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/\s+/g, " ").trim();
}

const findings = [];
let booksScanned = 0;

for (const [docxName, bookKey] of Object.entries(DOCX_TO_BOOKKEY)) {
  const fnXmlPath = path.join(MASTER_XML_DIR, docxName, "word", "footnotes.xml");
  if (!existsSync(fnXmlPath)) continue;
  booksScanned++;
  const xml = readFileSync(fnXmlPath, "utf8");

  FOOTNOTE_RE.lastIndex = 0;
  let m;
  while ((m = FOOTNOTE_RE.exec(xml))) {
    const id = Number(m[1]);
    if (id === -1 || id === 0) continue;
    const body = m[2];
    const blocks = (body.match(PARA_RE) || []).length;

    // A footnote split across several <w:p> blocks. Word treats each block as
    // its own paragraph, and every consumer downstream of the masters expects
    // one footnote to be one run of prose - the repo carries all four of these
    // as single notes, and the apps' glossary/footnote surfaces have no
    // paragraph concept at all. So this is a defect to fix in Word, with one
    // exception noted in the report.
    if (blocks > 1) {
      findings.push({ bookKey, docxName, id, blocks, text: footnoteText(body).slice(0, 120) });
    }
  }
}

console.log(`Scanned ${booksScanned} master documents under ${MASTER_XML_DIR}`);
console.log("");
console.log(`Multi-paragraph footnotes: ${findings.length}`);
for (const f of findings) {
  console.log(`  ${f.bookKey} (${f.docxName}) w:id=${f.id} - ${f.blocks} <w:p> blocks`);
  console.log(`    ${f.text}...`);
}
if (findings.length) {
  console.log("");
  console.log("Fix these in Word by replacing the paragraph break with a line break (Shift+Enter),");
  console.log("which keeps the note as one footnote. One of them is deliberate rather than a mistake:");
  console.log("1 Corinthians' three-block note is the chiasm whose lines are real, and the repo already");
  console.log("renders it as <div class=\"chiasm\"> - it still wants line breaks rather than paragraphs.");
}
process.exit(0);
