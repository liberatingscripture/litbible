// The rest of the site in the Study Desk's look (E132; BVJ, 2026-11-13),
// behind data-restyle until launch. A stylesheet has no behavior to run in
// node, so what is held here is the source: every rule gated, the desk's
// tokens copied with the same values in both dark selectors, each kind's
// selector list the same in every rule that names it, the Scripture pages'
// green buttons in the primary kind (D3), and /apps touched only at its four
// store buttons.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (f) => readFileSync(new URL(`../src/${f}`, import.meta.url), "utf8");
const restyle = read("styles/restyle.css");
const desk = read("styles/desk.css");
const layout = read("layouts/Layout.astro");
const bare = restyle.replace(/\/\*[\s\S]*?\*\//g, "");

/** Splits `text` at commas outside parentheses. */
function topLevel(text) {
  const parts = [];
  let depth = 0;
  let from = 0;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === "(") depth++;
    else if (text[i] === ")") depth--;
    else if (text[i] === "," && depth === 0) {
      parts.push(text.slice(from, i).trim());
      from = i + 1;
    }
  }
  parts.push(text.slice(from).trim());
  return parts.filter(Boolean);
}

/** Every style rule's selector list, at-rule blocks walked into. */
function selectors(css) {
  const out = [];
  let prelude = "";
  for (let i = 0; i < css.length; i++) {
    const c = css[i];
    if (c === "{") {
      const head = prelude.trim();
      prelude = "";
      if (head.startsWith("@")) continue; // descend: the block's rules follow
      out.push(head);
      let depth = 1;
      while (depth > 0) {
        i++;
        if (css[i] === "{") depth++;
        else if (css[i] === "}") depth--;
      }
    } else if (c === "}" || c === ";") prelude = "";
    else prelude += c;
  }
  return out;
}

/** The custom properties declared in the first block opening with `head` whose body declares `marker`. */
function tokens(css, head, marker = "--desk-btn-rest") {
  let from = 0;
  for (;;) {
    const at = css.indexOf(head, from);
    assert.ok(at >= 0, `no ${head} block declaring ${marker}`);
    const body = css.slice(at + head.length, css.indexOf("}", at));
    if (body.includes(marker)) return new Map([...body.matchAll(/(--[\w-]+):\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]));
    from = at + head.length;
  }
}

/** The list inside every `:is(` that opens with `first`. */
function lists(css, first) {
  const found = [];
  let from = 0;
  for (;;) {
    const at = css.indexOf(`:is(${first}`, from);
    if (at < 0) return found;
    let depth = 0;
    for (let i = at + 3; i < css.length; i++) {
      if (css[i] === "(") depth++;
      else if (css[i] === ")" && --depth === 0) {
        found.push(css.slice(at + 4, i));
        from = i;
        break;
      }
    }
  }
}

const KINDS = {
  ordinary: ".site-header__font-toggle",
  primary: ".nav-button",
  pill: ".searchbar__filter-pill",
  glyph: ".font-tray__close",
  float: ".font-tray,",
  card: ".search-page .result-link",
  heading: ".font-tray__legend",
  field: ".searchbar__input",
  quiet: ".searchbar__suggest-word",
};

test("Layout.astro loads the restyle after global.css, on every page", () => {
  const g = layout.indexOf('import "../styles/global.css";');
  const r = layout.indexOf('import "../styles/restyle.css";');
  assert.ok(g >= 0 && r > g);
});

test("every rule waits for data-restyle", () => {
  const all = selectors(bare);
  assert.ok(all.length > 40, "the walk found the rules");
  for (const list of all) {
    for (const sel of topLevel(list)) assert.match(sel, /^:root\[data-restyle\]/, sel.slice(0, 80));
  }
});

test("the desk's tokens are copied with desk.css's values, in both dark selectors", () => {
  const light = tokens(bare, ":root[data-restyle] {");
  const followed = tokens(bare, ':root[data-restyle]:not([data-theme="light"]) {');
  const forced = tokens(bare, ':root[data-restyle][data-theme="dark"] {');
  assert.match(bare, /@media \(prefers-color-scheme: dark\) \{\s*:root\[data-restyle\]:not\(\[data-theme="light"\]\) \{/);
  const deskLight = tokens(desk, ":root {");
  const deskDark = tokens(desk, ':root[data-theme="dark"] {');
  for (const [t, v] of light) {
    if (t.startsWith("--desk-")) assert.equal(v, deskLight.get(t), `${t}: light, as desk.css`);
  }
  assert.deepEqual([...followed.keys()].sort(), [...forced.keys()].sort(), "the two dark blocks name the same tokens");
  for (const [t, v] of forced) {
    assert.equal(followed.get(t), v, `${t}: the same in both dark selectors`);
    if (t.startsWith("--desk-")) assert.equal(v, deskDark.get(t), `${t}: dark, as desk.css`);
  }
  // Every shadow a kind uses has a dark value of its own.
  for (const t of ["--desk-btn-rest", "--desk-btn-lift", "--desk-btn-press", "--desk-primary-press", "--restyle-float-shadow"]) {
    assert.ok(forced.has(t) && forced.get(t) !== light.get(t), `${t} has a dark pair`);
  }
  // Every token the rules read is declared here: most pages have no desk.css.
  for (const m of bare.matchAll(/var\((--(?:desk|restyle)-[\w-]+)/g)) assert.ok(light.has(m[1]), `${m[1]} is declared in :root[data-restyle]`);
});

test("under reduced motion the lift and the transitions go, and the shadows stay", () => {
  const m = bare.match(/@media \(prefers-reduced-motion: reduce\) \{\s*:root\[data-restyle\] \{([^}]*)\}\s*\}/);
  assert.ok(m, "no reduced-motion block");
  assert.match(m[1], /--desk-btn-lift-y:\s*0px/);
  assert.match(m[1], /--desk-btn-motion:\s*0s/);
  assert.doesNotMatch(m[1], /shadow/);
  for (const t of bare.matchAll(/transform:\s*([^;]+);/g)) assert.match(t[1], /^(none|translateY\(var\(--desk-btn-lift-y\)\))$/, t[0]);
  for (const t of bare.matchAll(/transition:([^;]+);/g)) {
    for (const part of t[1].split(",")) assert.match(part, /var\(--desk-btn-motion\)/, part.trim());
  }
});

test("each kind's list is the same in every rule that names it, and no selector is in two kinds", () => {
  const seen = new Map();
  for (const [kind, first] of Object.entries(KINDS)) {
    const found = lists(bare, first);
    assert.ok(found.length >= 1, `${kind}: no list`);
    for (const l of found) assert.equal(l, found[0], `${kind}: a rule's copy of the list differs`);
    for (const sel of topLevel(found[0])) {
      assert.ok(!seen.has(sel), `${sel} is in ${seen.get(sel)} and ${kind}`);
      seen.set(sel, kind);
    }
  }
});

test("D3: on the Scripture pages every green button is the primary, in the 8px shape", () => {
  const primary = topLevel(lists(bare, KINDS.primary)[0]);
  for (const sel of [".nav-button", ".chapter-cta", ".back-to-top__link", ".rm-page .rm-fab"]) assert.ok(primary.includes(sel), sel);
  const at = bare.indexOf(`:is(${KINDS.primary}`);
  const body = bare.slice(bare.indexOf("{", at), bare.indexOf("}", at));
  assert.match(body, /border-radius:\s*8px/);
  assert.match(body, /background:\s*var\(--green-deep\)/);
  // A disabled primary says so in its words, never by fading.
  const off = bare.indexOf("):is(:disabled, [aria-disabled=\"true\"]) {", at);
  const disabled = bare.slice(off, bare.indexOf("}", off));
  assert.match(disabled, /color:\s*var\(--green-text\)/);
  assert.match(disabled, /opacity:\s*1;/);
});

test("/apps changes at its four store buttons only", () => {
  const apps = selectors(bare).flatMap(topLevel).filter((s) => s.includes(".apps"));
  assert.ok(apps.length >= 6);
  for (const s of apps) {
    if (s.includes("::after")) continue; // the open-page mark, which leaves /apps out
    assert.match(s, /^:root\[data-restyle\] \.apps :is\(\.hero__ctas, \.get-app__ctas\) > a\.btn/, s);
  }
  // The open-page mark leaves the whole page body out, store buttons too.
  assert.match(bare, /a\[target="_blank"\]:not\([^{]*\.apps a\)::after/);
});
