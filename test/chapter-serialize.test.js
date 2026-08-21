import test from "node:test";
import assert from "node:assert/strict";

import { serializeChapter } from "../scripts/lib/chapter-serialize.mjs";

const chapter = (over = {}) => ({
  bookKey: "john",
  chapter: 3,
  indexed: true,
  type: "scripture",
  title: "John 3",
  description: "John 3 in the Liberation and Inclusion Translation (LIT).",
  topics: ["Nicodemus"],
  paragraphs: ['<p id="john-3-p1">text</p>'],
  footnotes: [],
  ...over,
});

test("serializeChapter: each footnote is written on exactly one line", () => {
  const out = serializeChapter(
    chapter({
      footnotes: [
        { id: "fn-a", refId: "fnref-a", label: "a", html: "First note." },
        { id: "fn-b", refId: "fnref-b", label: "b", html: "Second note." },
      ],
    }),
  );

  assert.match(out, /^ {4}\{ "id": "fn-a", "refId": "fnref-a", "label": "a", "html": "First note\." \},$/m);
  assert.match(out, /^ {4}\{ "id": "fn-b", "refId": "fnref-b", "label": "b", "html": "Second note\." \}$/m);
});

test("serializeChapter: round-trips to an identical object", () => {
  const data = chapter({
    footnotes: [{ id: "fn-a", refId: "fnref-a", label: "a", html: "Note." }],
  });
  assert.deepEqual(JSON.parse(serializeChapter(data)), data);
});

test("serializeChapter: output ends with exactly one trailing newline", () => {
  const out = serializeChapter(
    chapter({ footnotes: [{ id: "fn-a", refId: "fnref-a", label: "a", html: "Note." }] }),
  );
  assert.ok(out.endsWith("}\n"));
  assert.ok(!out.endsWith("\n\n"));
});

test("serializeChapter: a chapter with no footnotes is plain 2-space JSON", () => {
  const data = chapter();
  assert.equal(serializeChapter(data), `${JSON.stringify(data, null, 2)}\n`);
  assert.match(serializeChapter(data), /^ {2}"footnotes": \[\]$/m);
});

test("serializeChapter: a missing footnotes array is left alone rather than invented", () => {
  const data = chapter();
  delete data.footnotes;
  const out = serializeChapter(data);
  assert.equal(out, `${JSON.stringify(data, null, 2)}\n`);
  assert.ok(!out.includes("footnotes"));
});

test("serializeChapter: is idempotent — re-serializing its own output changes nothing", () => {
  const data = chapter({
    footnotes: [
      { id: "fn-a", refId: "fnref-a", label: "a", html: "One." },
      { id: "fn-b", refId: "fnref-b", label: "b", html: "Two." },
    ],
  });
  const once = serializeChapter(data);
  assert.equal(serializeChapter(JSON.parse(once)), once);
});

test("serializeChapter: footnote html containing $ patterns survives replacement", () => {
  // String.prototype.replace treats $&, $1, $` in the REPLACEMENT specially, so
  // the substitution has to be function-form. A footnote quoting a regex or a
  // price would otherwise be silently corrupted.
  const html = "Costs $5. See $& and $1 and $` and $$.";
  const out = serializeChapter(
    chapter({ footnotes: [{ id: "fn-a", refId: "fnref-a", label: "a", html }] }),
  );
  assert.equal(JSON.parse(out).footnotes[0].html, html);
});

test("serializeChapter: curly quotes and em dashes are emitted literally, not escaped", () => {
  // The corpus convention is curly quotes; \u-escaping them would pass JSON.parse
  // while making every chapter file unreadable and every diff enormous.
  const html = "Traditionally, ‘church’ — see “the entry for \"X\"”.";
  const out = serializeChapter(
    chapter({ footnotes: [{ id: "fn-a", refId: "fnref-a", label: "a", html }] }),
  );
  assert.ok(out.includes("‘church’ — see"));
  assert.equal(JSON.parse(out).footnotes[0].html, html);
});

test("serializeChapter: preserves footnote key order as authored", () => {
  const out = serializeChapter(
    chapter({ footnotes: [{ label: "a", html: "Note.", id: "fn-a", refId: "fnref-a" }] }),
  );
  assert.match(out, /\{ "label": "a", "html": "Note\.", "id": "fn-a", "refId": "fnref-a" \}/);
});

test("serializeChapter: a footnote whose text mimics the internal placeholder is not corrupted", () => {
  // The placeholder is NUL-delimited precisely so content cannot collide with it;
  // this pins that the bare (NUL-free) lookalike is treated as ordinary text.
  const html = "chapter-footnote-0";
  const out = serializeChapter(
    chapter({
      footnotes: [
        { id: "fn-a", refId: "fnref-a", label: "a", html },
        { id: "fn-b", refId: "fnref-b", label: "b", html: "Real." },
      ],
    }),
  );
  const parsed = JSON.parse(out);
  assert.equal(parsed.footnotes[0].html, html);
  assert.equal(parsed.footnotes[1].html, "Real.");
});
