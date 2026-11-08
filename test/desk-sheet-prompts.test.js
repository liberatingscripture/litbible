// test/desk-sheet-prompts.test.js
//
// A module's prompt (STUDY-DESK-FORMAT.md, "Modules"; Audit 5, SH5-2): an
// optional plain-text `prompt` on a text or question module, and
// `answerPrompt` on a question, which the editor shows dimmed and nothing
// prints. The record check accepts them within the limit and refuses HTML or
// anything not a string; the sanitizer of formatted text leaves them alone.

import { test } from "node:test";
import assert from "node:assert/strict";

import { SHEET_LIMITS, cleanSheetText, validateSheet } from "../src/lib/desk-sheet-format.mjs";
import { createSheet, makeModule } from "../src/lib/desk-sheets.mjs";

const ctx = { client: "web/2026.11", contentVersion: "v20261107.1a2b3c4d" };

const sheetWith = (...modules) => createSheet({ template: "blank", modules }, ctx);

test("the prompt limit is 200 characters", () => {
  assert.equal(SHEET_LIMITS.prompt, 200);
});

test("a text module may carry a prompt, and a question both prompts", () => {
  const sheet = sheetWith(
    makeModule("text", { html: "<h2>Opening</h2>", prompt: "How you will begin: a welcome, a prayer, a moment of quiet." }),
    makeModule("text", { html: "", prompt: "" }),
    makeModule("question", { prompt: "A first question for the group.", answerPrompt: "Optional. The answer you expect." }),
    makeModule("question", { prompt: "Only the question’s." }),
  );
  assert.deepEqual(validateSheet(sheet), []);
});

test("a prompt of exactly the limit passes, counted in characters, not code units", () => {
  const full = "ἀ".repeat(SHEET_LIMITS.prompt); // one code point each
  const astral = "𝔸".repeat(SHEET_LIMITS.prompt); // two code units each
  assert.deepEqual(validateSheet(sheetWith(makeModule("text", { prompt: full }))), []);
  assert.deepEqual(validateSheet(sheetWith(makeModule("question", { answerPrompt: astral }))), []);
});

test("a prompt over the limit is refused", () => {
  const long = "x".repeat(SHEET_LIMITS.prompt + 1);
  assert.match(validateSheet(sheetWith(makeModule("text", { prompt: long }))).join(" "), /prompt is not plain text of at most 200 characters/);
  assert.match(validateSheet(sheetWith(makeModule("question", { prompt: long }))).join(" "), /prompt/);
  assert.match(validateSheet(sheetWith(makeModule("question", { answerPrompt: long }))).join(" "), /answerPrompt/);
});

test("a prompt that isn't a string is refused", () => {
  for (const bad of [5, true, {}, ["a"]]) {
    assert.notDeepEqual(validateSheet(sheetWith(makeModule("text", { prompt: bad }))), [], `text ${JSON.stringify(bad)}`);
    assert.notDeepEqual(validateSheet(sheetWith(makeModule("question", { prompt: bad }))), [], `question ${JSON.stringify(bad)}`);
    assert.notDeepEqual(validateSheet(sheetWith(makeModule("question", { answerPrompt: bad }))), [], `answer ${JSON.stringify(bad)}`);
  }
});

test("a prompt holding < is refused, since a prompt is plain text, never HTML", () => {
  for (const bad of ["<b>Bold</b>", "a < b", "<script>alert(1)</script>"]) {
    assert.match(validateSheet(sheetWith(makeModule("text", { prompt: bad }))).join(" "), /prompt/, bad);
    assert.match(validateSheet(sheetWith(makeModule("question", { answerPrompt: bad }))).join(" "), /answerPrompt/, bad);
  }
});

test("a prompt on another module type is that type's own business (kept, not checked)", () => {
  // Only text and question define a prompt; on a space it is a field this
  // code doesn't know, kept whole (principle 6) and not judged.
  const sheet = sheetWith(makeModule("space", { lines: 4, prompt: 7 }));
  assert.deepEqual(validateSheet(sheet), []);
});

test("cleanSheetText leaves prompts exactly as they are", () => {
  const prompt = "Text & <not> markup, “quoted”";
  const answerPrompt = "  spaced   out  ";
  // A record as another client might hold it: formatted text needing the
  // sanitizer, beside prompts it must not touch.
  const r = {
    kind: "sheet",
    modules: [
      { id: "a", type: "text", html: "<div>Opening</div>", prompt },
      { id: "b", type: "question", html: "<b>Why?</b>", answer: "", lines: 3, prompt, answerPrompt },
    ],
  };
  const out = cleanSheetText(r);
  assert.notEqual(out, r, "the formatted text was cleaned");
  assert.equal(out.modules[0].html, "<p>Opening</p>");
  assert.equal(out.modules[0].prompt, prompt);
  assert.equal(out.modules[1].html, "<p><strong>Why?</strong></p>");
  assert.equal(out.modules[1].prompt, prompt);
  assert.equal(out.modules[1].answerPrompt, answerPrompt);

  const clean = sheetWith(makeModule("text", { html: "<h2>Read</h2>", prompt: "How to read." }));
  assert.equal(cleanSheetText(clean), clean, "nothing to clean, so the same record");
});
