// The Display tray's text size and line spacing in the Study Desk
// (STUDY-DESK-FIXES.md, E109; BVJ, 2026-11-12: the size "affects some panes
// but not all"). Every /desk pane's own words follow both now, and so does the
// Notebook panel beside a chapter: --desk-ui is the tray's scale and
// --desk-leading what "Roomy" adds, set on the desk page and on the panel and
// nowhere else. These hold the stylesheets to that, the way
// desk-sheet-text-size.test.js holds /sheets to --sheet-ui: a size added later
// in plain rem would stay fixed while everything around it grew, which is the
// bug this closed.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (name) =>
  readFileSync(new URL(`../src/styles/${name}`, import.meta.url), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");

const desk = read("desk.css");
const search = read("desk-search.css");

/** The rules of a stylesheet outside any @media print block, as [selector, body]. */
function screenRules(css) {
  // Print sizes are in points and follow the tray by --reading-scale, or not
  // at all; none is a pane's.
  let out = "";
  let i = 0;
  while (i < css.length) {
    const at = css.indexOf("@media print", i);
    if (at < 0) {
      out += css.slice(i);
      break;
    }
    out += css.slice(i, at);
    let depth = 0;
    let j = css.indexOf("{", at);
    for (; j < css.length; j++) {
      if (css[j] === "{") depth++;
      else if (css[j] === "}" && --depth === 0) break;
    }
    i = j + 1;
  }
  return [...out.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(([, sel, body]) => [sel.trim().replace(/\s+/g, " "), body]);
}

const deskRules = screenRules(desk);

function body(sel) {
  const rule = deskRules.find(([s]) => s === sel);
  assert.ok(rule, `${sel} has a rule`);
  return rule[1];
}

/** Every size a rule body sets in a fixed unit and leaves unscaled. */
function fixedSizes(ruleBody) {
  const found = [];
  for (const [, prop, value] of ruleBody.matchAll(/(?:^|;)\s*(font(?:-size)?)\s*:\s*([^;]+)/g)) {
    if (!/[0-9.]+(?:rem|px|pt)\b/.test(value)) continue; // inherit, or an em of the size around it
    if (/var\(--(?:desk-ui|sheet-ui|sheet-text-scale|reading-scale)\b/.test(value)) continue;
    found.push(`${prop}: ${value.trim()}`);
  }
  return found;
}

test("on the desk page the tray's settings are the panes', and the Sheets pane's", () => {
  const rule = desk.match(/html\[data-desk-workspace\]\s*\{([^}]*)\}/);
  assert.ok(rule, "desk.css has the workspace's own rule");
  assert.match(rule[1], /--desk-ui:\s*var\(--reading-scale, 1\);/);
  assert.match(rule[1], /--sheet-ui:\s*var\(--reading-scale, 1\);/);
  assert.match(rule[1], /--desk-leading:\s*var\(--reading-leading-extra, 0\);/);
});

test("the Notebook panel beside a chapter sets both for itself", () => {
  const panel = body(".desk-panel");
  assert.match(panel, /--desk-ui:\s*var\(--reading-scale, 1\);/);
  assert.match(panel, /--desk-leading:\s*var\(--reading-leading-extra, 0\);/);
  assert.match(panel, /font-size:\s*calc\(0\.9375rem \* var\(--desk-ui, 1\)\);/);
  assert.match(panel, /line-height:\s*calc\(1\.5 \+ var\(--desk-leading, 0\)\);/);
});

test("every size the desk's stylesheets set multiplies by a scale", () => {
  for (const [name, css] of [["desk.css", desk], ["desk-search.css", search]]) {
    const fixed = [];
    for (const [sel, ruleBody] of screenRules(css)) {
      for (const size of fixedSizes(ruleBody)) fixed.push(`${sel} { ${size} }`);
    }
    assert.deepEqual(fixed, [], `${name}: multiply a rem size by var(--desk-ui, 1)`);
  }
});

test("running text adds the tray's line spacing; bars and a sheet's passage keep theirs", () => {
  // A line height of 1.4 or more is running text (a title, a one-line label
  // or a control is tighter), so it adds --desk-leading. Two kinds keep a
  // plain one on purpose: a bar, whose height must not move with the
  // setting, and a sheet's passage, which is the sheet's and not the pane's.
  const kept = /^\.desk-pane__head, \.desk-passage, \.desk-panel__head, \.desk-panel__tabs$|desk-sheet__words/;
  for (const [name, css] of [["desk.css", desk], ["desk-search.css", search]]) {
    const plain = [];
    for (const [sel, ruleBody] of screenRules(css)) {
      const m = ruleBody.match(/(?:^|;)\s*line-height:\s*([0-9.]+)\s*(?:;|$)/);
      if (m && Number(m[1]) >= 1.4 && !kept.test(sel)) plain.push(`${sel} { line-height: ${m[1]} }`);
    }
    assert.deepEqual(plain, [], `${name}: add var(--desk-leading, 0) to a block of text's line height`);
  }
  assert.match(body(".desk-pane__head, .desk-passage, .desk-panel__head, .desk-panel__tabs"), /line-height:\s*1\.5;/);
});

test("a pane sets its size once, so the LIT's and a Book Intro's text are scaled once", () => {
  assert.match(body(".desk-pane"), /font-size:\s*calc\(0\.9375rem \* var\(--desk-ui, 1\)\);/);
  // Either one multiplying again would square the scale: 15px to 24.5 at the
  // largest size, where the pane's other words go to 19.2.
  assert.doesNotMatch(body(".desk-lit__text"), /font-size/);
  assert.doesNotMatch(body(".desk-intro__article"), /font-size/);
});

test("a sheet's passage keeps the sheet's own size in a pane", () => {
  // Its words would inherit the pane's scaled size; they are the sheet's, as
  // its title and text are, so they are set from the root.
  assert.match(body(".desk-pane .desk-sheet__words"), /font-size:\s*calc\(0\.9375rem \* var\(--sheet-text-scale, 1\)\);/);
});

test("the verse menu and the selection panel keep the site's size and spacing on the desk", () => {
  // They are every page's panels; the rows the desk adds to them (Add a note,
  // Highlight, the note editor) stay like the rows around them.
  const pin = body("html[data-desk-workspace] .lit-panel");
  assert.match(pin, /--desk-ui:\s*1;/);
  assert.match(pin, /--desk-leading:\s*0;/);
});

test("the panel's header gives up its badge before its buttons", () => {
  // Larger words can ask for more than a 280px panel has. The name and badge
  // share one clipped row, so the badge wraps out of sight whole and the
  // Study Desk link and the minimize button stay in the panel.
  const name = body(".desk-panel__name");
  assert.match(name, /flex-wrap:\s*wrap;/);
  assert.match(name, /overflow:\s*hidden;/);
  assert.match(name, /height:\s*36px;/);
  const panelJs = readFileSync(new URL("../src/scripts/desk/panel.js", import.meta.url), "utf8");
  assert.match(
    panelJs,
    /<div class="desk-panel__name">\s*<h2 class="desk-panel__title"[^>]*>Notebook<\/h2>\s*<span class="desk-panel__badge">[^<]*<\/span>\s*<\/div>\s*<a class="desk-panel__desk"/,
  );
});

test("a pill of choices stacks where a line can't hold it", () => {
  const seg = body(".desk-seg");
  assert.match(seg, /flex-wrap:\s*wrap;/);
  assert.match(seg, /max-width:\s*100%;/);
});
