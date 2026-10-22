// test/api2.test.js
//
// The content API, version 2 (API-2-FORMAT.md, scripts/lib/api2-core.mjs).
// Three claims: the version 1 manifest's `files` map never gains a version 2
// path (an installed Android build would blank a chapter over it); every
// chapter's version 2 text is its anchor text, with every range in bounds and
// in order; and the committed vectors (test/fixtures/api2-vectors.json), which
// the apps run too, still say what the code does. If the last fails after a
// deliberate change, regenerate with `npm run build:api2-vectors` and tell the
// apps.

import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";

import { chapterAnchorText, ANCHOR_SPEC_VERSION } from "../scripts/lib/anchor-text.mjs";
import {
  API_VERSION,
  addV2ToManifest,
  assertV1FilesMap,
  buildChapterV2,
} from "../scripts/lib/api2-core.mjs";

const CHAPTERS = new URL("../src/data/chapters/", import.meta.url);
const vectors = JSON.parse(readFileSync(new URL("./fixtures/api2-vectors.json", import.meta.url), "utf8"));
const sha256 = (buf) => createHash("sha256").update(buf).digest("hex");

const corpus = readdirSync(CHAPTERS)
  .filter((n) => n.endsWith(".json"))
  .map((name) => {
    const raw = readFileSync(new URL(name, CHAPTERS));
    return { slug: name.replace(/\.json$/, ""), raw, data: JSON.parse(raw.toString("utf8")) };
  });

// ── The manifest rule ────────────────────────────────────────────────────

test("the version 1 files map takes only paths the shipping apps know", () => {
  const ok = {
    "chapters/john-3.json": "x",
    "intros/john-intro.md": "x",
    "images/john-1.webp": "x",
    "glossary.json": "x",
    "topics.json": "x",
    "translation-commitments.json": "x",
    "release-notes.json": "x",
  };
  assert.doesNotThrow(() => assertV1FilesMap(ok));
  for (const bad of [
    "v2/chapters/john-3.json",
    "data/v2/chapters/john-3.json",
    "v2/books.json",
    "chapters/v2/john-3.json",
    "content.json",
    "books.json",
  ]) {
    assert.throws(() => assertV1FilesMap({ ...ok, [bad]: "x" }), undefined, bad);
  }
});

test("adding v2 changes nothing else in the manifest, byte for byte", () => {
  const files = Object.fromEntries(corpus.map((c) => [`chapters/${c.slug}.json`, sha256(c.raw)]));
  const manifest = { version: "v20261022.abcdef12", generatedAt: "2026-10-22T00:00:00.000Z", files };
  const before = JSON.stringify(manifest, null, 2);
  const v2 = { api: 2, anchorSpec: 1, version: manifest.version, files: { "chapters/john-3.json": "y" } };
  const after = addV2ToManifest(manifest, v2);
  assert.deepEqual(Object.keys(after), ["version", "generatedAt", "files", "v2"]);
  const { v2: added, ...rest } = after;
  assert.equal(JSON.stringify(rest, null, 2), before);
  assert.deepEqual(after.files, files, "the version 1 files map is the same object, unchanged");
  assert.deepEqual(added, v2);
  // Run twice (a standalone `npm run build:api2` after a build): replaced, not doubled.
  assert.deepEqual(addV2ToManifest(after, v2), after);
});

// ── The corpus ───────────────────────────────────────────────────────────

test("every chapter builds, and its text and verse spans are the anchor text", () => {
  for (const { slug, data } of corpus) {
    const v2 = buildChapterV2(data); // throws on any difference
    const ref = chapterAnchorText(data.paragraphs);
    assert.equal(v2.text, ref.text, slug);
    assert.deepEqual(
      v2.verses.map((v) => [v.v, v.start, v.end]),
      [...ref.spans].map(([n, [s, e]]) => [n, s, e]),
      slug,
    );
    assert.equal(v2.hash, sha256(Buffer.from(v2.text, "utf8")), slug);
    assert.equal(v2.api, API_VERSION);
    assert.equal(v2.anchorSpec, ANCHOR_SPEC_VERSION);
    if (!v2.indexed) assert.equal(v2.text, "", `${slug} is a draft`);
  }
});

test("every range is in bounds, in order, and where the format says", () => {
  const isSpace = (ch) => /\s/.test(ch);
  for (const { slug, data } of corpus) {
    const c = buildChapterV2(data);
    const n = c.text.length;
    const inBounds = (r, what) => {
      assert.ok(0 <= r.start && r.start <= r.end && r.end <= n, `${slug} ${what} out of bounds`);
    };
    // Blocks: in order, never overlapping, no edge on a space, and only a
    // space (or nothing) between two of them.
    let prev = null;
    for (const b of c.blocks) {
      inBounds(b, b.id);
      assert.ok(b.end > b.start, `${slug} ${b.id} is empty`);
      assert.ok(!isSpace(c.text[b.start]) && !isSpace(c.text[b.end - 1]), `${slug} ${b.id} edge`);
      assert.ok(["p", "hbq"].includes(b.kind), `${slug} ${b.id} kind ${b.kind}`);
      if (prev) assert.ok(/^\s?$/.test(c.text.slice(prev.end, b.start)), `${slug} gap before ${b.id}`);
      for (const l of b.lines ?? []) {
        inBounds(l, `${b.id} line`);
        assert.ok(b.start <= l.start && l.end <= b.end, `${slug} ${b.id} line outside its block`);
      }
      prev = b;
    }
    if (c.text) {
      assert.equal(c.blocks[0].start, 0, slug);
      assert.equal(c.blocks.at(-1).end, n, slug);
    }
    for (const r of c.runs) inBounds(r, "run");
    // Every footnote is placed, and the letters stand in footnotes[] order.
    let at = -1;
    for (const f of c.footnotes) {
      assert.equal(typeof f.at, "number", `${slug} ${f.id} has no place`);
      assert.ok(f.at >= at && f.at <= n, `${slug} ${f.id} out of order`);
      at = f.at;
    }
    for (const m of c.marks) {
      inBounds(m, "mark");
      assert.ok(!isSpace(c.text[m.start]) && !isSpace(c.text[m.end - 1]), `${slug} mark edge`);
    }
  }
});

test("a ⟦ ahead of a verse number starts its mark at that verse", () => {
  for (const [slug, verse] of [["mark-16", 9], ["john-7", 53]]) {
    const c = buildChapterV2(corpus.find((x) => x.slug === slug).data);
    assert.equal(c.marks[0].start, c.verses.find((v) => v.v === verse).start, slug);
    assert.equal(c.marks[0].opens, true, slug);
  }
  const john8 = buildChapterV2(corpus.find((x) => x.slug === "john-8").data);
  assert.deepEqual([john8.marks[0].start, john8.marks[0].opens, john8.marks[0].closes], [0, false, true]);
});

test("no <figure> in an indexed chapter", () => {
  for (const { slug, data } of corpus) {
    if (data.indexed !== false) assert.ok(!/<figure\b/i.test(data.paragraphs.join("")), slug);
  }
  const bad = { bookKey: "test", chapter: 1, indexed: true, paragraphs: ["<figure><img src=\"x\"></figure>"], footnotes: [] };
  assert.throws(() => buildChapterV2(bad), /figure/);
});

// ── The committed vectors ────────────────────────────────────────────────

test("the committed vectors are for this api and spec version", () => {
  assert.equal(vectors.api, API_VERSION);
  assert.equal(vectors.anchorSpec, ANCHOR_SPEC_VERSION);
});

test("vector chapters and synthetic cases rebuild exactly", () => {
  for (const v of [...vectors.chapters, ...vectors.synthetic]) {
    assert.deepEqual(buildChapterV2(v.input), v.expected, v.slug ?? v.why);
  }
});

test("vector hashes hold for every chapter still at the text they record", () => {
  let checked = 0;
  for (const { slug, raw, data } of corpus) {
    const entry = vectors.hashes[slug];
    assert.ok(entry, `${slug} missing from the vectors (run npm run build:api2-vectors)`);
    if (entry.source !== sha256(raw)) continue; // edited since; the vectors describe the older file
    assert.equal(buildChapterV2(data).hash, entry.hash, slug);
    checked++;
  }
  assert.ok(checked > 0, "no chapter is at the text the vectors record; regenerate them");
});
