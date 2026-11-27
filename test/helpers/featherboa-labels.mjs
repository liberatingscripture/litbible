// test/helpers/featherboa-labels.mjs
//
// Reading the words the site draws for Featherboa's label rules
// (SITE-FEATHERBOA.md, "Controls," "Labels"): the reader-facing text in the
// .astro, .js, .mjs, and .ts files under src/, with comments taken out, so a
// rule is held over what a reader sees and never over a comment.

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { repo } from "./featherboa-css.mjs";

/** Files outside the rules: the /apps mirror (src/components/CLAUDE.md) and
 *  the content collections, which hold the owner's words. */
export const OUTSIDE = (rel) => rel.startsWith("src/components/apps/") || rel.startsWith("src/content/");

/**
 * Text with its comments blanked, lines kept: block comments (and markup's
 * braced ones), HTML comments, whole-line // comments, and a // comment at
 * the end of a line when it stands outside a string.
 */
export function withoutComments(text) {
  const blanked = text
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "))
    .replace(/<!--[\s\S]*?-->/g, (m) => m.replace(/[^\n]/g, " "));
  return blanked
    .split("\n")
    .map((line) => {
      let quote = "";
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (quote) {
          if (ch === "\\") i++;
          else if (ch === quote) quote = "";
          continue;
        }
        if (ch === '"' || ch === "'" || ch === "`") quote = ch;
        else if (ch === "/" && line[i + 1] === "/" && line[i - 1] !== ":") return line.slice(0, i);
      }
      return line;
    })
    .join("\n");
}

/** Every source file the rules read, as { rel, lines } with comments out. */
export function labelSources() {
  const out = [];
  (function walk(dir) {
    for (const e of readdirSync(join(repo, dir), { withFileTypes: true })) {
      const rel = `${dir}/${e.name}`;
      if (OUTSIDE(rel)) continue;
      if (e.isDirectory()) walk(rel);
      else if (/\.(astro|js|mjs|ts)$/.test(e.name)) {
        out.push({ rel, lines: withoutComments(readFileSync(join(repo, rel), "utf8")).split("\n") });
      }
    }
  })("src");
  return out;
}

/** The label rules, each a pattern over a line and what it breaks. */
export const RULES = [
  { id: "my", pattern: /\bMy [A-Za-z]+/g, why: "no “My”: inside Study everything is the reader's (CT-04)" },
  { id: "study-desk", pattern: /\bStudy Desk\b/g, why: "“Study,” never “Study Desk” (CT-09, CT-16)" },
  { id: "views", pattern: /\b(Chapter|Read) View\b/g, why: "Chapter View and Read View become the Read page (A whole book)" },
  {
    id: "article",
    // A label that is a verb and then an article: "Add a note," "Open the
    // Study Desk." Only a short quoted string or a button's own text counts,
    // and one that ends a sentence (a period, a question) is a sentence.
    pattern: /(?:["'`>]|aria-label=["'`])(?:Add|Open|Make|Create|Choose|Copy|Print|Share|Remove|Delete|Edit|Save|Start|Show|Hide|Pick|Write|Go to|Clear|Move|Rename|Turn) (?:a|an|the) [^"'`<\n]{1,32}(?<![.?!])(?=["'`<])/g,
    why: "no articles: “Add note,” not “Add a note” (CT-05)",
  },
];

/** Every place a rule finds, as { rel, line, rule, text }. */
export function findLabels(sources = labelSources()) {
  const found = [];
  for (const { rel, lines } of sources) {
    lines.forEach((line, i) => {
      for (const rule of RULES) {
        for (const m of line.matchAll(rule.pattern)) {
          found.push({ rel, line: i + 1, rule: rule.id, text: m[0].replace(/^(?:["'`>]|aria-label=["'`])/, "") });
        }
      }
    });
  }
  return found;
}
