// A reader's note on an article names the article by its slug: the file name
// in src/content/articles/ without ".md" (STUDY-DESK.md N11; a provisional
// rule, for the owner to confirm). So an article file must not be renamed
// without recording it here.
//
// src/data/article-slugs.json lists every slug ever published, in `slugs`.
// `renamed` maps an old slug to the new one, so notes can follow the article.
// To rename an article, add the old slug under `renamed`, pointing at the new
// one, and add the new slug to `slugs`. A new article goes in `slugs` too.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";

const articleDir = new URL("../src/content/articles/", import.meta.url);
const listFile = new URL("../src/data/article-slugs.json", import.meta.url);

const articles = readdirSync(articleDir)
  .filter((name) => name.endsWith(".md"))
  .map((name) => name.slice(0, -".md".length))
  .sort();
const current = new Set(articles);

const { slugs, renamed } = JSON.parse(readFileSync(listFile, "utf8"));

// Follow a renamed slug through any chain of renames. Returns { article } when
// the chain ends at a current article file, or { problem } saying where it breaks.
function followRename(old) {
  const seen = new Set([old]);
  let at = renamed[old];
  while (true) {
    if (seen.has(at)) return { problem: `loops back to "${at}"` };
    if (current.has(at)) return { article: at };
    if (!Object.hasOwn(renamed, at)) {
      return { problem: `"${at}" is neither an article file nor a renamed slug` };
    }
    seen.add(at);
    at = renamed[at];
  }
}

test("every listed slug is a current article file or a renamed slug", () => {
  const unknown = slugs.filter((slug) => !current.has(slug) && !Object.hasOwn(renamed, slug));
  assert.deepEqual(
    unknown,
    [],
    "these slugs match no article file and are not keys of renamed; if an article was renamed, add its old slug under renamed",
  );
});

test("every renamed slug leads, through any chain of renames, to a current article file", () => {
  const broken = Object.keys(renamed).flatMap((old) => {
    const result = followRename(old);
    return result.article ? [] : [`${old}: ${result.problem}`];
  });
  assert.deepEqual(broken, [], "fix the renamed entries in src/data/article-slugs.json so each chain ends at an article file");
});

test("no renamed slug is still a current article file", () => {
  const stillThere = Object.keys(renamed).filter((old) => current.has(old));
  assert.deepEqual(
    stillThere,
    [],
    "these old slugs are keys of renamed but their article files still exist; a renamed article's old file must be gone, or notes on that slug have two homes",
  );
});

test("every article file is listed in slugs", () => {
  const listed = new Set(slugs);
  const missing = articles.filter((slug) => !listed.has(slug));
  assert.deepEqual(
    missing,
    [],
    "these article files are not in src/data/article-slugs.json: add each one to its slugs list",
  );
});

test("slugs is sorted and lists each slug once", () => {
  assert.deepEqual(slugs, [...slugs].sort(), "keep slugs in alphabetical order");
  assert.equal(new Set(slugs).size, slugs.length, "a slug appears in slugs more than once");
});
