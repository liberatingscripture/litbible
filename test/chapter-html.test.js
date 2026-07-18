// test/chapter-html.test.js
//
// Unit tests for src/lib/chapter-html.ts — the shared server-side (build-time)
// HTML transform pipeline that both Study View and Reading Mode use to prepare
// chapter paragraphs. Run with `npm test` (node --test test/). No disk
// fixtures: every case is a small inline HTML string shaped like real chapter
// JSON `paragraphs` entries.
//
// chapter-html.ts is TypeScript but contains only erasable syntax (type
// aliases, parameter annotations, one `as`), so Node's built-in type
// stripping (default-on from Node 22.18) imports it directly with the
// explicit .ts extension below — no loader, no new deps.
//
// The module exports exactly two entry points; the nine internal passes
// (dropDuplicateVerseIds, normalizeHbqVerseGlue, normalizeStudyVerseGlue,
// wrapVerseSegments, addHbqAria, addOsisIds, removeFootnoteRefs,
// rewriteVerseIdsAndAnchors, normalizeReadVerseGlue) are deliberately
// unexported so the two views can't drift apart — this suite tests only
// through prepareStudyParagraph / prepareReadParagraph, as black boxes,
// mirroring how test/search-core.test.js covers nearestVocabWord /
// findTokenRuns through searchVerses.

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  prepareStudyParagraph,
  prepareReadParagraph,
} from "../src/lib/chapter-html.ts";

/** Fresh per-chapter state, matching what the real page templates pass. */
function freshState() {
  return { currentVerse: null };
}

/* ── 1. vglue handling ───────────────────────────────────────────────── */

test("vglue: Study normalizes surrounding whitespace around a literal &nbsp; entity", () => {
  const html =
    '<p id="p1"><span class="vglue">  <sup id="v5" class="vn">5</sup>  &nbsp;  Hello</span> world.</p>';
  const out = prepareStudyParagraph(html, "john", 3, new Set(), freshState());
  assert.match(
    out,
    /<span class="vglue"><sup id="v5" class="vn" data-osis="John\.3\.5">5<\/sup>&nbsp;Hello<\/span>/,
  );
});

test("vglue: Study normalizes a real U+00A0 character to the literal &nbsp; entity", () => {
  const NBSP = " ";
  const html = `<p id="p1"><span class="vglue"><sup id="v6" class="vn">6</sup>${NBSP}Hello</span> world.</p>`;
  const out = prepareStudyParagraph(html, "john", 3, new Set(), freshState());
  assert.ok(out.includes("<sup"));
  assert.match(out, /<\/sup>&nbsp;Hello<\/span>/);
  assert.equal(out.includes(NBSP), false);
});

// A `.vglue` span means "keep this verse number glued to the first word", so any
// separator — including a plain ASCII space — normalizes to `&nbsp;`. No chapter
// uses a plain space today (all 6319 vglue spans in the corpus use `&nbsp;`), but
// nothing validates that convention, so the transform handles it rather than
// silently failing its pattern and leaving the number unglued.
test("vglue: Study normalizes a plain ASCII space to the literal &nbsp; entity", () => {
  const html =
    '<p id="p1"><span class="vglue"><sup id="v5" class="vn">5</sup> Hello</span> world.</p>';
  const out = prepareStudyParagraph(html, "john", 3, new Set(), freshState());
  assert.match(
    out,
    /<span class="vglue"><sup id="v5" class="vn" data-osis="John\.3\.5">5<\/sup>&nbsp;Hello<\/span>/,
  );
});

test("vglue: Study collapses a run of plain spaces to a single &nbsp;", () => {
  const html =
    '<p id="p1"><span class="vglue"><sup id="v5" class="vn">5</sup>   Hello</span> world.</p>';
  const out = prepareStudyParagraph(html, "john", 3, new Set(), freshState());
  assert.match(out, /<\/sup>&nbsp;Hello<\/span>/);
});

// Regression guard for the separator alternation: only ONE separator is consumed,
// so a doubled entity keeps its second one as literal text rather than being
// swallowed as more separator.
test("vglue: Study consumes only one separator, leaving a doubled &nbsp; intact", () => {
  const html =
    '<p id="p1"><span class="vglue"><sup id="v5" class="vn">5</sup>&nbsp;&nbsp;Hello</span></p>';
  const out = prepareStudyParagraph(html, "john", 3, new Set(), freshState());
  assert.match(out, /<\/sup>&nbsp;&nbsp;Hello<\/span>/);
});

test("vglue: Reading Mode also normalizes a plain ASCII space, and still moves the id", () => {
  const html =
    '<p id="p1"><span class="vglue"><sup id="v16" class="vn">16</sup> For God so loved.</span></p>';
  const out = prepareReadParagraph(html, "john", 3, new Set());
  // The id must still reach .rm-verse-anchor — when verse numbers are toggled off
  // in Reading Mode, a #john-3-v16 deep link targets this span, not the <sup>.
  assert.match(
    out,
    /^<p id="p1"><span class="rm-verse-anchor" id="john-3-v16" aria-hidden="true"><\/span><span class="vglue"><sup class="vn">16<\/sup>&nbsp;<\/span>For God so loved\.<\/p>$/,
  );
});

test("vglue: Reading Mode moves the verse id off the <sup> onto a standalone .rm-verse-anchor span", () => {
  const html =
    '<p id="p1"><span class="vglue"><sup id="v16" class="vn">16</sup>&nbsp;For God so loved.</span></p>';
  const out = prepareReadParagraph(html, "john", 3, new Set());
  assert.match(
    out,
    /^<p id="p1"><span class="rm-verse-anchor" id="john-3-v16" aria-hidden="true"><\/span><span class="vglue"><sup class="vn">16<\/sup>&nbsp;<\/span>For God so loved\.<\/p>$/,
  );
  // The <sup> itself no longer carries an id.
  assert.equal(/<sup[^>]*\bid=/.test(out), false);
});

/* ── 2. Verse spans opening/closing at tag-depth 0 (wrapVerseSegments) ─── */

test("verse spans: a single-verse paragraph is wrapped in one data-verse span", () => {
  const html =
    '<p id="p1"><span class="vglue"><sup id="v1" class="vn">1</sup>&nbsp;There was a Pharisee.</span></p>';
  const out = prepareStudyParagraph(html, "john", 3, new Set(), freshState());
  assert.equal(
    out,
    '<p id="p1"><span data-verse="1"><span class="vglue"><sup id="v1" class="vn" data-osis="John.3.1">1</sup>&nbsp;There was a Pharisee.</span></span></p>',
  );
});

test("verse spans: two verses in one paragraph get two separate data-verse spans", () => {
  const html =
    '<p id="p2"><span class="vglue"><sup id="v1" class="vn">1</sup>&nbsp;First verse.</span> <span class="vglue"><sup id="v2" class="vn">2</sup>&nbsp;Second verse.</span></p>';
  const out = prepareStudyParagraph(html, "john", 3, new Set(), freshState());
  assert.match(out, /<span data-verse="1">.*?<\/span><span data-verse="2">/);
  // Exactly two data-verse wrappers, correctly numbered.
  const matches = [...out.matchAll(/data-verse="(\d+)"/g)].map((m) => m[1]);
  assert.deepEqual(matches, ["1", "2"]);
});

test("verse spans: text before the first marker in a paragraph stays unwrapped", () => {
  const html =
    '<p id="p1">Some lead-in text before <span class="vglue"><sup id="v1" class="vn">1</sup>&nbsp;the verse starts</span> and continues.</p>';
  const out = prepareStudyParagraph(html, "john", 3, new Set(), freshState());
  assert.ok(out.startsWith('<p id="p1">Some lead-in text before <span data-verse="1">'));
});

test("verse spans: a <p> with no marker continues the current verse (e.g. an unnumbered poetry line)", () => {
  const p1 =
    '<p id="p1"><span class="vglue"><sup id="v5" class="vn">5</sup>&nbsp;First line of poetry</span></p>';
  const p2 = '<p id="p2">continuation line, no marker</p>';
  const state = freshState();
  const seen = new Set();
  prepareStudyParagraph(p1, "john", 3, seen, state);
  const out2 = prepareStudyParagraph(p2, "john", 3, seen, state);
  assert.equal(
    out2,
    '<p id="p2"><span data-verse="5">continuation line, no marker</span></p>',
  );
});

test("verse spans: an empty/whitespace-only <p> comes back untouched", () => {
  const html = '<p id="p1">   </p>';
  const out = prepareStudyParagraph(
    html,
    "john",
    3,
    new Set(),
    { currentVerse: 5 },
  );
  assert.equal(out, html);
});

test("verse spans: a <p> with no marker and no active verse (nothing seen yet) is left unwrapped", () => {
  const html = '<p id="p1">Just a heading, no verse.</p>';
  const out = prepareStudyParagraph(html, "john", 3, new Set(), freshState());
  assert.equal(out, html);
});

/* ── 3. Duplicate verse ids via seenVerseIds ─────────────────────────── */

test("duplicate ids: Study keeps the visible number on a repeated verse (Mark 14:62) but drops the duplicate id", () => {
  const seen = new Set();
  const state = freshState();
  const p1 =
    '<p id="p1"><span class="vglue"><sup id="v62" class="vn">62</sup>&nbsp;Jesus said.</span></p>';
  const p2 =
    '<p id="p2"><span class="vglue"><sup id="v62" class="vn">62</sup>&nbsp;continuation text.</span></p>';

  const out1 = prepareStudyParagraph(p1, "mark", 14, seen, state);
  const out2 = prepareStudyParagraph(p2, "mark", 14, seen, state);

  // First occurrence keeps its id (and therefore gets data-osis).
  assert.match(out1, /<sup id="v62" class="vn" data-osis="Mark\.14\.62">62<\/sup>/);
  // Second occurrence keeps the visible "62" but has no id (and so no data-osis).
  assert.match(out2, /<sup class="vn">62<\/sup>/);
  assert.equal(/<sup[^>]*\bid="v62"/.test(out2), false);
  assert.equal(out2.includes("data-osis"), false);
  // The verse number is still correctly detected for the data-verse wrapper.
  assert.match(out2, /<span data-verse="62">/);
});

test("duplicate ids: a fresh Set restores the id on what would otherwise be a duplicate", () => {
  const p2 =
    '<p id="p2"><span class="vglue"><sup id="v62" class="vn">62</sup>&nbsp;continuation text.</span></p>';
  const out = prepareStudyParagraph(p2, "mark", 14, new Set(), freshState());
  assert.match(out, /<sup id="v62" class="vn" data-osis="Mark\.14\.62">62<\/sup>/);
});

test("duplicate ids: Reading Mode dedupes BEFORE namespacing, so the duplicate loses its anchor entirely", () => {
  const seen = new Set();
  const p1 =
    '<p id="p1"><span class="vglue"><sup id="v62" class="vn">62</sup>&nbsp;Jesus said.</span></p>';
  const p2 =
    '<p id="p2"><span class="vglue"><sup id="v62" class="vn">62</sup>&nbsp;continuation text.</span></p>';

  const out1 = prepareReadParagraph(p1, "mark", 14, seen);
  const out2 = prepareReadParagraph(p2, "mark", 14, seen);

  // First occurrence gets a namespaced rm-verse-anchor.
  assert.match(out1, /<span class="rm-verse-anchor" id="mark-14-v62" aria-hidden="true">/);
  // Second occurrence gets NO anchor at all (id was dropped before namespacing ran).
  assert.equal(out2.includes("rm-verse-anchor"), false);
  assert.equal(out2.includes('id="mark-14-v62"'), false);
});

/* ── 4. Footnote-ref pass-through ────────────────────────────────────── */

test("footnote refs: Study keeps <sup class=\"fn-ref\"> intact with no verse id or data-osis", () => {
  const html =
    '<p id="p3"><span class="vglue"><sup id="v2" class="vn">2</sup>&nbsp;Some text<sup class="fn-ref">[a]</sup> more.</span></p>';
  const out = prepareStudyParagraph(html, "john", 3, new Set(), freshState());
  assert.ok(out.includes('<sup class="fn-ref">[a]</sup>'));
  // The fn-ref sup itself never gains an id or a data-osis attribute.
  assert.equal(/<sup class="fn-ref"[^>]*\bid=/.test(out), false);
  assert.equal(/<sup class="fn-ref"[^>]*data-osis=/.test(out), false);
});

test("footnote refs: Reading Mode strips <sup class=\"fn-ref\"> entirely", () => {
  const html =
    '<p id="p3"><span class="vglue"><sup id="v2" class="vn">2</sup>&nbsp;Some text<sup class="fn-ref">[a]</sup> more.</span></p>';
  const out = prepareReadParagraph(html, "john", 3, new Set());
  assert.equal(out.includes("fn-ref"), false);
  assert.equal(out.includes("[a]"), false);
  assert.ok(out.includes("Some text more."));
});

/* ── 5. Verse state carrying across paragraphs ───────────────────────── */

test("verse state: one verseState threaded across calls carries currentVerse into an unnumbered continuation", () => {
  const seen = new Set();
  const state = freshState();
  const p1 =
    '<p id="p1"><span class="vglue"><sup id="v5" class="vn">5</sup>&nbsp;First line of poetry</span></p>';
  const p2 = '<p id="p2">Second unmarked poetry line</p>';
  const p3 = '<p id="p3">Third unmarked poetry line</p>';

  prepareStudyParagraph(p1, "john", 3, seen, state);
  const out2 = prepareStudyParagraph(p2, "john", 3, seen, state);
  const out3 = prepareStudyParagraph(p3, "john", 3, seen, state);

  assert.match(out2, /^<p id="p2"><span data-verse="5">/);
  assert.match(out3, /^<p id="p3"><span data-verse="5">/);
});

test("verse state: a fresh state does not carry a verse into an unnumbered paragraph", () => {
  const p2 = '<p id="p2">Second unmarked poetry line</p>';
  const out = prepareStudyParagraph(p2, "john", 3, new Set(), freshState());
  assert.equal(out, p2);
});

/* ── Extras: addOsisIds ──────────────────────────────────────────────── */

test("addOsisIds: sets data-osis on a verse number sup for a known book", () => {
  const html =
    '<p id="p1"><span class="vglue"><sup id="v16" class="vn">16</sup>&nbsp;For God so loved the world.</span></p>';
  const out = prepareStudyParagraph(html, "john", 3, new Set(), freshState());
  assert.ok(out.includes('data-osis="John.3.16"'));
});

test("addOsisIds: an unknown bookKey yields no data-osis attribute at all", () => {
  const html =
    '<p id="p1"><span class="vglue"><sup id="v1" class="vn">1</sup>&nbsp;Text.</span></p>';
  const out = prepareStudyParagraph(html, "notabook", 3, new Set(), freshState());
  assert.equal(out.includes("data-osis"), false);
});

test("addOsisIds: an already-present data-osis is not doubled", () => {
  const html =
    '<p id="p2"><span class="vglue"><sup id="v2" class="vn" data-osis="John.3.2">2</sup>&nbsp;Text.</span></p>';
  const out = prepareStudyParagraph(html, "john", 3, new Set(), freshState());
  const count = (out.match(/data-osis=/g) || []).length;
  assert.equal(count, 1);
  assert.ok(out.includes('data-osis="John.3.2"'));
});

/* ── Extras: rewriteVerseIdsAndAnchors ───────────────────────────────── */

test("rewriteVerseIdsAndAnchors: namespaces id=\"v16\" to id=\"john-3-v16\" in Reading Mode", () => {
  const html =
    '<p id="p1"><span class="vglue"><sup id="v16" class="vn">16</sup>&nbsp;Text.</span></p>';
  const out = prepareReadParagraph(html, "john", 3, new Set());
  assert.ok(out.includes('id="john-3-v16"'));
});

test("rewriteVerseIdsAndAnchors: namespaces href=\"#v16\" to href=\"#john-3-v16\" in Reading Mode", () => {
  const html =
    '<p id="p1"><span class="vglue"><sup id="v16" class="vn">16</sup>&nbsp;Text with <a href="#v16">self link</a>.</span></p>';
  const out = prepareReadParagraph(html, "john", 3, new Set());
  assert.ok(out.includes('href="#john-3-v16"'));
});

/* ── Extras: addHbqAria ──────────────────────────────────────────────── */

test("addHbqAria: adds role=\"group\" and aria-label=\"Poetry\" to blockquote.hbq", () => {
  const html = '<blockquote class="hbq"><p class="hbq-line">Text</p></blockquote>';
  const out = prepareStudyParagraph(html, "john", 3, new Set(), freshState());
  assert.ok(out.includes('role="group"'));
  assert.ok(out.includes('aria-label="Poetry"'));
});

/* ── Extras: normalizeHbqVerseGlue ───────────────────────────────────── */

test("normalizeHbqVerseGlue: splits a poetry line's verse glue into .hbq-first / .hbq-rest", () => {
  const html =
    '<blockquote class="hbq"><p class="hbq-line"><span class="vglue"><sup id="v10" class="vn">10</sup>&nbsp;Poetry words here now.</span></p></blockquote>';
  const out = prepareStudyParagraph(html, "john", 3, new Set(), freshState());
  assert.match(
    out,
    /<span class="vglue"><sup id="v10" class="vn" data-osis="John\.3\.10">10<\/sup>&#8288;<span class="hbq-first">Poetry<\/span><\/span><span class="hbq-rest"> words here now\.<\/span>/,
  );
});

test("normalizeHbqVerseGlue: is idempotent when .hbq-first / .hbq-rest are already present", () => {
  const html =
    '<blockquote class="hbq"><p class="hbq-line"><span class="vglue"><sup id="v10" class="vn">10</sup>&#8288;<span class="hbq-first">Poetry</span></span><span class="hbq-rest"> words here now.</span></p></blockquote>';
  const out = prepareStudyParagraph(html, "john", 3, new Set(), freshState());
  // Same first/rest split, unchanged content (only ARIA/osis/data-verse layered on).
  assert.ok(out.includes('<span class="hbq-first">Poetry</span>'));
  assert.ok(out.includes('<span class="hbq-rest"> words here now.</span>'));
  // Not double-wrapped: exactly one hbq-first span.
  assert.equal((out.match(/hbq-first/g) || []).length, 1);
});
