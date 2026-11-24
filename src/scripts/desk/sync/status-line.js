// src/scripts/desk/sync/status-line.js
//
// The synced notebook's status line and "Reconnect" (the plan's step 4g): as
// much screen as the status needs, and no more. The account pages are step
// 4h's.
//
// A desk page leaves a place for it: an empty element marked
// `data-desk-sync-slot` (the Notebook's Settings tab and the notebook page
// have one each), and a page that makes or shows one says so with SLOT_EVENT.
// An unlinked browser never loads this file, so the slot stays empty and
// hidden there. The words are src/lib/desk-sync-status.mjs.
//
// A stop that needs the reader is also said where they are, without their
// opening Settings: ./stopped-notice.js.

import syncCss from "../../../styles/desk-sync.css?inline";
import { SLOT_EVENT } from "../../../lib/desk-sync-link.mjs";
import { statusWords, worthSaying } from "../../../lib/desk-sync-status.mjs";

let seq = 0;

/** The sync's own rules, once a page: this file's line and the stopped notice's dot. */
export function addSyncStyle(doc = globalThis.document) {
  if (!doc?.head || doc.querySelector("style[data-desk-sync-style]")) return;
  const style = doc.createElement("style");
  style.setAttribute("data-desk-sync-style", "");
  style.textContent = syncCss;
  doc.head.append(style);
}

const format = {
  time: (iso) => new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(new Date(iso)),
  day: (iso) => new Intl.DateTimeFormat(undefined, { month: "long", day: "numeric" }).format(new Date(iso)),
};

/**
 * Draws the connector's status into every slot on the page, and keeps it
 * drawn. Returns the way to take it all off again.
 *
 * @param {{ status: () => object, subscribe: (fn: (s: object) => void) => () => void, syncNow: () => Promise<void> }} connector
 * @param {{ doc?: Document, log?: (...args: unknown[]) => void }} [env]
 */
export function mountStatusLines(connector, { doc = globalThis.document, log = (...args) => console.error("Study Desk sync:", ...args) } = {}) {
  if (!doc?.querySelectorAll) return () => {};
  addSyncStyle(doc);
  /** slot → its parts */
  const lines = new Map();
  let said = null;

  function build(slot) {
    const n = ++seq;
    const root = doc.createElement("div");
    root.className = "desk-sync";
    root.setAttribute("role", "group");
    root.setAttribute("aria-labelledby", `deskSyncLabel-${n}`);

    const label = doc.createElement("p");
    label.className = "desk-sync__label";
    label.id = `deskSyncLabel-${n}`;
    label.textContent = "Sync";

    const line = doc.createElement("p");
    line.className = "desk-sync__line";

    const detail = doc.createElement("ul");
    detail.className = "desk-sync__detail";
    detail.hidden = true;

    const again = doc.createElement("button");
    again.type = "button";
    again.className = "desk-sync__again";
    again.hidden = true;
    again.addEventListener("click", () => {
      // Busy, not disabled: the button keeps focus while the pass runs.
      if (again.getAttribute("aria-disabled") === "true") return;
      again.setAttribute("aria-disabled", "true");
      connector.syncNow().catch((err) => log("“Reconnect” failed", err));
    });

    // What a screen reader hears when the state changes, in the line's own
    // place: a line the reader can't see (another tab of the Notebook is
    // showing) says nothing, as it shows nothing.
    const say = doc.createElement("p");
    say.className = "sr-only";
    say.setAttribute("role", "status");

    root.append(label, line, detail, again, say);
    slot.replaceChildren(root);
    slot.hidden = false;
    lines.set(slot, { root, line, detail, again, say });
  }

  function draw(status) {
    // A slot made since the last look (a tab of the Notebook built late) is found here too.
    for (const slot of doc.querySelectorAll("[data-desk-sync-slot]")) if (!lines.has(slot)) build(slot);
    const words = statusWords(status, format);
    const speak = worthSaying(said, status);
    if (speak) said = { state: status.state, pending: status.pending };
    for (const parts of lines.values()) {
      parts.root.dataset.state = words.ok ? "ok" : words.busy ? "busy" : "stopped";
      parts.line.textContent = words.line;
      parts.detail.replaceChildren(
        ...words.detail.map((text) => {
          const li = doc.createElement("li");
          li.textContent = text;
          return li;
        }),
      );
      parts.detail.hidden = words.detail.length === 0;
      if (words.action) {
        parts.again.textContent = words.action;
        parts.again.hidden = false;
        parts.again.removeAttribute("aria-disabled");
      } else if (words.busy && !parts.again.hidden) {
        // A pass the button started: it stays, busy, so focus has somewhere to be.
        parts.again.setAttribute("aria-disabled", "true");
      } else {
        // Up to date. If the reader's focus was on the button, it moves to the line that now says so.
        if (doc.activeElement === parts.again) {
          parts.line.tabIndex = -1;
          parts.line.focus();
        }
        parts.again.hidden = true;
      }
      if (speak) parts.say.textContent = [words.line, ...words.detail].join(" ");
    }
  }

  const redraw = () => draw(connector.status());
  doc.addEventListener(SLOT_EVENT, redraw);
  const off = connector.subscribe(draw);
  redraw();

  return () => {
    off();
    doc.removeEventListener(SLOT_EVENT, redraw);
    for (const slot of lines.keys()) {
      slot.replaceChildren();
      slot.hidden = true;
    }
    lines.clear();
  };
}
