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
// by name (the Display tray's settings, keyboard shortcuts),
// and the header's news marks' key, which nothing writes while the news list is
// empty, and nothing else. Cookies are checked by the last test: a rendered component's
// cookie is named on /privacy, and the page's count of them is right.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import { LAYOUT_KEY } from "../src/lib/desk-layout.mjs";
import { GREEK_NOTES_KEY } from "../src/lib/desk-greek-notes.mjs";
import { SYNC_DB } from "../src/lib/desk-sync-link.mjs";

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
  ["lit-justify", "display setting: Justify (prose on /privacy, justification)"],
  ["lit-verse-numbers", "display setting: verse numbers in Chapter View (prose on /privacy, what the page shows)"],
  ["lit-read-numbers", "display setting: Read View's verse numbers, read as the chapter page's fallback since Read View retired and cleared once its switch is set (prose on /privacy, what the page shows)"],
  ["lit-fn-letters", "display setting: footnote letters (prose on /privacy, what the page shows)"],
  ["lit-terms", "display setting: term underlines (prose on /privacy, what the page shows)"],
  ["lit_rm_fontSize", "Read View's legacy text size key, read once and moved to lit-size (display settings, prose on /privacy)"],
  ["lit_rm_lineHeight", "Read View's legacy line spacing key, read once and moved to lit-leading (display settings, prose on /privacy)"],
  ["lit_rm_markers", "Read View's legacy verse-number key, read as the chapter page's last fallback and cleared once its switch is set (display settings, prose on /privacy)"],
  ["lit-shortcuts", "keyboard shortcuts switch (prose on /privacy: whether you have turned keyboard shortcuts off)"],
  ["lit_last_read", "the chapter you last read (prose on /privacy; the record is src/scripts/last-read.js)"],
  ["lit_app_banner_dismissed", "the Android app banner, closed (prose on /privacy)"],
  ["lit_pv", "session count of pageviews for the app announcement (session storage, prose on /privacy)"],
  ["lit-news-seen", "the header's news marks (src/lib/news.mjs): written only once the news list holds an entry, and test/news.test.js fails if one is added before /privacy names this key"],
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
    //    a `key:` or `legacy:` property, or a lit_ value in a property map. lit_
    //    values are never class names here; lit- values often are.
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
  // Not storage either: two of the encryption spec's labels (an HKDF `info` and an HPKE `info`), found
  // because they sit under property names that hold "key" (LABELS.passkey, LABELS.keyring). That module
  // has no storage at all, and test/desk-crypto.test.js holds it to that. The synced notebook's own
  // storage (step 4g) is a database, not a key, so this scan can't find it: the test below holds it.
  const cryptoLabels = new Set(["lit-notebook/1 passkey", "lit-notebook/1 keyring"]);
  const named = new Set(privacyCodeKeys());
  const missing = [...found]
    .filter(([k]) => !channels.has(k) && !cryptoLabels.has(k) && !named.has(k) && !ALLOWLIST.has(k))
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

test("the synced notebook's storage is named on /privacy, and it adds no local or session storage", () => {
  // The sync keeps its state in one IndexedDB database of its own (sync/sync-db.js) and one value in
  // the notebook's meta store; neither is a key the scan above can see.
  assert.ok(privacy.includes(`<code>${SYNC_DB}</code>`), `/privacy names the database ${SYNC_DB}`);
  const dir = join(SRC, "scripts", "desk", "sync");
  const files = [...sources(dir), join(SRC, "lib", "desk-sync.mjs"), join(SRC, "lib", "desk-sync-engine.mjs"), join(SRC, "lib", "desk-sync-link.mjs"), join(SRC, "lib", "desk-sync-status.mjs")];
  assert.ok(files.length >= 9, "the sync's files were found");
  for (const file of files) {
    const text = readFileSync(file, "utf8");
    assert.ok(!/\b(?:localStorage|sessionStorage|document\.cookie)\b/.test(text.replace(/\/\/.*$/gm, "")), `${file} uses storage /privacy doesn't name`);
    // Every database the sync opens is the one named.
    for (const m of text.matchAll(/\.open\(\s*(["'`])([^"'`]+)\1/g)) assert.ok(m[2] === SYNC_DB || m[2] === "lit-desk", `${file} opens ${m[2]}`);
  }
});

test("every cookie a rendered component sets is named on /privacy, and the page counts them right", () => {
  // A component sets a cookie through `COOKIE_NAME = "…"`; it is rendered when
  // some other file imports it (WelcomePopover.astro is kept but retired).
  const files = sources(SRC);
  const live = [];
  for (const file of files) {
    const text = readFileSync(file, "utf8");
    if (!text.includes("document.cookie =")) continue;
    const name = text.match(/COOKIE_NAME\s*=\s*["']([^"']+)["']/)?.[1];
    assert.ok(name, `${file} sets a cookie without a COOKIE_NAME`);
    const base = file.replaceAll("\\", "/").split("/").pop();
    const imported = files.some((f) => f !== file && readFileSync(f, "utf8").includes(`/${base}"`));
    if (imported) live.push(name);
  }
  assert.ok(live.length >= 1);
  for (const name of live) assert.ok(privacy.includes(`<code>${name}</code>`), `/privacy doesn't name the cookie ${name}`);
  const words = ["no", "one", "two", "three"];
  assert.match(privacy, new RegExp(String.raw`sets ${words[live.length]}\s+cookies? of its own`), `/privacy should say the site sets ${words[live.length]} cookie(s) of its own`);
});
