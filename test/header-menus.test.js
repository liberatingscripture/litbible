import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const header = read("src/components/SiteHeader.astro");
const css = read("src/styles/global.css");

test("header C shows only behind the desk preview's gate, and today's links only without it", () => {
  assert.match(css, /html:not\(\[data-desk\]\) \.site-nav__group,\s*html\[data-desk\] \.site-nav__plain \{\s*display: none;/);
  assert.match(css, /html:not\(\[data-desk\]\) \.menu-overlay__group--desk \{\s*display: none;/);
});

test("the Study group is the desk's, and its Study Desk link takes the page's place", () => {
  assert.match(header, /key: "study",\s*label: "Study",\s*desk: true,/);
  assert.match(header, /\{ href: deskHref, label: "Study Desk"/);
  assert.match(read("src/layouts/ScriptureLayout.astro"), /deskHref=\{showDeskPill \? deskPlaceHref : undefined\}/);
});

test("every group link goes to a page the site builds", () => {
  const hrefs = [...header.matchAll(/\{ href: "([^"]+)"/g)].map((m) => m[1]);
  assert.ok(hrefs.length >= 10);
  for (const href of hrefs) {
    const name = href.replace(/^\/|\/$/g, "");
    let found = false;
    for (const p of [`src/pages/${name}.astro`, `src/pages/${name}/index.astro`]) {
      try { readFileSync(new URL(`../${p}`, import.meta.url)); found = true; } catch {}
    }
    assert.ok(found, `${href} has no page`);
  }
});
