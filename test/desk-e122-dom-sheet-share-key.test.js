// E122 (BVJ, 2026-11-12): the Share dialog says what a link shows. The real
// dialog and the shared view, driven in a browser DOM:
//
// - It opens on the participant's version with "Include the answer key"
//   unchecked, whatever the page's "Add answer key" says.
// - "Sends: …" restates the choice, and the link and its code follow it.
// - Only a participant's version with the box checked carries `answerKey`.
// - A link with the key shows the key as the shared view's last page, on a
//   computer and on a phone; importing the sheet drops the field, and the
//   imported sheet's own "Add answer key" works.
// - A phone forwards a participant link as it came, key included, and a
//   leader link as the participant's version without the key.
// - The commercial check still comes first, in its own dialog.

import { test } from "node:test";
import assert from "node:assert/strict";
import "./helpers/browser-env.mjs";
import { IDBFactory, IDBKeyRange } from "fake-indexeddb";
import { createSheet, makeModule } from "../src/lib/desk-sheets.mjs";
import { blankFromOffsets } from "../src/lib/desk-sheet-lit.mjs";
import { passageFromVerses } from "../src/lib/desk-sheet-passages.mjs";

// happy-dom's Range.intersectsNode answers false for a node that holds the
// range; a passage's blanks need the DOM standard's answer (as in
// desk-audit8-dom-sheets-blanks.test.js).
const index = (n) => [...n.parentNode.childNodes].indexOf(n);
function comparePoints(nodeA, offA, nodeB, offB) {
  if (nodeA === nodeB) return Math.sign(offA - offB);
  const pos = nodeA.compareDocumentPosition(nodeB);
  if (pos & 2) return -comparePoints(nodeB, offB, nodeA, offA);
  if (pos & 16) {
    let child = nodeB;
    while (child.parentNode !== nodeA) child = child.parentNode;
    if (index(child) < offA) return 1;
  }
  return -1;
}
window.Range.prototype.intersectsNode = function (node) {
  if (node.getRootNode() !== this.startContainer.getRootNode()) return false;
  const parent = node.parentNode;
  if (!parent) return true;
  const i = index(node);
  return comparePoints(parent, i, this.endContainer, this.endOffset) === -1 && comparePoints(parent, i + 1, this.startContainer, this.startOffset) === 1;
};

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

// John 3, as the chapter page a sheet's passages are read from.
globalThis.fetch = window.fetch = async (url) => {
  if (!/\/john-3\/?$/.test(String(url))) return new Response("", { status: 404 });
  return new Response(
    `<!doctype html><html data-content-version="v1"><body><article class="chapter"><div class="chapter-paragraphs">` +
      `<p><span data-verse="1"><sup class="vn" id="v1">1</sup> Grace abounds for everyone here.</span></p>` +
      `<p><span data-verse="2"><sup class="vn" id="v2">2</sup> People heard it gladly.</span></p>` +
      `</div></article></body></html>`,
    { status: 200, headers: { "content-type": "text/html" } },
  );
};

const { openStore } = await import("../src/scripts/desk/store.js");
const { loadChapterPage } = await import("../src/scripts/desk/chapter-page.js");
const { shareFragment, openShare, sharedSheet } = await import("../src/lib/desk-sheet-share.mjs");

const ctx = () => ({ client: "web/test", contentVersion: "v1" });
const opCtx = () => ({ now: new Date().toISOString(), ...ctx() });

async function until(fn, ms = 5000, what = "the condition") {
  const end = Date.now() + ms;
  let v;
  while (!(v = await fn())) {
    if (Date.now() > end) throw new Error(`timed out waiting for ${what}`);
    await new Promise((r) => setTimeout(r, 10));
  }
  return v;
}
const byText = (root, text) => [...root.querySelectorAll("button")].find((b) => b.textContent === text);
const fragmentOf = (url) => url.slice(url.indexOf("#") + 1);
const shareDialog = () => document.querySelector('dialog[aria-labelledby="sheet-share-title"]');
const commercialDialog = () => document.querySelector("dialog.sheets-page__commercial");
const shown = (el) => Boolean(el) && !el.hidden;
const change = (input, checked) => {
  input.checked = checked;
  input.dispatchEvent(new Event("change", { bubbles: true }));
};

/** A sheet with a Leader only part and, unless `blanks` is false, a blank on "abounds". */
async function makeSheet({ blanks = true, commercial = false, title = "Share with key" } = {}) {
  const source = await loadChapterPage("john", 3);
  const chapter = source.anchorText();
  const start = chapter.text.indexOf("abounds");
  const blank = blankFromOffsets(chapter, start, start + "abounds".length, { id: "b1" });
  const passage = makeModule("passage", { ...passageFromVerses(chapter, { bookKey: "john", chapter: 3 }, 1, 2, "v1"), blanks: blanks ? [blank] : [] });
  const sheet = createSheet(
    {
      title,
      modules: [passage, makeModule("text", { html: "<p>For everyone</p>" }), makeModule("text", { html: "<p>Only the leader</p>", leaderOnly: true })],
    },
    opCtx(),
  );
  return commercial ? { ...sheet, commercial: true } : sheet;
}

const store = await openStore({ ctx });
const root = document.createElement("div");
root.dataset.sheetPage = "";
document.body.append(root);
document.documentElement.dataset.desk = "on";
let copied = "";
Object.defineProperty(navigator, "clipboard", { value: { writeText: async (t) => (copied = t) }, configurable: true });

let started = false;
/** The Sheets page at `url`, with `state` as its history entry's (a shared sheet's fragment). */
async function visit(url, state = null) {
  for (const d of document.querySelectorAll("dialog")) d.remove();
  window.happyDOM.setURL(url);
  history.replaceState(state, "", url);
  if (!started) {
    started = true;
    await import("../src/scripts/desk/sheets/sheet-page.js");
  } else {
    window.dispatchEvent(new window.PopStateEvent("popstate"));
  }
}

/** A saved sheet's own page, drawn. */
async function openOwn(sheet) {
  await store.save(sheet);
  await visit(`http://localhost/sheets/?id=${sheet.id}`);
  await until(() => byText(root, "Share…") && root.querySelector(".sheet-copy") && document.title.startsWith(sheet.title), 5000, "the sheet's page");
}

/** The Share dialog, opened from the page, with its link made. */
async function openDialog() {
  byText(root, "Share…").click();
  const dialog = await until(shareDialog, 5000, "the Share dialog");
  await linkReady(dialog);
  return dialog;
}
const linkReady = (dialog) => until(() => !byText(dialog, "Copy link").disabled, 5000, "the link");
async function copiedShare(dialog) {
  copied = "";
  await linkReady(dialog);
  byText(dialog, "Copy link").click();
  await until(() => copied, 5000, "the copied link");
  return { opened: await openShare(fragmentOf(copied), opCtx()), fragment: fragmentOf(copied) };
}
const parts = (dialog) => ({
  radios: [...dialog.querySelectorAll('input[name="sheet-share-scope"]')],
  key: dialog.querySelector('input[name="sheet-share-key"]'),
  keyLabel: dialog.querySelector(".sheets-page__dialog-key"),
  sends: dialog.querySelector(".sheets-page__dialog-sends").textContent,
  notes: [...dialog.querySelectorAll(".sheets-page__dialog-note")].filter(shown).map((p) => p.textContent),
  status: dialog.querySelector('[role="status"]').textContent,
  code: dialog.querySelector(".sheets-page__share-code img")?.src ?? "",
});
/** The page's own "Add answer key", which shows on the participant's version only. */
async function pageKeyBox() {
  change(root.querySelector('input[name="sheet-copy"][value="participant"]'), true);
  return until(() => (shown(root.querySelector(".sheets-page__keybox")) ? root.querySelector(".sheets-page__keybox") : null), 5000, "the page's Add answer key");
}
const KEY_NOTE = "The blanks’ answers are words of the LIT, so anyone who imports the sheet can add the key themselves.";

test("the dialog opens on the participant's version with the key's box unchecked, even while the page's “Add answer key” is checked", async () => {
  await openOwn(await makeSheet());
  // The page's own box, checked: the key is on the paper, and stays the page's business.
  change((await pageKeyBox()).querySelector("input"), true);
  await until(() => root.querySelector(".sheet-copy__key"), 5000, "the page's answer key");

  const dialog = await openDialog();
  const p = parts(dialog);
  assert.deepEqual(p.radios.map((r) => r.parentElement.textContent.trim()), ["The participant’s version", "The leader’s version"]);
  assert.equal(p.radios.find((r) => r.checked)?.value, "participant");
  assert.equal(p.keyLabel.textContent.trim(), "Include the answer key");
  assert.equal(shown(p.keyLabel), true);
  assert.equal(p.key.checked, false, "the box never inherits the page's");
  assert.equal(p.sends, "Sends: the sheet with its blanks empty. No Leader only parts, and no answers to questions.");
  assert.equal(p.notes.includes(KEY_NOTE), true, "the no-key state says once that the key can be added");
  assert.equal(p.status, "");
  assert.match(p.code, /^data:image\/svg\+xml/, "the code is drawn");
  assert.equal(dialog.textContent.includes("such as email"), false);
  assert.equal(dialog.textContent.includes("The passages are read from the LIT"), false);
  // No opening question: the link is there to copy at once, and it carries no key.
  const { opened } = await copiedShare(dialog);
  assert.equal(opened.scope, "participant");
  assert.equal(opened.answerKey, false);
  assert.equal(parts(dialog).status, "Link copied. Paste it into an email or a message.");
  byText(dialog, "Cancel").click();
});

test("checking the box changes “Sends,” the code and the link, which then carries answerKey; the leader's version never does", async () => {
  await openOwn(await makeSheet({ title: "Key choices" }));
  const dialog = await openDialog();
  const before = parts(dialog);

  change(before.key, true);
  await linkReady(dialog);
  let p = parts(dialog);
  assert.equal(p.sends, "Sends: the participant’s version, and the answer key as its last page. No Leader only parts, and no answers to questions.");
  assert.equal(p.notes.includes(KEY_NOTE), false, "the note is the no-key state's alone");
  assert.equal(p.code !== before.code, true, "the code was drawn again for the new link");
  let { opened } = await copiedShare(dialog);
  assert.equal(opened.scope, "participant");
  assert.equal(opened.answerKey, true);
  assert.equal(opened.sheet.modules.some((m) => (m.html ?? "").includes("Only the leader")), false);
  assert.equal(parts(dialog).status, "Link copied, with the answer key. Paste it into an email or a message.");

  // The leader's version: no box, and no key in the link though the box was checked.
  change(p.radios.find((r) => r.value === "leader"), true);
  await linkReady(dialog);
  p = parts(dialog);
  assert.equal(shown(p.keyLabel), false);
  assert.equal(p.sends, "Sends: everything, with every answer and Leader only part. For someone who leads with you.");
  assert.equal(p.status, "", "the status spoke of the last choice");
  ({ opened } = await copiedShare(dialog));
  assert.equal(opened.scope, "leader");
  assert.equal(opened.answerKey, false);
  assert.equal(parts(dialog).status, "Link copied. Paste it into an email or a message.");

  // Back to the participant's version: the box is as the sharer left it.
  change(p.radios.find((r) => r.value === "participant"), true);
  await linkReady(dialog);
  assert.equal(shown(parts(dialog).keyLabel), true);
  assert.equal(parts(dialog).key.checked, true);
  ({ opened } = await copiedShare(dialog));
  assert.equal(opened.answerKey, true);
  byText(dialog, "Cancel").click();
});

test("a sheet with no blanks offers no key and makes no promise about blanks", async () => {
  await openOwn(await makeSheet({ blanks: false, title: "No blanks to key" }));
  const dialog = await openDialog();
  const p = parts(dialog);
  assert.equal(shown(p.keyLabel), false);
  assert.equal(p.notes.includes(KEY_NOTE), false);
  assert.equal(p.sends, "Sends: the participant’s version. No Leader only parts, and no answers to questions.");
  byText(dialog, "Cancel").click();
});

test("a link with the key shows the key as the shared view's last page; one without shows none", async () => {
  const sheet = await makeSheet({ title: "Shared key" });
  const withKey = await shareFragment(sheet, { scope: "participant", answerKey: true });
  await visit("http://localhost/sheets/", { litSharedSheet: withKey });
  const key = await until(() => root.querySelector(".sheet-copy > .sheet-copy__key"), 5000, "the shared view's answer key");
  const copy = root.querySelector(".sheet-copy");
  // The last thing on the paper, so the last page of the print.
  assert.equal(copy.lastElementChild.className.includes("sheet-copy__key"), true);
  assert.match(key.textContent, /Answer key/);
  assert.match(key.textContent, /abounds/);
  assert.match(root.querySelector(".sheets-page__shared").textContent, /This is the participant’s version of a sheet, with its answer key\./);
  const note = root.querySelector(".sheets-page__key-note");
  assert.equal(shown(note), true);
  assert.equal(note.textContent, "The answer key prints as the last page.");
  // A shared sheet has no box of its own: the key is the sharer's choice.
  assert.equal(shown(root.querySelector(".sheets-page__keybox")), false);
  // Print prints the copy on screen, key and all.
  let printed = null;
  window.print = globalThis.print = () => { printed = root.querySelector(".sheet-copy").lastElementChild.className; };
  byText(root, "Print").click();
  await until(() => printed, 5000, "the print");
  assert.equal(printed.includes("sheet-copy__key"), true);

  const without = await shareFragment(sheet, { scope: "participant" });
  await visit("http://localhost/sheets/", { litSharedSheet: without });
  await until(() => /participant’s version of a sheet\. /.test(root.querySelector(".sheets-page__shared")?.textContent ?? "") && root.querySelector(".sheet-copy"), 5000, "the shared view without a key");
  await until(() => root.querySelector(".sheets-page__paper")?.getAttribute("aria-busy") !== "true", 5000, "the copy");
  assert.equal(root.querySelector(".sheet-copy__key"), null);
});

test("importing a sheet shared with the key drops the field, and the imported sheet's own “Add answer key” works", async () => {
  const sheet = await makeSheet({ title: "Imported key" });
  const fragment = await shareFragment(sheet, { scope: "participant", answerKey: true });
  await visit("http://localhost/sheets/", { litSharedSheet: fragment });
  await until(() => root.querySelector(".sheet-copy > .sheet-copy__key"), 5000, "the shared view's answer key");
  byText(root, "Import into my notebook").click();
  await until(() => /[?&]id=/.test(location.search) && byText(root, "Share…"), 5000, "the imported sheet's page");
  const id = new URLSearchParams(location.search).get("id");
  const mine = await store.get(id);
  assert.equal(mine.kind, "sheet");
  assert.equal("answerKey" in mine, false, "no sheet record holds the field");
  assert.equal(JSON.stringify(mine).includes("answerKey"), false);
  assert.equal(mine.modules.some((m) => (m.html ?? "").includes("Only the leader")), false);
  // The sheet is the reader's own now: no key until they ask, and then theirs to add.
  await until(() => root.querySelector(".sheet-copy") && root.querySelector(".sheets-page__paper")?.getAttribute("aria-busy") !== "true", 5000, "the copy");
  assert.equal(root.querySelector(".sheet-copy__key"), null);
  const box = await pageKeyBox();
  await until(() => root.querySelector(".sheets-page__paper")?.getAttribute("aria-busy") !== "true", 5000, "the participant's version");
  assert.equal(root.querySelector(".sheet-copy__key"), null);
  assert.equal(box.querySelector("input").checked, false);
  change(box.querySelector("input"), true);
  await until(() => root.querySelector(".sheet-copy > .sheet-copy__key"), 5000, "the reader's own key");
});

test("the commercial check still comes first, in its own dialog, and the Share dialog follows “Share anyway”", async () => {
  // A blank goes beyond the commercial terms, so the check has something to say.
  await openOwn(await makeSheet({ commercial: true, title: "Commercial share" }));
  byText(root, "Share…").click();
  const first = await until(commercialDialog, 5000, "the commercial dialog");
  assert.equal(shareDialog(), null, "the Share dialog waits");
  assert.equal(first.querySelector("h2").textContent, "This sheet goes beyond the commercial terms");
  byText(first, "Share anyway").click();
  const dialog = await until(shareDialog, 5000, "the Share dialog");
  assert.equal(commercialDialog(), null, "one dialog at a time");
  assert.equal(parts(dialog).key.checked, false);
  byText(dialog, "Cancel").click();
});

test("on a phone, a participant link with the key shows it and is forwarded as it came; a leader link goes on without one", async () => {
  const { showSharedOnPhone } = await import("../src/scripts/desk/sheets/sheet-page.js");
  const sheet = await makeSheet({ title: "Phone key" });
  const shared = [];
  Object.defineProperty(navigator, "share", { value: async (d) => void shared.push(d), configurable: true });

  const withKey = await shareFragment(sheet, { scope: "participant", answerKey: true });
  const phone = document.createElement("div");
  document.body.append(phone);
  await showSharedOnPhone(phone, withKey);
  await until(() => phone.querySelector(".sheet-copy > .sheet-copy__key"), 5000, "the phone's answer key");
  assert.equal(phone.querySelector(".sheet-copy").lastElementChild.className.includes("sheet-copy__key"), true);
  byText(phone, "Share…").click();
  await until(() => shared.length === 1, 5000, "the share sheet");
  assert.equal(fragmentOf(shared[0].url), withKey);
  assert.equal((await openShare(fragmentOf(shared[0].url), opCtx())).answerKey, true);

  const leader = await shareFragment(sheet, { scope: "leader" });
  const phone2 = document.createElement("div");
  document.body.append(phone2);
  await showSharedOnPhone(phone2, leader);
  const labels = [...phone2.querySelectorAll('input[name="sheet-phone-share-scope"]')].map((r) => r.parentElement.textContent.trim());
  assert.deepEqual(labels, ["The participant’s version", "The leader’s version"]);
  byText(phone2, "Share…").click();
  await until(() => shared.length === 2, 5000, "the second share");
  const sent = await openShare(fragmentOf(shared[1].url), opCtx());
  assert.equal(sent.scope, "participant");
  assert.equal(sent.answerKey, false);
});

test("the shared sheet's data says answerKey only for a participant's version with the key", async () => {
  const sheet = await makeSheet({ title: "Field" });
  assert.equal(sharedSheet(sheet, { scope: "participant", answerKey: true }).answerKey, true);
  assert.equal("answerKey" in sharedSheet(sheet, { scope: "participant" }), false);
  assert.equal("answerKey" in sharedSheet(sheet, { scope: "participant", answerKey: false }), false);
  assert.equal("answerKey" in sharedSheet(sheet, { scope: "leader", answerKey: true }), false);
  // Every share keeps the blank's words: the key decides what is shown, never what travels.
  for (const opts of [{ scope: "participant" }, { scope: "participant", answerKey: true }, { scope: "leader" }]) {
    assert.equal(sharedSheet(sheet, opts).modules[0].blanks[0].exact, "abounds");
  }
});
