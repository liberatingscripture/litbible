// src/lib/desk-sync-engine.mjs
//
// The sync loop (the plan's step 4g): one pass opens the session, pulls what
// changed on the notebook service and merges it, pushes what this device
// owes, and reseals after a change of key. The rules it applies are
// src/lib/desk-sync.mjs, whose header says what an entry is and why the queue
// is a difference; the requests are STUDY-DESK-ENCRYPTION.md, "The service's
// interface." This file has no storage, network, timer, or DOM of its own:
// each is handed in, so the whole loop runs under `node --test` against a
// stand-in service (test/helpers/fake-notebook-service.mjs) and, in the
// browser, against the real one (src/scripts/desk/sync/).
//
// What is handed in:
//   notebook  the desk's store, or anything with its three methods:
//             all(), get(id), and change(build, { record: false }), which
//             reads and writes in one transaction
//   state     where the sync's own state is kept (src/scripts/desk/sync/
//             sync-db.js): read() gives { meta, rows, held }, and
//             write({ meta, rows: { put, remove }, held: { put, remove } })
//             commits all of it together
//   api       call(method, path, body) gives { status, body }, or throws
//             Offline when the service can't be reached
//   device    { id, key }: the device's id and its key pair, the private
//             half a CryptoKey that can't be read out
//   now       this device's clock, in the format's form
//
// ORDER OF WRITES. The notebook is written first and the sync's state second,
// in two transactions. Either can be lost without harm: a merge whose state
// was never written is pulled again and writes nothing the second time, and a
// push whose answer was never recorded comes back in the next pull as a row
// this device already holds. Nothing here is correct only if both land.
//
// WHAT ENDS A PASS EARLY is a Halt, with the state the reader is shown:
// "signedOut" (the service ended the session; nothing here is removed),
// "removed" (this device has no keyring on the service any more),
// "otherNotebook" (the account's notebook is not the one this browser was
// linked to: replaced, or gone), "cantOpen" (the keyring or its proof didn't
// pass), "slowed" (the limiter), "full" (the account's ceiling), "offline",
// and "error". A pass never deletes a key, a session, or a record because of
// any of them: the spec's rule is that a device keeps its keys until the
// reader signs it out.
//
// A STOP IS FINAL (Audit 9, SY9b-2). `stop()` is for a reader who stopped
// syncing or signed out: from then on the engine makes no request, writes
// nothing to the notebook or to its own state, and starts no pass. A pass
// already running ends at its next request or write, and `stop()` resolves
// once it has, so whoever clears the sync's storage after it clears the last
// of it.
//
// THE ACCOUNT'S CEILING (BVJ, 2026-11-26; Audit 9, SV9-1). The service
// refuses, whole, a push that would take the account past 100,000 rows or
// 100 MB (`too_large`, `what: "account"`). Sending the same rows again would
// only be refused again, so for FULL_WAIT_MS after that refusal a pass still
// pulls, and still sends removals (which never grow an account), but sends
// no rows: it ends "full", with what waits counted. Every change stays in
// the notebook here, as it is. The first pass after the wait tries the rows
// once more, and so does a pass the reader asks for ("Reconnect").

import { CLOCK_TOLERANCE_MS } from "./desk-records.mjs";
import {
  Refusal,
  checkKeyring,
  fromBase64url,
  keyOf,
  keyProof,
  openKeyring,
  openRow,
  sealKeyring,
  sealRecord,
  toBase64url,
} from "./desk-crypto.mjs";
import {
  BODY_BUDGET,
  MAX_ROWS,
  batches,
  canOpenNow,
  clockOffset,
  latestRows,
  openRows,
  planIncoming,
  planPush,
  readPushAnswer,
  settle,
  summarize,
} from "./desk-sync.mjs";

// Thrown by `api.call` when the service can't be reached at all. In a file of
// its own so the carrier loads without this one (desk-sync-offline.mjs).
import { Offline } from "./desk-sync-offline.mjs";
export { Offline };

/** Ends a pass with the state the reader is shown. */
export class Halt extends Error {
  constructor(state, detail = {}) {
    super(`desk-sync: ${state}`);
    this.name = "Halt";
    this.state = state;
    this.detail = detail;
  }
}

/** The session hasn't proved the current key, or named an old one: fetch the keyring, check it, prove. */
class Behind extends Error {}

/** A refusal the caller may know what to do with: `word` is the service's `error`. */
class Refused extends Error {
  constructor(word, body, status) {
    super(`desk-sync: the service answered ${word}`);
    this.word = word;
    this.body = body;
    this.status = status;
  }
}

/** The engine was stopped: what follows a request or comes before a write goes no further. */
class Stopped extends Error {
  constructor() {
    super("desk-sync: the sync was stopped");
    this.name = "Stopped";
  }
}

/** How many times one pass will fetch a new keyring and start again. */
const MAX_CATCH_UPS = 3;
/** How many times one pass will pull, merge, and push before it stops and lets the next pass go on. */
const MAX_ROUNDS = 8;
/** Past this many changed ids, a scan reads the whole notebook once instead of each record. */
const SCAN_ALL_OVER = 200;
/** How long the account's answer is trusted before a pass asks again (a waiting request shows there). */
const ACCOUNT_EVERY_MS = 15 * 60_000;
/** After the account's ceiling refused a push, how long passes send no rows (the header). */
export const FULL_WAIT_MS = 60 * 60_000;

/** The ceiling a refusal named, as { rows, bytes }, or null when it named none the status can use. */
const limitsOf = (limits) =>
  limits && Number.isSafeInteger(limits.rows) && limits.rows > 0 && Number.isSafeInteger(limits.bytes) && limits.bytes > 0
    ? { rows: limits.rows, bytes: limits.bytes }
    : null;

const rowSize = (row) => JSON.stringify(row).length + 1;

/**
 * @param {{ notebook: object, state: object, api: object, device: { id: string, key: object },
 *   now?: () => string, sleep?: (ms: number) => Promise<void>, onStatus?: (status: object) => void,
 *   log?: (...args: unknown[]) => void }} deps
 */
export function createSyncEngine({
  notebook,
  state,
  api,
  device,
  now = () => new Date().toISOString(),
  sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  onStatus = () => {},
  log = () => {},
}) {
  /** The sync's own state, in memory for the life of the engine. */
  let meta = null;
  /** id → entry (desk-sync.mjs). */
  const base = new Map();
  /** id → { id, why, row, due? }: rows kept until they can be read or their time comes. */
  const holds = new Map();
  /** id → summary of the local record, once the notebook has been scanned. */
  const local = new Map();
  let scanned = false;
  /** Ids the notebook says changed since the last scan. */
  let touched = new Set();

  let keyring = null;
  let open = false;
  let accountAt = 0;
  let account = null;
  let clock = null;
  let audited = false;
  /** While a pull from 0 is checking which rows the service still has: the ids seen. */
  let auditing = null;
  let running = null;
  let stopped = false;
  let failures = 0;
  /** While the account's ceiling holds rows back: { until, limits } (the header). */
  let full = null;
  let counts = { pending: 0, blocked: 0, stuck: 0 };
  let status = { state: "starting", pending: 0, problems: {}, lastSynced: null, clock: null, account: null };

  const nowMs = () => Date.parse(now());

  /** Goes no further once the engine is stopped. */
  const alive = () => {
    if (stopped) throw new Stopped();
  };

  function publish(patch) {
    const unread = [...base.values()].filter((e) => e.held === "skip").length;
    const waiting = [...holds.values()];
    status = {
      state: status.state,
      ...patch,
      pending: counts.pending,
      problems: {
        stuck: counts.stuck,
        blocked: counts.blocked,
        unread,
        aside: waiting.filter((h) => h.why === "aside").length,
        ahead: waiting.filter((h) => h.why === "ahead").length,
        reseal: meta?.resealLeft ?? 0,
      },
      lastSynced: meta?.lastSynced ?? null,
      clock,
      account,
    };
    try {
      onStatus(status);
    } catch (err) {
      log("a status listener failed", err);
    }
  }

  async function load() {
    if (meta) return;
    const read = await state.read();
    meta = { cursor: 0, highest: 0, resealed: 0, ...read.meta };
    base.clear();
    for (const entry of read.rows ?? []) base.set(entry.id, entry);
    holds.clear();
    for (const hold of read.held ?? []) holds.set(hold.id, hold);
  }

  /** Writes entries, held rows, and meta together, after putting them in memory. A stopped engine writes nothing. */
  async function save({ entries = [], forget = [], hold = [], release = [], patch = null } = {}) {
    alive();
    for (const entry of entries) base.set(entry.id, entry);
    for (const id of forget) base.delete(id);
    for (const h of hold) holds.set(h.id, h);
    const released = release.filter((id) => holds.delete(id));
    if (patch) Object.assign(meta, patch);
    if (!entries.length && !forget.length && !hold.length && !released.length && !patch) return;
    await state.write({
      ...(patch ? { meta: { ...meta } } : {}),
      rows: { put: entries, remove: forget },
      held: { put: hold, remove: released },
    });
  }

  /* ── Talking to the service ─────────────────────────────────────────── */

  async function request(method, path, body) {
    for (let tries = 0; ; tries++) {
      // Nothing is sent once the engine is stopped, and an answer that arrives after the stop is not read.
      alive();
      const res = await api.call(method, path, body);
      alive();
      const answered = res?.body && typeof res.body === "object" ? res.body : {};
      clock = clockOffset(answered.time, nowMs()) ?? clock;
      if (res?.status === 200 && typeof answered.error !== "string") return answered;
      const word = typeof answered.error === "string" ? answered.error : "error";
      // The notebook changed while the service was checking: it asks to be sent the request again.
      if (word === "busy" && tries < 2) {
        await sleep(250 * (tries + 1));
        continue;
      }
      if (word === "sign_in") throw new Halt("signedOut", { reason: answered.reason ?? null });
      if (word === "slow_down") {
        const retry = Number.isFinite(answered.retry) && answered.retry > 0 ? Math.min(answered.retry, 3600) : 60;
        throw new Halt("slowed", { retry });
      }
      if (word === "not_open" || word === "old_key") throw new Behind();
      // The account's ceiling: nothing of this push was stored, and the same push would be refused again.
      if (word === "too_large" && answered.what === "account") {
        full = { until: nowMs() + FULL_WAIT_MS, limits: limitsOf(answered.limits) };
        throw new Halt("full", { limits: full.limits, retry: FULL_WAIT_MS / 1000 });
      }
      throw new Refused(word, answered, res?.status);
    }
  }

  const currentKey = () => keyOf(keyring, keyring.current);

  /** Fetches this device's sealed keyring, checks it against the one it holds, and proves the key. */
  async function catchUp() {
    let sealed;
    try {
      sealed = (await request("GET", `/keyring?device=${device.id}`)).keyring;
    } catch (err) {
      // No sealed keyring for this device: it was removed. It keeps its keys and its notebook.
      if (err instanceof Refused && err.word === "not_found" && err.body.what === "keyring") throw new Halt("removed");
      throw err;
    }
    let incoming;
    try {
      incoming = await openKeyring({ recipient: device.key, enc: fromBase64url(sealed.enc), ct: fromBase64url(sealed.ct) });
      checkKeyring({ held: keyring, highest: Math.max(meta.highest, keyring.current), incoming });
    } catch (err) {
      if (err instanceof Refusal) throw new Halt("cantOpen", { reason: "keyring", why: err.why });
      throw err;
    }
    if (incoming.current !== keyring.current || meta.sealed?.ct !== sealed.ct) {
      keyring = incoming;
      await save({ patch: { sealed: { enc: sealed.enc, ct: sealed.ct }, highest: incoming.current } });
    }
    try {
      await request("POST", "/session/proof", {
        device: device.id,
        kid: keyring.current,
        proof: toBase64url(await keyProof(currentKey())),
      });
    } catch (err) {
      if (!(err instanceof Refused)) throw err;
      // A wrong proof is never sent twice: the fifth in a row ends the session.
      if (err.word === "wrong_proof") throw new Halt("cantOpen", { reason: "proof" });
      if (err.word === "gone") throw new Halt("removed");
      if (err.word === "no_notebook") throw new Halt("otherNotebook", { notebook: null, replaced: null });
      throw err;
    }
  }

  async function openSession() {
    if (!keyring) {
      if (!meta.sealed) throw new Halt("cantOpen", { reason: "noKeyring" });
      try {
        keyring = await openKeyring({
          recipient: device.key,
          enc: fromBase64url(meta.sealed.enc),
          ct: fromBase64url(meta.sealed.ct),
        });
      } catch (err) {
        // The device's own key no longer opens what it kept: it needs to join again. Nothing is lost.
        if (err instanceof Refusal) throw new Halt("cantOpen", { reason: "deviceKey", why: err.why });
        throw err;
      }
      if (keyring.notebook !== meta.notebook) throw new Halt("cantOpen", { reason: "keyring", why: "notebook" });
    }
    const answered = await request("GET", "/account");
    account = { waiting: answered.waiting ?? null, replaced: answered.replaced ?? null, expires: answered.session?.expires ?? null };
    accountAt = nowMs();
    // A device that held another notebook never joins this one by itself (the spec's "When a reader loses every device").
    if (answered.notebook !== meta.notebook) {
      throw new Halt("otherNotebook", { notebook: answered.notebook ?? null, replaced: answered.replaced ?? null });
    }
    const here = answered.session?.open === true && answered.session.device === device.id && answered.kid === keyring.current;
    if (!here) await catchUp();
    open = true;
  }

  /* ── What arrives ───────────────────────────────────────────────────── */

  /**
   * Opens rows, merges them into the notebook in one transaction, and
   * settles each row's entry. `cursor`, when given, is written with them.
   */
  async function takeRows(rows, { cursor } = {}) {
    // Every row here is the service's own word for what it holds now (a pulled page, a conflict's
    // row, or a kept row whose revision still stands), so none is passed over for being older than
    // the entry: a service restored from an older copy answers with revisions that went back.
    const fresh = latestRows(rows);
    for (const row of fresh) {
      if (typeof row?.id !== "string" || !Number.isSafeInteger(row.rev)) throw new Error("desk-sync: a row without an id or a revision");
    }
    const patch = cursor !== undefined && cursor !== meta.cursor ? { cursor } : null;
    if (!fresh.length) return save({ patch });

    const { opened, aside, skipped } = await openRows(fresh, keyring);
    const unread = [
      ...aside.map(({ row, why }) => ({ row, how: "aside", why })),
      ...skipped.map(({ row, why }) => ({ row, how: "skip", why })),
    ];
    let planned = null;
    alive();
    await notebook.change(
      async ({ all }) => {
        const records = await all();
        // Checked inside the notebook's own transaction, so a stop can't fall between it and the write.
        if (stopped) return null;
        planned = planIncoming(records, opened, { now: now(), also: unread.map((o) => o.row.id) });
        return planned.plan.put.length || planned.plan.remove.length ? planned.plan : null;
      },
      { record: false },
    );
    if (!planned) throw new Stopped();
    if (scanned) {
      for (const r of planned.plan.put) local.set(r.id, await summarize(r));
      for (const id of planned.plan.remove) local.delete(id);
    }
    const settled = await settle({
      outcomes: [...unread, ...planned.outcomes],
      after: planned.after,
      base,
      tolerance: CLOCK_TOLERANCE_MS,
    });
    for (const report of settled.reports) log("a row was not merged", report);
    await save({ entries: settled.entries, hold: settled.hold, release: settled.release, patch });
  }

  async function pull() {
    for (;;) {
      const page = await request("GET", `/rows?since=${meta.cursor}`);
      // This session changed the key and the engine wasn't told, or its keyring is behind.
      if (Number.isSafeInteger(page.kid) && page.kid > keyring.current) throw new Behind();
      const rows = Array.isArray(page.rows) ? page.rows : [];
      if (!Number.isSafeInteger(page.next) || page.next < meta.cursor) throw new Error("desk-sync: a page without a cursor");
      if (rows.length && status.state !== "syncing") publish({ state: "syncing" });
      if (auditing) for (const row of rows) auditing.add(row.id);
      await takeRows(rows, { cursor: page.next });
      if (page.more !== true) break;
    }
    if (auditing) await finishAudit();
  }

  /**
   * After a pull from 0: an entry whose row the service no longer has. With a
   * record still here, the row is owed again as new (a service restored from
   * an older copy must not lose what its devices hold); with none, the entry
   * goes.
   */
  async function finishAudit() {
    const seen = auditing;
    auditing = null;
    const entries = [];
    const forget = [];
    for (const [id, entry] of base) {
      if (entry.rev === 0 || seen.has(id)) continue;
      if (scanned ? local.has(id) : (await notebook.get(id)) != null) {
        const { sent: _sent, held: _held, ...rest } = entry;
        entries.push({ ...rest, rev: 0, hash: null });
      } else forget.push(id);
    }
    const release = [...holds.keys()].filter((id) => !seen.has(id));
    await save({ entries, forget, release });
  }

  /** Judges again the rows that were kept: one whose time has come, and one this device can now open. */
  async function rejudge() {
    const due = [];
    const stale = [];
    const at = nowMs();
    for (const hold of holds.values()) {
      if (base.get(hold.id)?.rev !== hold.row.rev) stale.push(hold.id);
      else if (hold.why === "ahead" ? at >= (hold.due ?? 0) : canOpenNow(hold.row, keyring)) due.push(hold.row);
    }
    if (stale.length) await save({ release: stale });
    if (due.length) await takeRows(due);
  }

  /* ── What is owed ───────────────────────────────────────────────────── */

  async function scan() {
    const changed = touched;
    touched = new Set();
    try {
      if (!scanned || changed.size > SCAN_ALL_OVER) {
        const here = new Set();
        for (const r of await notebook.all()) {
          if (typeof r?.id !== "string") continue;
          here.add(r.id);
          if (!scanned || changed.has(r.id) || !local.has(r.id)) local.set(r.id, await summarize(r));
        }
        for (const id of [...local.keys()]) if (!here.has(id)) local.delete(id);
        scanned = true;
        return;
      }
      for (const id of changed) {
        const r = await notebook.get(id);
        if (r) local.set(id, await summarize(r));
        else local.delete(id);
      }
    } catch (err) {
      // A read that failed (a blocked or closing database) leaves the ids to read again, or an edit
      // would wait unsent, with the status saying "up to date," until the next full scan (Audit 9, SY9-1).
      for (const id of changed) touched.add(id);
      throw err;
    }
  }

  /** Reads one POST /rows answer into entries, and merges the rows its conflicts carried. */
  async function settlePush(sent, answer) {
    if (Number.isSafeInteger(answer.kid) && answer.kid > keyring.current) throw new Behind();
    const entries = [];
    const forget = [];
    const standing = [];
    let cursor = meta.cursor;
    const results = readPushAnswer({ put: sent.put.map((p) => p.row), remove: sent.remove }, answer);
    for (const [i, result] of results.entries()) {
      const prev = base.get(result.id);
      // Answers come in the request's order: the rows to put, then the removals.
      const item = sent.put[i];
      if (result.did === "stored") {
        const { hash, del } = item.summary;
        entries.push({ id: result.id, rev: result.rev, hash, sent: hash, ...(del ? { del } : {}) });
      } else if (result.did === "refused") {
        // The service won't take this copy. It stays here, and is tried again when it changes.
        entries.push({ ...(prev ?? { id: result.id, rev: 0, hash: null }), stuck: { hash: item.summary.hash, why: `refused:${result.why}` } });
        log("the service refused a row", { id: result.id, check: result.why });
      } else if (result.did === "gone") {
        // No such row any more. The record lives here, so it is owed as new (the spec's "Still open," 36).
        entries.push({ ...(prev ?? { id: result.id, hash: null }), rev: 0 });
      } else if (result.did === "removed") {
        forget.push(result.id);
      } else if (result.row) {
        standing.push(result.row);
      } else {
        // A conflict too large to carry its row: pull from before it.
        cursor = Math.min(cursor, prev?.rev ?? 0);
      }
    }
    // Each row stored takes a new revision past everything this device has pulled. A last revision
    // short of that means the service went back (restored from an older copy): everything is
    // fetched again, and what it lost is owed to it.
    const stored = results.filter((r) => r.did === "stored").map((r) => r.rev).sort((a, b) => a - b);
    if (Number.isSafeInteger(answer.rev) && answer.rev < meta.cursor + stored.length && !audited) {
      startAudit();
      cursor = 0;
    } else if (cursor === meta.cursor && stored.length && stored.every((rev, i) => rev === meta.cursor + 1 + i)) {
      // The rows stored took exactly the next revisions after everything this device has pulled, and
      // a revision is one row's alone, so nothing else was written between: the next pull starts after
      // them, and a first sync doesn't fetch back the whole notebook it just sent. One revision out of
      // place (another device wrote meanwhile) and the cursor stays where it is.
      cursor = meta.cursor + stored.length;
    }
    await save({ entries, forget, patch: cursor !== meta.cursor ? { cursor } : null });
    if (standing.length) await takeRows(standing);
  }

  /** The next pull starts from 0 and notes every row it sees (finishAudit). Once in an engine's life. */
  function startAudit() {
    audited = true;
    auditing = new Set();
  }

  /** Reads what changed in the notebook and plans the push: what the status counts, with no request made. */
  async function owed() {
    await scan();
    const plan = planPush(local, base);
    counts = { pending: plan.put.length + plan.remove.length + plan.waiting, blocked: plan.blocked, stuck: plan.stuck };
    return plan;
  }

  /** Pushes what is owed. Resolves to true when the plan should be made again. */
  async function push() {
    const plan = await owed();
    if (plan.forget.length) await save({ forget: plan.forget });
    if (plan.missing.length) {
      if (!audited) {
        // The service has rows this notebook lost without a trace. Fetch everything again, and delete nothing.
        startAudit();
        await save({ patch: { cursor: 0 } });
        return true;
      }
      log("records the service holds could not be brought back", plan.missing);
      await save({ entries: plan.missing.map((id) => ({ ...base.get(id), held: "skip" })) });
    }
    if (!plan.put.length && !plan.remove.length) return false;
    // The account's ceiling refused rows a moment ago: send what frees room, and hold the rows (the header).
    const holding = holdingRows();
    if (status.state !== "syncing" && (!holding || plan.remove.length)) publish({ state: "syncing" });

    let batch = [];
    let size = 0;
    const flush = async () => {
      if (!batch.length) return;
      const sent = { put: batch, remove: [] };
      batch = [];
      size = 0;
      await settlePush(sent, await request("POST", "/rows", { put: sent.put.map((p) => p.row), remove: [] }));
    };
    for (const { id, rev } of holding ? [] : plan.put) {
      // Sealing a large notebook takes a while: a stop ends it here, before the next request.
      alive();
      const record = await notebook.get(id);
      if (!record) {
        touched.add(id);
        continue;
      }
      const summary = await summarize(record);
      local.set(id, summary);
      let row;
      try {
        row = { ...(await sealRecord({ record, notebookKey: currentKey(), kid: keyring.current })), rev };
      } catch (err) {
        if (!(err instanceof Refusal)) throw err;
        // Too large, or a field no row can carry. It stays here.
        await save({ entries: [{ ...(base.get(id) ?? { id, rev: 0, hash: null }), stuck: { hash: summary.hash, why: `seal:${err.why}` } }] });
        log("a record could not be sealed", { id, why: err.why });
        continue;
      }
      const n = rowSize(row);
      if (batch.length && (batch.length === MAX_ROWS || size + n > BODY_BUDGET)) await flush();
      batch.push({ row, summary });
      size += n;
    }
    await flush();

    for (let i = 0; i < plan.remove.length; i += MAX_ROWS) {
      const remove = plan.remove.slice(i, i + MAX_ROWS);
      await settlePush({ put: [], remove }, await request("POST", "/rows", { put: [], remove }));
    }
    if (holding && plan.put.length) stillFull();
    // Rows were sent and none was refused for the ceiling: the account has room again.
    if (plan.put.length) full = null;
    return true;
  }

  /** True while the account's ceiling holds rows back (the header). */
  const holdingRows = () => full !== null && nowMs() < full.until;

  /** Ends the pass as "full", with how long until rows are tried again. */
  function stillFull() {
    throw new Halt("full", { limits: full.limits, retry: Math.max(1, Math.ceil((full.until - nowMs()) / 1000)) });
  }

  /**
   * After a change of key: every row still sealed under an older key is
   * opened and sealed again under the current one, its plain fields and its
   * bytes unchanged, and pushed against its revision. Any device with the new
   * keyring finishes this, and a row already resealed is not answered again.
   */
  async function reseal() {
    // A notebook still on its first key has nothing older to seal again.
    if (keyring.current <= 1 || meta.resealed >= keyring.current) return;
    // Resealing puts rows again, and the ceiling is holding rows back.
    if (holdingRows()) stillFull();
    let since = 0;
    let left = 0;
    for (;;) {
      const page = await request("GET", `/rows?since=${since}&old=1`);
      if (Number.isSafeInteger(page.kid) && page.kid > keyring.current) throw new Behind();
      const again = [];
      for (const row of Array.isArray(page.rows) ? page.rows : []) {
        try {
          const { record, text } = await openRow({ row, keyring });
          again.push({ ...(await sealRecord({ record, text, notebookKey: currentKey(), kid: keyring.current })), rev: row.rev });
        } catch (err) {
          if (!(err instanceof Refusal)) throw err;
          left++;
        }
      }
      for (const part of batches(again, rowSize)) {
        const answer = await request("POST", "/rows", { put: part, remove: [] });
        const entries = [];
        readPushAnswer({ put: part, remove: [] }, answer).forEach((result, i) => {
          const prev = base.get(result.id);
          // The same record under a new seal: only the revision moves. Anything else means another
          // device got there first, and the next pull brings what it did.
          if (result.did === "stored" && prev && prev.rev === part[i].rev) entries.push({ ...prev, rev: result.rev });
          else if (result.did === "refused") left++;
        });
        await save({ entries });
      }
      if (!Number.isSafeInteger(page.next) || page.more !== true) break;
      since = page.next;
    }
    await save({ patch: { resealed: keyring.current, resealLeft: left } });
  }

  /* ── A pass ─────────────────────────────────────────────────────────── */

  async function rounds() {
    for (let round = 0; round < MAX_ROUNDS; round++) {
      await pull();
      await rejudge();
      if (!(await push())) {
        await reseal();
        return true;
      }
    }
    // Still owed after this many rounds (another device keeps writing the same records). The next pass goes on.
    return false;
  }

  async function run() {
    try {
      await load();
      alive();
      // A pass that finds nothing to do leaves "up to date" on the screen: the status says "syncing"
      // only once a pull brings rows or a push has something to send.
      if (status.state !== "upToDate") publish({ state: "syncing" });
      let done = false;
      for (let behind = 0; ; ) {
        try {
          if (!open || nowMs() - accountAt > ACCOUNT_EVERY_MS) await openSession();
          done = await rounds();
          break;
        } catch (err) {
          if (!(err instanceof Behind) || ++behind > MAX_CATCH_UPS) throw err;
          open = false;
        }
      }
      if (done) await save({ patch: { lastSynced: now() } });
      // Stopped while the last write was on its way: nothing is said (the catch below).
      alive();
      failures = 0;
      publish({ state: done ? "upToDate" : "syncing", again: !done });
    } catch (err) {
      open = false;
      // Stopped (the request cut off, or the flag found): not a failure, and nothing more is read,
      // counted, or said. Whoever stopped it is clearing what the sync kept.
      if (stopped) return status;
      const known = err instanceof Halt || err instanceof Offline || err?.name === "Offline" || err instanceof Refused || err instanceof Behind;
      // Anything else may have left this memory ahead of what was written (a failed write of the
      // sync's own state): the next pass reads it again.
      if (!known) meta = null;
      // What waits is counted from the notebook alone, so the reader sees it while nothing can be sent.
      try {
        await load();
        await owed();
      } catch (inner) {
        log("what is owed could not be counted", inner);
      }
      if (err instanceof Halt) {
        publish({ state: err.state, ...err.detail });
      } else if (err instanceof Offline || err?.name === "Offline") {
        failures++;
        publish({ state: "offline", failures });
      } else {
        failures++;
        log("a pass failed", err);
        publish({ state: "error", failures, reason: err instanceof Refused ? err.word : err instanceof Behind ? "behind" : "failed" });
      }
    }
    return status;
  }

  /** Counts what waits without a request, and publishes it: for a change made while nothing can be sent. */
  async function tally() {
    if (stopped) return status;
    try {
      await load();
      await owed();
      publish({});
    } catch (err) {
      log("what is owed could not be counted", err);
    }
    return status;
  }

  return {
    /**
     * One pass. Resolves to the status it ends with, never rejects. A pass
     * asked for while one runs is that same pass. A stopped engine starts
     * none, and resolves to the status it has.
     */
    pass() {
      if (stopped) return running ?? Promise.resolve(status);
      running ??= run().finally(() => {
        running = null;
      });
      return running;
    },

    /**
     * Counts what waits to be sent, with no request, and publishes the status
     * with it. For a change the reader makes while a pass can't run (offline,
     * signed out). While a pass runs, it resolves when that pass does.
     */
    tally() {
      return running ?? tally();
    },

    /** The notebook changed: these ids are read again before the next push. Leave `ids` out to read everything. */
    touch(ids) {
      if (!ids) scanned = false;
      else for (const id of ids) touched.add(id);
    },

    /**
     * Takes a keyring this device was given (at setup or joining, by whoever
     * ran that) or made (a change of key from this session). It is checked
     * against the one already held, sealed to the device's own key, and kept
     * that way: at rest there is only the sealed copy.
     */
    async adopt(incoming) {
      alive();
      await load();
      if (keyring) checkKeyring({ held: keyring, highest: Math.max(meta.highest, keyring.current), incoming });
      if (incoming.notebook !== meta.notebook) throw new Refusal("notebook");
      const sealed = await sealKeyring({ keyring: incoming, recipientPublic: device.key.public });
      // A stopped engine takes nothing: it is checked again before anything changes (save checks too).
      alive();
      keyring = incoming;
      open = false;
      await save({ patch: { sealed: { enc: toBase64url(sealed.enc), ct: toBase64url(sealed.ct) }, highest: Math.max(meta.highest, incoming.current) } });
    },

    /** The keyring in memory, once a pass has opened it: what the account pages seal and open with. */
    keyring: () => keyring,

    /** After a new session token, or the reader's "Reconnect": the next pass opens the session from the start, and tries rows the ceiling held back. */
    resume() {
      open = false;
      failures = 0;
      full = null;
    },

    /**
     * Stops the engine for good (the reader stopped syncing, or signed out):
     * no request, no write to the notebook or the sync's state, and no pass
     * from here. Resolves to the status once the pass that was running, if
     * any, has ended, which it does at its next request or write.
     */
    stop() {
      stopped = true;
      return running ?? Promise.resolve(status);
    },

    status: () => status,
    failures: () => failures,
  };
}
