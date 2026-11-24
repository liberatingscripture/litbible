// "Three kinds of session": which requests need which kind, and when a
// session stops being the kind it was. Every route is driven from tables, so a
// route added to src/index.js without a row here fails the coverage test.
import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import indexSource from "../src/index.js?raw";
import { hashText } from "../src/session.js";
import { call, freshAccount } from "./call.js";
import {
  approvalRequest,
  approve,
  cardFor,
  catchUp,
  changeKey,
  entryFor,
  keyChangeRequest,
  keyringFor,
  makeHolder,
  must,
  newDevice,
  proofOf,
  push,
  ref,
  rowFor,
  setUp,
  setupRequest,
  signIn,
} from "./notebook.js";

const b64 = ref.toBase64url;
const random32 = () => b64(ref.randomBytes(32));
const uuid = () => crypto.randomUUID();
const approvalId = () => [...ref.randomBytes(16)].map((b) => b.toString(16).padStart(2, "0")).join("");

/** Every route that needs a session, as [method, path]. Ids are made up: authentication comes first. */
const NEEDS_A_SESSION = [
  ["GET", "/account"],
  ["POST", "/session/proof"],
  ["POST", "/notebook"],
  ["POST", "/notebook/key"],
  ["GET", "/holders"],
  ["POST", "/holders"],
  ["GET", `/keyring?device=${uuid()}`],
  ["GET", "/devices"],
  ["POST", "/devices"],
  ["PUT", `/devices/${uuid()}`],
  ["DELETE", `/devices/${uuid()}`],
  ["GET", "/rows"],
  ["POST", "/rows"],
  ["POST", "/approvals"],
  ["GET", `/approvals/${approvalId()}`],
  ["POST", `/approvals/${approvalId()}/grant`],
  ["POST", `/approvals/${approvalId()}/accept`],
  ["POST", "/preview/passkeys"],
  ["DELETE", "/session"],
  ["DELETE", `/ways/${uuid()}`],
  ["POST", "/ways/passkey/options"],
  ["POST", "/ways/passkey"],
  ["POST", "/ways/apple"],
  ["POST", "/ways/google"],
];

/** The routes anyone may call, with no session: GET /, the preview's way in, and sign-in itself. */
const NEEDS_NO_SESSION = [
  "GET /",
  "POST /preview/session",
  "GET /sign-in",
  "POST /sign-in/challenge",
  "POST /sign-in/passkey/options",
  "POST /sign-in/passkey",
  "POST /sign-in/new-passkey/options",
  "POST /sign-in/new-passkey",
  "POST /sign-in/apple",
  "POST /sign-in/google",
];

// Apple's and Google's requests are routed only where the deployment configures them. These are
// made-up values, enough to route them: every test here is answered before one is read.
const ON = {
  GOOGLE_CLIENT_IDS: "test-google-client.example",
  APPLE_CLIENT_IDS: "test.example.app",
  APPLE_TEAM_ID: "TESTTEAM01",
  APPLE_KEY_ID: "TESTKEY001",
  APPLE_PRIVATE_KEY: "set, and never read by these tests",
};

const pattern = (path) =>
  path
    .split("?")[0]
    .replace(/^\/devices\/[^/]+$/, "/devices/:id")
    .replace(/^\/ways\/[0-9a-f]{8}-[^/]+$/, "/ways/:id")
    .replace(/^\/approvals\/[0-9a-f]{32}/, "/approvals/:id");

describe("the route table here covers every route in src/index.js", () => {
  it("has a row for each route that needs a session, and a name for each that needs none", () => {
    const routed = [...indexSource.matchAll(/\["(GET|POST|PUT|DELETE)", "([^"]+)", \w+\]/g)].map((m) => `${m[1]} ${m[2]}`);
    expect(routed.length).toBeGreaterThan(15);
    const mine = new Set(NEEDS_A_SESSION.map(([method, path]) => `${method} ${pattern(path)}`));
    const missing = routed.filter((r) => !NEEDS_NO_SESSION.includes(r) && !mine.has(r));
    expect(missing).toEqual([]);
    // And no route is in both lists, or in either without being routed.
    expect(NEEDS_NO_SESSION.filter((r) => mine.has(r))).toEqual([]);
    expect([...NEEDS_NO_SESSION, ...mine].filter((r) => !routed.includes(r))).toEqual([]);
  });
});

/** Authorization headers that carry no usable session, as [name, value-for(realToken)]. */
const BAD_HEADERS = [
  ["no Authorization header", () => undefined],
  ["an empty Authorization header", () => ""],
  ["the wrong scheme (Basic)", () => `Basic ${random32().slice(0, 43)}`],
  ["a bare token with no scheme", () => random32().slice(0, 43)],
  ["a token one character too short", () => `Bearer ${random32().slice(0, 42)}`],
  ["a token one character too long", () => `Bearer ${random32().slice(0, 43)}A`],
  ["Bearer and nothing else", () => "Bearer "],
  ["a token with a plus sign in it", () => `Bearer +${random32().slice(1, 43)}`],
  ["a token with padding in it", () => `Bearer ${random32().slice(0, 42)}=`],
  ["a token with a space in it", () => `Bearer ${random32().slice(0, 20)} ${random32().slice(0, 22)}`],
  ["a well-formed token that no session has", () => `Bearer ${random32().slice(0, 43)}`],
];

describe("neither: a request with no usable session gets nothing", () => {
  for (const [method, path] of NEEDS_A_SESSION) {
    describe(`${method} ${pattern(path)}`, () => {
      for (const [name, header] of BAD_HEADERS) {
        it(`answers sign_in to ${name}`, async () => {
          const value = header();
          const headers = value === undefined ? {} : { authorization: value };
          const res = await call(method, path, { headers, env: ON, body: method === "GET" || method === "DELETE" ? undefined : {} });
          expect(res.status).toBe(401);
          expect(res.body.error).toBe("sign_in");
        });
      }
    });
  }

  it("refuses a real token sent under the wrong scheme, where the same token works", async () => {
    const token = await signIn(freshAccount());
    expect((await call("GET", "/account", { token })).status).toBe(200);
    const res = await call("GET", "/account", { headers: { authorization: `Basic ${token}` } });
    expect(res.status).toBe(401);
    expect(res.body.error).toBe("sign_in");
  });

  it("refuses a real token with anything added after it", async () => {
    const token = await signIn(freshAccount());
    const res = await call("GET", "/account", { headers: { authorization: `Bearer ${token}x` } });
    expect(res.status).toBe(401);
    expect(res.body.error).toBe("sign_in");
  });

  it("never takes an account from the body or the address as proof of who is asking", async () => {
    const a = await setUp();
    const stranger = await signIn(freshAccount());
    const res = await call("GET", `/keyring?device=${a.device.id}`, { token: stranger, body: undefined });
    expect(res.status).toBe(404);
    expect(res.body.what).toBe("keyring");
    const holders = await must("GET", "/holders", { token: stranger });
    expect(holders.holders).toEqual([]);
  });
});

/** A session that is signed in and not open, on an account that has a notebook, and the requests it may make. */
async function closedSession() {
  const made = await setUp();
  const { account, device, held } = made;
  const closed = await signIn(account);
  const second = await newDevice(account);
  const asking = await approvalRequest(account);
  const change = await keyChangeRequest(device);
  const grantee = await newDevice(account);
  const open = [
    // The bodies pass every parse check, so that only the kind of session is in question.
    ["GET /devices", "GET", "/devices", undefined],
    ["PUT /devices/:id", "PUT", `/devices/${device.id}`, { lists: 1, kid: 1, card: await cardFor(device, held) }],
    ["POST /holders", "POST", "/holders", { lists: 1, kid: 1, holder: (await makeHolder(held, "recovery")).wire }],
    ["POST /notebook/key", "POST", "/notebook/key", change.body],
    ["GET /rows", "GET", "/rows", undefined],
    ["POST /rows", "POST", "/rows", { put: [], remove: [] }],
    [
      "POST /approvals/:id/grant",
      "POST",
      `/approvals/${approvalId()}/grant`,
      { kid: 1, card: await cardFor(grantee, held), keyring: await keyringFor(grantee.key.public, held), mac: random32() },
    ],
    // Ways to sign in: once the account has a notebook, each needs an open session, and says so
    // before it reads a body.
    ["POST /ways/passkey/options", "POST", "/ways/passkey/options", undefined],
    ["POST /ways/passkey", "POST", "/ways/passkey", {}],
    ["POST /ways/apple", "POST", "/ways/apple", {}],
    ["POST /ways/google", "POST", "/ways/google", {}],
    ["DELETE /ways/:id", "DELETE", `/ways/${uuid()}`, undefined],
  ];
  const signedIn = [
    ["GET /account", "GET", "/account", undefined, 200, undefined],
    ["POST /session/proof", "POST", "/session/proof", { device: device.id, kid: 1, proof: random32() }, 403, "wrong_proof"],
    ["POST /notebook", "POST", "/notebook", (await setupRequest({ account })).body, 409, "already_set_up"],
    ["GET /holders", "GET", "/holders", undefined, 200, undefined],
    ["GET /keyring", "GET", `/keyring?device=${device.id}`, undefined, 200, undefined],
    [
      "POST /devices",
      "POST",
      "/devices",
      { kid: 1, proof: random32(), holder: uuid(), device: await entryFor(second, held) },
      403,
      "wrong_proof",
    ],
    ["GET /approvals/:id", "GET", `/approvals/${approvalId()}`, undefined, 410, "gone"],
    ["POST /approvals", "POST", "/approvals", asking.body, 200, undefined],
    ["DELETE /devices/:id", "DELETE", `/devices/${device.id}`, undefined, 422, "not_allowed"],
    ["POST /approvals/:id/accept", "POST", `/approvals/${approvalId()}/accept`, { kid: 1, proof: random32() }, 410, "gone"],
    // Last, since it ends the session the rows above were sent from.
    ["DELETE /session", "DELETE", "/session", undefined, 200, undefined],
  ];
  return { ...made, closed, open, signedIn };
}

describe("signed in and not open", () => {
  it("answers not_open, with the current kid, to every route the interface marks open", async () => {
    const { closed, open } = await closedSession();
    expect(open.map(([name]) => name).sort()).toEqual(
      [
        "GET /devices",
        "PUT /devices/:id",
        "POST /holders",
        "POST /notebook/key",
        "GET /rows",
        "POST /rows",
        "POST /approvals/:id/grant",
        "POST /ways/passkey/options",
        "POST /ways/passkey",
        "POST /ways/apple",
        "POST /ways/google",
        "DELETE /ways/:id",
      ].sort(),
    );
    for (const [name, method, path, body] of open) {
      const res = await call(method, path, { token: closed, body, env: ON });
      expect(res.status, name).toBe(403);
      expect(res.body.error, name).toBe("not_open");
      expect(res.body.kid, name).toBe(1);
    }
  });

  it("does not change anything when it is refused for not being open", async () => {
    const { closed, open, device } = await closedSession();
    const before = await must("GET", "/devices", { token: device.token });
    for (const [, method, path, body] of open) await call(method, path, { token: closed, body, env: ON });
    const after = await must("GET", "/devices", { token: device.token });
    expect(after.lists).toBe(before.lists);
    expect(after.kid).toBe(before.kid);
    expect(after.holders.length).toBe(before.holders.length);
  });

  it("answers something other than not_open or sign_in to every route the interface marks signed in", async () => {
    const { closed, signedIn } = await closedSession();
    for (const [name, method, path, body, status, error] of signedIn) {
      const res = await call(method, path, { token: closed, body });
      expect(res.status, name).toBe(status);
      if (error) expect(res.body.error, name).toBe(error);
      expect(res.body.error, name).not.toBe("not_open");
      expect(res.body.error, name).not.toBe("sign_in");
    }
  });

  it("is the same for a device that has never proved, before and after the first notebook", async () => {
    const account = freshAccount();
    const token = await signIn(account);
    expect((await must("GET", "/account", { token })).session.open).toBe(false);
    // With no notebook there is no kid to be open for, so a session is never open.
    const res = await call("GET", "/devices", { token });
    expect(res.status).toBe(403);
    expect(res.body.error).toBe("not_open");
    expect(res.body.kid).toBe(0);
  });
});

/** Sets a session's expiry directly, since no request can make a session that is already over. */
const expire = async (token, when = new Date(Date.now() - 1000).toISOString()) => {
  const done = await env.DB.prepare("UPDATE sessions SET expires = ? WHERE token_hash = ?").bind(when, await hashText(token)).run();
  expect(done.meta.changes).toBe(1);
};

describe("an expired session", () => {
  for (const [method, path] of NEEDS_A_SESSION) {
    it(`answers sign_in at ${method} ${pattern(path)}`, async () => {
      const token = await signIn(freshAccount());
      await expire(token);
      const res = await call(method, path, { token, env: ON, body: method === "GET" || method === "DELETE" ? undefined : {} });
      expect(res.status).toBe(401);
      expect(res.body.error).toBe("sign_in");
    });
  }

  it("answers sign_in to an open session too, and not to the account's other sessions", async () => {
    const { account, device } = await setUp();
    const other = await signIn(account);
    await expire(device.token);
    expect((await call("GET", "/devices", { token: device.token })).body.error).toBe("sign_in");
    expect((await call("GET", "/account", { token: other })).status).toBe(200);
  });

  it("is still good one second before it expires", async () => {
    const token = await signIn(freshAccount());
    await expire(token, new Date(Date.now() + 60_000).toISOString());
    expect((await call("GET", "/account", { token })).status).toBe(200);
  });
});

describe("a session whose device is gone", () => {
  it("is no longer usable once its device signs out, and neither is the device's other session", async () => {
    const { account, device: first } = await setUp();
    const second = await approve(first);
    // A second sign-in proves as the same device, so the device has two sessions.
    const again = await signIn(account);
    await must("POST", "/session/proof", {
      token: again,
      body: { device: second.id, kid: 1, proof: await proofOf(second.held) },
    });
    expect((await must("GET", "/devices", { token: again })).devices.length).toBe(2);

    const out = await must("DELETE", `/devices/${second.id}`, { token: second.token });
    expect(typeof out.lists).toBe("number");
    for (const token of [second.token, again]) {
      const res = await call("GET", "/account", { token });
      expect(res.status).toBe(401);
      expect(res.body.error).toBe("sign_in");
    }
    // The first device's own session is untouched, and the list has lost the entry.
    const lists = await must("GET", "/devices", { token: first.token });
    expect(lists.devices.map((d) => d.id)).toEqual([first.id]);
  });

  it("is no longer usable once another device removes it by a change of key", async () => {
    const { account, device: first } = await setUp();
    const second = await approve(first);
    const spare = await signIn(account);
    await changeKey(first, { removeDevices: [second.id] });
    for (const route of [["GET", "/account"], ["GET", "/devices"], ["GET", "/rows"], ["GET", "/holders"]]) {
      const res = await call(route[0], route[1], { token: second.token });
      expect(res.status, route[1]).toBe(401);
      expect(res.body.error, route[1]).toBe("sign_in");
    }
    // A session that never attached to a device is not the removed device's, so it remains signed in.
    expect((await call("GET", "/account", { token: spare })).status).toBe(200);
    expect((await call("GET", "/devices", { token: first.token })).status).toBe(200);
  });

  it("does not touch sessions of another account", async () => {
    const mine = await setUp();
    const theirs = await setUp();
    const second = await approve(mine.device);
    await must("DELETE", `/devices/${second.id}`, { token: second.token });
    expect((await call("GET", "/devices", { token: theirs.device.token })).status).toBe(200);
  });
});

describe("a change of key closes every session but the one that made it", () => {
  it("leaves the session that made the change open, and closes the other device's", async () => {
    const { device: first } = await setUp();
    const second = await approve(first);
    expect((await call("GET", "/devices", { token: second.token })).status).toBe(200);

    const changed = await changeKey(first);
    expect(changed.answer.kid).toBe(2);

    const closed = await call("GET", "/devices", { token: second.token });
    expect(closed.status).toBe(403);
    expect(closed.body.error).toBe("not_open");
    expect(closed.body.kid).toBe(2);
    expect((await must("GET", "/account", { token: second.token })).session.open).toBe(false);

    expect((await must("GET", "/account", { token: first.token })).session.open).toBe(true);
    expect((await call("GET", "/devices", { token: first.token })).status).toBe(200);
    // It can still read and write rows without proving again.
    await push(first, [await rowFor(first.held)]);
  });

  it("opens the closed session again only by a proof for the new kid", async () => {
    const { device: first } = await setUp();
    const second = await approve(first);
    await changeKey(first);
    const old = await call("POST", "/session/proof", {
      token: second.token,
      body: { device: second.id, kid: 1, proof: await proofOf(second.held, 1) },
    });
    expect(old.status).toBe(409);
    expect(old.body.error).toBe("old_key");
    expect(old.body.kid).toBe(2);
    await catchUp(second);
    expect((await call("GET", "/devices", { token: second.token })).status).toBe(200);
  });
});
