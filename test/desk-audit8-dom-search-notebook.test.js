// /notebook (notebook-page.js) driven in a browser DOM, on the real store over
// fake-indexeddb (Audit 8: GF8a-2, DK8-1, GF8a-10, SEC8-3). The page starts
// itself when imported, so each test imports a fresh copy (`?n=`) after
// building the markup it looks for.

import { test } from "node:test";
import assert from "node:assert/strict";
import { IDBFactory, IDBDatabase } from "fake-indexeddb";
import { settle, resetDom, window } from "./helpers/browser-env.mjs";

// An open channel keeps node alive; the stores here are never closed.
const RealChannel = globalThis.BroadcastChannel;
globalThis.BroadcastChannel = class extends RealChannel {
  constructor(name) {
    super(name);
    this.unref();
  }
};

// Every page instance adds a window hashchange listener that outlives it; an
// earlier test's would read (and strip) the next test's address, so they are
// dropped between tests.
const hashListeners = [];
const realAdd = window.addEventListener.bind(window);
window.addEventListener = (type, fn, ...rest) => {
  if (type === "hashchange") hashListeners.push(fn);
  return realAdd(type, fn, ...rest);
};

let n = 0;
async function until(fn, tries = 100) {
  for (let i = 0; i < tries; i++) {
    const v = fn();
    if (v) return v;
    await settle(10);
  }
  throw new Error("timed out waiting for the page");
}

async function openPage(url = "http://localhost/notebook/", { seed = [] } = {}) {
  globalThis.indexedDB = new IDBFactory();
  if (seed.length) {
    // Records already kept when the page opens, written through the real store.
    const { openStore } = await import(`../src/scripts/desk/store.js?seed=${n}`);
    const store = await openStore({ ctx: () => ({ client: "web/test", contentVersion: "v1" }) });
    await store.commit({ put: seed, remove: [] }, { record: false });
  }
  for (const fn of hashListeners.splice(0)) window.removeEventListener("hashchange", fn);
  resetDom(url);
  document.documentElement.dataset.contentVersion = "v1";
  document.body.innerHTML = `<h1 class="notebook-page__title">Notebook</h1><div data-notebook-page></div>`;
  await import(`../src/scripts/desk/notebook-page.js?n=${++n}`);
  await until(() => document.querySelector("[data-np-new-label]"));
  await settle(20);
}

const q = (sel) => document.querySelector(sel);
const click = (el) => el.dispatchEvent(new window.MouseEvent("click", { bubbles: true, cancelable: true }));
const submit = (form) => form.dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true }));
const key = (el, k, extra = {}) => el.dispatchEvent(new window.KeyboardEvent("keydown", { key: k, bubbles: true, cancelable: true, ...extra }));
const button = (box, text) => [...box.querySelectorAll("button")].find((b) => b.textContent === text);

async function addLabel(name) {
  q("#deskNpNewLabel").value = name;
  submit(q("[data-np-new-label]"));
  await until(() => [...document.querySelectorAll(".desk-np__label-name")].some((s) => s.textContent === name));
  await settle(20);
}

// The browser refusing a write (quota, a database closed by another tab).
function refuseWrites() {
  const real = IDBDatabase.prototype.transaction;
  IDBDatabase.prototype.transaction = function (stores, mode, ...rest) {
    if (mode === "readwrite") throw new Error("QuotaExceededError");
    return real.call(this, stores, mode, ...rest);
  };
  return () => (IDBDatabase.prototype.transaction = real);
}

const quiet = (fn) => async () => {
  const log = console.error;
  console.error = () => {};
  try {
    await fn();
  } finally {
    console.error = log;
  }
};

test("GF8a-2: a refused label write says so and changes nothing", quiet(async () => {
  await openPage();
  const restore = refuseWrites();
  try {
    q("#deskNpNewLabel").value = "Hope";
    submit(q("[data-np-new-label]"));
    await settle(50);
    const error = q("[data-np-label-error]");
    assert.equal(error.hidden, false);
    assert.match(error.textContent, /couldn’t be saved/);
    assert.equal(document.querySelectorAll(".desk-np__label").length, 0);
  } finally {
    restore();
  }
}));

test("GF8a-2: a refused \"Delete all notes and marks\" write says so and gives the confirm button back", quiet(async () => {
  await openPage();
  await addLabel("Hope");
  const box = q("[data-np-delete-box]");
  click(box.querySelector("button"));
  const yes = button(box, "Delete all notes and marks");
  assert.ok(yes, "the question is asked");
  const restore = refuseWrites();
  try {
    click(yes);
    await settle(50);
    const failed = box.querySelector(".desk-np__error");
    assert.equal(failed.hidden, false);
    assert.match(failed.textContent, /nothing was deleted/);
    assert.equal(yes.disabled, false, "asking again is possible");
    assert.equal(document.activeElement, yes);
    assert.equal(document.querySelectorAll(".desk-np__label").length, 1, "the label is still there");
  } finally {
    restore();
  }
}));

test("GF8a-2: a refused \"Empty the trash now\" write says so and gives the confirm button back", quiet(async () => {
  await openPage();
  await addLabel("Hope");
  // Move it to the trash, so there is something to empty.
  const del = q("[data-np-delete-box]");
  click(del.querySelector("button"));
  click(button(del, "Delete all notes and marks"));
  await until(() => q("[data-np-trash-box] button")?.textContent === "Empty the trash now…");
  const box = q("[data-np-trash-box]");
  click(box.querySelector("button"));
  const yes = button(box, "Empty the trash now");
  const restore = refuseWrites();
  try {
    click(yes);
    await settle(50);
    const failed = box.querySelector(".desk-np__error");
    assert.equal(failed.hidden, false);
    assert.match(failed.textContent, /nothing was wiped/);
    assert.equal(yes.disabled, false);
  } finally {
    restore();
  }
}));

async function startRename(name) {
  await addLabel(name);
  click(q(".desk-np__label .desk-item__edit"));
  const input = q(".desk-np__rename input");
  assert.ok(input);
  assert.equal(document.activeElement, input);
  return input;
}

test("DK8-1: Enter in the rename field saves and closes the form, focus back on Rename", async () => {
  await openPage();
  const input = await startRename("Hope");
  input.value = "Faith";
  submit(q(".desk-np__rename"));
  await until(() => !q(".desk-np__rename"));
  assert.equal(q(".desk-np__label-name").textContent, "Faith");
  await settle(20);
  assert.equal(document.activeElement, q(".desk-np__label .desk-item__edit"));
});

test("DK8-1: Escape cancels the rename and the form goes away", async () => {
  await openPage();
  const input = await startRename("Hope");
  input.value = "Faith";
  key(input, "Escape");
  await until(() => !q(".desk-np__rename"));
  assert.equal(q(".desk-np__label-name").textContent, "Hope");
  await settle(20);
  assert.equal(document.activeElement, q(".desk-np__label .desk-item__edit"));
});

test("GF8a-10: Escape that ends a composition leaves the rename form open", async () => {
  await openPage();
  const input = await startRename("Hope");
  key(input, "Escape", { isComposing: true });
  await settle(50);
  assert.ok(q(".desk-np__rename"), "still open");
  key(input, "Escape");
  await until(() => !q(".desk-np__rename"));
});

test("SEC8-3: a #q= address fills the search and is stripped, and a later hashchange filters the list", async () => {
  await openPage("http://localhost/notebook/#q=grace%20%26%20peace");
  const field = () => q("input[type=search]");
  assert.ok(field(), "the search field is drawn");
  assert.equal(field().value, "grace & peace");
  assert.equal(window.location.hash, "", "the words are out of the address");
  assert.equal(window.location.search, "");

  window.happyDOM.setURL("http://localhost/notebook/#q=mercy");
  window.dispatchEvent(new window.Event("hashchange"));
  await settle(50);
  assert.equal(field().value, "mercy");
  assert.equal(window.location.hash, "");
});

test("SEC8-3: an older ?q= link is still read and stripped", async () => {
  await openPage("http://localhost/notebook/?q=light");
  assert.equal(q("input[type=search]").value, "light");
  assert.equal(window.location.search, "");
});

/* ── Delete in bulk: marks and sheets apart (Audit 8 decision 8) ── */

const { createRecord } = await import("../src/lib/desk-records.mjs");
const { createSheet } = await import("../src/lib/desk-sheets.mjs");
const seedCtx = { now: "2026-11-09T12:00:00.000Z", client: "web/test", contentVersion: "v1" };
const aSheet = () => createSheet({ title: "Advent study" }, seedCtx);
const aNote = () => createRecord("note", { bookKey: "john", chapter: 3, verse: 16, endVerse: 16, body: "grace", marker: "note" }, seedCtx);
const liveKinds = async () => {
  const { openStore } = await import(`../src/scripts/desk/store.js?check=${n}`);
  const store = await openStore({ ctx: () => ({ client: "web/test", contentVersion: "v1" }) });
  return (await store.all()).filter((r) => r.kind !== "trash").map((r) => r.kind).sort();
};

test("decision 8: \"Delete all notes and marks\" trashes notes and labels and leaves the sheets", async () => {
  await openPage(undefined, { seed: [aSheet(), aNote()] });
  await addLabel("Hope");
  const box = q("[data-np-delete-box]");
  assert.equal(box.querySelector("button").textContent, "Delete all notes and marks…");
  click(box.querySelector("button"));
  assert.match(box.querySelector(".desk-np__ask-text").textContent, /2 items/);
  click(button(box, "Delete all notes and marks"));
  await until(() => box.querySelector(".desk-np__none"));
  assert.deepEqual(await liveKinds(), ["sheet"]);
  assert.equal(q("[data-np-delete-sheets-box] button").textContent, "Delete all sheets…", "the sheets can still be deleted");
});

test("decision 8: \"Delete all sheets\" trashes the sheets and leaves the marks", async () => {
  await openPage(undefined, { seed: [aSheet(), aSheet(), aNote()] });
  const box = q("[data-np-delete-sheets-box]");
  click(box.querySelector("button"));
  assert.match(box.querySelector(".desk-np__ask-text").textContent, /2 sheets/);
  click(button(box, "Delete all sheets"));
  await until(() => box.querySelector(".desk-np__none"));
  assert.equal(box.querySelector(".desk-np__none").textContent, "There are no sheets to delete.");
  assert.deepEqual(await liveKinds(), ["note"]);
});
