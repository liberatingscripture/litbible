// E154 driven: "All sheets…" at the foot of "Add to sheet ▸", and the pick
// window it opens (src/scripts/desk/pick-window.js), which knows nothing of
// sheets so D13's "All collections…" can share it. The window is driven
// through its keys and clicks; the flyout through a real verse menu on John 3,
// with a notebook of sheets held in memory.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { settle, resetDom } from "./helpers/browser-env.mjs";
import { prepareStudyParagraph } from "../src/lib/chapter-html.ts";
import { filterPicks, pickCountLine } from "../src/lib/desk-pick.mjs";
import { addableSheets, needsAllSheets } from "../src/lib/desk-sheet-add.mjs";
import { createSheet, makeModule, templateFromSheet } from "../src/lib/desk-sheets.mjs";

const { openPickWindow, closePickWindow } = await import("../src/scripts/desk/pick-window.js");

const key = (target, k, extra = {}) => target.dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true, cancelable: true, ...extra }));
const typeInto = (input, text, type = "input") => {
  input.value = text;
  input.dispatchEvent(new Event(type, { bubbles: true }));
};
const win = () => document.querySelector(".desk-pick");
const filterBox = () => win()?.querySelector(".desk-pick__filter");
const rowEls = () => [...(win()?.querySelectorAll(".desk-pick__row") ?? [])];
const rowNames = () => rowEls().map((b) => b.querySelector(".desk-pick__name").textContent);
const countLine = () => win()?.querySelector(".desk-pick__count")?.textContent;
const focused = () => document.activeElement;

/* ── The rules ─────────────────────────────────────────────────────── */

test("the filter keeps items holding every word typed, any order, no case or accents", () => {
  const items = [{ name: "Easter Sunday" }, { name: "Advent" }, { name: "Pentecôte" }, { name: "Sunday school" }];
  assert.deepEqual(filterPicks(items, "").map((i) => i.name), ["Easter Sunday", "Advent", "Pentecôte", "Sunday school"]);
  assert.deepEqual(filterPicks(items, "sunday").map((i) => i.name), ["Easter Sunday", "Sunday school"]);
  assert.deepEqual(filterPicks(items, "  SUNDAY  easter ").map((i) => i.name), ["Easter Sunday"]);
  assert.deepEqual(filterPicks(items, "pentecote").map((i) => i.name), ["Pentecôte"]);
  assert.deepEqual(filterPicks(items, "lent"), []);
});

test("the count line says how many, how many the filter left, or that it left none", () => {
  const noun = ["sheet", "sheets"];
  assert.equal(pickCountLine(7, 7, "", noun), "7 sheets");
  assert.equal(pickCountLine(1, 1, " ", noun), "1 sheet");
  assert.equal(pickCountLine(2, 7, "eas", noun), "2 of 7 sheets");
  assert.equal(pickCountLine(0, 7, " zz ", noun), "No title matches “zz.”");
});

/* ── The window ────────────────────────────────────────────────────── */

const ITEMS = [
  { id: "a", name: "Easter", detail: "Changed November 12, 2026" },
  { id: "b", name: "Advent", detail: "Changed November 10, 2026" },
  { id: "c", name: "Lent", detail: "Changed November 2, 2026" },
];

function setUp() {
  closePickWindow("page");
  resetDom();
  const opener = document.createElement("button");
  opener.textContent = "Where I was";
  document.body.append(opener);
  const picked = [];
  const handle = openPickWindow({
    heading: "Add to sheet",
    title: "All sheets",
    lead: "Choose the sheet for John 3:16.",
    noun: ["sheet", "sheets"],
    items: ITEMS,
    back: opener,
    onPick: (item) => picked.push(item),
  });
  return { opener, picked, handle };
}

test("it opens with focus in the filter box, listing every item in the order given", () => {
  setUp();
  const el = win();
  assert.ok(el, "the window is open");
  assert.equal(el.getAttribute("role"), "dialog");
  assert.equal(document.getElementById(el.getAttribute("aria-labelledby")).textContent, "All sheets");
  assert.equal(document.getElementById(el.getAttribute("aria-describedby")).textContent, "Choose the sheet for John 3:16.");
  assert.equal(focused() === filterBox(), true, "focus is in the filter box");
  assert.equal(document.querySelector(`label[for="${filterBox().id}"]`).textContent, "Filter by title");
  assert.deepEqual(rowNames(), ["Easter", "Advent", "Lent"]);
  assert.equal(countLine(), "3 sheets");
  const first = rowEls()[0];
  assert.equal(first.getAttribute("aria-label"), "Easter", "a row's name is its title");
  assert.equal(document.getElementById(first.getAttribute("aria-describedby")).textContent, "Changed November 12, 2026");
});

test("typing narrows the list and the count; the browser's own clear brings it all back", () => {
  setUp();
  typeInto(filterBox(), "en");
  assert.deepEqual(rowNames(), ["Advent", "Lent"]);
  assert.equal(countLine(), "2 of 3 sheets");
  typeInto(filterBox(), "zz");
  assert.deepEqual(rowNames(), []);
  assert.equal(countLine(), "No title matches “zz.”");
  typeInto(filterBox(), "", "search");
  assert.deepEqual(rowNames(), ["Easter", "Advent", "Lent"]);
});

test("the arrow keys, Home and End move through the rows, and Up from the first goes back to the box", () => {
  setUp();
  key(filterBox(), "ArrowDown");
  assert.equal(focused() === rowEls()[0], true, "Down from the box: the first row");
  key(focused(), "ArrowDown");
  assert.equal(focused() === rowEls()[1], true, "Down: the next row");
  key(focused(), "End");
  assert.equal(focused() === rowEls()[2], true, "End: the last row");
  key(focused(), "ArrowDown");
  assert.equal(focused() === rowEls()[2], true, "Down on the last row stays");
  key(focused(), "Home");
  assert.equal(focused() === rowEls()[0], true, "Home: the first row");
  key(focused(), "ArrowUp");
  assert.equal(focused() === filterBox(), true, "Up from the first row: the box");
});

test("a letter typed on a row goes back to the box", () => {
  setUp();
  key(filterBox(), "ArrowDown");
  key(focused(), "l");
  assert.equal(focused() === filterBox(), true);
});

test("Enter in the box picks the one row left, closes the window and gives focus back", () => {
  const { opener, picked } = setUp();
  typeInto(filterBox(), "len");
  key(filterBox(), "Enter");
  assert.deepEqual(picked.map((i) => i.id), ["c"]);
  assert.equal(win(), null, "the window closed");
  assert.equal(focused() === opener, true, "focus went back where the reader came from");
});

test("Enter in the box with several rows left moves to the first, picking nothing", () => {
  const { picked } = setUp();
  typeInto(filterBox(), "en");
  key(filterBox(), "Enter");
  assert.deepEqual(picked, []);
  assert.ok(win(), "still open");
  assert.equal(focused() === rowEls()[0], true);
});

test("a click on a row picks it", () => {
  const { opener, picked } = setUp();
  rowEls()[1].click();
  assert.deepEqual(picked.map((i) => i.id), ["b"]);
  assert.equal(win(), null);
  assert.equal(focused() === opener, true);
});

test("Escape in a box holding words only clears it; the next Escape closes and gives focus back (BA24)", () => {
  const { opener, picked } = setUp();
  let reachedPage = 0;
  const page = () => reachedPage++;
  document.addEventListener("keydown", page);
  typeInto(filterBox(), "en");
  key(filterBox(), "Escape");
  assert.ok(win(), "still open");
  assert.equal(filterBox().value, "");
  assert.deepEqual(rowNames(), ["Easter", "Advent", "Lent"]);
  key(filterBox(), "Escape");
  document.removeEventListener("keydown", page);
  assert.equal(win(), null, "closed");
  assert.equal(focused() === opener, true, "focus went back");
  assert.equal(reachedPage, 0, "neither Escape reached the page's own Escape");
  assert.deepEqual(picked, []);
});

test("the × closes it and gives focus back", () => {
  const { opener } = setUp();
  win().querySelector(".lit-panel__close").click();
  assert.equal(win(), null);
  assert.equal(focused() === opener, true);
});

test("a new list keeps the filter and the row that had focus; a row gone hands focus to the box", () => {
  const { handle } = setUp();
  typeInto(filterBox(), "en");
  key(filterBox(), "ArrowDown");
  key(focused(), "ArrowDown");
  assert.equal(focused().dataset.pick, "c");
  handle.update([{ id: "d", name: "Pentecost" }, ...ITEMS]);
  assert.deepEqual(rowNames(), ["Pentecost", "Advent", "Lent"], "the filter still holds");
  assert.equal(focused().dataset.pick, "c", "focus stayed on Lent");
  handle.update(ITEMS.slice(0, 2));
  assert.equal(focused() === filterBox(), true, "Lent is gone, so the box has focus");
});

test("opening another replaces the first, which gives no focus back", () => {
  const { opener } = setUp();
  openPickWindow({ heading: "Add to sheet", title: "All sheets", noun: ["sheet", "sheets"], items: ITEMS.slice(0, 1), back: opener, onPick: () => {} });
  assert.equal(document.querySelectorAll(".desk-pick").length, 1);
  assert.deepEqual(rowNames(), ["Easter"]);
  assert.equal(focused() === filterBox(), true, "the new window's box has focus");
});

/* ── "All sheets…" in Chapter View's verse menu ─────────────────────── */

const john3 = JSON.parse(readFileSync(new URL("../src/data/chapters/john-3.json", import.meta.url), "utf8"));
const ctxNow = "2026-11-18T12:00:00.000Z";
const ctx = () => ({ client: "web/test", contentVersion: "v1" });

/** John 3 as Chapter View renders it, verse numbers focusable as chapter-tools makes them. */
function chapterPage() {
  const seen = new Set();
  const state = { currentVerse: null };
  const body = john3.paragraphs.map((p) => `<div class="p">${prepareStudyParagraph(p, "john", 3, seen, state)}</div>`).join("");
  document.body.innerHTML = `
    <main><div class="scripture-main">
      <article class="chapter" data-last-read-book="john" data-last-read-chapter="3">
        <div class="chapter-paragraphs">${body}</div>
      </article>
    </div></main>`;
  for (const sup of document.querySelectorAll("sup.vn")) sup.setAttribute("tabindex", "0");
}

/** The undo bar is built once per process: keep it, cleared, across fresh pages. */
function freshPage() {
  closePickWindow("page");
  const bar = document.querySelector(".desk-undo");
  resetDom();
  chapterPage();
  if (bar) {
    bar.querySelector(".desk-undo__text").textContent = "";
    bar.querySelector(".desk-undo__bar").hidden = true;
    document.body.append(bar);
  }
}

const sheetCtx = { now: ctxNow, client: "web/test", contentVersion: "v1" };
/** Sheets S0 (oldest) to S{n-1} (newest), plus a template that never shows. */
function sheets(n) {
  const list = Array.from({ length: n }, (_, i) => ({
    ...createSheet({ title: `S${i}`, modules: [makeModule("text")] }, sheetCtx),
    modified: `2026-11-${String(i + 1).padStart(2, "0")}T12:00:00.000Z`,
  }));
  return [...list, { ...templateFromSheet(list[0], sheetCtx), modified: "2026-11-30T12:00:00.000Z" }];
}

/** A notebook held in memory: byKind, get, change and subscribe, as the page's store. */
function memoryStore(records) {
  const byId = new Map(records.map((r) => [r.id, r]));
  const listeners = [];
  return {
    byKind: async (kind) => [...byId.values()].filter((r) => r.kind === kind),
    get: async (id) => byId.get(id),
    change: async (fn) => {
      const plan = await fn({ get: async (id) => byId.get(id) });
      if (!plan) return null;
      for (const r of plan.put ?? []) byId.set(r.id, r);
      return plan;
    },
    lastEntry: () => null,
    subscribe: (fn) => {
      listeners.push(fn);
      return () => {};
    },
    put(record) {
      byId.set(record.id, record);
      for (const fn of listeners) fn({ kinds: ["sheet"] });
    },
    record: (id) => byId.get(id),
  };
}

const barText = () => document.querySelector(".desk-undo__text")?.textContent ?? "";

/** Open a verse menu on John 3:16 and let "Add to sheet" draw into it. */
async function verseMenu(store, { restoreFocus = null } = {}) {
  const { showPanel, currentPanel } = await import("../src/scripts/lit-panel.js");
  const { createSheetAdd } = await import("../src/scripts/desk/sheets/sheet-add.js");
  const sheetRow = createSheetAdd({ store, ctx });
  await settle(10);
  const panel = document.createElement("div");
  showPanel(document.querySelector("#v16"), panel, { restoreFocus });
  const d = { view: "study", kind: "verse", start: 16, end: 16, panel, acting: () => {} };
  panel.append(sheetRow(d, { bookKey: "john", chapter: 3 }));
  await settle(10);
  const menu = panel.querySelector(".lit-flyout__menu");
  return { panel, menu, currentPanel, names: () => [...menu.querySelectorAll("button")].map((b) => b.textContent) };
}

test("five sheets or fewer: the flyout lists them all and has no All sheets…", async () => {
  freshPage();
  const { names } = await verseMenu(memoryStore(sheets(5)));
  assert.deepEqual(names(), ["“S4”", "“S3”", "“S2”", "“S1”", "“S0”", "New sheet"]);
  assert.equal(needsAllSheets(addableSheets(sheets(5))), false);
});

test("more than five: the flyout lists the five changed last, New sheet, then All sheets…", async () => {
  freshPage();
  const { menu, names } = await verseMenu(memoryStore(sheets(7)));
  assert.deepEqual(names(), ["“S6”", "“S5”", "“S4”", "“S3”", "“S2”", "New sheet", "All sheets…"]);
  const more = [...menu.querySelectorAll("button")].at(-1);
  assert.equal(more.getAttribute("role"), "menuitem");
  assert.equal(more.getAttribute("aria-haspopup"), "dialog");
});

test("All sheets… closes the menu and lists every sheet the flyout could take, newest change first", async () => {
  freshPage();
  const { panel, menu, currentPanel } = await verseMenu(memoryStore(sheets(7)));
  [...menu.querySelectorAll("button")].at(-1).click();
  await settle(10);
  assert.equal(panel.isConnected, false, "the verse menu closed");
  assert.equal(currentPanel(), null);
  assert.ok(win(), "the window is open");
  assert.equal(win().querySelector(".lit-window__title").textContent, "All sheets");
  assert.equal(win().querySelector(".desk-pick__lead").textContent, "Choose the sheet for John 3:16.");
  assert.deepEqual(rowNames(), ["S6", "S5", "S4", "S3", "S2", "S1", "S0"], "no template, newest first");
  assert.equal(rowEls()[6].querySelector(".desk-pick__detail").textContent, "Changed November 1, 2026");
  assert.equal(countLine(), "7 sheets");
  assert.equal(focused() === filterBox(), true);
});

test("a pick in the window adds the passage as a flyout pick does, with the undo bar, and focus goes back to the verse", async () => {
  freshPage();
  const store = memoryStore(sheets(7));
  const { menu } = await verseMenu(store);
  [...menu.querySelectorAll("button")].at(-1).click();
  await settle(10);
  typeInto(filterBox(), "s0");
  key(filterBox(), "Enter");
  await settle(20);
  assert.equal(win(), null, "the window closed");
  const s0 = [...(await store.byKind("sheet"))].find((r) => r.title === "S0" && !r.isTemplate);
  const passages = s0.modules.filter((m) => m.type === "passage");
  assert.equal(passages.length, 1, "the passage is on the oldest sheet");
  assert.deepEqual([passages[0].bookKey, passages[0].chapter, passages[0].verse, passages[0].endVerse], ["john", 3, 16, 16]);
  assert.equal(barText(), "John 3:16 added to “S0.”");
  const link = document.querySelector(".desk-undo__link");
  assert.match(link?.textContent ?? "", /^Open the sheet\b/);
  assert.match(link.getAttribute("href"), new RegExp(`/sheets/\\?id=${encodeURIComponent(s0.id)}$`));
  assert.equal(focused() === document.querySelector("#v16"), true, "focus is on the verse number, not the page");
});

test("Escape closes the window and gives focus to the verse number the keyboard opened the menu from", async () => {
  freshPage();
  const v17 = document.querySelector("#v17");
  const { menu } = await verseMenu(memoryStore(sheets(7)), { restoreFocus: v17 });
  [...menu.querySelectorAll("button")].at(-1).click();
  await settle(10);
  assert.equal(focused() === filterBox(), true, "the closing menu didn't take focus to its verse number first");
  key(filterBox(), "Escape");
  assert.equal(win(), null);
  assert.equal(focused() === v17, true);
});

test("a sheet changed while the window is open shows there at once", async () => {
  freshPage();
  const store = memoryStore(sheets(7));
  const { menu } = await verseMenu(store);
  [...menu.querySelectorAll("button")].at(-1).click();
  await settle(10);
  const made = { ...createSheet({ title: "Made elsewhere", modules: [] }, sheetCtx), modified: "2026-11-20T12:00:00.000Z" };
  store.put(made);
  await settle(10);
  assert.deepEqual(rowNames().slice(0, 2), ["Made elsewhere", "S6"]);
  assert.equal(countLine(), "8 sheets");
});
