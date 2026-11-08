// The Greek search loads when a reader starts one, desk on or off (Audit 2,
// LG-6). The search tray is on every page, so nothing it or /search imports
// statically may reach the engine, and neither may any of the desk's entry
// points: it comes in through loadGreekSearch() in search-core.js or with
// desk/greek-find.js, both dynamic imports.
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const STATIC_IMPORT = /^\s*(?:import|export)\s[^;]*?\sfrom\s+["'](\.[^"']+)["']|^\s*import\s+["'](\.[^"']+)["']/gm;

/** Every repo file `entry` reaches by static imports alone, as repo-relative paths. */
function staticClosure(entry) {
  const seen = new Set();
  const walk = (file) => {
    const rel = relative(root, file).replaceAll("\\", "/");
    if (seen.has(rel)) return;
    seen.add(rel);
    for (const m of readFileSync(file, "utf8").matchAll(STATIC_IMPORT)) {
      const to = join(dirname(file), m[1] ?? m[2]);
      if (existsSync(to)) walk(to);
    }
  };
  walk(join(root, entry));
  return seen;
}

const ENGINE = [
  "src/scripts/search-greek.js",
  "src/scripts/greek-commands.js",
  "src/lib/greek-search.mjs",
  "src/lib/greek-query.mjs",
  "src/lib/greek-commands-ui.mjs",
  "src/lib/greek-credits.mjs",
];

for (const entry of ["src/scripts/search-core.js", "src/scripts/searchbar.js", "src/scripts/search.js"]) {
  test(`${entry} reaches none of the Greek search by a static import`, () => {
    const reached = staticClosure(entry);
    assert.ok(reached.has("src/data/books.js"), "the walk follows imports");
    for (const file of ENGINE) assert.ok(!reached.has(file), `${entry} reaches ${file}`);
  });
}

// The credits are a short list of names and links, which the Greek tab shows.
for (const entry of ["shell", "desk-page", "notebook-page", "sheets/sheet-page", "notebook-search", "sheets/search-sheet"]) {
  test(`desk/${entry}.js reaches none of the Greek search by a static import`, () => {
    const reached = staticClosure(`src/scripts/desk/${entry}.js`);
    for (const file of [...ENGINE.filter((f) => !f.endsWith("greek-credits.mjs")), "src/scripts/desk/greek-find.js"]) {
      assert.ok(!reached.has(file), `${entry} reaches ${file}`);
    }
  });
}

test("what every page does load to recognize Greek is the small detect file", () => {
  assert.ok(staticClosure("src/scripts/searchbar.js").has("src/lib/greek-detect.mjs"));
  const imports = readFileSync(join(root, "src/lib/greek-detect.mjs"), "utf8").match(/^\s*import\s/gm);
  assert.equal(imports, null, "greek-detect.mjs imports nothing");
});
