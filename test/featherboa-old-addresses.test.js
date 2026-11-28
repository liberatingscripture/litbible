// Featherboa's old addresses keep working (SITE-FEATHERBOA-BUILD.md, "Checks":
// "The old addresses"). Installed apps, Study, and readers' bookmarks link
// them, so each one lands where what it named went. The license's three
// fragments are here (FP-19); Read View's /read/<book>, with its #ch-N and
// verse anchors, since Phase 4 (WB-44); the /notebook anchors join in
// Phase 10. The rules themselves are tested in read-view-retirement.test.js;
// here the page's own script runs at each address.
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { runInNewContext } from "node:vm";
import { repo } from "./helpers/featherboa-css.mjs";
import { BOOKS, BOOK_ORDER } from "../src/data/books.js";

const read = (rel) => readFileSync(join(repo, rel), "utf8");

/** The inline script in /read's head that forwards the license's fragments. */
function forwardingScript() {
  const page = read("src/pages/read.astro");
  const m = /<script\s+slot="head"\s+is:inline\s+set:html=\{`([^`]*location\.replace[^`]*)`\}\s*\/>/.exec(page);
  assert.ok(m, "read.astro has an is:inline head script that calls location.replace");
  return m[1];
}

/** Runs the script at a hash; returns where it sent the reader, or null. */
function landing(script, hash) {
  let to = null;
  const location = {
    hash,
    replace(url) {
      to = url;
    },
  };
  runInNewContext(script, { location });
  return to;
}

test("/read forwards the license's three fragments to /license, keeping each", () => {
  const script = forwardingScript();
  for (const hash of ["#license", "#license-terms", "#sblgnt-disclaimer"]) {
    assert.equal(landing(script, hash), `/license/${hash}`, hash);
  }
});

test("/read leaves every other address alone", () => {
  const script = forwardingScript();
  for (const hash of ["", "#", "#ch-3", "#licence", "#license-terms-x", "#LICENSE", "#main"]) {
    assert.equal(landing(script, hash), null, hash || "(no hash)");
  }
});

test("/read's forwarding never throws, even where location can't be read", () => {
  const script = forwardingScript();
  assert.doesNotThrow(() => runInNewContext(script, {}));
});

test("/license holds the three ids the old fragments name", () => {
  const page = read("src/pages/license.astro");
  for (const id of ["license", "license-terms", "sblgnt-disclaimer"]) {
    assert.ok(new RegExp(`\\sid="${id}"`).test(page), `license.astro has id="${id}"`);
  }
});

/** Every file under a directory of the repo, as repo-relative paths. */
function walk(dir) {
  return readdirSync(join(repo, dir), { withFileTypes: true }).flatMap((e) => {
    const rel = `${dir}/${e.name}`;
    return e.isDirectory() ? walk(rel) : [rel];
  });
}

test("nothing the site serves or links from still points at /read#license", () => {
  // The records (STUDY-DESK*.md, FIXLIST.md, the audits) keep the old
  // address as history, and it forwards; everything else moved (FP-21).
  // license.astro names the old addresses in the comment that explains them.
  const files = [
    ...walk("src").filter((rel) => rel !== "src/pages/license.astro"),
    "LICENSE",
    "CONTRIBUTING.md",
    "README.md",
    "public/llms.txt",
    "public/llms-full.txt",
  ];
  const old = /\/read\/?#(license|license-terms|sblgnt-disclaimer)\b/;
  const left = files.filter((rel) => old.test(read(rel)));
  assert.deepEqual(left, []);
});

// ---------- Read View's /read/<book> (Phase 4, WB-44) ----------

const redirectScript = pathToFileURL(join(repo, "src/scripts/read-view-redirect.js")).href;
let run = 0;

/**
 * Runs /read/<book>'s own page script (read-view-redirect.js) at an address,
 * as the browser would; returns where `location.replace` sent the reader, or
 * null. Each run imports a fresh copy of the module.
 */
async function forwardsTo(pathname, hash = "") {
  let to = null;
  globalThis.window = {
    location: {
      pathname,
      hash,
      replace(url) {
        to = url;
      },
    },
  };
  try {
    await import(`${redirectScript}?run=${++run}`);
  } finally {
    delete globalThis.window;
  }
  return to;
}

/** `/john-3/` (and any `#fragment`) names a chapter page the build makes. */
function isChapterPage(address) {
  const m = /^\/([a-z0-9]+)-(\d+)\/(#[\w-]+)?$/.exec(address ?? "");
  return Boolean(m) && existsSync(join(repo, `src/data/chapters/${m[1]}-${m[2]}.json`));
}

test("/read/<book> forwards every book to its first chapter, with or without the slash", async () => {
  for (const book of BOOK_ORDER) {
    for (const path of [`/read/${book}/`, `/read/${book}`]) {
      const to = await forwardsTo(path);
      assert.equal(to, `/${book}-1/`, path);
      assert.ok(isChapterPage(to), `${to} is a chapter page`);
    }
  }
});

test("/read/<book>#ch-N lands on that chapter's page, every chapter of every book", async () => {
  for (const book of BOOK_ORDER) {
    for (let n = 1; n <= BOOKS[book]; n++) {
      const to = await forwardsTo(`/read/${book}/`, `#ch-${n}`);
      assert.equal(to, `/${book}-${n}/`, `${book} #ch-${n}`);
      assert.ok(isChapterPage(to), `${to} is a chapter page`);
    }
  }
});

test("/read/<book> keeps a verse or block anchor, and a missing chapter falls back to the book's start", async () => {
  assert.equal(await forwardsTo("/read/luke/", "#luke-10-v25"), "/luke-10/#v25");
  assert.equal(await forwardsTo("/read/john/", "#john-3-v16b"), "/john-3/#v16b");
  assert.equal(await forwardsTo("/read/john/", "#john-8-p9"), "/john-8/#john-8-p9");
  assert.equal(await forwardsTo("/read/john/", "#ch-22"), "/john-1/");
  assert.equal(await forwardsTo("/read/john/", "#somewhere"), "/john-1/");
});

test("the script leaves every address that isn't /read/<book> alone", async () => {
  for (const path of ["/read/", "/read", "/john-3/", "/read/john/3/", "/read/johnny/", "/"]) {
    assert.equal(await forwardsTo(path, "#ch-3"), null, path);
  }
});

test("/read/<book> is built for every book, runs that script, and works without it", () => {
  const page = read("src/pages/read/[book].astro");
  assert.match(page, /BOOK_ORDER\.filter\(/, "its paths are every book in BOOK_ORDER");
  assert.match(page, /import\s+"\.\.\/\.\.\/scripts\/read-view-redirect\.js";/, "the page runs the forwarding script");
  assert.match(page, /<noscript><meta http-equiv="refresh" content=\{`0; url=\$\{first\}`\} \/><\/noscript>/, "a meta refresh without scripts");
  assert.match(page, /const first = `\/\$\{bookKey\}-1\/`;/, "the fallback is the book's first chapter");
  assert.match(page, /<meta name="robots" content="noindex" \/>/, "never indexed");
  assert.match(page, /<a href=\{first\}>/, "a plain link for anyone the refresh doesn't move");
});
