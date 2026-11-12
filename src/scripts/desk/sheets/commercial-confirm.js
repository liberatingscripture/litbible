// The confirmation before a commercial sheet leaves the Sheets page (E94;
// BVJ, 2026-11-11). S7's check warns in the editor's License card, which the
// page never shows, so a sheet could be printed past every line of it unseen.
// This asks once more at the moment the sheet goes out: Print, Copy, Save as,
// Share, and Present.
//
// It asks only when the sheet is marked “This is for a commercial project”
// and something goes past the commercial terms, in the License card's own
// words (`commercialFindings`). **It never blocks**: the box is the reader's
// own word, so a block would only stop the honest; the 50% is counted against
// the whole work, which a sheet may be one part of; and written permission
// allows more. Going ahead holds for this page view until the counts change,
// so a leader who prints and then copies is asked once.

import { commercialFindings } from "../../../lib/desk-sheet-lit.mjs";
import { buttons, make } from "../dom.js";

const button = buttons("desk-sheet__btn");
const BASE = String(import.meta.env.BASE_URL || "/").replace(/\/?$/, "/");

/**
 * @param {{ getSheet: () => object, counts: (sheet: object) => Promise<object> }} opts
 *   `counts` is sheet-lit.js's commercialCounts, handed in so a test can give its own.
 */
export function createCommercialGate({ getSheet, counts }) {
  let pending = null;
  let pendingFor = null;
  let accepted = "";

  /** Starts counting the sheet as it is now, so a press rarely waits. */
  function refresh() {
    const sheet = getSheet();
    pendingFor = sheet;
    pending = sheet?.commercial === true ? Promise.resolve().then(() => counts(sheet)) : null;
    // A failed count is told when a press reads it, never as an unhandled rejection.
    pending?.catch(() => {});
  }

  /**
   * Whether to go ahead with `verb` ("Print", "Copy"…). True at once for a
   * sheet not marked commercial, one within the terms, one the reader has
   * already gone ahead with at these counts, or one whose count failed (a
   * failure never costs the reader their copy).
   */
  async function ask(opener, verb) {
    const sheet = getSheet();
    if (sheet?.commercial !== true) return true;
    if (pendingFor !== sheet || !pending) refresh();
    let c;
    try {
      c = await pending;
    } catch (err) {
      console.error("Study Desk: the commercial check didn't finish", err);
      return true;
    }
    const over = commercialFindings(c).filter((f) => f.over);
    if (!over.length) return true;
    const key = JSON.stringify(c);
    if (key === accepted) return true;
    const go = await confirmCommercial(over, opener, verb);
    if (go) accepted = key;
    return go;
  }

  return { refresh, ask };
}

/**
 * The dialog: what goes past the terms, and "<verb> anyway" or Cancel. Focus
 * starts on Cancel; Escape and the × cancel. Resolves true to go ahead.
 */
export function confirmCommercial(findings, opener, verb) {
  return new Promise((resolve) => {
    const dialog = make("dialog", "sheets-page__dialog sheets-page__commercial");
    dialog.setAttribute("aria-labelledby", "sheet-commercial-title");
    dialog.setAttribute("aria-describedby", "sheet-commercial-lead sheet-commercial-list");
    const h = make("h2", null, "This sheet goes beyond the commercial terms");
    h.id = "sheet-commercial-title";
    const lead = make("p", "sheets-page__dialog-note", "You marked this sheet “This is for a commercial project,” and its check found:");
    lead.id = "sheet-commercial-lead";
    const list = make("ul", "sheets-page__commercial-list");
    list.id = "sheet-commercial-list";
    for (const f of findings) list.append(make("li", null, f.text));

    const note = make("p", "sheets-page__dialog-note");
    if (findings.some((f) => f.kind === "share")) {
      note.append(document.createTextNode("The 50% is counted against the whole work, so a sheet that is one part of a larger work may still be within it. "));
    }
    note.append(document.createTextNode("Anything beyond the terms needs written permission: "));
    const contact = make("a", null, "contact the LIT");
    contact.href = `${BASE}contact/`;
    contact.target = "_blank";
    contact.rel = "noopener";
    contact.setAttribute("aria-label", "contact the LIT (opens in a new tab)");
    const terms = make("a", null, "Read the license terms");
    terms.href = `${BASE}read/#license-terms`;
    terms.target = "_blank";
    terms.rel = "noopener";
    terms.setAttribute("aria-label", "Read the license terms (opens in a new tab)");
    note.append(contact, document.createTextNode(" about your project. "), terms, document.createTextNode("."));

    const go = button(`${verb} anyway`);
    const cancel = button("Cancel");
    const x = button("×", "lit-panel__close sheets-page__dialog-x");
    x.setAttribute("aria-label", "Close");
    const row = make("div", "sheets-page__dialog-actions");
    row.append(go, cancel);
    dialog.append(x, h, lead, list, note, row);
    document.body.append(dialog);

    // Answered inside the press itself, never from the dialog's `close` event,
    // which comes a task later: Safari lets a copy or full screen start only
    // from a fresh press, and "Copy anyway" is that press.
    let settled = false;
    const finish = (yes) => {
      if (settled) return;
      settled = true;
      if (dialog.open) dialog.close();
      dialog.remove();
      if (opener?.isConnected) opener.focus();
      resolve(yes);
    };
    go.addEventListener("click", () => finish(true));
    for (const b of [x, cancel]) b.addEventListener("click", () => finish(false));
    // Escape, and anything else that closes it.
    dialog.addEventListener("close", () => finish(false));
    dialog.showModal();
    cancel.focus();
  });
}
