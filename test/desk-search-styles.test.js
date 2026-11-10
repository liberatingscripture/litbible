// Audit 8, LG8-10: the desk's part of the site's search brings only its own
// small stylesheet, desk-search.css, not all of desk.css (about 200 KB) that it
// used to add for a few result rows. Checked by what each module downloads,
// its static imports (a `?inline` stylesheet counted as its file), as
// desk-first-stage.test.js checks the first stage.

import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(root, p), "utf8");
const STATIC_IMPORT = /^\s*(?:import|export)\s[^;]*?\sfrom\s+["'](\.[^"']+)["']|^\s*import\s+["'](\.[^"']+)["']/gm;

function staticClosure(entry) {
  const seen = new Set();
  const walk = (file) => {
    const rel = relative(root, file).replaceAll("\\", "/");
    if (seen.has(rel)) return;
    seen.add(rel);
    if (!/\.m?js$/.test(file)) return;
    for (const m of readFileSync(file, "utf8").matchAll(STATIC_IMPORT)) {
      const to = join(dirname(file), (m[1] ?? m[2]).replace(/\?.*$/, ""));
      if (existsSync(to)) walk(to);
    }
  };
  walk(join(root, entry));
  return seen;
}

test("LG8-10: the search's desk modules carry desk-search.css and not desk.css", () => {
  for (const entry of ["src/scripts/desk/notebook-search.js", "src/scripts/desk/sheets/search-sheet.js"]) {
    const closure = staticClosure(entry);
    assert.ok(!closure.has("src/styles/desk.css"), `${entry} reaches desk.css`);
    assert.ok(closure.has("src/styles/desk-search.css"), `${entry} carries desk-search.css`);
  }
});

test("LG8-10: every desk page adds desk-search.css beside desk.css", () => {
  const closure = staticClosure("src/scripts/desk/boot.js");
  assert.ok(closure.has("src/styles/desk.css"));
  assert.ok(closure.has("src/styles/desk-search.css"));
  assert.match(read("src/scripts/desk/boot.js"), /addTabStyle\(\);\s*addSearchStyle\(\);/);
});

test("LG8-10: the search rows' rules live in desk-search.css alone", () => {
  const search = read("src/styles/desk-search.css");
  const desk = read("src/styles/desk.css");
  for (const cls of ["desk-cmds", "desk-command", "desk-hit__kind", "desk-hit__snippet", "desk-more", "desk-gather", "desk-gather__sheets"]) {
    assert.match(search, new RegExp(`\\.${cls}[\\s{:,._]`), `${cls} is styled in desk-search.css`);
    assert.doesNotMatch(desk, new RegExp(`\\.${cls}[\\s{:,._]`), `${cls} is styled in desk.css too`);
  }
});
