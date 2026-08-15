#!/usr/bin/env node
// Byte-level verification of what the restore actually changed, against a
// baseline ref (default `main`).
//
// This is the check validate-chapters.mjs cannot do. The validator answers
// "is this file well-formed and self-consistent"; it would pass just as
// happily if a reserialize had rewritten all 260 files, or if a restore had
// quietly dropped a footnote anchor. What matters here is the opposite
// question: did anything change that we did not intend to change?
//
// Per file, compares the baseline blob to the working tree and asserts:
//   1. Only string values changed - no key added, removed, reordered, or
//      retyped anywhere in the document.
//   2. Every changed path is a restore target: paragraphs[i] or
//      footnotes[i].html. Nothing else in a chapter is ours to touch.
//   3. The structural fingerprint is identical: paragraph count, the ordered
//      verse-marker tags (whole tags, so an attribute reorder fails),
//      the ordered footnote anchors, every footnote {id,refId,label} triple,
//      and `indexed`.
//   4. Formatting is preserved byte-for-byte outside the changed spans -
//      indentation, escaping style, BOM, trailing newline. A whole-file
//      reserialize moves every SHA-256 in the API manifest and forces every
//      app install to re-download a file whose content never changed, so
//      this is the assertion that keeps the restore invisible to sync.
//
// Usage: node scripts/reconcile/verify-bytes.mjs [--base=main]
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "../..");

function argValue(flag, fallback) {
  const pref = `--${flag}=`;
  const found = process.argv.find((a) => a.startsWith(pref));
  return found ? found.slice(pref.length) : fallback;
}
const BASE = argValue("base", "main");

function git(args) {
  return execFileSync("git", args, { cwd: REPO_ROOT, encoding: "utf8", maxBuffer: 1024 * 1024 * 256 });
}

const changed = git(["diff", "--name-only", BASE, "--", "src/data/chapters/"]).trim().split("\n").filter(Boolean);

const outside = git(["diff", "--name-only", BASE]).trim().split("\n").filter(Boolean)
  .filter((f) => !f.startsWith("src/data/chapters/"));

/** Every leaf path where two parsed documents differ, plus any structural change. */
function diffPaths(a, b, prefix = [], out = []) {
  const ta = Array.isArray(a) ? "array" : a === null ? "null" : typeof a;
  const tb = Array.isArray(b) ? "array" : b === null ? "null" : typeof b;
  if (ta !== tb) {
    out.push({ path: prefix, kind: "type changed" });
    return out;
  }
  if (ta === "array") {
    if (a.length !== b.length) out.push({ path: prefix, kind: `array length ${a.length} -> ${b.length}` });
    for (let i = 0; i < Math.min(a.length, b.length); i++) diffPaths(a[i], b[i], [...prefix, i], out);
    return out;
  }
  if (ta === "object") {
    const ka = Object.keys(a);
    const kb = Object.keys(b);
    if (ka.join(",") !== kb.join(",")) out.push({ path: prefix, kind: `keys ${ka.join(",")} -> ${kb.join(",")}` });
    for (const k of ka) {
      if (!Object.hasOwn(b, k)) continue;
      diffPaths(a[k], b[k], [...prefix, k], out);
    }
    return out;
  }
  if (a !== b) out.push({ path: prefix, kind: ta === "string" ? "string value" : "scalar value" });
  return out;
}

function isRestoreTarget(p) {
  if (p.length === 2 && p[0] === "paragraphs" && typeof p[1] === "number") return true;
  if (p.length === 3 && p[0] === "footnotes" && typeof p[1] === "number" && p[2] === "html") return true;
  return false;
}

function fingerprint(parsed) {
  const paras = parsed.paragraphs || [];
  return {
    topLevelKeys: Object.keys(parsed).join(","),
    paragraphCount: paras.length,
    verseMarkers: paras.flatMap((p) => p.match(/<sup\b[^>]*\bid="v\d+"[^>]*>/g) || []).join(" "),
    anchors: paras.flatMap((p) => p.match(/id="fnref-[^"]+"/g) || []).join(" "),
    footnotes: (parsed.footnotes || []).map((f) => `${f.id}|${f.refId}|${f.label}`).join(" "),
    indexed: `${Object.hasOwn(parsed, "indexed")}:${JSON.stringify(parsed.indexed)}`,
  };
}

/** The file with every JSON string value blanked, so what remains is purely
 *  formatting: indentation, punctuation, key order, BOM, trailing newline.
 *  Identical before and after means nothing but string contents moved. */
function formattingSkeleton(raw) {
  let out = "";
  let i = 0;
  while (i < raw.length) {
    const c = raw[i];
    if (c !== '"') {
      out += c;
      i++;
      continue;
    }
    let j = i + 1;
    while (j < raw.length) {
      if (raw[j] === "\\") j += 2;
      else if (raw[j] === '"') break;
      else j++;
    }
    out += '""';
    i = j + 1;
  }
  return out;
}

const problems = [];
let stringChanges = 0;
let hashesMoved = 0;

for (const file of changed) {
  const baseRaw = git(["show", `${BASE}:${file}`]);
  const nowRaw = readFileSync(path.join(REPO_ROOT, file), "utf8");
  if (baseRaw === nowRaw) continue;
  hashesMoved++;

  const baseJson = JSON.parse(baseRaw);
  const nowJson = JSON.parse(nowRaw);

  const diffs = diffPaths(baseJson, nowJson);
  for (const d of diffs) {
    if (d.kind === "string value" && isRestoreTarget(d.path)) {
      stringChanges++;
      continue;
    }
    problems.push(`${file}: ${d.kind} at ${JSON.stringify(d.path)}`);
  }

  const fb = fingerprint(baseJson);
  const fn = fingerprint(nowJson);
  for (const k of Object.keys(fb)) {
    if (fb[k] !== fn[k]) problems.push(`${file}: structural fingerprint '${k}' changed`);
  }

  const sb = formattingSkeleton(baseRaw);
  const sn = formattingSkeleton(nowRaw);
  if (sb !== sn) {
    problems.push(
      `${file}: formatting changed outside string values (indentation/escaping/BOM/newline) - ` +
        `this is the reserialize signature; it would move every manifest hash`,
    );
  }
}

const totalChapters = git(["ls-files", "src/data/chapters/"]).trim().split("\n").filter(Boolean).length;

console.log(`Baseline: ${BASE}`);
console.log(`  chapter files changed : ${hashesMoved} of ${totalChapters}`);
console.log(`  string values changed : ${stringChanges}`);
console.log(`  non-chapter files changed: ${outside.length}${outside.length ? ` (${outside.join(", ")})` : ""}`);
console.log(`  manifest hashes that will move: ${hashesMoved}`);

if (problems.length) {
  console.log(`\nFAIL - ${problems.length} problem(s):`);
  for (const p of problems.slice(0, 40)) console.log(`  ${p}`);
  if (problems.length > 40) console.log(`  … and ${problems.length - 40} more`);
  process.exit(1);
}
console.log("\nPASS - only paragraph/footnote string values changed; structure and formatting byte-identical.");
