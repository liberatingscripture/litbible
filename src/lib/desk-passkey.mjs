// src/lib/desk-passkey.mjs
//
// A passkey's two ceremonies, between the forms the notebook service speaks
// (the standard's JSON, every byte string base64url) and the ones a browser
// does (ArrayBuffers in, a PublicKeyCredential out). STUDY-DESK-ENCRYPTION.md,
// "The passkey" and "Signing in," are the rules.
//
// It imports nothing and holds no key, so a page that only signs in (the
// account's basics on a phone) can use it without the encryption code.
//
// THE ONE RULE A WRONG EDIT MAKES UNSAFE: the PRF's output is the secret a
// passkey holder is sealed under, and it never leaves the device. So the
// answer for the service is built here member by member, and
// `clientExtensionResults.prf.results` is never copied into it. The output
// is handed to the caller apart, as bytes, to use and drop. (The service
// refuses a response that carries it, so a slip fails in testing.)
//
// `publicKey` in is exactly what the service's options answered. The PRF
// input is the caller's (the fixed one, from desk-crypto.mjs) and is never
// taken from the service.

/* ── Bytes ──────────────────────────────────────────────────────────────── */

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

/** Bytes (a Uint8Array, an ArrayBuffer, or a view) as base64url without padding. */
export function toBase64url(bytes) {
  const b = bytes instanceof Uint8Array ? bytes : bytes instanceof ArrayBuffer ? new Uint8Array(bytes) : new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let out = "";
  for (let i = 0; i < b.length; i += 3) {
    const n = (b[i] << 16) | ((b[i + 1] ?? 0) << 8) | (b[i + 2] ?? 0);
    out += ALPHABET[n >> 18] + ALPHABET[(n >> 12) & 63];
    if (i + 1 < b.length) out += ALPHABET[(n >> 6) & 63];
    if (i + 2 < b.length) out += ALPHABET[n & 63];
  }
  return out;
}

/** Base64url text as bytes. Throws on anything that isn't. */
export function fromBase64url(text) {
  if (typeof text !== "string" || /[^A-Za-z0-9_-]/.test(text) || text.length % 4 === 1) throw new TypeError("not base64url");
  const out = new Uint8Array(Math.floor((text.length * 3) / 4));
  let at = 0;
  for (let i = 0; i < text.length; i += 4) {
    const n =
      (ALPHABET.indexOf(text[i]) << 18) |
      (ALPHABET.indexOf(text[i + 1]) << 12) |
      ((i + 2 < text.length ? ALPHABET.indexOf(text[i + 2]) : 0) << 6) |
      (i + 3 < text.length ? ALPHABET.indexOf(text[i + 3]) : 0);
    out[at++] = n >> 16;
    if (i + 2 < text.length) out[at++] = (n >> 8) & 255;
    if (i + 3 < text.length) out[at++] = n & 255;
  }
  return out;
}

const isBytes = (value) => value instanceof ArrayBuffer || ArrayBuffer.isView(value);
const asBytes = (value) => (value instanceof ArrayBuffer ? new Uint8Array(value) : new Uint8Array(value.buffer, value.byteOffset, value.byteLength));

/* ── Why a ceremony stopped ─────────────────────────────────────────────── */

/**
 * A ceremony that ended without a passkey's answer. `why` is one of:
 *   "canceled"     the reader closed the prompt, or it timed out (the two
 *                  can't be told apart, by the standard's design)
 *   "exists"       this password manager already has a passkey for the
 *                  account (making one only)
 *   "unsupported"  this browser can't do it here
 *   "failed"       anything else
 */
export class PasskeyStopped extends Error {
  constructor(why, cause) {
    super(`passkey: ${why}`);
    this.name = "PasskeyStopped";
    this.why = why;
    if (cause) this.cause = cause;
  }
}

function stopped(error, making) {
  const name = error?.name;
  if (name === "NotAllowedError" || name === "AbortError") return new PasskeyStopped("canceled", error);
  if (name === "InvalidStateError" && making) return new PasskeyStopped("exists", error);
  if (name === "NotSupportedError" || name === "SecurityError") return new PasskeyStopped("unsupported", error);
  return new PasskeyStopped("failed", error);
}

/** True where this window can make and use a passkey at all. */
export function passkeysHere(win = globalThis) {
  return typeof win.PublicKeyCredential === "function" && typeof win.navigator?.credentials?.create === "function";
}

/* ── Options: the service's JSON to a browser's ─────────────────────────── */

const prfExtension = (prfInput) => (prfInput ? { prf: { eval: { first: Uint8Array.from(prfInput) } } } : {});

const descriptors = (list) =>
  (list ?? []).map((entry) => ({ ...entry, id: fromBase64url(entry.id) }));

/**
 * What `navigator.credentials.create` takes, from the service's creation
 * options. The PRF is asked for when `prfInput` is given.
 */
export function creationOptions(publicKey, { prfInput } = {}) {
  return {
    ...publicKey,
    challenge: fromBase64url(publicKey.challenge),
    user: { ...publicKey.user, id: fromBase64url(publicKey.user.id) },
    excludeCredentials: descriptors(publicKey.excludeCredentials),
    extensions: { ...(publicKey.extensions ?? {}), ...prfExtension(prfInput) },
  };
}

/**
 * What `navigator.credentials.get` takes, from the service's request
 * options. `allow` is credential ids (bytes) to name, when the page wants
 * one of particular passkeys (the ones that hold the key); the service's
 * sign-in options name none.
 */
export function requestOptions(publicKey, { prfInput, allow } = {}) {
  const options = {
    ...publicKey,
    challenge: fromBase64url(publicKey.challenge),
    extensions: { ...(publicKey.extensions ?? {}), ...prfExtension(prfInput) },
  };
  if (publicKey.allowCredentials) options.allowCredentials = descriptors(publicKey.allowCredentials);
  if (allow?.length) options.allowCredentials = allow.map((id) => ({ type: "public-key", id: Uint8Array.from(id) }));
  return options;
}

/* ── Answers: a browser's credential to the service's JSON ──────────────── */

/**
 * The extension results as JSON, every byte string base64url, WITHOUT the
 * PRF's results. Everything else the platform said stays, `prf.enabled`
 * included.
 */
function extensionResults(results) {
  const plain = (value) => {
    if (isBytes(value)) return toBase64url(asBytes(value));
    if (Array.isArray(value)) return value.map(plain);
    if (value && typeof value === "object") {
      const out = {};
      for (const [key, member] of Object.entries(value)) out[key] = plain(member);
      return out;
    }
    return value;
  };
  const out = {};
  for (const [name, value] of Object.entries(results ?? {})) {
    if (name === "prf") {
      const { results: _secret, ...rest } = value ?? {};
      out.prf = plain(rest);
    } else {
      out[name] = plain(value);
    }
  }
  return out;
}

/** The PRF's first output as bytes, or null when the passkey gave none. */
function prfOutput(results) {
  const first = results?.prf?.results?.first;
  return isBytes(first) ? Uint8Array.from(asBytes(first)) : null;
}

/**
 * A new passkey's answer. Returns
 *   { credential, id, prf: { enabled, output } }
 * `credential` is the registration response for the service; `id` the
 * credential id as bytes; `prf.enabled` whether the passkey says it can do
 * the PRF; `prf.output` its 32 bytes if it gave them at creation (most
 * don't, and are asked again with `prfOnly`).
 */
export function registrationAnswer(made) {
  const results = made.getClientExtensionResults?.() ?? {};
  const response = {
    clientDataJSON: toBase64url(made.response.clientDataJSON),
    attestationObject: toBase64url(made.response.attestationObject),
  };
  const transports = made.response.getTransports?.();
  if (Array.isArray(transports)) response.transports = transports;
  const id = Uint8Array.from(asBytes(made.rawId));
  const output = prfOutput(results);
  return {
    credential: {
      id: toBase64url(id),
      rawId: toBase64url(id),
      type: "public-key",
      response,
      ...(made.authenticatorAttachment ? { authenticatorAttachment: made.authenticatorAttachment } : {}),
      clientExtensionResults: extensionResults(results),
    },
    id,
    prf: { enabled: results?.prf?.enabled === true || output !== null, output },
  };
}

/**
 * A used passkey's answer. Returns { credential, id, prf: { output } }:
 * the authentication response for the service, the id of the passkey that
 * answered, and the PRF's output when it was asked for and given.
 */
export function assertionAnswer(used) {
  const results = used.getClientExtensionResults?.() ?? {};
  const response = {
    clientDataJSON: toBase64url(used.response.clientDataJSON),
    authenticatorData: toBase64url(used.response.authenticatorData),
    signature: toBase64url(used.response.signature),
  };
  if (used.response.userHandle && asBytes(used.response.userHandle).length) {
    response.userHandle = toBase64url(used.response.userHandle);
  }
  const id = Uint8Array.from(asBytes(used.rawId));
  return {
    credential: {
      id: toBase64url(id),
      rawId: toBase64url(id),
      type: "public-key",
      response,
      ...(used.authenticatorAttachment ? { authenticatorAttachment: used.authenticatorAttachment } : {}),
      clientExtensionResults: extensionResults(results),
    },
    id,
    prf: { output: prfOutput(results) },
  };
}

/* ── The ceremonies ─────────────────────────────────────────────────────── */

/**
 * Makes a passkey. `credentials` is `navigator.credentials` (a stand-in, in
 * tests). Returns registrationAnswer's result, or throws PasskeyStopped.
 */
export async function makePasskey({ credentials, publicKey, prfInput, signal }) {
  let made;
  try {
    made = await credentials.create({ publicKey: creationOptions(publicKey, { prfInput }), ...(signal ? { signal } : {}) });
  } catch (error) {
    throw stopped(error, true);
  }
  if (!made) throw new PasskeyStopped("canceled");
  return registrationAnswer(made);
}

/** Uses a passkey. Returns assertionAnswer's result, or throws PasskeyStopped. */
export async function usePasskey({ credentials, publicKey, prfInput, allow, signal }) {
  let used;
  try {
    used = await credentials.get({ publicKey: requestOptions(publicKey, { prfInput, allow }), ...(signal ? { signal } : {}) });
  } catch (error) {
    throw stopped(error, false);
  }
  if (!used) throw new PasskeyStopped("canceled");
  return assertionAnswer(used);
}

/**
 * Asks particular passkeys for the PRF's output and nothing else: no
 * sign-in, and nothing is sent anywhere. For a passkey that was just made
 * and said only that it can (most platforms give the output at the first
 * use, not at creation), and for a device that is signed in another way and
 * needs the passkey to open the notebook. The challenge is the page's own
 * random bytes, since no one checks this signature.
 *
 * Returns { id, output }: which passkey answered, and its 32 bytes or null.
 */
export async function prfOnly({ credentials, rpId, allow, prfInput, random, signal }) {
  const publicKey = { challenge: toBase64url(random(32)), rpId, timeout: 300000, userVerification: "required" };
  const used = await usePasskey({ credentials, publicKey, prfInput, allow, signal });
  return { id: used.id, output: used.prf.output };
}
