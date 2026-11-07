// The Study Desk costs a reader nothing unless it is switched on (Audit 3, LG3-4,
// the root rule in src/scripts/CLAUDE.md): shared reader code never imports the
// desk statically. The other import-graph tests cover four search entries and
// the Greek engine; this one walks every non-desk file under src/scripts,
// src/layouts, src/components and src/pages, and fails if the static import
// closure of any of them reaches the desk.
//
// "Reaches the desk" means a static path into src/scripts/desk/, into a
// src/scripts/desk-*.js or src/lib/desk-*.mjs file. Only static imports count
// (import ... from, export ... from, import "..."); a dynamic import() is how
// the gate loads the desk, and is the one allowed route in.
//
// Roots that are excluded, and why:
// - src/scripts/desk/ (the desk itself): it is the desk, not shared code.
// - src/pages/desk*, src/pages/notebook* (including desk/help.astro, which
//   imports desk-bookmarks.mjs for its constants), src/pages/sheets*: the
//   desk's own pages. They are reached only by their own URL, never by a
//   shared import. A shared page (index, [slug], read/, search, privacy) is a
//   root and is checked.
//
// Files that may name the desk, and why:
// - src/scripts/desk-gate.js: the gate. Its static import is desk-frame.js,
//   and it loads the desk only through dynamic import(), which is not walked.
// - src/scripts/desk-frame.js: the panel's frame helpers (panelRoom, dockWidth,
//   readingSurface). It has no imports and is imported by lit-panel.js,
//   panel-pieces.js and the Greek commands window on every page.
// - src/lib/desk-margin.mjs: the reading column's constants, imported by
//   Layout.astro for the pre-paint script. It has no imports.
// - The edge from src/lib/greek-commands-ui.mjs to src/lib/desk-greek.mjs (its
//   SIGNS and W, the Greek symbol and word helpers). This is the Greek engine's
//   edge: greek-commands.js and search-greek.js reach it through that module,
//   and it is loaded only when a Greek search starts. The brief named the three
//   scripts; the direct importer is this module. It is the only direct importer
//   allowed; any other importer of desk-greek.mjs fails.
//
// The allowed files are still walked, so a desk import added inside one of
// them fails too. Each exception must still be reached, so a stale one fails.

import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const STATIC_IMPORT = /^\s*(?:import|export)\s[^;]*?\sfrom\s+["'](\.[^"']+)["']|^\s*import\s+["'](\.[^"']+)["']/gm;
const SHARED_DIRS = ["src/scripts", "src/layouts", "src/components", "src/pages"];

const EXEMPT_FILES = new Set([
  "src/scripts/desk-gate.js",
  "src/scripts/desk-frame.js",
  "src/lib/desk-margin.mjs",
]);
const GREEK_EDGE_TO = "src/lib/desk-greek.mjs";
const GREEK_EDGE_FROM = new Set(["src/lib/greek-commands-ui.mjs"]);

const isDesk = (f) =>
  f.startsWith("src/scripts/desk/") || /^src\/scripts\/desk-[^/]*$/.test(f) || /^src\/lib\/desk-[^/]*$/.test(f);
const isDeskPage = (f) => /^src\/pages\/(desk|notebook|sheets)/.test(f);

const toRel = (file) => relative(root, file).replaceAll("\\", "/");

/** Every shared root: .js, .mjs, .ts and .astro files outside the desk and its pages. */
function roots() {
  const out = [];
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      if (statSync(full).isDirectory()) {
        if (toRel(full) === "src/scripts/desk") continue;
        walk(full);
      } else if (/\.(js|mjs|ts|astro)$/.test(name)) {
        const rel = toRel(full);
        if (!isDeskPage(rel)) out.push(rel);
      }
    }
  };
  for (const d of SHARED_DIRS) walk(join(root, d));
  return out.sort();
}

/** The static imports of one file, as repo-relative paths of files that exist. */
function staticImports(rel) {
  const found = [];
  for (const m of readFileSync(join(root, rel), "utf8").matchAll(STATIC_IMPORT)) {
    const to = join(dirname(join(root, rel)), m[1] ?? m[2]);
    if (existsSync(to) && statSync(to).isFile()) found.push(toRel(to));
  }
  return found;
}

/**
 * Breadth-first walk from every shared root at once. Returns each violation as
 * the chain of files from its root to the desk file, and the set of exceptions
 * the walk actually reached.
 */
function walkShared() {
  const parent = new Map();
  const queue = [];
  for (const r of roots()) {
    parent.set(r, null);
    queue.push(r);
  }
  const violations = [];
  const reachedExceptions = new Set();
  const chainTo = (file) => {
    const chain = [];
    for (let f = file; f != null; f = parent.get(f)) chain.unshift(f);
    return chain;
  };
  while (queue.length) {
    const file = queue.shift();
    for (const to of staticImports(file)) {
      if (isDesk(to)) {
        if (EXEMPT_FILES.has(to)) reachedExceptions.add(to);
        else if (to === GREEK_EDGE_TO && GREEK_EDGE_FROM.has(file)) reachedExceptions.add(`${file} -> ${to}`);
        else {
          violations.push({ importer: file, to, chain: [...chainTo(file), to] });
          continue;
        }
      }
      if (!parent.has(to)) {
        parent.set(to, file);
        queue.push(to);
      }
    }
  }
  return { violations, reachedExceptions, reached: parent };
}

const WALK = walkShared();

test("no shared file reaches the Study Desk by a static import", () => {
  const lines = WALK.violations.map(
    (v) => `${v.importer} imports the desk file ${v.to} statically; chain: ${v.chain.join(" -> ")}`,
  );
  assert.deepEqual(lines, [], `shared code reaches the desk:\n  ${lines.join("\n  ")}`);
});

test("the walk covers the shared code and follows real imports", () => {
  assert.ok(WALK.reached.has("src/scripts/searchbar.js"), "searchbar.js is a root");
  assert.ok(WALK.reached.has("src/scripts/search-core.js"), "searchbar.js reaches search-core.js");
  assert.ok(WALK.reached.has("src/lib/desk-margin.mjs"), "Layout.astro's import of desk-margin.mjs is followed");
  assert.ok(!WALK.reached.has("src/pages/desk.astro"), "desk pages are not roots");
});

test("every allowed desk edge is still reached, so none goes stale", () => {
  for (const file of EXEMPT_FILES) {
    assert.ok(WALK.reachedExceptions.has(file), `${file} is no longer reached by shared code; drop it from the allowlist`);
  }
  for (const file of GREEK_EDGE_FROM) {
    assert.ok(
      WALK.reachedExceptions.has(`${file} -> ${GREEK_EDGE_TO}`),
      `${file} no longer imports ${GREEK_EDGE_TO}; drop it from the allowlist`,
    );
  }
});
