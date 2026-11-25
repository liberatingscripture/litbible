// src/scripts/desk/account/notebook.js
//
// The half of the account page that touches the notebook's key (the plan's
// step 4h): setting the notebook up, joining it, the account's home on a
// computer that syncs (the sync's status, where the key lives, the devices,
// the recovery code, the ways to sign in), and the step behind "Reconnect"
// for each stop only the reader can settle. ./page.js imports this file,
// dynamically, only on a computer with the Study Desk on: it brings the
// encryption and the sync with it, and a phone's browser never loads it.
//
// The rules are src/lib/desk-account.mjs's and are kept there: this file
// stores, links, and draws. Four things it must keep true itself:
//
//   - A SETUP CUT SHORT IS NEVER LOST. Before `POST /notebook` goes, the
//     device's keys, the keyring sealed to them, and the recovery code sealed
//     to them are written beside the page's sign-in ("account" in
//     ../sync/sync-db.js). If the answer never arrives, the next visit finds
//     them, proves the key, and carries on (`resumeSetup`). Without that, a
//     notebook could exist whose key and code no one holds.
//   - A RECOVERY CODE IS KEPT, SEALED TO THIS DEVICE'S OWN KEY, UNTIL THE
//     READER HAS TYPED TWO OF ITS GROUPS BACK ("code" in the same database).
//     A page closed on the code's screen shows it again. One kept before a
//     request whose answer never came is shown only after it has opened the
//     notebook's recovery holder as the service holds it (`resumeCode`).
//   - THE READER'S YES FOR `replace: true`. A browser that was syncing with
//     another notebook joins this one only from the button that says so
//     ("Join the new notebook"), never by itself.
//   - A PRF OUTPUT IS USED AND DROPPED. It opens or seals one holder and is
//     never stored, logged, or sent.

import {
  AccountRefusal,
  AccountStop,
  acceptApproval,
  addHolder,
  askToJoin,
  findRequest,
  grant,
  groupsToAsk,
  hasRecoveryCode,
  join,
  newDevice,
  newRecoveryCode,
  news,
  openWithPasskey,
  openWithRecoveryCode,
  prove,
  readHolders,
  readLists,
  removeDevices,
  renameDevice,
  seenIn,
  setUp,
  signOutDevice,
  switchToDeviceOnly,
  waysToOpen,
  whereKeyLives,
} from "../../../lib/desk-account.mjs";
import { addPasskeyWay, askToReplace, endSession, must, readAccount, removeWay } from "../../../lib/desk-account-session.mjs";
import {
  CONNECT_PATH,
  WORDS,
  addAsk,
  cleanName,
  codeGroupLabel,
  dayWords,
  deviceLine,
  deviceName,
  failureWords,
  newsWords,
  removeAsk,
  wayWords,
} from "../../../lib/desk-account-words.mjs";
import {
  formatApprovalCode,
  formatRecoveryCode,
  fromBase64url,
  hpkeOpen,
  hpkeSeal,
  openKeyring,
  prfInput,
  randomBytes,
  readApprovalCode,
  readRecoveryCode,
  recoveryGroupMatches,
  sealKeyring,
} from "../../../lib/desk-crypto.mjs";
import { prfOnly } from "../../../lib/desk-passkey.mjs";
import { SLOT_EVENT } from "../../../lib/desk-sync-link.mjs";
import { needsReader, statusWords } from "../../../lib/desk-sync-status.mjs";
import { qrSvg } from "../../../lib/qr-svg.mjs";
import { deskCtx } from "../desk-ctx.js";
import { linkNotebook, startSync, unlink } from "../sync/start.js";
import { button, confirmBox, field, h, section } from "./ui.js";

/** The fixed PRF input, as a passkey prompt takes it. */
export const prfBytes = async () => (await prfInput()).bytes;

/** What a kept recovery code is sealed under: this device's own key, with this label. */
const CODE_INFO = "lit-notebook/1 account page: recovery code";
/** How often a device that asked to join looks for its grant, and one that showed a code looks for the request. */
export const POLL_MS = 3000;

const userAgent = (ctx) => ctx.env.userAgent ?? ctx.win.navigator.userAgent;
const random = (ctx) => ctx.env.random ?? randomBytes;

async function openDeskStore(ctx) {
  if (ctx.S.store) return ctx.S.store;
  const { openStore } = await import("../store.js");
  ctx.S.store = await openStore({ ctx: deskCtx });
  return ctx.S.store;
}

/** A linked browser: opens the notebook and starts (or joins) this tab's connector. */
export async function connect(ctx) {
  const store = await openDeskStore(ctx);
  ctx.S.connector = await startSync({ store });
}

/** Whether a new sign-in belongs to the sync as it stands: the same browser, signed out and signed in again. */
export const takesSession = (ctx) => ctx.S.connector?.status().state === "signedOut" && !ctx.S.joining;

/** Stops syncing in this browser. The notebook stays. */
export async function leave(ctx) {
  const { S } = ctx;
  await unlink({ store: await openDeskStore(ctx) });
  S.connector = null;
  S.link = null;
  S.joining = false;
  S.replace = false;
}

/* ── Keeping what a step must not lose ──────────────────────────────────── */

async function sealCode(device, code, groups, notebook) {
  const sealed = await hpkeSeal({ recipientPublic: device.key.public, info: CODE_INFO, plaintext: code });
  return { v: 1, notebook, enc: sealed.enc, ct: sealed.ct, groups };
}

async function openCode(device, kept) {
  try {
    return await hpkeOpen({ recipient: device.key, enc: kept.enc, info: CODE_INFO, ct: kept.ct });
  } catch {
    return null;
  }
}

/** Links this browser to the notebook and starts syncing. The page's own sign-in becomes the sync's. */
async function linkUp(ctx, { device, held, carry }) {
  const { S, db } = ctx;
  const token = S.session?.token ?? (await db.get("token"));
  const store = await openDeskStore(ctx);
  S.connector = await linkNotebook({ store, service: S.service, token, notebook: held.notebook, device, keyring: held, replace: S.replace === true, carry });
  S.link = S.connector.link;
  S.session = null;
  S.passkey = null;
  S.joining = false;
  S.replace = false;
}

/* ── A passkey, asked for its PRF output alone ──────────────────────────── */

/** `{ id, output }` from one of `allow` (credential ids, bytes), or null when the passkey gave no output. */
async function passkeyOutput(ctx, allow) {
  const { S, door } = ctx;
  const rpId = S.session?.rpId ?? (await must(door, "POST", "/sign-in/passkey/options")).publicKey.rpId;
  const got = await prfOnly({ credentials: ctx.credentials(), rpId, allow, prfInput: await prfBytes(), random: random(ctx) });
  return got.output ? got : null;
}

const syncedPasskeys = (account) => (account?.ways ?? []).filter((way) => way.kind === "passkey" && way.syncs && way.credential);

/* ── The recovery code's screen ─────────────────────────────────────────── */

/**
 * Shows a recovery code, then asks two of its groups back. There is no way
 * past the check (BVJ, 2026-11-24). `after` runs once it passes, and the
 * kept copy is dropped then.
 */
function showCode(ctx, { code, groups, after }) {
  const { ui, db, win, doc } = ctx;
  const text = formatRecoveryCode(code);

  const shown = () => {
    const copy = button(ui, WORDS.codeCopy, async () => {
      await win.navigator.clipboard.writeText(text);
      ui.say(WORDS.codeCopied);
    });
    const print = button(ui, WORDS.codePrint, () => {
      const root = doc.documentElement;
      root.setAttribute("data-account-print", "code");
      const done = () => root.removeAttribute("data-account-print");
      win.addEventListener("afterprint", done, { once: true });
      win.print();
    });
    ui.show([
      ctx.title(WORDS.codeTitle),
      h("p", { text: WORDS.codeLede }),
      h("p", { class: "account__code", "data-account-code": true, translate: "no", text }),
      h("div", { class: "account__actions" }, copy, print),
      h("div", { class: "account__actions" }, button(ui, WORDS.codeSaved, check, { kind: "primary" })),
    ]);
  };

  const check = () => {
    const [first, second] = groups;
    const a = field(codeGroupLabel(first), { id: "account-code-a", maxlength: "8", inputmode: "text" });
    const b = field(codeGroupLabel(second), { id: "account-code-b", maxlength: "8", inputmode: "text" });
    const finish = button(
      ui,
      WORDS.codeFinish,
      async () => {
        if (!recoveryGroupMatches(code, first, a.input.value) || !recoveryGroupMatches(code, second, b.input.value)) return ui.warn(WORDS.codeWrong);
        await db.set({ code: undefined });
        await after();
      },
      { kind: "primary" },
    );
    ui.show(
      [
        ctx.title(WORDS.codeCheckTitle),
        h("p", { text: WORDS.codeCheckLede }),
        h("div", { class: "account__fields" }, a.row, b.row),
        h("div", { class: "account__actions" }, finish, button(ui, WORDS.codeShowAgain, shown)),
      ],
      { focus: a.input },
    );
  };

  shown();
}

/**
 * A code this browser kept and never saw confirmed. Shows it again when it
 * is real: it opens the notebook's recovery holder as the service holds it.
 * Returns true when the code's screen took the page.
 */
async function resumeCode(ctx, kept, after) {
  const { S, db } = ctx;
  const device = S.connector?.device();
  const drop = () => db.set({ code: undefined });
  if (!device || kept?.v !== 1 || kept.notebook !== S.connector.link.notebook) {
    await drop();
    return false;
  }
  const code = await openCode(device, kept);
  if (!code) {
    await drop();
    ctx.ui.say(WORDS.codeUnreadable);
    return false;
  }
  try {
    await openWithRecoveryCode({ call: S.connector.call, notebook: kept.notebook, code });
  } catch (error) {
    // The request that would have made it real never landed: it opens nothing, and showing it would mislead.
    if (error instanceof AccountStop) {
      await drop();
      return false;
    }
    // No answer, or signed out: it stays kept for the next visit, and the home shows without it.
    return false;
  }
  showCode(ctx, { code, groups: kept.groups, after });
  return true;
}

/* ── Setting up ─────────────────────────────────────────────────────────── */

async function dropSetup(ctx) {
  const { S, db } = ctx;
  if (!S.session?.setup) return;
  const { setup: _gone, ...rest } = S.session;
  S.session = rest;
  await db.set({ account: rest });
}

/**
 * A setup whose request went and whose answer this browser never saw. If the
 * account's notebook is the one it made, the device proves the key and the
 * setup carries on from the recovery code. Returns true when it did.
 */
async function resumeSetup(ctx) {
  const { S, call } = ctx;
  const setup = S.session?.setup;
  if (!setup) return false;
  if (!S.account?.notebook || S.account.notebook !== setup.notebook) {
    await dropSetup(ctx);
    return false;
  }
  const device = setup.device;
  const held = await openKeyring({ recipient: device.key, enc: setup.sealed.enc, ct: setup.sealed.ct });
  await prove({ call, device, held });
  const code = setup.code ? await openCode(device, setup.code) : null;
  await linkUp(ctx, { device, held, carry: setup.code ? { code: setup.code } : undefined });
  if (code) showCode(ctx, { code, groups: setup.code.groups, after: () => showHome(ctx, WORDS.codeDone) });
  else await showHome(ctx);
  return true;
}

/** The first-time choice: where the notebook's key lives. The final wording is step 4j's. */
export async function showSetup(ctx) {
  const { S, ui } = ctx;
  await dropSetup(ctx); // the account has no notebook, so a setup kept from before never landed
  const canFollow = syncedPasskeys(S.account).length > 0 && S.passkey?.prfEnabled !== false;

  const choice = (value, title, body, { checked = false, off = false } = {}) => {
    const id = `account-key-${value}`;
    const input = h("input", { type: "radio", name: "account-key", id, value, checked: checked || null, disabled: off || null });
    return h(
      "div",
      { class: "account__choice" },
      input,
      h("label", { for: id }, h("span", { class: "account__choice-title", text: title }), h("span", { class: "account__choice-body", text: body })),
      off ? h("p", { class: "account__hint", text: WORDS.followOff }) : null,
    );
  };
  const form = h(
    "fieldset",
    { class: "account__choices" },
    h("legend", { class: "sr-only", text: WORDS.setupLegend }),
    choice("account", WORDS.followTitle, WORDS.followBody, { checked: canFollow, off: !canFollow }),
    choice("device", WORDS.deviceTitle, WORDS.deviceBody, { checked: !canFollow }),
  );
  const go = button(ui, WORDS.setupContinue, () => runSetup(ctx, form.querySelector("input:checked")?.value === "account" ? "account" : "device"), { kind: "primary" });
  ui.show([
    ctx.title(WORDS.setupTitle),
    h("p", { text: WORDS.setupLede }),
    form,
    h("p", { class: "account__hint", text: WORDS.setupNext }),
    h("div", { class: "account__actions" }, go, signOutLink(ctx)),
  ]);
}

async function runSetup(ctx, choice) {
  const { S, ui, call, db } = ctx;
  let passkey = null;
  if (choice === "account") {
    let got = S.passkey?.prf ? { id: S.passkey.id, output: S.passkey.prf } : null;
    got ??= await passkeyOutput(ctx, S.passkey?.id ? [S.passkey.id] : syncedPasskeys(S.account).map((way) => fromBase64url(way.credential)));
    if (!got) return ui.warn(WORDS.followFailed);
    passkey = { credential: got.id, prf: got.output };
  }
  const device = await newDevice({ name: deviceName(userAgent(ctx)) });
  const groups = groupsToAsk(random(ctx));
  let kept = null;
  let made;
  try {
    made = await setUp({
      call,
      device,
      passkey,
      recovery: true,
      random: random(ctx),
      keep: async ({ code, notebook, held }) => {
        const sealed = await sealKeyring({ keyring: held, recipientPublic: device.key.public });
        kept = await sealCode(device, code, groups, notebook);
        S.session = { ...S.session, setup: { notebook, device, sealed: { enc: sealed.enc, ct: sealed.ct }, code: kept } };
        await db.set({ account: S.session });
      },
    });
  } catch (error) {
    // A refusal means nothing was made. No answer means it may have been: what was kept stays for the next try.
    if (!(error instanceof AccountRefusal)) throw error;
    await dropSetup(ctx);
    if (!error.is("already_set_up")) throw error;
    await ctx.refresh();
    await showJoin(ctx);
    ui.say(failureWords(error));
    return;
  }
  await linkUp(ctx, { device, held: made.held, carry: { code: kept } });
  showCode(ctx, { code: made.code, groups, after: () => showHome(ctx, WORDS.codeDone) });
}

/** Ends a sign-in that has joined nothing, from the setup and join screens. */
function signOutLink(ctx) {
  const { S, ui } = ctx;
  return button(ui, WORDS.signOut, async () => {
    if (S.session) {
      try {
        await endSession(ctx.call);
      } catch (error) {
        if (!(error instanceof AccountRefusal) || !error.is("sign_in")) throw error;
      }
      await ctx.forget();
    }
    S.joining = false;
    S.replace = false;
    S.account = null;
    if (S.connector) return showHome(ctx);
    ctx.showSignedOut();
  });
}

/* ── Joining ────────────────────────────────────────────────────────────── */

/** Runs `step` every POLL_MS until it answers true, the screen changes, or `stop()` is called. A step that can't reach the service is tried again. */
function poll(ctx, step, onStop) {
  const setTimer = ctx.env.setTimer ?? ((fn, ms) => setTimeout(fn, ms));
  const clearTimer = ctx.env.clearTimer ?? ((t) => clearTimeout(t));
  const alive = ctx.ui.live();
  let timer = null;
  let over = false;
  const tick = async () => {
    timer = null;
    if (over || !alive()) return;
    try {
      if (await step()) {
        over = true;
        return;
      }
    } catch (error) {
      if (error instanceof AccountStop || error instanceof AccountRefusal) {
        over = true;
        if (alive()) onStop(error);
        return;
      }
    }
    if (!over && alive()) timer = setTimer(tick, POLL_MS);
  };
  timer = setTimer(tick, POLL_MS);
  return () => {
    over = true;
    if (timer) clearTimer(timer);
  };
}

/** An approval code as the page shows it: its characters, and a QR code of the link that carries it after a `#`. */
function codeFigure(code) {
  const text = formatApprovalCode(code);
  const link = `https://litbible.net${CONNECT_PATH}#a=${text.replaceAll("-", "")}`;
  const qr = h("div", { class: "account__qr" });
  qr.innerHTML = qrSvg(link, { title: "A QR code that carries this code" });
  return h("div", { class: "account__figure" }, h("p", { class: "account__code account__code--short", translate: "no", text }), qr);
}

/**
 * The account has a notebook and this browser isn't in it: by the passkey
 * that holds the key, by approval from a device that has it, or with the
 * recovery code.
 */
export async function showJoin(ctx, note) {
  const { S, call } = ctx;
  if (await resumeSetup(ctx)) return;
  const holders = await readHolders(call);
  const J = { device: await newDevice({ name: deviceName(userAgent(ctx)) }), holders, ways: waysToOpen(holders), notebook: S.account.notebook, stop: null };
  // The passkey that just signed the reader in may open the notebook with no second prompt.
  if (S.passkey?.prf) {
    const { id, prf } = S.passkey;
    S.passkey = { ...S.passkey, prf: null };
    const opened = await openWithPasskey({ call, notebook: J.notebook, credential: id, prf, holders });
    if (opened) return finishJoin(ctx, J, opened);
  }
  drawJoin(ctx, J, note);
  if (S.pendingCode) {
    const typed = S.pendingCode;
    S.pendingCode = null;
    await ctx.ui.run(null, () => startApproval(ctx, J, readApprovalCode(typed)));
  }
}

async function finishJoin(ctx, J, opened) {
  J.stop?.();
  await join({ call: ctx.call, device: J.device, held: opened.held, holder: opened.holder });
  await linkUp(ctx, { device: J.device, held: opened.held });
  await showHome(ctx, WORDS.joined);
}

function drawJoin(ctx, J, note) {
  const { ui } = ctx;
  J.stop?.();
  J.area = h("div", { class: "account__step" });
  const ways = [];
  if (J.ways.passkeys.length) {
    ways.push(
      button(
        ui,
        WORDS.joinPasskey,
        async () => {
          const got = await passkeyOutput(ctx, J.ways.passkeys);
          const opened = got ? await openWithPasskey({ call: ctx.call, notebook: J.notebook, credential: got.id, prf: got.output, holders: J.holders }) : null;
          if (!opened) return ui.warn(WORDS.joinPasskeyNo);
          await finishJoin(ctx, J, opened);
        },
        { kind: "primary" },
      ),
    );
  }
  ways.push(button(ui, WORDS.joinApprove, () => startApproval(ctx, J), { kind: J.ways.passkeys.length ? "quiet" : "primary" }));
  if (J.ways.recovery) ways.push(button(ui, WORDS.joinRecovery, () => drawRecovery(ctx, J)));
  // A request that waits (to start a new notebook, or to delete the account) is said here too,
  // with its Cancel for the sign-in that asked.
  const { waiting } = ctx.basicsParts((said) => showJoin(ctx, said));
  ui.show([
    ctx.title(WORDS.joinTitle),
    note ? h("p", { class: "account__note", text: note }) : null,
    waiting,
    h("p", { text: WORDS.joinLede }),
    h("div", { class: "account__actions account__actions--stack" }, ways),
    J.area,
    cantPart(ctx, J),
    h("div", { class: "account__actions" }, signOutLink(ctx)),
  ]);
}

/**
 * "I can’t do any of these": asking to start a new notebook in the old one's
 * place (the spec's `POST /notebook/replace`). The request waits seven days and
 * a device that still has the key can cancel it, so the button asks nothing
 * more; while any request waits, the line above says so and this is not
 * offered.
 */
function cantPart(ctx, J) {
  const { S, ui, call } = ctx;
  if (S.account?.waiting) return null;
  return h(
    "details",
    { class: "account__more-ways" },
    h("summary", { text: WORDS.joinCant }),
    h("h3", { class: "account__subhead", text: WORDS.replaceTitle }),
    h("p", { text: WORDS.replaceLede }),
    button(ui, WORDS.replaceAsk, async () => {
      J.stop?.();
      await askToReplace(call);
      await ctx.refresh();
      await showJoin(ctx, WORDS.replaceAsked);
    }),
  );
}

/** By approval: this device asks, shows the code (or uses one typed from the other device), and waits for its grant. */
async function startApproval(ctx, J, typed = null) {
  const { ui, call } = ctx;
  J.stop?.();
  const code = typed ?? random(ctx)(10);
  const asked = await askToJoin({ call, device: J.device, code });
  const parts = [h("h3", { class: "account__subhead", text: WORDS.joinApprove })];
  if (!typed) {
    const entry = field(WORDS.joinTypeLabel, { id: "account-join-code", maxlength: "24" });
    parts.push(
      h("p", { text: WORDS.joinApproveLede }),
      codeFigure(code),
      h("p", { class: "account__wait", text: WORDS.joinWaiting }),
      h(
        "details",
        { class: "account__more-ways" },
        h("summary", { text: WORDS.joinTypeInstead }),
        entry.row,
        button(ui, WORDS.setupContinue, () => startApproval(ctx, J, readApprovalCode(entry.input.value))),
      ),
    );
  } else {
    parts.push(h("p", { class: "account__wait", text: WORDS.joinWaiting }));
  }
  J.area.replaceChildren(...parts);
  J.stop = poll(
    ctx,
    async () => {
      const got = await acceptApproval({ call, device: J.device, asked });
      if (!got) return false;
      await linkUp(ctx, { device: J.device, held: got.held });
      await showHome(ctx, WORDS.joined);
      return true;
    },
    (error) => {
      J.area.replaceChildren(h("p", { class: "account__note", text: failureWords(error) }), button(ui, WORDS.startAgain, () => startApproval(ctx, J)));
    },
  );
}

function drawRecovery(ctx, J) {
  const { ui, call } = ctx;
  J.stop?.();
  const entry = field(WORDS.joinRecoveryLabel, { id: "account-join-recovery", maxlength: "40" });
  const open = button(
    ui,
    WORDS.joinOpen,
    async () => {
      let code;
      try {
        code = readRecoveryCode(entry.input.value);
      } catch (error) {
        throw new AccountStop("wrongCode", error);
      }
      const opened = await openWithRecoveryCode({ call, notebook: J.notebook, code, holders: J.holders });
      await finishJoin(ctx, J, opened);
    },
    { kind: "primary" },
  );
  J.area.replaceChildren(h("h3", { class: "account__subhead", text: WORDS.joinRecovery }), entry.row, h("div", { class: "account__actions" }, open));
  entry.input.focus();
}

/* ── The account's home ─────────────────────────────────────────────────── */

const format = (locale) => ({
  time: (iso) => new Intl.DateTimeFormat(locale, { hour: "numeric", minute: "2-digit" }).format(new Date(iso)),
  day: (iso) => dayWords(iso, locale),
});

/** The step behind "Reconnect" for a stop only the reader can settle. */
function stopPart(ctx, status) {
  const { S, ui } = ctx;
  const words = statusWords(status, format(ctx.locale));
  const rejoin = async (replace) => {
    // The reader's own yes to leaving the notebook this browser was syncing with.
    S.replace = replace;
    S.joining = true;
    let account = null;
    try {
      account = await readAccount(S.connector.call);
    } catch (error) {
      if (!(error instanceof AccountRefusal) || !error.is("sign_in")) throw error;
    }
    if (!account) return ctx.signIn(); // signs in, and comes back to join
    S.account = account;
    return account.notebook ? showJoin(ctx) : showSetup(ctx);
  };
  const actions = [];
  if (status.state === "signedOut") actions.push(button(ui, WORDS.stopSignIn, () => ctx.signIn(), { kind: "primary" }));
  else if (status.state === "otherNotebook") actions.push(button(ui, WORDS.stopJoinNew, () => rejoin(true), { kind: "primary" }));
  else actions.push(button(ui, WORDS.stopJoin, () => rejoin(false), { kind: "primary" }));
  actions.push(
    button(ui, WORDS.stopLeave, async () => {
      await leave(ctx);
      await ctx.forget();
      ctx.showSignedOut(WORDS.stopLeaveNote);
    }),
  );
  return h("div", { class: "account__stop", role: "group" }, h("p", { text: [words.line, ...words.detail].join(" ") }), h("div", { class: "account__actions" }, actions));
}

export async function showHome(ctx, note) {
  const { S, ui, db, doc } = ctx;
  const connector = S.connector;
  if (!connector) return ctx.route(note);

  // A recovery code that was made and never confirmed comes first.
  const kept = await db.get("code");
  if (kept && (await resumeCode(ctx, kept, () => showHome(ctx, WORDS.codeDone)))) return;

  const H = { lists: null, held: null, device: null, loading: false };
  const stop = h("div", { class: "account__stop-slot" });
  const said = h("div", { class: "account__news" });
  const waiting = h("div");
  const key = section(WORDS.keyTitle);
  const devices = section(WORDS.devicesTitle);
  const recovery = section(WORDS.recoveryTitle);
  const ways = section(WORDS.waysTitle);
  const needOpen = [key, devices, recovery];
  const slot = h("div", { "data-desk-sync-slot": true, hidden: true });
  const end = section(WORDS.endTitle);

  ui.show([ctx.title(WORDS.homeTitle), note ? h("p", { class: "account__note", text: note }) : null, stop, said, section(WORDS.syncTitle, slot), waiting, key, devices, recovery, ways, end]);
  doc.dispatchEvent(new CustomEvent(SLOT_EVENT));
  const alive = ui.live();
  const again = (text) => showHome(ctx, text);

  /* Each part, drawn from what is known now. */

  const drawAccount = () => {
    const parts = ctx.basicsParts(again);
    waiting.replaceChildren(...(parts.waiting ? [parts.waiting] : []));
    const out = h("div", { class: "account__delete" });
    const opener = h("button", { type: "button", class: "account__button account__button--quiet", text: WORDS.signOut, "data-account-signout": true });
    opener.addEventListener("click", () => {
      if (out.querySelector(".account__confirm")) return;
      out.append(
        confirmBox(ui, {
          ask: WORDS.signOutLinked,
          yes: WORDS.signOutConfirm,
          onYes: async () => {
            const device = connector.device();
            try {
              if (device) await signOutDevice({ call: connector.call, device });
              else await endSession(connector.call);
            } catch (error) {
              // An entry or a sign-in the service no longer has is as good as signed out; anything else is tried again.
              if (!(error instanceof AccountRefusal) || !(error.is("sign_in") || error.is("gone") || error.is("not_found"))) throw error;
            }
            await leave(ctx);
            S.account = null;
            ctx.showSignedOut(WORDS.signedOutNow);
          },
          onCancel: () => opener.focus(),
        }),
      );
      out.querySelector(".account__confirm button")?.focus();
    });
    out.append(opener);
    end.replaceChildren(end.firstChild, out, ...(S.account && parts.remove ? [parts.remove] : []));
    drawWays();
  };

  const change = async (run) => {
    const result = await run({ call: connector.call, device: H.device, held: H.held, lists: H.lists });
    await connector.adopt(result.held);
    return result;
  };
  /** A change of key that may make a recovery code: kept before the request, dropped on a refusal, shown after. */
  const changeWithCode = async (run, done) => {
    const groups = groupsToAsk(random(ctx));
    let result;
    try {
      result = await change((rest) => run({ ...rest, random: random(ctx), keep: async ({ code, notebook }) => db.set({ code: await sealCode(H.device, code, groups, notebook) }) }));
    } catch (error) {
      if (error instanceof AccountRefusal || error instanceof AccountStop) await db.set({ code: undefined });
      throw error;
    }
    if (result.code) return showCode(ctx, { code: result.code, groups, after: () => showHome(ctx, WORDS.codeDone) });
    return again(done);
  };

  const ask = (holder, opener, options) => {
    if (holder.querySelector(".account__confirm")) return;
    holder.append(confirmBox(ui, { ...options, onCancel: () => opener.focus() }));
    holder.querySelector(".account__confirm button")?.focus();
  };

  const drawKey = () => {
    const where = whereKeyLives(H.lists);
    const box = h("div", { class: "account__row" }, h("p", { text: where === "account" ? WORDS.keyAccount : WORDS.keyDevice }));
    const opener = h("button", { type: "button", class: "account__button account__button--quiet", text: where === "account" ? WORDS.keyToDevice : WORDS.keyToAccount });
    opener.addEventListener("click", () =>
      where === "account"
        ? ask(box, opener, { ask: WORDS.keyToDeviceAsk, yes: WORDS.keyToDeviceYes, onYes: () => changeWithCode(switchToDeviceOnly, WORDS.keyChanged) })
        : ask(box, opener, {
            ask: WORDS.keyToAccountAsk,
            yes: WORDS.keyToAccountYes,
            onYes: async () => {
              const got = await passkeyOutput(ctx, syncedPasskeys(S.account).map((way) => fromBase64url(way.credential)));
              if (!got) return ui.warn(WORDS.followFailed);
              await addHolder({ call: connector.call, held: H.held, lists: H.lists, want: { kind: "passkey", credential: got.id, prf: got.output }, random: random(ctx) });
              await again(WORDS.keyNowAccount);
            },
          }),
    );
    if (where === "account" || syncedPasskeys(S.account).length) box.append(opener);
    key.replaceChildren(key.firstChild, box);
  };

  const drawDevices = () => {
    const list = h("ul", { class: "account__list" });
    for (const entry of H.lists.devices) {
      const own = entry.id === H.device.id;
      const row = h("li", { class: "account__item" });
      if (!entry.opens) {
        row.append(h("p", { class: "account__hint", text: WORDS.unknownDevice }));
        list.append(row);
        continue;
      }
      row.append(h("p", { class: "account__item-name", text: entry.name }), h("p", { class: "account__hint", text: deviceLine({ platform: entry.platform, added: entry.added, own, locale: ctx.locale }) }));
      if (own) {
        const opener = h("button", { type: "button", class: "account__button account__button--quiet", text: WORDS.rename });
        opener.addEventListener("click", () => {
          if (row.querySelector(".account__field")) return;
          const name = field(WORDS.renameLabel, { id: "account-device-name", maxlength: "60", value: entry.name });
          const save = button(ui, WORDS.save, async () => {
            const next = cleanName(name.input.value);
            if (!next || next === entry.name) return again();
            await renameDevice({ call: connector.call, device: H.device, held: H.held, lists: H.lists, name: next });
            await again();
          });
          row.append(name.row, h("div", { class: "account__actions" }, save));
          name.input.focus();
        });
        row.append(opener);
      } else {
        const opener = h("button", { type: "button", class: "account__button account__button--quiet", text: WORDS.remove, "aria-label": `${WORDS.remove} ${entry.name}` });
        opener.addEventListener("click", () =>
          ask(row, opener, { ask: removeAsk(entry.name), yes: WORDS.removeYes, kind: "danger", onYes: () => changeWithCode((rest) => removeDevices({ ...rest, ids: [entry.id] }), WORDS.keyChanged) }),
        );
        row.append(opener);
      }
      list.append(row);
    }
    const add = h("div", { class: "account__add" });
    drawAdd(add);
    devices.replaceChildren(devices.firstChild, list, add);
  };

  /** "Add a device": the code the new device shows is typed here, or this one shows a code for it. */
  let stopShown = null;
  const drawAdd = (add, typed = "") => {
    stopShown?.();
    const entry = field(WORDS.addDeviceLabel, { id: "account-add-code", maxlength: "24", value: typed });
    const confirm = (found) => {
      add.replaceChildren(
        confirmBox(ui, {
          ask: addAsk(found.request.model, found.request.platform),
          yes: WORDS.addDeviceYes,
          onYes: async () => {
            await grant({ call: connector.call, held: H.held, found });
            await again(WORDS.addDeviceDone);
          },
          onCancel: () => drawAdd(add),
        }),
      );
      add.querySelector("button")?.focus();
    };
    const find = button(ui, WORDS.addDeviceFind, async () => {
      let code;
      try {
        code = readApprovalCode(entry.input.value);
      } catch {
        return ui.warn(WORDS.addDeviceNone);
      }
      let found;
      try {
        found = await findRequest({ call: connector.call, code });
      } catch (error) {
        if (error instanceof AccountStop && error.why === "approvalGone") return ui.warn(WORDS.addDeviceNone);
        throw error;
      }
      confirm(found);
    });
    const show = button(ui, WORDS.showCode, async () => {
      const code = random(ctx)(10);
      add.replaceChildren(h("p", { text: WORDS.showCodeLede }), codeFigure(code), h("p", { class: "account__wait", text: WORDS.joinWaiting }), button(ui, WORDS.cancel, () => drawAdd(add)));
      stopShown = poll(
        ctx,
        async () => {
          let found;
          try {
            found = await findRequest({ call: connector.call, code });
          } catch (error) {
            if (error instanceof AccountStop && error.why === "approvalGone") return false; // not asked yet
            throw error;
          }
          confirm(found);
          return true;
        },
        (error) => {
          add.replaceChildren(h("p", { class: "account__note", text: failureWords(error) }), button(ui, WORDS.startAgain, () => drawAdd(add)));
        },
      );
    });
    add.replaceChildren(h("h3", { class: "account__subhead", text: WORDS.addDevice }), h("p", { class: "account__hint", text: WORDS.addDeviceLede }), entry.row, h("div", { class: "account__actions" }, find, show));
  };

  const drawRecovery = () => {
    const has = hasRecoveryCode(H.lists);
    const box = h("div", { class: "account__row" }, h("p", { text: has ? WORDS.recoveryHave : WORDS.recoveryNone }));
    const opener = h("button", { type: "button", class: "account__button account__button--quiet", text: has ? WORDS.recoveryNew : WORDS.recoveryFirst });
    opener.addEventListener("click", () => {
      if (has) return ask(box, opener, { ask: WORDS.recoveryNewAsk, yes: WORDS.recoveryNewYes, onYes: () => changeWithCode(newRecoveryCode, WORDS.keyChanged) });
      // A first code needs no change of key: a holder is added under the key there is.
      return ui.run(opener, async () => {
        const groups = groupsToAsk(random(ctx));
        let made;
        try {
          made = await addHolder({
            call: connector.call,
            held: H.held,
            lists: H.lists,
            want: { kind: "recovery" },
            random: random(ctx),
            keep: async ({ code, notebook }) => db.set({ code: await sealCode(H.device, code, groups, notebook) }),
          });
        } catch (error) {
          if (error instanceof AccountRefusal) await db.set({ code: undefined });
          throw error;
        }
        showCode(ctx, { code: made.code, groups, after: () => showHome(ctx, WORDS.codeDone) });
      });
    });
    box.append(opener);
    recovery.replaceChildren(recovery.firstChild, box);
  };

  const drawWays = () => {
    const list = h("ul", { class: "account__list" });
    const carrying = new Set((H.lists?.holders ?? []).filter((holder) => holder.opens && holder.kind === "passkey").map((holder) => holder.credential));
    for (const way of S.account?.ways ?? []) {
      const parts = [dayWords(way.added, ctx.locale) ? `added ${dayWords(way.added, ctx.locale)}` : null, way.credential && carrying.has(way.credential) ? WORDS.wayCarries : null].filter(Boolean);
      const row = h("li", { class: "account__item" }, h("p", { class: "account__item-name", text: wayWords(way.kind) }), parts.length ? h("p", { class: "account__hint", text: parts.join(", ") }) : null);
      row.append(
        button(
          ui,
          WORDS.remove,
          async () => {
            await removeWay(connector.call, way.id);
            await ctx.refresh();
            await again(WORDS.wayRemoved);
          },
          { "aria-label": `${WORDS.remove} ${wayWords(way.kind)}` },
        ),
      );
      list.append(row);
    }
    const add = button(ui, WORDS.wayAdd, async () => {
      await addPasskeyWay({ call: connector.call, credentials: ctx.credentials(), prfInput: await prfBytes() });
      await ctx.refresh();
      await again(WORDS.wayAdded);
    });
    const actions = h("div", { class: "account__actions" }, add);
    ways.replaceChildren(ways.firstChild, list, actions);
    ways.hidden = !S.account;
    // Apple and Google, where each is on and the account doesn't have it yet (page.js, "Apple and Google").
    ctx.providers().then(
      (offered) => {
        if (!alive() || !actions.isConnected) return;
        const has = new Set((S.account?.ways ?? []).map((way) => way.kind));
        for (const provider of offered) {
          if (!has.has(provider)) actions.append(button(ui, provider === "apple" ? WORDS.wayAddApple : WORDS.wayAddGoogle, () => ctx.leaveFor(provider, "way")));
        }
      },
      () => {},
    );
  };

  /** What this device hasn't told its reader about: a device that joined, a new way to open the notebook. */
  const drawNews = async () => {
    const seen = await db.get("seen");
    const all = seenIn(H.lists);
    if (!Array.isArray(seen)) return db.set({ seen: all });
    const items = news({ lists: H.lists, seen, own: H.device.id });
    if (!items.length) return undefined;
    const box = h("div", { class: "account__notice", role: "group" }, h("ul", {}, items.map((item) => h("li", { text: newsWords(item, ctx.locale, { own: H.device.id }) }))));
    box.append(
      button(ui, WORDS.ok, async () => {
        await db.set({ seen: all });
        box.remove();
      }),
    );
    said.replaceChildren(box);
    return undefined;
  };

  const loadLists = async () => {
    if (H.loading || H.lists) return;
    H.loading = true;
    try {
      const held = await connector.keyring();
      const device = connector.device();
      if (!held || !device) return;
      const lists = await readLists({ call: connector.call, held });
      if (!alive()) return;
      Object.assign(H, { lists, held, device });
      for (const part of needOpen) part.hidden = false;
      drawKey();
      drawDevices();
      drawRecovery();
      drawWays();
      await drawNews();
      if (S.pendingCode) {
        const typed = S.pendingCode;
        S.pendingCode = null;
        drawAdd(devices.querySelector(".account__add"), typed);
        devices.querySelector(".account__add button")?.click();
      }
    } catch (error) {
      // Not open yet (the first pass hasn't proved the key): the next status tries again.
      if (!(error instanceof AccountRefusal && (error.is("not_open") || error.is("sign_in"))) && alive()) ui.fail(error);
    } finally {
      H.loading = false;
    }
  };

  let lastState = null;
  const onStatus = async (status) => {
    if (!alive()) return off();
    const state = status?.state;
    const stopped = needsReader(state);
    if (stopped) {
      if (state !== lastState) stop.replaceChildren(stopPart(ctx, status));
      for (const part of needOpen) part.hidden = true;
    } else {
      stop.replaceChildren();
      if (state === "upToDate" || state === "syncing") await loadLists();
    }
    if (state !== lastState && (state === "upToDate" || stopped)) {
      lastState = state;
      if (!S.account || stopped) {
        try {
          await ctx.refresh();
        } catch {
          /* offline: the parts that need the account stay as they are */
        }
        if (alive()) drawAccount();
      }
    }
    lastState = state;
  };
  const off = connector.subscribe(onStatus);

  for (const part of needOpen) part.hidden = true;
  try {
    await ctx.refresh();
  } catch {
    /* offline: the status line says so */
  }
  if (!alive()) return;
  drawAccount();
  // The header's “Sign out” comes here to be asked (header-entry.js): the question opens, and the address
  // loses its mark. Pressed on this page, the link only changes the address, so that is heard too.
  ctx.offSignOutLink?.();
  const askSignOut = () => {
    if (!alive() || !end.isConnected || ctx.win.location.hash !== "#sign-out") return;
    try {
      ctx.win.history.replaceState(ctx.win.history.state, "", ctx.win.location.pathname + ctx.win.location.search);
    } catch {
      /* the address keeps its mark; the question is asked all the same */
    }
    const opener = end.querySelector("[data-account-signout]");
    opener?.scrollIntoView?.({ block: "center" });
    opener?.click();
  };
  ctx.win.addEventListener("hashchange", askSignOut);
  ctx.offSignOutLink = () => ctx.win.removeEventListener("hashchange", askSignOut);
  askSignOut();
  await onStatus(connector.status());
}
