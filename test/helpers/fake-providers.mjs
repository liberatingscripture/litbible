// test/helpers/fake-providers.mjs
//
// Apple and Google, stood in for in the root suite: a provider with a real
// RSA key that signs real identity tokens and publishes its key set, and
// Apple's two addresses the service calls. It is the root suite's copy of
// workers/notebook-service/test/idp.js, which imports vitest and so can't be
// imported here. Nothing reaches the network: the global fetch() is replaced
// until `restore()`, and an address a test didn't expect fails it.
//
// The client ids, team id, and key id are made up. No real identifier of
// LIT's is written anywhere in this repository, and neither provider has
// ever been tried.

import "./real-notebook-service.mjs"; // registers the hooks the service's files load through

const SERVICE = new URL("../../workers/notebook-service/", import.meta.url);
const { forgetProviderKeys } = await import(new URL("src/jwt.js", SERVICE).href);

const APPLE = "https://appleid.apple.com";
const GOOGLE_KEYS = "https://www.googleapis.com/oauth2/v3/certs";
const ISSUER = { apple: APPLE, google: "https://accounts.google.com" };

export const APPLE_WEB_CLIENT = "test.example.web";
export const GOOGLE_WEB_CLIENT = "test-google-web.example";

const ascii = (text) => new TextEncoder().encode(text);
const b64 = (bytes) => Buffer.from(bytes).toString("base64url");
const part = (value) => b64(ascii(JSON.stringify(value)));

async function rsaKey(kid) {
  const keys = await crypto.subtle.generateKey({ name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: Uint8Array.of(1, 0, 1), hash: "SHA-256" }, true, ["sign", "verify"]);
  const { n, e } = await crypto.subtle.exportKey("jwk", keys.publicKey);
  return { kid, keys, jwk: { kty: "RSA", kid, use: "sig", alg: "RS256", n, e } };
}

/** The team's key Apple gives a developer, as a .p8 file's text. */
async function appleTeamKey() {
  const keys = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
  const der = new Uint8Array(await crypto.subtle.exportKey("pkcs8", keys.privateKey));
  const lines = Buffer.from(der).toString("base64").match(/.{1,64}/g).join("\n");
  return `-----BEGIN PRIVATE KEY-----\n${lines}\n-----END PRIVATE KEY-----\n`;
}

// RSA keys are slow to make, so each is made once for a test file.
let made = null;

/**
 * Turns both providers on. Returns:
 *   env       the bindings that turn them on at the service (world(env))
 *   clients   the website's client ids, for the page's `env.providerClients`
 *   calls     every address the service fetched, with a posted form's fields
 *   answer    (address, { subject, cancel }) => the `#…` a provider's page
 *             would send the reader back with, for the address the page went to
 *   restore   puts fetch() back
 */
export async function fakeProviders() {
  made ??= { apple: await rsaKey("apple-key-1"), google: await rsaKey("google-key-1"), team: await appleTeamKey() };
  const keys = made;
  const calls = [];
  const real = globalThis.fetch;
  const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
  forgetProviderKeys();
  globalThis.fetch = async (input, init = {}) => {
    const url = typeof input === "string" ? input : input.url;
    const form = init.body ? Object.fromEntries(new URLSearchParams(init.body)) : null;
    calls.push({ url, form });
    if (url === `${APPLE}/auth/keys`) return json(200, { keys: [keys.apple.jwk] });
    if (url === GOOGLE_KEYS) return json(200, { keys: [keys.google.jwk] });
    if (url === `${APPLE}/auth/token`) return json(200, { access_token: "access", token_type: "Bearer", expires_in: 3600, refresh_token: `refresh-for-${form.code}`, id_token: "unused" });
    if (url === `${APPLE}/auth/revoke`) return new Response("", { status: 200 });
    throw new Error(`a test reached an address it did not expect: ${url}`);
  };

  async function idToken(provider, { nonce, client, subject }) {
    const at = Math.floor(Date.now() / 1000);
    const claims = { iss: ISSUER[provider], aud: client, sub: subject, iat: at, exp: at + 600, nonce, ...(provider === "google" ? { azp: client } : { nonce_supported: true }) };
    const key = keys[provider];
    const signed = `${part({ alg: "RS256", kid: key.kid, typ: "JWT" })}.${part(claims)}`;
    const signature = new Uint8Array(await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key.keys.privateKey, ascii(signed)));
    return `${signed}.${b64(signature)}`;
  }

  return {
    env: { GOOGLE_CLIENT_IDS: GOOGLE_WEB_CLIENT, APPLE_CLIENT_IDS: APPLE_WEB_CLIENT, APPLE_TEAM_ID: "TESTTEAM01", APPLE_KEY_ID: "TESTKEY001", APPLE_PRIVATE_KEY: keys.team },
    clients: { apple: APPLE_WEB_CLIENT, google: GOOGLE_WEB_CLIENT },
    calls,
    async answer(address, { subject = "reader-1", cancel = false } = {}) {
      const url = new URL(address);
      const provider = url.origin === APPLE ? "apple" : url.origin === "https://accounts.google.com" ? "google" : null;
      if (!provider) throw new Error(`the page went to an address that is neither provider's: ${address}`);
      const asked = url.searchParams;
      const state = asked.get("state");
      if (cancel) return `#${new URLSearchParams({ error: provider === "apple" ? "user_cancelled_authorize" : "access_denied", state })}`;
      const token = await idToken(provider, { nonce: asked.get("nonce"), client: asked.get("client_id"), subject });
      return `#${new URLSearchParams({ state, ...(provider === "apple" ? { code: `code-${subject}` } : {}), id_token: token })}`;
    },
    restore() {
      globalThis.fetch = real;
      forgetProviderKeys();
    },
  };
}
