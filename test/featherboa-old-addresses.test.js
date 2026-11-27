// Featherboa's old addresses keep working (SITE-FEATHERBOA-BUILD.md, "Checks":
// "The old addresses"). Installed apps, Study, and readers' bookmarks link
// them, so each one lands where what it named went. The license's three
// fragments are here (FP-19); /read/<book> and #ch-N join in Phase 4, and the
// /notebook anchors in Phase 10.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { runInNewContext } from "node:vm";
import { repo } from "./helpers/featherboa-css.mjs";

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
