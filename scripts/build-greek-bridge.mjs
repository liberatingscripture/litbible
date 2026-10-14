/**
 * build-greek-bridge.mjs
 *
 * `npm run build:greek-bridge` writes public/search/greek-bridge.json: the
 * LIT's renderings of the glossary terms, for searching the Greek by the
 * LIT's own words (STUDY-DESK.md, 1h). fs shell only; every rule is in
 * scripts/lib/greek-bridge-core.mjs. Part of `npm run build` (after
 * build:glossary), gitignored, deterministic. A website asset, never under
 * public/api/.
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { BOOK_ORDER } from "../src/data/books.js";
import { gatedOccurrences } from "../src/lib/alignment-gate.mjs";
import { GLOSSARY_LEMMAS } from "./lib/glossary-lemmas.mjs";
import { isDraftEntry, readGlossaryFrontmatter } from "./lib/glossary-feed-core.mjs";
import { buildGreekBridge } from "./lib/greek-bridge-core.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const alignmentDir = path.join(ROOT, "src", "data", "alignment");
const glossaryDir = path.join(ROOT, "src", "content", "glossary");
const out = path.join(ROOT, "public", "search", "greek-bridge.json");

async function main() {
  const files = [];
  for (const name of (await fs.readdir(alignmentDir)).filter((n) => n.endsWith(".json")).sort()) {
    files.push(JSON.parse(await fs.readFile(path.join(alignmentDir, name), "utf8")));
  }
  const entries = new Map();
  for (const name of (await fs.readdir(glossaryDir)).filter((n) => n.endsWith(".md")).sort()) {
    const fm = readGlossaryFrontmatter(await fs.readFile(path.join(glossaryDir, name), "utf8"));
    if (!fm?.id || isDraftEntry(fm)) continue;
    entries.set(fm.id, { title: fm.litMenu || fm.lit || fm.id, traditional: fm.traditional || "" });
  }
  const bridge = buildGreekBridge({
    gated: gatedOccurrences(files),
    entries,
    lemmas: GLOSSARY_LEMMAS,
    bookOrder: BOOK_ORDER,
  });
  await fs.mkdir(path.dirname(out), { recursive: true });
  await fs.writeFile(out, `${JSON.stringify(bridge).normalize("NFC")}\n`, "utf8");
  const renderings = bridge.terms.reduce((n, t) => n + t.renderings.length, 0);
  console.log(`build:greek-bridge: ${bridge.terms.length} terms, ${renderings} renderings → public/search/greek-bridge.json`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
