// "Type" (SITE-FEATHERBOA.md): three faces, one job each. Fraunces sets
// headings, Source Sans 3 everything read, Atkinson Hyperlegible Next the
// controls, and a reading face is never a serif. Every font-family in the
// site's styles is one of the three tokens (or a monospace, the Display
// tray's own choice, or a form's inherit); Inter and Crimson Text are gone
// but from /apps and the places a later phase moves; and each face that sets
// text carries Greek and Hebrew by range, as greek-hebrew-fonts.css's rules
// say.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  repo,
  styleSources,
  scriptSources,
  declarations,
  splitTop,
  inFontFace,
  isMirrored,
} from "./helpers/featherboa-css.mjs";

// The face files themselves, and /apps, which keeps its faces inside the new
// header and footer (SITE-FEATHERBOA-BUILD.md, question 9).
const FACE_FILES = new Set([
  "src/styles/tokens.css",
  "src/styles/faces.css",
  "src/styles/greek-hebrew-fonts.css",
  "src/styles/legacy-faces.css",
  "src/styles/pages/apps-legacy.css",
]);
// Kept until the phase that moves them (SITE-FEATHERBOA-BUILD.md, Phase 1):
// paper and the verse image in Phase 8, a sheet's stored faces in Phase 11.
// Each phase deletes its lines here.
const LATER = new Map([
  ["src/styles/print.css", 8],
  ["src/scripts/desk/print-notes.js", 8],
  ["src/scripts/desk/print-link.js", 8],
  ["src/styles/desk-sheet-view.css", 11],
  ["src/styles/pages/sheets-page.css", 11],
  ["src/lib/desk-sheet-doc.mjs", 11],
  ["src/lib/desk-sheet-copy.mjs", 11],
  ["src/lib/desk-doc-docx.mjs", 11],
  ["src/lib/desk-doc-odt.mjs", 11],
  ["src/lib/desk-doc-rtf.mjs", 11],
  ["src/lib/desk-slides-pptx.mjs", 11],
  ["src/lib/desk-slides-odp.mjs", 11],
  ["src/scripts/desk/sheets/sheet-slides.js", 11],
]);
const exempt = (rel) => isMirrored(rel) || FACE_FILES.has(rel) || LATER.has(rel);

const TOKENS = /^var\(--font-(display|text|control)\)$/;
const allowed = (value) =>
  TOKENS.test(value) ||
  value === "inherit" ||
  /\bmonospace$/.test(value) ||
  // The Display tray's choice, set on every element with !important.
  /^'(OpenDyslexic|Atkinson Hyperlegible Next Variable)', sans-serif$/.test(value) ||
  // The Study Desk's margin-note face, which leaves in Phase 4 ("The reading
  // page": the notes follow the Display face).
  /^var\(--desk-note-font\b/.test(value);

test("every font-family is one of the three faces (TY-01: no serif on reading text)", () => {
  const bad = [];
  for (const { rel, css } of styleSources()) {
    if (exempt(rel)) continue;
    for (const d of declarations(css)) {
      if (inFontFace(d.context)) continue;
      if (d.prop === "font-family" && !allowed(d.value)) bad.push(`${rel}:${d.line} ${d.value}`);
      // The margin-note face's own stack: Playpen Sans, then the text face.
      if (d.prop === "--desk-note-font" && !/^("Playpen Sans", )?var\(--font-text\)$/.test(d.value)) {
        bad.push(`${rel}:${d.line} --desk-note-font: ${d.value}`);
      }
      if (d.prop === "font" && /\b(Inter|Crimson|Georgia|serif)\b/.test(d.value.replace(/sans-serif/g, ""))) {
        bad.push(`${rel}:${d.line} font: ${d.value}`);
      }
    }
  }
  assert.deepEqual(bad, []);
});

test("Inter, Crimson Text, and the static Fraunces leave every page but /apps", () => {
  const bad = [];
  const OLD = /(["'`]|\b)(Inter|Inter Fallback|Crimson Text|Crimson Fallback|Fraunces)(["'`,]|\s+\d)/;
  for (const { rel, css } of styleSources()) {
    if (exempt(rel)) continue;
    for (const d of declarations(css)) if (OLD.test(d.value)) bad.push(`${rel}:${d.line} ${d.prop}: ${d.value}`);
  }
  for (const { rel, text } of scriptSources()) {
    if (exempt(rel) || !/\.(js|mjs)$/.test(rel)) continue;
    const code = text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    for (const m of code.matchAll(/["'`][^"'`\n]*\b(Inter|Crimson Text)\b[^"'`\n]*["'`]/g)) bad.push(`${rel}: ${m[0]}`);
  }
  assert.deepEqual(bad, []);
});

test("Literata waits for the Sheets (Phase 11): no face names it yet", () => {
  const bad = [];
  for (const { rel, css } of styleSources()) {
    for (const d of declarations(css)) if (/Literata/.test(d.value)) bad.push(`${rel}:${d.line}`);
  }
  assert.deepEqual(bad, []);
});

// ---------- the faces' files ----------

/** @font-face rules of a stylesheet: { family, weight, style, range, src }. */
function faces(rel) {
  const css = readFileSync(join(repo, rel), "utf8");
  const out = [];
  let cur = null;
  for (const d of declarations(css)) {
    if (!inFontFace(d.context)) continue;
    if (d.prop === "font-family") {
      cur = { family: d.value.replace(/^["']|["']$/g, ""), weight: "", style: "normal", range: "", src: "" };
      out.push(cur);
    } else if (cur) {
      if (d.prop === "font-weight") cur.weight = d.value;
      if (d.prop === "font-style") cur.style = d.value;
      if (d.prop === "unicode-range") cur.range = d.value;
      if (d.prop === "src") cur.src = d.value;
    }
  }
  return out;
}

test("the three tokens name the faces the site declares, and their fallbacks", () => {
  const declared = new Set(faces("src/styles/faces.css").map((f) => f.family));
  const tokens = readFileSync(join(repo, "src/styles/tokens.css"), "utf8");
  for (const family of ["Fraunces Variable", "Source Sans 3 Variable"]) {
    assert.ok(declared.has(family), `faces.css declares ${family}`);
  }
  for (const fallback of ["Fraunces Variable Fallback", "Source Sans 3 Fallback", "Atkinson Hyperlegible Next Fallback"]) {
    assert.ok(declared.has(fallback), `faces.css declares ${fallback}`);
    assert.ok(tokens.includes(`"${fallback}"`), `tokens.css names ${fallback}`);
  }
  // Fraunces is the variable font, with its softness and wonk.
  const fraunces = faces("src/styles/faces.css").filter((f) => f.family === "Fraunces Variable");
  assert.ok(fraunces.length >= 2, "Fraunces, upright and italic");
  for (const f of fraunces) assert.match(f.src, /fraunces-latin-full-(normal|italic)\.woff2/, "the full file, which carries SOFT and WONK");
});

test("Greek and Hebrew reach every face that sets text, at the descriptors the family has", () => {
  const latin = faces("src/styles/faces.css");
  const extra = faces("src/styles/greek-hebrew-fonts.css");
  // A range reaching into the Greek block, or the Hebrew one.
  const GREEK = /U\+03[7-9A-F][0-9A-F]/i;
  const HEBREW = /U\+05[9A-F][0-9A-F]/i;
  // [family, the weights its Latin faces have]
  const families = [
    ["Source Sans 3 Variable", latin.filter((f) => f.family === "Source Sans 3 Variable" && !/27E6/.test(f.range)).map((f) => f.weight)],
    ["Fraunces Variable", latin.filter((f) => f.family === "Fraunces Variable").map((f) => f.weight)],
    ["Atkinson Hyperlegible Next Variable", ["200 800"]],
    ["OpenDyslexic", ["400", "700"]],
  ];
  for (const [family, weights] of families) {
    const own = [...latin, ...extra].filter((f) => f.family === family);
    for (const [script, range] of [["Greek", GREEK], ["Hebrew", HEBREW]]) {
      for (const style of ["normal", "italic"]) {
        const hits = own.filter((f) => range.test(f.range) && f.style === style);
        assert.ok(hits.length, `${family} ${style} has ${script}`);
        for (const h of hits) assert.ok(weights.includes(h.weight), `${family} ${script} ${style} at ${h.weight}, a weight its Latin has (${weights})`);
      }
    }
  }
  // Every range is written out: no Greek or Hebrew file without one.
  for (const f of extra) assert.ok(f.range, `${f.family} ${f.src} has a unicode-range`);
});

test("splitTop keeps a stack whole", () => {
  assert.deepEqual(splitTop('"A B", var(--x, "C"), serif'), ['"A B"', 'var(--x, "C")', "serif"]);
});
