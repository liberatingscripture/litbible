import test from "node:test";
import assert from "node:assert/strict";
import {
  PAGE,
  READING,
  addAllLabel,
  addVerseLabel,
  bookFilterFor,
  bookOptions,
  longEnoughQuery,
  nextPage,
  pageLinkLabel,
  passageMoveMessage,
  resultTarget,
  introMoveMessage,
  verseRef,
} from "../src/lib/desk-search-pane.mjs";

test("passageMoveMessage: says which LIT pane took the passage (E34)", () => {
  assert.equal(passageMoveMessage("moved", "John 3:16"), "The LIT pane moved to John 3:16.");
  assert.equal(passageMoveMessage("opened", "John 3:16"), "A LIT pane opened at John 3:16.");
  assert.match(passageMoveMessage("placed", "John 3:16"), /no room for a LIT pane to show John 3:16/);
  assert.equal(passageMoveMessage(null, "John 3:16"), "");
});

test("pageLinkLabel: names the passage and the new tab", () => {
  assert.equal(pageLinkLabel("Romans 8"), "Open Romans 8 on its page, in a new tab");
});

test("resultTarget: a chapter or verse is a passage", () => {
  assert.deepEqual(resultTarget("/john-3#v16"), { type: "passage", bookKey: "john", chapter: 3, verse: 16 });
  assert.deepEqual(resultTarget("/john-3/#v16"), { type: "passage", bookKey: "john", chapter: 3, verse: 16 });
  assert.deepEqual(resultTarget("/1corinthians-13/"), { type: "passage", bookKey: "1corinthians", chapter: 13, verse: null });
  assert.deepEqual(resultTarget("/john-3/#v16-18"), { type: "passage", bookKey: "john", chapter: 3, verse: 16 }, "a range goes to its first verse");
  assert.deepEqual(resultTarget("/john-3/#not-a-verse"), { type: "passage", bookKey: "john", chapter: 3, verse: null });
});

test("resultTarget: a glossary entry opens in the pane", () => {
  assert.deepEqual(resultTarget("/glossary/#slave-servant"), { type: "glossary", id: "slave-servant" });
  assert.deepEqual(resultTarget("/glossary#grace"), { type: "glossary", id: "grace" });
  assert.deepEqual(resultTarget("/glossary/"), { type: "tab", href: "/glossary/" }, "no entry named");
});

test("resultTarget: an introduction shows in a Book Intro pane (E53)", () => {
  assert.deepEqual(resultTarget("/john-intro"), { type: "intro", bookKey: "john" });
  assert.deepEqual(resultTarget("/1corinthians-intro/#intro"), { type: "intro", bookKey: "1corinthians" });
  assert.equal(resultTarget("/notabook-intro/").type, "tab");
});

test("resultTarget: articles and other pages open in a tab", () => {
  for (const href of ["/articles/many-and-all/", "/about", "/read/john", "https://example.com/john-3", "https://example.com/john-intro"]) {
    assert.deepEqual(resultTarget(href), { type: "tab", href });
  }
});

test("introMoveMessage says what an intro result did (E53)", () => {
  assert.equal(introMoveMessage({ outcome: "shown", moved: null }, "Romans"), "The Book Intro pane shows Romans.");
  assert.equal(
    introMoveMessage({ outcome: "opened", moved: "romans 1" }, "Romans", "Romans 1"),
    "A Book Intro pane opened at Romans. The LIT moved to Romans 1.",
  );
  assert.match(introMoveMessage({ outcome: "none", moved: null }, "Romans"), /no room for a Book Intro pane/);
  assert.equal(introMoveMessage(null, "Romans"), "");
});

test("resultTarget: a chapter that doesn't exist, or junk, is a tab", () => {
  assert.equal(resultTarget("/john-30").type, "tab");
  assert.equal(resultTarget("/john-0").type, "tab");
  assert.equal(resultTarget("/notabook-3").type, "tab");
  assert.equal(resultTarget("/__proto__-3").type, "tab");
  assert.deepEqual(resultTarget(undefined), { type: "tab", href: "" });
});

test("longEnoughQuery: three letters, or Greek while Greek is on", () => {
  assert.equal(longEnoughQuery("ab"), false);
  assert.equal(longEnoughQuery("abc"), true);
  assert.equal(longEnoughQuery("  ab  "), false);
  assert.equal(longEnoughQuery("ὁ", true), true);
  assert.equal(longEnoughQuery("ὁ", false), false);
});

test("bookOptions: All books, the book being read, then every book", () => {
  const o = bookOptions("john");
  assert.deepEqual(o[0], { value: "", label: "All books" });
  assert.deepEqual(o[1], { value: READING, label: "The book I’m reading (John)" });
  assert.equal(o[2].value, "matthew");
  assert.equal(o.length, 2 + 27);
  assert.equal(bookOptions(null).length, 1 + 27, "no book being read, no such option");
  assert.equal(bookOptions("nope").some((x) => x.value === READING), false);
});

test("bookFilterFor: reading fixes the book at that moment", () => {
  assert.equal(bookFilterFor(READING, "john"), "john");
  assert.equal(bookFilterFor(READING, null), "");
  assert.equal(bookFilterFor("romans", "john"), "romans");
  assert.equal(bookFilterFor("", "john"), "");
  assert.equal(bookFilterFor("toString", "john"), "");
});

test("add controls: names and labels", () => {
  const hit = { bookKey: "john", chapter: 3, verse: 16, text: "x", runs: [] };
  assert.deepEqual(verseRef(hit), { bookKey: "john", chapter: 3, verse: 16 });
  assert.equal(addVerseLabel(hit), "Add John 3:16 to the sheet");
  assert.equal(addAllLabel("Faith", 1), "Add this verse to “Faith”");
  assert.equal(addAllLabel("Faith", 5), "Add these verses to “Faith”");
  assert.equal(addAllLabel("The “big” one", 2), "Add these verses to “The ‘big’ one”");
});

test("nextPage: 20 at a time", () => {
  assert.equal(PAGE, 20);
  assert.deepEqual(nextPage(0, 45), { shown: 20, hidden: 25 });
  assert.deepEqual(nextPage(40, 45), { shown: 45, hidden: 0 });
  assert.deepEqual(nextPage(0, 3), { shown: 3, hidden: 0 });
});
