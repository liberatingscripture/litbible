#!/usr/bin/env node
// Phase 2 of the approved plan ("## Phase 2 — Ledger (stop here for
// review)"). Builds a full record of every master/repo footnote and verse
// difference across the 206 `indexed: true` chapters, classifies each into
// a bucket (A-E, or a deferred/repo-only existence-check outcome), and
// writes `out/ledger.json` + one Markdown file per book + `out/INDEX.md`.
//
// *** WRITE-ONLY IN THIS SESSION. DO NOT RUN THIS SCRIPT. ***
// Per the task's explicit instruction: this file must be written to
// implement the plan's classification algorithm in full, but must not be
// executed. Its own header in scripts/reconcile/README.md repeats this. The
// classification thresholds in lib/word-diff.mjs are principled defaults
// reasoned from the plan's description, not calibrated against a live run -
// re-check them against real ledger output before trusting the bucket-A
// subclass counts the plan cites (11 placeholder / 52+13 truncated-or-
// summarized / 287+227 punctuation-or-case+66 case / 470+139 rewritten).
//
// Classification pipeline, per record, in order (plan: "Classification:
// existence check -> cosmetic gate (normalize() equality -> bucket E) ->
// settle window (git) -> word-level change shape via LCS -> bucket."):
//   1. Existence check - does this footnote/verse exist on both sides, only
//      in the master (deferred - a later PR's work, per the plan's
//      "Deferred" list), or only in the repo (bucket D)?
//   2. Cosmetic gate - normalize()-equal but raw-different -> bucket E,
//      classification stops there (no git/LCS work needed).
//   3. Settle window - walk the chapter file's own commit history (once per
//      file, reused across every record in it - see lib/git-settle.mjs) to
//      find when the record's CURRENT text first appeared, and classify
//      that date into import-era / authored-apr-jul / august.
//   4. Word-level shape - lib/word-diff.mjs's LCS diff, classified into a
//      bucket-A subclass (placeholder / truncated-or-summarized /
//      punctuation-or-case / rewritten).
//   5. Bucket from window: import-era -> A, authored-apr-jul -> C,
//      august -> B.
//   Override (applied after the above, informational fields kept either
//   way): a patch-construction warning, "structured" HTML the run-based
//   master extractor could never have produced (a real hyperlink, list, or
//   table - NOT the ordinary `<span class="vglue">` verse-marker wrapper or
//   a footnote-ref `<a>`, both of which are standard on every record), or a
//   bracketed chapter (mark-16, john-7/8/9/11, romans-16, whose paired
//   footnotes are byte-identical by design and must move together) forces
//   `forceHandReview` to a non-null reason. The natural bucket/subclass are
//   NOT overwritten - hand-review is a disposition on top of the
//   classification, not a replacement for it.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { extractMasterChapters, extractMasterFootnotes } from "./lib/docx-verses.mjs";
import { splitChapterVerses, extractRepoFootnoteOrder } from "./lib/repo-extract.mjs";
import { normalize, classifyDiff } from "./lib/normalize.mjs";
import { severity } from "./lib/classify.mjs";
import { pairFootnotes } from "./lib/pair-footnotes.mjs";
import { BOOKS, DOCX_TO_BOOKKEY, TRUNCATED_MASTERS, DOCUMENTED_GAPS } from "./lib/book-map.mjs";
// NO_MASTER_BOOKS (revelation) is intentionally not iterated at all here -
// it never appears in DOCX_TO_BOOKKEY, and every one of its chapters is a
// draft (indexed:false) anyway per CLAUDE.md's Scope section, so there is
// nothing for this ledger to compare.
import { classifyShape } from "./lib/word-diff.mjs";
import { getChapterHistory, findSettleCommit, findPreAugustValue, classifyWindow } from "./lib/git-settle.mjs";
import {
  locateVerseSpanInParagraphs,
  findVerseMarkers,
  splitComposedAtParagraphSeam,
  splitTrailingBlockClose,
  splitTrailingSeparator,
} from "./lib/verse-span.mjs";
import { REF_MARK } from "./lib/docx-verses.mjs";
import { curlify, auditWrongDirectionPairs } from "./lib/curl-quotes.mjs";
import { composeRestore } from "./lib/quote-compose.mjs";
import { restoreLinkAttributes } from "./lib/link-restore.mjs";
import { verseBoundaryDisagreement, suspectRestore } from "./lib/restore-guards.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------------
// Configuration - same convention as gate-report.mjs (see its header and
// scripts/reconcile/README.md).
// ---------------------------------------------------------------------

function argValue(flag) {
  const pref = `--${flag}=`;
  const found = process.argv.find((a) => a.startsWith(pref));
  return found ? found.slice(pref.length) : undefined;
}

const DEFAULT_MASTER_XML_DIR =
  "C:\\Users\\bcjoh\\AppData\\Local\\Temp\\claude\\C--Users-bcjoh-GitHub-litbible\\ddd3fc48-2f0f-4228-8fea-4b8565ba571e\\scratchpad\\docx-audit\\extracted";

const MASTER_XML_DIR = argValue("master-dir") || process.env.MASTER_XML_DIR || DEFAULT_MASTER_XML_DIR;
const REPO_ROOT = path.resolve(__dirname, "../..");
const CHAPTERS_DIR = path.resolve(REPO_ROOT, "src/data/chapters");
const OUT_DIR = argValue("out-dir") || path.resolve(__dirname, "out");
const DECISIONS_PATH = path.join(OUT_DIR, "decisions.json");

// Chapters carrying a contested passage wrapped in literal ⟦ and ⟧ markers
// (CLAUDE.md, "Bracketed passages"). This used to hold EVERY record in these
// chapters, which is far coarser than the hazard: 14 bucket-A records sat here
// and not one of their spans contained a marker - john-11-fn-y is an ordinary
// footnote held because John 11 has brackets somewhere else entirely.
//
// The real hazard is that the markers are literal characters, so they survive
// into the extracted master text and a restore could move or drop one. That is
// now checked per record (bracketMarkersAgree) against a SECOND, marker-
// preserving extraction, rather than assumed. The pairing half of the old
// justification - both footnotes of a pair are byte-identical by design and
// must move together - is enforced by check-bracket-twins.mjs after applying.
const BRACKETED_CHAPTERS = new Set(["mark-16", "john-7", "john-8", "john-9", "john-11", "romans-16"]);

// BOTH forms, deliberately: the repo uses ⟦/⟧ and the masters still use the
// retired [|/|], so a restore that would swap one for the other has to read as
// "this patch changes the markers" (and be held) rather than as "the markers
// vanished". See the note in src/lib/bracket-markers.mjs.
const BRACKET_MARKER_RE = /[⟦⟧]|\[\||\|\]/g;

const QUOTE_CHARS_G = /["'‘’‚‛“”„‟]/g;

/** Do these two plain texts differ in nothing but quote characters and
 *  whitespace? Asked of a whole record, where the answer decides whether a
 *  finding belongs to the owner rather than to this repo. */
function quotesAndSpacingOnly(a, b) {
  const flatten = (s) => String(s ?? "").replace(QUOTE_CHARS_G, "").replace(/\s+/g, " ").trim();
  return flatten(a) === flatten(b);
}

/** The bracket markers in every string this patch would rewrite must come out
 *  of the restore exactly as they went in - same markers, same order. A check,
 *  never a repair: a record that would move one keeps its hold. */
function bracketMarkersAgree(patch) {
  if (patch.newValue == null) return { ok: true };
  const spans = patch.edits ?? [{ oldValue: patch.oldValue, newValue: patch.newValue }];
  for (const s of spans) {
    const before = (String(s.oldValue).match(BRACKET_MARKER_RE) || []).join(" ");
    const after = (String(s.newValue).match(BRACKET_MARKER_RE) || []).join(" ");
    if (before !== after) {
      return {
        ok: false,
        reason:
          `bracketed passage: restoring would change this string's ⟦/⟧ markers ` +
          `(${before || "none"} -> ${after || "none"}) - they are reader-facing and their paired footnotes must move together`,
      };
    }
  }
  return { ok: true };
}

// ---------------------------------------------------------------------
// Structured-HTML detector (plan: "Anything with a patch warning,
// structured HTML (<div|span|a|ul|ol|table>), or a bracketed chapter is
// forced to hand-review"). The run-based master extractor
// (lib/docx-runs.mjs) only ever emits <em>/<b>/escaped text - never <div>,
// <a>, <ul>, <ol>, or <table>, and never a <span> at all - so any of those
// appearing in the REPO's current text signals hand-authored structure a
// blind master-text overwrite would destroy. `<span class="vglue">` (every
// verse's own marker wrapper) and a footnote-ref `<a>` (every paragraph
// that cites a footnote) are the two standard, expected exceptions.
// ---------------------------------------------------------------------

const FNREF_ANCHOR_RE = /<sup class="fn-ref"><a id="fnref-[^"]+" href="#fn-[^"]+" role="doc-noteref">[a-z]+<\/a><\/sup>/g;

function structuredHtmlReason(html) {
  if (/<(div|ul|ol|table)\b/i.test(html)) return "contains <div>/<ul>/<ol>/<table> - never produced by the master extractor";
  const withoutFnRef = html.replace(FNREF_ANCHOR_RE, "");
  if (/<a\b/i.test(withoutFnRef)) return "contains a hyperlink (<a>) beyond the standard footnote-ref anchor";
  const withoutVglue = html.replaceAll('<span class="vglue">', "");
  if (/<span\b/i.test(withoutVglue)) return "contains a <span> beyond the standard vglue verse-marker wrapper";
  return null;
}

// ---------------------------------------------------------------------
// Decisions sidecar (plan: "Owner approvals land in a sidecar
// out/decisions.json that apply.mjs reads, so ledger.json stays
// regenerable"). Shape is this reconciliation's own convention, since the
// plan doesn't fully specify it: { [recordId]: { decision: "approved" |
// "rejected" | "deferred", note?: string } }. Re-check this shape against
// whatever a human reviewer actually produces before Phase 3 relies on it.
// ---------------------------------------------------------------------

function loadDecisions() {
  if (!existsSync(DECISIONS_PATH)) return {};
  try {
    return JSON.parse(readFileSync(DECISIONS_PATH, "utf8"));
  } catch (e) {
    console.error(`WARNING: ${DECISIONS_PATH} exists but isn't valid JSON (${e.message}) - treating as empty.`);
    return {};
  }
}

// ---------------------------------------------------------------------
// Verse-patch construction: json-splice.mjs only ever replaces a whole JSON
// string value, so restoring one verse means replacing its WHOLE containing
// paragraphs[i] string with everything outside that verse's own span
// byte-identical. The verse's own marker wrapper
// (`<span class="vglue"><sup id="vN" class="vn">N</sup>&nbsp;FIRST_WORD
// </span>`) has to be reconstructed around the NEW first word, since the
// master has no concept of that wrapper at all (it's a repo/site
// convention, not something Word formatting carries). Handles the common
// case (new content's first word is plain text, no leading tag) and
// declines the rest rather than risk splitting/mis-nesting a tag.
// ---------------------------------------------------------------------

const PLAIN_FIRST_WORD_RE = /^([^\s<]+)/;

// A footnote reference is zero-width in the master, so master-derived verse
// HTML carries no <sup class="fn-ref"> anchors at all. Restoring a verse from
// it without putting them back deletes every anchor inside that verse: the
// footnote stays in footnotes[] with nothing pointing at it, unreachable to
// readers, and validate-chapters.mjs does not catch it (it checks that every
// anchor has a footnote, never that every footnote has an anchor).
//
// extractMasterChapters({refMarkers:true}) leaves a REF_MARK-delimited
// placeholder at each reference's position instead. The repo's OWN anchor
// markup is then substituted back in, in order, taken from the span being
// replaced - so the anchors are preserved verbatim (ids, hrefs, labels) and
// only their POSITION comes from the master. Counts must agree exactly; a
// mismatch means the master gained or lost a reference relative to the repo,
// which is an editorial change to hand-review, not something to paper over.
const REPO_ANCHOR_RE = /<sup\b[^>]*\bclass="fn-ref"[^>]*>[\s\S]*?<\/sup>/g;
const REF_PLACEHOLDER_RE = new RegExp(`${REF_MARK}([^${REF_MARK}]*)${REF_MARK}`, "g");

function restoreAnchors(masterHtml, oldVerseHtml) {
  const placeholders = masterHtml.match(REF_PLACEHOLDER_RE) || [];
  const anchors = oldVerseHtml.match(REPO_ANCHOR_RE) || [];
  if (placeholders.length !== anchors.length) {
    return {
      ok: false,
      reason:
        `footnote-reference count differs (master ${placeholders.length}, repo ${anchors.length}) - ` +
        `restoring would add or drop an anchor, so this verse needs hand-review`,
    };
  }
  let i = 0;
  return { ok: true, html: masterHtml.replace(REF_PLACEHOLDER_RE, () => anchors[i++]) };
}

function wrapFirstWordInVglue(verseNum, contentHtml) {
  const m = PLAIN_FIRST_WORD_RE.exec(contentHtml);
  if (!m) return null;
  const firstWord = m[1];
  const rest = contentHtml.slice(firstWord.length);
  return `<span class="vglue"><sup id="v${verseNum}" class="vn">${verseNum}</sup>&nbsp;${firstWord}</span>${rest}`;
}

// Both patch builders take the master's HTML twice over, and which one is
// populated says how curlify() went:
//
//   curlified !== null            the ordinary path - splice it in.
//   curlified === null, raw set   curlify() REFUSED this string as
//                                 quote-ambiguous. The refusal is about the
//                                 master's punctuation, not its words, so the
//                                 restore is COMPOSED instead of converted -
//                                 see lib/quote-compose.mjs. Before that
//                                 existed these records died here with
//                                 newValue null, which is what made
//                                 quote-ambiguous the largest held group in
//                                 bucket A by a factor of six.
//   both null                     nothing to build (the caller only wants
//                                 jsonPath/oldValue populated for review).
//
// A composed restore carries `quoteResolution` so the caller can tell the
// three outcomes apart: "composed" (real words recovered), "repo-quotes-correct"
// (every span resolved to the repo, so the two sides differ in punctuation
// only), or null (no compose happened).
function composeIfRefused(oldSpan, content, curlifiedMasterHtml) {
  if (curlifiedMasterHtml !== null) return { ok: true, content, quoteResolution: null };
  const composed = composeRestore(oldSpan, content, { quoteAmbiguous: true });
  if (!composed.ok) return { ok: false, reason: composed.reason };
  return {
    ok: true,
    content: composed.value,
    quoteResolution: composed.unchanged ? "repo-quotes-correct" : "composed",
  };
}

function buildVersePatch(paragraphs, verseNum, curlifiedMasterHtml, rawMasterHtml = null) {
  const loc = locateVerseSpanInParagraphs(paragraphs, verseNum);
  if (!loc.found) {
    return { jsonPath: null, oldValue: null, newValue: null, reason: "no id=\"vN\" marker for this verse found in the repo's current paragraphs" };
  }
  const source = curlifiedMasterHtml ?? rawMasterHtml;

  if (loc.spansMultipleParagraphs) {
    return buildContinuationVersePatch(paragraphs, verseNum, loc, source, curlifiedMasterHtml);
  }

  const para = paragraphs[loc.paragraphIndex];
  const jsonPath = ["paragraphs", loc.paragraphIndex];
  if (source == null) return { jsonPath, oldValue: para, newValue: null, reason: null };

  // The LAST verse in a paragraph owns the rest of the string, closing tags
  // and all - locateVerseSpanInParagraphs returns `end = para.length` for it.
  // The master has no markup whatsoever, so replacing that whole span drops
  // the paragraph's `</p>`. That is not hypothetical: it is how 59 paragraphs
  // on main lost their closing tag across the two restore PRs, undetected
  // because a browser silently closes a `<p>` at the next block element.
  // Splitting the closing run off and re-appending it verbatim means the
  // restore can only ever rewrite the paragraph's CONTENT.
  //
  // The same argument applies to the single space standing between this verse
  // and the next one's marker: it is inside this span (the span ends AT that
  // marker) and the master has nothing corresponding to it, so composing from
  // master text drops it and the verse number renders glued to the previous
  // sentence. Peel it off with the closing tags and re-append both in span
  // order - see splitTrailingSeparator.
  const oldSpan = para.slice(loc.start, loc.end);
  const { body: withoutClose, close: closeRun } = splitTrailingBlockClose(oldSpan);
  const { body: oldBody, sep: sepRun } = splitTrailingSeparator(withoutClose);
  const linked = restoreLinkAttributes(source, oldBody);
  if (!linked.ok) return { jsonPath, oldValue: para, newValue: null, reason: linked.reason };
  const anchored = restoreAnchors(linked.html, oldBody);
  if (!anchored.ok) return { jsonPath, oldValue: para, newValue: null, reason: anchored.reason };
  const wrapped = wrapFirstWordInVglue(verseNum, anchored.html);
  if (wrapped === null) {
    return {
      jsonPath,
      oldValue: para,
      newValue: null,
      reason: "restored text begins inside a formatting tag - the vglue marker rewrap needs manual construction",
    };
  }

  const c = composeIfRefused(oldBody, wrapped, curlifiedMasterHtml);
  if (!c.ok) return { jsonPath, oldValue: para, newValue: null, reason: c.reason };
  if (c.quoteResolution === "repo-quotes-correct") {
    return { jsonPath, oldValue: para, newValue: null, reason: null, quoteResolution: c.quoteResolution };
  }

  const newParagraph = para.slice(0, loc.start) + c.content + sepRun + closeRun + para.slice(loc.end);
  return { jsonPath, oldValue: para, newValue: newParagraph, reason: null, quoteResolution: c.quoteResolution };
}

// A verse that spans a paragraph break (CLAUDE.md's single-marker convention:
// the marker sits at the verse's start, the continuation paragraph opens with
// plain text). NEITHER SIDE IS WRONG HERE - Word has no paragraph structure to
// compare against, and the repo's break is authored: `ephesians-1` and
// `2peter-1` open a letter as `From:` / `To:`, `matthew-20` turns a speaker
// mid-verse. Only the patch SHAPE was wrong, since json-splice.mjs replaces
// one string value and this verse lives in two.
//
// The master's continuous text therefore has to be distributed across the two
// paragraphs the repo already has. Rather than cut the master and hope the cut
// lands where the repo's break does, both repo paragraphs are composed
// TOGETHER against the master: review-core reads the seam markup
// (`</p><p id="...">`) as a `structural` hunk, since it strips to nothing on
// both sides, so the composition keeps the repo's own seam and the words fall
// on whichever side the alignment puts them. splitComposedAtParagraphSeam then
// cuts there, under assertions; every way it declines keeps the hold.
function buildContinuationVersePatch(paragraphs, verseNum, loc, source, curlifiedMasterHtml) {
  const [pi, pj] = loc.paragraphIndices;
  const headPara = paragraphs[pi];
  const tailPara = paragraphs[pj];
  const jsonPath = ["paragraphs", pi];
  const tailPath = ["paragraphs", pj];
  const start = findVerseMarkers(headPara).find((mk) => mk.verse === verseNum).start;
  const headSpan = headPara.slice(start);

  if (source == null) {
    return {
      jsonPath,
      oldValue: headPara,
      newValue: null,
      reason: `verse continues into paragraphs[${pj}] with no marker of its own (a continuation, per CLAUDE.md) - not auto-patchable as a single string value`,
    };
  }

  const repoConcat = headSpan + tailPara;
  const linked = restoreLinkAttributes(source, repoConcat);
  if (!linked.ok) return { jsonPath, oldValue: headPara, newValue: null, reason: linked.reason };
  const anchored = restoreAnchors(linked.html, repoConcat);
  if (!anchored.ok) return { jsonPath, oldValue: headPara, newValue: null, reason: anchored.reason };
  const wrapped = wrapFirstWordInVglue(verseNum, anchored.html);
  if (wrapped === null) {
    return {
      jsonPath,
      oldValue: headPara,
      newValue: null,
      reason: "restored text begins inside a formatting tag - the vglue marker rewrap needs manual construction",
    };
  }

  const composed = composeRestore(repoConcat, wrapped, { quoteAmbiguous: curlifiedMasterHtml === null });
  if (!composed.ok) return { jsonPath, oldValue: headPara, newValue: null, reason: composed.reason };
  const quoteResolution =
    curlifiedMasterHtml !== null ? null : composed.unchanged ? "repo-quotes-correct" : "composed";
  if (composed.unchanged) {
    return { jsonPath, oldValue: headPara, newValue: null, reason: null, quoteResolution };
  }

  const split = splitComposedAtParagraphSeam(composed.value, headSpan, tailPara);
  if (!split.ok) return { jsonPath, oldValue: headPara, newValue: null, reason: split.reason };

  const newHead = headPara.slice(0, start) + split.head;
  // `edits` is the additive half of the patch schema: the head paragraph stays
  // in jsonPath/oldValue/newValue so every existing consumer keeps working,
  // and only apply.mjs looks for the rest. All of them land or none do.
  const edits = [];
  if (newHead !== headPara) edits.push({ jsonPath, oldValue: headPara, newValue: newHead });
  if (split.tail !== tailPara) edits.push({ jsonPath: tailPath, oldValue: tailPara, newValue: split.tail });
  if (edits.length === 0) return { jsonPath, oldValue: headPara, newValue: null, reason: null, quoteResolution };

  return {
    jsonPath,
    oldValue: headPara,
    newValue: newHead,
    reason: null,
    quoteResolution,
    edits,
    spansParagraphs: true,
  };
}

// Same nullable-curlifiedMasterHtml convention as buildVersePatch above.
function buildFootnotePatch(footnotesArr, refId, curlifiedMasterHtml, rawMasterHtml = null) {
  const idx = footnotesArr.findIndex((fn) => fn.refId === refId);
  if (idx === -1) {
    return { jsonPath: null, oldValue: null, newValue: null, reason: "repo footnote not found by refId (should not happen for a match/paired-differs pair)" };
  }
  const oldValue = footnotesArr[idx].html;
  const jsonPath = ["footnotes", idx, "html"];
  const source = curlifiedMasterHtml ?? rawMasterHtml;
  if (source == null) return { jsonPath, oldValue, newValue: null, reason: null };

  const linked = restoreLinkAttributes(source, oldValue);
  if (!linked.ok) return { jsonPath, oldValue, newValue: null, reason: linked.reason };

  const c = composeIfRefused(oldValue, linked.html, curlifiedMasterHtml);
  if (!c.ok) return { jsonPath, oldValue, newValue: null, reason: c.reason };
  if (c.quoteResolution === "repo-quotes-correct") {
    return { jsonPath, oldValue, newValue: null, reason: null, quoteResolution: c.quoteResolution };
  }
  return { jsonPath, oldValue, newValue: c.content, reason: null, quoteResolution: c.quoteResolution };
}

// ---------------------------------------------------------------------
// Per-record classification (steps 2-5 of the pipeline; existence-check
// outcomes are handled by the caller before this runs, since they skip
// straight to bucket D/deferred without a cosmetic gate or settle window).
// ---------------------------------------------------------------------

function classifyExisting({ masterText, repoText, history, extractValue }) {
  const diffKind = classifyDiff(masterText, repoText); // 'identical' | 'cosmetic' | 'real'
  if (diffKind !== "real") {
    return { bucket: diffKind === "cosmetic" ? "E" : null, subclass: diffKind === "cosmetic" ? "cosmetic" : null, cosmetic: diffKind === "cosmetic" };
  }

  const settledAt = findSettleCommit(history, repoText, extractValue);
  const window = settledAt ? classifyWindow(settledAt.date) : null;
  const preAugText = findPreAugustValue(history, extractValue);
  const shape = classifyShape(masterText, repoText);

  let bucket;
  if (window === "import-era") bucket = "A";
  else if (window === "authored-apr-jul") bucket = "C";
  else if (window === "august") bucket = "B";
  else bucket = "A"; // no history at all (file added and never touched again) - treat as settled from the start

  return { bucket, subclass: shape.subclass, settledAt, window, shape, preAugText, cosmetic: false };
}

// ---------------------------------------------------------------------
// Markdown rendering (one file per book - the plan explicitly rejects a
// single 921KB REPORT.md as unreviewable).
// ---------------------------------------------------------------------

function mdEscape(s) {
  return String(s ?? "").replace(/\|/g, "\\|").replace(/\n/g, " ");
}

function renderRecordMd(r) {
  const lines = [];
  lines.push(`### ${r.id}`);
  lines.push("");
  lines.push(`- kind: \`${r.kind}\`  bucket: **${r.bucket ?? "?"}**  subclass: \`${r.subclass ?? "-"}\``);
  if (r.window) lines.push(`- window: \`${r.window}\`  settled: ${r.settledAt?.date ?? "-"} (${r.settledAt?.sha?.slice(0, 8) ?? "-"})`);
  if (r.severity !== undefined) lines.push(`- severity: ${r.severity.toFixed(3)}`);
  if (r.forceHandReview) lines.push(`- **HAND REVIEW REQUIRED**: ${r.forceHandReview}`);
  lines.push(`- jsonPath: \`${JSON.stringify(r.jsonPath)}\``);
  lines.push(`- decision: \`${r.decision ?? "pending"}\``);
  lines.push("");
  lines.push(`| master | current |`);
  lines.push(`|---|---|`);
  lines.push(`| ${mdEscape(r.text.master)} | ${mdEscape(r.text.current)} |`);
  if (r.text.preAug !== undefined && r.text.preAug !== r.text.current) {
    lines.push("");
    lines.push(`pre-August text: ${mdEscape(r.text.preAug)}`);
  }
  lines.push("");
  return lines.join("\n");
}

function renderBookMd(bookKey, records, wrongDirectionByChapter) {
  const lines = [`# ${bookKey}`, ""];
  const byBucket = new Map();
  for (const r of records) {
    if (!byBucket.has(r.bucket)) byBucket.set(r.bucket, []);
    byBucket.get(r.bucket).push(r);
  }
  const bucketOrder = ["A", "B", "C", "D", "E", "deferred-master-only", null];
  for (const b of bucketOrder) {
    const list = byBucket.get(b);
    if (!list || list.length === 0) continue;
    lines.push(`## Bucket ${b ?? "(unclassified)"} (${list.length})`, "");
    for (const r of list) lines.push(renderRecordMd(r));
  }
  const wd = wrongDirectionByChapter.get(bookKey) || [];
  if (wd.length > 0) {
    lines.push("## Pre-existing wrong-direction quote pairs (history, not this reconciliation)", "");
    for (const f of wd) lines.push(`- ch.${f.chapter} ${f.where}: opener \`${f.opener}\` at ${f.openPos}, closer \`${f.closer}\` at ${f.closePos} (${f.kind})`);
    lines.push("");
  }
  return lines.join("\n");
}

// ---------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------

if (!existsSync(MASTER_XML_DIR)) {
  console.error(`Master XML directory not found: ${MASTER_XML_DIR}`);
  console.error("Pass --master-dir=<path> or set MASTER_XML_DIR. See scripts/reconcile/README.md.");
  process.exit(1);
}
if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });

const decisions = loadDecisions();
const records = [];
const wrongDirectionByChapter = new Map(); // bookKey -> [{chapter, where, ...finding}]
const deferredMasterOnly = []; // 8 real master-only footnotes + 13 master-has-extra verses, per the follow-up doc
// Two findings that are the OWNER's to act on, not this repo's - see the
// quoteResolution branches below for what separates them. Written to out/ and
// summarized into FOLLOW-UP-RECONCILIATION.md; neither implies a repo change.
const masterMalformedQuotes = []; // Word footnotes whose quotation doesn't balance
const crossVerseQuoteBoundaries = []; // verses where a quotation's two ends sit in different verses
let chaptersProcessed = 0;
let chaptersSkippedDraft = 0;

function auditChapterStrings(bookKey, chapter, kind, label, html) {
  const findings = auditWrongDirectionPairs(html);
  if (findings.length === 0) return;
  if (!wrongDirectionByChapter.has(bookKey)) wrongDirectionByChapter.set(bookKey, []);
  for (const f of findings) {
    wrongDirectionByChapter.get(bookKey).push({ chapter, where: `${kind} ${label}`, ...f });
  }
}

for (const [docxName, bookKey] of Object.entries(DOCX_TO_BOOKKEY)) {
  const chapterCount = BOOKS[bookKey];
  const docXmlPath = path.join(MASTER_XML_DIR, docxName, "word", "document.xml");
  const fnXmlPath = path.join(MASTER_XML_DIR, docxName, "word", "footnotes.xml");
  if (!existsSync(docXmlPath) || !existsSync(fnXmlPath)) {
    console.error(`Skipping ${bookKey}: master XML not found under ${MASTER_XML_DIR}\\${docxName}`);
    continue;
  }
  const docXml = readFileSync(docXmlPath, "utf8");
  const fnXml = readFileSync(fnXmlPath, "utf8");

  const warnings = [];
  const master = extractMasterChapters(docXml, chapterCount, { warnings, stripBrackets: true, refMarkers: true });
  const footnoteTextMap = extractMasterFootnotes(fnXml, { warnings, stripBrackets: true });

  // COMPARISON needs the markers stripped; RESTORATION does not. An opening
  // `⟦` leads its paragraph ahead of the first verse marker, so leaving it in
  // would file the marker's characters under the wrong verse and make every
  // bracketed chapter look like it had drifted. But the markers are
  // reader-facing text, so a patch value built from the stripped extraction
  // would silently delete them from the chapter it spliced into. Hence two
  // extractions from the same XML: `master`/`footnoteTextMap` drive
  // classification, and these drive `patch.newValue`.
  //
  // Only the three books that have a bracketed chapter pay for the second
  // pass. Marker logic must run on the CONCATENATED text these produce, never
  // on raw XML - John splits a marker across <w:t> runs, so a raw scan sees 2
  // opens where the text has 3.
  const bookHasBrackets = [...BRACKETED_CHAPTERS].some((k) => k.startsWith(`${bookKey}-`));
  const masterKeep = bookHasBrackets ? extractMasterChapters(docXml, chapterCount, { stripBrackets: false, refMarkers: true }) : null;
  const footnoteKeepMap = bookHasBrackets ? extractMasterFootnotes(fnXml, { stripBrackets: false }) : null;
  // pair-footnotes.mjs's masterList lookup expects a plain STRING per id
  // (`normalize(footnoteTextMap.get(x.id) || "")`), not the {plain,html,...}
  // record extractMasterFootnotes returns - mirrors gate-report.mjs's own
  // plainFootnoteMap transform (same two modules, same mismatch to bridge).
  const plainFootnoteMap = new Map([...footnoteTextMap].map(([id, rec]) => [id, rec.plain]));
  if (!master.ok && !TRUNCATED_MASTERS[bookKey]) {
    console.error(`Skipping ${bookKey}: master extraction failed entirely - ${master.reason}`);
    continue;
  }

  const truncInfo = TRUNCATED_MASTERS[bookKey];
  const usableSet = truncInfo ? new Set(truncInfo.usableChapters) : null;

  for (let c = 1; c <= chapterCount; c++) {
    const repoPath = path.join(CHAPTERS_DIR, `${bookKey}-${c}.json`);
    if (!existsSync(repoPath)) continue;
    const repoRaw = readFileSync(repoPath, "utf8");
    const repoJson = JSON.parse(repoRaw);
    if (repoJson.indexed === false) {
      chaptersSkippedDraft++;
      continue;
    }
    if (usableSet && !usableSet.has(c)) continue; // truncated master, not comparable
    const chData = master.chapters.get(c);
    if (!chData) continue; // master chapter boundary not found

    const chapterKey = `${bookKey}-${c}`;
    const isBracketed = BRACKETED_CHAPTERS.has(chapterKey);
    const relChapterPath = path.relative(REPO_ROOT, repoPath).split(path.sep).join("/");
    const history = getChapterHistory(REPO_ROOT, relChapterPath);
    chaptersProcessed++;

    // Audit every current string in this chapter for pre-existing
    // wrong-direction curly-quote pairs, regardless of whether it's part of
    // any ledger record (plan: "over restored AND untouched strings").
    repoJson.paragraphs.forEach((p, i) => auditChapterStrings(bookKey, c, "paragraph", `#${i}`, p));
    for (const fn of repoJson.footnotes || []) auditChapterStrings(bookKey, c, "footnote", `fn-${fn.label}`, fn.html);

    // ---------------- Scripture verses ----------------
    const repoVerses = splitChapterVerses(repoJson.paragraphs);
    // Plain text per verse on the master side, in the same shape repoVerses
    // has, so verseBoundaryDisagreement can compare a verse against its
    // NEIGHBOURS on the other side.
    const masterVerseText = new Map([...chData.verses].map(([n, rec]) => [n, rec.plain]));
    const allVerseNums = new Set([...chData.verses.keys(), ...repoVerses.keys()]);
    for (const v of [...allVerseNums].sort((a, b) => a - b)) {
      const gapKey = `${bookKey}-${c}-${v}`;
      const mRec = chData.verses.get(v);
      const masterText = mRec ? mRec.plain : undefined;
      const repoText = repoVerses.get(v);

      if (masterText === undefined && repoText === undefined) continue;
      if (masterText === undefined || repoText === undefined) {
        if (DOCUMENTED_GAPS.has(gapKey)) continue; // both sides agreeing the verse is absent is expected
        if (masterText !== undefined) {
          deferredMasterOnly.push({ kind: "verse", bookKey, chapter: c, verse: v, masterText });
        } else {
          // Repo-only verse text with no master counterpart at all is
          // outside this reconciliation's normal shape (verses don't get
          // freely added the way footnotes do) - record as bucket D for
          // visibility rather than silently dropping it.
          records.push({
            id: `${bookKey}-${c}-v${v}`,
            kind: "verse",
            bookKey,
            chapter: c,
            verse: v,
            repoLabel: null,
            jsonPath: null,
            settledAt: null,
            window: null,
            shape: null,
            bucket: "D",
            subclass: "repo-only",
            text: { master: null, preAug: undefined, current: repoText },
            diff: null,
            patch: { oldValue: null, newValue: null },
            forceHandReview: "repo-only verse content with no master counterpart",
            decision: decisions[`${bookKey}-${c}-v${v}`]?.decision ?? null,
          });
        }
        continue;
      }

      const extractValue = (parsed) => {
        try {
          const verses = splitChapterVerses(parsed.paragraphs);
          return verses.get(v);
        } catch {
          return undefined;
        }
      };
      const cls = classifyExisting({ masterText, repoText, history, extractValue });
      if (cls.bucket === "E" && cls.cosmetic) {
        records.push({
          id: `${bookKey}-${c}-v${v}`,
          kind: "verse",
          bookKey,
          chapter: c,
          verse: v,
          repoLabel: null,
          jsonPath: null,
          settledAt: null,
          window: null,
          shape: null,
          bucket: "E",
          subclass: "cosmetic",
          text: { master: masterText, preAug: undefined, current: repoText },
          diff: null,
          patch: { oldValue: null, newValue: null },
          forceHandReview: null,
          decision: decisions[`${bookKey}-${c}-v${v}`]?.decision ?? null,
        });
        continue;
      }
      if (cls.bucket === null) continue; // identical - nothing to record

      // Bracketed chapters get the marker-PRESERVING extraction for the patch
      // value while classification keeps using the stripped one - see
      // masterKeep's declaration.
      const mKeep = masterKeep?.chapters.get(c)?.verses.get(v);
      const patchSourceHtml = mKeep ? mKeep.html : mRec.html;
      const curlResult = curlify(patchSourceHtml);
      const patch = buildVersePatch(
        repoJson.paragraphs,
        v,
        curlResult.ok ? curlResult.result : null,
        curlResult.ok ? null : patchSourceHtml,
      );
      let forceHandReview = patch.reason;
      // Asked of the record's PLAIN texts, not of the compose outcome, so a
      // verse whose patch failed for some other reason first (an anchor-count
      // mismatch, or the wrong-direction gate firing on the very quote in
      // question) still reaches the owner's list rather than being filed under
      // whatever blocked it. Whitespace is folded here and deliberately not in
      // isQuoteOnly, which has to stay exact to judge a single hunk.
      const quoteOnlyDifference = !curlResult.ok && quotesAndSpacingOnly(masterText, repoText);
      if (quoteOnlyDifference || patch.quoteResolution === "repo-quotes-correct") {
        // Every span resolved to the repo, so the two sides differ in nothing
        // but quote characters. What that MEANS depends on the kind, and the
        // two are genuinely different findings:
        //
        // A footnote is a self-contained string, so an unbalanced quotation in
        // it is a defect in the master (see the footnote branch below).
        //
        // A VERSE is a slice of running prose. A speech routinely opens in one
        // verse and closes in another, so curlify refusing is expected and the
        // difference is about WHICH verse carries the mark - john-12:31-32
        // quotes the speech in the master and not at all in the repo, while
        // matthew-9:22 closes it in the repo and not in the master. That is an
        // editorial decision about the quotation's boundary, in both
        // directions, and no rule settles it.
        forceHandReview =
          "cross-verse quotation boundary: the two sides differ only in quote characters, and the quotation " +
          "opens or closes in a different verse - which verse carries the mark is an editorial decision";
        crossVerseQuoteBoundaries.push({ id: `${bookKey}-${c}-v${v}`, bookKey, chapter: c, verse: v, master: masterText, repo: repoText });
      } else if (!curlResult.ok && patch.newValue === null) {
        forceHandReview = forceHandReview || `quote-ambiguous: ${curlResult.reason}`;
      }
      if (isBracketed) {
        const bracketCheck = bracketMarkersAgree(patch);
        if (!bracketCheck.ok) forceHandReview = forceHandReview || bracketCheck.reason;
      }
      // Structured-HTML is checked against the REPO paragraph that would be
      // overwritten (patch.oldValue), not the master text - see
      // structuredHtmlReason's header for why.
      if (patch.jsonPath) {
        const structReason = structuredHtmlReason(patch.oldValue || "");
        if (structReason) forceHandReview = forceHandReview || structReason;
      }
      // Structural guards on the restore itself - see lib/restore-guards.mjs.
      // These run last because they are the least about classification and the
      // most about "a machine must not settle this one".
      forceHandReview =
        forceHandReview ||
        verseBoundaryDisagreement(masterVerseText, repoVerses, v) ||
        suspectRestore({ kind: "verse", masterText, repoText });

      records.push({
        id: `${bookKey}-${c}-v${v}`,
        kind: "verse",
        bookKey,
        chapter: c,
        verse: v,
        repoLabel: null,
        jsonPath: patch.jsonPath,
        settledAt: cls.settledAt,
        window: cls.window,
        shape: cls.shape,
        bucket: cls.bucket,
        subclass: cls.subclass,
        severity: severity(normalize(masterText), normalize(repoText)),
        text: { master: masterText, preAug: cls.preAugText, current: repoText },
        diff: cls.shape.diff.ops,
        patch: { oldValue: patch.oldValue, newValue: patch.newValue, edits: patch.edits, quoteResolution: patch.quoteResolution ?? null },
        forceHandReview,
        decision: decisions[`${bookKey}-${c}-v${v}`]?.decision ?? null,
      });
    }

    // ---------------- Footnotes ----------------
    const repoFootnoteOrder = extractRepoFootnoteOrder(repoJson.paragraphs, repoJson.footnotes);
    const paired = pairFootnotes(chData.footnotes, repoFootnoteOrder, plainFootnoteMap);

    for (const p of paired) {
      if (p.type === "master-only") {
        const rec = footnoteTextMap.get(p.master.id);
        deferredMasterOnly.push({ kind: "footnote", bookKey, chapter: c, masterId: p.master.id, verse: p.master.verse, masterText: rec?.plain });
        continue;
      }
      if (p.type === "repo-only") {
        const label = p.repo.footnote?.label ?? null;
        records.push({
          id: `${bookKey}-${c}-fn-${label ?? p.repo.refId}`,
          kind: "footnote",
          bookKey,
          chapter: c,
          verse: p.repo.verse,
          repoLabel: label,
          jsonPath: null,
          settledAt: null,
          window: null,
          shape: null,
          bucket: "D",
          subclass: "repo-only",
          text: { master: null, preAug: undefined, current: p.repo.text },
          diff: null,
          patch: { oldValue: p.repo.footnote?.html ?? null, newValue: null },
          forceHandReview: isBracketed ? "chapter carries a bracketed ⟦/⟧ passage - paired footnotes must move together" : null,
          decision: decisions[`${bookKey}-${c}-fn-${label ?? p.repo.refId}`]?.decision ?? null,
        });
        continue;
      }

      // match | paired-differs
      const masterRec = footnoteTextMap.get(p.master.id);
      const masterText = masterRec?.plain ?? "";
      const repoText = p.repo.text ?? "";
      const label = p.repo.footnote?.label ?? null;
      const id = `${bookKey}-${c}-fn-${label ?? p.repo.refId}`;

      const cls = classifyExisting({ masterText, repoText, history, extractValue: makeFootnoteExtractValue(p.repo.refId) });

      const baseFields = {
        id,
        kind: "footnote",
        bookKey,
        chapter: c,
        verse: p.repo.verse,
        repoLabel: label,
      };

      if (cls.bucket === "E" && cls.cosmetic) {
        records.push({
          ...baseFields,
          jsonPath: null,
          settledAt: null,
          window: null,
          shape: null,
          bucket: "E",
          subclass: "cosmetic",
          text: { master: masterText, preAug: undefined, current: repoText },
          diff: null,
          patch: { oldValue: null, newValue: null },
          forceHandReview: null,
          decision: decisions[id]?.decision ?? null,
        });
        continue;
      }
      if (cls.bucket === null) continue; // identical

      let forceHandReview = null;
      if (masterRec?.warning) forceHandReview = `master extraction warning: ${masterRec.warning}`;
      const patchSourceHtml = footnoteKeepMap?.get(p.master.id)?.html ?? masterRec?.html ?? "";
      // NOTE `patch.reason` is folded in below. It used to be ignored here
      // because buildFootnotePatch could only ever fail one way ("repo
      // footnote not found"), which cannot happen for a paired record; now
      // that composing can decline, dropping it would report a stale
      // quote-ambiguous reason in place of the real one.
      const curlResult = curlify(patchSourceHtml);
      const patch = buildFootnotePatch(
        repoJson.footnotes,
        p.repo.refId,
        curlResult.ok ? curlResult.result : null,
        curlResult.ok ? null : patchSourceHtml,
      );
      if (patch.quoteResolution === "repo-quotes-correct") {
        // A footnote is a self-contained string: its quotation has to balance
        // within it. So when the two sides differ in nothing but quote
        // characters and curlify refused the master's, the MASTER is the
        // malformed one and the repo is already right. There is nothing to
        // restore, and the fix belongs in Word - it goes on the back-port list
        // rather than staying held here forever.
        masterMalformedQuotes.push({
          id,
          bookKey,
          chapter: c,
          label,
          reason: curlResult.reason,
          position: curlResult.position,
          master: masterText,
          repo: repoText,
        });
      } else {
        forceHandReview = forceHandReview || patch.reason;
        if (!curlResult.ok && patch.newValue === null) {
          forceHandReview = forceHandReview || `quote-ambiguous: ${curlResult.reason}`;
        }
      }
      if (isBracketed) {
        const bracketCheck = bracketMarkersAgree(patch);
        if (!bracketCheck.ok) forceHandReview = forceHandReview || bracketCheck.reason;
      }
      const structReason = structuredHtmlReason(patch.oldValue ?? "");
      if (structReason) forceHandReview = forceHandReview || structReason;
      forceHandReview = forceHandReview || suspectRestore({ kind: "footnote", masterText, repoText });

      records.push({
        ...baseFields,
        jsonPath: patch.jsonPath,
        settledAt: cls.settledAt,
        window: cls.window,
        shape: cls.shape,
        bucket: cls.bucket,
        subclass: cls.subclass,
        severity: severity(normalize(masterText), normalize(repoText)),
        text: { master: masterText, preAug: cls.preAugText, current: repoText },
        diff: cls.shape.diff.ops,
        patch: { oldValue: patch.oldValue, newValue: patch.newValue, edits: patch.edits, quoteResolution: patch.quoteResolution ?? null },
        forceHandReview,
        decision: decisions[id]?.decision ?? null,
      });
    }
  }
}

// Footnote settle-window text extraction needs the SAME plain-text
// flattening repo-extract.mjs uses for the CURRENT comparison
// (footnoteHtmlToText), applied to each HISTORICAL commit's parsed JSON, so
// "does this historical value equal current" compares like with like. This
// is a factory rather than a top-level import cycle concern - kept next to
// its one call site above for locality; `footnoteHtmlToText` itself is
// re-exported from repo-extract.mjs.
function makeFootnoteExtractValue(refId) {
  return (parsed) => {
    const order = extractRepoFootnoteOrder(parsed.paragraphs || [], parsed.footnotes || []);
    const entry = order.find((o) => o.refId === refId);
    return entry ? entry.text : undefined;
  };
}

// ---------------------------------------------------------------------
// Write output
// ---------------------------------------------------------------------

writeFileSync(path.join(OUT_DIR, "ledger.json"), JSON.stringify(records, null, 2) + "\n", "utf8");

const booksDir = path.join(OUT_DIR, "books");
if (!existsSync(booksDir)) mkdirSync(booksDir, { recursive: true });
const recordsByBook = new Map();
for (const r of records) {
  if (!recordsByBook.has(r.bookKey)) recordsByBook.set(r.bookKey, []);
  recordsByBook.get(r.bookKey).push(r);
}
for (const [bookKey, list] of recordsByBook) {
  writeFileSync(path.join(booksDir, `${bookKey}.md`), renderBookMd(bookKey, list, wrongDirectionByChapter), "utf8");
}

// Deferred (master-only) list - a later PR's work per the plan's follow-up
// document, not part of this ledger's bucket A-E disposition.
writeFileSync(path.join(OUT_DIR, "deferred-master-only.json"), JSON.stringify(deferredMasterOnly, null, 2) + "\n", "utf8");

// The two owner-side quote findings, as Markdown to paste into
// FOLLOW-UP-RECONCILIATION.md. Both are lists of decisions only the author can
// make; nothing here is a repo change, and nothing here is applied.
{
  const lines = [
    "# Word back-port: footnotes whose quotation does not balance",
    "",
    `${masterMalformedQuotes.length} footnotes where the master and the repo differ in **nothing but quote characters**.`,
    "A footnote is a self-contained string, so its quotation has to balance inside it - these do not,",
    "and the repo already has them right. Nothing to restore; the fix is in Word.",
    "",
  ];
  for (const q of masterMalformedQuotes) {
    lines.push(`### ${q.id}`, "");
    lines.push(`- refused: ${mdEscape(q.reason)}${q.position != null ? ` (at character ${q.position})` : ""}`);
    lines.push(`- master: ${mdEscape(q.master)}`);
    lines.push(`- repo:   ${mdEscape(q.repo)}`);
    lines.push("");
  }
  writeFileSync(path.join(OUT_DIR, "word-backport-quotes.md"), lines.join("\n"), "utf8");
}
{
  const lines = [
    "# Cross-verse quotation boundaries",
    "",
    `${crossVerseQuoteBoundaries.length} verses where the two sides differ in **nothing but quote characters** and the`,
    "quotation's other end sits in a different verse. Unlike the footnotes above, these run BOTH ways -",
    "John 12:31-32 quotes the speech in Word and not at all in the repo, while Matthew 9:22 closes it in",
    "the repo and not in Word - so neither side can be taken as right by rule. Each needs a decision about",
    "where the quotation opens and closes; the repo side is then edited to match, and Word if it is wrong.",
    "",
  ];
  for (const q of crossVerseQuoteBoundaries) {
    lines.push(`### ${q.id}`, "");
    lines.push(`- master: ${mdEscape(q.master)}`);
    lines.push(`- repo:   ${mdEscape(q.repo)}`);
    lines.push("");
  }
  writeFileSync(path.join(OUT_DIR, "cross-verse-quote-boundaries.md"), lines.join("\n"), "utf8");
}

// INDEX.md: per-book x per-bucket counts.
{
  const bucketCols = ["A", "B", "C", "D", "E"];
  const lines = ["# Ledger index", "", `Chapters processed: ${chaptersProcessed} (drafts skipped: ${chaptersSkippedDraft})`, "", `| book | ${bucketCols.join(" | ")} | total |`, `|---|${bucketCols.map(() => "---").join("|")}|---|`];
  const allBooks = [...recordsByBook.keys()].sort();
  const totals = Object.fromEntries(bucketCols.map((b) => [b, 0]));
  for (const bookKey of allBooks) {
    const list = recordsByBook.get(bookKey);
    const counts = Object.fromEntries(bucketCols.map((b) => [b, list.filter((r) => r.bucket === b).length]));
    for (const b of bucketCols) totals[b] += counts[b];
    lines.push(`| ${bookKey} | ${bucketCols.map((b) => counts[b]).join(" | ")} | ${list.length} |`);
  }
  lines.push(`| **total** | ${bucketCols.map((b) => totals[b]).join(" | ")} | ${records.length} |`);
  lines.push("");
  lines.push(`Deferred (master-only, later PR): ${deferredMasterOnly.length}`);
  lines.push("");
  const wdTotal = [...wrongDirectionByChapter.values()].reduce((sum, arr) => sum + arr.length, 0);
  lines.push(`Pre-existing wrong-direction quote pairs found (history, not this change): ${wdTotal}`);
  writeFileSync(path.join(OUT_DIR, "INDEX.md"), lines.join("\n") + "\n", "utf8");
}

console.log(`Wrote ${records.length} records to ${path.join(OUT_DIR, "ledger.json")}`);
console.log(`Wrote ${recordsByBook.size} per-book Markdown files to ${booksDir}`);
console.log(`Wrote ${path.join(OUT_DIR, "INDEX.md")}`);
console.log(`Wrote ${deferredMasterOnly.length} deferred master-only records to ${path.join(OUT_DIR, "deferred-master-only.json")}`);
