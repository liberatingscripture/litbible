// test/desk-page-kind.test.js
//
// src/scripts/desk/page-kind.js: what kind of page this is, read off the DOM
// (Audit 6, LG6-3). readBook() names the book Read View shows; prosePage()
// returns the glossary or an article's note targets, and is switched off in
// version 1 (PROSE_NOTES), so it must answer null on every page. The DOM is a
// stub with only the selectors the module reads.
import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";

import { PROSE_NOTES, prosePage, readBook } from "../src/scripts/desk/page-kind.js";

/** A stub document: `selectors` maps a selector to the element it finds. */
function stubDocument(selectors = {}) {
  return {
    querySelector: (sel) => selectors[sel] ?? null,
    documentElement: { hasAttribute: () => false },
  };
}

/** A Read View root with a dataset and, optionally, its text element. */
function rmRoot(book, { text = true } = {}) {
  return {
    dataset: book === undefined ? {} : { rmBook: book },
    querySelector: (sel) => (sel === "[data-rm-text]" && text ? {} : null),
  };
}

let before;
beforeEach(() => {
  before = globalThis.document;
});
afterEach(() => {
  globalThis.document = before;
});

test("readBook names the book of a Read View page that has its text", () => {
  globalThis.document = stubDocument({ "[data-rm-root]": rmRoot("john") });
  assert.equal(readBook(), "john");
});

test("readBook is null where there is no Read View, or no text to read", () => {
  globalThis.document = stubDocument();
  assert.equal(readBook(), null, "no Read View root");
  globalThis.document = stubDocument({ "[data-rm-root]": rmRoot("john", { text: false }) });
  assert.equal(readBook(), null, "a root with no text element");
  globalThis.document = stubDocument({ "[data-rm-root]": rmRoot(undefined) });
  assert.equal(readBook(), null, "a root with no book named");
});

test("PROSE_NOTES is off in version 1, so prosePage is null even on an article", () => {
  assert.equal(PROSE_NOTES, false);
  // An article card and body, the markup prosePage would otherwise read.
  const body = { textContent: "Body" };
  const card = {
    querySelector: (sel) => (sel === ".article__body" ? body : null),
  };
  globalThis.document = stubDocument({ ".article__card": card });
  assert.equal(prosePage(), null);
});
