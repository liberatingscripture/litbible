// src/scripts/desk/diff-view.js
//
// What changed in the LIT's wording, drawn word by word: the change notice on
// a reader's mark (change-notice.js, N3) and a sheet's passage that changed
// since it was added (sheet-lit.js, S2) both show it this way, so a change
// looks the same wherever it is reported. The runs come from desk-wording.mjs
// (wordingDiff), trimmed to the words around each change by desk-change.mjs
// (excerptDiff). The look is `.desk-notice__diff` in desk.css.

import { excerptDiff } from "../../lib/desk-change.mjs";

function el(tag, className, text) {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (text != null) e.textContent = text;
  return e;
}

/**
 * The diff as a paragraph: unchanged words as they read, deleted words struck
 * through, added words underlined, each with a hidden "Removed:" or "Added:"
 * for a screen reader (the pattern of the release notes page). Null when
 * there is nothing to show.
 *
 * @param {Array<{ op: string, text: string, lead: string }>} diff wordingDiff's runs
 */
export function diffParagraph(diff) {
  const runs = excerptDiff(diff ?? []);
  if (!runs.length) return null;
  const p = el("p", "desk-notice__diff");
  for (const run of runs) {
    if (run.lead) p.append(run.lead);
    if (run.op === "same") {
      p.append(run.text);
      continue;
    }
    const mark = el(run.op === "del" ? "del" : "ins");
    mark.append(el("span", "sr-only", run.op === "del" ? "Removed: " : "Added: "), run.text);
    p.append(mark);
  }
  return p;
}
