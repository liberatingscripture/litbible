// The Search pane's other groups on a sheet (E166; BVJ, 2026-11-19: "full
// parity with the search page"): the chapters by topic, each going whole,
// and the Greek's verses, checked as E117's verses are, each group with its
// own checks and strip. Driven in a browser DOM: the verse index and the
// topics index are the test's own, the Greek's data is served from public/
// on disk (committed), and the store is a fake that keeps what is written.

import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { settle, window } from "./helpers/browser-env.mjs";

const VERSES = {
  verses: {
    matthew: { 6: ["Forgiveness is asked for here."] },
    luke: { 15: ["", "Here a father’s forgiveness runs to meet a child."] },
  },
  vocab: ["forgiveness", "asked", "father", "child", "meet"],
};
const scripture = (book, chapter, label = "Forgiveness") => ({
  url: `/${book}-${chapter}`,
  title: "",
  type: "scripture",
  book,
  chapter,
  topicLabel: label,
});
// Every chapter of Matthew, Mark, and Luke: 68, more than the pane's old cap of 50.
const LIGHT = [["matthew", 28], ["mark", 16], ["luke", 24]].flatMap(([book, last]) =>
  Array.from({ length: last }, (_, i) => scripture(book, i + 1, "Light")),
);
const TOPICS = {
  topics: {
    forgiveness: [
      scripture("matthew", 18),
      scripture("luke", 15),
      scripture("matthew", 6),
      { url: "/matthew-intro", title: "Matthew introduction", type: "intro", book: "matthew", topicLabel: "Forgiveness" },
    ],
    // No topic is "debt" itself, so the word finds both of these (a loose match).
    "debt-release": [scripture("luke", 4, "Debt release"), scripture("matthew", 18, "Debt release")],
    "forgiving-debt": [scripture("matthew", 18, "Forgiving debt")],
    light: LIGHT,
  },
};
const reply = (body, ok = true) => ({
  ok,
  status: ok ? 200 : 404,
  text: async () => (typeof body === "string" ? body : JSON.stringify(body)),
  json: async () => {
    if (!ok) throw new Error("404");
    return typeof body === "string" ? JSON.parse(body) : body;
  },
});
globalThis.fetch = async (url) => {
  const path = String(url).split("?")[0];
  if (path === "/search/verses.json") return reply(VERSES);
  if (path === "/topics-index.json") return reply(TOPICS);
  if (path.startsWith("/greek/")) {
    const file = new URL(`../public${path}`, import.meta.url);
    if (existsSync(file)) return reply(readFileSync(file, "utf8"));
  }
  return reply("", false);
};
globalThis.__pagefind = { search: async () => ({ results: [] }) };

const { createSearchPane } = await import("../src/scripts/desk/search-pane.js");
const { createSheet } = await import("../src/lib/desk-sheets.mjs");

// Elements are compared by identity: a failed assert.equal on two DOM nodes
// prints the whole happy-dom object graph.
const same = (a, b, message) => assert.ok(a === b, message ?? "not the same element");

async function until(fn, tries = 400) {
  for (let i = 0; i < tries; i++) {
    const v = fn();
    if (v) return v;
    await settle(10);
  }
  throw new Error("timed out");
}
const click = (el) => el.dispatchEvent(new window.MouseEvent("click", { bubbles: true, cancelable: true, button: 0 }));
function type(input, text) {
  input.value = text;
  input.dispatchEvent(new window.Event("input", { bubbles: true }));
}
function toggle(box, on) {
  box.checked = on;
  box.dispatchEvent(new window.Event("change", { bubbles: true }));
}

/** A store over `sheets`; `writes` gets each plan written. */
function memoryStore(sheets = []) {
  const writes = [];
  return {
    writes,
    change: async (build) => {
      const plan = await build({ get: async (id) => sheets.find((s) => s.id === id) ?? null });
      writes.push(plan);
      return plan;
    },
    lastEntry: () => ({ id: "entry" }),
    byKind: async (kind) => sheets.filter((s) => s.kind === kind),
  };
}

let n = 0;
/** A Search pane under the type `mode`, with a Sheets pane's target the test can set. */
function mount({ store = memoryStore(), mode = "all", desk = false } = {}) {
  for (const old of document.querySelectorAll(".desk-search")) old.remove();
  document.documentElement.dataset.desk = desk ? "on" : "off";
  let target = null;
  const shown = []; // the sheets the pane asked the desk to show
  const hearers = new Set();
  const pane = createSearchPane({
    paneId: `g${++n}`,
    env: {
      store,
      ctx: () => ({ client: "web/test", contentVersion: "v1" }),
      showPassage: () => "moved",
      showIntro: () => ({ outcome: "shown" }),
      showSheet: (id) => (shown.push(id), { outcome: "open", changed: false }),
      openGreekHit: () => {},
    },
    getPlace: () => ({ bookKey: "john" }),
    sheets: { addTarget: () => target, onAddTarget: (fn) => (hearers.add(fn), () => hearers.delete(fn)) },
  });
  document.body.append(pane.el);
  const $ = (sel) => pane.el.querySelector(sel);
  const $$ = (sel) => [...pane.el.querySelectorAll(sel)];
  const typeSel = $("select[aria-label='Kind of result']");
  typeSel.value = mode;
  typeSel.dispatchEvent(new window.Event("change", { bubbles: true }));
  const setTarget = (t) => {
    target = t;
    for (const fn of hearers) fn();
  };
  const strip = (kind) => $(`.desk-search__pick[data-pick="${kind}"]`);
  const line = (kind) => strip(kind).querySelector(".desk-search__pick-line").textContent.replace("Clear checks", "").trim();
  const box = (kind, label) => $$(`.desk-search__check[data-pick="${kind}"]`).filter((b) => b.getAttribute("aria-label") === `Include ${label} in the sheet`);
  return { pane, $, $$, store, input: $("input[type=search]"), setTarget, strip, line, box, shown };
}

const passagesOf = (sheet) => sheet.modules.filter((m) => m.type === "passage").map((p) => [p.bookKey, p.chapter, p.verse, p.endVerse]);
const said = () => until(() => document.querySelector(".desk-undo__text")?.textContent);

// ---- the chapters by topic ----

test("E166: the chapters by topic have a box each and their own strip, as /search's", async () => {
  const { $, $$, input, strip, line, box } = mount({ mode: "subject" });
  type(input, "forgiveness");
  await until(() => strip("subject"));
  const group = $("[data-group='subject']");
  same(group.querySelector(".desk-search__group-title").nextElementSibling, strip("subject"), "the strip sits under the group's title");
  const all = strip("subject").querySelector(".desk-search__check-all");
  assert.equal(all.getAttribute("aria-label"), "Check all 3 chapters");
  assert.equal(line("subject"), "Check the chapters you want, or check all 3.");
  const rows = $$("[data-group='subject'] .desk-search__row");
  assert.equal(rows.length, 4, "three chapters and the introduction");
  assert.equal(rows.filter((r) => r.querySelector(".desk-search__check")).length, 3, "a box on every chapter");
  const intro = rows.find((r) => !r.querySelector(".desk-search__check"));
  assert.match(intro.textContent, /Introduction/i, "the introduction, being no chapter, has none");
  assert.equal(intro.querySelector(".desk-search__add"), null, "nor a +");
  for (const r of rows.filter((r) => r.querySelector(".desk-search__check"))) {
    same(r.firstElementChild, r.querySelector(".desk-search__check"), "the box comes first in its row");
  }

  const fresh = strip("subject").querySelector(".desk-search__sheet--new");
  assert.equal(fresh.getAttribute("aria-label"), "New sheet of checked chapters");
  assert.equal(fresh.getAttribute("aria-disabled"), "true", "nothing checked adds nothing");
  toggle(box("subject", "Luke 15")[0], true);
  assert.equal(line("subject"), "1 of 3 checked.");
  assert.equal(fresh.getAttribute("aria-label"), "New sheet of 1 chapter");
  assert.equal(all.indeterminate, true);
  toggle(all, true);
  assert.equal(line("subject"), "All 3 checked.");
  assert.equal(fresh.getAttribute("aria-label"), "New sheet of all 3 chapters");
});

test("E166: a new sheet holds the checked chapters whole, named for their topic", async () => {
  const store = memoryStore();
  const { input, strip, box } = mount({ store, mode: "subject" });
  type(input, "forgiveness");
  await until(() => strip("subject"));
  toggle(box("subject", "Matthew 18")[0], true);
  toggle(box("subject", "Matthew 6")[0], true);
  click(strip("subject").querySelector(".desk-search__sheet--new"));
  await until(() => store.writes.length);
  const { sheet } = store.writes[0];
  assert.equal(sheet.title, "Forgiveness", "the topic every checked chapter carries");
  assert.deepEqual(passagesOf(sheet), [["matthew", 6, 1, 34], ["matthew", 18, 1, 35]], "each whole, in Bible order, and only the checked");
  assert.match(await said(), /^Made “Forgiveness” with 2 passages\./);
});

test("E166: a chapter's + adds that chapter, whole, to the sheet a Sheets pane shows", async () => {
  const sheet = createSheet({ title: "Mercy", modules: [] }, { now: "2026-11-19T12:00:00.000Z", client: "web/test", contentVersion: "v1" });
  const store = memoryStore([sheet]);
  const { input, strip, box, setTarget } = mount({ store, mode: "subject" });
  type(input, "forgiveness");
  await until(() => strip("subject"));
  setTarget({ id: sheet.id, name: "Mercy", ready: () => {} });
  const add = strip("subject").querySelector(".desk-search__sheet--add");
  assert.equal(add.hidden, false);
  assert.equal(add.getAttribute("aria-label"), "Add checked chapters to “Mercy”");
  const row = box("subject", "Luke 15")[0].closest(".desk-search__row");
  const plus = row.querySelector(".desk-search__add");
  assert.equal(plus.getAttribute("aria-label"), "Add Luke 15 to the sheet");
  assert.equal(plus.hidden, false);
  click(plus);
  await until(() => store.writes.length);
  assert.deepEqual(passagesOf(store.writes[0].sheet), [["luke", 15, 1, 32]]);
});

test("E166: under all types the verses and the chapters keep their own checks and strips", async () => {
  const { input, strip, line, box } = mount();
  type(input, "forgiveness");
  await until(() => strip("subject") && strip("keyword"));
  const ids = [strip("subject"), strip("keyword")].map((s) => s.querySelector(".desk-search__pick-line").id);
  assert.notEqual(ids[0], ids[1], "each strip's line has its own id, which its buttons name");
  toggle(box("keyword", "Luke 15:2")[0], true);
  assert.equal(line("keyword"), "1 of 2 checked.");
  assert.equal(line("subject"), "Check the chapters you want, or check all 3.", "a verse's check is not a chapter's");
  toggle(box("subject", "Luke 15")[0], true);
  assert.equal(line("subject"), "1 of 3 checked.");
  assert.equal(box("keyword", "Luke 15:2")[0].checked, true);
  click(strip("subject").querySelector(".desk-search__pick-clear"));
  assert.equal(line("subject"), "Check the chapters you want, or check all 3.");
  assert.equal(line("keyword"), "1 of 2 checked.", "Clear checks clears its own group");
});

test("E166: an emptied box forgets the checks, as /search does, so the same search starts fresh", async () => {
  const { input, strip, line, box } = mount({ mode: "subject" });
  type(input, "forgiveness");
  await until(() => strip("subject"));
  toggle(box("subject", "Luke 15")[0], true);
  type(input, "");
  await until(() => !strip("subject"));
  type(input, "forgiveness");
  await until(() => strip("subject"));
  assert.equal(line("subject"), "Check the chapters you want, or check all 3.");
});

test("E166: one word finds the topics that hold it, as /search does, and each row names them", async () => {
  const store = memoryStore();
  const { $$, input, strip, box } = mount({ store, mode: "subject" });
  type(input, "debt");
  await until(() => strip("subject"));
  const rows = $$("[data-group='subject'] .desk-search__row");
  assert.equal(rows.length, 2, "Luke 4 and Matthew 18, the second once though under two topics");
  const topicsOf = (label) => box("subject", label)[0].closest(".desk-search__row").querySelector(".desk-search__topics")?.textContent;
  assert.equal(topicsOf("Luke 4"), " · Debt release");
  assert.equal(topicsOf("Matthew 18"), " · Debt release, Forgiving debt");
  toggle(box("subject", "Luke 4")[0], true);
  toggle(box("subject", "Matthew 18")[0], true);
  click(strip("subject").querySelector(".desk-search__sheet--new"));
  await until(() => store.writes.length);
  assert.equal(store.writes[0].sheet.title, "Debt release", "the one topic both chapters carry");
});

test("E166: an exact topic's row doesn't repeat the query", async () => {
  const { $$, input, strip } = mount({ mode: "subject" });
  type(input, "forgiveness");
  await until(() => strip("subject"));
  assert.equal($$("[data-group='subject'] .desk-search__topics").length, 0);
});

test("E166: a topic's every chapter is found, past the 50 the pane used to stop at", async () => {
  const { input, strip } = mount({ mode: "subject" });
  type(input, "light");
  await until(() => strip("subject"));
  assert.equal(strip("subject").querySelector(".desk-search__check-all").getAttribute("aria-label"), "Check all 68 chapters");
});

test("E166: the book filter keeps one book's chapters by topic", async () => {
  const { pane, input, strip } = mount({ mode: "subject" });
  const bookSel = pane.el.querySelector("select[aria-label='Book']");
  assert.ok(bookSel, "the pane has a book filter");
  bookSel.value = "mark";
  bookSel.dispatchEvent(new window.Event("change", { bubbles: true }));
  type(input, "light");
  await until(() => strip("subject"));
  assert.equal(strip("subject").querySelector(".desk-search__check-all").getAttribute("aria-label"), "Check all 16 chapters");
});

// ---- the Greek ----

test("E166: the Greek's verses have a box per row, one check per verse, and the strip under the title", async () => {
  const { $, $$, input, strip, line, box } = mount({ desk: true });
  type(input, "ἐλευθερία");
  await until(() => strip("greek"), 1000);
  const group = $("[data-group='greek']");
  same(group.querySelector(".desk-search__group-title").nextElementSibling, strip("greek"), "under the title, above the word's line");
  const rows = $$("[data-group='greek'] .desk-search__row");
  assert.equal(rows.length, 11, "a row per word matched");
  assert.ok(rows.every((r) => r.querySelector(".desk-search__check[data-pick='greek']")), "a box on every row");
  const all = strip("greek").querySelector(".desk-search__check-all");
  assert.equal(all.getAttribute("aria-label"), "Check all 10 verses", "counted by verse: Galatians 5:13 has the word twice");
  const twice = box("greek", "Galatians 5:13");
  assert.equal(twice.length, 2);
  toggle(twice[0], true);
  assert.equal(twice[1].checked, true, "checking one row of a verse checks the other");
  assert.ok(twice[1].closest(".desk-search__row").classList.contains("desk-search__row--picked"));
  assert.equal(line("greek"), "1 of 10 checked.");
  toggle(twice[1], false);
  assert.equal(twice[0].checked, false);
  assert.equal(line("greek"), "Check the verses you want, or check all 10.");
});

test("E166: a new sheet of Greek verses is named for the word, and holds only the checked verses", async () => {
  const store = memoryStore();
  const { input, strip, box } = mount({ store, desk: true });
  type(input, "ἐλευθερία");
  await until(() => strip("greek"), 1000);
  toggle(box("greek", "Galatians 5:13")[0], true);
  toggle(box("greek", "Galatians 5:1")[0], true);
  toggle(box("greek", "Romans 8:21")[0], true);
  const fresh = strip("greek").querySelector(".desk-search__sheet--new");
  assert.equal(fresh.getAttribute("aria-label"), "New sheet of 3 verses");
  click(fresh);
  await until(() => store.writes.length);
  const { sheet } = store.writes[0];
  assert.equal(sheet.title, "Greek: “ἐλευθερία”");
  assert.deepEqual(passagesOf(sheet), [["romans", 8, 21, 21], ["galatians", 5, 1, 1], ["galatians", 5, 13, 13]]);
});

test("E166: Exact form only keeps the checks on verses the form is in, and names the sheet for the form", async () => {
  const store = memoryStore();
  const { $, input, strip, line, box } = mount({ store, desk: true });
  type(input, "ἐλευθερίαν");
  await until(() => strip("greek") && $(".desk-search__exact input"), 1000);
  toggle(box("greek", "Galatians 5:13")[0], true);
  toggle(box("greek", "2 Corinthians 3:17")[0], true);
  assert.equal(line("greek"), "2 of 10 checked.");
  toggle($(".desk-search__exact input"), true);
  await until(() => strip("greek") && !box("greek", "2 Corinthians 3:17").length, 1000);
  const total = Number(strip("greek").querySelector(".desk-search__check-all").getAttribute("aria-label").match(/\d+/)?.[0] ?? 1);
  assert.equal(line("greek"), `1 of ${total} checked.`, "2 Corinthians 3:17 has another form, so its check went");
  assert.equal(box("greek", "Galatians 5:13")[0].checked, true, "Galatians 5:13 has this form too, and kept its check");
  click(strip("greek").querySelector(".desk-search__sheet--new"));
  await until(() => store.writes.length);
  assert.equal(store.writes[0].sheet.title, "Greek: “ἐλευθερίαν”", "the form typed");
});

// ---- E167: the Greek rows' lines, and any sheet ----

test("E167: a Greek row shows a few words of its verse's Greek around the word and its parsing, and links its verse", async () => {
  const { $$, input, strip } = mount({ desk: true });
  type(input, "ἐλευθερία");
  await until(() => strip("greek"), 1000);
  const filled = (r) => r.querySelector(".desk-search__line[lang='grc']")?.hidden === false;
  const row = await until(() => $$("[data-group='greek'] .desk-search__row").find((r) => r.textContent.includes("Romans 8:21") && filled(r)), 1000);
  const greek = row.querySelector(".desk-search__line[lang='grc']");
  assert.equal(greek.querySelector("mark").textContent, "ἐλευθερίαν");
  assert.equal(greek.textContent, "… φθορᾶς εἰς τὴν ἐλευθερίαν τῆς δόξης τῶν …", "three words either side, and where it was cut");
  assert.equal(row.querySelector(".desk-search__greek-parse").textContent, " · noun, accusative feminine singular");
  // No line of the LIT: the verse's start isn't the words rendering this one
  // (BVJ, 2026-11-19). The reference is drawn as a link, and the row is one
  // ref-preview.js previews, so the LIT verse is a hover away.
  assert.equal(row.querySelectorAll(".desk-search__line").length, 1, "the Greek line only");
  assert.ok(row.classList.contains("desk-search__row--greek"), "the class that draws the reference as a link");
  const link = row.querySelector("a.desk-search__link");
  assert.match(link.getAttribute("href"), /^\/romans-8\b/, "the verse's own page, which the preview reads");
  assert.equal(link.querySelector(".desk-search__ref").textContent, "Romans 8:21");
});

test("E167: “Choose a sheet…” lists every sheet, adds the checked verses to the one picked, and shows it", async () => {
  const ctx = { client: "web/test", contentVersion: "v1" };
  const older = createSheet({ title: "Freedom", modules: [] }, { now: "2026-11-01T12:00:00.000Z", ...ctx });
  const newer = createSheet({ title: "Mercy", modules: [] }, { now: "2026-11-18T12:00:00.000Z", ...ctx });
  const store = memoryStore([older, newer]);
  const { input, strip, box, shown } = mount({ store, desk: true });
  type(input, "ἐλευθερία");
  await until(() => strip("greek"), 1000);
  const choose = strip("greek").querySelector(".desk-search__sheet--choose");
  assert.equal(choose.getAttribute("aria-label"), "Choose a sheet…");
  assert.equal(choose.getAttribute("aria-disabled"), "true", "nothing checked adds nothing");
  click(choose);
  await settle(20);
  assert.equal(document.querySelector(".desk-pick"), null, "and opens nothing");

  toggle(box("greek", "Galatians 5:1")[0], true);
  toggle(box("greek", "Romans 8:21")[0], true);
  assert.equal(choose.hasAttribute("aria-disabled"), false);
  click(choose);
  const win = await until(() => document.querySelector(".desk-pick"));
  const rows = [...win.querySelectorAll(".desk-pick__row")];
  assert.deepEqual(rows.map((b) => b.querySelector(".desk-pick__name").textContent), ["New sheet", "Mercy", "Freedom"], "New sheet first, then every sheet, newest first");
  click(rows.find((b) => b.textContent.includes("Freedom")));
  await until(() => store.writes.length);
  assert.equal(store.writes[0].sheet.id, older.id);
  assert.deepEqual(passagesOf(store.writes[0].sheet), [["romans", 8, 21, 21], ["galatians", 5, 1, 1]]);
  assert.deepEqual(shown, [older.id], "the sheet picked is shown, as a new one is");
  assert.equal(await until(() => document.querySelector(".desk-undo__text")?.textContent.match(/^Added .*/)?.[0]), "Added 2 passages to “Freedom.”");
});

test("E167: the window's New sheet makes one of the checked chapters, named as the strip's would be", async () => {
  const store = memoryStore();
  const { input, strip, box, shown } = mount({ store, mode: "subject" });
  type(input, "forgiveness");
  await until(() => strip("subject"));
  toggle(box("subject", "Luke 15")[0], true);
  click(strip("subject").querySelector(".desk-search__sheet--choose"));
  const win = await until(() => document.querySelector(".desk-pick"));
  assert.match(win.textContent, /Choose the sheet for the checked chapters\./);
  click(win.querySelector(".desk-pick__action"));
  await until(() => store.writes.length);
  const { sheet } = store.writes[0];
  assert.equal(sheet.title, "Forgiveness");
  assert.deepEqual(passagesOf(sheet), [["luke", 15, 1, 32]]);
  assert.deepEqual(shown, [sheet.id]);
});
