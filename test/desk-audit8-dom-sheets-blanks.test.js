// A sheet's printing blanks, worked out once per change and shared by every
// passage card (Audit 8, GF8b-9), driven in a browser DOM: a footnote in one
// passage that names a word blanked in another is flagged, the flag follows
// the other passage's blanks, and a save that changes no blank leaves the
// list as drawn.

import { test } from "node:test";
import assert from "node:assert/strict";
import "./helpers/browser-env.mjs";
import { createSheet, makeModule } from "../src/lib/desk-sheets.mjs";
import { blankFromOffsets } from "../src/lib/desk-sheet-lit.mjs";
import { passageFromVerses } from "../src/lib/desk-sheet-passages.mjs";

// happy-dom's Range.intersectsNode answers false for a node that holds the
// range, and its comparePoint refuses a range made by a parsed document; the
// passage card needs the DOM standard's answer, so it is written out here.
const index = (n) => [...n.parentNode.childNodes].indexOf(n);
/** -1, 0 or 1: boundary point A before, at or after B (DOM standard). */
function comparePoints(nodeA, offA, nodeB, offB) {
  if (nodeA === nodeB) return Math.sign(offA - offB);
  const pos = nodeA.compareDocumentPosition(nodeB);
  if (pos & 2) return -comparePoints(nodeB, offB, nodeA, offA); // B precedes A
  if (pos & 16) {
    // A contains B
    let child = nodeB;
    while (child.parentNode !== nodeA) child = child.parentNode;
    if (index(child) < offA) return 1;
  }
  return -1;
}
window.Range.prototype.intersectsNode = function (node) {
  if (node.getRootNode() !== this.startContainer.getRootNode()) return false;
  const parent = node.parentNode;
  if (!parent) return true;
  const i = index(node);
  return comparePoints(parent, i, this.endContainer, this.endOffset) === -1 && comparePoints(parent, i + 1, this.startContainer, this.startOffset) === 1;
};

let fetches = 0;
globalThis.fetch = window.fetch = async (url) => {
  if (!/\/john-3\/?$/.test(String(url))) return new Response("", { status: 404 });
  fetches++;
  return new Response(
    `<!doctype html><html data-content-version="v1"><body><article class="chapter"><div class="chapter-paragraphs">` +
      `<p><span data-verse="1"><sup class="vn" id="v1">1</sup> Grace abounds for everyone here.</span></p>` +
      `<p><span data-verse="2"><sup class="vn" id="v2">2</sup> People heard it gladly.<sup class="fn-ref"><a id="fnref-a" href="#fn-a">a</a></sup></span></p>` +
      `</div></article>` +
      `<ol class="footnotes"><li id="fn-a"><span class="fn-body">Some read “abounds” here. <a class="footnote-backlink" href="#fnref-a">a</a></span></li></ol>` +
      `</body></html>`,
    { status: 200, headers: { "content-type": "text/html" } },
  );
};

const { createPassageBody } = await import("../src/scripts/desk/sheets/sheet-lit.js");
const { loadChapterPage } = await import("../src/scripts/desk/chapter-page.js");

const ctx = () => ({ now: new Date().toISOString(), client: "web/test", contentVersion: "v1" });

async function until(fn, ms = 3000, what = "the condition") {
  const end = Date.now() + ms;
  while (!(await fn())) {
    if (Date.now() > end) throw new Error(`timed out waiting for ${what}`);
    await new Promise((r) => setTimeout(r, 10));
  }
}

test("a footnote in one passage that names a blank in another is flagged, and the flag follows that blank (GF8b-9)", async () => {
  const source = await loadChapterPage("john", 3);
  const chapter = source.anchorText();
  const where = { bookKey: "john", chapter: 3 };
  const start = chapter.text.indexOf("abounds");
  const blank = blankFromOffsets(chapter, start, start + "abounds".length, { id: "b1" });
  const first = makeModule("passage", { ...passageFromVerses(chapter, where, 1, 1, "v1"), blanks: [blank] });
  const second = makeModule("passage", passageFromVerses(chapter, where, 2, 2, "v1"));
  let sheet = createSheet({ title: "Study", modules: [first, second, makeModule("text", { html: "<p>one</p>" })] }, ctx());

  const card = createPassageBody({ m: second, readOnly: false, getSheet: () => sheet, update: async () => true, say: () => {} });
  document.body.replaceChildren(card.el);
  const summary = () => card.el.querySelector(".desk-sheet__notes-summary")?.textContent ?? "";
  await until(() => summary().includes("would give a blank away"), 3000, "the flag");

  // A save that changes no passage's blanks (a text part's words) leaves the list alone.
  const fetchesBefore = fetches;
  const drawn = card.el.querySelector(".desk-sheet__notes-summary");
  sheet = { ...sheet, modules: sheet.modules.map((m) => (m.type === "text" ? { ...m, html: "<p>two</p>" } : m)) };
  card.sheetChanged();
  await new Promise((r) => setTimeout(r, 50));
  assert.equal(card.el.querySelector(".desk-sheet__notes-summary"), drawn);
  assert.equal(fetches, fetchesBefore);

  // The other passage's blank is filled in again: the flag goes.
  sheet = { ...sheet, modules: sheet.modules.map((m) => (m.id === first.id ? { ...m, blanks: [] } : m)) };
  card.sheetChanged();
  await until(() => summary() && !summary().includes("would give a blank away"), 3000, "the flag to go");
  card.destroy();
});
