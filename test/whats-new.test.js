// The What's New page: its entries (src/lib/whats-new.mjs) and its page.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { WHATS_NEW } from "../src/lib/whats-new.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const page = readFileSync(join(root, "src/pages/whats-new.astro"), "utf8");
const data = readFileSync(join(root, "src/lib/whats-new.mjs"), "utf8");

test("entries are newest first, with unique ids and real dates", () => {
  const ids = new Set();
  for (const e of WHATS_NEW) {
    assert.match(e.id, /^[a-z0-9][a-z0-9-]*$/);
    assert.ok(!ids.has(e.id), `${e.id} is used twice`);
    ids.add(e.id);
    assert.match(e.date, /^\d{4}-\d{2}-\d{2}$/);
    const d = new Date(`${e.date}T00:00:00Z`);
    assert.ok(!Number.isNaN(d.getTime()) && d.toISOString().startsWith(e.date), `${e.id}: ${e.date} is not a day`);
    assert.ok(e.title && Array.isArray(e.body) && e.body.length > 0);
  }
  const dates = WHATS_NEW.map((e) => e.date);
  assert.deepEqual(dates, [...dates].sort().reverse());
});

test("the page draws every entry's title, date, and body from the data", () => {
  assert.match(page, /WHATS_NEW\.map/);
  for (const part of ["entry.title", "entry.date", "entry.body"]) assert.ok(page.includes(part), part);
  assert.ok(WHATS_NEW.every((e) => e.title.length > 0));
});

test("neither the page nor the data names the design's code name or the old desk name", () => {
  for (const text of [page, data]) {
    assert.doesNotMatch(text, /featherboa/i);
    assert.doesNotMatch(text, /study desk/i);
  }
});

test("no em dashes", () => {
  for (const text of [page, data]) assert.ok(!text.includes("—"));
});

test("a link that leaves the site opens in a new tab", () => {
  for (const e of WHATS_NEW) {
    for (const m of e.body.join(" ").matchAll(/<a\s[^>]*href="(https?:[^"]+)"[^>]*>/g)) {
      assert.match(m[0], /target="_blank"/);
      assert.match(m[0], /rel="noopener noreferrer"/);
    }
  }
});
