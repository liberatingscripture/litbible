// Signed tokens (RFC 7515, RFC 7519), as much of them as sign-in needs:
// checking an identity token from Apple or Google, and signing the short
// token Apple asks for when the service calls it.
//
// Hand-written on WebCrypto for the reason src/webauthn.js gives. The usual
// ways a token check goes wrong are closed by how this is built, not by
// remembering to check:
//
//   - The algorithm is never taken from the token. Only RS256 is verified;
//     a token that names anything else ("none", an HMAC) is refused before a
//     key is looked for.
//   - The key is never taken from the token. It comes from the provider's own
//     published set, at an address fixed in src/providers.js, found by `kid`.
//   - A token's claims are read only after its signature has held.
//
// Nothing here logs a token, a key, or what a provider answered.

import { base64urlBytes, fromBase64url, toBase64url } from "./check.js";

/** An identity token failed a check. `reason` is the word a client is told. */
export class TokenRefused extends Error {
  constructor(reason) {
    super(reason);
    this.reason = reason;
  }
}

/** A provider couldn't be reached, or answered something the service can't use. */
export class ProviderDown extends Error {}

const refused = (reason) => {
  throw new TokenRefused(reason);
};

const utf8 = new TextDecoder("utf-8", { fatal: true });
const ascii = (text) => new TextEncoder().encode(text);

/** How long an answer from a provider is waited for. */
const PROVIDER_TIMEOUT_MS = 5000;
/** A provider's key set is kept this long. */
const KEYS_FRESH_MS = 60 * 60 * 1000;
/** A key the set doesn't have sends the service back for a new set at most this often. */
const KEYS_RETRY_MS = 60 * 1000;

/** address → { keys: Map(kid → JWK), fetched }. In memory, for as long as this copy of the Worker lives. */
const keySets = new Map();

/** Forgets every provider's keys. For the tests, which change them. */
export function forgetProviderKeys() {
  keySets.clear();
}

/** One JSON segment of a token, or a refusal. */
function segment(text) {
  if (base64urlBytes(text) < 2) refused("form");
  let value;
  try {
    value = JSON.parse(utf8.decode(fromBase64url(text)));
  } catch {
    return refused("form");
  }
  if (value === null || typeof value !== "object" || Array.isArray(value)) refused("form");
  return value;
}

/** A provider's published keys, as Map(kid → JWK). RSA signing keys only. */
async function fetchKeys(address) {
  let body;
  try {
    const res = await fetch(address, { headers: { accept: "application/json" }, signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS) });
    if (!res.ok) throw new Error("not ok");
    body = await res.json();
  } catch {
    throw new ProviderDown();
  }
  if (!body || !Array.isArray(body.keys)) throw new ProviderDown();
  const keys = new Map();
  for (const key of body.keys) {
    if (!key || key.kty !== "RSA" || typeof key.kid !== "string" || typeof key.n !== "string" || typeof key.e !== "string") continue;
    if (key.use !== undefined && key.use !== "sig") continue;
    keys.set(key.kid, { kty: "RSA", n: key.n, e: key.e });
  }
  if (keys.size === 0) throw new ProviderDown();
  return keys;
}

async function providerKey(address, kid) {
  const at = Date.now();
  let set = keySets.get(address);
  const stale = !set || at - set.fetched > KEYS_FRESH_MS;
  // A `kid` the set lacks may be a key the provider began using since it was fetched.
  const missing = set && !set.keys.has(kid) && at - set.fetched > KEYS_RETRY_MS;
  if (stale || missing) {
    set = { keys: await fetchKeys(address), fetched: at };
    keySets.set(address, set);
  }
  return set.keys.get(kid) ?? null;
}

/**
 * Checks a token's signature against the provider's published keys and
 * returns its claims. `maxChars` bounds what is read at all.
 */
export async function verifyRs256(token, keysAddress, maxChars) {
  if (typeof token !== "string" || token.length > maxChars) refused("form");
  const parts = token.split(".");
  if (parts.length !== 3) refused("form");
  const header = segment(parts[0]);
  if (header.alg !== "RS256") refused("algorithm");
  if (typeof header.kid !== "string" || header.kid === "") refused("form");
  const signatureBytes = base64urlBytes(parts[2]);
  if (signatureBytes < 256 || signatureBytes > 1024) refused("form");

  const jwk = await providerKey(keysAddress, header.kid);
  if (!jwk) refused("key");
  let key;
  try {
    key = await crypto.subtle.importKey(
      "jwk",
      { ...jwk, alg: "RS256", ext: true },
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      false,
      ["verify"],
    );
  } catch {
    throw new ProviderDown();
  }
  const good = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, fromBase64url(parts[2]), ascii(`${parts[0]}.${parts[1]}`));
  if (!good) refused("signature");
  // Read only now that the signature has held.
  return segment(parts[1]);
}

/**
 * A token signed with ES256 by a P-256 private key in PKCS #8 PEM, the form
 * Apple hands a developer (a .p8 file). Line breaks may be real, or the two
 * characters `\n`, since a secret pasted on one line arrives that way.
 */
export async function signEs256(header, claims, pem) {
  const der = String(pem)
    .replace(/-----[A-Z ]+-----/g, "")
    .replace(/\\n/g, "")
    .replace(/\s+/g, "");
  const key = await crypto.subtle.importKey(
    "pkcs8",
    Uint8Array.from(atob(der), (c) => c.charCodeAt(0)),
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"],
  );
  const encode = (value) => toBase64url(ascii(JSON.stringify(value)));
  const signed = `${encode({ ...header, alg: "ES256" })}.${encode(claims)}`;
  // WebCrypto's ECDSA signature is r and s end to end, which is the form a JWS carries.
  const signature = new Uint8Array(await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, ascii(signed)));
  return `${signed}.${toBase64url(signature)}`;
}
