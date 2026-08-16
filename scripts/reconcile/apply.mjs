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
    (WANT_DECISION == null ? r.bucket === WANT_BUCKET : r.decision === WANT_DECISION) &&
    !r.forceHandReview &&
    r.patch?.newValue != null &&
    r.patch?.oldValue != null &&
    Array.isArray(r.jsonPath) &&
    (WANT_KIND == null || r.kind === WANT_KIND) &&
    (WANT_SUBCLASS == null || r.subclass === WANT_SUBCLASS) &&
    (WANT_BOOK == null || r.bookKey === WANT_BOOK),
);

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
 * The value to write for one record.
 *
 * A record reviewed hunk-by-hunk in the review tool carries a `resolvedValue`:
 * the master's text where the reviewer took it and the repo's where they kept
 * it, which is neither side's whole string. That value is what gets written,
 * and only when the text it was composed against is still the text on disk -
 * `baseSha` is checked against the record's current oldValue, so a decision
 * made before a chapter was edited is refused rather than applied blind.
 */
function targetValue(record) {
  const d = record.reviewDecision;
  if (!d?.resolvedValue) return { ok: true, value: record.patch.newValue };
  if (d.baseSha && d.baseSha !== sha16(record.patch.oldValue)) {
    return {
      ok: false,
      reason: `review decision was made against different text (baseSha ${d.baseSha}) - re-review this record`,
    };
  }
  return { ok: true, value: d.resolvedValue };
}

/** One patch per (file, jsonPath), composing multi-record groups or refusing. */
function composeGroup(records) {
  const first = records[0];
  if (records.length === 1) {
    const t = targetValue(first);
    if (!t.ok) return { ok: false, reason: t.reason, records };
    return { ok: true, oldValue: first.patch.oldValue, newValue: t.value, records };
  }
  const oldValue = first.patch.oldValue;
  for (const r of records) {
    if (r.patch.oldValue !== oldValue) {
      return { ok: false, reason: "records targeting one string disagree about its current value", records };
    }
  }
  const targets = records.map((r) => ({ r, t: targetValue(r) }));
  const badTarget = targets.find((x) => !x.t.ok);
  if (badTarget) return { ok: false, reason: badTarget.t.reason, records };
  const ranges = targets.map(({ r, t }) => ({ r, target: t.value, ...editRange(oldValue, t.value) })).sort((x, y) => x.start - y.start);
  for (let i = 1; i < ranges.length; i++) {
    if (ranges[i].start < ranges[i - 1].end) {
      return { ok: false, reason: "edit ranges overlap - cannot compose without guessing precedence", records };
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
      return { ok: false, reason: `composition would alter ${rg.r.id}'s own patch`, records };
    }
  }
  return { ok: true, oldValue, newValue: out, records };
}

const byFile = new Map();
for (const r of selected) {
  const file = `${r.bookKey}-${r.chapter}.json`;
  if (!byFile.has(file)) byFile.set(file, new Map());
  const key = JSON.stringify(r.jsonPath);
  const paths = byFile.get(file);
  if (!paths.has(key)) paths.set(key, []);
  paths.get(key).push(r);
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

function structuralFingerprint(parsed) {
  return {
    topLevelKeys: Object.keys(parsed).join(","),
    paragraphCount: (parsed.paragraphs || []).length,
    verseMarkers: verseMarkerTags(parsed).join(" "),
    anchors: anchorIds(parsed).join(" "),
    footnotes: footnoteTriples(parsed).join(" "),
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
  let appliedHere = 0;
  let fileFailed = null;

  for (const [key, records] of paths) {
    const group = composeGroup(records);
    if (!group.ok) {
      refused.push({ file, key, reason: group.reason, ids: records.map((r) => r.id) });
      continue;
    }
    try {
      raw = spliceValue(raw, JSON.parse(key), group.oldValue, group.newValue);
      appliedHere += records.length;
    } catch (e) {
      fileFailed = `${records.map((r) => r.id).join(", ")}: ${e.message}`;
      break;
    }
  }

  if (fileFailed) {
    refused.push({ file, reason: fileFailed, ids: [] });
    continue; // originalRaw never written - this file is left exactly as it was
  }
  if (appliedHere === 0) continue;

  const problems = compareFingerprints(before, structuralFingerprint(JSON.parse(raw)));
  if (problems.length) {
    refused.push({ file, reason: `structural invariant failed: ${problems.join("; ")}`, ids: [...paths.values()].flat().map((r) => r.id) });
    continue;
  }

  if (WRITE) writeFileSync(full, raw, "utf8");
  filesChanged++;
  recordsApplied += appliedHere;
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
