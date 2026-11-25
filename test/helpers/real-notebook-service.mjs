// test/helpers/real-notebook-service.mjs
//
// The notebook service itself, for the root suite: the Worker's own code
// (workers/notebook-service/src/, which imports nothing outside itself),
// answering requests in Node against a real SQLite database with the real
// migrations applied. The account pages' tests run against it, so no check,
// word, or shape of the service's is written out a second time by hand.
//
// What stands in for Cloudflare, and no more:
//   - D1: a small wrapper over node:sqlite with D1's own calls (prepare,
//     bind, first, all, run, batch). A batch is one transaction that rolls
//     back whole, which is what the service's guard relies on.
//   - The two rate limiters: bindings that always say yes.
//   - crypto.subtle.timingSafeEqual, which only workerd has.
//
// It is the service as the PREVIEW configures it, without the preview's own
// way in (no secret is set, so that route answers "not found"). Sign-in is a
// real passkey ceremony: the software authenticator is the service's own
// (workers/notebook-service/test/authenticator.js), and fake-credentials.mjs
// puts it behind a browser's navigator.credentials.
//
// The fake service (fake-notebook-service.mjs) stays for the sync engine's
// tests, which need a service they can break at an exact point.

import { register } from "node:module";
import { DatabaseSync } from "node:sqlite";
import { readFileSync, readdirSync } from "node:fs";
import { timingSafeEqual } from "node:crypto";
import { fileURLToPath } from "node:url";

register("./workers-hooks.mjs", import.meta.url);

if (typeof crypto.subtle.timingSafeEqual !== "function") {
  Object.defineProperty(crypto.subtle, "timingSafeEqual", {
    configurable: true,
    value: (a, b) => {
      const one = a instanceof ArrayBuffer ? new Uint8Array(a) : new Uint8Array(a.buffer, a.byteOffset, a.byteLength);
      const two = b instanceof ArrayBuffer ? new Uint8Array(b) : new Uint8Array(b.buffer, b.byteOffset, b.byteLength);
      if (one.length !== two.length) throw new TypeError("timingSafeEqual: the two differ in length");
      return timingSafeEqual(one, two);
    },
  });
}

const SERVICE = new URL("../../workers/notebook-service/", import.meta.url);
const { default: worker } = await import(new URL("src/index.js", SERVICE).href);
const { runScheduled } = await import(new URL("src/scheduled.js", SERVICE).href);

/** The service's own software passkey: newPasskey, attest, assert, and its encoders. */
export const authenticator = await import(new URL("test/authenticator.js", SERVICE).href);

const MIGRATIONS = readdirSync(new URL("migrations/", SERVICE))
  .filter((name) => name.endsWith(".sql"))
  .sort()
  .map((name) => readFileSync(fileURLToPath(new URL(`migrations/${name}`, SERVICE)), "utf8"));

/* ── D1, over node:sqlite ───────────────────────────────────────────────── */

const bound = (value) => {
  if (value === undefined) throw new Error("D1_TYPE_ERROR: Type 'undefined' not supported for value 'undefined'");
  if (typeof value === "boolean") return value ? 1 : 0;
  return value;
};

class Statement {
  constructor(sql, text, values = []) {
    this.sql = sql;
    this.text = text;
    this.values = values;
  }

  bind(...values) {
    return new Statement(this.sql, this.text, values.map(bound));
  }

  /** Runs it now. Returns what D1 answers: the rows, and how many rows it changed. */
  now() {
    const before = this.sql.prepare("SELECT total_changes() AS n").get().n;
    let results;
    try {
      results = this.sql.prepare(this.text).all(...this.values);
    } catch (error) {
      // As D1 words it, with SQLite's own message inside.
      throw new Error(`D1_ERROR: ${error.message}`);
    }
    const changes = this.sql.prepare("SELECT total_changes() AS n").get().n - before;
    return { success: true, results: results.map((row) => ({ ...row })), meta: { changes, rows_written: changes } };
  }

  async first(column) {
    const row = this.now().results[0];
    if (row === undefined) return null;
    return column === undefined ? row : row[column];
  }

  async all() {
    return this.now();
  }

  async run() {
    return this.now();
  }
}

function d1(sql) {
  return {
    prepare: (text) => new Statement(sql, text),
    async batch(statements) {
      sql.exec("BEGIN IMMEDIATE");
      try {
        const out = statements.map((statement) => statement.now());
        sql.exec("COMMIT");
        return out;
      } catch (error) {
        sql.exec("ROLLBACK");
        throw error;
      }
    },
  };
}

/* ── The service ────────────────────────────────────────────────────────── */

const ALWAYS = { limit: async () => ({ success: true }) };

/** The preview's configuration (wrangler.jsonc), without the preview's own way in. */
const PREVIEW = {
  ENVIRONMENT: "preview",
  ALLOWED_ORIGINS: "https://litbible.net,http://localhost:4321",
  PASSKEY_RP_ID: "litbible.net",
  PASSKEY_ORIGINS: "https://litbible.net",
  PASSKEY_LOCAL_ORIGINS: "http://localhost:4321",
};

/**
 * A service with an empty database.
 *
 *   const service = realService();
 *   const api = createApi({ service: service.origin, fetch: service.fetch, pageOrigin: service.pageOrigin });
 *
 * `fetch` is what a page's fetch would be: it takes the address and the
 * init, adds the `Origin` a browser sends from `pageOrigin`, and answers with
 * the Worker's own Response. `offline` makes it throw as a dead network does.
 * `env` adds or replaces bindings (a Turnstile secret, say). `sql` is the
 * database, for a test that has to look. `due(time)` runs the hourly job as
 * if it were `time` (an ISO string), which is how seven days pass.
 */
export function realService({ origin = "https://notebook-preview.litbible.net", pageOrigin = "https://litbible.net", env: more = {} } = {}) {
  const sql = new DatabaseSync(":memory:");
  for (const migration of MIGRATIONS) sql.exec(migration);
  const env = { DB: d1(sql), SIGN_IN_LIMIT: ALWAYS, REQUEST_LIMIT: ALWAYS, ...PREVIEW, ...more };

  const service = {
    origin,
    pageOrigin,
    env,
    sql,
    offline: false,
    /** Every request made, as "METHOD /path", in order. */
    requests: [],
    /** What the Worker logged as a failure (a 500): empty in a test that passes. */
    failures: [],
    async fetch(input, init = {}) {
      if (service.offline) throw new TypeError("fetch failed");
      const headers = new Headers(init.headers ?? {});
      if (!headers.has("origin") && service.pageOrigin) headers.set("origin", service.pageOrigin);
      const request = new Request(String(input), { method: init.method ?? "GET", headers, body: init.body });
      const url = new URL(request.url);
      if (url.origin !== origin) throw new TypeError(`fetch failed: ${url.origin} is not the service`);
      service.requests.push(`${request.method} ${url.pathname}${url.search}`);
      return quietly(service, () => worker.fetch(request, env));
    },
    due: (time) => quietly(service, () => runScheduled(env, time)),
  };
  return service;
}

// The Worker writes one line to the console for each request. A test run
// makes thousands, so they are kept out of the output; a failure's line is
// kept on the service for a test to read.
let depth = 0;
let saved = null;
async function quietly(service, run) {
  if (depth++ === 0) {
    saved = { log: console.log, error: console.error };
    console.log = () => {};
    console.error = (line) => service.failures.push(String(line));
  }
  try {
    return await run();
  } finally {
    if (--depth === 0) {
      console.log = saved.log;
      console.error = saved.error;
    }
  }
}
