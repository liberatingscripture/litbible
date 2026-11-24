// Apple and Google, stood in for: a provider with real RSA keys that signs
// real identity tokens, publishes its key set, and (for Apple) answers the
// two calls the service makes. Nothing here reaches the network: fetch() is
// replaced for the length of a test, and any address a test didn't expect
// fails it.
//
// The client ids, team id, and key id below are made up for the tests. No
// real identifier of LIT's is written anywhere in this repository.

import { vi } from "vitest";
import { forgetProviderKeys } from "../src/jwt.js";
import { call } from "./call.js";
import { must, ref } from "./notebook.js";

const b64 = ref.toBase64url;
const un = ref.fromBase64url;
const ascii = (text) => new TextEncoder().encode(text);
const part = (value) => b64(ascii(JSON.stringify(value)));

export const APPLE_KEYS = "https://appleid.apple.com/auth/keys";
export const APPLE_TOKEN = "https://appleid.apple.com/auth/token";
export const APPLE_REVOKE = "https://appleid.apple.com/auth/revoke";
export const GOOGLE_KEYS = "https://www.googleapis.com/oauth2/v3/certs";

export const GOOGLE_CLIENT = "test-google-client.example";
export const GOOGLE_CLIENT_2 = "test-google-client-2.example";
export const APPLE_CLIENT = "test.example.app";
export const APPLE_WEB_CLIENT = "test.example.web";

const ISSUER = { apple: "https://appleid.apple.com", google: "https://accounts.google.com" };

async function rsaKey(kid) {
  const keys = await crypto.subtle.generateKey(
    { name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: Uint8Array.of(1, 0, 1), hash: "SHA-256" },
    true,
    ["sign", "verify"],
  );
  const { n, e } = await crypto.subtle.exportKey("jwk", keys.publicKey);
  return { kid, keys, jwk: { kty: "RSA", kid, use: "sig", alg: "RS256", n, e } };
}

// One signing key for each provider is enough for nearly every test, and RSA keys are slow to
// make, so they are made once for a test file.
const made = new Map();
/** A provider's signing key by `kid`, made on first use. */
export async function signingKey(kid) {
  if (!made.has(kid)) made.set(kid, rsaKey(kid));
  return made.get(kid);
}

let subjects = 0;
/** A provider's id for an account that no other test has used. */
export const freshSubject = (label = "sub") => `${label}-${Date.now().toString(36)}-${++subjects}`;

/** A signed token: header, claims, and an RS256 signature by `key`. */
export async function signToken(key, claims, header = {}) {
  const signed = `${part({ alg: "RS256", kid: key.kid, typ: "JWT", ...header })}.${part(claims)}`;
  const signature = new Uint8Array(await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key.keys.privateKey, ascii(signed)));
  return `${signed}.${b64(signature)}`;
}

/**
 * An identity token as the provider would issue it for `challenge`. `claims`
 * adds or replaces claims (undefined removes one); `header` does the same
 * for the header; `key` signs it (the provider's own by default).
 */
export async function idToken(provider, challenge, { claims = {}, header = {}, key, subject = freshSubject() } = {}) {
  const at = Math.floor(Date.now() / 1000);
  const all = {
    iss: ISSUER[provider],
    aud: provider === "apple" ? APPLE_CLIENT : GOOGLE_CLIENT,
    sub: subject,
    iat: at,
    exp: at + 600,
    nonce: challenge,
    // What a provider may add, and the service must never keep.
    email: "reader@example.com",
    email_verified: true,
    ...(provider === "google" ? { name: "A Reader", azp: GOOGLE_CLIENT } : { nonce_supported: true }),
    ...claims,
  };
  for (const name of Object.keys(all)) if (all[name] === undefined) delete all[name];
  return signToken(key ?? (await signingKey(`${provider}-key-1`)), all, header);
}

/** The team's key Apple gives a developer, as a .p8 file's text, and its public half. */
async function appleTeamKey() {
  const keys = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
  const der = new Uint8Array(await crypto.subtle.exportKey("pkcs8", keys.privateKey));
  const lines = btoa(String.fromCharCode(...der)).match(/.{1,64}/g).join("\n");
  return { pem: `-----BEGIN PRIVATE KEY-----\n${lines}\n-----END PRIVATE KEY-----\n`, publicKey: keys.publicKey };
}

let team;
/** The environment that turns Apple and Google on, with made-up ids and a key made here. */
export async function providersOn() {
  team ??= await appleTeamKey();
  return {
    env: {
      GOOGLE_CLIENT_IDS: `${GOOGLE_CLIENT}, ${GOOGLE_CLIENT_2}`,
      APPLE_CLIENT_IDS: `${APPLE_CLIENT},${APPLE_WEB_CLIENT}`,
      APPLE_TEAM_ID: "TESTTEAM01",
      APPLE_KEY_ID: "TESTKEY001",
      APPLE_PRIVATE_KEY: team.pem,
    },
    team,
  };
}

/**
 * Replaces fetch() with the two providers. Returns what the tests read and
 * change:
 *
 *   calls        every request made, as { url, method, form } (form: the
 *                posted fields, for Apple's two addresses)
 *   keys         { apple: [...], google: [...] }, the published key sets;
 *                change them to rotate a key
 *   down         a Set of addresses that fail as a network does
 *   answers      { token, revoke }: functions (form) => [status, body] for
 *                Apple's two addresses
 *   refreshFor   the refresh token the stand-in gives for a code
 */
export async function standIns() {
  forgetProviderKeys();
  const world = {
    calls: [],
    keys: { apple: [(await signingKey("apple-key-1")).jwk], google: [(await signingKey("google-key-1")).jwk] },
    down: new Set(),
    refreshFor: (code) => `refresh-for-${code}`,
    answers: {
      token: (form) => [200, { access_token: "access", token_type: "Bearer", expires_in: 3600, refresh_token: world.refreshFor(form.code), id_token: "unused" }],
      revoke: () => [200, null],
    },
  };
  const json = (status, body) =>
    new Response(body === null ? "" : JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
  vi.stubGlobal("fetch", async (input, init = {}) => {
    const url = typeof input === "string" ? input : input.url;
    const method = init.method ?? "GET";
    const form = init.body ? Object.fromEntries(new URLSearchParams(init.body)) : null;
    world.calls.push({ url, method, form, headers: init.headers ?? {} });
    if (world.down.has(url)) throw new TypeError("network failure (a test's)");
    if (url === APPLE_KEYS) return json(200, { keys: world.keys.apple });
    if (url === GOOGLE_KEYS) return json(200, { keys: world.keys.google });
    if (url === APPLE_TOKEN) return json(...world.answers.token(form));
    if (url === APPLE_REVOKE) return json(...world.answers.revoke(form));
    throw new Error(`a test reached an address it did not expect: ${url}`);
  });
  return world;
}

/** Puts fetch() back, and forgets the keys the service fetched. */
export function standDown() {
  vi.unstubAllGlobals();
  forgetProviderKeys();
}

/** Checks the token Apple asks the service to sign: by the team's key, for this client, in time. Returns its claims. */
export async function readClientSecret(secret, teamPublicKey) {
  const [header, claims, signature] = secret.split(".");
  const good = await crypto.subtle.verify({ name: "ECDSA", hash: "SHA-256" }, teamPublicKey, un(signature), ascii(`${header}.${claims}`));
  const read = (text) => JSON.parse(new TextDecoder().decode(un(text)));
  return { good, header: read(header), claims: read(claims) };
}

/** A challenge for Apple or Google to carry back. */
export const challengeFor = async (env) => (await must("POST", "/sign-in/challenge", { env })).challenge;

/**
 * What a client sends to sign in with a provider, not sent: { challenge,
 * idToken } and for Apple { code }. `token` is passed on to idToken().
 */
export async function providerRequest(provider, env, { token = {}, code = `code-${freshSubject()}`, redirect } = {}) {
  const challenge = await challengeFor(env);
  return {
    challenge,
    idToken: await idToken(provider, challenge, token),
    ...(provider === "apple" ? { code } : {}),
    ...(redirect === undefined ? {} : { redirect }),
  };
}

/** Signs in with a provider, start to finish. Returns the service's answer and the subject used. */
export async function signInWith(provider, env, options = {}) {
  const subject = options.token?.subject ?? freshSubject();
  const body = await providerRequest(provider, env, { ...options, token: { ...options.token, subject } });
  const answer = await must("POST", `/sign-in/${provider}`, { env, body }, `sign in with ${provider}`);
  return { ...answer, subject, body };
}

export { call };
