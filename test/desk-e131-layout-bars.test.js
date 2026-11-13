// E131: every layout bar on /desk passes `keyless: true`, since Ctrl+Z steps
// through the notebook's history and a layout change writes none. desk-page.js
// can't be mounted in happy-dom (it builds the whole page), so this is one
// narrow source check: each showUndo call that commits a layout has the option.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("each layout bar in desk-page.js is keyless", () => {
  const src = readFileSync(new URL("../src/scripts/desk/desk-page.js", import.meta.url), "utf8");
  const calls = src.split("showUndo(").slice(1).map((c) => c.split("\n")[0]).filter((l) => /commit\(/.test(l));
  assert.ok(calls.length >= 4, `found ${calls.length} layout bars`);
  for (const line of calls) assert.match(line, /keyless: true/, line);
});
