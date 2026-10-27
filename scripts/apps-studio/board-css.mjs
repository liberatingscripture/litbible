/**
 * Builds board/page.css: the /apps page's own styles, rewritten so the board
 * can draw the page at any width inside one element (`.replica`) without an
 * iframe. `npm run studio:apps -- board-css` writes it; a test fails when the
 * committed file falls behind the components.
 *
 * The rewrite, rule by rule:
 *   - apps.css first, then each component's <style>, as the site bundles them;
 *   - `:global(x)` unwrapped to `x`;
 *   - every component selector prefixed with `.replica `, which stands in for
 *     Astro's scoping attribute: it lifts each rule by one class, so a
 *     component's rule still beats apps.css's element rules (`.apps h1`) the
 *     way the attribute makes it beat them on the site;
 *   - width media queries made container queries on `.replica`, and `vw`
 *     made `cqw`, so Phone, Tablet and Desktop lay out as the real widths do;
 *   - the OS dark-mode queries dropped and `:root[data-theme="dark"]` made
 *     `.replica[data-theme="dark"]`, so the board's Light/Dark switch decides.
 * Pure: the shell passes the files in.
 */

export const SOURCES = [
  "src/styles/pages/apps.css",
  "src/components/apps/Hero.astro",
  "src/components/apps/AboutTranslation.astro",
  "src/components/apps/ExamplesSlider.astro",
  "src/components/apps/ReaderCallouts.astro",
  "src/components/apps/ChurchYearCarousel.astro",
  "src/components/apps/BigScreens.astro",
  "src/components/apps/HumaneByDesign.astro",
  "src/components/apps/JoinBeta.astro",
  "src/components/apps/AppIcons.astro",
  "src/components/apps/PlatformIcon.astro",
];

/** What the site's global.css gives the page: its tokens, body type, and box sizing. */
const BASE = `.replica {
  container: replica / inline-size;
  --green: #209D50;
  --green-text: #0F6B33;
  --green-deep: #0F6B33;
  --ink: #1D231C;
  --surface-raised: #FAFAF8;
  --text: #1D231C;
  --serif: "Crimson Text", Georgia, "Times New Roman", serif;
  background: var(--surface-raised);
  color: var(--text);
  font-family: Inter, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  font-size: 1.125rem;
  line-height: 1.6;
  -webkit-font-smoothing: antialiased;
}
.replica[data-theme="dark"] {
  --surface-raised: #1d1d1f;
  --text: #F0F0F0;
  --green-text: #3abf6a;
  color-scheme: dark;
}
.replica *,
.replica *::before,
.replica *::after {
  box-sizing: border-box;
}
/* global.css's .container, whose bottom padding apps.css's own .container
   leaves in place: every section on the page carries it. */
.replica .container {
  padding-bottom: 80px;
}
`;

/** Remove `:global( … )` wrappers, keeping what they wrap (parentheses may nest). */
export function unwrapGlobal(css) {
  let out = "";
  let i = 0;
  for (;;) {
    const at = css.indexOf(":global(", i);
    if (at < 0) return out + css.slice(i);
    out += css.slice(i, at);
    let depth = 1;
    let j = at + ":global(".length;
    const start = j;
    while (j < css.length && depth) {
      if (css[j] === "(") depth++;
      else if (css[j] === ")") depth--;
      j++;
    }
    out += css.slice(start, j - 1);
    i = j;
  }
}

/** Split a block's text into top-level `prelude { body }` pairs. */
function blocks(css) {
  const out = [];
  let i = 0;
  for (;;) {
    const open = css.indexOf("{", i);
    if (open < 0) return out;
    let depth = 1;
    let j = open + 1;
    while (j < css.length && depth) {
      if (css[j] === "{") depth++;
      else if (css[j] === "}") depth--;
      j++;
    }
    out.push({ prelude: css.slice(i, open).trim(), body: css.slice(open + 1, j - 1) });
    i = j;
  }
}

function splitSelectors(prelude) {
  const out = [];
  let depth = 0;
  let cur = "";
  for (const ch of prelude) {
    if (ch === "(" || ch === "[") depth++;
    if (ch === ")" || ch === "]") depth--;
    if (ch === "," && depth === 0) { out.push(cur.trim()); cur = ""; }
    else cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

const DARK = ':root[data-theme="dark"]';

function rewrite(css, { prefix }, indent = "") {
  let out = "";
  for (const { prelude, body } of blocks(css)) {
    if (prelude.startsWith("@media")) {
      if (/prefers-color-scheme/.test(prelude)) continue;
      const cond = prelude.slice("@media".length).trim();
      const head = /^\((min|max)-width:\s*[^)]+\)$/.test(cond) ? `@container replica ${cond}` : prelude;
      out += `${indent}${head} {\n${rewrite(body, { prefix }, `${indent}  `)}${indent}}\n`;
      continue;
    }
    if (prelude.startsWith("@")) {
      out += `${indent}${prelude} {${body}}\n`;
      continue;
    }
    const selectors = splitSelectors(prelude).map((s) => {
      if (s.startsWith(DARK)) return `.replica[data-theme="dark"]${s.slice(DARK.length)}`;
      return prefix ? `.replica ${s}` : s;
    });
    const decls = body
      .split(";")
      .map((d) => d.trim())
      .filter(Boolean)
      .map((d) => `${indent}  ${d.replace(/\s+/g, " ").replace(/(\d)vw\b/g, "$1cqw")};`)
      .join("\n");
    out += `${indent}${selectors.join(",\n" + indent)} {\n${decls}\n${indent}}\n`;
  }
  return out;
}

/** The component's own <style> block, or "" if it has none. */
export function styleOf(astro) {
  const m = /<style>([\s\S]*?)<\/style>/.exec(astro);
  return m ? m[1] : "";
}

/**
 * @param {Record<string, string>} files SOURCES path → contents
 * @returns {string} board/page.css
 */
export function buildBoardCss(files) {
  const strip = (css) => css.replace(/\/\*[\s\S]*?\*\//g, "");
  let out = `/* Generated by \`npm run studio:apps -- board-css\` from the /apps page's own
   styles (scripts/apps-studio/board-css.mjs says how). Don't edit by hand. */\n\n`;
  out += BASE;
  for (const path of SOURCES) {
    const text = files[path];
    if (text === undefined) throw new Error(`board-css: missing ${path}`);
    const component = path.endsWith(".astro");
    const css = component ? styleOf(text) : text;
    if (!css.trim()) continue;
    out += `\n/* ${path} */\n`;
    out += rewrite(strip(unwrapGlobal(css)), { prefix: component });
  }
  return out;
}
