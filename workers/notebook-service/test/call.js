// One request to the Worker, made in workerd with the test environment's
// bindings. `env` overrides a binding for one call (to turn the preview's way
// in off, say). Returns { status, headers, body }, the body parsed.
import { env as bindings } from "cloudflare:workers";
import worker from "../src/index.js";

export const BASE = "https://notebook.test";
export const SECRET = bindings.PREVIEW_SECRET;

let address = 0;
/**
 * An address no other request in this run has come from, as Cloudflare would
 * report it. The service counts requests by address (src/limits.js), and a
 * suite makes thousands; a test about the limits passes `cf-connecting-ip`
 * itself.
 */
const freshAddress = () => {
  address += 1;
  return `2001:db8::${(address >>> 16).toString(16)}:${(address & 0xffff).toString(16)}`;
};

export async function call(method, path, { token, body, headers = {}, env = {} } = {}) {
  const init = { method, headers: { "cf-connecting-ip": freshAddress(), ...headers } };
  if (token) init.headers.authorization = `Bearer ${token}`;
  if (body !== undefined) {
    init.headers["content-type"] ??= "application/json";
    init.body = typeof body === "string" ? body : JSON.stringify(body);
  }
  const response = await worker.fetch(new Request(BASE + path, init), { ...bindings, ...env });
  const text = await response.text();
  let parsed = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = text;
  }
  return { status: response.status, headers: response.headers, body: parsed };
}

let made = 0;
/** A test account's name that no other test has used. */
export const freshAccount = (label = "t") => `${label}-${Date.now().toString(36)}-${++made}`;
