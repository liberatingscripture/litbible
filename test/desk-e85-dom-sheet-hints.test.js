// A sheet's blanks on key terms, driven in a browser DOM (STUDY-DESK-FIXES.md,
// E85): the hint a row offers is the traditional word of the Greek word its
// blank renders; a verse holding two words of the term's family offers each
// and says why nothing prints until one is chosen; the one chosen is kept as
// the leader's own hint and shown as chosen; and a footnote's flag names the
// word the footnote uses.

import { test } from "node:test";
import assert from "node:assert/strict";
import "./helpers/browser-env.mjs";
import { createSheet, makeModule } from "../src/lib/desk-sheets.mjs";
import { blankFromOffsets } from "../src/lib/desk-sheet-lit.mjs";
import { passageFromVerses } from "../src/lib/desk-sheet-passages.mjs";

// happy-dom's Range.intersectsNode answers false for a node that holds the
// range, and its comparePoint refuses a range made by a parsed document; the
// passage card needs the DOM standard's answer, so it is written out here
// (as in desk-audit8-dom-sheets-blanks.test.js).
const index = (n) => [...n.parentNode.childNodes].indexOf(n);
/** -1, 0 or 1: boundary point A before, at or after B (DOM standard). */
function comparePoints(nodeA, offA, nodeB, offB) {
  if (nodeA === nodeB) return Math.sign(offA - offB);
  const pos = nodeA.compareDocumentPosition(nodeB);
  if (pos & 2) return -comparePoints(nodeB, offB, nodeA, offA); // B precedes A
  if (pos & 16) {
    // A contains B
    let child = nodeB;
    while (child.parentNode !== nodeA) child = child.parentNode;
    if (index(child) < offA) return 1;
  }
  return -1;
}
window.Range.prototype.intersectsNode = function (node) {
  if (node.getRootNode() !== this.startContainer.getRootNode()) return false;
  const parent = node.parentNode;
  if (!parent) return true;
  const i = index(node);
  return comparePoints(parent, i, this.endContainer, this.endOffset) === -1 && comparePoints(parent, i + 1, this.startContainer, this.startOffset) === 1;
};

// One entry, Faith and pistis, governing three Greek words. Verse 1 holds the
// verb alone; verse 2 holds the noun and the verb, so its mark could be either.
// Verse 3 has a term the LIT renders by its traditional word.
const TERM_DATA = {
  marks: [
    { v: 1, text: "trusted", k: 0, id: "faith-trust", form: "trusted", w: [2] },
    { v: 2, text: "relies on", k: 0, id: "faith-trust", form: "relies on", w: [0, 2] },
    { v: 3, text: "demon", k: 0, id: "demon-demon", form: "demon", w: [0] },
  ],
  terms: {
    "faith-trust": {
      traditional: "Faith",
      greek: "pistis",
      title: "Trust / Faithfulness",
      renderings: [],
      lemmas: ["πίστις", "πιστός", "πιστεύω"],
      words: [["faith", "pistis"], ["faithful", "pistos"], ["believe", "pisteuo"]],
    },
    "demon-demon": {
      traditional: "Demon",
      greek: "daimonion",
      title: "Demon",
      renderings: [],
      lemmas: ["δαιμόνιον", "δαιμονίζομαι"],
      words: [["demon", "daimonion"], ["demon-possessed", "daimonizomai"]],
    },
  },
};

globalThis.fetch = window.fetch = async (url) => {
  if (!/\/romans-4\/?$/.test(String(url))) return new Response("", { status: 404 });
  return new Response(
    `<!doctype html><html data-content-version="v1"><body><article class="chapter"><div class="chapter-paragraphs">` +
      `<p><span data-verse="1"><sup class="vn" id="v1">1</sup> Abraham trusted God.<sup class="fn-ref"><a id="fnref-a" href="#fn-a">a</a></sup></span></p>` +
      `<p><span data-verse="2"><sup class="vn" id="v2">2</sup> Whoever relies on God has confidence.</span></p>` +
      `<p><span data-verse="3"><sup class="vn" id="v3">3</sup> Then the demon left.</span></p>` +
      `</div></article>` +
      `<ol class="footnotes"><li id="fn-a"><span class="fn-body">See the glossary entry on faith. <a class="footnote-backlink" href="#fnref-a">a</a></span></li></ol>` +
      `<script type="application/json" id="term-lens-data">${JSON.stringify(TERM_DATA)}</script>` +
      `</body></html>`,
    { status: 200, headers: { "content-type": "text/html" } },
  );
};

const { createPassageBody } = await import("../src/scripts/desk/sheets/sheet-lit.js");
const { loadChapterPage } = await import("../src/scripts/desk/chapter-page.js");

const ctx = () => ({ now: new Date().toISOString(), client: "web/test", contentVersion: "v1" });

async function until(fn, ms = 3000, what = "the condition") {
  const end = Date.now() + ms;
  while (!(await fn())) {
    if (Date.now() > end) throw new Error(`timed out waiting for ${what}`);
    await new Promise((r) => setTimeout(r, 10));
  }
}

/**
 * A passage card over Romans 4:1–3, with blanks on "trusted" and "relies on"
 * carrying the given hints, or with none (`hints` null). `saves` collects
 * what the card asks to save and `said` what it announces with it.
 */
async function cardWith(hints) {
  const source = await loadChapterPage("romans", 4);
  const chapter = source.anchorText();
  const where = { bookKey: "romans", chapter: 4 };
  const blankOn = (id, words, fields) => {
    const start = chapter.text.indexOf(words);
    return blankFromOffsets(chapter, start, start + words.length, { id, ...fields });
  };
  let passage = makeModule("passage", {
    ...passageFromVerses(chapter, where, 1, 3, "v1"),
    blanks: hints ? [blankOn("b1", "trusted", hints.trusted), blankOn("b2", "relies on", hints.relies)] : [],
  });
  let sheet = createSheet({ title: "Study", modules: [passage] }, ctx());
  const saves = [];
  const said = [];
  const card = createPassageBody({
    m: passage,
    readOnly: false,
    getSheet: () => sheet,
    // The editor's part: the change is saved, and the card is handed the passage as saved.
    update: async (fields, announce) => {
      saves.push(fields);
      said.push(announce ?? null);
      passage = { ...passage, ...fields };
      sheet = { ...sheet, modules: [passage] };
      card.update(passage);
      return true;
    },
    say: () => {},
  });
  document.body.replaceChildren(card.el);
  const rows = () => [...card.el.querySelectorAll(".desk-sheet__blank")];
  const chips = () => [...card.el.querySelectorAll(".desk-sheet__term-blanks .desk-sheet__chip")];
  await until(() => chips().length === 2 && rows().length === (hints ? 2 : 0), 3000, "the card");
  const row = (words) => rows().find((li) => li.querySelector(".desk-sheet__blank-words")?.textContent === `“${words}”`);
  const chip = (word) => chips().find((b) => b.textContent === word);
  const options = (li) => [...li.querySelectorAll("select.desk-sheet__hint option")].map((o) => o.textContent);
  return { card, saves, said, row, chip, options };
}

test("blanking a key term gives each use its own traditional word, none where the verse leaves a choice, and says so (E85)", async () => {
  const { card, saves, said, row, chip } = await cardWith(null);
  // One chip for the term's two uses: "trusted" is "believe"; "relies on" could be either word.
  const trust = chip("trusted");
  assert.equal(trust.title, "Blank “trusted” (2 times), each with its own traditional word beneath where it has one to show");
  trust.click();
  await until(() => saves.length === 1, 3000, "the save");
  assert.deepEqual(saves[0].blanks.map((b) => [b.exact, b.hint]), [["trusted", "traditional"], ["relies on", "none"]]);
  assert.equal(said[0], "“trusted” blanked 2 times. Choose a hint for one of them in the list below.");
  await until(() => row("relies on"), 3000, "the new rows");
  assert.equal(row("trusted").querySelector("select").value, "traditional");
  assert.equal(row("relies on").querySelector("select").value, "none");
  // It asked for no traditional hint, so nothing is missing to explain.
  assert.equal(row("relies on").querySelector(".desk-sheet__problem"), null);
  card.destroy();
});

test("a key term the LIT renders by its traditional word is blanked with no hint, which would be the answer (E85)", async () => {
  const { card, saves, said, row, chip, options } = await cardWith(null);
  const demon = chip("demon");
  assert.equal(demon.title, "Blank “demon” with no hint, since the traditional word is the same");
  demon.click();
  await until(() => saves.length === 1, 3000, "the save");
  assert.deepEqual(saves[0].blanks.map((b) => [b.exact, b.hint]), [["demon", "none"]]);
  assert.equal(said[0], "“demon” blanked. No hint beneath, since the traditional word is the same.");
  // The row still offers the word, for a leader who wants it there.
  await until(() => row("demon"), 3000, "the new row");
  assert.deepEqual(options(row("demon")), ["No hint", "traditionally demon", "My own hint…"]);
  assert.equal(row("demon").querySelector("select").value, "none");
  card.destroy();
});

test("a blank's traditional hint is its own Greek word's, and a verse with two family words offers each (E85)", async () => {
  const { card, row, options } = await cardWith({ trusted: { hint: "traditional" }, relies: { hint: "traditional" } });

  // "trusted" renders the verb: "believe", not its entry's "faith".
  const trusted = row("trusted");
  assert.deepEqual(options(trusted), ["No hint", "traditionally believe", "My own hint…"]);
  assert.equal(trusted.querySelector("select").value, "traditional");
  assert.equal(trusted.querySelector(".desk-sheet__problem"), null);

  // "relies on" could render either word: both are offered, none is chosen,
  // and the row says why the traditional hint it asks for prints nothing.
  const relies = row("relies on");
  assert.deepEqual(options(relies), ["No hint", "traditionally faith", "traditionally believe", "My own hint…"]);
  assert.equal(relies.querySelector("select").value, "none");
  assert.equal(
    relies.querySelector(".desk-sheet__problem")?.textContent,
    "This verse has more than one Greek word of this key term, so no hint prints here until you choose its traditional word from the menu.",
  );
  card.destroy();
});

test("the word picked for such a blank is kept as the leader's own hint and shown as picked (E85)", async () => {
  const { card, saves, row } = await cardWith({ trusted: { hint: "none" }, relies: { hint: "traditional" } });
  const select = row("relies on").querySelector("select");
  select.value = "word:believe";
  select.dispatchEvent(new window.Event("change", { bubbles: true }));
  await until(() => saves.length === 1, 3000, "the save");
  const saved = saves[0].blanks.find((b) => b.id === "b2");
  assert.equal(saved.hint, "custom");
  assert.equal(saved.hintText, "traditionally believe");
  // The other blank is left as it was.
  assert.equal(saves[0].blanks.find((b) => b.id === "b1").hint, "none");

  // Redrawn from the saved passage: the menu is on the word picked, its own
  // text field stays out of the way, and the note is gone.
  await until(() => row("relies on")?.querySelector("select")?.value === "word:believe", 3000, "the picked word");
  const relies = row("relies on");
  assert.equal(relies.querySelector("input.desk-sheet__hint-text").hidden, true);
  assert.equal(relies.querySelector(".desk-sheet__problem"), null);

  // "My own hint…" opens the field on the picked words without saving them again.
  const again = relies.querySelector("select");
  again.value = "custom";
  again.dispatchEvent(new window.Event("change", { bubbles: true }));
  await new Promise((r) => setTimeout(r, 30));
  assert.equal(saves.length, 1);
  const field = row("relies on").querySelector("input.desk-sheet__hint-text");
  assert.equal(field.hidden, false);
  assert.equal(field.value, "traditionally believe");
  card.destroy();
});

test("a footnote's flag names the traditional word the footnote uses (E85)", async () => {
  // With no hint, "trusted" is given away by a note that says only "faith,"
  // its entry's word; the flag says so rather than naming "believe," which
  // the note never uses.
  const { card } = await cardWith({ trusted: { hint: "none" }, relies: { hint: "custom", hintText: "traditionally believe" } });
  const flag = () => card.el.querySelector(".desk-sheet__note .desk-sheet__flag")?.textContent ?? "";
  await until(() => flag(), 3000, "the footnote's flag");
  assert.equal(flag(), "Gives away a blank (“trusted,” whose key term is traditionally “faith”), so it’s left out until you decide.");
  card.destroy();
});

test("a footnote that uses the blank's own traditional word is flagged by that word, as before (E85)", async () => {
  // Both blanks unhinted: the note's "faith" is one of the words "relies on"
  // could carry, so that blank is named with its own words.
  const { card } = await cardWith({ trusted: { hint: "traditional" }, relies: { hint: "none" } });
  const flag = () => card.el.querySelector(".desk-sheet__note .desk-sheet__flag")?.textContent ?? "";
  await until(() => flag(), 3000, "the footnote's flag");
  assert.equal(flag(), "Gives away a blank (“relies on,” traditionally “faith / believe”), so it’s left out until you decide.");
  card.destroy();
});
