// src/lib/qr-svg.mjs
//
// Draws a QR code as a small, self-contained SVG string: a white field, one
// stroked path with a horizontal run per stretch of dark modules, and a quiet
// zone of white on every side. It is the one QR drawing in the repo.
//
// Two callers share it, which is why it lives here and not in scripts/: the
// build script that writes public/images/apps-qr.svg (the QR the app
// announcement shows on a computer), and the browser, which can draw a code for
// a page on demand. Nothing in this file is Node-only, so the browser loads it
// the same way the build does. The library it wraps, qrcode-generator, is a
// runtime dependency for that reason.
//
// The output is deterministic: the same text, level and quiet zone always give
// the same bytes, so a committed file only moves when the address does.

import qrcode from "qrcode-generator";

// The characters that have to be escaped to sit inside an SVG text node or a
// double-quoted attribute.
const ESCAPES = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" };

function escapeXml(text) {
  return String(text).replace(/[&<>"]/g, (ch) => ESCAPES[ch]);
}

/**
 * @param {string} text   what the code encodes (a URL, usually)
 * @param {object} [opts]
 * @param {string} [opts.title]  the SVG <title>; defaults to "QR code for <text>"
 * @param {number} [opts.quiet]  white modules on every side (the QR spec asks for 4)
 * @param {"L"|"M"|"Q"|"H"} [opts.level]  error-correction level
 * @returns {string} the SVG document, ending in a newline
 */
export function qrSvg(text, { title, quiet = 4, level = "M" } = {}) {
  const qr = qrcode(0, level); // smallest version that fits
  qr.addData(text);
  qr.make();

  const count = qr.getModuleCount();
  const size = count + quiet * 2;

  // One stroked path, one horizontal run per stretch of dark modules (drawn
  // through the middle of the row), so the file stays small.
  let d = "";
  for (let row = 0; row < count; row++) {
    for (let col = 0; col < count; ) {
      if (!qr.isDark(row, col)) {
        col++;
        continue;
      }
      const start = col;
      while (col < count && qr.isDark(row, col)) col++;
      d += `M${start + quiet} ${row + quiet + 0.5}h${col - start}`;
    }
  }

  const label = title ?? `QR code for ${text}`;

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges">` +
    `<title>${escapeXml(label)}</title>` +
    `<rect width="${size}" height="${size}" fill="#fff"/>` +
    `<path stroke="#000" d="${d}"/>` +
    `</svg>\n`
  );
}
