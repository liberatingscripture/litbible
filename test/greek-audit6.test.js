// Study Desk Audit 6, the Greek findings: GK6-1, 3, 4, 5, 6, 10, 11, 12.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { foldGreek, matchGreek, prepareBridge, prepareIndex } from "../src/lib/greek-search.mjs";
import { parseGreekQuery } from "../src/lib/greek-query.mjs";
import { cannotSay, needsQuotes, writeCard } from "../src/lib/greek-builder.mjs";

const index = prepareIndex({
  format: 2,
  shards: 64,
  lemmas: [
    ["θεός", "G2316", "God", 1317, "θεοσ θεον θεου θεω θεε"],
    ["καί", "G2532", "and", 9000, "και"],
    ["μετά", "G3326", "with", 469, "μετα"],
    ["πίστις", "G4102", "faith, trust", 243, "πιστισ πιστιν"],
  ],
});
const lemmaOf = (m) => m.lemmas.map((x) => index.lemmas[x.id].lemma);

test("GK6-3: capitals with iota adscript find the dative, and καί is unaffected", () => {
  assert.deepEqual(lemmaOf(matchGreek(index, "ΘΕΩΙ")), ["θεός"]);
  assert.deepEqual(lemmaOf(matchGreek(index, "ΘΕΩ")), ["θεός"]);
  assert.deepEqual(lemmaOf(matchGreek(index, "καί")), ["καί"]);
  assert.deepEqual(lemmaOf(matchGreek(index, "ΚΑΙ")), ["καί"]);
  assert.deepEqual(matchGreek(index, "ΞΕΩΙ").lemmas, []);
});

test("GK6-4: the micro sign is mu, and a Latin letter inside a Greek word finds nothing", () => {
  assert.equal(foldGreek("µετά"), "μετα");
  assert.deepEqual(lemmaOf(matchGreek(index, "µετά")), ["μετά"]);
  for (const q of ["πίστιs", "πίστις-gen", "πίστις;gen", "πίστιςx"]) assert.deepEqual(matchGreek(index, q).lemmas, [], q);
  assert.deepEqual(lemmaOf(matchGreek(index, "ἀπ’ πίστις".split(" ")[1])), ["πίστις"]);
});

test("GK6-5: a LIT rendering of four words is found, other four-word text is not", () => {
  const bridge = prepareBridge({
    format: 1,
    terms: [{ id: "x", title: "X", traditional: "Y", lemmas: ["πίστις"], renderings: [{ form: "the place of the dead", count: 1, verses: [0, 1, 1] }] }],
  });
  assert.deepEqual(lemmaOf(matchGreek(index, "the place of the dead", { bridge })), ["πίστις"]);
  assert.deepEqual(matchGreek(index, "the place of the living", { bridge }).lemmas, []);
  assert.deepEqual(matchGreek(index, "the place of the dead").lemmas, []);
});

test("GK6-10: a control character in a query never reaches a term as undefined", () => {
  for (const q of ["\u0001.gen", "\u00010, πίστις"]) {
    const parsed = parseGreekQuery(q);
    for (const t of parsed.terms ?? []) for (const w of t.words ?? []) assert.equal(typeof w, "string", q);
  }
});

test("GK6-11: a too-long search tells the reader to shorten it once", () => {
  const read = { cannot: "error", error: { kind: "tooLong", length: 400 } };
  assert.doesNotMatch(cannotSay(read), /Shorten it in the field\. Fix it/);
  assert.match(cannotSay(read), /Or start a new search here\.$/);
});

test("GK6-12: a word with a notation symbol is written quoted", () => {
  for (const w of ["a.b", "*", "x/y", "a=b"]) {
    assert.equal(needsQuotes(w), true, w);
    assert.equal(writeCard({ words: [w], filters: [] }), `"${w}"`);
  }
  assert.equal(needsQuotes("πίστις"), false);
});

// ── GK6-1 and GK6-6: a failed load is not "no match" ─────────────────────

const publicDir = (rel) => fileURLToPath(new URL(`../public/${rel}`, import.meta.url));
let failing = new Set();
let bridgeJson = null;
globalThis.fetch = async (url) => {
  const u = String(url).replace(/^\//, "");
  if (bridgeJson && u.includes("greek-bridge.json")) return { ok: true, status: 200, json: async () => bridgeJson };
  if ([...failing].some((f) => u.includes(f))) return { ok: false, status: 503, json: async () => ({}) };
  try {
    return { ok: true, status: 200, json: async () => JSON.parse(await readFile(publicDir(u), "utf8")) };
  } catch {
    return { ok: false, status: 404, json: async () => ({}) };
  }
};
console.warn = () => {};
const { searchGreek, searchGreekAuto } = await import("../src/scripts/search-greek.js");

test("GK6-1: a lemmas.json that will not load is a failure, for a single word and a Strong's number", async () => {
  failing = new Set(["lemmas.json"]);
  for (const q of ["πίστις", "G4102"]) {
    const res = await searchGreekAuto("/", q);
    assert.equal(res.failed, true, q);
    assert.equal(res.lemmas.length, 0);
  }
  failing = new Set();
  assert.equal((await searchGreek("/", "πίστις")).failed, false);
});

test("GK6-6: a shard that will not load keeps a LIT-rendered lemma and says it failed", async () => {
  bridgeJson = {
    format: 1,
    terms: [{ id: "x", title: "X", traditional: "Y", lemmas: ["ἀγαπάω"], renderings: [{ form: "cherishing", count: 1, verses: [3, 3, 16] }] }],
  };
  failing = new Set(["occ/"]);
  const res = await searchGreek("/", "cherishing");
  assert.equal(res.failed, true);
  assert.equal(res.lemmas.length, 1);
  failing = new Set();
  bridgeJson = null;
});
