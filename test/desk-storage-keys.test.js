// test/desk-storage-keys.test.js
//
// /privacy must name every storage key the site writes (Audit 2, LG-2, LG-8:
// the BA42 class of drift; widened by Audit 3, LG3-7). Reads the page and the
// code, so a new key that isn't disclosed fails here instead of by hand.
//
// A key is found three ways, all in src/ (.js, .mjs, .astro, .ts):
// 1. a string literal, or a template literal's prefix before its first hole,
//    passed as the key of getItem, setItem or removeItem;
// 2. a literal starting lit- or lit_ held in a key position: a constant whose
//    name contains KEY (`const KEY = "…"`), or a `key: "…"` property (the
//    Display tray's SETTINGS table);
// 3. the reverse: every key /privacy names in a <code> element must appear in
//    the code, so /privacy can't name a key that was removed.
//
// A found key must be named on /privacy as <code>key</code>, or be in ALLOWLIST
// with a reason. ALLOWLIST is for keys the page describes in prose rather than
// by name (the Display tray's settings, the Read View place, keyboard shortcuts)
// and for the rare key the owner has not yet decided on (TODO(BVJ)). Cookies
// (document.cookie) are not storage and are not scanned here.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import { LAYOUT_KEY } from "../src/lib/desk-layout.mjs";
import { GREEK_NOTES_KEY } from "../src/lib/desk-greek-notes.mjs";

const privacy = readFileSync(new URL("../src/pages/privacy.astro", import.meta.url), "utf8");
const SRC = new URL("../src", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");

/** Site-wide keys that are not named as <code> on /privacy, each with the reason. */
const ALLOWLIST = new Map([
  // Named in /privacy's prose as "your display settings (font, theme, text size, line spacing, and what the page shows)".
  ["lit-theme", "display setting: theme (prose on /privacy)"],
  ["lit-font", "display setting: reader font (prose on /privacy)"],
  ["dyslexic-font", "display setting: the older dyslexic font switch, read and cleared on the way to lit-font (prose on /privacy)"],
  ["lit-size", "display setting: text size (prose on /privacy)"],
  ["lit-leading", "display setting: line spacing (prose on /privacy)"],
  ["lit-verse-numbers", "display setting: verse numbers in Chapter View (prose on /privacy, what the page shows)"],
  ["lit-read-numbers", "display setting: verse numbers in Read View (prose on /privacy, what the page shows)"],
  ["lit-fn-letters", "display setting: footnote letters (prose on /privacy, what the page shows)"],
  ["lit-terms", "display setting: term underlines (prose on /privacy, what the page shows)"],
  ["lit_rm_fontSize", "Read View's legacy text size key, read once and moved to lit-size (display settings, prose on /privacy)"],
  ["lit_rm_lineHeight", "Read View's legacy line spacing key, read once and moved to lit-leading (display settings, prose on /privacy)"],
  ["lit_rm_markers", "Read View's legacy verse-number key, read once and moved to lit-read-numbers (display settings, prose on /privacy)"],
  ["lit_rm_resume_", "the place you last reached in each book in Read View (prose on /privacy)"],
  // TODO(BVJ): Read View's focus-mode setting, saved when the reader keeps it. /privacy's
  // "what the page shows" doesn't clearly name it. Left for BVJ (audit 3, LG3-7); the privacy page is not edited here.
  ["lit_rm_focus", "TODO(BVJ): Read View's focus mode, saved as a setting; not clearly named on /privacy (audit 3, LG3-7)"],
  ["lit-shortcuts", "keyboard shortcuts switch (prose on /privacy: whether you have turned keyboard shortcuts off)"],
  ["lit_last_read", "the chapter you last read (prose on /privacy; the record is src/scripts/last-read.js)"],
  ["lit_app_banner_dismissed", "the Android app banner, closed (prose on /privacy)"],
  ["lit_pv", "session count of pageviews for the app announcement (session storage, prose on /privacy)"],
]);

function sources(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) sources(p, out);
    else if (/\.(js|mjs|astro|ts)$/.test(name)) out.push(p);
  }
  return out;
}

const KEY_START = /^lit[-_]|^dyslexic-font$/;

/** Every key the code passes to a storage call or holds in a key position: key -> the first file it is in. */
function codeKeys() {
  const found = new Map();
  const add = (key, file) => {
    if (!found.has(key)) found.set(key, file);
  };
  for (const file of sources(SRC)) {
    if (file.endsWith("privacy.astro")) continue;
    const text = readFileSync(file, "utf8");
    const rel = file.replaceAll("\\", "/").replace(/^.*\/src\//, "src/");
    // 1. Literal (or template prefix) passed to getItem, setItem or removeItem.
    for (const m of text.matchAll(/\b(?:getItem|setItem|removeItem)\(\s*(["'`])([^"'`]*)/g)) {
      const hole = m[2].indexOf("${");
      const key = hole === -1 ? m[2] : m[2].slice(0, hole);
      if (key) add(key, rel);
    }
    // 2. A literal starting lit- or lit_ in a key position: a KEY-named constant,
    //    a `key:` or `legacy:` property, or a lit_ value in a property map (read-mode's
    //    STORAGE table). lit_ values are never class names here; lit- values often are.
    for (const m of text.matchAll(/\b\w*(?:KEY|Key|key|legacy)\w*\s*[:=]\s*(["'`])([^"'`]*)/g)) {
      const hole = m[2].indexOf("${");
      const key = hole === -1 ? m[2] : m[2].slice(0, hole);
      if (KEY_START.test(key)) add(key, rel);
    }
    for (const m of text.matchAll(/\b\w+\s*:\s*(["'`])(lit_[^"'`]*)/g)) {
      const hole = m[2].indexOf("${");
      add(hole === -1 ? m[2] : m[2].slice(0, hole), rel);
    }
  }
  return found;
}

/** True when a key appears in the code as a quoted literal or a template prefix. */
function inCode(key) {
  const quoted = new RegExp(`["'\`]${key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:["'\`]|\\$\\{)`);
  return sources(SRC).some((file) => !file.endsWith("privacy.astro") && quoted.test(readFileSync(file, "utf8")));
}

const privacyCodeKeys = () => [...privacy.matchAll(/<code>([^<]+)<\/code>/g)].map((m) => m[1]);

test("every storage key the code writes or reads is named on /privacy, or allowlisted with a reason", () => {
  const found = codeKeys();
  assert.ok(found.size > 15, "the scan found the keys");
  // BroadcastChannel names, not storage; /privacy describes them in a sentence of their own.
  const channels = new Set(["lit-desk-follow-tab"]);
  const named = new Set(privacyCodeKeys());
  const missing = [...found]
    .filter(([k]) => !channels.has(k) && !named.has(k) && !ALLOWLIST.has(k))
    .map(([k, file]) => `${k} (in ${file})`);
  assert.deepEqual(missing, [], `storage keys not on /privacy and not allowlisted:\n  ${missing.join("\n  ")}`);
});

test("every allowlisted key is still in the code and not already named on /privacy", () => {
  for (const key of ALLOWLIST.keys()) {
    assert.ok(inCode(key), `${key} is allowlisted but no longer in the code; drop it`);
  }
});

test("every key /privacy names in code is still in the code", () => {
  for (const key of privacyCodeKeys().filter((k) => KEY_START.test(k))) {
    assert.ok(inCode(key), `/privacy names ${key}, which the code no longer uses`);
  }
});

test("the two keys the layout and Greek-notes rules export are the ones /privacy names", () => {
  assert.ok(privacy.includes(`<code>${LAYOUT_KEY}</code>`));
  assert.ok(privacy.includes(`<code>${GREEK_NOTES_KEY}</code>`));
});
