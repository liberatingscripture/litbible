#!/usr/bin/env node
/**
 * build-og-images.mjs — per-chapter / per-intro social share cards.
 *
 * Generates public/og/<slug>.png (1200×630) for every chapter page
 * (john-3.png), every book intro (john-intro.png), and the /apps promo page
 * (apps.png). Wired into the build before `astro build`; [slug].astro,
 * [book]-intro.astro and apps.astro reference the files via Layout's ogImage
 * prop. A website asset, NOT part of the app contract — it must never move
 * under public/api/.
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
 * The /apps card is a sibling composition on the same ink field, but its
 * hero visual is both platform icons (iOS's leather-book artwork and
 * Android's gradient mark, public/images/lit-app-icon*.{webp,svg} — the same
 * pair the launch popover shows) stacked vertically in rounded tiles on the
 * right, so it reads the way the icons appear on a home screen. The site
 * emblem is deliberately absent there: two logos on one card compete, and
 * the wordmark line alone carries the brand.
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
const IMAGES = path.join(ROOT, "public", "images");

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

/**
 * Fail loudly on a character the font can't render. inter-400.ttf is
 * deliberately character-subsetted (see scripts/og/fonts/README.md) and does
 * NOT carry comma, apostrophe, or any dash — opentype silently substitutes
 * .notdef, so an unguarded string ships a tofu box in a card nobody
 * re-inspects. Widen the subset or reword the card copy.
 */
function assertGlyphs(font, text) {
  const missing = [
    ...new Set([...text].filter((c) => font.charToGlyphIndex(c) === 0)),
  ];
  if (missing.length) {
    throw new Error(
      `font is missing glyphs ${JSON.stringify(missing.join(""))} for text ${JSON.stringify(text)} — ` +
        `see scripts/og/fonts/README.md`,
    );
  }
}

function textPath(font, text, x, y, size, attrs = "") {
  assertGlyphs(font, text);
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
${textPath(inter, WORDMARK, wordmarkX, 131, 44, `fill="${CREAM}"`)}`;

  // Footer, bottom-right — anchors the corner opposite the lockup.
  const siteW = width(inter, SITE, 42);
  const footer = textPath(inter, SITE, 1110 - siteW, 582, 42, `fill="${GREEN_LIGHT}"`);

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

// A rounded-corner square tile cropped (cover) from a source image.
async function roundedTile(src, sizePx, radius) {
  const base = await sharp(src)
    .resize(sizePx, sizePx, { fit: "cover", position: "centre" })
    .toBuffer();
  const mask = Buffer.from(
    `<svg width="${sizePx}" height="${sizePx}"><rect width="${sizePx}" height="${sizePx}" rx="${radius}" ry="${radius}"/></svg>`,
  );
  return sharp(base)
    .composite([{ input: mask, blend: "dest-in" }])
    .png()
    .toBuffer();
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

/**
 * The /apps share card. Text column on the left; on the right, both platform
 * icons as home-screen tiles, stacked vertically (iOS above Android) in the
 * band below the wordmark. The two are different art — iOS the leather-book
 * artwork (its own background, so `roundedTile` just needs to mask the
 * corners), Android the bare gradient mark on a tile one step lighter than
 * the field (not the popover's near-ink tile, which would disappear against
 * this background) — drawn straight into the SVG, since the icon's own 10%
 * padding keeps it clear of the rounded corners without a separate mask.
 */
function iconsLayout() {
  const size = 160;
  const gap = 24;
  const radius = 35; // ~22% of size, matching the app's own icon corners
  const x = WIDTH - 90 - size; // right edge aligned with the footer margin
  const bandTop = 150; // clears the wordmark
  const bandBottom = 540; // clears the footer
  const totalH = size * 2 + gap;
  const y = bandTop + Math.round((bandBottom - bandTop - totalH) / 2);
  return { x, y, size, gap, radius, androidY: y + size + gap };
}

function appsCardSVG() {
  const { x, y, size, radius, androidY } = iconsLayout();
  // Text column runs from the card margin to a gutter left of the icons.
  const X = 90;
  const COLW = x - 60 - X;

  // Hero shrinks to fit the column, same auto-fit rule as the chapter cards.
  let heroSize = 140;
  while (heroSize > 80 && width(fraunces, "LIT Bible", heroSize) > COLW) {
    heroSize -= 2;
  }

  const siteW = width(inter, SITE, 42);
  // The wordmark sits ABOVE the icons, so it spans the full card width and
  // can hold the chapter cards' 44px — matching them matters, because at a
  // 300px-wide phone link preview a smaller cut turns to mush.
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
<rect width="${WIDTH}" height="${HEIGHT}" fill="${INK}"/>
<rect x="${x}" y="${androidY}" width="${size}" height="${size}" rx="${radius}" fill="#262E24"/>
${textPath(inter, WORDMARK, X, 110, 44, `fill="${CREAM}"`)}
${textPath(fraunces, "LIT Bible", X, 292, heroSize, `fill="${CREAM_BRIGHT}"`)}
${textPath(inter, "for iPhone & Android", X, 356, 46, `fill="${GREEN_LIGHT}"`)}
<rect x="${X + 4}" y="400" width="180" height="10" fill="${GREEN}"/>
${textPath(inter, "A New Testament that's for everyone.", X, 482, 34, `fill="${CREAM}"`)}
${textPath(inter, SITE, 1110 - siteW, 582, 42, `fill="${GREEN_LIGHT}"`)}
</svg>`;
}

async function renderAppsCard() {
  const { x, y, size, radius, androidY } = iconsLayout();
  const pad = Math.round(size * 0.1);

  const ios = await roundedTile(
    path.join(IMAGES, "lit-app-icon-ios.webp"),
    size,
    radius,
  );

  // density: the source is a 200-unit viewBox, so rasterize well above the
  // target size and let sharp downsample — otherwise the thin gradient bands
  // alias badly.
  const androidMark = await sharp(path.join(IMAGES, "lit-app-icon.svg"), {
    density: 300,
  })
    .resize(size - pad * 2, size - pad * 2)
    .png()
    .toBuffer();

  await sharp(Buffer.from(appsCardSVG()))
    .composite([
      { input: ios, left: x, top: y },
      { input: androidMark, left: x + pad, top: androidY + pad },
    ])
    // No `palette` here (unlike the chapter cards): quantizing to 256 colours
    // bands the Android icon's gradient visibly.
    .png({ compressionLevel: 9 })
    .toFile(path.join(OUT_DIR, "apps.png"));
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
await renderAppsCard();

console.log(
  `build-og-images: wrote ${jobs.length + 1} cards to public/og/ in ${((Date.now() - started) / 1000).toFixed(1)}s`,
);
