// Audit 8, decision 5 (BVJ, 2026-11-10): a shared sheet defaults to the
// participant's version. The Share dialog opens on it, and on a phone
// "Share…" on a leader link forwards the participant's version unless the
// reader chooses "Everything".

import { test } from "node:test";
import assert from "node:assert/strict";
import "./helpers/browser-env.mjs";
import { IDBFactory, IDBKeyRange } from "fake-indexeddb";
import { createSheet, makeModule } from "../src/lib/desk-sheets.mjs";

globalThis.indexedDB = new IDBFactory();
globalThis.IDBKeyRange = IDBKeyRange;
const RealChannel = globalThis.BroadcastChannel;
globalThis.BroadcastChannel = class extends RealChannel {
  constructor(name) {
    super(name);
    this.unref?.();
  }
};
localStorage.setItem("lit-desk-sheet-tour", "never");

const { openStore } = await import("../src/scripts/desk/store.js");
const { shareFragment, openShare } = await import("../src/lib/desk-sheet-share.mjs");

const ctx = () => ({ client: "web/test", contentVersion: "v1" });
const opCtx = () => ({ now: new Date().toISOString(), ...ctx() });
const leaderSheet = () =>
  createSheet(
    {
      title: "Share default",
      modules: [
        makeModule("text", { html: "<p>For everyone</p>" }),
        makeModule("text", { html: "<p>Only the leader</p>", leaderOnly: true }),
      ],
    },
    opCtx(),
  );

async function until(fn, ms = 5000, what = "the condition") {
  const end = Date.now() + ms;
  let v;
  while (!(v = fn())) {
    if (Date.now() > end) throw new Error(`timed out waiting for ${what}`);
    await new Promise((r) => setTimeout(r, 10));
  }
  return v;
}
const byText = (root, text) => [...root.querySelectorAll("button")].find((b) => b.textContent === text);
const fragmentOf = (url) => url.slice(url.indexOf("#") + 1);
const texts = (sheet) => sheet.modules.map((m) => m.html ?? "").join("|");

test("the Share dialog opens with the participant's version chosen, and the leader choice is still there", async () => {
  const store = await openStore({ ctx });
  const sheet = leaderSheet();
  await store.save(sheet);
  document.body.replaceChildren();
  const root = document.createElement("div");
  root.dataset.sheetPage = "";
  document.body.append(root);
  document.documentElement.dataset.desk = "on";
  window.happyDOM.setURL(`http://localhost/sheets/?id=${sheet.id}`);
  await import("../src/scripts/desk/sheets/sheet-page.js");
  const share = await until(() => byText(root, "Share…"), 5000, "the Share… button");
  share.click();
  const dialog = await until(() => document.querySelector("dialog.sheets-page__dialog"), 5000, "the dialog");
  const radios = [...dialog.querySelectorAll('input[name="sheet-share-scope"]')];
  assert.deepEqual(radios.map((r) => r.value), ["participant", "leader"]);
  assert.equal(radios.find((r) => r.checked)?.value, "participant");
  // The link the dialog makes without any choice holds no Leader only part.
  const copy = byText(dialog, "Copy link");
  await until(() => !copy.disabled, 5000, "the link");
  let copied = "";
  Object.defineProperty(navigator, "clipboard", { value: { writeText: async (t) => (copied = t) }, configurable: true });
  copy.click();
  await until(() => copied, 5000, "the copied link");
  const opened = await openShare(fragmentOf(copied), opCtx());
  assert.equal(opened.scope, "participant");
  assert.ok(!texts(opened.sheet).includes("Only the leader"));
});

test("on a phone, Share… on a leader link forwards the participant's version, and offers Everything second", async () => {
  const { showSharedOnPhone } = await import("../src/scripts/desk/sheets/sheet-page.js");
  const fragment = await shareFragment(leaderSheet(), { scope: "leader" });
  const root = document.createElement("div");
  document.body.append(root);
  const shared = [];
  Object.defineProperty(navigator, "share", { value: async (d) => void shared.push(d), configurable: true });
  await showSharedOnPhone(root, fragment);
  const radios = [...root.querySelectorAll('input[name="sheet-phone-share-scope"]')];
  assert.deepEqual(radios.map((r) => r.value), ["participant", "leader"]);
  assert.equal(radios.find((r) => r.checked)?.value, "participant");

  byText(root, "Share…").click();
  await until(() => shared.length, 5000, "the share sheet");
  const sent = await openShare(fragmentOf(shared[0].url), opCtx());
  assert.equal(sent.scope, "participant");
  assert.ok(!texts(sent.sheet).includes("Only the leader"));

  // Choosing Everything forwards the link as it came.
  const leader = radios.find((r) => r.value === "leader");
  leader.checked = true;
  leader.dispatchEvent(new Event("change", { bubbles: true }));
  byText(root, "Share…").click();
  await until(() => shared.length === 2, 5000, "the second share");
  assert.equal(fragmentOf(shared[1].url), fragment);
});

test("on a phone, a participant link is forwarded as it came, with no choice offered", async () => {
  const { showSharedOnPhone } = await import("../src/scripts/desk/sheets/sheet-page.js");
  const fragment = await shareFragment(leaderSheet(), { scope: "participant" });
  const root = document.createElement("div");
  document.body.append(root);
  const shared = [];
  Object.defineProperty(navigator, "share", { value: async (d) => void shared.push(d), configurable: true });
  await showSharedOnPhone(root, fragment);
  assert.equal(root.querySelectorAll('input[name="sheet-phone-share-scope"]').length, 0);
  byText(root, "Share…").click();
  await until(() => shared.length, 5000, "the share sheet");
  assert.equal(fragmentOf(shared[0].url), fragment);
});
