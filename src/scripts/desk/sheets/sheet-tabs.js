// src/scripts/desk/sheets/sheet-tabs.js
//
// Which other tabs are editing a sheet (STUDY-DESK.md, S12, part 4): one
// channel for the tab, shared by every editor in it. The rules are
// `src/lib/desk-sheet-tabs.mjs`.

import {
  ASK_WAIT_MS,
  EDITING_CHANNEL,
  editingMessage,
  editingReply,
  readEditingMessage,
} from "../../../lib/desk-sheet-tabs.mjs";

const TAB = globalThis.crypto?.randomUUID?.() ?? `tab-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;

let channel = null;
/** Each editor in this tab, as a function returning the sheet id it shows (or null). */
const editors = new Set();
/** The questions this tab is waiting on: sheet id → the function an answer calls. */
const waiting = new Map();

function open() {
  if (channel || typeof BroadcastChannel !== "function") return channel;
  channel = new BroadcastChannel(EDITING_CHANNEL);
  channel.onmessage = (e) => {
    const msg = readEditingMessage(e.data);
    const showing = [...editors].map((fn) => fn()).filter(Boolean);
    for (const asking of [null, ...waiting.keys()]) {
      const reply = editingReply(msg, { tab: TAB, showing, asking });
      if (reply === "answer") channel.postMessage(editingMessage("here", TAB, msg.sheet));
      if (reply === "count") waiting.get(asking)?.();
      if (reply) break;
    }
  };
  return channel;
}

/**
 * Count an editor in this tab: `showing()` is the id of the sheet it shows,
 * or null while it shows the list or a sheet not yet written. Returns the way
 * to stop.
 */
export function addEditor(showing) {
  open();
  editors.add(showing);
  return () => editors.delete(showing);
}

/**
 * Whether another tab's editor shows the sheet `id`: asks, and resolves true
 * on the first answer or false once none has come in ASK_WAIT_MS.
 */
export function editedElsewhere(id) {
  const ch = open();
  if (!ch) return Promise.resolve(false);
  return new Promise((resolve) => {
    const done = (answer) => {
      clearTimeout(timer);
      if (waiting.get(id) === heard) waiting.delete(id);
      resolve(answer);
    };
    const heard = () => done(true);
    const timer = setTimeout(() => done(false), ASK_WAIT_MS);
    waiting.set(id, heard);
    ch.postMessage(editingMessage("who", TAB, id));
  });
}
