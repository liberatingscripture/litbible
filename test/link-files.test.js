// The two link files the released apps read: public/.well-known/
// apple-app-site-association (iOS) and assetlinks.json (Android). A mistake
// in either breaks links for installed apps and is not visible on any page,
// so their shape is held here.
//
// Since Study Desk step 4e they also say that the apps may use the site's
// passkeys ("webcredentials" for iOS, "get_login_creds" for Android), and the
// notebook service accepts a passkey's answer from the Android app by its
// signing certificate. The last test keeps the two in step: the service's
// preview must accept exactly the certificates assetlinks.json vouches for.
// If it fails, change PASSKEY_ORIGINS in workers/notebook-service/
// wrangler.jsonc to match (its README, "Passkeys," has the spelling), and
// tell the apps' developer, who owns the certificates.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const read = (path) => readFileSync(fileURLToPath(new URL(`../${path}`, import.meta.url)), "utf8");
const apple = JSON.parse(read("public/.well-known/apple-app-site-association"));
const android = JSON.parse(read("public/.well-known/assetlinks.json"));

const APP_ID = /^[A-Z0-9]{10}\.[A-Za-z0-9.-]+$/;
const FINGERPRINT = /^([0-9A-F]{2}:){31}[0-9A-F]{2}$/;

test("apple-app-site-association: universal links and passkeys name the same apps", () => {
  assert.deepEqual(Object.keys(apple), ["applinks", "webcredentials"]);
  const linked = apple.applinks.details.flatMap((detail) => detail.appIDs);
  assert.ok(linked.length > 0);
  for (const id of linked) assert.match(id, APP_ID);
  // "webcredentials" has apps and nothing else ("details" belongs to applinks alone).
  assert.deepEqual(Object.keys(apple.webcredentials), ["apps"]);
  assert.deepEqual(apple.webcredentials.apps, linked);
  for (const detail of apple.applinks.details) {
    assert.ok(Array.isArray(detail.components) && detail.components.length > 0);
    for (const component of detail.components) assert.equal(typeof component["/"], "string");
  }
});

test("assetlinks.json: one statement for the app, with both relations", () => {
  assert.equal(android.length, 1);
  const [statement] = android;
  assert.deepEqual(Object.keys(statement), ["relation", "target"]);
  assert.deepEqual(statement.relation, ["delegate_permission/common.handle_all_urls", "delegate_permission/common.get_login_creds"]);
  assert.deepEqual(Object.keys(statement.target), ["namespace", "package_name", "sha256_cert_fingerprints"]);
  assert.equal(statement.target.namespace, "android_app");
  assert.ok(statement.target.sha256_cert_fingerprints.length > 0);
  for (const fingerprint of statement.target.sha256_cert_fingerprints) assert.match(fingerprint, FINGERPRINT);
});

test("the notebook service's preview accepts a passkey from exactly the Android certificates assetlinks.json lists", () => {
  // Android names an app's origin android:apk-key-hash:<base64url of the certificate's SHA-256, unpadded>.
  const origin = (fingerprint) => `android:apk-key-hash:${Buffer.from(fingerprint.replaceAll(":", ""), "hex").toString("base64url")}`;
  const vouched = android[0].target.sha256_cert_fingerprints.map(origin).sort();

  const config = read("workers/notebook-service/wrangler.jsonc");
  const origins = /"PASSKEY_ORIGINS":\s*"([^"]*)"/.exec(config);
  assert.ok(origins, "wrangler.jsonc sets PASSKEY_ORIGINS");
  const accepted = origins[1].split(",").map((entry) => entry.trim());
  assert.deepEqual(accepted.filter((entry) => entry.startsWith("android:")).sort(), vouched);
  // The rest is the site's own origin, which is also what an iOS app answers with.
  assert.deepEqual(accepted.filter((entry) => !entry.startsWith("android:")), ["https://litbible.net"]);
});
