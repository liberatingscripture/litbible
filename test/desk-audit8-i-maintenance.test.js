// Audit 8's maintenance items: the shared helpers that replaced the copies
// (LG8-7), the import cycle they broke (LG8-6), and one id maker with a
// fallback for pages outside a secure context (LG8-12).

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import "./helpers/browser-env.mjs";
import { newId } from "../src/lib/desk-records.mjs";
import { createSheet, duplicateSheet } from "../src/lib/desk-sheets.mjs";

const { buttons, describe } = await import("../src/scripts/desk/dom.js");
const { plural, dateWords } = await import("../src/scripts/desk/desk-text.js");
const { colorOf, nameOf, highlightedWords } = await import("../src/scripts/desk/record-words.js");

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

test("newId makes a version 4 UUID with crypto.randomUUID, and without it (plain http)", (t) => {
  assert.match(newId(), UUID);
  const real = globalThis.crypto.randomUUID;
  t.after(() => Object.defineProperty(globalThis.crypto, "randomUUID", { value: real, configurable: true, writable: true }));
  Object.defineProperty(globalThis.crypto, "randomUUID", { value: undefined, configurable: true, writable: true });
  const ids = new Set(Array.from({ length: 200 }, () => newId()));
  assert.equal(ids.size, 200);
  for (const id of ids) assert.match(id, UUID);
  // The callers that were bare `crypto.randomUUID()` work too.
  const sheet = createSheet({ title: "T" }, { now: "2026-11-10T00:00:00.000Z", client: "web/test", contentVersion: "v1" });
  assert.match(sheet.id, UUID);
  assert.match(duplicateSheet(sheet, { client: "web/test" }).id, UUID);
});

test("buttons: a module's default class, an override, and never a submit", () => {
  const button = buttons("desk-sheet__btn");
  const b = button("Save <b>");
  assert.equal(b.tagName, "BUTTON");
  assert.equal(b.type, "button");
  assert.equal(b.className, "desk-sheet__btn");
  assert.equal(b.textContent, "Save <b>");
  assert.equal(b.children.length, 0);
  assert.equal(button("Go", "other").className, "other");
});

test("describe gives each hint its own id across every caller", () => {
  const a = document.createElement("button");
  const b = document.createElement("button");
  const ha = describe(a, "First");
  const hb = describe(b, "Second");
  assert.notEqual(ha.id, hb.id);
  assert.equal(a.getAttribute("aria-describedby"), ha.id);
  assert.equal(hb.className, "sr-only");
  assert.equal(hb.textContent, "Second");
});

test("plural and dateWords", () => {
  assert.equal(plural(1, "item", "items"), "1 item");
  assert.equal(plural(0, "item", "items"), "0 items");
  assert.equal(plural(1204, "word"), "1,204 words");
  assert.equal(dateWords("2026-11-09T12:00:00.000Z"), "November 9, 2026");
  assert.equal(dateWords("not a date"), "");
});

test("record words: a known highlight color is named and tinted; anything else is plain", () => {
  const hl = { kind: "highlight", color: "yellow" };
  assert.equal(colorOf(hl), "yellow");
  assert.equal(nameOf(hl), "Yellow highlight");
  assert.equal(colorOf({ kind: "highlight", color: "plaid" }), null);
  const swatch = highlightedWords("yellow", "grace");
  assert.equal(swatch.className, "desk-swatch");
  assert.equal(swatch.dataset.color, "yellow");
  assert.equal(swatch.textContent, "grace");
  assert.equal(highlightedWords(null, "grace").nodeType, 3);
});

/** The static import graph of the client and lib code, and any cycle in it (Tarjan). */
function cycles() {
  const files = [];
  const walk = (dir) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (/\.(m?js)$/.test(e.name)) files.push(p);
    }
  };
  walk(join(root, "src/scripts"));
  walk(join(root, "src/lib"));
  const known = new Set(files);
  const edges = new Map();
  for (const f of files) {
    const src = readFileSync(f, "utf8");
    const out = [];
    for (const m of src.matchAll(/^\s*(?:import|export)\s[^;]*?from\s+"(\.{1,2}\/[^"]+)"/gm)) {
      const to = resolve(dirname(f), m[1]);
      if (known.has(to)) out.push(to);
    }
    edges.set(f, out);
  }
  let index = 0;
  const idx = new Map(), low = new Map(), stack = [], on = new Set(), found = [];
  const strong = (v) => {
    idx.set(v, index); low.set(v, index); index++; stack.push(v); on.add(v);
    for (const w of edges.get(v)) {
      if (!idx.has(w)) { strong(w); low.set(v, Math.min(low.get(v), low.get(w))); }
      else if (on.has(w)) low.set(v, Math.min(low.get(v), idx.get(w)));
    }
    if (low.get(v) === idx.get(v)) {
      const comp = [];
      let w;
      do { w = stack.pop(); on.delete(w); comp.push(w); } while (w !== v);
      if (comp.length > 1) found.push(comp.map((p) => p.slice(root.length + 1)).sort());
    }
  };
  for (const f of files) if (!idx.has(f)) strong(f);
  return found;
}

test("no static import cycle in src/scripts or src/lib (LG8-6)", () => {
  assert.deepEqual(cycles(), []);
});
