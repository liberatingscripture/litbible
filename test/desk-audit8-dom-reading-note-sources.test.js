// Placing notes on footnotes (Audit 8, NB8-11): the page's footnote list is read
// once for a drawing, not once per note.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resetDom } from "./helpers/browser-env.mjs";
import { createRecord } from "../src/lib/desk-records.mjs";
import { pinFields } from "../src/lib/desk-footnotes.mjs";
import { prepareStudyParagraph } from "../src/lib/chapter-html.ts";

const { studySource } = await import("../src/scripts/desk/note-sources.js");
const { footnoteList } = await import("../src/scripts/desk/page.js");

const john3 = JSON.parse(readFileSync(new URL("../src/data/chapters/john-3.json", import.meta.url), "utf8"));

function page() {
  resetDom();
  const seen = new Set();
  const state = { currentVerse: null };
  const body = john3.paragraphs.map((p) => `<div class="p">${prepareStudyParagraph(p, "john", 3, seen, state)}</div>`).join("");
  const notes = john3.footnotes
    .map((f) => `<li id="${f.id}"><span class="fn-body">${f.html}</span> <a class="footnote-backlink" href="#${f.refId}">${f.label}</a></li>`)
    .join("");
  document.body.innerHTML = `
    <article class="chapter" data-last-read-book="john" data-last-read-chapter="3">
      <div class="chapter-paragraphs">${body}</div>
      <section class="footnotes-wrap"><ol class="footnotes">${notes}</ol></section>
    </article>`;
}

/** How many times `fn` looks an element up by id. */
function lookups(fn) {
  const real = document.getElementById.bind(document);
  let n = 0;
  document.getElementById = (id) => {
    n++;
    return real(id);
  };
  try {
    return { result: fn(), n };
  } finally {
    document.getElementById = real;
  }
}

test("NB8-11: placing several notes on footnotes reads the footnote list once", () => {
  page();
  const list = footnoteList();
  assert.ok(list.length >= 3);
  const noteOn = (id) =>
    createRecord("note", { bookKey: "john", chapter: 3, ...pinFields(list, id), body: "mine", marker: "note" }, { now: "2026-11-09T12:00:00.000Z", client: "web/test", contentVersion: "v1" });
  const records = list.slice(0, 3).map((f) => noteOn(f.id));
  const one = lookups(() => footnoteList()).n;
  const { result, n } = lookups(() => studySource().placed(records));
  assert.equal(result.length, 3, "all three notes are placed beside their footnotes");
  assert.ok(n < 2 * one, `the list is read once (${n} lookups; one read is ${one}, three would be ${3 * one})`);
});

test("NB8-11: a drawing with no note on a footnote doesn't read the footnote list at all", () => {
  page();
  const list = footnoteList();
  const verseNote = createRecord("note", { bookKey: "john", chapter: 3, verse: 16, endVerse: 16, body: "mine", marker: "note" }, { now: "2026-11-09T12:00:00.000Z", client: "web/test", contentVersion: "v1" });
  const { n } = lookups(() => studySource().placed([verseNote]));
  assert.equal(n, 0, `no footnote lookups (${list.length} footnotes on the page)`);
});
