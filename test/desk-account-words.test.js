// test/desk-account-words.test.js
//
// The account pages' words and the small rules beside them
// (src/lib/desk-account-words.mjs): held to the site's conventions (curly
// quotes, no em dashes, periods and commas inside a closing quote), with what
// a device is first called, how a notice names it, and what a failed step
// says.

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  NAME_MAX, SWITCH_KEY, SWITCH_VALUES, WORDS, addAsk, cleanName, deviceLine, deviceName, failureWords, newsWords, platformWords,
  readSwitchParam, removeAsk, signedInWords, waitingWords, wayWords,
} from "../src/lib/desk-account-words.mjs";

const UA = {
  chrome: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  edge: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0",
  firefox: "Mozilla/5.0 (X11; Linux x86_64; rv:131.0) Gecko/20100101 Firefox/131.0",
  safariMac: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15",
  safariPhone: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
  chromePhone: "Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36",
  chromebook: "Mozilla/5.0 (X11; CrOS x86_64 14541.0.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
  // A Chromium browser that names no browser this list knows still ends "Safari/…".
  headless: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/131.0.0.0 Safari/537.36",
};

/** Every sentence the module can say: the table, and each function over every case it words. */
function everySentence() {
  const said = Object.values(WORDS);
  said.push(removeAsk("Chrome on Windows"), removeAsk(null), addAsk("Pixel 9", "android"), addAsk("", "web"));
  said.push(deviceLine({ platform: "web", added: "2026-11-24T10:00:00Z", own: true, locale: "en-US" }));
  for (const what of ["delete", "replace"]) for (const mine of [true, false]) said.push(waitingWords({ what, mine, due: "2026-12-01T10:00:00Z" }, "en-US"));
  for (const how of ["approval", "recovery", "passkey", "setup"]) {
    said.push(newsWords({ what: "device", name: "Laptop", how, by: "d1", byName: "Desk computer", added: "2026-11-24T10:00:00Z" }, "en-US"));
    said.push(newsWords({ what: "device", name: null, how, by: "d1", byName: null, added: "2026-11-24T10:00:00Z" }, "en-US", { own: "d1" }));
  }
  for (const kind of ["recovery", "passkey"]) said.push(newsWords({ what: "holder", kind, byName: "Laptop", added: "2026-11-24T10:00:00Z" }, "en-US"));
  for (const kind of ["passkey", "apple", "google", "preview", "other"]) said.push(wayWords(kind), signedInWords(kind));
  for (const platform of ["ios", "android", "web", "other"]) said.push(platformWords(platform));
  said.push(failureWords({ name: "Offline" }), failureWords(new Error("anything else")), failureWords(null));
  for (const why of ["canceled", "exists", "unsupported", "failed"]) said.push(failureWords({ name: "PasskeyStopped", why }));
  for (const why of ["wrongCode", "noRecovery", "holderBroken", "approvalGone", "approvalForged", "holderNeeded", "behind", "other"]) said.push(failureWords({ name: "AccountStop", why }));
  const refusals = [
    ["passkey_refused", "unknown"], ["passkey_refused", "counter"], ["sign_in"], ["limited"], ["exists", "waiting"], ["exists", "notebook"], ["exists"], ["not_found"], ["gone"],
    ["old_key"], ["not_allowed"], ["not_open"], ["provider"], ["bad_request"], ["too_many"], ["anything_else"],
  ];
  for (const [word, about] of refusals) said.push(failureWords({ name: "AccountRefusal", word, about, is: (w, a) => w === word && (a === undefined || a === about) }));
  return said.filter((text) => typeof text === "string");
}

test("the words follow the site's conventions: curly quotes, no em dashes, punctuation inside a closing quote", () => {
  const said = everySentence();
  assert.ok(said.length > 150, `the sweep reads the whole table (${said.length} sentences)`);
  for (const text of said) {
    assert.ok(text.length > 0, "no empty sentence");
    assert.doesNotMatch(text, /["']/, `a straight quote in: ${text}`);
    assert.doesNotMatch(text, /—/, `an em dash in: ${text}`);
    assert.doesNotMatch(text, /”[.,]/, `a period or comma outside its closing quote in: ${text}`);
    assert.doesNotMatch(text, / {2}|^\s|\s$/, `stray spaces in: ${text}`);
    assert.doesNotMatch(text, /\b(colour|favour|behaviour|centre|cancelled|grey)\b/i, `a British spelling in: ${text}`);
  }
});

test("every sentence for a step that failed says what happened to the reader's work, or what to do next", () => {
  for (const why of ["canceled", "failed"]) assert.match(failureWords({ name: "PasskeyStopped", why }), /nothing was changed/);
  assert.match(failureWords({ name: "Offline" }), /Nothing was changed\.$/);
  assert.match(failureWords({ name: "AccountStop", why: "holderNeeded" }), /nothing was changed\.$/);
  assert.match(failureWords(new Error("boom")), /\.$/);
});

test("a device is first called by its browser and its system", () => {
  assert.equal(deviceName(UA.chrome), "Chrome on Windows");
  assert.equal(deviceName(UA.edge), "Edge on Windows");
  assert.equal(deviceName(UA.firefox), "Firefox on Linux");
  assert.equal(deviceName(UA.safariMac), "Safari on Mac");
  assert.equal(deviceName(UA.safariPhone), "Safari on iPhone");
  assert.equal(deviceName(UA.chromePhone), "Chrome on Android");
  assert.equal(deviceName(UA.chromebook), "Chrome on ChromeOS");
});

test("a browser the list doesn't know is never called Safari for ending its line “Safari/”", () => {
  // Seen 2026-11-25: headless Chrome read as “Safari on Windows.”
  assert.equal(deviceName(UA.headless), "A browser on Windows");
  assert.equal(deviceName(""), "A web browser");
  assert.equal(deviceName(undefined), "A web browser");
});

test("a typed name is trimmed and cut to what a card keeps", () => {
  assert.equal(cleanName("  Desk   computer \n"), "Desk computer");
  assert.equal(cleanName("   "), null);
  assert.equal(cleanName(null), null);
  assert.equal(cleanName("x".repeat(200)).length, NAME_MAX);
});

test("the switch reads “preview,” “local,” and “off,” and nothing else", () => {
  assert.equal(SWITCH_KEY, "lit-desk-account");
  assert.deepEqual([...SWITCH_VALUES], ["preview", "local"]);
  assert.equal(readSwitchParam("?account=preview"), "preview");
  assert.equal(readSwitchParam("?desk=on&account=local"), "local");
  assert.equal(readSwitchParam("?account=off"), "off");
  assert.equal(readSwitchParam("?account=yes"), null);
  assert.equal(readSwitchParam(""), null);
  assert.equal(readSwitchParam(undefined), null);
});

test("a device that joined is announced with how, and an approval given here says “this computer”", () => {
  const item = { what: "device", name: "Chrome on Windows", how: "approval", by: "d1", byName: "Chrome on Windows", added: "2026-11-25T10:00:00Z" };
  assert.equal(newsWords(item, "en-US"), "“Chrome on Windows” joined your notebook on November 25, 2026, approved from “Chrome on Windows.”");
  // Two computers often share a first name, so the one that approved names itself.
  assert.equal(newsWords(item, "en-US", { own: "d1" }), "“Chrome on Windows” joined your notebook on November 25, 2026, approved from this computer.");
  assert.equal(newsWords({ ...item, byName: null }, "en-US", { own: "d2" }), "“Chrome on Windows” joined your notebook on November 25, 2026, approved from another device.");
  assert.equal(newsWords({ ...item, how: "recovery" }, "en-US"), "“Chrome on Windows” joined your notebook on November 25, 2026, with your recovery code.");
  assert.equal(newsWords({ ...item, name: null, how: "passkey" }, "en-US"), "A device joined your notebook on November 25, 2026, with your passkey.");
});

test("a request that waits says who asked and when it takes effect", () => {
  assert.equal(waitingWords({ what: "delete", mine: true, due: "2026-12-02T10:00:00Z" }, "en-US"), "You asked to delete your account. It takes effect on December 2, 2026.");
  assert.match(waitingWords({ what: "replace", mine: false, due: null }, "en-US"), /^Someone signed in to your account asked to replace your account’s notebook\.$/);
  assert.equal(waitingWords(null, "en-US"), null);
  assert.equal(waitingWords({ what: "something" }, "en-US"), null);
});
