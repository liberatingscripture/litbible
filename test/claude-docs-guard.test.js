// The repo's Claude docs stay off the public site
// (src/lib/claude-docs-guard.mjs). Three things keep them off: the build takes
// every CLAUDE.md output out of dist/, the sitemap filter drops its address,
// and check:links fails a built site that has either. The first two are run
// from the real astro.config.mjs and the last from the real script, each on a
// small made-up site in the system's temporary folder (a CLAUDE.md made inside
// the repo would need a row in the root file: test/claude-docs.test.js).

import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import config from "../astro.config.mjs";
import { isClaudeDocPath } from "../src/lib/claude-docs-guard.mjs";

const CHECK_LINKS = fileURLToPath(new URL("../scripts/check-links.mjs", import.meta.url));
const quiet = { info() {}, warn() {}, error() {} };

/** A new folder holding `files` ({ path: text }), removed when the test ends. */
async function fixture(t, files) {
  const root = await mkdtemp(path.join(tmpdir(), "claude-docs-guard-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  for (const [name, text] of Object.entries(files)) {
    const file = path.join(root, name);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, text);
  }
  return root;
}

/** Every file and folder under dir, written with forward slashes and sorted. */
async function listing(dir) {
  const entries = await readdir(dir, { recursive: true, withFileTypes: true });
  return entries
    .map((entry) => path.relative(dir, path.join(entry.parentPath, entry.name)))
    .map((name) => name.split(path.sep).join("/"))
    .sort();
}

/** One of astro.config.mjs's integrations. */
function integration(name) {
  const found = config.integrations.find((each) => each.name === name);
  assert.ok(found, `astro.config.mjs has no ${name} integration`);
  return found;
}

test("knows a CLAUDE.md, and a page made from one, by its path", () => {
  for (const sitePath of [
    "CLAUDE.md",
    "greek/CLAUDE.md",
    "CLAUDE/index.html",
    "desk/CLAUDE/index.html",
    "CLAUDE.html",
    "CLAUDE",
    "/CLAUDE/",
    "/desk/CLAUDE",
  ]) {
    assert.equal(isClaudeDocPath(sitePath), true, sitePath);
  }
  for (const sitePath of [
    "",
    "/",
    "index.html",
    "about/index.html",
    "claude/index.html",
    "/articles/claude/",
    "CLAUDETTE/index.html",
    "greek/john-1.json",
    "api/data/intros/john-intro.md",
  ]) {
    assert.equal(isClaudeDocPath(sitePath), false, sitePath);
  }
});

test("the build takes every one out of dist/ and leaves the rest", async (t) => {
  const dist = await fixture(t, {
    "index.html": "",
    "about/index.html": "",
    "desk/index.html": "",
    "greek/john-1.json": "",
    // The pages Astro makes of a CLAUDE.md under src/pages/ ...
    "CLAUDE/index.html": "",
    "desk/CLAUDE/index.html": "",
    // ... and the docs it copies out of public/.
    "CLAUDE.md": "",
    "greek/CLAUDE.md": "",
  });

  await integration("lit-claude-docs-guard").hooks["astro:build:done"]({
    dir: pathToFileURL(dist + path.sep),
    logger: quiet,
  });

  assert.deepEqual(await listing(dist), [
    "about",
    "about/index.html",
    "desk",
    "desk/index.html",
    "greek",
    "greek/john-1.json",
    "index.html",
  ]);
});

test("the sitemap lists none of their addresses", async (t) => {
  const dist = await fixture(t, {});
  const addresses = ["about", "CLAUDE", "desk/CLAUDE"];
  const { hooks } = integration("@astrojs/sitemap");

  // The three hooks @astrojs/sitemap builds its list from, given what Astro
  // gives them for those three pages.
  await hooks["astro:config:done"]({
    config: {
      site: config.site,
      base: "/",
      trailingSlash: "ignore",
      build: { format: "directory" },
    },
  });
  await hooks["astro:routes:resolved"]({
    routes: addresses.map((address) => ({
      type: "page",
      pathname: `/${address}`,
      pattern: `/${address}`,
      generate: () => `/${address}`,
      fallbackRoutes: [],
    })),
  });
  await hooks["astro:build:done"]({
    dir: pathToFileURL(dist + path.sep),
    pages: addresses.map((address) => ({ pathname: `${address}/` })),
    logger: quiet,
  });

  const xml = await readFile(path.join(dist, "sitemap-0.xml"), "utf8");
  assert.ok(xml.includes(`<loc>${config.site}/about/</loc>`), xml);
  assert.ok(!xml.includes("CLAUDE"), xml);
});

test("check:links fails a built site that publishes one", async (t) => {
  const sitemap = (address) => `<urlset><url><loc>${config.site}${address}</loc></url></urlset>`;
  const site = {
    "dist/index.html": '<a href="/about/">About</a>',
    "dist/about/index.html": "",
    "dist/sitemap-0.xml": sitemap("/about/"),
  };
  const run = async (t, files) =>
    spawnSync(process.execPath, [CHECK_LINKS], {
      cwd: await fixture(t, files),
      encoding: "utf8",
    });

  await t.test("and passes one that doesn't", async (t) => {
    const result = await run(t, site);
    assert.equal(result.status, 0, result.stderr);
  });

  for (const [what, extra, named] of [
    ["a doc copied from public/", { "dist/greek/CLAUDE.md": "" }, "greek/CLAUDE.md"],
    ["a page made from one", { "dist/CLAUDE/index.html": "" }, "CLAUDE/index.html"],
    [
      "a sitemap entry for one",
      { "dist/sitemap-0.xml": sitemap("/CLAUDE/") },
      `${config.site}/CLAUDE/`,
    ],
  ]) {
    await t.test(`on ${what}`, async (t) => {
      const result = await run(t, { ...site, ...extra });
      assert.equal(result.status, 1, result.stdout);
      assert.ok(result.stderr.includes(`✗ ${named}`), result.stderr);
    });
  }
});
