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
 * Design (owner-approved 2026-07-09, FIXLIST F3): ink field, the emblem
 * line-art in a brand-green ring, the reference in Fraunces (display cut,
 * opsz 144), a green accent bar, the wordmark line in Inter, litbible.net
 * bottom-right. One switch, two compositions:
 *   - If "<Book> <N>" fits at 148px beside a left-centered emblem, it
 *     renders on that single line (most books).
 *   - Otherwise the emblem moves to the top-left corner and the reference
 *     takes the full card width on one line, shrunk to fit ("2 Thessalonians 3").
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

function textPath(font, text, x, y, size, attrs = "") {
  const d = font.getPath(text, x, y, size).toPathData(2);
  return `<path d="${d}" ${attrs}/>`;
}

function width(font, text, size) {
  return font.getAdvanceWidth(text, size);
}

/**
 * The emblem line-art (globe + flame + laurels + open book), drawn white,
 * centered on 0,0 within a nominal r=50 — the vector redraw from the
 * approved mockups. Scaled/translated per composition below.
 */
function emblemMarks(tx, ty, scale) {
  return `<g transform="translate(${tx},${ty}) scale(${scale})" fill="none" stroke="#FFFFFF">
<path d="M0,-38 C5,-32 6,-27 2,-23 C-1,-21 -5,-23 -6,-27 C-7,-31 -3,-34 0,-38 Z" fill="#FFFFFF" stroke="none"/>
<circle cx="0" cy="-2" r="17" stroke-width="3"/>
<ellipse cx="0" cy="-2" rx="8" ry="17" stroke-width="2.5"/>
<line x1="-16" y1="-8" x2="16" y2="-8" stroke-width="2.5"/>
<line x1="-16" y1="4" x2="16" y2="4" stroke-width="2.5"/>
<path d="M-25,12 C-32,0 -32,-14 -24,-25" stroke-width="3" stroke-linecap="round"/>
<path d="M25,12 C32,0 32,-14 24,-25" stroke-width="3" stroke-linecap="round"/>
<path d="M-28,18 C-16,12 -5,12 0,17 C5,12 16,12 28,18 L28,27 C16,22 5,22 0,26 C-5,22 -16,22 -28,27 Z" fill="#FFFFFF" stroke="none"/>
<rect x="-32" y="29" width="64" height="4" rx="2" fill="#FFFFFF" stroke="none"/>
</g>`;
}

/**
 * Build one card. `suffix` is the chapter number (cream) or "Intro" (green).
 * The reference renders as two path segments (book label, then suffix) so
 * the intro cards can color the suffix without a second layout.
 */
function cardSVG(label, suffix, suffixFill) {
  const seg1 = `${label} `;
  const shared = `<rect width="${WIDTH}" height="${HEIGHT}" fill="${INK}"/>`;
  const siteW = width(inter, SITE, 22);
  const footer = textPath(inter, SITE, 1100 - siteW, 580, 22, `fill="${GREEN_LIGHT}"`);

  // Short composition: emblem left-center, reference at 148px from x=350.
  const SHORT_SIZE = 148;
  const shortW =
    width(fraunces, seg1, SHORT_SIZE) + width(fraunces, suffix, SHORT_SIZE);
  if (shortW <= 750) {
    const seg1W = width(fraunces, seg1, SHORT_SIZE);
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
${shared}
<circle cx="180" cy="315" r="80" fill="none" stroke="${GREEN}" stroke-width="4"/>
${emblemMarks(180, 315, 1.3)}
${textPath(fraunces, seg1, 350, 345, SHORT_SIZE, `fill="${CREAM_BRIGHT}"`)}
${textPath(fraunces, suffix, 350 + seg1W, 345, SHORT_SIZE, `fill="${suffixFill}"`)}
<rect x="356" y="385" width="150" height="7" fill="${GREEN}"/>
${textPath(inter, WORDMARK, 356, 455, 27, `fill="${CREAM}" fill-opacity="0.7"`)}
${footer}
</svg>`;
  }

  // Long composition: emblem top-left, full-width reference shrunk to fit.
  let size = 106;
  while (
    size > 40 &&
    width(fraunces, seg1, size) + width(fraunces, suffix, size) > 990
  ) {
    size -= 2;
  }
  const seg1W = width(fraunces, seg1, size);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
${shared}
<circle cx="165" cy="135" r="58" fill="none" stroke="${GREEN}" stroke-width="3.5"/>
${emblemMarks(165, 135, 0.95)}
${textPath(fraunces, seg1, 105, 400, size, `fill="${CREAM_BRIGHT}"`)}
${textPath(fraunces, suffix, 105 + seg1W, 400, size, `fill="${suffixFill}"`)}
<rect x="110" y="437" width="150" height="7" fill="${GREEN}"/>
${textPath(inter, WORDMARK, 110, 505, 27, `fill="${CREAM}" fill-opacity="0.7"`)}
${footer}
</svg>`;
}

async function renderCard(slug, label, suffix, suffixFill) {
  const svg = cardSVG(label, suffix, suffixFill);
  await sharp(Buffer.from(svg))
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
