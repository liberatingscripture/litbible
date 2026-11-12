// The group's answer key (STUDY-DESK-FIXES.md, E102; BVJ, 2026-11-11,
// Fable's option B): the last page of the participant's version, read into
// Copy and the saved files with its own credit, and never drawn empty.

import { test } from "node:test";
import assert from "node:assert/strict";
import "./helpers/browser-env.mjs";
import { createSheet, makeModule } from "../src/lib/desk-sheets.mjs";
import { LIT_CREDIT_LINE } from "../src/lib/lit-credit.mjs";

const { renderCopy } = await import("../src/scripts/desk/sheets/sheet-copy.js");
const { readCopy } = await import("../src/scripts/desk/sheets/sheet-word.js");
const { docText } = await import("../src/lib/desk-sheet-doc.mjs");

const ctx = { client: "web/test", contentVersion: "v1", now: "2026-11-11T12:00:00.000Z" };

/** A copy as renderCopy draws one, its foot and (when asked) the key after it. */
function article({ key }) {
  const el = document.createElement("article");
  el.className = "sheet-copy sheet-copy--participant";
  el.innerHTML =
    '<header class="sheet-copy__head"><h1 class="sheet-copy__title">Sheep and Goats</h1></header>' +
    '<section class="sheet-copy__text"><div class="desk-rich"><p>Read slowly.</p></div></section>' +
    `<footer class="sheet-copy__foot"><p class="sheet-copy__credit">${LIT_CREDIT_LINE}</p><p class="sheet-copy__addresses">litbible.net/matthew-25</p></footer>` +
    (key
      ? '<section class="sheet-copy__key"><h2 class="sheet-copy__key-title">Answer key</h2><p class="sheet-copy__key-sheet">Sheep and Goats</p>' +
        '<h3 class="sheet-copy__key-ref">Matthew 25:31–46</h3><ul class="sheet-copy__key-list">' +
        '<li class="sheet-copy__key-row" data-verse="31"><span class="sheet-copy__key-verse" aria-hidden="true">v. 31</span><span class="sr-only">Verse 31: </span><span class="sheet-copy__key-words">renown</span></li>' +
        '<li class="sheet-copy__key-row" data-verse="35"><span class="sheet-copy__key-verse" aria-hidden="true">v. 35</span><span class="sr-only">Verse 35: </span><span class="sheet-copy__key-words">hungry, stranger</span></li>' +
        `</ul><p class="sheet-copy__key-credit">${LIT_CREDIT_LINE}</p></section>`
      : "");
  return el;
}

const credits = (doc) => doc.blocks.filter((b) => b.type === "foot" && b.inlines.some((i) => i.text === LIT_CREDIT_LINE));

test("Copy and the files read the key as a page of its own: the sheet's name, a heading per passage, a list by verse", () => {
  const doc = readCopy(article({ key: true }));
  const at = doc.blocks.findIndex((b) => b.type === "section" && b.text === "Answer key");
  assert.ok(at > 0);
  assert.equal(doc.blocks[at - 1].type, "break", "the key starts a page");
  const rest = doc.blocks.slice(at + 1);
  assert.deepEqual(rest[0], { type: "para", inlines: [{ t: "em", kids: [{ t: "text", text: "Sheep and Goats" }] }] });
  assert.deepEqual(rest[1], { type: "heading", level: 3, inlines: [{ t: "text", text: "Matthew 25:31–46" }] });
  assert.equal(rest[2].type, "list");
  assert.deepEqual(rest[2].items.map((i) => i.inlines[0].text), ["v. 31: renown", "v. 35: hungry, stranger"]);
  assert.doesNotMatch(docText(doc), /Verse 31/, "the screen reader's words stay off the page");
});

test("with a key, the sheet keeps its credit in place and the key's page ends with its own", () => {
  const doc = readCopy(article({ key: true }));
  const lines = credits(doc);
  assert.equal(lines.length, 2);
  // The files write a `credit` line last, so the sheet's own is a plain line
  // of its foot, written where it stands, and the key's is the last.
  assert.equal(lines[0].credit, undefined);
  assert.equal(lines[1].credit, true);
  assert.equal(doc.blocks.at(-1), lines[1]);
});

test("without a key, the sheet's credit is the one the files write last, as before", () => {
  const doc = readCopy(article({ key: false }));
  assert.deepEqual(credits(doc).map((b) => b.credit), [true]);
  assert.equal(doc.blocks.some((b) => b.type === "section" && b.text === "Answer key"), false);
});

test("a sheet with no blanks gets no key on either version, asked for or not", async () => {
  const sheet = createSheet({ title: "No blanks", modules: [makeModule("text", { html: "<p>Words.</p>" })] }, ctx);
  for (const copy of ["leader", "participant"]) {
    const el = await renderCopy(sheet, { copy, codes: false, answerKey: true });
    assert.equal(el.querySelector(".sheet-copy__key"), null, copy);
  }
});
