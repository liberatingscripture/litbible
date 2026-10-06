// test/desk-anchor-dom.test.js
//
// src/lib/desk-anchor-dom.mjs reads a chapter's anchor text off the rendered
// page; scripts/lib/anchor-text.mjs reads it from the chapter JSON, and is what
// the apps' test vectors come from. A note made on the website lands in the
// right place in the apps only if the two agree character for character, so
// the main test here is a sweep: every published chapter, rendered through both
// views' real pipelines (src/lib/chapter-html.ts, imported via Node's type
// stripping as test/chapter-html.test.js does), read back through the DOM half
// and compared verse by verse. A chapter edit or a render change that breaks
// agreement fails here, in CI, before any reader's notes depend on it.
//
// The DOM is test/helpers/mini-dom.js, not a browser. The real-browser check is
// done by hand when the DOM half changes (see STUDY-DESK.md, phase 1a).

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";

import { prepareReadParagraph, prepareStudyParagraph } from "../src/lib/chapter-html.ts";
import { chapterAnchorText, makeAnchor, resolveAnchor } from "../scripts/lib/anchor-text.mjs";
import {
  anchorTextFromSegments,
  offsetsToRange,
  pageAnchorText,
  rangeToOffsets,
} from "../src/lib/desk-anchor-dom.mjs";
import { parseHtml } from "./helpers/mini-dom.js";

const CHAPTER_DIR = new URL("../src/data/chapters/", import.meta.url);

const published = readdirSync(CHAPTER_DIR)
  .filter((f) => f.endsWith(".json"))
  .map((f) => JSON.parse(readFileSync(new URL(f, CHAPTER_DIR), "utf8")))
  .filter((c) => c.indexed !== false);

/** A chapter as Study View renders it: one `.p` container per paragraph. */
function studyBlocks(c) {
  const seen = new Set();
  const state = { currentVerse: null };
  const html = c.paragraphs
    .map((p) => `<div class="p">${prepareStudyParagraph(p, c.bookKey, c.chapter, seen, state)}</div>`)
    .join("\n");
  return parseHtml(html).childNodes.filter((n) => n.nodeType === 1);
}

/** A chapter as Read View renders it, inside a page holding the chapter before it. */
function readBlocks(c) {
  const seen = new Set();
  const state = { currentVerse: null };
  const html = c.paragraphs
    .map(
      (p) =>
        `<div class="rm-block" data-chapter="${c.chapter}">${prepareReadParagraph(p, c.bookKey, c.chapter, seen, state)}</div>`,
    )
    .join("\n");
  return parseHtml(html).childNodes.filter((n) => n.nodeType === 1);
}

function versesObject(chapter) {
  return Object.fromEntries([...chapter.verses].map(([n, t]) => [n, t]));
}

test("the sweep covers the published corpus", () => {
  assert.ok(published.length > 150, `only ${published.length} published chapters found`);
});

test("sweep: Study View's page text is the anchor text, verse by verse, in every published chapter", () => {
  const failures = [];
  for (const c of published) {
    const want = chapterAnchorText(c.paragraphs);
    const got = pageAnchorText(studyBlocks(c));
    try {
      assert.deepEqual(versesObject(got), versesObject(want));
      assert.equal(got.text, want.text);
    } catch {
      failures.push(`${c.bookKey}-${c.chapter}`);
    }
  }
  assert.deepEqual(failures, [], `Study View disagrees with the anchor text in ${failures.length} chapters`);
});

test("sweep: Read View's page text is the anchor text, verse by verse, in every published chapter", () => {
  const failures = [];
  for (const c of published) {
    const want = chapterAnchorText(c.paragraphs);
    const got = pageAnchorText(readBlocks(c));
    try {
      assert.deepEqual(versesObject(got), versesObject(want));
      assert.equal(got.text, want.text);
    } catch {
      failures.push(`${c.bookKey}-${c.chapter}`);
    }
  }
  assert.deepEqual(failures, [], `Read View disagrees with the anchor text in ${failures.length} chapters`);
});

test("sweep: every offset maps to the page and back, in both views", () => {
  for (const c of published) {
    for (const blocks of [studyBlocks(c), readBlocks(c)]) {
      const page = pageAnchorText(blocks);
      // Every word start and end, which is where a selection's edges fall.
      for (const m of page.text.matchAll(/\S+/g)) {
        const s = m.index;
        const e = s + m[0].length;
        const range = offsetsToRange(page, s, e);
        assert.ok(range, `${c.bookKey}-${c.chapter} @${s}`);
        assert.deepEqual(rangeToOffsets(page, range), [s, e], `${c.bookKey}-${c.chapter} "${m[0]}" @${s}`);
      }
    }
  }
});

test("a selection's quote, made on the page, resolves to the same words through the reference", () => {
  for (const c of published.filter((_, i) => i % 7 === 0)) {
    const page = pageAnchorText(studyBlocks(c));
    const reference = chapterAnchorText(c.paragraphs);
    // A run of whole words from a third of the way in, as a reader would select.
    const s = page.text.indexOf(" ", Math.floor(page.text.length / 3)) + 1;
    const e = page.text.lastIndexOf(" ", Math.min(page.text.length, s + 40));
    const anchor = makeAnchor(page, s, e);
    const r = resolveAnchor(reference, anchor);
    assert.equal(r.status, "found", `${c.bookKey}-${c.chapter}`);
    assert.equal(reference.text.slice(r.start, r.end), page.text.slice(s, e));
  }
});

test("the resolution vectors give the same offsets on the rendered page", () => {
  const vectors = JSON.parse(readFileSync(new URL("./fixtures/anchor-vectors.json", import.meta.url), "utf8"));
  const pages = new Map(
    vectors.chapters.map((c) => {
      const [, bookKey, chapter] = c.slug.match(/^(.+)-(\d+)$/);
      return [c.slug, pageAnchorText(studyBlocks({ bookKey, chapter: Number(chapter), paragraphs: c.paragraphs }))];
    }),
  );
  for (const v of vectors.resolve) {
    const page = pages.get(v.chapter);
    const r = resolveAnchor(page, v.anchor);
    assert.equal(r.status, v.expected.status, v.why);
    assert.equal(r.start, v.expected.start, v.why);
    assert.equal(r.end, v.expected.end, v.why);
  }
});

/* ── The spec's rules on text the corpus doesn't contain yet ─────────── */

function segs(...parts) {
  // parts: [verse, text] or "|" for a block boundary; each text is its own node.
  return parts.map((p) => (p === "|" ? { boundary: true } : { verse: p[0], text: p[1], node: { id: p[1] } }));
}

test("a decomposed accent composes, and maps back to its whole cluster", () => {
  const page = anchorTextFromSegments(segs([1, "Iēsous said"]));
  assert.equal(page.text, "Iēsous said");
  assert.deepEqual(page.toDom(1, "start"), { node: page.textNodes[0], offset: 1 });
  assert.deepEqual(page.toDom(2, "end"), { node: page.textNodes[0], offset: 3 });
});

test("invisible characters, including the poetry word joiner, are dropped", () => {
  const page = anchorTextFromSegments(segs([1, "re­orient​ing⁠ minds﻿"]));
  assert.equal(page.text, "reorienting minds");
});

test("bracket markers go before whitespace collapses, even split across nodes", () => {
  const page = anchorTextFromSegments(segs([1, "Jesus said, "], [1, "|"], [1, "] “I came"]));
  assert.equal(page.text, "Jesus said, “I came");
  const page2 = anchorTextFromSegments(segs([1, "said, ⟧ “I"]));
  assert.equal(page2.text, "said, “I");
});

test("a block boundary separates words; inline breaks don't", () => {
  assert.equal(anchorTextFromSegments(segs([1, "ekd"], [1, "emeo"])).text, "ekdemeo");
  assert.equal(anchorTextFromSegments(segs([1, "Zion"], "|", [1, "A valuable"])).text, "Zion A valuable");
});

test("text outside a verse is dropped, and verses join in number order", () => {
  const page = anchorTextFromSegments(segs([null, "⟦"], [2, "Two."], "|", [1, "One."]));
  assert.equal(page.text, "One. Two.");
});

test("a selection edge inside a verse number or footnote letter moves off it", () => {
  const root = parseHtml(
    '<div class="p"><p><span data-verse="1"><span class="vglue"><sup id="v1" class="vn">1</sup>&nbsp;Love</span> is kind.<sup class="fn-ref"><a href="#fn-a">a</a></sup></span> <span data-verse="2"><span class="vglue"><sup id="v2" class="vn">2</sup>&nbsp;It</span> waits.</span></p></div>',
  );
  const page = pageAnchorText(root.childNodes);
  assert.equal(page.text, "Love is kind. It waits.");
  const sups = root.findAll((el) => el.tagName === "SUP");
  const digit = (sup) => sup.findAll(() => true).concat(sup).map((el) => el.childNodes[0]).find((n) => n?.nodeType === 3);
  // Starting inside "1" moves forward to "Love"; ending inside "a" moves back to "kind.".
  assert.deepEqual(
    rangeToOffsets(page, { startContainer: digit(sups[0]), startOffset: 0, endContainer: digit(sups[1]), endOffset: 1 }),
    [0, "Love is kind.".length],
  );
  // Ending inside "2" stops before it, with the space trimmed.
  const s = page.text.indexOf("kind");
  const at = page.toDom(s);
  assert.deepEqual(
    rangeToOffsets(page, { startContainer: at.node, startOffset: at.offset, endContainer: digit(sups[2]), endOffset: 1 }),
    [s, "Love is kind.".length],
  );
});

test("an element boundary point resolves to the text around it", () => {
  const root = parseHtml('<div class="p"><p><span data-verse="1">One two.</span></p></div><div class="p"><p><span data-verse="2">Three.</span></p></div>');
  const page = pageAnchorText(root.childNodes);
  const [p1, p2] = root.childNodes;
  // A triple-click style selection: from the start of block 1 to the start of block 2.
  assert.deepEqual(rangeToOffsets(page, { startContainer: p1, startOffset: 0, endContainer: p2, endOffset: 0 }), [0, "One two.".length]);
});
