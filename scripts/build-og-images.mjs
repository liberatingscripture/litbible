#!/usr/bin/env node
/**
 * build-og-images.mjs — per-chapter / per-intro social share cards.
 *
 * Generates public/og/<slug>.png (1200×630) for every chapter page
 * (john-3.png) and every book intro (john-intro.png). Wired into the build
 * before `astro build`; [slug].astro and [book]-intro.astro reference the
 * files via Layout's ogImage prop. A website asset, NOT part of the app
 * contract — it must never move under public/api/.
 *
 * Design (owner-approved 2026-07-09, FIXLIST F3; reworked 2026-07-19 for
 * legibility when the card is scaled down to a phone-sized link preview).
 * One full-card composition on an ink field, so nothing floats in dead space:
 *   - Top-left brand lockup: the real logo (public/images/lit-logo.png) in a
 *     brand-green ring, with the wordmark line (Inter) beside it.
 *   - Hero reference in Fraunces (display cut, opsz 144), shrunk to fit the
 *     full card width, so short refs ("John 3") render large and the longest
 *     ("2 Thessalonians 3") still fills the line.
 *   - Green accent bar under the reference; litbible.net bottom-right.
 * Intro cards set "Intro" in green where the chapter number would sit.
 *
 * Rendering: text is converted to SVG paths with opentype.js using fonts
 * committed under scripts/og/fonts/ (see the README there), then sharp
 * rasterizes the SVG — no system-font or network dependency, so output is
 * deterministic and identical across machines/CI.
 */

import { mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import opentype from "opentype.js";
import sharp from "sharp";
import { BOOKS, bookKeyToLabel } from "../src/data/books.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const OUT_DIR = path.join(ROOT, "public", "og");

const WIDTH = 1200;
const HEIGHT = 630;

const INK = "#1D231C";
const GREEN = "#209D50";
const GREEN_LIGHT = "#3abf6a";
const CREAM_BRIGHT = "#F2F0E9";
const CREAM = "#E1DFD9";

const WORDMARK = "The Liberation & Inclusion Translation";
const SITE = "litbible.net";

function loadFont(file) {
  const buf = readFileSync(path.join(__dirname, "og", "fonts", file));
  return opentype.parse(
    buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength),
  );
}

const fraunces = loadFont("fraunces-opsz144-500.ttf");
const inter = loadFont("inter-400.ttf");

/**
 * Serialize an opentype Path to SVG path data. We do NOT use opentype's own
 * `path.toPathData()` because it has a number-formatting bug that emits the
 * literal string "NaN" for some finite control points at certain font
 * size / x-origin combinations (e.g. "John " at 200px, x=90). The SVG
 * rasterizer then silently stops parsing the path at that token, dropping
 * every glyph after it. The Path command coordinates themselves are always
 * finite, so formatting them here sidesteps the bug entirely.
 */
function pathData(path, prec = 2) {
  const f = (n) => {
    if (!Number.isFinite(n)) throw new Error(`non-finite path coord: ${n}`);
    return Number(n.toFixed(prec)).toString();
  };
  let d = "";
  for (const c of path.commands) {
    if (c.type === "M") d += `M${f(c.x)} ${f(c.y)}`;
    else if (c.type === "L") d += `L${f(c.x)} ${f(c.y)}`;
    else if (c.type === "C")
      d += `C${f(c.x1)} ${f(c.y1)} ${f(c.x2)} ${f(c.y2)} ${f(c.x)} ${f(c.y)}`;
    else if (c.type === "Q") d += `Q${f(c.x1)} ${f(c.y1)} ${f(c.x)} ${f(c.y)}`;
    else if (c.type === "Z") d += "Z";
  }
  return d;
}

function textPath(font, text, x, y, size, attrs = "") {
  const d = pathData(font.getPath(text, x, y, size));
  return `<path d="${d}" ${attrs}/>`;
}

function width(font, text, size) {
  return font.getAdvanceWidth(text, size);
}

/**
 * The emblem is the real logo (public/images/lit-logo.png — dark-green disc
 * with the white globe/flame/laurels/book line-art), composited by sharp
 * into the green ring after the SVG rasterizes. Sits in the top-left brand
 * lockup; the diameter leaves a small gap inside the ring stroke.
 */
const EMBLEM = { cx: 150, cy: 116, r: 60, d: 104 };

const logoBuffers = new Map();
function logoAt(d) {
  if (!logoBuffers.has(d)) {
    logoBuffers.set(
      d,
      sharp(path.join(ROOT, "public", "images", "lit-logo.png"))
        .resize(d, d)
        .png()
        .toBuffer(),
    );
  }
  return logoBuffers.get(d);
}

/**
 * Build one card. `suffix` is the chapter number (cream) or "Intro" (green).
 * The reference renders as two path segments (book label, then suffix) so
 * the intro cards can color the suffix without a second layout. Returns the
 * SVG plus the emblem placement for the logo composite.
 */
function cardSVG(label, suffix, suffixFill) {
  const seg1 = `${label} `;
  const shared = `<rect width="${WIDTH}" height="${HEIGHT}" fill="${INK}"/>`;
  const e = EMBLEM;

  // Top-left brand lockup: emblem ring + wordmark, vertically centered on
  // the emblem so it reads as one unit.
  const wordmarkX = e.cx + e.r + 26;
  const lockup = `<circle cx="${e.cx}" cy="${e.cy}" r="${e.r}" fill="none" stroke="${GREEN}" stroke-width="6"/>
${textPath(inter, WORDMARK, wordmarkX, 128, 32, `fill="${CREAM}"`)}`;

  // Footer, bottom-right — anchors the corner opposite the lockup.
  const siteW = width(inter, SITE, 30);
  const footer = textPath(inter, SITE, 1110 - siteW, 582, 30, `fill="${GREEN_LIGHT}"`);

  // Hero reference: one line, shrunk to fill the full card width (x=90..1110).
  // Short refs land at MAX; the longest ("2 Thessalonians 3") shrink to fit.
  const MAX = 200;
  const MAXW = 1020;
  let size = MAX;
  while (
    size > 72 &&
    width(fraunces, seg1, size) + width(fraunces, suffix, size) > MAXW
  ) {
    size -= 2;
  }
  const seg1W = width(fraunces, seg1, size);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
${shared}
${lockup}
${textPath(fraunces, seg1, 90, 378, size, `fill="${CREAM_BRIGHT}"`)}
${textPath(fraunces, suffix, 90 + seg1W, 378, size, `fill="${suffixFill}"`)}
<rect x="94" y="452" width="180" height="10" fill="${GREEN}"/>
${footer}
</svg>`;
  return { svg, emblem: e };
}

async function renderCard(slug, label, suffix, suffixFill) {
  const { svg, emblem } = cardSVG(label, suffix, suffixFill);
  const logo = await logoAt(emblem.d);
  await sharp(Buffer.from(svg))
    .composite([
      {
        input: logo,
        left: Math.round(emblem.cx - emblem.d / 2),
        top: Math.round(emblem.cy - emblem.d / 2),
      },
    ])
    .png({ compressionLevel: 9, palette: true })
    .toFile(path.join(OUT_DIR, `${slug}.png`));
}

const jobs = [];
for (const [bookKey, chapterCount] of Object.entries(BOOKS)) {
  const label = bookKeyToLabel(bookKey);
  jobs.push([`${bookKey}-intro`, label, "Intro", GREEN]);
  for (let ch = 1; ch <= Number(chapterCount); ch++) {
    jobs.push([`${bookKey}-${ch}`, label, String(ch), CREAM_BRIGHT]);
  }
}

mkdirSync(OUT_DIR, { recursive: true });

const CONCURRENCY = 8;
const started = Date.now();
for (let i = 0; i < jobs.length; i += CONCURRENCY) {
  await Promise.all(
    jobs.slice(i, i + CONCURRENCY).map((args) => renderCard(...args)),
  );
}

console.log(
  `build-og-images: wrote ${jobs.length} cards to public/og/ in ${((Date.now() - started) / 1000).toFixed(1)}s`,
);
