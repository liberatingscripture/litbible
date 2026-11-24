// Deleting an account, replacing a notebook, and the seven days some of those
// requests wait (STUDY-DESK-ENCRYPTION.md, "The service's interface":
// "Waiting seven days"; and "Deleting the account").
//
// THE RULE: what a session may do at once depends on whether it has proved
// the notebook's key.
//
//   open              DELETE /account deletes everything, now.
//   signed in, and    DELETE /account and POST /notebook/replace are RECORDED
//   no more           and wait seven days. GET /account shows the request to
//                     every session of the account, and any open session can
//                     cancel it (DELETE /waiting). So a stolen sign-in can't
//                     take a reader's notebook away while they look the other
//                     way for a day.
//   no notebook yet   DELETE /account deletes at once: there is nothing to
//                     protect, and no device that could cancel.
//
// A request that falls due is carried out by the scheduled handler
// (src/scheduled.js), which runs every hour. Until it has run, the request
// can still be canceled.
//
// APPLE FIRST. Before an account goes, every refresh token Apple gave for its
// ways in is revoked with Apple (revokeApple, below). If Apple can't be
// reached the account stays, and the client is told to try again.
//
// Each write here is one statement or one batch that carries its own
// condition (src/db.js): the session is still open, the request is still
// waiting, none is waiting yet. A request racing it either lands first, and
// this one is run again against the new state, or lands after.

import { after, answer, notAllowed, now, refuse } from "./http.js";
import { LIMITS, needText } from "./check.js";
import { Moved, commit, guard, transact } from "./db.js";
import { authenticate, changing, needNotebook } from "./session.js";
import { ProviderDown } from "./jwt.js";
import { appleOn, appleRevoke } from "./providers.js";

/** How long a request from a session that can't open the notebook waits. BVJ, 2026-11-23. */
export const WAIT_DAYS = 7;
const WAIT_MS = WAIT_DAYS * 24 * 60 * 60 * 1000;

/**
 * True, inside a statement, while the session is open: attached to a device
 * that has an entry, proved for the account's current kid, and in time.
 * Binds: the token hash, the account, the time.
 */
const OPEN_NOW = `EXISTS (
  SELECT 1 FROM sessions s
    JOIN accounts a ON a.id = s.account
    JOIN devices d ON d.account = s.account AND d.id = s.device
   WHERE s.token_hash = ? AND s.account = ? AND a.kid > 0 AND s.open_kid = a.kid AND s.expires > ?)`;

/** A waiting request as an answer carries it. `mine` says whether the asking session made it. */
export const waitingOut = (row, tokenHash) =>
  row
    ? { what: row.what, asked: row.asked, due: row.due, platform: row.platform, through: row.through, mine: row.session === tokenHash }
    : null;

/** The account's waiting request, or null. */
export const readWaiting = (db, account) =>
  db.prepare("SELECT what, asked, due, platform, through, session FROM waiting WHERE account = ?").bind(account).first();

/**
 * Revokes, with Apple, every refresh token kept for the account's ways in,
 * and forgets each as it is revoked. Throws ProviderDown if Apple can't be
 * reached, or if there is a token to revoke and Apple isn't configured here;
 * the account must then stay.
 *
 * A token is forgotten once revoked so that what the service holds stays
 * true if the delete that follows doesn't happen (the session stopped being
 * open, the request was canceled): the reader's next Apple sign-in trades a
 * new code, as a first one does.
 */
export async function revokeApple(env, account) {
  const { results } = await env.DB.prepare(
    "SELECT t.way, t.client, t.token FROM apple_tokens t JOIN ways w ON w.id = t.way WHERE w.account = ?",
  )
    .bind(account)
    .all();
  if (results.length === 0) return 0;
  if (!appleOn(env)) throw new ProviderDown();
  for (const { way, client, token } of results) {
    await appleRevoke(env, { client, token });
    await env.DB.prepare("DELETE FROM apple_tokens WHERE way = ? AND client = ? AND token = ?").bind(way, client, token).run();
  }
  return results.length;
}

/** Records a request that waits. "None is already waiting" is the table's primary key. */
async function record(env, auth, what, platform) {
  if (await readWaiting(env.DB, auth.account)) refuse(409, "exists", { what: "waiting" });
  const way = auth.way
    ? await env.DB.prepare("SELECT kind FROM ways WHERE id = ? AND account = ?").bind(auth.way, auth.account).first()
    : null;
  const asked = now();
  const row = { what, asked, due: after(asked, WAIT_MS), platform, through: way?.kind ?? null, session: auth.tokenHash };
  await commit(env.DB, [
    // The account still has the notebook the request is about.
    guard(env.DB, auth.account, { kid: auth.kid }),
    env.DB.prepare("INSERT INTO waiting (account, what, asked, due, platform, through, session) VALUES (?, ?, ?, ?, ?, ?, ?)").bind(
      auth.account,
      row.what,
      row.asked,
      row.due,
      row.platform,
      row.through,
      row.session,
    ),
  ]);
  return waitingOut(row, auth.tokenHash);
}

/**
 * DELETE /account, from a signed-in session.
 *
 * Open, or an account with no notebook: Apple's tokens are revoked, then
 * everything the service holds for the account is deleted, in one statement
 * (every table hangs from `accounts`). Answers { deleted: true }.
 *
 * Signed in and no more, on an account with a notebook: the request is
 * recorded with `?platform=` (the kind of device, 1 to 16 characters) and
 * waits seven days. Answers { deleted: false, waiting }.
 */
export async function deleteAccount({ request, env, url }) {
  let auth = await authenticate(request, env);
  const wasOpen = auth.open;
  let revoked = false;
  return transact(async (again) => {
    if (again) auth = await authenticate(request, env);
    // A session that was open when it asked, and was closed while it was being answered (a change
    // of key a moment ago), is told so. Its request to delete at once is never quietly turned into
    // one that waits.
    if (wasOpen && !auth.open) refuse(403, "not_open", { kid: auth.kid });
    if (!auth.open && auth.kid > 0) {
      const platform = needText(url.searchParams.get("platform"), "platform", LIMITS.platformChars);
      return answer({ deleted: false, waiting: await record(env, auth, "delete", platform) });
    }

    // Apple is told before the account goes, so a token is never dropped unrevoked. Done once,
    // however many times the step is tried.
    if (!revoked) {
      try {
        await revokeApple(env, auth.account);
      } catch (error) {
        if (error instanceof ProviderDown) refuse(502, "provider", { which: "apple" });
        throw error;
      }
      revoked = true;
    }
    // One statement: the account goes only if what was just checked still holds. An open session
    // must still be open (a change of key, or its device's removal, a moment ago closes it), and
    // an account with no notebook must still have none.
    const gone = auth.open
      ? await env.DB.prepare(`DELETE FROM accounts WHERE id = ? AND ${OPEN_NOW} RETURNING id`)
          .bind(auth.account, auth.tokenHash, auth.account, now())
          .first()
      : await env.DB.prepare("DELETE FROM accounts WHERE id = ? AND kid = 0 RETURNING id").bind(auth.account).first();
    if (!gone) throw new Moved();
    return answer({ deleted: true });
  });
}

/**
 * POST /notebook/replace, from a session that is signed in and not open:
 * { platform }. "Start a new notebook," for a reader who can't open the one
 * the account has. Recorded, and carried out seven days on.
 */
export function postReplace({ request, env }) {
  return changing(
    request,
    env,
    (body) => ({ platform: needText(body.platform, "platform", LIMITS.platformChars) }),
    async (auth, { platform }) => answer({ waiting: await record(env, auth, "replace", platform) }),
    // Before the body is read: there must be a notebook, and a device that has its key has
    // nothing to replace (it can delete the account, or change the key).
    (auth) => (needNotebook(auth).open ? notAllowed("already_open") : auth),
  );
}

/**
 * DELETE /waiting, from an open session, or from the session that made the
 * request: cancels it. Any other session is "not_open".
 */
export async function deleteWaiting({ request, env }) {
  let auth = await authenticate(request, env);
  return transact(async (again) => {
    if (again) auth = await authenticate(request, env);
    const row = await readWaiting(env.DB, auth.account);
    // An account with no notebook has no key to prove, and never a request waiting.
    if (!auth.open && auth.kid > 0 && row?.session !== auth.tokenHash) refuse(403, "not_open", { kid: auth.kid });
    if (!row) refuse(410, "gone", { what: "waiting" });
    const canceled = await env.DB.prepare(`DELETE FROM waiting WHERE account = ? AND (session = ? OR ${OPEN_NOW}) RETURNING what`)
      .bind(auth.account, auth.tokenHash, auth.tokenHash, auth.account, now())
      .first();
    // Carried out or canceled a moment ago, or this session was closed: read again and say which.
    if (!canceled) throw new Moved();
    return answer({ canceled: canceled.what });
  });
}

/* ── When a request falls due (called by src/scheduled.js) ──────────────── */

/**
 * Carries out a request to delete that is due at `time`. Returns true if the
 * account was deleted, false if the request was canceled first. Throws
 * ProviderDown, and leaves everything, if Apple can't be reached.
 */
export async function carryOutDelete(env, account, time) {
  await revokeApple(env, account);
  const gone = await env.DB.prepare(
    "DELETE FROM accounts WHERE id IN (SELECT account FROM waiting WHERE account = ? AND what = 'delete' AND due <= ?) RETURNING id",
  )
    .bind(account, time)
    .first();
  return gone !== null;
}

/**
 * Carries out a request to replace that is due at `time`: the notebook's
 * records, keys, lists, and approvals go; the account and its ways in stay;
 * every session is signed in and no more; and POST /notebook works again.
 * Returns true if it was done, false if the request was canceled first.
 *
 * Every session's proof is forgotten with the key it was for. The next
 * notebook's first key is kid 1 again, and a session that proved the old
 * kid 1 must not be open on the new one.
 */
export async function carryOutReplace(env, account, time) {
  const db = env.DB;
  try {
    await commit(db, [
      // Fails, and rolls the batch back, unless the request is still waiting and due.
      db.prepare("INSERT INTO guard (ok) SELECT 0 WHERE NOT EXISTS (SELECT 1 FROM waiting WHERE account = ? AND what = 'replace' AND due <= ?)").bind(
        account,
        time,
      ),
      db.prepare("DELETE FROM rows WHERE account = ?").bind(account),
      db.prepare("DELETE FROM devices WHERE account = ?").bind(account),
      db.prepare("DELETE FROM holders WHERE account = ?").bind(account),
      db.prepare("DELETE FROM approvals WHERE account = ?").bind(account),
      db.prepare("UPDATE sessions SET device = NULL, open_kid = 0, proof_failures = 0 WHERE account = ?").bind(account),
      db.prepare(
        `UPDATE accounts
            SET notebook = NULL, kid = 0, proof_hash = NULL, lists = lists + 1, replaced = ?,
                replaced_platform = (SELECT platform FROM waiting WHERE account = accounts.id),
                replaced_through = (SELECT through FROM waiting WHERE account = accounts.id)
          WHERE id = ?`,
      ).bind(time, account),
      db.prepare("DELETE FROM waiting WHERE account = ?").bind(account),
    ]);
  } catch (error) {
    if (error instanceof Moved) return false;
    throw error;
  }
  return true;
}
