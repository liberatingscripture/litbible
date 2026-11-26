// test/helpers/fake-notebook-service.mjs
//
// A stand-in for the LIT notebook service, for the sync's tests in the root
// suite (the real one runs in workerd, in its own package). It answers the
// requests the website's connector sends (STUDY-DESK-ENCRYPTION.md, "The
// service's interface": "The account," "Devices and holders" for the sealed
// keyring, and "Records"), meant to give the same words, statuses, shapes,
// sizes, and order of checks as workers/notebook-service/src/rows.js,
// session.js, account.js, http.js, and check.js on those five routes: the
// session first, then what the route needs of it (`not_open`, `no_notebook`),
// then the body's size, then its contents. Nothing holds it to them but
// reading those files (Audit 9, SY9-2, found it had drifted), so a change
// there needs the same change here. What it leaves out: the words of routes
// it doesn't serve, the Content-Type check, the proof's form, the rate
// limiter (`slowDown` stands in), and the busy retry inside the service
// (`busy` stands in). The connector is held to the real service by the
// end-to-end run against `wrangler dev`, and the account's tests run against
// the service's own code (test/helpers/real-notebook-service.mjs).
//
// It can't open anything, like the real one: it keeps sealed rows and sealed
// keyrings, and a hash of the key proof. What a test does on a device's side
// of the interface (setting up, joining, changing the key) goes through the
// same reference the website ships.
//
// A test can make it misbehave: `offline()` and `online()`, `slowDown(n)`,
// `busy(n)`, `fail(n)`, `endSession(token)`, `goBack()`, and `onCall`, which
// sees every request before it is answered.

import * as ref from "../../src/lib/desk-crypto.mjs";
import { Offline } from "../../src/lib/desk-sync-engine.mjs";

const b64 = ref.toBase64url;

const LIMITS = { rowsPerRequest: 500, pageRows: 500, pageChars: 4 * 1024 * 1024, bodyBytes: 4 * 1024 * 1024, maxRecordBytes: 1_048_576, tagBytes: 16, padBlock: 256 };
/** A session token as the service reads one (session.js, BEARER): 32 bytes in base64url, 43 characters. */
const BEARER = /^Bearer ([A-Za-z0-9_-]{43})$/i;
const TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/;
const RECORD_ID = /^[\x20-\x7e]{1,64}$/;
const BASE64URL = /^[A-Za-z0-9_-]*$/;
const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

const isObject = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const isCount = (v, min = 0) => Number.isSafeInteger(v) && v >= min;
const isTime = (v) => typeof v === "string" && v.length <= 64 && TIME.test(v);
const isRecordId = (v) => typeof v === "string" && RECORD_ID.test(v);

function base64urlBytes(text) {
  if (typeof text !== "string" || !BASE64URL.test(text)) return -1;
  const rest = text.length % 4;
  if (rest === 1) return -1;
  if (rest) {
    const last = ALPHABET.indexOf(text[text.length - 1]);
    if (last & (rest === 2 ? 0b1111 : 0b11)) return -1;
  }
  return Math.floor((text.length * 3) / 4);
}

class Refuse extends Error {
  constructor(status, code, extra = {}) {
    super(code);
    this.status = status;
    this.code = code;
    this.extra = extra;
  }
}
const refuse = (status, code, extra) => {
  throw new Refuse(status, code, extra);
};
const bad = (field) => refuse(400, "bad_request", { field });

/** The checks on one row to put, in the interface's order (rows.js, refusedRow). */
function refusedRow(row) {
  if (row.v !== 1) return "v";
  if (!isRecordId(row.id)) return "id";
  if (!isTime(row.modified)) return "modified";
  if (row.deletedAt !== undefined && row.deletedAt !== null && !isTime(row.deletedAt)) return "deletedAt";
  if (base64urlBytes(row.nonce) !== 12) return "nonce";
  const bytes = base64urlBytes(row.ct);
  if (bytes < 0) return "ct";
  if (bytes > LIMITS.maxRecordBytes + LIMITS.tagBytes) return "too_large";
  const padded = bytes - LIMITS.tagBytes;
  if (padded < LIMITS.padBlock || padded % LIMITS.padBlock) return "ct";
  if (!isCount(row.rev)) return "rev";
  return null;
}

const rowOut = (row) => ({
  v: row.v,
  id: row.id,
  rev: row.rev,
  modified: row.modified,
  ...(row.deletedAt == null ? {} : { deletedAt: row.deletedAt }),
  kid: row.kid,
  nonce: row.nonce,
  ct: row.ct,
});

export function createFakeService({ now = () => new Date().toISOString() } = {}) {
  /** name → { notebook, kid, proofHash, lists, rev, rows: Map, devices: Map, waiting, replaced } */
  const accounts = new Map();
  /** token → { account, device, openKid } */
  const sessions = new Map();
  let unreachable = false;
  let slow = 0;
  let busy = 0;
  let failing = 0;
  let lost = 0;
  const service = {
    /** Every request, as { method, path, body, account }, in order. */
    calls: [],
    /** Called with each request before it is answered; may throw Offline. */
    onCall: null,

    offline() {
      unreachable = true;
    },
    online() {
      unreachable = false;
    },
    /** The next `n` requests are answered `slow_down`. */
    slowDown(n = 1) {
      slow = n;
    },
    /** The next `n` requests are answered `busy`. */
    busy(n = 1) {
      busy = n;
    },
    /** The next `n` requests are answered `error` (500). */
    fail(n = 1) {
      failing = n;
    },
    /** The next `n` requests (those `only` picks, if given) are carried out, and their answers are lost on the way back. */
    loseAnswer(n = 1, only = null) {
      lost = n;
      service.losing = only;
    },
    /** When true, a conflict is answered without the row that stands (as the real service does past a page of them). */
    withoutConflictRows: false,
    /** The service's own clock, when a test sets one apart from the devices'. */
    time: null,

    account(name) {
      if (!accounts.has(name)) {
        accounts.set(name, { notebook: null, kid: 0, proofHash: null, lists: 0, rev: 0, rows: new Map(), devices: new Map(), waiting: null, replaced: null });
      }
      return accounts.get(name);
    },

    /** A session for an account, signed in and no more. Its token has the real one's form (createSession, session.js). */
    signIn(name) {
      service.account(name);
      const token = b64(ref.randomBytes(32));
      sessions.set(token, { account: name, device: null, openKid: 0 });
      return token;
    },
    endSession(token) {
      sessions.delete(token);
    },

    /** What `POST /notebook` does, from a first device (see setUp below). */
    async createNotebook(token, { notebook, proofHash, device }) {
      const session = sessions.get(token);
      const account = service.account(session.account);
      if (account.notebook) refuse(409, "already_set_up", { notebook: account.notebook });
      Object.assign(account, { notebook, kid: 1, proofHash, lists: 1 });
      account.devices.set(device.id, { keyring: { kid: 1, ...device.keyring } });
      session.device = device.id;
      session.openKid = 1;
    },

    /** What `POST /devices` does, for a device that came in holding the keyring. */
    async addDevice(token, { device, kid }) {
      const session = sessions.get(token);
      const account = service.account(session.account);
      account.devices.set(device.id, { keyring: { kid, ...device.keyring } });
      account.lists++;
      session.device = device.id;
      session.openKid = kid;
    },

    /**
     * What `POST /notebook/key` does: the next kid, a new proof, a keyring
     * for each kept device, the removed ones gone with their sessions, and
     * every session but the caller's no longer open.
     */
    async changeKey(token, { proofHash, devices, removeDevices = [] }) {
      const session = sessions.get(token);
      const account = service.account(session.account);
      account.kid += 1;
      account.lists += 1;
      account.proofHash = proofHash;
      for (const id of removeDevices) account.devices.delete(id);
      for (const { id, keyring } of devices) account.devices.set(id, { keyring: { kid: account.kid, ...keyring } });
      for (const [t, s] of sessions) {
        if (s.account !== session.account) continue;
        if (removeDevices.includes(s.device)) sessions.delete(t);
      }
      session.openKid = account.kid;
    },

    /**
     * A row written by some other client, whatever it holds: stored at the
     * next revision with none of the service's checks, so a test can stand a
     * row no well-behaved client would send (a damaged seal, a version from
     * the future) where a device will pull it. Returns the stored row.
     */
    plant(name, row) {
      const account = service.account(name);
      account.rev += 1;
      const stored = { deletedAt: null, ...row, rev: account.rev };
      account.rows.set(row.id, stored);
      return stored;
    },

    /** The service restored from an older copy: every row written after `rev` is gone, and revisions go back. */
    goBack(name, rev) {
      const account = service.account(name);
      for (const [id, row] of account.rows) if (row.rev > rev) account.rows.delete(id);
      account.rev = rev;
    },

    /**
     * Replaces the account's notebook with none (what a carried-out "Start a
     * new notebook" leaves; carryOutReplace in waiting.js). The account's
     * revision counter is not reset, so the next notebook's rows never take a
     * revision a device already pulled.
     */
    replaceNotebook(name) {
      const account = service.account(name);
      Object.assign(account, { notebook: null, kid: 0, proofHash: null, rows: new Map(), devices: new Map(), waiting: null, replaced: { when: now(), platform: "web", through: "passkey" } });
      account.lists++;
      for (const s of sessions.values()) if (s.account === name) Object.assign(s, { device: null, openKid: 0, failures: 0 });
    },

    /** Every request that came through `fetch` below, as { url, init }: what the browser's carrier sent. */
    fetched: [],
    /**
     * A `fetch` for the connector's own carrier (src/scripts/desk/sync/service.js):
     * the same service, reached as HTTP. No connection is a TypeError, as a
     * browser's is.
     */
    async fetch(url, init = {}) {
      service.fetched.push({ url, init });
      const { pathname, search } = new URL(url);
      const token = BEARER.exec(init.headers?.Authorization ?? "")?.[1] ?? null;
      let answered;
      try {
        answered = await service.api(token).call(init.method ?? "GET", pathname + search, init.body === undefined ? undefined : JSON.parse(init.body));
      } catch (err) {
        if (err instanceof Offline) throw new TypeError("Failed to fetch");
        throw err;
      }
      const text = JSON.stringify(answered.body);
      return { status: answered.status, ok: answered.status < 300, text: async () => text };
    },

    /** An `api` for the engine: call(method, path, body) → { status, body }. */
    api(getToken) {
      return {
        async call(method, path, body) {
          const token = typeof getToken === "function" ? getToken() : getToken;
          const call = { method, path, body, token, account: sessions.get(token)?.account ?? null };
          service.calls.push(call);
          if (service.onCall) await service.onCall(call);
          if (unreachable) throw new Offline();
          // Through JSON, as a request and an answer are: nothing is shared by reference.
          const text = body === undefined ? undefined : JSON.stringify(body);
          const sent = text === undefined ? undefined : JSON.parse(text);
          let status = 200;
          let answered;
          try {
            answered = await route(token, method, path, sent, text === undefined ? 0 : new TextEncoder().encode(text).length);
          } catch (err) {
            if (!(err instanceof Refuse)) throw err;
            status = err.status;
            answered = { error: err.code, message: err.code, ...err.extra };
          }
          // The request was carried out and its answer never arrived.
          if (lost > 0 && (!service.losing || service.losing(call))) {
            lost--;
            throw new Offline();
          }
          if (service.withoutConflictRows) for (const item of [...(answered.put ?? []), ...(answered.remove ?? [])]) delete item.row;
          return { status, body: JSON.parse(JSON.stringify({ time: service.time?.() ?? now(), ...answered })) };
        },
      };
    },
  };

  function authenticate(token) {
    const session = sessions.get(token);
    if (!session) refuse(401, "sign_in");
    const account = service.account(session.account);
    const attached = session.device !== null && account.devices.has(session.device);
    const open = account.kid > 0 && attached && session.openKid === account.kid;
    return { session, account, open, device: attached ? session.device : null };
  }

  function needOpen(auth) {
    if (!auth.open) refuse(403, "not_open", { kid: auth.account.kid });
    return auth;
  }

  /**
   * `size` is the body's length in bytes. As `changing` in session.js does,
   * a route reads its body (`readBody`) only after the session and what the
   * route needs of it, so a device behind a change of key is told
   * "not_open" whatever it sent.
   */
  async function route(token, method, fullPath, body, size) {
    // http.js, readJson: no `what`, only the limit (the rows' own limit is "rows", below).
    const readBody = () => {
      if (size > LIMITS.bodyBytes) refuse(413, "too_large", { limit: LIMITS.bodyBytes });
    };
    if (slow > 0) {
      slow--;
      refuse(429, "slow_down", { retry: 60 });
    }
    if (busy > 0) {
      busy--;
      refuse(503, "busy");
    }
    if (failing > 0) {
      failing--;
      refuse(500, "error");
    }
    const url = new URL(fullPath, "https://notebook.example");
    const path = url.pathname.replace(/\/$/, "") || "/";

    if (method === "GET" && path === "/account") {
      const auth = authenticate(token);
      const { account } = auth;
      return {
        notebook: account.notebook,
        kid: account.kid,
        lists: account.lists,
        session: { open: auth.open, device: auth.device, expires: "2027-01-01T00:00:00.000Z" },
        ways: [],
        waiting: account.waiting,
        replaced: account.replaced,
      };
    }

    if (method === "GET" && path === "/keyring") {
      const { account } = authenticate(token);
      const id = url.searchParams.get("device");
      const entry = account.devices.get(id);
      if (!entry) refuse(404, "not_found", { what: "keyring" });
      return { device: id, keyring: entry.keyring };
    }

    if (method === "POST" && path === "/session/proof") {
      const auth = authenticate(token);
      const { account, session } = auth;
      if (account.kid === 0) refuse(409, "no_notebook");
      readBody();
      if (body.kid !== account.kid) refuse(409, "old_key", { kid: account.kid });
      const given = b64(await ref.sha256(ref.fromBase64url(body.proof)));
      if (given !== account.proofHash) {
        session.failures = (session.failures ?? 0) + 1;
        if (session.failures >= 5) {
          sessions.delete(token);
          refuse(401, "sign_in", { reason: "wrong_proofs" });
        }
        refuse(403, "wrong_proof", { left: 5 - session.failures });
      }
      if (!account.devices.has(body.device)) refuse(410, "gone", { what: "device" });
      Object.assign(session, { device: body.device, openKid: account.kid, failures: 0 });
      return { open: true, device: body.device, kid: account.kid };
    }

    if (method === "GET" && path === "/rows") {
      const { account } = needOpen(authenticate(token));
      const sinceText = url.searchParams.get("since") ?? "0";
      if (!/^(0|[1-9]\d{0,15})$/.test(sinceText)) bad("since");
      const since = Number(sinceText);
      const oldText = url.searchParams.get("old");
      if (oldText !== null && oldText !== "1") bad("old");
      const later = [...account.rows.values()]
        .filter((row) => row.rev > since && (oldText !== "1" || row.kid < account.kid))
        .sort((a, b) => a.rev - b.rev);
      const page = [];
      let chars = 0;
      for (const row of later) {
        if (page.length === LIMITS.pageRows || (page.length > 0 && chars + row.ct.length > LIMITS.pageChars)) break;
        chars += row.ct.length;
        page.push(row);
      }
      if (!page.length) return { kid: account.kid, rows: [], next: since, more: false };
      return { kid: account.kid, rows: page.map(rowOut), next: page[page.length - 1].rev, more: page.length < later.length };
    }

    if (method === "POST" && path === "/rows") {
      const { account } = needOpen(authenticate(token));
      readBody();
      if (!isObject(body)) bad("body");
      const put = body.put ?? [];
      const remove = body.remove ?? [];
      if (!Array.isArray(put)) bad("put");
      if (!Array.isArray(remove)) bad("remove");
      if (put.length + remove.length > LIMITS.rowsPerRequest) refuse(413, "too_large", { what: "rows", limit: LIMITS.rowsPerRequest });
      put.forEach((row, i) => {
        if (!isObject(row)) bad(`put[${i}]`);
        if (!isCount(row.kid, 1)) bad(`put[${i}].kid`);
      });
      remove.forEach((item, i) => {
        if (!isObject(item) || !isRecordId(item.id)) bad(`remove[${i}].id`);
        if (!isCount(item.rev, 1)) bad(`remove[${i}].rev`);
      });
      const named = [...put.map((row) => row.id).filter((id) => typeof id === "string"), ...remove.map((item) => item.id)];
      if (new Set(named).size !== named.length) bad("id");
      if (put.some((row) => row.kid !== account.kid)) refuse(409, "old_key", { kid: account.kid });

      let rev = account.rev;
      const conflicts = [];
      const putAnswers = put.map((row) => {
        const refused = refusedRow(row);
        if (refused) return { ...(typeof row.id === "string" ? { id: row.id } : {}), refused };
        const stands = account.rows.get(row.id)?.rev ?? 0;
        if (row.rev !== stands) {
          if (stands) conflicts.push(row.id);
          return { id: row.id, conflict: stands ? "changed" : "gone" };
        }
        rev += 1;
        account.rows.set(row.id, { v: row.v, id: row.id, rev, modified: row.modified, deletedAt: row.deletedAt ?? null, kid: row.kid, nonce: row.nonce, ct: row.ct });
        return { id: row.id, rev };
      });
      const gone = [];
      const removeAnswers = remove.map((item) => {
        const stands = account.rows.get(item.id)?.rev;
        if (stands === undefined) return { id: item.id, removed: true };
        if (item.rev !== stands) {
          conflicts.push(item.id);
          return { id: item.id, conflict: "changed" };
        }
        gone.push(item.id);
        return { id: item.id, removed: true };
      });
      if (gone.length) {
        rev += 1;
        for (const id of gone) account.rows.delete(id);
      }
      account.rev = rev;
      let chars = 0;
      for (const id of conflicts.sort((a, b) => account.rows.get(a).rev - account.rows.get(b).rev)) {
        const row = account.rows.get(id);
        if (chars + row.ct.length > LIMITS.pageChars) break;
        chars += row.ct.length;
        for (const item of [...putAnswers, ...removeAnswers]) if (item.conflict === "changed" && item.id === id) item.row = rowOut(row);
      }
      return { kid: account.kid, rev, put: putAnswers, remove: removeAnswers };
    }

    return refuse(404, "not_found");
  }

  return service;
}

/* ── A device's side of the interface, for the tests ─────────────────── */

/** A device that has joined nothing: an id and a key pair whose private half can't be read out. */
export async function newDevice(service, account) {
  return { account, token: service.signIn(account), id: ref.newId(), key: await ref.generateDeviceKey(), keyring: null };
}

const sealedFor = async (publicKey, keyring) => {
  const sealed = await ref.sealKeyring({ keyring, recipientPublic: publicKey });
  return { enc: b64(sealed.enc), ct: b64(sealed.ct) };
};

const proofHashOf = async (keyring) => b64(await ref.keyProofHash(await ref.keyProof(ref.keyOf(keyring, keyring.current))));

/** A first device sets a notebook up. Returns the device, holding the keyring, its session open. */
export async function setUp(service, account) {
  const device = await newDevice(service, account);
  device.keyring = ref.firstKeyring(ref.newId(), ref.randomBytes(32));
  await service.createNotebook(device.token, {
    notebook: device.keyring.notebook,
    proofHash: await proofHashOf(device.keyring),
    device: { id: device.id, keyring: await sealedFor(device.key.public, device.keyring) },
  });
  return device;
}

/** Another device joins, given the keyring by one that has it (a holder or an approval, in the real thing). */
export async function join(service, from) {
  const device = await newDevice(service, from.account);
  device.keyring = from.keyring;
  await service.addDevice(device.token, {
    kid: from.keyring.current,
    device: { id: device.id, keyring: await sealedFor(device.key.public, from.keyring) },
  });
  return device;
}

/**
 * A device changes the key, keeping `kept` (itself included) and removing
 * `removed`. Only `by` is given the new keyring here: every other kept
 * device finds its sealed copy on the service, as a real one does.
 */
export async function changeKey(service, by, { kept, removed = [], next = ref.nextKeyring(by.keyring, ref.randomBytes(32)) }) {
  await service.changeKey(by.token, {
    proofHash: await proofHashOf(next),
    devices: await Promise.all(kept.map(async (d) => ({ id: d.id, keyring: await sealedFor(d.key.public, next) }))),
    removeDevices: removed.map((d) => d.id),
  });
  by.keyring = next;
  return next;
}
