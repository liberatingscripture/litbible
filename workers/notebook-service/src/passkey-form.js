// A passkey's answer as a request carries it, and what the service asks a
// passkey for.
//
// A client sends the response in the standard's own JSON form (WebAuthn
// Level 3, `PublicKeyCredential.toJSON()`): what a browser makes, what
// Android's Credential Manager hands an app as text, and what an iOS app
// builds from the parts AuthenticationServices gives it. The service answers
// its options in the matching form, so each client passes them to its
// platform with one addition of its own: the `prf` extension, whose input a
// client never takes from the service (STUDY-DESK-ENCRYPTION.md, "The
// passkey").
//
// This file checks form and nothing else, and it holds the one rule that is
// LIT's own: A RESPONSE THAT STILL CARRIES A PRF RESULT IS REFUSED, before
// anything else is looked at. The standard's JSON form includes the PRF's
// output unless the client removes it, and that output is the secret a
// passkey holder is sealed under. Refusing it means a client that forgets
// fails in testing, and not in a reader's hands.

import { bad, notAllowed, refuse } from "./http.js";
import { LIMITS, base64urlBytes, fromBase64url, isObject, needBytesWithin, needObject } from "./check.js";
import { ALGORITHMS, PasskeyRefused, readClientData } from "./webauthn.js";
import { list } from "./providers.js";

/** A challenge is good for this long, and so is the wait a platform is asked to allow. */
export const CHALLENGE_MS = 5 * 60 * 1000;

/** What a passkey is called where the reader keeps it. The service keeps no name, so every account's is the same. */
const RP_NAME = "LIT Bible";
const PASSKEY_NAME = "LIT Bible notebook";

/**
 * Where passkeys may be used from, or null when the deployment doesn't say:
 * the relying party's id, and each accepted origin with the RP ID a passkey
 * made there belongs to.
 *
 *   PASSKEY_RP_ID          the relying party: litbible.net
 *   PASSKEY_ORIGINS        the origins accepted for it: the website's, and an
 *                          Android app's (android:apk-key-hash:…). An iOS app
 *                          answers with the website's origin and needs none.
 *   PASSKEY_LOCAL_ORIGINS  the preview only: pages on the developer's own
 *                          machine (http://localhost:…), whose RP ID a
 *                          browser makes "localhost". Read only where the
 *                          environment names itself "preview", and only for
 *                          an address of that exact form.
 */
export function passkeyConfig(env) {
  const rpId = typeof env.PASSKEY_RP_ID === "string" ? env.PASSKEY_RP_ID.trim() : "";
  const origins = list(env.PASSKEY_ORIGINS);
  if (!rpId || origins.length === 0) return null;
  const rps = new Map(origins.map((origin) => [origin, rpId]));
  if (env.ENVIRONMENT === "preview") {
    for (const origin of list(env.PASSKEY_LOCAL_ORIGINS)) {
      if (/^http:\/\/localhost(:\d{1,5})?$/.test(origin) && !rps.has(origin)) rps.set(origin, "localhost");
    }
  }
  return { rpId, rps };
}

export const passkeysOn = (env) => passkeyConfig(env) !== null;

/** The RP ID to name in options: a local page's is "localhost"; everyone else's is the deployment's. */
export function rpIdFor(config, request) {
  return config.rps.get(request.headers.get("origin") ?? "") ?? config.rpId;
}

/** What the service asks when a passkey signs in. The client adds `extensions.prf` itself. */
export function requestOptions({ rpId, challenge }) {
  return { challenge, rpId, timeout: CHALLENGE_MS, userVerification: "required" };
}

/**
 * What the service asks when a passkey is made: discoverable, user
 * verification required, no attestation. `exclude` is the credential ids the
 * account already has, so that a provider that holds one says so instead of
 * making a second. The client adds `extensions.prf` itself.
 */
export function creationOptions({ rpId, challenge, handle, exclude = [] }) {
  return {
    rp: { id: rpId, name: RP_NAME },
    user: { id: handle, name: PASSKEY_NAME, displayName: PASSKEY_NAME },
    challenge,
    pubKeyCredParams: ALGORITHMS.map((alg) => ({ type: "public-key", alg })),
    timeout: CHALLENGE_MS,
    excludeCredentials: exclude.map((id) => ({ type: "public-key", id })),
    authenticatorSelection: { residentKey: "required", requireResidentKey: true, userVerification: "required" },
    attestation: "none",
  };
}

/** A failed check of a passkey's answer, as the refusal a client is sent. */
export function refusePasskey(reason) {
  return refuse(403, "passkey_refused", { reason });
}

/** Runs a check from src/webauthn.js, turning its refusal into the service's. */
export async function passkeyCheck(check) {
  try {
    return await check();
  } catch (error) {
    if (error instanceof PasskeyRefused) return refusePasskey(error.reason);
    throw error;
  }
}

const bytesIn = (value, field, min, max) => fromBase64url(needBytesWithin(value, field, min, max));

/** What both kinds of response share: the credential's id, and no PRF result. */
function needCredential(value) {
  const credential = needObject(value, "credential");
  if (credential.type !== "public-key") bad("credential.type");
  const id = needBytesWithin(credential.id, "credential.id", 1, LIMITS.credentialBytes);
  if (credential.rawId !== undefined && credential.rawId !== id) bad("credential.rawId");
  const response = needObject(credential.response, "credential.response");
  const extensions = credential.clientExtensionResults;
  if (extensions !== undefined && extensions !== null && !isObject(extensions)) bad("credential.clientExtensionResults");
  // The PRF's output never reaches the service: a response that still has it is refused whole.
  if (isObject(extensions) && isObject(extensions.prf) && "results" in extensions.prf) notAllowed("prf_results");
  return { id, response };
}

/**
 * A new passkey's response: { id, type, response: { clientDataJSON,
 * attestationObject }, clientExtensionResults }. Returns its parts as bytes,
 * and the challenge and origin its client data names.
 */
export async function needRegistration(value) {
  const { id, response } = needCredential(value);
  const clientDataJSON = bytesIn(response.clientDataJSON, "credential.response.clientDataJSON", 1, LIMITS.clientDataBytes);
  const attestationObject = bytesIn(response.attestationObject, "credential.response.attestationObject", 1, LIMITS.attestationBytes);
  const client = await passkeyCheck(() => readClientData(clientDataJSON, "webauthn.create"));
  return { id, clientDataJSON, attestationObject, ...client };
}

/**
 * A response from a passkey used to sign in: { id, type, response: {
 * clientDataJSON, authenticatorData, signature, userHandle },
 * clientExtensionResults }.
 */
export async function needAssertion(value) {
  const { id, response } = needCredential(value);
  const clientDataJSON = bytesIn(response.clientDataJSON, "credential.response.clientDataJSON", 1, LIMITS.clientDataBytes);
  const authenticatorData = bytesIn(response.authenticatorData, "credential.response.authenticatorData", 37, LIMITS.authenticatorDataBytes);
  const signature = bytesIn(response.signature, "credential.response.signature", 1, LIMITS.signatureBytes);
  // A user handle may be left out, null, or empty: a passkey found by its id need not send one.
  const handle = response.userHandle;
  const none = handle === undefined || handle === null || handle === "";
  if (!none && !(base64urlBytes(handle) >= 1 && base64urlBytes(handle) <= LIMITS.userHandleBytes)) bad("credential.response.userHandle");
  const client = await passkeyCheck(() => readClientData(clientDataJSON, "webauthn.get"));
  return { id, clientDataJSON, authenticatorData, signature, userHandle: none ? null : handle, ...client };
}
