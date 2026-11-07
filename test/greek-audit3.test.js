// Audit 3, session 4 (GK3): the pure rules behind the Greek findings. The
// 300-character error (GK3-7), the builder reading plain Latin words and
// LIT renderings (GK3-4, GK3-5), what a card's text box left out (GK3-15), the
// narrow fallback for a command that finds nothing lemma-first (decision 12),
// the offers table that must not know "constructor" (GK3-6, GK3-14), and the
// Greek tab's plain-text copy (GK3-12).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import {
  MAX_QUERY_LENGTH,
  errorMessage,
  formFallbackTerm,
  parseGreekQuery,
  plainLatinWords,
  resolveGreekQuery,
} from "../src/lib/greek-query.mjs";
import { needsBridge, readBuilder, readCardText, resolveCard, writeBuilder } from "../src/lib/greek-builder.mjs";
import { prepareBridge, prepareIndex } from "../src/lib/greek-search.mjs";
import { plainTextOf } from "../src/lib/desk-greek-text.mjs";
import { parseHtml } from "./helpers/mini-dom.js";

const read = (rel) =>
  JSON.parse(readFileSync(fileURLToPath(new URL(`../public/greek/search/${rel}`, import.meta.url)), "utf8"));
const index = prepareIndex(read("lemmas.json"));

// ── GK3-7: past 300 characters, an error, never a silent cut ────────────

test("GK3-7: a query of 300 characters reads; one of 301 is an error that says so", () => {
  const word = "λόγος";
  const fits = Array.from({ length: 49 }, () => word).join("/") + ".gen"; // 49 * 5 + 48 + 4 = 297
  const ok = parseGreekQuery(`${fits}  `);
  assert.equal(ok.error, undefined);
  assert.equal(ok.terms[0].filters.length, 1, "the filter at the end is kept");
  assert.equal(ok.terms[0].words.length, 49);

  const exactly = "a".repeat(MAX_QUERY_LENGTH - 4) + ".gen";
  assert.equal(exactly.length, MAX_QUERY_LENGTH);
  assert.equal(parseGreekQuery(exactly).error, undefined);

  const long = Array.from({ length: 60 }, () => "λόγος").join("/") + "/θεός.gen"; // over 300
  assert.ok(long.length > MAX_QUERY_LENGTH);
  const res = parseGreekQuery(long);
  assert.equal(res.error.kind, "tooLong");
  assert.equal(res.error.length, long.length);
  assert.equal(res.terms, undefined, "nothing is searched");
});

test("GK3-7: the sentence says why and what to do, with the real length", () => {
  const { text } = errorMessage({ kind: "tooLong", length: 1234 });
  assert.match(text, /at most 300 characters/);
  assert.match(text, /1,234/);
  assert.match(text, /Shorten it in the field/);
  assert.ok(!/—/.test(text), "no em dash");
});

test("GK3-7: the builder says it can't show a query that is too long and leaves the field alone", () => {
  const long = "λόγος/".repeat(60) + "θεός.gen";
  const read = readBuilder(long);
  assert.equal(read.cannot, "error");
  assert.equal(read.error.kind, "tooLong");
});

test("GK3-7: huge input is refused at once", () => {
  const start = performance.now();
  assert.equal(parseGreekQuery("a ".repeat(500_000)).error.kind, "tooLong");
  assert.equal(parseGreekQuery(" ".repeat(1_000_000) + "λόγος").error, undefined, "white space around is trimmed first");
  assert.ok(performance.now() - start < 1000);
});

// ── GK3-5: two or three plain Latin words are a construction ────────────

test("GK3-5: plainLatinWords is two or three words of letters", () => {
  for (const q of ["pistis Christos", "logos theos", "faith hope love", "son of man", "self-preservation x"]) {
    assert.equal(plainLatinWords(q), true, q);
  }
  for (const q of ["pistis", "one two three four", "pistis 3", "πίστις Χριστός", "a.b c", ""]) {
    assert.equal(plainLatinWords(q), false, q);
  }
});

test("GK3-5: the builder reads plain Latin words as cards, and says it did", () => {
  const two = readBuilder("pistis Christos");
  assert.equal(two.cannot, undefined);
  assert.equal(two.plain, true);
  assert.deepEqual(two.cards.map((c) => c.words), [["pistis"], ["Christos"]]);
  assert.equal(readBuilder("logos theos kyrios").cards.length, 3);
  // Greek letters and command words were always read, and are not "plain".
  assert.equal(readBuilder("πίστις Χριστός").plain, undefined);
  assert.equal(readBuilder("pistis genitive").plain, undefined);
  // Four plain words, or digits, are still an ordinary word search.
  assert.equal(readBuilder("the son of man today").cannot, "plain");
  assert.equal(readBuilder("pistis 3").cannot, "plain");
  // One word is a card as before.
  assert.deepEqual(readBuilder("pistis").cards, [{ words: ["pistis"], filters: [] }]);
});

test("GK3-5: what the builder writes back from plain words is the construction the field would run", () => {
  const { cards } = readBuilder("pistis Christos");
  assert.equal(writeBuilder({ cards }), "pistis, Christos");
});

// ── GK3-4: a card knows the LIT's renderings ────────────────────────────

const fakeBridge = prepareBridge({
  format: 1,
  terms: [
    {
      id: "flesh",
      title: "Flesh",
      lemmas: ["σάρξ"],
      renderings: [{ form: "self-preservation", count: 3, verses: [45, 8, 3] }],
    },
  ],
});

test("GK3-4: a LIT rendering typed in a card is a word with a bridge and unknown without", () => {
  const without = resolveCard(index, { words: ["self-preservation"], filters: [] });
  assert.equal(without.error.kind, "unknown");
  const withBridge = resolveCard(index, { words: ["self-preservation"], filters: [] }, { bridge: fakeBridge });
  assert.equal(withBridge.error, undefined);
  assert.ok(withBridge.ids.length > 0);
  assert.equal(index.lemmas[withBridge.ids[0]].lemma, "σάρξ");
});

test("GK3-4: only Latin text needs the bridge", () => {
  assert.equal(needsBridge(["self-preservation"]), true);
  assert.equal(needsBridge(["πίστις", "Χριστός"]), false);
  assert.equal(needsBridge(["G4102"]), false);
  assert.equal(needsBridge(["πίστις", "pistis"]), true);
});

// ── GK3-15: what the text box left out is said ──────────────────────────

test("GK3-15: readCardText reports a space, a symbol or a command word that was left out", () => {
  assert.deepEqual(readCardText("λόγος"), { words: ["λόγος"], draft: "λόγος", note: "" });
  assert.equal(readCardText("λόγος ").note, "", "a trailing space is just trimmed");
  assert.equal(readCardText("holy spirit").words[0], "holyspirit");
  assert.match(readCardText("holy spirit").note, /space or a symbol/);
  assert.match(readCardText("πίστις.gen").note, /space or a symbol/);
  const both = readCardText("perfect/aorist");
  assert.deepEqual(both.words, []);
  const mixed = readCardText("perfect/λόγος");
  assert.deepEqual(mixed.words, ["λόγος"]);
  assert.match(mixed.note, /also a command/);
  assert.equal(mixed.draft, "λόγος");
  assert.equal(readCardText("λόγος/").draft, "λόγος/", "a slash waiting for its next word stays");
  assert.equal(readCardText("").note, "");
  assert.equal(readCardText("perfect").note, "", "one word that is a command is kept (it is written quoted)");
});

// ── Decision 12 (1): the narrow fallback ────────────────────────────────

const idsOf = (term) => term.lemmaIds.map((id) => index.lemmas[id].lemma);

test("the fallback is offered for a Greek word with a filter that is a form of another lemma", () => {
  const resolved = resolveGreekQuery(index, parseGreekQuery("ἐξ.prep"));
  const term = resolved.terms[0];
  assert.deepEqual(idsOf(term), ["ἕξ"], "lemma-first is the numeral");
  assert.ok(term.altIds.length > 0);
  const alt = formFallbackTerm(index, term);
  assert.deepEqual(idsOf(alt), ["ἐκ"]);
  assert.equal(alt.fellBack, true);
  assert.deepEqual(alt.shown[0].lemmas, ["ἐκ"]);
  assert.deepEqual(alt.altIds, []);
});

test("the fallback is never offered where the rule says lemma-first stands", () => {
  const alts = (q) => resolveGreekQuery(index, parseGreekQuery(q)).terms[0].altIds ?? [];
  assert.deepEqual(alts("ἐξ"), [], "no filter, so nothing to find nothing under");
  assert.deepEqual(alts("=ἐξ.prep"), [], "an exact form is asked for");
  assert.deepEqual(alts("ἐξ/πίστις.prep"), [], "alternatives are not guessed at");
  assert.deepEqual(alts("*.prep"), [], "any word");
  assert.deepEqual(alts("πίστις.gen"), [], "a word that is only a headword");
  assert.equal(formFallbackTerm(index, resolveGreekQuery(index, parseGreekQuery("πίστις.gen")).terms[0]), null);
});

// ── GK3-12: the Greek tab's plain-text copy ─────────────────────────────

test("GK3-12: plainTextOf keeps a lexicon entry's body, its line breaks, and one blank line between blocks", () => {
  const box = parseHtml(
    '<p>λόγος</p><div class="desk-greek__entry-body">word, <b>speech</b>.<br>second   line</div><p>end</p>',
  );
  assert.equal(plainTextOf(box), "λόγος\n\nword, speech.\nsecond line\n\nend");
});

test("GK3-12: plainTextOf joins inline pieces and collapses the markup's white space", () => {
  const box = parseHtml("<p>1 <span>τὸ</span>\n   <span>πνεῦμα</span></p><p></p><h3>Title</h3>");
  assert.equal(plainTextOf(box), "1 τὸ πνεῦμα\n\nTitle");
  assert.equal(plainTextOf(parseHtml("just text")), "just text");
  assert.equal(plainTextOf(parseHtml("   ")), "");
});

// ── GK3-1 and GK3-3: the tab's classes, and forced colors ───────────────

test("GK3-1: no class in the Greek tab names two kinds of element", () => {
  const src = readFileSync(fileURLToPath(new URL("../src/scripts/desk/tab-greek.js", import.meta.url)), "utf8");
  const tags = new Map();
  for (const m of src.matchAll(/make\(\s*"([a-z0-9]+)"\s*,\s*"([^"]+)"/g)) {
    for (const cls of m[2].split(/\s+/)) {
      if (!tags.has(cls)) tags.set(cls, new Set());
      tags.get(cls).add(m[1]);
    }
  }
  const shared = [...tags].filter(([, set]) => set.size > 1).map(([cls, set]) => `${cls}: ${[...set]}`);
  assert.deepEqual(shared, []);
  assert.ok(tags.get("desk-greek__sources")?.has("section"));
  assert.ok(tags.get("desk-greek__show-sources")?.has("button"));
});

test("GK3-3: a pressed builder chip is drawn in a system color in forced colors", () => {
  const css = readFileSync(fileURLToPath(new URL("../src/styles/global.css", import.meta.url)), "utf8");
  const block = css.match(/@media \(forced-colors: active\) \{\s*\.greek-chip\[aria-pressed="true"\][\s\S]*?\n\}\n/);
  assert.ok(block, "a forced-colors block for .greek-chip");
  assert.match(block[0], /border: 3px solid Highlight/);
  assert.match(block[0], /\.greek-card__x/);
});
