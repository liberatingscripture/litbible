// test/desk-copy-constants.test.js
//
// Copy that states a limit in words must agree with the constant that
// enforces it (Audit 2, CP-16). Each sentence is typed beside its constant
// rather than built from it, so a changed limit fails here instead of
// leaving a stale sentence.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { TRASH_DAYS } from "../src/lib/desk-records.mjs";
import { REMIND_AFTER_DAYS } from "../src/lib/desk-first-use.mjs";
import { MAX_TERMS } from "../src/lib/greek-query.mjs";
import { MAX_FOLLOWING } from "../src/lib/desk-bookmarks.mjs";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

const WORDS = { 1: "one", 2: "two", 3: "three", 4: "four", 5: "five", 6: "six", 7: "seven" };

test("the trash's days in copy are TRASH_DAYS", () => {
  for (const file of ["src/pages/notebook/help.astro", "src/scripts/desk/notebook-page.js"]) {
    const found = [...read(file).matchAll(/(\d+) days/g)].map((m) => Number(m[1]));
    assert.ok(found.length, `${file} names the trash's days`);
    assert.ok(found.every((n) => n === TRASH_DAYS), `${file} says ${found.join(", ")} days; TRASH_DAYS is ${TRASH_DAYS}`);
  }
});

test("the copy reminder's \"a week\" is REMIND_AFTER_DAYS", () => {
  assert.equal(REMIND_AFTER_DAYS, 7);
  assert.match(read("src/scripts/desk/first-use.js"), /been a week since your last copy/);
});

test("the Greek command line's \"Up to four words\" is MAX_TERMS", () => {
  const m = read("src/lib/greek-query.mjs").match(/Up to (\w+) words/);
  assert.ok(m, "the comma command names its limit");
  assert.equal(m[1], WORDS[MAX_TERMS]);
});

test("copy that reads MAX_FOLLOWING does so, not a typed number", () => {
  assert.ok(MAX_FOLLOWING >= 1);
  assert.match(read("src/pages/notebook/help.astro"), /\{MAX_FOLLOWING\}/);
  assert.match(read("src/scripts/desk/trash-list.js"), /\$\{MAX_FOLLOWING\}/);
});
