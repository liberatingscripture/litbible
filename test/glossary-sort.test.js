// The glossary's alphabetical order (src/lib/glossary-sort.mjs).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { compareGlossaryLabels, glossarySortKey } from "../src/lib/glossary-sort.mjs";

test("glossarySortKey drops a leading The, A or An, in any case", () => {
  assert.equal(glossarySortKey("The Adversary"), "Adversary");
  assert.equal(glossarySortKey("The heavens / Sky"), "heavens / Sky");
  assert.equal(glossarySortKey("the heavens"), "heavens");
  assert.equal(glossarySortKey("A Messenger"), "Messenger");
  assert.equal(glossarySortKey("An Angel"), "Angel");
});

test("glossarySortKey leaves a word that only starts like an article", () => {
  for (const label of ["Angel", "Atonement", "Theology", "Another way", "Then", "A", "The"]) {
    assert.equal(glossarySortKey(label), label);
  }
});

test("glossarySortKey drops one article only, and only at the start", () => {
  assert.equal(glossarySortKey("The A-team"), "A-team");
  assert.equal(glossarySortKey("Place of the dead"), "Place of the dead");
});

test("compareGlossaryLabels files The Adversary among the A's", () => {
  const labels = ["Alignment / Justice", "Sacred", "The Adversary", "Torah", "Trust / Faithfulness"];
  assert.deepEqual(
    [...labels].sort(compareGlossaryLabels),
    ["The Adversary", "Alignment / Justice", "Sacred", "Torah", "Trust / Faithfulness"],
  );
});

// The real entries: every LIT label that starts with an article sorts under
// the word after it. Read straight from the frontmatter, so a new entry
// starting with "The" is covered without touching this test.
test("the glossary's own labels sort by the word after an article", () => {
  const dir = join(import.meta.dirname, "..", "src", "content", "glossary");
  const labels = readdirSync(dir)
    .filter((n) => n.endsWith(".md"))
    .map((n) => readFileSync(join(dir, n), "utf8").match(/^litMenu:\s*(.+)$/m)?.[1].trim())
    .filter(Boolean);
  const sorted = [...labels].sort(compareGlossaryLabels);
  const keys = sorted.map(glossarySortKey);
  for (let i = 1; i < keys.length; i++) {
    assert.ok(keys[i - 1].localeCompare(keys[i]) <= 0, `${sorted[i - 1]} before ${sorted[i]}`);
  }
  const adversary = sorted.indexOf("The Adversary");
  if (adversary !== -1) assert.ok(adversary < sorted.indexOf("Liberation"));
});
