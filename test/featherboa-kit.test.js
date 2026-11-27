// Featherboa's kit (SITE-FEATHERBOA.md, "Controls" and "The kit";
// SITE-FEATHERBOA-BUILD.md, Phase 2): ten controls in five states, drawn once
// in src/styles/kit.css. What is held here:
//
// - each control is there, and each level has a rule for each state;
// - each level's lists are alike (the kit's other names; scripts/lib/kit-lists.mjs),
//   and no name takes two looks;
// - no control's look is drawn outside kit.css: a rule whose subject is a
//   control (a name in the kit's lists, a button, field, or summary, a control's
//   role, or a class named for a button) says only where it sits and how big it
//   is, never its fill, edge, corners, words' color, face, weight, capitals,
//   shadow, or opacity;
// - pointed at and pressed never move a thing or cast a shadow, anywhere;
// - nothing unavailable is faded with opacity, and nothing is filled red;
// - every state's words stand at 4.5:1, and every edge, underline, and track
//   at 3:1, on the page and on a float, by day and by night.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  repo,
  styleSources,
  declarations,
  isMirrored,
  readTokens,
  resolve,
  parseColor,
  over,
  contrast,
} from "./helpers/featherboa-css.mjs";
import { LEVELS, listsOf, allNames, splitList } from "../scripts/lib/kit-lists.mjs";

const KIT = "src/styles/kit.css";
const kitCss = readFileSync(join(repo, KIT), "utf8");

/** Stylesheets the kit reaches in a later phase (SITE-FEATHERBOA-BUILD.md),
 *  by the phase that draws them. Each phase empties its entries. */
export const LATER = new Map([
  ["src/styles/pages/sheets-page.css", 11], // present mode's buttons (.present-btn)
]);

// ---------- Reading selectors ----------

/** The last compound selector of a complex selector (its subject). */
export function subjectOf(selector) {
  let depth = 0;
  let quote = "";
  let cut = 0;
  for (let i = 0; i < selector.length; i++) {
    const ch = selector[i];
    if (quote) {
      if (ch === quote) quote = "";
      continue;
    }
    if (ch === '"' || ch === "'") quote = ch;
    else if (ch === "(" || ch === "[") depth++;
    else if (ch === ")" || ch === "]") depth--;
    else if (depth === 0 && (ch === " " || ch === ">" || ch === "+" || ch === "~")) cut = i + 1;
  }
  return selector.slice(cut).trim();
}

/** A compound with its conditions taken out: :not(), :has(), and the
 *  states (:hover and the rest) say when, not what. :is() and :where()
 *  are opened, their alternatives kept. */
export function bareCompound(compound) {
  let s = compound;
  // Drop :not(…) and :has(…), however deep.
  for (;;) {
    const m = /:(not|has)\(/.exec(s);
    if (!m) break;
    let depth = 0;
    let end = m.index + m[0].length - 1;
    for (; end < s.length; end++) {
      if (s[end] === "(") depth++;
      else if (s[end] === ")" && --depth === 0) break;
    }
    s = s.slice(0, m.index) + s.slice(end + 1);
  }
  return s.replace(/:(is|where)\(/g, " (");
}

const CONTROL_ELEMENTS = /(?:^|[\s,(])(button|select|textarea|summary|input)(?=$|[\s.:#[,)])/;
const CONTROL_ROLES = /\[role="?(button|tab|switch|menuitem|menuitemradio|menuitemcheckbox|option|radio|checkbox)"?\]/;
const BUTTONISH = /\.(?:[\w-]*[-_])?(?:btn|button|buttons|cta)(?:[-_][\w-]*)?(?![\w-])/;

/** The classes a kit name stands for: its subject's classes. */
function subjectClasses(selector) {
  return [...bareCompound(subjectOf(selector)).matchAll(/\.([\w-]+)/g)].map((m) => m[1]);
}

const kitNames = allNames(kitCss);
const REGISTERED = new Set([
  ...Object.values(LEVELS).map((c) => c.slice(1)),
  "kit-btn",
  "kit-icon",
  "kit-switch",
  "kit-check",
  "kit-tabs",
  "kit-choices",
  ...Object.values(kitNames).flat().flatMap(subjectClasses),
]);

/** Why a compound selector is a control, or null. */
export function controlReason(compound, registered = REGISTERED) {
  const bare = bareCompound(compound);
  const cls = [...bare.matchAll(/\.([\w-]+)/g)].map((m) => m[1]).find((c) => registered.has(c));
  if (cls) return `.${cls} is in the kit`;
  const el = CONTROL_ELEMENTS.exec(bare);
  if (el) return `a ${el[1]}`;
  const role = CONTROL_ROLES.exec(bare);
  if (role) return `role ${role[1]}`;
  const named = BUTTONISH.exec(bare);
  if (named) return `${named[0]} is named for a button`;
  return null;
}

const inExemptMedia = (context) =>
  context.some((p) => /^@media\b[^{]*\b(print|forced-colors)\b/.test(p));

const NO_BORDER = /^(0|none|0 none|none 0)$/;
const COLOR_PROPS = new Set([
  "background",
  "background-color",
  "background-image",
  "border-color",
  "border-top-color",
  "border-right-color",
  "border-bottom-color",
  "border-left-color",
  "border-block-color",
  "border-inline-color",
  "border-block-start-color",
  "border-block-end-color",
  "border-inline-start-color",
  "border-inline-end-color",
  "color",
  "accent-color",
  "-webkit-text-fill-color",
  "box-shadow",
]);
const BORDER_SHORTHANDS = new Set([
  "border",
  "border-top",
  "border-right",
  "border-bottom",
  "border-left",
  "border-block",
  "border-inline",
  "border-block-start",
  "border-block-end",
  "border-inline-start",
  "border-inline-end",
]);
const MOVES = new Set(["transform", "translate", "scale", "rotate"]);
/** A control's type is the kit's too (Atkinson Hyperlegible Next 600, "on"
 *  at 700; TY-17, SZ-08), and so are its corners (6px; KT-13). Its size
 *  stays with its surface until that surface is redrawn. */
const TYPE_PROPS = new Set(["font", "font-family", "font-weight"]);
const RADIUS_PROP = /^border(-(top|bottom)-(left|right)|-(start|end)-(start|end))?-radius$/;

/** Whether a declaration on a control draws its look. `important` marks
 *  the Display tray's previews, each option set in the face it chooses. */
export function isLook(prop, value, subject, important = false) {
  if (prop.startsWith("--")) return false;
  if (COLOR_PROPS.has(prop)) return true;
  if (BORDER_SHORTHANDS.has(prop)) return !NO_BORDER.test(value);
  if (prop === "opacity") return !/^(0|1|0\.0+|1\.0+)$/.test(value);
  if (prop === "filter") return value !== "none";
  if (MOVES.has(prop)) return /:(hover|active)\b/.test(subject) && value !== "none";
  if (TYPE_PROPS.has(prop)) return !(prop === "font-family" && important);
  if (prop === "text-transform") return value !== "none";
  if (RADIUS_PROP.test(prop)) return true;
  return false;
}

/** Each rule of a style source, as { rel, selector, context, decls }. */
function rulesOf({ rel, css }) {
  const rules = new Map();
  for (const d of declarations(css)) {
    const rule = d.context[d.context.length - 1] || "";
    if (rule.startsWith("@")) continue;
    const key = `${d.context.join(" | ")}@${rule}`;
    if (!rules.has(key)) rules.set(key, { rel, selector: rule, context: d.context, line: d.line, decls: [] });
    rules.get(key).decls.push(d);
  }
  return [...rules.values()];
}

const SOURCES = styleSources().filter(({ rel }) => !isMirrored(rel));

/** A mark drawn on a control, not its look: a dot or a count the reader
 *  needs (news, something due). Each with its file, its selector as written,
 *  and why. */
export const MARKS = [
  // { file, selector, why }
  { file: "src/styles/desk.css", selector: ".desk-title__button[data-desk-due]::after", why: "the dot that says a backup is due (E113)" },
  { file: "src/styles/desk.css", selector: ".desk-title__item[data-desk-due]::after", why: "the dot that says a backup is due (E113)" },
  { file: "src/styles/desk-tab.css", selector: ".desk-tab:is([data-desk-nudge], [data-desk-due])::after", why: "the dot on the Notebook's tab: a first record kept (E74) or a backup due (E113)" },
  { file: "src/styles/desk-sync.css", selector: 'html:is([data-desk-sync="stopped"], [data-desk-account="waiting"]) :is(.desk-tab, [data-desk-toggle], .desk-panel__tabs [data-tab="settings"], .desk-title__button, [data-desk-notebook-item], .site-header__account-btn)::after', why: "the dot that says the sync has stopped or a request waits on the account" },
  { file: "src/styles/desk-sync.css", selector: 'html[data-desk-account="news"] .site-header__account-btn::after', why: "the dot that says something is new on the account" },
];

// ---------- The kit's parts ----------

/** The declarations of each state of a level, read from kit.css. */
function statesOf(level) {
  const anchor = LEVELS[level];
  const out = {};
  for (const d of declarations(kitCss)) {
    if (d.context.some((p) => /forced-colors/.test(p))) continue;
    const rule = d.context[d.context.length - 1] || "";
    for (const sel of splitList(rule)) {
      if (!sel.startsWith(":is(")) continue;
      let depth = 0;
      let end = 3;
      for (; end < sel.length; end++) {
        if (sel[end] === "(") depth++;
        else if (sel[end] === ")" && --depth === 0) break;
      }
      if (splitList(sel.slice(4, end))[0] !== anchor) continue;
      const tail = sel.slice(end + 1);
      const state =
        tail === "" ? "rest"
        : tail.startsWith(":hover") ? "hover"
        : tail.startsWith(":is(:active") ? "press"
        : tail.startsWith(":is(:disabled") ? "off"
        : tail.startsWith("::placeholder") ? "placeholder"
        : /^(:is\()?\[aria-(selected|pressed|checked)/.test(tail) ? "on"
        : `other ${tail}`;
      out[state] = { ...(out[state] || {}), [d.prop]: d.value };
    }
  }
  return out;
}

test("kit.css draws each of the ten controls", () => {
  for (const cls of [
    ".kit-btn--filled",
    ".kit-btn--tinted",
    ".kit-btn--plain",
    ".kit-btn--danger",
    ".kit-icon",
    ".kit-field",
    ".kit-check",
    ".kit-switch",
    ".kit-tab",
    ".kit-tabs",
    ".kit-choices",
    ".kit-row",
  ]) {
    assert.ok(new RegExp(`${cls.replace(/[.-]/g, "\\$&")}(?![\\w-])`).test(kitCss), `${cls} is not in kit.css`);
  }
  // A checkbox takes the deep green wherever it is.
  assert.match(kitCss, /:root\s*\{\s*accent-color:\s*var\(--color-press\);/);
});

test("each level has a rule for each state a reader can meet", () => {
  const want = {
    filled: ["rest", "hover", "press", "off"],
    tinted: ["rest", "hover", "press", "off"],
    plain: ["rest", "hover", "press", "off"],
    danger: ["rest", "hover", "press", "off"],
    row: ["rest", "hover", "press", "on", "off"],
    tab: ["rest", "hover", "on", "off"],
    inline: ["rest", "hover", "press", "off"],
    field: ["rest", "placeholder", "hover", "off"],
    dot: ["rest", "hover", "on", "off"],
  };
  for (const [level, states] of Object.entries(want)) {
    const have = statesOf(level);
    for (const s of states) assert.ok(have[s], `${level} has no ${s} rule`);
    const odd = Object.keys(have).filter((s) => s.startsWith("other"));
    assert.deepEqual(odd, [], `${level}: rules the test can't place`);
  }
  // Keyboard focus is the one ring, global.css's, and nothing in the kit
  // takes it away.
  const global = readFileSync(join(repo, "src/styles/global.css"), "utf8");
  assert.match(global, /:focus-visible\s*\{\s*outline:\s*2px solid var\(--focus-ring/);
  assert.doesNotMatch(kitCss, /outline:\s*(none|0)\b/);
  // The switch: off, on, pointed at, unavailable.
  for (const sel of [/\.kit-switch::before\s*\{/, /\.kit-switch\[aria-checked="true"\]::before/, /\.kit-switch:hover/, /\.kit-switch:is\(:disabled/]) {
    assert.match(kitCss, sel);
  }
});

test("each level's lists are alike, and no name takes two looks", () => {
  const seen = new Map();
  for (const level of Object.keys(LEVELS)) {
    const lists = listsOf(kitCss, level);
    assert.ok(lists.length > 0, `no list for ${level}`);
    const first = JSON.stringify([lists[0].kit, lists[0].names]);
    for (const l of lists) {
      assert.equal(JSON.stringify([l.kit, l.names]), first, `${level}: a list differs from its first (scripts/kit-names.mjs keeps them alike)`);
    }
    for (const n of lists[0].names) {
      const base = level.replace(/-on$/, "");
      const other = seen.get(n);
      assert.ok(!other || other === base, `${n} is in both ${other} and ${level}`);
      seen.set(n, base);
    }
  }
});

test("no control's look is drawn outside kit.css", () => {
  const found = [];
  for (const src of SOURCES) {
    if (src.rel === KIT || LATER.has(src.rel)) continue;
    for (const rule of rulesOf(src)) {
      if (inExemptMedia(rule.context)) continue;
      for (const sel of splitList(rule.selector)) {
        if (MARKS.some((m) => m.file === src.rel && m.selector === sel.trim())) continue;
        const subject = subjectOf(sel);
        const why = controlReason(subject);
        if (!why) continue;
        const looks = rule.decls.filter((d) => isLook(d.prop, d.value, subject, d.important));
        if (looks.length) {
          found.push(`${src.rel}:${rule.line} ${sel} (${why}): ${looks.map((d) => d.prop).join(", ")}`);
        }
      }
    }
  }
  assert.deepEqual(found, [], `${found.length} rules draw a control's look outside kit.css:\n${found.join("\n")}`);
});

// accent-color colors nothing but a form's controls, so it is the kit's
// wherever it is set, whatever the selector is named (a class ending in
// "-input" isn't caught above).
test("a checkbox's, a radio's, and a range's color is the kit's alone", () => {
  const found = [];
  for (const src of SOURCES) {
    if (src.rel === KIT || LATER.has(src.rel)) continue;
    for (const rule of rulesOf(src)) {
      if (inExemptMedia(rule.context)) continue;
      if (rule.decls.some((d) => d.prop === "accent-color")) found.push(`${src.rel}:${rule.line} ${rule.selector}`);
    }
  }
  assert.deepEqual(found, [], `${found.length} rules set accent-color outside kit.css:\n${found.join("\n")}`);
});

// KT-07: focus is the one ring, global.css's :focus-visible (2px of
// --focus-ring, 2px off the control). A rule that draws a ring of its own on
// focus keeps that width, color, and offset, or draws it 2px inside a row
// that fills a scrolling list or menu edge to edge, where an outside ring is
// clipped. The rings drawn in --text on purpose are named, with why.
const OWN_RINGS = [
  { file: "src/styles/global.css", selector: ".font-tray__font-input:focus-visible", why: "the Display tray's chosen options are green, so its ring is --text" },
  { file: "src/styles/global.css", selector: ".font-tray__check-input:focus-visible", why: "the Display tray's chosen options are green, so its ring is --text" },
  { file: "src/styles/global.css", selector: ".font-tray__seg-input:focus-visible + .font-tray__seg-text", why: "the Display tray's chosen options are green, so its ring is --text" },
];
const RING_WIDTH = /^(2px|var\(--focus-width(, ?2px)?\))$/;
const RING_COLOR = /^var\(--focus-ring(, ?#[0-9a-f]{3,6})?\)$/i;
const RING_OFFSET = /^(2px|-2px|var\(--focus-offset(, ?2px)?\)|calc\(-1 \* var\(--focus-offset(, ?2px)?\)\))$/;

test("focus is the one ring: 2px of --focus-ring, 2px off the control", () => {
  const found = [];
  for (const src of SOURCES) {
    if (LATER.has(src.rel)) continue;
    const rules = rulesOf(src);
    // A ring moved to a pseudo-element that covers the whole row.
    const moved = new Set(rules.flatMap((r) => splitList(r.selector).map((s) => s.trim()))
      .filter((s) => /::(after|before)$/.test(s)).map((s) => s.replace(/::(after|before)$/, "")));
    for (const rule of rules) {
      if (inExemptMedia(rule.context)) continue;
      for (const sel of splitList(rule.selector)) {
        if (!/:focus(-visible)?\b/.test(sel)) continue;
        if (OWN_RINGS.some((r) => r.file === src.rel && r.selector === sel.trim())) continue;
        const bad = [];
        for (const d of rule.decls) {
          if (d.prop === "outline") {
            const parts = d.value.split(/\s+(?![^(]*\))/);
            if (/^(none|0)$/.test(d.value)) {
              // Only a mouse's focus loses the ring.
              if (/:focus-visible/.test(sel) && !/:not\(:focus-visible\)/.test(sel) && !moved.has(sel.trim())) bad.push("outline: none on :focus-visible");
              continue;
            }
            const width = parts.find((p) => /^(\d|var\(--focus-width)/.test(p));
            const color = parts.find((p) => /^(var\(--|#|rgb|transparent|currentcolor|Highlight)/i.test(p) && !/--focus-width/.test(p));
            if (!width || !RING_WIDTH.test(width)) bad.push(`width ${width}`);
            // A transparent ring draws nothing but in forced colors, where it
            // is the ring; the control shows its focus some other way.
            if (!color || !(RING_COLOR.test(color) || color === "transparent")) bad.push(`color ${color}`);
          } else if (d.prop === "outline-width" && !RING_WIDTH.test(d.value)) bad.push(`width ${d.value}`);
          else if (d.prop === "outline-color" && !RING_COLOR.test(d.value)) bad.push(`color ${d.value}`);
          else if (d.prop === "outline-offset" && !RING_OFFSET.test(d.value)) bad.push(`offset ${d.value}`);
        }
        if (bad.length) found.push(`${src.rel}:${rule.line} ${sel.trim()}: ${bad.join(", ")}`);
      }
    }
  }
  assert.deepEqual(found, [], `${found.length} focus rings are not the one ring:\n${found.join("\n")}`);
});

test("pointed at and pressed move nothing and cast no shadow", () => {
  const found = [];
  for (const src of SOURCES) {
    if (LATER.has(src.rel)) continue;
    for (const rule of rulesOf(src)) {
      for (const sel of splitList(rule.selector)) {
        const subject = bareCompound(subjectOf(sel));
        if (!/:(hover|active)\b/.test(subject)) continue;
        for (const d of rule.decls) {
          const moves = MOVES.has(d.prop) && d.value !== "none";
          const shadow = (d.prop === "box-shadow" || d.prop === "text-shadow") && d.value !== "none";
          const glow = d.prop === "filter" && d.value !== "none";
          if (moves || shadow || glow) found.push(`${src.rel}:${rule.line} ${sel}: ${d.prop}: ${d.value}`);
        }
      }
    }
  }
  assert.deepEqual(found, [], found.join("\n"));
});

test("nothing unavailable is faded with opacity", () => {
  const found = [];
  for (const src of SOURCES) {
    if (LATER.has(src.rel)) continue;
    for (const rule of rulesOf(src)) {
      for (const sel of splitList(rule.selector)) {
        const subject = subjectOf(sel);
        if (!/:disabled|\[disabled\]|\[aria-disabled="?true"?\]|[-_]disabled\b|\bis-disabled\b/.test(subject)) continue;
        for (const d of rule.decls) {
          const faded =
            (d.prop === "opacity" && Number(d.value) < 1) ||
            (d.prop === "filter" && /opacity|grayscale|contrast|brightness/.test(d.value));
          if (faded) found.push(`${src.rel}:${rule.line} ${sel}: ${d.prop}: ${d.value}`);
        }
      }
    }
  }
  assert.deepEqual(found, [], found.join("\n"));
});

test("red words are never filled: no fill is more than a fifth red", () => {
  for (const d of declarations(kitCss)) {
    if (!/^background/.test(d.prop) || !/--color-danger/.test(d.value)) continue;
    const m = /color-mix\(in srgb, var\(--color-danger\) (\d+)%, transparent\)/.exec(d.value);
    assert.ok(m && Number(m[1]) <= 20, `kit.css fills red: ${d.prop}: ${d.value}`);
  }
});

// ---------- Contrast, by day and by night ----------

/** tokens.css's two themes, with global.css's field border beside them. */
function themes() {
  const { day, night } = readTokens();
  const field = "rgba(var(--color-text-rgb), 0.58)";
  const global = readFileSync(join(repo, "src/styles/global.css"), "utf8");
  assert.match(global, /--field-border:\s*rgba\(var\(--ink-rgb\), 0\.58\);/, "global.css's field border moved; update the test");
  return { day: new Map([...day, ["--field-border", field]]), night: new Map([...night, ["--field-border", field]]) };
}

/** A resolved color as [r, g, b, a]: a hex, rgb(), rgba(), transparent, or
 *  color-mix(in srgb, …) of those. */
export function evalColor(text) {
  const t = text.trim();
  if (t === "transparent" || t === "none") return [0, 0, 0, 0];
  const mix = /^color-mix\(in srgb,\s*([\s\S]+)\)$/.exec(t);
  if (mix) {
    const parts = splitList(mix[1]).map((p) => {
      const m = /^([\s\S]*?)\s+([\d.]+)%$/.exec(p);
      return m ? { c: evalColor(m[1]), p: Number(m[2]) / 100 } : { c: evalColor(p), p: null };
    });
    const [a, b] = parts;
    const pa = a.p ?? (b.p === null ? 0.5 : 1 - b.p);
    const pb = b.p ?? 1 - pa;
    const alpha = a.c[3] * pa + b.c[3] * pb;
    if (alpha === 0) return [0, 0, 0, 0];
    const rgb = [0, 1, 2].map((i) => (a.c[i] * a.c[3] * pa + b.c[i] * b.c[3] * pb) / alpha);
    return [...rgb, alpha];
  }
  return parseColor(t);
}

/** A value from kit.css, resolved in a theme, as a color. */
const colorIn = (theme) => (value) => evalColor(resolve(value, theme));

test("every state stands out: words at 4.5:1, edges and tracks at 3:1, by day and by night", () => {
  const T = themes();
  const S = Object.fromEntries(
    ["filled", "tinted", "plain", "danger", "row", "tab", "inline", "field", "dot"].map((l) => [l, statesOf(l)]),
  );
  const fails = [];
  for (const [name, theme] of Object.entries(T)) {
    const c = colorIn(theme);
    for (const surfaceName of ["--color-page", "--color-float"]) {
      const surface = c(`var(${surfaceName})`);
      const at = `${name}, on ${surfaceName}`;
      const check = (what, fg, bg, min) => {
        const base = over(bg, surface);
        const ratio = contrast(over(fg, base), base);
        if (ratio < min) fails.push(`${at}: ${what} ${ratio.toFixed(2)} < ${min}`);
      };
      for (const level of ["filled", "tinted", "plain", "danger", "row", "tab", "inline"]) {
        const s = S[level];
        for (const state of ["rest", "hover", "press", "on", "off"]) {
          if (!s[state]) continue;
          const words = s[state].color ?? s.rest.color;
          let fill = s[state].background ?? s[state]["background-color"] ?? s.rest.background;
          if (state === "off" && !s.off.background) fill = s.rest.background;
          check(`${level} ${state} words`, c(words), c(fill), 4.5);
        }
      }
      // A tab that is on: its underline.
      const underline = /inset 0 -2px 0 (var\(--[\w-]+\))/.exec(S.tab.on["box-shadow"] || "");
      assert.ok(underline, "a tab that is on has no underline");
      check("tab on underline", c(underline[1]), c("transparent"), 3);
      // A field: its edge, its words, its placeholder, and unavailable.
      check("field edge", c(S.field.rest["border"].replace(/^1px solid /, "")), c(S.field.rest.background), 3);
      check("field words", c(S.field.rest.color), c(S.field.rest.background), 4.5);
      check("field placeholder", c(S.field.placeholder.color), c(S.field.rest.background), 4.5);
      check("field unavailable", c(S.field.off.color), c(S.field.off.background), 4.5);
      // A dot's edge and its ring when on.
      check("dot edge", c(S.dot.rest.border.replace(/^1px solid /, "")), c("transparent"), 3);
      check("dot on ring", c(/0 0 0 2px (.+)$/.exec(S.dot.on["box-shadow"])[1]), c("transparent"), 3);
      // The filled button unavailable: its edge still shows it is a button.
      // A switch: the track off and on, and the knob on each.
      check("switch track off", c("rgba(var(--color-text-rgb), 0.58)"), c("transparent"), 3);
      check("switch knob off", c("var(--color-page)"), c("rgba(var(--color-text-rgb), 0.58)"), 3);
      check("switch track on", c("var(--color-press)"), c("transparent"), 3);
      check("switch knob on", c("var(--color-on-press)"), c("var(--color-press)"), 3);
      // The focus ring.
      check("focus ring", c("var(--focus-ring)"), c("transparent"), 3);
    }
  }
  assert.deepEqual(fails, [], fails.join("\n"));
});

test("the selector readers", () => {
  assert.equal(subjectOf(".a .b > button:hover"), "button:hover");
  assert.equal(subjectOf(":is(.a, .b) .c:not(.d .e)"), ".c:not(.d .e)");
  assert.equal(bareCompound(".x:not(.y):has(> button)"), ".x");
  assert.ok(controlReason("button.foo"));
  assert.ok(controlReason(".site-footer__cta"));
  assert.ok(controlReason('[role="tab"]'));
  assert.ok(controlReason(".lit-panel__button:hover"));
  assert.equal(controlReason(".kit-buttonless-label"), null);
  assert.equal(controlReason(".footer a"), null);
  assert.equal(controlReason(".x:not(button)"), null);
  assert.equal(controlReason(".row:has(> input)"), null);
  assert.ok(isLook("background", "none", ".x"));
  assert.ok(!isLook("border", "0", ".x"));
  assert.ok(isLook("border", "1px solid var(--field-border)", ".x"));
  assert.ok(!isLook("opacity", "0", ".x"));
  assert.ok(isLook("opacity", "0.6", ".x"));
  assert.ok(isLook("transform", "translateY(-1px)", ".x:hover"));
  assert.ok(!isLook("transform", "rotate(180deg)", '.x[aria-expanded="true"]'));
  assert.ok(isLook("font", "inherit", ".x"));
  assert.ok(isLook("font-weight", "400", ".x"));
  assert.ok(!isLook("font-family", "OpenDyslexic, sans-serif", ".x", true));
  assert.ok(isLook("text-transform", "uppercase", ".x"));
  assert.ok(!isLook("text-transform", "none", ".x"));
  assert.ok(isLook("border-radius", "999px", ".x"));
  assert.ok(isLook("border-top-left-radius", "0", ".x"));
  assert.ok(!isLook("font-size", "0.9rem", ".x"));
  assert.ok(!isLook("padding", "0 12px", ".x"));
  assert.deepEqual(evalColor("color-mix(in srgb, #ff0000 10%, transparent)").map((v) => Math.round(v * 100) / 100), [255, 0, 0, 0.1]);
  assert.deepEqual(evalColor("color-mix(in srgb, #000000 50%, #ffffff)").map(Math.round), [128, 128, 128, 1]);
});
