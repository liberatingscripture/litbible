// The account work where two requests meet. Each test pauses one request (or
// one scheduled run) at an exact point, lets a second finish, and lets the
// first go on. Each fails if the condition it is about is taken out of the
// statement in src/waiting.js; that was checked by taking each out in turn.
import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import { runScheduled } from "../src/scheduled.js";
import { hashText } from "../src/session.js";
import { call, freshAccount } from "./call.js";
import { pausingAfter } from "./pausing.js";
import { approve, changeKey, must, newDevice, push, rowFor, setUp, setupRequest, signIn } from "./notebook.js";

const count = async (sql, ...binds) => (await env.DB.prepare(sql).bind(...binds).first()).n;
const accountOf = async (token) => (await env.DB.prepare("SELECT account FROM sessions WHERE token_hash = ?").bind(await hashText(token)).first())?.account;
const exists = async (id) => (await count("SELECT COUNT(*) AS n FROM accounts WHERE id = ?", id)) === 1;
const waitingOf = async (token) => (await must("GET", "/account", { token })).waiting;

/** Markers: SQL that only one read in the request under test holds. */
const APPLE_TOKENS_READ = "FROM apple_tokens t JOIN ways";
const WAITING_READ = "FROM waiting WHERE account = ?";
const DUE_READ = "FROM waiting WHERE due <=";

describe("DELETE /account from an open session, racing what closes it", () => {
  it("deletes nothing when a change of key closes the session after it was read: not_open, and the account whole", async () => {
    const { device } = await setUp();
    const second = await approve(device);
    await push(device, [await rowFor(device.held)]);
    const id = await accountOf(device.token);
    let ran = false;
    const DB = pausingAfter(APPLE_TOKENS_READ, async () => {
      ran = true;
      await changeKey(device);
    });
    const res = await call("DELETE", "/account", { token: second.token, env: { DB } });
    expect(ran).toBe(true);
    expect([res.status, res.body.error, res.body.kid]).toEqual([403, "not_open", 2]);
    expect(await exists(id)).toBe(true);
    expect((await must("GET", "/rows", { token: device.token })).rows).toHaveLength(1);
  });

  it("is not turned into a request that waits, even when it carried a platform", async () => {
    const { device } = await setUp();
    const second = await approve(device);
    const DB = pausingAfter(APPLE_TOKENS_READ, () => changeKey(device));
    const res = await call("DELETE", "/account?platform=ios", { token: second.token, env: { DB } });
    expect(res.body.error).toBe("not_open");
    expect(await waitingOf(device.token)).toBeNull();
  });

  it("deletes nothing when the session's device is removed after it was read: sign_in", async () => {
    const { device } = await setUp();
    const second = await approve(device);
    const id = await accountOf(device.token);
    // Removing a device changes the key, and takes the removed device's sessions with it.
    const DB = pausingAfter(APPLE_TOKENS_READ, () => changeKey(device, { removeDevices: [second.id] }));
    const res = await call("DELETE", "/account", { token: second.token, env: { DB } });
    expect([res.status, res.body.error]).toEqual([401, "sign_in"]);
    expect(await exists(id)).toBe(true);
  });

  it("deletes once, of two open devices asking at once: the second is told sign_in", async () => {
    const { device } = await setUp();
    const second = await approve(device);
    const id = await accountOf(device.token);
    let other;
    const DB = pausingAfter(APPLE_TOKENS_READ, async () => {
      other = await call("DELETE", "/account", { token: device.token });
    });
    const res = await call("DELETE", "/account", { token: second.token, env: { DB } });
    expect([other.status, other.body.deleted]).toEqual([200, true]);
    expect([res.status, res.body.error]).toEqual([401, "sign_in"]);
    expect(await exists(id)).toBe(false);
  });
});

describe("DELETE /account on an account with no notebook, racing a setup", () => {
  it("does not delete a notebook made a moment ago: the request waits instead", async () => {
    const account = freshAccount();
    const token = await signIn(account);
    const id = await accountOf(token);
    const device = await newDevice(account);
    const setup = await setupRequest({ device });
    const DB = pausingAfter(APPLE_TOKENS_READ, () => must("POST", "/notebook", { token: device.token, body: setup.body }));
    const res = await call("DELETE", "/account?platform=web", { token, env: { DB } });
    expect([res.status, res.body.deleted, res.body.waiting?.what]).toEqual([200, false, "delete"]);
    expect(await exists(id)).toBe(true);
    expect((await must("GET", "/account", { token: device.token })).kid).toBe(1);
  });

  it("and with no platform it is refused, with the new notebook untouched", async () => {
    const account = freshAccount();
    const token = await signIn(account);
    const device = await newDevice(account);
    const setup = await setupRequest({ device });
    const DB = pausingAfter(APPLE_TOKENS_READ, () => must("POST", "/notebook", { token: device.token, body: setup.body }));
    const res = await call("DELETE", "/account", { token, env: { DB } });
    expect([res.status, res.body.error, res.body.field]).toEqual([400, "bad_request", "platform"]);
    expect((await must("GET", "/account", { token: device.token })).kid).toBe(1);
  });
});

describe("two requests to wait, at once", () => {
  for (const [first, second] of [["delete", "replace"], ["replace", "delete"], ["delete", "delete"], ["replace", "replace"]]) {
    it(`records one, of a ${first} and a ${second}: the one that read first and wrote second is told exists`, async () => {
      const { account, device } = await setUp();
      const a = await signIn(account);
      const b = await signIn(account);
      const ask = (what, token, options = {}) =>
        what === "delete"
          ? call("DELETE", "/account?platform=one", { token, ...options })
          : call("POST", "/notebook/replace", { token, body: { platform: "one" }, ...options });
      let other;
      const DB = pausingAfter(WAITING_READ, async () => {
        other = await ask(second, b);
      });
      const res = await ask(first, a, { env: { DB } });
      expect(other.status).toBe(200);
      expect([res.status, res.body.error, res.body.what]).toEqual([409, "exists", "waiting"]);
      expect(await count("SELECT COUNT(*) AS n FROM waiting WHERE account = ?", await accountOf(a))).toBe(1);
      expect(await waitingOf(device.token)).toMatchObject({ what: second, mine: false });
    });
  }
});

describe("a request to wait, racing the account's deletion", () => {
  for (const what of ["delete", "replace"]) {
    it(`is told sign_in, and not that the service failed, when an open device deletes the account under a ${what}`, async () => {
      const { account, device } = await setUp();
      const closed = await signIn(account);
      const DB = pausingAfter(WAITING_READ, () => must("DELETE", "/account", { token: device.token }));
      const res =
        what === "delete"
          ? await call("DELETE", "/account?platform=web", { token: closed, env: { DB } })
          : await call("POST", "/notebook/replace", { token: closed, body: { platform: "web" }, env: { DB } });
      expect([res.status, res.body.error]).toEqual([401, "sign_in"]);
      expect(await count("SELECT COUNT(*) AS n FROM waiting")).toBe(await count("SELECT COUNT(*) AS n FROM waiting w JOIN accounts a ON a.id = w.account"));
    });
  }
});

describe("DELETE /waiting, racing", () => {
  it("cancels nothing from a session a change of key closed after it was read: not_open, and the request stands", async () => {
    const { account, device } = await setUp();
    const second = await approve(device);
    const { waiting } = await must("DELETE", "/account?platform=web", { token: await signIn(account) });
    const DB = pausingAfter(WAITING_READ, () => changeKey(device));
    const res = await call("DELETE", "/waiting", { token: second.token, env: { DB } });
    expect(res.body.error).toBe("not_open");
    expect(await waitingOf(device.token)).toEqual({ ...waiting, mine: false });
  });

  it("answers one of two cancels at once, and gone to the other", async () => {
    const { account, device } = await setUp();
    const second = await approve(device);
    await must("POST", "/notebook/replace", { token: await signIn(account), body: { platform: "web" } });
    let other;
    const DB = pausingAfter(WAITING_READ, async () => {
      other = await call("DELETE", "/waiting", { token: device.token });
    });
    const res = await call("DELETE", "/waiting", { token: second.token, env: { DB } });
    expect([other.status, other.body.canceled]).toEqual([200, "replace"]);
    expect([res.status, res.body.error, res.body.what]).toEqual([410, "gone", "waiting"]);
  });

  it("is told sign_in when the account was deleted, as due, between its read and its write", async () => {
    const { account, device } = await setUp();
    const { waiting } = await must("DELETE", "/account?platform=web", { token: await signIn(account) });
    const id = await accountOf(device.token);
    const DB = pausingAfter(WAITING_READ, () => runScheduled(env, waiting.due));
    const res = await call("DELETE", "/waiting", { token: device.token, env: { DB } });
    expect([res.status, res.body.error]).toEqual([401, "sign_in"]);
    expect(await exists(id)).toBe(false);
  });

  it("is told gone when the notebook was replaced, as due, between its read and its write", async () => {
    const { account, device } = await setUp();
    const { waiting } = await must("POST", "/notebook/replace", { token: await signIn(account), body: { platform: "web" } });
    const DB = pausingAfter(WAITING_READ, () => runScheduled(env, waiting.due));
    const res = await call("DELETE", "/waiting", { token: device.token, env: { DB } });
    expect([res.status, res.body.error, res.body.what]).toEqual([410, "gone", "waiting"]);
    expect((await must("GET", "/account", { token: device.token })).kid).toBe(0);
  });
});

describe("a scheduled run, racing a cancel", () => {
  it("deletes nothing when the request to delete is canceled after the run read it as due", async () => {
    const { account, device } = await setUp();
    await push(device, [await rowFor(device.held)]);
    const { waiting } = await must("DELETE", "/account?platform=web", { token: await signIn(account) });
    const id = await accountOf(device.token);
    let canceled;
    const DB = pausingAfter(DUE_READ, async () => {
      canceled = await must("DELETE", "/waiting", { token: device.token });
    });
    const did = await runScheduled({ ...env, DB }, waiting.due);
    expect(canceled.canceled).toBe("delete");
    expect([did.deleted, did.canceled]).toEqual([0, 1]);
    expect(await exists(id)).toBe(true);
    expect((await must("GET", "/rows", { token: device.token })).rows).toHaveLength(1);
  });

  it("replaces nothing when the request to replace is canceled after the run read it as due", async () => {
    const { account, device } = await setUp();
    await push(device, [await rowFor(device.held)]);
    const { waiting } = await must("POST", "/notebook/replace", { token: await signIn(account), body: { platform: "web" } });
    const DB = pausingAfter(DUE_READ, () => must("DELETE", "/waiting", { token: device.token }));
    const did = await runScheduled({ ...env, DB }, waiting.due);
    expect([did.replaced, did.canceled]).toEqual([0, 1]);
    const account2 = await must("GET", "/account", { token: device.token });
    expect([account2.kid, account2.session.open, account2.replaced]).toEqual([1, true, null]);
    expect((await must("GET", "/rows", { token: device.token })).rows).toHaveLength(1);
  });

  it("does not carry out a NEW request made after a cancel, which is not yet due, on the strength of the old one", async () => {
    const { account, device } = await setUp();
    const closed = await signIn(account);
    const { waiting } = await must("DELETE", "/account?platform=web", { token: closed });
    const id = await accountOf(device.token);
    // The run reads the old request as due; it is canceled, and a new one is made, due seven days from now.
    const DB = pausingAfter(DUE_READ, async () => {
      await must("DELETE", "/waiting", { token: device.token });
      await must("DELETE", "/account?platform=web", { token: closed });
    });
    // "Now," for the run, is the old request's due time: before the new one's, which was made in real time.
    const due = new Date(Date.now() + 60_000).toISOString();
    await env.DB.prepare("UPDATE waiting SET due = ? WHERE account = ?").bind(due, id).run();
    const did = await runScheduled({ ...env, DB }, due);
    expect(waiting.what).toBe("delete");
    expect(did.deleted).toBe(0);
    expect(await exists(id)).toBe(true);
  });

  it("does not replace on the strength of a request to delete, or delete on a request to replace, made in its place", async () => {
    for (const [first, second] of [["delete", "replace"], ["replace", "delete"]]) {
      const { account, device } = await setUp();
      const closed = await signIn(account);
      const ask = (what) => (what === "delete" ? must("DELETE", "/account?platform=web", { token: closed }) : must("POST", "/notebook/replace", { token: closed, body: { platform: "web" } }));
      await ask(first);
      const id = await accountOf(device.token);
      const due = new Date(Date.now() + 60_000).toISOString();
      await env.DB.prepare("UPDATE waiting SET due = ? WHERE account = ?").bind(due, id).run();
      const DB = pausingAfter(DUE_READ, async () => {
        await must("DELETE", "/waiting", { token: device.token });
        await ask(second);
        // And the new one is made due as well, so that only its kind stands between it and the run.
        await env.DB.prepare("UPDATE waiting SET due = ? WHERE account = ?").bind(due, id).run();
      });
      const did = await runScheduled({ ...env, DB }, due);
      // The run carries out what it read, or nothing. The request made in its place is for the next run.
      expect([did.deleted, did.replaced], `${first} then ${second}`).toEqual([0, 0]);
      expect(await exists(id)).toBe(true);
      const account2 = await must("GET", "/account", { token: device.token });
      expect([account2.kid, account2.waiting.what]).toEqual([1, second]);
      // It is due, by this test's own hand: taken away, so the next run here doesn't carry it out.
      await env.DB.prepare("DELETE FROM waiting WHERE account = ?").bind(id).run();
    }
  });
});

describe("a setup, racing the replacement that makes it possible", () => {
  it("answers already_set_up to a setup sent before the replacement, and accepts the same setup after it", async () => {
    const { account, device } = await setUp();
    const closed = await signIn(account);
    const { waiting } = await must("POST", "/notebook/replace", { token: closed, body: { platform: "web" } });
    const next = await setupRequest({ device: await newDevice(account, { token: closed }) });
    expect((await call("POST", "/notebook", { token: closed, body: next.body })).body.error).toBe("already_set_up");
    await runScheduled(env, waiting.due);
    expect((await must("POST", "/notebook", { token: closed, body: next.body })).kid).toBe(1);
    expect((await call("GET", "/rows", { token: device.token })).body.error).toBe("not_open");
  });
});
