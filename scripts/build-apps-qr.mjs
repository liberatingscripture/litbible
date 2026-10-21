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
 * The drawing itself is src/lib/qr-svg.mjs, which the browser can load too.
 *
 * The address is the plain canonical URL, with no tracking parameter
 * (owner, 2026-09-28). The SVG carries its own four-module quiet zone, which
 * the QR spec asks for, so the page can set it on any background.
 */

import { writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { qrSvg } from "../src/lib/qr-svg.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(__dirname, "..", "public", "images", "apps-qr.svg");

const APPS_URL = "https://litbible.net/apps/";
const QUIET = 4; // modules of white on every side

const svg = qrSvg(APPS_URL, { quiet: QUIET, level: "M" }); // medium error correction
writeFileSync(OUT, svg);

// The module count is the viewBox less the two quiet zones, for the message.
const size = Number(svg.match(/viewBox="0 0 (\d+)/)[1]);
const count = size - QUIET * 2;
console.log(`Wrote ${path.relative(process.cwd(), OUT)}: ${count}×${count} modules for ${APPS_URL}`);
