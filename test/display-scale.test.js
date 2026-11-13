// The Display tray's text size beyond the reading column (BVJ, 2026-11-12):
// three scales in global.css, and the shared floating panel, which hangs off
// <body> and so takes its size from a variable rather than by inheritance.
// The rules are in src/styles/CLAUDE.md, the Display tray's rule 1. These
// hold the parts a later edit would break without anything looking wrong at
// Medium: a control that shrinks at Small, a panel size left in plain rem
// (it would stay put while the popover around it grew), and a preview page's
// change leaking out from behind the gate.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(`../src/${path}`, import.meta.url), "utf8");
const css = (path) => read(path).replace(/\/\*[\s\S]*?\*\//g, "");

const globalCss = css("styles/global.css");

/** Every rule of a stylesheet as [selector, body], media blocks flattened. */
function rules(sheet) {
  return [...sheet.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(([, sel, body]) => [sel.trim().replace(/\s+/g, " "), body]);
}

/** The text of each `@media <query> { … }` block whose query matches. */
function mediaBlocks(sheet, query) {
  const blocks = [];
  let at = 0;
  for (;;) {
    at = sheet.indexOf("@media", at);
    if (at < 0) break;
    const open = sheet.indexOf("{", at);
    let depth = 0;
    let end = open;
    for (; end < sheet.length; end++) {
      if (sheet[end] === "{") depth++;
      else if (sheet[end] === "}" && --depth === 0) break;
    }
    if (query.test(sheet.slice(at, open))) blocks.push(sheet.slice(open + 1, end));
    at = end + 1;
  }
  return blocks;
}

test("a control keeps its own size by default, so Small never shrinks one", () => {
  const root = globalCss.match(/:root\s*\{[^}]*--control-scale:\s*([^;]+);/);
  assert.ok(root, ":root declares --control-scale");
  assert.equal(root[1].trim(), "1");
  // The only other value is the Large step, and only from tablet width up.
  const values = [...globalCss.matchAll(/--control-scale:\s*([^;]+);/g)].map((m) => m[1].trim());
  assert.deepEqual(values, ["1", "calc(20 / 18)"]);
  const wide = mediaBlocks(globalCss, /min-width:\s*641px/).filter((b) => /--control-scale/.test(b));
  assert.equal(wide.length, 1, "the Large step sits inside one (min-width: 641px) block");
  assert.match(wide[0], /html\[data-size="lg"\],\s*html\[data-size="xl"\]\s*\{\s*--control-scale:\s*calc\(20 \/ 18\);/);
});

test("a page's title follows the reader's size, but never grows on a phone", () => {
  assert.match(globalCss, /:root\s*\{[^}]*--heading-scale:\s*var\(--reading-scale\);/);
  const phone = mediaBlocks(globalCss, /max-width:\s*640px/).filter((b) => /--heading-scale/.test(b));
  assert.equal(phone.length, 1, "one (max-width: 640px) block resets it");
  assert.match(phone[0], /html\[data-size="lg"\],\s*html\[data-size="xl"\]\s*\{\s*--heading-scale:\s*1;/);
  // Small still shrinks a title on a phone: nothing resets it there.
  assert.doesNotMatch(phone[0], /data-size="sm"/);
});

test("a menu is a control and a panel of text takes the reader's size and spacing", () => {
  const all = rules(globalCss);
  const body = (sel) => {
    const found = all.filter(([s]) => s === sel).map(([, b]) => b).join("\n");
    assert.ok(found, `${sel} has a rule`);
    return found;
  };
  const panel = body(".lit-panel");
  assert.match(panel, /--panel-scale:\s*1;/);
  assert.match(panel, /font-size:\s*calc\(0\.95rem \* var\(--panel-scale, 1\)\);/);
  assert.match(panel, /max-width:\s*calc\(380px \* var\(--panel-scale, 1\)\);/);
  assert.match(body(".lit-panel--menu"), /--panel-scale:\s*var\(--control-scale, 1\);/);
  const text = body(".lit-panel--footnote");
  assert.match(text, /--panel-scale:\s*var\(--reading-scale, 1\);/);
  assert.match(text, /line-height:\s*calc\(1\.55 \+ var\(--reading-leading-extra, 0\)\);/);
});

test("every size inside the shared panel multiplies by the panel's scale", () => {
  // The × glyph, a window's title and the tooltip are not panel text: the
  // glyph is an icon in a fixed 30px button, and the other two are their own
  // components (float-window.js, tip.js).
  const kept = /^\.lit-panel__close$|^\.lit-window__title$|^\.lit-tip$/;
  const fixed = [];
  for (const [sel, body] of rules(globalCss)) {
    if (!/\.lit-(?:panel|flyout|image|window|tip)|\.ref-preview/.test(sel) || kept.test(sel)) continue;
    for (const [, value] of body.matchAll(/(?:^|;)\s*font(?:-size)?\s*:\s*([^;]+)/g)) {
      if (/[0-9.]+(?:rem|px)\b/.test(value) && !/var\(--panel-scale\b/.test(value)) fixed.push(`${sel} { ${value.trim()} }`);
    }
  }
  assert.deepEqual(fixed, [], "multiply a panel's rem size by var(--panel-scale, 1)");
});

test("the panel's width is the stylesheet's, read back by the scripts that place it", () => {
  const panelJs = read("scripts/lit-panel.js");
  assert.match(panelJs, /export function panelMaxWidth\(el\)/);
  assert.match(panelJs, /Math\.min\(panelMaxWidth\(el\), room - 24\)/);
  assert.match(read("scripts/panel-pieces.js"), /Math\.min\(panelMaxWidth\(el\), room - 2 \* PANEL_EDGE\)/);
});

test("the preview's own pages follow only behind the gate", () => {
  // /desk/help reads without the desk, so its two factors are 1 and 0 there.
  const help = css("styles/pages/desk-help.css");
  const helpRules = rules(help);
  const base = helpRules.find(([s]) => s === ".nbhelp");
  assert.match(base[1], /--help-scale:\s*1;/);
  assert.match(base[1], /--help-leading:\s*0;/);
  const gated = helpRules.find(([s]) => s === "html[data-desk] .nbhelp");
  assert.ok(gated, "the scale is set under html[data-desk]");
  assert.match(gated[1], /--help-scale:\s*var\(--reading-scale, 1\);/);
  assert.match(gated[1], /--help-leading:\s*var\(--reading-leading-extra, 0\);/);
  assert.doesNotMatch(help, /var\(--reading-scale[^)]*\)\s*\)/, "no size reads the tray's scale directly");

  const notebook = rules(css("styles/pages/notebook.css"));
  const page = notebook.find(([s]) => s === "html[data-desk] .notebook-page");
  assert.ok(page, "/notebook sets the desk's two variables under html[data-desk]");
  assert.match(page[1], /--desk-ui:\s*var\(--reading-scale, 1\);/);
  assert.match(page[1], /--desk-leading:\s*var\(--reading-leading-extra, 0\);/);
  assert.equal(
    notebook.filter(([s, b]) => /--desk-ui|reading-scale/.test(b) && !s.startsWith("html[data-desk]")).length,
    0,
    "nothing on /notebook follows the tray without the gate",
  );
});

test("the desk look of the glossary scales its entries once", () => {
  // The entries' .wrap sits inside the hero's, and both match the rule that
  // scales the column; without the inner reset the entries took it twice.
  const glossary = rules(css("styles/pages/glossary.css"));
  const outer = glossary.find(([s]) => s === "html[data-desk] .glossary-page .wrap");
  assert.match(outer[1], /font-size:\s*calc\(1em \* var\(--reading-scale, 1\)\);/);
  const inner = glossary.find(([s]) => s === "html[data-desk] .glossary-page .wrap .wrap");
  assert.ok(inner, "the nested wrap has its own rule");
  assert.match(inner[1], /font-size:\s*1em;/);
});
