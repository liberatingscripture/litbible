// test/helpers/featherboa-css.mjs
//
// Reading the site's styles for Featherboa's rule tests (SITE-FEATHERBOA-BUILD.md,
// "New tests the build adds"): every .css file under src/ and every <style>
// block in an .astro file, walked as declarations with the rules and at-rules
// around them; and tokens.css read as two themes, its values resolved.

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

export const repo = fileURLToPath(new URL("../..", import.meta.url));

/** The /apps files are a byte-for-byte mirror of the LSC site's
 *  (src/components/apps/CLAUDE.md): the site's rules never reach them. */
export const isMirrored = (rel) =>
  rel.startsWith("src/components/apps/") || rel === "src/styles/pages/apps.css";

/** Every stylesheet under src/, as { rel, css }: .css files whole, .astro files
 *  as their <style> blocks. */
export function styleSources() {
  const out = [];
  (function walk(dir) {
    for (const e of readdirSync(join(repo, dir), { withFileTypes: true })) {
      const rel = `${dir}/${e.name}`;
      if (e.isDirectory()) walk(rel);
      else if (e.name.endsWith(".css")) out.push({ rel, css: readFileSync(join(repo, rel), "utf8") });
      else if (e.name.endsWith(".astro")) {
        const text = readFileSync(join(repo, rel), "utf8");
        const blocks = [...text.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/g)].map((m) => m[1]);
        if (blocks.length) out.push({ rel, css: blocks.join("\n") });
      }
    }
  })("src");
  return out;
}

/** Every script under src/ (.js, .mjs, and .astro files, whose scripts are
 *  inline), as { rel, text }. */
export function scriptSources() {
  const out = [];
  (function walk(dir) {
    for (const e of readdirSync(join(repo, dir), { withFileTypes: true })) {
      const rel = `${dir}/${e.name}`;
      if (e.isDirectory()) walk(rel);
      else if (/\.(js|mjs|astro)$/.test(e.name)) out.push({ rel, text: readFileSync(join(repo, rel), "utf8") });
    }
  })("src");
  return out;
}

/**
 * The declarations of a stylesheet, in order: { prop, value, important,
 * context, line }, where context is the preludes of the rules and at-rules
 * around it, outermost first. Comments are dropped; strings and parentheses
 * are kept whole.
 */
export function* declarations(css) {
  const text = css.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "));
  const stack = [];
  let buf = "";
  let start = 0;
  let paren = 0;
  let quote = "";
  let line = 1;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === "\n") line++;
    if (quote) {
      buf += ch;
      if (ch === quote) quote = "";
      continue;
    }
    if (ch === '"' || ch === "'") quote = ch;
    else if (ch === "(") paren++;
    else if (ch === ")") paren--;
    if (paren > 0 || quote) {
      buf += ch;
      continue;
    }
    if (ch === "{") {
      stack.push(buf.trim().replace(/\s+/g, " "));
      buf = "";
    } else if (ch === ";" || ch === "}") {
      const d = buf.trim();
      const colon = d.indexOf(":");
      if (colon > 0 && !d.startsWith("@") && stack.length) {
        let value = d.slice(colon + 1).trim().replace(/\s+/g, " ");
        const important = /!\s*important$/i.test(value);
        if (important) value = value.replace(/\s*!\s*important$/i, "");
        yield { prop: d.slice(0, colon).trim().toLowerCase(), value, important, context: [...stack], line: start };
      }
      if (ch === "}") stack.pop();
      buf = "";
    } else {
      if (!buf.trim()) start = line;
      buf += ch;
    }
  }
}

/** Splits a value at top-level commas (or another separator), leaving
 *  parentheses whole. */
export function splitTop(value, sep = ",") {
  const parts = [];
  let depth = 0;
  let cur = "";
  for (const ch of value) {
    if (ch === "(") depth++;
    if (ch === ")") depth--;
    if (depth === 0 && (sep === " " ? /\s/.test(ch) : ch === sep)) {
      if (cur.trim()) parts.push(cur.trim());
      cur = "";
    } else cur += ch;
  }
  if (cur.trim()) parts.push(cur.trim());
  return parts;
}

export const inReducedMotion = (context) => context.some((p) => /prefers-reduced-motion:\s*reduce/.test(p));
export const inFontFace = (context) => context.some((p) => p.startsWith("@font-face"));

// ---------- tokens.css as two themes ----------

const DARK_MEDIA = "@media (prefers-color-scheme: dark)";
const DARK_ROOT = ':root:not([data-theme="light"])';
const DARK_ATTR = ':root[data-theme="dark"]';

/** tokens.css's custom properties: { day, night, nightMedia, nightAttr },
 *  each a Map of name to raw value; night is day overlaid with the dark
 *  block (the two dark blocks are returned apart so a test can hold them
 *  equal). */
export function readTokens() {
  const css = readFileSync(join(repo, "src/styles/tokens.css"), "utf8");
  const day = new Map();
  const nightMedia = new Map();
  const nightAttr = new Map();
  const byFont = new Map();
  for (const d of declarations(css)) {
    if (!d.prop.startsWith("--")) continue;
    const ctx = d.context.join(" | ");
    if (ctx === ":root") day.set(d.prop, d.value);
    else if (ctx === `${DARK_MEDIA} | ${DARK_ROOT}`) nightMedia.set(d.prop, d.value);
    else if (ctx === DARK_ATTR) nightAttr.set(d.prop, d.value);
    else if (/^html\[data-font="/.test(ctx)) byFont.set(`${ctx} ${d.prop}`, d.value);
  }
  return { day, night: new Map([...day, ...nightMedia]), nightMedia, nightAttr, byFont };
}

/** A value with every var() replaced from the theme, recursively. */
export function resolve(value, theme, seen = new Set()) {
  return value.replace(/var\((--[\w-]+)(?:\s*,\s*([^()]*))?\)/g, (m, name, fallback) => {
    if (seen.has(name)) throw new Error(`a cycle through ${name}`);
    const raw = theme.get(name) ?? fallback;
    if (raw === undefined) throw new Error(`${name} is not a token`);
    return resolve(raw, theme, new Set([...seen, name]));
  });
}

/** A color as [r, g, b, a] (0 to 255, alpha 0 to 1), from #rgb, #rrggbb,
 *  rgb() or rgba() with numbers. */
export function parseColor(text) {
  const t = text.trim();
  let m = t.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (m) {
    const h = m[1].length === 3 ? [...m[1]].map((c) => c + c).join("") : m[1];
    return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)).concat(1);
  }
  m = t.match(/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)$/i);
  if (m) return [Number(m[1]), Number(m[2]), Number(m[3]), m[4] === undefined ? 1 : Number(m[4])];
  throw new Error(`not a color: ${text}`);
}

/** The opaque color of `fg` laid over `bg` (bg opaque). */
export function over(fg, bg) {
  const a = fg[3];
  return [0, 1, 2].map((i) => fg[i] * a + bg[i] * (1 - a)).concat(1);
}

/** WCAG 2's contrast ratio of two opaque colors. */
export function contrast(c1, c2) {
  const lum = (c) => {
    const [r, g, b] = c.slice(0, 3).map((v) => {
      const s = v / 255;
      return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const [a, b] = [lum(c1), lum(c2)].sort((x, y) => y - x);
  return (a + 0.05) / (b + 0.05);
}
