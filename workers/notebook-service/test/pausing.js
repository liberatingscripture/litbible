// A database that pauses at an exact point, so that a test can make two
// requests meet there instead of hoping they do (test/races.test.js has the
// same two, and says why).
import { env } from "cloudflare:workers";

/**
 * The database, but `during` runs once, right after the first read or write
 * whose SQL holds `marker` has come back (and before the request acts on it).
 */
export function pausingAfter(marker, during) {
  let fired = false;
  const once = async (result) => {
    if (!fired) {
      fired = true;
      await during();
    }
    return result;
  };
  return {
    prepare(sql) {
      const statement = env.DB.prepare(sql);
      if (fired || !sql.includes(marker)) return statement;
      return {
        bind(...values) {
          const bound = statement.bind(...values);
          return {
            first: async (...args) => once(await bound.first(...args)),
            all: async (...args) => once(await bound.all(...args)),
            run: async (...args) => once(await bound.run(...args)),
          };
        },
      };
    },
    batch: (statements) => env.DB.batch(statements),
  };
}

/** The database, but `during` runs once, right BEFORE the first batch() is sent. */
export function pausingBeforeBatch(during) {
  let fired = false;
  return {
    prepare: (sql) => env.DB.prepare(sql),
    async batch(statements) {
      if (!fired) {
        fired = true;
        await during();
      }
      return env.DB.batch(statements);
    },
  };
}
