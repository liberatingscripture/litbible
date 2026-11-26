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
const { WORDS, SWITCH_KEY, SWITCH_VALUES, renamedWords, signOutAsk } = await import("../src/lib/desk-account-words.mjs");
const { peekLink } = await import("../src/lib/desk-sync-link.mjs");
const { openSyncDb } = await import("../src/scripts/desk/sync/sync-db.js");
const { openStore } = await import("../src/scripts/desk/store.js");
const { fakeCredentials } = await import("./helpers/fake-credentials.mjs");
const { REST_WAIT_MS } = await import("../src/scripts/desk/account/notebook.js");

/** What stamps a record made by a test. */
const CTX = () => ({ client: "test-web", contentVersion: "2026.11.24" });

/** What a browser's sync storage holds under `key`. */
async function kept(b, key) {
  const db = await openSyncDb({ idb: b.idb });
  try {
    return await db.get(key);
  } finally {
    db.close();
  }
}

/**
 * The link in a browser's notebook, or null, read from its storage alone: a
 * page still open in that browser keeps its connector running (a stopped
 * one sends nothing more, so its page's requests would fail; Audit 9, SY9b-2).
 */
const linkOf = (b) => peekLink({ idb: b.idb });

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
  // Under "Create an account," the Terms of Use, as a link (step 4j).
  const hint = page.root.querySelector(".account__hint");
  assert.ok(hint.textContent.includes(`${WORDS.createTermsBefore} ${WORDS.createTermsLink} ${WORDS.createTermsAfter}`), hint.textContent);
  assert.equal(hint.querySelector("a")?.getAttribute("href"), "/terms/");
  assert.equal(document.documentElement.getAttribute("data-account"), "open");
  assert.notEqual(document.activeElement, page.root.querySelector("h2"), "the first screen doesn't take focus as the page loads");
  page.b.creds.next = { syncs: true, prf: false };
  await page.press(WORDS.create);
  await page.shows(WORDS.setupTitle);
  assert.equal(document.activeElement, page.root.querySelector("h2"), "every screen after it starts at its heading");
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

test("a screen whose heading repeats the page's own is not drawn twice, and every other heading is", async () => {
  // Seen 2026-11-25: “Your account” twice, the page's h1 and the home's h2 under it.
  const headings = (page) => [...page.root.querySelectorAll(".account__title")].map((el) => [el.textContent.trim(), el.classList.contains("sr-only")]);
  const w = world();
  const { b } = await setUpReader(w);
  const page = await openPage(b, { heading: WORDS.homeTitle });
  await synced(page);
  assert.deepEqual(headings(page), [[WORDS.homeTitle, true]]);
  // With no heading of the page's above it, the box draws its own.
  const plain = await openPage(b);
  await synced(plain);
  assert.deepEqual(headings(plain), [[WORDS.homeTitle, false]]);
  // A screen with words of its own under the same page heading is drawn.
  const out = await openPage(browser(w), { heading: WORDS.homeTitle });
  await out.shows(WORDS.signInPasskey);
  assert.deepEqual(headings(out), [[WORDS.signInTitle, false]]);
});

test("the header's entry follows the page: drawn on the visit that opens accounts, the button once the browser is linked, and “Sign in” again after signing out", async () => {
  // Seen 2026-11-25: on the first visit with ?account=preview the stamp isn't there before paint, so
  // desk-gate.js never drew the entry, and it kept its room in the header and showed nothing.
  const w = world();
  const b = browser(w);
  const page = await openPage(b, { header: true });
  const entry = document.querySelector("[data-account-entry]");
  const shows = () => [entry.getAttribute("data-account-state"), entry.querySelector("[data-account-signin]").hidden, entry.querySelector("[data-account-button]").hidden];
  await until(() => entry.getAttribute("data-account-state") === "out", "the entry drawn");
  assert.deepEqual(shows(), ["out", false, true]);

  await page.press(WORDS.create);
  await page.shows(WORDS.setupTitle);
  page.root.querySelector("#account-key-device").checked = true;
  await page.press(WORDS.setupContinue);
  await page.shows(WORDS.codeTitle);
  await until(() => entry.getAttribute("data-account-state") === "in", "the account button, once the browser is linked");
  assert.deepEqual(shows(), ["in", true, false]);
  await saveCode(page);
  await page.shows(WORDS.homeTitle);
  await synced(page);

  await page.press(WORDS.signOut);
  await page.press(WORDS.signOutConfirm);
  await page.shows(WORDS.signedOutNow);
  await until(() => entry.getAttribute("data-account-state") === "out", "“Sign in” again");
  assert.deepEqual(shows(), ["out", false, true]);
});

test("a phone's page draws no header entry: the header has none without the Study Desk", async () => {
  const w = world();
  await openPage(browser(w, { desk: false, userAgent: PHONE }), { header: true });
  await new Promise((r) => setTimeout(r, 20));
  assert.equal(document.querySelector("[data-account-entry]").hasAttribute("data-account-state"), false);
});

/* ── A second device ────────────────────────────────────────────────────── */

test("a second computer with the same passkey opens the notebook as it signs in, and the first is told once", async () => {
  const w = world();
  const first = await setUpReader(w, { follows: true });
  const second = browser(w, { creds: first.b.creds, userAgent: SAFARI_MAC });
  const page2 = await openPage(second);
  const prompts = second.creds.prompts;
  await page2.press(WORDS.signInPasskey);
  await page2.shows(WORDS.joined);
  assert.equal(second.creds.prompts, prompts + 1, "one prompt: the sign-in's own");
  await synced(page2);
  await page2.shows("Safari on Mac");
  assert.equal(page2.root.querySelector(".account__notice"), null, "a device isn't news to itself");

  const page1 = await openPage(first.b);
  await synced(page1);
  await page1.shows("“Safari on Mac” joined your notebook");
  assert.ok(page1.has("with your passkey"));
  await page1.press(WORDS.ok);
  assert.equal(page1.root.querySelector(".account__notice"), null);
  const again = await openPage(first.b);
  await synced(again);
  await again.shows("Safari on Mac");
  assert.equal(again.root.querySelector(".account__notice"), null, "told once");
});

test("joining with the recovery code, where the key stays on the devices", async () => {
  const w = world();
  const first = await setUpReader(w);
  const second = browser(w, { creds: first.b.creds, userAgent: SAFARI_MAC });
  const page = await openPage(second);
  await page.press(WORDS.signInPasskey);
  await page.shows(WORDS.joinTitle);
  assert.deepEqual(page.labels(), [WORDS.joinApprove, WORDS.joinRecovery, WORDS.replaceAsk, WORDS.signOut], "no passkey holds the key, so none is offered");
  assert.equal(page.button(WORDS.replaceAsk).closest("details").open, false, "starting a new notebook is folded away under “I can’t do any of these”");

  await page.press(WORDS.joinRecovery);
  page.fill("account-join-recovery", "0000-0000-0000-0000-0000-0000");
  await page.press(WORDS.joinOpen);
  assert.match(page.alert(), /doesn’t open this notebook/);
  page.fill("account-join-recovery", first.code.toLowerCase().replaceAll("-", " "));
  await page.press(WORDS.joinOpen);
  await page.shows(WORDS.joined);
  await synced(page);
  await page.shows("Chrome on Windows");
  assert.equal((await linkOf(second)).notebook, (await linkOf(first.b)).notebook);
});

test("joining by approval: the new computer shows a code, and the one with the notebook types it and says yes", async () => {
  const w = world();
  const first = await setUpReader(w);
  const second = browser(w, { creds: first.b.creds, userAgent: SAFARI_MAC });
  const page2 = await openPage(second);
  await page2.press(WORDS.signInPasskey);
  await page2.shows(WORDS.joinTitle);
  await page2.press(WORDS.joinApprove);
  await page2.shows(WORDS.joinWaiting);
  const code = page2.root.querySelector(".account__code--short").textContent;
  assert.match(code, /^([0-9A-Z]{4}-){3}[0-9A-Z]{4}$/);
  assert.ok(page2.root.querySelector(".account__qr svg"), "and a QR code of the link that carries it");
  assert.equal(JSON.stringify(w.sent).includes(code.replaceAll("-", "")), false, "the code itself is never sent");

  const page1 = await openPage(first.b);
  await synced(page1);
  await page1.shows(WORDS.addDevice);
  page1.fill("account-add-code", "ZZZZ-ZZZZ-ZZZZ-ZZZZ");
  await page1.press(WORDS.addDeviceFind);
  assert.equal(page1.alert(), WORDS.addDeviceNone);
  page1.fill("account-add-code", code);
  await page1.press(WORDS.addDeviceFind);
  await page1.shows("Add “Safari on Mac” (Website) to your notebook?");
  // When and how it was asked, and to approve only a device in hand (Audit 9, SEC9-1).
  assert.ok(page1.has("Asked just now, signed in with a passkey."), page1.text().slice(0, 400));
  assert.ok(page1.has(WORDS.addDeviceHolding));
  await page1.press(WORDS.addDeviceYes);
  await page1.shows(WORDS.addDeviceDone);

  // The new computer looks again, and is in.
  await use(second);
  await second.timers.fire();
  await until(() => page2.has(WORDS.joined), "the new computer to join");
  const reopened = await openPage(second);
  await synced(reopened);
  await reopened.shows("Chrome on Windows");
  assert.equal((await linkOf(second)).notebook, (await linkOf(first.b)).notebook);
});

test("a link that carries a code is taken out of the address, and a browser that has the notebook asks for the code typed instead (Audit 9, SEC9-1)", async () => {
  const w = world();
  const first = await setUpReader(w);
  const second = browser(w, { creds: first.b.creds, userAgent: SAFARI_MAC });
  const page2 = await openPage(second);
  await page2.press(WORDS.signInPasskey);
  await page2.shows(WORDS.joinTitle);
  await page2.press(WORDS.joinApprove);
  await page2.shows(WORDS.joinWaiting);
  const code = page2.root.querySelector(".account__code--short").textContent;

  // The new device's own polling waits on its timers, so any lookup from here on is the first computer's.
  const lookups = () => w.sent.filter((request) => request.method === "GET" && request.path.startsWith("/approvals/")).length;
  const before = lookups();
  const page1 = await openPage(first.b, { kind: "connect", hash: `#a=${code.replaceAll("-", "")}` });
  assert.equal(window.location.hash, "", "the code left the address before anything else ran");
  await synced(page1);
  await page1.shows(WORDS.addDeviceLink);
  await until(() => document.activeElement?.id === "account-add-code", "focus on the field the code is typed into");
  assert.equal(document.activeElement.value, "", "the link's code is not filled in");
  assert.equal(document.activeElement.getAttribute("aria-describedby"), "account-add-note");
  assert.equal(page1.has("to your notebook?"), false, "no question was asked from the link");
  assert.equal(lookups(), before, "the link's code was never looked up");

  // Typed from the new device's screen, it works as always.
  page1.fill("account-add-code", code);
  await page1.press(WORDS.addDeviceFind);
  await page1.shows("Add “Safari on Mac” (Website) to your notebook?");
  assert.ok(page1.has(WORDS.addDeviceHolding));
});

test("“Show a code instead”: the new device types the code, and the question says to approve only a device that did (Audit 9, SEC9-1)", async () => {
  const w = world();
  const first = await setUpReader(w);
  // The new device signs in first: in this rig the browsers share one sync module, so the page
  // that shows the code is opened last, and its sync is the live one.
  const second = browser(w, { creds: first.b.creds, userAgent: SAFARI_MAC });
  const page2 = await openPage(second);
  await page2.press(WORDS.signInPasskey);
  await page2.shows(WORDS.joinTitle);
  await page2.press(WORDS.joinApprove);
  await page2.shows(WORDS.joinWaiting);

  const page1 = await openPage(first.b);
  await synced(page1);
  // The button is drawn with the home's lists, which can come after the sync is in step.
  await page1.shows(WORDS.showCode);
  await page1.press(WORDS.showCode);
  await page1.shows(WORDS.showCodeLede);
  const code = page1.root.querySelector(".account__code--short").textContent;

  // The new device types the code it was shown.
  page2.fill("account-join-code", code);
  await page2.press(WORDS.setupContinue);

  await first.b.timers.fire();
  await until(() => page1.has(WORDS.addDeviceHoldingShown), "the question on the browser that showed the code");
  assert.ok(page1.has("Add “Safari on Mac” (Website) to your notebook? Asked just now, signed in with a passkey."), page1.text().slice(0, 400));
  assert.equal(page1.has(WORDS.addDeviceHolding), false, "not the sentence for a code the new device is showing");
  await page1.press(WORDS.addDeviceYes);
  await page1.shows(WORDS.addDeviceDone);
});

/* ── Devices, the recovery code, and where the key lives ────────────────── */

test("removing a device changes the key; the removed computer says so and joins again", async () => {
  const w = world();
  const first = await setUpReader(w, { follows: true });
  const second = browser(w, { creds: first.b.creds, userAgent: SAFARI_MAC });
  const joined = await openPage(second);
  await joined.press(WORDS.signInPasskey);
  await joined.shows(WORDS.joined);
  await synced(joined);

  const page1 = await openPage(first.b);
  await synced(page1);
  await page1.shows("Safari on Mac");
  await page1.press(WORDS.ok);
  const kidBefore = page1.ctx.S.account.kid;
  await page1.press(WORDS.remove);
  assert.ok(page1.has("Remove “Safari on Mac” from your notebook?"));
  assert.match(document.activeElement?.textContent ?? "", /^Remove “Safari on Mac” from your notebook\? /, "focus is on the question, not on Remove (AC9-1)");
  await page1.press(WORDS.removeYes);
  await page1.shows(WORDS.keyChanged);
  await synced(page1);
  await until(() => !page1.has("Safari on Mac"), "the removed device to leave the list");
  assert.equal((await page1.ctx.S.connector.keyring()).current, kidBefore + 1);

  // The removed computer hears it in two steps, as the service tells it: its sign-in ended with its entry...
  const page2 = await openPage(second);
  await synced(page2, "signedOut");
  await page2.shows("You’ve been signed out.");
  assert.ok(page2.has("Your notebook is still in this browser"));
  assert.deepEqual(page2.labels().slice(0, 2), [WORDS.stopSignIn, WORDS.stopLeave]);
  assert.equal(page2.has(WORDS.devicesTitle) && !page2.root.querySelector(".account__section [hidden]"), false, "nothing that needs the key is offered meanwhile");
  await until(() => page2.root.querySelector(".account__rest")?.hidden === false, "what is under the lists to show at once, since no list is coming while the stop stands");
  await page2.press(WORDS.stopSignIn);
  // ...and signed in again, it learns it is no longer one of the notebook's devices.
  await synced(page2, "removed");
  await page2.shows("This browser was removed from your notebook’s devices");
  assert.ok(page2.has("Your notebook is still in this browser."));
  assert.deepEqual(page2.labels().slice(0, 2), [WORDS.stopJoin, WORDS.stopLeave]);
  // The passkey that just signed it in carries the key, so joining again asks for nothing more.
  await page2.press(WORDS.stopJoin);
  await page2.shows(WORDS.joined);
  await synced(page2);
  await page2.shows("Chrome on Windows");
});

test("a reader with no way left asks to start a new notebook; the old computer is told it was replaced, and joins the new one only on its reader's yes", async () => {
  const w = world();
  const first = await setUpReader(w); // the key stays on its devices, so the passkey alone opens nothing
  const { createRecord } = await import("../src/lib/desk-records.mjs");
  const note = createRecord("note", { bookKey: "john", chapter: 3, verse: 16, body: "from the old notebook", marker: "note" }, { now: new Date(Date.now() - 5000).toISOString(), ...CTX() });
  await first.page.ctx.S.store.save(note);
  const oldNotebook = first.page.ctx.S.account.notebook;

  // Another computer signs in and can open nothing: “I can’t do any of these.”
  const second = browser(w, { creds: first.b.creds, userAgent: SAFARI_MAC });
  let page2 = await openPage(second);
  await page2.press(WORDS.signInPasskey);
  await page2.shows(WORDS.joinTitle);
  assert.ok(page2.has(WORDS.joinCant) && page2.has(WORDS.replaceLede));
  await page2.press(WORDS.replaceAsk);
  await page2.shows(WORDS.replaceAsked);
  assert.ok(page2.has("You asked to replace your account’s notebook. It takes effect on"));
  assert.equal(page2.button(WORDS.replaceAsk), null, "one request waits at a time");
  assert.ok(page2.button(WORDS.cancelRequest), "the sign-in that asked may cancel");
  const due = page2.ctx.S.account.waiting.due;

  // The computer that still has the key is told, and could cancel.
  let page1 = await openPage(first.b);
  await synced(page1);
  await page1.shows("Someone signed in to your account asked to replace your account’s notebook.");
  assert.ok(page1.button(WORDS.cancelRequest));

  // No one cancels. Seven days on, the account has no notebook, and the computer that asked sets one up.
  await w.service.due(new Date(Date.parse(due) + 60_000).toISOString());
  page2 = await openPage(second);
  await page2.shows(WORDS.setupTitle);
  page2.root.querySelector("#account-key-device").checked = true;
  await page2.press(WORDS.setupContinue);
  await page2.shows(WORDS.codeTitle);
  const code = await saveCode(page2);
  await page2.shows(WORDS.homeTitle);
  await synced(page2);
  const newNotebook = page2.ctx.S.account.notebook;
  assert.notEqual(newNotebook, oldNotebook);

  // The old computer: its notebook is untouched, it isn't syncing, and it says why.
  page1 = await openPage(first.b);
  await synced(page1, "otherNotebook");
  await page1.shows("Your account’s notebook was replaced");
  assert.ok(page1.has("The notebook in this browser is still here, and nothing in it was changed."));
  assert.deepEqual(page1.labels().slice(0, 2), [WORDS.stopJoinNew, WORDS.stopLeave]);
  assert.equal((await linkOf(first.b)).notebook, oldNotebook, "nothing moves until the reader says so");

  // “Join the new notebook” is the reader's yes: the new code opens it, and what this browser held goes in.
  page1 = await openPage(first.b);
  await synced(page1, "otherNotebook");
  await page1.press(WORDS.stopJoinNew);
  await page1.shows(WORDS.joinTitle);
  await page1.press(WORDS.joinRecovery);
  page1.fill("account-join-recovery", code);
  await page1.press(WORDS.joinOpen);
  await page1.shows(WORDS.joined);
  await synced(page1);
  assert.equal((await linkOf(first.b)).notebook, newNotebook);
  page2 = await openPage(second);
  await synced(page2);
  await until(async () => (await page2.ctx.S.store.all()).some((record) => record.body === "from the old notebook"), "the old computer's note to reach the new notebook's other device");
});

test("a request to start a new notebook can be canceled by the sign-in that asked", async () => {
  const w = world();
  const first = await setUpReader(w);
  const second = browser(w, { creds: first.b.creds, userAgent: SAFARI_MAC });
  const page2 = await openPage(second);
  await page2.press(WORDS.signInPasskey);
  await page2.shows(WORDS.joinTitle);
  await page2.press(WORDS.replaceAsk);
  await page2.shows(WORDS.replaceAsked);
  await page2.press(WORDS.cancelRequest);
  await page2.shows(WORDS.canceled);
  assert.equal(page2.ctx.S.account.waiting, null);
  assert.ok(page2.button(WORDS.replaceAsk), "and it can be asked again");
  assert.ok(page2.has(WORDS.joinTitle), "the reader is still on the ways to open the notebook");
});

test("“Stop syncing in this browser” ends the link from a stop, and keeps the notebook in the browser", async () => {
  const w = world();
  const first = await setUpReader(w, { follows: true });
  const second = browser(w, { creds: first.b.creds, userAgent: SAFARI_MAC });
  const joined = await openPage(second);
  await joined.press(WORDS.signInPasskey);
  await joined.shows(WORDS.joined);
  await synced(joined);
  const { createRecord } = await import("../src/lib/desk-records.mjs");
  const note = createRecord("note", { bookKey: "john", chapter: 3, verse: 16, body: "kept through the stop", marker: "note" }, { now: new Date(Date.now() - 5000).toISOString(), ...CTX() });
  await joined.ctx.S.store.save(note);

  // The first computer removes the second, which is then stopped: signed out, as the service tells it first.
  const page1 = await openPage(first.b);
  await synced(page1);
  await page1.shows("Safari on Mac");
  await page1.press(WORDS.ok);
  await page1.press(WORDS.remove);
  await page1.press(WORDS.removeYes);
  await page1.shows(WORDS.keyChanged);

  const page2 = await openPage(second);
  await synced(page2, "signedOut");
  await page2.press(WORDS.stopLeave);
  await page2.shows(WORDS.stopLeaveNote);
  assert.deepEqual(page2.labels(), [WORDS.signInPasskey, WORDS.create]);
  assert.equal(await linkOf(second), null, "the browser is no longer linked");
  assert.equal(await kept(second, "token"), undefined, "its session and keys are gone");
  assert.equal(await kept(second, "device"), undefined);
  await use(second);
  const after = await openStore({ ctx: CTX });
  assert.ok((await after.all()).some((record) => record.body === "kept through the stop"), "the notebook is still in the browser");
  // Opened again, the page asks nothing and syncs nothing: the stop is over.
  const again = await openPage(second);
  await again.shows(WORDS.signInPasskey);
  assert.equal(again.ctx.S.connector ?? null, null);
});

/** A second browser joins, is removed by the first, and signs in again: a live session that belongs to no device. */
async function removedAndSignedIn(w) {
  const first = await setUpReader(w, { follows: true });
  const second = browser(w, { creds: first.b.creds, userAgent: SAFARI_MAC });
  const joined = await openPage(second);
  await joined.press(WORDS.signInPasskey);
  await joined.shows(WORDS.joined);
  await synced(joined);
  const page1 = await openPage(first.b);
  await synced(page1);
  await page1.shows("Safari on Mac");
  await page1.press(WORDS.ok);
  await page1.press(WORDS.remove);
  await page1.press(WORDS.removeYes);
  await page1.shows(WORDS.keyChanged);
  const page2 = await openPage(second);
  await synced(page2, "signedOut");
  await page2.press(WORDS.stopSignIn);
  await synced(page2, "removed");
  return { first, second, page2, token: await kept(second, "token") };
}

const deletes = (w, from) => w.sent.slice(from).filter((request) => request.method === "DELETE").map((request) => request.path);
const sessionLives = async (w, token) =>
  (await w.service.fetch(`${w.service.origin}/account`, { method: "GET", headers: { Authorization: `Bearer ${token}` } })).status !== 401;

test("signing out of a browser that was removed and signed in again ends its session, with no failure (Audit 9, COH9-1)", async () => {
  const w = world();
  const { second, page2, token } = await removedAndSignedIn(w);
  assert.ok(await sessionLives(w, token));
  const from = w.sent.length;
  await page2.press(WORDS.signOut);
  await page2.press(WORDS.signOutConfirm);
  await page2.shows(WORDS.signedOutNow);
  assert.equal(page2.alert(), "", "no failure is said");
  assert.deepEqual(deletes(w, from), ["/session"], "the session is ended itself; no device removal that would be refused");
  assert.equal(await sessionLives(w, token), false);
  assert.equal(await linkOf(second), null);
});

test("“Stop syncing in this browser” ends the session it had (Audit 9, SY9b-2)", async () => {
  const w = world();
  const { second, page2, token } = await removedAndSignedIn(w);
  const from = w.sent.length;
  await page2.press(WORDS.stopLeave);
  await page2.shows(WORDS.stopLeaveNote);
  assert.deepEqual(deletes(w, from), ["/session"]);
  assert.equal(await sessionLives(w, token), false, "the service no longer knows the session");
  assert.equal(await linkOf(second), null);
  assert.equal(await kept(second, "token"), undefined);
});

test("a new recovery code is shown once and confirmed, and the old one opens nothing", async () => {
  const w = world();
  const first = await setUpReader(w);
  await first.page.press(WORDS.recoveryNew);
  assert.ok(first.page.has(WORDS.recoveryNewAsk));
  await first.page.press(WORDS.recoveryNewYes);
  await first.page.shows(WORDS.codeTitle);
  const next = first.page.code();
  assert.notEqual(next, first.code);
  assert.ok(await kept(first.b, "code"));
  // Closed on the code's screen, the page shows it again: it is real, so it opens the recovery holder.
  const reopened = await openPage(first.b);
  await reopened.shows(WORDS.codeTitle);
  assert.equal(reopened.code(), next);
  await saveCode(reopened);
  await reopened.shows(WORDS.codeDone);
  assert.equal(await kept(first.b, "code"), undefined);

  const second = browser(w, { creds: first.b.creds, userAgent: SAFARI_MAC });
  const page = await openPage(second);
  await page.press(WORDS.signInPasskey);
  await page.shows(WORDS.joinTitle);
  await page.press(WORDS.joinRecovery);
  page.fill("account-join-recovery", first.code);
  await page.press(WORDS.joinOpen);
  assert.match(page.alert(), /doesn’t open this notebook/);
  page.fill("account-join-recovery", next);
  await page.press(WORDS.joinOpen);
  await page.shows(WORDS.joined);
});

test("where the key lives can be switched both ways", async () => {
  const w = world();
  const { page } = await setUpReader(w, { follows: true });
  await page.press(WORDS.keyToDevice);
  assert.ok(page.has(WORDS.keyToDeviceAsk));
  await page.press(WORDS.keyToDeviceYes);
  await page.shows(WORDS.keyChanged);
  await synced(page);
  await page.shows(WORDS.keyDevice);
  assert.equal(page.has(WORDS.wayCarries), false);

  await page.press(WORDS.keyToAccount);
  await page.press(WORDS.keyToAccountYes);
  await page.shows(WORDS.keyNowAccount);
  await page.shows(WORDS.keyAccount);
});

test("this browser can be renamed, and the name is cut to what a card keeps", async () => {
  const w = world();
  const { page } = await setUpReader(w);
  await page.press(WORDS.rename);
  page.fill("account-device-name", `  The   office computer ${"x".repeat(80)}`);
  await page.press(WORDS.save);
  await page.shows("The office computer x");
  const shown = page.root.querySelector(".account__item-name").textContent;
  assert.equal(shown.length, 60);
  // AC9-2: Rename says its result in the status line, with the name as it was kept.
  assert.ok(page.has(renamedWords(shown)), "the new name is said");
  assert.ok(page.has(`Renamed to “${shown}.”`));
});

test("AC9-3: the sign-out question says what coming back takes only where the key does not follow the account", async () => {
  const device = await setUpReader(world());
  await device.page.press(WORDS.signOut);
  assert.ok(device.page.has(WORDS.signOutLinked));
  assert.ok(device.page.has(WORDS.signOutDeviceOnly), "This device only: the recovery code or another device is how it comes back");
  assert.ok(device.page.has("To sync here again, you’ll need your recovery code or approval from another of your devices."));

  const follows = await setUpReader(world(), { follows: true });
  await follows.page.press(WORDS.signOut);
  assert.ok(follows.page.has(WORDS.signOutLinked));
  assert.equal(follows.page.has(WORDS.signOutDeviceOnly), false, "the passkey carries the key: nothing is added");
});

/* ── Signing out, and deleting ──────────────────────────────────────────── */

test("signing out takes this browser off the notebook and keeps the notebook in the browser", async () => {
  const w = world();
  const { page, b } = await setUpReader(w);
  const { createRecord } = await import("../src/lib/desk-records.mjs");
  const note = createRecord("note", { bookKey: "john", chapter: 3, verse: 16, body: "kept through signing out", marker: "note" }, { now: new Date(Date.now() - 5000).toISOString(), ...CTX() });
  await page.ctx.S.store.save(note);
  const token = await kept(b, "token");

  await page.press(WORDS.signOut);
  assert.ok(page.has(WORDS.signOutLinked));
  await page.press(WORDS.signOutConfirm);
  await page.shows(WORDS.signedOutNow);
  assert.deepEqual(page.labels(), [WORDS.signInPasskey, WORDS.create]);
  assert.equal(await linkOf(b), null, "the browser is no longer linked");
  assert.equal(await kept(b, "token"), undefined, "and its session and keys are gone");
  assert.equal(await kept(b, "device"), undefined);
  const res = await w.service.fetch(`${w.service.origin}/account`, { method: "GET", headers: { Authorization: `Bearer ${token}` } });
  assert.equal(res.status, 401, "the service ended the session with the device");
  await use(b);
  const after = await openStore({ ctx: CTX });
  assert.ok((await after.all()).some((record) => record.body === "kept through signing out"), "the notebook is still in the browser");
});

test("the header's “Sign out” link opens the question on the account page, and nothing is signed out until the reader says yes", async () => {
  const w = world();
  const { b } = await setUpReader(w);
  const page = await openPage(b, { hash: "#sign-out" });
  await page.shows(WORDS.signOutLinked);
  assert.equal(window.location.hash, "", "the mark is taken out of the address");
  assert.ok(page.button(WORDS.signOutConfirm), "the question is open");
  assert.notEqual(await linkOf(b), null, "and the browser is still linked");

  await page.press(WORDS.signOutConfirm);
  await page.shows(WORDS.signedOutNow);
  assert.equal(await linkOf(b), null);
});

test("pressed on the account page itself, the header's “Sign out” link only changes the address, and the question still opens", async () => {
  const w = world();
  const { b } = await setUpReader(w);
  const page = await openPage(b);
  await synced(page);
  assert.equal(page.button(WORDS.signOutConfirm), null);
  // What a browser does for a link to this same page: the address gains the mark, and the page hears of it.
  const pressLink = () => {
    window.happyDOM.setURL(`${w.service.pageOrigin}/account/#sign-out`);
    window.dispatchEvent(new Event("hashchange"));
  };
  pressLink();
  await page.shows(WORDS.signOutLinked);
  assert.ok(page.button(WORDS.signOutConfirm));
  assert.equal(window.location.hash, "");
  // A second press while the question is open asks nothing twice.
  pressLink();
  assert.equal(page.root.querySelectorAll(".account__confirm").length, 1);
});

/* ── The home fills from the top down ───────────────────────────────────── */

/**
 * Lets a test hold the service's answer to the home's lists (`GET /devices`,
 * the first of their requests), as a network does. Call it before the
 * browser is made: a browser keeps the `fetch` it was made with.
 */
function holdLists(w) {
  const real = w.fetch;
  let waiting = null;
  w.fetch = async (url, init = {}) => {
    const res = await real(url, init);
    if (waiting && (init.method ?? "GET") === "GET" && new URL(url).pathname === "/devices") await waiting.promise;
    return res;
  };
  return {
    hold() {
      let release;
      const promise = new Promise((resolve) => (release = resolve));
      waiting = { promise, release };
    },
    release() {
      waiting?.release();
      waiting = null;
    },
    /** How many times the lists have been asked for. */
    asked: () => w.sent.filter((r) => r.method === "GET" && r.path === "/devices").length,
  };
}

/** The home as it stands on the page, whether or not its page has finished starting. */
const home = () => {
  const root = document.querySelector("[data-account-page]");
  const section = (title) => [...root.querySelectorAll(".account__section")].find((el) => el.querySelector("h2")?.textContent === title) ?? null;
  return { root, section, rest: root.querySelector(".account__rest") };
};

/**
 * Opens `b`'s home with its lists held, and waits until they have been asked for. Answers
 * `{ opening }`, the page's promise in an object: an async function that returned the promise itself
 * would wait for it, and a page whose sync is already up finishes starting only with its lists.
 */
async function openHeld(b, lists, options) {
  const before = lists.asked();
  lists.hold();
  const opening = openPage(b, options);
  await until(() => lists.asked() > before && !!document.querySelector("[data-account-page] .account__rest"), "the home, with its lists asked for");
  return { opening };
}

test("the home fills from the top down: what lies under the lists shows with them, never before", async () => {
  const w = world();
  const lists = holdLists(w);
  const { b } = await setUpReader(w);

  const { opening } = await openHeld(b, lists);
  const { section, rest } = home();
  assert.equal(section(WORDS.syncTitle).hidden, false, "the status is there from the start");
  for (const title of [WORDS.keyTitle, WORDS.devicesTitle, WORDS.recoveryTitle]) assert.equal(section(title).hidden, true, `“${title}” waits for the lists`);
  assert.equal(rest.hidden, true, "and what is under them is held back, so nothing shown moves when they come");
  assert.ok(rest.contains(section(WORDS.waysTitle)) && rest.contains(section(WORDS.endTitle)), "the ways to sign in and the end of the page");
  assert.equal(rest.querySelectorAll("[data-account-signout]").length, 1, "which are drawn and ready, only not shown");

  // The sections and what is under them are shown in one step: the rest never shows above a gap.
  const seen = [];
  const watch = new MutationObserver(() => seen.push({ rest: rest.hidden, devices: section(WORDS.devicesTitle).hidden }));
  watch.observe(home().root, { attributes: true, attributeFilter: ["hidden"], subtree: true });
  lists.release();
  await opening;
  await until(() => !rest.hidden, "the rest of the home");
  watch.disconnect();
  for (const title of [WORDS.keyTitle, WORDS.devicesTitle, WORDS.recoveryTitle]) assert.equal(section(title).hidden, false);
  assert.equal(seen.some((at) => !at.rest && at.devices), false, "the rest was never showing while the devices were still to come");
  assert.deepEqual(b.timers.waiting().filter((ms) => ms === REST_WAIT_MS), [], "and the limit on the wait is put away");
});

test("the wait for the lists has an end: after three seconds the rest of the home shows without them", async () => {
  const w = world();
  const lists = holdLists(w);
  const { b } = await setUpReader(w);

  const { opening } = await openHeld(b, lists);
  const { section, rest } = home();
  assert.equal(REST_WAIT_MS, 3000);
  assert.equal(rest.hidden, true);
  assert.ok((await b.timers.fire((ms) => ms === REST_WAIT_MS)) >= 1, "the limit comes due");
  assert.equal(rest.hidden, false, "signing out and deleting never wait on a slow service");
  assert.equal(section(WORDS.devicesTitle).hidden, true, "though the lists are still to come");

  lists.release();
  await opening;
  await until(() => !section(WORDS.devicesTitle).hidden, "the lists, late");
});

test("the header's “Sign out” waits for the home to fill in before it asks", async () => {
  const w = world();
  const lists = holdLists(w);
  const { b } = await setUpReader(w);

  const { opening } = await openHeld(b, lists, { hash: "#sign-out" });
  const { root, rest } = home();
  assert.equal(window.location.hash, "", "the mark is out of the address at once");
  assert.equal(rest.hidden, true);
  assert.equal(root.querySelectorAll(".account__confirm").length, 0, "and nothing is asked under sections still to come");

  lists.release();
  const page = await opening;
  await page.shows(WORDS.signOutLinked);
  assert.equal(rest.hidden, false);
  assert.equal(page.labels().includes(WORDS.signOutConfirm), true, "the question opens once the page has stopped growing above it");
});

test("deleting from a computer that holds the key happens at once, and the notebook stays in the browser", async () => {
  const w = world();
  const { page, b } = await setUpReader(w);
  await page.press(WORDS.deleteOpen);
  assert.ok(page.has(WORDS.deleteAtOnce));
  await page.press(WORDS.deleteNow);
  await page.shows(WORDS.deletedNow);
  assert.equal(await linkOf(b), null);
  // The passkey is still in the password manager, and opens nothing.
  await page.press(WORDS.signInPasskey);
  assert.match(page.alert(), /doesn’t belong to an account here/);
});

test("an “Are you sure” is named by its question, which takes focus before its button, and Escape is Cancel (Audit 9, AC9-1)", async () => {
  const w = world();
  const { page, b } = await setUpReader(w);
  const escape = (el) => el.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
  for (const [open, yes, ask] of [
    [WORDS.deleteOpen, WORDS.deleteNow, WORDS.deleteAtOnce],
    [WORDS.signOut, WORDS.signOutConfirm, signOutAsk("device")],
  ]) {
    await page.press(open);
    const box = page.root.querySelector(".account__confirm");
    const question = document.getElementById(box.getAttribute("aria-labelledby"));
    assert.equal(question?.textContent, ask, "the group is named by its question");
    assert.equal(page.button(yes).getAttribute("aria-describedby"), question.id, "and the button that does it is described by it");
    assert.equal(document.activeElement === question, true, "focus is on the question, not on the button");

    // While the step runs, Escape can't call it back, so it does nothing.
    page.button(yes).setAttribute("aria-disabled", "true");
    escape(question);
    assert.equal(box.isConnected, true);
    page.button(yes).removeAttribute("aria-disabled");

    escape(question);
    assert.equal(box.isConnected, false, "Escape closes it, as Cancel does");
    assert.equal(document.activeElement === page.button(open), true, "and focus is back on the button that asked");
  }
  assert.ok(await linkOf(b), "nothing was deleted, and the browser still syncs");
});

test("the box on /delete-account/ signs in and deletes, and offers nothing else", async () => {
  const w = world();
  const first = await setUpReader(w);
  // A browser that holds nothing: the request waits, as from a phone.
  const other = browser(w, { desk: false, userAgent: PHONE, creds: first.b.creds });
  const page = await openPage(other, { kind: "delete" });
  assert.deepEqual(page.labels(), [WORDS.signInPasskey], "no way to make an account from the page that deletes one");
  assert.ok(page.has(WORDS.deleteSignIn));
  assert.equal(page.root.querySelector("h2"), null, "its headings sit under the page's own");
  await page.press(WORDS.signInPasskey);
  await page.shows(WORDS.deleteTitle);
  assert.deepEqual(page.labels(), [WORDS.deleteOpen, WORDS.signOut]);
  assert.equal(page.has(WORDS.phoneHasNotebook), false);
  await page.press(WORDS.deleteOpen);
  await page.press(WORDS.deleteAsk);
  await page.shows("You asked to delete your account.");

  // On the computer that holds the key, the same box cancels it and deletes at once.
  const home = await openPage(first.b, { kind: "delete" });
  await home.shows("Someone signed in to your account asked to delete your account.");
  await home.press(WORDS.cancelRequest);
  await home.shows(WORDS.canceled);
  await home.press(WORDS.deleteOpen);
  assert.ok(home.has(WORDS.deleteAtOnce));
  await home.press(WORDS.deleteNow);
  await home.shows(WORDS.deletedNow);
  assert.equal(await linkOf(first.b), null, "and the browser stops syncing");
});

test("a page that can't reach the service says so and can try again", async () => {
  const w = world();
  const first = await setUpReader(w);
  const phone = browser(w, { desk: false, userAgent: PHONE, creds: first.b.creds });
  const page = await openPage(phone);
  await page.press(WORDS.signInPasskey);
  await page.shows(WORDS.phoneHasNotebook);
  const real = w.service.fetch;
  w.service.fetch = async () => {
    throw new TypeError("offline");
  };
  const down = await openPage(phone);
  assert.match(down.alert(), /can’t be reached/);
  assert.ok(await kept(phone, "account"), "the sign-in is kept: no answer isn't a refusal");
  w.service.fetch = real;
  await down.press(WORDS.tryAgain);
  await down.shows(WORDS.phoneHasNotebook);
});

/* ── A phone ────────────────────────────────────────────────────────────── */

test("a phone gets the account's basics and never a key: asking to delete waits seven days, and the phone that asked can cancel", async () => {
  const w = world();
  const first = await setUpReader(w);
  const phone = browser(w, { desk: false, userAgent: PHONE, creds: first.b.creds });
  const page = await openPage(phone);
  assert.equal(page.has(WORDS.noAccountTitle), false, "the notebook isn't in a phone's browser, so nothing is said of it there");
  await page.press(WORDS.signInPasskey);
  await page.shows(WORDS.phoneHasNotebook);
  assert.ok(page.has("Signed in with a passkey."));
  assert.deepEqual(page.labels(), [WORDS.deleteOpen, WORDS.signOut]);

  await page.press(WORDS.deleteOpen);
  assert.ok(page.has(WORDS.deleteWaits));
  await page.press(WORDS.deleteAsk);
  await page.shows("You asked to delete your account. It takes effect on ");

  // The computer that holds the notebook shows the request, and may cancel it too.
  const home = await openPage(first.b);
  await synced(home);
  await home.shows("Someone signed in to your account asked to delete your account.");
  assert.ok(home.button(WORDS.cancelRequest));

  // The phone, opened again later, is still the one that asked.
  const later = await openPage(phone);
  await later.shows("You asked to delete your account.");
  assert.equal(later.button(WORDS.deleteOpen), null, "one request at a time");
  await later.press(WORDS.cancelRequest);
  await later.shows(WORDS.canceled);
  assert.ok(later.button(WORDS.deleteOpen));

  await later.press(WORDS.signOut);
  assert.deepEqual(later.labels(), [WORDS.signInPasskey, WORDS.create]);
  assert.equal(await kept(phone, "account"), undefined);
  assert.deepEqual((await phone.idb.databases()).map((d) => d.name), ["lit-desk-sync"], "no notebook was ever made on the phone");
  assert.equal(await kept(phone, "device"), undefined, "and no key");
});

/* ── A setup cut short ──────────────────────────────────────────────────── */

test("a setup whose answer never arrived is finished on the next visit, with the same code", async () => {
  const w = world();
  const b = browser(w);
  const page = await openPage(b);
  await page.press(WORDS.create);
  await page.shows(WORDS.setupTitle);
  page.root.querySelector("#account-key-device").checked = true;
  w.net.after = ({ method, path }) => {
    if (method !== "POST" || path !== "/notebook") return;
    w.net.after = null;
    throw new TypeError("the connection dropped");
  };
  await page.press(WORDS.setupContinue);
  assert.match(page.alert(), /can’t be reached/);
  assert.equal(page.code(), null, "no code is shown for a request that wasn't answered");
  const setup = (await kept(b, "account")).setup;
  assert.ok(setup.device.key.privateKey && setup.sealed.ct && setup.code.ct, "what it needs to carry on was stored before the request went");
  assert.equal(setup.device.key.privateKey.extractable, false);

  const again = await openPage(b);
  await again.shows(WORDS.codeTitle);
  const code = await saveCode(again);
  await again.shows(WORDS.homeTitle);
  await synced(again);
  await again.shows(WORDS.keyDevice);
  assert.equal(w.sent.filter((r) => r.method === "POST" && r.path === "/notebook").length, 1, "the notebook was made once");

  // And the code it showed is the real one.
  const second = browser(w, { creds: b.creds, userAgent: SAFARI_MAC });
  const joining = await openPage(second);
  await joining.press(WORDS.signInPasskey);
  await joining.press(WORDS.joinRecovery);
  joining.fill("account-join-recovery", code);
  await joining.press(WORDS.joinOpen);
  await joining.shows(WORDS.joined);
});

test("a setup the service never received starts over, and what was kept for it is dropped", async () => {
  const w = world();
  const b = browser(w);
  const page = await openPage(b);
  await page.press(WORDS.create);
  await page.shows(WORDS.setupTitle);
  page.root.querySelector("#account-key-device").checked = true;
  const real = w.service.fetch;
  w.service.fetch = async () => {
    throw new TypeError("offline");
  };
  await page.press(WORDS.setupContinue);
  w.service.fetch = real;
  assert.match(page.alert(), /can’t be reached/);
  assert.ok((await kept(b, "account")).setup, "kept, since the page can't know whether it arrived");

  const again = await openPage(b);
  await again.shows(WORDS.setupTitle);
  assert.equal((await kept(b, "account")).setup, undefined, "the account has no notebook, so what was kept is dropped");
});

export { CHROME };
