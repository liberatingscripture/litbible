// src/scripts/desk/sync/connector.js
//
// The website's connector (the plan's step 4g): what runs the sync loop in a
// browser. It is downloaded only by a browser that is linked to an account
// (src/lib/desk-sync-link.mjs; the gate is in desk/store.js and
// desk/first-stage.js), so a reader who doesn't sync loads none of this, the
// loop, or the encryption.
//
// ONE TAB SYNCS FOR THE BROWSER. Every tab with the notebook open starts a
// connector, and they ask for one Web Lock. The tab that holds it (the
// leader) runs the loop (src/lib/desk-sync-engine.mjs) over the notebook the
// tabs share; the others only show its status and pass it requests over a
// BroadcastChannel ("sync now," a new session, a new keyring). When the
// leader's tab closes the lock passes on, and the next tab reads the loop's
// state from storage and carries on. Nothing of the notebook travels between
// tabs here: the leader hears another tab's change the way every desk view
// does, from the store.
//
// WHEN A PASS RUNS: as the leader starts; two seconds after the notebook
// last changed (ten at most, while the reader keeps typing); once a minute
// while a tab is visible; when the browser comes back online or a tab is
// looked at again; and when the reader presses "Reconnect." After a pass
// that couldn't reach the service it tries again by itself, waiting longer
// each time (retryDelay). A pass that ends needing the reader (signed out,
// removed, another notebook, keys that don't open) is not repeated on a
// timer: only "Reconnect," or the account pages handing in a new session or
// keyring, starts another. What waits is still counted, so the status line
// can say how much. A pass that ends "full" (the account's ceiling) sets no
// timer of its own: the engine holds the rows back for an hour
// (FULL_WAIT_MS in desk-sync-engine.mjs), the passes asked for meanwhile
// still pull, and "Reconnect" tries the rows at once.
//
// WHAT THE ACCOUNT PAGES GET (step 4h) is the object `createConnector`
// resolves to, and `linkNotebook` and `unlink` in ./start.js.

import { checkKeyring, fromBase64url, openKeyring, sealKeyring, toBase64url } from "../../../lib/desk-crypto.mjs";
import { retryDelay } from "../../../lib/desk-sync.mjs";
import { createSyncEngine } from "../../../lib/desk-sync-engine.mjs";
import { SYNC_CHANNEL, SYNC_LOCK } from "../../../lib/desk-sync-link.mjs";
import { needsReader } from "../../../lib/desk-sync-status.mjs";
import { createApi } from "./service.js";

/** After the notebook changes, how long the loop waits for the reader to stop, and the longest it waits. */
export const CHANGE_WAIT_MS = 2000;
export const CHANGE_MAX_MS = 10_000;
/** How often a visible tab asks for a pass. */
export const POLL_MS = 60_000;
/** A tab looked at again asks for a pass if the last one is older than this. */
export const VISIBLE_AFTER_MS = 30_000;
/** How long a tab waits for the leader to answer a request it passed on. */
const ANSWER_MS = 15_000;

const sameIds = (ids, set) => set != null && ids.length === set.size && ids.every((id) => set.has(id));

/**
 * @param {{ store: object, db: object, link: object, env?: object }} options
 *   `store` is the desk's store (desk/store.js); `db` the sync's storage
 *   (./sync-db.js), already holding this link's keys and session; `link` the
 *   link read from the notebook. `env` replaces the browser's parts in tests.
 */
export async function createConnector({ store, db, link, env = {} }) {
  const {
    fetch: send = globalThis.fetch?.bind(globalThis),
    locks = globalThis.navigator?.locks,
    Channel = globalThis.BroadcastChannel,
    doc = globalThis.document,
    win = globalThis.window,
    pageOrigin = globalThis.location?.origin,
    now = () => new Date().toISOString(),
    setTimer = (fn, ms) => setTimeout(fn, ms),
    clearTimer = (t) => clearTimeout(t),
    log = (...args) => console.warn("Study Desk sync:", ...args),
  } = env;

  let stopped = false;
  let leader = false;
  let engine = null;
  let release = null;
  let status = { state: "starting", pending: 0, problems: {}, lastSynced: null, clock: null, account: null };
  let lastPassAt = 0;
  const listeners = new Set();
  const cleanup = [];
  const watched = new WeakSet();

  /* ── What this browser holds for the link ───────────────────────────── */

  let token = null;
  let device = null;
  async function readKeys() {
    const kept = await db.getAll(["link", "token", "device"]);
    const mine = kept.link === link.link;
    token = mine ? (kept.token ?? null) : null;
    device = mine && kept.device?.id && kept.device.key?.privateKey ? kept.device : null;
  }
  await readKeys();

  const api = createApi({ service: link.service, token: () => token, fetch: send, pageOrigin });

  /* ── Status ─────────────────────────────────────────────────────────── */

  const channel = typeof Channel === "function" ? new Channel(SYNC_CHANNEL) : null;
  const post = (message) => {
    try {
      channel?.postMessage({ link: link.link, ...message });
    } catch (err) {
      log("a message to the other tabs failed", err);
    }
  };

  function show(next, { tell = true } = {}) {
    status = { ...next, leader };
    for (const fn of listeners) {
      try {
        fn(status);
      } catch (err) {
        log("a status listener failed", err);
      }
    }
    if (tell && leader) post({ t: "status", status: next });
  }

  /* ── The loop, in the tab that leads ────────────────────────────────── */

  let ownWrite = null;
  // The notebook as the loop sees it. A write of the loop's own is told apart from the reader's,
  // so merging what arrived doesn't ask for another pass.
  const notebook = {
    all: () => store.all(),
    get: (id) => store.get(id),
    change: (build, options) =>
      store.change(async (reads) => {
        const plan = await build(reads);
        ownWrite = plan ? new Set([...(plan.put ?? []).map((r) => r.id), ...(plan.remove ?? [])]) : null;
        return plan;
      }, options),
  };

  function makeEngine() {
    engine = device
      ? createSyncEngine({ notebook, state: db, api, device: { id: device.id, key: device.key }, now, onStatus: (s) => show(s), log })
      : null;
    if (!engine) show({ ...status, state: "noKeys" });
  }

  let changeTimer = null;
  let changeSince = 0;
  let retryTimer = null;
  let running = null;

  function clearTimers() {
    if (changeTimer) clearTimer(changeTimer);
    if (retryTimer) clearTimer(retryTimer);
    changeTimer = retryTimer = null;
    changeSince = 0;
  }

  /** One pass in the leader, and what follows it. */
  function runPass({ manual = false } = {}) {
    if (stopped || !leader) return Promise.resolve(status);
    if (!engine) {
      show({ ...status, state: "noKeys" });
      return Promise.resolve(status);
    }
    if (running) return running;
    clearTimers();
    if (manual) engine.resume();
    running = engine
      .pass()
      .then((ended) => {
        running = null;
        lastPassAt = Date.now();
        if (stopped) return ended;
        if (ended.state === "offline" || ended.state === "error") {
          retryTimer = setTimer(() => runPass(), retryDelay(engine.failures()));
        } else if (ended.state === "slowed") {
          retryTimer = setTimer(() => runPass(), (ended.retry ?? 60) * 1000);
        } else if (ended.state === "syncing" && ended.again) {
          // More than one pass does at a time (another device keeps writing). Go on, after a breath.
          retryTimer = setTimer(() => runPass(), 1000);
        }
        return ended;
      })
      .catch((err) => {
        running = null;
        log("a pass failed outside the loop", err);
        return status;
      });
    return running;
  }

  /**
   * A pass is wanted now. `changed` says the notebook changed (the others are
   * the clock and the browser's own signals); `manual` that the reader asked.
   */
  function fire({ changed = false, manual = false } = {}) {
    if (stopped) return;
    if (!leader) {
      post({ t: "sync", changed, manual });
      return;
    }
    if (manual) {
      runPass({ manual: true });
      return;
    }
    // Nothing a timer can fix (it needs the reader), or the service can't be reached and a retry is
    // already waiting: count what waits, so the status line says how much, and send nothing.
    if (needsReader(status.state) || (changed && retryTimer)) {
      engine?.tally();
      return;
    }
    runPass();
  }

  /** The notebook changed: a pass once the reader has stopped, and before long even if they haven't. */
  function changedSoon() {
    if (stopped) return;
    const at = Date.now();
    changeSince ||= at;
    if (changeTimer) clearTimer(changeTimer);
    const wait = Math.max(0, Math.min(CHANGE_WAIT_MS, changeSince + CHANGE_MAX_MS - at));
    changeTimer = setTimer(() => {
      changeTimer = null;
      changeSince = 0;
      fire({ changed: true });
    }, wait);
  }

  cleanup.push(
    store.subscribe((ids, origin) => {
      if (stopped) return;
      if (leader && engine) {
        // The loop's own merge, heard back: nothing to read again, and no pass to ask for.
        if (origin === "this-tab" && sameIds(ids, ownWrite)) {
          ownWrite = null;
          return;
        }
        engine.touch(ids);
        changedSoon();
        return;
      }
      // In a tab that follows, a change made here asks the leader, whose own timers may be slowed in
      // a tab nobody is looking at. (It hears the change itself, from its own store.)
      if (origin === "this-tab") changedSoon();
    }),
  );

  /* ── Leading, and following ─────────────────────────────────────────── */

  function lead() {
    if (stopped) return;
    leader = true;
    makeEngine();
    if (engine) runPass();
  }

  if (locks?.request) {
    locks
      .request(SYNC_LOCK, () => {
        if (stopped) return undefined;
        lead();
        return new Promise((resolve) => {
          release = resolve;
        });
      })
      .catch((err) => {
        // No lock to be had (a browser that refuses them here): this tab syncs for itself.
        log("the tabs couldn't agree on one to sync", err);
        if (!leader) lead();
      });
  } else {
    lead();
  }

  const asks = new Map();
  let askSeq = 0;
  /** Passes a request to the leader and waits for its answer. */
  function ask(message) {
    return new Promise((resolve, reject) => {
      const n = `${Date.now().toString(36)}-${++askSeq}`;
      const timer = setTimer(() => {
        asks.delete(n);
        reject(new Error("desk-sync: the tab that syncs didn't answer"));
      }, ANSWER_MS);
      asks.set(n, { resolve, reject, timer });
      post({ ...message, n });
    });
  }

  async function adoptHere(incoming) {
    if (!engine) throw new Error("desk-sync: this browser holds no keys for the notebook");
    await running;
    await engine.adopt(incoming);
    runPass({ manual: true });
  }

  /** The keyring, from the loop's memory or opened from the sealed copy this browser keeps. */
  async function openHeld() {
    const held = engine?.keyring();
    if (held) return held;
    if (!device) return null;
    const { meta } = await db.read();
    if (!meta?.sealed) return null;
    try {
      return await openKeyring({ recipient: device.key, enc: fromBase64url(meta.sealed.enc), ct: fromBase64url(meta.sealed.ct) });
    } catch {
      return null;
    }
  }

  if (channel) {
    channel.onmessage = async (event) => {
      const m = event.data;
      if (stopped || !m || m.link !== link.link) return;
      if (m.t === "status" && !leader) show(m.status, { tell: false });
      else if (m.t === "hello" && leader) post({ t: "status", status });
      else if (m.t === "sync" && leader) {
        // A following tab's clock or visibility asks often; its reader's changes and presses always count.
        if (m.manual || m.changed || Date.now() - lastPassAt > VISIBLE_AFTER_MS) fire({ changed: m.changed === true, manual: m.manual === true });
      } else if (m.t === "resume") {
        // A new session was written by another tab: every tab reads it, and the leader tries again.
        await readKeys();
        if (leader) runPass({ manual: true });
      } else if (m.t === "adopt" && leader) {
        try {
          const incoming = await openKeyring({ recipient: device.key, enc: fromBase64url(m.sealed.enc), ct: fromBase64url(m.sealed.ct) });
          await adoptHere(incoming);
          post({ t: "answer", n: m.n, ok: true });
        } catch (err) {
          post({ t: "answer", n: m.n, ok: false, why: err?.why ?? err?.message ?? "failed" });
        }
      } else if (m.t === "answer" && asks.has(m.n)) {
        const waiting = asks.get(m.n);
        asks.delete(m.n);
        clearTimer(waiting.timer);
        if (m.ok) waiting.resolve();
        else waiting.reject(Object.assign(new Error(`desk-sync: ${m.why}`), { why: m.why }));
      }
    };
    post({ t: "hello" });
  }

  /* ── The browser's own signals ──────────────────────────────────────── */

  const listen = (target, type, fn) => {
    if (!target?.addEventListener) return;
    target.addEventListener(type, fn);
    cleanup.push(() => target.removeEventListener(type, fn));
  };
  const visible = () => !doc || doc.visibilityState !== "hidden";
  listen(win, "online", () => fire());
  listen(win, "pageshow", (e) => {
    if (e.persisted) fire();
  });
  listen(doc, "visibilitychange", () => {
    if (visible() && Date.now() - lastPassAt > VISIBLE_AFTER_MS) fire();
  });
  const poll = setInterval(() => {
    if (visible()) fire();
  }, POLL_MS);
  poll.unref?.();
  cleanup.push(() => clearInterval(poll));

  /* ── What the status line and the account pages use ─────────────────── */

  return {
    link,

    /** The latest status: the engine's (src/lib/desk-sync-engine.mjs), with `leader`, whether this tab runs the loop. */
    status: () => status,

    /** Calls `fn(status)` on every change. Returns the way to stop. */
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },

    /** "Reconnect": a pass now, whatever state the last one ended in. Resolves when it has been asked for. */
    async syncNow() {
      fire({ manual: true });
    },

    /**
     * A new session for this browser's account, after the reader signed in
     * again. The device and its keys are the ones already here.
     */
    async setSession(next) {
      if (typeof next !== "string" || !next) throw new Error("desk-sync: not a session");
      await db.set({ token: next });
      await readKeys();
      post({ t: "resume" });
      if (leader) runPass({ manual: true });
    },

    /** One request to the service with this browser's session: what the account pages send. `{ status, body }`. */
    call: (method, path, body) => api.call(method, path, body),

    /** This device's id and its key pairs, as they are kept. Null when this browser holds none for the link. */
    device: () => (device ? { id: device.id, key: device.key, sign: device.sign ?? null } : null),

    /**
     * The notebook's keyring, opened: what a device card or a keyring for
     * another device is sealed from. Its key bytes are in memory only, so
     * nothing a caller does with it may store them. Null when this browser
     * can't open one.
     */
    keyring: () => openHeld(),

    /**
     * Takes a keyring this session made (a change of key) or was given. It is
     * checked against the one held, as one from the service is: the same
     * notebook, not going backward, every held key unchanged. Rejects with
     * the reference's refusal (`why`) when it doesn't pass.
     */
    async adopt(incoming) {
      if (!device) throw new Error("desk-sync: this browser holds no keys for the notebook");
      if (leader) return adoptHere(incoming);
      const held = await openHeld();
      if (held) checkKeyring({ held, incoming });
      // To the tab that syncs, sealed to this device's own key: no key travels between tabs unsealed.
      const sealed = await sealKeyring({ keyring: incoming, recipientPublic: device.key.public });
      return ask({ t: "adopt", sealed: { enc: toBase64url(sealed.enc), ct: toBase64url(sealed.ct) } });
    },

    /**
     * A second store opened on this page (the shell's, after the first
     * stage's own): what the reader changes through it asks for a pass too.
     * The tab that leads hears those changes from its own store already.
     */
    watch(other) {
      if (stopped || other === store || watched.has(other)) return;
      watched.add(other);
      cleanup.push(
        other.subscribe((ids, origin) => {
          if (!stopped && !leader && origin === "this-tab") changedSoon();
        }),
      );
    },

    /** Stops this tab's connector. Storage is left as it is. */
    stop() {
      if (stopped) return;
      stopped = true;
      clearTimers();
      for (const undo of cleanup) undo();
      for (const waiting of asks.values()) clearTimer(waiting.timer);
      asks.clear();
      try {
        channel?.close();
      } catch {
        /* already closed */
      }
      release?.();
      leader = false;
      listeners.clear();
    },

    /** For tests: resolves when no pass is running. */
    idle: async () => {
      while (running) await running;
    },
  };
}
