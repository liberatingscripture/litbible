// test/build-glossary-feed.test.js
//
// Unit tests for scripts/lib/glossary-feed-core.mjs — the `{ entries, index }`
// document that ships to the iOS and Android apps as /api/data/glossary.json.
// Its shape is an app contract, so it is tested directly rather than through the
// writer, the same arrangement as test/draft-release-notes.test.js.
//
// No disk: every case is an inline entry file shaped like a real
// src/content/glossary/*.md. What these tests let through is what lands in a
// reader's Study tab, and the failure modes here are all silent ones — a
// missing `index` key makes iOS skip the file forever without an error, and an
// unresolved cross-reference just renders as plain text. Hence the emphasis on
// the throwing paths.

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  buildGlossaryFeed,
  parseEntryFile,
  readGlossaryFrontmatter,
  toPlainProse,
} from "../scripts/lib/glossary-feed-core.mjs";

/* ── Fixture builders ─────────────────────────────────────────────────────── */

/** One entry file: frontmatter block + body, as authored on disk. */
function entryFile(fields, body) {
  const lines = Object.entries(fields).map(([k, v]) => `${k}: ${v}`);
  return `---\n${lines.join("\n")}\n---\n${body}\n`;
}

/** A complete, valid entry — override only what a case is about. */
function validEntry(overrides = {}, body = "A definition.") {
  return {
    name: `${overrides.id ?? "sin-deviation"}.md`,
    raw: entryFile(
      {
        id: "sin-deviation",
        traditional: "Sin",
        greek: "hamartia",
        lit: "deviation",
        litMenu: "Deviation",
        srOnly: "Sin deviation",
        ...overrides,
      },
      body,
    ),
  };
}

const build = (...files) => buildGlossaryFeed(files).feed;

/* ── Frontmatter parsing ──────────────────────────────────────────────────── */

test("YAML quoting is stripped — the value of `\"Good [1]\"` is Good [1]", () => {
  // Reading the raw line instead is how quote characters reached both apps'
  // displayed text and broke that entry's cross-reference lookup.
  const fm = readGlossaryFrontmatter('---\nid: good-admirable\ntraditional: "Good [1]"\n---\nx');
  assert.equal(fm.traditional, "Good [1]");
});

test("parseEntryFile splits frontmatter from body and tolerates CRLF", () => {
  const parsed = parseEntryFile("---\r\nid: a\r\ntraditional: A\r\n---\r\nThe body.\r\n");
  assert.equal(parsed.frontmatter.id, "a");
  assert.equal(parsed.body, "The body.");
});

test("a file with no frontmatter is an error, not an empty entry", () => {
  assert.throws(() => build({ name: "loose.md", raw: "Just prose.\n" }), /no frontmatter/);
});

test("a missing required field names the field", () => {
  const { litMenu, ...rest } = {
    id: "x",
    traditional: "X",
    greek: "x",
    lit: "x",
    litMenu: "X",
    srOnly: "x",
  };
  assert.throws(
    () => build({ name: "x.md", raw: entryFile(rest, "Body.") }),
    /missing required frontmatter: litMenu/,
  );
});

/* ── Plain prose (rule 3) ─────────────────────────────────────────────────── */

test("single-asterisk emphasis is flattened, keeping the word", () => {
  // 59 of these across 23 entries — transliterated Greek. Neither app parses
  // Markdown, so the asterisks reach the screen.
  assert.equal(toPlainProse("The word *kalos* is positive."), "The word kalos is positive.");
});

test("bold and underscore emphasis flatten too, without decaying to single markers", () => {
  assert.equal(toPlainProse("**very** and __also__ and _this_"), "very and also and this");
});

test("Markdown backslash escapes are removed", () => {
  // `\[. . .\]` is a scholarly elision in law-torah; the backslashes are
  // visible on screen on both platforms today.
  assert.equal(toPlainProse("genres of Torah. \\[. . .\\] The Torah is"), "genres of Torah. [. . .] The Torah is");
});

test("an unmatched emphasis marker throws rather than shipping", () => {
  assert.throws(() => toPlainProse("a lone * marker", "x.md"), /unmatched/);
});

test("an escaped asterisk is not mistaken for an unmatched marker", () => {
  assert.equal(toPlainProse("five \\* three"), "five * three");
});

test("HTML, Markdown links, headings and backticks are rejected", () => {
  assert.throws(() => toPlainProse("an <em>emphasis</em> tag", "x.md"), /HTML tag/);
  assert.throws(() => toPlainProse("see [Spirit](/glossary/spirit)", "x.md"), /Markdown link/);
  assert.throws(() => toPlainProse("## Heading\nbody", "x.md"), /heading/);
  assert.throws(() => toPlainProse("a `code` span", "x.md"), /backtick/);
});

test("removals do not leave a double space behind", () => {
  assert.equal(toPlainProse("the word *nomos* here"), "the word nomos here");
  assert.equal(toPlainProse("a  b\t\tc"), "a b c");
});

test("paragraph breaks survive; single newlines do not become double", () => {
  assert.equal(toPlainProse("One.\n\nTwo.\n\n\n\nThree."), "One.\n\nTwo.\n\nThree.");
});

/* ── The index (rules 1 and 2) ────────────────────────────────────────────── */

test("the feed carries a top-level index — iOS cannot decode it otherwise", () => {
  const feed = build(validEntry());
  assert.deepEqual(Object.keys(feed).sort(), ["entries", "index"]);
  assert.deepEqual(Object.keys(feed.index).sort(), ["lit", "traditional"]);
});

test("index.traditional keys on `traditional`, never on `menuTraditional`", () => {
  // menuTraditional is a site-menu label: Trespass/Transgression where
  // traditional is Transgression. Substituting it changes displayed text.
  const feed = build(
    validEntry({
      id: "trespass-shortfall",
      traditional: "Transgression",
      menuTraditional: "Trespass/Transgression",
      litMenu: "Shortfall / Sidestep",
    }),
  );
  assert.deepEqual(feed.index.traditional, { Transgression: "trespass-shortfall" });
});

test("index.lit keys on `litMenu`, never on `lit`", () => {
  // lit differs from litMenu on 27 of 31 entries.
  const feed = build(
    validEntry({ lit: "self-preservation / family", litMenu: "Self-preservation / Family" }),
  );
  assert.deepEqual(Object.keys(feed.index.lit), ["Self-preservation / Family"]);
});

test("two entries sharing an index label is an error, not a silent overwrite", () => {
  assert.throws(
    () =>
      build(
        validEntry({ id: "a", traditional: "Good" }),
        validEntry({ id: "b", traditional: "Good", litMenu: "Other" }),
      ),
    /share the traditional label/,
  );
});

/* ── Cross-references (rule 4) ────────────────────────────────────────────── */

test("a cross-reference resolves through the [N] disambiguation", () => {
  // `the entry for "good [1]"` against the label `Good [1]`: iOS folds case and
  // drops brackets and hyphens on both sides.
  const feed = build(
    validEntry({ id: "bad-harmful", traditional: "Bad", litMenu: "Harmful" }, 'See the entry for "good [1]" below.'),
    validEntry({ id: "good-admirable", traditional: "Good [1]", litMenu: "Appealing / Admirable" }),
  );
  assert.equal(feed.entries.length, 2);
});

test("a cross-reference to a label no entry carries fails the build", () => {
  assert.throws(
    () => build(validEntry({}, 'See the entry for "purity" above.')),
    /no entry carries that label/,
  );
});

test("escaping is what killed the two live cross-references — unescaping revives them", () => {
  // `good \[1\]` normalized to `good \1\` on iOS and matched nothing.
  assert.throws(
    () => build(validEntry({}, 'See the entry for "good \\[1\\]" below.')),
    /no entry carries that label/,
  );
  const feed = build(
    validEntry({ id: "bad-harmful", traditional: "Bad", litMenu: "Harmful" }, 'See the entry for "good \\[1\\]".'),
    validEntry({ id: "good-admirable", traditional: "Good [1]", litMenu: "Appealing / Admirable" }),
  );
  assert.match(feed.entries[0].body, /the entry for "good \[1\]"/);
});

test("curly quotes around a cross-reference fail the build", () => {
  // iOS matches straight quotes only. The site's curly-quote convention is a
  // chapter-JSON rule and must not be applied to these phrases.
  assert.throws(
    () => build(validEntry({}, "See the entry for “bad” above.")),
    /curly quotes/,
  );
});

test("a cross-reference reaches the feed verbatim, never rewritten as a link", () => {
  const feed = build(
    validEntry({ id: "defiled-common", traditional: "Defiled/Profane", litMenu: "Ordinary / Unconsecrated" }, 'Compare the entry for "holy" here.'),
    validEntry({ id: "holy-sacred", traditional: "Holy", litMenu: "Sacred" }),
  );
  assert.equal(feed.entries[0].body, 'Compare the entry for "holy" here.');
});

/* ── Determinism and schema ───────────────────────────────────────────────── */

test("entries sort by id and index keys sort, whatever the input order", () => {
  const feed = build(
    validEntry({ id: "unclean-unclean", traditional: "Unclean", litMenu: "Unclean" }),
    validEntry({ id: "angel-message", traditional: "Angel", litMenu: "Messenger" }),
  );
  assert.deepEqual(
    feed.entries.map((e) => e.id),
    ["angel-message", "unclean-unclean"],
  );
  assert.deepEqual(Object.keys(feed.index.traditional), ["Angel", "Unclean"]);
  assert.deepEqual(Object.keys(feed.index.lit), ["Messenger", "Unclean"]);
});

test("identical input serializes byte-identically — the sync version depends on it", () => {
  const files = [
    validEntry({ id: "b", traditional: "B", litMenu: "Bee" }),
    validEntry({ id: "a", traditional: "A", litMenu: "Ay" }),
  ];
  assert.equal(JSON.stringify(build(...files)), JSON.stringify(build(...files)));
});

test("duplicate ids are an error", () => {
  assert.throws(
    () => build(validEntry({ id: "a", traditional: "A", litMenu: "Ay" }), validEntry({ id: "a", traditional: "B", litMenu: "Bee" })),
    /Duplicate glossary ids: a/,
  );
});

test("the full entry schema ships, including srOnly and the optional fields", () => {
  const feed = build(
    validEntry({
      id: "clean-clean",
      traditional: "Clean",
      litMenu: "Clean",
      srOnly: "Clean clean",
      note: "(prepared for sacred purposes)",
      menuTraditional: "Clean/Pure",
    }),
  );
  assert.deepEqual(Object.keys(feed.entries[0]), [
    "id",
    "traditional",
    "menuTraditional",
    "greek",
    "lit",
    "litMenu",
    "srOnly",
    "note",
    "body",
  ]);
});

test("optional fields are omitted rather than emitted as null", () => {
  const entry = build(validEntry()).entries[0];
  assert.equal("note" in entry, false);
  assert.equal("menuTraditional" in entry, false);
});
