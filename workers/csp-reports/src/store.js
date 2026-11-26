// The counts, in D1 (migrations/0001_counts.sql).
//
// ANYONE CAN POST HERE, so what a day may cost is fixed in advance. At most
// HOURLY_CAP reports are counted in one UTC hour, so the most a UTC day can
// count is DAILY_CAP (24 of them). After an hour's allowance is spent a post
// is answered as any other and writes nothing, until the next hour starts.
// One sender at the rate limit can spoil one hour, not the rest of the day.
// The database is on the same Cloudflare account as the notebook service's,
// and on the Workers Free plan every database draws on one daily allowance of
// rows written (100,000, as Cloudflare's D1 pricing page gave it on
// 2026-11-24). A full day here writes at most two rows a report: a tenth of
// that allowance, and never more.
//
// NO SCHEMA CHANGE: the `days` table is keyed by text, so each of its rows is
// now an hour's total, keyed 2026-11-24T13. The `counts` rows stay by day.
// (Rows keyed by a bare day, from before the hourly cap, are never read here.)
//
// THE CAP IS CHECKED AND THE COUNTS ARE WRITTEN AS ONE STEP. D1 has no
// transaction across a read and a later write, so there is no read: every
// statement of the batch carries the same condition (is there room this hour
// for all of this post?), and the hour's total is moved last, so each
// statement before it sees the total as it was. A batch is one transaction,
// and D1 runs one at a time, so they all pass or none does.

/** How many days a count is kept. The site's privacy page gives this number: change the two together. */
export const KEEP_DAYS = 30;

/**
 * The most reports counted in one UTC hour. 208 is the largest whole share of
 * 5,000 over 24 hours (5,000 / 24 = 208.3), so a day can never pass 5,000.
 */
export const HOURLY_CAP = 208;

/** The most a UTC day can count: 24 hours of HOURLY_CAP, 4,992. */
export const DAILY_CAP = 24 * HOURLY_CAP;

const DAY_MS = 24 * 60 * 60 * 1000;

/** The UTC day of an instant, as 2026-11-24. */
export const dayOf = (ms) => new Date(ms).toISOString().slice(0, 10);

/** The UTC hour of an instant, as 2026-11-24T13: the key of the hour's total in `days`. */
export const hourOf = (ms) => new Date(ms).toISOString().slice(0, 13);

// ?1 the hour, ?2 how many reports this post adds, ?3 the cap.
const ROOM = "COALESCE((SELECT n FROM days WHERE day = ?1), 0) + ?2 <= ?3";

/**
 * Adds a post's groups (src/report.js, group) to the counts of the day that
 * `hour` (2026-11-24T13) is in. Returns whether they were counted: false when
 * the hour has no room for them.
 */
export async function count(db, hour, groups, cap = HOURLY_CAP) {
  const day = hour.slice(0, 10);
  const total = groups.reduce((sum, entry) => sum + entry.n, 0);
  if (total === 0) return false;
  const statements = groups.map((entry) =>
    db
      .prepare(
        `INSERT INTO counts (day, disposition, directive, blocked, page, source, browser, n)
         SELECT ?11, ?4, ?5, ?6, ?7, ?8, ?9, ?10 WHERE ${ROOM}
         ON CONFLICT (day, disposition, directive, blocked, page, source, browser) DO UPDATE SET n = n + excluded.n`,
      )
      .bind(hour, total, cap, entry.disposition, entry.directive, entry.blocked, entry.page, entry.source, entry.browser, entry.n, day),
  );
  statements.push(
    db
      .prepare(`INSERT INTO days (day, n) SELECT ?1, ?2 WHERE ${ROOM} ON CONFLICT (day) DO UPDATE SET n = n + excluded.n`)
      .bind(hour, total, cap),
  );
  const results = await db.batch(statements);
  return results.at(-1).meta.changes > 0;
}

/** Deletes every count from before the last `keepDays` days. Returns the first day still kept. */
export async function prune(db, nowMs, keepDays = KEEP_DAYS) {
  const first = dayOf(nowMs - keepDays * DAY_MS);
  await db.batch([db.prepare("DELETE FROM counts WHERE day < ?1").bind(first), db.prepare("DELETE FROM days WHERE day < ?1").bind(first)]);
  return first;
}
