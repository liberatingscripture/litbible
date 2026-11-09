// test/helpers/browser-env.mjs
//
// A browser for Node tests of the desk's DOM code (Audit 8: tests that drive
// the code rather than read its source). Importing this file installs a
// happy-dom window as the globals a browser module expects (`document`,
// `window`, `HTMLElement`, `CSS`, `requestAnimationFrame`, …) and registers
// vite-hooks.mjs, so `import.meta.env` and stylesheet imports load in Node.
// Import it before the module under test, which then has to be imported with
// `await import(...)` so the hooks are in place first.
//
//   import { settle, resetDom } from "./helpers/browser-env.mjs";
//   const { createKeptList } = await import("../src/scripts/desk/kept-list.js");
//
// It is not a full browser: no layout (sizes are 0), no IndexedDB (use
// fake-indexeddb, or a fake store), and focus moves only by `.focus()`.

import { register } from "node:module";
import { GlobalWindow } from "happy-dom";

register("./vite-hooks.mjs", import.meta.url);

export const window = new GlobalWindow({ url: "http://localhost/", settings: { disableCSSFileLoading: true, disableJavaScriptFileLoading: true } });

// Every window property Node's global object lacks, its own and its classes'
// (as @happy-dom/global-registrator does).
const names = new Set();
for (let o = window; o && o !== Object.prototype; o = Object.getPrototypeOf(o)) {
  for (const key of Object.getOwnPropertyNames(o)) names.add(key);
}
for (const key of names) {
  if (key === "constructor") continue;
  if (key in globalThis || key === "undefined" || key === "NaN" || key === "Infinity") continue;
  try {
    Object.defineProperty(globalThis, key, { value: window[key], configurable: true, writable: true });
  } catch {
    // A read-only Node global keeps Node's own.
  }
}
for (const key of ["document", "window", "navigator", "location", "history", "localStorage", "sessionStorage", "getComputedStyle", "requestAnimationFrame", "cancelAnimationFrame", "matchMedia", "CSS", "Event", "CustomEvent", "KeyboardEvent", "MouseEvent", "FocusEvent", "InputEvent"]) {
  if (window[key] === undefined) continue;
  Object.defineProperty(globalThis, key, { value: key === "window" ? window : window[key], configurable: true, writable: true });
}
globalThis.window = window;
// happy-dom has no `Option` constructor; the desk builds selects with it.
if (typeof globalThis.Option !== "function") {
  globalThis.Option = function Option(text = "", value, defaultSelected = false, selected = false) {
    const o = document.createElement("option");
    o.textContent = text;
    if (value !== undefined) o.value = value;
    o.defaultSelected = defaultSelected;
    o.selected = selected;
    return o;
  };
  window.Option = globalThis.Option;
}
window.CSS ??= {};
window.CSS.escape ??= (s) => String(s).replace(/[^a-zA-Z0-9_-]/g, (c) => `\\${c}`);
globalThis.CSS = window.CSS;

/** Lets pending promises, timers up to `ms`, and animation frames run. */
export async function settle(ms = 0) {
  await new Promise((r) => setTimeout(r, ms));
  await new Promise((r) => window.requestAnimationFrame(() => r()));
  await new Promise((r) => setTimeout(r, 0));
}

/** An empty body and a fresh address, between tests. */
export function resetDom(url = "http://localhost/") {
  document.body.innerHTML = "";
  window.happyDOM.setURL(url);
}
