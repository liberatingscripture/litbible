// /search's Greek results on a sheet (E165), driven in a browser DOM over the
// real store on fake-indexeddb: the Greek group gets the keyword results' head
// row (E116, E163), a box on every row, checks counted by verse (a verse can
// hold several matches, each its own row), nothing checked adds nothing, and a
// new sheet holds only the checked verses, every hit found counting, not only
// the page shown. search-sheet.js keeps its state at module level, so it is
// imported once and each test draws fresh results under a query of its own.

import { test } from "node:test";
import assert from "node:assert/strict";
import { IDBFactory } from "fake-indexeddb";
import { settle, resetDom, window } from "./helpers/browser-env.mjs";

globalThis.indexedDB = new IDBFactory();
document.documentElement.dataset.contentVersion = "v1";
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

// The hits of a Greek search, in the shape searchGreekAuto lists them (made
// up: here Romans 3:22 and Galatians 2:16 hold the word twice each), so seven
// hits are five verses. desk-search-pane-groups.test.js runs the real data.
const HITS = [
  { book: "romans", chapter: 3, verse: 22, t: 3 },
  { book: "romans", chapter: 3, verse: 22, t: 12 },
  { book: "romans", chapter: 3, verse: 25, t: 4 },
  { book: "romans", chapter: 3, verse: 26, t: 9 },
  { book: "galatians", chapter: 2, verse: 16, t: 7 },
  { book: "galatians", chapter: 2, verse: 16, t: 20 },
  { book: "galatians", chapter: 2, verse: 20, t: 5 },
];
const NAMES = { romans: "Romans", galatians: "Galatians" };
const labelOf = (h) => `${NAMES[h.book]} ${h.chapter}:${h.verse}`;
// A row as search.js's appendGreekRows draws it.
const greekRow = (h) =>
  `<li class="result greek-row"><div class="greek-card"><a class="greek-ref" href="/${h.book}-${h.chapter}/?greek=${h.verse}.${h.t}#v${h.verse}">${labelOf(h)}</a><div class="result-excerpt greek-text" lang="grc">πίστεως</div><div class="greek-parse" hidden></div></div></li>`;
// What search.js's announceGreek sends.
const detailFor = (query, hits, greekWord = "πίστις") => ({
  query,
  verses: [],
  chapters: [],
  greek: hits.map((h) => ({ bookKey: h.book, chapter: h.chapter, verse: h.verse })),
  greekWord,
});

let started = false;
let queries = 0;
function announce(detail) {
  if (!started) {
    started = true;
    attachSearchSheets(() => detail);
  } else {
    document.dispatchEvent(new window.CustomEvent("lit:search-results", { detail }));
  }
}

/** The Greek group's head row and its rows' boxes. */
function head() {
  const bar = document.querySelector("#group-greek [data-desk-gather]");
  const q = (sel) => bar.querySelector(sel);
  const rows = (label) => [...document.querySelectorAll("#results-greek .desk-gather__tick")].filter((b) => b.getAttribute("aria-label") === label);
  const row = (label) => rows(label)[0];
  const line = () => q(".desk-gather__lead").textContent.replace("Clear checks", "").trim();
  const heard = () => bar.querySelector(":scope > p[role=status]").textContent;
  return { bar, q, row, rows, line, heard };
}

/**
 * A Greek search's page under a query of its own: the group as search.astro
 * has it, the first `shown` hits drawn (one page), every hit announced.
 */
function draw({ hits = HITS, shown = 6, greekWord } = {}) {
  resetDom("http://localhost/search/?q=%CF%80%CE%AF%CF%83%CF%84%CE%B9%CF%82");
  document.body.innerHTML = `<main class="search-page">
    <div class="group" id="group-keyword" hidden><div class="group-title">Keyword matches</div><ol class="results" id="results-keyword"></ol></div>
    <div class="group" id="group-greek"><div class="group-title">Greek</div>
      <div class="greek-lemmas" id="greek-lemmas"><p class="greek-lemma-one">πίστις · pistis · G4102 · faith</p></div>
      <ol class="results" id="results-greek">${hits.slice(0, shown).map(greekRow).join("")}</ol>
    </div></main>`;
  const query = `πίστις ${++queries}`;
  announce(detailFor(query, hits, greekWord));
  return { query, ...head() };
}

async function newSheet(q) {
  click(q(".desk-gather__go"));
  const panel = await until(() => q(".desk-gather__panel"));
  await until(() => panel.querySelector(".desk-gather__note")?.textContent !== "Reading your sheets…");
  click(panel.querySelector(".desk-gather__actions button"));
  return { panel, done: await until(() => q(".desk-gather__done")) };
}

async function sheetTitled(title) {
  const store = await openStore({ ctx: () => ({ client: "web/test", contentVersion: "v1" }) });
  return (await store.all()).find((r) => r.kind === "sheet" && r.title === title);
}

test("E165: the Greek group gets the keyword results' head row, and every row a box", () => {
  const { bar, q, line } = draw();
  same(document.querySelector("#group-greek .group-title").nextElementSibling, bar, "right after the group's title");
  assert.ok(bar.classList.contains("desk-gather--head"));
  assert.equal(bar.hidden, false);
  const all = q(":scope > input.desk-gather__all");
  assert.equal(all.type, "checkbox");
  assert.equal(all.getAttribute("aria-label"), "Check all 5 verses", "seven matches in five verses");
  assert.equal(line(), "Check the verses you want, or check all 5.");
  const go = q(".desk-gather__go");
  assert.ok(go.classList.contains("desk-gather__btn--primary"));
  assert.equal(go.getAttribute("aria-label"), "Add checked verses to a sheet…", "never “0 verses”");
  assert.equal(document.querySelector("#group-keyword [data-desk-gather]")?.hidden ?? true, true, "no keyword row on a Greek search");
  const rows = document.querySelectorAll("#results-greek li.greek-row");
  assert.equal(rows.length, 6);
  for (const li of rows) {
    const box = li.querySelector(":scope > input.desk-gather__tick");
    assert.ok(box, "every row has a box");
    same(box.nextElementSibling, li.querySelector(".greek-card"), "before the card");
    assert.ok(li.classList.contains("desk-gather__row-item"));
  }
  assert.equal(rows[0].querySelector(".desk-gather__tick").getAttribute("aria-label"), "Include Romans 3:22 in the sheet");
});

test("E165: nothing checked adds nothing; the button stays focusable and a press says why", async () => {
  const { q, heard } = draw();
  const go = q(".desk-gather__go");
  assert.equal(go.getAttribute("aria-disabled"), "true");
  assert.equal(go.disabled, false);
  assert.equal(go.getAttribute("aria-describedby"), q(".desk-gather__lead").id);
  click(go);
  await settle(20);
  assert.equal(q(".desk-gather__panel"), null, "no chooser opens");
  assert.equal(await until(() => heard()), "Check the verses you want, or check all 5.");
});

test("E165: a verse's checks are one, whichever of its matches is checked, and count once", async () => {
  const { bar, q, rows, line, heard } = draw();
  const [first, second] = rows("Include Romans 3:22 in the sheet");
  assert.ok(first && second, "Romans 3:22 has a row for each match");
  toggle(second, true);
  assert.equal(first.checked, true, "checking one match checks the verse");
  assert.ok(first.closest("li").classList.contains("desk-gather__row-item--picked"));
  assert.ok(second.closest("li").classList.contains("desk-gather__row-item--picked"));
  assert.equal(line(), "1 of 5 checked.");
  assert.equal(q(".desk-gather__go").getAttribute("aria-label"), "Add 1 verse to a sheet…");
  assert.equal(q(".desk-gather__all").indeterminate, true);
  assert.ok(bar.classList.contains("desk-gather--some"), "the card takes the green rule");
  assert.equal(await until(() => heard()), "1 of 5 checked.");
  toggle(first, false);
  assert.equal(second.checked, false, "and unchecking one unchecks it");
  assert.equal(line(), "Check the verses you want, or check all 5.");
});

test("E165: a new sheet holds only the checked verses, in Bible order and joined, named for the Greek word", async () => {
  const { q, row, rows } = draw();
  toggle(row("Include Romans 3:26 in the sheet"), true);
  toggle(row("Include Romans 3:25 in the sheet"), true);
  toggle(rows("Include Romans 3:22 in the sheet")[1], true);
  assert.equal(q(".desk-gather__go").getAttribute("aria-label"), "Add 3 verses to a sheet…");
  const { panel, done } = await newSheet(q);
  assert.equal(panel.querySelector(".desk-gather__title").textContent, "Add 3 verses to a sheet");
  assert.match(done.textContent, /^Made “Greek: ‘πίστις’” with 2 passages\. Open the sheet, or open it in the Study Desk\./);
  const sheet = await sheetTitled("Greek: “πίστις”");
  assert.ok(sheet, "named for the word, not “Search:”");
  assert.equal(sheet.template, "search");
  assert.deepEqual(
    sheet.modules.filter((m) => m.type === "passage").map((p) => [p.bookKey, p.chapter, p.verse, p.endVerse]),
    [["romans", 3, 22, 22], ["romans", 3, 25, 26]],
    "3:22 once, though checked from one of its two matches; 3:25 and 3:26 as one passage; Galatians left out",
  );
});

test("E165: the box at the head checks every verse found, not only the page shown", async () => {
  // Galatians 2:20 is the seventh hit, on the next page.
  const { q, line } = draw({ greekWord: "πίστις.gen" });
  assert.equal(document.querySelector('#results-greek [aria-label="Include Galatians 2:20 in the sheet"]'), null, "not on screen");
  toggle(q(".desk-gather__all"), true);
  assert.equal(line(), "All 5 checked.");
  assert.equal(q(".desk-gather__go").getAttribute("aria-label"), "Add all 5 verses to a sheet…");
  assert.equal(document.querySelectorAll("#results-greek .desk-gather__row-item--picked").length, 6, "every row on screen marked");
  await newSheet(q);
  const sheet = await sheetTitled("Greek: “πίστις.gen”");
  assert.ok(sheet, "a command search is named as typed");
  assert.deepEqual(
    sheet.modules.filter((m) => m.type === "passage").map((p) => [p.bookKey, p.chapter, p.verse, p.endVerse]),
    [["romans", 3, 22, 22], ["romans", 3, 25, 26], ["galatians", 2, 16, 16], ["galatians", 2, 20, 20]],
  );
});

test("E165: another Greek word for the same query keeps only the checks on verses it still finds", () => {
  const { query, row, line } = draw();
  toggle(row("Include Romans 3:25 in the sheet"), true);
  toggle(row("Include Galatians 2:16 in the sheet"), true);
  assert.equal(line(), "2 of 5 checked.");
  // The reader picks another of the query's words: search.js draws its rows
  // into the same group and announces them under the same query.
  const other = [HITS[2], HITS[3], { book: "romans", chapter: 4, verse: 5, t: 2 }];
  document.getElementById("results-greek").innerHTML = other.map(greekRow).join("");
  announce(detailFor(query, other, "πιστεύω"));
  const h = head();
  assert.equal(h.line(), "1 of 3 checked.", "Romans 3:25 kept; Galatians 2:16, no longer found, dropped");
  assert.equal(h.row("Include Romans 3:25 in the sheet").checked, true);
  assert.equal(h.row("Include Romans 4:5 in the sheet").checked, false);
});

test("E165: a search with nothing to check, or none at all, hides the row and forgets the checks", () => {
  const { q, row } = draw();
  toggle(row("Include Romans 3:22 in the sheet"), true);
  // Cleared: search.js announces an empty query.
  announce({ query: "", verses: [], chapters: [], greek: [] });
  const bar = document.querySelector("#group-greek [data-desk-gather]");
  assert.equal(bar.hidden, true);
  // The same Greek search again: its verses unchecked.
  const query = `πίστις ${++queries}`;
  announce(detailFor(query, HITS));
  assert.equal(bar.hidden, false);
  assert.equal(q(".desk-gather__lead").textContent.replace("Clear checks", "").trim(), "Check the verses you want, or check all 5.");
  assert.equal(document.querySelectorAll("#results-greek .desk-gather__row-item--picked").length, 0);
});
