// The Greek tab, driven (Audit 8):
//   GK8-3  only Greek runs of an apparatus note carry lang="grc", not the whole note
//   GK8-4  Shift+Arrow is not taken, so a reader can extend a selection of the
//          Greek by keyboard; the plain arrows still move between words

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { settle, resetDom } from "./helpers/browser-env.mjs";

// The real committed Greek files, served to the tab's fetches.
const greekRoot = new URL("../public/", import.meta.url);
globalThis.fetch = async (url) => {
  const path = String(url).replace(/^https?:\/\/[^/]+/, "").replace(/^\//, "").split("?")[0];
  const file = new URL(path, greekRoot);
  if (!path.startsWith("greek/") || !existsSync(file)) return { ok: false, status: 404, json: async () => ({}) };
  const text = readFileSync(file, "utf8");
  return { ok: true, status: 200, json: async () => JSON.parse(text) };
};

const { createGreekTab } = await import("../src/scripts/desk/tab-greek.js");
const GREEK = /[Ͱ-Ͽἀ-῿]/;

async function tab() {
  resetDom();
  document.body.innerHTML = `<div class="chapter-paragraphs"></div>`;
  const t = createGreekTab({ here: { bookKey: "john", chapter: 3, label: "John 3" }, visible: () => true, openVerse: () => {} });
  document.body.append(t.el);
  await t.render();
  await settle(30);
  return t;
}

test("GK8-3: an apparatus note is marked grc only on its Greek runs", async () => {
  const t = await tab();
  const notes = [...t.el.querySelectorAll(".desk-greek__app-note")];
  assert.ok(notes.length > 0, "John 3 has apparatus notes");
  let marked = 0;
  for (const n of notes) {
    assert.equal(n.hasAttribute("lang"), false, "the note as a whole is not marked");
    for (const s of n.querySelectorAll("[lang]")) {
      marked++;
      assert.equal(s.lang, "grc");
      assert.match(s.textContent, GREEK, `a marked run is Greek: ${s.textContent}`);
    }
  }
  assert.ok(marked > 0, "the Greek runs are marked");
  // The Latin sigla stay unmarked: some note has text outside any lang span.
  assert.ok(notes.some((n) => [...n.childNodes].some((c) => c.nodeType === 3 && /[A-Za-z]/.test(c.nodeValue))));
});

function press(word, init) {
  const e = new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true, cancelable: true, ...init });
  word.dispatchEvent(e);
  return e;
}

test("GK8-4: Shift+Arrow is left to the browser; the plain arrow moves to the next word", async () => {
  const t = await tab();
  const words = [...t.el.querySelectorAll(".desk-greek__w")];
  assert.ok(words.length > 3);
  const first = words[0];
  first.focus();
  const shifted = press(first, { shiftKey: true });
  assert.equal(shifted.defaultPrevented, false, "Shift+Right is not taken");
  assert.equal(document.activeElement, first, "and focus didn't move");
  for (const mod of ["ctrlKey", "metaKey", "altKey"]) {
    assert.equal(press(first, { [mod]: true }).defaultPrevented, false, `${mod} passes too`);
  }
  const plain = press(first, {});
  assert.equal(plain.defaultPrevented, true, "the plain arrow is the tab's own");
  assert.notEqual(document.activeElement, first, "and moves to another word");
});
