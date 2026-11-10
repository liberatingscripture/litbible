// A Strong's number finds the words tagged with it, not whole lemmas
// (STUDY-DESK-AUDIT-8.md, GK8-1; BVJ, 2026-11-10, decision 6). MACULA tags a
// few of a lemma's words with another number than the lemma's (αὐτοῦ as G848,
// ἦν as G2258), and format 2 of the search index sent a search for any such
// number to every word of the lemma: G3596 (ὁδοιπορέω, one word) brought all
// of πᾶς. build:greek now writes each word's own number where it differs
// (text/, and the shard's side list), and the search keeps only the words
// that carry the number. The rule: a word carries its own number where it has
// one, else its lemma's. The first half works on small built data; the second
// on the committed public/greek/.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

import {
  decodeOccurrences,
  lemmaLine,
  matchGreek,
  occShard,
  prepareIndex,
  strongCount,
  strongFilter,
  strongView,
} from "../src/lib/greek-search.mjs";
import { describeGreekQuery, parseGreekQuery, resolveGreekQuery } from "../src/lib/greek-query.mjs";
import { codeCounts, resolveCard } from "../src/lib/greek-builder.mjs";
import { W, wordStrong } from "../src/lib/desk-greek.mjs";
import { BOOK_ORDER } from "../src/data/books.js";

// ── the rules, on a small index ──────────────────────────────────────────────

// πᾶς (G3956) has 4 words, one tagged G3596; ὁδοιπορέω (G3596) has 1.
// εἰμί (G2076) has 5: two tagged G1510, one G2258.
const index = prepareIndex({
  format: 3,
  shards: 64,
  lemmas: [
    ["εἰμί", "G2076", "to be", 5, "ειμι εστιν ην", [["G1510", 2], ["G2258", 1]]],
    ["πᾶς", "G3956", "all", 4, "πασ παντεσ", [["G3596", 1]]],
    ["ὁδοιπορέω", "G3596", "to journey", 1, "οδοιπορουντων"],
  ],
});
const byLemma = (l) => index.lemmas.find((x) => x.lemma === l);
const flat = (n) => Array.from({ length: n }, (_, i) => [0, 1, i + 1, 1, 0, 0]).flat();
const pasEntry = [["πᾶς"], flat(4), ["A-----NSM-"], { G3596: [2] }];
const eimiEntry = [["ἐστιν"], flat(5), ["V--PAI3S--"], { G1510: [0, 4], G2258: [1] }];

test("a lemma's words carrying a number are counted from `also`", () => {
  const pas = byLemma("πᾶς");
  assert.equal(strongCount(pas, "G3596"), 1);
  assert.equal(strongCount(pas, "G3956"), 3); // its own number: every word not tagged otherwise
  assert.equal(strongCount(pas, "G1"), 0);
  assert.equal(strongCount(byLemma("εἰμί"), "G2076"), 2);
  assert.deepEqual(strongView(pas, ["G3596"]).count, 1);
  assert.equal(strongView(pas, ["G3596"]).tagged, "G3596");
  assert.equal(strongView(pas, ["G3956"]).tagged, null);
  assert.equal(strongView(pas, null), pas);
});

test("a Strong's search lists the lemmas by words carrying it, the number's own lemma first on a tie", () => {
  const m = matchGreek(index, "G3596");
  assert.equal(m.kind, "strong");
  assert.equal(m.strong, "G3596");
  assert.deepEqual(m.lemmas.map((x) => index.lemmas[x.id].lemma), ["ὁδοιπορέω", "πᾶς"]);
  const eimi = matchGreek(index, "G1510");
  assert.deepEqual(eimi.lemmas.map((x) => index.lemmas[x.id].lemma), ["εἰμί"]);
});

test("only the words carrying the number are decoded", () => {
  const verses = (entry, strongs, primary) => decodeOccurrences(entry, BOOK_ORDER, { strongs, primary }).map((o) => o.verse);
  assert.deepEqual(verses(pasEntry, ["G3596"], "G3956"), [3]);
  assert.deepEqual(verses(pasEntry, ["G3956"], "G3956"), [1, 2, 4]);
  assert.deepEqual(verses(pasEntry, null, "G3956"), [1, 2, 3, 4]); // no number asked: every word
  assert.deepEqual(verses(eimiEntry, ["G1510"], "G2076"), [1, 5]);
  assert.deepEqual(verses(eimiEntry, ["G1510", "G2258"], "G2076"), [1, 2, 5]);
  assert.deepEqual(verses(eimiEntry, ["G2076"], "G2076"), [3, 4]);
  // A lemma with no side list: its own number is every word's.
  assert.deepEqual(verses([["λόγος"], flat(2), ["N-"]], ["G3056"], "G3056"), [1, 2]);
  assert.deepEqual(verses([["λόγος"], flat(2), ["N-"]], ["G9"], "G3056"), []);
  assert.equal(strongFilter(pasEntry, [], "G3956"), null);
});

test("a lemma found by another lemma's number says so on its line", () => {
  const pas = strongView(byLemma("πᾶς"), ["G3596"]);
  assert.equal(lemmaLine(pas), "πᾶς · pas · G3956 · all · tagged G3596 · 1 time");
  assert.equal(lemmaLine(strongView(byLemma("εἰμί"), ["G2076"])), "εἰμί · eimi · G2076 · be · 2 times");
});

test("in a command, a lemma reached by a Strong's number keeps only its tagged words", () => {
  const resolved = resolveGreekQuery(index, parseGreekQuery("G3596"));
  const [term] = resolved.terms;
  const pasId = byLemma("πᾶς").id;
  assert.deepEqual(term.strongs[pasId], ["G3596"]);
  assert.equal(term.strongs[byLemma("ὁδοιπορέω").id], undefined); // every word of it is G3596
  // The readback names the number when it leaves words out.
  const said = describeGreekQuery(resolved, { greek: (g) => g, text: (t) => t });
  assert.match(said, /tagged G3596/);
  // A Greek word for the same lemma takes the whole lemma back.
  const both = resolveGreekQuery(index, parseGreekQuery("G3596/πᾶς")).terms[0];
  assert.equal(both.strongs?.[pasId], undefined);
  // A number covering all of its one lemma's words is said plainly.
  const solo = prepareIndex({ format: 3, lemmas: [["πίστις", "G4102", "faith", 3, "πιστισ"]] });
  const plain = resolveGreekQuery(solo, parseGreekQuery("G4102.gen"));
  assert.equal(plain.terms[0].strongs?.[0], undefined);
  assert.equal(describeGreekQuery(plain, { greek: (g) => g, text: (t) => t }), "Genitives of πίστις");
});

test("the search builder counts a Strong's word's parsings over its tagged words", () => {
  const card = resolveCard(index, { words: ["G3596"], filters: [] });
  assert.deepEqual(card.strongs[byLemma("πᾶς").id], ["G3596"]);
  const entry = [["πᾶς", "πάντες"], [0, 1, 1, 1, 0, 0, 0, 1, 2, 1, 1, 1, 0, 1, 3, 1, 1, 1], ["A-----NSM-", "A-----NPM-"], { G3596: [0] }];
  assert.deepEqual([...codeCounts(entry, { strongs: ["G3596"], primary: "G3956" })], [["A-----NSM-", 1]]);
  assert.deepEqual([...codeCounts(entry)], [["A-----NSM-", 1], ["A-----NPM-", 2]]);
});

test("the Greek tab names a word's own Strong's number", () => {
  const word = [1, 1, "ἦν", "", " ", 0, "V-", "-IAI-3S--", null];
  assert.equal(W.strong, 9);
  assert.equal(wordStrong(word, "G2076"), "G2076");
  assert.equal(wordStrong([...word, "G2258"], "G2076"), "G2258");
  assert.equal(wordStrong(word, null), null);
});

// ── the committed data ───────────────────────────────────────────────────────

const root = new URL("../public/greek/", import.meta.url);
const read = (rel) => JSON.parse(readFileSync(fileURLToPath(new URL(rel, root)), "utf8"));
const real = prepareIndex(read("search/lemmas.json"));
const lemmaNamed = (l) => real.lemmas.find((x) => x.lemma === l);

/** What a search for `q` finds in the committed data: { lemma: words } and the total. */
function search(q) {
  const m = matchGreek(real, q);
  const found = {};
  for (const { id } of m.lemmas) {
    const entry = read(`search/occ/${occShard(real, id)}.json`)[id];
    found[real.lemmas[id].lemma] = decodeOccurrences(entry, BOOK_ORDER, { strongs: [m.strong], primary: real.lemmas[id].strong }).length;
  }
  return found;
}

test("committed: G3596 finds ὁδοιπορέω and the one word of πᾶς tagged so, not all of πᾶς", () => {
  const found = search("G3596");
  assert.equal(found["ὁδοιπορέω"], lemmaNamed("ὁδοιπορέω").count);
  assert.equal(found["πᾶς"], 1);
  assert.ok(lemmaNamed("πᾶς").count > 1000);
  assert.deepEqual(Object.keys(found), ["ὁδοιπορέω", "πᾶς"]);
});

test("committed: G1519 finds εἰς, and of ἐν only the words tagged G1519", () => {
  const found = search("G1519");
  assert.equal(found["εἰς"], lemmaNamed("εἰς").count);
  assert.equal(found["ἐν"], lemmaNamed("ἐν").also.get("G1519"));
  assert.ok(found["ἐν"] < 10, `ἐν has ${found["ἐν"]} words tagged G1519`);
  // ἐν's own number still finds the rest of it.
  assert.equal(search("G1722")["ἐν"], lemmaNamed("ἐν").count - found["ἐν"]);
});

test("committed: G848 finds only the words tagged G848", () => {
  const found = search("G848");
  const autos = lemmaNamed("αὐτός");
  assert.equal(found["αὐτός"], autos.also.get("G848"));
  assert.equal(found["ἑαυτοῦ"], lemmaNamed("ἑαυτοῦ").also.get("G848"));
  assert.ok(found["αὐτός"] < autos.count / 5);
  assert.equal(search("G846")["αὐτός"], autos.count - found["αὐτός"]);
});

test("committed: G1510 still finds the forms of εἰμί tagged so, and a lemma's own number its words", () => {
  const eimi = lemmaNamed("εἰμί");
  const g1510 = search("G1510")["εἰμί"];
  assert.ok(g1510 > 50, `εἰμί has ${g1510} words tagged G1510`);
  assert.equal(g1510, eimi.also.get("G1510"));
  assert.equal(search(eimi.strong)["εἰμί"], strongCount(eimi, eimi.strong));
  // A lemma with no other numbers: its number finds every word.
  assert.equal(search("G4102")["πίστις"], lemmaNamed("πίστις").count);
});

test("committed: the chapters' word numbers and the search's side lists agree", () => {
  // Every word text/ tags with its own number is in its lemma's side list
  // under that number, and the side lists hold nothing else.
  const fromText = new Map(); // "lemma|number" -> words
  for (const name of readdirSync(fileURLToPath(new URL("text/", root)))) {
    const doc = read(`text/${name}`);
    for (const para of doc.paragraphs) {
      for (const w of para) {
        if (w.length < 10) continue;
        const [lemma, strong] = doc.lemmas[w[W.lemma]];
        assert.notEqual(w[W.strong], strong, `${name} ${w[0]}.${w[1]} repeats its lemma's number`);
        const key = `${lemma}|${w[W.strong]}`;
        fromText.set(key, (fromText.get(key) ?? 0) + 1);
      }
    }
  }
  const fromIndex = new Map();
  for (const item of real.lemmas) for (const [s, n] of item.also) fromIndex.set(`${item.lemma}|${s}`, n);
  assert.deepEqual(new Map([...fromText].sort()), new Map([...fromIndex].sort()));
  for (const item of real.lemmas.filter((x) => x.also.size)) {
    const entry = read(`search/occ/${occShard(real, item.id)}.json`)[item.id];
    for (const [s, places] of Object.entries(entry[3])) assert.equal(places.length, item.also.get(s), `${item.lemma} ${s}`);
  }
});
