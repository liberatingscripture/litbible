// One sheet per record on a collection's page (BVJ, 2026-11-20): members as
// the sheet editor's modules, a run per kind (E192), Bible order's nesting
// (E193), the group labels' type (E195), My order's gap pills (E196), a
// pinned footnote cut at three lines (E199), the moves' tooltips (E200),
// Bring back keeping its place (E201), the column's marker (E207), and the
// passage form's "It's also inside" (E194). Driven through the real page over
// fake-indexeddb, as test/desk-collections-page.test.js is.

import { test } from "node:test";
import assert from "node:assert/strict";
import { settle } from "./helpers/browser-env.mjs";
import { IDBFactory, IDBKeyRange } from "fake-indexeddb";
import { createRecord } from "../src/lib/desk-records.mjs";
import { addItems, addRule, createCollection, passageMember } from "../src/lib/desk-collections.mjs";
import { planSave } from "../src/lib/desk-store-core.mjs";
import { assembleChapter } from "../src/lib/anchor-core.mjs";

globalThis.indexedDB = new IDBFactory();
globalThis.IDBKeyRange = IDBKeyRange;
const RealChannel = globalThis.BroadcastChannel;
globalThis.BroadcastChannel = class extends RealChannel {
  constructor(name) {
    super(name);
    this.unref?.();
  }
};

const { mountCollectionsPage } = await import("../src/scripts/desk/collections/collection-page.js");
const { openStore } = await import("../src/scripts/desk/store.js");

const ctx = () => ({ client: "web/test", contentVersion: "v1" });
const opCtx = () => ({ now: new Date().toISOString(), ...ctx() });
let n = 0;
const make = (kind, fields) => createRecord(kind, fields, { ...opCtx(), id: `00000000-0000-4000-9000-${String(++n).padStart(12, "0")}` });

async function until(fn, ms = 3000, what = "the condition") {
  const end = Date.now() + ms;
  while (!fn()) {
    if (Date.now() > end) throw new Error(`timed out waiting for ${what}`);
    await new Promise((r) => setTimeout(r, 10));
  }
}

const store = await openStore({ ctx });
const collections = async () => (await store.all()).filter((r) => r.kind === "collection" && !r.deleted);
const save = (record) => store.change(async () => planSave(record));

async function clearAll() {
  for (const r of await store.all()) await store.remove(r.id).catch(() => {});
}

async function mount(search = "") {
  for (const old of document.querySelectorAll("[data-test-root], .desk-pick")) old.remove();
  history.replaceState(null, "", `/collections/${search}`);
  const root = document.createElement("div");
  root.dataset.testRoot = "";
  document.body.append(root);
  const page = await mountCollectionsPage(root, {
    store,
    ctx,
    base: "/",
    chapterText: async () => luke1,
    passageText: async () => "My soul magnifies the Lord.",
    parse: (raw) => {
      const m = /^luke (\d+):(\d+)(?:-(\d+))?$/i.exec(raw.trim());
      return m ? { bookKey: "luke", chapter: Number(m[1]), verse: Number(m[2]), endVerse: m[3] ? Number(m[3]) : undefined } : null;
    },
  });
  return { root, page };
}

// Luke 1:1–56, one short line a verse, so the passage form can check what it adds.
const luke1 = assembleChapter(new Map(Array.from({ length: 56 }, (_, i) => [i + 1, `Verse ${i + 1} of Luke 1.`])));

const byText = (root, sel, text) => [...root.querySelectorAll(sel)].find((el) => el.textContent.trim() === text);

/** Luke 1:46–55, and inside it a note, a bookmark and a pinned footnote; a note on 1:56 that only touches it; a sheet. */
async function magnificat(order) {
  const note = make("note", { bookKey: "luke", chapter: 1, verse: 47, endVerse: 47, body: "My spirit rejoices", marker: "note" });
  const mark = make("bookmark", { bookKey: "luke", chapter: 1, verse: 50, endVerse: 50, label: "" });
  const pin = make("footnotePin", { bookKey: "luke", chapter: 1, verse: 48, endVerse: 48, footnote: "Lowliness: the word is the one used of a slave." });
  const across = make("note", { bookKey: "luke", chapter: 1, verse: 55, endVerse: 56, body: "Mary stays three months", marker: "note" });
  for (const r of [note, mark, pin, across]) await save(r);
  const passage = passageMember({ bookKey: "luke", chapter: 1, verse: 46, endVerse: 55 });
  let c = createCollection({ name: "Advent small group", members: [passage] }, opCtx());
  c = addItems(c, [note.id, mark.id, pin.id, across.id], opCtx());
  c = { ...c, order };
  await save(c);
  return { c, note, mark, pin, across, passage };
}

test("E192: each member is its own module, one run per kind, and the page marks its column (E207)", async () => {
  await clearAll();
  const { c } = await magnificat("type");
  const { root, page } = await mount(`?id=${c.id}`);
  await until(() => root.querySelectorAll(".collection-page__member").length === 5, 3000, "five members");
  const members = root.querySelector(".collection-page__members");
  assert.equal(members.classList.contains("v2-sheet"), false, "no one sheet under them all");
  const runs = [...members.querySelectorAll(".collection-page__run")];
  assert.deepEqual(
    runs.map((r) => r.querySelectorAll(":scope > .collection-page__member").length),
    [1, 2, 1, 1],
    "Passages, Notes (two), Highlights none, Bookmarks, Pinned footnotes",
  );
  assert.equal(root.querySelector("h1").dataset.collectionShown, c.id);
  page.destroy();
});

test("E195: the group labels are the notebook's small headings", async () => {
  await clearAll();
  const { c } = await magnificat("type");
  const { root, page } = await mount(`?id=${c.id}`);
  await until(() => root.querySelector(".collection-page__group"), 3000, "a group label");
  const labels = [...root.querySelectorAll(".collection-page__group")];
  assert.ok(labels.every((h) => h.tagName === "H2" && h.classList.contains("desk-np__h3")));
  assert.deepEqual(
    labels.map((h) => h.textContent),
    ["Passages", "Notes", "Bookmarks", "Pinned footnotes"],
  );
  page.destroy();
});

test("E193: in Bible order a record wholly inside a passage nests on its sheet; one that runs past stands alone", async () => {
  await clearAll();
  const { c, passage } = await magnificat("bible");
  const { root, page } = await mount(`?id=${c.id}`);
  await until(() => root.querySelector(".collection-page__nested"), 3000, "the nested list");
  const host = root.querySelector(`[data-row-key="${passage.id}"]`);
  const nested = [...host.querySelectorAll(".collection-page__nested > [data-row-key]")];
  assert.equal(nested.length, 3, "the note, the bookmark and the pin");
  const bookmarkRow = nested.find((li) => /Bookmark/.test(li.querySelector(".desk-item__kind")?.textContent ?? ""));
  assert.ok(bookmarkRow, "the bookmark is among them");
  assert.equal(bookmarkRow.querySelector(".desk-sheet__words"), null, "a nested bookmark drops its words");
  const acrossRow = [...root.querySelectorAll(".collection-page__members [data-row-key]")].find(
    (li) => li.querySelector(".desk-item__body, .desk-note__body")?.textContent.includes("Mary stays") || li.textContent.includes("Mary stays"),
  );
  assert.ok(acrossRow, "the note across 55–56 is drawn");
  assert.equal(acrossRow.closest(".collection-page__nested"), null, "a partial overlap stands alone");
  assert.ok(acrossRow.classList.contains("collection-page__member"));
  assert.equal(root.querySelector(".collection-page__group"), null, "no group label without a Sheets group above");
  // By type never nests.
  const type = [...root.querySelectorAll(".desk-seg__input")].find((i) => i.value === "type");
  type.checked = true;
  type.dispatchEvent(new Event("change", { bubbles: true }));
  await until(() => !root.querySelector(".collection-page__nested"), 3000, "By type to draw flat");
  assert.equal((await collections())[0].order, "type");
  page.destroy();
});

test("E199: a pinned footnote is cut at three lines with a caret, as a passage's words are", async () => {
  await clearAll();
  const { c } = await magnificat("type");
  const { root, page } = await mount(`?id=${c.id}`);
  await until(() => root.querySelector(".desk-item__pin-row"), 3000, "the pin's row");
  const row = [...root.querySelectorAll(".collection-page__member")].find((li) => li.textContent.includes("Lowliness"));
  assert.ok(row, "the pinned footnote's row");
  assert.ok(row.querySelector(".desk-item__pin-row .desk-item__more"), "a caret beside it");
  assert.equal(row.querySelector(".desk-np-row__pin"), null, "not the notebook's own clamp");
  assert.match(row.querySelector(".desk-item__more").getAttribute("aria-label"), /^Show (all|less) of the pinned footnote on Luke 1:48$/);
  page.destroy();
});

test("E196, E200: My order puts a “+ Heading” pill in every gap, one Tab stop, and the arrows name Alt", async () => {
  await clearAll();
  const { c } = await magnificat("mine");
  const { root, page } = await mount(`?id=${c.id}`);
  await until(() => root.querySelectorAll(".collection-page__member").length === 5, 3000, "five members");
  const pills = [...root.querySelectorAll(".desk-sheet__after-btn")];
  assert.equal(pills.length, 6, "one above the first row and one under each");
  assert.equal(pills.filter((p) => p.tabIndex === 0).length, 1, "one Tab stop");
  assert.deepEqual(
    pills.map((p) => p.textContent),
    Array(6).fill("+ Heading"),
  );
  assert.equal(pills[0].getAttribute("aria-label"), "Add a heading at the top");
  const up = root.querySelector('[data-focus-key^="up-"]');
  assert.equal(up.dataset.tip, "Move up (Alt+↑)");
  assert.equal(root.querySelector('[data-focus-key^="down-"]').dataset.tip, "Move down (Alt+↓)");

  // The arrow keys move among the pills.
  pills[0].focus();
  pills[0].dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
  assert.equal(document.activeElement === pills[1], true);

  // The second pill (under the passage) opens a field there; Add puts the heading after the passage.
  const firstKey = root.querySelector(".collection-page__members [data-row-key]").dataset.rowKey;
  pills[1].click();
  await until(() => root.querySelector('[data-focus-key="gap-input"]'), 3000, "the gap's field");
  const title = root.querySelector(".collection-page__gap-form .desk-sheet__insert-title").textContent;
  assert.match(title, /^Add a heading after /);
  const input = root.querySelector('[data-focus-key="gap-input"]');
  input.value = "Week 1: Hope";
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.closest("form").requestSubmit();
  await until(() => root.querySelector(".collection-page__heading"), 3000, "the heading");
  const saved = (await collections())[0];
  const at = saved.members.findIndex((m) => m.type === "heading");
  assert.equal(saved.members[at - 1].id, firstKey, "right after the first row");
  assert.equal(saved.members[at].text, "Week 1: Hope");
  page.destroy();
});

test("E201: Bring back puts a left-out bookmark back where it was, after a reload too", async () => {
  await clearAll();
  const advent = make("label", { name: "Advent" });
  await save(advent);
  const marks = [];
  for (const verse of [1, 2, 3]) {
    const b = make("bookmark", { bookKey: "luke", chapter: 1, verse, endVerse: verse, label: "", labels: [advent.id] });
    await save(b);
    marks.push(b);
  }
  let c = createCollection({ name: "Labeled", members: [] }, opCtx());
  c = addItems(c, marks.map((b) => b.id), opCtx());
  c = addRule(c, advent.id, [advent, ...marks], opCtx());
  c = { ...c, order: "mine" };
  await save(c);
  const before = c.members.map((m) => m.id);
  const { root, page } = await mount(`?id=${c.id}`);
  await until(() => root.querySelectorAll(".collection-page__member").length === 3, 3000, "three bookmarks");
  const middle = root.querySelector(`[data-focus-key="remove-${c.members[1].id}"]`);
  assert.ok(middle, "the middle bookmark's Leave it out");
  middle.click();
  await until(() => byText(root, "a, button", "Bring back Luke 1:2"), 3000, "Bring back");
  const out = (await collections())[0];
  assert.equal(out.members.length, 3, "two items and the rule");
  assert.deepEqual(Object.keys(out.members.find((m) => m.type === "rule").exceptAt), [marks[1].id], "the rule keeps the place");
  // A reload: the page drawn afresh from the notebook.
  page.destroy();
  const again = await mount(`?id=${c.id}`);
  await until(() => byText(again.root, "a, button", "Bring back Luke 1:2"), 3000, "Bring back, after the reload");
  byText(again.root, "a, button", "Bring back Luke 1:2").click();
  await settle();
  await until(() => again.root.querySelectorAll(".collection-page__member").length === 3, 3000, "three again");
  const back = (await collections())[0];
  assert.deepEqual(back.members.map((m) => m.id), before, "the same members in the same order");
  assert.equal("exceptAt" in back.members.find((m) => m.type === "rule"), false, "the place is forgotten");
  again.page.destroy();
});

test("E194: a passage added inside one already there says so", async () => {
  await clearAll();
  const passage = passageMember({ bookKey: "luke", chapter: 1, verse: 46, endVerse: 55 });
  const c = createCollection({ name: "Magnificat", members: [passage] }, opCtx());
  await save(c);
  const { root, page } = await mount(`?id=${c.id}`);
  await until(() => byText(root, "button", "Add"), 3000, "Add ▾");
  byText(root, "button", "Add").click();
  byText(document, "[role=menuitem]", "Passage…").click();
  const input = root.querySelector('[data-focus-key="add-input"]');
  input.value = "Luke 1:54";
  input.closest("form").requestSubmit();
  await until(() => document.querySelector(".desk-undo")?.textContent.includes("Luke 1:54 added"), 3000, "the undo bar");
  assert.match(document.querySelector(".desk-undo").textContent, /Luke 1:54 added to Magnificat\. It’s also inside Luke 1:46–55\./);
  page.destroy();
});
