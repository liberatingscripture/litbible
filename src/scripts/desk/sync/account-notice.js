// src/scripts/desk/sync/account-notice.js
//
// Two things about a reader's account that were said only on the account's
// home are said on whatever page they are reading (BVJ, 2026-11-25, of
// Claude's mock: "Go with all your recommendations and choices"):
//
//   1. A REQUEST THAT WAITS. A request to delete the account, or to replace
//      its notebook, made by a sign-in that doesn't hold the key waits seven
//      days. The wait protects a reader only if their devices say so. Every
//      pass already asks the account (`status.account.waiting`), so this
//      costs no request. It is told as a stop is told (./stopped-notice.js):
//      the dot in every place a stop's goes, and the notebook's notice bar
//      with the status line's own sentence and "Review," once, and again a
//      day later for as long as the request waits.
//   2. WHAT IS NEW. A device that joined, or a new way to open the notebook
//      (a recovery code, a passkey that carries the key). A device that joins
//      can read the whole notebook at once, with no wait, so hearing of it
//      soon is the only defense. A dot on the header's account button, and
//      the bar once, with "Review" and "OK." "OK" marks it seen, exactly as
//      the account home's own "OK" does (the `seen` value); a bar that is
//      closed without an answer is not put up again, and the dot stays until
//      the account page's "OK."
//
// "Review" opens the account page, where the request can be canceled and a
// device removed. Neither notice comes up over a tour, a print, a sheet's own
// page, or another notice (./notice-parts.js), nor on the account page, which
// says both itself. While the sync is stopped the stop is what the page says,
// and these stand down.
//
// NOT ANNOUNCED HERE: a request this browser's own sign-in made (`mine`), and
// a device this computer approved. The reader did both on this computer.
//
// WHAT IS NEW NEEDS A REQUEST of its own, `GET /devices`, which only the
// account's home made before. It is asked at most every NEWS_EVERY_MS
// (fifteen minutes, as often as a pass asks the account), by whichever page
// is open when it falls due, and once more on a page that finds something
// found earlier and never said. The names are read with the notebook's key
// and kept in memory only: what is stored is ids and times (./sync-db.js,
// "asked" and "news").
//
// The account's model and its words are imported when a read is due, never
// with the page: src/lib/desk-account.mjs is every key flow the account has.

import { SLOT_EVENT } from "../../../lib/desk-sync-link.mjs";
import {
  ACCOUNT_PAGE,
  REVIEW_WORDS,
  needsReader,
  newsCheckDue,
  newsOutside,
  noticeDay,
  shouldTellWaiting,
  waitingKey,
  waitingOutside,
  waitingSentence,
} from "../../../lib/desk-sync-status.mjs";
import { WAIT_MS, WAIT_TIMES, barFree, loadBar, markDots } from "./notice-parts.js";

/** After a read that failed, the next one waits this long: a service that is down isn't asked on every pass. */
const RETRY_MS = 60_000;

/** A read that fails for one of these is no surprise, and isn't logged: the next one may well work. */
const EXPECTED = new Set(["AccountRefusal", "AccountStop", "Offline"]);

async function loadAccount() {
  const [model, words] = await Promise.all([import("../../../lib/desk-account.mjs"), import("../../../lib/desk-account-words.mjs")]);
  return { readLists: model.readLists, news: model.news, seenIn: model.seenIn, newsWords: words.newsWords, ok: words.WORDS.ok };
}

/**
 * @param {{ status: () => object, subscribe: (fn: (s: object) => void) => () => void,
 *   call: (method: string, path: string, body?: object) => Promise<object>,
 *   keyring: () => Promise<object | null>, device: () => { id: string } | null }} connector
 * @param {{ db: { getAll: (keys: string[]) => Promise<object>, set: (values: object) => Promise<void> },
 *   doc?: Document, win?: Window, nowMs?: () => number, bar?: () => Promise<object>, go?: (href: string) => void,
 *   account?: () => Promise<object>, locale?: string,
 *   setTimer?: (fn: () => void, ms: number) => unknown, clearTimer?: (t: unknown) => void,
 *   log?: (...args: unknown[]) => void }} env
 *   `db` is the sync's storage; `bar` and `account` replace the notice bar's and the account model's loading in tests
 * @returns {() => void} the way to take it off
 */
export function mountAccountNotice(connector, env) {
  const {
    db,
    doc = globalThis.document,
    win = globalThis.window,
    nowMs = () => Date.now(),
    bar: getBar = () => loadBar(doc),
    account: getAccount = loadAccount,
    locale,
    go = (href) => win?.location?.assign(href),
    setTimer = (fn, ms) => setTimeout(fn, ms),
    clearTimer = (t) => clearTimeout(t),
    log = (...args) => console.error("Study Desk sync:", ...args),
  } = env;
  if (!doc?.documentElement) return () => {};

  let off = false;
  let ui = null; // undo-bar.js, once it was needed
  let parts = null; // the account's model and words, once a read was due
  let up = null; // our notice while it may be the one showing: { number, about, key }
  let handled = null; // the waiting request this page has dealt with: said, or found said already
  let unseen = []; // the ids of what is new and not yet marked seen: what the dot stands for
  let fresh = null; // what this page read: { items, lists, own }
  let triedAt = null; // when a read last failed
  let working = false;
  let missed = false;
  let timer = null;
  let waits = 0;

  // The account page says both itself: its home reads the lists and has its own "OK."
  const onAccountPage = () => Boolean(doc.querySelector("[data-account-page]"));
  const free = () => barFree({ doc, win, ui });
  const day = (iso) => noticeDay(iso, { locale, nowMs: nowMs() });

  function paint(status) {
    const stopped = needsReader(status?.state);
    markDots(doc, "waiting", !stopped && Boolean(waitingOutside(status)));
    markDots(doc, "news", !stopped && unseen.length > 0 && !onAccountPage());
  }

  function takeDown(about) {
    if (!up || (about && up.about !== about)) return;
    // hideUndo does nothing when another notice has taken ours's place.
    ui?.hideUndo(up.number);
    up = null;
  }

  function later() {
    if (off || timer || waits >= WAIT_TIMES) return;
    waits++;
    timer = setTimer(() => {
      timer = null;
      settle(connector.status());
    }, WAIT_MS);
  }

  /** The bar, loaded, when it may come up now; otherwise null, with another try on its way. */
  async function barNow() {
    ui ??= await getBar();
    if (off) return null;
    if (!free()) {
      later();
      return null;
    }
    waits = 0;
    return ui;
  }

  /* ── A request that waits ───────────────────────────────────────────── */

  async function tellWaiting(status) {
    const asked = waitingOutside(status);
    if (!asked) {
      takeDown("waiting");
      handled = null;
      // The account answered, and nothing waits: a request made after this is a new thing to say.
      if (status.account && !status.account.waiting) {
        const { asked: kept } = await db.getAll(["asked"]);
        if (kept) await db.set({ asked: undefined });
      }
      return;
    }
    const key = waitingKey(asked);
    if (up?.about === "waiting" && up.key !== key) takeDown("waiting");
    if (handled === key) return;
    // Nothing is recorded on the account page, so the next page still says it.
    if (onAccountPage()) {
      handled = key;
      return;
    }
    const { asked: kept } = await db.getAll(["asked"]);
    if (!shouldTellWaiting(kept, key, nowMs())) {
      handled = key;
      return;
    }
    if (!(await barNow())) return;
    handled = key;
    const number = ui.showChoices(waitingSentence(asked, { day }), [{ label: REVIEW_WORDS, primary: true, onPress: () => go(ACCOUNT_PAGE) }], { onClose: () => {} });
    up = { number, about: "waiting", key };
    await db.set({ asked: { key, at: nowMs() } });
  }

  /* ── What is new ────────────────────────────────────────────────────── */

  /** Reads who can open the notebook. Null when it can't be read now. */
  async function read(seen) {
    const held = await connector.keyring();
    const device = connector.device();
    if (!held || !device) return null;
    try {
      parts ??= await getAccount();
      const lists = await parts.readLists({ call: connector.call, held });
      // Before this browser has a list of what its reader knows, everything there is known (the home's own rule).
      if (!Array.isArray(seen)) {
        await db.set({ seen: parts.seenIn(lists) });
        return { items: [], lists, own: device.id };
      }
      return { items: newsOutside(parts.news({ lists, seen, own: device.id }), device.id), lists, own: device.id };
    } catch (err) {
      if (!EXPECTED.has(err?.name)) log("who can open the notebook couldn’t be read, to say what is new", err);
      return null;
    }
  }

  async function tellNews() {
    if (onAccountPage()) return;
    const { news: kept, seen } = await db.getAll(["news", "seen"]);
    const known = new Set(Array.isArray(seen) ? seen : []);
    let ids = (Array.isArray(kept?.unseen) ? kept.unseen : []).filter((id) => !known.has(id));
    let told = Array.isArray(kept?.told) ? kept.told : [];
    let at = kept?.at;
    const now = nowMs();
    // Something found earlier and never said (the page it was found on had a tour up, or was a sheet's) is read again here.
    const owed = !fresh && ids.some((id) => !told.includes(id));
    if ((newsCheckDue(kept, now) || owed) && (triedAt === null || now - triedAt >= RETRY_MS || now < triedAt)) {
      const found = await read(seen);
      if (off) return;
      if (!found) {
        triedAt = now;
      } else {
        triedAt = null;
        fresh = found;
        ids = found.items.map((item) => item.id);
        told = told.filter((id) => ids.includes(id));
        at = now;
        await db.set({ news: { at, unseen: ids, told } });
      }
    }
    unseen = ids;
    paint(connector.status());

    const items = (fresh?.items ?? []).filter((item) => ids.includes(item.id) && !told.includes(item.id));
    if (!items.length) return;
    if (!(await barNow())) return;
    const { lists, own } = fresh;
    const number = ui.showChoices(
      items.map((item) => parts.newsWords(item, locale, { own, day })).join(" "),
      [
        { label: REVIEW_WORDS, primary: true, onPress: () => go(ACCOUNT_PAGE) },
        {
          label: parts.ok,
          // The account home's own "OK": everything in the lists is now known to this browser's reader.
          onPress: async () => {
            await db.set({ seen: parts.seenIn(lists) });
            fresh = { ...fresh, items: [] };
            unseen = [];
            paint(connector.status());
          },
        },
      ],
      { onClose: () => {} },
    );
    up = { number, about: "news" };
    await db.set({ news: { at, unseen: ids, told: [...told, ...items.map((item) => item.id)] } });
  }

  /* ── One status at a time ───────────────────────────────────────────── */

  async function once(status) {
    // A stop is what the page says now (./stopped-notice.js), and no pass is asking the account.
    if (needsReader(status.state)) {
      takeDown();
      return;
    }
    await tellWaiting(status);
    if (off) return;
    await tellNews();
  }

  /** One status at a time; one that arrives meanwhile is dealt with after, from the latest. */
  async function settle(status) {
    if (off) return;
    const state = status?.state;
    if (!state || state === "starting" || state === "syncing") return;
    if (working) {
      missed = true;
      return;
    }
    working = true;
    try {
      await once(status);
    } catch (err) {
      // Taken off meanwhile, as the sync stopped: its storage is closed and refuses, which is no fault.
      if (!off) log("a notice about the account couldn’t be shown", err);
    } finally {
      working = false;
    }
    if (missed) {
      missed = false;
      settle(connector.status());
    }
  }

  const hear = (status) => {
    paint(status);
    settle(status);
  };
  // A tab or a button built late takes its description when the page says a slot is there.
  const repaint = () => paint(connector.status());
  doc.addEventListener(SLOT_EVENT, repaint);
  const stop = connector.subscribe(hear);
  hear(connector.status());

  return () => {
    off = true;
    stop();
    doc.removeEventListener(SLOT_EVENT, repaint);
    if (timer) clearTimer(timer);
    timer = null;
    takeDown();
    markDots(doc, "waiting", false);
    markDots(doc, "news", false);
  };
}
