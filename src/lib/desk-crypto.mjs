// src/lib/desk-crypto.mjs
//
// The reference implementation of STUDY-DESK-ENCRYPTION.md: how the synced
// notebook is sealed before it leaves a device, and how the key that seals it
// passes from one device to another. This is the code the website ships (the
// plan's step 4g builds its connector on it), and the code that writes the
// test vectors both apps run (test/fixtures/notebook-crypto-vectors.json, by
// scripts/build-notebook-crypto-vectors.mjs). test/desk-crypto.test.js holds
// the two together, and runs published vectors through this file first.
//
// Rules for this file:
// - Pure, on WebCrypto alone (globalThis.crypto, which browsers and Node
//   share). No storage, no network, no node: imports, no dependency.
// - Every random input is an argument with a random default, so the vector
//   builder can fix each one and ordinary callers can't forget one.
// - A check that fails throws a Refusal whose `why` is one of REFUSALS. The
//   vectors name the same words, so "refused, and why" means the same thing
//   in all three clients.
// - The spec is the contract. Where this code had to read the spec one way,
//   the spec says so too ("Changed in step 4b"); change
//   the two together, regenerate the vectors, bump CRYPTO_VECTORS_VERSION,
//   and tell the apps (STUDY-DESK-FOR-THE-APPS.md).
// - Study Desk code: nothing a page loads without data-desk="on" imports it.

/** The version in every label ("lit-notebook/1 …"). A later version changes the labels. */
export const CRYPTO_VERSION = 1;

/** The committed vectors' own version: it moves whenever a value in the file does. */
export const CRYPTO_VECTORS_VERSION = 2;

export const KEY_BYTES = 32;
export const NONCE_BYTES = 12;
export const TAG_BYTES = 16;
export const POINT_BYTES = 65;
export const SCALAR_BYTES = 32;
export const RECOVERY_CODE_BYTES = 15;
export const APPROVAL_CODE_BYTES = 10;
/** A record is padded with spaces to the next multiple of this. */
export const PAD_BLOCK = 256;
/** The format's ceiling for any record (desk-records.mjs's MAX_RECORD_BYTES; the test holds the two equal). */
export const MAX_RECORD_BYTES = 1_048_576;

/** Every label, as the spec's table has them. */
export const LABELS = Object.freeze({
  record: "lit-notebook/1 record",
  device: "lit-notebook/1 device",
  proof: "lit-notebook/1 proof",
  recovery: "lit-notebook/1 recovery",
  passkey: "lit-notebook/1 passkey",
  prf: "lit-notebook/1 prf",
  approveId: "lit-notebook/1 approve-id",
  approveMac: "lit-notebook/1 approve-mac",
  keyring: "lit-notebook/1 keyring",
  row: "lit-row/1",
  deviceCard: "lit-device/1",
  holder: "lit-holder/1",
  holderCard: "lit-holder-card/1",
  approveRequest: "lit-approve/1 request",
  approveGrant: "lit-approve/1 grant",
});

/**
 * Why a check refused, in the words the vectors use. `version` and
 * `missingKey` on a row mean "keep it aside and fetch the keyring"; every
 * other refusal of a row means "skip it, keep the device's own copy, and
 * report it." Nothing here ever means "delete."
 */
export const REFUSALS = Object.freeze({
  bytes: "a byte string of the wrong length: a key, a nonce, a code, a MAC, or a PRF output",
  base64url: "text that isn't base64url without padding, written the one canonical way",
  code: "a typed code with a character outside the alphabet (checked before its length)",
  codeLength: "a typed code with the wrong number of characters",
  lineFeed: "a value headed for an AAD or a MAC that isn't text, or that holds a line feed",
  kid: "a kid that isn't a whole number of 1 or more",
  id: "an id a device makes that isn't a UUID in lowercase with hyphens",
  point: "a public key that isn't the 65-byte uncompressed form of a point on P-256",
  privateKey: "a private key that isn't a 32-byte scalar beside its own public key",
  recordSize: "a record that is empty or larger than MAX_RECORD_BYTES",
  row: "a row whose own fields aren't what a row carries",
  version: "a row, a keyring, or a holder record whose version this client doesn't know",
  missingKey: "a row sealed under a kid the keyring doesn't hold",
  length: "a ciphertext whose length isn't a padded record's: a multiple of 256 bytes, plus the tag",
  seal: "a seal that doesn't open: the wrong key, or a changed byte, nonce, tag, or AAD field",
  json: "opened bytes that aren't the UTF-8 JSON object they should be",
  fields: "a record whose id, modified, or deletedAt disagrees with the row's plain fields",
  kids: "a keyring whose kids aren't exactly the whole numbers from 1 to current, each once",
  keySize: "a keyring key that isn't 32 bytes of base64url",
  notebook: "a keyring or a holder record that names another notebook",
  backward: "a keyring whose current is lower than the highest this device has accepted",
  keyChanged: "a keyring that lacks a key this device holds, or holds other bytes for it",
  card: "a card a client won't write (a field missing or of the wrong kind), or a grant's card that doesn't open for this device or doesn't name its keys",
  record: "a holder record that isn't what it should be: lit, v, kind, id, or the shape of its keys",
  credential: "a passkey holder's record that names another passkey than the one that answered",
  anchor: "a holder's keyring that lacks the anchor's key, or holds other bytes for it",
  mac: "an approval MAC that doesn't verify",
  grantKid: "a grant whose kid isn't its keyring's current",
  der: "a signature that isn't the strict DER form of two 32-byte numbers",
});

export class Refusal extends Error {
  /**
   * @param {keyof typeof REFUSALS} why
   * @param {string} [detail] for a developer; never shown to a reader
   * @param {number} [check] which of a holder's four checks stopped, 1 to 4
   */
  constructor(why, detail, check) {
    super(detail ? `${why}: ${detail}` : why);
    this.name = "Refusal";
    this.why = why;
    if (check) this.check = check;
  }
}

function refuse(why, detail, check) {
  throw new Refusal(why, detail, check);
}

/** Which of a holder's four checks a refusal belongs to, stamped on whatever a step throws. */
async function atCheck(n, fn) {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof Refusal && !e.check) e.check = n;
    throw e;
  }
}

const subtle = () => globalThis.crypto.subtle;

/* ── Bytes and text ──────────────────────────────────────────────────── */

const encoder = new TextEncoder();
const EMPTY = new Uint8Array(0);

/** Any byte source as a Uint8Array (no copy when it already is one). */
function u8(bytes) {
  if (bytes instanceof Uint8Array) return bytes;
  if (bytes instanceof ArrayBuffer) return new Uint8Array(bytes);
  if (ArrayBuffer.isView(bytes)) return new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (Array.isArray(bytes)) return Uint8Array.from(bytes);
  return refuse("bytes", "not a byte string");
}

function sized(bytes, n, what) {
  const b = u8(bytes);
  if (b.length !== n) refuse("bytes", `${what} is ${b.length} bytes, not ${n}`);
  return b;
}

export function utf8(text) {
  return encoder.encode(text);
}

/** Bytes as text; refuses anything that isn't well-formed UTF-8. */
export function fromUtf8(bytes) {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(u8(bytes));
  } catch {
    return refuse("json", "not UTF-8");
  }
}

export function concatBytes(...parts) {
  const all = parts.map(u8);
  const out = new Uint8Array(all.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of all) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}

export function bytesEqual(a, b) {
  const x = u8(a);
  const y = u8(b);
  if (x.length !== y.length) return false;
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0;
}

const HEX = "0123456789abcdef";

export function toHex(bytes) {
  let s = "";
  for (const b of u8(bytes)) s += HEX[b >> 4] + HEX[b & 15];
  return s;
}

export function fromHex(text) {
  if (typeof text !== "string" || text.length % 2 || /[^0-9a-fA-F]/.test(text)) refuse("bytes", "not hex");
  const out = new Uint8Array(text.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(text.slice(2 * i, 2 * i + 2), 16);
  return out;
}

const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
const B64_VALUE = new Map([...B64].map((c, i) => [c, i]));

/** Base64url without padding (RFC 4648 §5). */
export function toBase64url(bytes) {
  const b = u8(bytes);
  const out = [];
  let chunk = "";
  for (let i = 0; i < b.length; i += 3) {
    const n = (b[i] << 16) | ((b[i + 1] ?? 0) << 8) | (b[i + 2] ?? 0);
    chunk += B64[n >> 18] + B64[(n >> 12) & 63];
    if (i + 1 < b.length) chunk += B64[(n >> 6) & 63];
    if (i + 2 < b.length) chunk += B64[n & 63];
    if (chunk.length > 8192) {
      out.push(chunk);
      chunk = "";
    }
  }
  out.push(chunk);
  return out.join("");
}

/**
 * Reads base64url the one way toBase64url writes it. Refused: padding, `+`
 * or `/`, any other character, a length no byte string encodes to, and
 * leftover bits that aren't zero (so each byte string has one spelling).
 */
export function fromBase64url(text) {
  if (typeof text !== "string" || text.length % 4 === 1) refuse("base64url");
  const out = new Uint8Array(Math.floor((text.length * 3) / 4));
  let acc = 0;
  let bits = 0;
  let at = 0;
  for (const c of text) {
    const v = B64_VALUE.get(c);
    if (v === undefined) refuse("base64url");
    acc = ((acc << 6) | v) & 0xffff;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out[at++] = (acc >> bits) & 0xff;
    }
  }
  if (acc & ((1 << bits) - 1)) refuse("base64url", "leftover bits");
  return out;
}

/**
 * "Lines": the UTF-8 bytes of the values, one line feed between each and
 * none after the last. A last value that is empty therefore leaves the line
 * feed before it at the end. No value may hold a line feed.
 */
export function lines(...values) {
  for (const v of values) if (typeof v !== "string" || v.includes("\n")) refuse("lineFeed");
  return utf8(values.join("\n"));
}

/** A kid as an AAD or a MAC carries it: decimal, no sign, no leading zero. */
export function kidText(kid) {
  if (!Number.isSafeInteger(kid) || kid < 1) refuse("kid");
  return String(kid);
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** True for a UUID written in lowercase with hyphens, the form of every id a device makes. */
export function isUuid(text) {
  return typeof text === "string" && UUID.test(text);
}

function needUuid(text, what) {
  if (!isUuid(text)) refuse("id", what);
  return text;
}

/** Random bytes from the platform. Every function that needs any takes them as an argument with this default. */
export function randomBytes(n) {
  const out = new Uint8Array(n);
  globalThis.crypto.getRandomValues(out);
  return out;
}

/** A new id for a notebook, a device, or a holder: a version 4 UUID from 16 random bytes. */
export function newId(random = randomBytes(16)) {
  const b = Uint8Array.from(sized(random, 16, "an id's random bytes"));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = toHex(b);
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

/* ── SHA-256, HMAC, HKDF ─────────────────────────────────────────────── */

export async function sha256(bytes) {
  return new Uint8Array(await subtle().digest("SHA-256", u8(bytes)));
}

const ZERO_SALT = new Uint8Array(32);

async function hmacKey(key, usages = ["sign"]) {
  const k = u8(key);
  // WebCrypto refuses an empty HMAC key, which is why the spec writes a zero salt out.
  if (!k.length) refuse("bytes", "an empty HMAC key");
  return subtle().importKey("raw", k, { name: "HMAC", hash: "SHA-256" }, false, usages);
}

export async function hmac(key, bytes) {
  return new Uint8Array(await subtle().sign("HMAC", await hmacKey(key), u8(bytes)));
}

/** Checks a MAC in constant time (the platform's own comparison). */
export async function hmacVerify(key, bytes, mac) {
  const m = u8(mac);
  if (m.length !== 32) return false;
  return subtle().verify("HMAC", await hmacKey(key, ["verify"]), m, u8(bytes));
}

/** HKDF-Extract (RFC 5869). An empty salt is 32 zero bytes, which is what the RFC means by one. */
export async function hkdfExtract(salt, ikm) {
  const s = u8(salt);
  return hmac(s.length ? s : ZERO_SALT, ikm);
}

/** HKDF-Expand (RFC 5869). */
export async function hkdfExpand(prk, info, length) {
  if (!Number.isInteger(length) || length < 1 || length > 255 * 32) refuse("bytes", "an HKDF length out of range");
  const key = await hmacKey(prk);
  const out = new Uint8Array(length);
  let t = EMPTY;
  for (let i = 1, at = 0; at < length; i++) {
    t = new Uint8Array(await subtle().sign("HMAC", key, concatBytes(t, u8(info), [i])));
    out.set(t.subarray(0, Math.min(t.length, length - at)), at);
    at += t.length;
  }
  return out;
}

/** The spec's HKDF: SHA-256, a salt of 32 zero bytes, and an ASCII label as `info`. */
export async function hkdf(input, label, length = KEY_BYTES) {
  if (typeof label !== "string") refuse("lineFeed", "an HKDF label is text");
  return hkdfExpand(await hkdfExtract(ZERO_SALT, input), utf8(label), length);
}

/* ── AES-256-GCM ─────────────────────────────────────────────────────── */

async function gcmKey(key, usage) {
  return subtle().importKey("raw", u8(key), "AES-GCM", false, [usage]);
}

// The key may be 16 bytes only for the published HPKE vectors' AES-128 suite.
async function gcmSeal(key, nonce, aad, plaintext) {
  const params = { name: "AES-GCM", iv: u8(nonce), additionalData: u8(aad), tagLength: 128 };
  return new Uint8Array(await subtle().encrypt(params, await gcmKey(key, "encrypt"), u8(plaintext)));
}

async function gcmOpen(key, nonce, aad, ciphertext) {
  const ct = u8(ciphertext);
  if (ct.length < TAG_BYTES) refuse("seal", "shorter than a tag");
  const params = { name: "AES-GCM", iv: u8(nonce), additionalData: u8(aad), tagLength: 128 };
  try {
    return new Uint8Array(await subtle().decrypt(params, await gcmKey(key, "decrypt"), ct));
  } catch {
    return refuse("seal");
  }
}

/** AES-256-GCM: a 12-byte nonce, and the 16-byte tag appended to the ciphertext. */
export async function aesGcmSeal(key, nonce, aad, plaintext) {
  return gcmSeal(sized(key, KEY_BYTES, "an AES-256 key"), sized(nonce, NONCE_BYTES, "a nonce"), aad, plaintext);
}

export async function aesGcmOpen(key, nonce, aad, ciphertext) {
  return gcmOpen(sized(key, KEY_BYTES, "an AES-256 key"), sized(nonce, NONCE_BYTES, "a nonce"), aad, ciphertext);
}

/* ── P-256 ───────────────────────────────────────────────────────────── */

const P = 0xffffffff00000001000000000000000000000000ffffffffffffffffffffffffn;
const B = 0x5ac635d8aa3a93e7b3ebbd55769886bc651d06b0cc53b0f63bce3c3e27d2604bn;
const N = 0xffffffff00000000ffffffffffffffffbce6faada7179e84f3b9cac2fc632551n;

const toBig = (bytes) => BigInt("0x" + (toHex(bytes) || "0"));

/**
 * True for the 65-byte uncompressed form (04 ‖ x ‖ y) of a point on P-256.
 * Checked by hand, before any platform call sees the bytes: the compressed
 * and hybrid forms, a coordinate at or past the field's size, and a point
 * off the curve are all refused. P-256 has no small subgroups, so a point on
 * the curve needs no further check.
 */
export function isP256Point(bytes) {
  let b;
  try {
    b = u8(bytes);
  } catch {
    return false;
  }
  if (b.length !== POINT_BYTES || b[0] !== 4) return false;
  const x = toBig(b.subarray(1, 33));
  const y = toBig(b.subarray(33));
  if (x >= P || y >= P) return false;
  return (y * y) % P === (((x * x) % P) * x + (P - 3n) * x + B) % P;
}

function needPoint(bytes, what) {
  if (!isP256Point(bytes)) refuse("point", what);
  return u8(bytes);
}

/** True for a private key's 32-byte scalar: 1 or more, and less than the curve's order. */
export function isP256Scalar(bytes) {
  let b;
  try {
    b = u8(bytes);
  } catch {
    return false;
  }
  if (b.length !== SCALAR_BYTES) return false;
  const d = toBig(b);
  return d >= 1n && d < N;
}

function privateJwk({ d, public: pub }) {
  if (!isP256Scalar(d)) refuse("privateKey");
  const p = needPoint(pub, "a private key's public half");
  return {
    kty: "EC",
    crv: "P-256",
    d: toBase64url(d),
    x: toBase64url(p.subarray(1, 33)),
    y: toBase64url(p.subarray(33)),
  };
}

/**
 * A key-agreement private key ready for use. A device's is a non-extractable
 * CryptoKey beside its public key ({ privateKey, public }); a holder's and an
 * HPKE sender's are the scalar beside the public key ({ d, public }), since
 * WebCrypto imports a private key only with both.
 */
async function agreementKey(holder) {
  if (holder?.privateKey) return holder.privateKey;
  try {
    return await subtle().importKey("jwk", privateJwk(holder ?? {}), { name: "ECDH", namedCurve: "P-256" }, false, ["deriveBits"]);
  } catch (e) {
    if (e instanceof Refusal) throw e;
    return refuse("privateKey", "the platform refused it");
  }
}

/** P-256 key agreement: the shared point's x coordinate, 32 bytes. The other side's key is checked first. */
export async function ecdh(holder, theirPublic) {
  const pub = needPoint(theirPublic, "the other side's public key");
  const mine = await agreementKey(holder);
  const theirs = await subtle().importKey("raw", pub, { name: "ECDH", namedCurve: "P-256" }, false, []);
  return new Uint8Array(await subtle().deriveBits({ name: "ECDH", public: theirs }, mine, 256));
}

/**
 * A new key-agreement pair as bytes ({ d, public }): a holder's key pair,
 * whose private half is sealed into its record, and HPKE's one-use sender key.
 */
export async function generateKeyPair() {
  const pair = await subtle().generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
  const jwk = await subtle().exportKey("jwk", pair.privateKey);
  return { d: fromBase64url(jwk.d), public: new Uint8Array(await subtle().exportKey("raw", pair.publicKey)) };
}

/** A device key: the private half a CryptoKey that page code can use and can't read out. */
export async function generateDeviceKey() {
  const pair = await subtle().generateKey({ name: "ECDH", namedCurve: "P-256" }, false, ["deriveBits"]);
  return { privateKey: pair.privateKey, public: new Uint8Array(await subtle().exportKey("raw", pair.publicKey)) };
}

/* ── The signing key (reserved: nothing checks it in version 1) ──────── */

const ECDSA = { name: "ECDSA", namedCurve: "P-256" };
const ECDSA_SHA256 = { name: "ECDSA", hash: "SHA-256" };

/** A device's signing key, made with its device key: P-256, for ECDSA with SHA-256, not extractable. */
export async function generateSigningKey() {
  const pair = await subtle().generateKey(ECDSA, false, ["sign", "verify"]);
  return { privateKey: pair.privateKey, public: new Uint8Array(await subtle().exportKey("raw", pair.publicKey)) };
}

/** A signing key from its bytes ({ d, public }), for tests and for a platform that keeps it wrapped. */
export async function importSigningKey(holder) {
  try {
    return await subtle().importKey("jwk", privateJwk(holder ?? {}), ECDSA, false, ["sign"]);
  } catch (e) {
    if (e instanceof Refusal) throw e;
    return refuse("privateKey", "the platform refused it");
  }
}

/** Signs with a device's signing key: the 64 bytes r ‖ s. ECDSA picks a fresh number each time, so no two are alike. */
export async function signMessage(privateKey, message) {
  return new Uint8Array(await subtle().sign(ECDSA_SHA256, privateKey, u8(message)));
}

/** True when `signature` (64 bytes, r ‖ s) is `publicKey`'s over `message`. Never throws. */
export async function verifySignature(publicKey, message, signature) {
  try {
    const sig = u8(signature);
    if (sig.length !== 64 || !isP256Point(publicKey)) return false;
    const key = await subtle().importKey("raw", u8(publicKey), ECDSA, false, ["verify"]);
    return await subtle().verify(ECDSA_SHA256, key, sig, u8(message));
  } catch {
    return false;
  }
}

function derInteger(bytes) {
  let i = 0;
  while (i < bytes.length - 1 && bytes[i] === 0) i++;
  const body = bytes.subarray(i);
  return body[0] & 0x80 ? concatBytes([2, body.length + 1, 0], body) : concatBytes([2, body.length], body);
}

/** r ‖ s (64 bytes) as the DER form Android's Signature gives. */
export function signatureToDer(signature) {
  const sig = sized(signature, 64, "a signature");
  const body = concatBytes(derInteger(sig.subarray(0, 32)), derInteger(sig.subarray(32)));
  return concatBytes([0x30, body.length], body);
}

/** Strict DER back to r ‖ s. Refused: any other length form, padding that isn't needed, a negative or oversized number, trailing bytes. */
export function signatureFromDer(der) {
  const b = u8(der);
  const bad = (detail) => refuse("der", detail);
  if (b.length < 8 || b[0] !== 0x30 || b[1] !== b.length - 2 || b[1] > 70) bad("the sequence");
  const out = new Uint8Array(64);
  let at = 2;
  for (const part of [0, 1]) {
    if (b[at] !== 2) bad("an integer's tag");
    const len = b[at + 1];
    const body = b.subarray(at + 2, at + 2 + len);
    if (len < 1 || len > 33 || body.length !== len) bad("an integer's length");
    if (body[0] & 0x80) bad("a negative number");
    if (body[0] === 0 && len > 1 && !(body[1] & 0x80)) bad("padding that isn't needed");
    const digits = body[0] === 0 && len > 1 ? body.subarray(1) : body;
    if (digits.length > 32) bad("a number past 32 bytes");
    out.set(digits, part * 32 + 32 - digits.length);
    at += 2 + len;
  }
  if (at !== b.length) bad("trailing bytes");
  return out;
}

/* ── HPKE (RFC 9180), base mode, written by hand ─────────────────────── */

/** DHKEM(P-256, HKDF-SHA256), HKDF-SHA256, AES-256-GCM. */
export const HPKE_SUITE = Object.freeze({ kem: 0x0010, kdf: 0x0001, aead: 0x0002 });

const AEAD_KEY_BYTES = { 1: 16, 2: 32 };
const HPKE_V1 = utf8("HPKE-v1");
const i2osp2 = (n) => Uint8Array.of(n >> 8, n & 0xff);
const KEM_SUITE = concatBytes(utf8("KEM"), i2osp2(HPKE_SUITE.kem));
const hpkeSuiteId = (aead) => concatBytes(utf8("HPKE"), i2osp2(HPKE_SUITE.kem), i2osp2(HPKE_SUITE.kdf), i2osp2(aead));

const labeledExtract = (suite, salt, label, ikm) => hkdfExtract(salt, concatBytes(HPKE_V1, suite, utf8(label), ikm));
const labeledExpand = (suite, prk, label, info, length) =>
  hkdfExpand(prk, concatBytes(i2osp2(length), HPKE_V1, suite, utf8(label), info), length);

// RFC 9180 §4.1 (ExtractAndExpand) and §5.1 (KeySchedule), mode_base: no PSK.
async function hpkeSchedule(aead, dh, enc, recipientPublic, info) {
  if (!AEAD_KEY_BYTES[aead]) refuse("bytes", "an AEAD this code doesn't have");
  const eaePrk = await labeledExtract(KEM_SUITE, EMPTY, "eae_prk", dh);
  const sharedSecret = await labeledExpand(KEM_SUITE, eaePrk, "shared_secret", concatBytes(enc, recipientPublic), 32);
  const suite = hpkeSuiteId(aead);
  const pskIdHash = await labeledExtract(suite, EMPTY, "psk_id_hash", EMPTY);
  const infoHash = await labeledExtract(suite, EMPTY, "info_hash", u8(info));
  const keyScheduleContext = concatBytes([0], pskIdHash, infoHash);
  const secret = await labeledExtract(suite, sharedSecret, "secret", EMPTY);
  return {
    aead,
    sharedSecret,
    keyScheduleContext,
    secret,
    key: await labeledExpand(suite, secret, "key", keyScheduleContext, AEAD_KEY_BYTES[aead]),
    baseNonce: await labeledExpand(suite, secret, "base_nonce", keyScheduleContext, NONCE_BYTES),
    exporterSecret: await labeledExpand(suite, secret, "exp", keyScheduleContext, 32),
  };
}

/**
 * The sender's side of HPKE's setup: `enc` and the key schedule. `ephemeral`
 * is the one-use key pair ({ d, public }); it is random unless a test fixes
 * it. `aead` is 2 (AES-256-GCM) everywhere but in the published vectors.
 */
export async function hpkeSenderContext({ recipientPublic, info, ephemeral, aead = HPKE_SUITE.aead }) {
  const pkR = needPoint(recipientPublic, "HPKE's recipient");
  const e = ephemeral ?? (await generateKeyPair());
  const enc = needPoint(e.public, "HPKE's sender key");
  return { enc, ...(await hpkeSchedule(aead, await ecdh(e, pkR), enc, pkR, info)) };
}

/** The recipient's side: `recipient` is { privateKey, public } or { d, public }, and `enc` is checked to be a point. */
export async function hpkeRecipientContext({ recipient, enc, info, aead = HPKE_SUITE.aead }) {
  const e = needPoint(enc, "HPKE's enc");
  const pkR = needPoint(recipient?.public, "HPKE's recipient");
  return { enc: e, ...(await hpkeSchedule(aead, await ecdh(recipient, e), e, pkR, info)) };
}

/** The nonce for a context's `seq`-th message: the base nonce XOR the number. The notebook only ever uses 0. */
export function hpkeNonce(baseNonce, seq = 0) {
  const nonce = Uint8Array.from(u8(baseNonce));
  let n = BigInt(seq);
  for (let i = nonce.length - 1; i >= 0 && n > 0n; i--, n >>= 8n) nonce[i] ^= Number(n & 0xffn);
  return nonce;
}

export async function hpkeContextSeal(context, seq, aad, plaintext) {
  return gcmSeal(context.key, hpkeNonce(context.baseNonce, seq), aad, plaintext);
}

export async function hpkeContextOpen(context, seq, aad, ciphertext) {
  return gcmOpen(context.key, hpkeNonce(context.baseNonce, seq), aad, ciphertext);
}

/** HPKE's single-shot seal to a public key: { enc, ct }. A fresh sender key each time, unless a test fixes one. */
export async function hpkeSeal({ recipientPublic, info, aad = EMPTY, plaintext, ephemeral }) {
  const context = await hpkeSenderContext({ recipientPublic, info: utf8(info), ephemeral });
  return { enc: context.enc, ct: await hpkeContextSeal(context, 0, aad, plaintext) };
}

/** HPKE's single-shot open. Refused as `point` when `enc` isn't on the curve, as `seal` when it doesn't open. */
export async function hpkeOpen({ recipient, enc, info, aad = EMPTY, ct }) {
  const context = await hpkeRecipientContext({ recipient, enc, info: utf8(info) });
  return hpkeContextOpen(context, 0, aad, ct);
}

/* ── The keys made from a notebook key and from a reader's secrets ───── */

const notebookKeyBytes = (key) => sized(key, KEY_BYTES, "a notebook key");

/** The key that seals every record. */
export const recordKey = (notebookKey) => hkdf(notebookKeyBytes(notebookKey), LABELS.record);
/** The key that seals every device's card and every holder's card. */
export const cardKey = (notebookKey) => hkdf(notebookKeyBytes(notebookKey), LABELS.device);
/** The 32 bytes that show the service a device holds the key. It opens nothing. */
export const keyProof = (notebookKey) => hkdf(notebookKeyBytes(notebookKey), LABELS.proof);
/** What the service stores for the current kid: SHA-256 of the proof. */
export const keyProofHash = (proof) => sha256(sized(proof, KEY_BYTES, "a key proof"));
/** The key that seals the recovery holder's record, from the code's 15 bytes. */
export const codeKey = (code) => hkdf(sized(code, RECOVERY_CODE_BYTES, "a recovery code"), LABELS.recovery);
/** The key that seals a passkey holder's record, from the PRF's 32 bytes. The PRF's output is never a key itself. */
export const passkeyKey = (prfOutput) => hkdf(sized(prfOutput, KEY_BYTES, "a PRF output"), LABELS.passkey);

/* ── The recovery code and the approval code ─────────────────────────── */

const CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

function base32(bytes) {
  let out = "";
  let acc = 0;
  let bits = 0;
  for (const b of bytes) {
    acc = ((acc << 8) | b) & 0xfff;
    bits += 8;
    while (bits >= 5) {
      bits -= 5;
      out += CROCKFORD[(acc >> bits) & 31];
    }
  }
  return out;
}

const grouped = (chars) => chars.match(/.{4}/g).join("-");

/**
 * The characters removed from a typed or pasted code before it is read: the
 * spec's list under "The recovery code," as code point ranges. White space
 * (Unicode's White_Space), the invisible characters a paste can carry, and
 * the hyphen with the dashes a word processor puts in its place. The list is
 * the rule: every client removes exactly these, and nothing else.
 */
const CODE_SEPARATORS = [
  [0x0009, 0x000d], [0x0020, 0x0020], [0x0085, 0x0085], [0x00a0, 0x00a0], [0x1680, 0x1680],
  [0x2000, 0x200a], [0x2028, 0x2029], [0x202f, 0x202f], [0x205f, 0x205f], [0x3000, 0x3000],
  [0x00ad, 0x00ad], [0x200b, 0x200d], [0x2060, 0x2060], [0xfeff, 0xfeff],
  [0x002d, 0x002d], [0x2010, 0x2015], [0x2212, 0x2212], [0xfe58, 0xfe58], [0xfe63, 0xfe63], [0xff0d, 0xff0d],
];

function isCodeSeparator(ch) {
  const cp = ch.codePointAt(0);
  return CODE_SEPARATORS.some(([from, to]) => cp >= from && cp <= to);
}

/**
 * A typed code's characters, read as the spec says: white space, invisible
 * characters, and hyphens and dashes removed (CODE_SEPARATORS), a to z taken
 * as A to Z, O read as 0, I and L as 1. Any other character is refused (U
 * included, and a letter from another alphabet that looks like one of
 * these), and then any other length.
 */
function readCodeCharacters(typed, count) {
  if (typeof typed !== "string") refuse("code");
  let chars = "";
  for (const ch of typed) {
    if (isCodeSeparator(ch)) continue;
    let c = ch >= "a" && ch <= "z" ? ch.toUpperCase() : ch;
    if (c === "O") c = "0";
    else if (c === "I" || c === "L") c = "1";
    if (c.length !== 1 || !CROCKFORD.includes(c)) refuse("code");
    chars += c;
  }
  if (chars.length !== count) refuse("codeLength");
  return chars;
}

function readCode(typed, byteLength) {
  const chars = readCodeCharacters(typed, (byteLength * 8) / 5);
  const out = new Uint8Array(byteLength);
  let acc = 0;
  let bits = 0;
  let at = 0;
  for (const c of chars) {
    acc = ((acc << 5) | CROCKFORD.indexOf(c)) & 0xfff;
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      out[at++] = (acc >> bits) & 0xff;
    }
  }
  return out;
}

/** A recovery code as it is shown: 24 characters of Crockford's base32 in six groups of four. */
export function formatRecoveryCode(code) {
  return grouped(base32(sized(code, RECOVERY_CODE_BYTES, "a recovery code")));
}

/** A typed recovery code back to its 15 bytes. */
export function readRecoveryCode(typed) {
  return readCode(typed, RECOVERY_CODE_BYTES);
}

/**
 * The check after a code is shown: did the reader type its `group`-th group
 * (1 to 6) back? Read by the same rules as a whole code. False, never a
 * refusal, for anything that isn't that group.
 */
export function recoveryGroupMatches(code, group, typed) {
  if (!Number.isInteger(group) || group < 1 || group > 6) return false;
  const chars = base32(sized(code, RECOVERY_CODE_BYTES, "a recovery code"));
  try {
    return readCodeCharacters(typed, 4) === chars.slice(4 * (group - 1), 4 * group);
  } catch {
    return false;
  }
}

/** An approval code as it is shown: 16 characters in four groups of four. A link carries the 16 without hyphens. */
export function formatApprovalCode(code) {
  return grouped(base32(sized(code, APPROVAL_CODE_BYTES, "an approval code")));
}

/** A typed or scanned approval code back to its 10 bytes. */
export function readApprovalCode(typed) {
  return readCode(typed, APPROVAL_CODE_BYTES);
}

/* ── A record on the service ─────────────────────────────────────────── */

/** A record's length once padded: the next multiple of 256 (a multiple of 256 takes none). */
export function paddedLength(length) {
  if (!Number.isInteger(length) || length < 1 || length > MAX_RECORD_BYTES) refuse("recordSize");
  return Math.ceil(length / PAD_BLOCK) * PAD_BLOCK;
}

/** A serialized record padded with spaces (0x20). */
export function padRecord(bytes) {
  const b = u8(bytes);
  const out = new Uint8Array(paddedLength(b.length)).fill(0x20);
  out.set(b);
  return out;
}

const hasDeletedAt = (row) => row.deletedAt !== undefined && row.deletedAt !== null;

/** A row's AAD: lines `lit-row/1`, kid, id, modified, and deletedAt (an empty line on a row that has none). */
export function rowAad({ kid, id, modified, deletedAt }) {
  return lines(LABELS.row, kidText(kid), id, modified, deletedAt ?? "");
}

const TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.(\d+))?Z$/;

/**
 * True when two of the format's times are the same instant: the same bytes,
 * or both in the format's form (UTC, with Z), alike to the second, with the
 * same fraction once trailing zeros are dropped. Fractions are compared in
 * full, to any number of digits, so no client's clock resolution decides it.
 */
export function sameInstant(a, b) {
  if (typeof a !== "string" || typeof b !== "string") return false;
  if (a === b) return true;
  const x = TIME.exec(a);
  const y = TIME.exec(b);
  if (!x || !y || a.slice(0, 19) !== b.slice(0, 19)) return false;
  return (x[1] ?? "").replace(/0+$/, "") === (y[1] ?? "").replace(/0+$/, "");
}

const isObject = (v) => typeof v === "object" && v !== null && !Array.isArray(v);

function parseObject(text) {
  let value;
  try {
    value = JSON.parse(text);
  } catch {
    return refuse("json");
  }
  return isObject(value) ? value : refuse("json", "not an object");
}

/** The plain fields a record's row carries: id, modified, and, on a trash record only, deletedAt. */
function plainFields(record) {
  if (!isObject(record)) refuse("json", "a record is a JSON object");
  const plain = { id: record.id, modified: record.modified };
  if (record.kind === "trash") plain.deletedAt = record.deletedAt;
  for (const v of Object.values(plain)) if (typeof v !== "string") refuse("lineFeed", "a plain field is text");
  return plain;
}

/**
 * Seals a record for the service: the row without `rev`, which the service
 * adds. `text` is the record as this client serializes it (JSON); when it is
 * left out the website's own form is used, JSON.stringify(record). The bytes
 * sealed are `text`'s, so another client's key order or spacing is its own.
 */
export async function sealRecord({ record, text, notebookKey, kid, nonce = randomBytes(NONCE_BYTES) }) {
  const json = text ?? JSON.stringify(record);
  if (typeof json !== "string") refuse("json", "a record's text");
  const plain = plainFields(record ?? parseObject(json));
  const row = { v: 1, ...plain, kid };
  const aad = rowAad(row);
  const ct = await aesGcmSeal(await recordKey(notebookKey), nonce, aad, padRecord(utf8(json)));
  return { ...row, nonce: toBase64url(nonce), ct: toBase64url(ct) };
}

/**
 * Opens a row with a keyring: { record, text }. The spec's steps 1 to 3; the
 * format's own checks (validateRecord) are the caller's step 4. `version`
 * and `missingKey` mean "keep the row aside and fetch the keyring." Any
 * other refusal means "skip it, keep the device's copy, and report it."
 */
export async function openRow({ row, keyring }) {
  if (!isObject(row)) refuse("row");
  if (row.v !== 1) refuse("version");
  if (!Number.isSafeInteger(row.kid) || row.kid < 1) refuse("row", "kid");
  const key = keyOf(keyring, row.kid);
  if (!key) refuse("missingKey");
  if (typeof row.id !== "string" || typeof row.modified !== "string") refuse("row", "id or modified");
  if (hasDeletedAt(row) && typeof row.deletedAt !== "string") refuse("row", "deletedAt");
  let nonce;
  let ct;
  try {
    nonce = sized(fromBase64url(row.nonce), NONCE_BYTES, "a nonce");
    ct = fromBase64url(row.ct);
  } catch {
    return refuse("row", "nonce or ct");
  }
  const padded = ct.length - TAG_BYTES;
  if (padded < PAD_BLOCK || padded % PAD_BLOCK || padded > MAX_RECORD_BYTES) refuse("length");
  const plaintext = await aesGcmOpen(await recordKey(key), nonce, rowAad(row), ct);
  let end = plaintext.length;
  while (end > 0 && plaintext[end - 1] === 0x20) end--;
  const text = fromUtf8(plaintext.subarray(0, end));
  const record = parseObject(text);
  const trash = record.kind === "trash";
  const agrees =
    record.id === row.id &&
    sameInstant(record.modified, row.modified) &&
    (trash ? hasDeletedAt(row) && sameInstant(record.deletedAt, row.deletedAt) : !hasDeletedAt(row));
  if (!agrees) refuse("fields");
  return { record, text };
}

/* ── The keyring ─────────────────────────────────────────────────────── */

/**
 * A keyring in memory: { notebook, current, keys: [{ kid, key }] }, newest
 * key first, the keys as bytes. It holds every key the notebook has had.
 */
function keyring(notebook, keys) {
  const sorted = keys
    .map(({ kid, key }) => ({ kid, key: Uint8Array.from(notebookKeyBytes(key)) }))
    .sort((a, b) => b.kid - a.kid);
  return { notebook, current: sorted[0].kid, keys: sorted };
}

/** A notebook's first keyring: its id and the key with kid 1. */
export function firstKeyring(notebook, key) {
  return keyring(needUuid(notebook, "a notebook's id"), [{ kid: 1, key }]);
}

/** The keyring after a change of key: every older key, and the new one as `current`. */
export function nextKeyring(held, key) {
  return keyring(held.notebook, [...held.keys, { kid: held.current + 1, key }]);
}

/** The notebook key with this kid, or null. */
export function keyOf(held, kid) {
  return held?.keys?.find((k) => k.kid === kid)?.key ?? null;
}

/** A keyring as it is sealed: JSON in UTF-8, the keys in base64url. */
export function keyringText(held) {
  return JSON.stringify({
    lit: "keyring",
    v: 1,
    notebook: held.notebook,
    current: held.current,
    keys: held.keys.map(({ kid, key }) => ({ kid, key: toBase64url(key) })),
  });
}

/**
 * Reads a keyring (text or bytes) and applies its own checks. Refused: a
 * `lit` or `v` this client doesn't know (`version`), kids that aren't
 * exactly 1 to `current`, each once (`kids`), and a key that isn't 32 bytes
 * (`keySize`). The order the keys come in doesn't matter.
 */
export function parseKeyring(input) {
  const raw = parseObject(typeof input === "string" ? input : fromUtf8(input));
  if (raw.lit !== "keyring" || raw.v !== 1) refuse("version");
  if (typeof raw.notebook !== "string" || !raw.notebook || raw.notebook.includes("\n")) refuse("json", "notebook");
  if (!Number.isSafeInteger(raw.current) || raw.current < 1 || !Array.isArray(raw.keys)) refuse("kids");
  if (raw.keys.length !== raw.current) refuse("kids");
  const seen = new Set();
  const keys = raw.keys.map((entry) => {
    const kid = entry?.kid;
    if (!Number.isSafeInteger(kid) || kid < 1 || kid > raw.current || seen.has(kid)) refuse("kids");
    seen.add(kid);
    let key;
    try {
      key = fromBase64url(entry.key);
    } catch {
      return refuse("keySize");
    }
    if (key.length !== KEY_BYTES) refuse("keySize");
    return { kid, key };
  });
  return keyring(raw.notebook, keys);
}

/**
 * The checks a keyring taken from the service must pass on a device that
 * already holds one (`held`; `highest` is the highest `current` the device
 * has accepted, which is `held.current` unless the caller keeps it apart):
 * the same notebook; no lower than the highest accepted; and every key the
 * device holds, each kid with the same bytes. A keyring that goes backward
 * also lacks the newer keys, and is reported as `backward`.
 */
export function checkKeyring({ held, highest = held.current, incoming }) {
  if (incoming.notebook !== held.notebook) refuse("notebook");
  if (incoming.current < highest) refuse("backward");
  for (const { kid, key } of held.keys) {
    const theirs = keyOf(incoming, kid);
    if (!theirs || !bytesEqual(theirs, key)) refuse("keyChanged");
  }
  return incoming;
}

/** Seals a keyring to a device's or a holder's public key: HPKE, `info` "lit-notebook/1 keyring", an empty AAD. */
export async function sealKeyring({ keyring: held, recipientPublic, ephemeral }) {
  return hpkeSeal({ recipientPublic, info: LABELS.keyring, plaintext: utf8(keyringText(held)), ephemeral });
}

/** Opens a sealed keyring and applies the keyring's own checks. Trusting it is the caller's: checkKeyring, an approval, or a holder's anchor. */
export async function openKeyring({ recipient, enc, ct }) {
  return parseKeyring(await hpkeOpen({ recipient, enc, info: LABELS.keyring, ct }));
}

/* ── Device cards and holder cards ───────────────────────────────────── */

function pointField(value) {
  try {
    const bytes = fromBase64url(value);
    return isP256Point(bytes) ? bytes : null;
  } catch {
    return null;
  }
}

const textFields = (card, names) => {
  for (const n of names) if (typeof card[n] !== "string") refuse("card", n);
};

/**
 * A device's card as a client writes it. Refused without a valid point in
 * both `public` and `sign`: nothing checks `sign` in version 1, and a client
 * still never writes a card without one. Fields this version doesn't know
 * are kept.
 */
export function deviceCard({ public: pub, sign, name, platform, added, ...more }) {
  const card = {
    public: toBase64url(needPoint(pub, "a card's public key")),
    sign: toBase64url(needPoint(sign, "a card's signing key")),
    name,
    platform,
    added,
    ...more,
  };
  textFields(card, ["name", "platform", "added"]);
  return card;
}

/** A holder's card as a client writes it. `credential` (the passkey's credential id) is there for a passkey holder only. */
export function holderCard({ public: pub, kind, credential, name, added, ...more }) {
  if (kind !== "recovery" && kind !== "passkey") refuse("card", "kind");
  if ((kind === "passkey") !== (credential !== undefined)) refuse("card", "credential");
  const card = {
    public: toBase64url(needPoint(pub, "a card's public key")),
    kind,
    ...(kind === "passkey" ? { credential: toBase64url(credential) } : {}),
    name,
    added,
    ...more,
  };
  textFields(card, ["name", "added"]);
  return card;
}

const deviceCardAad = ({ notebook, kid, deviceId }) => lines(LABELS.deviceCard, notebook, kidText(kid), deviceId);
const holderCardAad = ({ notebook, kid, holderId }) => lines(LABELS.holderCard, notebook, kidText(kid), holderId);

async function sealCardText(aad, { notebookKey, card, text, nonce }) {
  const json = text ?? JSON.stringify(card);
  if (typeof json !== "string") refuse("card");
  return { nonce: Uint8Array.from(nonce), ct: await aesGcmSeal(await cardKey(notebookKey), nonce, aad, utf8(json)) };
}

async function openCardText(aad, { notebookKey, nonce, ct }) {
  const text = fromUtf8(await aesGcmOpen(await cardKey(notebookKey), sized(nonce, NONCE_BYTES, "a nonce"), aad, ct));
  const card = parseObject(text);
  const pub = pointField(card.public);
  if (!pub) refuse("point", "a card's public key");
  return { card, text, public: pub };
}

/**
 * Seals a device's card under the card key of the notebook key `kid`:
 * { nonce, ct }. `text` is the card's JSON as this client writes it, else
 * JSON.stringify(card).
 */
export async function sealDeviceCard({ notebookKey, kid, notebook, deviceId, card, text, nonce = randomBytes(NONCE_BYTES) }) {
  return sealCardText(deviceCardAad({ notebook, kid, deviceId }), { notebookKey, card, text, nonce });
}

/**
 * Opens a device's card: { card, text, public, sign }. It opens only under
 * the notebook, kid, and device id it was sealed for. `public` is checked to
 * be a point; `sign` is its bytes, or null when it isn't one, which refuses
 * nothing in version 1.
 */
export async function openDeviceCard({ notebookKey, kid, notebook, deviceId, nonce, ct }) {
  const opened = await openCardText(deviceCardAad({ notebook, kid, deviceId }), { notebookKey, nonce, ct });
  return { ...opened, sign: pointField(opened.card.sign) };
}

export async function sealHolderCard({ notebookKey, kid, notebook, holderId, card, text, nonce = randomBytes(NONCE_BYTES) }) {
  return sealCardText(holderCardAad({ notebook, kid, holderId }), { notebookKey, card, text, nonce });
}

export async function openHolderCard({ notebookKey, kid, notebook, holderId, nonce, ct }) {
  return openCardText(holderCardAad({ notebook, kid, holderId }), { notebookKey, nonce, ct });
}

/**
 * Seals a card again under a new key, at a change of key. The card's own
 * bytes are sealed again untouched, which is how every field in it is kept,
 * the ones this version doesn't know included. `from` and `to` are each
 * { notebookKey, kid }.
 */
export async function resealDeviceCard({ from, to, notebook, deviceId, nonce, ct, newNonce = randomBytes(NONCE_BYTES) }) {
  const { text } = await openDeviceCard({ ...from, notebook, deviceId, nonce, ct });
  return sealDeviceCard({ ...to, notebook, deviceId, text, nonce: newNonce });
}

export async function resealHolderCard({ from, to, notebook, holderId, nonce, ct, newNonce = randomBytes(NONCE_BYTES) }) {
  const { text } = await openHolderCard({ ...from, notebook, holderId, nonce, ct });
  return sealHolderCard({ ...to, notebook, holderId, text, nonce: newNonce });
}

/* ── Holders: the recovery code's and a passkey's ────────────────────── */

/** What a passkey's PRF is evaluated at: the 18 ASCII bytes of this, as the extension's first value. Never taken from the service. */
export const PRF_INPUT = LABELS.prf;

/**
 * The fixed PRF input in each form a client meets it: its bytes; its
 * base64url, as a request's JSON carries it (Android's Credential Manager);
 * and the 32 bytes the platform sends the passkey, SHA-256 of
 * "WebAuthn PRF", a zero byte, and the input.
 */
export async function prfInput() {
  const bytes = utf8(PRF_INPUT);
  return {
    bytes,
    base64url: toBase64url(bytes),
    hashed: await sha256(concatBytes(utf8("WebAuthn PRF"), [0], bytes)),
  };
}

/**
 * A passkey response as it may be sent to the service: a copy without
 * `clientExtensionResults.prf.results`, which is the passkey's secret.
 * Everything else, `prf.enabled` included, stays.
 */
export function stripPrfResults(response) {
  const copy = JSON.parse(JSON.stringify(response));
  const prf = copy?.clientExtensionResults?.prf;
  if (isObject(prf)) delete prf.results;
  return copy;
}

/**
 * A holder's record as a client writes it: the holder's private key, its
 * public key, and the anchor (the notebook key current when the holder was
 * made). `credential` is a passkey holder's passkey; a recovery holder has none.
 */
export function holderRecord({ notebook, kind, id, credential, d, public: pub, anchor }) {
  if (kind !== "recovery" && kind !== "passkey") refuse("record", "kind");
  if ((kind === "passkey") !== (credential !== undefined)) refuse("record", "credential");
  if (!isP256Scalar(d)) refuse("privateKey");
  return {
    lit: "holder",
    v: 1,
    notebook: needUuid(notebook, "a notebook's id"),
    kind,
    id: needUuid(id, "a holder's id"),
    ...(kind === "passkey" ? { credential: toBase64url(credential) } : {}),
    d: toBase64url(d),
    public: toBase64url(needPoint(pub, "a holder's public key")),
    anchor: { kid: Number(kidText(anchor?.kid)), key: toBase64url(notebookKeyBytes(anchor.key)) },
  };
}

const holderAad = (kind, id) => lines(LABELS.holder, kind, id);

/**
 * Seals a holder's record under the code key or the passkey key: { nonce,
 * ct }. The AAD is made from the record's own kind and id.
 */
export async function sealHolderRecord({ secretKey, record, text, nonce = randomBytes(NONCE_BYTES) }) {
  const json = text ?? JSON.stringify(record);
  const fields = record ?? parseObject(json);
  const key = sized(secretKey, KEY_BYTES, "a holder's secret key");
  return { nonce: Uint8Array.from(nonce), ct: await aesGcmSeal(key, nonce, holderAad(fields.kind, fields.id), utf8(json)) };
}

function readHolderRecord(text, { kind, id, notebook, credential }) {
  const record = parseObject(text);
  if (record.lit !== "holder" || record.v !== 1 || record.kind !== kind || record.id !== id) refuse("record");
  if (record.notebook !== notebook) refuse("notebook");
  if (kind === "passkey") {
    let theirs;
    try {
      theirs = fromBase64url(record.credential);
    } catch {
      return refuse("record", "credential");
    }
    if (!bytesEqual(theirs, credential)) refuse("credential");
  }
  let d;
  let anchorKey;
  try {
    d = fromBase64url(record.d);
    anchorKey = fromBase64url(record.anchor?.key);
  } catch {
    return refuse("record", "its keys");
  }
  const pub = pointField(record.public);
  const anchorKid = record.anchor?.kid;
  if (!isP256Scalar(d) || !pub || anchorKey.length !== KEY_BYTES || !Number.isSafeInteger(anchorKid) || anchorKid < 1) {
    refuse("record", "its keys");
  }
  return { record, key: { d, public: pub }, anchor: { kid: anchorKid, key: anchorKey } };
}

/**
 * Coming in through a holder: the four checks, in order, stopping at the
 * first that fails (the Refusal's `check` says which).
 *
 * 1. The record opens under the key made from the secret, with the AAD made
 *    from the kind and id the service gave (`seal`: the code is wrong, or
 *    this passkey doesn't open this notebook).
 * 2. The record is what it should be (`record`), for the account's notebook
 *    (`notebook`) and, for a passkey, the passkey that answered (`credential`).
 * 3. The keyring sealed to the holder opens with the record's private key
 *    and passes the keyring's own checks.
 * 4. The keyring names the record's notebook (`notebook`) and holds the
 *    anchor's key, the same kid with the same bytes (`anchor`).
 *
 * `secretKey` is codeKey(code) or passkeyKey(prf). `sealed` is the record's
 * { nonce, ct }; `keyring` is the { enc, ct } sealed to the holder.
 * `credential` is the id of the passkey that just answered, as bytes.
 * Returns { record, key, keyring }: `key` is the holder's own key pair.
 */
export async function openHolder({ secretKey, kind, id, notebook, credential, sealed, keyring: sealedKeyring }) {
  const text = await atCheck(1, async () => {
    const key = sized(secretKey, KEY_BYTES, "a holder's secret key");
    return fromUtf8(await aesGcmOpen(key, sized(sealed.nonce, NONCE_BYTES, "a nonce"), holderAad(kind, id), sealed.ct));
  });
  const holder = await atCheck(2, () => readHolderRecord(text, { kind, id, notebook, credential }));
  const opened = await atCheck(3, () => openKeyring({ recipient: holder.key, enc: sealedKeyring.enc, ct: sealedKeyring.ct }));
  await atCheck(4, () => {
    if (opened.notebook !== holder.record.notebook) refuse("notebook");
    const theirs = keyOf(opened, holder.anchor.kid);
    if (!theirs || !bytesEqual(theirs, holder.anchor.key)) refuse("anchor");
  });
  return { record: holder.record, key: holder.key, keyring: opened };
}

/* ── Adding a device by approval ─────────────────────────────────────── */

/**
 * What both devices make from an approval code's 10 bytes: the approval's
 * id (32 lowercase hex characters, which the service sees) and its MAC key
 * (which it never does).
 */
export async function approvalKeys(code) {
  const c = sized(code, APPROVAL_CODE_BYTES, "an approval code");
  return { id: toHex(await hkdf(c, LABELS.approveId, 16)), macKey: await hkdf(c, LABELS.approveMac) };
}

const requestLines = ({ id, deviceId, platform, model, public: pub, sign }) =>
  lines(LABELS.approveRequest, id, deviceId, platform, model, toBase64url(pub), toBase64url(sign));

const grantLines = ({ id, kid, enc, ct }) => lines(LABELS.approveGrant, id, kidText(kid), toBase64url(enc), toBase64url(ct));

/** The new device's MAC over its request: the approval id, its device id, platform, model, and both public keys. */
export async function approvalRequestMac({ macKey, id, deviceId, platform, model, public: pub, sign }) {
  needPoint(pub, "a request's device key");
  needPoint(sign, "a request's signing key");
  return hmac(sized(macKey, KEY_BYTES, "a MAC key"), requestLines({ id, deviceId, platform, model, public: pub, sign }));
}

/** The approving device's check of a request: its MAC, in constant time, and that both keys are points. */
export async function checkApprovalRequest({ macKey, id, request }) {
  const input = requestLines({ id, ...request });
  if (!(await hmacVerify(sized(macKey, KEY_BYTES, "a MAC key"), input, request.mac))) refuse("mac");
  needPoint(request.public, "a request's device key");
  needPoint(request.sign, "a request's signing key");
  return request;
}

/** The approving device's MAC over its grant: the approval id, the kid, HPKE's enc, and the ciphertext. */
export async function approvalGrantMac({ macKey, id, kid, enc, ct }) {
  return hmac(sized(macKey, KEY_BYTES, "a MAC key"), grantLines({ id, kid, enc, ct }));
}

/**
 * The approving device's grant, once the reader has said yes: its keyring
 * sealed to the new device's key, the new device's card (the model as its
 * name, both public keys from the request), and the MAC. The request is
 * checked again first. Returns { kid, card: { nonce, ct }, enc, ct, mac }.
 */
export async function makeGrant({ macKey, id, request, keyring: held, added, cardNonce = randomBytes(NONCE_BYTES), ephemeral }) {
  await checkApprovalRequest({ macKey, id, request });
  const kid = held.current;
  const { enc, ct } = await sealKeyring({ keyring: held, recipientPublic: request.public, ephemeral });
  const card = await sealDeviceCard({
    notebookKey: keyOf(held, kid),
    kid,
    notebook: held.notebook,
    deviceId: request.deviceId,
    card: deviceCard({ public: request.public, sign: request.sign, name: request.model, platform: request.platform, added }),
    nonce: cardNonce,
  });
  return { kid, card, enc, ct, mac: await approvalGrantMac({ macKey, id, kid, enc, ct }) };
}

/**
 * The new device's checks of a grant, in order: its MAC (`mac`); the
 * keyring opens and passes its own checks; its `current` is the grant's kid
 * (`grantKid`); and the card opens under that key for this device's id and
 * names both of its public keys (`card`). `device` is { id, key, sign }:
 * `key` the device key ({ privateKey, public } or { d, public }), `sign`
 * the signing key's public half. Returns { keyring, card }.
 */
export async function acceptGrant({ macKey, id, grant, device }) {
  const input = grantLines({ id, kid: grant.kid, enc: grant.enc, ct: grant.ct });
  if (!(await hmacVerify(sized(macKey, KEY_BYTES, "a MAC key"), input, grant.mac))) refuse("mac");
  const held = await openKeyring({ recipient: device.key, enc: grant.enc, ct: grant.ct });
  if (held.current !== grant.kid) refuse("grantKid");
  let opened;
  try {
    opened = await openDeviceCard({
      notebookKey: keyOf(held, held.current),
      kid: held.current,
      notebook: held.notebook,
      deviceId: device.id,
      nonce: grant.card.nonce,
      ct: grant.card.ct,
    });
  } catch {
    return refuse("card", "it doesn't open for this device");
  }
  if (!bytesEqual(opened.public, device.key.public) || !opened.sign || !bytesEqual(opened.sign, device.sign)) {
    refuse("card", "not this device's keys");
  }
  return { keyring: held, card: opened.card };
}
