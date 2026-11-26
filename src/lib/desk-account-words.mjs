// src/lib/desk-account-words.mjs
//
// Every sentence the account pages show (the plan's step 4h), and the small
// pure rules beside them: what a device is first called, how a stop is
// worded, where the switch points. No DOM and no imports, so the words are
// tested without a browser (test/desk-account-words.test.js holds them to
// the site's conventions: curly quotes, no em dashes) and a page that holds
// no notebook can load them alone.
//
// THE WORDING IS CLAUDE'S PROPOSAL. BVJ chose the design on 2026-11-24 (the
// screens, what each offers, and that "no account" is plainly an option);
// the final words of the first-time choice ("Follows my account" or "This
// device only") belong to the plan's step 4j. A new sentence here is a new
// thing to show BVJ.

/* ── The switch ─────────────────────────────────────────────────────────── */

/**
 * Accounts are closed for every reader until launch. One browser opens them
 * with `?account=preview` (or `?account=local`, on a page served from this
 * computer, for `wrangler dev`), and `?account=off` closes them again. The
 * choice is kept in local storage under SWITCH_KEY, which /privacy names,
 * and retires at launch as `lit-desk-preview` does.
 */
export const SWITCH_KEY = "lit-desk-account";
export const SWITCH_PARAM = "account";
/** The switch's values, and the service each one names (a key of SERVICES in desk-sync-link.mjs). */
export const SWITCH_VALUES = Object.freeze(["preview", "local"]);

/** What `?account=` asks for: "preview", "local", "off", or null when the address says nothing readable. */
export function readSwitchParam(search) {
  let value = null;
  try {
    value = new URLSearchParams(search ?? "").get(SWITCH_PARAM);
  } catch {
    return null;
  }
  if (value === "off") return "off";
  return SWITCH_VALUES.includes(value) ? value : null;
}

/* ── A device's first name ──────────────────────────────────────────────── */

const BROWSERS = [
  [/\bEdg(?:e|A|iOS)?\//, "Edge"],
  [/\bOPR\//, "Opera"],
  [/\bFirefox\/|\bFxiOS\//, "Firefox"],
  [/\bChrome\/|\bCriOS\//, "Chrome"],
  // Every WebKit and Chromium browser ends its line with "Safari/"; only Safari itself says "Version/" before it.
  [/\bVersion\/[\d.]+ (?:Mobile\/\w+ )?Safari\//, "Safari"],
];
const SYSTEMS = [
  [/\biPhone\b/, "iPhone"],
  [/\biPad\b/, "iPad"],
  [/\bAndroid\b/, "Android"],
  [/\bCrOS\b/, "ChromeOS"],
  [/\bWindows\b/, "Windows"],
  [/\bMac OS X\b|\bMacintosh\b/, "Mac"],
  [/\bLinux\b/, "Linux"],
];

/**
 * What a device is called until its reader renames it: its browser and its
 * system ("Chrome on Windows"; BVJ, 2026-11-24). At most 60 characters, as a
 * card's name is kept.
 */
export function deviceName(userAgent) {
  const ua = String(userAgent ?? "");
  const browser = BROWSERS.find(([test]) => test.test(ua))?.[1];
  const system = SYSTEMS.find(([test]) => test.test(ua))?.[1];
  if (browser && system) return `${browser} on ${system}`;
  return browser ?? (system ? `A browser on ${system}` : "A web browser");
}

/** The longest name a device may be given here. */
export const NAME_MAX = 60;

/** A typed device name, trimmed and cut to what a card keeps; null when nothing is left. */
export function cleanName(typed) {
  const name = String(typed ?? "").replace(/\s+/g, " ").trim().slice(0, NAME_MAX);
  return name || null;
}

/* ── Small words ────────────────────────────────────────────────────────── */

const PLATFORM_WORDS = { ios: "iPhone or iPad", android: "Android", web: "Website" };
/** A device's platform, as its card says it. */
export const platformWords = (platform) => PLATFORM_WORDS[platform] ?? "Another device";

const WAY_WORDS = { passkey: "Passkey", apple: "Apple", google: "Google", preview: "The preview’s sign-in" };
/** A way to sign in, as a row names it. */
export const wayWords = (kind) => WAY_WORDS[kind] ?? "Another way to sign in";

const SIGNED_IN_WITH = { passkey: "a passkey", apple: "Apple", google: "Google", preview: "the preview’s sign-in" };
/** "Signed in with a passkey." */
export const signedInWords = (kind) => `Signed in with ${SIGNED_IN_WITH[kind] ?? "your account"}.`;

/** "November 24, 2026", in the reader's own language and time zone; "" for no date. */
export function dayWords(iso, locale) {
  const date = new Date(iso);
  if (!iso || Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(locale, { year: "numeric", month: "long", day: "numeric" }).format(date);
}

/* ── The sentences ──────────────────────────────────────────────────────── */

export const HELP_KEPT = "/desk/help/#ways-to-keep";
export const HELP_COPIES = "/desk/help/#copies";
export const ACCOUNT_PATH = "/account/";
export const CONNECT_PATH = "/account/connect/";

export const WORDS = Object.freeze({
  loading: "Loading your account…",
  working: "Working…",

  /* Signed out */
  signInTitle: "Sign in",
  signInLede:
    "An account keeps your notebook in step across your devices. Your notebook is locked on your devices before it is sent, with a key we never have, so we can’t read it.",
  signInPasskey: "Sign in with a passkey",
  create: "Create an account",
  /* Apple and Google: shown only once each has a client id (desk-account-providers.mjs) */
  signInApple: "Sign in with Apple",
  signInGoogle: "Sign in with Google",
  providerStale: "That sign-in didn’t finish, so nothing was changed. Try again.",
  providerCanceled: "The sign-in was closed before it finished. Nothing was changed.",
  createNote:
    "Creating an account makes a passkey, which your browser or password manager keeps for you. There is no password, and we don’t ask for your name or email address.",
  noPasskeys: "This browser can’t use passkeys, so it can’t sign in here. Try a current version of Chrome, Edge, Safari, or Firefox.",
  noAccountTitle: "You don’t need an account",
  noAccountBody:
    "Your notebook works without one. It stays in this browser, and you keep it safe by saving a copy to a file, which you can bring back or merge on any computer.",
  noAccountKept: "Where your notebook is kept",
  noAccountCopies: "Backing up your notebook",
  signedOutNow: "You’re signed out. Your notebook is still in this browser.",
  deletedNow: "Your account was deleted. The notebook in this browser is still here.",
  check: "One more step before your account is made: a quick check that you’re a person.",

  /* The account's basics */
  basicsTitle: "Your account",
  phoneHasNotebook:
    "Your account has a synced notebook. A phone’s or tablet’s browser doesn’t hold it: open it in the LIT Bible app, or on the website on a computer.",
  phoneNoNotebook: "Your account has no notebook yet. Set one up in the LIT Bible app, or on the website on a computer.",
  deskOffHasNotebook: "Your account has a synced notebook. To open it here, turn on the Study Desk in this browser.",
  signOut: "Sign out",
  signOutBasics: "Signing out ends this sign-in. Nothing in your account changes.",
  signOutLinked: "Signing out stops syncing on this computer and takes it off your notebook’s devices. Your notebook stays in this browser.",
  signOutConfirm: "Sign out of this computer",
  cancel: "Cancel",

  /* Deleting */
  deleteTitle: "Delete your account",
  deleteSignIn: "Sign in to the account you want to delete. Nothing is deleted until you choose “Delete account…” and confirm.",
  deleteOpen: "Delete account…",
  deleteAtOnce:
    "This deletes your account and the synced copy of your notebook now, for every device. It can’t be undone. The notebook on each of your devices stays where it is.",
  deleteWaits:
    "This sign-in hasn’t opened your notebook, so the request waits seven days. Every device that holds your notebook shows the request, and any of them can cancel it. After seven days your account and the synced copy of your notebook are deleted.",
  deleteNow: "Delete my account",
  deleteAsk: "Ask to delete my account",
  deleteMore: "What is deleted, and what stays",
  cancelRequest: "Cancel the request",
  canceled: "The request was canceled.",

  /* Setup */
  setupTitle: "Set up your synced notebook",
  setupLede: "Your notebook is locked with a key before it leaves this computer. Choose where that key lives.",
  followTitle: "Follows my account",
  followBody: "Your passkey carries the key. Sign in on a new device with the same passkey, and your notebook opens there.",
  followOff: "Your passkey can’t carry the key in this browser, so this choice isn’t offered here.",
  deviceTitle: "This device only",
  deviceBody: "The key stays on the devices you add. A new device joins when one you already use approves it, or with your recovery code.",
  setupNext: "Either way, you’ll get a recovery code next.",
  setupContinue: "Continue",
  setupLegend: "Where the key lives",
  followFailed: "Your passkey didn’t give this browser what it needs to carry the key. You can choose “This device only,” or try again.",

  /* The recovery code */
  codeTitle: "Your recovery code",
  codeLede:
    "This code opens your notebook if you ever lose your devices or your passkey. Save it somewhere safe and private. We never see it, so we can’t send it to you later.",
  codeCopy: "Copy",
  codeCopied: "Copied.",
  codePrint: "Print",
  codeSaved: "I’ve saved it",
  codeCheckTitle: "Check your recovery code",
  codeCheckLede: "To be sure it was saved, type two of its groups.",
  codeShowAgain: "Show the code again",
  codeFinish: "Finish",
  codeWrong: "That doesn’t match the code. Check what you saved and try again.",
  codeDone: "Your recovery code is saved.",
  codeUnreadable: "This computer can’t show the recovery code again. Make a new one below, so that you have one saved.",

  /* Joining */
  joinTitle: "Open your notebook on this computer",
  joinLede: "Your account already has a synced notebook. This computer needs the notebook’s key before it can open it.",
  joinPasskey: "Use my passkey",
  joinPasskeyNo: "That passkey can’t open your notebook on this computer. Try one of the other ways.",
  joinApprove: "Approve from another device",
  joinApproveLede:
    "On a device that already has your notebook, open your account (in the app: Settings, then Account), choose “Add a device,” and enter this code or scan it. The code works for 10 minutes.",
  joinWaiting: "Waiting for the other device…",
  joinTypeInstead: "Enter a code from the other device instead",
  joinTypeLabel: "The code the other device shows",
  joinRecovery: "Use my recovery code",
  joinRecoveryLabel: "Recovery code",
  joinOpen: "Open my notebook",
  joinGone: "That code ran out. Start again for a new one.",
  joinForged: "That approval didn’t come from a device that saw your code, so nothing was accepted. Start again.",
  joinOther:
    "The notebook in this browser was syncing with a different account’s notebook. If you go on, it joins this account’s notebook instead, and the notes in this browser are added to it.",
  joinOtherYes: "Join this notebook",
  joined: "This computer has joined your notebook.",
  /* Starting a new notebook, for a reader with no way left to open the old one */
  joinCant: "I can’t do any of these",
  replaceTitle: "Start a new notebook",
  replaceLede:
    "If you have lost every device and have no passkey or recovery code that opens your notebook, no one can open it, and we can’t either. You can start a new notebook in its place. The request waits seven days, and any device that can still open the old notebook can cancel it. After that, come back to this page to set the new one up, and the notebook in this browser goes into it.",
  replaceAsk: "Ask to start a new notebook",
  replaceAsked: "Your request is recorded. Nothing changes for seven days.",
  startAgain: "Start again",
  tryAgain: "Try again",
  ok: "OK",

  /* Home */
  homeTitle: "Your account",
  syncTitle: "Sync",
  keyTitle: "Where your notebook’s key lives",
  keyAccount: "Follows your account. Your passkey carries the key, so signing in with it on a new device opens your notebook there.",
  keyDevice: "This device only. The key stays on your devices, and a new one joins by approval or with your recovery code.",
  keyToDevice: "Switch to this device only…",
  keyToDeviceAsk:
    "Your passkey will stop carrying the key, and the key is changed. Your passkey still signs you in. A new device will join by approval or with your recovery code.",
  keyToDeviceYes: "Switch to this device only",
  keyToAccount: "Let my passkey carry the key…",
  keyToAccountAsk: "Your passkey will carry the key, so signing in with it on a new device opens your notebook there. You’ll be asked for your passkey now.",
  keyToAccountYes: "Use my passkey",
  keyChanged: "Done. Your notebook’s key was changed.",
  keyNowAccount: "Done. Your passkey now carries the key.",
  devicesTitle: "Devices",
  thisComputer: "This computer",
  rename: "Rename",
  renameLabel: "This computer’s name",
  save: "Save",
  remove: "Remove",
  removeYes: "Remove device",
  unknownDevice: "A device this computer can’t read. It is removed the next time the key changes.",
  addDevice: "Add a device",
  addDeviceLede: "On the new device, sign in and choose to join by approval. Then enter the code it shows.",
  addDeviceLabel: "The code the new device shows",
  addDeviceFind: "Continue",
  addDeviceYes: "Add device",
  addDeviceDone: "Added. It can take a moment to show on the new device.",
  addDeviceNone: "No device is waiting with that code. Check the code, and that it hasn’t run out.",
  showCode: "Show a code for the new device instead",
  showCodeLede: "On the new device, sign in, choose to join by approval, and enter this code or scan it. The code works for 10 minutes.",
  recoveryTitle: "Recovery code",
  recoveryHave: "You have a recovery code. If you’ve lost it, or someone else may have seen it, make a new one. The old code stops working.",
  recoveryNone: "Your notebook has no recovery code. Make one, so that you can open your notebook if you lose your devices.",
  recoveryNew: "Make a new recovery code",
  recoveryNewYes: "Make the new code",
  recoveryFirst: "Make a recovery code",
  recoveryNewAsk: "The old code stops working, and your notebook’s key is changed. You’ll see the new code once, and type two of its groups back.",
  waysTitle: "Ways to sign in",
  wayCarries: "carries your notebook’s key",
  wayAdd: "Add a passkey",
  wayAddApple: "Add Sign in with Apple",
  wayAddGoogle: "Add Sign in with Google",
  wayAdded: "Added.",
  wayRemoved: "Removed.",
  wayLast: "This is your only way to sign in, so it can’t be removed.",
  wayHolds: "This passkey carries your notebook’s key. Switch to “This device only” first, and then remove it.",
  endTitle: "Sign out or delete",

  /* A stop only the reader can settle */
  stopSignIn: "Sign in again",
  stopJoin: "Join again",
  stopJoinNew: "Join the new notebook",
  stopLeave: "Stop syncing on this computer",
  stopLeaveNote: "Syncing stops on this computer. Your notebook stays in this browser.",

  /* The page that takes a scanned code */
  connectTitle: "Add a device",
  connectLede: "This link carries a code from a device that wants to join your notebook.",
  connectGo: "Continue to your account",
});

/** "Type groups 2 and 5." */
export const codeGroupLabel = (group) => `Group ${group}`;

/** “Remove “Chrome on Windows” from your notebook? …” */
export const removeAsk = (name) =>
  `Remove “${name ?? "this device"}” from your notebook? It stops syncing there, and your notebook’s key is changed so that it can’t open anything new. The notebook already on that device stays on it.`;

/** “Add “Pixel 9” (Android) to your notebook?” */
export const addAsk = (model, platform) => `Add “${model || "a new device"}” (${platformWords(platform)}) to your notebook?`;

/** The line under a device's name. */
export function deviceLine({ platform, added, own, locale }) {
  const parts = [platformWords(platform)];
  if (own) parts.unshift(WORDS.thisComputer);
  const day = dayWords(added, locale);
  if (day) parts.push(`added ${day}`);
  return parts.join(", ");
}

/** A request that is waiting its seven days, in a sentence. `waiting` is the service's `{ what, due, mine }`. */
export function waitingWords(waiting, locale) {
  if (!waiting || (waiting.what !== "delete" && waiting.what !== "replace")) return null;
  const what = waiting.what === "delete" ? "delete your account" : "replace your account’s notebook";
  const who = waiting.mine ? "You asked" : "Someone signed in to your account asked";
  const day = dayWords(waiting.due, locale);
  return `${who} to ${what}.${day ? ` It takes effect on ${day}.` : ""}`;
}

/**
 * What a new device or a new way to open the notebook is announced as. `item`
 * is one of `news()`'s (desk-account.mjs); `own` is this device's id, so an
 * approval given here says so (two computers often share a first name,
 * "Chrome on Windows"). `day` writes the day in place of `dayWords`: the
 * notice on a reading page leaves the year out (sync/account-notice.js).
 */
export function newsWords(item, locale, { own = null, day: write = null } = {}) {
  const day = write ? write(item.added) : dayWords(item.added, locale);
  const when = day ? ` on ${day}` : "";
  if (item.what === "device") {
    const name = item.name ? `“${item.name}”` : "A device";
    // Each ending carries its own period: one that closes on a quoted name puts the period inside the quote.
    const approved = own && item.by === own ? ", approved from this computer." : item.byName ? `, approved from “${item.byName}.”` : ", approved from another device.";
    const how = item.how === "approval" ? approved : item.how === "recovery" ? ", with your recovery code." : item.how === "passkey" ? ", with your passkey." : ".";
    return `${name} joined your notebook${when}${how}`;
  }
  const kind = item.kind === "recovery" ? "A new recovery code" : "A passkey that carries the key";
  const by = item.byName ? ` from “${item.byName}.”` : ".";
  return `${kind} was added to your notebook${when}${by}`;
}

/**
 * What a failed step says. `error` is whatever was thrown: an Offline (the
 * carrier's), a PasskeyStopped (`why`), an AccountRefusal (`word`, and
 * `is()`), an AccountStop (`why`), or anything else. Every sentence says
 * that nothing was lost where that is true.
 */
export function failureWords(error) {
  const name = error?.name;
  if (name === "Offline") return "The notebook service can’t be reached. Check your connection and try again. Nothing was changed.";
  if (name === "PasskeyStopped") {
    if (error.why === "canceled") return "The passkey prompt was closed, so nothing was changed.";
    if (error.why === "exists") return "Your browser or password manager already has a passkey for this account. Choose “Sign in with a passkey” instead.";
    if (error.why === "unsupported") return WORDS.noPasskeys;
    return "The passkey didn’t work, and nothing was changed. Try again.";
  }
  if (name === "AccountStop") {
    switch (error.why) {
      case "wrongCode":
        return "That code doesn’t open this notebook. Check it and try again.";
      case "noRecovery":
        return "This notebook has no recovery code. Use one of the other ways.";
      case "holderBroken":
        return "That way of opening your notebook didn’t pass this computer’s checks, so nothing was kept. Try one of the other ways.";
      case "approvalGone":
        return WORDS.joinGone;
      case "approvalForged":
        return WORDS.joinForged;
      case "holderNeeded":
        return "That would leave nothing that can open your notebook, so nothing was changed.";
      case "behind":
        return "Your notebook’s key was changed on another device. Wait for this computer to sync, and then try again.";
      default:
        return "This computer couldn’t do that safely, so nothing was changed.";
    }
  }
  if (name === "AccountRefusal") {
    const is = (word, about) => (typeof error.is === "function" ? error.is(word, about) : error.word === word);
    if (is("passkey_refused", "unknown")) return "That passkey doesn’t belong to an account here. If you’re new, choose “Create an account.”";
    if (is("passkey_refused")) return "The passkey wasn’t accepted, and nothing was changed. Try again.";
    if (is("not_allowed", "turnstile")) return "The check that you’re a person didn’t pass. Try again.";
    if (is("not_allowed", "last_way")) return WORDS.wayLast;
    if (is("not_allowed", "passkey_holds_key")) return WORDS.wayHolds;
    if (is("exists", "waiting")) return "A request is already waiting on this account.";
    if (is("already_set_up")) return "Your account already has a notebook, so this computer will join it instead.";
    if (is("sign_in")) return "Your sign-in ended. Sign in again, and then try once more.";
    if (is("wrong_proof") || is("old_key") || is("lists_changed")) return "Something about your notebook changed on another device just now. Try again.";
    if (is("gone")) return "That is no longer there. Nothing was changed.";
    if (is("slow_down") || is("too_many") || is("busy")) return "Too many tries in a short time. Wait a minute, and then try again.";
    if (is("token_refused")) return "That sign-in wasn’t accepted, so nothing was changed. Try again.";
    if (is("provider")) return "A service this step depends on couldn’t be reached. Try again in a moment.";
  }
  return "Something went wrong, and nothing was changed. Try again.";
}
