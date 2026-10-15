// Searching the Greek with commands (src/lib/greek-query.mjs): reading a
// query, looking its words up, matching a construction and saying it back.
// The last tests load the committed public/greek/search/ index and check the
// searches the commands window offers against counts taken from the data
// itself, so a change to the rules or to the data that moves them fails here.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import {
  AXES,
  COMMANDS,
  EXAMPLES,
  FILTERS,
  codeFits,
  countLine,
  describeGreekQuery,
  errorMessage,
  filterFor,
  groupsForFilters,
  isCommandQuery,
  isSimpleQuery,
  matchConstruction,
  nearestFilter,
  parseGreekQuery,
  resolveGreekQuery,
} from "../src/lib/greek-query.mjs";
import { decodeOccurrences, decodeParseGroup, occShard, prepareIndex } from "../src/lib/greek-search.mjs";
import { BOOK_ORDER } from "../src/data/books.js";

const names = (filters) => filters.map((f) => f.name);
const shape = (parsed) =>
  parsed.error ?? {
    terms: parsed.terms.map((t) => ({ words: t.words, exact: t.exact, filters: names(t.filters) })),
    gap: parsed.gap,
    anyOrder: parsed.anyOrder,
  };

// ── Filters ─────────────────────────────────────────────────────────────

test("every filter word names its filter, and no word names two", () => {
  const seen = new Map();
  for (const f of FILTERS) {
    assert.ok(AXES.includes(f.axis), f.name);
    for (const w of f.words) {
      assert.equal(seen.has(w), false, `${w} is listed twice`);
      seen.set(w, f);
      assert.equal(filterFor(w), f);
      assert.equal(filterFor(w.toUpperCase()), f, "filters ignore case");
    }
  }
  assert.equal(filterFor("faith"), null);
});

test("a mistyped filter word is matched to the one it was probably meant to be", () => {
  assert.equal(nearestFilter("genetive"), "genitive");
  assert.equal(nearestFilter("imperitive"), "imperative");
  assert.equal(nearestFilter("aorst"), "aorist");
  assert.equal(nearestFilter("noon"), "noun");
  assert.equal(nearestFilter("gen"), null, "short words are not guessed at");
  assert.equal(nearestFilter("faithful"), null);
});

test("codeFits reads each axis at its place in a ten-character code", () => {
  const aorImpv = "V-2AAD-P--";
  const gen = (name) => filterFor(name);
  assert.equal(codeFits([gen("aor"), gen("impv")], aorImpv), true);
  assert.equal(codeFits([gen("2nd"), gen("pl"), gen("act")], aorImpv), true);
  assert.equal(codeFits([gen("pres")], aorImpv), false);
  assert.equal(codeFits([gen("verb")], aorImpv), true);
  assert.equal(codeFits([gen("gen"), gen("fem"), gen("sg"), gen("noun")], "N-----GSF-"), true);
  assert.equal(codeFits([gen("pronoun")], "RP----GS--"), true);
  assert.equal(codeFits([gen("pronoun")], "RA----GSM-"), false, "the article is not a pronoun");
  assert.equal(codeFits([gen("article")], "RA----GSM-"), true);
  assert.equal(codeFits([gen("comp")], "A-----NSMC"), true);
  assert.equal(codeFits([], "C---------"), true);
});

// ── Which queries are command queries ───────────────────────────────────

test("one bare word is always a word, and plain English stays a gloss search", () => {
  for (const q of ["πίστις", "pistis", "G4102", "any", "exact", "and", "or", "perfect", "genitive", "\"any\"", "son of man", "faith hope", ""]) {
    assert.equal(isCommandQuery(q), false, q);
  }
  for (const q of ["πίστις.gen", "*.aor.impv", "πίστεως Ἰησοῦ", "faith and love", "aorist imperative", "pistis genitive", "=πίστεως", "πίστις, Χριστός", "πίστις & νόμος", "first person verbs"]) {
    assert.equal(isCommandQuery(q), true, q);
  }
});

test("a lone word, a command word or a parsing word alone, reads as a simple word", () => {
  for (const [q, word] of [["any", "any"], ["exact", "exact"], ["perfect", "perfect"], ["genitive", "genitive"], ["\"and\"", "and"], ["πίστις", "πίστις"]]) {
    const parsed = parseGreekQuery(q);
    assert.equal(isSimpleQuery(parsed), true, q);
    assert.deepEqual(parsed.terms[0].words, [word], q);
  }
  assert.equal(isSimpleQuery(parseGreekQuery("πίστις.gen")), false);
  assert.equal(isSimpleQuery(parseGreekQuery("=πίστεως")), false);
});

// ── Reading a query ─────────────────────────────────────────────────────

test("symbols and their words read the same", () => {
  const pairs = [
    ["πίστις.gen, Ἰησοῦς/Χριστός.gen", "πίστις genitive and Ἰησοῦς or Χριστός genitive"],
    ["*.aor.impv", "any aorist imperative"],
    ["=πίστεως", "exact πίστεως"],
    ["=πίστεως", "exactly πίστεως"],
    ["πίστις, νόμος ~v &", "πίστις and νόμος, anywhere, any order"],
    ["πίστις ~0 Χριστός", "πίστις next to Χριστός"],
    ["πίστις ~5 Χριστός", "πίστις within 5 words Χριστός"],
    ["*.1st.sg.fut.ind", "any first person singular future indicative"],
  ];
  for (const [a, b] of pairs) assert.deepEqual(shape(parseGreekQuery(b)), shape(parseGreekQuery(a)), b);
});

test("a query reads into terms, their filters, and one distance for the whole query", () => {
  assert.deepEqual(shape(parseGreekQuery("πίστις.gen, Ἰησοῦς/Χριστός.gen")), {
    terms: [
      { words: ["πίστις"], exact: false, filters: ["genitive"] },
      { words: ["Ἰησοῦς", "Χριστός"], exact: false, filters: ["genitive"] },
    ],
    gap: 3,
    anyOrder: false,
  });
  assert.deepEqual(shape(parseGreekQuery("πίστις.gen, *.gen.noun")).terms[1], { words: null, exact: false, filters: ["genitive", "noun"] });
  assert.deepEqual(shape(parseGreekQuery("pistis genitive, genitive noun")).terms.map((t) => t.filters), [["genitive"], ["genitive", "noun"]],
    "after a comma, a parsing word starts any word");
  assert.deepEqual(shape(parseGreekQuery("πίστις .gen")).terms[0].filters, ["genitive"], "a dot after a space narrows the word before it");
  assert.equal(parseGreekQuery("πίστις, Χριστός ~v").gap, Infinity);
  assert.equal(parseGreekQuery("πίστεως Ἰησοῦ").terms.length, 2, "a space between two words is a construction too");
});

test("quotes keep a command word a word", () => {
  const p = shape(parseGreekQuery("πίστις and \"and\""));
  assert.deepEqual(p.terms.map((t) => t.words), [["πίστις"], ["and"]]);
  assert.deepEqual(shape(parseGreekQuery("“any” and πίστις.gen")).terms[0].words, ["any"]);
});

test("a command at the end waits for what follows", () => {
  for (const q of ["πίστις and", "πίστις,", "πίστις, ", "πίστις or", "πίστις/", "πίστις.", "πίστις and any", "πίστις, *", "πίστις exact", "πίστις within", "πίστις next"]) {
    const p = parseGreekQuery(q);
    assert.equal(p.error, undefined, q);
    assert.deepEqual(p.terms.map((t) => t.words), [["πίστις"]], q);
  }
  assert.equal(parseGreekQuery("and").terms[0].words[0], "and", "alone, it is the word");
  assert.equal(parseGreekQuery("πίστις, Χριστός ~3").gap, 3, "a finished distance at the end stays");
  assert.deepEqual(parseGreekQuery("   ").terms, []);
});

test("errors: a misspelled filter, two of one kind, any word with no filter", () => {
  assert.deepEqual(parseGreekQuery("πίστις.genetive").error, { kind: "near", word: "genetive", near: "genitive" });
  assert.deepEqual(parseGreekQuery("πίστις.xyz").error, { kind: "notCommand", word: "xyz" });
  assert.deepEqual(parseGreekQuery("πίστις.gen.dat").error, { kind: "conflict", word: "dat", other: "genitive", name: "dative" });
  assert.deepEqual(parseGreekQuery("πίστις, *, Χριστός").error, { kind: "bareAny" });
  assert.equal(parseGreekQuery("πίστις.gen.gen").error, undefined, "the same filter twice is fine");
});

test("every error has a sentence for the reader", () => {
  for (const kind of ["near", "notCommand", "conflict", "bareAny", "exactGreek", "unknown", "other"]) {
    const m = errorMessage({ kind, word: "x", near: "genitive", other: "genitive", name: "dative" });
    assert.ok(m.text.length > 10, kind);
    assert.doesNotMatch(m.text, /—/, "no em dashes in reader-facing text");
  }
  assert.equal(errorMessage({ kind: "near", word: "genetive", near: "genitive" }).text, "“genetive” isn’t a command. Did you mean genitive?");
});

// ── The parse groups ────────────────────────────────────────────────────

test("groupsForFilters keeps only the groups that can hold such a word", () => {
  const all = ["a-g", "a-n", "c", "d", "n-g", "n-n", "p", "ra-g", "rd-g", "rp-g", "v-ad", "v-ai", "v-ap", "v-pi", "v-pn", "v-pp", "x"];
  const f = (...w) => w.map(filterFor);
  assert.deepEqual(groupsForFilters(f("aor", "impv"), all), ["v-ad"]);
  assert.deepEqual(groupsForFilters(f("gen", "noun"), all), ["n-g"]);
  assert.deepEqual(groupsForFilters(f("gen"), all), ["a-g", "n-g", "ra-g", "rd-g", "rp-g", "v-ap", "v-pp"], "participles have a case");
  assert.deepEqual(groupsForFilters(f("pronoun"), all), ["rd-g", "rp-g"]);
  assert.deepEqual(groupsForFilters(f("conj"), all), ["c"]);
  assert.deepEqual(groupsForFilters(f("2nd", "pl"), all), ["v-ad", "v-ai", "v-pi"], "person is for finite verbs");
  assert.deepEqual(groupsForFilters(f("aor"), all), ["v-ad", "v-ai", "v-ap"]);
});

// ── Matching ────────────────────────────────────────────────────────────

test("matchConstruction: order, distance, one match per first word, Bible order", () => {
  const w = (book, chapter, verse, t) => ({ book, chapter, verse, t });
  const first = [w(1, 2, 16, 13), w(1, 2, 16, 25), w(0, 3, 22, 5), w(0, 3, 23, 1)];
  const second = [w(1, 2, 16, 14), w(1, 2, 16, 15), w(1, 2, 16, 26), w(0, 3, 22, 7), w(0, 3, 23, 9)];
  const hits = matchConstruction([first, second], { gap: 3 });
  assert.deepEqual(hits, [
    { book: 0, chapter: 3, verse: 22, matches: [[5, 7]] },
    { book: 1, chapter: 2, verse: 16, matches: [[13, 14, 15], [25, 26]] },
  ]);
  assert.equal(countLine(hits), "3 matches in 2 verses");
  assert.deepEqual(matchConstruction([first, second], { gap: 0 }).map((h) => h.matches), [[[13, 14], [25, 26]]], "next to each other");
  assert.equal(matchConstruction([second, first], { gap: 3 }).length, 0, "in order by default");
  assert.equal(matchConstruction([second, first], { gap: 3, anyOrder: true }).length, 2);
  assert.equal(matchConstruction([first, second], { gap: Infinity }).length, 3);
  assert.equal(countLine(matchConstruction([first], {})), "4 matches in 3 verses", "one term: every word");
  assert.equal(countLine([{ matches: [[1]] }]), "1 match in 1 verse");
});

// ── Saying it back ──────────────────────────────────────────────────────

test("the readback names the search in plain English", () => {
  const term = (filters, shown = null, extra = {}) => ({
    filters: filters.map(filterFor), lemmaIds: shown ? [0] : null, shown: shown ?? [], exact: false, ...extra,
  });
  const say = (terms, opts = {}) => describeGreekQuery({ terms, gap: 3, anyOrder: false, ...opts });
  const πίστις = [{ word: "πίστις", lemmas: ["πίστις"], gloss: null }];
  const IX = [{ word: "Ἰησοῦς", lemmas: ["Ἰησοῦς"], gloss: null }, { word: "Χριστός", lemmas: ["Χριστός"], gloss: null }];
  assert.equal(say([term(["gen"], πίστις), term(["gen"], IX)]),
    "Genitives of πίστις, followed within 3 words by a genitive of Ἰησοῦς or Χριστός");
  assert.equal(say([term(["aor", "impv"])]), "Aorist imperatives");
  assert.equal(say([term(["aor", "impv", "2nd", "pl"])]), "Aorist imperatives (2nd person plural)");
  assert.equal(say([term(["gen", "ptc"])]), "Genitive participles");
  assert.equal(say([term(["gen", "noun"])]), "Genitive nouns");
  assert.equal(say([term([], πίστις)]), "Any form of πίστις");
  assert.equal(say([term(["gen"], πίστις), term(["gen", "noun"])], { gap: 0 }), "Genitives of πίστις, followed directly by a genitive noun");
  assert.equal(say([term([], πίστις), term([], [{ word: "law", lemmas: ["νόμος"], gloss: "law" }])], { gap: Infinity, anyOrder: true }),
    "Any form of πίστις, with νόμος (“law”) anywhere in the verse, in either order");
  assert.equal(say([term([], [{ word: "πίστεως", lemmas: ["πίστις"], gloss: null }], { exact: true })]), "The form πίστεως");
  assert.equal(say([term(["aor", "impv"]), term(["acc"])]), "Aorist imperatives, followed within 3 words by an accusative");
  const html = describeGreekQuery(
    { terms: [term(["gen"], πίστις)], gap: 3, anyOrder: false },
    { greek: (s) => `<span lang="grc">${s}</span>` },
  );
  assert.equal(html, "Genitives of <span lang=\"grc\">πίστις</span>");
});

// ── The commands window ─────────────────────────────────────────────────

test("every command the window lists is one a query accepts", () => {
  for (const group of COMMANDS) {
    assert.ok(group.title && group.items.length, group.title);
    for (const item of group.items) {
      assert.ok(item.means, item.code);
      assert.doesNotMatch(`${item.means} ${item.note ?? ""}`, /—/, "no em dashes in reader-facing text");
      if (item.filter) {
        assert.ok(filterFor(item.filter), item.filter);
        assert.equal(parseGreekQuery(`πίστις${item.insert}`).error, undefined, item.insert);
      }
    }
  }
  const listed = new Set(COMMANDS.flatMap((g) => g.items.map((i) => i.filter)).filter(Boolean));
  for (const f of FILTERS) assert.ok(listed.has(f.words[f.words.length - 1]), `${f.name} is in the window`);
});

// ── The committed index ─────────────────────────────────────────────────

const read = (rel) =>
  JSON.parse(readFileSync(fileURLToPath(new URL(`../public/greek/search/${rel}`, import.meta.url)), "utf8"));

function searchCommitted(q) {
  const index = prepareIndex(read("lemmas.json"));
  const groupNames = Object.keys(read("parse.json").groups);
  const parsed = parseGreekQuery(q);
  assert.equal(parsed.error, undefined, q);
  const resolved = resolveGreekQuery(index, parsed);
  assert.equal(resolved.error, undefined, q);
  const lists = resolved.terms.map((term) => {
    if (term.lemmaIds) {
      return term.lemmaIds.flatMap((id) =>
        decodeOccurrences(read(`occ/${occShard(index, id)}.json`)[id], BOOK_ORDER, { form: term.form })
          .filter((w) => codeFits(term.filters, w.pos + w.parse)));
    }
    return groupsForFilters(term.filters, groupNames).flatMap((g) =>
      decodeParseGroup(read(`parse/${g}.json`), BOOK_ORDER).filter((w) => codeFits(term.filters, w.pos + w.parse)));
  });
  return { resolved, hits: matchConstruction(lists, { gap: resolved.gap, anyOrder: resolved.anyOrder, bookOrder: BOOK_ORDER }) };
}

test("the committed index: pistis Christou, typed in Greek and in words", () => {
  for (const q of ["πίστις.gen, Ἰησοῦς/Χριστός.gen", "pistis genitive and Iesous or Christos genitive"]) {
    const { resolved, hits } = searchCommitted(q);
    assert.equal(countLine(hits), "6 matches in 5 verses", q);
    assert.deepEqual(hits.map((h) => `${h.book} ${h.chapter}:${h.verse}`),
      ["romans 3:22", "romans 3:26", "galatians 2:16", "galatians 3:22", "philippians 3:9"], q);
    assert.equal(describeGreekQuery(resolved), "Genitives of πίστις, followed within 3 words by a genitive of Ἰησοῦς or Χριστός");
  }
});

test("the committed index: parsing alone, and a word narrowed by parsing", () => {
  assert.equal(countLine(searchCommitted("*.aor.impv").hits), "762 matches in 615 verses");
  assert.equal(countLine(searchCommitted("any aorist imperative").hits), "762 matches in 615 verses");
  assert.equal(searchCommitted("πίστις.gen").hits.reduce((n, h) => n + h.matches.length, 0), 94);
  assert.equal(countLine(searchCommitted("πίστις.gen ~0 Χριστός.gen").hits), "2 matches in 2 verses");
});

test("the committed index: every example the window offers finds something", () => {
  for (const { query } of EXAMPLES) assert.ok(searchCommitted(query).hits.length > 0, query);
});
