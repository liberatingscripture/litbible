// Post-build internal link checker. Walks the built site in dist/ and verifies
// that every INTERNAL href points at a page/asset that actually exists, and
// that any #fragment resolves to a real element id on the target page. No
// network requests — this only reads dist/, so it's fast and CI-safe.
//
// Run AFTER `npm run build` (it needs dist/). Wired into CI as
// `npm run check:links`. Exits 1 with a grouped report when links are broken.
//
// Resolution mirrors Astro's directory build format:
//   /            -> dist/index.html
//   /about       -> dist/about/index.html      (trailing slash tolerated)
//   /read/john   -> dist/read/john/index.html
//   /rss.xml     -> dist/rss.xml               (exact file for assets)
// Fragments are checked against the id/name attributes of the resolved target
// page; same-page fragment-only hrefs (#faq) resolve against the linking page.

import { promises as fs } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const DIST = path.join(ROOT, "dist");

// Fragments that are always valid without a matching element: empty (#, top of
// page) and the special "top" keyword (browsers scroll to the top when no such
// element exists).
const ALWAYS_VALID_FRAGMENTS = new Set(["", "top"]);

/** Recursively collect every *.html file under dir (posix-style absolute paths). */
async function walkHtml(dir) {
  const out = [];
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...(await walkHtml(full)));
    } else if (entry.isFile() && entry.name.endsWith(".html")) {
      out.push(full);
    }
  }
  return out;
}

/** Pull every href attribute value out of an HTML string. */
function extractHrefs(html) {
  const hrefs = [];
  const re = /\bhref\s*=\s*("([^"]*)"|'([^']*)')/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    hrefs.push(m[2] !== undefined ? m[2] : m[3]);
  }
  return hrefs;
}

/** Collect all id="…" / id='…' and name="…" values from an HTML string. */
function extractIds(html) {
  const ids = new Set();
  const re = /\b(?:id|name)\s*=\s*("([^"]*)"|'([^']*)')/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    const val = m[2] !== undefined ? m[2] : m[3];
    if (val) ids.add(val);
  }
  return ids;
}

/**
 * Classify an href. Returns null for anything we don't check (external,
 * mailto:, tel:, javascript:, protocol-relative //host, other hosts), or
 * `{ pathname, fragment }` for an internal link. `pathname` is null for a
 * same-page fragment-only href (#foo).
 */
function classify(href) {
  const raw = href.trim();
  if (!raw) return null;

  // Same-page fragment-only link.
  if (raw.startsWith("#")) {
    return { pathname: null, fragment: decodeFragment(raw.slice(1)) };
  }

  // Protocol-relative (//host/…) is external.
  if (raw.startsWith("//")) return null;

  // Absolute URLs: only litbible.net is internal; reduce to its pathname.
  if (/^[a-z][a-z0-9+.-]*:/i.test(raw)) {
    let url;
    try {
      url = new URL(raw);
    } catch {
      return null;
    }
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    if (url.hostname !== "litbible.net") return null;
    return { pathname: url.pathname, fragment: decodeFragment(url.hash.slice(1)) };
  }

  // Root-relative internal link.
  if (raw.startsWith("/")) {
    const hashIdx = raw.indexOf("#");
    const fragment = hashIdx === -1 ? "" : decodeFragment(raw.slice(hashIdx + 1));
    let pathname = hashIdx === -1 ? raw : raw.slice(0, hashIdx);
    // Strip a defensive query string (none exist today, but be safe).
    const qIdx = pathname.indexOf("?");
    if (qIdx !== -1) pathname = pathname.slice(0, qIdx);
    return { pathname, fragment };
  }

  // Anything else (bare relative like "foo/bar" — the site doesn't emit these).
  return null;
}

function decodeFragment(frag) {
  try {
    return decodeURIComponent(frag);
  } catch {
    return frag;
  }
}

/**
 * Resolve an internal pathname to the dist file that serves it, or null if
 * nothing matches. Mirrors Astro's directory build format.
 */
async function resolveTargetFile(pathname) {
  const clean = pathname.replace(/\/+$/, ""); // drop trailing slash(es)
  const rel = decodeURIComponent(clean.replace(/^\/+/, "")); // strip leading slash

  if (rel === "") return path.join(DIST, "index.html"); // "/" or ""

  const base = path.join(DIST, rel);
  const candidates = [
    base, // exact file (assets: /rss.xml, /_astro/x.css)
    path.join(base, "index.html"), // directory-format page
    `${base}.html`, // flat .html page
  ];
  for (const c of candidates) {
    if (await isFile(c)) return c;
  }
  return null;
}

async function isFile(p) {
  try {
    return (await fs.stat(p)).isFile();
  } catch {
    return false;
  }
}

async function main() {
  if (!(await isDir(DIST))) {
    console.error(
      "check-links: dist/ not found — run `npm run build` first.",
    );
    process.exit(1);
  }

  const htmlFiles = await walkHtml(DIST);

  // Cache: resolved dist file -> Set of ids (lazy). The linking pages we scan
  // are already keyed by their own path, so same-page fragments reuse this too.
  const idCache = new Map();
  const idsFor = async (file) => {
    if (idCache.has(file)) return idCache.get(file);
    const html = await fs.readFile(file, "utf8");
    const ids = extractIds(html);
    idCache.set(file, ids);
    return ids;
  };

  const failures = [];
  let linksChecked = 0;

  for (const file of htmlFiles) {
    const rel = path.relative(DIST, file).replace(/\\/g, "/");
    const html = await fs.readFile(file, "utf8");
    // Seed the id cache for this file so same-page fragments don't re-read it.
    if (!idCache.has(file)) idCache.set(file, extractIds(html));

    for (const href of extractHrefs(html)) {
      const link = classify(href);
      if (!link) continue;
      linksChecked++;

      // Determine the target file.
      let targetFile;
      if (link.pathname === null) {
        targetFile = file; // same-page fragment
      } else {
        targetFile = await resolveTargetFile(link.pathname);
        if (!targetFile) {
          failures.push({
            source: rel,
            href,
            reason: `target page not found (${link.pathname})`,
          });
          continue;
        }
      }

      // Fragment check.
      if (link.fragment && !ALWAYS_VALID_FRAGMENTS.has(link.fragment.toLowerCase())) {
        const ids = await idsFor(targetFile);
        if (!ids.has(link.fragment)) {
          const where =
            link.pathname === null
              ? "this page"
              : path.relative(DIST, targetFile).replace(/\\/g, "/");
          failures.push({
            source: rel,
            href,
            reason: `no element #${link.fragment} in ${where}`,
          });
        }
      }
    }
  }

  if (failures.length) {
    // Group by source page for a readable report.
    const bySource = new Map();
    for (const f of failures) {
      if (!bySource.has(f.source)) bySource.set(f.source, []);
      bySource.get(f.source).push(f);
    }
    console.error(
      `\ncheck-links: ${failures.length} broken internal link(s) in ${bySource.size} page(s):\n`,
    );
    for (const src of [...bySource.keys()].sort()) {
      console.error(`  ${src}`);
      for (const f of bySource.get(src)) {
        console.error(`    ✗ ${f.href}\n        ${f.reason}`);
      }
    }
    console.error(
      `\nScanned ${htmlFiles.length} pages, checked ${linksChecked} internal links.`,
    );
    process.exit(1);
  }

  console.log(
    `check-links: OK — scanned ${htmlFiles.length} pages, checked ${linksChecked} internal links, no broken targets or fragments.`,
  );
}

async function isDir(p) {
  try {
    return (await fs.stat(p)).isDirectory();
  } catch {
    return false;
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
