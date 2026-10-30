// src/lib/content-version.mjs
//
// The content `version` this build publishes (`v20261005.5d2c847d`), read at
// build time from public/api/version.json, which build:manifest writes before
// `astro build` runs. Layout.astro puts it on <html data-content-version>, so
// a Study Desk record names the text the page in front of the reader was
// built from (STUDY-DESK-FORMAT.md, `contentVersion`). The page's own build
// is the right answer even when the API has moved on since: a cached page
// still shows its own text.
//
// "unversioned" when the file isn't there (a dev server before any build).
// desk-records' compareContentVersions can't order it, so mayRewriteAnchor
// refuses to rewrite a record made against it, which is the safe side.
//
// contentUpdated() is the same file's `updatedAt`, the build's time, on
// <html data-content-updated>. The version's day is the build's UTC day, so
// a sheet's "Text as of" line reads this to name the reader's own day
// (desk-sheet-check.mjs, textDay). Null when the file isn't there.

import { readFileSync } from "node:fs";
import path from "node:path";

export const UNVERSIONED = "unversioned";

let cached = null;

function read() {
  if (cached) return cached;
  try {
    // From the working directory, as draft-chapters.mjs does: in the Astro
    // build, import.meta.url points at the output chunk.
    const file = path.resolve(process.cwd(), "public/api/version.json");
    const { version, updatedAt } = JSON.parse(readFileSync(file, "utf8"));
    cached = {
      version: typeof version === "string" && version ? version : UNVERSIONED,
      updatedAt: typeof updatedAt === "string" && updatedAt ? updatedAt : null,
    };
  } catch {
    cached = { version: UNVERSIONED, updatedAt: null };
  }
  return cached;
}

export function contentVersion() {
  return read().version;
}

export function contentUpdated() {
  return read().updatedAt;
}
