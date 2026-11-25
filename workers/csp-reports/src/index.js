// Where litbible.net's content security policy reports go (step 4i of
// STUDY-DESK.md, "Order of work," 4).
//
// Every page of the site is sent with a list of where it may load from
// (public/_headers). A browser that sees a page reach outside that list
// posts a report here, and this Worker adds one to a count: the day, the
// rule, what was blocked, the page, the file that asked, and the browser's
// family (src/report.js). Nothing about the reader is kept, and nothing is
// logged. `npm run summary` prints a week of the counts.
//
// The address is public and takes posts from anyone, so:
//   - nothing is ever echoed back: every answer has an empty body, and a
//     post that was counted, dropped, or over the day's cap is answered
//     alike (204), so the answer tells a sender nothing;
//   - a post is at most MAX_BODY_BYTES, checked while it is read and not by
//     what it claims;
//   - one address may post REPORT_LIMIT's number of times a minute
//     (wrangler.jsonc). The address is handed to the limiter as a key for
//     one call and goes nowhere else: not into the database, not into a log;
//   - a day's counts have a cap (src/store.js).

import { MAX_BODY_BYTES, PATH, RETRY_SECONDS, answer, isReportType, readText } from "./http.js";
import { group, trim } from "./report.js";
import { DAILY_CAP, count, dayOf, prune } from "./store.js";

/**
 * One line of fixed words for a failure, and nothing from the request. The
 * message is kept only for the database's and the configuration's own
 * errors, which name a table or a binding and never a value. No log is
 * stored (wrangler.jsonc): `npx wrangler tail` shows the line live.
 */
function failed(where, err) {
  console.error(JSON.stringify({ failure: where, error: String(err?.message ?? err).slice(0, 200) }));
}

/** Whether the sender's address may post: false once it has posted too often. */
async function allowed(env, request) {
  const limiter = env.REPORT_LIMIT;
  // A deployment without its limiter answers 500 to everything, loudly,
  // instead of running unlimited without anyone knowing.
  if (!limiter || typeof limiter.limit !== "function") throw new Error("no REPORT_LIMIT binding");
  // Cloudflare sets this header itself on every request and overwrites one a client sends.
  const key = request.headers.get("cf-connecting-ip") ?? "none";
  try {
    const outcome = await limiter.limit({ key });
    return !(outcome && outcome.success === false);
  } catch {
    // The limiter is a brake, and a brake that sticks must not stop the reports.
    return true;
  }
}

/** The day's cap: DAILY_CAP, or the environment's own number where it gives a whole one (the tests do). */
function capOf(env) {
  const given = Number(env.DAILY_CAP);
  return Number.isInteger(given) && given > 0 ? given : DAILY_CAP;
}

async function handle(request, env) {
  if (new URL(request.url).pathname !== PATH) return answer(404);
  if (request.method !== "POST") return answer(405, { allow: "POST" });
  if (typeof env.SITE_ORIGIN !== "string" || !env.SITE_ORIGIN) throw new Error("no SITE_ORIGIN");
  if (!env.DB) throw new Error("no DB binding");

  if (!(await allowed(env, request))) return answer(429, { "retry-after": String(RETRY_SECONDS) });
  if (!isReportType(request.headers.get("content-type"))) return answer(415);
  if (Number(request.headers.get("content-length") ?? 0) > MAX_BODY_BYTES) return answer(413);

  let parsed;
  try {
    const body = await readText(request, MAX_BODY_BYTES);
    if (body === null) return answer(413);
    parsed = JSON.parse(body);
  } catch {
    // A parser's own error quotes the text it choked on, so it is dropped here and never logged.
    return answer(400);
  }

  const groups = group(trim(parsed, { site: env.SITE_ORIGIN, userAgent: request.headers.get("user-agent") }));
  if (groups.length > 0) await count(env.DB, dayOf(Date.now()), groups, capOf(env));
  return answer(204);
}

export default {
  async fetch(request, env) {
    try {
      return await handle(request, env);
    } catch (err) {
      failed("request", err);
      return answer(500);
    }
  },

  // Once a day (wrangler.jsonc): counts older than KEEP_DAYS are deleted.
  async scheduled(controller, env) {
    try {
      await prune(env.DB, controller?.scheduledTime ?? Date.now());
    } catch (err) {
      failed("prune", err);
      // Thrown again so Cloudflare marks the run failed, where its dashboard shows it.
      throw err;
    }
  },
};
