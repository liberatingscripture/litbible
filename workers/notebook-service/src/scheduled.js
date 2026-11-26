// What the service does on its own, every hour (the cron trigger in
// wrangler.jsonc): it carries out the requests that have waited their seven
// days (src/waiting.js), and it sweeps what ran out.
//
// TIMING, SAID PLAINLY. A request falls due exactly seven days after it was
// made. It is carried out by the first run after that, so up to an hour
// later, and later still if Cloudflare starts a run late or Apple can't be
// reached. Until a run has carried it out, it can be canceled. Nothing here
// acts on a request before its `due`.
//
// A request that can't be carried out (Apple is down, so a token can't be
// revoked) is left as it is and tried again next hour. The run goes on to the
// others, and its log line counts the ones held.
//
// WHAT IS SWEPT: sessions, approvals, and sign-in challenges that ran out.
// Each was already dead to every request (each read checks `expires`), so
// sweeping changes no answer; it only keeps an account that never returns
// from leaving rows behind.
//
// AND THE ACCOUNTS THAT NEVER SET UP A NOTEBOOK (BVJ, 2026-11-26; Audit 9,
// SEC9-3). An account is deleted when all three hold at once:
//   - it has no notebook (`kid` 0);
//   - no session of it is live (none with `expires` still ahead; a session
//     of an account with no notebook is never extended, so it lasts thirty
//     days from the sign-in that made it, or until sign-out); and
//   - it was made more than UNUSED_DAYS ago, or, if its notebook was
//     replaced, the replacement was. (A reader who started a new notebook
//     gets the same thirty days to set it up as a new account does.)
// The sweep reads the accounts that qualify, then deletes them with one
// statement that asks all three again, so an account that set up a
// notebook, or was signed in to, or was replaced, after it was read, stays
// (test/sweep-races.test.js). Apple first, as for every account that goes
// (src/waiting.js): an account with a refresh token from Apple is deleted
// only after Apple revokes it, and stays, counted as held, while Apple
// can't be reached or isn't configured here.
//
// The one line a run logs holds counts and nothing else: no account, no id.

import { after, now } from "./http.js";
import { ProviderDown } from "./jwt.js";
import { idList } from "./db.js";
import { carryOutDelete, carryOutReplace, revokeApple } from "./waiting.js";

/** How many due requests one run carries out. The rest wait for the next run, oldest first. */
export const DUE_PER_RUN = 100;

/** How long an account with no notebook is kept once no session of it is live. BVJ, 2026-11-26. */
export const UNUSED_DAYS = 30;
const UNUSED_MS = UNUSED_DAYS * 24 * 60 * 60 * 1000;

/** How many accounts that never set up a notebook one run deletes. The rest wait for the next run, oldest first. */
export const UNUSED_PER_RUN = 100;

/**
 * True, inside a statement on `accounts`, while the account is one the sweep
 * deletes: no notebook, made (or replaced) before the cutoff, and no session
 * live at the time. Binds: the cutoff, the time.
 */
const UNUSED = `accounts.kid = 0
   AND COALESCE(accounts.replaced, accounts.created) <= ?
   AND NOT EXISTS (SELECT 1 FROM sessions s WHERE s.account = accounts.id AND s.expires > ?)`;

/** True, inside a statement on `accounts`, while the account holds a refresh token from Apple. */
const HOLDS_APPLE = "EXISTS (SELECT 1 FROM apple_tokens t JOIN ways w ON w.id = t.way WHERE w.account = accounts.id)";

/**
 * Deletes the accounts that never set up a notebook, as of `time`. Returns
 * { deleted, held, failed }: `held` counts the accounts kept because Apple
 * couldn't revoke their tokens.
 */
export async function sweepUnused(env, time) {
  const cutoff = after(time, -UNUSED_MS);
  const out = { deleted: 0, held: 0, failed: 0 };
  const { results } = await env.DB.prepare(
    `SELECT id, ${HOLDS_APPLE} AS apple FROM accounts WHERE ${UNUSED} ORDER BY created, id LIMIT ?`,
  )
    .bind(cutoff, time, UNUSED_PER_RUN)
    .all();

  // The accounts without Apple's tokens: one statement, which asks again, of each, everything the
  // read above asked, and that no token from Apple has been kept for it since.
  const plain = results.filter((row) => !row.apple).map((row) => row.id);
  if (plain.length) {
    const gone = await env.DB.prepare(
      `DELETE FROM accounts WHERE id IN (SELECT value FROM json_each(?)) AND ${UNUSED} AND NOT ${HOLDS_APPLE} RETURNING id`,
    )
      .bind(idList(plain), cutoff, time)
      .all();
    out.deleted += gone.results.length;
  }

  // The accounts with them: Apple is told first, then the account goes only if it still qualifies.
  for (const { id } of results.filter((row) => row.apple)) {
    try {
      await revokeApple(env, id);
      const gone = await env.DB.prepare(`DELETE FROM accounts WHERE id = ? AND ${UNUSED} RETURNING id`)
        .bind(id, cutoff, time)
        .first();
      if (gone) out.deleted += 1;
    } catch (error) {
      if (error instanceof ProviderDown) out.held += 1;
      else {
        out.failed += 1;
        console.error(JSON.stringify({ at: now(), job: "scheduled", failure: error?.name ?? "Error" }));
      }
    }
  }
  return out;
}

/** One run, as of `time`. Returns what it did, as counts. */
export async function runScheduled(env, time = now()) {
  const did = { deleted: 0, replaced: 0, canceled: 0, held: 0, failed: 0 };
  const { results } = await env.DB.prepare("SELECT account, what FROM waiting WHERE due <= ? ORDER BY due, account LIMIT ?")
    .bind(time, DUE_PER_RUN)
    .all();
  for (const { account, what } of results) {
    try {
      const done = what === "delete" ? await carryOutDelete(env, account, time) : await carryOutReplace(env, account, time);
      if (!done) did.canceled += 1;
      else if (what === "delete") did.deleted += 1;
      else did.replaced += 1;
    } catch (error) {
      // One request's failure never stops the run. ProviderDown is Apple; anything else is a fault
      // here, and only its kind is logged (src/index.js says why).
      if (error instanceof ProviderDown) did.held += 1;
      else {
        did.failed += 1;
        console.error(JSON.stringify({ at: now(), job: "scheduled", failure: error?.name ?? "Error" }));
      }
    }
  }

  const [sessions, approvals, challenges] = await env.DB.batch([
    env.DB.prepare("DELETE FROM sessions WHERE expires <= ?").bind(time),
    env.DB.prepare("DELETE FROM approvals WHERE expires <= ?").bind(time),
    env.DB.prepare("DELETE FROM challenges WHERE expires <= ?").bind(time),
  ]);
  const unused = await sweepUnused(env, time);
  did.failed += unused.failed;
  const swept = {
    sessions: sessions.meta.changes,
    approvals: approvals.meta.changes,
    challenges: challenges.meta.changes,
    accounts: unused.deleted,
    accountsHeld: unused.held,
  };
  return { ...did, more: results.length === DUE_PER_RUN, swept };
}

/** The Worker's scheduled handler. */
export async function scheduled(_controller, env) {
  const started = Date.now();
  try {
    const did = await runScheduled(env);
    console.log(JSON.stringify({ at: now(), job: "scheduled", ...did, ms: Date.now() - started }));
  } catch (error) {
    console.error(JSON.stringify({ at: now(), job: "scheduled", failure: error?.name ?? "Error" }));
    throw error;
  }
}
