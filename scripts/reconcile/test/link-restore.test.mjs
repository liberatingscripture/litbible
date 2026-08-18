import test from "node:test";
import assert from "node:assert/strict";

import { restoreLinkAttributes } from "../lib/link-restore.mjs";

test("a single link's attributes and label are restored from the repo", () => {
  const master = 'See: <a href="https://example.com/a">https://example.com/a</a>.';
  const repo = 'See: <a href="https://example.com/a" target="_blank" rel="noopener">https://example.com/a</a>.';
  const r = restoreLinkAttributes(master, repo);
  assert.equal(r.ok, true);
  assert.equal(r.html, repo);
});

test("three links match by href, not by position, even when the master reorders them", () => {
  const master =
    'First <a href="https://b.example">https://b.example</a>, ' +
    'then <a href="https://a.example">https://a.example</a>.';
  const repo =
    'See <a href="https://a.example" target="_blank" rel="noopener">a</a> and ' +
    '<a href="https://b.example" target="_blank" rel="noopener">b</a>.';
  const r = restoreLinkAttributes(master, repo);
  assert.equal(r.ok, true);
  assert.match(r.html, /First <a href="https:\/\/b\.example" target="_blank" rel="noopener">b<\/a>/);
  assert.match(r.html, /then <a href="https:\/\/a\.example" target="_blank" rel="noopener">a<\/a>/);
});

test("the same href appearing twice is matched in encounter order, not merged", () => {
  const master = '<a href="https://x.example">https://x.example</a> and again <a href="https://x.example">https://x.example</a>.';
  const repo = '<a href="https://x.example" rel="first">one</a> and again <a href="https://x.example" rel="second">two</a>.';
  const r = restoreLinkAttributes(master, repo);
  assert.equal(r.ok, true);
  assert.equal(
    r.html,
    '<a href="https://x.example" rel="first">one</a> and again <a href="https://x.example" rel="second">two</a>.',
  );
});

test("a master link with no repo counterpart is refused, not guessed", () => {
  const master = 'See <a href="https://gone.example">https://gone.example</a>.';
  const repo = "See the note above.";
  const r = restoreLinkAttributes(master, repo);
  assert.equal(r.ok, false);
  assert.match(r.reason, /gone\.example/);
});

test("a repo link the master does not mention is left alone - not every asymmetry is a refusal", () => {
  const master = "Plain text with no link at all.";
  const repo = 'Plain text with <a href="https://extra.example" target="_blank">a citation</a>.';
  const r = restoreLinkAttributes(master, repo);
  assert.equal(r.ok, true);
  assert.equal(r.html, master, "nothing to substitute - the master has no auto-link to replace");
});

test("text with no links at all passes through untouched", () => {
  const html = "Ordinary footnote prose, no citations here.";
  assert.deepEqual(restoreLinkAttributes(html, html), { ok: true, html });
});

test("matching is by href only - a hand-labeled repo link still restores", () => {
  // docx-runs.mjs can only ever synthesize the bare auto-link shape
  // (visible text = href), never a custom label like "Read more". This
  // documents that restoreLinkAttributes does not require the repo's label
  // to match anything in the master - only the href has to line up.
  const master = 'Cf. <a href="https://example.com/study">https://example.com/study</a>.';
  const repo = 'Cf. <a href="https://example.com/study">Read more</a>.';
  const r = restoreLinkAttributes(master, repo);
  assert.equal(r.ok, true);
  assert.equal(r.html, 'Cf. <a href="https://example.com/study">Read more</a>.');
});
