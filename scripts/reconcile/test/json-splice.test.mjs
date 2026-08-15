// scripts/reconcile/test/json-splice.test.mjs
//
// Unit tests for scripts/reconcile/lib/json-splice.mjs - the safety-critical
// module of this reconciliation (see its own header): it replaces exactly
// one JSON string value's byte span in a whole chapter file's raw text,
// never via JSON.parse -> JSON.stringify (which would reformat 169 of 260
// files on `main` and move every one of their manifest hashes for zero
// content change - see CLAUDE.md's Phase 3 notes).
//
// Fixtures are hand-written raw JSON text (not built via JSON.stringify), so
// each test controls its exact byte layout - reproducing both serialization
// styles on `main` (canonical multi-line vs. Prettier-style conditional
// one-line footnote objects) and the two `\uXXXX`-escape conventions found
// in the real corpus (colossians-3.json/ephesians-5.json/luke-13.json),
// without depending on live chapter files that could change under this test
// later. Run with `node --test scripts/reconcile/test/`.
import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { locateStringSpan, spliceValue, encodeLike, encodeJsonString, usesUnicodeEscapes } from "../lib/json-splice.mjs";

// A canonical multi-line fixture (the `JSON.stringify(data, null, 2) + "\n"`
// shape `npm run fix:chapters` produces).
const CANONICAL = `{
  "bookKey": "testbook",
  "chapter": 1,
  "type": "scripture",
  "title": "Testbook 1",
  "paragraphs": [
    "<p id=\\"testbook-1-p1\\">Hello world.</p>",
    "<p id=\\"testbook-1-p2\\">Second paragraph.</p>"
  ],
  "footnotes": [
    {
      "id": "fn-a",
      "refId": "fnref-a",
      "label": "a",
      "html": "First footnote text."
    },
    {
      "id": "fn-b",
      "refId": "fnref-b",
      "label": "b",
      "html": "Second footnote text."
    }
  ],
  "indexed": true
}
`;

// A conditional one-line-footnote fixture - the OTHER style present on
// `main` (169 of 260 files), where short footnote objects collapse to one
// line instead of the canonical multi-line spread.
const ONE_LINE_FOOTNOTES = `{
  "bookKey": "testbook",
  "chapter": 2,
  "paragraphs": [
    "<p id=\\"testbook-2-p1\\">Hi there.</p>"
  ],
  "footnotes": [
    { "id": "fn-a", "refId": "fnref-a", "label": "a", "html": "Short note." },
    { "id": "fn-b", "refId": "fnref-b", "label": "b", "html": "Another short note." }
  ],
  "indexed": true
}
`;

// \uXXXX-escaped curly quotes (matches luke-13.json's convention: escaped
// throughout) vs. literal UTF-8 curly quotes (matches the far more common
// convention, e.g. colossians-3.json).
const ESCAPED_QUOTES = `{
  "footnotes": [
    { "id": "fn-a", "refId": "fnref-a", "label": "a", "html": "He said \\u201chello\\u201d to her." }
  ]
}
`;
const LITERAL_QUOTES = `{
  "footnotes": [
    { "id": "fn-a", "refId": "fnref-a", "label": "a", "html": "He said “hello” to her." }
  ]
}
`;

// No trailing newline (12 files on `main`).
const NO_TRAILING_NEWLINE = `{"bookKey":"t","paragraphs":["<p>x</p>"],"footnotes":[{"id":"fn-a","html":"y"}]}`;

describe("locateStringSpan", () => {
  test("locates a top-level array element (paragraphs[0])", () => {
    const span = locateStringSpan(CANONICAL, ["paragraphs", 0]);
    const text = CANONICAL.slice(span.start, span.end);
    assert.equal(JSON.parse(text), '<p id="testbook-1-p1">Hello world.</p>');
  });

  test("locates a nested object field (footnotes[1].html)", () => {
    const span = locateStringSpan(CANONICAL, ["footnotes", 1, "html"]);
    const text = CANONICAL.slice(span.start, span.end);
    assert.equal(JSON.parse(text), "Second footnote text.");
  });

  test("locates correctly in the one-line-footnote style too", () => {
    const span = locateStringSpan(ONE_LINE_FOOTNOTES, ["footnotes", 1, "html"]);
    const text = ONE_LINE_FOOTNOTES.slice(span.start, span.end);
    assert.equal(JSON.parse(text), "Another short note.");
  });

  test("throws a clear error for a missing key", () => {
    assert.throws(() => locateStringSpan(CANONICAL, ["footnotes", 0, "nope"]), /not found/);
  });

  test("throws for an out-of-bounds array index", () => {
    assert.throws(() => locateStringSpan(CANONICAL, ["footnotes", 99, "html"]), /out of bounds/);
  });

  test("throws when the path points at a non-string value", () => {
    assert.throws(() => locateStringSpan(CANONICAL, ["chapter"]), /does not point to a string/);
  });
});

describe("spliceValue - round trips", () => {
  test("round-trips a paragraph replacement (canonical style)", () => {
    const oldValue = '<p id="testbook-1-p1">Hello world.</p>';
    const newValue = '<p id="testbook-1-p1">Hello, restored world.</p>';
    const newRaw = spliceValue(CANONICAL, ["paragraphs", 0], oldValue, newValue);
    const reparsed = JSON.parse(newRaw);
    assert.equal(reparsed.paragraphs[0], newValue);
    // Nothing else changed.
    assert.equal(reparsed.paragraphs[1], JSON.parse(CANONICAL).paragraphs[1]);
    assert.deepEqual(reparsed.footnotes, JSON.parse(CANONICAL).footnotes);
  });

  test("round-trips a footnote html replacement (one-line-footnote style)", () => {
    const oldValue = "Another short note.";
    const newValue = "Another short note, restored.";
    const newRaw = spliceValue(ONE_LINE_FOOTNOTES, ["footnotes", 1, "html"], oldValue, newValue);
    const reparsed = JSON.parse(newRaw);
    assert.equal(reparsed.footnotes[1].html, newValue);
    assert.equal(reparsed.footnotes[0].html, "Short note.");
  });

  test("splice then reverse-splice returns the byte-identical original", () => {
    const oldValue = JSON.parse(CANONICAL).paragraphs[0];
    const newValue = oldValue + " EDITED";
    const forward = spliceValue(CANONICAL, ["paragraphs", 0], oldValue, newValue);
    const back = spliceValue(forward, ["paragraphs", 0], newValue, oldValue);
    assert.equal(back, CANONICAL);
  });
});

describe("spliceValue - encoding style preservation (encodeLike)", () => {
  test("preserves \\uXXXX-escape style when the existing span uses it", () => {
    const oldValue = "He said “hello” to her.";
    const newValue = oldValue + " “Again,” she said.";
    const newRaw = spliceValue(ESCAPED_QUOTES, ["footnotes", 0, "html"], oldValue, newValue);
    const span = locateStringSpan(newRaw, ["footnotes", 0, "html"]);
    const rawSpanText = newRaw.slice(span.start, span.end);
    assert.match(rawSpanText, /\\u201[cd]/i);
    assert.doesNotMatch(rawSpanText, /[“”]/);
    assert.equal(JSON.parse(newRaw).footnotes[0].html, newValue);
  });

  test("preserves literal-UTF-8 style when the existing span uses it", () => {
    const oldValue = "He said “hello” to her.";
    const newValue = oldValue + " ‘Again,’ she said.";
    const newRaw = spliceValue(LITERAL_QUOTES, ["footnotes", 0, "html"], oldValue, newValue);
    const span = locateStringSpan(newRaw, ["footnotes", 0, "html"]);
    const rawSpanText = newRaw.slice(span.start, span.end);
    assert.match(rawSpanText, /[‘’]/);
    assert.doesNotMatch(rawSpanText, /\\u201[89cd]/i);
    assert.equal(JSON.parse(newRaw).footnotes[0].html, newValue);
  });

  test("usesUnicodeEscapes detects each style correctly", () => {
    assert.equal(usesUnicodeEscapes('"He said \\u201chello\\u201d"'), true);
    assert.equal(usesUnicodeEscapes('"He said “hello”"'), false);
  });

  test("encodeJsonString always applies mandatory escapes regardless of style", () => {
    const withQuoteAndBackslash = 'She said "hi"\\done.';
    assert.equal(encodeJsonString(withQuoteAndBackslash), '"She said \\"hi\\"\\\\done."');
    assert.equal(JSON.parse(encodeJsonString(withQuoteAndBackslash)), withQuoteAndBackslash);
  });

  test("encodeLike matches an old span with mixed escape usage by escaping (safer default)", () => {
    // Mirrors the real ephesians-5.json case: one string mixes literal curly
    // quotes with a ’-escaped one. Any span containing at least one
    // \u escape is treated as "this string uses unicode escapes."
    const oldRawSpan = '"Traditionally, ‘revere’ or ‘respect’ (\\u201cfear\\u201d)"';
    const encoded = encodeLike("New ’value’ with “curly” chars", oldRawSpan);
    assert.doesNotMatch(encoded, /[‘’“”]/);
  });
});

describe("spliceValue - assertions / safety guards", () => {
  test("assertion 2 (stale oldValue) throws and does not modify anything", () => {
    assert.throws(
      () => spliceValue(CANONICAL, ["paragraphs", 0], "THIS IS NOT THE CURRENT VALUE", "whatever"),
      /assertion 2/,
    );
  });

  test("assertion 1 (parse succeeds) throws for invalid JSON input", () => {
    assert.throws(() => spliceValue("{not valid json", ["paragraphs", 0], "x", "y"), /assertion 1/);
  });

  test("a BOM'd file is rejected via assertion 1, not silently mishandled", () => {
    // JSON.parse does not strip a leading BOM, so this fails at the very
    // first assertion - confirmed no file in src/data/chapters/ currently
    // has one (a direct byte scan during this session found zero).
    const bomFile = "﻿" + NO_TRAILING_NEWLINE;
    assert.throws(() => spliceValue(bomFile, ["footnotes", 0, "html"], "y", "z"), /assertion 1/);
  });

  test("bytes outside the span are byte-for-byte identical to the original", () => {
    const oldValue = JSON.parse(CANONICAL).footnotes[0].html;
    const newValue = "Completely different replacement text.";
    const span = locateStringSpan(CANONICAL, ["footnotes", 0, "html"]);
    const newRaw = spliceValue(CANONICAL, ["footnotes", 0, "html"], oldValue, newValue);
    // The new span's own length differs, but everything strictly before and
    // after it must be untouched.
    const newSpan = locateStringSpan(newRaw, ["footnotes", 0, "html"]);
    assert.equal(CANONICAL.slice(0, span.start), newRaw.slice(0, newSpan.start));
    assert.equal(CANONICAL.slice(span.end), newRaw.slice(newSpan.end));
  });

  test("path addressing: identical text at two different paths only changes the targeted one", () => {
    const raw = `{"footnotes":[{"id":"fn-a","html":"same text"},{"id":"fn-b","html":"same text"}]}`;
    const newRaw = spliceValue(raw, ["footnotes", 1, "html"], "same text", "only fn-b changes");
    const reparsed = JSON.parse(newRaw);
    assert.equal(reparsed.footnotes[0].html, "same text");
    assert.equal(reparsed.footnotes[1].html, "only fn-b changes");
  });
});

describe("spliceValue - whitespace/BOM fingerprint", () => {
  test("preserves the absence of a trailing newline", () => {
    const oldValue = "y";
    const newRaw = spliceValue(NO_TRAILING_NEWLINE, ["footnotes", 0, "html"], oldValue, "z");
    assert.ok(!newRaw.endsWith("\n"));
    assert.equal(JSON.parse(newRaw).footnotes[0].html, "z");
  });

  test("preserves a trailing newline when the original has one", () => {
    const oldValue = JSON.parse(CANONICAL).footnotes[0].html;
    const newRaw = spliceValue(CANONICAL, ["footnotes", 0, "html"], oldValue, "z");
    assert.ok(newRaw.endsWith("\n") && !newRaw.endsWith("\n\n"));
  });
});

describe("spliceValue - escaped content inside the target string", () => {
  test("round-trips a value containing an embedded quote and backslash", () => {
    const raw = '{"footnotes":[{"id":"fn-a","html":"She said \\"hi\\" and left.\\\\"}]}';
    const oldValue = JSON.parse(raw).footnotes[0].html;
    assert.equal(oldValue, 'She said "hi" and left.\\');
    const newValue = 'New "quoted" text\\done.';
    const newRaw = spliceValue(raw, ["footnotes", 0, "html"], oldValue, newValue);
    assert.equal(JSON.parse(newRaw).footnotes[0].html, newValue);
  });
});
