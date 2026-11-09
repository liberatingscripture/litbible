// The notebook list (kept-list.js) driven in a browser DOM (Audit 8, GF8b-8 and
// the review of its fix): a search typed while a full read is still in flight
// must not draw the older records and throw the newer read away.

import { test } from "node:test";
import assert from "node:assert/strict";
import { settle } from "./helpers/browser-env.mjs";
import { createRecord } from "../src/lib/desk-records.mjs";

const { createKeptList } = await import("../src/scripts/desk/kept-list.js");

const ctx = () => ({ now: "2026-11-09T12:00:00.000Z", client: "web/test", contentVersion: "v1" });
const note = (body, verse) =>
  createRecord("note", { bookKey: "john", chapter: 3, verse, endVerse: verse, body, marker: "note" }, ctx());

/** A store whose reads the test answers by hand, in any order. */
function heldStore() {
  const reads = [];
  return {
    reads,
    all: () => new Promise((resolve) => reads.push(resolve)),
    subscribe: () => () => {},
    lastEntry: () => null,
  };
}

const shownBodies = (list) => [...list.el.querySelectorAll("[data-id]")].map((row) => row.textContent);

test("a search typed while a read is in flight waits for that read, so a new note isn't dropped", async () => {
  const store = heldStore();
  const list = createKeptList({ store, ctx });
  document.body.append(list.el);

  const first = note("grace upon grace", 16);
  list.render();
  store.reads[0]([first]);
  await settle();
  assert.equal(shownBodies(list).length, 1);

  // A store change starts a full read; before it answers, the reader types a search.
  const added = note("grace and truth", 17);
  const full = list.render();
  list.setQuery("grace");
  const filtered = list.render({ reuse: true });
  assert.equal(store.reads.length, 2, "the filter reuses the read in flight rather than starting another");
  store.reads[1]([first, added]);
  await Promise.all([full, filtered]);
  await settle();

  const rows = shownBodies(list);
  assert.equal(rows.length, 2, "both notes are listed");
  assert.ok(rows.some((t) => t.includes("grace and truth")), "the note the newer read brought is shown");
});

test("a filter change with no read in flight redraws from the last read, without reading again", async () => {
  const store = heldStore();
  const list = createKeptList({ store, ctx });
  document.body.append(list.el);
  list.render();
  store.reads[0]([note("light", 19), note("darkness", 19)]);
  await settle();
  list.setQuery("light");
  await list.render({ reuse: true });
  assert.equal(store.reads.length, 1);
  assert.equal(shownBodies(list).length, 1);
});
