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

/** The channel every sheet editor listens on; each message names its sheet. */
export const EDITING_CHANNEL = "lit-sheet-editing";

/** How long a tab opening a sheet waits for the others to answer. */
export const ASK_WAIT_MS = 400;

const VERSION = 1;

/** A message to send: `who` (is anyone editing `sheet`?) or `here` (this tab is). */
export function editingMessage(type, tab, sheet) {
  return { v: VERSION, type, tab, sheet };
}

/**
 * A message another tab sent, checked: { type: "who" | "here", tab, sheet },
 * or null for anything else.
 */
export function readEditingMessage(data) {
  if (!data || typeof data !== "object" || data.v !== VERSION) return null;
  if (data.type !== "who" && data.type !== "here") return null;
  const ok = (s) => typeof s === "string" && s.length > 0 && s.length <= 200;
  if (!ok(data.tab) || !ok(data.sheet)) return null;
  return { type: data.type, tab: data.tab, sheet: data.sheet };
}

/**
 * What a tab does with a message it heard: "answer" a `who` about the sheet
 * one of its editors shows (`showing`, the ids it shows), "count" a `here`
 * about the sheet it is asking after (`asking`), else null. Its own messages
 * are never answered or counted.
 */
export function editingReply(msg, { tab, showing = [], asking = null }) {
  if (!msg || msg.tab === tab) return null;
  if (msg.type === "who" && showing.includes(msg.sheet)) return "answer";
  if (msg.type === "here" && msg.sheet === asking) return "count";
  return null;
}

/**
 * Whether a part's saved text moved under the reader: the card was drawn or
 * last saved as `drawn` (its module as JSON), the store now holds `stored`,
 * and focus is in the card. A part whose text fields are the same (only its
 * minutes, say, moved) needs no line.
 */
export function changedUnderReader(drawn, stored) {
  if (!drawn || !stored) return false;
  let before;
  try {
    before = JSON.parse(drawn);
  } catch {
    return false;
  }
  return TEXT_FIELDS.some((f) => (before?.[f] ?? "") !== (stored?.[f] ?? ""));
}

/** A part's fields typed into, which the line is about. */
export const TEXT_FIELDS = ["html", "answer"];
