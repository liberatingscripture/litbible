#!/usr/bin/env node
// Phase 3 applier: splice approved ledger records into src/data/chapters/*.json.
//
// Dry-run by default. Nothing is written without --write.
//
// Two hazards this file exists to handle, both found by inspecting the ledger
// before the first write rather than after:
//
//   1. TWO RECORDS CAN TARGET ONE STRING. A paragraph holding two verses
//      produces one record per verse, each carrying the WHOLE paragraph as
//      oldValue/newValue with only its own verse's portion changed. Applied in
//      sequence the second would discard the first (its oldValue no longer
//      matches, and its newValue never contained the first's edit). They are
//      composed into a single patch here, and only when their edit ranges are
//      provably disjoint - otherwise the group is refused.
//   2. A REBUILT VERSE CAN LOSE FOOTNOTE ANCHORS. Master footnote references
//      are zero-width in extraction, so a verse whose HTML is rebuilt from
//      master text drops every <sup class="fn-ref"> that sat inside the
//      replaced span. validate-chapters.mjs checks anchor -> footnote but NOT
//      footnote -> anchor, so that ships silently: a footnote in the array
//      with nothing in the text pointing at it. The anchor-sequence invariant
//      below is the backstop, and it is per-FILE so it catches the case no
//      matter which record introduced it.
//
// Usage:
//   node scripts/reconcile/apply.mjs [--bucket=A | --decision=approved]
//                                    [--kind=footnote|verse]
//                                    [--subclass=<s>] [--book=<bookKey>]
//                                    [--ledger=<path>] [--write]
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { createHash } from "node:crypto";

import { spliceValue } from "./lib/json-splice.mjs";
import { blockDelta } from "./lib/block-structure.mjs";
import { findUnseparatedVerseMarkers } from "./lib/verse-span.mjs";

const sha16 = (v) => createHash("sha256").update(v, "utf8").digest("hex").slice(0, 16);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CHAPTERS_DIR = path.resolve(__dirname, "../../src/data/chapters");

function argValue(flag, fallback) {
  const pref = `--${flag}=`;
  const found = process.argv.find((a) => a.startsWith(pref));
  return found ? found.slice(pref.length) : fallback;
}
const WRITE = process.argv.includes("--write");
const LEDGER_PATH = argValue("ledger", path.resolve(__dirname, "out/ledger.json"));
const WANT_BUCKET = argValue("bucket", "A");
const WANT_KIND = argValue("kind", null);
const WANT_SUBCLASS = argValue("subclass", null);
const WANT_BOOK = argValue("book", null);
// --decision=<v> selects by the reviewer's verdict instead of by bucket, so a
// record approved by hand can be applied whatever bucket it landed in. The
// verdict lives in out/decisions.json and build-ledger.mjs stamps it onto each
// record, which is why this reads r.decision rather than the file: the ledger
// stays the single thing apply.mjs looks at.
const WANT_DECISION = argValue("decision", null);
// --ids=<id>,<id> names records explicitly and is the ONLY way past
// forceHandReview. That flag is set on a whole chapter carrying a bracketed
// [|/|] passage, which is deliberately coarse: john-11-fn-d is an ordinary
// footnote held only because its chapter has brackets somewhere else. Naming a
// record is the reviewer saying they checked that particular one, so every
// other assertion still applies - a named record with no decision, no patch or
// a moved baseSha is still refused.
//
// It does NOT relieve you of the pair rule. romans-16 fn-o and fn-r are the
// same note printed at both ends of the doxology and are byte-identical by
// design; applying one alone splits them. Run check-bracket-twins.mjs after.
const WANT_IDS = (argValue("ids", "") || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

if (!existsSync(LEDGER_PATH)) {
  console.error(`Ledger not found: ${LEDGER_PATH}. Run build-ledger.mjs first.`);
  process.exit(1);
}

// ---------------------------------------------------------------------
// Record selection
// ---------------------------------------------------------------------

const ledger = JSON.parse(readFileSync(LEDGER_PATH, "utf8"));
const DECISIONS_PATH = path.resolve(__dirname, "out/decisions.json");
const decisionsFile = existsSync(DECISIONS_PATH) ? JSON.parse(readFileSync(DECISIONS_PATH, "utf8")) : {};
for (const r of ledger) r.reviewDecision = decisionsFile[r.id];
const selected = ledger.filter(
  (r) =>
    (WANT_IDS.length
      ? WANT_IDS.includes(r.id)
      : (WANT_DECISION == null ? r.bucket === WANT_BUCKET : r.decision === WANT_DECISION) &&
        !r.forceHandReview) &&
    r.patch?.newValue != null &&
    r.patch?.oldValue != null &&
    Array.isArray(r.jsonPath) &&
    (WANT_KIND == null || r.kind === WANT_KIND) &&
    (WANT_SUBCLASS == null || r.subclass === WANT_SUBCLASS) &&
    (WANT_BOOK == null || r.bookKey === WANT_BOOK),
);

if (WANT_IDS.length) {
  const missing = WANT_IDS.filter((id) => !selected.some((r) => r.id === id));
  if (missing.length) {
    console.error(`Named record(s) not applicable: ${missing.join(", ")}`);
    console.error("They are absent from the ledger, or carry no patch to write.");
    process.exit(1);
  }
}

if (selected.length === 0) {
  console.error("No records matched the given filters. Nothing to do.");
  process.exit(1);
}

// ---------------------------------------------------------------------
// Compose records that share one target string (hazard 1 above)
// ---------------------------------------------------------------------

/** [start,end) of the single differing region between two strings, by common
 *  prefix/suffix. Exact for a one-region edit, which is what a per-verse patch
 *  against a shared paragraph always is. */
function editRange(oldValue, newValue) {
  let a = 0;
  while (a < oldValue.length && a < newValue.length && oldValue[a] === newValue[a]) a++;
  let b = 0;
  while (
    b < oldValue.length - a &&
    b < newValue.length - a &&
    oldValue[oldValue.length - 1 - b] === newValue[newValue.length - 1 - b]
  ) {
    b++;
  }
  return { start: a, end: oldValue.length - b, replacement: newValue.slice(a, newValue.length - b) };
}

/**
 * A record's writes, one per target string.
 *
 * Most records have exactly one. A verse that spans a paragraph break has two:
 * it is a single verse in the Word master and two `paragraphs[]` strings here,
 * so restoring it means writing both, and json-splice.mjs only ever replaces
 * one string value. build-ledger.mjs emits those as `patch.edits` and keeps
 * jsonPath/oldValue/newValue pointing at the FIRST of them, so every consumer
 * that predates the field still sees a well-formed patch. Only this file reads
 * `edits`, and all of a record's units land or none of them do - see the
 * partial-write guard in the apply loop.
 */
function patchUnits(record) {
  const edits = record.patch.edits;
  if (!Array.isArray(edits) || edits.length === 0) {
    return [{ record, jsonPath: record.jsonPath, oldValue: record.patch.oldValue, newValue: record.patch.newValue, multiParagraph: false }];
  }
  return edits.map((e) => ({ record, jsonPath: e.jsonPath, oldValue: e.oldValue, newValue: e.newValue, multiParagraph: true }));
}

/**
 * The value to write for one unit.
 *
 * A record reviewed hunk-by-hunk in the review tool carries a `resolvedValue`:
 * the master's text where the reviewer took it and the repo's where they kept
 * it, which is neither side's whole string. That value is what gets written,
 * and only when the text it was composed against is still the text on disk -
 * `baseSha` is checked against the record's current oldValue, so a decision
 * made before a chapter was edited is refused rather than applied blind.
 */
function targetValue(unit) {
  const d = unit.record.reviewDecision;
  if (!d?.resolvedValue) return { ok: true, value: unit.newValue };
  if (unit.multiParagraph) {
    return {
      ok: false,
      reason: "a review decision resolves one string, but this record writes two paragraphs - re-review it as a whole",
    };
  }
  if (d.baseSha && d.baseSha !== sha16(unit.oldValue)) {
    return {
      ok: false,
      reason: `review decision was made against different text (baseSha ${d.baseSha}) - re-review this record`,
    };
  }
  return { ok: true, value: d.resolvedValue };
}

/** One patch per (file, jsonPath), composing multi-unit groups or refusing. */
function composeGroup(units) {
  const first = units[0];
  if (units.length === 1) {
    const t = targetValue(first);
    if (!t.ok) return { ok: false, reason: t.reason, units };
    return { ok: true, oldValue: first.oldValue, newValue: t.value, units };
  }
  const oldValue = first.oldValue;
  for (const u of units) {
    if (u.oldValue !== oldValue) {
      return { ok: false, reason: "records targeting one string disagree about its current value", units };
    }
  }
  const targets = units.map((u) => ({ u, t: targetValue(u) }));
  const badTarget = targets.find((x) => !x.t.ok);
  if (badTarget) return { ok: false, reason: badTarget.t.reason, units };
  const ranges = targets.map(({ u, t }) => ({ u, target: t.value, ...editRange(oldValue, t.value) })).sort((x, y) => x.start - y.start);
  for (let i = 1; i < ranges.length; i++) {
    if (ranges[i].start < ranges[i - 1].end) {
      return { ok: false, reason: "edit ranges overlap - cannot compose without guessing precedence", units };
    }
  }
  let out = "";
  let cursor = 0;
  for (const rg of ranges) {
    out += oldValue.slice(cursor, rg.start) + rg.replacement;
    cursor = rg.end;
  }
  out += oldValue.slice(cursor);

  // Each record's own change must survive composition intact.
  for (const rg of ranges) {
    const solo = oldValue.slice(0, rg.start) + rg.replacement + oldValue.slice(rg.end);
    if (solo !== rg.target) {
      return { ok: false, reason: `composition would alter ${rg.u.record.id}'s own patch`, units };
    }
  }
  return { ok: true, oldValue, newValue: out, units };
}

const byFile = new Map();
for (const r of selected) {
  const file = `${r.bookKey}-${r.chapter}.json`;
  if (!byFile.has(file)) byFile.set(file, new Map());
  const paths = byFile.get(file);
  for (const unit of patchUnits(r)) {
    const key = JSON.stringify(unit.jsonPath);
    if (!paths.has(key)) paths.set(key, []);
    paths.get(key).push(unit);
  }
}

// ---------------------------------------------------------------------
// Per-file structural invariants (the plan's Phase 3 pre-write checks)
// ---------------------------------------------------------------------

/** Whole `<sup …>` tags carrying a verse id, in order. Matching the WHOLE tag
 *  rather than a fixed attribute order is deliberate: `<sup class="vn" id="v3">`
 *  validates fine but is invisible to search, the API, and alignment, so an
 *  attribute reorder has to fail here. */
function verseMarkerTags(parsed) {
  return (parsed.paragraphs || []).flatMap((p) => p.match(/<sup\b[^>]*\bid="v\d+"[^>]*>/g) || []);
}

/** Every footnote anchor id in paragraph order. Hazard 2's backstop. */
function anchorIds(parsed) {
  return (parsed.paragraphs || []).flatMap((p) => p.match(/id="fnref-[^"]+"/g) || []);
}

function footnoteTriples(parsed) {
  return (parsed.footnotes || []).map((f) => `${f.id}|${f.refId}|${f.label}`);
}

/**
 * Opens-minus-closes for the block tags in each paragraph.
 *
 * The backstop for hazard 3: a verse that is the LAST in its paragraph owns
 * the string to its end, so a restore rebuilt from master text - which has no
 * markup at all - silently takes the `</p>` with it. 59 paragraphs reached
 * production that way before anything noticed, because a browser closes a
 * dangling `<p>` at the next block element and the page looks almost right.
 * This is a per-paragraph DELTA rather than an absolute check so it reports
 * the damage a run introduces without failing on damage already on disk.
 */
function blockBalance(parsed) {
  return (parsed.paragraphs || [])
    .map(blockDelta)
    .join(",");
}

// Verse markers with nothing separating them from the preceding text. The
// master has no separator to contribute (it has no marker to separate from),
// so a restore composed from master text silently eats the repo's - see
// splitTrailingSeparator. Same failure class as blockBalance, and it shipped
// undetected for the same reason: the page still renders, just wrong.
function unseparatedMarkers(parsed) {
  return findUnseparatedVerseMarkers(parsed.paragraphs || [])
    .map((h) => `${h.paragraphIndex}:v${h.verse}`)
    .join(" ");
}

function structuralFingerprint(parsed) {
  return {
    topLevelKeys: Object.keys(parsed).join(","),
    paragraphCount: (parsed.paragraphs || []).length,
    verseMarkers: verseMarkerTags(parsed).join(" "),
    anchors: anchorIds(parsed).join(" "),
    footnotes: footnoteTriples(parsed).join(" "),
    blockBalance: blockBalance(parsed),
    unseparatedMarkers: unseparatedMarkers(parsed),
    indexed: `${Object.hasOwn(parsed, "indexed")}:${JSON.stringify(parsed.indexed)}`,
  };
}

function compareFingerprints(before, after) {
  const problems = [];
  for (const key of Object.keys(before)) {
    if (before[key] === after[key]) continue;
    if (key === "anchors") {
      const b = before[key].split(" ").filter(Boolean);
      const a = after[key].split(" ").filter(Boolean);
      const lost = b.filter((x) => !a.includes(x));
      problems.push(
        `footnote anchors changed (${b.length} -> ${a.length}${lost.length ? `, lost ${lost.join(", ")}` : ""}) ` +
          `- a footnote with no anchor is unreachable to readers and validate-chapters.mjs does not check this direction`,
      );
      continue;
    }
    if (key === "blockBalance") {
      const b = before[key].split(",");
      const a = after[key].split(",");
      const moved = a.map((v, i) => (v === b[i] ? null : `paragraphs[${i}] ${b[i]} -> ${v}`)).filter(Boolean);
      problems.push(
        `block-tag balance changed (${moved.join("; ")}) - a restore rebuilt from master text has taken a paragraph's own closing tag with it`,
      );
      continue;
    }
    if (key === "unseparatedMarkers") {
      const b = new Set(before[key].split(" ").filter(Boolean));
      const gained = after[key].split(" ").filter(Boolean).filter((x) => !b.has(x));
      if (gained.length === 0) continue; // only lost some - a repair, not damage
      problems.push(
        `verse marker(s) lost the whitespace separating them from the preceding text (${gained.join(", ")}) ` +
          `- the number would render glued to the previous sentence; no CSS supplies that gap. ` +
          `A decision made in the review tool BEFORE splitTrailingSeparator landed has the loss baked into its ` +
          `resolvedValue, so re-review the record or run repair-verse-separators.mjs after applying it`,
      );
      continue;
    }
    problems.push(`${key} changed`);
  }
  return problems;
}

// ---------------------------------------------------------------------
// Apply
// ---------------------------------------------------------------------

let filesChanged = 0;
let recordsApplied = 0;
const refused = [];

for (const [file, paths] of [...byFile].sort(([a], [b]) => a.localeCompare(b))) {
  const full = path.join(CHAPTERS_DIR, file);
  const originalRaw = readFileSync(full, "utf8");
  const before = structuralFingerprint(JSON.parse(originalRaw));

  let raw = originalRaw;
  let fileFailed = null;
  const appliedIds = new Set();
  const refusedIds = new Set();

  for (const [key, units] of paths) {
    const ids = units.map((u) => u.record.id);
    const group = composeGroup(units);
    if (!group.ok) {
      refused.push({ file, key, reason: group.reason, ids });
      for (const id of ids) refusedIds.add(id);
      continue;
    }
    try {
      raw = spliceValue(raw, JSON.parse(key), group.oldValue, group.newValue);
      for (const id of ids) appliedIds.add(id);
    } catch (e) {
      fileFailed = `${ids.join(", ")}: ${e.message}`;
      break;
    }
  }

  if (fileFailed) {
    refused.push({ file, reason: fileFailed, ids: [] });
    continue; // originalRaw never written - this file is left exactly as it was
  }

  // A record that writes two paragraphs must land whole. If one of its units
  // was refused while another spliced cleanly, the in-memory `raw` now holds
  // half a verse - so the whole file is refused rather than written.
  const partial = [...appliedIds].filter((id) => refusedIds.has(id));
  if (partial.length) {
    refused.push({
      file,
      reason: `multi-paragraph record(s) would land only partly, so nothing in this file was written`,
      ids: partial,
    });
    continue;
  }
  if (appliedIds.size === 0) continue;

  const problems = compareFingerprints(before, structuralFingerprint(JSON.parse(raw)));
  if (problems.length) {
    refused.push({ file, reason: `structural invariant failed: ${problems.join("; ")}`, ids: [...appliedIds] });
    continue;
  }

  if (WRITE) writeFileSync(full, raw, "utf8");
  filesChanged++;
  recordsApplied += appliedIds.size;
}

// ---------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------

const filters = [
  WANT_DECISION ? `decision=${WANT_DECISION}` : `bucket=${WANT_BUCKET}`,
  WANT_KIND ? `kind=${WANT_KIND}` : null,
  WANT_SUBCLASS ? `subclass=${WANT_SUBCLASS}` : null,
  WANT_BOOK ? `book=${WANT_BOOK}` : null,
].filter(Boolean);

console.log(`${WRITE ? "APPLIED" : "DRY RUN"} (${filters.join(" ")})`);
console.log(`  records selected : ${selected.length}`);
console.log(`  records applied  : ${recordsApplied}`);
console.log(`  files changed    : ${filesChanged}`);
console.log(`  refused          : ${refused.length}`);
for (const r of refused) {
  console.log(`    ${r.file} ${r.ids.length ? `[${r.ids.join(", ")}] ` : ""}- ${r.reason}`);
}
if (!WRITE) console.log("\nNothing was written. Re-run with --write to apply.");
process.exit(refused.length ? 1 : 0);
