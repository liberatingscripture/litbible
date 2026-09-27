// test/glossary-crossrefs.test.js
//
// src/lib/glossary-crossrefs.mjs links "the entry for “X”" on /glossary only.
// Labels resolve through the feed's own normalizeLabel, so these tests use it
// too: the page and the apps must agree on where each phrase points.

import { test } from "node:test";
import assert from "node:assert/strict";

import { linkGlossaryCrossRefs } from "../src/lib/glossary-crossrefs.mjs";
import { normalizeLabel } from "../scripts/lib/glossary-feed-core.mjs";

const ids = new Map(
  [
    ["Good [2]", "good-beneficial"],
    ["Law", "law-torah"],
    ["Sin", "sin-deviation"],
    ["Blessed", "blessed-fortunate"],
    ["Called Community", "church-called-community"],
  ].map(([label, id]) => [normalizeLabel(label), id])
);
const resolve = (label) => ids.get(normalizeLabel(label)) ?? null;
const link = (html) => linkGlossaryCrossRefs(html, resolve);

test("the quoted label becomes a jump to its entry", () => {
  assert.equal(
    link("See the entry for “good [2]” below."),
    'See the entry for <a href="#good-beneficial">“good [2]”</a> below.'
  );
});

test("both labels of a plural cross-reference link", () => {
  assert.equal(
    link("(See the entries for “law” above and “sin” below)."),
    '(See the entries for <a href="#law-torah">“law”</a> above and <a href="#sin-deviation">“sin”</a> below).'
  );
});

test("\"the entry on\" works too, and a following gloss is left alone", () => {
  assert.equal(
    link("the one traced out by Torah (see the entry on “law” above)"),
    'the one traced out by Torah (see the entry on <a href="#law-torah">“law”</a> above)'
  );
  assert.equal(
    link("See the entry for “Blessed” (“how greatly fortunate”) for that one."),
    'See the entry for <a href="#blessed-fortunate">“Blessed”</a> (“how greatly fortunate”) for that one.'
  );
});

test("an unknown label stays plain text", () => {
  assert.equal(link("See the entry for “nope” below."), "See the entry for “nope” below.");
});

test("labels resolve case-insensitively, the way iOS matches them", () => {
  assert.equal(
    link("See the entry for “Called Community” (<em>ekklesia</em>)"),
    'See the entry for <a href="#church-called-community">“Called Community”</a> (<em>ekklesia</em>)'
  );
});
