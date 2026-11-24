// Checking a passkey's answer (WebAuthn Level 3, sections 7.1 and 7.2), with
// nothing here that reads or writes the database: bytes in, a verdict out.
//
// WHY THIS IS HAND-WRITTEN ON WEBCRYPTO, AND NOT A LIBRARY. The service asks
// for no attestation (it never judges the make of a reader's passkey), so all
// it has to check is small and fixed: what the client says it signed, what the
// authenticator says about itself in 37 bytes and a public key, and one
// signature under one of two algorithms. That is this file and src/cbor.js,
// short enough to read in a sitting, with each check a row of the spec's
// table and a test of its own. A library would bring the dozen attestation
// formats this service never reads and their certificate parsers, as the
// service's first runtime dependencies, into the one place that hands out
// sessions. It would also not know the two rules that are LIT's own: a
// response that carries a PRF result is refused, and an Android app's origin
// is checked against a list. The tests hold this code to the W3C's own
// published examples (test/webauthn.test.js), not only to an authenticator
// written beside it.
//
// WHAT THE SERVICE NEVER SEES: the PRF's output. A client removes it before a
// response leaves the device, and the routes refuse one that still has it
// (src/passkey-form.js), before anything here runs.

import { CborError, decodeCbor, decodeCborWhole } from "./cbor.js";
import { toBase64url } from "./check.js";

/** A passkey's answer failed a check. `reason` is the word a client is told. */
export class PasskeyRefused extends Error {
  constructor(reason) {
    super(reason);
    this.reason = reason;
  }
}
const fail = (reason) => {
  throw new PasskeyRefused(reason);
};

// The flags byte of authenticator data (WebAuthn, 6.1).
const UP = 0x01; // the user was present
const UV = 0x04; // the user was verified
const BE = 0x08; // the credential may be backed up: it is the kind that syncs
const BS = 0x10; // it is backed up now
const AT = 0x40; // attested credential data follows
const ED = 0x80; // extension data follows

/** The two signature algorithms asked for, by their COSE numbers, in the order of preference. */
export const ALGORITHMS = Object.freeze([-7, -257]); // ES256, then RS256 (Windows Hello on an older TPM)

const sha256 = async (bytes) => new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
const utf8 = new TextDecoder("utf-8", { fatal: true });
const same = (a, b) => a.length === b.length && a.every((byte, i) => byte === b[i]);

/**
 * What the client says it did: the `clientDataJSON` of a response, read as
 * the JSON it is. Checks its `type` ("webauthn.create" or "webauthn.get") and
 * that it wasn't made inside another site's frame. Returns the challenge and
 * the origin as text, for the caller to check against what it issued and
 * what it accepts.
 */
export function readClientData(bytes, type) {
  let data;
  try {
    data = JSON.parse(utf8.decode(bytes));
  } catch {
    return fail("client_data");
  }
  if (data === null || typeof data !== "object" || Array.isArray(data)) fail("client_data");
  if (typeof data.challenge !== "string" || typeof data.origin !== "string") fail("client_data");
  if (data.type !== type) fail("type");
  if (data.crossOrigin === true) fail("cross_origin");
  return { challenge: data.challenge, origin: data.origin };
}

/**
 * Authenticator data, taken apart (WebAuthn, 6.1): the RP ID's hash, the
 * flags, the signature counter, and, at registration, the new credential's id
 * and public key. Nothing may follow what the flags announce.
 */
function readAuthenticatorData(bytes) {
  if (bytes.length < 37) fail("authenticator_data");
  const flags = bytes[32];
  const out = {
    rpIdHash: bytes.subarray(0, 32),
    present: (flags & UP) !== 0,
    verified: (flags & UV) !== 0,
    eligible: (flags & BE) !== 0,
    backedUp: (flags & BS) !== 0,
    count: ((bytes[33] << 24) | (bytes[34] << 16) | (bytes[35] << 8) | bytes[36]) >>> 0,
    credential: null,
  };
  let at = 37;
  try {
    if (flags & AT) {
      if (bytes.length < at + 18) fail("authenticator_data");
      const length = (bytes[at + 16] << 8) | bytes[at + 17];
      at += 18;
      if (length < 1 || length > 1023 || at + length > bytes.length) fail("authenticator_data");
      const id = bytes.slice(at, at + length);
      const key = decodeCbor(bytes, at + length);
      if (!(key.value instanceof Map)) fail("authenticator_data");
      out.credential = { id, key: key.value };
      at = key.end;
    }
    if (flags & ED) {
      const extensions = decodeCbor(bytes, at);
      if (!(extensions.value instanceof Map)) fail("authenticator_data");
      at = extensions.end;
    }
  } catch (error) {
    if (error instanceof CborError) fail("authenticator_data");
    throw error;
  }
  if (at !== bytes.length) fail("authenticator_data");
  return out;
}

/** What both ceremonies check of authenticator data: the RP, presence, verification, and that the backup flags make sense. */
async function checkAuthenticatorData(data, rpId) {
  if (!same(data.rpIdHash, await sha256(new TextEncoder().encode(rpId)))) fail("rp");
  if (!data.present) fail("presence");
  // Always required (STUDY-DESK-ENCRYPTION.md, "The passkey"): the PRF's secret is tied to it.
  if (!data.verified) fail("verification");
  // A credential can't be backed up without being the kind that may be (WebAuthn, 6.1.3).
  if (data.backedUp && !data.eligible) fail("backup");
}

/**
 * A COSE public key (RFC 9052) as the JWK the service stores: P-256 for
 * ES256, or RSA of 2,048 bits or more for RS256. Anything else is refused.
 */
function jwkFromCose(key) {
  const bytes = (label, min, max) => {
    const value = key.get(label);
    return value instanceof Uint8Array && value.length >= min && value.length <= max ? value : fail("key");
  };
  const kty = key.get(1);
  const alg = key.get(3);
  if (kty === 2 && alg === -7) {
    if (key.get(-1) !== 1) fail("algorithm"); // the curve: P-256
    return { kty: "EC", crv: "P-256", x: toBase64url(bytes(-2, 32, 32)), y: toBase64url(bytes(-3, 32, 32)) };
  }
  if (kty === 3 && alg === -257) {
    return { kty: "RSA", n: toBase64url(bytes(-1, 256, 1024)), e: toBase64url(bytes(-2, 1, 8)) };
  }
  return fail("algorithm");
}

/** The stored JWK as a key WebCrypto verifies with. Refuses a point off the curve, or a key that isn't one. */
async function importPublicKey(jwk) {
  try {
    if (jwk.kty === "EC") {
      return await crypto.subtle.importKey("jwk", { ...jwk, ext: true }, { name: "ECDSA", namedCurve: "P-256" }, false, ["verify"]);
    }
    return await crypto.subtle.importKey(
      "jwk",
      { ...jwk, alg: "RS256", ext: true },
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      false,
      ["verify"],
    );
  } catch {
    return fail("key");
  }
}

/**
 * An ECDSA signature as WebCrypto wants it: r and s, 32 bytes each. A passkey
 * sends it in ASN.1 (a SEQUENCE of two INTEGERs). Null when it isn't that.
 */
export function ecdsaSignatureFromDer(der) {
  // A P-256 signature is at most 72 bytes, so every length here is one byte.
  if (der.length < 8 || der.length > 72 || der[0] !== 0x30 || der[1] !== der.length - 2) return null;
  let at = 2;
  const integer = () => {
    if (der[at] !== 0x02) return null;
    const length = der[at + 1];
    at += 2;
    if (!(length >= 1) || at + length > der.length) return null;
    let value = der.subarray(at, at + length);
    at += length;
    if (value[0] & 0x80) return null; // negative
    while (value.length > 1 && value[0] === 0) value = value.subarray(1);
    return value.length <= 32 ? value : null;
  };
  const r = integer();
  const s = r && integer();
  if (!r || !s || at !== der.length) return null;
  const raw = new Uint8Array(64);
  raw.set(r, 32 - r.length);
  raw.set(s, 64 - s.length);
  return raw;
}

/**
 * A new passkey (WebAuthn 7.1, from its step 11 on; the caller has already
 * read the client data and used the challenge). The attestation statement is
 * not read: the service asked for none and trusts none.
 *
 * Returns what the service keeps: the public key as a JWK, the counter, and
 * whether the passkey is the kind that syncs.
 */
export async function checkRegistration({ attestationObject, credentialId, rpId }) {
  let attestation;
  try {
    attestation = decodeCborWhole(attestationObject);
  } catch (error) {
    if (error instanceof CborError) fail("attestation");
    throw error;
  }
  if (!(attestation instanceof Map)) fail("attestation");
  const authData = attestation.get("authData");
  if (typeof attestation.get("fmt") !== "string" || !(attestation.get("attStmt") instanceof Map) || !(authData instanceof Uint8Array)) {
    fail("attestation");
  }
  const data = readAuthenticatorData(authData);
  await checkAuthenticatorData(data, rpId);
  if (!data.credential) fail("authenticator_data");
  // The id the client named is the one the authenticator made.
  if (!same(data.credential.id, credentialId)) fail("credential");
  const jwk = jwkFromCose(data.credential.key);
  await importPublicKey(jwk);
  return { jwk, count: data.count, syncs: data.eligible };
}

/**
 * A passkey used to sign in (WebAuthn 7.2, from its step 13 on). `jwk` and
 * `syncs` are what registration stored. Returns the counter the authenticator
 * gave; whether it went forward is the caller's to check as it writes it.
 */
export async function checkAssertion({ clientDataJSON, authenticatorData, signature, rpId, jwk, syncs }) {
  const data = readAuthenticatorData(authenticatorData);
  if (data.credential) fail("authenticator_data");
  await checkAuthenticatorData(data, rpId);
  // Whether a credential may be backed up is fixed when it is made (WebAuthn, 6.1.3).
  if (data.eligible !== syncs) fail("backup");

  const key = await importPublicKey(jwk);
  const signed = new Uint8Array(authenticatorData.length + 32);
  signed.set(authenticatorData);
  signed.set(await sha256(clientDataJSON), authenticatorData.length);
  let good = false;
  if (jwk.kty === "EC") {
    const raw = ecdsaSignatureFromDer(signature);
    good = raw !== null && (await crypto.subtle.verify({ name: "ECDSA", hash: "SHA-256" }, key, raw, signed));
  } else {
    good = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, signature, signed);
  }
  if (!good) fail("signature");
  return { count: data.count };
}
