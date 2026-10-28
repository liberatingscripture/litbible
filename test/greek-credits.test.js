import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { GREEK_LICENSE_HREF, SEARCH_CREDIT, SOURCES, creditHtml, creditText } from "../src/lib/greek-credits.mjs";

const read = (p) => fs.readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const escape = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

test("every link in the search credit points at the license or at a source the Greek tab lists (BA46)", () => {
  const hrefs = new Set(SOURCES.map(([, href]) => href));
  const links = SEARCH_CREDIT.filter((p) => typeof p !== "string");
  assert.ok(links.length >= 5);
  for (const { text, href } of links) {
    assert.ok(href === GREEK_LICENSE_HREF || hrefs.has(href), `${text} -> ${href}`);
  }
});

test("the credit's plain text names every source in one line", () => {
  assert.equal(creditText(), "Greek: SBLGNT; parsing: MorphGNT and MACULA Greek; glosses: UBS and STEP Bible (licenses).");
});

test("creditHtml escapes text and opens only outside links in a new tab (BA47)", () => {
  const html = creditHtml(escape);
  for (const m of html.matchAll(/<a href="([^"]+)"([^>]*)>/g)) {
    if (m[1].startsWith("http")) {
      assert.match(m[2], /target="_blank"/, m[1]);
      assert.match(m[2], /rel="noopener noreferrer"/, m[1]);
    } else {
      assert.equal(m[1], GREEK_LICENSE_HREF);
      assert.equal(m[2], "", "the internal link has neither attribute");
    }
  }
  assert.ok(html.includes(`<a href="${GREEK_LICENSE_HREF}">licenses</a>`));

  const out = creditHtml(escape, ["a < b & c", { text: "x<y", href: "https://example.com/?a=1&b=2" }]);
  assert.ok(out.startsWith("a &lt; b &amp; c"));
  assert.ok(out.includes("x&lt;y</a>"));
  assert.ok(out.includes('href="https://example.com/?a=1&amp;b=2"'));
  assert.ok(!/<y|< b/.test(out));
});

test("the Greek tab, the search tray and /search draw from greek-credits.mjs", () => {
  const tab = read("src/scripts/desk/tab-greek.js");
  assert.match(tab, /import\s*\{[^}]*\bSOURCES\b[^}]*\}\s*from\s*["']\.\.\/\.\.\/lib\/greek-credits\.mjs["']/);
  assert.ok(!/const SOURCES\b/.test(tab), "no list of its own");
  assert.match(read("src/scripts/searchbar.js"), /import\s*\{[^}]*\bcreditHtml\b[^}]*\}\s*from\s*["'][^"']*greek-credits\.mjs["']/);
  assert.match(read("src/pages/search.astro"), /import\s*\{[^}]*\bSEARCH_CREDIT\b[^}]*\}\s*from\s*["'][^"']*greek-credits\.mjs["']/);
});

test("public/greek/LICENSE.txt is the LICENSE_TEXT build-greek.mjs writes", () => {
  const src = read("scripts/build-greek.mjs");
  const m = src.match(/const LICENSE_TEXT = `([\s\S]*?)`;/);
  assert.ok(m, "LICENSE_TEXT found");
  const onDisk = fs.readFileSync(new URL("../public/greek/LICENSE.txt", import.meta.url));
  assert.ok(onDisk.equals(Buffer.from(m[1], "utf8")), "byte-identical; run build:greek or fix the template");
});

test("the license's search/ section names the STEPBible glosses (BA46)", () => {
  const text = read("public/greek/LICENSE.txt");
  const at = text.search(/^search\/$/m);
  assert.ok(at >= 0, "search/ section found");
  const section = text.slice(at);
  assert.match(section, /STEPBible/);
  assert.match(section, /TBESG/);
  assert.match(section, /CC BY 4\.0/);
  assert.ok(section.includes("github.com/STEPBible"));
  assert.ok(!section.includes("(or the brief lexicon where UBS has none)"));
});
