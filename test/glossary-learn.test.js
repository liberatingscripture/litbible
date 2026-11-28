// test/glossary-learn.test.js
//
// /glossary as Featherboa Phase 7 draws it (SITE-FEATHERBOA.md, "The glossary
// and articles"; GL-01 to GL-28): one page, every entry at the anchor it has
// always had, the pair as the headline with no strike-through, the Greek read
// at build time from the alignment's lemma map, and "Where it appears" that
// opens without JavaScript. Source-level, like the other page tests: nothing
// here needs a build.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { GLOSSARY_LEMMAS, lemmaWords } from "../scripts/lib/glossary-lemmas.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => readFileSync(path.join(root, rel), "utf8");
const page = read("src/pages/glossary.astro");
const css = read("src/styles/pages/glossary.css");
const line = read("src/components/GlossaryLine.astro");
const lineJs = read("src/scripts/glossary-line.js");

const dir = path.join(root, "src/content/glossary");
const entries = readdirSync(dir)
  .filter((f) => f.endsWith(".md"))
  .map((f) => {
    const text = readFileSync(path.join(dir, f), "utf8");
    return {
      id: f.replace(/\.md$/, ""),
      draft: /^draft:\s*true/m.test(text),
      greek: /^greek:\s*"?([^"\n]+?)"?\s*$/m.exec(text)?.[1] ?? "",
    };
  })
  .filter((e) => !e.draft);

test("every entry keeps the anchor it has today: its id, on its heading", () => {
  assert.ok(entries.length > 40, "the collection is read");
  // The one template draws every entry, and the heading's id is the entry's id
  // (a /glossary#faith link works as it did).
  assert.match(page, /<h2 class="entry-title" id=\{data\.id\}>/);
  assert.match(page, /data-entry=\{data\.id\}/);
  // The line's list links to the same ids.
  assert.match(line, /href=\{`#\$\{e\.data\.id\}`\}/);
});

test("the pair is the headline, with no arrow, no strike-through, and no scribble", () => {
  assert.match(page, /Traditionally/);
  assert.match(page, /In the LIT/);
  assert.match(page, /pair__side--traditional/);
  assert.match(page, /pair__side--lit/);
  assert.doesNotMatch(css, /line-through/);
  assert.doesNotMatch(css, /\.entries-underline|\.ink-|scribble|roughjs/i);
  assert.doesNotMatch(page, /entries-underline|scribble|roughjs|<svg/i);
  // Study finds the traditional word by this name; nothing draws it.
  assert.match(page, /entries-strike/);
  // The traditional side is lighter and gray: the second ink, never a gray of its own.
  assert.match(css, /pair__side--traditional[^}]*\{[^}]*color: var\(--color-text-2\)/s);
  // A word with the LIT keeping it still shows both sides (Demon / demon): no
  // rule hides a side that matches.
  assert.doesNotMatch(page, /data\.traditional\.toLowerCase\(\) ===/);
});

test("the Greek of every entry comes from the lemma map, never a new field", () => {
  const missing = [];
  for (const e of entries) {
    let found = null;
    try {
      const words = lemmaWords(e.id);
      const lemmas = GLOSSARY_LEMMAS[e.id] ?? [];
      const at = words.findIndex(([, tr]) => tr.toLowerCase() === e.greek.toLowerCase());
      found = at >= 0 ? lemmas[at] : null;
    } catch {}
    if (!found || !/[Ͱ-Ͽἀ-῿]/.test(found)) missing.push(`${e.id} (${e.greek})`);
  }
  assert.deepEqual(missing, [], "an entry the map can't match shows its transliteration alone");
  assert.match(page, /GLOSSARY_LEMMAS/);
  assert.match(page, /lang="grc"/);
});

test("Where it appears: today's numbers, in the margin on a computer, under the entry elsewhere, and open without JS", () => {
  // The total and each rendering with its count.
  assert.match(page, /Where it appears/);
  assert.match(page, /totalOccurrences\(data\.id\)/);
  assert.match(page, /\{form\.count\} \{form\.count === 1 \? "time" : "times"\}/);
  // "Every place" is a link to the list's own address, which :target shows.
  assert.match(page, /href=\{`#places-\$\{data\.id\}`\}/);
  assert.match(page, /id=\{`places-\$\{data\.id\}`\}/);
  assert.match(css, /\.entry-places:target/);
  // The margin only where it fits and the desk is off; under the entry
  // otherwise. In the margin the entry is a grid that grows to hold the note,
  // so a long note never runs into the next entry (an absolute note did, on
  // 16 of 47 entries).
  const margin = css.match(/@media screen and \(min-width: 1300px\)\s*\{([\s\S]*?)\n\}/);
  assert.ok(margin, "the margin's media block");
  assert.match(margin[1], /html:not\(\[data-desk\]\) \.entry:has\(> \.entry-occ\)\s*\{[^}]*display: grid/);
  assert.match(margin[1], /html:not\(\[data-desk\]\) \.entry > \.entry-occ\s*\{[^}]*grid-column: 2/);
  assert.doesNotMatch(margin[1], /position: absolute/);
  // The full list is server-rendered: the script only hides batches.
  assert.match(page, /form\.refs\.map/);
});

test("the line: Learn / Glossary / the entry in view, ‹ ›, and the order switch in the list", () => {
  assert.match(line, />Learn</);
  assert.match(line, /Glossary/);
  assert.match(line, /data-gloss-current/);
  assert.match(line, /data-gloss-step="-1"/);
  assert.match(line, /data-gloss-step="1"/);
  assert.match(line, /data-order="lit"/);
  assert.match(line, /data-order="traditional"/);
  // Without JS the list still reaches every entry, and the switch waits hidden.
  assert.match(line, /<details class="gloss-menu"/);
  assert.match(line, /data-gloss-order hidden/);
  assert.match(line, /data-gloss-turn hidden/);
  assert.match(lineJs, /orderBox\.hidden = false/);
  // The line stays under the header as the page scrolls.
  assert.match(css, /\.place-line--glossary\s*\{[^}]*position: sticky/s);
});

test("BVJ's opening words are verbatim, the third paragraph untouched (Q1)", () => {
  assert.match(page, /As you look through the entries below, in bold, you’ll find the\s+traditional word\. In italics is the Greek behind it\. Underlined,\s+you’ll see what the LIT Bible uses in its place most often \(it can\s+change based on context\)\./);
});
