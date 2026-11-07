#!/usr/bin/env node
// scripts/build-sheet-text-golden.mjs
//
// Writes test/fixtures/sheet-text-golden.json: a few hundred inputs to the
// sheet's formatted-text sanitizer (src/lib/desk-sheet-format.mjs,
// `sanitizeSheetHtml`) with the output each gave, held byte for byte by
// test/desk-sheets.test.js (audit 3 DI3-6).
//
// Why it exists: a stored sheet's text is valid only while the sanitizer's
// output for it never changes (validateSheet requires the canonical form).
// A change to the sanitizer that altered any canonical form would make every
// sheet holding that form refuse its edits. With this file, such a change
// fails the test, so it is made deliberately: regenerate the file, and bump
// SHEET_FORMAT if any stored sheet could hold the old form.
//
// The inputs are every template's formatted text and a seeded set of random
// HTML built from the tags and attributes the sanitizer allows, drops and
// unwraps, so the file covers the canonical forms and the ways in to them.
// On demand only; the output is committed.
//
//   npm run build:sheet-golden

import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { SHEET_FORMAT, sanitizeSheetHtml } from "../src/lib/desk-sheet-format.mjs";
import { TEMPLATES, templateModules } from "../src/lib/desk-sheet-templates.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "test/fixtures/sheet-text-golden.json");

/* ── A seeded generator, so the file is the same on every run ────────── */

let seed = 20261107;
const rnd = (n) => {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed % n;
};
const pick = (list) => list[rnd(list.length)];

const WORDS = ["love", "is", "patient,", "kind", "“quoted”", "don’t", "a & b", "<c>", "3–4", "é", "ἀγάπη", "אהבה", "  two  spaces", "x<sup>2</sup>"];
const BLOCKS = ["p", "h2", "h3", "blockquote", "ul", "ol", "hr", "div", "h1", "h4", "pre", "table", "section"];
const INLINE = ["strong", "em", "u", "s", "sup", "sub", "a", "span", "b", "i", "code", "mark", "font", "script", "img", "br"];
const ATTRS = [
  ' data-align="center"', ' data-align="right"', ' data-align="justify"', ' data-align="left"', ' data-align="up"',
  ' data-font="handwriting"', ' data-size="large"', ' data-size="small"', ' data-color="red"', ' data-color="blue"',
  ' data-mark="yellow"', ' data-mark="pink"', ' data-mark="green"', ' data-color="purple"', ' data-size="huge"',
  ' href="https://litbible.net/read/"', ' href="/romans-8/#v3"', ' href="mailto:a@b.org"', ' href="javascript:alert(1)"',
  ' href="java&#9;script:alert(1)"', ' href="data:text/html,x"', ' onclick="x()"', ' style="color:red"', ' class="x"',
  ' id="y"', ' title="t"', ' target="_blank"', ' rel="noopener"', ' lang="grc"', ' dir="rtl"',
];

function text() {
  return Array.from({ length: 1 + rnd(4) }, () => pick(WORDS)).join(" ");
}

function inline(depth) {
  if (depth > 2 || rnd(3) === 0) return text();
  const tag = pick(INLINE);
  const attrs = rnd(2) ? pick(ATTRS) : "";
  if (tag === "br" || tag === "img") return `${text()}<${tag}${attrs}>${text()}`;
  return `${text()}<${tag}${attrs}>${inline(depth + 1)}</${tag}>${rnd(2) ? text() : ""}`;
}

function block(depth) {
  const tag = pick(BLOCKS);
  const attrs = rnd(2) ? pick(ATTRS) : "";
  if (tag === "hr") return `<hr${attrs}>`;
  if (tag === "ul" || tag === "ol") {
    const items = Array.from({ length: 1 + rnd(3) }, () => `<li${rnd(3) ? "" : attrs}>${inline(0)}${depth < 2 && rnd(3) === 0 ? block(depth + 1) : ""}</li>`);
    return `<${tag}${attrs}>${rnd(4) === 0 ? text() : ""}${items.join("")}</${tag}>`;
  }
  if (tag === "blockquote" || tag === "div" || tag === "section") {
    const inner = depth < 2 ? Array.from({ length: 1 + rnd(2) }, () => block(depth + 1)).join("") : inline(0);
    return `<${tag}${attrs}>${inner}</${tag}>`;
  }
  return `<${tag}${attrs}>${inline(0)}</${tag}>`;
}

function document() {
  const parts = Array.from({ length: 1 + rnd(4) }, () => (rnd(5) === 0 ? text() : block(0)));
  const html = parts.join(rnd(3) === 0 ? "\n" : "");
  // Now and then, something unclosed or oddly nested, as a paste can be.
  if (rnd(8) === 0) return html.replace(/<\/(p|li|em)>/, "");
  if (rnd(8) === 0) return `<p>${html}</p>`;
  return html;
}

/* ── The cases ───────────────────────────────────────────────────────── */

const cases = [];
for (const t of TEMPLATES) {
  for (const m of templateModules(t.id)) {
    for (const field of ["html", "answer"]) {
      if (typeof m[field] === "string") cases.push({ why: `template ${t.id}, ${m.type}.${field}`, input: m[field] });
    }
  }
}
const seen = new Set(cases.map((c) => c.input));
while (cases.length < 400) {
  const input = document();
  if (seen.has(input)) continue;
  seen.add(input);
  cases.push({ why: "random", input });
}
for (const c of cases) {
  c.output = sanitizeSheetHtml(c.input);
  if (sanitizeSheetHtml(c.output) !== c.output) throw new Error(`not idempotent: ${c.input}`);
}

const out = {
  about:
    "Inputs to the sheet's formatted-text sanitizer (src/lib/desk-sheet-format.mjs, sanitizeSheetHtml) with the output each gave. test/desk-sheets.test.js holds every output byte for byte, so a change to a canonical form is a deliberate one: regenerate with `npm run build:sheet-golden`, and bump SHEET_FORMAT if a stored sheet could hold the old form (audit 3 DI3-6).",
  sheetFormat: SHEET_FORMAT,
  generatedBy: "npm run build:sheet-golden (scripts/build-sheet-text-golden.mjs)",
  cases,
};
writeFileSync(OUT, JSON.stringify(out, null, 1) + "\n");
console.log(`Wrote ${cases.length} sanitizer cases to ${OUT.replace(ROOT + "/", "")}`);
