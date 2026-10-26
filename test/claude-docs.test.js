// The Claude docs are split: the root CLAUDE.md holds only what applies
// anywhere, and each area's detail is in a CLAUDE.md beside its code, which
// Claude Code loads on demand. Every session pays for the root file on every
// turn, so it is held under a size limit, and its index table must name every
// area file, or a session has no way to find the detail it needs.
//
// If the size test fails, move the new detail into its area's file rather
// than raising the limit. If a table test fails, add or fix the row in the
// root's "How these docs are split" table.

import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const repo = fileURLToPath(new URL("..", import.meta.url));
const ROOT_LIMIT = 40 * 1024;
const SKIP = new Set(["node_modules", ".git", ".claude", ".astro", "dist", ".morphgnt"]);

const root = readFileSync(join(repo, "CLAUDE.md"), "utf8");

function areaFiles(dir = repo) {
  const found = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!SKIP.has(entry.name)) found.push(...areaFiles(join(dir, entry.name)));
    } else if (entry.name === "CLAUDE.md" && dir !== repo) {
      found.push(relative(repo, join(dir, entry.name)).split(sep).join("/"));
    }
  }
  return found;
}

// The paths in the index table: every `…/CLAUDE.md` in its first column.
function indexed() {
  const start = root.indexOf("## How these docs are split");
  assert.ok(start >= 0, "the root CLAUDE.md has lost its index section");
  const rows = root.slice(start).split("\n").filter((line) => line.startsWith("| `"));
  return rows.flatMap((row) =>
    [...row.split("|")[1].matchAll(/`([^`]+\/CLAUDE\.md)`/g)].map((m) => m[1]),
  );
}

test("the root CLAUDE.md stays under its size limit", () => {
  const size = statSync(join(repo, "CLAUDE.md")).size;
  assert.ok(
    size <= ROOT_LIMIT,
    `CLAUDE.md is ${size} bytes, over ${ROOT_LIMIT}: move detail into an area file`,
  );
});

test("every file the index names exists", () => {
  for (const path of indexed()) {
    assert.ok(existsSync(join(repo, path)), `the index names ${path}, which doesn't exist`);
  }
});

test("every area CLAUDE.md has a row in the index", () => {
  const listed = new Set(indexed());
  for (const path of areaFiles()) {
    assert.ok(listed.has(path), `${path} has no row in the root CLAUDE.md's index`);
  }
});
