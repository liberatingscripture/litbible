// test/desk-audit8-h-gate.test.js
//
// LG8-1 (Study Desk Audit 8): the root rule is that the desk is downloaded only
// with <html data-desk="on"> (a shared sheet's viewer on a phone aside). The
// import-graph test (desk-gate-imports) and the pre-paint test (desk-prepaint)
// hold the two ends; nothing ran desk-gate.js or sheet-share-gate.js itself, so
// dropping `=== "on"` from one of the gate's branches broke no test.
//
// These two files are plain browser scripts that touch `document` and `window`
// as they load, and load the desk with dynamic import(). So each case writes a
// copy of the file to a temp directory with two rewrites (its static imports
// pointed at a stub or at the real helper by absolute address, and every
// `import("./desk/...")` pointed at a counter), imports it with a stub
// `document`, and reads which desk modules it asked for. The copy is made from
// the file on disk each time, so an edit to the gate is the edit under test.

import { test, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const work = mkdtempSync(join(tmpdir(), "lit-gate-"));
after(() => rmSync(work, { recursive: true, force: true }));

const gateSource = readFileSync(join(root, "src/scripts/desk-gate.js"), "utf8");
const shareSource = readFileSync(join(root, "src/scripts/sheet-share-gate.js"), "utf8");

/** The source with its desk imports turned into counted stubs; refuses to run if any import survives. */
function instrument(source, staticImports) {
  let out = source;
  for (const [from, to] of staticImports) {
    assert.ok(out.includes(from), `expected the import ${from}`);
    out = out.replace(from, to);
  }
  const dynamic = /import\(\s*(["'])(\.\/desk\/[^"']+)\1\s*\)/g;
  assert.ok(dynamic.test(out), "expected the gate to load the desk with import()");
  dynamic.lastIndex = 0;
  out = out.replace(dynamic, (_, __, spec) => `globalThis.__deskImport(${JSON.stringify(spec)})`);
  assert.doesNotMatch(out, /\bimport\s*\(/, "an import() the test doesn't stub would load the real desk");
  assert.doesNotMatch(out, /^\s*import\s[^;]*["']\.{1,2}\//m, "a relative static import the test doesn't stub");
  return out;
}

let serial = 0;
const GLOBALS = ["document", "window", "history", "location", "navigator", "console", "__deskImport", "__gateFrame"];

/** Run `source` with these globals; returns once its dynamic imports have settled. */
async function run(source, globals) {
  const file = join(work, `case-${++serial}.mjs`);
  writeFileSync(file, source);
  const saved = new Map(GLOBALS.map((k) => [k, Object.getOwnPropertyDescriptor(globalThis, k)]));
  for (const [k, v] of Object.entries(globals)) Object.defineProperty(globalThis, k, { value: v, configurable: true, writable: true });
  try {
    await import(pathToFileURL(file).href);
    // loadShell chains a few promise turns before it calls start().
    for (let i = 0; i < 10; i++) await new Promise((r) => setImmediate(r));
  } finally {
    for (const k of GLOBALS) {
      const d = saved.get(k);
      if (d) Object.defineProperty(globalThis, k, d);
      else delete globalThis[k];
    }
  }
}

/* ── desk-gate.js ─────────────────────────────────────────────────────── */

const MARKERS = { notebook: "[data-notebook-page]", desk: "[data-desk-page]", sheet: "[data-sheet-page]" };
const gate = instrument(gateSource, [['import { readingSurface, standDown } from "./desk-frame.js";', "const { readingSurface, standDown } = globalThis.__gateFrame;"]]);

/** Load desk-gate.js on a page with this data-desk value, reading surface, and marker; returns what it did. */
async function gateOn({ desk, reading = false, marker = null, following = true }) {
  const asked = [];
  const store = new Map(following ? [["lit-desk-follow", JSON.stringify({ paused: false, told: true })]] : []);
  let stood = 0;
  await run(gate, {
    document: {
      documentElement: { dataset: desk === undefined ? {} : { desk } },
      querySelector: (sel) => (marker && sel === MARKERS[marker] ? {} : null),
    },
    window: { sessionStorage: { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => void store.set(k, v) } },
    console: { error() {} },
    __gateFrame: { readingSurface: () => (reading ? { column: [] } : null), standDown: () => void stood++ },
    __deskImport: (spec) => {
      asked.push(spec);
      return Promise.resolve({ start() {} });
    },
  });
  const flag = store.get("lit-desk-follow");
  return { asked, stood, paused: flag ? JSON.parse(flag).paused === true : null };
}

const OFF = [undefined, "off", "", "ON", "true"];

test("desk on, on a reading surface: the first stage loads, and the follow flag is left alone", async () => {
  const r = await gateOn({ desk: "on", reading: true });
  assert.deepEqual(r.asked, ["./desk/first-stage.js"]);
  assert.equal(r.paused, false);
});

test("desk not on, on a reading surface: nothing loads and the follow flag is paused (LG8-1: shellHere needs the stamp)", async () => {
  for (const desk of OFF) {
    const r = await gateOn({ desk, reading: true });
    assert.deepEqual(r.asked, [], `desk=${JSON.stringify(desk)}`);
    assert.equal(r.paused, true, `desk=${JSON.stringify(desk)}`);
  }
});

for (const [marker, module] of [
  ["notebook", "./desk/notebook-page.js"],
  ["desk", "./desk/desk-page.js"],
  ["sheet", "./desk/sheets/sheet-page.js"],
]) {
  test(`desk on, on the ${marker} page: only ${module} loads`, async () => {
    const r = await gateOn({ desk: "on", marker });
    assert.deepEqual(r.asked, [module]);
    // /desk follows the reader itself, so the gate leaves the flag; the other pages don't follow.
    assert.equal(r.paused, marker !== "desk");
  });

  test(`desk not on, on the ${marker} page: nothing loads (LG8-1: the ${marker} branch needs the stamp)`, async () => {
    for (const desk of OFF) {
      const r = await gateOn({ desk, marker });
      assert.deepEqual(r.asked, [], `desk=${JSON.stringify(desk)}`);
      assert.equal(r.stood, 0);
      // No desk page follows the reader here, so the tab's follow flag is paused (deskPageHere needs the stamp too).
      assert.equal(r.paused, true, `desk=${JSON.stringify(desk)}`);
    }
  });
}

test("a page that is none of them loads nothing, with the desk on or off", async () => {
  for (const desk of ["on", undefined]) assert.deepEqual((await gateOn({ desk })).asked, [], String(desk));
});

test("a reading surface takes the first stage, not a page branch, when both could apply", async () => {
  assert.deepEqual((await gateOn({ desk: "on", reading: true, marker: "desk" })).asked, ["./desk/first-stage.js"]);
});

/* ── sheet-share-gate.js ──────────────────────────────────────────────── */

const share = instrument(shareSource, [
  [
    'import { isAppPlatform } from "../lib/app-platform.mjs";',
    `import { isAppPlatform } from ${JSON.stringify(pathToFileURL(join(root, "src/lib/app-platform.mjs")).href)};`,
  ],
]);

const PHONE = { userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)", maxTouchPoints: 5 };
const COMPUTER = { userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64)", maxTouchPoints: 0 };

function fakeElement(tag = "div") {
  return {
    tag,
    children: [],
    textContent: "",
    className: "",
    append(...n) {
      this.children.push(...n);
    },
    after() {},
    setAttribute() {},
    addEventListener() {},
    querySelector() {
      return null;
    },
    replaceWith(p) {
      this.replacedBy = p;
    },
  };
}

/** Load sheet-share-gate.js for a shared link; returns whether it took over the page and what it asked for. */
async function shareOn({ desk, nav, shared = "abc" }) {
  const asked = [];
  const off = fakeElement("p");
  const box = { ...fakeElement(), querySelector: (sel) => (sel === ".sheets-page__off" ? off : null) };
  await run(share, {
    document: {
      documentElement: { dataset: desk === undefined ? {} : { desk } },
      querySelector: (sel) => (sel === "[data-sheet-page]" ? box : null),
      createElement: (t) => fakeElement(t),
      createTextNode: (t) => ({ text: t }),
    },
    history: { state: { litSharedSheet: shared } },
    location: { origin: "https://litbible.net", pathname: "/sheets/" },
    navigator: nav,
    console: { error() {} },
    __deskImport: (spec) => {
      asked.push(spec);
      return Promise.resolve({ showSharedOnPhone() {} });
    },
  });
  return { asked, tookOver: off.replacedBy !== undefined };
}

test("a shared link with the desk on: the share gate does nothing, on a computer or a phone (LG8-1, G9)", async () => {
  for (const nav of [COMPUTER, PHONE]) {
    const r = await shareOn({ desk: "on", nav });
    assert.deepEqual(r, { asked: [], tookOver: false }, nav.userAgent);
  }
});

test("a shared link without the desk: a phone loads the sheet's viewer, a computer is offered the preview and loads nothing", async () => {
  for (const desk of [undefined, "off"]) {
    assert.deepEqual(await shareOn({ desk, nav: PHONE }), { asked: ["./desk/sheets/sheet-page.js"], tookOver: true });
    assert.deepEqual(await shareOn({ desk, nav: COMPUTER }), { asked: [], tookOver: true });
  }
});
