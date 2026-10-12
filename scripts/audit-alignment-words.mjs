// Re-checks every stored word-alignment record (src/data/alignment-words/)
// against the English and the Greek as they are NOW.
//
//   npm run audit:words [-- --chapters-dir <dir> --out-dir <dir>]
//
// Run it after any change to scripture, the same habit as audit:alignment for
// the glossary records: a record is a decision about specific words, and
// revising the translation (or moving to a newer SBLGNT) can leave it pointing
// at words that are no longer there. Nothing else in the pipeline notices.
// Deliberately NOT in CI, the pre-commit hook or `npm run build`: a finding is
// an editorial prompt, not a gate. Exits 1 when anything is stale, purely so
// it can be chained.
//
// It only reports. Repair happens in the review tool (`npm run review:words`),
// where each stale record offers Re-link (its still-good Greek comes back
// selected, and you choose the new English) or Discard. A record is never
// deleted for you, since the decision it holds is the translator's.

import path from "node:path";
import { createStore } from "./alignment-words/store.mjs";

function argValue(name) {
  const args = process.argv.slice(2);
  for (let i = 0; i < args.length; i++) {
    if (args[i] === `--${name}` && args[i + 1]) return path.resolve(args[i + 1]);
    if (args[i].startsWith(`--${name}=`)) return path.resolve(args[i].slice(name.length + 3));
  }
  return undefined;
}

let store;
try {
  store = await createStore({
    ...(argValue("chapters-dir") && { chaptersDir: argValue("chapters-dir") }),
    ...(argValue("out-dir") && { outDir: argValue("out-dir") }),
  });
} catch (err) {
  console.error(err.message || err);
  process.exit(1);
}

const REASON = {
  english: "its English is no longer in the verse",
  greek: "its Greek no longer matches SBLGNT",
  clash: "it overlaps another record",
  empty: "it links nothing",
};

const { stale, orphans, verses, chapters } = store.getReport();
const show = (r) =>
  `${r.greek.map((g) => g.form).join(" ") || "(no Greek)"} ↔ ${r.english.map((p) => p.text).join(" … ") || "(no English)"}`;

console.log(`Checked ${verses} verses in ${chapters} chapters.`);
if (stale.length) {
  console.log(`\nStale (${stale.length}): the record no longer fits its verse.`);
  for (const s of stale) console.log(`  ${s.ref}  ${show(s.record)}\n      ${REASON[s.reason] ?? s.reason}`);
}
if (orphans.length) {
  console.log(`\nOrphaned (${orphans.length}): the verse is no longer in the English.`);
  for (const o of orphans) console.log(`  ${o.ref}  ${show(o.record)}`);
}
if (!stale.length && !orphans.length) console.log("Every stored record still fits.");
process.exit(stale.length || orphans.length ? 1 : 0);
