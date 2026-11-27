// Featherboa's one icon set (SITE-FEATHERBOA.md, "Controls," "Icons";
// SITE-FEATHERBOA-BUILD.md, Phase 2): Lucide's drawings on a 24-pixel grid
// at a 1.5-pixel stroke with round ends, in src/lib/icons.mjs, which both
// .astro files and client scripts read. An icon stands alone only if it is one
// of five everyone knows, and typed glyphs (× ‹ › ▾, and ▸) no longer stand in
// for icons on a control.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { repo } from "./helpers/featherboa-css.mjs";
import { ICONS, STANDALONE, mayStandAlone, icon } from "../src/lib/icons.mjs";

const RECORD = ["read", "notebook", "sheet", "collection", "highlight", "note", "bookmark", "copy", "share", "print", "layout", "new", "search", "close", "back", "more"];

test("the record's sixteen icons are in the module, by name", () => {
  for (const name of RECORD) assert.ok(ICONS[name], `no icon named ${name}`);
});

test("every icon is drawn on a 24-pixel grid at a 1.5-pixel stroke with round ends, and hidden from screen readers", () => {
  for (const name of Object.keys(ICONS)) {
    const svg = icon(name);
    assert.match(svg, /viewBox="0 0 24 24"/, name);
    assert.match(svg, /stroke-width="1\.5"/, name);
    assert.match(svg, /stroke-linecap="round"/, name);
    assert.match(svg, /stroke-linejoin="round"/, name);
    assert.match(svg, /stroke="currentColor"/, `${name} takes its control's color`);
    assert.match(svg, /fill="none"/, name);
    assert.match(svg, /aria-hidden="true"/, name);
    assert.match(svg, /focusable="false"/, name);
    assert.match(svg, new RegExp(`data-icon="${name}"`), name);
    assert.doesNotMatch(ICONS[name], /stroke-width|<script|on\w+=/i, `${name}'s drawing sets nothing of its own`);
  }
  assert.throws(() => icon("nope"), /no icon named/);
  assert.match(icon("search", { size: 16, className: "icon tiny" }), /class="icon tiny"[^>]*width="16" height="16"/);
});

test("only the five everyone knows may stand alone", () => {
  assert.deepEqual([...STANDALONE], ["search", "close", "back", "forward", "more"]);
  assert.ok(mayStandAlone("close"));
  assert.ok(!mayStandAlone("print"));
});

test("each drawing is Lucide's, as lucide-static ships it (npm run build:icons)", () => {
  const require = createRequire(import.meta.url);
  const dir = dirname(require.resolve("lucide-static/package.json"));
  const module = readFileSync(join(repo, "src/lib/icons.mjs"), "utf8");
  const sources = /Lucide's drawing behind each name: ([^\n]+(?:\n\/\/ [^\n]+)*)\./.exec(module);
  assert.ok(sources, "the module names Lucide's drawing behind each icon");
  const pairs = sources[1].replace(/\n\/\/ /g, " ").split(", ").map((p) => p.split(" "));
  assert.equal(pairs.length, Object.keys(ICONS).length);
  for (const [name, file] of pairs) {
    const svg = readFileSync(join(dir, "icons", `${file}.svg`), "utf8");
    const inner = svg
      .replace(/^[\s\S]*?<svg[^>]*>/, "")
      .replace(/<\/svg>\s*$/, "")
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)
      .join("")
      .replace(/\s*\/>/g, "/>");
    assert.equal(ICONS[name], inner, `${name} (${file}) differs from lucide-static: run npm run build:icons`);
  }
});

// ---------- No typed glyph stands in for an icon ----------

/** Text with its comments blanked: block comments (markup's braced ones
 *  too), whole-line // comments, and markup's <!-- --> ones. */
function withoutComments(text) {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "))
    .replace(/<!--[\s\S]*?-->/g, (m) => m.replace(/[^\n]/g, " "))
    .replace(/^\s*\/\/.*$/gm, "");
}

/** Typed glyphs that may stay, each with its reason: never on a control. */
const ALLOWED = [
  // { file, text, why }
];

const GLYPHS = /[×‹›▾▸]/;

test("typed glyphs (× ‹ › ▾ ▸) no longer stand in for icons", () => {
  const found = [];
  (function walk(dir) {
    for (const e of readdirSync(join(repo, dir), { withFileTypes: true })) {
      const rel = `${dir}/${e.name}`;
      if (e.isDirectory()) {
        if (rel === "src/components/apps" || rel === "src/content") continue;
        walk(rel);
      } else if (/\.(astro|js|mjs|ts)$/.test(e.name)) {
        const lines = withoutComments(readFileSync(join(repo, rel), "utf8")).split("\n");
        lines.forEach((line, i) => {
          if (!GLYPHS.test(line)) return;
          const allowed = ALLOWED.some((a) => a.file === rel && line.includes(a.text));
          if (!allowed) found.push(`${rel}:${i + 1}: ${line.trim().slice(0, 140)}`);
        });
      }
    }
  })("src");
  assert.deepEqual(found, [], `${found.length} lines type a glyph:\n${found.join("\n")}`);
});
