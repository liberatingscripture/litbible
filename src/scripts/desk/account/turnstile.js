// src/scripts/desk/account/turnstile.js
//
// The check a new account passes first, where the service asks for one (the
// plan's step 4h; STUDY-DESK-ENCRYPTION.md, "Signing in"): Cloudflare
// Turnstile, the same widget the contact form uses. It is loaded only when
// `GET /sign-in` names a site key and the reader has pressed "Create an
// account," so signing in, and every other page, loads nothing from
// Cloudflare. public/_headers already allows the script and its frame.
//
// The token goes to the service once, with the request for a new passkey's
// options, and is kept nowhere.

const SCRIPT = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

function loadWidget(win) {
  if (win.turnstile?.render) return Promise.resolve(win.turnstile);
  return new Promise((resolve, reject) => {
    const script = win.document.createElement("script");
    script.src = SCRIPT;
    script.async = true;
    script.onload = () => (win.turnstile?.render ? resolve(win.turnstile) : reject(new Error("turnstile: the widget didn't start")));
    script.onerror = () => reject(Object.assign(new Error("turnstile: the widget couldn't be loaded"), { name: "Offline" }));
    win.document.head.append(script);
  });
}

/**
 * Shows the widget in `slot` and resolves to its token. `run` replaces the
 * widget in tests: `async ({ siteKey }) => token`.
 *
 * @param {{ siteKey: string, slot: Element, win?: Window, run?: (o: { siteKey: string }) => Promise<string> }} options
 * @returns {Promise<string>}
 */
export async function humanCheck({ siteKey, slot, win = window, run }) {
  if (run) return run({ siteKey });
  const widget = await loadWidget(win);
  slot.hidden = false;
  slot.replaceChildren();
  try {
    return await new Promise((resolve, reject) => {
      widget.render(slot, {
        sitekey: siteKey,
        action: "new-account",
        callback: (token) => resolve(token),
        "error-callback": () => reject(Object.assign(new Error("turnstile: the check failed"), { name: "AccountRefusal", word: "not_allowed", detail: { rule: "turnstile" } })),
      });
    });
  } finally {
    slot.hidden = true;
    slot.replaceChildren();
  }
}
