// Site 2.0 (SITE-2.0.md): the rest of the site in the Study Desk's grammar,
// behind the restyle's stamp until launch. A stylesheet has no behavior to
// run in node, so what is held here is the source: every rule in
// src/styles/v2/ gated on data-restyle, dark rules in both selectors with the
// same declarations, no ch unit and no removed focus ring, Layout.astro's
// import and its two display rules, and every page stylesheet imported.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const SRC = fileURLToPath(new URL("../src/", import.meta.url));
const V2 = join(SRC, "styles", "v2");
const read = (p) => readFileSync(p, "utf8");
const strip = (css) => css.replace(/\/\*[\s\S]*?\*\//g, "");

const files = readdirSync(V2).filter((f) => f.endsWith(".css")).sort();
const sheets = files.map((f) => ({ name: f, css: strip(read(join(V2, f))) }));
const layout = read(join(SRC, "layouts", "Layout.astro"));

/** Splits `text` at commas outside parentheses. */
function topLevel(text) {
  const parts = [];
  let depth = 0;
  let from = 0;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === "(") depth++;
    else if (text[i] === ")") depth--;
    else if (text[i] === "," && depth === 0) {
      parts.push(text.slice(from, i).trim());
      from = i + 1;
    }
  }
  parts.push(text.slice(from).trim());
  return parts.filter(Boolean);
}

/** Every style rule as { selectors, body, at }, at-rule blocks walked into; `at` is the enclosing at-rule preludes. */
function rules(css, at = []) {
  const out = [];
  let prelude = "";
  for (let i = 0; i < css.length; i++) {
    const c = css[i];
    if (c === "{") {
      const head = prelude.trim();
      prelude = "";
      let depth = 1;
      const start = i + 1;
      while (depth > 0) {
        i++;
        if (css[i] === "{") depth++;
        else if (css[i] === "}") depth--;
      }
      const body = css.slice(start, i);
      if (head.startsWith("@")) out.push(...rules(body, [...at, head]));
      else out.push({ selectors: topLevel(head), body: body.trim(), at });
    } else if (c === "}" || c === ";") prelude = "";
    else prelude += c;
  }
  return out;
}

/** A body's declarations, normalized, in order. */
const decls = (body) =>
  body
    .split(";")
    .map((d) => d.trim().replace(/\s+/g, " "))
    .filter(Boolean);

const DARK_OS = ':root[data-restyle]:not([data-theme="light"])';
const DARK_FORCED = ':root[data-restyle][data-theme="dark"]';

test("src/styles/v2/ holds base.css and the walk finds its rules", () => {
  assert.ok(files.includes("base.css"));
  const base = sheets.find((s) => s.name === "base.css");
  assert.ok(rules(base.css).length > 20, "the walk found the rules");
});

test("every rule in src/styles/v2/ waits for data-restyle", () => {
  for (const { name, css } of sheets) {
    for (const r of rules(css)) {
      for (const sel of r.selectors) assert.match(sel, /^:root\[data-restyle\]/, `${name}: ${sel.slice(0, 80)}`);
    }
  }
});

test("dark rules name both selectors, with the same declarations", () => {
  for (const { name, css } of sheets) {
    const all = rules(css);
    const isDark = (r) => r.at.some((a) => /prefers-color-scheme:\s*dark/.test(a));
    for (const r of all.filter(isDark)) {
      for (const sel of r.selectors) {
        assert.ok(sel.startsWith(DARK_OS), `${name}: a dark media rule is guarded by :not([data-theme="light"]): ${sel}`);
        const twinSel = DARK_FORCED + sel.slice(DARK_OS.length);
        const outer = r.at.filter((a) => !/prefers-color-scheme/.test(a)).join("|");
        const twin = all.find(
          (o) => !isDark(o) && o.at.join("|") === outer && o.selectors.includes(twinSel),
        );
        assert.ok(twin, `${name}: ${sel} has a twin under ${DARK_FORCED}`);
        assert.deepEqual(decls(twin.body), decls(r.body), `${name}: ${sel}: the same declarations in both dark selectors`);
      }
    }
    // A forced-dark rule has its OS twin too.
    for (const r of all.filter((o) => !isDark(o))) {
      for (const sel of r.selectors.filter((s) => s.startsWith(DARK_FORCED))) {
        const osSel = DARK_OS + sel.slice(DARK_FORCED.length);
        assert.ok(all.some((o) => isDark(o) && o.selectors.includes(osSel)), `${name}: ${sel} has a twin under the OS's dark query`);
      }
    }
  }
});

test("no ch unit (use --ch) and no removed outline in src/styles/v2/", () => {
  for (const { name, css } of sheets) {
    const bodies = rules(css).map((r) => r.body).join("\n");
    assert.doesNotMatch(bodies, /(?<![\w-])\d*\.?\d+ch\b/, `${name}: the ch unit; size columns with var(--ch)`);
    assert.doesNotMatch(bodies, /outline\s*:\s*(none|0)\b/, `${name}: a removed focus ring`);
    assert.doesNotMatch(bodies, /outline-(style|width)\s*:\s*(none|0)\b/, `${name}: a removed focus ring`);
  }
});

test("Layout.astro loads v2/base.css after restyle.css, and holds the two display rules", () => {
  const r = layout.indexOf('import "../styles/restyle.css";');
  const v = layout.indexOf('import "../styles/v2/base.css";');
  assert.ok(r >= 0 && v > r, "v2/base.css is imported after restyle.css");
  const critical = layout.match(/const criticalCSS = `([^`]*)`;/);
  assert.ok(critical, "criticalCSS");
  assert.ok(critical[1].includes(":root:not([data-restyle]) [data-v2]{display:none!important}"), "data-v2 is hidden without the stamp");
  assert.ok(critical[1].includes(":root[data-restyle] [data-v1]{display:none!important}"), "data-v1 is hidden with the stamp");
});

test("every page stylesheet in src/styles/v2/ is imported by a page or a layout", () => {
  const sources = [];
  const walk = (dir) => {
    for (const f of readdirSync(dir)) {
      const p = join(dir, f);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.(astro|ts|js|mjs)$/.test(f)) sources.push(read(p));
    }
  };
  walk(join(SRC, "pages"));
  walk(join(SRC, "layouts"));
  for (const f of files.filter((n) => n !== "base.css")) {
    const imported = sources.some((s) => new RegExp(`import\\s+["'][./]*(?:styles/)?v2/${f.replace(".", "\\.")}["']`).test(s));
    assert.ok(imported, `v2/${f} is imported by a file under src/pages/ or src/layouts/`);
  }
});
