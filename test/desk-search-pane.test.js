import test from "node:test";
import assert from "node:assert/strict";
import {
  PAGE,
  READING,
  BIBLE_ORDER,
  addCheckedLabel,
  addVerseLabel,
  newSheetLabel,
  bookFilterFor,
  bookOptions,
  longEnoughQuery,
  nextPage,
  pageLinkLabel,
  pageLinkText,
  passageMoveMessage,
  resultTarget,
  introMoveMessage,
  noWayLinkLabel,
  noWayMessage,
  replacedMessage,
  verseRef,
} from "../src/lib/desk-search-pane.mjs";

test("pageLinkText: the link to /search says what it does before and after a search (E115)", () => {
  assert.equal(pageLinkText(false), "Open the search page");
  assert.equal(pageLinkText(true), "See results on the search page");
  assert.equal(pageLinkText(""), "Open the search page", "an empty box is not a search");
  assert.equal(pageLinkText("loved"), "See results on the search page");
});

test("passageMoveMessage: says which LIT pane took the passage (E34)", () => {
  assert.equal(passageMoveMessage("moved", "John 3:16"), "The LIT pane moved to John 3:16.");
  assert.equal(passageMoveMessage("opened", "John 3:16"), "A LIT pane opened at John 3:16.");
  assert.equal(passageMoveMessage("placed", "John 3:16"), "", "the notice says it (E127)");
  assert.equal(passageMoveMessage("replaced", "John 3:16"), "", "the undo bar says it (E127)");
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
  assert.equal(introMoveMessage({ outcome: "none", moved: null }, "Romans"), "", "the notice says it (E127)");
  assert.equal(introMoveMessage({ outcome: "replaced", moved: null }, "Romans"), "");
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
});

test("E117: the strip's buttons carry the count, and never say “0 verses”", () => {
  assert.equal(addCheckedLabel("Faith", 3, 40), "Add 3 verses to “Faith”");
  assert.equal(addCheckedLabel("Faith", 1, 40), "Add 1 verse to “Faith”");
  assert.equal(addCheckedLabel("Faith", 40, 40), "Add all 40 verses to “Faith”");
  assert.equal(addCheckedLabel("Faith", 0, 40), "Add checked verses to “Faith”");
  assert.equal(addCheckedLabel("The “big” one", 2, 9), "Add 2 verses to “The ‘big’ one”");
  assert.equal(addCheckedLabel("Faith", 1, 1), "Add 1 verse to “Faith”", "one verse of one is still one verse, not “all 1”");
  assert.equal(newSheetLabel(3, 40), "New sheet of 3 verses");
  assert.equal(newSheetLabel(1, 40), "New sheet of 1 verse");
  assert.equal(newSheetLabel(40, 40), "New sheet of all 40 verses");
  assert.equal(newSheetLabel(0, 40), "New sheet of checked verses");
  assert.equal(newSheetLabel(1200, 1500), "New sheet of 1,200 verses", "a long count is grouped");
  for (const k of [0, 1, 2, 40]) {
    assert.doesNotMatch(addCheckedLabel("X", k, 40), /\b0 verses/);
    assert.doesNotMatch(newSheetLabel(k, 40), /\b0 verses/);
  }
  assert.equal(BIBLE_ORDER, "Bible order");
});

test("nextPage: 20 at a time", () => {
  assert.equal(PAGE, 20);
  assert.deepEqual(nextPage(0, 45), { shown: 20, hidden: 25 });
  assert.deepEqual(nextPage(40, 45), { shown: 45, hidden: 0 });
  assert.deepEqual(nextPage(0, 3), { shown: 3, hidden: 0 });
});

test("E127: replacedMessage names each kind as its menu does, and what else happened", () => {
  assert.equal(replacedMessage("intro", "greek"), "Book Intro shown in place of Greek.");
  assert.equal(replacedMessage("sheet", "verse"), "Sheets shown in place of This verse.");
  assert.equal(replacedMessage("search", "footnotes"), "Search shown in place of Footnotes.");
  assert.equal(replacedMessage("greek", "mine"), "Greek shown in place of My Notes.");
  assert.equal(replacedMessage("lit", "greek", { at: "John 3:16" }), "The LIT shown at John 3:16 in place of Greek.");
  assert.equal(
    replacedMessage("intro", "greek", { extra: "The LIT moved to Romans 1." }),
    "Book Intro shown in place of Greek. The LIT moved to Romans 1.",
  );
});

test("E127: noWayMessage says why and both ways on, and names the search only when it asked", () => {
  assert.equal(
    noWayMessage("intro", "full", { search: true }),
    "There’s no room for a Book Intro pane, and no pane can make way: LIT panes, panes set to “Stay here,” and this search keep their places. Close a pane and try again, or open the introduction on its page.",
  );
  assert.equal(
    noWayMessage("search", "full"),
    "There’s no room for a Search pane, and no pane can make way: LIT panes and panes set to “Stay here” keep their places. Close a pane and try again, or use the search page.",
  );
  assert.match(noWayMessage("greek", "window", { search: true }), /^There’s no room for a Greek pane in a window this size, and no pane can make way: .*Make the window larger or close a pane and try again, or open the word on its page\.$/);
  for (const kind of ["lit", "intro", "sheet", "greek", "search"]) {
    for (const reason of ["full", "window"]) {
      const text = noWayMessage(kind, reason);
      assert.match(text, /close a pane and try again, or /i, `${kind} ${reason}: both ways`);
      assert.doesNotMatch(text, /—/);
    }
  }
});

test("E127: noWayLinkLabel names the page", () => {
  assert.equal(noWayLinkLabel("lit", "John 3:16"), "Open John 3:16");
  assert.equal(noWayLinkLabel("intro", "Romans"), "Open the Romans introduction");
  assert.equal(noWayLinkLabel("sheet"), "Open the sheet");
  assert.equal(noWayLinkLabel("greek"), "Open the Greek word");
  assert.equal(noWayLinkLabel("search"), "Open the search page");
});
