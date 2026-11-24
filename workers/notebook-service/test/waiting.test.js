// "Waiting seven days": DELETE /account, POST /notebook/replace, and
// DELETE /waiting, one check at a time. What happens when a request falls
// due is in scheduled.test.js, and where two requests meet in
// waiting-races.test.js. (That each answers "sign_in" with no session is in
// sessions.test.js, which drives every route from one table.)
import { env } from "cloudflare:workers";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { hashText } from "../src/session.js";
import { WAIT_DAYS } from "../src/waiting.js";
import { call, freshAccount } from "./call.js";
import { addPasskey, signInWithPasskey, signUpWithPasskey } from "./authenticator.js";
import { APPLE_REVOKE, providersOn, signInWith, standDown, standIns } from "./idp.js";
import { approvalRequest, approve, changeKey, must, newDevice, push, rowFor, setUp, setupRequest, signIn } from "./notebook.js";

const TIME = /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/;
const DAY = 24 * 60 * 60 * 1000;
const count = async (sql, ...binds) => (await env.DB.prepare(sql).bind(...binds).first()).n;
const refusal = (res) => [res.status, res.body.error, res.body.what ?? res.body.rule ?? res.body.field ?? res.body.which];
const accountOf = async (token) => (await env.DB.prepare("SELECT account FROM sessions WHERE token_hash = ?").bind(await hashText(token)).first())?.account;
const waitingOf = async (token) => (await must("GET", "/account", { token })).waiting;

/** Every table that hangs from an account, and how many rows it holds for one. */
const TABLES = ["ways", "sessions", "devices", "holders", "rows", "approvals", "waiting"];
async function held(account) {
  const out = { accounts: await count("SELECT COUNT(*) AS n FROM accounts WHERE id = ?", account) };
  for (const table of TABLES) out[table] = await count(`SELECT COUNT(*) AS n FROM ${table} WHERE account = ?`, account);
  out.challenges = await count("SELECT COUNT(*) AS n FROM challenges WHERE account = ?", account);
  return out;
}
const NOTHING = { accounts: 0, ways: 0, sessions: 0, devices: 0, holders: 0, rows: 0, approvals: 0, waiting: 0, challenges: 0 };

describe("DELETE /account, from an open session", () => {
  it("deletes everything the service holds for the account, at once", async () => {
    const { account, device } = await setUp();
    const second = await approve(device);
    const closed = await signIn(account);
    await push(device, [await rowFor(device.held), await rowFor(device.held)]);
    const asking = await approvalRequest(account);
    await must("POST", "/approvals", { token: asking.device.token, body: asking.body });
    await must("POST", "/notebook/replace", { token: closed, body: { platform: "web" } });
    const id = await accountOf(device.token);
    const before = await held(id);
    expect(before).toMatchObject({ accounts: 1, devices: 2, holders: 1, rows: 2, approvals: 1, waiting: 1 });
    expect(before.sessions).toBeGreaterThanOrEqual(4);

    const res = await call("DELETE", "/account", { token: second.token });
    expect(res.status).toBe(200);
    expect(Object.keys(res.body)).toEqual(["time", "deleted"]);
    expect(res.body.deleted).toBe(true);
    expect(await held(id)).toEqual(NOTHING);
  });

  it("ends every session of the account, the asking one too: each is told sign_in", async () => {
    const { account, device } = await setUp();
    const second = await approve(device);
    const closed = await signIn(account);
    await must("DELETE", "/account", { token: device.token });
    for (const token of [device.token, second.token, closed]) {
      const res = await call("GET", "/account", { token });
      expect([res.status, res.body.error]).toEqual([401, "sign_in"]);
    }
  });

  it("needs no platform, and reads none", async () => {
    const { device } = await setUp();
    expect((await must("DELETE", "/account?platform=", { token: device.token })).deleted).toBe(true);
  });

  it("leaves every other account as it was", async () => {
    const mine = await setUp();
    const theirs = await setUp();
    await push(theirs.device, [await rowFor(theirs.device.held)]);
    const before = await held(await accountOf(theirs.device.token));
    await must("DELETE", "/account", { token: mine.device.token });
    expect(await held(await accountOf(theirs.device.token))).toEqual(before);
    expect((await must("GET", "/rows", { token: theirs.device.token })).rows).toHaveLength(1);
  });

  it("frees the account's name on the preview: the same name is then a new, empty account", async () => {
    const { account, device, held: keyring } = await setUp();
    await must("DELETE", "/account", { token: device.token });
    const again = await must("GET", "/account", { token: await signIn(account) });
    expect([again.notebook, again.kid, again.lists]).toEqual([null, 0, 0]);
    expect(again.notebook).not.toBe(keyring.notebook);
  });

  it("takes a passkey way in with it: the service then knows no such passkey", async () => {
    const made = await signUpWithPasskey();
    const device = await newDevice("passkey", { token: made.token });
    await must("POST", "/notebook", { token: made.token, body: (await setupRequest({ device })).body });
    await must("DELETE", "/account", { token: made.token });
    expect(await count("SELECT COUNT(*) AS n FROM ways WHERE subject = ?", made.passkey.id)).toBe(0);
    const res = await signInWithPasskey(made.passkey).catch((error) => String(error.message));
    expect(res).toContain("passkey_refused");
    expect(res).toContain("unknown");
  });

  it("is refused to a session a change of key has closed, which must wait like any other without the key", async () => {
    const { device } = await setUp();
    const second = await approve(device);
    await changeKey(device);
    const res = await call("DELETE", "/account", { token: second.token });
    expect(refusal(res)).toEqual([400, "bad_request", "platform"]);
    const waited = await must("DELETE", "/account?platform=ios", { token: second.token });
    expect(waited.deleted).toBe(false);
    expect((await must("GET", "/devices", { token: device.token })).devices).toHaveLength(2);
  });
});

describe("DELETE /account, from an account with no notebook", () => {
  it("deletes at once, with a platform or without: there is nothing to protect and no device to cancel", async () => {
    for (const query of ["", "?platform=web"]) {
      const token = await signIn(freshAccount());
      const id = await accountOf(token);
      const res = await must("DELETE", `/account${query}`, { token });
      expect(res.deleted).toBe(true);
      expect(await held(id)).toEqual(NOTHING);
      expect((await call("GET", "/account", { token })).body.error).toBe("sign_in");
    }
  });

  it("takes the account's ways in and its challenges with it", async () => {
    const made = await signUpWithPasskey();
    await addPasskey(made.token);
    await must("POST", "/ways/passkey/options", { token: made.token });
    const id = await accountOf(made.token);
    expect(await held(id)).toMatchObject({ ways: 2, challenges: 1 });
    await must("DELETE", "/account", { token: made.token });
    expect(await held(id)).toEqual(NOTHING);
  });
});

describe("DELETE /account, from a session that is signed in and no more", () => {
  it("records the request and deletes nothing: when, from what kind of device, through which way in, and due seven days on", async () => {
    const { account, device } = await setUp();
    const closed = await signIn(account);
    const id = await accountOf(closed);
    const before = await held(id);
    const started = Date.now();
    const res = await call("DELETE", "/account?platform=android", { token: closed });
    expect(res.status).toBe(200);
    expect(Object.keys(res.body)).toEqual(["time", "deleted", "waiting"]);
    expect(res.body.deleted).toBe(false);
    const { waiting } = res.body;
    expect(waiting).toEqual({ what: "delete", asked: expect.stringMatching(TIME), due: expect.stringMatching(TIME), platform: "android", through: "preview", mine: true });
    expect(Date.parse(waiting.asked)).toBeGreaterThanOrEqual(started);
    expect(Date.parse(waiting.asked)).toBeLessThanOrEqual(Date.now());
    // Seven days to the millisecond, and the constant is the number BVJ chose.
    expect(WAIT_DAYS).toBe(7);
    expect(Date.parse(waiting.due) - Date.parse(waiting.asked)).toBe(7 * DAY);
    expect(await held(id)).toEqual({ ...before, waiting: 1 });
    expect((await must("GET", "/devices", { token: device.token })).devices).toHaveLength(1);
  });

  it("is shown to every session of the account, and `mine` only to the one that asked", async () => {
    const { account, device } = await setUp();
    const second = await approve(device);
    const closed = await signIn(account);
    const other = await signIn(account);
    const { waiting } = await must("DELETE", "/account?platform=web", { token: closed });
    for (const token of [device.token, second.token, other]) {
      expect(await waitingOf(token)).toEqual({ ...waiting, mine: false });
    }
    expect(await waitingOf(closed)).toEqual(waiting);
  });

  it("names the way in the asking session came through, by kind and nothing more", async () => {
    const made = await signUpWithPasskey();
    const device = await newDevice("passkey", { token: made.token });
    await must("POST", "/notebook", { token: made.token, body: (await setupRequest({ device })).body });
    const second = (await signInWithPasskey(made.passkey)).token;
    const { waiting } = await must("DELETE", "/account?platform=ios", { token: second });
    expect(waiting.through).toBe("passkey");
    expect(JSON.stringify(waiting)).not.toContain(made.passkey.id);
  });

  it("needs a platform of 1 to 16 characters with no control character", async () => {
    const { account } = await setUp();
    const closed = await signIn(account);
    for (const query of ["", "?platform=", `?platform=${"x".repeat(17)}`, "?platform=a%0Ab", "?platform=a%00b", "?device=web"]) {
      expect(refusal(await call("DELETE", `/account${query}`, { token: closed })), query).toEqual([400, "bad_request", "platform"]);
    }
    expect(await waitingOf(closed)).toBeNull();
    expect((await must("DELETE", `/account?platform=${"x".repeat(16)}`, { token: closed })).waiting.platform).toBe("x".repeat(16));
  });

  it("is refused while a request is already waiting, whichever kind, and the first stands unchanged", async () => {
    for (const first of ["delete", "replace"]) {
      const { account } = await setUp();
      const closed = await signIn(account);
      const other = await signIn(account);
      const made =
        first === "delete"
          ? (await must("DELETE", "/account?platform=web", { token: closed })).waiting
          : (await must("POST", "/notebook/replace", { token: closed, body: { platform: "web" } })).waiting;
      for (const token of [closed, other]) {
        expect(refusal(await call("DELETE", "/account?platform=ios", { token }))).toEqual([409, "exists", "waiting"]);
      }
      expect(await waitingOf(closed)).toEqual(made);
    }
  });

  it("makes no call to Apple: nothing is revoked until the account goes", async () => {
    const { env: on } = await providersOn();
    const world = await standIns();
    try {
      const apple = await signInWith("apple", on);
      const device = await newDevice("apple", { token: apple.token });
      await must("POST", "/notebook", { token: apple.token, body: (await setupRequest({ device })).body });
      const closed = (await signInWith("apple", on, { token: { subject: apple.subject } })).token;
      await must("DELETE", "/account?platform=ios", { token: closed, env: on });
      expect(world.calls.filter((c) => c.url === APPLE_REVOKE)).toHaveLength(0);
      expect(await count("SELECT COUNT(*) AS n FROM apple_tokens WHERE way = ?", apple.way.id)).toBe(1);
    } finally {
      standDown();
    }
  });
});

describe("DELETE /account, and Apple", () => {
  let world;
  let on;
  beforeEach(async () => {
    ({ env: on } = await providersOn());
    world = await standIns();
  });
  afterEach(standDown);

  /** An account that signs in with Apple through two clients, with a notebook, its device open. */
  async function appleAccount() {
    const apple = await signInWith("apple", on, { code: "one" });
    await signInWith("apple", on, { token: { subject: apple.subject, claims: { aud: "test.example.web" } }, code: "two" });
    const device = await newDevice("apple", { token: apple.token });
    await must("POST", "/notebook", { token: apple.token, body: (await setupRequest({ device })).body });
    return { ...apple, id: await accountOf(apple.token) };
  }

  it("revokes every refresh token first, one for each client, and then deletes", async () => {
    const apple = await appleAccount();
    expect((await must("DELETE", "/account", { token: apple.token, env: on })).deleted).toBe(true);
    const revoked = world.calls.filter((c) => c.url === APPLE_REVOKE).map((c) => [c.form.client_id, c.form.token, c.form.token_type_hint]);
    expect(revoked.sort()).toEqual([
      ["test.example.app", "refresh-for-one", "refresh_token"],
      ["test.example.web", "refresh-for-two", "refresh_token"],
    ]);
    expect(await held(apple.id)).toEqual(NOTHING);
    expect(await count("SELECT COUNT(*) AS n FROM apple_tokens WHERE way = ?", apple.way.id)).toBe(0);
  });

  it("keeps the account, whole, when Apple can't be told, and deletes it once Apple answers", async () => {
    const apple = await appleAccount();
    const before = await held(apple.id);
    for (const fail of [() => world.down.add(APPLE_REVOKE), () => (world.answers.revoke = () => [400, { error: "invalid_client" }]), () => (world.answers.revoke = () => [500, null])]) {
      world.down.clear();
      fail();
      expect(refusal(await call("DELETE", "/account", { token: apple.token, env: on }))).toEqual([502, "provider", "apple"]);
      expect(await held(apple.id)).toEqual(before);
    }
    expect(await count("SELECT COUNT(*) AS n FROM apple_tokens WHERE way = ?", apple.way.id)).toBe(2);
    world.answers.revoke = () => [200, null];
    expect((await must("DELETE", "/account", { token: apple.token, env: on })).deleted).toBe(true);
  });

  it("keeps the account where the deployment no longer has Apple's key, with no call to Apple", async () => {
    const apple = await appleAccount();
    const res = await call("DELETE", "/account", { token: apple.token, env: { ...on, APPLE_PRIVATE_KEY: undefined } });
    expect(refusal(res)).toEqual([502, "provider", "apple"]);
    expect(world.calls.filter((c) => c.url === APPLE_REVOKE)).toHaveLength(0);
    expect((await held(apple.id)).accounts).toBe(1);
  });

  it("revokes for an account with no notebook too", async () => {
    const apple = await signInWith("apple", on, { code: "lone" });
    expect((await must("DELETE", "/account", { token: apple.token, env: on })).deleted).toBe(true);
    expect(world.calls.filter((c) => c.url === APPLE_REVOKE).map((c) => c.form.token)).toEqual(["refresh-for-lone"]);
  });

  it("makes no call to Apple for an account that never signed in with Apple", async () => {
    const { device } = await setUp();
    await must("DELETE", "/account", { token: device.token, env: on });
    expect(world.calls).toHaveLength(0);
  });

  it("lets the same Apple account start again afterward: a new, empty account, and a new code traded", async () => {
    const apple = await appleAccount();
    await must("DELETE", "/account", { token: apple.token, env: on });
    const again = await signInWith("apple", on, { token: { subject: apple.subject }, code: "three" });
    expect(again.created).toBe(true);
    expect((await must("GET", "/account", { token: again.token })).notebook).toBeNull();
    expect(await accountOf(again.token)).not.toBe(apple.id);
  });
});

describe("POST /notebook/replace", () => {
  it("records the request, due seven days on, and changes nothing else", async () => {
    const { account, device } = await setUp();
    await push(device, [await rowFor(device.held)]);
    const closed = await signIn(account);
    const id = await accountOf(closed);
    const before = await held(id);
    const res = await call("POST", "/notebook/replace", { token: closed, body: { platform: "web" } });
    expect(res.status).toBe(200);
    expect(Object.keys(res.body)).toEqual(["time", "waiting"]);
    expect(res.body.waiting).toEqual({ what: "replace", asked: expect.stringMatching(TIME), due: expect.stringMatching(TIME), platform: "web", through: "preview", mine: true });
    expect(Date.parse(res.body.waiting.due) - Date.parse(res.body.waiting.asked)).toBe(7 * DAY);
    expect(await held(id)).toEqual({ ...before, waiting: 1 });
    const account2 = await must("GET", "/account", { token: device.token });
    expect([account2.kid, account2.lists, account2.session.open]).toEqual([1, 1, true]);
    expect((await must("GET", "/rows", { token: device.token })).rows).toHaveLength(1);
  });

  it("is refused on an account with no notebook, whatever it sent", async () => {
    const token = await signIn(freshAccount());
    for (const body of [{ platform: "web" }, {}, "not json"]) {
      expect(refusal(await call("POST", "/notebook/replace", { token, body }))).toEqual([409, "no_notebook", undefined]);
    }
  });

  it("is refused to an open session, whatever it sent: a device with the key has nothing to replace", async () => {
    const { device } = await setUp();
    for (const body of [{ platform: "web" }, {}, "not json"]) {
      expect(refusal(await call("POST", "/notebook/replace", { token: device.token, body }))).toEqual([422, "not_allowed", "already_open"]);
    }
    expect(await waitingOf(device.token)).toBeNull();
  });

  it("needs a platform of 1 to 16 characters with no control character", async () => {
    const { account } = await setUp();
    const closed = await signIn(account);
    for (const platform of [undefined, null, "", 7, ["web"], "x".repeat(17), "a\nb", "a\u0000b", "a\u0085b"]) {
      expect(refusal(await call("POST", "/notebook/replace", { token: closed, body: { platform } })), String(platform)).toEqual([400, "bad_request", "platform"]);
    }
    expect(await waitingOf(closed)).toBeNull();
  });

  it("is refused while a request is already waiting, whichever kind", async () => {
    for (const first of ["delete", "replace"]) {
      const { account } = await setUp();
      const closed = await signIn(account);
      if (first === "delete") await must("DELETE", "/account?platform=web", { token: closed });
      else await must("POST", "/notebook/replace", { token: closed, body: { platform: "web" } });
      const made = await waitingOf(closed);
      expect(refusal(await call("POST", "/notebook/replace", { token: await signIn(account), body: { platform: "ios" } }))).toEqual([409, "exists", "waiting"]);
      expect(await waitingOf(closed)).toEqual(made);
    }
  });

  it("may be asked again once the first was canceled", async () => {
    const { account, device } = await setUp();
    const closed = await signIn(account);
    await must("POST", "/notebook/replace", { token: closed, body: { platform: "web" } });
    await must("DELETE", "/waiting", { token: device.token });
    expect((await must("POST", "/notebook/replace", { token: closed, body: { platform: "web" } })).waiting.what).toBe("replace");
  });
});

describe("DELETE /waiting", () => {
  it("cancels from any open session, and every session then sees none waiting", async () => {
    for (const what of ["delete", "replace"]) {
      const { account, device } = await setUp();
      const second = await approve(device);
      const closed = await signIn(account);
      if (what === "delete") await must("DELETE", "/account?platform=web", { token: closed });
      else await must("POST", "/notebook/replace", { token: closed, body: { platform: "web" } });
      const res = await call("DELETE", "/waiting", { token: second.token });
      expect(res.status).toBe(200);
      expect(Object.keys(res.body)).toEqual(["time", "canceled"]);
      expect(res.body.canceled).toBe(what);
      for (const token of [device.token, second.token, closed]) expect(await waitingOf(token)).toBeNull();
    }
  });

  it("cancels from the session that asked, which is not open", async () => {
    const { account } = await setUp();
    const closed = await signIn(account);
    await must("DELETE", "/account?platform=web", { token: closed });
    expect((await must("DELETE", "/waiting", { token: closed })).canceled).toBe("delete");
    expect(await waitingOf(closed)).toBeNull();
  });

  it("is refused to any other session without the key, and the request stands", async () => {
    const { account } = await setUp();
    const closed = await signIn(account);
    const thief = await signIn(account);
    const { waiting } = await must("POST", "/notebook/replace", { token: closed, body: { platform: "web" } });
    const res = await call("DELETE", "/waiting", { token: thief });
    expect([res.status, res.body.error, res.body.kid]).toEqual([403, "not_open", 1]);
    expect(await waitingOf(closed)).toEqual(waiting);
  });

  it("is refused to a session of another account, whose own account has none waiting", async () => {
    const mine = await setUp();
    const closed = await signIn(mine.account);
    const { waiting } = await must("DELETE", "/account?platform=web", { token: closed });
    const theirs = await setUp();
    expect(refusal(await call("DELETE", "/waiting", { token: theirs.device.token }))).toEqual([410, "gone", "waiting"]);
    expect(await waitingOf(closed)).toEqual(waiting);
  });

  it("answers gone when none is waiting: to an open session, and on an account with no notebook", async () => {
    const { device } = await setUp();
    expect(refusal(await call("DELETE", "/waiting", { token: device.token }))).toEqual([410, "gone", "waiting"]);
    expect(refusal(await call("DELETE", "/waiting", { token: await signIn(freshAccount()) }))).toEqual([410, "gone", "waiting"]);
  });

  it("answers gone to a second cancel", async () => {
    const { account, device } = await setUp();
    await must("DELETE", "/account?platform=web", { token: await signIn(account) });
    await must("DELETE", "/waiting", { token: device.token });
    expect(refusal(await call("DELETE", "/waiting", { token: device.token }))).toEqual([410, "gone", "waiting"]);
  });

  it("is refused to a session that a change of key has closed", async () => {
    const { account, device } = await setUp();
    const second = await approve(device);
    await must("DELETE", "/account?platform=web", { token: await signIn(account) });
    await changeKey(device);
    expect((await call("DELETE", "/waiting", { token: second.token })).body.error).toBe("not_open");
    expect((await must("DELETE", "/waiting", { token: device.token })).canceled).toBe("delete");
  });
});

describe("a request that waits changes nothing until it is carried out", () => {
  it("leaves every device working: rows, a new device, a change of key, and the request still waiting after each", async () => {
    const { account, device } = await setUp();
    const closed = await signIn(account);
    const { waiting } = await must("DELETE", "/account?platform=web", { token: closed });
    await push(device, [await rowFor(device.held)]);
    const second = await approve(device);
    await changeKey(device);
    expect((await must("GET", "/rows", { token: device.token })).rows).toHaveLength(1);
    expect(await waitingOf(second.token)).toEqual({ ...waiting, mine: false });
  });

  it("outlives the session that asked: signing that session out cancels nothing", async () => {
    const { account, device } = await setUp();
    const closed = await signIn(account);
    const { waiting } = await must("POST", "/notebook/replace", { token: closed, body: { platform: "web" } });
    await must("DELETE", "/session", { token: closed });
    expect(await waitingOf(device.token)).toEqual({ ...waiting, mine: false });
  });
});

describe("deleting a large notebook", () => {
  // README, "What is left," asked for this before the one statement is relied on. It runs on
  // workerd's local SQLite, which shows that the cascade is complete and how the statement
  // scales; it can't show D1's own limits over a network, which the README says plainly.
  it("deletes 20,000 rows of about a kilobyte, 100 devices, and 20 holders in the one statement, and leaves no row behind", async () => {
    const { device } = await setUp();
    const id = await accountOf(device.token);
    const numbers = "WITH RECURSIVE n(i) AS (SELECT 1 UNION ALL SELECT i + 1 FROM n WHERE i < ?)";
    await env.DB.batch([
      env.DB.prepare(
        `${numbers} INSERT INTO rows (account, id, rev, v, modified, kid, nonce, ct, size)
         SELECT ?, 'large-' || i, i, 1, '2026-11-24T00:00:00.000Z', 1, 'AAAAAAAAAAAAAAAA', hex(randomblob(512)), 1024 FROM n`,
      ).bind(20000, id),
      env.DB.prepare(
        `${numbers} INSERT INTO devices (account, id, card_kid, card_nonce, card_ct, keyring_kid, keyring_enc, keyring_ct, added, added_how, seen)
         SELECT ?, 'device-' || i, 1, 'n', 'c', 1, 'e', 'k', 't', 'approval', 't' FROM n`,
      ).bind(99, id),
      env.DB.prepare(
        `${numbers} INSERT INTO holders (account, id, kind, credential, record_nonce, record_ct, card_kid, card_nonce, card_ct, keyring_kid, keyring_enc, keyring_ct, added)
         SELECT ?, 'holder-' || i, 'passkey', 'credential-' || i, 'n', 'c', 1, 'n', 'c', 1, 'e', 'k', 't' FROM n`,
      ).bind(19, id),
    ]);
    const other = await setUp();
    await push(other.device, [await rowFor(other.device.held)]);
    expect(await held(id)).toMatchObject({ rows: 20000, devices: 100, holders: 20 });

    const started = Date.now();
    expect((await must("DELETE", "/account", { token: device.token })).deleted).toBe(true);
    const took = Date.now() - started;
    expect(await held(id)).toEqual(NOTHING);
    expect(await count("SELECT COUNT(*) AS n FROM rows WHERE id LIKE 'large-%'")).toBe(0);
    expect((await must("GET", "/rows", { token: other.device.token })).rows).toHaveLength(1);
    // Far inside any limit locally; the number is here so that a change that makes it slow shows.
    expect(took).toBeLessThan(10_000);
    console.info(`deleting 20,000 rows took ${took} ms locally`);
  });
});
