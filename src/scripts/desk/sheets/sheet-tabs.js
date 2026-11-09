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
/**
 * The questions this tab is waiting on: sheet id → { heard, answer, done }:
 * the tabs asking about the same sheet whose `who` it answered (DI8-8), the
 * function an answer calls, and the question's promise, which a second editor
 * here asking about that sheet meanwhile shares (Audit 8, SH8-8).
 */
const waiting = new Map();

function open() {
  if (channel || typeof BroadcastChannel !== "function") return channel;
  channel = new BroadcastChannel(EDITING_CHANNEL);
  channel.onmessage = (e) => {
    const msg = readEditingMessage(e.data);
    if (!msg) return;
    const showing = [...editors].map((fn) => fn()).filter(Boolean);
    if (editingReply(msg, { tab: TAB, showing }) === "answer") {
      channel.postMessage(editingMessage("here", TAB, msg.sheet));
      return;
    }
    const ask = waiting.get(msg.sheet);
    if (!ask) return;
    const reply = editingReply(msg, { tab: TAB, asking: msg.sheet, heard: [...ask.heard] });
    if (reply === "answer-asking") {
      ask.heard.add(msg.tab);
      channel.postMessage(editingMessage("here", TAB, msg.sheet, { asking: true }));
    }
    if (reply === "count") ask.answer();
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
 * on the first answer or false once none has come in ASK_WAIT_MS. Two editors
 * here asking about one sheet at once share the question.
 */
export function editedElsewhere(id) {
  const ch = open();
  if (!ch) return Promise.resolve(false);
  const already = waiting.get(id);
  if (already) return already.done;
  let ask;
  const done = new Promise((resolve) => {
    const finish = (answer) => {
      clearTimeout(timer);
      if (waiting.get(id) === ask) waiting.delete(id);
      resolve(answer);
    };
    const timer = setTimeout(() => finish(false), ASK_WAIT_MS);
    ask = { heard: new Set(), answer: () => finish(true) };
  });
  ask.done = done;
  waiting.set(id, ask);
  ch.postMessage(editingMessage("who", TAB, id));
  return done;
}
