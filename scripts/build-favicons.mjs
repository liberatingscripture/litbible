#!/usr/bin/env node
/**
 * build-favicons.mjs — regenerates the favicon / touch-icon / manifest-icon set
 * from the two committed emblem SVGs in public/images/.
 *
 * Deliberately NOT part of `npm run build`: the outputs are committed static
 * files that only change when the emblem changes. Run it by hand
 * (`npm run build:favicons`) after editing lit-logo-2026*.svg, so the whole set
 * stays derived from one source instead of drifting apart — the previous emblem
 * lived as a raster master AND a separate hand-vectorized favicon, and the two
 * were maintained independently.
 *
 * Which variant goes where:
 *   - Tab favicons (svg / 32px png / ico) use the PLAIN variant. The ringed
 *     variant's band is a sub-pixel hairline below ~24px and just costs the
 *     glyph size it eats.
 *   - Touch and manifest icons use the RINGED variant, which reads as a
 *     contained mark at those sizes.
 *
 * Backgrounds: tab favicons keep transparent corners (they sit on browser
 * chrome of unknown color). apple-touch-icon and the maskable manifest icon are
 * flattened onto the disc's own #FAFAF8, because a home-screen tile with
 * transparency renders its corners black. The maskable 512 additionally holds
 * the mark inside the 80% safe zone the spec requires.
 */

import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const PUB = path.join(ROOT, "public");

const PLAIN = path.join(PUB, "images", "lit-logo-2026.svg");
const RINGED = path.join(PUB, "images", "lit-logo-2026-ring.svg");
const FIELD = "#FAFAF8"; // the disc's own fill, used where transparency can't go

/** Render an emblem SVG to a square PNG buffer at `size`. */
function render(src, size, background) {
  let pipe = sharp(src, { density: 1200 }).resize(size, size);
  if (background) pipe = pipe.flatten({ background });
  return pipe.png({ compressionLevel: 9 }).toBuffer();
}

/**
 * Minimal ICO writer. An .ico is a 6-byte header, one 16-byte directory entry
 * per image, then the image payloads — which modern decoders accept as raw PNG,
 * so each entry is just a PNG we already rendered.
 */
function ico(images) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(images.length, 4);

  const dir = Buffer.alloc(16 * images.length);
  let offset = header.length + dir.length;
  images.forEach(({ size, data }, i) => {
    const e = 16 * i;
    dir.writeUInt8(size >= 256 ? 0 : size, e); // width
    dir.writeUInt8(size >= 256 ? 0 : size, e + 1); // height
    dir.writeUInt8(0, e + 2); // palette size
    dir.writeUInt8(0, e + 3); // reserved
    dir.writeUInt16LE(1, e + 4); // color planes
    dir.writeUInt16LE(32, e + 6); // bits per pixel
    dir.writeUInt32LE(data.length, e + 8);
    dir.writeUInt32LE(offset, e + 12);
    offset += data.length;
  });

  return Buffer.concat([header, dir, ...images.map((i) => i.data)]);
}

const out = (name, buf) => {
  writeFileSync(path.join(PUB, name), buf);
  console.log(`  ${name} — ${buf.length.toLocaleString()} bytes`);
};

console.log("build-favicons: regenerating from public/images/lit-logo-2026*.svg");

// Tab favicons — plain variant, transparent.
out("favicon.svg", readFileSync(PLAIN));
out("favicon-32x32.png", await render(PLAIN, 32));
out(
  "favicon.ico",
  ico(
    await Promise.all(
      [16, 32, 48].map(async (size) => ({ size, data: await render(PLAIN, size) })),
    ),
  ),
);

// Touch / manifest icons — ringed variant.
out("apple-touch-icon.png", await render(RINGED, 180, FIELD));
out("web-app-manifest-192x192.png", await render(RINGED, 192));

// Maskable: the mark must sit inside a circle of 80% the icon's width, so the
// platform's squircle/circle crop can never clip it.
const SAFE = Math.round(512 * 0.8);
out(
  "web-app-manifest-512x512.png",
  await sharp({
    create: { width: 512, height: 512, channels: 4, background: FIELD },
  })
    .composite([
      {
        input: await render(RINGED, SAFE),
        left: Math.round((512 - SAFE) / 2),
        top: Math.round((512 - SAFE) / 2),
      },
    ])
    .png({ compressionLevel: 9 })
    .toBuffer(),
);
