// "Checked and written as one step," on D1.
//
// D1 has no transaction that spans two calls: a Worker can't read, think, and
// then write inside one. What it has is batch(), which runs its statements in
// order as one SQL transaction and rolls all of them back if any fails
// (https://developers.cloudflare.com/d1/worker-api/d1-database/#batch).
//
// So every change that depends on what was just read is written like this:
//
//   1. Read the account (its kid, its lists' version, its last revision) and
//      whatever else the checks need.
//   2. Make the checks, in memory.
//   3. Send one batch whose FIRST statement is guard(): it fails unless the
//      account's numbers are still the ones read in step 1.
//
// Every change to the device and holder lists moves `lists`, every change of
// key moves `kid`, and every write to the rows moves `rev`, all in the same
// batch as the change. So "the numbers are what I read" means "nothing I
// checked has changed," and the batch either applies to exactly the state
// that was checked or does not apply at all. When the guard fails, the
// request is run again from step 1 (transact, below), and now its checks see
// the new state and refuse with the right word.

import { refuse } from "./http.js";

/** Thrown when a batch was rolled back because the account moved under it. */
export class Moved extends Error {}

/**
 * The statement that makes a batch all-or-nothing against what was read.
 * `expect` holds the account's numbers the checks relied on: any of
 * { kid, lists, rev }.
 */
export function guard(db, account, expect) {
  const where = ["id = ?"];
  const binds = [account];
  for (const column of ["kid", "lists", "rev"]) {
    if (expect[column] !== undefined) {
      where.push(`${column} = ?`);
      binds.push(expect[column]);
    }
  }
  return db
    .prepare(`INSERT INTO guard (ok) SELECT 0 WHERE NOT EXISTS (SELECT 1 FROM accounts WHERE ${where.join(" AND ")})`)
    .bind(...binds);
}

/**
 * Runs a guarded batch. A failed constraint means the account moved between
 * the read and the write: the guard's own CHECK, or a primary key or unique
 * index that a request racing this one got to first. Anything else is a real
 * failure and is thrown as it is.
 */
export async function commit(db, statements) {
  try {
    return await db.batch(statements);
  } catch (error) {
    if (/constraint/i.test(String(error?.message))) throw new Moved();
    throw error;
  }
}

/**
 * Runs `step` until its batch lands or its checks refuse. `step(again)` reads,
 * checks, and commits; `again` is true on a run after the first. After three
 * tries the account is busier than one reader's devices can make it, and the
 * client is told to try again.
 */
export async function transact(step) {
  for (let tries = 0; tries < 3; tries++) {
    try {
      return await step(tries > 0);
    } catch (error) {
      if (!(error instanceof Moved)) throw error;
    }
  }
  return refuse(503, "busy");
}

/** One JSON text holding a list of ids, for `IN (SELECT value FROM json_each(?))`: one bound value, however many ids. */
export const idList = (ids) => JSON.stringify(ids);
