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
// The one line a run logs holds counts and nothing else: no account, no id.

import { now } from "./http.js";
import { ProviderDown } from "./jwt.js";
import { carryOutDelete, carryOutReplace } from "./waiting.js";

/** How many due requests one run carries out. The rest wait for the next run, oldest first. */
export const DUE_PER_RUN = 100;

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
  const swept = { sessions: sessions.meta.changes, approvals: approvals.meta.changes, challenges: challenges.meta.changes };
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
