// How the three search surfaces route a Greek query (search-core.js):
// searchGreekAuto sends a command query to searchGreekCommands and anything
// else to searchGreek as before, and isGreekQuery knows the commands' symbols.
// The loaders fetch from public/greek/ (the committed index), so fetch is
// answered from disk; the glossary bridge (a build output) is simply absent.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { countLine, isCommandQuery } from "../src/lib/greek-query.mjs";
import { foldGreek } from "../src/lib/greek-search.mjs";

const publicDir = (rel) => fileURLToPath(new URL(`../public/${rel}`, import.meta.url));

globalThis.fetch = async (url) => {
  try {
    const text = await readFile(publicDir(String(url).replace(/^\//, "")), "utf8");
    return { ok: true, status: 200, json: async () => JSON.parse(text) };
  } catch {
    return { ok: false, status: 404, json: async () => ({}) };
  }
};
const warn = console.warn;
console.warn = () => {}; // the absent bridge is logged once

const { isGreekQuery, searchGreekAuto, searchGreekCommands } = await import("../src/scripts/search-core.js");

// ── What counts as only Greek ───────────────────────────────────────────

test("a query with Greek letters, a Strong's number, a star or a parsing after a dot is Greek", () => {
  for (const q of ["πίστις", "G4102", "*.aor.impv", "*", "pistis.gen", "pistis.GEN.fem", "Rom.8.3.aor", "πίστις.gen, Χριστός.gen", "faith.pl", "pistis, *.gen.noun", "pistis/*"]) {
    assert.equal(isGreekQuery(q), true, q);
  }
  for (const q of ["faith", "son of man", "Rom. 8.3", "John 3.16", "e.g. gen", "etc.", "gen. 1:1", "Gen.1.1", "a.b", "", "aorist imperative", "pistis genitive", "lov*", "lov* one", "*lov"]) {
    assert.equal(isGreekQuery(q), false, q);
  }
});

// ── Command queries ─────────────────────────────────────────────────────

test("a construction, typed in Greek or in words, comes back as hits", async () => {
  for (const q of ["πίστις.gen, Ἰησοῦς/Χριστός.gen", "pistis genitive and Iesous or Christos genitive"]) {
    const res = await searchGreekAuto("/", q);
    assert.equal(res.kind, "commands", q);
    assert.equal(res.error, null, q);
    assert.equal(countLine(res.hits), "6 matches in 5 verses", q);
    assert.equal(res.matchCount, 6);
    assert.equal(res.verseCount, 5);
    const first = res.hits[0];
    assert.equal(first.label, "Romans 3:22");
    assert.equal(first.book, "romans");
    assert.deepEqual(first.marked, [...new Set(first.matches.flat())].sort((a, b) => a - b));
    assert.equal(first.t, first.matches[0][0]);
    assert.equal(first.href, `/romans-3/?greek=22.${first.t}#v22`);
  }
});

test("parsing alone finds every word so parsed, and the book filter narrows it", async () => {
  const all = await searchGreekAuto("/", "*.aor.impv");
  assert.equal(countLine(all.hits), "762 matches in 615 verses");
  const john = await searchGreekAuto("/", "any aorist imperative", { bookKey: "john" });
  assert.ok(john.hits.length > 0 && john.hits.length < all.hits.length);
  assert.ok(john.hits.every((h) => h.book === "john"));
  const ph = await searchGreekCommands("/", "πίστις.gen ~0 Χριστός.gen");
  assert.equal(countLine(ph.hits), "2 matches in 2 verses");
});

test("an error comes back as the error, with nothing else", async () => {
  const res = await searchGreekAuto("/", "πίστις.genetive");
  assert.equal(res.kind, "commands");
  assert.deepEqual(res.error, { kind: "near", word: "genetive", near: "genitive" });
  assert.deepEqual(res.hits, []);
  const bare = await searchGreekAuto("/", "πίστις, *, Χριστός");
  assert.equal(bare.error.kind, "bareAny");
});

test("nothing typed yet, or a search that finds nothing, is not an error", async () => {
  const none = await searchGreekCommands("/", "   ");
  assert.equal(none.error, null);
  assert.equal(none.resolved, null);
  const empty = await searchGreekAuto("/", "πίστις.voc");
  assert.equal(empty.kind, "commands");
  assert.equal(empty.error, null);
  assert.deepEqual(empty.hits, []);
  assert.equal(countLine(empty.hits), "0 matches in 0 verses");
});

// ── Everything else is the single-word search as before ─────────────────

test("one word, even with a command symbol after it, is the single-word search", async () => {
  for (const q of ["πίστις", "πίστις.", "πίστις and"]) {
    const res = await searchGreekAuto("/", q);
    assert.notEqual(res.kind, "commands", q);
    assert.ok(res.lemmas.length > 0, q);
    assert.equal(res.lemmas[0].lemma, "πίστις", q);
  }
});

test("a lone command or parsing word is searched as the word it is", async () => {
  const res = await searchGreekAuto("/", "genitive");
  assert.notEqual(res.kind, "commands");
});

test("two plain Latin words that match no word are tried as a construction", async () => {
  const res = await searchGreekAuto("/", "pistis Christos");
  assert.equal(res.kind, "commands");
  assert.equal(res.error, null);
  assert.ok(res.hits.length > 0);
});

test("two plain Latin words that match nothing stay the single-word search's empty answer", async () => {
  const res = await searchGreekAuto("/", "zzqx wwvk");
  assert.notEqual(res.kind, "commands");
  assert.deepEqual(res.lemmas, []);
});

test("the single-word options still reach it", async () => {
  const res = await searchGreekAuto("/", "πίστεως", { exactForm: true });
  assert.notEqual(res.kind, "commands");
  assert.ok(res.hits.length > 0);
  assert.ok(res.hits.every((h) => foldGreek(h.form) === foldGreek("πίστεως")));
});

test.after(() => {
  console.warn = warn;
});

// ── Fixes from the FA1-k audit ──────────────────────────────────────────

test("BA45: two or three plain words that are a whole gloss are the gloss, even holding a command word", async () => {
  // "be next to" and "be exactly" end in a command word, which a command drops.
  for (const q of ["present time", "in the middle", "next day", "in order to", "be next to", "be exactly"]) {
    assert.equal(isCommandQuery(q), true, `${q} reads as a command`);
    const res = await searchGreekAuto("/", q);
    assert.notEqual(res.kind, "commands", q);
    assert.equal(res.kind, "latin", q);
    assert.ok(res.lemmas.length > 0, q);
    assert.ok(res.lemmas.some((l) => l.how === "lit" || l.how === "sense" || (l.how === "gloss" && l.glossHeads.includes(q))), q);
  }
  assert.equal((await searchGreekAuto("/", "present time")).lemmas[0].lemma, "δεῦρο");
  assert.ok((await searchGreekAuto("/", "next day")).lemmas.some((l) => l.lemma === "ἐπαύριον"));
  assert.ok((await searchGreekAuto("/", "in order to")).lemmas.some((l) => l.lemma === "ἵνα"));
});

test("BA45: a command of plain words that is no gloss is still a command", async () => {
  const res = await searchGreekAuto("/", "pistis genitive");
  assert.equal(res.kind, "commands");
  assert.equal(res.error, null);
  assert.ok(res.hits.length > 0);
});
