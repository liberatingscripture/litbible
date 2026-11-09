// src/scripts/desk/sheets/part-cards.js
//
// What each part's card holds (Audit 6, LG6-2, taken out of
// `createSheetEditor` as my-sheets.js and add-forms.js were): the body of a
// passage, text, question, space, page break or key terms box, and the two
// controls in a card's header that change the part itself (planned minutes,
// Leader only). The card around them, its Move and Remove buttons, dragging
// and the gap under it stay the editor's (`buildCard`), handed in as `host`:
//
// - `readOnly()` and `sheet()`, read when a card is built or acts, since the
//   editor moves between sheets;
// - `change(op, options)`, `opCtx()` and `say(text)`, as the editor has them;
// - `idSuffix`, which keeps the editors' ids apart;
// - `showPassage`, the host's way to a LIT pane, or null (no "Show in the LIT").

import { sheetHtmlForShow } from "../../../lib/desk-sheet-copy.mjs";
import { SHEET_LIMITS } from "../../../lib/desk-sheet-format.mjs";
import { moveModule, updateModule } from "../../../lib/desk-sheets.mjs";
import { keyTermsPlacement } from "../../../lib/desk-sheet-templates.mjs";
import { createKeyTermsBody, createPassageBody } from "./sheet-lit.js";
import { createSheetText } from "./sheet-text.js";
import { make } from "../dom.js";
// The editor imports this file too; `button` and `describe` are function
// declarations, so the cycle is safe whichever file loads first.
import { button, describe } from "./sheet-editor.js";

/** A module's prompt field (`prompt` or `answerPrompt`), when it is usable text. */
export const promptOf = (m, field) => (typeof m?.[field] === "string" ? m[field].trim() : "");

/**
 * A card's header controls for the part itself: its planned minutes (Audit 5,
 * D #2) and Leader only. None for a page break, which is on both versions:
 * a break on the leader's printout alone is meaningful but puzzling in a
 * box, so it isn't offered (SH5-17). `name` is the card's kind, `called`
 * what the gap names the part (a text part's heading, else its kind).
 */
export function cardTools(host, m, { name, called }) {
  if (m.type === "pageBreak") return [];
  const { change, opCtx, say } = host;
  // Planned minutes: the leader's own, counted down in the presenter view
  // and totaled on the leader's version. Saved on change, not on every
  // keystroke, so a half-typed number isn't kept.
  const mins = make("label", "desk-sheet__minutes");
  const field = make("input");
  field.type = "number";
  field.min = "1";
  field.max = String(SHEET_LIMITS.minutes);
  field.step = "1";
  field.inputMode = "numeric";
  field.placeholder = "–";
  field.value = m.minutes ?? "";
  field.setAttribute("aria-label", `Minutes planned for ${called}`);
  field.addEventListener("change", () => {
    const n = field.value.trim() === "" ? undefined : Math.round(Number(field.value));
    const ok = n === undefined || (Number.isFinite(n) && n >= 1 && n <= SHEET_LIMITS.minutes);
    if (!ok) {
      field.value = m.minutes ?? "";
      say(`Minutes are a whole number from 1 to ${SHEET_LIMITS.minutes}.`);
      return;
    }
    change((s) => updateModule(s, m.id, { minutes: n }, opCtx()), {
      source: m.id,
      announce: n ? `${called}: ${n} ${n === 1 ? "minute" : "minutes"} planned.` : `${called}: no time planned.`,
    });
  });
  mins.append(field, make("span", null, "min"));
  mins.title = "Minutes you plan for this part: counted down in the presenter view and totaled on the leader’s version";
  const leader = make("label", "desk-sheet__leader");
  const box = make("input");
  box.type = "checkbox";
  box.checked = m.leaderOnly === true;
  box.addEventListener("change", () => {
    change((s) => updateModule(s, m.id, { leaderOnly: box.checked || undefined }, opCtx()), {
      source: m.id,
      announce: box.checked ? `${name}: on the leader’s version only.` : `${name}: on every version.`,
    });
  });
  leader.append(box, make("span", null, "Leader only"));
  leader.title = "Print and present this on the leader’s version only";
  return [mins, leader, describe(box, "Prints and presents this on the leader’s version only.")];
}

/**
 * Puts a part's body in its card, after the header, and returns the card's
 * instance (focus, hasFocus, flush, destroy, sheetChanged, and `fields` for a
 * text or question part, which the two-tab line reads), or null.
 */
export function cardBody(host, card, m) {
  if (m.type === "passage") return passageCard(host, card, m);
  if (m.type === "text") return textCard(host, card, m);
  if (m.type === "question") return questionCard(host, card, m);
  if (m.type === "space") return spaceCard(host, card, m);
  if (m.type === "keyTerms") return keyTermsCard(host, card, m);
  if (m.type === "pageBreak") card.append(make("div", "desk-sheet__break", "A new page starts here when printed."));
  else card.append(make("p", "desk-sheet__status", "This part was made by a newer version of the LIT. It is kept as it is; reload the page to see it."));
  return null;
}

/** The change to one part's fields, with an announcement or none. */
const updater = (host, m) => (fields, announce) => host.change((s) => updateModule(s, m.id, fields, host.opCtx()), { announce });

function passageCard(host, card, m) {
  const body = make("div");
  card.append(body);
  if (host.showPassage) {
    const go = button("Show in the LIT", "desk-sheet__btn desk-sheet__btn--quiet desk-sheet__show");
    go.addEventListener("click", () => host.showPassage({ bookKey: m.bookKey, chapter: m.chapter, verse: m.verse }));
    card.querySelector(".desk-sheet__module-tools").prepend(go);
  }
  const inst = createPassageBody({
    m,
    readOnly: host.readOnly(),
    getSheet: host.sheet,
    update: updater(host, m),
    fill: (fields) => host.change((s) => updateModule(s, m.id, fields, host.opCtx()), { quiet: true }),
    say: host.say,
  });
  body.replaceWith(inst.el);
  return inst;
}

function keyTermsCard(host, card, m) {
  const inst = createKeyTermsBody({
    m,
    readOnly: host.readOnly(),
    getSheet: host.sheet,
    update: updater(host, m),
  });
  // Before or after the reading, decided sheet by sheet in one click (BVJ,
  // 2026-11-08): the group meets the words first, or the passage speaks
  // first. Redrawn on every change, since a move doesn't rebuild the card.
  const place = make("div", "desk-sheet__terms-place");
  const placeButtons = () => {
    const where = host.readOnly() ? null : keyTermsPlacement(host.sheet());
    const keep = place.contains(document.activeElement) ? document.activeElement.dataset.side : null;
    place.replaceChildren();
    place.hidden = !where;
    if (!where) return;
    for (const side of ["before", "after"]) {
      if (where.side === side) continue;
      const b = button(side === "before" ? "Move before the reading" : "Move after the reading", "desk-sheet__btn desk-sheet__btn--quiet");
      b.dataset.side = side;
      b.addEventListener("click", () => {
        const to = keyTermsPlacement(host.sheet())?.[side];
        if (to === undefined) return;
        host.change((s) => moveModule(s, m.id, to, host.opCtx()), {
          announce: side === "before" ? "Key terms box moved before the reading." : "Key terms box moved after the reading.",
          after: () => place.querySelector("button")?.focus(),
        });
      });
      place.append(b);
    }
    if (keep) (place.querySelector(`[data-side="${keep}"]`) ?? place.querySelector("button"))?.focus();
  };
  placeButtons();
  card.append(place, inst.el);
  return {
    ...inst,
    sheetChanged: () => {
      placeButtons();
      inst.sheetChanged?.();
    },
  };
}

function textField(host, m, field, label, placeholder) {
  return createSheetText({
    html: m[field] ?? "",
    label,
    placeholder,
    idPrefix: `deskSheet-${host.idSuffix}-${m.id}-${field}`,
    onChange: (html) => host.change((s) => updateModule(s, m.id, { [field]: html }, host.opCtx()), { source: m.id }),
  });
}

/** Several editors and fields as one card's instance. */
function group(...insts) {
  return {
    focus: () => insts[0]?.focus?.(),
    hasFocus: () => insts.some((i) => i.hasFocus?.()),
    flush: () => insts.forEach((i) => i.flush?.()),
    destroy: () => insts.forEach((i) => i.destroy?.()),
  };
}

function textCard(host, card, m) {
  if (host.readOnly()) return readOnlyRich(card, m.html);
  const ed = textField(host, m, "html", "Your text", promptOf(m, "prompt") || "A heading, instructions, a prayer, or anything else to print.");
  // The prompt under a heading goes with the first word typed after it,
  // not only once that typing is saved and draw() runs (SH5-4).
  const box = ed.el.querySelector(".desk-rich");
  box?.addEventListener("input", () => {
    if (!box.hasAttribute("data-hint")) return;
    const heading = box.querySelector("h1, h2, h3, h4, h5, h6");
    if (box.textContent.trim() === (heading?.textContent.trim() ?? "")) return;
    delete box.dataset.hint;
    box.removeAttribute("aria-description");
  });
  card.append(ed.el);
  // The fields typed into, for the line when another tab changes them (S12, part 4).
  return Object.assign(ed, { fields: { html: ed } });
}

function readOnlyRich(card, html) {
  const box = make("div", "desk-rich");
  // A read-only sheet is one in a newer format, which validateSheet never
  // checked, so its html is drawn only through the sanitizer (BA66).
  box.innerHTML = sheetHtmlForShow(html);
  card.append(box);
  return null;
}

function linesField(host, m, { min, max, label }) {
  const wrap = make("label", "desk-sheet__lines");
  const input = make("input");
  input.type = "number";
  input.min = String(min);
  input.max = String(max);
  input.value = String(m.lines ?? min);
  input.disabled = host.readOnly();
  input.addEventListener("change", () => {
    const n = Math.round(Number(input.value));
    if (!Number.isFinite(n)) return;
    const lines = Math.min(max, Math.max(min, n));
    input.value = String(lines);
    host.change((s) => updateModule(s, m.id, { lines }, host.opCtx()), { source: m.id });
  });
  wrap.append(make("span", null, label), input);
  return { el: wrap, hasFocus: () => document.activeElement === input };
}

function questionCard(host, card, m) {
  if (host.readOnly()) {
    readOnlyRich(card, m.html);
    return null;
  }
  const q = textField(host, m, "html", "Question", promptOf(m, "prompt") || "A question for the group, such as “What surprised you here?”");
  const a = textField(host, m, "answer", "Answer, on the leader’s version only", promptOf(m, "answerPrompt") || "Optional. An answer or notes for you as leader. It prints only on the leader’s version.");
  const lines = linesField(host, m, { min: 0, max: SHEET_LIMITS.questionLines, label: "Lines to write on" });
  // The two editors look alike, and the answer's ghost text goes once it has
  // words, so it keeps a visible label (BVJ, 2026-11-06). The editor's own
  // accessible name already says this, so the label is hidden from it.
  const answerLabel = make("p", "desk-sheet__field-label", "Answer (leader’s version only)");
  answerLabel.setAttribute("aria-hidden", "true");
  card.append(q.el, answerLabel, a.el, lines.el);
  return Object.assign(group(q, a, lines), { fields: { html: q, answer: a } });
}

function spaceCard(host, card, m) {
  const lines = linesField(host, m, { min: 1, max: SHEET_LIMITS.spaceLines, label: "Lines to write on" });
  const ruled = make("div", "desk-sheet__ruled");
  ruled.style.setProperty("--lines", String(Math.min(m.lines ?? 4, 6)));
  ruled.setAttribute("aria-hidden", "true");
  card.append(lines.el, ruled);
  return lines;
}
