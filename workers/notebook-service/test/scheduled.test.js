// The scheduled handler: the requests that have waited seven days are carried
// out, no sooner, and what ran out is swept (src/scheduled.js).
//
// TIME IS TESTED TWO WAYS, because each alone would leave something out.
// runScheduled(env, time) is given the instant, so a test can stand exactly on
// `due` and one millisecond before it. And the Worker's own `scheduled`
// handler, which reads the clock, is run with the clock itself moved (only
// `Date` is faked), so the path a real cron run takes is the one tested.
import { env } from "cloudflare:workers";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import worker from "../src/index.js";
import { DUE_PER_RUN, UNUSED_DAYS, UNUSED_PER_RUN, runScheduled } from "../src/scheduled.js";
import { hashText } from "../src/session.js";
import { call, freshAccount } from "./call.js";
import { signUpWithPasskey } from "./authenticator.js";
import { APPLE_REVOKE, providersOn, signInWith, standDown, standIns } from "./idp.js";
import { approvalRequest, approve, must, newDevice, proofOf, push, rowFor, setUp, setupRequest, signIn } from "./notebook.js";

const DAY = 24 * 60 * 60 * 1000;
const count = async (sql, ...binds) => (await env.DB.prepare(sql).bind(...binds).first()).n;
const accountOf = async (token) => (await env.DB.prepare("SELECT account FROM sessions WHERE token_hash = ?").bind(await hashText(token)).first())?.account;
const exists = async (id) => (await count("SELECT COUNT(*) AS n FROM accounts WHERE id = ?", id)) === 1;
const at = (time, ms) => new Date(Date.parse(time) + ms).toISOString();

/** A notebook with rows, a second device, and a request waiting from a session without the key. */
async function waiting(what, { platform = "web" } = {}) {
  const made = await setUp();
  await push(made.device, [await rowFor(made.device.held), await rowFor(made.device.held)]);
  const closed = await signIn(made.account);
  const request =
    what === "delete"
      ? (await must("DELETE", `/account?platform=${platform}`, { token: closed })).waiting
      : (await must("POST", "/notebook/replace", { token: closed, body: { platform } })).waiting;
  return { ...made, closed, request, id: await accountOf(closed) };
}

/** Other tests' leftovers must not be carried out or counted here: every run below is about one account. */
beforeEach(async () => {
  await env.DB.prepare("DELETE FROM waiting").run();
});

describe("a request to delete, when it falls due", () => {
  it("is not carried out one millisecond before it is due, and is at the instant it is due", async () => {
    const w = await waiting("delete");
    for (const early of [w.request.asked, at(w.request.asked, DAY), at(w.request.asked, 6 * DAY), at(w.request.due, -1)]) {
      const did = await runScheduled(env, early);
      expect([did.deleted, did.replaced, did.canceled, did.held, did.failed], early).toEqual([0, 0, 0, 0, 0]);
      expect(await exists(w.id), early).toBe(true);
    }
    const did = await runScheduled(env, w.request.due);
    expect(did.deleted).toBe(1);
    expect(await exists(w.id)).toBe(false);
  });

  it("deletes everything the service holds for the account, and ends every session", async () => {
    const w = await waiting("delete");
    await runScheduled(env, w.request.due);
    for (const table of ["ways", "sessions", "devices", "holders", "rows", "approvals", "waiting"]) {
      expect(await count(`SELECT COUNT(*) AS n FROM ${table} WHERE account = ?`, w.id), table).toBe(0);
    }
    for (const token of [w.device.token, w.closed]) {
      expect((await call("GET", "/account", { token })).body.error).toBe("sign_in");
    }
  });

  it("is carried out by a run that comes late, however late", async () => {
    const w = await waiting("delete");
    expect((await runScheduled(env, at(w.request.due, 30 * DAY))).deleted).toBe(1);
    expect(await exists(w.id)).toBe(false);
  });

  it("is not carried out once it was canceled, and a second run finds nothing to do", async () => {
    const w = await waiting("delete");
    await must("DELETE", "/waiting", { token: w.device.token });
    const did = await runScheduled(env, at(w.request.due, DAY));
    expect([did.deleted, did.canceled]).toEqual([0, 0]);
    expect(await exists(w.id)).toBe(true);
    expect((await must("GET", "/rows", { token: w.device.token })).rows).toHaveLength(2);
  });

  it("can still be canceled after it is due, until a run has carried it out", async () => {
    const w = await waiting("delete");
    vi.useFakeTimers({ toFake: ["Date"] });
    try {
      vi.setSystemTime(Date.parse(w.request.due) + 20 * 60 * 1000);
      // Past due, and no run yet. The asking session is not open and was never made longer, but it has 23 days left.
      expect((await must("DELETE", "/waiting", { token: w.closed })).canceled).toBe("delete");
      await worker.scheduled({ scheduledTime: Date.now(), cron: "17 * * * *" }, env, {});
    } finally {
      vi.useRealTimers();
    }
    expect(await exists(w.id)).toBe(true);
  });

  it("leaves every other account alone, one with a request not yet due included", async () => {
    const due = await waiting("delete");
    const later = await waiting("delete");
    const none = await setUp();
    await env.DB.prepare("UPDATE waiting SET due = ? WHERE account = ?").bind(at(due.request.due, 1), later.id).run();
    expect((await runScheduled(env, due.request.due)).deleted).toBe(1);
    expect(await exists(later.id)).toBe(true);
    expect((await must("GET", "/account", { token: later.device.token })).waiting.what).toBe("delete");
    expect((await must("GET", "/account", { token: none.device.token })).kid).toBe(1);
  });
});

describe("the Worker's own scheduled handler, by the clock", () => {
  afterEach(() => vi.useRealTimers());

  it("does nothing six days and twenty-three hours on, and carries the request out seven days on", async () => {
    const w = await waiting("delete");
    const asked = Date.parse(w.request.asked);
    vi.useFakeTimers({ toFake: ["Date"] });

    vi.setSystemTime(asked + 7 * DAY - 60 * 60 * 1000);
    await worker.scheduled({ scheduledTime: Date.now(), cron: "17 * * * *" }, env, {});
    expect(await exists(w.id)).toBe(true);

    vi.setSystemTime(asked + 7 * DAY - 1);
    await worker.scheduled({ scheduledTime: Date.now(), cron: "17 * * * *" }, env, {});
    expect(await exists(w.id)).toBe(true);

    vi.setSystemTime(asked + 7 * DAY);
    await worker.scheduled({ scheduledTime: Date.now(), cron: "17 * * * *" }, env, {});
    expect(await exists(w.id)).toBe(false);
  });

  it("logs one line of counts for a run, with no account and no id in it", async () => {
    const w = await waiting("delete");
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(Date.parse(w.request.due));
    try {
      await worker.scheduled({ scheduledTime: Date.now(), cron: "17 * * * *" }, env, {});
      expect(error).not.toHaveBeenCalled();
      const lines = log.mock.calls.map(([line]) => line);
      expect(lines).toHaveLength(1);
      const line = JSON.parse(lines[0]);
      expect(Object.keys(line)).toEqual(["at", "job", "deleted", "replaced", "canceled", "held", "failed", "more", "swept", "ms"]);
      expect(line).toMatchObject({ job: "scheduled", deleted: 1, replaced: 0, canceled: 0, held: 0, failed: 0, more: false });
      expect(Object.keys(line.swept)).toEqual(["sessions", "approvals", "challenges", "accounts", "accountsHeld"]);
      for (const secret of [w.id, w.device.id, w.held.notebook, w.closed, w.device.token, w.account]) expect(lines[0]).not.toContain(secret);
    } finally {
      log.mockRestore();
      error.mockRestore();
    }
  });

  it("is what the Worker exports as its scheduled handler, beside fetch", () => {
    expect(typeof worker.scheduled).toBe("function");
    expect(typeof worker.fetch).toBe("function");
  });
});

describe("a request to replace, when it falls due", () => {
  it("is not carried out before it is due, and is at the instant it is due", async () => {
    const w = await waiting("replace");
    expect((await runScheduled(env, at(w.request.due, -1))).replaced).toBe(0);
    expect((await must("GET", "/account", { token: w.device.token })).kid).toBe(1);
    expect((await runScheduled(env, w.request.due)).replaced).toBe(1);
    expect((await must("GET", "/account", { token: w.device.token })).kid).toBe(0);
  });

  it("deletes the notebook's records, keys, lists, and approvals, and keeps the account, its ways in, and its sessions", async () => {
    const w = await waiting("replace", { platform: "android" });
    await approve(w.device);
    const asking = await approvalRequest(w.account);
    await must("POST", "/approvals", { token: asking.device.token, body: asking.body });
    const ways = (await must("GET", "/account", { token: w.device.token })).ways;
    const sessions = await count("SELECT COUNT(*) AS n FROM sessions WHERE account = ?", w.id);

    await runScheduled(env, w.request.due);
    for (const table of ["devices", "holders", "rows", "approvals", "waiting"]) {
      expect(await count(`SELECT COUNT(*) AS n FROM ${table} WHERE account = ?`, w.id), table).toBe(0);
    }
    // And the account's counts of its rows, which the ceiling reads (src/rows.js).
    expect(await env.DB.prepare("SELECT row_count, row_bytes FROM accounts WHERE id = ?").bind(w.id).first()).toEqual({ row_count: 0, row_bytes: 0 });
    expect(await count("SELECT COUNT(*) AS n FROM sessions WHERE account = ?", w.id)).toBe(sessions);
    const account = await must("GET", "/account", { token: w.device.token });
    expect(account).toMatchObject({ notebook: null, kid: 0, ways, waiting: null, session: { open: false, device: null } });
    // When, from what kind of device, and through which kind of way in: what an old device tells its reader.
    expect(account.replaced).toEqual({ when: w.request.due, platform: "android", through: "preview" });
    expect((await must("GET", "/holders", { token: w.closed })).holders).toEqual([]);
    expect((await call("GET", `/keyring?device=${w.device.id}`, { token: w.device.token })).status).toBe(404);
  });

  it("moves the lists' version, so a request that read the old lists can't land on the new account", async () => {
    const w = await waiting("replace");
    const before = (await must("GET", "/account", { token: w.device.token })).lists;
    await runScheduled(env, w.request.due);
    expect((await must("GET", "/account", { token: w.device.token })).lists).toBe(before + 1);
  });

  it("lets a first device set up again, with a new notebook id and kid 1", async () => {
    const w = await waiting("replace");
    await runScheduled(env, w.request.due);
    const device = await newDevice(w.account, { token: w.closed });
    const next = await setupRequest({ device });
    const made = await must("POST", "/notebook", { token: w.closed, body: next.body });
    expect(made.kid).toBe(1);
    expect(made.notebook).not.toBe(w.held.notebook);
    const account = await must("GET", "/account", { token: w.closed });
    expect(account.replaced).toMatchObject({ platform: "web" });
    expect((await must("GET", "/rows", { token: w.closed })).rows).toEqual([]);
  });

  it("closes every session of the old notebook: one that proved the old kid 1 is not open on the new kid 1", async () => {
    const w = await waiting("replace");
    await runScheduled(env, w.request.due);
    // The new notebook is set up by another device, which lists a device under the OLD device's id.
    const device = await newDevice(w.account, { token: w.closed });
    device.id = w.device.id;
    await must("POST", "/notebook", { token: w.closed, body: (await setupRequest({ device })).body });
    // The old device's session proved kid 1 of the old notebook, and its id has an entry again.
    const old = await must("GET", "/account", { token: w.device.token });
    expect(old.kid).toBe(1);
    expect(old.session).toMatchObject({ open: false, device: null });
    expect((await call("GET", "/rows", { token: w.device.token })).body.error).toBe("not_open");
    // And its old key's proof opens nothing.
    const res = await call("POST", "/session/proof", { token: w.device.token, body: { device: w.device.id, kid: 1, proof: await proofOf(w.held) } });
    expect(res.body.error).toBe("wrong_proof");
  });

  it("is not carried out once it was canceled", async () => {
    const w = await waiting("replace");
    await must("DELETE", "/waiting", { token: w.device.token });
    expect((await runScheduled(env, at(w.request.due, DAY))).replaced).toBe(0);
    expect((await must("GET", "/rows", { token: w.device.token })).rows).toHaveLength(2);
    expect((await must("GET", "/account", { token: w.device.token })).replaced).toBeNull();
  });

  it("makes no call to Apple: the ways in stay, and so do their tokens", async () => {
    const { env: on } = await providersOn();
    const world = await standIns();
    try {
      const apple = await signInWith("apple", on);
      const device = await newDevice("apple", { token: apple.token });
      await must("POST", "/notebook", { token: apple.token, body: (await setupRequest({ device })).body });
      const closed = (await signInWith("apple", on, { token: { subject: apple.subject } })).token;
      const { waiting: request } = await must("POST", "/notebook/replace", { token: closed, env: on, body: { platform: "ios" } });
      expect(request.through).toBe("apple");
      expect((await runScheduled({ ...env, ...on }, request.due)).replaced).toBe(1);
      expect(world.calls.filter((c) => c.url === APPLE_REVOKE)).toHaveLength(0);
      expect(await count("SELECT COUNT(*) AS n FROM apple_tokens WHERE way = ?", apple.way.id)).toBe(1);
      expect((await must("GET", "/account", { token: closed })).replaced.through).toBe("apple");
    } finally {
      standDown();
    }
  });
});

describe("a request to delete that is due, and Apple", () => {
  let world;
  let on;
  beforeEach(async () => {
    ({ env: on } = await providersOn());
    world = await standIns();
  });
  afterEach(standDown);

  async function appleWaiting() {
    const apple = await signInWith("apple", on, { code: "held" });
    const device = await newDevice("apple", { token: apple.token });
    await must("POST", "/notebook", { token: apple.token, body: (await setupRequest({ device })).body });
    const closed = (await signInWith("apple", on, { token: { subject: apple.subject } })).token;
    const { waiting: request } = await must("DELETE", "/account?platform=ios", { token: closed, env: on });
    return { apple, request, id: await accountOf(closed) };
  }

  it("revokes Apple's tokens first, then deletes", async () => {
    const w = await appleWaiting();
    expect((await runScheduled({ ...env, ...on }, w.request.due)).deleted).toBe(1);
    expect(world.calls.filter((c) => c.url === APPLE_REVOKE).map((c) => c.form.token)).toEqual(["refresh-for-held"]);
    expect(await exists(w.id)).toBe(false);
  });

  it("holds the account while Apple can't be told, hour after hour, and deletes it on the first run after Apple answers", async () => {
    const w = await appleWaiting();
    world.down.add(APPLE_REVOKE);
    for (const hours of [0, 1, 2, 30]) {
      const did = await runScheduled({ ...env, ...on }, at(w.request.due, hours * 60 * 60 * 1000));
      expect([did.deleted, did.held, did.failed]).toEqual([0, 1, 0]);
      expect(await exists(w.id)).toBe(true);
    }
    expect(await count("SELECT COUNT(*) AS n FROM waiting WHERE account = ?", w.id)).toBe(1);
    world.down.clear();
    expect((await runScheduled({ ...env, ...on }, at(w.request.due, 31 * 60 * 60 * 1000))).deleted).toBe(1);
    expect(await exists(w.id)).toBe(false);
  });

  it("holds the account where the deployment has lost Apple's key, with no call to Apple", async () => {
    const w = await appleWaiting();
    const did = await runScheduled({ ...env, ...on, APPLE_PRIVATE_KEY: undefined }, w.request.due);
    expect([did.deleted, did.held]).toEqual([0, 1]);
    expect(world.calls.filter((c) => c.url === APPLE_REVOKE)).toHaveLength(0);
    expect(await exists(w.id)).toBe(true);
  });

  it("goes on to the other requests that are due when one is held", async () => {
    const stuck = await appleWaiting();
    const other = await waiting("delete");
    const third = await waiting("replace");
    world.down.add(APPLE_REVOKE);
    const time = at(third.request.due, 1000);
    const did = await runScheduled({ ...env, ...on }, time);
    expect([did.deleted, did.replaced, did.held]).toEqual([1, 1, 1]);
    expect([await exists(stuck.id), await exists(other.id), await exists(third.id)]).toEqual([true, false, true]);
  });
});

describe("a run that fails on one request", () => {
  it("logs the failure's kind and nothing else, counts it, and carries out the rest", async () => {
    const broken = await waiting("delete");
    const fine = await waiting("delete");
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    // The database fails on the one statement that deletes the first account, as a fault would.
    const failing = {
      prepare(sql) {
        const statement = env.DB.prepare(sql);
        if (!sql.startsWith("DELETE FROM accounts")) return statement;
        return {
          bind(...values) {
            if (values[0] === broken.id) throw new Error(`a fault that quotes ${broken.id}`);
            return statement.bind(...values);
          },
        };
      },
      batch: (statements) => env.DB.batch(statements),
    };
    try {
      const did = await runScheduled({ ...env, DB: failing }, at(fine.request.due, 1000));
      expect([did.deleted, did.failed]).toEqual([1, 1]);
      expect([await exists(broken.id), await exists(fine.id)]).toEqual([true, false]);
      expect(error).toHaveBeenCalledTimes(1);
      const line = error.mock.calls[0][0];
      expect(Object.keys(JSON.parse(line))).toEqual(["at", "job", "failure"]);
      expect(line).not.toContain(broken.id);
    } finally {
      error.mockRestore();
    }
  });
});

describe("how many a run carries out", () => {
  it("takes the oldest first, at most DUE_PER_RUN, says there are more, and finishes them on the next run", async () => {
    // Empty accounts with a request each, written straight to the tables: a run needs only those.
    const time = "2031-01-01T00:00:00.000Z";
    const n = DUE_PER_RUN + 5;
    const label = freshAccount("many");
    const statements = [];
    for (let i = 0; i < n; i++) {
      const id = `${label}-${String(i).padStart(4, "0")}`;
      statements.push(env.DB.prepare("INSERT INTO accounts (id, created, notebook, kid) VALUES (?, ?, ?, 1)").bind(id, time, crypto.randomUUID()));
      statements.push(
        env.DB.prepare("INSERT INTO waiting (account, what, asked, due, platform, through, session) VALUES (?, 'delete', ?, ?, 'web', NULL, 'none')").bind(
          id,
          time,
          // Due one second apart, the last made first, so "oldest first" is not the order they were written in.
          new Date(Date.parse(time) + (n - i) * 1000).toISOString(),
        ),
      );
    }
    await env.DB.batch(statements);
    const left = () => count("SELECT COUNT(*) AS n FROM accounts WHERE id LIKE ?", `${label}-%`);

    const first = await runScheduled(env, at(time, DAY));
    expect([first.deleted, first.more]).toEqual([DUE_PER_RUN, true]);
    expect(await left()).toBe(5);
    // The five left are the five due last: the first five written.
    const kept = (await env.DB.prepare("SELECT id FROM accounts WHERE id LIKE ? ORDER BY id").bind(`${label}-%`).all()).results.map((r) => r.id);
    expect(kept).toEqual([0, 1, 2, 3, 4].map((i) => `${label}-${String(i).padStart(4, "0")}`));
    const second = await runScheduled(env, at(time, DAY));
    expect([second.deleted, second.more]).toEqual([5, false]);
    expect(await left()).toBe(0);
  });
});

describe("the sweep", () => {
  const PAST = "2020-01-01T00:00:00.000Z";

  it("deletes sessions that ran out, and no session still in time", async () => {
    const account = freshAccount();
    const dead = await signIn(account);
    const live = await signIn(account);
    const id = await accountOf(live);
    await env.DB.prepare("UPDATE sessions SET expires = ? WHERE token_hash = ?").bind(PAST, await hashText(dead)).run();
    const did = await runScheduled(env);
    expect(did.swept.sessions).toBeGreaterThanOrEqual(1);
    expect(await count("SELECT COUNT(*) AS n FROM sessions WHERE account = ?", id)).toBe(1);
    expect((await call("GET", "/account", { token: live })).status).toBe(200);
    expect((await call("GET", "/account", { token: dead })).body.error).toBe("sign_in");
  });

  it("sweeps at the instant a session ends, and not a millisecond before: the same instant a request stops accepting it", async () => {
    const token = await signIn(freshAccount());
    const id = await accountOf(token);
    const { expires } = await env.DB.prepare("SELECT expires FROM sessions WHERE account = ?").bind(id).first();
    await runScheduled(env, at(expires, -1));
    expect(await count("SELECT COUNT(*) AS n FROM sessions WHERE account = ?", id)).toBe(1);
    await runScheduled(env, expires);
    expect(await count("SELECT COUNT(*) AS n FROM sessions WHERE account = ?", id)).toBe(0);
  });

  it("deletes approvals that ran out, and none still in time", async () => {
    const { account, device } = await setUp();
    const id = await accountOf(device.token);
    const old = await approvalRequest(account);
    const fresh = await approvalRequest(account);
    await must("POST", "/approvals", { token: old.device.token, body: old.body });
    await must("POST", "/approvals", { token: fresh.device.token, body: fresh.body });
    await env.DB.prepare("UPDATE approvals SET expires = ? WHERE account = ? AND id = ?").bind(PAST, id, old.id).run();
    expect((await runScheduled(env)).swept.approvals).toBeGreaterThanOrEqual(1);
    const left = (await env.DB.prepare("SELECT id FROM approvals WHERE account = ?").bind(id).all()).results.map((r) => r.id);
    expect(left).toEqual([fresh.id]);
  });

  it("deletes sign-in challenges that ran out, and none still in time", async () => {
    const made = await signUpWithPasskey();
    const old = (await must("POST", "/ways/passkey/options", { token: made.token })).publicKey.challenge;
    await env.DB.prepare("UPDATE challenges SET expires = ? WHERE id = ?").bind(PAST, old).run();
    const fresh = (await must("POST", "/sign-in/passkey/options")).publicKey.challenge;
    // The request above swept as it made its own; put the old one back to show the run does it too.
    await env.DB.prepare("INSERT OR REPLACE INTO challenges (id, purpose, expires) VALUES (?, 'passkey_sign_in', ?)").bind(old, PAST).run();
    expect((await runScheduled(env)).swept.challenges).toBeGreaterThanOrEqual(1);
    expect(await count("SELECT COUNT(*) AS n FROM challenges WHERE id = ?", old)).toBe(0);
    expect(await count("SELECT COUNT(*) AS n FROM challenges WHERE id = ?", fresh)).toBe(1);
  });

  it("deletes no account, no way in, no device, and no row, whatever ran out", async () => {
    const { device } = await setUp();
    await push(device, [await rowFor(device.held)]);
    const id = await accountOf(device.token);
    await env.DB.prepare("UPDATE sessions SET expires = ? WHERE account = ?").bind(PAST, id).run();
    await runScheduled(env);
    expect(await exists(id)).toBe(true);
    for (const table of ["ways", "devices", "holders", "rows"]) {
      expect(await count(`SELECT COUNT(*) AS n FROM ${table} WHERE account = ?`, id), table).toBe(1);
    }
  });
});

describe("the sweep of accounts that never set up a notebook (BVJ, 2026-11-26)", () => {
  const PAST = "2020-01-01T00:00:00.000Z";
  const ago = (days) => new Date(Date.now() - days * DAY).toISOString();
  const later = (a, b) => (a > b ? a : b);

  /** An account with no notebook, signed in once: its id, its token, and the first instant it may be swept. */
  async function unused(name = freshAccount("unused")) {
    const token = await signIn(name);
    const id = await accountOf(token);
    const { created } = await env.DB.prepare("SELECT created FROM accounts WHERE id = ?").bind(id).first();
    const { expires } = await env.DB.prepare("SELECT expires FROM sessions WHERE account = ?").bind(id).first();
    return { name, token, id, created, expires, ready: later(at(created, UNUSED_DAYS * DAY), expires) };
  }

  it("keeps the account for thirty days, and until its last session ends, and deletes it at the first run after both", async () => {
    const u = await unused();
    // The session of an account with no notebook is never made longer: it ends thirty days after the sign-in.
    expect(Date.parse(u.expires) - Date.parse(u.created)).toBeLessThan(UNUSED_DAYS * DAY + 1000);
    for (const early of [u.created, at(u.created, 29 * DAY), at(u.ready, -1)]) {
      await runScheduled(env, early);
      expect(await exists(u.id), early).toBe(true);
    }
    const did = await runScheduled(env, u.ready);
    expect(did.swept.accounts).toBeGreaterThanOrEqual(1);
    expect(await exists(u.id)).toBe(false);
    for (const table of ["ways", "sessions"]) {
      expect(await count(`SELECT COUNT(*) AS n FROM ${table} WHERE account = ?`, u.id), table).toBe(0);
    }
  });

  it("keeps an old account while any session of it is live: a reader who signs in again starts the wait again", async () => {
    const u = await unused();
    await env.DB.prepare("UPDATE accounts SET created = ? WHERE id = ?").bind(PAST, u.id).run();
    await env.DB.prepare("UPDATE sessions SET expires = ? WHERE account = ?").bind(PAST, u.id).run();
    const again = await signIn(u.name);
    await runScheduled(env);
    expect(await exists(u.id)).toBe(true);
    expect((await must("GET", "/account", { token: again })).kid).toBe(0);
    // Signed out: nothing live, and the account is long past thirty days.
    await must("DELETE", "/session", { token: again });
    expect((await runScheduled(env)).swept.accounts).toBeGreaterThanOrEqual(1);
    expect(await exists(u.id)).toBe(false);
  });

  it("keeps an account made less than thirty days ago, though it was signed out of at once", async () => {
    const u = await unused();
    await must("DELETE", "/session", { token: u.token });
    await env.DB.prepare("UPDATE accounts SET created = ? WHERE id = ?").bind(ago(UNUSED_DAYS - 1), u.id).run();
    await runScheduled(env);
    expect(await exists(u.id)).toBe(true);
    await env.DB.prepare("UPDATE accounts SET created = ? WHERE id = ?").bind(ago(UNUSED_DAYS), u.id).run();
    await runScheduled(env);
    expect(await exists(u.id)).toBe(false);
  });

  it("never deletes an account with a notebook, however old, with every session ended", async () => {
    const { device } = await setUp();
    const id = await accountOf(device.token);
    await env.DB.prepare("UPDATE accounts SET created = ? WHERE id = ?").bind(PAST, id).run();
    await env.DB.prepare("UPDATE sessions SET expires = ? WHERE account = ?").bind(PAST, id).run();
    await runScheduled(env);
    expect(await exists(id)).toBe(true);
  });

  it("gives an account whose notebook was replaced thirty days from the replacement, as a new account has", async () => {
    const w = await waiting("replace");
    await env.DB.prepare("UPDATE accounts SET created = ? WHERE id = ?").bind(PAST, w.id).run();
    await runScheduled(env, w.request.due);
    // Every session has ended by the end of the thirty days, and only the replacement's time keeps it until then.
    await runScheduled(env, at(w.request.due, UNUSED_DAYS * DAY - 1));
    expect(await exists(w.id)).toBe(true);
    await runScheduled(env, at(w.request.due, UNUSED_DAYS * DAY));
    expect(await exists(w.id)).toBe(false);
  });

  it("takes the oldest first, at most UNUSED_PER_RUN, and the rest on the next run", async () => {
    const label = freshAccount("old");
    const n = UNUSED_PER_RUN + 5;
    const statements = [];
    for (let i = 0; i < n; i++) {
      // Made a second apart, the first written made last, and older than any other account here.
      const made = new Date(Date.parse("2019-01-01T00:00:00.000Z") + (n - i) * 1000).toISOString();
      statements.push(env.DB.prepare("INSERT INTO accounts (id, created) VALUES (?, ?)").bind(`${label}-${String(i).padStart(4, "0")}`, made));
    }
    await env.DB.batch(statements);
    const left = async () =>
      (await env.DB.prepare("SELECT id FROM accounts WHERE id LIKE ? ORDER BY id").bind(`${label}-%`).all()).results.map((r) => r.id);

    expect((await runScheduled(env)).swept.accounts).toBe(UNUSED_PER_RUN);
    expect(await left()).toEqual([0, 1, 2, 3, 4].map((i) => `${label}-${String(i).padStart(4, "0")}`));
    await runScheduled(env);
    expect(await left()).toEqual([]);
  });

  it("counts what it swept in the hour's line, as `swept.accounts`", async () => {
    const u = await unused();
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(Date.parse(u.ready));
    try {
      await worker.scheduled({ scheduledTime: Date.now(), cron: "17 * * * *" }, env, {});
      const line = JSON.parse(log.mock.calls[0][0]);
      expect(line.swept.accounts).toBeGreaterThanOrEqual(1);
      expect(typeof line.swept.accountsHeld).toBe("number");
      expect(log.mock.calls[0][0]).not.toContain(u.id);
    } finally {
      vi.useRealTimers();
      log.mockRestore();
    }
    expect(await exists(u.id)).toBe(false);
  });
});

describe("the sweep of accounts that never set up a notebook, and Apple", () => {
  let world;
  let on;
  beforeEach(async () => {
    ({ env: on } = await providersOn());
    world = await standIns();
  });
  afterEach(standDown);

  /** An account made by signing in with Apple, with a refresh token kept, and no notebook, made long ago and signed out of. */
  async function appleUnused() {
    const apple = await signInWith("apple", on, { code: `sweep-${freshAccount()}` });
    const id = await accountOf(apple.token);
    await env.DB.prepare("UPDATE accounts SET created = ? WHERE id = ?").bind("2020-01-01T00:00:00.000Z", id).run();
    await must("DELETE", "/session", { token: apple.token, env: on });
    expect(await count("SELECT COUNT(*) AS n FROM apple_tokens WHERE way = ?", apple.way.id)).toBe(1);
    return { apple, id, refresh: world.refreshFor(apple.body.code) };
  }

  it("revokes Apple's token first, then deletes", async () => {
    const u = await appleUnused();
    const did = await runScheduled({ ...env, ...on });
    expect(did.swept.accounts).toBeGreaterThanOrEqual(1);
    expect(world.calls.filter((c) => c.url === APPLE_REVOKE).map((c) => c.form.token)).toContain(u.refresh);
    expect(await exists(u.id)).toBe(false);
  });

  it("keeps the account, counted as held, while Apple can't be reached, and deletes it on the first run after Apple answers", async () => {
    const u = await appleUnused();
    world.down.add(APPLE_REVOKE);
    for (let hour = 0; hour < 3; hour++) {
      const did = await runScheduled({ ...env, ...on });
      expect(did.swept.accountsHeld).toBeGreaterThanOrEqual(1);
      expect(did.failed).toBe(0);
      expect(await exists(u.id)).toBe(true);
    }
    expect(await count("SELECT COUNT(*) AS n FROM apple_tokens WHERE way = ?", u.apple.way.id)).toBe(1);
    world.down.clear();
    await runScheduled({ ...env, ...on });
    expect(await exists(u.id)).toBe(false);
  });

  it("keeps the account where Apple is off, with no call to Apple: no token is ever dropped unrevoked", async () => {
    const u = await appleUnused();
    for (const off of [{ APPLE_PRIVATE_KEY: undefined }, { APPLE_CLIENT_IDS: undefined, APPLE_TEAM_ID: undefined, APPLE_KEY_ID: undefined, APPLE_PRIVATE_KEY: undefined }]) {
      const did = await runScheduled({ ...env, ...on, ...off });
      expect(did.swept.accountsHeld).toBeGreaterThanOrEqual(1);
      expect(await exists(u.id)).toBe(true);
    }
    expect(world.calls.filter((c) => c.url === APPLE_REVOKE)).toHaveLength(0);
  });

  it("deletes the accounts without Apple's tokens while one with them is held", async () => {
    const held = await appleUnused();
    const plain = await signIn(freshAccount("plain"));
    const plainId = await accountOf(plain);
    await env.DB.prepare("UPDATE accounts SET created = ? WHERE id = ?").bind("2020-01-01T00:00:00.000Z", plainId).run();
    await must("DELETE", "/session", { token: plain });
    world.down.add(APPLE_REVOKE);
    await runScheduled({ ...env, ...on });
    expect([await exists(held.id), await exists(plainId)]).toEqual([true, false]);
  });
});