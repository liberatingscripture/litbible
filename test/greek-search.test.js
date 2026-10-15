// Searching the Greek (src/lib/greek-search.mjs): the matching rules the search
// bar, /search and the Notebook's Greek tab share. Most of it works on a small
// index built in the test; the last test loads the real committed
// public/greek/search/lemmas.json, so a change to the rules or to the data
// that makes a plain query find nothing fails here.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import {
  GREEK_PARSE_FORMAT,
  GREEK_SEARCH_FORMAT,
  decodeOccurrences,
  decodeParseGroup,
  foldGreek,
  glossHead,
  greekHref,
  greekKey,
  hasOtherForms,
  latinKeys,
  lemmaLine,
  litVerseKeys,
  matchForTray,
  matchGreek,
  occShard,
  parseGreekParam,
  parseGroup,
  parseStrong,
  splitCode,
  prepareBridge,
  prepareIndex,
  transliterate,
  trayLemmas,
} from "../src/lib/greek-search.mjs";
import { BOOK_ORDER } from "../src/data/books.js";

const fake = prepareIndex({
  format: 2,
  shards: 64,
  lemmas: [
    ["λόγος", "G3056", "word, speech", 330, "λογοσ λογον λογου"],
    ["πίστις", "G4102", "faith, trust", 243, "πιστισ πιστιν πιστει", ["G9999"]],
    ["πιστός", "G4103", "faithful", 67, "πιστοσ πιστον"],
    ["Χριστός", "G5547", "Christ", 529, "χριστοσ χριστον"],
    ["ἀγαπάω", "G25", "to love", 143, "αγαπαω αγαπα αγαπασ"],
    ["ἄγγελος", "G32", "(in the singular) messenger, angel", 175, "αγγελοσ"],
    ["ἁμαρτία", "G266", "sin", 173, "αμαρτια"],
  ],
});
const lemmaOf = (match, i = 0) => fake.lemmas[match.lemmas[i].id].lemma;

// ── keys ─────────────────────────────────────────────────────────────────────

test("what a reader types and what a lemma is as a key agree", () => {
  const cases = [
    [["agreuō", "agreuo"], "ἀγρεύω"],
    [["pistis"], "πίστις"],
    [["Christos", "Khristos", "xristos"], "Χριστός"],
    [["hamartia", "amartia"], "ἁμαρτία"],
    [["ēgapēsen", "egapesen"], "ἠγάπησεν"],
    [["psychē", "psuche"], "ψυχή"],
    [["enchriō", "egchriō"], "ἐγχρίω"],
    [["ekstasis"], "ἔκστασις"],
    [["angelos"], "ἄγγελος"],
    [["huios"], "υἱός"],
  ];
  for (const [typed, greek] of cases) {
    for (const t of typed) {
      assert.ok(latinKeys(t).includes(greekKey(greek)), `${t} should reach ${greek} (${greekKey(greek)}, got ${latinKeys(t)})`);
    }
  }
});

test("transliterate writes a lemma as the SBL Handbook does", () => {
  const cases = {
    πίστις: "pistis", ψυχή: "psychē", υἱός: "huios", οὗτος: "houtos",
    ἄγγελος: "angelos", Ῥώμη: "Rhōmē", Χριστός: "Christos",
  };
  for (const [greek, latin] of Object.entries(cases)) assert.equal(transliterate(greek), latin);
});

test("foldGreek drops accents, breathings, case, final sigma and anything not a letter", () => {
  assert.equal(foldGreek("ἦν"), foldGreek("ἥν"));
  assert.equal(foldGreek("ἦν"), foldGreek("ην"));
  assert.equal(foldGreek("λόγος"), "λογοσ");
  assert.equal(foldGreek("Λόγοσ"), "λογοσ");
  assert.equal(foldGreek("ἀλλ’"), "αλλ");
  assert.equal(foldGreek("⸀ἀλλʼ,"), "αλλ");
});

test("parseStrong reads every way of typing a Strong's number", () => {
  for (const t of ["G4102", "g4102", "strong:4102", "Strong's 4102", "G04102"]) assert.equal(parseStrong(t), "G4102", t);
  assert.equal(parseStrong("Gospel"), null);
  assert.equal(parseStrong("4102"), null);
});

test("glossHead is a gloss's first sense without parentheses or a leading article", () => {
  assert.equal(glossHead("(in the singular) person, human being"), "person");
  assert.equal(glossHead("to catch"), "catch");
  assert.equal(glossHead("the Lord; master"), "lord");
  assert.equal(glossHead(null), "");
});

// ── matching ─────────────────────────────────────────────────────────────────

test("a Greek form finds its lemma, a lemma typed finds that lemma alone", () => {
  const form = matchGreek(fake, "πίστει");
  assert.equal(form.kind, "greek");
  assert.equal(form.form, "πιστει");
  assert.equal(lemmaOf(form), "πίστις");
  assert.equal(form.lemmas[0].how, "form");
  const lemma = matchGreek(fake, "Πίστις");
  assert.equal(lemma.lemmas.length, 1);
  assert.equal(lemma.lemmas[0].how, "lemma");
  assert.equal(matchGreek(fake, "πιστις").lemmas[0].how, "lemma");
  assert.deepEqual(matchGreek(fake, "λόγος πίστις").lemmas, []); // one word at a time
  assert.deepEqual(matchGreek(fake, "ζζζζ").lemmas, []);
});

test("a Strong's number finds its lemma, as the primary or an also", () => {
  for (const q of ["G4102", "g4102", "Strong's 4102", "G9999"]) {
    const m = matchGreek(fake, q);
    assert.equal(m.kind, "strong", q);
    assert.equal(lemmaOf(m), "πίστις", q);
    assert.equal(m.lemmas[0].how, "strong");
  }
  assert.deepEqual(matchGreek(fake, "G1").lemmas, []);
});

test("a transliteration finds the lemma however it is spelled", () => {
  for (const q of ["pistis", "Christos", "Khristos", "xristos", "hamartia", "angelos", "agapao", "agapaō"]) {
    const m = matchGreek(fake, q, { near: false });
    assert.equal(m.kind, "latin", q);
    assert.equal(m.lemmas[0].how, "translit", q);
  }
  assert.equal(lemmaOf(matchGreek(fake, "xristos", { near: false })), "Χριστός");
});

test("near misses need five letters of key and the near option", () => {
  const near = matchGreek(fake, "pistoi");
  assert.ok(near.lemmas.some((m) => m.how === "near" && fake.lemmas[m.id].lemma === "πιστός"));
  assert.deepEqual(matchGreek(fake, "pistoi", { near: false }).lemmas, []);
  assert.deepEqual(matchGreek(fake, "lgos").lemmas, []); // four letters: exact only
  assert.equal(matchGreek(fake, "agapo").lemmas[0].how, "near");
});

test("a gloss matches whole words only", () => {
  const faith = matchGreek(fake, "faith");
  assert.deepEqual(faith.lemmas.map((m) => [fake.lemmas[m.id].lemma, m.how]), [["πίστις", "gloss"]]);
  assert.equal(faith.query, "faith");
  assert.equal(lemmaOf(matchGreek(fake, "faithful")), "πιστός");
  assert.equal(matchGreek(fake, "faithful").lemmas.length, 1);
  assert.equal(lemmaOf(matchGreek(fake, "word speech")), "λόγος");
  assert.deepEqual(matchGreek(fake, "one two three four").lemmas, []);
});

test("the tray shows only an exact transliteration or a gloss that is the query, three at most", () => {
  assert.deepEqual(matchForTray(fake, "faith").lemmas.map((m) => fake.lemmas[m.id].lemma), ["πίστις"]);
  assert.deepEqual(matchForTray(fake, "angel").lemmas, []); // "angel" is only a later sense of ἄγγελος
  assert.equal(lemmaOf(matchForTray(fake, "messenger")), "ἄγγελος");
  assert.deepEqual(matchForTray(fake, "pistoi").lemmas, []); // a near miss never reaches the tray
  assert.deepEqual(trayLemmas(fake, { kind: null, lemmas: [] }), []);
  assert.equal(matchForTray(fake, "G4102").lemmas.length, 1);

  const four = prepareIndex({
    format: 2,
    lemmas: ["λέγε", "λήγε", "λέγη", "λήγη"].map((l, i) => [l, null, null, 10 - i, foldGreek(l)]),
  });
  assert.equal(matchGreek(four, "lege").lemmas.length, 4);
  assert.equal(matchForTray(four, "lege").lemmas.length, 3);
});

test("prepareIndex refuses anything that is not the current format", () => {
  assert.equal(GREEK_SEARCH_FORMAT, 2);
  assert.equal(prepareIndex(null), null);
  assert.equal(prepareIndex({ format: 1, lemmas: [] }), null);
  assert.equal(prepareIndex({ format: 2 }), null);
  assert.ok(prepareIndex({ format: 2, lemmas: [] }));
});

// ── occurrences and links ────────────────────────────────────────────────────

test("decodeOccurrences reads the flat list and filters by book and form", () => {
  const entry = [
    ["Λόγος", "λόγον"],
    [0, 1, 1, 1, 0, 0, 3, 3, 16, 2, 1, 1, 3, 3, 17, 4, 0, 0],
    ["N-----NSM-", "N-----ASM-"],
  ];
  const all = decodeOccurrences(entry, BOOK_ORDER);
  assert.equal(all.length, 3);
  assert.deepEqual(all[1], {
    book: BOOK_ORDER[3], chapter: 3, verse: 16, t: 2, form: "λόγον", pos: "N-", parse: "----ASM-",
  });
  assert.equal(all[0].parse, "----NSM-");
  assert.deepEqual(decodeOccurrences(entry, BOOK_ORDER, { bookKey: BOOK_ORDER[3] }).map((o) => o.verse), [16, 17]);
  assert.deepEqual(decodeOccurrences(entry, BOOK_ORDER, { form: "λογον" }).map((o) => o.verse), [16]);
  assert.deepEqual(decodeOccurrences(undefined, BOOK_ORDER), []);
  assert.equal(hasOtherForms(entry, "λογον"), true);
  assert.equal(hasOtherForms([["λόγον"], []], "λογον"), false);
});

test("parseGroup names a word's file: verbs by tense and mood, the rest by case", () => {
  // verbs: "v-" + tense + mood
  assert.equal(parseGroup("V-", "2AAD-S--"), "v-ad"); // aorist imperative
  assert.equal(parseGroup("V-", "-PAPNSM-"), "v-pp"); // present participle
  assert.equal(parseGroup("V-", "-AAN----"), "v-an"); // aorist infinitive
  assert.equal(parseGroup("V-", "3IMI-S--"), "v-ii");
  // everything else with a case: the part of speech and the case
  assert.equal(parseGroup("N-", "----GSF-"), "n-g");
  assert.equal(parseGroup("RA", "----GSF-"), "ra-g");
  assert.equal(parseGroup("RP", "----DSM-"), "rp-d");
  assert.equal(parseGroup("A-", "----NPN-"), "a-n");
  // no case: the part of speech alone
  assert.equal(parseGroup("C-", "--------"), "c");
  assert.equal(parseGroup("D-", "--------"), "d");
  assert.equal(parseGroup("P-", "--------"), "p");
  assert.equal(parseGroup("X-", "--------"), "x");
  assert.equal(parseGroup("I-", "--------"), "i");
  assert.equal(parseGroup("N-", "--------"), "n"); // a caseless noun
  assert.equal(parseGroup("N-", ""), "n");
  // no part of speech: no group
  assert.equal(parseGroup(null, null), null);
  assert.equal(parseGroup("", ""), null);
});

test("every group a word can have is lowercase, filesystem-safe and unique, ignoring case", () => {
  const poss = ["N-", "V-", "RA", "C-", "RP", "P-", "A-", "D-", "RD", "RR", "RI", "X-", "I-"];
  const tenses = "PIFAXY".split("");
  const moods = "INDSOP".split("");
  const cases = "NGDAV-".split("");
  const names = new Set();
  const add = (n) => {
    assert.match(n, /^[a-z]+(-[a-z]+)?$/);
    names.add(n);
  };
  for (const pos of poss) {
    if (pos === "V-") for (const t of tenses) for (const m of moods) add(parseGroup(pos, `-${t}A${m}----`));
    else for (const c of cases) add(parseGroup(pos, `----${c}---`));
  }
  // Distinct as written means distinct on a case-insensitive disk, since all are lowercase.
  assert.equal(names.size, tenses.length * moods.length + (poss.length - 1) * cases.length);
});

test("a code splits into its part of speech and parsing", () => {
  assert.deepEqual(splitCode("N-----GSF-"), { pos: "N-", parse: "----GSF-" });
  assert.deepEqual(splitCode(undefined), { pos: "", parse: "" });
});

test("decodeParseGroup reads a group file into words, and refuses another format", () => {
  const json = {
    format: GREEK_PARSE_FORMAT,
    codes: ["V-2AAD-S--", "V-2AAD-P--"],
    occ: [0, 1, 1, 1, 7, 0, 3, 3, 16, 2, 9, 1],
  };
  const words = decodeParseGroup(json, BOOK_ORDER);
  assert.deepEqual(words, [
    { book: BOOK_ORDER[0], chapter: 1, verse: 1, t: 1, lemmaId: 7, pos: "V-", parse: "2AAD-S--" },
    { book: BOOK_ORDER[3], chapter: 3, verse: 16, t: 2, lemmaId: 9, pos: "V-", parse: "2AAD-P--" },
  ]);
  assert.deepEqual(decodeParseGroup({ ...json, occ: [] }, BOOK_ORDER), []);
  assert.equal(decodeParseGroup({ ...json, format: 2 }, BOOK_ORDER), null);
  assert.equal(decodeParseGroup(null, BOOK_ORDER), null);
  assert.equal(decodeParseGroup({ format: 1, codes: [] }, BOOK_ORDER), null);
});

test("a result links to the verse, naming the word", () => {
  assert.equal(greekHref({ book: "john", chapter: 3, verse: 16, t: 7 }), "/john-3/?greek=16.7#v16");
  assert.deepEqual(parseGreekParam("16.7"), { verse: 16, t: 7 });
  assert.equal(parseGreekParam("16"), null);
  assert.equal(parseGreekParam("a.b"), null);
  assert.equal(parseGreekParam(null), null);
});

test("occShard names the file a lemma's verses are in", () => {
  assert.equal(occShard(fake, 7), "07");
  assert.equal(occShard(fake, 64 + 5), "05");
  assert.equal(occShard(null, 63), "63");
});

// ── the real index ───────────────────────────────────────────────────────────

const read = (rel) =>
  JSON.parse(readFileSync(fileURLToPath(new URL(`../public/greek/search/${rel}`, import.meta.url)), "utf8"));

test("the committed index finds the words readers will type", () => {
  const json = read("lemmas.json");
  const index = prepareIndex(json);
  assert.ok(index, "lemmas.json is the current format");
  assert.ok(index.lemmas.length > 5000);
  const pistis = index.lemmas.find((l) => l.lemma === "πίστις");
  for (const q of ["πιστις", "πίστει", "pistis", "G4102"]) {
    assert.ok(matchGreek(index, q).lemmas.some((x) => x.id === pistis.id), q);
  }
  // UBS's commonest sense of πίστις is glossed "to believe in"; the brief
  // lexicon's "faith" is what makes the English bridge work, and it is what
  // the lemma's line shows.
  assert.equal(matchGreek(index, "faith").lemmas[0].id, pistis.id);
  assert.deepEqual(matchForTray(index, "faith").lemmas.map((m) => m.id), [pistis.id]);
  assert.equal(pistis.shortGloss, "faith");
  // A gloss that is the query outranks a transliteration one letter off.
  const charis = index.lemmas.find((l) => l.lemma === "χάρις");
  assert.equal(matchGreek(index, "grace").lemmas[0].id, charis.id);
  // Another UBS sense's gloss still finds a lemma, after the glosses.
  const believe = matchGreek(index, "believe in");
  assert.ok(believe.lemmas.some((m) => index.lemmas[m.id].lemma === "πιστεύω" && m.how === "sense"));
  // εἰμί is G2076 in MACULA's commonest reading; G1510 reaches it through `also`.
  const eimi = index.lemmas.find((l) => l.lemma === "εἰμί");
  assert.ok(matchGreek(index, "G1510").lemmas.some((x) => x.id === eimi.id));
  assert.ok(matchGreek(index, eimi.strong).lemmas.some((x) => x.id === eimi.id));

  // Ids are NFC code-point order, and each lemma's words are in its shard.
  const names = json.lemmas.map((e) => e[0]);
  assert.deepEqual(names, [...names].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)));
  const shard = read(`occ/${occShard(index, pistis.id)}.json`);
  const occ = decodeOccurrences(shard[pistis.id], BOOK_ORDER);
  assert.equal(occ.length, pistis.count);
  assert.ok(occ.every((o) => o.book && o.chapter > 0 && o.verse > 0 && o.t > 0));
  assert.ok(occ.every((o) => o.pos === "N-" && o.parse.length === 8));
  const genitives = occ.filter((o) => o.parse[4] === "G");
  assert.ok(genitives.length > 50);

  // The parse groups hold the same words, found by lemma id.
  const groups = read("parse.json");
  assert.equal(groups.format, GREEK_PARSE_FORMAT);
  assert.ok(groups.groups["v-ad"] > 700 && groups.groups["n-g"] > 1000);
  const ng = decodeParseGroup(read("parse/n-g.json"), BOOK_ORDER);
  assert.equal(ng.length, groups.groups["n-g"]);
  assert.equal(ng.filter((w) => w.lemmaId === pistis.id).length, genitives.length);
  assert.ok(ng.every((w) => w.pos === "N-" && w.parse[4] === "G"));
});

test("the glossary bridge reaches the Greek from the LIT's own words, first", () => {
  const bridge = prepareBridge({
    format: 1,
    terms: [
      {
        id: "faith-trust",
        title: "Trust",
        traditional: "Faith",
        lemmas: ["πίστις", "πιστός"],
        renderings: [
          { form: "trust", count: 3, verses: [42, 3, 16, 44, 3, 22] },
          { form: "Trust", count: 1, verses: [44, 4, 5] },
        ],
      },
    ],
  });
  const m = matchGreek(fake, "TRUST", { bridge });
  const first = m.lemmas[0];
  assert.equal(fake.lemmas[first.id].lemma, "πίστις");
  assert.equal(first.how, "lit");
  // "trust" and "Trust" are one rendering to a reader: their verses join.
  assert.equal(first.lit.count, 4);
  assert.deepEqual([...litVerseKeys(first.lit)], ["42.3.16", "44.3.22", "44.4.5"]);
  assert.ok(m.lemmas.some((x) => fake.lemmas[x.id].lemma === "πιστός" && x.how === "lit"));
  // The LIT's line names the rendering, with the count searchGreek makes.
  const line = lemmaLine({ ...fake.lemmas[first.id], lit: { ...first.lit, counted: 2 } });
  assert.match(line, /in the LIT “trust”, 2 times$/);
  // Without the bridge, the same query is the lexicons' English alone.
  assert.ok(matchGreek(fake, "trust").lemmas.every((x) => x.how !== "lit"));
  assert.equal(prepareBridge({ format: 2, terms: [] }), null);
});
