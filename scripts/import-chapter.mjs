#!/usr/bin/env node
/**
 * import-chapter.mjs — build chapter JSON from a Word master, changing nothing.
 *
 *   node scripts/import-chapter.mjs --docx="…/Titus.docx" --book=titus --chapter=2
 *   node scripts/import-chapter.mjs --docx=… --book=titus --all
 *   node scripts/import-chapter.mjs --docx=… --book=titus --chapter=2 --report
 *
 * THE GUARANTEE. Not one visible character of the master reaches the JSON
 * altered, with exactly two pre-approved exceptions:
 *
 *   - straight quotes become curly  ( "  '  ->  “ ” ‘ ’ )
 *   - a hyphen between digits becomes an en dash  ( 5:3-12 -> 5:3–12 )
 *
 * Everything else the import notices — a typo, a mismatched quotation, a note
 * Word split across paragraphs — is REPORTED AND REFUSED, never repaired. The
 * master is the origin of the translation, so a fix belongs in Word first; the
 * import then re-runs and agrees with it. Repairing on the way in is exactly
 * how the repo and the masters drifted apart in the first place.
 *
 * The guarantee is enforced, not promised. After building, a fidelity gate
 * reconstructs the master's own visible text, folds the two allowed classes
 * back out of the generated text, and refuses to write unless the two are
 * identical. Markup, footnote anchor letters, and whitespace runs are outside
 * that comparison by construction; every other character has to match.
 *
 * WHY THIS EXISTS. The 2026-02 import was hand-rolled and lossy in ways that
 * took six months to find (see FOLLOW-UP-RECONCILIATION.md). Each loss is
 * mechanical, so each is preventable at generation time:
 *
 *   1. A footnote reference is ZERO-WIDTH in Word. Rebuild a verse from master
 *      text alone and every <sup class="fn-ref"> anchor vanishes with it,
 *      stranding the note. Anchors come from the docx's own reference
 *      positions, never re-guessed. (§ "The Word masters", 1)
 *   2. A verse number is usually a superscript run, BUT NOT ALWAYS — eight
 *      chapters type one as body text and Mark 5:39 is subscript. The
 *      superscript pass and the blind digit-adjacency scan are cross-checked
 *      per chapter; disagreement is fatal, never silently resolved. (2)
 *   3. A verse marker needs a real space before it — sup.vn is inline-block
 *      and no CSS supplies the gap, so the separator lives in the text or the
 *      marker welds to the previous sentence. (6)
 *   4. A verse spanning a paragraph break carries its marker ONCE, at its
 *      start; the continuation paragraph opens with plain text. (§8)
 *   5. Word's run boundaries fragment words across per-letter tags
 *      (<em>ekd</em><em>e</em>…). Collapsed — markup only, no text. (§26)
 *
 * WHAT IT DOES NOT DECIDE. Three things are editorial, and are left marked:
 *   - `topics` — free-text labels, empty on import
 *   - poetry / block quotes — Word paragraph breaks arrive as <p>, so a
 *     passage set as poetry needs <p class="hbq-line"> or <blockquote> by hand
 *   - bracketed passages — the ⟦ … ⟧ markers and their paired footnotes
 * `indexed` is written FALSE: a fresh import is a draft until read against the
 * master. Flip it to true to publish.
 *
 * FLAGS
 *   --docx=<f> | --xml-dir=<d>   the master (a .docx, or an unpacked copy)
 *   --book=<key> --chapter=<n>   what to build; --all for every chapter
 *   --report                     inspect and report only; write nothing
 *   --approve                    write despite findings (records them anyway)
 *   --out=<f> | --out-dir=<d> | --stdout | --force
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { readDocxParts } from "./lib/docx-zip.mjs";
import { scanDocumentEntries, scanFootnoteRecords, escapeHtml } from "./reconcile/lib/docx-runs.mjs";
import { extractMasterChapters } from "./reconcile/lib/docx-verses.mjs";
import { curlify, auditWrongDirectionPairs, matchesValidatorPredicate } from "./reconcile/lib/curl-quotes.mjs";
import { BOOKS, bookKeyToLabel } from "../src/data/books.js";
import {
  labelFor, anchorFor, mapTextNodes, visibleText, foldAllowed,
  curlText, enDashRanges, collapseRuns, fidelityDivergence,
} from "./lib/import-core.mjs";

const root = resolve(fileURLToPath(new URL(".", import.meta.url)), "..");

const argv = process.argv.slice(2);
const flag = (n) => argv.includes(`--${n}`);
const val = (n) => {
  const hit = argv.find((a) => a.startsWith(`--${n}=`));
  if (hit) return hit.slice(n.length + 3);
  const i = argv.indexOf(`--${n}`);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[i + 1] : null;
};
const die = (msg) => { console.error(`import-chapter: ${msg}`); process.exit(1); };

const docxPath = val("docx"), xmlDir = val("xml-dir"), bookKey = val("book");
const chapterArg = val("chapter"), all = flag("all"), reportOnly = flag("report");

if (!docxPath && !xmlDir) die("pass --docx=<file.docx> or --xml-dir=<unpacked dir>");
if (!bookKey) die("pass --book=<bookKey> (see src/data/books.js)");
if (!BOOKS[bookKey]) die(`unknown book "${bookKey}"`);
if (!all && !chapterArg) die("pass --chapter=<n>, or --all");

let documentXml, footnotesXml;
if (docxPath) {
  if (!existsSync(docxPath)) die(`no such file: ${docxPath}`);
  ({ document: documentXml, footnotes: footnotesXml } = readDocxParts(docxPath));
} else {
  documentXml = readFileSync(join(xmlDir, "word", "document.xml"), "utf8");
  const fp = join(xmlDir, "word", "footnotes.xml");
  footnotesXml = existsSync(fp) ? readFileSync(fp, "utf8") : null;
}

const scanWarnings = [];
const scan = extractMasterChapters(documentXml, BOOKS[bookKey], { warnings: scanWarnings, refMarkers: true, stripBrackets: false });
const { entries, paragraphs } = scanDocumentEntries(documentXml, { warnings: scanWarnings });
const footnoteBodies = footnotesXml ? scanFootnoteRecords(footnotesXml, { warnings: scanWarnings }) : new Map();

if (!scan.superscriptCheck.ok) {
  die("verse-number detection disagrees between the superscript pass and the blind digit scan.\n" +
      "  That is the \"verse number typed as body text or subscript\" case. Resolve it in the\n" +
      "  master rather than trusting either side.");
}

// ── local helpers ────────────────────────────────────────────────────────────
// Everything pure lives in lib/import-core.mjs; only what needs this run's scan
// or has to raise a finding is here.
const paragraphOf = (i) => paragraphs.findIndex((p) => i >= p.start && i < p.end);

// ── findings ─────────────────────────────────────────────────────────────────
const findings = [];
const note = (where, kind, detail, fix) => findings.push({ where, kind, detail, fix });

/** curlText plus this run's bookkeeping: tally what changed, and turn a refusal
 *  into a finding for the owner rather than a guess at what was meant. */
function curlHtml(html, where, tally) {
  let res;
  try {
    res = curlText(html, curlify);
  } catch (err) {
    die(`${where}: ${err.message}`);
  }
  if (res.refusal !== null) {
    note(where, "unbalanced quotation", res.refusal,
      "Balance the quotation in Word, then re-run. Curling it here would be a guess.");
    return html; // the master's characters, exactly as they are
  }
  tally.curled += res.curled;
  return res.html;
}

const enDash = (html, tally) => {
  const res = enDashRanges(html);
  tally.dashed += res.dashed;
  return res.html;
};

// ── build ────────────────────────────────────────────────────────────────────
function buildChapter(chapterNum) {
  const ch = scan.chapters.get(chapterNum);
  if (!ch) die(`chapter ${chapterNum} not found in this document`);
  const tally = { curled: 0, dashed: 0, separators: 0, collapsed: 0 };

  const labelOf = new Map();
  for (const f of ch.footnotes) if (!labelOf.has(f.id)) labelOf.set(f.id, labelFor(labelOf.size));

  const { start, end } = ch.entryRange;
  const blocks = [];
  let cur = null, curPara = -1, pending = null;
  const seen = [];

  const flushPending = () => {
    if (pending !== null) {
      cur.push(`<span class="vglue"><sup id="v${pending}" class="vn">${pending}</sup>&nbsp;</span>`);
      pending = null;
    }
  };
  const openBlock = (p) => { flushPending(); if (cur) blocks.push(cur.join("")); cur = []; curPara = p; };

  for (let i = start; i < end; i++) {
    const e = entries[i];
    if (e.kind === "break") continue;
    const p = paragraphOf(i);
    if (p !== curPara) openBlock(p);

    if (e.kind === "verseMarker") {
      flushPending();
      if (cur.length) {
        const tailText = visibleText(cur.join(""));
        if (tailText !== "" && !/\s$/.test(tailText)) { cur.push(" "); tally.separators++; }
      }
      pending = e.verse; seen.push(e.verse);
      continue;
    }
    if (e.kind === "footnoteMarker") continue;
    if (e.kind === "footnoteRef") {
      const label = labelOf.get(e.id);
      if (!label) { note(`chapter ${chapterNum}`, "orphan reference", `footnote ${e.id} has no body`, "Check the master."); continue; }
      flushPending();
      cur.push(anchorFor(label));
      continue;
    }

    let html = e.html;
    if (pending !== null) {
      const lead = e.plain.replace(/^[  ]+/, "");
      if (lead === "") continue;                       // Word's separator space
      html = html.slice(e.plain.length - lead.length);
      const first = (/^(\S+)/.exec(lead) || [, lead])[1];
      const firstHtml = escapeHtml(first);
      if (html.startsWith(firstHtml)) {
        cur.push(`<span class="vglue"><sup id="v${pending}" class="vn">${pending}</sup>&nbsp;${firstHtml}</span>`);
        html = html.slice(firstHtml.length);
      } else {
        cur.push(`<span class="vglue"><sup id="v${pending}" class="vn">${pending}</sup>&nbsp;</span>`);
      }
      pending = null;
    }
    if (html) cur.push(html);
  }
  flushPending();
  if (cur) blocks.push(cur.join(""));

  const emitted = [...new Set(seen)].sort((a, b) => a - b);
  const expected = [...ch.digitScanVerseSet].sort((a, b) => a - b);
  if (JSON.stringify(emitted) !== JSON.stringify(expected)) {
    note(`chapter ${chapterNum}`, "verse detection",
      `emitted ${emitted.join(",")} vs digit scan ${expected.join(",")}`,
      "Resolve in the master; do not trust either side.");
  }

  let paras = blocks.map((b) => b.trim()).filter(Boolean)
    .map((b, i) => `<p id="${bookKey}-${chapterNum}-p${i + 1}">${b}</p>`);

  paras = paras.map((p, i) => {
    const where = `${bookKeyToLabel(bookKey)} ${chapterNum} paragraph ${i + 1}`;
    const before = p;
    const out = collapseRuns(enDash(curlHtml(p, where, tally), tally));
    tally.collapsed += (before.match(/<\/([a-z]+)><\1>/g) || []).length;
    return out;
  });

  const notes = [...labelOf.entries()].map(([id, label]) => {
    const where = `${bookKeyToLabel(bookKey)} ${chapterNum} footnote ${label}`;
    const rec = footnoteBodies.get(id);
    if (!rec) { note(where, "missing body", `docx footnote ${id}`, "Check the master."); return null; }
    if (rec.paragraphCount > 1)
      note(where, "multi-paragraph footnote", `${rec.paragraphCount} paragraphs in Word`,
        "Replace the paragraph break with a line break (Shift+Enter) in the master.");
    const html = collapseRuns(enDash(curlHtml(rec.html, where, tally), tally));
    return { id: `fn-${label}`, refId: `fnref-${label}`, label, html, _master: rec.plain, _where: where };
  }).filter(Boolean);

  // Read-only audits: report, never repair.
  for (const [i, p] of paras.entries())
    for (const w of auditWrongDirectionPairs(p))
      note(`${bookKeyToLabel(bookKey)} ${chapterNum} paragraph ${i + 1}`, "mismatched quote pair",
        `${w.opener} … ${w.closer} (${w.kind})`, "Fix the pair in Word, then re-run.");
  for (const n of notes)
    for (const w of auditWrongDirectionPairs(n.html))
      note(n._where, "mismatched quote pair", `${w.opener} … ${w.closer} (${w.kind})`, "Fix the pair in Word, then re-run.");

  // ── the fidelity gate ──────────────────────────────────────────────────────
  // Reconstruct what Word shows for this chapter: text runs plus verse digits.
  // Footnote references contribute nothing (zero-width), which is exactly why
  // they are excluded from the generated side too.
  let masterVisible = "";
  for (let i = start; i < end; i++) {
    const e = entries[i];
    if (e.kind === "text") masterVisible += e.plain;
    else if (e.kind === "verseMarker") masterVisible += ` ${e.verse} `;
    else if (e.kind === "break") masterVisible += " ";
  }
  const gate = (label, master, generated) => {
    const d = fidelityDivergence(master, generated);
    if (!d) return true;
    note(label, "FIDELITY",
      `first difference at char ${d.at}\n      master:    ${d.master}\n      generated: ${d.generated}`,
      "This is a bug in the importer, not in the master. Nothing was written.");
    return false;
  };
  gate(`${bookKeyToLabel(bookKey)} ${chapterNum} text`, masterVisible, visibleText(paras.join(" ")));
  for (const n of notes) gate(n._where, n._master, visibleText(n.html));

  for (const p of paras) if (!matchesValidatorPredicate(p)) note(`${bookKeyToLabel(bookKey)} ${chapterNum}`, "straight quotes remain", "", "Balance the quotation in Word.");
  for (const n of notes) if (!matchesValidatorPredicate(n.html)) note(n._where, "straight quotes remain", "", "Balance the quotation in Word.");

  return {
    doc: {
      bookKey, chapter: chapterNum, type: "scripture",
      title: `${bookKeyToLabel(bookKey)} ${chapterNum}`,
      description: `${bookKeyToLabel(bookKey)} ${chapterNum} in the Liberation and Inclusion Translation (LIT).`,
      topics: [], indexed: false,
      paragraphs: paras,
      footnotes: notes.map(({ _master, _where, ...f }) => f),
    },
    tally,
  };
}

// ── run ──────────────────────────────────────────────────────────────────────
const targets = all ? [...scan.chapters.keys()].sort((a, b) => a - b) : [Number(chapterArg)];
const built = targets.map((n) => ({ n, ...buildChapter(n) }));

const total = built.reduce((a, b) => ({
  curled: a.curled + b.tally.curled, dashed: a.dashed + b.tally.dashed,
  separators: a.separators + b.tally.separators, collapsed: a.collapsed + b.tally.collapsed,
}), { curled: 0, dashed: 0, separators: 0, collapsed: 0 });

console.log(`Pre-approved changes applied (the only visible characters touched):`);
console.log(`  straight quotes curled : ${total.curled}`);
console.log(`  hyphens to en dashes   : ${total.dashed}`);
console.log(`Structural, no visible character changed:`);
console.log(`  verse-marker separators inserted : ${total.separators}`);
console.log(`  fragmented tag runs collapsed    : ${total.collapsed}`);

if (findings.length) {
  const fatal = findings.some((f) => f.kind === "FIDELITY");
  console.log(`\n${findings.length} finding(s) — NOT changed, for you to fix in Word:\n`);
  for (const f of findings) {
    console.log(`  [${f.kind}] ${f.where}`);
    if (f.detail) console.log(`      ${f.detail}`);
    if (f.fix) console.log(`      -> ${f.fix}`);
  }
  if (fatal) { console.error(`\nRefusing to write: the fidelity gate failed.`); process.exit(1); }
  if (!flag("approve")) {
    console.error(`\nRefusing to write. Fix these in the master and re-run, or pass --approve to\n` +
                  `write anyway (the findings stand either way — nothing here was repaired).`);
    process.exit(1);
  }
}
if (scanWarnings.length) {
  console.log(`\n${scanWarnings.length} parser warning(s):`);
  for (const w of scanWarnings.slice(0, 15)) console.log(`  - ${w}`);
}
if (reportOnly) { console.log(`\n--report: nothing written.`); process.exit(findings.length ? 1 : 0); }

const outDir = val("out-dir") || join(root, "src", "data", "chapters");
for (const { n, doc } of built) {
  const json = JSON.stringify(doc, null, 2) + "\n";
  if (flag("stdout")) { process.stdout.write(json); continue; }
  const out = val("out") || join(outDir, `${bookKey}-${n}.json`);
  if (existsSync(out) && !flag("force")) die(`${out} exists; pass --force to overwrite`);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, json);
  console.log(`\nwrote ${out}  (${doc.paragraphs.length} paragraphs, ${doc.footnotes.length} footnotes)`);
}

if (!flag("stdout")) {
  console.log(
    `\nStill yours to decide — deliberately not automated:\n` +
    `  - topics[] is empty\n` +
    `  - poetry / block quotes: Word paragraph breaks arrive as <p>\n` +
    `  - bracketed passages: ⟦ … ⟧ and their paired footnotes\n` +
    `  - indexed is FALSE (draft). Flip it to true to publish.\n` +
    `\nThen run: npm run validate:chapters`);
}
