// test/term-words.test.js
//
// Which traditional word and which Greek word stand behind a key-term mark
// (src/lib/term-words.mjs; STUDY-DESK-FIXES.md, E85): the list they come from
// (LEMMA_WORDS in scripts/lib/glossary-lemmas.mjs), the rule, and the page
// data that carries them (term-lens-data.mjs), swept over every published
// chapter.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { GLOSSARY_LEMMAS, LEMMA_WORDS, lemmaWords } from "../scripts/lib/glossary-lemmas.mjs";
import { termLensFor } from "../src/lib/term-lens-data.mjs";
import {
  familyWordsIn,
  markChoices,
  markOrigin,
  ownTraditional,
  tellingForms,
  tellingText,
  traditionalChoices,
  traditionalHint,
  traditionalWord,
  wordAlternatives,
} from "../src/lib/term-words.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** The glossary entries' frontmatter, by id, drafts included. */
function glossaryEntries() {
  const dir = path.join(root, "src/content/glossary");
  const out = new Map();
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".md"))) {
    const front = readFileSync(path.join(dir, file), "utf8").split(/^---\s*$/m)[1] ?? "";
    const field = (key) => (front.match(new RegExp(`^${key}:\\s*(.*)$`, "m"))?.[1] ?? "").trim().replace(/^(["'])(.*)\1$/, "$2");
    out.set(field("id"), {
      id: field("id"),
      traditional: field("traditional"),
      greek: field("greek"),
      litMenu: field("litMenu"),
      draft: field("draft") === "true",
    });
  }
  return out;
}

/* ── The list ────────────────────────────────────────────────────────── */

// The words Bibles print with a capital, which the list keeps: a name or a
// title of God. Any other capital in the list is a slip.
const CAPITALS = new Set(["Almighty", "Baptist", "Gehenna", "Gentiles", "Hades", "Satan", "Savior"]);

test("every Greek word an entry governs has its own traditional word and spelling, and nothing else does", () => {
  assert.deepEqual(Object.keys(LEMMA_WORDS).sort(), Object.keys(GLOSSARY_LEMMAS).sort());
  let count = 0;
  const capitals = new Set();
  for (const [id, family] of Object.entries(GLOSSARY_LEMMAS)) {
    assert.deepEqual(Object.keys(LEMMA_WORDS[id]).sort(), [...family].sort(), id);
    const pairs = lemmaWords(id);
    assert.equal(pairs.length, family.length, id);
    for (const [i, [traditional, greek]] of pairs.entries()) {
      const where = `${id}: ${family[i]}`;
      // As it reads after "traditionally": words of plain letters, a space, a
      // hyphen or a slash between, no disambiguator, no stray space.
      assert.equal(traditional, traditional.trim(), where);
      assert.doesNotMatch(traditional, /\[\d+\]/, where);
      assert.match(traditional, /^[A-Za-z]+(?:[ /-][A-Za-z]+)*$/, where);
      // Lowercase, but for the words Bibles capitalize.
      for (const word of traditional.split(/[ /-]/)) {
        if (word === word.toLowerCase()) continue;
        assert.ok(CAPITALS.has(word), `${where}: “${word}” has a capital and is not one of the names`);
        capitals.add(word);
      }
      // The glossary's spelling: plain Latin letters, no macrons.
      assert.match(greek, /^[A-Za-z]+$/, where);
      count += 1;
    }
  }
  assert.equal(count, Object.values(GLOSSARY_LEMMAS).reduce((n, family) => n + family.length, 0));
  assert.deepEqual([...capitals].sort(), [...CAPITALS].sort(), "a name in the test's list is no longer in the word list");
});

test("each entry's own traditional word and Greek stand on one of its words, as the entry spells them", () => {
  // So a mark on the entry's own word reads as it did before the list (but
  // for a name's capital), and an entry edited without its line fails here.
  const entries = glossaryEntries();
  let checked = 0;
  for (const id of Object.keys(GLOSSARY_LEMMAS)) {
    const entry = entries.get(id);
    assert.ok(entry, `${id} has a family but no glossary entry`);
    const pairs = lemmaWords(id);
    assert.ok(
      pairs.some(([traditional]) => traditional.toLowerCase() === traditionalWord(entry)),
      `${id}: no word of the family carries the entry's traditional word “${traditionalWord(entry)}”`,
    );
    assert.ok(
      pairs.some(([, greek]) => greek === entry.greek),
      `${id}: no word of the family is spelled as the entry's greek, “${entry.greek}”`,
    );
    checked += 1;
  }
  assert.ok(checked >= 47);
});

test("a family word with no line is an error, not a gap", () => {
  const family = GLOSSARY_LEMMAS["faith-trust"];
  family.push("ἄπιστος");
  try {
    assert.throws(() => lemmaWords("faith-trust"), /no line for ἄπιστος \(faith-trust\)/);
  } finally {
    family.pop();
  }
  assert.equal(lemmaWords("faith-trust").length, 3);
  assert.deepEqual(lemmaWords("no-such-entry"), []);
});

/* ── The rule ────────────────────────────────────────────────────────── */

const TRUST = {
  traditional: "Faith",
  greek: "pistis",
  words: [["faith", "pistis"], ["faithful", "pistos"], ["believe", "pisteuo"]],
};
const SIN = {
  traditional: "Sin",
  greek: "hamartia",
  words: [["sin", "hamartia"], ["sin", "hamartano"], ["sinner", "hamartolos"]],
};

test("traditionalWord: lowercase, without the glossary's disambiguator", () => {
  assert.equal(traditionalWord({ traditional: "Good [2]" }), "good");
  assert.equal(traditionalWord({ traditional: "Gehenna/Hell" }), "gehenna/hell");
  assert.equal(traditionalWord(null), "");
  assert.equal(traditionalHint("believe"), "traditionally believe");
});

test("markChoices: the family words the mark's verse holds, each pair once", () => {
  assert.deepEqual(markChoices(TRUST, { w: [2] }), [{ traditional: "believe", greek: "pisteuo" }]);
  assert.deepEqual(markChoices(TRUST, { w: [0, 2, 2] }), [
    { traditional: "faith", greek: "pistis" },
    { traditional: "believe", greek: "pisteuo" },
  ]);
  // An index the term has no word for, a mark with no `w`, a term with no words: nothing.
  assert.deepEqual(markChoices(TRUST, { w: [9] }), []);
  assert.deepEqual(markChoices(TRUST, {}), []);
  assert.deepEqual(markChoices({ traditional: "Faith" }, { w: [0] }), []);
  assert.deepEqual(markChoices(null, null), []);
});

const ADVERSARY = { traditional: "Satan", greek: "Satanas", words: [["Satan", "Satanas"]] };

test("ownTraditional: the entry's own word as the page's list spells it, a name's capital kept", () => {
  assert.equal(ownTraditional(ADVERSARY), "Satan");
  assert.equal(ownTraditional(TRUST), "faith");
  // A page with no list: the entry's heading, lowercase.
  assert.equal(ownTraditional({ traditional: "Satan" }), "satan");
  assert.equal(ownTraditional({ traditional: "Good [2]", words: [["good", "agathos"]] }), "good");
  assert.equal(ownTraditional(null), "");
});

test("markOrigin: one family word in the verse gives the card that word's own pair", () => {
  assert.deepEqual(markOrigin(TRUST, { w: [2] }), { traditional: ["believe"], greek: ["pisteuo"] });
  assert.deepEqual(markOrigin(TRUST, { w: [0] }), { traditional: ["faith"], greek: ["pistis"] });
  assert.deepEqual(markOrigin(ADVERSARY, { w: [0] }), { traditional: ["Satan"], greek: ["Satanas"] });
});

test("markOrigin: where the verse's family words differ, that half names each, and never a word the verse lacks", () => {
  // believe or faith, pisteuo or pistis: nothing says which, so both, in the family's order.
  assert.deepEqual(markOrigin(TRUST, { w: [0, 2] }), { traditional: ["faith", "believe"], greek: ["pistis", "pisteuo"] });
  // faithful or believe: the entry's own word is in neither half, the verse not holding it.
  assert.deepEqual(markOrigin(TRUST, { w: [1, 2] }), { traditional: ["faithful", "believe"], greek: ["pistos", "pisteuo"] });
  // Two words with one traditional word: that half is sure, the Greek is not.
  assert.deepEqual(markOrigin(SIN, { w: [0, 1] }), { traditional: ["sin"], greek: ["hamartia", "hamartano"] });
  assert.deepEqual(markOrigin(SIN, { w: [1, 2] }), { traditional: ["sin", "sinner"], greek: ["hamartano", "hamartolos"] });
  assert.deepEqual(markOrigin(TRUST, { w: [0, 1, 2] }), {
    traditional: ["faith", "faithful", "believe"],
    greek: ["pistis", "pistos", "pisteuo"],
  });
});

test("markOrigin: a page that says nothing of the verse gives the entry's own pair, plainly", () => {
  assert.deepEqual(markOrigin(TRUST, {}), { traditional: ["faith"], greek: ["pistis"] });
  assert.deepEqual(markOrigin({ traditional: "Good [1]", greek: "kalos" }, { w: [0] }), { traditional: ["good"], greek: ["kalos"] });
  assert.deepEqual(markOrigin(ADVERSARY, {}), { traditional: ["Satan"], greek: ["Satanas"] });
  assert.deepEqual(markOrigin(null, null), { traditional: [], greek: [] });
});

test("traditionalChoices: one word where the verse leaves no doubt, several where it does, the entry's where it is silent", () => {
  assert.deepEqual(traditionalChoices(TRUST, { w: [2] }), ["believe"]);
  assert.deepEqual(traditionalChoices(TRUST, { w: [0, 2] }), ["faith", "believe"]);
  assert.deepEqual(traditionalChoices(SIN, { w: [0, 1] }), ["sin"]);
  assert.deepEqual(traditionalChoices(SIN, { w: [1, 2] }), ["sin", "sinner"]);
  assert.deepEqual(traditionalChoices(TRUST, {}), ["faith"]);
  assert.deepEqual(traditionalChoices(ADVERSARY, {}), ["Satan"]);
  assert.deepEqual(traditionalChoices({}, {}), []);
});

test("wordAlternatives: either side of a slash is the word", () => {
  assert.deepEqual(wordAlternatives("forgive/leave"), ["forgive", "leave"]);
  assert.deepEqual(wordAlternatives("faith / believe"), ["faith", "believe"]);
  assert.deepEqual(wordAlternatives("commit adultery"), ["commit adultery"]);
  assert.deepEqual(wordAlternatives(""), []);
  assert.deepEqual(wordAlternatives(undefined), []);
});

test("tellingForms and tellingText: a phrase tells by its own word, not by the small word that carries it", () => {
  assert.deepEqual(tellingForms("have mercy"), ["have mercy", "mercy"]);
  assert.deepEqual(tellingForms("make atonement/be merciful"), ["make atonement", "atonement", "be merciful", "merciful"]);
  assert.deepEqual(tellingForms("have fellowship with"), ["have fellowship with", "fellowship"]);
  assert.deepEqual(tellingForms("commit sexual immorality"), ["commit sexual immorality", "sexual immorality"]);
  // A word with nothing to set aside is itself, once.
  assert.deepEqual(tellingForms("believe"), ["believe"]);
  assert.deepEqual(tellingForms("faith / believe"), ["faith", "believe"]);
  assert.deepEqual(tellingForms(undefined), []);
  assert.equal(tellingText("make atonement/be merciful"), "atonement / merciful");
  assert.equal(tellingText("worship/show godliness"), "worship / godliness");
  assert.equal(tellingText("believe"), "believe");
  assert.equal(tellingText(""), "");
});

test("every phrase in the list leans only on verbs the give-away checks set aside", () => {
  // A list phrase's first word is its carrier when it is a verb phrase. This
  // holds the two in step: a new "do justice" or "give thanks" would make
  // every note saying "do" or "give" look like a give-away.
  const VERB_PHRASES = new Map();
  for (const id of Object.keys(GLOSSARY_LEMMAS)) {
    for (const [traditional] of lemmaWords(id)) {
      for (const alternative of wordAlternatives(traditional)) {
        const words = alternative.split(" ");
        if (words.length > 1) VERB_PHRASES.set(alternative, tellingText(alternative));
      }
    }
  }
  assert.deepEqual(Object.fromEntries(VERB_PHRASES), {
    "be merciful": "merciful",
    "call blessed": "blessed",
    "commit adultery": "adultery",
    "commit sexual immorality": "sexual immorality",
    "fellow partaker": "fellow partaker",
    "have fellowship with": "fellowship",
    "have mercy": "mercy",
    "make atonement": "atonement",
    "mercy seat": "mercy seat",
    "preach the gospel": "preach gospel",
    "righteous act": "righteous act",
    "sexual immorality": "sexual immorality",
    "sexually immoral": "sexually immoral",
    "show godliness": "godliness",
  });
});

test("familyWordsIn: which of a family's words a verse holds, in the family's order", () => {
  const family = ["πίστις", "πιστός", "πιστεύω"];
  assert.deepEqual(familyWordsIn(family, new Set(["καί", "πιστεύω", "ὁ"])), [2]);
  assert.deepEqual(familyWordsIn(family, ["πιστεύω", "πίστις"]), [0, 2]);
  assert.deepEqual(familyWordsIn(family, new Set(["καί"])), []);
  // A verse the Greek lacks, or a term with no family.
  assert.deepEqual(familyWordsIn(family, undefined), []);
  assert.deepEqual(familyWordsIn(undefined, new Set(["πίστις"])), []);
  // The borrowed passages write a name's lemma without its capital, and a
  // decomposed accent is the same letter.
  assert.deepEqual(familyWordsIn(["Σατανᾶς"], new Set(["σατανᾶς"])), [0]);
  assert.deepEqual(familyWordsIn(["πίστις"], new Set(["πίστις".normalize("NFD")])), [0]);
});

/* ── The page data, over the whole text ──────────────────────────────── */

test("every published chapter's marks say which word of the family their verse holds", () => {
  const all = glossaryEntries();
  const entries = new Map([...all].filter(([, e]) => !e.draft));
  const dir = path.join(root, "src/data/chapters");
  let marks = 0;
  let placed = 0;
  let another = 0;
  let open = 0;
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".json"))) {
    const chapter = JSON.parse(readFileSync(path.join(dir, file), "utf8"));
    if (chapter.indexed === false || !chapter.paragraphs?.length) continue;
    const data = termLensFor(chapter.bookKey, chapter.chapter, chapter.paragraphs, entries);
    for (const [id, term] of Object.entries(data.terms)) {
      assert.equal(term.words.length, term.lemmas.length, `${file}: ${id}`);
    }
    for (const mark of data.marks) {
      marks += 1;
      if (!mark.w) continue;
      placed += 1;
      const term = data.terms[mark.id];
      for (const i of mark.w) assert.ok(term.words[i], `${file}, verse ${mark.v}: ${mark.id} has no word ${i}`);
      const choices = traditionalChoices(term, mark);
      if (choices.length > 1) open += 1;
      else if (choices[0].toLowerCase() !== traditionalWord(term)) another += 1;
      // The card never names a word the verse lacks: each half is drawn from
      // the family words the verse holds.
      const origin = markOrigin(term, mark);
      const held = mark.w.map((i) => term.words[i]);
      for (const word of origin.traditional) assert.ok(held.some((pair) => pair[0] === word), `${file}, verse ${mark.v}: “${word}”`);
      for (const word of origin.greek) assert.ok(held.some((pair) => pair[1] === word), `${file}, verse ${mark.v}: “${word}”`);
    }
  }
  assert.ok(marks > 3000, `only ${marks} marks: the alignment data wasn't read`);
  // Nearly every mark's verse holds a word of its term's family. If this
  // falls, the Greek files aren't being read, and every card and hint has
  // gone back to its entry's word with nothing on the page to say so.
  assert.ok(placed / marks > 0.99, `${placed} of ${marks} marks know their verse's family words`);
  // The reason any of this exists: about a third sit on another word than
  // their entry's own (31% when E85 was measured).
  assert.ok(another / marks > 0.2, `${another} of ${marks} marks carry another word than their entry's`);
  // And few are left to a choice (3% then).
  assert.ok(open / marks < 0.06, `${open} of ${marks} marks are in a verse with two differing family words`);
});
