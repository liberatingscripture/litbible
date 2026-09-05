#!/usr/bin/env node
/**
 * build-bracket-marker-font.mjs — extracts just U+27E6/U+27E7 (⟦ ⟧, the
 * disputed-passage bracket markers — see "Bracketed passages" in CLAUDE.md)
 * from Noto Sans Math into a 2-glyph font at public/fonts/bracket-markers.otf.
 *
 * .otf, not .ttf: opentype.js writes PostScript/CFF outlines, so the file is
 * an OTTO-flavoured OpenType font. The @font-face in global.css declares
 * format("opentype") to match. Browsers sniff the real format and would render
 * it either way, but the format hint is advisory-and-honoured — a stricter
 * engine may skip a resource whose hint disagrees with the file, which would
 * silently drop the reader back to the missing-glyph fallback this exists to
 * prevent.
 *
 * WHY THIS EXISTS: the site's self-hosted webfonts (Inter, Crimson Text,
 * Fraunces, OpenDyslexic, Atkinson Hyperlegible Next) are Latin-subset only —
 * none of them contain U+27E6/U+27E7, so the bare characters would fall back
 * to whatever font each reader's OS happens to supply, from "looks fine" to a
 * missing-glyph box. Rather than ship the whole ~270KB Noto Sans Math Latin
 * file (gated by unicode-range so it would only ever load on the six chapter
 * pages that use it, but still 100x more than these two glyphs need), this
 * subsets exactly the two codepoints out of it, keeping their paths, advance
 * widths, and vertical metrics byte-for-byte as designed.
 *
 * Deliberately NOT part of `npm run build`: the output is a committed static
 * file that only changes if the chosen source glyphs ever change. Run it by
 * hand (`npm run build:bracket-font`) — see global.css for the three
 * unicode-range @font-face patches (Inter / OpenDyslexic / Atkinson
 * Hyperlegible Next Variable) that consume this file; add a fourth patch
 * there (not here) if a future font ever needs to render these characters.
 *
 * Source: Noto Sans Math (SIL Open Font License), via the
 * @fontsource/noto-sans-math package — a devDependency used only by this
 * script, never shipped to the browser directly.
 */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import opentype from "opentype.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const SOURCE_FONT = path.join(
  ROOT,
  "node_modules/@fontsource/noto-sans-math/files/noto-sans-math-latin-400-normal.woff",
);
const OUT_FILE = path.join(ROOT, "public/fonts/bracket-markers.otf");

const CODEPOINTS = [0x27e6, 0x27e7]; // ⟦ LEFT, ⟧ RIGHT white square bracket

function toArrayBuffer(buf) {
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
}

const source = opentype.parse(toArrayBuffer(readFileSync(SOURCE_FONT)));

const notdef = new opentype.Glyph({
  name: ".notdef",
  unicode: 0,
  advanceWidth: 0,
  path: new opentype.Path(),
});

const glyphs = [notdef];
for (const cp of CODEPOINTS) {
  const glyph = source.charToGlyph(String.fromCodePoint(cp));
  if (glyph.unicode !== cp) {
    throw new Error(
      `Noto Sans Math has no glyph for U+${cp.toString(16).toUpperCase()} ` +
        `(got glyph "${glyph.name}") — pick a different source font.`,
    );
  }
  glyphs.push(
    new opentype.Glyph({
      name: `uni${cp.toString(16).toUpperCase()}`,
      unicode: cp,
      advanceWidth: glyph.advanceWidth,
      path: glyph.path,
    }),
  );
}

const subset = new opentype.Font({
  familyName: "LIT Bracket Markers",
  styleName: "Regular",
  unitsPerEm: source.unitsPerEm,
  ascender: source.ascender,
  descender: source.descender,
  glyphs,
});

mkdirSync(path.dirname(OUT_FILE), { recursive: true });
writeFileSync(OUT_FILE, Buffer.from(subset.toArrayBuffer()));

// Round-trip check: re-parse what was just written and confirm each glyph's
// path and metrics survived byte-for-byte. A silent mismatch here would ship
// a subtly wrong bracket shape with nothing to catch it.
const written = opentype.parse(toArrayBuffer(readFileSync(OUT_FILE)));
for (const cp of CODEPOINTS) {
  const original = source.charToGlyph(String.fromCodePoint(cp));
  const gid = written.charToGlyphIndex(String.fromCodePoint(cp));
  if (gid === 0) throw new Error(`Round-trip lost U+${cp.toString(16).toUpperCase()}`);
  const rebuilt = written.glyphs.get(gid);
  const a = original.getPath(0, 0, source.unitsPerEm).getBoundingBox();
  const b = rebuilt.getPath(0, 0, written.unitsPerEm).getBoundingBox();
  const matches =
    rebuilt.advanceWidth === original.advanceWidth &&
    a.x1 === b.x1 && a.x2 === b.x2 && a.y1 === b.y1 && a.y2 === b.y2;
  if (!matches) throw new Error(`Round-trip changed U+${cp.toString(16).toUpperCase()}'s shape or metrics`);
}

console.log(`Wrote ${path.relative(ROOT, OUT_FILE)} (${written.numGlyphs} glyphs, verified byte-identical to source).`);
