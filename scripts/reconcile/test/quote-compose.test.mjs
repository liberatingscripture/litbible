import test from "node:test";
import assert from "node:assert/strict";

import { composeRestore, isQuoteOnly } from "../lib/quote-compose.mjs";

test("isQuoteOnly sees a wrong-direction pair as quotes only", () => {
  assert.equal(isQuoteOnly("“triumphant message”", "“triumphant message’"), true);
  assert.equal(isQuoteOnly("to me.”", "to me."), true);
  assert.equal(isQuoteOnly("me.", "me.”"), true);
});

test("isQuoteOnly requires a quote character, so spacing damage still takes the master", () => {
  assert.equal(isQuoteOnly("word ", "word"), false);
  assert.equal(isQuoteOnly("", " "), false);
});

test("isQuoteOnly is exact, so a macron beside a quote is not quotes only", () => {
  assert.equal(isQuoteOnly("‘soter’", "‘sōter’"), false);
  assert.equal(isQuoteOnly("punches,’", "punches”"), false);
});

test("a quote-only difference resolves entirely to the repo", () => {
  const repo = "The use of “triumphant message” here is intended.";
  const master = "The use of “triumphant message’ here is intended.";
  const r = composeRestore(repo, master, { quoteAmbiguous: true });
  assert.equal(r.ok, true);
  assert.equal(r.unchanged, true);
  assert.equal(r.value, repo);
});

test("words are taken from the master while quote characters stay the repo's", () => {
  const repo = "Or ‘not pulling my punches’ so to speak.";
  const master = "Or ‘not throwing my punches’ so to speak.";
  const r = composeRestore(repo, master, { quoteAmbiguous: true });
  assert.equal(r.ok, true);
  assert.equal(r.unchanged, false);
  assert.equal(r.value, "Or ‘not throwing my punches’ so to speak.");
});

test("markup the master never had is kept", () => {
  const repo = 'The word <em>logos</em> is <span class="x">here</span>.';
  const master = "The word logos is here.";
  const r = composeRestore(repo, master, { quoteAmbiguous: true });
  assert.equal(r.ok, true);
  assert.equal(r.value, repo);
});

test("diacritics and spacing are restored from the master even under quoteAmbiguous", () => {
  const repo = "The word soter, meaning  saviour.";
  const master = "The word sōter, meaning saviour.";
  const r = composeRestore(repo, master, { quoteAmbiguous: true });
  assert.equal(r.ok, true);
  assert.match(r.value, /sōter/);
});

test("gate 1 refuses a composition still carrying a straight quote", () => {
  const repo = "Traditionally, ‘assembly’ in Greek.";
  const master = "Traditionally, 'gathering' in Koine.";
  const r = composeRestore(repo, master, { quoteAmbiguous: true });
  assert.equal(r.ok, false);
  assert.match(r.reason, /straight quote/);
});

test("gate 2 refuses a composition that introduces a wrong-direction pair", () => {
  const repo = "Traditionally, ‘Abomination of Desolation.’";
  const master = "Traditionally, ‘Abomination of Desolations”";
  const r = composeRestore(repo, master, { quoteAmbiguous: true });
  assert.equal(r.ok, false);
  assert.match(r.reason, /wrong-direction/);
});

test("a wrong-direction pair the repo already has does not block a restore", () => {
  const repo = "Traditionally, ‘assembly” and also plain.";
  const master = "Traditionally, ‘assembly” and also simple.";
  const r = composeRestore(repo, master, { quoteAmbiguous: true });
  assert.equal(r.ok, true);
  assert.match(r.value, /simple/);
});

test("without quoteAmbiguous the master's quotes are taken like any punctuation", () => {
  const repo = "He said, ‘go’ quietly.";
  const master = "He said, “go” quietly.";
  const r = composeRestore(repo, master);
  assert.equal(r.ok, true);
  assert.equal(r.value, master);
});
