// src/lib/desk-sheet-tabs.mjs
//
// Two tabs on one sheet (STUDY-DESK.md, S12, part 4; BVJ, 2026-11-08):
// the rules behind the question a second tab asks before it edits a sheet,
// and the line a part shows when its saved text moves while it is typed in.
// Pure; the page side is `sheet-editor.js` and `sheet-tabs.js`.
//
// - **A tab asks, and the tabs editing that sheet answer.** An editor opening
//   a sheet sends `who` with the sheet's id on `EDITING_CHANNEL`; every tab
//   whose editor shows that sheet answers `here`. A tab that answers nothing
//   in `ASK_WAIT_MS` isn't counted, so a tab that crashed, or one the browser
//   froze in the background, never blocks the question with a "yes", which
//   is why no heartbeat is needed: nothing is remembered between questions.
// - **Only editing counts**: a tab printing or presenting the sheet holds no
//   editor, so it neither asks nor answers.
// - Several editors in one tab (two Sheets panes) share its `tab` id, and a
//   tab never counts its own answers.
// - **Two tabs opening one sheet at once ask each other** (Audit 8, DI8-8):
//   a tab still asking answers a `who` about the same sheet with a `here`
//   marked `asking`. When each heard the other's `who`, only the tab with the
//   larger id counts the other's answer, so exactly one of the two shows the
//   question; when only one heard (the other began
//   asking after the first `who` went by), the one that didn't hear counts it.

/** The channel every sheet editor listens on; each message names its sheet. */
export const EDITING_CHANNEL = "lit-sheet-editing";

/** How long a tab opening a sheet waits for the others to answer. */
export const ASK_WAIT_MS = 400;

const VERSION = 1;

/**
 * A message to send: `who` (is anyone editing `sheet`?) or `here` (this tab
 * is). A `here` from a tab that is itself still asking carries `asking`.
 */
export function editingMessage(type, tab, sheet, { asking = false } = {}) {
  return asking && type === "here" ? { v: VERSION, type, tab, sheet, asking: true } : { v: VERSION, type, tab, sheet };
}

/**
 * A message another tab sent, checked: { type: "who" | "here", tab, sheet },
 * with `asking: true` on a `here` from a tab still asking, or null for
 * anything else.
 */
export function readEditingMessage(data) {
  if (!data || typeof data !== "object" || data.v !== VERSION) return null;
  if (data.type !== "who" && data.type !== "here") return null;
  const ok = (s) => typeof s === "string" && s.length > 0 && s.length <= 200;
  if (!ok(data.tab) || !ok(data.sheet)) return null;
  const msg = { type: data.type, tab: data.tab, sheet: data.sheet };
  if (data.type === "here" && data.asking === true) msg.asking = true;
  return msg;
}

/**
 * What a tab does with a message it heard: "answer" a `who` about the sheet
 * one of its editors shows (`showing`, the ids it shows); "answer-asking" a
 * `who` about the sheet it is itself asking after (`asking`), so two tabs
 * opening it together don't both miss each other (DI8-8); "count" a `here`
 * about the sheet it is asking after, else null. A `here` marked `asking` is
 * counted unless this tab heard that tab's `who` too (`heard`, the tabs whose
 * `who` it answered while asking) and has the smaller id, so of two tabs that
 * heard each other only the one with the larger id asks. Its own messages are never answered or
 * counted.
 */
export function editingReply(msg, { tab, showing = [], asking = null, heard = [] }) {
  if (!msg || msg.tab === tab) return null;
  if (msg.type === "who" && showing.includes(msg.sheet)) return "answer";
  if (msg.type === "who" && msg.sheet === asking) return "answer-asking";
  if (msg.type === "here" && msg.sheet === asking) {
    if (msg.asking && heard.includes(msg.tab) && tab < msg.tab) return null;
    return "count";
  }
  return null;
}

/**
 * A part's typed fields when its saved text moved while focus was in its
 * card (Audit 8, SH8-2): each of `fields` is { name, shown, busy }, `shown`
 * the text that field last loaded or saved and `busy` whether the reader is
 * in it (focus, or typing not yet saved). A field whose stored text is what
 * it shows is left alone; one that moved and isn't busy is loaded with the
 * stored text (`load`), since nothing the reader typed there is lost; one
 * that moved while busy keeps the reader's words and gets the line
 * (`conflict`). So the line is only ever about the field being typed in, and
 * a field the other tab changed beside it shows that change at once.
 *
 * @returns {{ load: string[], conflict: string[] }}
 */
export function movedUnderReader(fields, stored) {
  const load = [];
  const conflict = [];
  for (const { name, shown, busy } of fields) {
    if ((stored?.[name] ?? "") === (shown ?? "")) continue;
    (busy ? conflict : load).push(name);
  }
  return { load, conflict };
}

/**
 * Which of a part's fields "Keep mine" writes (SH8-2): those whose text in
 * this tab (`mine`, field → html) differs from the other tab's (`theirs`, the
 * module), never every field, so a field this tab didn't change can't put an
 * older text back over the other tab's.
 */
export function keptFields(mine, theirs) {
  return Object.fromEntries(Object.entries(mine).filter(([f, html]) => html !== (theirs?.[f] ?? "")));
}

/**
 * The newer of two copies of one sheet (by `modified`, which every write
 * steps past the one it replaces), or the one there is; `a` when the two
 * aren't copies of one sheet. A closing tab writes
 * what hasn't landed over the newest copy it has heard of (Audit 8, DI8-4).
 */
export function newerSheet(a, b) {
  if (!a || !b || a.id !== b.id) return a ?? b ?? null;
  return Date.parse(b.modified) > Date.parse(a.modified) ? b : a;
}
