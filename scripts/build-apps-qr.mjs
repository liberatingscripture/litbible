#!/usr/bin/env node
/**
 * build-apps-qr.mjs — regenerates public/images/apps-qr.svg, the QR code the
 * app announcement (src/components/AppsLaunchPopover.astro) shows on a
 * computer, so a reader can point their phone at it and land on /apps.
 *
 * Deliberately NOT part of `npm run build`, the same arrangement as
 * build:favicons: the output is a committed static file that only changes
 * when the address does. Run it by hand (`npm run build:apps-qr`) after
 * changing APPS_URL.
 *
 * The address is the plain canonical URL, with no tracking parameter
 * (owner, 2026-09-28). The SVG carries its own four-module quiet zone, which
 * the QR spec asks for, so the page can set it on any background.
 */

import { writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import qrcode from "qrcode-generator";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(__dirname, "..", "public", "images", "apps-qr.svg");

const APPS_URL = "https://litbible.net/apps/";
const QUIET = 4; // modules of white on every side

const qr = qrcode(0, "M"); // smallest version that fits, medium error correction
qr.addData(APPS_URL);
qr.make();

const count = qr.getModuleCount();
const size = count + QUIET * 2;

// One stroked path, one horizontal run per stretch of dark modules (drawn
// through the middle of the row), so the file stays small and its bytes only
// move when the code does.
let d = "";
for (let row = 0; row < count; row++) {
  for (let col = 0; col < count; ) {
    if (!qr.isDark(row, col)) {
      col++;
      continue;
    }
    const start = col;
    while (col < count && qr.isDark(row, col)) col++;
    d += `M${start + QUIET} ${row + QUIET + 0.5}h${col - start}`;
  }
}

const svg =
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges">` +
  `<title>QR code for ${APPS_URL}</title>` +
  `<rect width="${size}" height="${size}" fill="#fff"/>` +
  `<path stroke="#000" d="${d}"/>` +
  `</svg>\n`;

writeFileSync(OUT, svg);
console.log(`Wrote ${path.relative(process.cwd(), OUT)}: ${count}×${count} modules for ${APPS_URL}`);
