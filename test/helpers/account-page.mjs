// test/helpers/account-page.mjs
//
// A browser for the account page's tests (the plan's step 4h): the real page
// (src/scripts/desk/account/), the real store and sync storage over
// fake-indexeddb, the real connector, and the notebook service's own code
// (./real-notebook-service.mjs) behind a software passkey
// (./fake-credentials.mjs). Import ./browser-env.mjs before this file.
//
// ONE BROWSER IS LIVE AT A TIME, as one tab's connector is
// (sync/start.js keeps one). `use(browser)` makes a browser the live one: its
// IndexedDB, its channels between tabs, and its stand-ins for timers and
// locks. Opening its page again is that browser being opened again, with
// everything it stored still there.

import { IDBFactory } from "fake-indexeddb";

import { resetDom } from "./browser-env.mjs";
import { fakeCredentials } from "./fake-credentials.mjs";
import { realService } from "./real-notebook-service.mjs";
import { fakeBar, fakeLocks, handTimers, until } from "./sync-browser.mjs";

const { start } = await import("../../src/scripts/desk/account/page.js");
const { setSyncEnv } = await import("../../src/scripts/desk/sync/start.js");

const BaseChannel = globalThis.BroadcastChannel;
let browsers = 0;

export const CHROME = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
export const SAFARI_MAC = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15";
export const PHONE = "Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36";

/** A service, and the browsers that talk to it. */
export function world(env) {
  const service = realService(env ? { env } : undefined);
  /** Every request the pages sent, as { method, path, body }. */
  const sent = [];
  /** Set to a function to break the network: it is given { method, path } after the service answered, and may throw. */
  const net = { after: null };
  const fetch = async (url, init = {}) => {
    const path = new URL(url).pathname;
    sent.push({ method: init.method, path, body: init.body ? JSON.parse(init.body) : null });
    const res = await service.fetch(url, init);
    net.after?.({ method: init.method, path });
    return res;
  };
  return { service, sent, net, fetch };
}

/**
 * A browser. `desk` is whether the Study Desk is on in it (a computer);
 * `creds` is its password manager, shared with another browser when a
 * passkey syncs between them.
 */
export function browser(w, { desk = true, userAgent = CHROME, creds = fakeCredentials({ origin: w.service.pageOrigin }) } = {}) {
  const n = ++browsers;
  const timers = handTimers();
  const b = {
    w,
    desk,
    userAgent,
    creds,
    idb: new IDBFactory(),
    timers,
    bar: fakeBar(),
    logged: [],
    Channel: class extends BaseChannel {
      constructor(name) {
        super(`${name}#account-${n}`);
      }
    },
    page: null,
  };
  b.syncEnv = { fetch: w.fetch, locks: fakeLocks(), setTimer: timers.set, clearTimer: timers.clear, bar: async () => b.bar, log: (...args) => b.logged.push(args), pageOrigin: w.service.pageOrigin };
  return b;
}

/** Makes `b` the live browser. */
export async function use(b) {
  globalThis.indexedDB = b.idb;
  globalThis.BroadcastChannel = b.Channel;
  if (b.desk) document.documentElement.dataset.desk = "on";
  else delete document.documentElement.dataset.desk;
  document.documentElement.removeAttribute("data-account");
  await setSyncEnv(b.syncEnv);
}

/**
 * Opens an account page in `b` (and makes it the live browser). `kind` is
 * the page ("account", "delete", "connect"); `open` the switch's value;
 * `hash` what the address carries after its `#`; `heading` the page's own
 * h1 above the box, as account.astro draws it.
 */
export async function openPage(b, { kind = "account", open = "preview", hash = "", heading = null } = {}) {
  await use(b);
  resetDom(`${b.w.service.pageOrigin}/${kind === "delete" ? "delete-account" : kind === "connect" ? "account/connect" : "account"}/${hash}`);
  const root = document.createElement("div");
  root.setAttribute("data-account-page", kind);
  root.innerHTML = "<p>Accounts are not open yet.</p>";
  document.body.append(root);
  if (heading) {
    const h1 = document.createElement("h1");
    h1.className = "account-page__title";
    h1.textContent = heading;
    root.before(h1);
  }
  const page = {
    b,
    root,
    ctx: null,
    text: () => root.textContent.replace(/\s+/g, " ").trim(),
    has: (words) => root.textContent.includes(words),
    button: (label) => [...root.querySelectorAll("button")].find((el) => el.textContent.trim() === label) ?? null,
    labels: () => [...root.querySelectorAll("button")].map((el) => el.textContent.trim()),
    /** Presses a button and waits for its step to end (it is busy until then). */
    async press(label) {
      const el = page.button(label);
      if (!el) throw new Error(`no button “${label}” on the page; it has: ${page.labels().join(" | ")}`);
      el.click();
      await until(() => el.getAttribute("aria-disabled") !== "true", `“${label}” to finish`);
      // A step that changes the screen from a status (the home) settles a moment later.
      await new Promise((r) => setTimeout(r, 10));
    },
    fill(id, value) {
      const input = root.querySelector(`#${id}`);
      if (!input) throw new Error(`no field #${id} on the page`);
      input.value = value;
    },
    alert: () => root.querySelector('[role="alert"]')?.textContent ?? "",
    status: () => root.querySelector(".account__status")?.textContent ?? "",
    /** The recovery code on the screen, as it is shown. */
    code: () => root.querySelector("[data-account-code]")?.textContent ?? null,
    /** Waits until the page shows `words`. */
    shows: (words) => until(() => root.textContent.includes(words), `the page to show “${words}”; it shows: ${page.text().slice(0, 400)}`),
  };
  page.ctx = await start({
    root,
    open,
    env: { fetch: b.w.fetch, credentials: b.creds, userAgent: b.userAgent, setTimer: b.timers.set, clearTimer: b.timers.clear, log: (...args) => b.logged.push(args), locale: "en-US" },
  });
  b.page = page;
  return page;
}

/** Saves the recovery code the page shows by typing its two groups back. Returns the code as shown. */
export async function saveCode(page) {
  const shown = page.code();
  if (!shown) throw new Error(`no recovery code on the page; it shows: ${page.text().slice(0, 300)}`);
  const groups = shown.split("-");
  await page.press("I’ve saved it");
  const asked = [...page.root.querySelectorAll("label")].map((label) => Number(/Group (\d)/.exec(label.textContent)?.[1]));
  page.fill("account-code-a", groups[asked[0] - 1]);
  page.fill("account-code-b", groups[asked[1] - 1]);
  await page.press("Finish");
  return shown;
}

/** Waits for the live browser's sync to settle in `state`. */
export const synced = (page, state = "upToDate") => until(() => page.ctx?.S.connector?.status().state === state, `the sync to reach ${state} (it is ${page.ctx?.S.connector?.status().state})`);

export { until };
