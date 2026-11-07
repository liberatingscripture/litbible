// test/desk-copy-constants.test.js
//
// Copy that states a limit in words must agree with the constant that
// enforces it (Audit 2, CP-16). Where a sentence is typed beside its constant
// (help.astro, awaiting Audit 3's CP3-6), the test checks the typed number. Where
// a sentence is built from its constant (Audit 3, CP3-2, 3, 5, 7), the test
// checks that it reads the constant, so a changed limit can't leave it stale.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { TRASH_DAYS } from "../src/lib/desk-records.mjs";
import { DESK_TOUR_STEPS, REMIND_AFTER_DAYS } from "../src/lib/desk-first-use.mjs";
import { MAX_TERMS } from "../src/lib/greek-query.mjs";
import { MAX_FOLLOWING } from "../src/lib/desk-bookmarks.mjs";
import { MAX_PANES } from "../src/lib/desk-layout.mjs";
import { FOLLOW_LIMIT_REACHED } from "../src/lib/desk-bookmark-change.mjs";
import { numberWord } from "../src/lib/desk-wording.mjs";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

const WORDS = { 1: "one", 2: "two", 3: "three", 4: "four", 5: "five", 6: "six", 7: "seven" };

test("the trash's days in copy are TRASH_DAYS", () => {
  // help.astro still types the number (CP3-6 is another session's); notebook-page.js builds it (below).
  const file = "src/pages/notebook/help.astro";
  const found = [...read(file).matchAll(/(\d+) days/g)].map((m) => Number(m[1]));
  assert.ok(found.length, `${file} names the trash's days`);
  assert.ok(found.every((n) => n === TRASH_DAYS), `${file} says ${found.join(", ")} days; TRASH_DAYS is ${TRASH_DAYS}`);
});

test("the notebook page builds the trash's days from TRASH_DAYS (CP3-7)", () => {
  const src = read("src/scripts/desk/notebook-page.js");
  assert.match(src, /import \{ TRASH_DAYS \} from "\.\.\/\.\.\/lib\/desk-records\.mjs"/);
  const code = src.split("\n").filter((line) => !line.trimStart().startsWith("//")).join("\n");
  assert.doesNotMatch(code, /\b\d+ days\b/, "no typed number of days in the code");
  assert.ok(src.match(/\$\{TRASH_DAYS\} days/g).length >= 4, "every trash sentence reads TRASH_DAYS");
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

test("numberWord spells 1 to 10, capitalized when asked, and writes anything else in figures", () => {
  for (const n of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]) {
    assert.match(numberWord(n), /^[a-z]+$/);
  }
  assert.equal(numberWord(6), "six");
  assert.equal(numberWord(6, { capital: true }), "Six");
  assert.equal(numberWord(4, { capital: true }), "Four");
  assert.equal(numberWord(11), "11");
  assert.equal(numberWord(0), "0");
  assert.equal(numberWord(2.5), "2.5");
});

test("the bookmark limit's sentences are built from MAX_FOLLOWING (CP3-2, CP3-3)", () => {
  assert.equal(
    FOLLOW_LIMIT_REACHED,
    `${numberWord(MAX_FOLLOWING, { capital: true })} of your bookmarks already move as you read. Turn that off on one of them first.`,
  );
  const form = read("src/scripts/desk/bookmark-form.js");
  assert.match(form, /numberWord\(MAX_FOLLOWING, \{ capital: true \}\)/);
  assert.match(form, /Up to \$\{numberWord\(MAX_FOLLOWING\)\} of your bookmarks can move\./);
  for (const file of ["src/lib/desk-bookmark-change.mjs", "src/scripts/desk/bookmark-form.js"]) {
    assert.doesNotMatch(read(file), /Six of your|Up to six of your/, `${file} types no number`);
  }
});

test("the Add pane tour step's \"Four panes fit\" is built from MAX_PANES (CP3-5)", () => {
  const add = DESK_TOUR_STEPS.find((s) => s.id === "add");
  assert.ok(add, "the Study Desk tour has an Add pane step");
  assert.ok(
    add.body.default.includes(`${numberWord(MAX_PANES, { capital: true })} panes fit when the window has room.`),
    "the step names MAX_PANES",
  );
  assert.match(read("src/lib/desk-first-use.mjs"), /import \{ MAX_PANES \} from "\.\/desk-layout\.mjs"/);
  assert.doesNotMatch(read("src/lib/desk-first-use.mjs"), /Four panes fit/);
});
