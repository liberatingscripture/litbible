// Per-record git "settle window" (plan, "Two corrections to the agreed
// rules" #2): NOT a flat pre-8/1 binary. A flat rule would auto-revert 63
// footnotes and 10 verses the author deliberately revised April-July 2026
// (the *kephale*/*kentron*/*zugos*/*lepton* expansions the owner's exclusion
// exists to protect). Instead, walk each chapter file's own commit history
// and find, PER RECORD (a specific footnote's html or a specific verse's
// text), the oldest commit whose text already equals HEAD's - that
// "settled at" date sorts the record into one of three windows:
//   import-era        settledAt <= 2026-02-16  (the original lossy import)
//   authored-apr-jul   2026-02-16 < settledAt < 2026-08-01  (deliberate revision)
//   august             settledAt >= 2026-08-01  (excluded from this reconciliation)
//
// Cost control: `getChapterHistory` fetches and parses a chapter file's full
// commit history ONCE (avg 5.5 revisions, max 12, per the plan's own
// measurement), and `findSettleCommit` is then called once per record
// reusing that already-parsed history - never one `git show` per record.
import { execFileSync } from "node:child_process";

function readFileAtCommit(repoRoot, sha, relPath) {
  try {
    return execFileSync("git", ["show", `${sha}:${relPath}`], { cwd: repoRoot, encoding: "utf8", maxBuffer: 1024 * 1024 * 16 });
  } catch {
    return null; // file didn't exist at that commit yet
  }
}

/**
 * A chapter file's own commit history, oldest -> newest, each entry already
 * parsed as JSON (entries whose content fails to parse or doesn't exist at
 * that commit are skipped - a chapter file predating a repo-wide reformat,
 * for instance, might not always have been valid on its own, though in
 * practice every commit that touches src/data/chapters/*.json has been
 * valid JSON since the format was introduced).
 * @returns {Array<{sha:string, date:string, parsed:object}>}
 */
export function getChapterHistory(repoRoot, relPath) {
  let log;
  try {
    log = execFileSync("git", ["log", "--follow", "--reverse", "--format=%H|%aI", "--", relPath], {
      cwd: repoRoot,
      encoding: "utf8",
    });
  } catch (e) {
    throw new Error(`git-settle: \`git log\` failed for ${relPath}: ${e.message}`);
  }
  const commits = log
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      const sep = line.indexOf("|");
      return { sha: line.slice(0, sep), date: line.slice(sep + 1) };
    });

  const history = [];
  for (const c of commits) {
    const raw = readFileAtCommit(repoRoot, c.sha, relPath);
    if (raw == null) continue;
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      continue;
    }
    history.push({ sha: c.sha, date: c.date, parsed });
  }
  return history;
}

/**
 * Find the oldest commit in `history` (oldest->newest) at which
 * `extractValue(parsed)` already equals `currentValue`. Walks newest ->
 * oldest and stops at the first commit where the value differs (or is
 * absent) from `currentValue`; the commit just after that break is the
 * settle point. If EVERY commit in history already matches (the record has
 * never changed since the file was first added), the oldest commit in
 * history is returned.
 * @param {Array<{sha,date,parsed}>} history from getChapterHistory, oldest->newest
 * @param {string} currentValue HEAD's current text for this record
 * @param {(parsed:object) => string|undefined} extractValue
 * @returns {{sha:string, date:string}|null} null only when history is empty
 */
export function findSettleCommit(history, currentValue, extractValue) {
  if (history.length === 0) return null;
  let settled = { sha: history[history.length - 1].sha, date: history[history.length - 1].date };
  for (let i = history.length - 1; i >= 0; i--) {
    const value = extractValue(history[i].parsed);
    if (value === undefined || value !== currentValue) break;
    settled = { sha: history[i].sha, date: history[i].date };
  }
  return settled;
}

const IMPORT_ERA_CUTOFF = Date.parse("2026-02-17T00:00:00Z"); // end of 2026-02-16, inclusive
const AUGUST_CUTOFF = Date.parse("2026-08-01T00:00:00Z");

/** Classify an ISO settle date into one of the three windows. */
export function classifyWindow(dateIso) {
  const t = Date.parse(dateIso);
  if (Number.isNaN(t)) throw new Error(`git-settle: unparseable date ${JSON.stringify(dateIso)}`);
  if (t < IMPORT_ERA_CUTOFF) return "import-era";
  if (t >= AUGUST_CUTOFF) return "august";
  return "authored-apr-jul";
}

// Exposed so build-ledger.mjs can compute `text.preAug` (the record's value
// as of the last commit before this cutoff) without restating the date.
export { AUGUST_CUTOFF as AUGUST_CUTOFF_MS };

/**
 * The value of a record as of the last commit in `history` (oldest->newest)
 * strictly before the August cutoff - "what this text looked like right
 * before any August editing," which is what a bucket-B/C ledger entry needs
 * to show alongside master and current text. Returns undefined if the
 * record didn't exist yet before August at all (e.g. a chapter first
 * published in August).
 */
export function findPreAugustValue(history, extractValue) {
  let val;
  for (const c of history) {
    if (Date.parse(c.date) >= AUGUST_CUTOFF) break;
    const v = extractValue(c.parsed);
    if (v !== undefined) val = v;
  }
  return val;
}
