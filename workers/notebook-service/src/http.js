// Answers and refusals, and reading a request's body.
//
// Every answer is JSON and carries the service's time first, a refusal as
// much as a success (STUDY-DESK-ENCRYPTION.md, "The service's interface").
// A refusal's `error` is one of the words under "What the service answers
// when it refuses," and a client switches on that word, never on `message`.

/** No request may be larger than this, whatever it carries. */
export const MAX_BODY_BYTES = 4 * 1024 * 1024;

/** The service's own clock, in the record format's form: 2026-11-23T18:35:09.978Z. */
export const now = () => new Date().toISOString();

/** A time this many milliseconds after `from` (a time in the same form). */
export const after = (from, ms) => new Date(Date.parse(from) + ms).toISOString();

const MESSAGES = {
  sign_in: "Sign in again.",
  not_open: "This session has not proved the notebook's current key. Fetch the keyring, check it, and prove.",
  wrong_proof: "That key proof is not the current key's.",
  old_key: "The notebook's key has changed. Fetch the keyring, check it, and prove.",
  lists_changed: "The device and holder lists have changed. Fetch them and start the step again.",
  already_set_up: "This account already has a notebook. Join it instead.",
  no_notebook: "This account has no notebook yet. Set one up first.",
  exists: "That is already there.",
  gone: "That is no longer there.",
  not_found: "Not found.",
  preview_secret: "That is not the preview's secret.",
  passkey_refused: "That passkey's answer did not pass the service's checks.",
  token_refused: "That identity token did not pass the service's checks.",
  provider: "Apple or Google could not be reached, or answered something the service can't use. Try again.",
  bad_request: "The request is not in the form the interface gives.",
  not_allowed: "The interface does not allow that.",
  too_large: "Too large.",
  too_many: "A limit was reached.",
  slow_down: "Too many requests from this address. Wait, then try again.",
  busy: "The notebook changed while this was being done. Try again.",
  error: "The service failed. Try again.",
};

const HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
  "x-content-type-options": "nosniff",
};

/** A refusal, thrown from wherever a check fails and answered in one place (src/index.js). */
export class Refusal extends Error {
  constructor(status, code, extra = {}) {
    super(code);
    this.status = status;
    this.code = code;
    this.extra = extra;
  }
}

/** Refuses: `status` is the HTTP status, `code` the word a client reads, `extra` what helps it act. */
export function refuse(status, code, extra) {
  throw new Refusal(status, code, extra);
}

/** A malformed request: `field` names the member, in the request's own spelling. */
export const bad = (field) => refuse(400, "bad_request", { field });

/** A well-formed request that breaks a rule of the interface: `rule` names it. */
export const notAllowed = (rule) => refuse(422, "not_allowed", { rule });

/** An answer: the service's time, then `body`. */
export function answer(body = {}, status = 200) {
  return new Response(JSON.stringify({ time: now(), ...body }), { status, headers: HEADERS });
}

/** The answer to a refusal. */
export function refusalAnswer(refusal) {
  const { code, status, extra } = refusal;
  return answer({ error: code, message: MESSAGES[code] ?? code, ...extra }, status);
}

/**
 * Reads a request's body as a JSON object, and no more than MAX_BODY_BYTES of
 * it. Nothing read here is ever logged: a JSON parser's own error quotes the
 * text it choked on, so its message is dropped and only "bad_request" leaves.
 */
export async function readJson(request) {
  const type = request.headers.get("content-type") ?? "";
  if (!/^application\/json\s*(;|$)/i.test(type)) bad("Content-Type");
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > MAX_BODY_BYTES) refuse(413, "too_large", { limit: MAX_BODY_BYTES });
  if (!request.body) bad("body");

  const reader = request.body.getReader();
  const chunks = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_BODY_BYTES) {
      await reader.cancel();
      refuse(413, "too_large", { limit: MAX_BODY_BYTES });
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(total);
  let at = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, at);
    at += chunk.byteLength;
  }

  let parsed;
  try {
    parsed = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch {
    return bad("body");
  }
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) bad("body");
  return parsed;
}
