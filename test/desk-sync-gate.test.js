// test/desk-sync-gate.test.js
//
// A reader who isn't syncing downloads none of the sync (the plan's step 4g:
// "nothing may reach a reader yet"). The connector, the loop, the encryption
// and the status line's stylesheet are reached only through a dynamic import
// of src/scripts/desk/sync/start.js, made by the two files that have first
// read a link from the notebook: desk/store.js and desk/first-stage.js. This
// walks every file under src/ and holds that.
//
// Only static imports are edges (import ... from, export ... from,
// import "..."), as in test/desk-gate-imports.test.js: a dynamic import() is
// the gate. The one sync file other desk code may import statically is
// src/lib/desk-sync-link.mjs, which says what a link is and imports nothing.

import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const toRel = (file) => relative(root, file).replaceAll("\\", "/");
const STATIC_IMPORT = /^\s*(?:import|export)\s[^;]*?\sfrom\s+["'](\.[^"']+)["']|^\s*import\s+["'](\.[^"']+)["']/gm;
const DYNAMIC_IMPORT = /\bimport\(\s*["'](\.[^"']+)["']\s*\)/g;

/**
 * What only a syncing browser may download. The account's key flows
 * (desk-account.mjs, step 4h) are held the same way: they bring the
 * encryption with them, and no page reaches them yet. When the account
 * page is built its own dynamic import is a third way in, listed below.
 */
const GATED_LIBS = new Set([
  "src/lib/desk-account.mjs",
  "src/lib/desk-crypto.mjs",
  "src/lib/desk-sync.mjs",
  "src/lib/desk-sync-engine.mjs",
  "src/lib/desk-sync-status.mjs",
  "src/styles/desk-sync.css",
]);
const isGated = (f) => f.startsWith("src/scripts/desk/sync/") || GATED_LIBS.has(f);
const LINK = "src/lib/desk-sync-link.mjs";
const WAY_IN = "src/scripts/desk/sync/start.js";

function files(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) files(full, out);
    else if (/\.(js|mjs|ts|astro)$/.test(name)) out.push(toRel(full));
  }
  return out;
}

function imports(rel, pattern) {
  const found = [];
  for (const m of readFileSync(join(root, rel), "utf8").matchAll(pattern)) {
    const to = join(dirname(join(root, rel)), (m[1] ?? m[2]).replace(/\?.*$/, ""));
    if (existsSync(to) && statSync(to).isFile()) found.push(toRel(to));
  }
  return found;
}

const ALL = files(join(root, "src")).sort();

test("nothing outside the sync imports it statically", () => {
  const broken = [];
  for (const file of ALL) {
    if (isGated(file)) continue;
    for (const to of imports(file, STATIC_IMPORT)) {
      if (isGated(to)) broken.push(`${file} imports ${to}`);
    }
  }
  assert.deepEqual(broken, [], `a reader who isn't syncing would download:\n  ${broken.join("\n  ")}`);
});

test("the only way in is a dynamic import of start.js, from the two files that read the link first", () => {
  const ways = [];
  for (const file of ALL) {
    if (isGated(file)) continue;
    for (const to of imports(file, DYNAMIC_IMPORT)) {
      if (isGated(to)) ways.push(`${file} -> ${to}`);
    }
  }
  assert.deepEqual(ways.sort(), [`src/scripts/desk/first-stage.js -> ${WAY_IN}`, `src/scripts/desk/store.js -> ${WAY_IN}`]);
  for (const file of ["src/scripts/desk/first-stage.js", "src/scripts/desk/store.js"]) {
    assert.ok(imports(file, STATIC_IMPORT).includes(LINK), `${file} reads the link with ${LINK}`);
  }
});

test("what says a browser is linked imports nothing, so reading it costs a reader nothing", () => {
  assert.deepEqual(imports(LINK, STATIC_IMPORT), []);
  assert.deepEqual(imports(LINK, DYNAMIC_IMPORT), []);
});

test("the walk sees the sync's own files and follows real imports", () => {
  assert.ok(ALL.includes(WAY_IN));
  const fromStart = imports(WAY_IN, STATIC_IMPORT);
  for (const part of ["src/scripts/desk/sync/connector.js", "src/scripts/desk/sync/status-line.js", "src/scripts/desk/sync/stopped-notice.js", "src/scripts/desk/sync/sync-db.js", "src/lib/desk-crypto.mjs"]) {
    assert.ok(fromStart.includes(part), `start.js imports ${part}`);
  }
  assert.ok(imports("src/scripts/desk/sync/status-line.js", STATIC_IMPORT).includes("src/styles/desk-sync.css"), "the stylesheet's ?inline import is followed");
  assert.ok(imports("src/scripts/desk/sync/connector.js", STATIC_IMPORT).includes("src/lib/desk-sync-engine.mjs"));
});

test("the stylesheet is only ever imported inline, so no page's own stylesheet gathers it", () => {
  let found = 0;
  for (const file of ALL) {
    const text = readFileSync(join(root, file), "utf8");
    for (const m of text.matchAll(/(?:\bfrom|\bimport)\s*\(?\s*["']([^"'\n]*desk-sync\.css[^"'\n]*)["']/g)) {
      found++;
      assert.match(m[1], /\?inline$/, `${file} imports ${m[1]}`);
    }
  }
  assert.equal(found, 1, "one import, in the status line");
});
