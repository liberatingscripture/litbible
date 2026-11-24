// A software passkey and the client around it, for the tests: everything a
// browser or an app and its authenticator do in a WebAuthn ceremony, made
// with real keys and real signatures, in the standard's own encodings (CBOR,
// COSE, and ASN.1 for an ECDSA signature).
//
// It answers the options the service gives exactly as a platform would, and
// hands back the response in the standard's JSON form. A test that wants a
// refusal passes one override (`o`) and so changes one thing: the origin, a
// flag, the RP, what was signed, the key it was signed with.
//
// The service's own decoder is held to the W3C's published examples as well
// (webauthn.test.js), so it is not only checked against the encoder below.

import { call } from "./call.js";
import { must, ref } from "./notebook.js";

const b64 = ref.toBase64url;
const un = ref.fromBase64url;
const utf8 = (text) => new TextEncoder().encode(text);
const sha256 = async (bytes) => new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));

/** The website's origin, which is also what an iOS app answers with. */
export const ORIGIN = "https://litbible.net";
/** The Android app's, as wrangler.jsonc lists them. */
export const ANDROID_ORIGINS = [
  "android:apk-key-hash:i0jYJmPpHB9l29QmwXak-oP4_MisDdoXizByqeH510k",
  "android:apk-key-hash:1fwRSSnQjSYWhPzTsioZe2Wjm838nZnc6GVT8PMwlEU",
];
/** The website's dev server, on the preview only. */
export const LOCAL_ORIGIN = "http://localhost:4321";

export const FLAGS = { UP: 0x01, UV: 0x04, BE: 0x08, BS: 0x10, AT: 0x40, ED: 0x80 };

export function concat(...parts) {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const part of parts) {
    out.set(part, at);
    at += part.length;
  }
  return out;
}

/* ── CBOR, as an authenticator writes it ────────────────────────────────── */

function head(major, n) {
  if (n < 24) return Uint8Array.of((major << 5) | n);
  if (n < 0x100) return Uint8Array.of((major << 5) | 24, n);
  if (n < 0x10000) return Uint8Array.of((major << 5) | 25, n >> 8, n & 0xff);
  return Uint8Array.of((major << 5) | 26, (n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff);
}

/** Encodes whole numbers, byte strings, text, arrays, Maps, true, false, and null. */
export function cbor(value) {
  if (typeof value === "number") return value >= 0 ? head(0, value) : head(1, -1 - value);
  if (value instanceof Uint8Array) return concat(head(2, value.length), value);
  if (typeof value === "string") return concat(head(3, utf8(value).length), utf8(value));
  if (Array.isArray(value)) return concat(head(4, value.length), ...value.map(cbor));
  if (value instanceof Map) return concat(head(5, value.size), ...[...value].flatMap(([k, v]) => [cbor(k), cbor(v)]));
  if (value === false) return Uint8Array.of(0xf4);
  if (value === true) return Uint8Array.of(0xf5);
  if (value === null) return Uint8Array.of(0xf6);
  throw new Error("cbor: not a value this encoder writes");
}

/* ── A passkey ──────────────────────────────────────────────────────────── */

/**
 * A new passkey, not yet known to anyone. `alg` is -7 (ES256) or -257
 * (RS256); `syncs` is its backup-eligible flag; `counting` makes it keep a
 * signature counter, as a security key or Windows Hello does (a passkey that
 * syncs keeps none, and always says 0).
 */
export async function newPasskey({ alg = -7, syncs = true, backedUp = syncs, counting = false } = {}) {
  const keys =
    alg === -7
      ? await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"])
      : await crypto.subtle.generateKey(
          { name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: Uint8Array.of(1, 0, 1), hash: "SHA-256" },
          true,
          ["sign", "verify"],
        );
  const credentialId = crypto.getRandomValues(new Uint8Array(20));
  return {
    alg,
    keys,
    jwk: await crypto.subtle.exportKey("jwk", keys.publicKey),
    credentialId,
    id: b64(credentialId),
    syncs,
    backedUp,
    counting,
    count: 0,
    /** The user handle it was made under, once it has been made. */
    handle: null,
    /** What its PRF would give. Never sent anywhere. */
    prf: crypto.getRandomValues(new Uint8Array(32)),
  };
}

/** The passkey's public key as COSE writes it. */
export function coseKey(passkey) {
  const { jwk } = passkey;
  return jwk.kty === "EC"
    ? new Map([[1, 2], [3, -7], [-1, 1], [-2, un(jwk.x)], [-3, un(jwk.y)]])
    : new Map([[1, 3], [3, -257], [-1, un(jwk.n)], [-2, un(jwk.e)]]);
}

/** An ECDSA signature (r and s, 32 bytes each) in the ASN.1 form a passkey sends. */
export function derSignature(raw) {
  const integer = (bytes) => {
    let at = 0;
    while (at < bytes.length - 1 && bytes[at] === 0) at++;
    let value = bytes.subarray(at);
    if (value[0] & 0x80) value = concat(Uint8Array.of(0), value);
    return concat(Uint8Array.of(0x02, value.length), value);
  };
  const body = concat(integer(raw.subarray(0, 32)), integer(raw.subarray(32)));
  return concat(Uint8Array.of(0x30, body.length), body);
}

/** Signs as the passkey does: ES256 in ASN.1, or RS256. */
export async function signAs(passkey, bytes) {
  if (passkey.alg === -7) {
    return derSignature(new Uint8Array(await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, passkey.keys.privateKey, bytes)));
  }
  return new Uint8Array(await crypto.subtle.sign("RSASSA-PKCS1-v1_5", passkey.keys.privateKey, bytes));
}

/** Authenticator data (WebAuthn, 6.1). `attested` is { id, key } at registration; `extensions` a Map. */
export async function authenticatorData({ rpId, flags, count = 0, attested = null, extensions = null }) {
  const parts = [await sha256(utf8(rpId)), Uint8Array.of(flags), Uint8Array.of((count >>> 24) & 0xff, (count >>> 16) & 0xff, (count >>> 8) & 0xff, count & 0xff)];
  if (attested) {
    parts.push(new Uint8Array(16), Uint8Array.of(attested.id.length >> 8, attested.id.length & 0xff), attested.id, cbor(attested.key));
  }
  if (extensions) parts.push(cbor(extensions));
  return concat(...parts);
}

const flagsOf = (passkey, o, extra = 0) =>
  o.flags ??
  (FLAGS.UP | FLAGS.UV | (passkey.syncs ? FLAGS.BE : 0) | (passkey.backedUp ? FLAGS.BS : 0) | extra | (o.extensions ? FLAGS.ED : 0));

const clientDataBytes = (type, publicKey, o) =>
  o.clientDataJSON ??
  utf8(JSON.stringify({ type, challenge: publicKey.challenge, origin: o.origin ?? ORIGIN, crossOrigin: false, ...(o.clientData ?? {}) }));

/**
 * Makes the passkey: answers creation options (`publicKey`, as the service
 * gave them) with a registration response in the standard's JSON form.
 *
 * Overrides, each changing one thing: origin, clientData (members to add or
 * replace), clientDataJSON (the bytes outright), rpId, flags, count,
 * extensions (a Map of authenticator extension outputs), attested ({ id, key }
 * inside the authenticator data), authData and attestationObject (the bytes
 * outright), fmt, attStmt, id (what the response names),
 * clientExtensionResults, and `response` (members to add or replace).
 */
export async function attest(passkey, publicKey, o = {}) {
  passkey.handle = publicKey.user.id;
  const clientDataJSON = clientDataBytes("webauthn.create", publicKey, o);
  const authData =
    o.authData ??
    (await authenticatorData({
      rpId: o.rpId ?? publicKey.rp.id,
      flags: flagsOf(passkey, o, FLAGS.AT),
      count: o.count ?? passkey.count,
      attested: o.attested ?? { id: passkey.credentialId, key: coseKey(passkey) },
      extensions: o.extensions,
    }));
  const attestationObject =
    o.attestationObject ?? cbor(new Map([["fmt", o.fmt ?? "none"], ["attStmt", o.attStmt ?? new Map()], ["authData", authData]]));
  const id = o.id ?? passkey.id;
  return {
    id,
    rawId: id,
    type: "public-key",
    response: { clientDataJSON: b64(clientDataJSON), attestationObject: b64(attestationObject), transports: ["internal", "hybrid"], ...(o.response ?? {}) },
    authenticatorAttachment: "platform",
    // What a client sends once it has taken the PRF's results out.
    clientExtensionResults: o.clientExtensionResults ?? { prf: { enabled: true }, credProps: { rk: true } },
  };
}

/**
 * Uses the passkey: answers request options with an authentication response
 * in the standard's JSON form.
 *
 * Overrides: origin, clientData, clientDataJSON, rpId, flags, count,
 * extensions, authData (the bytes outright, which are then what is signed),
 * signWith (another passkey, whose key signs), signature (the bytes
 * outright), userHandle (null leaves it out), id, clientExtensionResults,
 * and `response`.
 */
export async function assert(passkey, publicKey, o = {}) {
  if (passkey.counting && o.count === undefined) passkey.count += 1;
  const clientDataJSON = clientDataBytes("webauthn.get", publicKey, o);
  const authData =
    o.authData ??
    (await authenticatorData({
      rpId: o.rpId ?? publicKey.rpId,
      flags: flagsOf(passkey, o),
      count: o.count ?? passkey.count,
      extensions: o.extensions,
    }));
  const signature = o.signature ?? (await signAs(o.signWith ?? passkey, concat(authData, await sha256(clientDataJSON))));
  const userHandle = o.userHandle === undefined ? passkey.handle : o.userHandle;
  const id = o.id ?? passkey.id;
  return {
    id,
    rawId: id,
    type: "public-key",
    response: {
      clientDataJSON: b64(clientDataJSON),
      authenticatorData: b64(authData),
      signature: b64(signature),
      ...(userHandle === null ? {} : { userHandle }),
      ...(o.response ?? {}),
    },
    authenticatorAttachment: "platform",
    clientExtensionResults: o.clientExtensionResults ?? {},
  };
}

/* ── The ceremonies, start to finish ────────────────────────────────────── */

/** The headers a browser page on `origin` sends, or none for an app. */
const from = (origin) => (origin && origin.startsWith("http") ? { origin } : {});

/** Options from the service, as a client on `origin` gets them. */
export const optionsFor = (path, { token, origin } = {}) => must("POST", path, { token, headers: from(origin) });

/**
 * A reader with no account makes one with a passkey. Returns { passkey,
 * token, way, expires }: the session is signed in, and there is no notebook.
 */
export async function signUpWithPasskey(make = {}, o = {}) {
  const passkey = await newPasskey(make);
  const { publicKey } = await optionsFor("/sign-in/new-passkey/options", o);
  const answer = await must("POST", "/sign-in/new-passkey", { body: { credential: await attest(passkey, publicKey, o) } }, "sign up with a passkey");
  return { passkey, ...answer };
}

/** A reader signs in with a passkey they have. Returns the service's answer: { token, expires, created, way }. */
export async function signInWithPasskey(passkey, o = {}) {
  const { publicKey } = await optionsFor("/sign-in/passkey/options", o);
  return must("POST", "/sign-in/passkey", { body: { credential: await assert(passkey, publicKey, o) } }, "sign in with a passkey");
}

/** The request that sign-in sends, not sent: { publicKey, body }. */
export async function passkeySignInRequest(passkey, o = {}) {
  const { publicKey } = await optionsFor("/sign-in/passkey/options", o);
  return { publicKey, body: { credential: await assert(passkey, publicKey, o) } };
}

/** A signed-in (or open) session adds a passkey as a way in. Returns { passkey, way, lists }. */
export async function addPasskey(token, make = {}, o = {}) {
  const passkey = await newPasskey(make);
  const { publicKey } = await optionsFor("/ways/passkey/options", { token, ...o });
  const answer = await must("POST", "/ways/passkey", { token, body: { credential: await attest(passkey, publicKey, o) } }, "add a passkey");
  return { passkey, ...answer };
}

/** The same, as far as the request that would add it: { passkey, publicKey, body }. */
export async function addPasskeyRequest(token, make = {}, o = {}) {
  const passkey = await newPasskey(make);
  const { publicKey } = await optionsFor("/ways/passkey/options", { token, ...o });
  return { passkey, publicKey, body: { credential: await attest(passkey, publicKey, o) } };
}

export { call };
