// The sweep of accounts that never set up a notebook (src/scheduled.js,
// sweepUnused), where something changes an account between the run's read
// and its delete. Each test pauses the run right after it has read the
// accounts that qualify, changes one thing about one of them, and lets the
// run go on. Each fails if the condition it is about is taken out of the
// statement that deletes; that was checked by taking each out in turn.
import { env } from "cloudflare:workers";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { sweepUnused } from "../src/scheduled.js";
import { hashText } from "../src/session.js";
import { freshAccount } from "./call.js";
import { pausingAfter } from "./pausing.js";
import { APPLE_REVOKE, providersOn, signInWith, standDown, standIns } from "./idp.js";
import { must, newDevice, setupRequest, signIn } from "./notebook.js";

const PAST = "2020-01-01T00:00:00.000Z";
const count = async (sql, ...binds) => (await env.DB.prepare(sql).bind(...binds).first()).n;
const accountOf = async (token) => (await env.DB.prepare("SELECT account FROM sessions WHERE token_hash = ?").bind(await hashText(token)).first())?.account;
const exists = async (id) => (await count("SELECT COUNT(*) AS n FROM accounts WHERE id = ?", id)) === 1;
const now = () => new Date().toISOString();

/** Markers: SQL that only one read in the run holds. */
const CANDIDATES_READ = "AS apple FROM accounts WHERE";
// The sweep's own read names apple_tokens too; this is revokeApple's (src/waiting.js).
const APPLE_TOKENS_READ = "SELECT t.way, t.client, t.token FROM apple_tokens";

/** An account the sweep would delete now: no notebook, made long ago, and signed out of. */
async function qualifying() {
  const name = freshAccount("race");
  const token = await signIn(name);
  const id = await accountOf(token);
  await env.DB.prepare("UPDATE accounts SET created = ? WHERE id = ?").bind(PAST, id).run();
  await must("DELETE", "/session", { token });
  return { name, id };
}

/** Ends every session of an account, as signing out of each would. */
const endSessions = (id) => env.DB.prepare("UPDATE sessions SET expires = ? WHERE account = ?").bind(PAST, id).run();

describe("the sweep, racing what makes an account stay", () => {
  it("deletes nothing that set up a notebook after the run read it", async () => {
    const u = await qualifying();
    const DB = pausingAfter(CANDIDATES_READ, async () => {
      // Signed in, set up, and signed out again, all between the read and the delete: only the notebook is new.
      const token = await signIn(u.name);
      const device = await newDevice(u.name, { token });
      await must("POST", "/notebook", { token, body: (await setupRequest({ device })).body });
      await endSessions(u.id);
    });
    await sweepUnused({ ...env, DB }, now());
    expect(await exists(u.id)).toBe(true);
    expect(await count("SELECT kid AS n FROM accounts WHERE id = ?", u.id)).toBe(1);
  });

  it("deletes nothing that was signed in to after the run read it", async () => {
    const u = await qualifying();
    let token;
    const DB = pausingAfter(CANDIDATES_READ, async () => {
      token = await signIn(u.name);
    });
    await sweepUnused({ ...env, DB }, now());
    expect(await exists(u.id)).toBe(true);
    expect((await must("GET", "/account", { token })).kid).toBe(0);
  });

  it("deletes nothing whose notebook was replaced after the run read it", async () => {
    const u = await qualifying();
    const time = now();
    const DB = pausingAfter(CANDIDATES_READ, async () => {
      // What a replacement carried out at this instant leaves (src/waiting.js, carryOutReplace).
      // No request can reach this state through the interface in the gap, since a replacement
      // needs a notebook; the run that carries it out can, so the statement must not rest on the read.
      await env.DB.prepare("UPDATE accounts SET replaced = ? WHERE id = ?").bind(time, u.id).run();
    });
    await sweepUnused({ ...env, DB }, time);
    expect(await exists(u.id)).toBe(true);
  });

  it("deletes nothing that came to hold a token from Apple after the run read it", async () => {
    const u = await qualifying();
    const DB = pausingAfter(CANDIDATES_READ, async () => {
      // A token kept with no session: what an Apple way added, and then signed out of, would leave.
      const way = crypto.randomUUID();
      await env.DB.batch([
        env.DB.prepare("INSERT INTO ways (id, account, kind, subject, created) VALUES (?, ?, 'apple', ?, ?)").bind(way, u.id, `race-${way}`, now()),
        env.DB.prepare("INSERT INTO apple_tokens (way, client, token, created) VALUES (?, 'test.example.app', 'refresh-race', ?)").bind(way, now()),
      ]);
    });
    await sweepUnused({ ...env, DB }, now());
    expect(await exists(u.id)).toBe(true);
    expect(await count("SELECT COUNT(*) AS n FROM apple_tokens t JOIN ways w ON w.id = t.way WHERE w.account = ?", u.id)).toBe(1);
  });

  it("deletes the account when nothing changed in the gap: the pause itself keeps nothing", async () => {
    const u = await qualifying();
    let ran = false;
    const DB = pausingAfter(CANDIDATES_READ, async () => {
      ran = true;
    });
    await sweepUnused({ ...env, DB }, now());
    expect(ran).toBe(true);
    expect(await exists(u.id)).toBe(false);
  });
});

describe("the sweep of an account with Apple's token, racing a sign-in", () => {
  let on;
  let world;
  beforeEach(async () => {
    ({ env: on } = await providersOn());
    world = await standIns();
  });
  afterEach(standDown);

  it("revokes, then deletes nothing, when the account is signed in to while Apple is being told", async () => {
    const apple = await signInWith("apple", on, { code: `race-${freshAccount()}` });
    const id = await accountOf(apple.token);
    // Older than any other account here, so it is the first the run tells Apple about.
    await env.DB.prepare("UPDATE accounts SET created = ? WHERE id = ?").bind("2010-01-01T00:00:00.000Z", id).run();
    await must("DELETE", "/session", { token: apple.token, env: on });
    let again;
    const DB = pausingAfter(APPLE_TOKENS_READ, async () => {
      again = await signInWith("apple", on, { token: { subject: apple.subject } });
    });
    await sweepUnused({ ...env, ...on, DB }, now());
    // The token the run read was revoked (the sign-in, trading a new code, may revoke as well).
    expect(world.calls.filter((c) => c.url === APPLE_REVOKE).map((c) => c.form.token)).toContain(world.refreshFor(apple.body.code));
    expect(await exists(id)).toBe(true);
    expect((await must("GET", "/account", { token: again.token, env: on })).kid).toBe(0);
  });
});
