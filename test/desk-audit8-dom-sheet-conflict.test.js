// What the sheet editor shows when another tab works on its sheet, driven
// (Audit 8, LG8-8: cut from sheet-editor.js into sheets/sheet-conflict.js).
// The editor's side, with two real stores, is desk-audit8-dom-sheets-tabs.test.js.

import { test } from "node:test";
import assert from "node:assert/strict";
import { settle, resetDom } from "./helpers/browser-env.mjs";

const { askContinue, showConflict, clearConflict } = await import("../src/scripts/desk/sheets/sheet-conflict.js");
const { createSheet, makeModule } = await import("../src/lib/desk-sheets.mjs");

const buttonNamed = (root, name) => [...root.querySelectorAll("button")].find((b) => b.textContent === name);

test("askContinue: the question takes the editor's place, Continue resolves true, focus on it", async () => {
  resetDom();
  const content = document.body.appendChild(document.createElement("div"));
  const asked = askContinue({ content, idSuffix: "p1" });
  await settle(5);
  const group = content.querySelector('[role="group"]');
  assert.ok(group, "a labelled group");
  assert.equal(document.getElementById(group.getAttribute("aria-labelledby")).textContent, "This sheet is already open in another tab. Continue here?");
  const go = buttonNamed(content, "Continue");
  assert.equal(document.activeElement, go, "focus is on Continue");
  assert.match(document.getElementById(go.getAttribute("aria-describedby")).textContent, /show in the other/);
  go.click();
  assert.equal(await asked, true);
});

test("askContinue: Cancel and Escape resolve false", async () => {
  resetDom();
  const content = document.body.appendChild(document.createElement("div"));
  const viaCancel = askContinue({ content, idSuffix: "p1" });
  buttonNamed(content, "Cancel").click();
  assert.equal(await viaCancel, false);
  const viaEscape = askContinue({ content, idSuffix: "p1" });
  const e = new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true });
  buttonNamed(content, "Continue").dispatchEvent(e);
  assert.equal(await viaEscape, false);
  assert.equal(e.defaultPrevented, true);
});

/** A card with a question's two fields, as the editor builds one. */
function card() {
  const el = document.body.appendChild(document.createElement("div"));
  const after = el.appendChild(document.createElement("div"));
  after.className = "desk-sheet__after";
  const field = (html) => {
    let shown = html;
    return { setHtml: (h) => { shown = h; }, take: () => shown, shown: () => shown };
  };
  let focused = 0;
  return {
    el,
    name: "Question",
    conflict: null,
    theirs: null,
    inst: { fields: { html: field("<p>Mine</p>"), answer: field("<p>Same</p>") }, focus: () => { focused++; } },
    focused: () => focused,
  };
}

function host() {
  const changes = [];
  const said = [];
  const ctx = { now: "2026-11-10T00:00:00.000Z", client: "web/test", contentVersion: "v1" };
  const q = { ...makeModule("question", { html: "<p>Old</p>", answer: "<p>Same</p>" }), id: "q" };
  const sheet = createSheet({ title: "Study", modules: [q] }, ctx);
  return {
    changes, said, sheet,
    idSuffix: "p1",
    label: "Discuss",
    change: (op, opts) => changes.push({ after: op(structuredClone(sheet)), opts }),
    opCtx: () => ctx,
    say: (t) => said.push(t),
  };
}

test("showConflict: one line under the part, said once, before the gap's zone", () => {
  resetDom();
  const c = card();
  const h = host();
  const theirs = { id: "q", type: "question", html: "<p>Theirs</p>", answer: "<p>Same</p>" };
  showConflict(c, theirs, "tab", h);
  showConflict(c, { ...theirs, html: "<p>Theirs again</p>" }, "tab", h);
  const lines = c.el.querySelectorAll(".desk-sheet__conflict");
  assert.equal(lines.length, 1, "a later change only updates the version");
  assert.equal(c.theirs.html, "<p>Theirs again</p>");
  assert.equal(lines[0].nextElementSibling.className, "desk-sheet__after");
  assert.equal(document.getElementById(lines[0].getAttribute("aria-labelledby")).textContent, "Changed in another tab.");
  assert.deepEqual(h.said, ["Discuss: changed in another tab. Show that version, or keep yours."]);
  clearConflict(c);
  showConflict(c, theirs, "pane", host());
  assert.match(c.conflict.textContent, /Changed in another Sheets pane\./);
});

test("Keep mine writes only the fields that differ from the other version (SH8-2)", () => {
  resetDom();
  const c = card();
  const h = host();
  showConflict(c, { id: "q", type: "question", html: "<p>Theirs</p>", answer: "<p>Same</p>" }, "tab", h);
  buttonNamed(c.el, "Keep mine").click();
  assert.equal(c.conflict, null, "the line is gone");
  assert.equal(c.el.querySelector(".desk-sheet__conflict"), null);
  assert.equal(h.changes.length, 1);
  assert.equal(h.changes[0].after.modules[0].html, "<p>Mine</p>");
  assert.equal(h.changes[0].opts.announce, "Kept your version.");
  assert.equal(c.focused(), 1, "focus goes back to the part");
});

test("Keep mine with nothing different writes nothing and says so", () => {
  resetDom();
  const c = card();
  const h = host();
  showConflict(c, { id: "q", type: "question", html: "<p>Mine</p>", answer: "<p>Same</p>" }, "tab", h);
  buttonNamed(c.el, "Keep mine").click();
  assert.equal(h.changes.length, 0);
  assert.equal(h.said.at(-1), "Kept your version.");
});

test("Show that version loads the other words into every field and writes them again", () => {
  resetDom();
  const c = card();
  const h = host();
  showConflict(c, { id: "q", type: "question", html: "<p>Theirs</p>", answer: "<p>Their answer</p>" }, "tab", h);
  buttonNamed(c.el, "Show that version").click();
  assert.equal(c.inst.fields.html.shown(), "<p>Theirs</p>");
  assert.equal(c.inst.fields.answer.shown(), "<p>Their answer</p>");
  const m = h.changes[0].after.modules[0];
  assert.equal(m.html, "<p>Theirs</p>");
  assert.equal(m.answer, "<p>Their answer</p>");
  assert.equal(h.changes[0].opts.announce, "Showing the other version.");
  assert.equal(c.theirs, null);
});
