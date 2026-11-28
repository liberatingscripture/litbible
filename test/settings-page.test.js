// All settings for every reader (src/pages/settings.astro and
// src/scripts/settings-page.js; Featherboa, Phase 4, part three): the
// keyboard shortcuts' switch (DI-20; required, WCAG 2.1.4), driven in a
// browser DOM on the page's own markup with Study off, and what keeps the
// page out of search and the sitemap. Study's part, which desk-gate.js loads
// only where Study is on (test/desk-audit8-h-gate.test.js), is
// test/desk-settings-page.test.js.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resetDom, window } from "./helpers/browser-env.mjs";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const page = read("src/pages/settings.astro");
const css = read("src/styles/pages/settings.css");

// The page's body as the build writes it: what sits between Layout's tags.
const body = page.slice(page.indexOf(">", page.indexOf("<Layout")) + 1, page.indexOf("</Layout>"));

let n = 0;
async function openPage({ shortcuts = null } = {}) {
  resetDom("http://localhost/settings/");
  localStorage.clear();
  if (shortcuts) localStorage.setItem("lit-shortcuts", shortcuts);
  delete document.documentElement.dataset.desk;
  document.body.innerHTML = body;
  await import(`../src/scripts/settings-page.js?n=${++n}`);
}

const q = (sel) => document.querySelector(sel);
const click = (el) => el.dispatchEvent(new window.MouseEvent("click", { bubbles: true, cancelable: true }));
const keys = () => q('[data-settings-switch="shortcuts"]');

test("the switch is hidden until its script runs, then on by default; off writes what keyboard-shortcuts.js reads (DI-20)", async () => {
  resetDom("http://localhost/settings/");
  document.body.innerHTML = body;
  assert.equal(q("[data-settings-keys]").hidden, true, "a switch that can't work isn't shown");
  await openPage();
  assert.equal(q("[data-settings-keys]").hidden, false);
  assert.equal(keys().getAttribute("role"), "switch");
  assert.equal(keys().className, "kit-switch");
  assert.equal(keys().textContent, "Keyboard shortcuts");
  assert.equal(keys().getAttribute("aria-checked"), "true");

  let told = 0;
  const hear = () => told++;
  document.addEventListener("lit:shortcuts-changed", hear);
  try {
    click(keys());
    assert.equal(keys().getAttribute("aria-checked"), "false");
    assert.equal(localStorage.getItem("lit-shortcuts"), "off");
    assert.equal(told, 1, "the page is told, so Study's line about H can follow");
    click(keys());
    assert.equal(keys().getAttribute("aria-checked"), "true");
    assert.equal(localStorage.getItem("lit-shortcuts"), null, "on stores nothing");
    assert.equal(told, 2);
  } finally {
    document.removeEventListener("lit:shortcuts-changed", hear);
  }
});

test("a reader who turned them off before finds the switch off, and another tab's switch is followed", async () => {
  await openPage({ shortcuts: "off" });
  assert.equal(keys().getAttribute("aria-checked"), "false");
  localStorage.removeItem("lit-shortcuts");
  window.dispatchEvent(new window.StorageEvent("storage", { key: "lit-shortcuts" }));
  assert.equal(keys().getAttribute("aria-checked"), "true");
});

test("the switch is described by what the keys do; H is listed only where Study is on", async () => {
  await openPage();
  const described = keys().getAttribute("aria-describedby").split(" ");
  assert.deepEqual(described, ["settingsKeysHint", "settingsKeysList"]);
  assert.ok(described.every((id) => document.getElementById(id)), "both are on the page");
  const rows = [...q("#settingsKeysList").children].map((li) => li.textContent.replace(/\s+/g, " ").trim());
  assert.deepEqual(rows, ["/ Search", "g Choose passage", "← → or [ ] Previous or next chapter", "h Hide or show your marks"]);
  assert.ok(q("#settingsKeysList > :last-child").classList.contains("settings-page__desk-key"));
  assert.match(css, /\n\.settings-page__desk-key \{\s*display: none;\s*\}/);
  assert.match(css, /\nhtml\[data-desk\] \.settings-page__desk-key \{\s*display: block;\s*\}/);
});

test("Study's part has its place and its loading line, which shows only while Study's code loads (BA153)", async () => {
  await openPage();
  const desk = q("[data-settings-page]");
  assert.ok(desk, "desk-gate.js looks for it");
  assert.equal(desk.querySelector(".settings-page__loading").textContent, "Loading Study’s settings…");
  assert.match(css, /\n\.settings-page__loading \{\s*display: none;\s*\}/);
  assert.match(css, /\nhtml\[data-desk="on"\] \.settings-page__loading \{\s*display: block;\s*\}/);
});

test("every /settings/#part the help page links to is in the page's markup, inside Study's place, until Study draws it", async () => {
  await openPage();
  const desk = q("[data-settings-page]");
  const parts = new Set([...read("src/pages/desk/help.astro").matchAll(/href="\/settings\/#([^"]+)"/g)].map((m) => m[1]));
  assert.ok(parts.size > 0, "the help page links to parts of /settings");
  for (const id of parts) {
    const at = document.getElementById(id);
    assert.ok(at && desk.contains(at) && at.hidden, `#${id} stands, empty and hidden, in Study's place (npm run check:links reads the built page)`);
  }
});

// The line under the header names it "Settings" in no place: test/places.test.js.
test("noindex, and out of the sitemap and Pagefind", () => {
  assert.match(page, /robotsNoindex=\{true\}/);
  assert.doesNotMatch(page, /pagefindIndex/, "Layout leaves it out of Pagefind by default");
  assert.match(read("astro.config.mjs"), /if \(slug === 'settings'\) return false;/, "out of the sitemap");
});
