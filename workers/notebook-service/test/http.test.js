// The HTTP layer: routing, the shape of every answer, reading a body, CORS,
// and what the service writes to its log.
import { env as bindings } from "cloudflare:workers";
import { afterEach, describe, expect, it, vi } from "vitest";
import worker from "../src/index.js";
import { MAX_BODY_BYTES } from "../src/http.js";
import { BASE, SECRET, call, freshAccount } from "./call.js";
import { must, note, proofOf, push, ref, rowFor, setUp, setupRequest, signIn } from "./notebook.js";
import { addPasskeyRequest, assert, attest, newPasskey } from "./authenticator.js";
import { freshSubject, providerRequest, providersOn, standDown, standIns } from "./idp.js";

const TIME = /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/;

/** A request with full control of the headers and the body, which call() does not give. */
async function raw(method, path, { headers = {}, body, duplex, env = {} } = {}) {
  const init = { method, headers };
  if (body !== undefined) init.body = body;
  if (duplex) init.duplex = duplex;
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

const JSON_TYPE = { "content-type": "application/json" };
const session = (body) => raw("POST", "/preview/session", { headers: JSON_TYPE, body });

describe("routing", () => {
  it("answers an unknown path with 404 not_found", async () => {
    for (const method of ["GET", "POST"]) {
      const res = await call(method, "/no/such/path");
      expect(res.status).toBe(404);
      expect(res.body.error).toBe("not_found");
    }
  });

  it("answers a known path with the wrong method with 404 not_found, not 405", async () => {
    for (const [method, path] of [
      ["POST", "/"],
      ["PUT", "/account"],
      ["DELETE", "/account"],
      ["GET", "/notebook"],
      ["PUT", "/notebook"],
      ["DELETE", "/rows"],
      ["GET", "/session/proof"],
      ["PUT", "/devices"],
      ["POST", `/devices/${crypto.randomUUID()}`],
      ["GET", "/preview/session"],
    ]) {
      const res = await call(method, path);
      expect(res.status, `${method} ${path}`).toBe(404);
      expect(res.body.error, `${method} ${path}`).toBe("not_found");
    }
  });

  it("answers the same to a wrong method as to an unknown path, with a token or without", async () => {
    const token = await signIn(freshAccount());
    const unknown = await call("GET", "/no/such/path", { token });
    const wrong = await call("PUT", "/account", { token });
    expect({ ...wrong.body, time: 0 }).toEqual({ ...unknown.body, time: 0 });
  });

  it("does not match an address with more or fewer parts than the route's", async () => {
    for (const [method, path] of [
      ["PUT", `/devices/${crypto.randomUUID()}/extra`],
      ["GET", `/approvals/${"a".repeat(32)}/extra`],
      ["PUT", "/devices/"],
      ["GET", "/account/extra"],
    ]) {
      const res = await call(method, path);
      expect(res.status, path).toBe(404);
    }
  });

  it("treats a trailing slash as the same path", async () => {
    const token = await signIn(freshAccount());
    const plain = await must("GET", "/account", { token });
    const slashed = await call("GET", "/account/", { token });
    expect(slashed.status).toBe(200);
    expect({ ...slashed.body, time: 0 }).toEqual({ ...plain, time: 0 });
    expect((await call("GET", "/rows/?since=0", { token })).body.error).toBe("not_open");
    expect((await call("GET", "/account/")).body.error).toBe("sign_in");
  });

  it("answers GET / with the service, the interface's version, and whether the preview's way in is on", async () => {
    const res = await call("GET", "/");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ time: expect.stringMatching(TIME), service: "lit-notebook", interface: 1, preview: true });
  });
});

describe("every answer has the same form", () => {
  const sample = async () => {
    const { device } = await setUp();
    const stranger = await signIn(freshAccount());
    return {
      "a success": await call("GET", "/account", { token: device.token }),
      "the root": await call("GET", "/"),
      "sign_in": await call("GET", "/account"),
      "not_open": await call("GET", "/devices", { token: stranger }),
      "bad_request": await call("POST", "/session/proof", { token: stranger, body: "{" }),
      "not_allowed": await call("DELETE", `/devices/${crypto.randomUUID()}`, { token: stranger }),
      "a 404": await call("GET", "/nowhere"),
      "too_large": await raw("POST", "/preview/session", {
        headers: { ...JSON_TYPE, "content-length": String(MAX_BODY_BYTES + 1) },
        body: "{}",
      }),
      "a preview_secret refusal": await session(JSON.stringify({ secret: "wrong", account: "x" })),
    };
  };

  it("carries time first, in the format's form, success and refusal alike", async () => {
    const before = Date.now() - 2000;
    for (const [name, res] of Object.entries(await sample())) {
      expect(Object.keys(res.body)[0], name).toBe("time");
      expect(res.body.time, name).toMatch(TIME);
      expect(Date.parse(res.body.time), name).toBeGreaterThan(before);
      expect(Date.parse(res.body.time), name).toBeLessThan(Date.now() + 2000);
    }
  });

  it("carries the three headers on every answer", async () => {
    for (const [name, res] of Object.entries(await sample())) {
      expect(res.headers.get("content-type"), name).toBe("application/json; charset=utf-8");
      expect(res.headers.get("cache-control"), name).toBe("no-store");
      expect(res.headers.get("x-content-type-options"), name).toBe("nosniff");
    }
  });

  it("gives every refusal an error word and a message, after time", async () => {
    for (const [name, res] of Object.entries(await sample())) {
      if (res.status < 400) continue;
      expect(Object.keys(res.body).slice(0, 3), name).toEqual(["time", "error", "message"]);
      expect(typeof res.body.error, name).toBe("string");
      expect(typeof res.body.message, name).toBe("string");
    }
  });

  it("answers a failure inside the service with 500 and the word error, naming nothing", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const token = ref.toBase64url(ref.randomBytes(32));
    const res = await call("GET", "/account", { token, env: { DB: undefined } });
    spy.mockRestore();
    log.mockRestore();
    expect(res.status).toBe(500);
    expect(res.body.error).toBe("error");
    expect(JSON.stringify(res.body)).not.toContain(token);
    expect(res.headers.get("cache-control")).toBe("no-store");
  });
});

describe("reading a body", () => {
  it("refuses a body without Content-Type: application/json, naming Content-Type", async () => {
    for (const type of ["text/plain", "application/x-www-form-urlencoded", "application/jsonp", "text/json", "application/json5"]) {
      const res = await raw("POST", "/preview/session", { headers: { "content-type": type }, body: "{}" });
      expect(res.status, type).toBe(400);
      expect(res.body.error, type).toBe("bad_request");
      expect(res.body.field, type).toBe("Content-Type");
    }
  });

  it("refuses a body with no Content-Type header at all", async () => {
    const res = await raw("POST", "/preview/session", { body: new Uint8Array([123, 125]) });
    expect(res.status).toBe(400);
    expect(res.body.field).toBe("Content-Type");
  });

  it("refuses a request with no body, as one", async () => {
    const res = await raw("POST", "/preview/session", { headers: JSON_TYPE });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("bad_request");
    expect(res.body.field).toBe("body");
  });

  it("accepts the type with a charset, in any case", async () => {
    for (const type of ["application/json; charset=utf-8", "APPLICATION/JSON", "application/json;charset=UTF-8"]) {
      const res = await raw("POST", "/preview/session", { headers: { "content-type": type }, body: JSON.stringify({ secret: SECRET, account: freshAccount() }) });
      expect(res.status, type).toBe(200);
    }
  });

  it("refuses a body that is not JSON, naming body", async () => {
    for (const text of ["not json", "{", '{"secret":', "{'secret': 1}", "undefined"]) {
      const res = await session(text);
      expect(res.status, text).toBe(400);
      expect(res.body.error, text).toBe("bad_request");
      expect(res.body.field, text).toBe("body");
    }
  });

  it("refuses a body that is not UTF-8, naming body", async () => {
    // 0xC3 0x28 is an invalid two-byte sequence, put inside an otherwise good object.
    const head = new TextEncoder().encode('{"secret":"');
    const tail = new TextEncoder().encode('","account":"x"}');
    const bytes = new Uint8Array([...head, 0xc3, 0x28, ...tail]);
    const res = await session(bytes);
    expect(res.status).toBe(400);
    expect(res.body.field).toBe("body");
  });

  it("refuses a body that begins with a byte-order mark's lone half", async () => {
    const res = await session(new Uint8Array([0xff, 0xfe, 0x7b, 0x7d]));
    expect(res.status).toBe(400);
    expect(res.body.field).toBe("body");
  });

  it("refuses JSON that is not an object: an array, a string, null, a number, a boolean", async () => {
    for (const text of ["[]", '[{"secret":"x"}]', '"secret"', "null", "5", "true"]) {
      const res = await session(text);
      expect(res.status, text).toBe(400);
      expect(res.body.error, text).toBe("bad_request");
      expect(res.body.field, text).toBe("body");
    }
  });

  it("refuses an empty body of the right type", async () => {
    const res = await session("");
    expect(res.status).toBe(400);
    expect(res.body.field).toBe("body");
  });

  it("refuses a body over MAX_BODY_BYTES when Content-Length says so, without reading it", async () => {
    const res = await raw("POST", "/preview/session", {
      headers: { ...JSON_TYPE, "content-length": String(MAX_BODY_BYTES + 1) },
      body: "{}",
    });
    expect(res.status).toBe(413);
    expect(res.body.error).toBe("too_large");
    expect(res.body.limit).toBe(MAX_BODY_BYTES);
  });

  it("refuses a body over MAX_BODY_BYTES that carries no Content-Length", async () => {
    const chunk = new Uint8Array(1024 * 1024).fill(97);
    let sent = 0;
    const stream = new ReadableStream({
      pull(controller) {
        if (sent > MAX_BODY_BYTES) return controller.close();
        controller.enqueue(chunk);
        sent += chunk.byteLength;
      },
    });
    const res = await raw("POST", "/preview/session", { headers: JSON_TYPE, body: stream, duplex: "half" });
    expect(res.status).toBe(413);
    expect(res.body.error).toBe("too_large");
  });

  it("refuses one byte over the limit in a body whose length is known", async () => {
    const padded = (size) => {
      const prefix = '{"secret":"wrong","pad":"';
      const suffix = '"}';
      return prefix + "a".repeat(size - prefix.length - suffix.length) + suffix;
    };
    const over = await session(padded(MAX_BODY_BYTES + 1));
    expect(over.status).toBe(413);
    expect(over.body.error).toBe("too_large");
  });

  it("reads a body of exactly MAX_BODY_BYTES", async () => {
    const prefix = '{"secret":"wrong","pad":"';
    const suffix = '"}';
    const text = prefix + "a".repeat(MAX_BODY_BYTES - prefix.length - suffix.length) + suffix;
    expect(text.length).toBe(MAX_BODY_BYTES);
    const res = await session(text);
    // It was read and parsed: the refusal is the secret's, which comes after the body.
    expect(res.status).toBe(401);
    expect(res.body.error).toBe("preview_secret");
  });

  it("checks the session before reading a body of a request that needs one", async () => {
    const res = await raw("POST", "/rows", { headers: { ...JSON_TYPE, "content-length": String(MAX_BODY_BYTES + 1) }, body: "{}" });
    expect(res.status).toBe(401);
    expect(res.body.error).toBe("sign_in");
  });

  it("ignores members it does not know, in a body that is otherwise good", async () => {
    const res = await session(JSON.stringify({ secret: SECRET, account: freshAccount(), extra: 1, nested: { a: [1, 2] }, __proto__x: null }));
    expect(res.status).toBe(200);
    expect(Object.keys(res.body)).toEqual(["time", "token", "expires"]);
  });

  it("ignores members it does not know on a request that changes something", async () => {
    const { account, device, held } = await setUp();
    const token = await signIn(account);
    const res = await call("POST", "/session/proof", {
      token,
      body: { device: device.id, kid: 1, proof: await proofOf(held), extra: "x", sub: "someone else", account: "another" },
    });
    expect(res.status).toBe(200);
  });

  it("does not take an account or sub from a body as proof of who is asking", async () => {
    const mine = await setUp();
    const theirs = await setUp();
    const token = await signIn(mine.account);
    const res = await call("POST", "/session/proof", {
      token,
      body: { device: theirs.device.id, kid: 1, proof: await proofOf(theirs.held), account: theirs.account, sub: theirs.account },
    });
    // The other account's proof and device are no use here: this account's own hash is the one checked.
    expect(res.status).toBe(403);
    expect(res.body.error).toBe("wrong_proof");
    expect((await must("GET", "/account", { token })).session.open).toBe(false);
  });
});

describe("CORS", () => {
  const ALLOWED = ["https://litbible.net", "http://localhost:4321"];

  it("answers a request from an allowed origin with that origin and Vary: Origin", async () => {
    for (const origin of ALLOWED) {
      const res = await call("GET", "/", { headers: { origin } });
      expect(res.status).toBe(200);
      expect(res.headers.get("access-control-allow-origin")).toBe(origin);
      expect(res.headers.get("vary")).toBe("Origin");
    }
  });

  it("lets a browser read a refusal and a 404 from an allowed origin too", async () => {
    const origin = ALLOWED[0];
    for (const path of ["/account", "/nowhere"]) {
      const res = await call("GET", path, { headers: { origin } });
      expect(res.status).toBeGreaterThanOrEqual(400);
      expect(res.headers.get("access-control-allow-origin"), path).toBe(origin);
      expect(res.headers.get("content-type"), path).toBe("application/json; charset=utf-8");
      expect(res.headers.get("cache-control"), path).toBe("no-store");
    }
  });

  it("gives no CORS header to another origin, while still answering", async () => {
    for (const origin of [
      "https://evil.example",
      "https://litbible.net.evil.example",
      "http://litbible.net",
      "https://www.litbible.net",
      "http://localhost:4322",
      "null",
    ]) {
      const res = await call("GET", "/", { headers: { origin } });
      expect(res.status, origin).toBe(200);
      expect(res.headers.get("access-control-allow-origin"), origin).toBeNull();
      expect(res.headers.get("access-control-allow-methods"), origin).toBeNull();
    }
  });

  it("gives no CORS header when the request names no origin", async () => {
    const res = await call("GET", "/");
    expect(res.headers.get("access-control-allow-origin")).toBeNull();
  });

  it("answers a preflight from an allowed origin with 204, the methods, and the headers", async () => {
    for (const origin of ALLOWED) {
      const res = await call("OPTIONS", "/rows", { headers: { origin, "access-control-request-method": "POST" } });
      expect(res.status).toBe(204);
      expect(res.body).toBeNull();
      expect(res.headers.get("access-control-allow-origin")).toBe(origin);
      expect(res.headers.get("access-control-allow-methods")).toBe("GET, POST, PUT, DELETE");
      const allowed = res.headers.get("access-control-allow-headers").toLowerCase();
      expect(allowed).toContain("authorization");
      expect(allowed).toContain("content-type");
      expect(res.headers.get("vary")).toBe("Origin");
    }
  });

  it("refuses a preflight from another origin, or none, with 403", async () => {
    for (const headers of [{ origin: "https://evil.example" }, {}]) {
      const res = await call("OPTIONS", "/rows", { headers });
      expect(res.status).toBe(403);
      expect(res.headers.get("access-control-allow-origin")).toBeNull();
    }
  });

  it("allows only the origins the environment names, trimmed, and none when it names none", async () => {
    const env = { ALLOWED_ORIGINS: " https://a.test , https://b.test " };
    expect((await call("GET", "/", { headers: { origin: "https://b.test" }, env })).headers.get("access-control-allow-origin")).toBe("https://b.test");
    expect((await call("GET", "/", { headers: { origin: "https://litbible.net" }, env })).headers.get("access-control-allow-origin")).toBeNull();
    for (const ALLOWED_ORIGINS of [undefined, ""]) {
      const res = await call("GET", "/", { headers: { origin: "https://litbible.net" }, env: { ALLOWED_ORIGINS } });
      expect(res.headers.get("access-control-allow-origin")).toBeNull();
    }
  });

  it("never answers with Access-Control-Allow-Credentials", async () => {
    const origin = ALLOWED[0];
    const token = await signIn(freshAccount());
    const answers = [
      await call("GET", "/", { headers: { origin } }),
      await call("GET", "/account", { headers: { origin }, token }),
      await call("GET", "/account", { headers: { origin } }),
      await call("GET", "/nowhere", { headers: { origin } }),
      await call("OPTIONS", "/account", { headers: { origin } }),
      await call("OPTIONS", "/account", { headers: { origin: "https://evil.example" } }),
      await call("GET", "/", { headers: { origin: "https://evil.example" } }),
    ];
    for (const res of answers) expect(res.headers.get("access-control-allow-credentials")).toBeNull();
  });
});

describe("what the service logs", () => {
  afterEach(() => vi.restoreAllMocks());

  /** Every string leaf of a value, for what a log line must never contain. */
  const leaves = (value, out = []) => {
    if (typeof value === "string") {
      // A time is not a secret, and two can coincide with a log line's own `at`.
      if (value.length >= 16 && !/^\d{4}-\d\d-\d\dT/.test(value)) out.push(value);
    } else if (Array.isArray(value)) value.forEach((v) => leaves(v, out));
    else if (value && typeof value === "object") Object.values(value).forEach((v) => leaves(v, out));
    return out;
  };

  const ROUTES = [
    "GET /account", "POST /session/proof", "POST /notebook", "POST /notebook/key", "GET /holders", "POST /holders",
    "GET /keyring", "GET /devices", "POST /devices", "PUT /devices/:id", "DELETE /devices/:id", "GET /rows", "POST /rows",
    "POST /approvals", "GET /approvals/:id", "POST /approvals/:id/grant", "POST /approvals/:id/accept", "GET /",
    "POST /preview/session", "POST /preview/passkeys",
  ];

  async function flow() {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const error = vi.spyOn(console, "error").mockImplementation(() => {});

    const account = freshAccount("logged-account");
    const made = await setupRequest({ account, passkey: true });
    const { device, held } = made;
    const wrongSecret = `wrong-secret-${crypto.randomUUID()}`;
    await call("POST", "/preview/session", { body: { secret: wrongSecret, account } });
    await must("POST", "/notebook", { token: device.token, body: made.body });
    const row = await rowFor(held, note({ body: "a private thought, quite private" }));
    await push(device, [row]);
    const other = await signIn(account);
    const wrongProof = ref.toBase64url(ref.randomBytes(32));
    const proofRes = await call("POST", "/session/proof", { token: other, body: { device: device.id, kid: 1, proof: wrongProof } });
    const keyring = await call("GET", `/keyring?device=${device.id}`, { token: device.token });
    const rename = await call("PUT", `/devices/${device.id}`, { token: device.token, body: { lists: 99, kid: 1, card: made.body.device.card } });
    await call("GET", `/rows?since=0`, { token: device.token });
    await call("GET", `/no/such/${crypto.randomUUID()}`, { token: device.token });
    await call("DELETE", `/devices/${device.id}`, { token: device.token });

    const lines = [...log.mock.calls, ...error.mock.calls].map((args) => args.join(" "));
    const secrets = [
      device.token, other, SECRET, wrongSecret, wrongProof, await proofOf(held), made.body.proofHash, account, device.id,
      held.notebook, row.id, ...leaves(made.body), ...leaves(row), ...leaves(keyring.body), ...leaves(rename.body),
    ];
    return { lines, log, error, secrets, proofRes, keyring };
  }

  it("holds no token, secret, proof, id, account name, or ciphertext in any line", async () => {
    const { lines, secrets } = await flow();
    expect(lines.length).toBeGreaterThan(10);
    expect(secrets.length).toBeGreaterThan(20);
    for (const line of lines) {
      for (const secret of secrets) expect(line.includes(secret), `${line} holds ${secret.slice(0, 12)}...`).toBe(false);
    }
  });

  it("writes each line as JSON with only at, route, status, ms, and perhaps refused", async () => {
    const { lines } = await flow();
    for (const line of lines) {
      const parsed = JSON.parse(line);
      expect(Object.keys(parsed).sort(), line).toEqual(
        Object.keys(parsed).includes("refused") ? ["at", "ms", "refused", "route", "status"] : ["at", "ms", "route", "status"],
      );
      expect(parsed.at).toMatch(TIME);
      expect(typeof parsed.status).toBe("number");
      expect(typeof parsed.ms).toBe("number");
    }
  });

  it("names the route by its own pattern, never the address asked for", async () => {
    const { lines } = await flow();
    const routes = lines.map((line) => JSON.parse(line).route);
    for (const route of routes) expect([...ROUTES, "unmatched"], route).toContain(route);
    expect(routes).toContain("GET /keyring");
    expect(routes).toContain("PUT /devices/:id");
    expect(routes).toContain("DELETE /devices/:id");
    expect(routes).toContain("unmatched");
    for (const line of lines) expect(line).not.toMatch(/\/keyring\?|\/devices\/[0-9a-f]{8}|since=|\/no\/such/);
  });

  it("writes the word of a refusal, the status, and nothing for a success", async () => {
    const { lines } = await flow();
    const parsed = lines.map((l) => JSON.parse(l));
    const wrong = parsed.find((l) => l.route === "POST /session/proof");
    expect(wrong).toMatchObject({ status: 403, refused: "wrong_proof" });
    const wrongSecret = parsed.find((l) => l.route === "POST /preview/session" && l.status === 401);
    expect(wrongSecret.refused).toBe("preview_secret");
    const unmatched = parsed.find((l) => l.route === "unmatched");
    expect(unmatched).toMatchObject({ status: 404, refused: "not_found" });
    const lists = parsed.find((l) => l.route === "PUT /devices/:id");
    expect(lists).toMatchObject({ status: 409, refused: "lists_changed" });
    for (const line of parsed.filter((l) => l.status === 200)) expect(line.refused).toBeUndefined();
  });

  it("writes one line for each request, to console.log, and nothing to console.error", async () => {
    const { error } = await flow();
    expect(error).not.toHaveBeenCalled();
  });

  it("logs a failure inside the service as its kind only, to console.error, with no token in it", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const token = ref.toBase64url(ref.randomBytes(32));
    const res = await call("GET", "/account", { token, env: { DB: undefined } });
    expect(res.status).toBe(500);
    expect(error).toHaveBeenCalledTimes(1);
    const failure = JSON.parse(error.mock.calls[0][0]);
    expect(Object.keys(failure).every((k) => ["at", "route", "failure", "d1"].includes(k))).toBe(true);
    expect(failure.route).toBe("GET /account");
    for (const text of [...error.mock.calls, ...log.mock.calls].map((a) => a.join(" "))) expect(text).not.toContain(token);
    const line = JSON.parse(log.mock.calls[0][0]);
    expect(line).toMatchObject({ route: "GET /account", status: 500, refused: "error" });
  });

  describe("of a sign-in", () => {
    afterEach(standDown);

    const SIGN_IN_ROUTES = [
      "GET /sign-in", "POST /sign-in/challenge", "POST /sign-in/passkey/options", "POST /sign-in/passkey",
      "POST /sign-in/new-passkey/options", "POST /sign-in/new-passkey", "POST /sign-in/apple", "POST /sign-in/google",
      "POST /ways/passkey/options", "POST /ways/passkey", "POST /ways/apple", "POST /ways/google", "DELETE /ways/:id",
      "DELETE /session", "GET /account",
    ];

    /** Every sign-in request once, accepted and refused, with everything a line must never hold. */
    async function signInFlow() {
      const { env: on } = await providersOn();
      const world = await standIns();
      const log = vi.spyOn(console, "log").mockImplementation(() => {});
      const error = vi.spyOn(console, "error").mockImplementation(() => {});
      const sent = [];
      const send = async (method, path, options = {}) => {
        const res = await call(method, path, { ...options, env: on });
        sent.push(options.body, res.body);
        return res;
      };

      await send("GET", "/sign-in");
      // An account made with a passkey, which then signs in, once well and once with a bad signature.
      const passkey = await newPasskey();
      const forNew = (await send("POST", "/sign-in/new-passkey/options")).body;
      const made = (await send("POST", "/sign-in/new-passkey", { body: { credential: await attest(passkey, forNew.publicKey) } })).body;
      const ask = async () => (await send("POST", "/sign-in/passkey/options")).body.publicKey;
      const again = (await send("POST", "/sign-in/passkey", { body: { credential: await assert(passkey, await ask()) } })).body;
      await send("POST", "/sign-in/passkey", { body: { credential: await assert(passkey, await ask(), { signWith: await newPasskey() }) } });
      const leaking = await assert(passkey, await ask(), { clientExtensionResults: { prf: { results: { first: ref.toBase64url(passkey.prf) } } } });
      await send("POST", "/sign-in/passkey", { body: { credential: leaking } });

      // Google and Apple: a first sign-in each, and a token that is refused.
      const challenge = async () => (await send("POST", "/sign-in/challenge")).body.challenge;
      await challenge();
      const subjects = { google: freshSubject("logged-google"), apple: freshSubject("logged-apple") };
      const google = await send("POST", "/sign-in/google", { body: await providerRequest("google", on, { token: { subject: subjects.google } }) });
      const apple = await send("POST", "/sign-in/apple", { body: await providerRequest("apple", on, { token: { subject: subjects.apple }, code: "a-code-only-apple-should-see" }) });
      await send("POST", "/sign-in/google", { body: await providerRequest("google", on, { token: { claims: { aud: "another-audience.example" } } }) });
      world.down.add("https://appleid.apple.com/auth/token");
      await send("POST", "/sign-in/apple", { body: await providerRequest("apple", on) });
      world.down.clear();

      // Ways in: add one of each, remove two, and sign out.
      const forMore = (await send("POST", "/ways/passkey/options", { token: made.token })).body;
      const second = await newPasskey();
      const way = (await send("POST", "/ways/passkey", { token: made.token, body: { credential: await attest(second, forMore.publicKey) } })).body;
      const linked = { google: freshSubject("linked-google"), apple: freshSubject("linked-apple") };
      await send("POST", "/ways/google", { token: made.token, body: await providerRequest("google", on, { token: { subject: linked.google } }) });
      const appleWay = (await send("POST", "/ways/apple", { token: made.token, body: await providerRequest("apple", on, { token: { subject: linked.apple }, code: "a-second-code-for-apple" }) })).body;
      await send("DELETE", `/ways/${way.way.id}`, { token: made.token });
      await send("DELETE", `/ways/${appleWay.way.id}`, { token: made.token });
      await send("DELETE", `/ways/${crypto.randomUUID()}`, { token: made.token });
      await send("GET", "/account", { token: made.token });
      await send("DELETE", "/session", { token: again.token });
      for (const res of [google, apple]) expect(res.status).toBe(200);

      const lines = [...log.mock.calls, ...error.mock.calls].map((args) => args.join(" "));
      const secrets = [
        ...leaves(sent), ...Object.values(subjects), ...Object.values(linked), passkey.id, second.id, passkey.handle,
        ref.toBase64url(passkey.prf), on.APPLE_TEAM_ID, on.APPLE_KEY_ID, ...on.APPLE_CLIENT_IDS.split(","), ...on.GOOGLE_CLIENT_IDS.split(", "),
        ...world.calls.flatMap((c) => Object.values(c.form ?? {})).filter((v) => v.length >= 16),
        "refresh-for-a-code-only-apple-should-see", "refresh-for-a-second-code-for-apple", "reader@example.com", "A Reader",
      ];
      return { lines, error, secrets, parsed: lines.map((l) => JSON.parse(l)) };
    }

    it("holds no token, challenge, credential, signature, code, provider's id for anyone, or configured identifier in any line", async () => {
      const { lines, secrets } = await signInFlow();
      expect(lines.length).toBeGreaterThan(25);
      expect(secrets.length).toBeGreaterThan(80);
      for (const line of lines) {
        for (const secret of secrets) expect(line.includes(secret), `${line} holds ${secret.slice(0, 12)}...`).toBe(false);
      }
    });

    it("writes each line with only at, route, status, ms, and perhaps refused, and nothing to console.error", async () => {
      const { parsed, error } = await signInFlow();
      for (const line of parsed) {
        expect(Object.keys(line).sort()).toEqual("refused" in line ? ["at", "ms", "refused", "route", "status"] : ["at", "ms", "route", "status"]);
      }
      expect(error).not.toHaveBeenCalled();
    });

    it("names each route by its own pattern, and writes the word of a refusal and never its reason", async () => {
      const { parsed, lines } = await signInFlow();
      const routes = parsed.map((l) => l.route);
      for (const route of routes) expect(SIGN_IN_ROUTES, route).toContain(route);
      for (const route of SIGN_IN_ROUTES) expect(routes, route).toContain(route);
      for (const line of lines) expect(line).not.toMatch(/\/ways\/[0-9a-f]{8}/);

      const refused = (route, status) => parsed.filter((l) => l.route === route && l.status === status).map((l) => l.refused);
      expect(refused("POST /sign-in/passkey", 403)).toEqual(["passkey_refused"]);
      expect(refused("POST /sign-in/passkey", 422)).toEqual(["not_allowed"]);
      expect(refused("POST /sign-in/google", 403)).toEqual(["token_refused"]);
      expect(refused("POST /sign-in/apple", 502)).toEqual(["provider"]);
      expect(refused("DELETE /ways/:id", 410)).toEqual(["gone"]);
      // The reason a passkey or a token was refused is the client's to read, and is not logged.
      for (const line of lines) expect(line).not.toMatch(/"signature"|"audience"|prf_results|reason/);
    });
  });
});
