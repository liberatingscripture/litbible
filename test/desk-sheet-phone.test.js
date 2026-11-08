// A shared sheet on a phone or tablet (Audit 6, NB6-8; BVJ, 2026-11-08): the
// one way the desk's code reaches a phone. /sheets/ loads sheet-share-gate.js
// for everyone, so it may reach the desk only by a dynamic import, made for a
// shared link on a phone; and sheet-page.js, which that import loads, must
// not start the desk's own page (which opens the notebook) unless the desk is on.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(resolve(root, p), "utf8");
const STATIC_IMPORT = /^\s*(?:import|export)\s[^;]*?\sfrom\s+["']([^"']+)["']|^\s*import\s+["']([^"']+)["']/gm;

test("sheet-share-gate.js imports nothing of the desk statically", () => {
  const src = read("src/scripts/sheet-share-gate.js");
  const imports = [...src.matchAll(STATIC_IMPORT)].map((m) => m[1] ?? m[2]);
  assert.deepEqual(imports.filter((p) => /desk/.test(p)), []);
});

test("sheet-share-gate.js loads the sheet page dynamically, and only on a phone or tablet", () => {
  const src = read("src/scripts/sheet-share-gate.js");
  const at = src.indexOf('import("./desk/sheets/sheet-page.js")');
  assert.ok(at > 0, "the dynamic import is there");
  assert.equal(src.indexOf('import("./desk/sheets/sheet-page.js")', at + 1), -1, "and only once");
  assert.ok(src.lastIndexOf("if (isAppPlatform(navigator)) {", at) > 0, "inside the phone branch");
});

test("sheet-page.js starts the desk's page only with the desk on, and exports the phone's way in", () => {
  const src = read("src/scripts/desk/sheets/sheet-page.js");
  assert.match(src, /\nif \(document\.documentElement\.dataset\.desk === "on"\) start\(\);\n/);
  assert.doesNotMatch(src, /\nstart\(\);/);
  assert.match(src, /export async function showSharedOnPhone\(root, fragment\) \{[\s\S]*?showShared\(root, null, fragment, \{ phone: true \}\)/);
});
