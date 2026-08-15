// scripts/reconcile/test/curl-quotes.test.mjs
//
// Unit tests for scripts/reconcile/lib/curl-quotes.mjs - straight-to-curly
// quote normalization for restored master text, so it satisfies
// `curly_quotes_in_prose` (FATAL in scripts/validate-chapters.mjs). See that
// module's header for the design rationale (apostrophe-vs-quote ambiguity,
// independent double/single toggles, U+2032 PRIME, tag-awareness, refusal
// over guessing). Run with `node --test scripts/reconcile/test/`.
import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { curlify, matchesValidatorPredicate, auditWrongDirectionPairs } from "../lib/curl-quotes.mjs";

describe("curlify - basic quote pairs", () => {
  test("curls a plain double-quote pair", () => {
    const r = curlify('He said "hello" to her.');
    assert.equal(r.ok, true);
    assert.equal(r.result, "He said “hello” to her.");
  });

  test("curls a standalone single-quote gloss with no enclosing double", () => {
    // Real corpus usage (jude-1.json fn-ff): singles used independently for
    // short glosses/scare-quotes, not required to nest inside an open
    // double - see the module header for why this is NOT the traditional
    // strict outer/inner requirement.
    const r = curlify("Traditionally, 'saints' or 'holy ones'.");
    assert.equal(r.ok, true);
    assert.equal(r.result, "Traditionally, ‘saints’ or ‘holy ones’.");
  });
});

describe("curlify - apostrophes", () => {
  test("word-internal apostrophe (contraction)", () => {
    const r = curlify("She didn't go.");
    assert.equal(r.ok, true);
    assert.equal(r.result, "She didn’t go.");
  });

  test("trailing possessive apostrophe with nothing open", () => {
    const r = curlify("For Jesus' sake, listen.");
    assert.equal(r.ok, true);
    assert.equal(r.result, "For Jesus’ sake, listen.");
  });

  test("closing punctuation inside the quote (American style) still closes correctly", () => {
    // The exact real-corpus pattern that broke the first version of this
    // heuristic: the period sits INSIDE the closing quote, so the character
    // immediately before the closer is "." not a letter.
    const r = curlify("Traditionally, 'holy ones.' serves as a gloss.");
    assert.equal(r.ok, true);
    assert.equal(r.result, "Traditionally, ‘holy ones.’ serves as a gloss.");
  });
});

describe("curlify - idempotency over already-curly text", () => {
  test("already-fully-curly text passes through byte-identical", () => {
    const already = "Traditionally, ‘saints’ or ‘holy ones.’ “People” serves.";
    const r = curlify(already);
    assert.equal(r.ok, true);
    assert.equal(r.result, already);
  });

  test("mixed straight and curly within one sentence (the documented master pattern)", () => {
    const mixed = "He said “hello” and then 'goodbye' quickly.";
    const r = curlify(mixed);
    assert.equal(r.ok, true);
    assert.equal(r.result, "He said “hello” and then ‘goodbye’ quickly.");
  });
});

describe("curlify - PRIME (U+2032) is never touched", () => {
  test("chiasm-label primes pass through unchanged alongside curled quotes", () => {
    const withPrime = 'Chiasm: A B C D D′ C′ B′ A′ and "quoted" text.';
    const r = curlify(withPrime);
    assert.equal(r.ok, true);
    assert.match(r.result, /D′ C′ B′ A′/);
    assert.match(r.result, /“quoted”/);
  });
});

describe("curlify - refusal over guessing", () => {
  test("refuses when a quote never closes (genuinely unbalanced)", () => {
    const r = curlify('She said "the term \'agape means love.');
    assert.equal(r.ok, false);
    assert.equal(r.subclass, "quote-ambiguous");
  });

  test("refuses on a bare apostrophe with no word character on either side", () => {
    const r = curlify("weird ' . spacing");
    assert.equal(r.ok, false);
    assert.equal(r.subclass, "quote-ambiguous");
  });

  test("refuses on existing-curly double-inside-double (a real defect, not guessed past)", () => {
    const r = curlify("He said “the term “kalos” means good.");
    assert.equal(r.ok, false);
  });
});

describe("curlify - tag awareness", () => {
  test("leaves attribute quotes inside a tag untouched, curls prose quotes", () => {
    const html = 'He said <a href="https://example.com">"hello"</a> to her.';
    const r = curlify(html);
    assert.equal(r.ok, true);
    assert.match(r.result, /href="https:\/\/example\.com"/);
    assert.match(r.result, /“hello”/);
  });

  test("correctly resolves an apostrophe immediately after a closing tag", () => {
    const html = "The term <em>kalos</em>'s meaning is good.";
    const r = curlify(html);
    assert.equal(r.ok, true);
    assert.match(r.result, /<\/em>’s/);
  });
});

describe("curlify - throws for non-string input, never for ordinary refusal", () => {
  test("throws a TypeError-shaped error for non-string input", () => {
    assert.throws(() => curlify(42), /expected a string/);
  });
});

describe("matchesValidatorPredicate - mirrors scripts/validate-chapters.mjs", () => {
  test("straight double quote fails", () => {
    assert.equal(matchesValidatorPredicate('He said "hi"'), false);
  });
  test("curly double quote passes", () => {
    assert.equal(matchesValidatorPredicate("He said “hi”"), true);
  });
  test("quote entity fails", () => {
    assert.equal(matchesValidatorPredicate("He said &quot;hi&quot;"), false);
  });
  test("apos entity fails", () => {
    assert.equal(matchesValidatorPredicate("It&#39;s fine"), false);
  });
  test("attribute quotes inside a tag are exempt", () => {
    assert.equal(matchesValidatorPredicate('<a href="x">text</a>'), true);
  });
});

describe("curlify - every ok:true result satisfies the validator predicate (self-assert)", () => {
  const samples = [
    'He said "hello" to her.',
    "She didn't go.",
    "For Jesus' sake, listen.",
    "Traditionally, 'saints' or 'holy ones.' \"People who were dedicated\" serves.",
    'Chiasm: A B C D D′ C′ B′ A′ and "quoted" text.',
    'He said <a href="https://example.com">"hello"</a> to her.',
    "The term <em>kalos</em>'s meaning is good.",
  ];
  for (const s of samples) {
    test(`sample: ${JSON.stringify(s).slice(0, 50)}...`, () => {
      const r = curlify(s);
      if (r.ok) assert.equal(matchesValidatorPredicate(r.result), true);
    });
  }
});

describe("auditWrongDirectionPairs", () => {
  test("finds a wrong-direction pair (opener single, closer double)", () => {
    const findings = auditWrongDirectionPairs("He is ‘lord” of all.");
    assert.equal(findings.length, 1);
    assert.equal(findings[0].kind, "wrong-direction");
  });

  test("finds a wrong-direction pair the other way (opener double, closer single)", () => {
    const findings = auditWrongDirectionPairs("He said “hello’ to her.");
    assert.equal(findings.length, 1);
    assert.equal(findings[0].kind, "wrong-direction");
  });

  test("correctly-paired text has no findings", () => {
    const findings = auditWrongDirectionPairs("Traditionally, ‘saints’ or “holy ones” serves.");
    assert.equal(findings.length, 0);
  });

  test("ignores ordinary apostrophes entirely", () => {
    const findings = auditWrongDirectionPairs("She didn’t go, and it’s fine, and the boys’ toys were fun.");
    assert.equal(findings.length, 0);
  });

  test("does not require any straight quotes - operates on already-curly text", () => {
    // The real defect this exists to catch (CLAUDE.md, colossians-1 note):
    // an opening ‘ paired with a wrong-direction ” closer, already present
    // in already-published, fully-curly text.
    const findings = auditWrongDirectionPairs("He used ‘the term lord” loosely.");
    assert.equal(findings.length, 1);
  });
});
