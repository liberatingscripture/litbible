// The "Labels…" popover (labels-ui.js) driven in a browser DOM (Audit 8,
// LG8-8): a checkbox per label that writes one change, a new-label field that
// makes the label and puts it on the record, errors said in place, and the
// popover closing with focus back on its button.

import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { settle } from "./helpers/browser-env.mjs";
import { createRecord } from "../src/lib/desk-records.mjs";

const { openLabelsPopover, labelsSubject } = await import("../src/scripts/desk/labels-ui.js");
const { closePanel } = await import("../src/scripts/lit-panel.js");

const ctx = () => ({ now: "2026-11-09T12:00:00.000Z", client: "web/test", contentVersion: "v1" });
let n = 0;
const id = () => `01J00000000000000000000${String(++n).padStart(3, "0")}`;
const label = (name) => createRecord("label", { name }, { ...ctx(), id: id() });
const note = () =>
  createRecord("note", { bookKey: "john", chapter: 3, verse: 16, endVerse: 16, body: "grace", marker: "note" }, { ...ctx(), id: id() });

/** A store over an array: change() runs the callback and applies the plan it returns, as the real one does. */
function fakeStore(records) {
  const listeners = new Set();
  const store = {
    records,
    writes: [],
    all: async () => [...store.records],
    subscribe: (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    listeners,
    async change(fn) {
      const plan = await fn({ get: async (rid) => store.records.find((r) => r.id === rid) ?? null, all: async () => [...store.records] });
      if (!plan) return;
      store.writes.push(plan);
      for (const r of plan.put) store.records = [...store.records.filter((x) => x.id !== r.id), r];
      for (const rid of plan.remove) store.records = store.records.filter((x) => x.id !== rid);
      for (const fn2 of listeners) fn2();
    },
  };
  return store;
}

let trigger;
beforeEach(() => {
  closePanel({ force: true });
  document.body.replaceChildren();
  trigger = document.createElement("button");
  trigger.textContent = "Labels…";
  document.body.append(trigger);
});

const boxes = (panel) => [...panel.querySelectorAll("input[type=checkbox]")];
const rowsText = (panel) => boxes(panel).map((b) => b.parentElement.textContent);

test("it opens focused, names the record, lists the labels, and ticks the ones on the record", async () => {
  const a = label("Grace");
  const b = label("Hope");
  const rec = { ...note(), labels: [b.id] };
  const store = fakeStore([a, b, rec]);
  const panel = await openLabelsPopover({ trigger, store, ctx, recordId: rec.id, name: "note on John 3:16" });
  assert.ok(document.body.contains(panel));
  assert.equal(document.activeElement, panel);
  assert.equal(panel.querySelector(".desk-labels__for").textContent, "note on John 3:16");
  assert.deepEqual(rowsText(panel), ["Grace", "Hope"]);
  assert.deepEqual(boxes(panel).map((x) => x.checked), [false, true]);
});

test("with no labels yet it says so instead of showing an empty list", async () => {
  const rec = note();
  const panel = await openLabelsPopover({ trigger, store: fakeStore([rec]), ctx, recordId: rec.id });
  assert.equal(panel.querySelector(".desk-labels__none").hidden, false);
  assert.equal(panel.querySelector(".desk-labels__list").hidden, true);
});

test("ticking a box commits one change that puts the label on the record; unticking takes it off", async () => {
  const a = label("Grace");
  const rec = note();
  const store = fakeStore([a, rec]);
  const panel = await openLabelsPopover({ trigger, store, ctx, recordId: rec.id });
  const box = boxes(panel)[0];
  box.checked = true;
  box.dispatchEvent(new window.Event("change", { bubbles: true }));
  await settle();
  assert.equal(store.writes.length, 1);
  assert.deepEqual(store.writes[0].put.map((r) => r.id), [rec.id]);
  assert.deepEqual(store.records.find((r) => r.id === rec.id).labels, [a.id]);

  const again = boxes(panel)[0];
  again.checked = false;
  again.dispatchEvent(new window.Event("change", { bubbles: true }));
  await settle();
  assert.deepEqual(store.records.find((r) => r.id === rec.id).labels ?? [], []);
});

test("a failed write puts the box back and says nothing changed", async () => {
  const a = label("Grace");
  const rec = note();
  const store = fakeStore([a, rec]);
  store.change = async () => { throw new Error("disk full"); };
  const realError = console.error;
  console.error = () => {};
  try {
    const panel = await openLabelsPopover({ trigger, store, ctx, recordId: rec.id });
    const box = boxes(panel)[0];
    box.checked = true;
    box.dispatchEvent(new window.Event("change", { bubbles: true }));
    await settle();
    assert.equal(box.checked, false);
    const error = panel.querySelector(".desk-labels__error");
    assert.equal(error.hidden, false);
    assert.match(error.textContent, /nothing changed/);
  } finally {
    console.error = realError;
  }
});

test("a new label name is made and put on the record in one write, and the field is cleared and kept in focus", async () => {
  const rec = note();
  const store = fakeStore([rec]);
  const panel = await openLabelsPopover({ trigger, store, ctx, recordId: rec.id });
  const input = panel.querySelector(".desk-labels__input");
  input.value = "Favorites";
  panel.querySelector(".desk-labels__new").dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true }));
  await settle();
  assert.equal(store.writes.length, 1, "one commit, so one Ctrl+Z");
  const made = store.records.find((r) => r.kind === "label");
  assert.equal(made.name, "Favorites");
  assert.deepEqual(store.records.find((r) => r.id === rec.id).labels, [made.id]);
  assert.equal(input.value, "");
  assert.equal(document.activeElement, input);
  // The list was redrawn from the notebook (the store told it of the change).
  assert.deepEqual(rowsText(panel), ["Favorites"]);
  assert.equal(boxes(panel)[0].checked, true);
});

test("an empty name says to type one and writes nothing", async () => {
  const rec = note();
  const store = fakeStore([rec]);
  const panel = await openLabelsPopover({ trigger, store, ctx, recordId: rec.id });
  panel.querySelector(".desk-labels__input").value = "   ";
  panel.querySelector(".desk-labels__new").dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true }));
  await settle();
  assert.equal(panel.querySelector(".desk-labels__error").textContent, "Type a name first.");
  assert.equal(store.writes.length, 0);
});

test("closing removes the popover, stops listening to the notebook, and gives focus back to the button", async () => {
  const rec = note();
  const store = fakeStore([rec]);
  const panel = await openLabelsPopover({ trigger, store, ctx, recordId: rec.id });
  assert.equal(store.listeners.size, 1);
  panel.querySelector(".lit-panel__close").click();
  assert.equal(document.body.contains(panel), false);
  assert.equal(store.listeners.size, 0);
  assert.equal(document.activeElement, trigger);
});

test("a record that has gone from the notebook closes the popover when it next redraws", async () => {
  const a = label("Grace");
  const rec = note();
  const store = fakeStore([a, rec]);
  const panel = await openLabelsPopover({ trigger, store, ctx, recordId: rec.id });
  store.records = [a];
  store.listeners.forEach((fn) => fn());
  await settle();
  assert.equal(document.body.contains(panel), false);
});

test("labelsSubject names the record by kind and reference", () => {
  assert.equal(labelsSubject({ kind: "note" }, "Romans 8:3"), "note on Romans 8:3");
  assert.equal(labelsSubject({ kind: "highlight" }, ""), "highlight");
});
