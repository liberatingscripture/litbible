#!/usr/bin/env node
/**
 * build-api-v2.mjs
 *
 * Writes the content API, version 2 (API-2-FORMAT.md), under
 * public/api/data/v2/, and adds its `v2` key to public/api/manifest.json.
 * Runs in `npm run build` after build:manifest and build:api, since it reads
 * the content version they publish. Every rule lives in scripts/lib/api2-core.mjs;
 * this is the fs shell.
 *
 *   v2/version.json            the gate a version 2 app polls
 *   v2/books.json              the 27 books, each chapter's `indexed` flag
 *   v2/chapters/<book>-<n>.json one per chapter
 *   v2/content.json            every chapter in one file, for the many-changes path
 *
 * ⚠️ The `files` map of the version 1 manifest is never touched. An installed
 * Android build matches `chapters/<book>-<n>.json` anywhere in a path, so a
 * version 2 file listed there would blank the reader's chapter. Version 2's
 * hashes go under the manifest's own `v2` key, which both apps' decoders skip.
 *
 * Every chapter's text and verse spans are checked against the anchor text
 * (scripts/lib/anchor-text.mjs) before anything is written; a difference fails
 * the build.
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { BOOKS, BOOK_ORDER, bookKeyToLabel } from "../src/data/books.js";
import { ANCHOR_SPEC_VERSION } from "./lib/anchor-text.mjs";
import { API_VERSION, addV2ToManifest, buildChapterV2, sha256 } from "./lib/api2-core.mjs";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const chaptersDir = path.join(projectRoot, "src", "data", "chapters");
const apiDir = path.join(projectRoot, "public", "api");
const outDir = path.join(apiDir, "data", "v2");

async function readChapters() {
  const chapters = [];
  for (const name of await fs.readdir(chaptersDir)) {
    if (!name.endsWith(".json")) continue;
    chapters.push(JSON.parse(await fs.readFile(path.join(chaptersDir, name), "utf8")));
  }
  const order = new Map(BOOK_ORDER.map((b, i) => [b, i]));
  for (const c of chapters) {
    if (!order.has(c.bookKey)) throw new Error(`unknown bookKey ${c.bookKey}`);
  }
  return chapters.sort((a, b) => order.get(a.bookKey) - order.get(b.bookKey) || a.chapter - b.chapter);
}

async function main() {
  const v1Version = JSON.parse(await fs.readFile(path.join(apiDir, "version.json"), "utf8"));
  const manifestPath = path.join(apiDir, "manifest.json");
  const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));
  const { version } = v1Version;

  const source = await readChapters();
  const chapters = source.map(buildChapterV2); // throws on any fidelity failure

  const books = BOOK_ORDER.map((bookKey) => {
    const indexed = Array.from({ length: BOOKS[bookKey] }, (_, i) => {
      const c = chapters.find((ch) => ch.bookKey === bookKey && ch.chapter === i + 1);
      if (!c) throw new Error(`no chapter file for ${bookKey} ${i + 1}`);
      return c.indexed;
    });
    return { bookKey, name: bookKeyToLabel(bookKey), chapters: BOOKS[bookKey], indexed };
  });

  await fs.rm(outDir, { recursive: true, force: true });
  await fs.mkdir(path.join(outDir, "chapters"), { recursive: true });

  const files = {};
  const write = async (rel, payload) => {
    const buf = Buffer.from(JSON.stringify(payload), "utf8");
    await fs.writeFile(path.join(outDir, rel), buf);
    return sha256(buf);
  };

  files["books.json"] = await write("books.json", { api: API_VERSION, anchorSpec: ANCHOR_SPEC_VERSION, books });
  for (const c of chapters) {
    const rel = `chapters/${c.bookKey}-${c.chapter}.json`;
    files[rel] = await write(rel, c);
  }
  const sortedFiles = Object.fromEntries(Object.keys(files).sort().map((k) => [k, files[k]]));
  // Like version 1's contentHash: moves whenever any version 2 file does, so a
  // change to this exporter alone (no new wording) still reaches the apps.
  const contentHash = sha256(Object.entries(sortedFiles).map(([k, v]) => `${k}:${v}`).join("\n")).slice(0, 8);

  const contentSha = await write("content.json", {
    api: API_VERSION,
    anchorSpec: ANCHOR_SPEC_VERSION,
    version,
    contentHash,
    chapters,
  });
  await write("version.json", {
    api: API_VERSION,
    anchorSpec: ANCHOR_SPEC_VERSION,
    version,
    contentHash,
    chapterCount: chapters.length,
  });

  const withV2 = addV2ToManifest(manifest, {
    api: API_VERSION,
    anchorSpec: ANCHOR_SPEC_VERSION,
    version,
    contentHash,
    files: sortedFiles,
    content: contentSha,
  });
  await fs.writeFile(manifestPath, JSON.stringify(withV2, null, 2));

  const published = chapters.filter((c) => c.indexed).length;
  console.log(
    `✅ public/api/data/v2/ written — ${chapters.length} chapters (${published} published), ` +
      `text and verse spans identical to the anchor text in every one (version ${version}, v2 ${contentHash})`,
  );
}

main().catch((error) => {
  console.error("❌ build-api-v2 failed");
  console.error(error?.stack ?? error);
  process.exit(1);
});
