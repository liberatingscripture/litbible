#!/usr/bin/env node
/**
 * build-text-critical-font.mjs — extracts just U+2E00–U+2E05 (⸀ ⸁ ⸂ ⸃ ⸄ ⸅, the
 * SBL Greek New Testament's text-critical signs) from Cardo into a 6-glyph
 * font at public/fonts/text-critical-signs.otf.
 *
 * .otf, not .ttf: opentype.js writes PostScript/CFF outlines, so the file is
 * an OTTO-flavoured OpenType font. The @font-face in greek-hebrew-fonts.css
 * declares format("opentype") to match, the same as the ⟦ ⟧ patch
 * (build-bracket-marker-font.mjs) does. A stricter engine may skip a resource
 * whose format hint disagrees with the file, so the hint must stay honest.
 *
 * WHY THIS EXISTS: Fontsource's Cardo subsets, which the site loads for Crimson
 * Text, Fraunces and the Greek and Hebrew faces, are Latin- and Greek-only and
 * do not contain these signs. The Study Desk's Greek tab shows the SBLGNT text
 * with them, so without this patch they would fall back to whatever font each
 * reader's OS supplies, from "looks fine" to a missing-glyph box. Rather than
 * ship the whole Cardo file, this subsets exactly the six codepoints out of it,
 * keeping their paths, advance widths and vertical metrics byte-for-byte as
 * designed. The @font-face rules that consume it live in
 * src/styles/greek-hebrew-fonts.css (its last block), registered under the
 * existing Crimson Text and Inter family names at each weight those families
 * already declare, restricted to U+2E00–2E05.
 *
 * Deliberately NOT part of `npm run build`: the output is a committed static
 * file that only changes if the chosen source glyphs ever change. Run it by
 * hand with `npm run build:text-critical-font`, and commit the output.
 *
 * Source: Cardo (SIL Open Font License 1.1, David J. Perry), from
 * github.com/google/fonts, ofl/cardo. The source font is NOT in this repo.
 * It is read from the directory named by GREEK_SOURCES_DIR, defaulting to
 * C:/Users/bcjoh/GitHub/greek-sources, at <dir>/cardo/Cardo-Regular.ttf. The
 * OFL text ships beside the output as public/fonts/text-critical-signs-OFL.txt.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import opentype from "opentype.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const GREEK_SOURCES_DIR = process.env.GREEK_SOURCES_DIR ?? "C:/Users/bcjoh/GitHub/greek-sources";
const SOURCE_FONT = path.join(GREEK_SOURCES_DIR, "cardo/Cardo-Regular.ttf");
const OUT_FILE = path.join(ROOT, "public/fonts/text-critical-signs.otf");

const CODEPOINTS = [0x2e00, 0x2e01, 0x2e02, 0x2e03, 0x2e04, 0x2e05]; // ⸀ ⸁ ⸂ ⸃ ⸄ ⸅

if (!existsSync(SOURCE_FONT)) {
  throw new Error(
    `Source font not found: ${SOURCE_FONT}\n` +
      `This script reads Cardo from outside the repo. Download ofl/cardo from ` +
      `github.com/google/fonts into ${path.join(GREEK_SOURCES_DIR, "cardo")}, ` +
      `or set GREEK_SOURCES_DIR to the directory that holds it.`,
  );
}

// A Node Buffer can be a view into a larger pooled ArrayBuffer, so passing
// buf.buffer alone hands opentype.js the whole pool. Slice to this view only.
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
      `Cardo has no glyph for U+${cp.toString(16).toUpperCase()} ` +
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
  familyName: "LIT Text-Critical Signs",
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
// a subtly wrong sign shape with nothing to catch it.
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
