// test/desk-storage-keys.test.js
//
// /privacy must name every storage key the desk writes (Audit 2, LG-2, LG-8:
// the BA42 class of drift). Reads the page and the code, so a new key that
// isn't disclosed fails here instead of by hand.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import { LAYOUT_KEY } from "../src/lib/desk-layout.mjs";
import { GREEK_NOTES_KEY } from "../src/lib/desk-greek-notes.mjs";

const privacy = readFileSync(new URL("../src/pages/privacy.astro", import.meta.url), "utf8");

function sources(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) sources(p, out);
    else if (/\.(js|mjs|astro)$/.test(name)) out.push(p);
  }
  return out;
}

test("every lit-desk, lit-sheet and lit-greek key in the code is named on /privacy", () => {
  const found = new Set();
  for (const file of sources(new URL("../src", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"))) {
    if (file.endsWith("privacy.astro")) continue;
    for (const m of readFileSync(file, "utf8").matchAll(/["'`](lit-(?:desk|sheet|greek)-[a-z-]+)["'`]/g)) found.add(m[1]);
  }
  assert.ok(found.size > 15, "the scan found the keys");
  // BroadcastChannel names, not storage; /privacy describes them in a sentence of their own.
  const channels = new Set(["lit-desk-follow-tab"]);
  const missing = [...found].filter((k) => !channels.has(k)).filter((k) => !privacy.includes(`<code>${k}</code>`));
  assert.deepEqual(missing, []);
});

test("the two keys the layout and Greek-notes rules export are the ones /privacy names", () => {
  assert.ok(privacy.includes(`<code>${LAYOUT_KEY}</code>`));
  assert.ok(privacy.includes(`<code>${GREEK_NOTES_KEY}</code>`));
});
