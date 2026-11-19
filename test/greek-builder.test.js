// The Greek search builder's rules (src/lib/greek-builder.mjs): the field is the
// only record of a search, the builder reads it with the language's own parser
// and writes it back, and each card offers only what its word takes. The last
// tests read the committed public/greek/search/ index.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import {
  MAX_CARDS,
  builderOffers,
  cannotSay,
  closenessOptions,
  codeCounts,
  emptyCard,
  readBuilder,
  readCardBox,
  resolveCard,
  usableWords,
  needsQuotes,
  writeBuilder,
  writeCard,
} from "../src/lib/greek-builder.mjs";
import { EXAMPLES, filterFor, parseGreekQuery } from "../src/lib/greek-query.mjs";
import { prepareIndex, occShard } from "../src/lib/greek-search.mjs";

const f = (...words) => words.map((w) => filterFor(w));
const card = (words, ...filters) => ({ words, filters: f(...filters) });
const read = (rel) =>
  JSON.parse(readFileSync(fileURLToPath(new URL(`../public/greek/search/${rel}`, import.meta.url)), "utf8"));

// ── Field to builder, and back ──────────────────────────────────────────

test("an empty field is a builder with no cards", () => {
  assert.deepEqual(readBuilder(""), { cards: [], gap: 3, anyOrder: true });
  assert.deepEqual(readBuilder("   "), { cards: [], gap: 3, anyOrder: true });
});

test("a card is written as the notation the commands window teaches", () => {
  assert.equal(writeCard(card(["πίστις"], "gen")), "πίστις.gen");
  assert.equal(writeCard(card([], "aor", "impv")), "*.aor.impv");
  assert.equal(writeCard(card(["Ἰησοῦς", "Χριστός"], "gen", "dat")), "Ἰησοῦς/Χριστός.gen/dat", "two of one kind are either");
  assert.equal(writeCard(card(["πίστις"], "gen", "noun")), "πίστις.noun.gen", "filters read in the order of a parsing");
  assert.equal(writeCard(card(["πίστις"])), "πίστις");
  assert.equal(writeCard(emptyCard()), "", "an empty card writes nothing");
});

test("how close and in what order are written once there are two words", () => {
  const two = [card(["πίστις"], "gen"), card(["Χριστός"], "gen")];
  assert.equal(writeBuilder({ cards: two }), "πίστις.gen, Χριστός.gen", "any order is the default (E161)");
  assert.equal(writeBuilder({ cards: two, gap: 0 }), "πίστις.gen, Χριστός.gen ~0");
  assert.equal(writeBuilder({ cards: two, gap: Infinity, anyOrder: true }), "πίστις.gen, Χριστός.gen ~v");
  assert.equal(writeBuilder({ cards: two, anyOrder: false }), "πίστις.gen > Χριστός.gen", "in this order");
  assert.equal(writeBuilder({ cards: [...two, card(["θεός"])], gap: 0, anyOrder: false }), "πίστις.gen > Χριστός.gen > θεός ~0");
  assert.equal(writeBuilder({ cards: two, gap: 5 }), "πίστις.gen, Χριστός.gen ~5");
  assert.equal(writeBuilder({ cards: [two[0]], gap: 0, anyOrder: false }), "πίστις.gen", "one word has nothing to be close to");
  assert.equal(readBuilder("πίστις.gen > Χριστός.gen").anyOrder, false);
  assert.equal(readBuilder("πίστις.gen, Χριστός.gen").anyOrder, true);
});

test("an empty card waits in the window and never reaches the field", () => {
  assert.equal(writeBuilder({ cards: [card(["πίστις"], "gen"), emptyCard()] }), "πίστις.gen");
  assert.equal(writeBuilder({ cards: [emptyCard()] }), "");
});

test("no more than four words are written", () => {
  const five = Array.from({ length: 5 }, (_, i) => card([`w${i}`], "gen"));
  assert.equal(writeBuilder({ cards: five }).split(",").length, MAX_CARDS);
});

test("what the builder writes reads back as the same cards", () => {
  const builders = [
    { cards: [card(["πίστις"], "gen"), card(["Ἰησοῦς", "Χριστός"], "gen")], gap: 3, anyOrder: false },
    { cards: [card([], "aor", "impv")], gap: 3, anyOrder: false },
    { cards: [card(["πίστις"], "noun", "gen", "sg"), card([], "ptc", "nom"), card(["θεός"])], gap: 0, anyOrder: true },
    { cards: [card(["pistis"], "gen", "dat")], gap: Infinity, anyOrder: false },
  ];
  for (const b of builders) {
    const text = writeBuilder(b);
    const back = readBuilder(text);
    assert.equal(back.cannot, undefined, text);
    assert.equal(writeBuilder(back), text, `${text} writes itself back`);
    assert.equal(parseGreekQuery(text).error, undefined, text);
  }
});

test("every example the window offers is a search the builder can show, and writes in the same notation", () => {
  for (const { query } of EXAMPLES) {
    const back = readBuilder(query);
    assert.equal(back.cannot, undefined, query);
    const text = writeBuilder(back);
    assert.deepEqual(parseGreekQuery(text).terms.map((t) => [t.words, t.filters.map((x) => x.name)]), parseGreekQuery(query).terms.map((t) => [t.words, t.filters.map((x) => x.name)]), query);
  }
  // The same search in words reads, and is written in the shorter notation.
  assert.equal(writeBuilder(readBuilder("pistis genitive and Iesous or Christos genitive")), "pistis.gen, Iesous/Christos.gen");
});

test("one bare word is a card, and a plain word search is not something to build", () => {
  assert.deepEqual(readBuilder("πίστις").cards, [{ words: ["πίστις"], filters: [] }]);
  assert.deepEqual(readBuilder("faith").cards, [{ words: ["faith"], filters: [] }]);
  assert.equal(readBuilder("son of the man").cannot, "plain", "four plain words stay a word search of their own");
  assert.equal(readBuilder("son of man").plain, true, "two or three are read as the construction the field runs (GK3-5)");
});

test("a search the builder can't show says why and is left to the field", () => {
  assert.equal(readBuilder("=πίστεως.gen").cannot, "exact");
  const bad = readBuilder("πίστις.genetive");
  assert.equal(bad.cannot, "error");
  assert.match(cannotSay(bad), /Did you mean genitive/);
  for (const r of [readBuilder("=πίστεως.gen"), readBuilder("son of the man"), bad]) {
    assert.ok(cannotSay(r).length > 20);
  }
  assert.equal(cannotSay({ cards: [] }), "");
});

test("a word that is also a command is written quoted, and reads back as the word", () => {
  for (const [cards, text] of [
    [[card(["perfect"], "gen")], '"perfect".gen'],
    [[card(["love"]), card(["and"])], 'love, "and"'],
    [[card(["any"], "gen")], '"any".gen'],
    [[card(["middle"])], '"middle"'],
    [[card(["present"], "noun")], '"present".noun'],
  ]) {
    assert.equal(writeBuilder({ cards }), text);
    const back = readBuilder(text);
    assert.equal(back.cannot, undefined, text);
    assert.deepEqual(back.cards.map((c) => c.words), cards.map((c) => c.words), text);
    assert.equal(writeBuilder(back), text, `${text} writes itself back`);
    // The field runs what the cards say: the same terms, word for word.
    assert.deepEqual(parseGreekQuery(text).terms.map((t) => t.words), cards.map((c) => c.words), text);
  }
  assert.deepEqual(readBuilder('"son of man".gen').cards[0].words, ["son of man"]);
  assert.equal(needsQuotes("love"), false);
});

test("a command word among several is left out of a card, since a quote can't sit inside an alternative", () => {
  assert.deepEqual(usableWords(["middle", "noun", "love"]), ["love"]);
  assert.deepEqual(usableWords(["middle"]), ["middle"], "one word alone is kept, and quoted");
  const box = readCardBox("love/and").stretches[0];
  assert.deepEqual(box.card.words, ["love"]);
  assert.match(box.note, /also a command/);
});

// ── A card's box (E162): it reads as the field does ─────────────────────

const boxCards = (value) => readCardBox(value).stretches.map((s) => writeCard(s.card));

test("E162: a card's box takes a word with its filters, as dots or as words", () => {
  for (const [typed, notation] of [
    ["πίστις", "πίστις"],
    ["πίστις.gen", "πίστις.gen"],
    ["pistis genitive", "pistis.gen"],
    ["Ἰησοῦς or Χριστός genitive", "Ἰησοῦς/Χριστός.gen"],
    ["*.aor.impv", "*.aor.impv"],
    ["any aorist imperative", "*.aor.impv"],
    [".gen", "*.gen"],
    ['"and"', '"and"'],
    ["", ""],
    ["*", ""],
  ]) {
    const [stretch] = readCardBox(typed).stretches;
    assert.equal(writeCard(stretch.card), notation, typed);
    assert.equal(stretch.clean, true, typed);
  }
});

test("E162: a comma, “>”, “and” or “then” in a box starts the next word", () => {
  assert.deepEqual(boxCards("πίστις, ἀγάπη"), ["πίστις", "ἀγάπη"]);
  assert.deepEqual(boxCards("pistis,agape,elpis"), ["pistis", "agape", "elpis"]);
  assert.deepEqual(boxCards("πίστις, "), ["πίστις", ""], "a comma at the end starts an empty card, for the next word");
  assert.deepEqual(boxCards("pistis and "), ["pistis", ""]);
  assert.deepEqual(boxCards("pistis and"), ["pistis"], "“and” joins only once a space follows it");
  assert.deepEqual(boxCards("pistis andr"), ["pistis"], "so a word starting “and” is never cut");
  assert.deepEqual(boxCards(", πίστις"), ["πίστις"], "a joiner with nothing before it starts nothing");
  assert.deepEqual(boxCards(","), [""]);
  assert.deepEqual(boxCards("a,,b"), ["a", "b"]);
  assert.deepEqual(boxCards('"and", πίστις'), ['"and"', "πίστις"], "a quoted word is a word");
  // The order and the distance are the whole search's, so only said when typed.
  assert.equal(readCardBox("πίστις, ἀγάπη").anyOrder, undefined);
  assert.equal(readCardBox("πίστις > ἀγάπη").anyOrder, false);
  assert.equal(readCardBox("pistis then agape").anyOrder, false);
  assert.equal(readCardBox("πίστις, ἀγάπη &").anyOrder, true);
  assert.equal(readCardBox("πίστις").gap, undefined);
  assert.equal(readCardBox("πίστις ~0").gap, 0);
  assert.equal(readCardBox("πίστις anywhere").gap, Infinity);
  assert.equal(readCardBox("πίστις ~").gap, undefined, "a “~” still being typed sets nothing");
});

test("E162: a word or filter still being typed waits, and the card is what reads before it", () => {
  for (const [typed, notation, why] of [
    ["πίστις.ge", "πίστις", /“ge” isn’t a command/],
    ["pistis g", "pistis", /Two words need a comma/],
    ["pistis genetive", "pistis", /Did you mean genitive/],
    ["holy spirit", "holy", /Two words need a comma/],
    ["πίστις.gen.dat", "πίστις.gen", /both genitive and dative/],
    [".g", "", /“g” isn’t a command/],
  ]) {
    const [stretch] = readCardBox(typed).stretches;
    assert.equal(writeCard(stretch.card), notation, typed);
    assert.equal(stretch.clean, false, typed);
    assert.equal(stretch.raw, typed, typed);
    assert.match(stretch.why, why, typed);
  }
});

test("E162: “=” can't be shown by the builder, so a box leaves it out and says so", () => {
  const [stretch] = readCardBox("=πίστεως").stretches;
  assert.deepEqual(stretch.card.words, ["πίστεως"]);
  assert.equal(stretch.clean, true);
  assert.match(stretch.note, /“=” was left out/);
});

test("the closeness choices keep a typed gap as a choice of its own", () => {
  assert.deepEqual(closenessOptions(3).map((o) => o.gap), [3, 0, Infinity]);
  const five = closenessOptions(5);
  assert.deepEqual(five.map((o) => o.label), ["Within 3 words", "Within 5 words", "Next to each other", "Anywhere in the verse"]);
  assert.equal(closenessOptions(1)[1].label, "Within 1 word");
});

// ── What a word takes ───────────────────────────────────────────────────

test("code counts are read from a shard entry", () => {
  // [forms, flat (book, chapter, verse, t, form, code) x n, codes]
  const entry = [["a", "b"], [0, 1, 1, 1, 0, 0, 0, 1, 2, 3, 1, 1, 0, 1, 4, 2, 0, 0], ["N-----NSM-", "N-----GSM-"]];
  assert.deepEqual([...codeCounts(entry)], [["N-----NSM-", 2], ["N-----GSM-", 1]]);
  assert.equal(codeCounts(null).size, 0);
});

test("with no word, every choice is offered and none is counted", () => {
  const offers = builderOffers(emptyCard(), null);
  assert.deepEqual(offers.map((o) => o.axis), ["pos", "tense", "voice", "mood", "case", "person", "number", "gender", "degree"]);
  assert.ok(offers.every((o) => o.options.every((x) => x.n === null && !x.on)));
  assert.ok(offers.every((o) => o.only === null));
});

test("a noun offers no tense or mood, and a choice narrows the others", () => {
  const rows = [
    { code: "N-----NSF-", n: 10 }, { code: "N-----GSF-", n: 94 }, { code: "N-----DSF-", n: 58 }, { code: "N-----ASF-", n: 55 },
  ];
  const axes = (card) => builderOffers(card, rows).map((o) => o.axis);
  assert.deepEqual(axes(emptyCard()), ["pos", "case", "number", "gender"]);
  const gen = builderOffers(card([], "gen"), rows);
  const kind = (axis) => gen.find((o) => o.axis === axis);
  assert.equal(kind("pos").only.name, "noun", "a kind with one choice is stated");
  assert.deepEqual(kind("case").options.map((o) => [o.filter.name, o.n, o.on]), [
    ["nominative", 10, false], ["genitive", 94, true], ["dative", 58, false], ["accusative", 55, false],
  ]);
  assert.equal(kind("number").options.length, 1);
  assert.equal(kind("number").options[0].n, 94, "singular, among the genitives");
});

test("a choice already made stays listed even when the word has none of it", () => {
  const rows = [{ code: "N-----GSF-", n: 3 }];
  const offers = builderOffers(card(["x"], "aor"), rows);
  const tense = offers.find((o) => o.axis === "tense");
  assert.deepEqual(tense.options.map((o) => [o.filter.name, o.n, o.on]), [["aorist", 0, true]]);
  assert.equal(tense.only, null, "it can be taken off");
});

test("participles carry case and no person; finite verbs the reverse", () => {
  const rows = [
    { code: "V--PAPGSM-", n: 18 }, { code: "V-3AAI-S--", n: 614 }, { code: "V-1PAI-S--", n: 209 },
  ];
  const ptc = builderOffers(card([], "ptc"), rows).map((o) => o.axis);
  assert.ok(ptc.includes("case") && !ptc.includes("person"));
  const ind = builderOffers(card([], "ind"), rows).map((o) => o.axis);
  assert.ok(ind.includes("person") && !ind.includes("case"));
});

test("a real word: πίστις takes four parsings, and the builder offers exactly them", () => {
  const index = prepareIndex(read("lemmas.json"));
  const resolved = resolveCard(index, card(["πίστις"]));
  assert.equal(resolved.ids.length, 1);
  const id = resolved.ids[0];
  assert.equal(index.lemmas[id].lemma, "πίστις");
  const entry = read(`occ/${occShard(index, id)}.json`)[id];
  const counts = codeCounts(entry);
  assert.equal([...counts.values()].reduce((a, b) => a + b, 0), index.lemmas[id].count, "every occurrence is counted");
  const rows = [...counts].map(([code, n]) => ({ code, n }));
  const offers = builderOffers(card(["πίστις"]), rows);
  assert.deepEqual(offers.map((o) => o.axis), ["pos", "case", "number", "gender"]);
  const cases = offers.find((o) => o.axis === "case").options.map((o) => o.filter.name);
  assert.deepEqual(cases, ["nominative", "genitive", "dative", "accusative"]);
  // Every number the builder shows next to a choice is what a search finds.
  const gen = builderOffers(card(["πίστις"], "gen"), rows).find((o) => o.axis === "case").options.find((o) => o.on);
  assert.equal(gen.n, rows.filter((r) => r.code[6] === "G").reduce((a, r) => a + r.n, 0));
});

test("a word the index doesn't know is an error the window can say, and Latin letters reach a lemma", () => {
  const index = prepareIndex(read("lemmas.json"));
  assert.equal(resolveCard(index, card(["ζζζζ"])).error.kind, "unknown");
  assert.equal(resolveCard(index, card([])).any, true);
  const via = resolveCard(index, card(["pistis"]));
  assert.equal(index.lemmas[via.ids[0]].lemma, "πίστις");
  const either = resolveCard(index, card(["Ἰησοῦς", "Χριστός"]));
  assert.equal(either.ids.length, 2);
});
