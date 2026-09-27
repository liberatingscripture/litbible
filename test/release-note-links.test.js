// test/release-note-links.test.js
//
// Unit tests for src/lib/release-note-links.mjs, which links each row of the
// release notes page (and /read's "What's new") to what changed. The shapes
// come from scripts/lib/release-notes-core.mjs, so a test here that starts
// failing after a drafter change means the two have stopped agreeing.

import { test } from "node:test";
import assert from "node:assert/strict";

import { linkChangeDescription } from "../src/lib/release-note-links.mjs";
import { linkScriptureRefs } from "../src/lib/scripture-refs.mjs";

const deps = {
  linkRefs: (html) => linkScriptureRefs(html),
  glossaryId: (traditional) => ({ "Good [1]": "good-beautiful", Flesh: "flesh-body" })[traditional] ?? null,
  articleSlugs: new Set(["faithfulness-as-resistance"]),
};
const link = (d) => linkChangeDescription(d, deps);

test("a scripture row goes through the reference linker", () => {
  assert.equal(
    link("Matthew 21:21–22 — text updated"),
    '<a class="sref" href="/matthew-21/#v21-22">Matthew 21:21–22</a> — text updated'
  );
});

test("an intro row links to the intro page", () => {
  assert.equal(link("Mark Introduction updated"), '<a href="/mark-intro/">Mark Introduction</a> updated');
  assert.equal(
    link("1 Corinthians Introduction added"),
    '<a href="/1corinthians-intro/">1 Corinthians Introduction</a> added'
  );
});

test("a glossary row links to the entry, and only when the entry is published", () => {
  assert.equal(
    link("Glossary entry for Good [1] updated"),
    'Glossary entry for <a href="/glossary/#good-beautiful">Good [1]</a> updated'
  );
  assert.equal(link("Glossary entry for Mystery added"), "Glossary entry for Mystery added");
});

test("an article row links to the article, and only when it still exists", () => {
  assert.equal(
    link("Article updated: faithfulness as resistance"),
    'Article updated: <a href="/articles/faithfulness-as-resistance/">faithfulness as resistance</a>'
  );
  assert.equal(link("Article added: a retired piece"), "Article added: a retired piece");
});

test("a row that names no page stays plain, and is escaped", () => {
  assert.equal(link("Metadata updated (6 chapters)"), "Metadata updated (6 chapters)");
  assert.equal(link("Notes <draft> & more"), "Notes &lt;draft&gt; &amp; more");
});
