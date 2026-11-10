// src/scripts/desk/sheets/sheet-cards.js
//
// A sheet's parts as cards in the sheet editor (STUDY-DESK.md, S1): the card
// around each part's body (its header with Move and Remove, the gap under it
// with its "Add" pill), dragging cards into order, and keeping the cards in
// line with the sheet as it changes, rebuilding only a card whose part
// changed and never the one being typed in. Cut from sheet-editor.js (Audit
// 8, LG8-8), which hands in, as `host`, what a card needs from it: the sheet
// and whether it can be changed, the open passage form, the moves and the
// removal, the gap's menu and the line on a part changed in another tab.
// What each kind of part holds is part-cards.js (`cardBody`, `cardTools`),
// given the editor's `cardHost`.
//
// No module imports sheet-editor.js (LG8-6), so what both need lives here:
// `TYPE_NAMES` and `headingOf`.

import { MODULE_TYPES } from "../../../lib/desk-sheet-format.mjs";
import { movedUnderReader } from "../../../lib/desk-sheet-tabs.mjs";
import { passageLabel, passageReference } from "../../../lib/desk-sheet-passages.mjs";
import { buttons, make } from "../dom.js";
import { cardBody, cardTools, promptOf } from "./part-cards.js";

const button = buttons("desk-sheet__btn");

/** What each kind of part is called. */
export const TYPE_NAMES = {
  passage: "Passage",
  text: "Text",
  question: "Question",
  space: "Space to write",
  keyTerms: "Key terms box",
  pageBreak: "Page break",
};

/** A text part holding one heading and nothing else. */
const LONE_HEADING = /^<h[1-6]>[^<]*<\/h[1-6]>$/;

/** A text part's opening heading ("Opening", "The text"), or null: what the gap's pill and its form call the part. */
export const headingOf = (m) => (m?.type === "text" && typeof m.html === "string" && /^<h[1-6]>([^<]*)<\/h[1-6]>/.exec(m.html)?.[1]?.replace(/\s+/g, " ").trim()) || null;

/**
 * The prompt a text part shows under its heading (SH5-2, SH5-4): its own
 * `prompt` while its text is exactly one heading and the part after it isn't
 * a passage (which fills it, as the reading part's passage does); else "".
 * An empty part shows its prompt as the placeholder instead.
 */
function headingPrompt(m, next) {
  if (m?.type !== "text" || typeof m.html !== "string" || !LONE_HEADING.test(m.html)) return "";
  if (next?.type === "passage") return "";
  return promptOf(m, "prompt");
}

const json = (x) => JSON.stringify(x);
/** What a card's head shows, which a body's in-place update doesn't redraw. */
const headKey = (m) => json([m.type, m.leaderOnly === true, m.minutes ?? null, m.type === "passage" ? passageReference(m) : null]);
/** The part of it the head can't redraw in place (`setHead` shows the rest). */
const fixedKey = (m) => json([m.type, m.type === "passage" ? passageReference(m) : null]);

/** The controls in a card's header, in order. */
function headControls(cardEl) {
  return [...(cardEl.querySelector(".desk-sheet__module-head")?.querySelectorAll("button, input, select, a[href]") ?? [])];
}

/** Which of a card's header controls has focus, by its place, or null. */
function focusedHeadControl(cardEl) {
  const at = headControls(cardEl).indexOf(document.activeElement);
  return at < 0 ? null : at;
}

/**
 * @param {{
 *   cards: Map<string, object>,
 *   cardHost: object,
 *   idSuffix: string,
 *   sheet: () => object | null,
 *   readOnly: () => boolean,
 *   insertForm: () => ({ after: string, el: HTMLElement } | null),
 *   forgetForm: () => void,
 *   worked: (id: string) => void,
 *   move: (id: string, by: number, from: HTMLElement) => void,
 *   moveTo: (id: string, to: number) => void,
 *   remove: (id: string, name: string) => void,
 *   openInsertMenu: (button: HTMLElement, m: object, called: string) => void,
 *   showConflict: (card: object, m: object, from: string) => void,
 * }} host
 *   `cards` is the editor's map of part id to card ({ el, inst, name, json,
 *   head, fixed, setHead, setPosition, conflict, theirs }), which this fills
 *   and empties; `worked` hears the part last focused or pressed; `moveTo` is
 *   a drop's new place; `forgetForm` drops the passage form when its card goes.
 */
export function createSheetCards(host) {
  const { cards, cardHost, idSuffix } = host;
  let list = null;
  // The gap pill that takes Tab (DK6-1): the one last focused, else the
  // first part's.
  let gapStop = null;

  /** A new list for a sheet's cards, wired for dragging; the cards go in it. */
  function makeList() {
    list = make("div", "desk-sheet__modules");
    list.setAttribute("role", "list");
    list.setAttribute("aria-label", "The sheet’s parts");
    wireDrag(list);
    return list;
  }

  /** One gap pill takes Tab: the one last focused, else the first part's (DK6-1). */
  function syncGapStop() {
    const pills = [...(list?.querySelectorAll(".desk-sheet__after-btn") ?? [])];
    if (!pills.length) return;
    const owner = (b) => b.closest(".desk-sheet__module")?.dataset.moduleId;
    if (!pills.some((b) => owner(b) === gapStop)) gapStop = owner(pills[0]) ?? null;
    for (const b of pills) b.tabIndex = owner(b) === gapStop ? 0 : -1;
  }

  function buildCard(m) {
    const readOnly = host.readOnly();
    const known = MODULE_TYPES.includes(m.type);
    const card = make("div", `desk-sheet__module desk-sheet__module--${known ? m.type : "unknown"}`);
    card.setAttribute("role", "listitem");
    card.dataset.moduleId = m.id;
    card.addEventListener("focusin", () => host.worked(m.id));
    card.addEventListener("pointerdown", () => host.worked(m.id));
    const head = make("div", "desk-sheet__module-head");
    const grip = make("span", "desk-sheet__grip");
    grip.setAttribute("aria-hidden", "true");
    grip.title = "Drag to move";
    grip.textContent = "⠿";
    const label = make("span", "desk-sheet__module-name", known ? TYPE_NAMES[m.type] : "Made by a newer version of the LIT");
    if (m.type === "passage") label.textContent = passageLabel(m);
    head.append(grip, label);

    const tools = make("div", "desk-sheet__module-tools");
    const name = label.textContent;
    // What the gap's pill, its menu and its form call the part: a text part's
    // heading when it has one ("Add a passage after Reading"), else its kind.
    const called = headingOf(m) ?? name;
    let up = null;
    let down = null;
    let setHead = null;
    if (!readOnly) {
      if (known) {
        const own = cardTools(cardHost, m, { name, called });
        tools.append(...own.els);
        setHead = own.update;
      }
      up = button("↑", "desk-sheet__icon");
      up.setAttribute("aria-label", `Move ${name} up`);
      up.addEventListener("click", () => host.move(m.id, -1, up));
      down = button("↓", "desk-sheet__icon");
      down.setAttribute("aria-label", `Move ${name} down`);
      down.addEventListener("click", () => host.move(m.id, 1, down));
      const remove = button("×", "desk-sheet__icon");
      remove.setAttribute("aria-label", `Remove ${name}`);
      remove.addEventListener("click", () => host.remove(m.id, name));
      tools.append(up, down, remove);
    }
    head.append(tools);
    card.append(head);

    const inst = cardBody(cardHost, card, m);

    if (!readOnly) {
      // The whole header is the handle (BVJ, 2026-11-08), not the grip alone;
      // its buttons and the Leader only box keep their own job. A press that
      // doesn't become a drag ends with the card undraggable again, so a later
      // drag across the part's text never carries the card off (pointerup
      // doesn't fire once a drag starts; dragend covers that).
      head.addEventListener("pointerdown", (e) => {
        if (e.target.closest("button, input, label, a")) return;
        card.draggable = true;
        document.addEventListener("pointerup", () => { card.draggable = false; }, { once: true });
      });
      card.addEventListener("dragend", () => { card.draggable = false; });
      // The gap under the card (BVJ, 2026-11-08): a zone over the space to the
      // next card, where a line with an "Add" pill appears under the pointer or
      // on focus, so a part can be added right there. The passage form it
      // opens sits in the card, before the zone, so the card holds it again
      // after a redraw.
      const form = host.insertForm();
      if (form?.after === m.id) card.append(form.el);
      const zone = make("div", "desk-sheet__after");
      const insert = button("+ Add", "desk-sheet__after-btn");
      insert.setAttribute("aria-label", `Add a part after ${called}`);
      insert.setAttribute("aria-haspopup", "menu");
      insert.setAttribute("aria-expanded", "false");
      insert.title = "Add a part here";
      insert.tabIndex = gapStop === m.id ? 0 : -1;
      insert.setAttribute("aria-describedby", `deskSheetGapKeys-${idSuffix}`);
      insert.addEventListener("click", () => host.openInsertMenu(insert, m, called));
      insert.addEventListener("focus", () => {
        gapStop = m.id;
        syncGapStop();
      });
      insert.addEventListener("keydown", (e) => {
        if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
        const pills = [...list.querySelectorAll(".desk-sheet__after-btn")];
        const i = pills.indexOf(insert);
        const to = { ArrowDown: i + 1, ArrowUp: i - 1, Home: 0, End: pills.length - 1 }[e.key];
        if (to === undefined) return;
        e.preventDefault();
        const next = pills[Math.max(0, Math.min(pills.length - 1, to))];
        gapStop = next?.closest(".desk-sheet__module")?.dataset.moduleId ?? gapStop;
        syncGapStop();
        next?.focus();
      });
      zone.append(insert);
      card.append(zone);
    }
    return {
      el: card,
      inst,
      name,
      json: "",
      head: headKey(m),
      fixed: fixedKey(m),
      setHead,
      setPosition(i, count) {
        if (up) up.disabled = i === 0;
        if (down) down.disabled = i === count - 1;
      },
    };
  }

  /**
   * Bring the cards in line with the sheet, keeping every card whose part
   * hasn't changed. `from` is where a change being drawn was made, for the
   * line on a part typed in meanwhile: "pane" for another Sheets pane in
   * this tab, else another tab.
   */
  function draw(from = "tab") {
    const sheet = host.sheet();
    if (!sheet || !list) return;
    const readOnly = host.readOnly();
    const seen = new Set();
    let headFocus = null;
    sheet.modules.forEach((m, i) => {
      seen.add(m.id);
      let card = cards.get(m.id);
      const now = json(m);
      if (card && card.json !== now) {
        // Planned minutes and Leader only are shown in place, so a card isn't
        // rebuilt for them, nor left showing older ones while focus is in it
        // (Audit 8, DI8-7, SH8-4). Its kind and passage are drawn only once.
        if (card.head !== headKey(m) && card.fixed === fixedKey(m)) {
          card.setHead?.(m);
          card.head = headKey(m);
        }
        if (card.inst?.update && card.head === headKey(m)) {
          // Passages and the key terms box redraw their own body in place, so
          // a blank or a footnote choice keeps the card, its open lists and
          // the reader's focus.
          card.inst.update(m);
          card.json = now;
        } else if (card.inst?.hasFocus?.()) {
          // The reader is in this card, so it keeps their words. Field by
          // field (SH8-2): one that moved and isn't being typed in takes the
          // stored text now, and one being typed in keeps the reader's words
          // under a line saying its saved text moved (S12, part 4).
          const fields = Object.entries(card.inst.fields ?? {});
          const { load, conflict } = movedUnderReader(
            fields.map(([name, ed]) => ({ name, shown: ed.shown(), busy: ed.hasFocus() })),
            m,
          );
          for (const f of load) card.inst.fields[f].setHtml(m[f] ?? "");
          // A line already up shows this newest version from now on.
          if (conflict.length || card.conflict) host.showConflict(card, m, from);
          card.json = now;
        } else {
          // Focus in the card's header (its minutes, Leader only, Move or
          // Remove) goes to the same control in the rebuilt card, so another
          // tab's change doesn't drop it to the page.
          headFocus = focusedHeadControl(card.el);
          card.inst?.destroy?.();
          card.el.remove();
          card = null;
        }
      }
      if (!card) {
        card = buildCard(m);
        card.json = now;
        cards.set(m.id, card);
      }
      card.setPosition(i, sheet.modules.length);
      if (list.children[i] !== card.el) list.insertBefore(card.el, list.children[i] ?? null);
      if (headFocus != null) {
        headControls(card.el)[headFocus]?.focus();
        headFocus = null;
      }
    });
    for (const [id, card] of cards) {
      if (seen.has(id)) continue;
      if (host.insertForm()?.after === id) host.forgetForm();
      card.inst?.destroy?.();
      card.el.remove();
      cards.delete(id);
    }
    for (const card of cards.values()) card.inst?.sheetChanged?.();
    // A part's prompt under its lone heading (SH5-2, SH5-4): shown while the
    // part holds only the heading and no passage follows it, gone once the
    // leader types there. Only the editor shows it, so it never prints or
    // goes up on a room's screen (BA70); aria-description gives it to a
    // screen reader. An empty part's prompt is the editor's placeholder.
    sheet.modules.forEach((m, i) => {
      const box = cards.get(m.id)?.el.querySelector(".desk-rich-editor > .desk-rich");
      if (!box) return;
      const hint = readOnly ? "" : headingPrompt(m, sheet.modules[i + 1]);
      if (hint) {
        if (box.dataset.hint !== hint) {
          box.dataset.hint = hint;
          box.setAttribute("aria-description", hint);
        }
      } else if (box.hasAttribute("data-hint")) {
        delete box.dataset.hint;
        box.removeAttribute("aria-description");
      }
    });
    syncGapStop();
    if (!sheet.modules.length) {
      // Beside the list, not in it: a list holds only list items (DK-16).
      if (!list.parentNode?.querySelector(".desk-sheet__none")) {
        const none = make("p", "desk-sheet__none", "Nothing on this sheet yet. Add a passage or your own text below.");
        none.tabIndex = -1; // where focus goes when the last part is removed (XA8-10)
        list.before(none);
      }
    } else {
      list.parentNode?.querySelector(".desk-sheet__none")?.remove();
    }
  }

  /** A card's part as it now stands is drawn: a save that changed nothing it shows. */
  function settled(id, m) {
    const card = cards.get(id);
    if (!card || !m) return;
    card.json = json(m);
    card.head = headKey(m);
  }

  /** Every card taken down, for another sheet or the list. */
  function clear() {
    for (const card of cards.values()) card.inst?.destroy?.();
    cards.clear();
    gapStop = null;
  }

  // ---- dragging into order ----

  const passageOrName = (id) => {
    const m = host.sheet()?.modules.find((x) => x.id === id);
    return m?.type === "passage" ? passageReference(m) : TYPE_NAMES[m?.type] ?? "";
  };

  function wireDrag(el) {
    let dragging = null;
    const marker = make("div", "desk-sheet__drop");
    marker.setAttribute("aria-hidden", "true");
    const indexAt = (y) => {
      const items = [...el.querySelectorAll(":scope > .desk-sheet__module")];
      for (let i = 0; i < items.length; i++) {
        const r = items[i].getBoundingClientRect();
        if (y < r.top + r.height / 2) return { i, before: items[i] };
      }
      return { i: items.length, before: null };
    };
    el.addEventListener("dragstart", (e) => {
      const card = e.target.closest?.(".desk-sheet__module");
      if (!card || !card.draggable) return;
      dragging = card.dataset.moduleId;
      card.classList.add("is-dragging");
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", passageOrName(dragging));
    });
    el.addEventListener("dragover", (e) => {
      if (!dragging) return;
      e.preventDefault();
      const { before } = indexAt(e.clientY);
      if (before) el.insertBefore(marker, before);
      else el.append(marker);
    });
    const end = () => {
      marker.remove();
      el.querySelector(".is-dragging")?.classList.remove("is-dragging");
      dragging = null;
    };
    el.addEventListener("drop", (e) => {
      if (!dragging) return;
      e.preventDefault();
      const id = dragging;
      marker.remove();
      const { i } = indexAt(e.clientY);
      const from = host.sheet()?.modules.findIndex((x) => x.id === id) ?? -1;
      end();
      if (from < 0) return;
      host.moveTo(id, i > from ? i - 1 : i);
    });
    el.addEventListener("dragend", end);
  }

  return { makeList, draw, syncGapStop, settled, clear, list: () => list };
}
