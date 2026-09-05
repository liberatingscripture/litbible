#!/usr/bin/env node
// The Phase 1 gate (see the approved plan's "Phase 1" and top-level "THE
// GATE" sections). Re-runs the v1 audit's book-by-book comparison
// (docx-audit/run-all.mjs in the session scratchpad) using the v2 run-aware
// extractor (lib/docx-verses.mjs + lib/docx-runs.mjs) instead of v1's
// markup-blind one, writes scripts/reconcile/out/results-v2.json, and diffs
// the resulting finding set against the v1 docx-audit/results.json.
//
// This script does NOT declare the gate passed or failed. It writes evidence
// to out/GATE.md and stdout; a human adjudicates. See scripts/reconcile/README.md
// for how to run it and what MASTER_XML_DIR/V1_RESULTS_JSON must point at.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { extractMasterChapters, extractMasterFootnotes } from "./lib/docx-verses.mjs";
import { splitChapterVerses, extractRepoFootnoteOrder } from "./lib/repo-extract.mjs";
import { normalize } from "./lib/normalize.mjs";
import { characterize, severity } from "./lib/classify.mjs";
import { pairFootnotes } from "./lib/pair-footnotes.mjs";
import {
  BOOKS,
  DOCX_TO_BOOKKEY,
  NO_MASTER_BOOKS,
  TRUNCATED_MASTERS,
  DOCUMENTED_GAPS,
} from "./lib/book-map.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------------
// Configuration. The master XML is 17MB of unpacked .docx and must never be
// committed - see "Source data" in scripts/reconcile/README.md. The default
// below is where THIS reconciliation session unpacked it; a future run
// (different machine/session) must pass --master-dir or set MASTER_XML_DIR.
// ---------------------------------------------------------------------

function argValue(flag) {
  const pref = `--${flag}=`;
  const found = process.argv.find((a) => a.startsWith(pref));
  return found ? found.slice(pref.length) : undefined;
}

const DEFAULT_MASTER_XML_DIR =
  "C:\\Users\\bcjoh\\AppData\\Local\\Temp\\claude\\C--Users-bcjoh-GitHub-litbible\\ddd3fc48-2f0f-4228-8fea-4b8565ba571e\\scratchpad\\docx-audit\\extracted";
const DEFAULT_V1_RESULTS =
  "C:\\Users\\bcjoh\\AppData\\Local\\Temp\\claude\\C--Users-bcjoh-GitHub-litbible\\ddd3fc48-2f0f-4228-8fea-4b8565ba571e\\scratchpad\\docx-audit\\results.json";
// v1's OWN extractor (docx-audit/lib/docx-xml.mjs), imported READ-ONLY so
// the >=99% footnote-text assertion can compare against v1's FULL text
// universe (all 5552 footnotes), not just the ~1176 it happened to record a
// masterText for in results.json (its findings + cosmetic buckets) - that
// subset is exactly the footnotes MOST likely to differ, so scoping to it
// alone understates agreement severely. Never imported for anything but
// this comparison; v1 must stay untouched for the gate to mean anything.
const DEFAULT_V1_DOCX_XML_MODULE =
  "C:\\Users\\bcjoh\\AppData\\Local\\Temp\\claude\\C--Users-bcjoh-GitHub-litbible\\ddd3fc48-2f0f-4228-8fea-4b8565ba571e\\scratchpad\\docx-audit\\lib\\docx-xml.mjs";

const MASTER_XML_DIR = argValue("master-dir") || process.env.MASTER_XML_DIR || DEFAULT_MASTER_XML_DIR;
const V1_RESULTS_PATH = argValue("v1-results") || process.env.V1_RESULTS_JSON || DEFAULT_V1_RESULTS;
const V1_DOCX_XML_MODULE = argValue("v1-docx-xml") || process.env.V1_DOCX_XML_MODULE || DEFAULT_V1_DOCX_XML_MODULE;
const CHAPTERS_DIR = path.resolve(__dirname, "../../src/data/chapters");
const OUT_DIR = path.resolve(__dirname, "out");

if (!existsSync(MASTER_XML_DIR)) {
  console.error(`Master XML directory not found: ${MASTER_XML_DIR}`);
  console.error("Pass --master-dir=<path> or set MASTER_XML_DIR. See scripts/reconcile/README.md.");
  process.exit(1);
}
if (!existsSync(V1_RESULTS_PATH)) {
  console.error(`v1 results.json not found: ${V1_RESULTS_PATH}`);
  console.error("Pass --v1-results=<path> or set V1_RESULTS_JSON.");
  process.exit(1);
}
let v1ExtractFootnotes = null;
if (existsSync(V1_DOCX_XML_MODULE)) {
  ({ extractFootnotes: v1ExtractFootnotes } = await import(pathToFileURL(V1_DOCX_XML_MODULE).href));
} else {
  console.error(
    `WARNING: v1 docx-xml.mjs not found at ${V1_DOCX_XML_MODULE} - the footnote-text-match assertion will fall back to the results.json-only subset, which understates agreement. Pass --v1-docx-xml=<path> or set V1_DOCX_XML_MODULE.`,
  );
}
if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });

function sevCap(s) {
  return s.length > 600 ? s.slice(0, 600) : s;
}

// ---------------------------------------------------------------------
// Pass 1: run the v2 comparison, mirroring docx-audit/run-all.mjs's logic
// exactly (same buckets, same order of operations) so the ONLY things that
// can differ from v1's results.json are the extractor and its outputs.
// ---------------------------------------------------------------------

const footnoteFindings = [];
const scriptureFindings = [];
const cosmeticFootnote = [];
const cosmeticScripture = [];
const couldNotCompare = [];
let draftsSkipped = 0;
let chaptersCompared = 0;
let footnotesPaired = 0;
let versesPaired = 0;
const bookNotes = [];
const superscriptDisagreements = []; // {bookKey, chapter, digitSet, superscriptSet}
const extractorWarnings = []; // {bookKey, warning}
const masterFootnoteWarnings = []; // {bookKey, chapter, masterLabel, warning} - multi-paragraph etc.

// Lookups used only by the diff-against-v1 pass below, so a "disappeared"
// finding's CURRENT v2 text can be recovered even if it's no longer a
// finding at all (i.e. it became an exact match).
const v2VerseLookup = new Map(); // "bookKey|chapter|verse" -> {plain, html}
const v2FootnoteLookup = new Map(); // "bookKey|chapter|masterLabel" -> {plain, html}
const v1FullFootnoteText = new Map(); // "bookKey|id" -> v1's raw text, EVERY footnote (not just findings)
const v2FullFootnoteText = new Map(); // "bookKey|id" -> v2's {plain, html}, EVERY footnote

let masterFootnoteTotal = 0;

for (const bookKey of NO_MASTER_BOOKS) {
  const chapterCount = BOOKS[bookKey];
  for (let c = 1; c <= chapterCount; c++) {
    const repoPath = path.join(CHAPTERS_DIR, `${bookKey}-${c}.json`);
    if (!existsSync(repoPath)) {
      couldNotCompare.push({ bookKey, chapter: c, reason: "no repo chapter file found" });
      continue;
    }
    const repoJson = JSON.parse(readFileSync(repoPath, "utf8"));
    if (repoJson.indexed === false) {
      draftsSkipped++;
      continue;
    }
    couldNotCompare.push({
      bookKey,
      chapter: c,
      reason: "no master document found (no Revelation folder in the OneDrive Bible Translation library)",
    });
  }
}

for (const [docxName, bookKey] of Object.entries(DOCX_TO_BOOKKEY)) {
  const chapterCount = BOOKS[bookKey];
  const docXml = readFileSync(path.join(MASTER_XML_DIR, docxName, "word", "document.xml"), "utf8");
  const fnXml = readFileSync(path.join(MASTER_XML_DIR, docxName, "word", "footnotes.xml"), "utf8");

  const warnings = [];
  const master = extractMasterChapters(docXml, chapterCount, { warnings, stripBrackets: true });
  const footnoteTextMap = extractMasterFootnotes(fnXml, { warnings, stripBrackets: true });
  for (const w of warnings) extractorWarnings.push({ bookKey, warning: w });
  masterFootnoteTotal += footnoteTextMap.size;
  for (const [id, rec] of footnoteTextMap) v2FullFootnoteText.set(`${bookKey}|${id}`, rec);
  if (v1ExtractFootnotes) {
    // v1's extraction does NOT strip ⟦/⟧ bracket markers (docx-verses.mjs
    // does that, not docx-xml.mjs) and does NOT left-trim the separator
    // space - both real, expected, ALREADY-DOCUMENTED differences, not gate
    // failures. Apply the identical bracket-strip + left-trim v2 applies so
    // this comparison isolates genuine wording differences.
    const v1FnMap = v1ExtractFootnotes(fnXml);
    for (const [id, rawText] of v1FnMap) {
      if (id === "-1" || id === "0") continue;
      // Both marker forms: this text comes from a MASTER, which still carries
      // the retired [|/|] (see src/lib/bracket-markers.mjs).
      const stripped = rawText.replace(/[⟦⟧]|\[\||\|\]/g, "").replace(/^\s+/, "");
      v1FullFootnoteText.set(`${bookKey}|${id}`, stripped);
    }
  }

  for (const c of master.superscriptCheck.perChapter) {
    if (!c.agree) {
      superscriptDisagreements.push({
        bookKey,
        chapter: c.chapter,
        digitSet: c.digitSet,
        superscriptSet: c.superscriptSet,
        missingFromSuperscript: c.digitSet.filter((v) => !c.superscriptSet.includes(v)),
        extraInSuperscript: c.superscriptSet.filter((v) => !c.digitSet.includes(v)),
      });
    }
  }

  const truncInfo = TRUNCATED_MASTERS[bookKey];
  const usableSet = truncInfo ? new Set(truncInfo.usableChapters) : null;

  if (!master.ok && !truncInfo) {
    for (let c = 1; c <= chapterCount; c++) {
      const repoPath = path.join(CHAPTERS_DIR, `${bookKey}-${c}.json`);
      if (!existsSync(repoPath)) continue;
      const repoJson = JSON.parse(readFileSync(repoPath, "utf8"));
      if (repoJson.indexed === false) {
        draftsSkipped++;
        continue;
      }
      couldNotCompare.push({ bookKey, chapter: c, reason: `master extraction failed: ${master.reason}` });
    }
    bookNotes.push(`${bookKey}: MASTER EXTRACTION FAILED ENTIRELY - ${master.reason}`);
    continue;
  }

  for (let c = 1; c <= chapterCount; c++) {
    const repoPath = path.join(CHAPTERS_DIR, `${bookKey}-${c}.json`);
    if (!existsSync(repoPath)) {
      couldNotCompare.push({ bookKey, chapter: c, reason: "no repo chapter file found" });
      continue;
    }
    const repoJson = JSON.parse(readFileSync(repoPath, "utf8"));
    if (repoJson.indexed === false) {
      draftsSkipped++;
      continue;
    }

    if (usableSet && !usableSet.has(c)) {
      couldNotCompare.push({
        bookKey,
        chapter: c,
        reason: `master document (${docxName}.docx) is truncated/incomplete - ${truncInfo.note}`,
      });
      continue;
    }

    const chData = master.chapters.get(c);
    if (!chData) {
      couldNotCompare.push({ bookKey, chapter: c, reason: "master chapter boundary not found (pairing failed)" });
      continue;
    }

    chaptersCompared++;
    if (!chData.paragraphInitial) {
      bookNotes.push(
        `${bookKey}-${c}: chapter marker was NOT paragraph-initial (used whole-document fallback scan) - lower confidence`,
      );
    }

    // ---------- Scripture verse comparison ----------
    const repoVerses = splitChapterVerses(repoJson.paragraphs);
    const allVerseNums = new Set([...chData.verses.keys(), ...repoVerses.keys()]);
    for (const v of [...allVerseNums].sort((a, b) => a - b)) {
      const gapKey = `${bookKey}-${c}-${v}`;
      const mObj = chData.verses.get(v);
      const m = mObj ? mObj.plain : undefined;
      if (mObj) v2VerseLookup.set(`${bookKey}|${c}|${v}`, mObj);
      const r = repoVerses.get(v);
      versesPaired++;
      if (m === undefined && r === undefined) continue;
      if (m === undefined || r === undefined) {
        if (DOCUMENTED_GAPS.has(gapKey) && m === undefined && r === undefined) continue;
        scriptureFindings.push({
          bookKey,
          chapter: c,
          verse: v,
          type: m === undefined ? "present in repo only" : "present in master only",
          masterText: m ?? null,
          masterHtml: mObj ? mObj.html : null,
          repoText: r ?? null,
          severity: 1,
        });
        continue;
      }
      const nm = normalize(m);
      const nr = normalize(r);
      if (nm === nr) {
        if (m.trim() !== r.trim()) {
          cosmeticScripture.push({
            bookKey,
            chapter: c,
            verse: v,
            masterText: m.trim(),
            masterHtml: mObj.html,
            repoText: r.trim(),
          });
        }
        continue;
      }
      const type = characterize(nm, nr);
      scriptureFindings.push({
        bookKey,
        chapter: c,
        verse: v,
        type,
        masterText: m,
        masterHtml: mObj.html,
        repoText: r,
        severity: severity(sevCap(nm), sevCap(nr)),
      });
    }

    // ---------- Footnote comparison ----------
    const repoFootnotes = extractRepoFootnoteOrder(repoJson.paragraphs, repoJson.footnotes);
    const plainFootnoteMap = new Map([...footnoteTextMap].map(([id, rec]) => [id, rec.plain]));
    const masterFootnoteListForChapter = chData.footnotes;
    const paired = pairFootnotes(masterFootnoteListForChapter, repoFootnotes, plainFootnoteMap);
    for (const p of paired) {
      footnotesPaired++;
      if (p.type === "match" || p.type === "paired-differs") {
        const mRec = footnoteTextMap.get(p.master.id);
        const mText = mRec ? mRec.plain : "";
        const mHtml = mRec ? mRec.html : "";
        if (mRec) v2FootnoteLookup.set(`${bookKey}|${c}|${p.master.id}`, mRec);
        if (mRec && mRec.warning) {
          masterFootnoteWarnings.push({ bookKey, chapter: c, masterLabel: p.master.id, warning: mRec.warning });
        }
        const rText = p.repo.text || "";
        if (p.type === "match") {
          if (p.master.verse !== p.repo.verse) {
            footnoteFindings.push({
              bookKey,
              chapter: c,
              masterVerse: p.master.verse,
              repoVerse: p.repo.verse,
              type: "anchored to a different verse",
              masterText: mText,
              masterHtml: mHtml,
              repoText: rText,
              masterLabel: p.master.id,
              repoLabel: p.repo.refId,
              severity: 0.5,
            });
          } else if (mText.trim() !== rText.trim()) {
            cosmeticFootnote.push({
              bookKey,
              chapter: c,
              verse: p.master.verse,
              masterLabel: p.master.id,
              repoLabel: p.repo.refId,
              masterText: mText.trim(),
              masterHtml: mHtml,
              repoText: rText.trim(),
            });
          }
          continue;
        }
        // paired-differs
        const nm = normalize(mText);
        const nr = normalize(rText);
        if (nm === nr) continue; // shouldn't happen (LCS would have matched), guard anyway
        const verseMismatch = p.master.verse !== p.repo.verse;
        const type = characterize(nm, nr) + (verseMismatch ? " (and anchored to a different verse)" : "");
        footnoteFindings.push({
          bookKey,
          chapter: c,
          masterVerse: p.master.verse,
          repoVerse: p.repo.verse,
          type,
          masterText: mText,
          masterHtml: mHtml,
          repoText: rText,
          masterLabel: p.master.id,
          repoLabel: p.repo.refId,
          severity: severity(sevCap(nm), sevCap(nr)),
        });
        continue;
      }
      if (p.type === "master-only") {
        const mRec = footnoteTextMap.get(p.master.id);
        const mText = mRec ? mRec.plain : "";
        const mHtml = mRec ? mRec.html : "";
        if (mRec) v2FootnoteLookup.set(`${bookKey}|${c}|${p.master.id}`, mRec);
        footnoteFindings.push({
          bookKey,
          chapter: c,
          masterVerse: p.master.verse,
          repoVerse: null,
          type: "present in master only",
          masterText: mText,
          masterHtml: mHtml,
          repoText: null,
          masterLabel: p.master.id,
          repoLabel: null,
          severity: 1,
        });
      }
      if (p.type === "repo-only") {
        footnoteFindings.push({
          bookKey,
          chapter: c,
          masterVerse: null,
          repoVerse: p.repo.verse,
          type: "present in repo only",
          masterText: null,
          masterHtml: null,
          repoText: p.repo.text || "",
          masterLabel: null,
          repoLabel: p.repo.refId,
          severity: 1,
        });
      }
    }
  }
}

// ---------- Detect verse-boundary shifts (copied from run-all.mjs) ----------
{
  const byChapter = new Map();
  for (const f of scriptureFindings) {
    const key = `${f.bookKey}-${f.chapter}`;
    if (!byChapter.has(key)) byChapter.set(key, []);
    byChapter.get(key).push(f);
  }
  for (const list of byChapter.values()) {
    list.sort((a, b) => a.verse - b.verse);
    for (let i = 0; i < list.length - 1; i++) {
      const a = list[i];
      const b = list[i + 1];
      if (b.verse !== a.verse + 1) continue;
      if (a.masterText == null || a.repoText == null || b.masterText == null || b.repoText == null) continue;
      const combinedMaster = normalize(`${a.masterText} ${b.masterText}`);
      const combinedRepo = normalize(`${a.repoText} ${b.repoText}`);
      if (combinedMaster === combinedRepo) {
        a.type = "verse-boundary shift (combined text matches - not missing content)";
        b.type = "verse-boundary shift (combined text matches - not missing content)";
        a.severity = 0.05;
        b.severity = 0.05;
      }
    }
  }
}

scriptureFindings.sort((a, b) => b.severity - a.severity);
footnoteFindings.sort((a, b) => b.severity - a.severity);

const summaryV2 = {
  chaptersCompared,
  footnotesPaired,
  versesPaired,
  draftsSkipped,
  couldNotCompareCount: couldNotCompare.length,
  scriptureFindingsCount: scriptureFindings.length,
  footnoteFindingsCount: footnoteFindings.length,
  cosmeticScriptureCount: cosmeticScripture.length,
  cosmeticFootnoteCount: cosmeticFootnote.length,
  masterFootnoteTotal,
  superscriptDisagreementCount: superscriptDisagreements.length,
  extractorWarningCount: extractorWarnings.length,
};

const resultsV2 = {
  summary: summaryV2,
  scriptureFindings,
  footnoteFindings,
  cosmeticScripture,
  cosmeticFootnote,
  couldNotCompare,
  bookNotes,
  superscriptDisagreements,
  extractorWarnings,
  masterFootnoteWarnings,
};

writeFileSync(path.join(OUT_DIR, "results-v2.json"), JSON.stringify(resultsV2, null, 2));
console.log(`Wrote ${path.join(OUT_DIR, "results-v2.json")}`);
console.log(JSON.stringify(summaryV2, null, 2));

// ---------------------------------------------------------------------
// Pass 2: diff v1 vs v2 finding sets, and explain every difference.
// ---------------------------------------------------------------------

const v1 = JSON.parse(readFileSync(V1_RESULTS_PATH, "utf8"));

function scriptureKey(f) {
  return `${f.bookKey}|${f.chapter}|${f.verse}`;
}
function footnoteKey(f) {
  // masterLabel is the stable anchor (a w:id-derived identifier, unaffected
  // by extractor choice); repo-only findings have no masterLabel, so fall
  // back to repoLabel (also stable - it's the chapter JSON's own fn id).
  return `${f.bookKey}|${f.chapter}|${f.masterLabel ?? `repo:${f.repoLabel}`}`;
}

const v1ScriptureMap = new Map(v1.scriptureFindings.map((f) => [scriptureKey(f), f]));
const v2ScriptureMap = new Map(scriptureFindings.map((f) => [scriptureKey(f), f]));
const v1FootnoteMap = new Map(v1.footnoteFindings.map((f) => [footnoteKey(f), f]));
const v2FootnoteMap = new Map(footnoteFindings.map((f) => [footnoteKey(f), f]));

// Chapters where the superscript cross-check already found a real master
// formatting anomaly (a verse marker not run as its own superscript run).
// A footnote landing on the wrong side of that SAME verse boundary is a
// downstream symptom of the identical cause, not a new independent bug.
const anomalousChapters = new Set(superscriptDisagreements.map((d) => `${d.bookKey}|${d.chapter}`));

const multiParaFootnoteKeys = new Set(
  masterFootnoteWarnings.map((w) => `${w.bookKey}|${w.chapter}|${w.masterLabel}`),
);
// Same set, keyed by bookKey+id only (no chapter) - matches the key shape
// used by the full-footnote-universe text comparison below.
const multiParaFootnoteIdsByBook = new Set(masterFootnoteWarnings.map((w) => `${w.bookKey}|${w.masterLabel}`));

const NBSP = String.fromCharCode(160);

/**
 * True if `longer` reduces to exactly `shorter` once every EXTRA "-"
 * character (one `longer` has that `shorter` doesn't, at that position) is
 * deleted - i.e. `longer` is `shorter` with zero or more "-" inserted
 * somewhere. A blind "strip every hyphen" check is wrong whenever the text
 * ALSO contains a real, shared hyphen elsewhere (very common in ~1300-char
 * footnote prose): stripping that one too makes both sides mismatch even
 * though the actual cause (an extra noBreakHyphen) is exactly the same. A
 * two-pointer walk only ever removes hyphens `longer` has and `shorter`
 * lacks, so a shared hyphen (present on both sides) is left alone.
 */
function reducesToByRemovingHyphens(shorter, longer) {
  let i = 0;
  let j = 0;
  let removed = 0;
  while (i < shorter.length && j < longer.length) {
    if (shorter[i] === longer[j]) {
      i++;
      j++;
      continue;
    }
    if (longer[j] === "-") {
      j++;
      removed++;
      continue;
    }
    return false;
  }
  while (j < longer.length && longer[j] === "-") {
    j++;
    removed++;
  }
  return i === shorter.length && j === longer.length && removed > 0;
}

/** Best-effort, transparent classification of WHY a v1 finding no longer
 *  appears (or a v2 finding is new) - shown in GATE.md so a human doesn't
 *  have to re-derive it, but every raw text pair is shown too so the
 *  classification can be checked rather than trusted blindly. */
function explainTextChange(v1Text, v2Text) {
  if (v1Text == null || v2Text == null) return "one side has no text at all (existence change, not a text edit)";
  if (v1Text === v2Text) return "byte-identical (no explanation needed)";
  const causes = [];
  // noBreakHyphen: v1 dropped it entirely, v2 renders "-". v2 is always the
  // LONGER side when this is the only cause (each occurrence adds exactly
  // one character), so only test that direction.
  if (v2Text.length > v1Text.length && reducesToByRemovingHyphens(v1Text, v2Text)) {
    causes.push('<w:noBreakHyphen/> now renders as "-" (v1 silently dropped it)');
  }
  // Leading/trailing whitespace / separator-space artifact.
  if (v1Text.trim() === v2Text.trim() && v1Text !== v2Text) {
    causes.push("leading/trailing whitespace only (footnote-marker left-trim or paragraph-join artifact)");
  }
  // nbsp -> regular space, possibly combined with a noBreakHyphen fix too.
  if (v1Text.includes(NBSP)) {
    const v1NbspToSpace = v1Text.replace(new RegExp(NBSP, "g"), " ");
    if (v1NbspToSpace === v2Text) {
      causes.push("U+00A0 (nbsp) now normalized to a regular space");
    } else if (v2Text.length > v1NbspToSpace.length && reducesToByRemovingHyphens(v1NbspToSpace, v2Text)) {
      causes.push(
        '<w:noBreakHyphen/> now renders as "-" (v1 silently dropped it); U+00A0 (nbsp) now normalized to a regular space',
      );
    }
  }
  // Formatting markup only: v2 with tags stripped equals v1.
  const v2Stripped = v2Text.replace(/<\/?(em|b|a)[^>]*>/g, "");
  if (v2Stripped === v1Text) {
    causes.push("v2 adds <em>/<b>/<a> formatting markup v1 could not see; underlying text unchanged");
  }
  // Combined causes. Each test above demands that its own transform be the
  // ONLY difference, so a footnote carrying two of them at once (a nbsp AND a
  // trailing space, a noBreakHyphen AND a trailing space) falls through every
  // branch and reports as UNEXPLAINED - which is the one label that must stay
  // meaningful, since it is what a reviewer is asked to chase into the XML.
  // Apply the known-benign transforms cumulatively and see what is left.
  if (causes.length === 0) {
    const applied = [];
    let a = v1Text;
    let b = v2Text;
    if (a.includes(NBSP)) {
      a = a.replace(new RegExp(NBSP, "g"), " ");
      applied.push("U+00A0 (nbsp) now normalized to a regular space");
    }
    if (a.trim() !== a || b.trim() !== b) {
      a = a.trim();
      b = b.trim();
      applied.push("leading/trailing whitespace only (footnote-marker left-trim or paragraph-join artifact)");
    }
    if (a !== b && b.length > a.length && reducesToByRemovingHyphens(a, b)) {
      a = b;
      applied.push('<w:noBreakHyphen/> now renders as "-" (v1 silently dropped it)');
    }
    if (a === b && applied.length > 1) return applied.join("; ");
  }
  if (causes.length === 0) return null; // unexplained
  return causes.join("; ");
}

const disappearedScripture = [];
for (const [key, f] of v1ScriptureMap) {
  if (v2ScriptureMap.has(key)) continue;
  const v2Current = v2VerseLookup.get(key);
  const v2Text = v2Current ? v2Current.plain : undefined;
  const explanation = v2Text !== undefined ? explainTextChange(f.masterText, v2Text) : "v2 could not locate this verse in the master at all";
  disappearedScripture.push({ key, v1Finding: f, v2CurrentMasterText: v2Text ?? null, explanation });
}

const appearedScripture = [];
for (const [key, f] of v2ScriptureMap) {
  if (v1ScriptureMap.has(key)) continue;
  const v1Existing = v1.scriptureFindings.find((x) => scriptureKey(x) === key);
  appearedScripture.push({ key, v2Finding: f, v1PriorFinding: v1Existing ?? null });
}

function footnoteAnomalyExplanation(f) {
  if (multiParaFootnoteKeys.has(`${f.bookKey}|${f.chapter}|${f.masterLabel}`)) {
    return "multi-paragraph footnote - already forced to hand-review (see Extractor warnings); v1 and v2 join its paragraphs differently";
  }
  if (anomalousChapters.has(`${f.bookKey}|${f.chapter}`) && f.type === "anchored to a different verse") {
    // NOT an explanation - a lead. This exact correlation once auto-labelled a
    // real v2 regression as benign: assignFootnotes anchored on <w:vertAlign>
    // superscript runs, so in the eight chapters that type a verse number as
    // body text every following footnote was filed under the previous verse,
    // and five spurious findings were waved through as "expected in an
    // anomalous chapter". The fix was to anchor on the digit scan, as v1 does
    // (see assignFootnotesByOffset in lib/docx-verses.mjs). A re-anchoring
    // finding must be traced to the XML by hand before it is believed.
    return null;
  }
  return null;
}

const disappearedFootnote = [];
for (const [key, f] of v1FootnoteMap) {
  if (v2FootnoteMap.has(key)) continue;
  const v2Current = f.masterLabel ? v2FootnoteLookup.get(`${f.bookKey}|${f.chapter}|${f.masterLabel}`) : undefined;
  const v2Text = v2Current ? v2Current.plain : undefined;
  const anomaly = footnoteAnomalyExplanation(f);
  const explanation =
    anomaly ??
    (v2Text !== undefined
      ? explainTextChange(f.masterText, v2Text)
      : f.masterLabel
        ? "v2 could not locate this footnote id in the master at all"
        : "repo-only finding (no master side to compare) - disappearance means the pairing itself changed");
  disappearedFootnote.push({ key, v1Finding: f, v2CurrentMasterText: v2Text ?? null, explanation });
}

const appearedFootnote = [];
for (const [key, f] of v2FootnoteMap) {
  if (v1FootnoteMap.has(key)) continue;
  const v1Existing = v1.footnoteFindings.find((x) => footnoteKey(x) === key);
  appearedFootnote.push({ key, v2Finding: f, v1PriorFinding: v1Existing ?? null, anomaly: footnoteAnomalyExplanation(f) });
}

// ---------------------------------------------------------------------
// Assertions
// ---------------------------------------------------------------------

const assertions = [];
function assert(label, pass, detail) {
  assertions.push({ label, pass, detail });
}

assert("master footnote count is 5552", masterFootnoteTotal === 5552, `actual: ${masterFootnoteTotal}`);
assert("chapters compared is 206", chaptersCompared === 206, `actual: ${chaptersCompared}`);

// v2 markup-stripped text vs v1 masterText, over the FULL footnote universe
// (all 5552, keyed by bookKey+id - a footnote's w:id is extraction-
// independent) - not just the ~1176 results.json happened to record a
// masterText for (its findings + cosmetic buckets), which is exactly the
// subset MOST likely to already differ and would understate agreement.
// v1's raw text is re-derived fresh via v1's own extractFootnotes (see
// V1_DOCX_XML_MODULE above), with the two DOCUMENTED, intentional
// transforms applied (bracket-marker strip, leading-separator-space
// left-trim) so this isolates genuine wording differences from the fixes
// this whole project exists to make.
let footnoteTextChecked = 0;
let footnoteTextMatched = 0;
const footnoteTextBelowThreshold = [];
if (v1FullFootnoteText.size > 0) {
  for (const [key, v1Text] of v1FullFootnoteText) {
    const v2Rec = v2FullFootnoteText.get(key);
    if (!v2Rec) continue; // shouldn't happen once master footnote count matches; guarded anyway
    footnoteTextChecked++;
    // Compare both sides trimmed. This assertion exists to catch v2 CHANGING
    // footnote wording, and v1 only ever left-trimmed (it had no reason to -
    // the artifact it knew about was Word's leading separator space). v2 trims
    // both ends, so a raw comparison scores 729 footnotes as mismatches purely
    // for a trailing space and drowns the handful that matter.
    if (v2Rec.plain.trim() === v1Text.trim()) {
      footnoteTextMatched++;
    } else {
      footnoteTextBelowThreshold.push({ key, v1Text, v2PlainText: v2Rec.plain });
    }
  }
}
const footnoteTextPct = footnoteTextChecked > 0 ? (100 * footnoteTextMatched) / footnoteTextChecked : 0;
assert(
  "v2 markup-stripped footnote text equals v1 masterText (bracket-stripped), both sides trimmed, for >=99% of ALL footnotes",
  footnoteTextChecked > 0 && footnoteTextPct >= 99,
  footnoteTextChecked > 0
    ? `${footnoteTextMatched}/${footnoteTextChecked} = ${footnoteTextPct.toFixed(3)}% (full footnote universe, both sides re-extracted fresh)`
    : "could not run - v1 docx-xml.mjs was not found (see warning above); rerun with --v1-docx-xml=<path>",
);

assert(
  "superscript-vs-digit-scan verse marker agreement, all books",
  superscriptDisagreements.length === 0,
  `${superscriptDisagreements.length} chapter(s) disagree - see GATE.md`,
);

// ---------------------------------------------------------------------
// Write GATE.md
// ---------------------------------------------------------------------

function fmtText(t, max = 300) {
  if (t == null) return "*(none)*";
  const s = String(t);
  const truncated = s.length > max ? `${s.slice(0, max)}…` : s;
  return "`" + truncated.replace(/`/g, "'") + "`";
}

const lines = [];
lines.push("# Phase 1 gate report");
lines.push("");
lines.push(
  "This is evidence for a human decision, not a verdict. Read every UNEXPLAINED row before trusting the v2 extractor. See scripts/reconcile/README.md for how this was run.",
);
lines.push("");
lines.push(`Generated: ${new Date().toISOString()}`);
lines.push(`Master XML dir: \`${MASTER_XML_DIR}\``);
lines.push(`v1 results.json: \`${V1_RESULTS_PATH}\``);
lines.push("");

lines.push("## Assertions");
lines.push("");
lines.push("| Assertion | Result | Detail |");
lines.push("|---|---|---|");
for (const a of assertions) {
  lines.push(`| ${a.label} | ${a.pass ? "PASS" : "**FAIL**"} | ${a.detail} |`);
}
lines.push("");

if (footnoteTextChecked > 0) {
  lines.push(
    `### Every footnote below the 99% text-match threshold (${footnoteTextBelowThreshold.length} of ${footnoteTextChecked} checked)`,
  );
  lines.push("");
  if (footnoteTextBelowThreshold.length === 0) {
    lines.push("None - full 100% match.");
  } else {
    const grouped = new Map();
    for (const item of footnoteTextBelowThreshold) {
      const explanation = multiParaFootnoteIdsByBook.has(item.key)
        ? "multi-paragraph footnote - already forced to hand-review (see Extractor warnings); v1 and v2 join its paragraphs differently"
        : (explainTextChange(item.v1Text, item.v2PlainText) ?? "**UNEXPLAINED**");
      if (!grouped.has(explanation)) grouped.set(explanation, []);
      grouped.get(explanation).push(item);
    }
    for (const [explanation, items] of grouped) {
      const flag = explanation === "**UNEXPLAINED**" ? " — NEEDS ATTRIBUTION" : "";
      lines.push(`#### ${explanation} (${items.length})${flag}`);
      lines.push("");
      lines.push("| Book\\|id | v1 text (bracket-stripped, left-trimmed) | v2 plain text |");
      lines.push("|---|---|---|");
      for (const item of items) {
        lines.push(`| ${item.key} | ${fmtText(item.v1Text)} | ${fmtText(item.v2PlainText)} |`);
      }
      lines.push("");
    }
  }
  lines.push("");
}

lines.push("## Summary counts");
lines.push("");
lines.push("| | v1 | v2 |");
lines.push("|---|---|---|");
lines.push(`| chaptersCompared | ${v1.summary.chaptersCompared} | ${summaryV2.chaptersCompared} |`);
lines.push(`| footnotesPaired | ${v1.summary.footnotesPaired} | ${summaryV2.footnotesPaired} |`);
lines.push(`| versesPaired | ${v1.summary.versesPaired} | ${summaryV2.versesPaired} |`);
lines.push(`| scriptureFindingsCount | ${v1.summary.scriptureFindingsCount} | ${summaryV2.scriptureFindingsCount} |`);
lines.push(`| footnoteFindingsCount | ${v1.summary.footnoteFindingsCount} | ${summaryV2.footnoteFindingsCount} |`);
lines.push(`| cosmeticScriptureCount | ${v1.summary.cosmeticScriptureCount} | ${summaryV2.cosmeticScriptureCount} |`);
lines.push(`| cosmeticFootnoteCount | ${v1.summary.cosmeticFootnoteCount} | ${summaryV2.cosmeticFootnoteCount} |`);
lines.push(`| master footnote total | 5552 (documented) | ${masterFootnoteTotal} |`);
lines.push("");

// ---- Superscript cross-check ----
lines.push("## Superscript-vs-digit-scan verse marker agreement (per chapter)");
lines.push("");
if (superscriptDisagreements.length === 0) {
  lines.push("All chapters agree. No disagreements to report.");
} else {
  lines.push(
    `**${superscriptDisagreements.length} chapter(s) disagree.** Each row is a hard-fail signal per the plan - a chapter where the blind digit-adjacency scan and the <w:vertAlign superscript> scan found different verse sets.`,
  );
  lines.push("");
  lines.push("| Book | Chapter | Missing from superscript | Extra in superscript |");
  lines.push("|---|---|---|---|");
  for (const d of superscriptDisagreements) {
    lines.push(
      `| ${d.bookKey} | ${d.chapter} | ${JSON.stringify(d.missingFromSuperscript)} | ${JSON.stringify(d.extraInSuperscript)} |`,
    );
  }
  lines.push("");
  lines.push(
    [
      "**All eight rows were traced to the raw XML by hand and are the same benign thing**: the master occasionally types a verse number as ordinary body text instead of giving it its own `<w:vertAlign w:val=\"superscript\"/>` run, so only the superscript scan misses it. Per row, the entry the digits actually live in:",
      "",
      "| Verse | How the master carries it |",
      "|---|---|",
      "| 1 Timothy 6:5 | plain run `\" 5 \"`, right after a footnote reference |",
      "| 2 Corinthians 8:14 | plain run `\" what is equitable. 14 \"` |",
      "| Acts 1:2, 1:3, 1:4 | all three inside prose runs (`\"doing and teaching 2 until the day\"`) - this is the truncated Acts master, 1:1-4 only, and an out-of-scope draft |",
      "| Luke 4:39 | plain run `\"39 \"` after `\". \"` |",
      "| Luke 21:31 | plain run `\"that summer is now near. 31 \"` - out-of-scope draft |",
      "| Mark 5:39 | its own run, but `<w:vertAlign w:val=\"subscript\"/>` - subscript, not superscript |",
      "| Mark 7:7 | plain run inside the Isaiah 29:13 quotation |",
      "| Mark 7:37 | plain run `\". 37 \"` |",
      "| Mark 12:14 | plain run `\"catch him in what he said. 14 \"` |",
      "",
      "The blind digit-adjacency scan finds every one of them (it doesn't care about formatting), so **no verse text is missing from results-v2.json because of this** - it is a formatting-consistency finding about the master, not an extraction failure. Mark 7's digit set also shows the documented 7:16 gap in the right place, which is an independent sanity check on that chapter.",
      "",
      "**What this cost once, and the reason the assertion stays loud:** footnote-to-verse anchoring originally walked `verseMarker` entries, so in exactly these chapters it filed every footnote after a plain-text verse number under the previous verse. That surfaced as five spurious \"anchored to a different verse\" findings in Mark 7 and Mark 12 and was nearly explained away as expected noise from an anomalous chapter. Anchoring now runs off the digit scan, as v1 did.",
    ].join("\n"),
  );
}
lines.push("");

// ---- Disappeared findings ----
lines.push("## Findings that DISAPPEARED under v2");
lines.push("");
lines.push(
  `Scripture: ${disappearedScripture.length} of v1's ${v1.scriptureFindings.length}. Footnote: ${disappearedFootnote.length} of v1's ${v1.footnoteFindings.length}.`,
);
lines.push("");

function groupByExplanation(list) {
  const groups = new Map();
  for (const item of list) {
    const key = item.explanation ?? "**UNEXPLAINED**";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
  }
  return groups;
}

for (const [label, list, isScripture] of [
  ["Scripture", disappearedScripture, true],
  ["Footnote", disappearedFootnote, false],
]) {
  lines.push(`### ${label} (${list.length})`);
  lines.push("");
  const groups = groupByExplanation(list);
  for (const [explanation, items] of groups) {
    const flag = explanation === "**UNEXPLAINED**" ? " — LISTED PROMINENTLY, NEEDS ATTRIBUTION" : "";
    lines.push(`#### ${explanation} (${items.length})${flag}`);
    lines.push("");
    lines.push("| Book | Ch | Verse/Label | v1 type | v1 masterText | v2 current master text |");
    lines.push("|---|---|---|---|---|---|");
    for (const item of items.slice(0, explanation === "**UNEXPLAINED**" ? 1000 : 25)) {
      const f = item.v1Finding;
      const locator = isScripture ? f.verse : (f.masterLabel ?? `repo:${f.repoLabel}`);
      lines.push(
        `| ${f.bookKey} | ${f.chapter} | ${locator} | ${f.type} | ${fmtText(f.masterText)} | ${fmtText(item.v2CurrentMasterText)} |`,
      );
    }
    if (explanation !== "**UNEXPLAINED**" && items.length > 25) {
      lines.push(`| … | | | *(${items.length - 25} more, same cause)* | |`);
    }
    lines.push("");
  }
}

// ---- Appeared findings ----
lines.push("## Findings that APPEARED under v2");
lines.push("");
lines.push(
  `Scripture: ${appearedScripture.length} new. Footnote: ${appearedFootnote.length} new. **Every row below must be explained before trusting v2** - a new finding here means the run-aware tokenizer changed text it should not have.`,
);
lines.push("");

for (const [label, list, isScripture] of [
  ["Scripture", appearedScripture, true],
  ["Footnote", appearedFootnote, false],
]) {
  lines.push(`### ${label} (${list.length})`);
  lines.push("");
  if (list.length === 0) {
    lines.push("None.");
    lines.push("");
    continue;
  }
  lines.push("| Book | Ch | Verse/Label | v2 type | v1 master text (prior) | v2 master text (new finding) | repo text | Explanation |");
  lines.push("|---|---|---|---|---|---|---|---|");
  for (const item of list) {
    const f = item.v2Finding;
    const locator = isScripture ? f.verse : (f.masterLabel ?? `repo:${f.repoLabel}`);
    const priorMaster = item.v1PriorFinding ? item.v1PriorFinding.masterText : "*(v1 reported no finding here at all - verses/footnotes matched)*";
    const explanation =
      item.anomaly ??
      (item.v1PriorFinding
        ? (explainTextChange(item.v1PriorFinding.masterText, f.masterText) ?? "**UNEXPLAINED - hand-review required**")
        : "**new finding where v1 saw a match - hand-review required**");
    lines.push(
      `| ${f.bookKey} | ${f.chapter} | ${locator} | ${f.type} | ${fmtText(priorMaster)} | ${fmtText(f.masterText)} | ${fmtText(f.repoText)} | ${explanation} |`,
    );
  }
  lines.push("");
}

// ---- Extractor warnings ----
lines.push("## Extractor warnings (forced hand-review candidates)");
lines.push("");
lines.push(`${extractorWarnings.length} tokenizer warning(s), ${masterFootnoteWarnings.length} footnote-level warning(s) (multi-paragraph footnotes, etc).`);
lines.push("");
if (masterFootnoteWarnings.length) {
  lines.push("| Book | Ch | Label | Warning |");
  lines.push("|---|---|---|---|");
  for (const w of masterFootnoteWarnings) {
    lines.push(`| ${w.bookKey} | ${w.chapter} | ${w.masterLabel} | ${w.warning} |`);
  }
  lines.push("");
}
if (extractorWarnings.length) {
  lines.push("<details><summary>Tokenizer warnings (raw)</summary>");
  lines.push("");
  lines.push("```");
  for (const w of extractorWarnings) lines.push(`${w.bookKey}: ${w.warning}`);
  lines.push("```");
  lines.push("</details>");
  lines.push("");
}

writeFileSync(path.join(OUT_DIR, "GATE.md"), lines.join("\n"));
console.log(`Wrote ${path.join(OUT_DIR, "GATE.md")}`);
console.log("\n--- GATE SUMMARY (see out/GATE.md for full detail) ---");
console.log(`Assertions: ${assertions.filter((a) => a.pass).length}/${assertions.length} pass`);
console.log(`Disappeared: scripture=${disappearedScripture.length} footnote=${disappearedFootnote.length}`);
console.log(`  unexplained: scripture=${disappearedScripture.filter((x) => !x.explanation).length} footnote=${disappearedFootnote.filter((x) => !x.explanation).length}`);
console.log(`Appeared: scripture=${appearedScripture.length} footnote=${appearedFootnote.length}`);
console.log(`Superscript disagreements: ${superscriptDisagreements.length} chapter(s)`);
console.log("\nThis script does not declare the gate passed. Read out/GATE.md.");
