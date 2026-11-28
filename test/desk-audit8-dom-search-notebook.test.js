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

// Delete in bulk's refused writes (GF8a-2) are All settings' now:
// test/desk-settings-page.test.js.

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

/* ── What moved to All settings (Featherboa, Phase 4) ── */

test("NB-25 to NB-27: the start setting and Delete in bulk are gone from the page, and its last line says where they are", async () => {
  await openPage();
  for (const gone of ["#panel", "#delete-everything", "[data-np-start]", "[data-np-delete-box]", "[data-np-delete-sheets-box]", "[data-np-delete-collections-box]", "[data-np-trash-box]"]) {
    assert.equal(q(gone), null, `${gone} is gone`);
  }
  const jumps = [...document.querySelectorAll(".desk-np__jump a")].map((a) => a.getAttribute("href"));
  assert.deepEqual(jumps, ["#continue", "#kept", "#whats-new", "#labels", "#backup", "#trash"]);
  const moved = q("[data-np-moved]");
  assert.ok(moved, "the page says where they went");
  assert.equal(moved.querySelector("a").getAttribute("href"), "/settings/");
  assert.match(moved.textContent, /Delete in bulk \(“Empty the trash now” among its choices\)/);
  // Its last section is the Trash, with the line after it.
  const sections = [...document.querySelectorAll("[data-notebook-page] section")].map((s) => s.id);
  assert.equal(sections.at(-1), "trash");
});
