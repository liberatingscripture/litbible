// test/draft-release-notes.test.js
//
// Golden tests for scripts/lib/release-notes-core.mjs — the pure diff→changes
// core of the release-notes drafter. The drafter's change-object output is a
// documented contract with the iOS/Android apps (their "Translation Updates"
// feed): type + self-contained description, plus additive/optional
// detail/location/relabel (see the docblock in scripts/draft-release-notes.mjs).
// It runs automatically on every push to main, so a silent shape regression
// would ship straight to the apps — these tests pin the shapes down.
//
// No git and no disk: buildChanges takes the added/modified file lists and two
// content-lookup callbacks, so each case builds a tiny in-memory pair of file
// maps (base = content at the compare ref, now = current content). This mirrors
// the "tiny in-memory corpus" approach in test/search-core.test.js and the
// black-box, through-the-public-entry-point style of test/chapter-html.test.js.
//
// buildChanges was verified byte-for-byte against the pre-refactor script on a
// real 92-change range (see FIXLIST O11); these fixtures then exercise each
// documented behavior in isolation.

import { test } from "node:test";
import assert from "node:assert/strict";

import { buildChanges } from "../scripts/lib/release-notes-core.mjs";

/* ── Fixture builders ─────────────────────────────────────────────────────
 * Small helpers that emit chapter JSON shaped like the real files, so the
 * verse-glue split, footnote-ref matching, and stripHtml passes all see what
 * they see in production (see any src/data/chapters/*.json). */

/** One verse: `<span class="vglue"><sup id="vN">N</sup>&nbsp;First</span> rest`
 *  plus optional trailing footnote-ref superscripts for the given labels. */
function verse(n, text, fnRefs = []) {
  const words = text.split(" ");
  const rest = words.length > 1 ? " " + words.slice(1).join(" ") : "";
  const refs = fnRefs
    .map(
      (l) =>
        `<sup class="fn-ref"><a id="fnref-${l}" href="#fn-${l}" role="doc-noteref">${l}</a></sup>`,
    )
    .join("");
  return `<span class="vglue"><sup id="v${n}" class="vn">${n}</sup>&nbsp;${words[0]}</span>${rest}${refs}`;
}

const para = (id, ...verses) => `<p id="${id}">${verses.join(" ")}</p>`;
const fn = (label, html) => ({ id: `fn-${label}`, refId: `fnref-${label}`, label, html });

/** Serialize a chapter object the way a real chapter file looks. Only
 *  paragraphs / footnotes / indexed feed the diff; title/description/topics are
 *  present so a "metadata-only" edit can plausibly differ without touching
 *  reader-facing content. */
const chapterJson = ({
  bookKey = "john",
  chapter = 3,
  indexed = true,
  paragraphs = [],
  footnotes = [],
  title = "x",
  description = "x",
  topics = [],
}) =>
  JSON.stringify({
    bookKey,
    chapter,
    type: "scripture",
    title,
    description,
    topics,
    indexed,
    paragraphs,
    footnotes,
  });

/** Run buildChanges against in-memory base/now file maps. */
function run(base, now, { added = [], modified = [] } = {}) {
  const b = new Map(Object.entries(base));
  const n = new Map(Object.entries(now));
  return buildChanges({
    addedFiles: added,
    modifiedFiles: modified,
    readBase: (f) => (b.has(f) ? b.get(f) : null),
    readNow: (f) => (n.has(f) ? n.get(f) : null),
  });
}

const F = "src/data/chapters/john-3.json";

/* ── 1. New chapters ──────────────────────────────────────────────────── */

test("chapter added: single added file → chapter_added, no detail, location without verse", () => {
  const changes = run({}, { [F]: chapterJson({ paragraphs: [para("p1", verse(1, "In the beginning."))] }) }, {
    added: [F],
  });
  assert.deepEqual(changes, [
    { type: "chapter_added", description: "John 3 added", location: { bookKey: "john", chapter: 3 } },
  ]);
});

test("whole book added: every chapter of a 1-chapter book → 'Philemon added'", () => {
  const PHM = "src/data/chapters/philemon-1.json";
  const changes = run(
    {},
    { [PHM]: chapterJson({ bookKey: "philemon", chapter: 1, paragraphs: [para("p1", verse(1, "Paul, a prisoner."))] }) },
    { added: [PHM] },
  );
  assert.deepEqual(changes, [
    { type: "chapter_added", description: "Philemon added", location: { bookKey: "philemon", chapter: 1 } },
  ]);
});

test("placeholder → real: indexed false→true is a chapter_added, not a text edit", () => {
  const changes = run(
    { [F]: chapterJson({ indexed: false, paragraphs: [] }) },
    { [F]: chapterJson({ indexed: true, paragraphs: [para("p1", verse(1, "Now real content."))] }) },
    { modified: [F] },
  );
  assert.deepEqual(changes, [
    { type: "chapter_added", description: "John 3 added", location: { bookKey: "john", chapter: 3 } },
  ]);
});

test("still a placeholder: indexed stays false → no change emitted", () => {
  const changes = run(
    { [F]: chapterJson({ indexed: false, paragraphs: [] }) },
    { [F]: chapterJson({ indexed: false, paragraphs: [para("p1", verse(1, "work in progress"))] }) },
    { modified: [F] },
  );
  assert.deepEqual(changes, []);
});

/* ── 2. Verse text updates ────────────────────────────────────────────── */

test("single verse text: text_updated with before→after detail and location.verse", () => {
  const changes = run(
    { [F]: chapterJson({ paragraphs: [para("p1", verse(16, "For God so loved."))] }) },
    { [F]: chapterJson({ paragraphs: [para("p1", verse(16, "For God really loved."))] }) },
    { modified: [F] },
  );
  assert.deepEqual(changes, [
    {
      type: "text_updated",
      description: "John 3:16 — text updated",
      detail: '"so" → "really"',
      location: { bookKey: "john", chapter: 3, verse: 16 },
    },
  ]);
  // A single-verse detail carries no "v. N:" prefix (the location pinpoints it).
  assert.ok(!changes[0].detail.includes("v. 16:"));
});

test("multiple verses: description uses a compact en-dash range, detail prefixes v. N, anchor = smallest", () => {
  const base = chapterJson({
    paragraphs: [para("p1", verse(1, "One x."), verse(2, "Two x."), verse(3, "Three x."), verse(4, "Four x."), verse(5, "Five x."))],
  });
  const now = chapterJson({
    paragraphs: [para("p1", verse(1, "One CHG."), verse(2, "Two CHG."), verse(3, "Three CHG."), verse(4, "Four x."), verse(5, "Five CHG."))],
  });
  const changes = run({ [F]: base }, { [F]: now }, { modified: [F] });
  assert.equal(changes.length, 1);
  const [c] = changes;
  assert.equal(c.type, "text_updated");
  assert.equal(c.description, "John 3:1–3, 5 — text updated");
  assert.match(c.detail, /^v\. 1: .+; v\. 2: .+; v\. 3: .+; v\. 5: /);
  assert.deepEqual(c.location, { bookKey: "john", chapter: 3, verse: 1 }); // anchor = min verse
});

/* ── 3. Footnotes ─────────────────────────────────────────────────────── */

test("footnote updated: footnote_updated with the letter, detail, and no relabel", () => {
  const changes = run(
    { [F]: chapterJson({ paragraphs: [para("p1", verse(1, "Word here.", ["a"]))], footnotes: [fn("a", "Old note")] }) },
    { [F]: chapterJson({ paragraphs: [para("p1", verse(1, "Word here.", ["a"]))], footnotes: [fn("a", "New note")] }) },
    { modified: [F] },
  );
  assert.deepEqual(changes, [
    {
      type: "footnote_updated",
      description: "John 3:1 — footnote a updated",
      detail: '"Old" → "New"',
      location: { bookKey: "john", chapter: 3, verse: 1 },
    },
  ]);
  assert.ok(!("relabel" in changes[0]));
});

test("footnote appended at end (no cascade): footnote_added", () => {
  const changes = run(
    { [F]: chapterJson({ paragraphs: [para("p1", verse(1, "Word here.", ["a"]))], footnotes: [fn("a", "A")] }) },
    { [F]: chapterJson({ paragraphs: [para("p1", verse(1, "Word here.", ["a", "b"]))], footnotes: [fn("a", "A"), fn("b", "B")] }) },
    { modified: [F] },
  );
  assert.deepEqual(changes, [
    {
      type: "footnote_added",
      description: "John 3:1 — footnote b added",
      detail: 'added "B"',
      location: { bookKey: "john", chapter: 3, verse: 1 },
    },
  ]);
});

test("footnote inserted mid-list: relabel cascade split into its own field, type stays footnote_updated", () => {
  // Insert a new note at label b; old b→c, c→d cascade.
  const base = chapterJson({ paragraphs: [para("p1", verse(1, "Word.", ["a", "b", "c"]))], footnotes: [fn("a", "A"), fn("b", "B"), fn("c", "C")] });
  const now = chapterJson({ paragraphs: [para("p1", verse(1, "Word.", ["a", "b", "c", "d"]))], footnotes: [fn("a", "A"), fn("b", "NEW"), fn("c", "B"), fn("d", "C")] });
  const changes = run({ [F]: base }, { [F]: now }, { modified: [F] });
  assert.equal(changes.length, 1);
  const [c] = changes;
  // The relabel note lives ONLY in `relabel`; description keeps the human ref + letter.
  assert.equal(c.type, "footnote_updated"); // relabelSummary present ⇒ never footnote_added
  assert.equal(c.description, "John 3:1 — footnote b updated");
  assert.ok(!/relabel/.test(c.description));
  assert.equal(c.relabel, "footnotes formerly b–c relabeled c–d");
  assert.equal(c.detail, '"B" → "NEW"');
});

test("footnote removed mid-list: negative-shift cascade also reported via relabel", () => {
  // Remove note B; old c→b, d→c cascade (shift -1).
  const base = chapterJson({ paragraphs: [para("p1", verse(1, "Word.", ["a", "b", "c", "d"]))], footnotes: [fn("a", "A"), fn("b", "B"), fn("c", "C"), fn("d", "D")] });
  const now = chapterJson({ paragraphs: [para("p1", verse(1, "Word.", ["a", "b", "c"]))], footnotes: [fn("a", "A"), fn("b", "C"), fn("c", "D")] });
  const changes = run({ [F]: base }, { [F]: now }, { modified: [F] });
  assert.equal(changes.length, 1);
  assert.equal(changes[0].type, "footnote_updated");
  assert.equal(changes[0].relabel, "footnotes formerly c–d relabeled b–c");
  assert.ok(!/relabel/.test(changes[0].description));
});

/* ── 4. Metadata-only + attribute-only collapse (FIXLIST O11 core behaviors) ── */

test("metadata-only chapter edit: identical rendered content collapses to one metadata_updated line", () => {
  // Paragraphs + footnotes byte-identical; only title/topics differ — but the
  // diff never reads those, so this stands in for any non-content edit.
  const paras = [para("p1", verse(1, "Unchanged verse."))];
  const changes = run(
    { [F]: chapterJson({ paragraphs: paras, title: "Old", topics: ["x"] }) },
    { [F]: chapterJson({ paragraphs: paras, title: "New", topics: ["y"] }) },
    { modified: [F] },
  );
  assert.deepEqual(changes, [
    { type: "metadata_updated", description: "John 3 — metadata updated", location: { bookKey: "john", chapter: 3 } },
  ]);
});

test("attribute-only paragraph edit: a class/id-only change collapses to metadata_updated (fix 1b), not a noisy text_updated", () => {
  const base = chapterJson({ paragraphs: [para("p1", verse(1, "Alpha word."))] });
  // Same visible text; only a non-content attribute (class) added to the <p>.
  const nowPara = '<p id="p1" class="lead"><span class="vglue"><sup id="v1" class="vn">1</sup>&nbsp;Alpha</span> word.</p>';
  const changes = run({ [F]: base }, { [F]: chapterJson({ paragraphs: [nowPara] }) }, { modified: [F] });
  assert.deepEqual(changes, [
    { type: "metadata_updated", description: "John 3 — metadata updated", location: { bookKey: "john", chapter: 3 } },
  ]);
  assert.ok(!changes.some((c) => c.type === "text_updated"));
});

test("many metadata-only chapters: collapse to a single count line with no location (flood guard)", () => {
  const F2 = "src/data/chapters/john-4.json";
  const p3 = [para("p1", verse(1, "a."))];
  const p4 = [para("p1", verse(1, "b."))];
  const changes = run(
    { [F]: chapterJson({ paragraphs: p3, title: "o" }), [F2]: chapterJson({ chapter: 4, paragraphs: p4, title: "o" }) },
    { [F]: chapterJson({ paragraphs: p3, title: "n" }), [F2]: chapterJson({ chapter: 4, paragraphs: p4, title: "n" }) },
    { modified: [F, F2] },
  );
  assert.deepEqual(changes, [{ type: "metadata_updated", description: "Metadata updated (2 chapters)" }]);
  assert.ok(!("location" in changes[0]));
});

/* ── 5. Intros / glossary / articles ──────────────────────────────────── */

test("intro added and updated both use type intro_updated; attribute-only markdown edit emits nothing", () => {
  const IN = "src/data/intros/mark-intro.md";
  assert.deepEqual(run({}, { [IN]: "# Mark\n\nAn intro." }, { added: [IN] }), [
    { type: "intro_updated", description: "Mark Introduction added" },
  ]);
  assert.deepEqual(run({ [IN]: "# Mark\n\nOld." }, { [IN]: "# Mark\n\nNew words." }, { modified: [IN] }), [
    { type: "intro_updated", description: "Mark Introduction updated" },
  ]);
  // Dropping target="_blank" is a mechanical edit — no reader-facing change.
  assert.deepEqual(
    run(
      { [IN]: '# Mark\n\n<a href="/x" target="_blank">link</a>' },
      { [IN]: '# Mark\n\n<a href="/x">link</a>' },
      { modified: [IN] },
    ),
    [],
  );
});

test("glossary: traditional frontmatter parsed quoted and unquoted; attribute-only edit emits nothing", () => {
  const GQ = "src/content/glossary/good-tov.md";
  const GU = "src/content/glossary/angel-messenger.md";
  assert.deepEqual(run({}, { [GQ]: 'traditional: "Good [1]"\nlit: Tov\n---\nbody' }, { added: [GQ] }), [
    { type: "glossary_added", description: "Glossary entry for Good [1] added" },
  ]);
  assert.deepEqual(run({}, { [GU]: "traditional: Angel\nlit: Messenger\n---\nbody" }, { added: [GU] }), [
    { type: "glossary_added", description: "Glossary entry for Angel added" },
  ]);
  assert.deepEqual(
    run({ [GQ]: 'traditional: "Good [1]"\n---\nold' }, { [GQ]: 'traditional: "Good [1]"\n---\nnew body' }, { modified: [GQ] }),
    [{ type: "glossary_updated", description: "Glossary entry for Good [1] updated" }],
  );
  assert.deepEqual(
    run(
      { [GQ]: 'traditional: "Good [1]"\n---\n<a href="/x" target="_blank">l</a>' },
      { [GQ]: 'traditional: "Good [1]"\n---\n<a href="/x">l</a>' },
      { modified: [GQ] },
    ),
    [],
  );
});

test("articles: added/updated de-hyphenate the slug; attribute-only edit emits nothing", () => {
  const AR = "src/content/articles/why-we-translate.md";
  assert.deepEqual(run({}, { [AR]: "# Why\n\nbody" }, { added: [AR] }), [
    { type: "article_added", description: "Article added: why we translate" },
  ]);
  assert.deepEqual(run({ [AR]: "# Why\n\nold" }, { [AR]: "# Why\n\nnew body" }, { modified: [AR] }), [
    { type: "article_updated", description: "Article updated: why we translate" },
  ]);
  assert.deepEqual(
    run(
      { [AR]: '# Why\n\n<a href="/x" target="_blank">l</a>' },
      { [AR]: '# Why\n\n<a href="/x">l</a>' },
      { modified: [AR] },
    ),
    [],
  );
});

/* ── 6. Empty result ──────────────────────────────────────────────────── */

test("no relevant files: buildChanges returns an empty array", () => {
  assert.deepEqual(run({}, {}, { added: [], modified: [] }), []);
  // A non-content file (e.g. a style change) is ignored entirely.
  assert.deepEqual(
    run({ "src/styles/global.css": "a{}" }, { "src/styles/global.css": "a{color:red}" }, { modified: ["src/styles/global.css"] }),
    [],
  );
});
