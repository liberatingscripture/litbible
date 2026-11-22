// A passage's reference on the paper copy is an h3 (STUDY-DESK-FIXES.md,
// E222; BVJ, 2026-11-22, from a printed leader copy): the sheet's title is the
// h1 and its own headings ("Opening," "Reading") are h2, so the reference under
// one is a step down. At the same level it read as one more section heading.
//
// The copy is drawn here with a chapter that can't be fetched, which still
// draws the heading, then read into the model Copy and the saved files share.

import { test } from "node:test";
import assert from "node:assert/strict";
import "./helpers/browser-env.mjs";
import { createSheet, makeModule } from "../src/lib/desk-sheets.mjs";

const { renderCopy } = await import("../src/scripts/desk/sheets/sheet-copy.js");
const { readCopy } = await import("../src/scripts/desk/sheets/sheet-word.js");
const { docHtml, docText } = await import("../src/lib/desk-sheet-doc.mjs");

const ctx = { client: "web/test", contentVersion: "v1", now: "2026-11-22T12:00:00.000Z" };
const sheet = createSheet(
  {
    title: "Matthew 25:31-46",
    modules: [
      makeModule("text", { html: "<h2>Reading</h2>" }),
      makeModule("passage", { bookKey: "matthew", chapter: 25, verse: 31, endVerse: 46 }),
    ],
  },
  ctx,
);

for (const copy of ["leader", "participant"]) {
  test(`${copy}'s copy: the passage's reference is an h3 under the sheet's own h2`, async () => {
    const article = await renderCopy(sheet, { copy, codes: false });
    const ref = article.querySelector(".sheet-copy__ref");
    assert.equal(ref?.tagName, "H3");
    assert.equal(ref.textContent, "Matthew 25:31–46");
    assert.deepEqual([...article.querySelectorAll("h1, h2, h3")].map((h) => `${h.tagName} ${h.textContent}`), [
      "H1 Matthew 25:31-46",
      "H2 Reading",
      "H3 Matthew 25:31–46",
    ]);
  });
}

test("Copy and the files read it as a level 3 heading, with its blank line in the plain text", async () => {
  const doc = readCopy(await renderCopy(sheet, { copy: "leader", codes: false }));
  const ref = doc.blocks.find((b) => b.type === "section" && b.text === "Matthew 25:31–46");
  assert.equal(ref.level, 3);
  const html = docHtml(doc);
  assert.match(html, /<h2>Reading<\/h2>/);
  assert.match(html, /<h3>Matthew 25:31–46<\/h3>/);
  assert.doesNotMatch(html, /<h2>Matthew 25:31–46<\/h2>/);
  assert.match(docText(doc), /Reading\n\nMatthew 25:31–46\n/, "a blank line still sets the passage apart in the plain text");
});

test("a section with no level stays an h2: the key terms' and the answer key's titles", () => {
  const html = docHtml({ blocks: [{ type: "section", text: "Key terms", flush: true }, { type: "section", text: "Answer key" }], size: 12 });
  assert.match(html, /<h2 style="margin-top:0">Key terms<\/h2>/);
  assert.match(html, /<h2>Answer key<\/h2>/);
});
