// test/build-verse-index.test.js
//
// Unit tests for scripts/lib/verse-index-core.mjs — the paragraph-HTML →
// per-verse plain-text extraction behind public/search/verses.json. That file
// is a website asset rather than part of the mobile-app contract, but it is the
// entire search surface for scripture: whatever these tests let through is what
// a reader sees in a search result. Run with `npm test` (node --test test/).
//
// No disk and no fetch: every case is a small inline paragraph array shaped
// like a real chapter file's `paragraphs`, built with the same fixture helpers
// as test/draft-release-notes.test.js so the vglue split and footnote-ref
// stripping see what they see in production.
//
// extractVerses is the module's only export; htmlToPlainText and
// stripBracketMarkers are internal, so this suite tests through the one entry
// point as a black box — the convention test/chapter-html.test.js documents.

import { test } from "node:test";
import assert from "node:assert/strict";

import { extractVerses } from "../scripts/lib/verse-index-core.mjs";

/* ── Fixture builders (mirroring test/draft-release-notes.test.js) ───────── */

/** A footnote-reference superscript, as it appears attached to a bracket marker. */
const fnRef = (l) =>
  `<sup class="fn-ref"><a id="fnref-${l}" href="#fn-${l}" role="doc-noteref">${l}</a></sup>`;

/** One verse: `<span class="vglue"><sup id="vN">N</sup>&nbsp;First</span> rest`. */
function verse(n, text) {
  const words = text.split(" ");
  const rest = words.length > 1 ? " " + words.slice(1).join(" ") : "";
  return `<span class="vglue"><sup id="v${n}" class="vn">${n}</sup>&nbsp;${words[0]}</span>${rest}`;
}

const para = (id, ...parts) => `<p id="${id}">${parts.join(" ")}</p>`;

/** verses[] is 0-indexed; this reads it the way a human cites scripture. */
const v = (verses, n) => verses[n - 1];

/* ── 1. Bracketed passages ───────────────────────────────────────────────
 * `[|` and `|]` wrap passages whose authenticity or placement is contested
 * (Mark 16:9–20, John 7:53–8:11, John 9:38–39a, John 11:28–32, Romans 16:24
 * and 25–27). They are literal characters in the paragraph text, not markup,
 * and they are meant to be visible to a READER on the page — but never in an
 * extracted plain-text index. See "Bracketed passages" in CLAUDE.md. */

test("opening [| does not leak into the preceding verse", () => {
  // The real Romans 16 shape: the bracketed passage opens a NEW paragraph, so
  // its `[|` sits ahead of that paragraph's first vglue and therefore lands in
  // the PREVIOUS verse's chunk when the split runs.
  const bracketed = extractVerses([
    para("p4", verse(23, "Quartus greets you.")),
    `<p id="p5">[|${fnRef("m")} ${verse(24, "The generosity be with you all. Amen.")} |]${fnRef("n")}</p>`,
  ]);

  // Control: the identical chapter with the markers never authored at all.
  const plain = extractVerses([
    para("p4", verse(23, "Quartus greets you.")),
    para("p5", verse(24, "The generosity be with you all. Amen.")),
  ]);

  assert.equal(v(bracketed, 23), "Quartus greets you.");
  assert.equal(
    v(bracketed, 23),
    v(plain, 23),
    "verse 23 must be byte-identical to the unbracketed control",
  );
  assert.equal(v(bracketed, 24), "The generosity be with you all. Amen.");
});

test("closing |] at the end of the last paragraph leaves no trailing junk", () => {
  // Mark 16:20 — the marker closes the passage at the very end of the chapter.
  const verses = extractVerses([
    `<p id="p9">${verse(20, "They went out announcing him everywhere.")} |]${fnRef("m")}</p>`,
  ]);

  assert.equal(v(verses, 20), "They went out announcing him everywhere.");
});

test("closing |] mid-verse collapses to exactly one space", () => {
  // John 9:39 — the bracket closes partway through a verse, NOT at a paragraph
  // end: `Jesus said, |] “I came…`. This is why the whitespace collapse has to
  // run after the strip rather than before it.
  const verses = extractVerses([
    `<p id="p33">${verse(39, "Jesus said,")} |]${fnRef("r")} “I came for justice,</p>`,
  ]);

  assert.equal(v(verses, 39), "Jesus said, “I came for justice,");
  assert.doesNotMatch(v(verses, 39), /\s\s/, "a stripped marker left a double space");
});

test("back-to-back |] [| at a passage boundary leaves no gap", () => {
  // Romans 16:24 — its own passage closes and the doxology's opens immediately
  // after, so BOTH markers land in verse 24's chunk.
  const verses = extractVerses([
    `<p id="p5">[|${fnRef("m")} ${verse(24, "The generosity be with you all. Amen.")} |]${fnRef("n")}</p>`,
    `<p id="p6">[|${fnRef("o")} ${verse(25, "To the one who is able.")} |]${fnRef("r")}</p>`,
  ]);

  assert.equal(v(verses, 24), "The generosity be with you all. Amen.");
  assert.equal(v(verses, 25), "To the one who is able.");
});

test("no bracket marker survives extraction, in any position", () => {
  const verses = extractVerses([
    para("p1", verse(8, "They were afraid.")),
    `<p id="p2">[|${fnRef("e")} ${verse(9, "After he reawakened.")}</p>`,
    `<p id="p3">${verse(10, "She went and told,")} |]${fnRef("m")} weeping.</p>`,
  ]);

  for (const text of verses) {
    assert.doesNotMatch(text, /\[\||\|\]/, `marker survived in ${JSON.stringify(text)}`);
  }
});

/* ── 2. Extraction behavior these tests must not let drift ──────────────── */

test("a verse spanning a paragraph break keeps its continuation text", () => {
  // The authored convention: the continuation paragraph carries NO marker, so
  // its text simply stays inside the open verse's chunk.
  const verses = extractVerses([
    para("p1", verse(41, "Others said, “This is the Christ!”")),
    `<p id="p2">Then the first ones objected.</p>`,
  ]);

  assert.equal(
    v(verses, 41),
    "Others said, “This is the Christ!” Then the first ones objected.",
  );
});

test("a repeated verse id concatenates rather than overwriting", () => {
  // The other shape the split handles: the same id="vN" repeated on the
  // continuation paragraph (mirroring dropDuplicateVerseIds at render time).
  const verses = extractVerses([
    para("p1", verse(62, "“I am,” said Jesus,")),
    para("p2", verse(62, "“and you will see.”")),
  ]);

  assert.equal(v(verses, 62), "“I am,” said Jesus, “and you will see.”");
});

test("footnote references are stripped, entities decoded", () => {
  const verses = extractVerses([
    para("p1", `${verse(16, "God&#39;s love&mdash;for the world")}${fnRef("a")}, freely given.`),
  ]);

  assert.equal(v(verses, 16), "God's love—for the world, freely given.");
});

test("verse 1 is index 0 and an omitted verse is an empty string", () => {
  // Matthew 17:21 and friends: the source text carries no such verse, so the
  // slot exists but stays empty rather than shifting every later verse up one.
  const verses = extractVerses([
    para("p1", verse(20, "Nothing will be impossible."), verse(22, "As they gathered.")),
  ]);

  assert.equal(verses.length, 22);
  assert.equal(v(verses, 20), "Nothing will be impossible.");
  assert.equal(v(verses, 21), "");
  assert.equal(v(verses, 22), "As they gathered.");
});

test("a chapter with no verse markers extracts to null", () => {
  // How a draft/stub chapter reaches the caller, which skips it.
  assert.equal(extractVerses([`<p id="p1">Coming soon.</p>`]), null);
  assert.equal(extractVerses([]), null);
  assert.equal(extractVerses(undefined), null);
});
