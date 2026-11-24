// What a value in a request must look like. The service opens nothing, so
// these are checks of form and size alone: an id's shape, a byte string's
// spelling and length, a time's form.
//
// The limits here are the interface's "sizes"; each is written into
// STUDY-DESK-ENCRYPTION.md, "The service's interface," so change the two
// together.

import { bad } from "./http.js";

export const LIMITS = Object.freeze({
  nonceBytes: 12,
  pointBytes: 65, // a P-256 public key, and HPKE's enc
  proofBytes: 32, // a key proof, its hash, and an approval's MACs
  tagBytes: 16,
  cardBytes: 4096, // a sealed card's ciphertext, tag included
  holderRecordBytes: 4096, // a sealed holder record's ciphertext
  keyringBytes: 65536, // a sealed keyring's ciphertext: about a thousand keys
  credentialBytes: 1023, // WebAuthn's ceiling for a credential id
  padBlock: 256,
  maxRecordBytes: 1_048_576, // the format's MAX_RECORD_BYTES
  idChars: 64, // a record's id
  timeChars: 64,
  modelChars: 64,
  platformChars: 16,
  devices: 100,
  holders: 20,
  approvals: 3, // in progress at once, for one account
  rowsPerRequest: 500,
  pageRows: 500,
  pageChars: 4 * 1024 * 1024, // ciphertext in one page of rows, as text
  // Sign-in (step 4e). Each is a ceiling well above what a platform sends.
  ways: 20, // ways in to one account
  challengeBytes: 32,
  userHandleBytes: 64, // WebAuthn's ceiling for a user handle; the service makes 32
  clientDataBytes: 4096, // a passkey response's clientDataJSON
  attestationBytes: 16384, // its attestationObject
  authenticatorDataBytes: 1024, // its authenticatorData, when signing in
  signatureBytes: 1024, // its signature
  idTokenChars: 8192, // an identity token from Apple or Google
  codeChars: 1024, // Apple's authorization code
  redirectChars: 2048, // the redirect address a web sign-in with Apple used
  subjectChars: 255, // a provider's id for an account
});

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const BASE64URL = /^[A-Za-z0-9_-]*$/;
const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
const TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/;
const RECORD_ID = /^[\x20-\x7e]{1,64}$/;
const APPROVAL_ID = /^[0-9a-f]{32}$/;
// No C0 or C1 control character, so no line feed: a model is one of an approval's "lines".
const NO_CONTROLS = /^[^\u0000-\u001f\u007f-\u009f]+$/;

export const isObject = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
export const isUuid = (v) => typeof v === "string" && UUID.test(v);
export const isApprovalId = (v) => typeof v === "string" && APPROVAL_ID.test(v);
export const isRecordId = (v) => typeof v === "string" && RECORD_ID.test(v);
export const isTime = (v) => typeof v === "string" && v.length <= LIMITS.timeChars && TIME.test(v);
/** A whole number from `min` up, as JSON carries one. */
export const isCount = (v, min = 0) => Number.isSafeInteger(v) && v >= min;

/**
 * How many bytes a base64url text spells, or -1 if it isn't the one strict
 * spelling the spec allows: no padding, no `+` or `/`, a possible length, and
 * no leftover bits that aren't zero. Read from the text alone, so a megabyte
 * of ciphertext is never decoded just to be measured.
 */
export function base64urlBytes(text) {
  if (typeof text !== "string" || !BASE64URL.test(text)) return -1;
  const rest = text.length % 4;
  if (rest === 1) return -1;
  if (rest) {
    const last = ALPHABET.indexOf(text[text.length - 1]);
    if (last & (rest === 2 ? 0b1111 : 0b11)) return -1;
  }
  return Math.floor((text.length * 3) / 4);
}

/** Decodes a short base64url text that has already passed base64urlBytes(). */
export function fromBase64url(text) {
  const binary = atob(text.replace(/-/g, "+").replace(/_/g, "/"));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export function toBase64url(bytes) {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/* ── Fields of a request: each returns the value, or refuses naming `field` ── */

export function needObject(value, field) {
  return isObject(value) ? value : bad(field);
}

export function needArray(value, field) {
  return Array.isArray(value) ? value : bad(field);
}

export function needUuid(value, field) {
  return isUuid(value) ? value : bad(field);
}

export function needCount(value, field, min = 0) {
  return isCount(value, min) ? value : bad(field);
}

/** A byte string of exactly `bytes` bytes. */
export function needBytes(value, field, bytes) {
  return base64urlBytes(value) === bytes ? value : bad(field);
}

/** A byte string of `min` to `max` bytes. */
export function needBytesWithin(value, field, min, max) {
  const n = base64urlBytes(value);
  return n >= min && n <= max ? value : bad(field);
}

/** Text of 1 to `max` characters with no control character in it. */
export function needText(value, field, max) {
  return typeof value === "string" && value.length <= max && NO_CONTROLS.test(value) ? value : bad(field);
}

/** A sealed card: { nonce, ct }. Its kid is the request's. */
export function needCard(value, field) {
  const card = needObject(value, field);
  return {
    nonce: needBytes(card.nonce, `${field}.nonce`, LIMITS.nonceBytes),
    ct: needBytesWithin(card.ct, `${field}.ct`, LIMITS.tagBytes + 1, LIMITS.cardBytes),
  };
}

/** A sealed holder record: { nonce, ct }. */
export function needHolderRecord(value, field) {
  const record = needObject(value, field);
  return {
    nonce: needBytes(record.nonce, `${field}.nonce`, LIMITS.nonceBytes),
    ct: needBytesWithin(record.ct, `${field}.ct`, LIMITS.tagBytes + 1, LIMITS.holderRecordBytes),
  };
}

/** A sealed keyring: HPKE's { enc, ct }. Its kid is the request's. */
export function needKeyring(value, field) {
  const keyring = needObject(value, field);
  return {
    enc: needBytes(keyring.enc, `${field}.enc`, LIMITS.pointBytes),
    ct: needBytesWithin(keyring.ct, `${field}.ct`, LIMITS.tagBytes + 1, LIMITS.keyringBytes),
  };
}

/** A device's entry in a request: { id, card, keyring }. */
export function needDeviceEntry(value, field) {
  const device = needObject(value, field);
  return {
    id: needUuid(device.id, `${field}.id`),
    card: needCard(device.card, `${field}.card`),
    keyring: needKeyring(device.keyring, `${field}.keyring`),
  };
}

/** A kept holder in a change of key: { id, card, keyring }. */
export const needKeptHolder = needDeviceEntry;

/** A holder in full: { id, kind, credential?, record, card, keyring }. */
export function needHolder(value, field) {
  const holder = needObject(value, field);
  const kind = holder.kind === "recovery" || holder.kind === "passkey" ? holder.kind : bad(`${field}.kind`);
  const passkey = kind === "passkey";
  if (!passkey && holder.credential !== undefined && holder.credential !== null) bad(`${field}.credential`);
  return {
    id: needUuid(holder.id, `${field}.id`),
    kind,
    credential: passkey
      ? needBytesWithin(holder.credential, `${field}.credential`, 1, LIMITS.credentialBytes)
      : null,
    record: needHolderRecord(holder.record, `${field}.record`),
    card: needCard(holder.card, `${field}.card`),
    keyring: needKeyring(holder.keyring, `${field}.keyring`),
  };
}

/** Refuses a request in which one id appears twice: `field` says which ids were compared. */
export function needDistinct(ids, field) {
  if (new Set(ids).size !== ids.length) bad(field);
}
