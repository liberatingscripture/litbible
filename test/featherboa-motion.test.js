// "Motion" (SITE-FEATHERBOA.md): four speeds and one curve. Every transition
// and animation in the site's styles runs at one of the four duration tokens
// (or not at all) on the one easing token, nothing loops, and reduced motion
// keeps its own zeroing; scripts that move things use the same numbers. The
// /apps files are a mirror of the LSC site's and keep their own.

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  styleSources,
  scriptSources,
  declarations,
  splitTop,
  inReducedMotion,
  isMirrored,
} from "./helpers/featherboa-css.mjs";

const DURATION = /^var\(--dur-(instant|quick|settled|large)(-out)?\)$/;
const ZERO = /^0(m?s)?$/;
const TIME = /^(?:\d*\.?\d+m?s|var\(--dur-[\w-]+\))$/;
const EASINGS = /^(?:ease|ease-in|ease-out|ease-in-out|linear|step-start|step-end|cubic-bezier\(.*\)|steps\(.*\)|var\(--ease\))$/;

/** Every transition or animation declaration outside reduced motion. */
function* motion() {
  for (const { rel, css } of styleSources()) {
    if (isMirrored(rel)) continue;
    for (const d of declarations(css)) {
      if (!/^(transition|animation)(-duration|-timing-function|-iteration-count)?$/.test(d.prop)) continue;
      if (inReducedMotion(d.context)) continue;
      yield { ...d, where: `${rel}:${d.line} ${d.prop}: ${d.value}` };
    }
  }
}

test("every transition and animation runs at one of the four speeds, on the one curve", () => {
  const bad = [];
  for (const d of motion()) {
    if (d.value === "none" || d.prop.endsWith("-iteration-count")) continue;
    if (d.prop.endsWith("-duration")) {
      for (const t of splitTop(d.value)) if (!ZERO.test(t) && !DURATION.test(t)) bad.push(d.where);
      continue;
    }
    if (d.prop.endsWith("-timing-function")) {
      for (const t of splitTop(d.value)) if (t !== "var(--ease)" && t !== "linear") bad.push(d.where);
      continue;
    }
    for (const item of splitTop(d.value)) {
      const parts = splitTop(item, " ");
      const time = parts.find((p) => TIME.test(p)) ?? "0s";
      if (ZERO.test(time)) continue; // an instant change (a visibility flip) needs no curve
      if (!DURATION.test(time)) bad.push(`${d.where} (duration ${time})`);
      const easing = parts.filter((p) => EASINGS.test(p));
      // A discrete property flips at the end of its time and takes no curve;
      // anything else names the curve, or it gets the browser's own "ease".
      const discrete = /^visibility\b/.test(item);
      if (!discrete && (easing.length !== 1 || easing[0] !== "var(--ease)")) bad.push(`${d.where} (curve)`);
    }
  }
  assert.deepEqual(bad, []);
});

test("nothing loops", () => {
  const loops = [...motion()].filter((d) => /\binfinite\b/.test(d.value)).map((d) => d.where);
  assert.deepEqual(loops, []);
});

test("reduced motion still zeroes every duration, site-wide", () => {
  const global = styleSources().find((s) => s.rel === "src/styles/global.css").css;
  const zeroed = [...declarations(global)].filter((d) => inReducedMotion(d.context));
  for (const prop of ["transition-duration", "animation-duration", "animation-iteration-count"]) {
    assert.ok(zeroed.some((d) => d.prop === prop && d.important), `${prop} under reduced motion`);
  }
});

test("under reduced motion only what declares a transition takes one, so a change of size lands at once", () => {
  // The scripts that hold the reader's place (keep-reading-place.js,
  // read-on.js, Study's text pane) measure right after a change. With the
  // property's initial "all" and the short duration, every margin or font
  // size became a transition that landed a frame later: in headless Chrome
  // the Display tray's Large threw John 3 144px, and a chapter loading above
  // moved the text 22px.
  const global = styleSources().find((s) => s.rel === "src/styles/global.css").css;
  const reduced = [...declarations(global)].filter((d) => inReducedMotion(d.context));
  assert.ok(
    reduced.some((d) => d.prop === "transition-property" && d.value === "none" && !d.important),
    "transition-property: none under reduced motion, below any rule that declares one",
  );
  // So every transition names its properties: one leaning on "all" would
  // take every change with it again.
  const leaning = [];
  for (const d of motion()) {
    if (d.prop === "transition-duration") leaning.push(`${d.where} (a duration with no property)`);
    if (d.prop !== "transition" || d.value === "none") continue;
    for (const item of splitTop(d.value)) {
      const parts = splitTop(item, " ");
      const named = parts.filter((p) => !TIME.test(p) && !EASINGS.test(p) && !/^(allow-discrete|normal)$/.test(p));
      if (named.length === 0 || named.includes("all")) leaning.push(d.where);
    }
  }
  assert.deepEqual(leaning, []);
});

test("scripts that move things use the speeds and the curve too", () => {
  const bad = [];
  for (const { rel, text } of scriptSources()) {
    if (isMirrored(rel)) continue;
    // Web Animations: a duration from the speeds, the curve written out.
    for (const m of text.matchAll(/\.animate\(([\s\S]*?)\)(?:\.finished|;)/g)) {
      const dur = m[1].match(/duration:\s*(\d+)/);
      if (dur && ![0, 80, 120, 173, 180, 260].includes(Number(dur[1]))) bad.push(`${rel}: duration ${dur[1]}`);
      const ease = m[1].match(/easing:\s*"([^"]+)"/);
      if (ease && ease[1] !== "cubic-bezier(0.2, 0.8, 0.2, 1)") bad.push(`${rel}: easing ${ease[1]}`);
    }
    // A transition set from a script names a token, never a time of its own.
    for (const m of text.matchAll(/\.style\.(transition|transitionDuration|transitionDelay)\s*=\s*([^;]+);/g)) {
      if (/\b(?!0m?s\b)\d+m?s\b/.test(m[2])) bad.push(`${rel}: style.${m[1]} = ${m[2].trim()}`);
    }
  }
  assert.deepEqual(bad, []);
});
