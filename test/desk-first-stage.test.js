// test/desk-first-stage.test.js
//
// The desk's first stage (Audit 3, LG3-2): what makes the shell load at once,
// the look at the notebook (against fake-indexeddb, with the real store.js
// beside it), how a menu that gets its rows late is moved, and that a stage
// two that fails to load or start stands the page down.

import { test } from "node:test";
import assert from "node:assert/strict";
import { IDBFactory, IDBKeyRange } from "fake-indexeddb";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  CHANNEL,
  DB_NAME,
  FOLLOW_KEY,
  LOAD_PARAMS,
  RECORDS,
  grownPanelShift,
  loadAtOnce,
  loadStageTwo,
  peekNotebook,
} from "../src/lib/desk-first-stage.mjs";
import { CHANNEL as STORE_CHANNEL } from "../src/lib/desk-store-core.mjs";
import { FOLLOW_FLAG_KEY } from "../src/lib/desk-bookmarks.mjs";
import { PRINT_PARAM } from "../src/lib/desk-print-notes.mjs";
import { createRecord } from "../src/lib/desk-records.mjs";

// An open channel keeps node alive; the stores here are never closed.
const RealChannel = globalThis.BroadcastChannel;
globalThis.BroadcastChannel = class extends RealChannel {
  constructor(name) {
    super(name);
    this.unref();
  }
};
Object.defineProperty(globalThis, "navigator", {
  configurable: true,
  value: { storage: { persisted: async () => true, persist: async () => true } },
});
const store = await import("../src/scripts/desk/store.js");

const ctx = () => ({ client: "web/2026.11", contentVersion: "v20261107.1" });
let n = 0;
const note = (extra = {}) =>
  createRecord(
    "note",
    { body: "mine", marker: "note", bookKey: "romans", chapter: 8, verse: 3, ...extra },
    { ...ctx(), now: "2026-11-07T12:00:00.000Z", id: `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}` },
  );

const peek = (idb, where) => peekNotebook({ idb, KeyRange: IDBKeyRange, where });

test("the first stage names the store's database, channel, follow flag and print parameter", () => {
  assert.equal(DB_NAME, store.DB_NAME);
  assert.equal(RECORDS, store.RECORDS);
  assert.equal(CHANNEL, STORE_CHANNEL);
  assert.equal(FOLLOW_KEY, FOLLOW_FLAG_KEY);
  assert.ok(LOAD_PARAMS.includes(PRINT_PARAM));
});

test("the shell loads at once only when the Notebook starts expanded, a bookmark follows, or the address asks", () => {
  const session = (v = null) => () => v;
  const params = (q = "") => new URLSearchParams(q);
  const min = { open: true, minimized: true };
  assert.equal(loadAtOnce({ start: min, session: session(), params: params() }), null);
  assert.equal(loadAtOnce({ start: { open: false, minimized: true }, session: session(), params: params() }), null);
  assert.equal(loadAtOnce({ start: { open: true, minimized: false }, session: session(), params: params() }), "expanded");
  assert.equal(loadAtOnce({ start: min, session: session('{"id":"r1"}'), params: params() }), "following");
  assert.equal(loadAtOnce({ start: min, session: session(), params: params("greek=16.7") }), "param:greek");
  assert.equal(loadAtOnce({ start: min, session: session(), params: params("desk-tour") }), "param:desk-tour");
  assert.equal(loadAtOnce({ start: min, session: session(), params: params("print=notes") }), "param:print");
  // Closed and expanded can't both be: closed waits like minimized.
  assert.equal(loadAtOnce({ start: { open: false, minimized: false }, session: session(), params: params() }), null);
});

test("a browser that has kept nothing has nothing to draw, and the look leaves no database behind", async () => {
  const idb = new IDBFactory();
  globalThis.indexedDB = idb;
  assert.equal(await peek(idb, { bookKey: "romans", chapter: 8 }), false);
  assert.deepEqual(await idb.databases(), [], "no empty database was made");
  // The store's own open still creates its tables (an empty database at
  // version 1 would have skipped the upgrade and left it with none).
  const s = await store.openStore({ ctx });
  await s.save(note());
  assert.equal((await s.byChapter("romans", 8)).length, 1);
});

test("the look finds this chapter's records in Chapter View and the book's in Read View", async () => {
  const idb = new IDBFactory();
  globalThis.indexedDB = idb;
  const s = await store.openStore({ ctx });
  await s.save(note({ chapter: 8 }));
  assert.equal(await peek(idb, { bookKey: "romans", chapter: 8 }), true);
  assert.equal(await peek(idb, { bookKey: "romans", chapter: 9 }), false, "another chapter");
  assert.equal(await peek(idb, { bookKey: "john", chapter: 8 }), false, "another book");
  assert.equal(await peek(idb, { bookKey: "romans" }), true, "Read View: the book");
  assert.equal(await peek(idb, { bookKey: "roman" }), false, "a book key that is a prefix isn't the book");
  assert.equal(await peek(idb, { bookKey: "1john" }), false);
  assert.equal(await peek(idb, null), false, "a page that draws no records");
});

test("a sheet or a label, which sit on no chapter, draws nothing on a reading page", async () => {
  const idb = new IDBFactory();
  globalThis.indexedDB = idb;
  const s = await store.openStore({ ctx });
  await s.save(createRecord("label", { name: "Advent" }, { ...ctx(), now: "2026-11-07T12:00:00.000Z" }));
  assert.equal(await peek(idb, { bookKey: "romans", chapter: 8 }), false);
  assert.equal(await peek(idb, { bookKey: "romans" }), false);
});

test("a look that can't tell says so, and the shell is loaded", async () => {
  // A database of that name without the store's tables.
  const idb = new IDBFactory();
  await new Promise((resolve, reject) => {
    const open = idb.open(DB_NAME, 1);
    open.onsuccess = () => {
      open.result.close();
      resolve();
    };
    open.onerror = () => reject(open.error);
  });
  assert.equal(await peek(idb, { bookKey: "romans", chapter: 8 }), null);
  // A factory that throws, and one that never answers.
  assert.equal(await peek({ open() { throw new Error("SecurityError"); } }, { bookKey: "romans", chapter: 8 }), null);
  const silent = { open: () => ({}) };
  assert.equal(await peekNotebook({ idb: silent, KeyRange: IDBKeyRange, where: { bookKey: "romans", chapter: 8 }, timeout: 20 }), null);
});

test("a menu that grows after it was placed keeps clear of what it sat above, and inside the window", () => {
  const box = (top, height) => ({ top, bottom: top + height });
  const vn = (top) => box(top, 20); // a verse number
  // Above its verse number (at 500): it grows upward.
  assert.equal(grownPanelShift({ before: box(300, 180), after: box(300, 260), trigger: vn(500), viewport: 900 }), -80);
  // Below it: it stays, growing downward.
  assert.equal(grownPanelShift({ before: box(528, 180), after: box(528, 260), trigger: vn(500), viewport: 900 }), 0);
  // Below, but now past the window's foot: up only as far as needed.
  assert.equal(grownPanelShift({ before: box(600, 180), after: box(600, 320), trigger: vn(500), viewport: 900 }), -32);
  // Above, with no room left above: below the verse number, as showPanel would put it
  // (seen live: John 3's first verse menu, 182px growing to 457).
  assert.equal(grownPanelShift({ before: box(125, 182), after: box(125, 457), trigger: vn(315), viewport: 900 }), 315 + 20 + 8 - 125);
  // No room above or below: its top wins.
  assert.equal(grownPanelShift({ before: box(40, 180), after: box(40, 700), trigger: vn(240), viewport: 900 }), -28);
  // Nothing grew, or no trigger to measure.
  assert.equal(grownPanelShift({ before: box(300, 180), after: box(300, 180), trigger: vn(500), viewport: 900 }), 0);
  assert.equal(grownPanelShift({ before: box(300, 180), after: box(300, 260), trigger: null, viewport: 900 }), 0);
});

// What the first stage downloads, by its static imports (a `?inline`
// stylesheet counted as its file).
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const STATIC_IMPORT = /^\s*(?:import|export)\s[^;]*?\sfrom\s+["'](\.[^"']+)["']|^\s*import\s+["'](\.[^"']+)["']/gm;
function staticClosure(entry) {
  const seen = new Set();
  const walk = (file) => {
    const rel = relative(root, file).replaceAll("\\", "/");
    if (seen.has(rel)) return;
    seen.add(rel);
    if (!/\.m?js$/.test(file)) return;
    for (const m of readFileSync(file, "utf8").matchAll(STATIC_IMPORT)) {
      const to = join(dirname(file), (m[1] ?? m[2]).replace(/\?.*$/, ""));
      if (existsSync(to)) walk(to);
    }
  };
  walk(join(root, entry));
  return seen;
}

test("the first stage carries the tab's stylesheet and none of the shell, the store or desk.css", () => {
  const first = staticClosure("src/scripts/desk/first-stage.js");
  for (const f of [
    "src/scripts/desk/shell.js", "src/scripts/desk/panel.js", "src/scripts/desk/store.js", "src/scripts/desk/boot.js",
    "src/scripts/desk/history.js", "src/scripts/desk/page.js", "src/scripts/desk/note-sources.js",
    "src/styles/desk.css", "src/lib/desk-store-core.mjs", "src/lib/desk-records.mjs",
  ]) {
    assert.ok(!first.has(f), `the first stage reaches ${f}`);
  }
  // The Display tray's Notebook switches are the first stage's (BVJ, 2026-11-07).
  assert.ok(first.has("src/scripts/desk/note-settings.js"));
  assert.ok(first.has("src/styles/desk-tab.css"));
  // The tab's rules live in desk-tab.css alone, so the first stage's tab is
  // styled and the shell's arrival restyles nothing.
  const tabCss = readFileSync(join(root, "src/styles/desk-tab.css"), "utf8");
  const deskCss = readFileSync(join(root, "src/styles/desk.css"), "utf8");
  assert.match(tabCss, /\.desk-rail--collapsed \.desk-tab \{/);
  assert.doesNotMatch(deskCss, /\.desk-tab[\s:{.,_]|\.desk-rail[\s{[]/);
  // And the shell adds it too, for a page that skipped the first stage's tab.
  assert.ok(staticClosure("src/scripts/desk/shell.js").has("src/styles/desk-tab.css"));
});

test("what the first stage draws is styled by what it loads: the skip link, the tray's hint and Reset widths (Audit 6, NB6-1, NB6-4)", () => {
  const read = (p) => readFileSync(join(root, p), "utf8");
  const tabCss = read("src/styles/desk-tab.css");
  const deskCss = read("src/styles/desk.css");
  // The link carries the attribute its hiding rule keys on, and the rule is in the stylesheet stage one loads.
  assert.match(read("src/scripts/desk/first-stage.js"), /skip\.setAttribute\("data-desk-skip", ""\)/);
  assert.match(tabCss, /html\[data-desk-show="off"\] \.skip-link\[data-desk-skip\] \{/);
  assert.doesNotMatch(deskCss, /\.skip-link\[data-desk-skip\]/);
  for (const cls of ["font-tray__hint", "font-tray__reset"]) {
    assert.match(tabCss, new RegExp(`\.${cls} \{`));
    assert.doesNotMatch(deskCss, new RegExp(`\.${cls}\b`));
  }
});

test("stage two that fails to load or to start stands the page down; one that starts doesn't", async () => {
  const quiet = console.error;
  console.error = () => {};
  try {
    let stood = 0;
    const stand = () => { stood += 1; };
    assert.equal(await loadStageTwo(() => Promise.reject(new Error("offline")), { stand }), null);
    assert.equal(stood, 1, "the import failed");
    assert.equal(await loadStageTwo(() => { throw new Error("sync"); }, { stand }), null);
    assert.equal(stood, 2, "the importer threw");
    assert.equal(await loadStageTwo(async () => ({ startShell: async () => null }), { stand }), null);
    assert.equal(stood, 3, "the Notebook didn't come up");
    let handed = null;
    const api = { panel: {} };
    const handOver = () => {};
    assert.equal(await loadStageTwo(async () => ({ startShell: async (o) => { handed = o.handOver; return api; } }), { stand, handOver }), api);
    assert.equal(stood, 3);
    assert.equal(handed, handOver, "the shell is given the hand-over");
  } finally {
    console.error = quiet;
  }
});
