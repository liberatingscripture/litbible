// src/scripts/desk/desk-panes.js
//
// What each kind of pane on /desk draws (STUDY-DESK.md, D9; "Order of work",
// 3c to 3f). The kinds, their names and which of them follow the LIT pane are
// src/lib/desk-layout.mjs's; this says what fills a pane's body.
//
// Phase 3c builds the frame, and proves it by mounting one existing pane: My
// Notes, from the Notebook panel's own tab module (tab-mine.js), so the pane
// and the tab can't drift apart. The other kinds say they're still to come:
// the LIT text and Footnotes in 3e, This verse and Greek in 3d, the sheet in
// 3f. Each mount returns { destroy }, called when its pane closes or shows
// another kind.

import { createMineTab } from "./tab-mine.js";

const LATER = {
  lit: "The LIT text comes to this pane in a later step of the preview.",
  verse: "This verse comes to this pane in a later step of the preview. It will follow the LIT pane you last worked in.",
  greek: "The Greek comes to this pane in a later step of the preview. It will follow the LIT pane you last worked in.",
  footnotes: "The footnotes come to this pane in a later step of the preview. They will follow the LIT pane you last worked in.",
  sheet: "Sheets come to this pane in a later step of the preview.",
};

function message(body, text) {
  const p = document.createElement("p");
  p.className = "desk-pane__later";
  p.textContent = text;
  body.append(p);
  return { destroy() {} };
}

/**
 * Fill a pane's body with a kind.
 *
 * @param {string} kind
 * @param {HTMLElement} body
 * @param {{ store: object | null, storeError: unknown,
 *   onEdit: ((record: object, trigger: Element) => void) | null,
 *   ctx: () => { client: string, contentVersion: string } }} env
 * @returns {{ destroy: () => void }}
 */
export function mountPane(kind, body, env) {
  if (kind === "mine") {
    const tab = createMineTab({
      store: env.store,
      storeError: env.storeError,
      inReadView: false,
      // Drawn whenever it is on the page; a closed pane is taken off it.
      visible: () => body.isConnected,
      onEdit: env.onEdit,
      ctx: env.ctx,
    });
    body.append(tab.el);
    // The pane goes on the page right after this returns, and a tab draws
    // only once it is there.
    queueMicrotask(() => tab.render());
    const unsubscribe = env.store?.subscribe(() => tab.render());
    return { destroy: () => unsubscribe?.() };
  }
  if (LATER[kind]) return message(body, LATER[kind]);
  // A pane saved by a later version of the page, which this copy doesn't know.
  return message(body, "This pane needs a newer copy of the page. Reload to get it.");
}
