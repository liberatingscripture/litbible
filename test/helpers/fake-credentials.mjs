// test/helpers/fake-credentials.mjs
//
// A browser's `navigator.credentials` and the reader's password manager
// behind it, for tests of the account pages. The passkeys are the notebook
// service's own software passkeys (workers/notebook-service/test/
// authenticator.js: real keys, real signatures, the standard's encodings),
// so what this hands the page is what a platform would, and what the page
// sends on is checked by the real service.
//
// It answers in a browser's forms: ArrayBuffers in the options, and a
// credential whose members are ArrayBuffers with `getClientExtensionResults`
// and `getTransports`. The PRF is a real function of the passkey and the
// input (SHA-256 of the passkey's secret and the input), so a page that
// sends the wrong input gets bytes that open nothing.

import { authenticator } from "./real-notebook-service.mjs";

const { newPasskey, attest, assert } = authenticator;

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
const u8 = (value) => (value instanceof ArrayBuffer ? new Uint8Array(value) : new Uint8Array(value.buffer, value.byteOffset, value.byteLength));
const b64 = (value) => Buffer.from(u8(value)).toString("base64url");
const un = (text) => {
  if ([...text].some((c) => !ALPHABET.includes(c))) throw new Error("not base64url");
  return new Uint8Array(Buffer.from(text, "base64url"));
};
const buffer = (bytes) => Uint8Array.from(bytes).buffer;
const same = (a, b) => b64(a) === b64(b);

/** What a browser throws from a ceremony. */
const domError = (name) => Object.assign(new Error(name), { name });

async function prfOf(passkey, input) {
  const joined = new Uint8Array(passkey.prf.length + input.length);
  joined.set(passkey.prf);
  joined.set(input, passkey.prf.length);
  return new Uint8Array(await crypto.subtle.digest("SHA-256", joined));
}

/**
 * A browser on `origin` with an empty password manager.
 *
 *   const browser = fakeCredentials();
 *   browser.next = { syncs: false };          // how the next passkey is made
 *   browser.cancel = true;                    // the reader closes the next prompt
 *   await browser.create({ publicKey });      // as navigator.credentials.create
 *
 * `passkeys` is the manager's contents, newest last; `chosen` is the passkey
 * the reader picks when a prompt names none (the newest, unless set).
 * `prompts` counts the prompts the reader saw. Options for a new passkey:
 * `syncs` (backup-eligible), `prf` ("create": gives the output when made;
 * "use": says it can, and gives it at each use, as most platforms do;
 * false: none), `alg`.
 */
export function fakeCredentials({ origin = "https://litbible.net" } = {}) {
  const browser = {
    origin,
    passkeys: [],
    chosen: null,
    next: {},
    cancel: false,
    prompts: 0,
    /** Every `publicKey` a ceremony was given, as the page passed it. */
    asked: [],

    async create({ publicKey }) {
      browser.prompts += 1;
      browser.asked.push(publicKey);
      if (browser.cancel) {
        browser.cancel = false;
        throw domError("NotAllowedError");
      }
      const excluded = (publicKey.excludeCredentials ?? []).some((entry) => browser.passkeys.some((p) => same(entry.id, p.credentialId)));
      if (excluded) throw domError("InvalidStateError");
      const { syncs = true, prf = "use", alg = -7 } = browser.next;
      browser.next = {};
      const passkey = await newPasskey({ syncs, alg });
      passkey.rpId = publicKey.rp.id;
      passkey.prfMode = prf;
      const json = { ...publicKey, challenge: b64(publicKey.challenge), user: { ...publicKey.user, id: b64(publicKey.user.id) } };
      const made = await attest(passkey, json, { origin: browser.origin });
      browser.passkeys.push(passkey);
      const input = publicKey.extensions?.prf?.eval?.first;
      const results = {};
      if (input && prf) {
        results.prf = { enabled: true };
        if (prf === "create") results.prf.results = { first: buffer(await prfOf(passkey, u8(input))) };
      } else if (input) {
        results.prf = { enabled: false };
      }
      results.credProps = { rk: true };
      return {
        id: made.id,
        rawId: buffer(un(made.id)),
        type: "public-key",
        authenticatorAttachment: "platform",
        response: {
          clientDataJSON: buffer(un(made.response.clientDataJSON)),
          attestationObject: buffer(un(made.response.attestationObject)),
          getTransports: () => ["internal", "hybrid"],
        },
        getClientExtensionResults: () => results,
      };
    },

    async get({ publicKey }) {
      browser.prompts += 1;
      browser.asked.push(publicKey);
      if (browser.cancel) {
        browser.cancel = false;
        throw domError("NotAllowedError");
      }
      const mine = browser.passkeys.filter((p) => p.rpId === publicKey.rpId);
      const allowed = publicKey.allowCredentials?.length
        ? mine.filter((p) => publicKey.allowCredentials.some((entry) => same(entry.id, p.credentialId)))
        : mine;
      const passkey = allowed.includes(browser.chosen) ? browser.chosen : allowed[allowed.length - 1];
      if (!passkey) throw domError("NotAllowedError");
      const used = await assert(passkey, { challenge: b64(publicKey.challenge), rpId: publicKey.rpId }, { origin: browser.origin });
      const input = publicKey.extensions?.prf?.eval?.first;
      const results = {};
      if (input && passkey.prfMode) results.prf = { results: { first: buffer(await prfOf(passkey, u8(input))) } };
      return {
        id: used.id,
        rawId: buffer(un(used.id)),
        type: "public-key",
        authenticatorAttachment: "platform",
        response: {
          clientDataJSON: buffer(un(used.response.clientDataJSON)),
          authenticatorData: buffer(un(used.response.authenticatorData)),
          signature: buffer(un(used.response.signature)),
          userHandle: used.response.userHandle ? buffer(un(used.response.userHandle)) : null,
        },
        getClientExtensionResults: () => results,
      };
    },
  };
  return browser;
}
