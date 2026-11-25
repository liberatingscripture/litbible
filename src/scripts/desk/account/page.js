// src/scripts/desk/account/page.js
//
// The account page (the plan's step 4h): /account/, /account/connect/, and
// the box on /delete-account/. src/scripts/account-gate.js imports this
// file, dynamically, only where accounts are open in this browser or the
// Study Desk is on; nobody else downloads it.
//
// WHAT THIS FILE IS, AND WHAT IT LEAVES TO ./notebook.js. Everything here
// works on any device and holds no key: signing in, making an account,
// reading the account, the request that waits seven days, deleting, signing
// out. It imports no encryption (test/desk-sync-gate.test.js holds that), so
// a phone's browser, which never holds a notebook, loads only this. On a
// computer with the Study Desk on it also loads ./notebook.js, which does
// everything that touches the notebook's key: setting up, joining, the
// devices, the recovery code, where the key lives, and syncing.
//
// WHERE A SIGN-IN IS KEPT. A browser that is linked to a notebook keeps its
// session where the sync does (../sync/sync-db.js, "token"). One that is
// signed in and not linked (mid-setup, or a phone that asked to delete its
// account and may come back to cancel) keeps `{ v, service, token, expires,
// way, rpId }` in the same database under "account". Nothing of a passkey's
// PRF output is ever kept: it stays in memory for the one step that uses it.

import { ACCOUNT_PATH, HELP_COPIES, HELP_KEPT, WORDS, signedInWords, waitingWords } from "../../../lib/desk-account-words.mjs";
import {
  AccountRefusal,
  cancelWaiting,
  deleteAccount,
  deletesAtOnce,
  endSession,
  readAccount,
  signInWays,
  signInWithPasskey,
  signUpWithPasskey,
} from "../../../lib/desk-account-session.mjs";
import { passkeysHere } from "../../../lib/desk-passkey.mjs";
import { SERVICES, allowedService, peekLink } from "../../../lib/desk-sync-link.mjs";
import { createApi } from "../sync/service.js";
import { openSyncDb } from "../sync/sync-db.js";
import { button, confirmBox, h, screens } from "./ui.js";

/** The code a scanned or followed link carries after its `#` (`#a=<16 characters>`), or null. Nothing after a `#` is ever sent. */
export function codeInHash(hash) {
  const m = /^#a=([0-9A-Za-z-]{16,24})$/.exec(String(hash ?? ""));
  return m ? m[1] : null;
}

/**
 * Starts the page in `root`. Resolves to null where accounts aren't open
 * (the page's own note stays), else to the page's context, which tests read.
 *
 * @param {{ root?: Element, open?: "preview" | "local" | null, env?: object }} [options]
 *   `open` is the switch's value (account-gate.js reads it). `env` replaces
 *   the browser's parts in tests: fetch, credentials, idb, pageOrigin,
 *   userAgent, setTimer, clearTimer, random, turnstile, and `sync` (handed
 *   to ../sync/start.js).
 */
export async function start({ root = document.querySelector("[data-account-page]"), open = null, env = {} } = {}) {
  if (!root) return null;
  const win = env.win ?? window;
  const doc = win.document;
  const kind = root.getAttribute("data-account-page") || "account";
  const desk = doc.documentElement.dataset.desk === "on";
  const pageOrigin = env.pageOrigin ?? win.location.origin;
  const idb = env.idb ?? globalThis.indexedDB;
  if (!idb) return null;

  // A browser that is linked uses its link's service, whatever the switch says.
  const link = desk ? await peekLink({ idb }) : null;
  const service = allowedService(link ? link.service : open ? SERVICES[open] : null, pageOrigin);
  if (!service) return null;

  // A link that carries a code: read it and take it out of the address before anything else runs.
  let pendingCode = null;
  if (kind === "connect") {
    pendingCode = codeInHash(win.location.hash);
    try {
      win.history.replaceState(null, "", win.location.pathname + win.location.search);
    } catch {
      /* the address stays; the code is still never sent */
    }
  }

  doc.documentElement.setAttribute("data-account", "open");
  const ui = screens(root, env.log ? { log: env.log } : {});
  ui.show(h("p", { class: "account__loading", text: WORDS.loading }));

  const db = await openSyncDb({ idb });
  const door = createApi({ service, signIn: true, fetch: env.fetch, pageOrigin }).call;

  /** What the page knows. `passkey` holds a PRF output for one step and is never stored. */
  const S = { kind, desk, service, link, session: null, passkey: null, account: null, ways: null, connector: null, store: null, nb: null, pendingCode };
  const sessionCall = createApi({ service, token: () => S.session?.token ?? null, fetch: env.fetch, pageOrigin }).call;
  /** The service, with this browser's sign-in: the page's own while it has one, else the sync's. */
  const call = (method, path, body) => (S.session || !S.connector ? sessionCall(method, path, body) : S.connector.call(method, path, body));
  const credentials = () => env.credentials ?? win.navigator.credentials;
  const canPasskey = () => env.credentials != null || passkeysHere(win);
  const locale = env.locale;
  /** A screen's heading. On /delete-account/ the box sits under the page's own h2, so its headings are a level down. */
  const title = (text) => h(kind === "delete" ? "h3" : "h2", { class: "account__title", text });

  const ctx = { S, ui, db, door, call, env, win, doc, credentials, locale, title, refresh, route, signIn, showSignedOut, basicsParts, forget };

  /* ── The account, read ─────────────────────────────────────────────── */

  /** Reads the account. A sign-in the service no longer knows is forgotten here, and `S.account` is null. */
  async function refresh() {
    S.account = null;
    if (!S.session && !S.connector) return null;
    try {
      S.account = await readAccount(call);
    } catch (error) {
      if (!(error instanceof AccountRefusal) || !error.is("sign_in")) throw error;
      if (S.session) await forget();
    }
    return S.account;
  }

  /** Drops the page's own sign-in, in memory and in storage. */
  async function forget() {
    S.session = null;
    S.passkey = null;
    await db.set({ account: undefined });
  }

  /* ── Which screen ──────────────────────────────────────────────────── */

  async function route(note) {
    try {
      if (S.connector && !S.session) {
        if (kind === "delete") return await showBasics(note);
        return await S.nb.showHome(ctx, note);
      }
      if (!S.session || !S.account) return showSignedOut(note);
      if (S.nb && kind !== "delete") return await (S.account.notebook ? S.nb.showJoin(ctx) : S.nb.showSetup(ctx));
      return showBasics(note);
    } catch (error) {
      // A screen that couldn't be drawn (no answer from the service, most often) is said, with a way to try again.
      showProblem(error);
      return undefined;
    }
  }

  function showProblem(error) {
    ui.show([title(kind === "delete" ? WORDS.deleteTitle : WORDS.basicsTitle), h("div", { class: "account__actions" }, button(ui, WORDS.tryAgain, async () => {
      await refresh();
      await route();
    }, { kind: "primary" }))]);
    ui.fail(error);
  }

  /* ── Signed out ────────────────────────────────────────────────────── */

  const prf = async () => (S.nb ? S.nb.prfBytes() : undefined);

  async function took(got) {
    S.passkey = got.passkey ?? null;
    S.session = { v: 1, service, token: got.token, expires: got.expires ?? null, way: got.way ?? null, rpId: got.passkey?.rpId ?? null };
    if (S.connector && S.nb.takesSession(ctx)) {
      // The same browser, signed in again: the sync takes the session and carries on.
      await S.connector.setSession(got.token);
      S.session = null;
    } else {
      await db.set({ account: S.session });
    }
    await refresh();
    await route();
  }

  async function signIn() {
    const got = await signInWithPasskey({ call: door, credentials: credentials(), prfInput: await prf() });
    await took(got);
  }

  async function signUp(slot) {
    S.ways ??= await signInWays(door);
    let token;
    if (S.ways.turnstile) {
      const { humanCheck } = await import("./turnstile.js");
      token = await humanCheck({ siteKey: S.ways.turnstile, slot, win, run: env.turnstile });
    }
    const got = await signUpWithPasskey({ call: door, credentials: credentials(), prfInput: await prf(), turnstile: token });
    await took(got);
  }

  function showSignedOut(note) {
    const can = canPasskey();
    const check = h("div", { class: "account__check", hidden: true });
    const nodes = [
      title(WORDS.signInTitle),
      note ? h("p", { class: "account__note", text: note }) : null,
      h("p", { text: kind === "delete" ? WORDS.deleteSignIn : WORDS.signInLede }),
    ];
    if (!can) {
      nodes.push(h("p", { class: "account__note", text: WORDS.noPasskeys }));
    } else {
      nodes.push(
        h(
          "div",
          { class: "account__actions" },
          button(ui, WORDS.signInPasskey, signIn, { kind: "primary" }),
          kind === "delete" ? null : button(ui, WORDS.create, () => signUp(check)),
        ),
      );
      if (kind !== "delete") nodes.push(check, h("p", { class: "account__hint", text: WORDS.createNote }));
    }
    // "No account" is plainly a choice (BVJ, 2026-11-24), said where the notebook is: a computer with the desk on.
    if (kind !== "delete" && desk) {
      nodes.push(
        h(
          "div",
          { class: "account__aside" },
          h("h3", { class: "account__aside-title", text: WORDS.noAccountTitle }),
          h("p", { text: WORDS.noAccountBody }),
          h("p", { class: "account__links" }, h("a", { href: HELP_KEPT, text: WORDS.noAccountKept }), " · ", h("a", { href: HELP_COPIES, text: WORDS.noAccountCopies })),
        ),
      );
    }
    ui.show(nodes);
  }

  /* ── The account's basics: what needs no key ───────────────────────── */

  /** The request that is waiting, with its Cancel where this sign-in may cancel it. */
  function waitingPart(after) {
    const words = waitingWords(S.account?.waiting, locale);
    if (!words) return null;
    const mayCancel = S.account.waiting.mine || S.account.session?.open === true;
    return h(
      "div",
      { class: "account__waiting" },
      h("p", { text: words }),
      mayCancel
        ? button(ui, WORDS.cancelRequest, async () => {
            await cancelWaiting(call);
            await refresh();
            await after(WORDS.canceled);
          })
        : null,
    );
  }

  /** "Delete account…", and what it asks before it does anything. */
  function deletePart(after) {
    if (S.account?.waiting?.what === "delete") return null;
    const holder = h("div", { class: "account__delete" });
    const opener = h("button", { type: "button", class: "account__button account__button--danger", text: WORDS.deleteOpen });
    opener.addEventListener("click", () => {
      if (holder.querySelector(".account__confirm")) return;
      const atOnce = deletesAtOnce(S.account);
      holder.append(
        confirmBox(ui, {
          ask: atOnce ? WORDS.deleteAtOnce : WORDS.deleteWaits,
          yes: atOnce ? WORDS.deleteNow : WORDS.deleteAsk,
          kind: "danger",
          onYes: async () => {
            const answer = await deleteAccount(call);
            if (answer.deleted) {
              if (S.connector) await S.nb.leave(ctx);
              await forget();
              S.account = null;
              return showSignedOut(WORDS.deletedNow);
            }
            await refresh();
            await after();
          },
          onCancel: () => opener.focus(),
        }),
      );
      holder.querySelector(".account__confirm button")?.focus();
    });
    holder.append(opener);
    if (kind !== "delete") holder.append(" ", h("a", { class: "account__more", href: "/delete-account/", text: WORDS.deleteMore }));
    return holder;
  }

  /** Signing out a sign-in that holds no notebook: the session ends, and nothing else changes. */
  function signOutPart() {
    return button(ui, WORDS.signOut, async () => {
      try {
        await endSession(call);
      } catch (error) {
        if (!(error instanceof AccountRefusal) || !error.is("sign_in")) throw error;
      }
      await forget();
      S.account = null;
      showSignedOut();
    });
  }

  function basicsParts(after) {
    return { waiting: waitingPart(after), remove: deletePart(after) };
  }

  function showBasics(note) {
    if (!S.account) return showSignedOut(note);
    const a = S.account;
    const again = (said) => showBasics(said);
    const { waiting, remove } = basicsParts(again);
    const way = S.session?.way?.kind;
    const nodes = [title(kind === "delete" ? WORDS.deleteTitle : WORDS.basicsTitle), note ? h("p", { class: "account__note", text: note }) : null];
    if (way) nodes.push(h("p", { text: signedInWords(way) }));
    if (kind !== "delete") {
      nodes.push(h("p", { text: a.notebook ? (desk ? WORDS.deskOffHasNotebook : WORDS.phoneHasNotebook) : WORDS.phoneNoNotebook }));
    }
    nodes.push(waiting, remove);
    if (S.connector && !S.session) {
      nodes.push(h("p", { class: "account__links" }, h("a", { href: ACCOUNT_PATH, text: WORDS.homeTitle })));
    } else {
      nodes.push(h("div", { class: "account__actions" }, signOutPart()), h("p", { class: "account__hint", text: WORDS.signOutBasics }));
    }
    ui.show(nodes);
  }

  /* ── Start ─────────────────────────────────────────────────────────── */

  try {
    if (desk) {
      S.nb = await import("./notebook.js");
      if (link) await S.nb.connect(ctx);
    }
    if (!S.connector) {
      const kept = await db.get("account");
      if (kept?.v === 1 && kept.service === service && typeof kept.token === "string") S.session = kept;
    }
    await refresh();
    await route();
  } catch (error) {
    showProblem(error);
  }
  return ctx;
}


