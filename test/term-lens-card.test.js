// test/term-lens-card.test.js
//
// The term lens's card, driven in a browser DOM (src/scripts/term-lens.js):
// what it says of a marked word's traditional rendering and Greek
// (STUDY-DESK-FIXES.md, E85). The rule itself is term-words.mjs, tested in
// term-words.test.js; this holds the card to it.

import { test } from "node:test";
import assert from "node:assert/strict";
import { settle } from "./helpers/browser-env.mjs";

const { attachTermLens } = await import("../src/scripts/term-lens.js");
const { closePanel } = await import("../src/scripts/lit-panel.js");

// One entry, Faith and pistis, governing three Greek words, as a chapter
// page's #term-lens-data carries it.
const TERMS = {
  "faith-trust": {
    traditional: "Faith",
    greek: "pistis",
    title: "Trust / Faithfulness",
    renderings: [{ form: "trust", count: 242 }, { form: "faithfulness", count: 60 }],
    lemmas: ["πίστις", "πιστός", "πιστεύω"],
    words: [["faith", "pistis"], ["faithful", "pistos"], ["believe", "pisteuo"]],
  },
  "good-admirable": { traditional: "Good [1]", greek: "kalos", title: "Appealing / Admirable", renderings: [], lemmas: ["καλός"] },
  "sin-deviation": {
    traditional: "Sin",
    greek: "hamartia",
    title: "Deviation",
    renderings: [],
    lemmas: ["ἁμαρτία", "ἁμαρτάνω", "ἁμαρτωλός"],
    words: [["sin", "hamartia"], ["sin", "hamartano"], ["sinner", "hamartolos"]],
  },
  "satan-adversary": {
    traditional: "Satan",
    greek: "Satanas",
    title: "The Adversary",
    renderings: [],
    lemmas: ["Σατανᾶς"],
    words: [["Satan", "Satanas"]],
  },
};

const VERSES = [
  "Abraham trusted God.",
  "Their faithfulness stood.",
  "Whoever trusts has confidence.",
  "We believe it.",
  "It was honorable.",
  "They kept deviating.",
  "Then the Adversary left.",
];

/** A chapter of those verses with the lens attached; returns the card's origin line for a word. */
function lensOver(marks) {
  document.body.replaceChildren();
  const box = document.createElement("div");
  box.className = "chapter-paragraphs";
  box.innerHTML = `<p>${VERSES.map((text, i) => `<span data-verse="${i + 1}">${text}</span>`).join(" ")}</p>`;
  document.body.append(box);
  attachTermLens(box, { marks, terms: TERMS });
  return async (word) => {
    const span = [...box.querySelectorAll(".term")].find((s) => s.textContent === word);
    assert.ok(span, `“${word}” is marked`);
    span.click();
    await settle();
    const line = document.querySelector(".term-card .term-card__origin")?.textContent;
    closePanel();
    await settle();
    return line;
  };
}

const mark = (v, text, id, w) => ({ v, text, k: 0, id, form: text, ...(w ? { w } : {}) });

test("the card names the Greek word the verse holds and its traditional word, not the entry's for every mark", async () => {
  const origin = lensOver([
    mark(1, "trusted", "faith-trust", [2]),
    mark(2, "faithfulness", "faith-trust", [0]),
  ]);
  // The verb: not "Traditionally faith · Greek pistis", as it read before.
  assert.equal(await origin("trusted"), "Traditionally believe · Greek pisteuo");
  // The entry's own word reads as it always did.
  assert.equal(await origin("faithfulness"), "Traditionally faith · Greek pistis");
});

test("a verse holding differing words of the family names each of them, and guesses none", async () => {
  const two = lensOver([mark(3, "trusts", "faith-trust", [0, 2])]);
  assert.equal(await two("trusts"), "Traditionally faith or believe · Greek pistis or pisteuo");
  // The entry's own pair is in neither half where the verse lacks its word:
  // it read "Traditionally faith · Greek pistis" there, of a verse with no pistis.
  const lacking = lensOver([mark(3, "trusts", "faith-trust", [1, 2])]);
  assert.equal(await lacking("trusts"), "Traditionally faithful or believe · Greek pistos or pisteuo");
  // Three are a list, with the Oxford comma.
  const three = lensOver([mark(3, "trusts", "faith-trust", [0, 1, 2])]);
  assert.equal(await three("trusts"), "Traditionally faith, faithful, or believe · Greek pistis, pistos, or pisteuo");
});

test("each word is set in italics, the words between them are not", async () => {
  lensOver([mark(3, "trusts", "faith-trust", [0, 2])]);
  document.querySelector(".term").click();
  await settle();
  const line = document.querySelector(".term-card .term-card__origin");
  assert.deepEqual([...line.querySelectorAll("em")].map((em) => em.textContent), ["faith", "believe", "pistis", "pisteuo"]);
  closePanel();
  await settle();
});

test("family words that share a traditional word leave that half sure and name each Greek word", async () => {
  const origin = lensOver([mark(6, "deviating", "sin-deviation", [0, 1])]);
  assert.equal(await origin("deviating"), "Traditionally sin · Greek hamartia or hamartano");
});

test("a name keeps its capital", async () => {
  const origin = lensOver([mark(7, "the Adversary", "satan-adversary", [0])]);
  assert.equal(await origin("the Adversary"), "Traditionally Satan · Greek Satanas");
  // And where the page says nothing of the verse, the entry's own word is the list's spelling.
  const silent = lensOver([mark(7, "the Adversary", "satan-adversary")]);
  assert.equal(await silent("the Adversary"), "Traditionally Satan · Greek Satanas");
});

test("where the LIT keeps the traditional word, only the Greek is given, and it is the word's own", async () => {
  const origin = lensOver([mark(4, "believe", "faith-trust", [2])]);
  assert.equal(await origin("believe"), "Greek pisteuo");
});

test("a page that says nothing of the verse gives the entry's pair, without the glossary's disambiguator", async () => {
  const origin = lensOver([mark(1, "trusted", "faith-trust"), mark(5, "honorable", "good-admirable")]);
  assert.equal(await origin("trusted"), "Traditionally faith · Greek pistis");
  assert.equal(await origin("honorable"), "Traditionally good · Greek kalos");
});
