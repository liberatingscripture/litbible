// A passkey's forms (src/lib/desk-passkey.mjs): the service's JSON to what a
// browser takes, and a browser's credential to what the service takes, with
// the PRF's output kept out of everything that is sent. The ceremonies
// themselves run against the real service in desk-account.test.js.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import * as ref from "../src/lib/desk-crypto.mjs";
import {
  PasskeyStopped,
  assertionAnswer,
  creationOptions,
  fromBase64url,
  makePasskey,
  passkeysHere,
  prfOnly,
  registrationAnswer,
  requestOptions,
  toBase64url,
  usePasskey,
} from "../src/lib/desk-passkey.mjs";

const bytes = (...values) => Uint8Array.from(values);
const buffer = (...values) => bytes(...values).buffer;

test("it imports nothing, so a page with no key can sign in with it", () => {
  const source = readFileSync(new URL("../src/lib/desk-passkey.mjs", import.meta.url), "utf8");
  assert.equal(/^\s*import\s/m.test(source), false);
  assert.equal(/\bimport\(/.test(source), false);
});

test("base64url is the reference's, for every length", () => {
  for (let length = 0; length < 70; length++) {
    const value = ref.randomBytes(length);
    assert.equal(toBase64url(value), ref.toBase64url(value));
    assert.deepEqual(fromBase64url(toBase64url(value)), value);
    assert.equal(toBase64url(value.buffer), ref.toBase64url(value));
  }
  for (const wrong of ["a", "ab=d", "a b", "+/+/", null, 7]) assert.throws(() => fromBase64url(wrong), TypeError);
});

test("creation options: byte strings become bytes, and the PRF is asked for only when an input is given", () => {
  const publicKey = {
    rp: { id: "litbible.net", name: "LIT Bible" },
    user: { id: toBase64url(bytes(1, 2, 3)), name: "LIT Bible notebook", displayName: "LIT Bible notebook" },
    challenge: toBase64url(bytes(9, 8, 7, 6)),
    pubKeyCredParams: [{ type: "public-key", alg: -7 }],
    excludeCredentials: [{ type: "public-key", id: toBase64url(bytes(5, 5)) }],
    authenticatorSelection: { residentKey: "required", userVerification: "required" },
    attestation: "none",
  };
  const plain = creationOptions(publicKey);
  assert.deepEqual(plain.challenge, bytes(9, 8, 7, 6));
  assert.deepEqual(plain.user.id, bytes(1, 2, 3));
  assert.equal(plain.user.name, "LIT Bible notebook");
  assert.deepEqual(plain.excludeCredentials, [{ type: "public-key", id: bytes(5, 5) }]);
  assert.deepEqual(plain.authenticatorSelection, publicKey.authenticatorSelection);
  assert.deepEqual(plain.extensions, {});

  const input = bytes(4, 4, 4);
  const asked = creationOptions(publicKey, { prfInput: input });
  assert.deepEqual(asked.extensions, { prf: { eval: { first: input } } });
  assert.notEqual(asked.extensions.prf.eval.first, input, "a copy, not the caller's own bytes");
  assert.equal(publicKey.extensions, undefined, "the service's options are not changed");
});

test("request options: the service names no passkey, and the page may name the ones that hold the key", () => {
  const publicKey = { challenge: toBase64url(bytes(1)), rpId: "litbible.net", timeout: 300000, userVerification: "required" };
  const open = requestOptions(publicKey, { prfInput: bytes(2) });
  assert.equal("allowCredentials" in open, false);
  assert.equal(open.userVerification, "required");
  assert.deepEqual(open.extensions.prf.eval.first, bytes(2));

  const named = requestOptions(publicKey, { allow: [bytes(7, 7), bytes(8)] });
  assert.deepEqual(named.allowCredentials, [
    { type: "public-key", id: bytes(7, 7) },
    { type: "public-key", id: bytes(8) },
  ]);
});

test("a new passkey's answer: the standard's JSON, the PRF's output apart, and never in what is sent", () => {
  const secret = ref.randomBytes(32);
  const made = {
    rawId: buffer(1, 2, 3),
    authenticatorAttachment: "platform",
    response: { clientDataJSON: buffer(10), attestationObject: buffer(20, 21), getTransports: () => ["internal"] },
    getClientExtensionResults: () => ({ prf: { enabled: true, results: { first: secret.buffer } }, credProps: { rk: true }, largeBlob: { blob: buffer(3) } }),
  };
  const answer = registrationAnswer(made);
  assert.deepEqual(answer.credential, {
    id: "AQID",
    rawId: "AQID",
    type: "public-key",
    response: { clientDataJSON: "Cg", attestationObject: "FBU", transports: ["internal"] },
    authenticatorAttachment: "platform",
    clientExtensionResults: { prf: { enabled: true }, credProps: { rk: true }, largeBlob: { blob: "Aw" } },
  });
  assert.deepEqual(answer.id, bytes(1, 2, 3));
  assert.deepEqual(answer.prf, { enabled: true, output: secret });
  assert.equal(JSON.stringify(answer.credential).includes(toBase64url(secret)), false);
  // What the reference's own strip would leave is what was built.
  assert.deepEqual(ref.stripPrfResults(answer.credential), answer.credential);
});

test("a passkey that says nothing of the PRF is not taken to have one", () => {
  const made = { rawId: buffer(1), response: { clientDataJSON: buffer(1), attestationObject: buffer(1) }, getClientExtensionResults: () => ({}) };
  const answer = registrationAnswer(made);
  assert.deepEqual(answer.prf, { enabled: false, output: null });
  assert.deepEqual(answer.credential.clientExtensionResults, {});
  assert.equal("transports" in answer.credential.response, false);

  const refusing = { ...made, getClientExtensionResults: () => ({ prf: { enabled: false } }) };
  assert.equal(registrationAnswer(refusing).prf.enabled, false);
});

test("a used passkey's answer: the user handle only when there is one, and the output apart", () => {
  const secret = ref.randomBytes(32);
  const used = {
    rawId: buffer(4, 5),
    response: { clientDataJSON: buffer(1), authenticatorData: buffer(2), signature: buffer(3), userHandle: buffer(6, 6) },
    getClientExtensionResults: () => ({ prf: { results: { first: secret.buffer } } }),
  };
  const answer = assertionAnswer(used);
  assert.deepEqual(answer.credential.response, { clientDataJSON: "AQ", authenticatorData: "Ag", signature: "Aw", userHandle: "BgY" });
  assert.deepEqual(answer.credential.clientExtensionResults, { prf: {} });
  assert.deepEqual(answer.prf.output, secret);

  const bare = assertionAnswer({ ...used, response: { ...used.response, userHandle: null }, getClientExtensionResults: () => ({}) });
  assert.equal("userHandle" in bare.credential.response, false);
  assert.equal(bare.prf.output, null);
});

test("a ceremony that stops says why, in four words", async () => {
  const failing = (name) => ({
    create: async () => {
      throw Object.assign(new Error(name), { name });
    },
    get: async () => {
      throw Object.assign(new Error(name), { name });
    },
  });
  const publicKey = { challenge: "AA", rpId: "litbible.net", rp: { id: "litbible.net" }, user: { id: "AA" } };
  const why = async (run) => {
    try {
      await run();
    } catch (error) {
      assert.ok(error instanceof PasskeyStopped);
      return error.why;
    }
    return "answered";
  };
  assert.equal(await why(() => makePasskey({ credentials: failing("NotAllowedError"), publicKey })), "canceled");
  assert.equal(await why(() => makePasskey({ credentials: failing("InvalidStateError"), publicKey })), "exists");
  assert.equal(await why(() => makePasskey({ credentials: failing("NotSupportedError"), publicKey })), "unsupported");
  assert.equal(await why(() => makePasskey({ credentials: failing("TypeError"), publicKey })), "failed");
  assert.equal(await why(() => usePasskey({ credentials: failing("AbortError"), publicKey })), "canceled");
  // Using a passkey has no "exists."
  assert.equal(await why(() => usePasskey({ credentials: failing("InvalidStateError"), publicKey })), "failed");
  assert.equal(await why(() => usePasskey({ credentials: { get: async () => null }, publicKey })), "canceled");
});

test("asking for the PRF alone names the passkey, makes its own challenge, and sends nothing", async () => {
  const secret = ref.randomBytes(32);
  let asked;
  const credentials = {
    get: async ({ publicKey }) => {
      asked = publicKey;
      return {
        rawId: buffer(9),
        response: { clientDataJSON: buffer(1), authenticatorData: buffer(1), signature: buffer(1), userHandle: null },
        getClientExtensionResults: () => ({ prf: { results: { first: secret.buffer } } }),
      };
    },
  };
  const got = await prfOnly({ credentials, rpId: "litbible.net", allow: [bytes(9)], prfInput: bytes(1, 2), random: (n) => new Uint8Array(n).fill(7) });
  assert.deepEqual(got, { id: bytes(9), output: secret });
  assert.equal(asked.rpId, "litbible.net");
  assert.equal(asked.userVerification, "required");
  assert.deepEqual(asked.challenge, new Uint8Array(32).fill(7));
  assert.deepEqual(asked.allowCredentials, [{ type: "public-key", id: bytes(9) }]);
});

test("a window without passkeys is told apart", () => {
  assert.equal(passkeysHere({}), false);
  assert.equal(passkeysHere({ PublicKeyCredential: function () {}, navigator: { credentials: { create() {} } } }), true);
  assert.equal(passkeysHere({ PublicKeyCredential: function () {}, navigator: {} }), false);
});
