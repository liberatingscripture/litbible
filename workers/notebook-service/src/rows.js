// Records
// (STUDY-DESK-ENCRYPTION.md, "A record on the service," and "The service's
// interface": "Records").
//
// The service merges nothing. It keeps one sealed row for each record, gives
// each accepted row the account's next revision, and answers "what changed
// since." Its checks on a row are of form alone: it can't open one, and it
// applies no rule to a row's two times beyond their form.
//
// THE CEILING ON AN ACCOUNT (BVJ, 2026-11-26; Audit 9, SV9-1): at most
// LIMITS.accountRows rows and LIMITS.accountBytes bytes of sealed records.
// The account keeps both counts (`row_count`, `row_bytes`), and a push moves
// them in the same guarded batch that writes its rows, by what it changes: a
// new row adds itself, a row put again at a new revision adds the difference
// in its size, and a removal takes its row away. A push that would end past
// either ceiling, having grown it, is refused whole (`too_large`, `what:
// "account"`), so one that only shrinks an account, or keeps it, is never
// refused. The guard on `rev` is what makes the count exact under two pushes
// at once: the one that read the counts first finds `rev` moved, reads them
// again, and is refused (test/races.test.js). A replacement resets both
// (src/waiting.js), and an account deleted takes them with it.

import { answer, bad, refuse } from "./http.js";
import { LIMITS, base64urlBytes, isCount, isObject, isRecordId, isTime, needArray, needDistinct } from "./check.js";
import { commit, guard, idList } from "./db.js";
import { authenticate, changing, needOpen } from "./session.js";

/** The longest a row's `ct` may be, as bytes: a padded record of the format's largest size, and the tag. */
const MAX_CT_BYTES = LIMITS.maxRecordBytes + LIMITS.tagBytes;

/**
 * The sealed bytes a well-formed `ct` of this many characters spells: what
 * base64urlBytes() gives, from a length alone. A stored row's `size` is that
 * length, and a row to put has passed base64urlBytes() before it is counted.
 */
const sealedBytes = (chars) => Math.floor((chars * 3) / 4);

/** What a refusal for the ceiling carries, so a client can say what the limits are. */
const ACCOUNT_LIMITS = Object.freeze({ rows: LIMITS.accountRows, bytes: LIMITS.accountBytes });

const COLUMNS = "id, rev, v, modified, deleted_at, kid, nonce, ct";

/** A row as it is answered. `deletedAt` is left out unless the record is trash. */
const rowOut = (row) => ({
  v: row.v,
  id: row.id,
  rev: row.rev,
  modified: row.modified,
  ...(row.deleted_at === null ? {} : { deletedAt: row.deleted_at }),
  kid: row.kid,
  nonce: row.nonce,
  ct: row.ct,
});

/**
 * GET /rows?since=<rev>, from an open session: the rows with a later
 * revision, in order, with `next` (the cursor for the next call) and `more`.
 * With `old=1`, only the rows still sealed under an older kid, for resealing.
 *
 * A page is at most LIMITS.pageRows rows and LIMITS.pageChars of ciphertext,
 * and always at least one row. It is measured first from the index alone
 * (revisions and sizes), so no ciphertext is read that isn't sent.
 */
export async function getRows({ request, env, url }) {
  const auth = needOpen(await authenticate(request, env));
  const sinceText = url.searchParams.get("since") ?? "0";
  if (!/^(0|[1-9]\d{0,15})$/.test(sinceText)) bad("since");
  const since = Number(sinceText);
  const oldText = url.searchParams.get("old");
  if (oldText !== null && oldText !== "1") bad("old");
  const old = oldText === "1" ? " AND kid < ?" : "";
  const oldBinds = oldText === "1" ? [auth.kid] : [];

  const measured = await env.DB.prepare(
    `SELECT rev, size FROM rows WHERE account = ? AND rev > ?${old} ORDER BY rev LIMIT ?`,
  )
    .bind(auth.account, since, ...oldBinds, LIMITS.pageRows + 1)
    .all();
  let taken = 0;
  let chars = 0;
  for (const { size } of measured.results) {
    if (taken === LIMITS.pageRows || (taken > 0 && chars + size > LIMITS.pageChars)) break;
    chars += size;
    taken++;
  }
  if (taken === 0) return answer({ kid: auth.kid, rows: [], next: since, more: false });

  const next = measured.results[taken - 1].rev;
  const page = await env.DB.prepare(
    `SELECT ${COLUMNS} FROM rows WHERE account = ? AND rev > ? AND rev <= ?${old} ORDER BY rev`,
  )
    .bind(auth.account, since, next, ...oldBinds)
    .all();
  return answer({
    kid: auth.kid,
    rows: page.results.map(rowOut),
    next,
    more: taken < measured.results.length,
  });
}

/**
 * The checks on one row to put, in the interface's order. Returns the word
 * for the first that fails, or null. `kid` was checked for the whole request.
 */
function refusedRow(row) {
  if (row.v !== 1) return "v";
  if (!isRecordId(row.id)) return "id";
  if (!isTime(row.modified)) return "modified";
  if (row.deletedAt !== undefined && row.deletedAt !== null && !isTime(row.deletedAt)) return "deletedAt";
  if (base64urlBytes(row.nonce) !== LIMITS.nonceBytes) return "nonce";
  const bytes = base64urlBytes(row.ct);
  if (bytes < 0) return "ct";
  if (bytes > MAX_CT_BYTES) return "too_large";
  const padded = bytes - LIMITS.tagBytes;
  if (padded < LIMITS.padBlock || padded % LIMITS.padBlock) return "ct";
  if (!isCount(row.rev)) return "rev";
  return null;
}

function parse(body) {
  const put = needArray(body.put ?? [], "put");
  const remove = needArray(body.remove ?? [], "remove");
  if (put.length + remove.length > LIMITS.rowsPerRequest) {
    refuse(413, "too_large", { what: "rows", limit: LIMITS.rowsPerRequest });
  }
  put.forEach((row, i) => {
    if (!isObject(row)) bad(`put[${i}]`);
    // A kid that is no kid at all is a malformed request, not an old key.
    if (!isCount(row.kid, 1)) bad(`put[${i}].kid`);
  });
  remove.forEach((item, i) => {
    if (!isObject(item) || !isRecordId(item.id)) bad(`remove[${i}].id`);
    if (!isCount(item.rev, 1)) bad(`remove[${i}].rev`);
  });
  needDistinct(
    [...put.map((row) => row.id).filter((id) => typeof id === "string"), ...remove.map((item) => item.id)],
    "id",
  );
  return { put, remove };
}

/**
 * POST /rows, from an open session:
 * { put: [row with the `rev` last seen, 0 for a new one], remove: [{ id, rev }] }.
 *
 * Every row's kid must be the current one, or the whole request is refused as
 * "old_key". Then each row is answered for itself, in the request's order:
 * stored with its new `rev`; refused, with the check that failed; or
 * "conflict," with the row as it stands. A row that fails never holds back
 * the ones beside it. Then, if what would be stored passes the account's
 * ceiling, the whole request is refused and nothing is stored (the header).
 */
export function postRows({ request, env }) {
  return changing(request, env, parse, store, needOpen);

  async function store(auth, { put, remove }) {
    const stale = put.find((row) => row.kid !== auth.kid);
    if (stale) refuse(409, "old_key", { kid: auth.kid });

    const refusals = put.map(refusedRow);
    const ids = [...put.filter((_, i) => !refusals[i]).map((row) => row.id), ...remove.map((item) => item.id)];
    /** id → { rev, size } of each row named that the service holds. */
    const current = new Map();
    if (ids.length) {
      const found = await env.DB.prepare(
        "SELECT id, rev, size FROM rows WHERE account = ? AND id IN (SELECT value FROM json_each(?))",
      )
        .bind(auth.account, idList(ids))
        .all();
      for (const { id, rev, size } of found.results) current.set(id, { rev, size });
    }

    // Decide each item against what the service holds now, and count what the account gains.
    let rev = auth.rev;
    let addRows = 0;
    let addBytes = 0;
    const statements = [];
    const conflicts = [];
    const putAnswers = put.map((row, i) => {
      if (refusals[i]) return { ...(typeof row.id === "string" ? { id: row.id } : {}), refused: refusals[i] };
      const held = current.get(row.id);
      const stands = held?.rev ?? 0;
      if (row.rev !== stands) {
        if (stands) conflicts.push(row.id);
        return { id: row.id, conflict: stands ? "changed" : "gone" };
      }
      if (!held) addRows += 1;
      addBytes += sealedBytes(row.ct.length) - (held ? sealedBytes(held.size) : 0);
      rev += 1;
      statements.push(
        env.DB.prepare(
          `INSERT INTO rows (account, id, rev, v, modified, deleted_at, kid, nonce, ct, size)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT (account, id) DO UPDATE SET
             rev = excluded.rev, v = excluded.v, modified = excluded.modified, deleted_at = excluded.deleted_at,
             kid = excluded.kid, nonce = excluded.nonce, ct = excluded.ct, size = excluded.size`,
        ).bind(auth.account, row.id, rev, row.v, row.modified, row.deletedAt ?? null, row.kid, row.nonce, row.ct, row.ct.length),
      );
      return { id: row.id, rev };
    });

    const gone = [];
    const removeAnswers = remove.map((item) => {
      const held = current.get(item.id);
      // Already gone is what the device asked for.
      if (held === undefined) return { id: item.id, removed: true };
      if (item.rev !== held.rev) {
        conflicts.push(item.id);
        return { id: item.id, conflict: "changed" };
      }
      gone.push(item.id);
      addRows -= 1;
      addBytes -= sealedBytes(held.size);
      return { id: item.id, removed: true };
    });

    // The ceiling: refused whole, before anything is written, when the push would end past either
    // count and grows it. The counts are the ones read with `rev`, which the guard below holds.
    if (
      (addRows > 0 && auth.rowCount + addRows > LIMITS.accountRows) ||
      (addBytes > 0 && auth.rowBytes + addBytes > LIMITS.accountBytes)
    ) {
      refuse(413, "too_large", { what: "account", limits: ACCOUNT_LIMITS });
    }
    if (gone.length) {
      // A removal takes a revision too, so the guard below sees every write to the rows.
      rev += 1;
      statements.push(
        env.DB.prepare("DELETE FROM rows WHERE account = ? AND id IN (SELECT value FROM json_each(?))").bind(
          auth.account,
          idList(gone),
        ),
      );
    }

    if (statements.length) {
      await commit(env.DB, [
        // The same key, and no row written since the revisions, sizes, and counts above were read.
        guard(env.DB, auth.account, { kid: auth.kid, rev: auth.rev }),
        ...statements,
        env.DB.prepare("UPDATE accounts SET rev = ?, row_count = row_count + ?, row_bytes = row_bytes + ? WHERE id = ?").bind(
          rev,
          addRows,
          addBytes,
          auth.account,
        ),
      ]);
    }

    // A conflict is answered with the row as it stands, while a page's worth
    // of them fits. Past that the row is left out, and the device pulls.
    if (conflicts.length) {
      const measured = await env.DB.prepare(
        "SELECT id, size FROM rows WHERE account = ? AND id IN (SELECT value FROM json_each(?)) ORDER BY rev",
      )
        .bind(auth.account, idList(conflicts))
        .all();
      const fits = [];
      let chars = 0;
      for (const { id, size } of measured.results) {
        if (chars + size > LIMITS.pageChars) break;
        chars += size;
        fits.push(id);
      }
      if (fits.length) {
        const standing = await env.DB.prepare(
          `SELECT ${COLUMNS} FROM rows WHERE account = ? AND id IN (SELECT value FROM json_each(?))`,
        )
          .bind(auth.account, idList(fits))
          .all();
        const rows = new Map(standing.results.map((row) => [row.id, rowOut(row)]));
        for (const item of [...putAnswers, ...removeAnswers]) {
          if (item.conflict === "changed" && rows.has(item.id)) item.row = rows.get(item.id);
        }
      }
    }

    return answer({ kid: auth.kid, rev, put: putAnswers, remove: removeAnswers });
  }
}
