// One request to the Worker, made in workerd with the test environment's
// bindings, and the reports the tests send. `env` overrides a binding for one
// call. Returns { status, headers, text }.
import { env as bindings } from "cloudflare:workers";
import worker from "../src/index.js";

export const SITE = "https://litbible.net";
export const ENDPOINT = `${SITE}/csp-report`;

export const CHROME = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36";
export const FIREFOX = "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:128.0) Gecko/20100101 Firefox/128.0";
export const SAFARI = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15";

let address = 0;
/**
 * An address no other request in this run has come from, as Cloudflare would
 * report it. Posts are counted by address, so a test about the limit passes
 * `cf-connecting-ip` itself.
 */
const freshAddress = () => `2001:db8::${(++address).toString(16)}`;

export async function send(method, { path = "/csp-report", type, body, headers = {}, env = {} } = {}) {
  const init = { method, headers: { "cf-connecting-ip": freshAddress(), "user-agent": FIREFOX, ...headers } };
  if (type) init.headers["content-type"] = type;
  if (body !== undefined) init.body = typeof body === "string" || body instanceof Uint8Array || body instanceof ReadableStream ? body : JSON.stringify(body);
  if (body instanceof ReadableStream) init.duplex = "half";
  const response = await worker.fetch(new Request(SITE + path, init), { ...bindings, ...env });
  return { status: response.status, headers: response.headers, text: await response.text() };
}

/** A report as `report-uri` sends it. `fields` replaces or adds members of "csp-report". */
export const legacy = (fields = {}) => ({
  "csp-report": {
    "document-uri": `${SITE}/john-3/`,
    referrer: "https://www.example.org/a-search?q=someone",
    "violated-directive": "connect-src",
    "effective-directive": "connect-src",
    "original-policy": "default-src 'self'; connect-src 'self'; report-uri https://litbible.net/csp-report",
    disposition: "report",
    "blocked-uri": "https://api.example.com/v1/charge?token=abc",
    "status-code": 200,
    "script-sample": "",
    ...fields,
  },
});

/** One report as `report-to` sends it, to be put in an array. `body` replaces or adds members of its body. */
export const modern = (body = {}, top = {}) => ({
  age: 12,
  type: "csp-violation",
  url: `${SITE}/john-3/`,
  user_agent: CHROME,
  body: {
    blockedURL: "https://api.example.com/v1/charge?token=abc",
    columnNumber: 7,
    disposition: "report",
    documentURL: `${SITE}/john-3/`,
    effectiveDirective: "connect-src",
    lineNumber: 44,
    originalPolicy: "default-src 'self'; connect-src 'self'; report-to csp",
    referrer: "https://www.example.org/a-search?q=someone",
    sample: "",
    sourceFile: `${SITE}/_astro/chapter-tools.B5E1GIKE.js`,
    statusCode: 200,
    ...body,
  },
  ...top,
});

export const postLegacy = (fields, options = {}) => send("POST", { type: "application/csp-report", body: legacy(fields), ...options });
export const postModern = (reports, options = {}) => send("POST", { type: "application/reports+json", body: reports, ...options });

/** Every row of the counts, in a fixed order. */
export async function rows(db = bindings.DB) {
  const { results } = await db.prepare("SELECT * FROM counts ORDER BY day, disposition, directive, blocked, page, source, browser").all();
  return results;
}

/** Empties both tables, so a test counts only what it sent. */
export async function clear(db = bindings.DB) {
  await db.batch([db.prepare("DELETE FROM counts"), db.prepare("DELETE FROM days")]);
}
