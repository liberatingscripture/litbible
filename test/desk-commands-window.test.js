// The Commands window (E31, reworked 2026-11-06) is the desk's own, apart from
// the Greek search commands window. The search tray and /search must reach it
// only through the gated desk module (loadDeskSearch), never a static import,
// so a reader without the Study Desk preview downloads none of it.
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const STATIC_IMPORT = /^\s*(?:import|export)\s[^;]*?\sfrom\s+["'](\.[^"']+)["']|^\s*import\s+["'](\.[^"']+)["']/gm;

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

const WINDOW = "src/scripts/desk/commands-window.js";

for (const entry of ["src/scripts/search-core.js", "src/scripts/searchbar.js", "src/scripts/search.js", "src/scripts/greek-commands.js"]) {
  test(`${entry} reaches no Study Desk file by a static import`, () => {
    const reached = [...staticClosure(entry)].filter((f) => f.startsWith("src/scripts/desk/") && !f.startsWith("src/scripts/desk-"));
    assert.deepEqual(reached, [], `${entry} reaches ${reached.join(", ")}`);
  });
}

test("the desk's search module carries the Commands window, and the Greek window does not", () => {
  assert.ok(staticClosure("src/scripts/desk/notebook-search.js").has(WINDOW));
  assert.ok(!staticClosure("src/scripts/greek-commands.js").has(WINDOW));
  assert.ok(!staticClosure(WINDOW).has("src/scripts/greek-commands.js"), "the two windows stay apart");
});

test("the three ways in open it through the desk module, labeled Notebook actions", () => {
  const src = (p) => readFileSync(join(root, p), "utf8");
  assert.match(src("src/scripts/searchbar.js"), /openCommands\(\{ anchor/);
  assert.match(src("src/scripts/search.js"), /openCommands\(\{ anchor/);
  assert.match(src("src/scripts/desk/panel.js"), /openCommands\(\{ anchor/);
  assert.match(src("src/components/SearchBar.astro"), /hidden>Notebook actions<\/button/);
  // The Greek window's button is back to a Greek-only "Search commands".
  assert.match(src("src/scripts/search.js"), /commandsBtn\.textContent = "Search commands"/);
});
