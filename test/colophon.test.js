// The colophon (src/pages/colophon.astro, "How this site is made") states
// facts about the site. Hold the ones most likely to drift to their files:
// the faces it names are the faces the site serves, the colors it names are
// the tokens' values, and the licenses it names are the packages' and the
// icon set's.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { repo, readTokens } from "./helpers/featherboa-css.mjs";

const page = readFileSync(join(repo, "src/pages/colophon.astro"), "utf8");
const faces = readFileSync(join(repo, "src/styles/faces.css"), "utf8");
const { day, night } = readTokens();

test("every face the page names is one the site serves, under its token", () => {
  // page name -> the family faces.css declares, and the token that uses it
  const named = {
    "Fraunces": ["Fraunces Variable", "--font-display"],
    "Source Sans 3": ["Source Sans 3 Variable", "--font-text"],
    "Atkinson Hyperlegible Next": ["Atkinson Hyperlegible Next Variable", "--font-control"],
    "OpenDyslexic": ["OpenDyslexic", null],
  };
  const tokens = readFileSync(join(repo, "src/styles/tokens.css"), "utf8");
  for (const [name, [family, token]] of Object.entries(named)) {
    assert.ok(page.includes(name), `the page names ${name}`);
    assert.ok(faces.includes(`font-family: "${family}"`), `faces.css serves ${family}`);
    if (token) {
      assert.match(tokens, new RegExp(`${token}:\\s*"${family}"`), `${token} starts with ${family}`);
    }
  }
});

test("the page names no face the site no longer uses", () => {
  for (const gone of ["Inter", "Crimson", "Literata", "Playpen"]) {
    assert.ok(!new RegExp(`\\b${gone}\\b`).test(page.replace(/^---[\s\S]*?---/, "")), `${gone} is not named`);
  }
});

test("the colors it names are the tokens' values, by day and by night", () => {
  const rows = {
    "Paper": ["--brand-paper", "#FAFAF8"],
    "Ink": ["--brand-ink", "#1D231C"],
    "LIT Green": ["--brand-lit-green", "#209D50"],
    "Deep green": ["--brand-deep-green", "#0F6B33"],
    "Sunshine": ["--brand-sunshine", "#FFD23F"],
    "Red": ["--brand-red", "#B3261E"],
  };
  for (const [name, [token, hex]] of Object.entries(rows)) {
    assert.equal(day.get(token).toUpperCase(), hex, `${token} in tokens.css`);
    assert.match(page, new RegExp(`name: "${name}",\\s*hex: "${hex}",\\s*swatch: "var\\(${token}\\)"`, "i"), `the page's ${name} row`);
  }
  assert.equal(night.get("--color-page").toUpperCase(), "#111411");
  assert.equal(night.get("--color-text").toUpperCase(), "#ECEEE8");
  assert.ok(page.includes("#111411") && page.includes("#ECEEE8"), "the page gives night's page and words");
});

test("the four speeds it names are the tokens' (in seconds)", () => {
  assert.equal(day.get("--dur-instant"), "0ms");
  for (const [token, seconds] of [["--dur-quick", "0.12"], ["--dur-settled", "0.18"], ["--dur-large", "0.26"]]) {
    assert.equal(Number.parseFloat(day.get(token)) / 1000, Number(seconds), token);
    assert.ok(page.includes(`(${seconds} seconds)`), `the page says ${seconds} seconds`);
  }
});

test("the controls' sizes it names are the tokens'", () => {
  assert.equal(day.get("--target"), "36px");
  assert.equal(day.get("--target-touch"), "44px");
  assert.ok(page.includes("36 pixels") && page.includes("44 on a touch"));
});

test("the licenses it names: the faces' packages are OFL, the icons are Lucide's under ISC", () => {
  for (const pkg of [
    "@fontsource-variable/fraunces",
    "@fontsource-variable/source-sans-3",
    "@fontsource-variable/atkinson-hyperlegible-next",
    "@fontsource/opendyslexic",
    "@fontsource-variable/noto-sans-hebrew",
    "@fontsource/cardo",
  ]) {
    const json = JSON.parse(readFileSync(join(repo, "node_modules", pkg, "package.json"), "utf8"));
    assert.equal(json.license, "OFL-1.1", pkg);
  }
  assert.ok(page.includes("SIL Open Font License") && page.includes("ISC license"));
  assert.match(readFileSync(join(repo, "src/lib/icons.mjs"), "utf8"), /lucide-static[\s\S]{0,40}\(ISC/);
});

test("the page's own facts: its title, its address, and the sentence about who translates", () => {
  assert.match(page, /<h1 class="colophon-title"[^>]*>How this site is made<\/h1>/);
  assert.ok(page.includes("https://litbible.net/colophon/"));
  assert.ok(page.includes("Brandon translates every word of the LIT"), "Q2's sentence says who translates");
  assert.ok(!/Featherboa|Study Desk/.test(page.replace(/^---[\s\S]*?---/, "")), "no private names in what a reader sees");
  assert.ok(!/—/.test(page), "no em dashes");
});
