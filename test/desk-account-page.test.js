// test/desk-account-page.test.js
//
// The account page, driven the way a reader drives it (the plan's step 4h):
// the real page in a happy-dom window, its buttons pressed and its words
// read, over the real store, the real connector, and the notebook service's
// own code (test/helpers/account-page.mjs says what stands in for what).
// What the model does with a key is test/desk-account.test.js's; this file
// is about what the page shows, stores, and links.

import { test } from "node:test";
import assert from "node:assert/strict";

import "./helpers/browser-env.mjs";

const { CHROME, PHONE, SAFARI_MAC, browser, openPage, saveCode, synced, until, use, world } = await import("./helpers/account-page.mjs");
const { WORDS, SWITCH_KEY, SWITCH_VALUES } = await import("../src/lib/desk-account-words.mjs");
const { SYNC_META, readLink } = await import("../src/lib/desk-sync-link.mjs");
const { openSyncDb } = await import("../src/scripts/desk/sync/sync-db.js");
const { openStore } = await import("../src/scripts/desk/store.js");
const { fakeCredentials } = await import("./helpers/fake-credentials.mjs");

/** What a browser's sync storage holds under `key`. */
async function kept(b, key) {
  const db = await openSyncDb({ idb: b.idb });
  try {
    return await db.get(key);
  } finally {
    db.close();
  }
}

/** The link in a browser's notebook, or null. */
async function linkOf(b) {
  await use(b);
  const store = await openStore({ ctx: () => ({ client: "test-web", contentVersion: "2026.11.24" }) });
  return readLink(await store.getMeta(SYNC_META));
}

/** A reader with an account and a synced notebook, set up on a computer. Returns the page on its home, and the code. */
async function setUpReader(w, { follows = false, b = browser(w) } = {}) {
  if (follows) b.creds.next = { syncs: true, prf: "create" };
  const page = await openPage(b);
  await page.press(WORDS.create);
  await page.shows(WORDS.setupTitle);
  if (!follows) page.root.querySelector("#account-key-device").checked = true;
  await page.press(WORDS.setupContinue);
  await page.shows(WORDS.codeTitle);
  const code = await saveCode(page);
  await page.shows(WORDS.homeTitle);
  await synced(page);
  await page.shows(WORDS.thisComputer);
  return { b, page, code };
}

/* ── Closed ─────────────────────────────────────────────────────────────── */

test("accounts are closed: with no switch and no link the page stays as it was served, and nothing is stored", async () => {
  const w = world();
  for (const desk of [true, false]) {
    const b = browser(w, { desk });
    const page = await openPage(b, { open: null });
    assert.equal(page.ctx, null);
    assert.equal(page.text(), "Accounts are not open yet.");
    assert.equal(document.documentElement.hasAttribute("data-account"), false);
    assert.deepEqual(await b.idb.databases(), [], "no database was made");
  }
  assert.deepEqual(w.sent, [], "and nothing was asked of the service");
});

test("the gate's key and values are the words module's", async () => {
  const { readFileSync } = await import("node:fs");
  const gate = readFileSync(new URL("../src/scripts/account-gate.js", import.meta.url), "utf8");
  assert.ok(gate.includes(`const KEY = "${SWITCH_KEY}";`));
  assert.ok(gate.includes(`const VALUES = ${JSON.stringify([...SWITCH_VALUES]).replaceAll(",", ", ")};`));
});

/* ── Signed out ─────────────────────────────────────────────────────────── */

test("signed out on a computer: two buttons, and that no account is needed is said plainly", async () => {
  const w = world();
  const page = await openPage(browser(w));
  assert.deepEqual(page.labels(), [WORDS.signInPasskey, WORDS.create]);
  assert.ok(page.has(WORDS.noAccountTitle));
  assert.ok(page.has(WORDS.noAccountBody));
  assert.deepEqual(
    [...page.root.querySelectorAll(".account__aside a")].map((a) => a.getAttribute("href")),
    ["/desk/help/#ways-to-keep", "/desk/help/#copies"],
  );
  assert.equal(document.documentElement.getAttribute("data-account"), "open");
  assert.equal(document.activeElement, page.root.querySelector("h2"), "focus starts at the screen's heading");
});

test("a passkey the service doesn't know says so, and offers to make an account", async () => {
  const w = world();
  const stranger = fakeCredentials({ origin: "https://example.org" });
  const b = browser(w);
  // A passkey made for this site in a password manager, for an account that was never made here.
  const page = await openPage(b);
  b.creds.cancel = true;
  await page.press(WORDS.signInPasskey);
  assert.match(page.alert(), /prompt was closed/);
  assert.ok(page.button(WORDS.create), "the screen is still there to try again");
  assert.ok(stranger);
});

/* ── Making an account, and setting the notebook up ─────────────────────── */

test("a new account on this device only: the code is shown, two groups come back, and the notebook syncs", async () => {
  const w = world();
  const b = browser(w);
  b.creds.next = { syncs: true, prf: false };
  const page = await openPage(b);
  await page.press(WORDS.create);

  await page.shows(WORDS.setupTitle);
  const follow = page.root.querySelector("#account-key-account");
  assert.equal(follow.disabled, true, "a passkey with no PRF can't carry the key");
  assert.ok(page.has(WORDS.followOff));
  assert.ok(page.has(WORDS.setupNext), "either way a recovery code comes next");
  assert.equal(page.root.querySelector('input[type="checkbox"]'), null, "there is no box to tick for a recovery code");
  assert.equal((await kept(b, "account")).token.length > 20, true, "the sign-in is kept while nothing is linked");

  await page.press(WORDS.setupContinue);
  await page.shows(WORDS.codeTitle);
  const shown = page.code();
  assert.match(shown, /^([0-9A-Z]{4}-){5}[0-9A-Z]{4}$/);
  assert.deepEqual(page.labels(), [WORDS.codeCopy, WORDS.codePrint, WORDS.codeSaved], "no way past the code but saving it");
  assert.ok(await kept(b, "code"), "the code is kept, sealed, until it is confirmed");
  assert.equal(JSON.stringify(await kept(b, "code")).includes(shown.replaceAll("-", "")), false);
  assert.equal(await kept(b, "account"), undefined, "the page's own sign-in became the sync's");

  // The wrong groups don't pass, and nothing lets the reader skip them.
  await page.press(WORDS.codeSaved);
  assert.deepEqual(page.labels(), [WORDS.codeFinish, WORDS.codeShowAgain]);
  page.fill("account-code-a", "0000");
  page.fill("account-code-b", "0000");
  await page.press(WORDS.codeFinish);
  assert.equal(page.alert(), WORDS.codeWrong);
  await page.press(WORDS.codeShowAgain);
  assert.equal(page.code(), shown);

  await saveCode(page);
  await page.shows(WORDS.homeTitle);
  assert.equal(await kept(b, "code"), undefined, "confirmed, the kept copy is gone");
  await synced(page);
  await page.shows("Your notebook is in sync.");
  await page.shows(WORDS.keyDevice);
  await page.shows("Chrome on Windows");
  assert.ok(page.has(`${WORDS.thisComputer}, Website, added`));
  assert.ok(page.has(WORDS.recoveryHave));

  const link = await linkOf(b);
  assert.equal(link.service, w.service.origin);
  assert.equal(link.notebook, page.ctx.S.account.notebook);
  assert.equal(JSON.stringify(w.sent).includes(shown.replaceAll("-", "")), false, "the code never went to the service");
});

test("a passkey that syncs and gives a PRF output can carry the key: “Follows my account”", async () => {
  const w = world();
  const { page, b } = await setUpReader(w, { follows: true });
  await page.shows(WORDS.keyAccount);
  assert.ok(page.has(WORDS.wayCarries), "the passkey's row says it carries the key");
  assert.ok(page.button(WORDS.keyToDevice));
  const sentPrf = JSON.stringify(w.sent);
  for (const passkey of b.creds.passkeys) assert.equal(sentPrf.includes(Buffer.from(passkey.prf ?? []).toString("base64url")) && (passkey.prf?.length ?? 0) > 0, false, "no PRF secret went to the service");
});

test("a passkey that gives its PRF output only when used is asked once more, and then carries the key", async () => {
  const w = world();
  const b = browser(w);
  b.creds.next = { syncs: true, prf: "use" };
  const page = await openPage(b);
  await page.press(WORDS.create);
  await page.shows(WORDS.setupTitle);
  assert.equal(page.root.querySelector("#account-key-account").checked, true, "offered, and the first choice");
  const prompts = b.creds.prompts;
  await page.press(WORDS.setupContinue);
  await page.shows(WORDS.codeTitle);
  assert.equal(b.creds.prompts, prompts + 1, "one more prompt, for the output alone");
  await saveCode(page);
  await synced(page);
  await page.shows(WORDS.keyAccount);
});

test("reopening the page on a syncing computer shows the home, with no sign-in asked", async () => {
  const w = world();
  const { b } = await setUpReader(w);
  const before = w.sent.length;
  const page = await openPage(b);
  await synced(page);
  await page.shows("Chrome on Windows");
  assert.equal(page.button(WORDS.signInPasskey), null);
  assert.equal(w.sent.slice(before).some((r) => r.path.startsWith("/sign-in")), false);
});

export { CHROME, PHONE, SAFARI_MAC, until };
