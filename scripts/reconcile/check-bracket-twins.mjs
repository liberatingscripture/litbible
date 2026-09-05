#!/usr/bin/env node
// Bracketed passages print the SAME footnote at both ends, and the two copies
// must stay byte-identical.
//
// CLAUDE.md states the rule - "both markers carry the same footnote text, so a
// reader who meets either end gets the whole explanation... they must be edited
// together" - and until this script nothing enforced it. `validate-chapters.mjs`
// checks that every anchor has a footnote, never that a pair still agrees, so a
// split pair validates clean and ships: one end of John 7:53-8:11 explaining the
// manuscript evidence and the other end carrying the previous wording.
//
// The reconciliation made that a live hazard rather than a theoretical one. The
// ledger pairs each repo footnote with its master counterpart, and the master
// prints the note ONCE - so of romans-16 fn-o and fn-r, only fn-o gets a patch
// and fn-r lands in bucket D with nothing to apply. Approving fn-o in the review
// tool and applying it would have split the doxology pair silently. That is the
// case this exists for.
//
// A "twin set" is found by content, not by position: footnotes in one chapter
// whose html is byte-identical. That is exactly the invariant, and it needs no
// register of which chapters have brackets (the six in CLAUDE.md today, more
// later) and no parsing of where a passage starts.
//
// KNOWN GAP: it compares within one chapter, so it sees five sets - mark-16
// (e/m), john-9 (q/r), john-11 (w/z) and romans-16 twice (m/n, o/r) - and is
// blind to the sixth, john-7 fn-ff paired with john-8 fn-k across the chapter
// boundary. Closing that means keeping the pair register this deliberately
// avoids, so for now it is a documented blind spot: edit that pair by hand and
// check it by eye.
//
// Usage:
//   node scripts/reconcile/check-bracket-twins.mjs            # report, exit 1 if split
//   node scripts/reconcile/check-bracket-twins.mjs --fix      # propagate, needs --from
//   node scripts/reconcile/check-bracket-twins.mjs --fix --from=romans-16-fn-o
//
// --fix is deliberately narrow: it copies ONE named footnote's html onto the
// others in its set. It will not guess which end is current, because that is an
// editorial fact about which one someone just edited.
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { spliceValue } from "./lib/json-splice.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CHAPTERS_DIR = path.resolve(__dirname, "../../src/data/chapters");

function argValue(flag, fallback) {
  const pref = `--${flag}=`;
  const found = process.argv.find((a) => a.startsWith(pref));
  return found ? found.slice(pref.length) : fallback;
}
const FIX = process.argv.includes("--fix");
const FROM = argValue("from", null);

// The markers are literal characters in the paragraph HTML, not markup.
const OPEN = String.fromCodePoint(0x27e6); // ⟦
const CLOSE = String.fromCodePoint(0x27e7); // ⟧

/**
 * Every bracket marker in a chapter, in reading order, with the footnote label
 * it carries. A marker is always followed immediately by its fn-ref anchor.
 *
 * Pairing by MARKER STRUCTURE rather than by text similarity is the whole
 * point. An earlier version grouped footnotes by identical html and guessed
 * that two lone notes sharing their opening words were a drifted pair - which
 * misses exactly the case that matters, because a pair drifts precisely when
 * one side's wording has changed. The open/close sequence is the real
 * invariant and says nothing about the text.
 */
function markers(chapter) {
  const found = [];
  const anchor = /<sup class="fn-ref"><a id="fnref-([^"]+)"/g;
  const paragraphs = chapter.paragraphs ?? [];
  for (let pi = 0; pi < paragraphs.length; pi++) {
    const p = paragraphs[pi];
    for (const [marker, type] of [
      [OPEN, "open"],
      [CLOSE, "close"],
    ]) {
      let at = 0;
      for (;;) {
        const i = p.indexOf(marker, at);
        if (i < 0) break;
        at = i + marker.length;
        anchor.lastIndex = at;
        const m = anchor.exec(p);
        // The anchor sits immediately after the marker, allowing only the space
        // the closing form carries.
        if (m && m.index <= at + 1) found.push({ type, label: m[1], pi, at: i });
      }
    }
  }
  // Reading order across the whole chapter, not within one paragraph.
  return found.sort((a, b) => a.pi - b.pi || a.at - b.at);
}

const files = readdirSync(CHAPTERS_DIR).filter((f) => f.endsWith(".json")).sort();
const split = [];
const unmatched = [];
let sets = 0;

for (const file of files) {
  const raw = readFileSync(path.join(CHAPTERS_DIR, file), "utf8");
  const chapter = JSON.parse(raw);
  const notes = chapter.footnotes ?? [];
  if (notes.length === 0) continue;

  const found = markers(chapter);
  if (found.length === 0) continue;

  // Match openings to closings as a stack, so a chapter holding several
  // passages pairs each one correctly. Leftovers are the cross-chapter case.
  const stack = [];
  const pairs = [];
  for (const mk of found) {
    if (mk.type === "open") stack.push(mk);
    else if (stack.length) pairs.push([stack.pop(), mk]);
    else unmatched.push({ bookKey: chapter.bookKey, chapter: chapter.chapter, label: mk.label, type: "close" });
  }
  for (const leftover of stack) {
    unmatched.push({ bookKey: chapter.bookKey, chapter: chapter.chapter, label: leftover.label, type: "open" });
  }

  const htmlOf = (label) => notes.find((f) => f.label === label)?.html;
  for (const [open, close] of pairs) {
    sets++;
    const a = htmlOf(open.label);
    const b = htmlOf(close.label);
    if (a === b) continue;
    split.push({
      file,
      bookKey: chapter.bookKey,
      chapter: chapter.chapter,
      labels: [open.label, close.label],
      texts: [a ?? "(no such footnote)", b ?? "(no such footnote)"],
    });
  }
}

// An unmatched marker is the documented cross-chapter case (john-7 fn-ff opens
// what john-8 fn-k closes), so it is reported and not failed on. Two of them is
// the expected count; more than that means a marker lost its anchor.
if (unmatched.length) {
  console.log(`Unmatched markers (cross-chapter passages, checked by hand): ${unmatched.length}`);
  for (const u of unmatched) console.log(`  ${u.bookKey} ${u.chapter} fn-${u.label} (${u.type})`);
  console.log("");
}

if (split.length === 0) {
  console.log(`Bracketed footnote pairs: ${sets} set(s) checked, all byte-identical.`);
  process.exit(0);
}

console.error(`SPLIT PAIR(S): ${split.length}`);
for (const s of split) {
  console.error(`\n  ${s.bookKey} ${s.chapter} — fn-${s.labels[0]} and fn-${s.labels[1]} have drifted apart`);
  for (let i = 0; i < 2; i++) {
    console.error(`    fn-${s.labels[i]}: ${JSON.stringify(s.texts[i]).slice(0, 120)}`);
  }
}

if (!FIX) {
  console.error(`\nRe-run with --fix --from=<bookKey>-<chapter>-fn-<label> to propagate one of them.`);
  process.exit(1);
}

if (!FROM) {
  console.error(`\n--fix needs --from=<bookKey>-<chapter>-fn-<label>: which end is current is an editorial fact.`);
  process.exit(1);
}

const m = FROM.match(/^(.+)-(\d+)-fn-(.+)$/);
if (!m) {
  console.error(`--from must look like romans-16-fn-o, got ${FROM}`);
  process.exit(1);
}
const [, bookKey, chapterNo, fromLabel] = m;
const target = split.find(
  (s) => s.bookKey === bookKey && String(s.chapter) === chapterNo && s.labels.includes(fromLabel),
);
if (!target) {
  console.error(`${FROM} is not one of the split pairs above.`);
  process.exit(1);
}

const file = path.join(CHAPTERS_DIR, target.file);
let raw = readFileSync(file, "utf8");
const chapter = JSON.parse(raw);
const source = chapter.footnotes.find((f) => f.label === fromLabel);
const others = target.labels.filter((l) => l !== fromLabel);

for (const label of others) {
  const index = chapter.footnotes.findIndex((f) => f.label === label);
  // Same splice path as apply.mjs: a byte-level replacement of one string
  // value, never a reserialize - the manifest hashes chapter files by raw bytes.
  raw = spliceValue(raw, ["footnotes", index, "html"], chapter.footnotes[index].html, source.html);
  console.log(`  fn-${label} <- fn-${fromLabel}`);
}
writeFileSync(file, raw, "utf8");
console.log(`\nWrote ${target.file}. Re-run without --fix to confirm.`);
