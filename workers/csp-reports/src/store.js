// The counts, in D1 (migrations/0001_counts.sql).
//
// ANYONE CAN POST HERE, so what a day may cost is fixed in advance. At most
// DAILY_CAP reports are counted in one UTC day; after that a post is answered
// as any other and writes nothing. The database is on the same Cloudflare
// account as the notebook service's, and on the Workers Free plan every
// database draws on one daily allowance of rows written (100,000, as
// Cloudflare's D1 pricing page gave it on 2026-11-24). A full day here writes
// at most two rows a report: a tenth of that allowance, and never more.
//
// THE CAP IS CHECKED AND THE COUNTS ARE WRITTEN AS ONE STEP. D1 has no
// transaction across a read and a later write, so there is no read: every
// statement of the batch carries the same condition (is there room today for
// all of this post?), and the day's total is moved last, so each statement
// before it sees the total as it was. A batch is one transaction, and D1
// runs one at a time, so they all pass or none does.

/** How many days a count is kept. The site's privacy page gives this number: change the two together. */
export const KEEP_DAYS = 30;

/** The most reports counted in one UTC day. */
export const DAILY_CAP = 5000;

const DAY_MS = 24 * 60 * 60 * 1000;

/** The UTC day of an instant, as 2026-11-24. */
export const dayOf = (ms) => new Date(ms).toISOString().slice(0, 10);

// ?1 the day, ?2 how many reports this post adds, ?3 the cap.
const ROOM = "COALESCE((SELECT n FROM days WHERE day = ?1), 0) + ?2 <= ?3";

/**
 * Adds a post's groups (src/report.js, group) to `day`'s counts. Returns
 * whether they were counted: false when the day has no room for them.
 */
export async function count(db, day, groups, cap = DAILY_CAP) {
  const total = groups.reduce((sum, entry) => sum + entry.n, 0);
  if (total === 0) return false;
  const statements = groups.map((entry) =>
    db
      .prepare(
        `INSERT INTO counts (day, disposition, directive, blocked, page, source, browser, n)
         SELECT ?1, ?4, ?5, ?6, ?7, ?8, ?9, ?10 WHERE ${ROOM}
         ON CONFLICT (day, disposition, directive, blocked, page, source, browser) DO UPDATE SET n = n + excluded.n`,
      )
      .bind(day, total, cap, entry.disposition, entry.directive, entry.blocked, entry.page, entry.source, entry.browser, entry.n),
  );
  statements.push(
    db
      .prepare(`INSERT INTO days (day, n) SELECT ?1, ?2 WHERE ${ROOM} ON CONFLICT (day) DO UPDATE SET n = n + excluded.n`)
      .bind(day, total, cap),
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
