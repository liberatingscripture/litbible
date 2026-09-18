#!/usr/bin/env node
// A bracketed passage carries ONE note, at the span's last marker on the page
// the reader is looking at.
//
// CLAUDE.md states the rule: one note per reading surface. A span that opens and
// closes in the same chapter is one surface, so its note hangs off the closing
// marker and the opening bracket carries nothing. A span that crosses a chapter
// boundary occupies two surfaces - a reader on the second chapter never sees the
// opening bracket - so each chapter carries its own copy, and those two copies
// must stay byte-identical.
//
// That is the whole of what this checks, and each half has already failed in
// practice. `validate-chapters.mjs` proves every anchor HAS a footnote, never
// that a span still has one or that a pair still agrees, so both defects
// validate clean and ship.
//
// The reconciliation made the pair half a live hazard rather than a theoretical
// one: the ledger pairs each repo footnote with its master counterpart, and the
// master prints the note once, so only one end of a pair gets a patch and the
// other lands in bucket D with nothing to apply. Approving and applying one end
// would split the pair silently.
//
// Until 2026-09 this compared byte-identical footnotes WITHIN one chapter, which
// left the cross-chapter pair (john-7 fn-ff / john-8 fn-k) a documented blind
// spot. Under the one-note rule that pair is the only duplicate left in the
// corpus, so the blind spot would have been the entire job. Cross-chapter spans
// are now paired by POSITION - an unmatched open in chapter N against an
// unmatched close in chapter N+1 of the same book - which closes the gap without
// the hand-kept register of bracketed chapters the old version avoided.
//
// Usage:
//   node scripts/reconcile/check-bracket-twins.mjs            # report, exit 1 if wrong
//   node scripts/reconcile/check-bracket-twins.mjs --fix --from=john-7-fn-ff
//
// --fix is deliberately narrow: it copies ONE named footnote's html onto the
// other end of its cross-chapter pair. It will not guess which end is current,
// because that is an editorial fact about which one someone just edited.
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
 * Every bracket marker in a chapter, in reading order, tagged with the footnote
 * label it carries or null when it carries none.
 *
 * Pairing by MARKER STRUCTURE rather than by text similarity is the whole point.
 * An earlier version grouped footnotes by identical html and guessed that two
 * lone notes sharing their opening words were a drifted pair - which misses
 * exactly the case that matters, because a pair drifts precisely when one side's
 * wording has changed. The open/close sequence is the real invariant and says
 * nothing about the text.
 *
 * A marker WITHOUT an anchor used to be skipped silently, which is how a
 * deviation could quietly file itself under "cross-chapter, checked by hand"
 * instead of being reported. Under the one-note rule a bare opening marker is
 * the normal case, so it is recorded as data and judged below.
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
        // An anchor counts as this marker's only if it sits immediately after
        // it, allowing the single space a marker may carry.
        found.push({ type, label: m && m.index <= at + 1 ? m[1] : null, pi, at: i });
      }
    }
  }
  // Reading order across the whole chapter, not within one paragraph.
  return found.sort((a, b) => a.pi - b.pi || a.at - b.at);
}

const files = readdirSync(CHAPTERS_DIR).filter((f) => f.endsWith(".json")).sort();
const problems = [];
const dangling = [];
let spans = 0;

for (const file of files) {
  const raw = readFileSync(path.join(CHAPTERS_DIR, file), "utf8");
  const chapter = JSON.parse(raw);
  const found = markers(chapter);
  if (found.length === 0) continue;

  const notes = chapter.footnotes ?? [];
  const htmlOf = (label) => notes.find((f) => f.label === label)?.html;
  const where = `${chapter.bookKey} ${chapter.chapter}`;

  // Stack-match, so a chapter holding several passages pairs each correctly.
  const stack = [];
  const pairs = [];
  for (const mk of found) {
    if (mk.type === "open") stack.push(mk);
    else if (stack.length) pairs.push([stack.pop(), mk]);
    else dangling.push({ file, bookKey: chapter.bookKey, chapter: chapter.chapter, mk, htmlOf });
  }
  for (const leftover of stack) {
    dangling.push({ file, bookKey: chapter.bookKey, chapter: chapter.chapter, mk: leftover, htmlOf });
  }

  for (const [open, close] of pairs) {
    spans++;
    if (close.label === null) {
      problems.push(`${where}: a span closes with no note on its closing marker`);
    } else if (htmlOf(close.label) === undefined) {
      problems.push(`${where}: closing marker points at fn-${close.label}, which does not exist`);
    }
    if (open.label !== null) {
      problems.push(
        `${where}: opening marker still carries fn-${open.label} - a span inside one chapter keeps its note at the close only`,
      );
    }
  }
}

// Cross-chapter spans: an unmatched open in chapter N pairs with an unmatched
// close in chapter N+1 of the same book. Position, not a hand-kept register.
const splits = [];
const opens = dangling.filter((d) => d.mk.type === "open");
const closes = dangling.filter((d) => d.mk.type === "close");
const usedClose = new Set();

for (const o of opens) {
  const c = closes.find(
    (x) => !usedClose.has(x) && x.bookKey === o.bookKey && x.chapter === o.chapter + 1,
  );
  if (!c) {
    problems.push(
      `${o.bookKey} ${o.chapter}: an opening bracket has no closing bracket, here or in the next chapter`,
    );
    continue;
  }
  usedClose.add(c);
  spans++;
  if (o.mk.label === null || c.mk.label === null) {
    problems.push(
      `${o.bookKey} ${o.chapter}-${c.chapter}: a span crossing a chapter boundary needs its note in BOTH chapters`,
    );
    continue;
  }
  const a = o.htmlOf(o.mk.label);
  const b = c.htmlOf(c.mk.label);
  if (a !== b) {
    splits.push({
      ends: [
        { file: o.file, bookKey: o.bookKey, chapter: o.chapter, label: o.mk.label, html: a },
        { file: c.file, bookKey: c.bookKey, chapter: c.chapter, label: c.mk.label, html: b },
      ],
    });
  }
}
for (const c of closes) {
  if (!usedClose.has(c)) {
    problems.push(`${c.bookKey} ${c.chapter}: a closing bracket has no opening bracket`);
  }
}

for (const p of problems) console.error(`CONVENTION: ${p}`);

if (splits.length === 0 && problems.length === 0) {
  console.log(`Bracketed passages: ${spans} span(s) checked, each carrying one note per chapter.`);
  process.exit(0);
}

for (const s of splits) {
  const [x, y] = s.ends;
  console.error(
    `\nSPLIT PAIR: ${x.bookKey} ${x.chapter} fn-${x.label} and ${y.bookKey} ${y.chapter} fn-${y.label} have drifted apart`,
  );
  for (const e of s.ends) {
    console.error(
      `    ${e.bookKey}-${e.chapter} fn-${e.label}: ${JSON.stringify(e.html ?? "(no such footnote)").slice(0, 120)}`,
    );
  }
}

if (!FIX) {
  if (splits.length) {
    console.error(`\nRe-run with --fix --from=<bookKey>-<chapter>-fn-<label> to propagate one of them.`);
  }
  process.exit(1);
}
if (!FROM) {
  console.error(`\n--fix needs --from=<bookKey>-<chapter>-fn-<label>: which end is current is an editorial fact.`);
  process.exit(1);
}
const m = FROM.match(/^(.+)-(\d+)-fn-(.+)$/);
if (!m) {
  console.error(`--from must look like john-7-fn-ff, got ${FROM}`);
  process.exit(1);
}
const [, bookKey, chapterNo, fromLabel] = m;
const target = splits.find((s) =>
  s.ends.some((e) => e.bookKey === bookKey && String(e.chapter) === chapterNo && e.label === fromLabel),
);
if (!target) {
  console.error(`${FROM} is not one end of a split pair above.`);
  process.exit(1);
}
const source = target.ends.find((e) => e.label === fromLabel && String(e.chapter) === chapterNo);
for (const e of target.ends) {
  if (e === source) continue;
  const file = path.join(CHAPTERS_DIR, e.file);
  let raw = readFileSync(file, "utf8");
  const chapter = JSON.parse(raw);
  const index = chapter.footnotes.findIndex((f) => f.label === e.label);
  // Same splice path as apply.mjs: a byte-level replacement of one string value,
  // never a reserialize - the manifest hashes chapter files by raw bytes.
  raw = spliceValue(raw, ["footnotes", index, "html"], chapter.footnotes[index].html, source.html);
  writeFileSync(file, raw, "utf8");
  console.log(`  ${e.bookKey}-${e.chapter} fn-${e.label} <- ${source.bookKey}-${source.chapter} fn-${source.label}`);
}
console.log(`\nWrote. Re-run without --fix to confirm.`);
