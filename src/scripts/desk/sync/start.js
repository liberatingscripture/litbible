// src/scripts/desk/sync/start.js
//
// The way in to the synced notebook's code (the plan's step 4g). Nothing
// imports this file statically: desk/store.js and desk/first-stage.js import
// it, dynamically, only once they have read a link from the notebook
// (src/lib/desk-sync-link.mjs), and the account pages (step 4h) import it
// when the reader signs in. test/desk-sync-gate.test.js holds that.
//
// What the account pages use:
//
//   linkNotebook({ store, service, token, notebook, device, keyring, replace, carry })
//       After sign-in, and after this device has set the notebook up or
//       joined it: keeps the session and the device's keys, links this
//       browser to the account's notebook, and starts syncing. The first
//       pass merges the notebook already in this browser into the account's
//       and the account's into it (the format's own merge, the later writing
//       winning), so nothing in either is lost.
//   currentSync()
//       The running connector, or null: status(), subscribe(), syncNow(),
//       setSession(), call(), device(), keyring(), adopt()
//       (./connector.js says what each does).
//   unlink({ store })
//       Signing this browser out of syncing: its keys, its session, and the
//       sync's state go. The notebook stays in the browser, whole.
//
// ONE NOTEBOOK AT A TIME (the plan's C5). A browser is linked to one account
// notebook or none. `linkNotebook` refuses a browser already linked to
// another notebook unless it is told `replace: true`, which is the reader's
// own yes, asked by whoever calls: the spec's rule is that a device that
// held one notebook never joins another by itself ("When a reader loses
// every device").

import { deskCtx } from "../desk-ctx.js";
import { sealKeyring, toBase64url } from "../../../lib/desk-crypto.mjs";
import { SYNC_META, allowedService, makeLink, readLink } from "../../../lib/desk-sync-link.mjs";
import { createConnector } from "./connector.js";
import { mountStatusLines } from "./status-line.js";
import { mountStoppedNotice } from "./stopped-notice.js";
import { openSyncDb } from "./sync-db.js";

/** The connector of this tab, once started: { store, link, ready: Promise<connector>, stop } */
let current = null;
let env = {};

const sameLink = (a, b) => a && b && a.link === b.link;

/** What `linkNotebook` writes beside a new link when the account page hands it over. */
const CARRIED = ["code", "seen"];

async function stopCurrent() {
  const was = current;
  current = null;
  if (!was) return;
  try {
    const connector = await was.ready;
    connector?.stop();
  } catch {
    /* it never started */
  }
  was.unmount?.();
  was.db?.close();
}

// Starting, linking, and unlinking each wait for the one before, so two of them never interleave
// (two stores opening on one page, or the link changing while a connector is starting).
let turn = Promise.resolve();
function inTurn(work) {
  const run = turn.then(work);
  turn = run.catch(() => {});
  return run;
}

/**
 * For tests: the browser's parts to use in place of the real ones (see
 * connector.js), and a fresh start, as a page that was closed and opened
 * again: the tab's connector is stopped, and storage is left as it is.
 */
export function setSyncEnv(next = {}) {
  env = next;
  return inTurn(stopCurrent);
}

async function startNow({ store }) {
  const link = readLink(await store.getMeta(SYNC_META));
  if (!link || !allowedService(link.service, env.pageOrigin ?? globalThis.location?.origin)) {
    await stopCurrent();
    return null;
  }
  if (current && sameLink(current.link, link)) {
    const connector = await current.ready;
    // Another store on the same page (the shell's, after the first stage's): its changes count too.
    if (store !== current.store) connector.watch(store);
    return connector;
  }
  await stopCurrent();

  const mine = { link, store, db: null, unmount: null, ready: null };
  current = mine;
  mine.ready = (async () => {
    mine.db = await openSyncDb({ idb: env.idb });
    const connector = await createConnector({ store, db: mine.db, link, env });
    const offLine = mountStatusLines(connector, env);
    const offNotice = mountStoppedNotice(connector, { ...env, db: mine.db });
    mine.unmount = () => {
      offLine();
      offNotice();
    };
    return connector;
  })();
  try {
    return await mine.ready;
  } catch (err) {
    if (current === mine) await stopCurrent();
    throw err;
  }
}

/**
 * Starts syncing in this tab if the notebook is linked, stops if it no longer
 * is, and starts again if the link changed. Safe to call again: a tab has one
 * connector, and a second store opened on the same page joins the first's.
 * desk/store.js calls it when a store opens and whenever the link is written,
 * in this tab or another.
 *
 * @param {{ store: object }} options the desk's store, already open
 * @returns {Promise<object | null>} the connector, or null when the browser isn't linked
 */
export const startSync = ({ store }) => inTurn(() => startNow({ store }));

/**
 * For a page that has no store open yet (the desk's first stage): opens the
 * notebook, which starts the connector if the browser is linked.
 */
export async function startSyncAlone() {
  if (current) return current.ready;
  const { openStore } = await import("../store.js");
  const store = await openStore({ ctx: deskCtx });
  // openStore starts the connector itself, without waiting for it; this waits.
  return startSync({ store });
}

/** The running connector, or null. */
export const currentSync = async () => (current ? current.ready : null);

export class LinkRefused extends Error {
  constructor(why, detail = {}) {
    super(`desk-sync: ${why}`);
    this.name = "LinkRefused";
    this.why = why;
    Object.assign(this, detail);
  }
}

/**
 * Links this browser to an account's notebook and starts syncing.
 *
 * @param {{ store: object, service: string, token: string, notebook: string,
 *   device: { id: string, key: { privateKey: CryptoKey, public: Uint8Array }, sign?: object },
 *   keyring: object, replace?: boolean }} options
 *   `service` is the service's origin; `token` the session sign-in gave;
 *   `notebook` the account's notebook id; `device` this device's id and key
 *   pairs, the private halves not extractable; `keyring` the notebook's
 *   keyring, opened (this device made it, or was given it and has checked
 *   where it came from). `replace: true` is the reader's yes to leaving the
 *   notebook this browser was linked to before. `carry` is what the account
 *   page keeps beside the link from its first moment (./sync-db.js: "code",
 *   a recovery code not yet confirmed, and "seen"); nothing else is taken.
 * @returns {Promise<object>} the connector
 */
export function linkNotebook({ store, service, token, notebook, device, keyring, replace = false, carry = null }) {
  return inTurn(async () => {
    const origin = allowedService(service, env.pageOrigin ?? globalThis.location?.origin);
    if (!origin) throw new LinkRefused("service");
    if (typeof token !== "string" || !token) throw new LinkRefused("session");
    if (!device?.id || !device.key?.privateKey || !device.key.public) throw new LinkRefused("device");
    if (device.key.privateKey.extractable) throw new LinkRefused("device", { detail: "the device's private key can be read out" });
    if (keyring?.notebook !== notebook) throw new LinkRefused("keyring");

    const held = readLink(await store.getMeta(SYNC_META));
    if (held && held.notebook !== notebook && !replace) throw new LinkRefused("otherNotebook", { notebook: held.notebook });

    await stopCurrent();
    // The sync's storage first and the link second: a link is only ever written over keys that are there.
    const db = await openSyncDb({ idb: env.idb });
    try {
      const sealed = await sealKeyring({ keyring, recipientPublic: device.key.public });
      const id = (env.randomUUID ?? (() => globalThis.crypto.randomUUID()))();
      await db.clear();
      const kept = Object.fromEntries(CARRIED.filter((key) => carry?.[key] != null).map((key) => [key, carry[key]]));
      await db.set({ ...kept, link: id, token, device: { id: device.id, key: device.key, sign: device.sign ?? null } });
      await db.write({
        meta: { notebook, cursor: 0, highest: keyring.current, resealed: 0, sealed: { enc: toBase64url(sealed.enc), ct: toBase64url(sealed.ct) } },
      });
      const now = (env.now ?? (() => new Date().toISOString()))();
      await store.setMeta(SYNC_META, makeLink({ id, notebook, service: origin, now }));
    } finally {
      db.close();
    }
    return startNow({ store });
  });
}

/**
 * Stops syncing in this browser and forgets what syncing needed: the
 * session, the device's keys, the sealed keyring, and the loop's state. The
 * notebook is not touched, and neither is anything on the service: removing
 * this device there (`DELETE /devices/<id>`) is the account pages' request,
 * made before this.
 */
export function unlink({ store }) {
  return inTurn(async () => {
    await stopCurrent();
    // The link first: from here no tab starts a connector, whatever becomes of the rest.
    await store.setMeta(SYNC_META, null);
    const db = await openSyncDb({ idb: env.idb });
    try {
      await db.clear();
    } finally {
      db.close();
    }
  });
}
