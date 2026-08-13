/**
 * build-glossary-json.mjs
 *
 * Generates `public/glossary.json` — the glossary feed the mobile apps sync as
 * `/api/data/glossary.json`. Runs as part of `npm run build`, before
 * `build:manifest`, which picks the file up as the generated source behind its
 * top-level `glossary.json` declaration (the same fallback arrangement
 * `topics.json` uses with `public/topics-index.json`).
 *
 * The source of truth is the Astro content collection, `src/content/glossary/`.
 * There is no hand-authored `src/data/glossary.json` and never has been — see
 * the header of `scripts/lib/glossary-feed-core.mjs` for that history and for
 * the four rules the feed's shape has to satisfy.
 *
 * Everything except reading and writing lives in the core module, so the rules
 * are unit-tested without touching disk (test/build-glossary-feed.test.js).
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { buildGlossaryFeed } from "./lib/glossary-feed-core.mjs";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, "..");
const glossaryDir = path.join(projectRoot, "src", "content", "glossary");
const outputPath = path.join(projectRoot, "public", "glossary.json");

async function main() {
  const names = (await fs.readdir(glossaryDir)).filter((n) => n.endsWith(".md")).sort();
  if (names.length === 0) {
    throw new Error(`No glossary entries found in ${glossaryDir}`);
  }

  const files = [];
  for (const name of names) {
    files.push({ name, raw: await fs.readFile(path.join(glossaryDir, name), "utf8") });
  }

  const { feed, stats } = buildGlossaryFeed(files);

  const json = `${JSON.stringify(feed, null, 2)}\n`;
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, json, "utf8");

  const bodyChars = feed.entries.reduce((total, e) => total + e.body.length, 0);
  console.log(
    `✅ public/glossary.json — ${feed.entries.length} entries, ` +
      `${Object.keys(feed.index.traditional).length}+${Object.keys(feed.index.lit).length} index keys, ` +
      `${bodyChars.toLocaleString("en-US")} chars of prose, ` +
      `${(json.length / 1024).toFixed(1)} KB`,
  );
  console.log(
    `   flattened to plain prose: ${stats.emphasisStripped} emphasis spans, ` +
      `${stats.escapesStripped} backslash escapes`,
  );
}

main().catch((err) => {
  console.error(`❌ build:glossary failed — ${err.message}`);
  process.exit(1);
});
