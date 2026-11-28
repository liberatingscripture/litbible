// /search's head rows (E116, E163), driven in a browser DOM over the real
// store on fake-indexeddb: the box that checks every verse, the card with its
// line and its one button, which adds nothing while nothing is checked, and
// the chapters' row, checked the same way. search-sheet.js keeps its state at
// module level, so it is imported once and each test draws fresh results
// under a query of its own.

import { test } from "node:test";
import assert from "node:assert/strict";
import { IDBFactory } from "fake-indexeddb";
import { settle, resetDom, window } from "./helpers/browser-env.mjs";

globalThis.indexedDB = new IDBFactory();
document.documentElement.dataset.contentVersion = "v1";
// A chapter's last verse is the length of its verse file (search/chapters/*.json).
const LAST = { "john-3": 36, "romans-8": 39, "matthew-18": 35 };
globalThis.fetch = async (url) => {
  const n = LAST[/chapters\/([a-z0-9]+-\d+)\.json$/.exec(String(url))?.[1]];
  return n
    ? { ok: true, status: 200, json: async () => Array.from({ length: n }, (_, i) => ({ v: i + 1 })), text: async () => "" }
    : { ok: false, status: 404, json: async () => null, text: async () => "" };
};

const { attachSearchSheets } = await import("../src/scripts/desk/sheets/search-sheet.js");
const { openStore } = await import("../src/scripts/desk/store.js");

const same = (a, b, message) => assert.ok(a === b, message ?? "not the same element");
async function until(fn, tries = 200) {
  for (let i = 0; i < tries; i++) {
    const v = fn();
    if (v) return v;
    await settle(10);
  }
  throw new Error("timed out");
}
const pk = (sel) => document.querySelector(`#search-pickbar ${sel}`);
const foot = () => pk(".search-pickbar__add");
const click = (el) => el.dispatchEvent(new window.MouseEvent("click", { bubbles: true, cancelable: true, button: 0 }));
function toggle(box, on) {
  box.checked = on;
  box.dispatchEvent(new window.Event("change", { bubbles: true }));
}

const VERSES = [
  { bookKey: "john", chapter: 3, verse: 16 },
  { bookKey: "john", chapter: 3, verse: 17 },
  { bookKey: "john", chapter: 3, verse: 18 },
  { bookKey: "romans", chapter: 8, verse: 1 },
];
const occurrence = (r) =>
  `<li class="search-row search-row--verse"><a class="search-row__link" href="/${r.bookKey}-${r.chapter}#v${r.verse}"><span class="search-row__ref">${r.bookKey === "john" ? "John" : "Romans"} ${r.chapter}:${r.verse}</span></a></li>`;
const chapterGroup = (title, verses) => verses.map(occurrence).join("");
// A topic's chapter as search.js draws it.
const topicRow = (c) =>
  `<li class="search-row search-row--title"><a class="search-row__link" href="/${c.bookKey}-${c.chapter}/"><span class="search-row__title">${c.title}</span></a></li>`;

let started = false;
let queries = 0;
/** One group's head row and its rows' boxes. */
function head(groupId, listId) {
  const bar = document.querySelector(`#${groupId} [data-desk-gather]`);
  const q = (sel) => bar.querySelector(sel);
  const row = (v) => [...document.querySelectorAll(`#${listId} .desk-gather__tick`)].find((b) => b.getAttribute("aria-label") === v);
  const line = () => q(".desk-gather__lead").textContent.replace("Clear checks", "").trim();
  const heard = () => bar.querySelector(":scope > p[role=status]").textContent;
  return { bar, q, row, line, heard };
}
/** /search's results for a query of their own, announced as search.js does. */
function draw({ verses = VERSES, chapters = [] } = {}) {
  resetDom("http://localhost/search/?q=loved");
  document.body.innerHTML = `<main class="search-page">
    <div id="search-tools"></div><div id="search-pickbar" hidden></div>
    <section id="group-subject"><h2 class="group-title">Chapters by topic</h2><ol id="results-subject">${chapters.map(topicRow).join("")}</ol></section>
    <section id="group-keyword"><h2 class="group-title">Verses</h2><ol id="results-keyword">${
      verses.length ? chapterGroup("John 3", verses.filter((r) => r.bookKey === "john")) + chapterGroup("Romans 8", verses.filter((r) => r.bookKey === "romans")) : ""
    }</ol></section></main>`;
  const detail = { query: `loved ${++queries}`, verses, chapters: chapters.map(({ bookKey, chapter, labels }) => ({ bookKey, chapter, labels })) };
  if (!started) {
    started = true;
    attachSearchSheets(() => detail);
  } else {
    document.dispatchEvent(new window.CustomEvent("lit:search-results", { detail }));
  }
  // Select is how a reader gets the boxes (Featherboa, "Search").
  // (Selecting is the page's state and outlives a redraw, so press it only when it is off.)
  if (document.querySelector(".search-tools__select")?.getAttribute("aria-pressed") !== "true") click(document.querySelector(".search-tools__select"));
  return { ...head("group-keyword", "results-keyword"), chapters: head("group-subject", "results-subject") };
}

// Matthew 18 and Romans 8 share a topic John 3 lacks, so a sheet of those
// two is named for it and a sheet of all three is not.
const TOPIC = [
  { bookKey: "matthew", chapter: 18, title: "Matthew 18", labels: ["love"] },
  { bookKey: "john", chapter: 3, title: "John 3", labels: ["new birth"] },
  { bookKey: "romans", chapter: 8, title: "Romans 8", labels: ["love"] },
];

test("E116: the head row holds the box that checks every verse and a card with one primary button", async () => {
  const { bar, q, line } = draw();
  const title = document.querySelector("#group-keyword .group-title");
  same(title.nextElementSibling, bar, "the row comes right after the group's title");
  assert.ok(bar.classList.contains("desk-gather--head"));
  const all = q(":scope > input.desk-gather__all");
  assert.equal(all.type, "checkbox", "in the rows' column of boxes");
  assert.equal(all.getAttribute("aria-label"), "Check all 4 verses");
  const card = q(".desk-gather__card");
  assert.ok(card.querySelector(".desk-gather__lead"), "the card holds the line");
  const go = card.querySelector(".desk-gather__go");
  assert.ok(go.classList.contains("desk-gather__btn--primary"), "and the one primary button");
  assert.equal(line(), "Check the verses you want, or check all 4.");
  assert.equal(go.getAttribute("aria-label"), "Add checked verses to a sheet…", "never “0 verses”");
  assert.equal(go.getAttribute("aria-haspopup"), "dialog");
  assert.equal(bar.classList.contains("desk-gather--some"), false, "no green rule with nothing checked");
  assert.equal(document.body.textContent.includes("With none checked"), false, "the old all-by-default line is gone");
  for (const li of document.querySelectorAll("#results-keyword li.search-row--verse")) {
    assert.ok(li.querySelector(":scope > input.desk-gather__tick"), "every verse has a box");
  }
});

test("E116: nothing checked adds nothing; the button stays focusable, is described by the line, and a press says why", async () => {
  const { q, heard } = draw();
  const go = q(".desk-gather__go");
  assert.equal(go.getAttribute("aria-disabled"), "true");
  assert.equal(go.disabled, false);
  assert.equal(go.getAttribute("aria-describedby"), q(".desk-gather__lead").id);
  click(go);
  await settle(20);
  assert.equal(pk(".desk-gather__panel"), null, "no chooser opens");
  assert.equal(go.getAttribute("aria-expanded"), "false");
  assert.equal(await until(() => heard()), "Check the verses you want, or check all 4.");
});

test("E116: checking counts, the box shows some, checks all and clears, and checked rows take the green rule", async () => {
  const { bar, q, row, line, heard } = draw();
  const all = q(".desk-gather__all");
  const go = q(".desk-gather__go");

  toggle(row("Include John 3:17 in the sheet"), true);
  assert.equal(all.indeterminate, true);
  assert.equal(all.checked, false);
  assert.equal(line(), "1 of 4 checked.");
  assert.equal(q(".desk-gather__count").textContent, "1 of 4");
  assert.equal(go.getAttribute("aria-label"), "Add 1 verse to a sheet…");
  assert.equal(go.getAttribute("aria-disabled"), null);
  assert.equal(go.getAttribute("aria-describedby"), null);
  assert.ok(bar.classList.contains("desk-gather--some"), "the card takes the rule");
  assert.ok(row("Include John 3:17 in the sheet").closest("li").classList.contains("desk-gather__row-item--picked"));
  assert.equal(row("Include John 3:16 in the sheet").closest("li").classList.contains("desk-gather__row-item--picked"), false);
  assert.equal(await until(() => heard()), "1 of 4 checked.");
  const room = [...go.querySelectorAll(".desk-gather__label-room")];
  assert.deepEqual(room.map((s) => s.textContent), ["Add checked verses to a sheet…", "Add all 4 verses to a sheet…"], "its width is held");
  for (const s of room) assert.equal(s.getAttribute("aria-hidden"), "true");

  toggle(all, true);
  assert.equal(all.checked, true);
  assert.equal(all.indeterminate, false);
  assert.equal(line(), "All 4 checked.");
  assert.equal(go.getAttribute("aria-label"), "Add all 4 verses to a sheet…");
  assert.equal(document.querySelectorAll(".desk-gather__row-item--picked").length, 4);

  toggle(all, false);
  assert.equal(document.querySelectorAll(".desk-gather__row-item--picked").length, 0);
  assert.equal(line(), "Check the verses you want, or check all 4.");
  assert.equal(go.getAttribute("aria-disabled"), "true");

  toggle(row("Include Romans 8:1 in the sheet"), true);
  const clear = q(".desk-gather__clear");
  assert.equal(clear.hidden, false);
  assert.equal(clear.textContent, "Clear checks");
  click(clear);
  assert.equal(line(), "Check the verses you want, or check all 4.");
  same(document.activeElement, all, "focus goes to the box, since Clear checks hides itself");
});

test("E116: the chooser names what it adds, and a new sheet holds only the checked verses", async () => {
  const { q, row } = draw();
  const go = q(".desk-gather__go");
  toggle(row("Include John 3:16 in the sheet"), true);
  toggle(row("Include John 3:17 in the sheet"), true);
  click(foot());
  const panel = await until(() => pk(".desk-gather__panel"));
  assert.equal(panel.getAttribute("role"), "dialog");
  assert.equal(panel.getAttribute("aria-label"), "Add to a sheet");
  assert.equal(panel.querySelector(".desk-gather__title").textContent, "Add 2 verses to a sheet");
  assert.equal(go.getAttribute("aria-expanded"), "true");
  const buttons = [...panel.querySelectorAll(".desk-gather__actions button")];
  assert.deepEqual(buttons.map((b) => b.textContent), ["New sheet", "Cancel"]);
  assert.ok(buttons[0].classList.contains("desk-gather__btn--primary"), "New sheet is the chooser's primary");
  assert.equal(buttons[1].classList.contains("desk-gather__btn--primary"), false, "Cancel is ordinary");

  toggle(row("Include John 3:18 in the sheet"), true);
  assert.equal(panel.querySelector(".desk-gather__title").textContent, "Add 3 verses to a sheet", "the heading follows the checks");
  toggle(row("Include John 3:18 in the sheet"), false);

  await until(() => panel.querySelector(".desk-gather__note")?.textContent !== "Reading your sheets…");
  click(buttons[0]);
  const done = await until(() => pk(".desk-gather__done"));
  assert.match(done.textContent, /Open the sheet, or open it in the Study Desk\./);
  const store = await openStore({ ctx: () => ({ client: "web/test", contentVersion: "v1" }) });
  const sheets = (await store.all()).filter((r) => r.kind === "sheet");
  assert.equal(sheets.length, 1);
  const passages = sheets[0].modules.filter((m) => m.type === "passage");
  assert.deepEqual(passages.map((p) => [p.bookKey, p.chapter, p.verse, p.endVerse]), [["john", 3, 16, 17]], "the two checked verses, joined; not all four");
});

test("E116: unchecking everything closes an open chooser, which has nothing left to add", async () => {
  const { q, row } = draw();
  toggle(row("Include Romans 8:1 in the sheet"), true);
  click(foot());
  await until(() => pk(".desk-gather__panel"));
  toggle(row("Include Romans 8:1 in the sheet"), false);
  assert.equal(pk(".desk-gather__panel"), null);
  assert.equal(q(".desk-gather__go").getAttribute("aria-expanded"), "false");
});

test("E163: the chapters by topic are checked as the verses are, with their own box and nothing checked to start", async () => {
  const { chapters } = draw({ verses: [], chapters: TOPIC });
  const { bar, q, row, line, heard } = chapters;
  assert.equal(document.querySelector("#group-keyword [data-desk-gather]").hidden, true, "no verses, no verse row");
  same(document.querySelector("#group-subject .group-title").nextElementSibling, bar);
  assert.ok(bar.classList.contains("desk-gather--head"));
  const all = q(":scope > input.desk-gather__all");
  assert.equal(all.getAttribute("aria-label"), "Check all 3 chapters");
  assert.equal(line(), "Check the chapters you want, or check all 3.");
  assert.equal(bar.classList.contains("desk-gather--some"), false, "no rule with nothing checked");
  const go = q(".desk-gather__go");
  assert.equal(go.getAttribute("aria-label"), "Add checked chapters to a sheet…");
  assert.equal(go.getAttribute("aria-disabled"), "true");
  click(go);
  await settle(20);
  assert.equal(pk(".desk-gather__panel"), null, "nothing checked adds nothing");
  assert.equal(await until(() => heard()), "Check the chapters you want, or check all 3.");
  for (const li of document.querySelectorAll("#results-subject li.result")) {
    assert.ok(li.querySelector(":scope > input.desk-gather__tick"), "every chapter has a box");
  }
  assert.ok(row("Include John 3 in the sheet"), "named by its chapter");

  toggle(row("Include Romans 8 in the sheet"), true);
  assert.equal(all.indeterminate, true);
  assert.equal(line(), "1 of 3 checked.");
  assert.equal(go.getAttribute("aria-label"), "Add 1 chapter to a sheet…");
  assert.ok(row("Include Romans 8 in the sheet").closest("li").classList.contains("desk-gather__row-item--picked"));
  assert.equal(await until(() => heard() !== "Check the chapters you want, or check all 3." && heard()), "1 of 3 checked.");

  toggle(all, true);
  assert.equal(line(), "All 3 checked.");
  assert.equal(go.getAttribute("aria-label"), "Add all 3 chapters to a sheet…");
  click(q(".desk-gather__clear"));
  assert.equal(line(), "Check the chapters you want, or check all 3.");
  assert.equal(document.querySelectorAll("#results-subject .desk-gather__row-item--picked").length, 0);
});

test("E163: the verses' checks and the chapters' are kept apart", async () => {
  const { row, line, chapters } = draw({ chapters: TOPIC });
  toggle(chapters.row("Include John 3 in the sheet"), true);
  assert.equal(line(), "Check the verses you want, or check all 4.", "a chapter's check counts nothing among the verses");
  toggle(row("Include John 3:16 in the sheet"), true);
  assert.equal(chapters.line(), "1 of 3 checked.", "nor a verse's among the chapters");
  assert.equal(line(), "1 of 4 checked.");
});

test("E163: a new sheet holds only the checked chapters, each whole, named for the topic they share", async () => {
  const { chapters } = draw({ verses: [], chapters: TOPIC });
  const { q, row } = chapters;
  toggle(row("Include Romans 8 in the sheet"), true);
  toggle(row("Include Matthew 18 in the sheet"), true);
  click(q(".desk-gather__go"));
  const panel = await until(() => pk(".desk-gather__panel"));
  assert.equal(panel.querySelector(".desk-gather__title").textContent, "Add 2 chapters to a sheet");
  await until(() => panel.querySelector(".desk-gather__note")?.textContent !== "Reading your sheets…");
  click(panel.querySelector(".desk-gather__actions button"));
  const done = await until(() => pk(".desk-gather__done"));
  assert.match(done.textContent, /^Made “love” with 2 passages\./);
  const store = await openStore({ ctx: () => ({ client: "web/test", contentVersion: "v1" }) });
  const sheet = (await store.all()).find((r) => r.kind === "sheet" && r.title === "love");
  assert.ok(sheet, "named for the topic both checked chapters carry, which John 3 lacks");
  const passages = sheet.modules.filter((m) => m.type === "passage");
  assert.deepEqual(
    passages.map((p) => [p.bookKey, p.chapter, p.verse, p.endVerse]),
    [["matthew", 18, 1, 35], ["romans", 8, 1, 39]],
    "Bible order, each chapter whole; John 3 left out",
  );
});

test("Select: boxes and the foot bar exist only while selecting, and Cancel puts the page back", async () => {
  draw();
  const select = document.querySelector(".search-tools__select");
  assert.equal(select.getAttribute("aria-pressed"), "true");
  const foot = document.getElementById("search-pickbar");
  assert.equal(foot.hidden, false);
  assert.equal(foot.querySelector(".search-pickbar__count").textContent, "0 chosen");
  toggle(document.querySelector('.search-row > .desk-gather__tick[aria-label="Include John 3:16 in the sheet"]'), true);
  toggle(document.querySelector('.search-row > .desk-gather__tick[aria-label="Include John 3:17 in the sheet"]'), true);
  assert.equal(foot.querySelector(".search-pickbar__count").textContent, "2 chosen");
  assert.equal(foot.querySelector(".search-pickbar__add").getAttribute("aria-disabled"), "false");
  click(foot.querySelector(".search-pickbar__cancel"));
  assert.equal(foot.hidden, true);
  assert.equal(document.querySelectorAll(".search-row > .desk-gather__tick").length, 0, "no boxes once it is off");
  assert.equal(select.getAttribute("aria-pressed"), "false");
});
