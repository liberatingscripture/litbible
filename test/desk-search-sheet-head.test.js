// /search's head row (E116), driven in a browser DOM over the real store on
// fake-indexeddb: the box that checks every verse, the card with its line and
// its one button, which adds nothing while nothing is checked, and the
// chapters' row. search-sheet.js keeps its state at module level, so it is
// imported once and each test draws fresh results under a query of its own.

import { test } from "node:test";
import assert from "node:assert/strict";
import { IDBFactory } from "fake-indexeddb";
import { settle, resetDom, window } from "./helpers/browser-env.mjs";

globalThis.indexedDB = new IDBFactory();
document.documentElement.dataset.contentVersion = "v1";
// The chapters' last verses (search/chapters/*.json) aren't needed here.
globalThis.fetch = async () => ({ ok: false, status: 404, json: async () => null, text: async () => "" });

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
  `<li class="result-occurrence"><a class="result-link result-link--occurrence" href="/${r.bookKey}-${r.chapter}#v${r.verse}">Verse ${r.verse}</a></li>`;
const chapterGroup = (title, verses) =>
  `<li class="result-group"><h3 class="result-group__title">${title}</h3><ol class="result-group__occurrences">${verses.map(occurrence).join("")}</ol></li>`;

let started = false;
let queries = 0;
/** /search's results for a query of their own, announced as search.js does. */
function draw({ verses = VERSES, chapters = [] } = {}) {
  resetDom("http://localhost/search/?q=loved");
  document.body.innerHTML = `<main class="search-page">
    <section id="group-subject"><h2 class="group-title">Chapters by topic</h2><ol id="results-subject"></ol></section>
    <section id="group-keyword"><h2 class="group-title">Verses</h2><ol id="results-keyword">${
      verses.length ? chapterGroup("John 3", verses.filter((r) => r.bookKey === "john")) + chapterGroup("Romans 8", verses.filter((r) => r.bookKey === "romans")) : ""
    }</ol></section></main>`;
  const detail = { query: `loved ${++queries}`, verses, chapters };
  if (!started) {
    started = true;
    attachSearchSheets(() => detail);
  } else {
    document.dispatchEvent(new window.CustomEvent("lit:search-results", { detail }));
  }
  const bar = document.querySelector("#group-keyword [data-desk-gather]");
  const q = (sel) => bar.querySelector(sel);
  const row = (v) => [...document.querySelectorAll("#results-keyword .desk-gather__tick")].find((b) => b.getAttribute("aria-label") === v);
  const line = () => q(".desk-gather__lead").textContent.replace("Clear checks", "").trim();
  const heard = () => bar.querySelector(":scope > p[role=status]").textContent;
  return { bar, q, row, line, heard };
}

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
  for (const li of document.querySelectorAll("#results-keyword li.result-occurrence")) {
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
  assert.equal(q(".desk-gather__panel"), null, "no chooser opens");
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
  click(go);
  const panel = await until(() => q(".desk-gather__panel"));
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
  const done = await until(() => q(".desk-gather__done"));
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
  click(q(".desk-gather__go"));
  await until(() => q(".desk-gather__panel"));
  toggle(row("Include Romans 8:1 in the sheet"), false);
  assert.equal(q(".desk-gather__panel"), null);
  assert.equal(q(".desk-gather__go").getAttribute("aria-expanded"), "false");
});

test("E116: the chapters get the same head row and rule, with no box, since every chapter goes whole", async () => {
  draw({ verses: [], chapters: [{ bookKey: "john", chapter: 3, labels: ["love"] }, { bookKey: "romans", chapter: 8, labels: ["love"] }] });
  const verses = document.querySelector("#group-keyword [data-desk-gather]");
  assert.equal(verses.hidden, true, "no verses, no verse row");
  const bar = document.querySelector("#group-subject [data-desk-gather]");
  same(document.querySelector("#group-subject .group-title").nextElementSibling, bar);
  assert.ok(bar.classList.contains("desk-gather--head"));
  assert.equal(bar.querySelector("input[type=checkbox]"), null);
  assert.ok(bar.classList.contains("desk-gather--some"), "the rule is always on");
  assert.equal(bar.querySelector(".desk-gather__lead").textContent, "All 2 chapters go, each whole.");
  const go = bar.querySelector(".desk-gather__go");
  assert.equal(go.getAttribute("aria-label"), "Add 2 chapters to a sheet…");
  assert.equal(go.getAttribute("aria-disabled"), null);
  click(go);
  const panel = await until(() => bar.querySelector(".desk-gather__panel"));
  assert.equal(panel.querySelector(".desk-gather__title").textContent, "Add 2 chapters to a sheet");
});
