// src/scripts/desk/sheet-pane.js
//
// The sheet editor, shown as /desk's Sheet pane (STUDY-DESK.md, S1; "Order of
// work", 3f). A sheet is one record (STUDY-DESK-FORMAT.md, "Sheets (kind
// 9)"), changed only through src/lib/desk-sheets.mjs and saved like any other
// record, so trash, undo (Ctrl+Z and the undo bar), merging and other tabs
// all work as they do for notes. Built to run inside another page: it takes
// its store, context and a place to remember which sheet it shows, and draws
// nothing outside its own element.
//
// - **The pane shows one sheet, or the list of them.** Which one is kept in
//   the layout (`setPaneSheet`), so the page opens on it again.
// - **Passages come from the live text** (format rule 1): a passage module
//   holds a reference, and its words are read from the chapter's Study View
//   page whenever it is drawn (desk-sheet-passages.mjs's locatePassage). They
//   are added from the LIT pane's verse menu or a selection ("Add to sheet",
//   offered while a sheet is open), by typing a reference, or from the
//   notebook's notes, highlights and bookmarks.
// - **Your own text between**, formatted, in text and question modules
//   (sheet-text.js); a question has its answer (always the leader's) and
//   lines to write on; space to write and page breaks too.
// - **What the sheet knows about the LIT** (3h; sheet-lit.js): a passage's
//   blanks and which of its footnotes print, the key terms box, and the
//   license card with the commercial check. Those cards are told whenever the
//   sheet changes (`sheetChanged`), since each reads the rest of the sheet.
// - **Drag into order** by a module's grip, or Move up and Move down.
// - **Saves as you go**: every change is saved at once, typing a moment after
//   it pauses. A change made elsewhere (another pane on the same sheet,
//   another tab, an undo) redraws only the modules it touched, and never the
//   one being typed in.

import { canEdit } from "../../lib/desk-records.mjs";
import { MODULE_TYPES, SHEET_LIMITS } from "../../lib/desk-sheet-format.mjs";
import { addModule, createSheet, makeModule, moveModule, removeModule, setSheetFields, updateModule } from "../../lib/desk-sheets.mjs";
import {
  passageFromOffsets,
  passageFromRecord,
  passageFromVerses,
  passageReference,
  samePassage,
  sheetName,
  sortSheets,
} from "../../lib/desk-sheet-passages.mjs";
import { rangeToOffsets } from "../../lib/desk-anchor-dom.mjs";
import { recordReference } from "../../lib/desk-store-core.mjs";
import { parseReference } from "../search-core.js";
import { closePanel } from "../lit-panel.js";
import { loadChapterPage } from "./chapter-page.js";
import { undoEntry } from "./history.js";
import { createKeyTermsBody, createLicenseCard, createPassageBody } from "./sheet-lit.js";
import { createSheetText } from "./sheet-text.js";
import { showUndo } from "./undo-bar.js";

const TYPE_NAMES = {
  passage: "Passage",
  text: "Your text",
  question: "Question",
  space: "Space to write",
  keyTerms: "Key terms box",
  pageBreak: "Page break",
};

/** How long typing in the title waits before it is saved. */
const TITLE_DELAY = 500;

function make(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}

function button(label, cls = "desk-sheet__btn") {
  const b = make("button", cls, label);
  b.type = "button";
  return b;
}

const json = (x) => JSON.stringify(x);

const dateWords = (iso) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
};

/* ── "Add to sheet" in the LIT pane's menus ───────────────────────────── */

// Every open Sheet pane, and the one last worked in, which a verse menu or
// selection adds to.
const openPanes = new Set();
let lastUsed = null;
let listening = false;

function targetPane() {
  const showing = [...openPanes].filter((p) => p.sheet());
  if (lastUsed && showing.includes(lastUsed)) return lastUsed;
  return showing[0] ?? null;
}

function listenForPanels() {
  if (listening) return;
  listening = true;
  document.addEventListener("lit:panel-actions", (e) => {
    const d = e.detail;
    if (d.view !== "desk" || !d.book || !d.chapter) return;
    const pane = targetPane();
    if (!pane) return;
    const heading = make("p", "lit-panel__subheading", "Sheet");
    const add = button(`Add to “${sheetName(pane.sheet())}”`, "lit-panel__btn");
    add.addEventListener("click", async () => {
      d.acting?.();
      const where = { bookKey: d.book, chapter: d.chapter };
      let fields = null;
      try {
        const text = d.textFor?.() ?? null;
        if (d.kind === "selection" && d.range && text) {
          const offsets = rangeToOffsets(text, d.range);
          if (offsets) fields = passageFromOffsets(text, where, offsets[0], offsets[1], pane.contentVersion());
        }
        fields ??= passageFromVerses(text, where, d.start, d.end, pane.contentVersion());
      } catch (err) {
        console.error("Study Desk: couldn't read the passage for the sheet", err);
        fields = passageFromVerses(null, where, d.start, d.end);
      }
      const ok = await pane.addPassage(fields);
      add.textContent = ok ? "Added ✓" : "Couldn’t add it";
      if (d.kind === "selection") window.getSelection()?.removeAllRanges();
      setTimeout(closePanel, 700);
    });
    const row = make("div", "lit-panel__row");
    row.append(add);
    d.append(heading);
    d.append(row);
  });
}

/* ── The pane ─────────────────────────────────────────────────────────── */

/**
 * @param {{ store: object | null, ctx: () => { client: string, contentVersion: string },
 *   paneId: string, getSheet: () => string | null, setSheet: (id: string | null) => void,
 *   showPassage?: ((passage: object) => void) | null }} options
 *   `getSheet` and `setSheet` are which sheet the pane shows, kept by the page;
 *   `showPassage` moves the LIT pane to a passage, where there is one.
 * @returns {{ el: HTMLElement, destroy: () => void }}
 */
export function createSheetPane({ store, ctx, paneId, getSheet, setSheet, showPassage = null }) {
  const el = make("div", "desk-sheet");
  const live = make("p", "sr-only");
  live.setAttribute("aria-live", "polite");
  const content = make("div", "desk-sheet__content");
  el.append(live, content);

  const say = (text) => {
    live.textContent = "";
    requestAnimationFrame(() => { live.textContent = text; });
  };

  if (!store) {
    content.append(make("p", "desk-pane__later", "This browser isn’t letting the site keep a notebook, so sheets can’t be saved here. Private windows sometimes don’t."));
    return { el, destroy() {} };
  }

  let sheet = null; // the sheet shown, as last read or saved
  let destroyed = false;
  let seq = 0; // bumped when the pane switches between the list and a sheet
  const now = () => new Date().toISOString();
  const opCtx = () => ({ now: now(), ...ctx() });

  const me = {
    sheet: () => sheet,
    contentVersion: () => ctx().contentVersion,
    addPassage: async (fields) => {
      if (!sheet || !canEdit(sheet)) return false;
      if (sheet.modules.some((m) => m.type === "passage" && samePassage(m, fields))) {
        say(`${passageReference(fields)} is already on the sheet.`);
      }
      return change((s) => addModule(s, makeModule("passage", fields)), { focusNew: false, announce: `${passageReference(fields)} added.` });
    },
  };
  openPanes.add(me);
  listenForPanels();
  el.addEventListener("pointerdown", () => { lastUsed = me; });
  el.addEventListener("focusin", () => { lastUsed = me; });

  // ---- saving ----

  let saving = Promise.resolve();
  const status = make("span", "desk-sheet__saved");
  status.setAttribute("role", "status");

  /**
   * Apply an operation to the sheet and save it. Saves run one after
   * another, each with the sheet as the last one left it. Resolves true when
   * the change was saved (or changed nothing). `source` is the module whose
   * own card made the change, which then isn't redrawn: it already shows it,
   * and redrawing would drop a click on its buttons that is under way.
   */
  function change(op, { announce = null, after = null, source = null } = {}) {
    const run = saving.then(async () => {
      if (destroyed || !sheet) return false;
      let next;
      try {
        next = op(sheet);
      } catch (err) {
        console.error("Study Desk: the sheet refused a change", err);
        say(err.message?.includes("at most") ? `A sheet holds at most ${SHEET_LIMITS.modules} parts.` : "That change couldn’t be made.");
        return false;
      }
      if (next === sheet) return true;
      sheet = next;
      status.textContent = "Saving…";
      try {
        await store.save(next);
        status.textContent = "Saved";
      } catch (err) {
        console.error("Study Desk: the sheet couldn’t be saved", err);
        status.textContent = "Not saved";
        say("The sheet couldn’t be saved. Your last change may be lost if you leave.");
        return false;
      }
      if (source) {
        const card = cards.get(source);
        const m = next.modules.find((x) => x.id === source);
        if (card && m) card.json = json(m);
      }
      draw();
      after?.();
      if (announce) say(announce);
      return true;
    });
    saving = run.catch(() => false);
    return run;
  }

  // ---- the list of sheets ----

  async function showList() {
    const n = ++seq;
    sheet = null;
    for (const card of cards.values()) card.inst?.destroy?.();
    cards.clear();
    license = null;
    keyTermsButton = null;
    content.replaceChildren(make("p", "desk-sheet__status", "Loading your sheets…"));
    let all = [];
    try {
      all = (await store.all()).filter((r) => r.kind === "sheet");
    } catch (err) {
      console.error("Study Desk: couldn't read the sheets", err);
    }
    if (n !== seq || destroyed) return;
    const list = make("div", "desk-sheet__list");
    const head = make("div", "desk-sheet__list-head");
    const h = make("h3", "desk-sheet__list-title", "My sheets");
    const fresh = button("New sheet", "desk-sheet__btn desk-sheet__btn--primary");
    fresh.addEventListener("click", newSheet);
    head.append(h, fresh);
    list.append(head);
    if (!all.length) {
      list.append(make("p", "desk-sheet__empty", "A sheet gathers passages and your own words into a handout for a study, a class, or a sermon. Start one with New sheet, then add passages from the LIT pane’s verse numbers or by selecting words."));
    } else {
      const ul = make("ul", "desk-sheet__sheets");
      for (const s of sortSheets(all)) {
        const li = make("li", "desk-sheet__sheet");
        const open = button("", "desk-sheet__open");
        open.append(make("span", "desk-sheet__open-name", sheetName(s)));
        const passages = s.modules?.filter((m) => m?.type === "passage").length ?? 0;
        const bits = [s.subtitle, `${passages} ${passages === 1 ? "passage" : "passages"}`, s.modified ? `changed ${dateWords(s.modified)}` : ""].filter(Boolean);
        open.append(make("span", "desk-sheet__open-meta", bits.join(" · ")));
        open.addEventListener("click", () => openSheet(s.id));
        const del = button("Delete", "desk-sheet__btn desk-sheet__btn--quiet");
        del.setAttribute("aria-label", `Delete ${sheetName(s)}`);
        del.addEventListener("click", async () => {
          const trash = await store.remove(s.id);
          const entry = trash ? store.lastEntry() : null;
          if (entry) showUndo(`${sheetName(s)} deleted.`, () => undoEntry(entry));
          showList();
        });
        li.append(open, del);
        ul.append(li);
      }
      list.append(ul);
    }
    content.replaceChildren(list);
  }

  async function newSheet() {
    const s = createSheet({ template: "blank" }, opCtx());
    try {
      await store.save(s);
    } catch (err) {
      console.error("Study Desk: couldn't make a sheet", err);
      say("The sheet couldn’t be made.");
      return;
    }
    await openSheet(s.id, { focusTitle: true });
  }

  // ---- one sheet ----

  const cards = new Map(); // module id → { el, json, inst }
  let header = null;
  let moduleList = null;
  let titleInput = null;
  let subtitleInput = null;
  let readOnly = false;
  let license = null;
  let keyTermsButton = null;

  /** What a card's head shows, which an in-place update can't redraw. */
  const headKey = (m) => json([m.type, m.leaderOnly === true, m.type === "passage" ? passageReference(m) : null]);

  async function openSheet(id, { focusTitle = false } = {}) {
    const n = ++seq;
    let record = null;
    try {
      record = await store.get(id);
    } catch (_) {}
    if (n !== seq || destroyed) return;
    if (record?.kind !== "sheet") {
      setSheet(null);
      showList();
      return;
    }
    setSheet(id);
    sheet = record;
    readOnly = !canEdit(record);
    for (const card of cards.values()) card.inst?.destroy?.();
    cards.clear();
    buildSheet();
    draw();
    if (focusTitle) titleInput?.focus();
  }

  function buildSheet() {
    const wrap = make("div", "desk-sheet__sheet-view");
    header = make("div", "desk-sheet__top");
    const back = button("‹ All sheets", "desk-sheet__btn desk-sheet__btn--quiet");
    back.addEventListener("click", async () => {
      flushAll();
      await saving;
      setSheet(null);
      showList();
    });
    status.textContent = "";
    header.append(back, status);
    wrap.append(header);

    if (readOnly) {
      wrap.append(make("p", "desk-sheet__status", "This sheet was made by a newer version of the LIT. Reload the page to edit it."));
    }

    titleInput = make("input", "desk-sheet__title");
    titleInput.type = "text";
    titleInput.maxLength = SHEET_LIMITS.title;
    titleInput.placeholder = "Title";
    titleInput.setAttribute("aria-label", "Sheet title");
    subtitleInput = make("input", "desk-sheet__subtitle");
    subtitleInput.type = "text";
    subtitleInput.maxLength = SHEET_LIMITS.subtitle;
    subtitleInput.placeholder = "Subtitle, such as your group and the date";
    subtitleInput.setAttribute("aria-label", "Sheet subtitle");
    for (const [input, field] of [[titleInput, "title"], [subtitleInput, "subtitle"]]) {
      input.value = sheet[field] ?? "";
      input.disabled = readOnly;
      let timer = null;
      const save = () => {
        clearTimeout(timer);
        timer = null;
        const value = input.value;
        change((s) => setSheetFields(s, { [field]: value }, opCtx()));
      };
      input.addEventListener("input", () => {
        clearTimeout(timer);
        timer = setTimeout(save, TITLE_DELAY);
      });
      input.addEventListener("blur", () => { if (timer) save(); });
      input.flush = () => { if (timer) save(); };
    }
    wrap.append(titleInput, subtitleInput);

    moduleList = make("div", "desk-sheet__modules");
    moduleList.setAttribute("role", "list");
    moduleList.setAttribute("aria-label", "The sheet’s parts");
    wireDrag(moduleList);
    wrap.append(moduleList);
    if (!readOnly) wrap.append(addBar());
    license = createLicenseCard({
      getSheet: () => sheet,
      readOnly,
      idPrefix: `deskSheet-${paneId}`,
      setCommercial: (on) =>
        change((s) => setSheetFields(s, { commercial: on }, opCtx()), {
          announce: on ? "Marked as a commercial project; the commercial check is on." : "No longer marked as a commercial project.",
        }),
    });
    wrap.append(license.el);
    content.replaceChildren(wrap);
  }

  /** Bring the page in line with `sheet`, keeping every card that hasn't changed. */
  function draw() {
    if (!sheet || !moduleList) return;
    if (titleInput && document.activeElement !== titleInput) titleInput.value = sheet.title ?? "";
    if (subtitleInput && document.activeElement !== subtitleInput) subtitleInput.value = sheet.subtitle ?? "";
    const seen = new Set();
    sheet.modules.forEach((m, i) => {
      seen.add(m.id);
      let card = cards.get(m.id);
      const now = json(m);
      if (card && card.json !== now) {
        if (card.inst?.update && card.head === headKey(m)) {
          // Passages and the key terms box redraw their own body in place, so
          // a blank or a footnote choice keeps the card, its open lists and
          // the reader's focus.
          card.inst.update(m);
          card.json = now;
        } else if (card.inst?.hasFocus?.()) {
          card.json = now; // the reader is typing here; their next save wins
        } else {
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
      if (moduleList.children[i] !== card.el) moduleList.insertBefore(card.el, moduleList.children[i] ?? null);
    });
    for (const [id, card] of cards) {
      if (seen.has(id)) continue;
      card.inst?.destroy?.();
      card.el.remove();
      cards.delete(id);
    }
    for (const card of cards.values()) card.inst?.sheetChanged?.();
    license?.sheetChanged();
    if (keyTermsButton) {
      const has = sheet.modules.some((x) => x?.type === "keyTerms");
      keyTermsButton.disabled = has;
      keyTermsButton.title = has ? "A sheet has one key terms box" : "A box listing the key terms in the sheet’s passages, filled in for you";
    }
    if (!sheet.modules.length) {
      if (!moduleList.querySelector(".desk-sheet__none")) {
        moduleList.append(make("p", "desk-sheet__none", "Nothing on this sheet yet. Add a passage or your own text below."));
      }
    } else {
      moduleList.querySelector(".desk-sheet__none")?.remove();
    }
  }

  function flushAll() {
    titleInput?.flush?.();
    subtitleInput?.flush?.();
    for (const card of cards.values()) card.inst?.flush?.();
  }

  // ---- a module's card ----

  function buildCard(m) {
    const known = MODULE_TYPES.includes(m.type);
    const card = make("div", `desk-sheet__module desk-sheet__module--${known ? m.type : "unknown"}`);
    card.setAttribute("role", "listitem");
    card.dataset.moduleId = m.id;
    const head = make("div", "desk-sheet__module-head");
    const grip = make("span", "desk-sheet__grip");
    grip.setAttribute("aria-hidden", "true");
    grip.title = "Drag to move";
    grip.textContent = "⠿";
    const label = make("span", "desk-sheet__module-name", known ? TYPE_NAMES[m.type] : "Made by a newer version of the LIT");
    if (m.type === "passage") label.textContent = passageReference(m);
    head.append(grip, label);

    const tools = make("div", "desk-sheet__module-tools");
    const name = label.textContent;
    let up = null;
    let down = null;
    if (!readOnly) {
      if (known) {
        const leader = make("label", "desk-sheet__leader");
        const box = make("input");
        box.type = "checkbox";
        box.checked = m.leaderOnly === true;
        box.addEventListener("change", () => {
          change((s) => updateModule(s, m.id, { leaderOnly: box.checked || undefined }, opCtx()), {
            source: m.id,
            announce: box.checked ? `${name}: on the leader’s copy only.` : `${name}: on every copy.`,
          });
        });
        leader.append(box, make("span", null, "Leader only"));
        leader.title = "Print and present this on the leader’s copy only";
        tools.append(leader);
      }
      up = button("↑", "desk-sheet__icon");
      up.setAttribute("aria-label", `Move ${name} up`);
      up.addEventListener("click", () => move(m.id, -1, up));
      down = button("↓", "desk-sheet__icon");
      down.setAttribute("aria-label", `Move ${name} down`);
      down.addEventListener("click", () => move(m.id, 1, down));
      const remove = button("×", "desk-sheet__icon");
      remove.setAttribute("aria-label", `Remove ${name}`);
      remove.addEventListener("click", () => removeCard(m.id, name));
      tools.append(up, down, remove);
    }
    head.append(tools);
    card.append(head);

    let inst = null;
    if (m.type === "passage") inst = passageCard(card, m);
    else if (m.type === "text") inst = textCard(card, m);
    else if (m.type === "question") inst = questionCard(card, m);
    else if (m.type === "space") inst = spaceCard(card, m);
    else if (m.type === "pageBreak") card.append(make("div", "desk-sheet__break", "A new page starts here when printed."));
    else if (m.type === "keyTerms") inst = keyTermsCard(card, m);
    else card.append(make("p", "desk-sheet__status", "This part was made by a newer version of the LIT. It is kept as it is; reload the page to see it."));

    if (!readOnly) {
      grip.addEventListener("pointerdown", () => { card.draggable = true; });
      card.addEventListener("dragend", () => { card.draggable = false; });
    }
    return {
      el: card,
      inst,
      json: "",
      head: headKey(m),
      setPosition(i, count) {
        if (up) up.disabled = i === 0;
        if (down) down.disabled = i === count - 1;
      },
    };
  }

  function move(id, by, from) {
    const at = sheet.modules.findIndex((x) => x.id === id);
    if (at < 0) return;
    const to = at + by;
    if (to < 0 || to >= sheet.modules.length) return;
    change((s) => moveModule(s, id, to, opCtx()), {
      announce: `Moved to ${to + 1} of ${sheet.modules.length}.`,
      after: () => from.isConnected && !from.disabled ? from.focus() : cards.get(id)?.el.querySelector("button")?.focus(),
    });
  }

  function removeCard(id, name) {
    const at = sheet.modules.findIndex((x) => x.id === id);
    change((s) => removeModule(s, id, opCtx()), {
      after: () => {
        const entry = store.lastEntry();
        if (entry) showUndo(`${name} removed from the sheet.`, () => undoEntry(entry));
        const next = sheet.modules[Math.min(at, sheet.modules.length - 1)];
        (next ? cards.get(next.id)?.el.querySelector("button") : moduleList)?.focus?.();
      },
    });
  }

  function passageCard(card, m) {
    const body = make("div");
    card.append(body);
    if (showPassage) {
      const go = button("Show in the LIT", "desk-sheet__btn desk-sheet__btn--quiet desk-sheet__show");
      go.addEventListener("click", () => showPassage({ bookKey: m.bookKey, chapter: m.chapter, verse: m.verse }));
      card.querySelector(".desk-sheet__module-tools").prepend(go);
    }
    const inst = createPassageBody({
      m,
      readOnly,
      getSheet: () => sheet,
      update: (fields, announce) => change((s) => updateModule(s, m.id, fields, opCtx()), { announce }),
      say,
    });
    body.replaceWith(inst.el);
    return inst;
  }

  function keyTermsCard(card, m) {
    const inst = createKeyTermsBody({
      m,
      readOnly,
      getSheet: () => sheet,
      update: (fields, announce) => change((s) => updateModule(s, m.id, fields, opCtx()), { announce }),
    });
    card.append(inst.el);
    return inst;
  }

  function textField(m, field, label, placeholder) {
    return createSheetText({
      html: m[field] ?? "",
      label,
      placeholder,
      idPrefix: `deskSheet-${paneId}-${m.id}-${field}`,
      onChange: (html) => change((s) => updateModule(s, m.id, { [field]: html }, opCtx()), { source: m.id }),
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

  function textCard(card, m) {
    if (readOnly) return readOnlyRich(card, m.html);
    const ed = textField(m, "html", "Your text", "Write here…");
    card.append(ed.el);
    return ed;
  }

  function readOnlyRich(card, html) {
    const box = make("div", "desk-rich");
    box.innerHTML = html ?? "";
    card.append(box);
    return null;
  }

  function linesField(m, { min, max, label }) {
    const wrap = make("label", "desk-sheet__lines");
    const input = make("input");
    input.type = "number";
    input.min = String(min);
    input.max = String(max);
    input.value = String(m.lines ?? min);
    input.disabled = readOnly;
    input.addEventListener("change", () => {
      const n = Math.round(Number(input.value));
      if (!Number.isFinite(n)) return;
      const lines = Math.min(max, Math.max(min, n));
      input.value = String(lines);
      change((s) => updateModule(s, m.id, { lines }, opCtx()), { source: m.id });
    });
    wrap.append(make("span", null, label), input);
    return { el: wrap, hasFocus: () => document.activeElement === input };
  }

  function questionCard(card, m) {
    if (readOnly) {
      readOnlyRich(card, m.html);
      return null;
    }
    const q = textField(m, "html", "Question", "Ask a question for discussion…");
    const a = textField(m, "answer", "Answer, on the leader’s copy only", "An answer or notes for the leader (optional)");
    const lines = linesField(m, { min: 0, max: SHEET_LIMITS.questionLines, label: "Lines to write on" });
    card.append(q.el, a.el, lines.el);
    return group(q, a, lines);
  }

  function spaceCard(card, m) {
    const lines = linesField(m, { min: 1, max: SHEET_LIMITS.spaceLines, label: "Lines to write on" });
    const ruled = make("div", "desk-sheet__ruled");
    ruled.style.setProperty("--lines", String(Math.min(m.lines ?? 4, 6)));
    ruled.setAttribute("aria-hidden", "true");
    card.append(lines.el, ruled);
    return lines;
  }

  // ---- adding ----

  function addBar() {
    const bar = make("div", "desk-sheet__add");
    const row = make("div", "desk-sheet__add-row");
    row.setAttribute("role", "group");
    row.setAttribute("aria-label", "Add to the sheet");
    const form = make("div", "desk-sheet__passage-form");
    form.hidden = true;
    const add = (type, label) => {
      const b = button(`+ ${label}`);
      b.addEventListener("click", () => {
        if (type === "passage") {
          form.hidden = !form.hidden;
          b.setAttribute("aria-expanded", String(!form.hidden));
          if (!form.hidden) openPassageForm(form);
          return;
        }
        const mod = makeModule(type);
        change((s) => addModule(s, mod, s.modules.length, opCtx()), {
          announce: `${TYPE_NAMES[type]} added at the end.`,
          after: () => {
            const c = cards.get(mod.id);
            c?.el.scrollIntoView({ block: "nearest" });
            c?.inst?.focus?.() ?? c?.el.querySelector("[contenteditable], input, button")?.focus();
          },
        });
      });
      if (type === "passage") {
        b.setAttribute("aria-expanded", "false");
        b.setAttribute("aria-controls", `deskSheetPassage-${paneId}`);
      }
      row.append(b);
    };
    add("passage", "Passage");
    add("text", "Your text");
    add("question", "Question");
    add("space", "Space");
    add("pageBreak", "Page break");
    add("keyTerms", "Key terms box");
    keyTermsButton = row.lastChild;
    form.id = `deskSheetPassage-${paneId}`;
    bar.append(row, form);
    return bar;
  }

  /** The "+ Passage" form: a typed reference, or a place from the notebook. */
  async function openPassageForm(form) {
    form.replaceChildren();
    const line = make("form", "desk-sheet__ref");
    const input = make("input");
    input.type = "text";
    input.placeholder = "A reference, such as John 3:16–18";
    input.setAttribute("aria-label", "Passage to add");
    const go = make("button", "desk-sheet__btn", "Add");
    go.type = "submit";
    const problem = make("p", "desk-sheet__problem");
    problem.setAttribute("role", "alert");
    line.append(input, go);
    line.addEventListener("submit", async (e) => {
      e.preventDefault();
      const ref = parseReference(input.value.replace(/[–—]/g, "-"));
      if (!ref) {
        problem.textContent = "That isn’t a reference the LIT can read. Try a book, a chapter, and verses, such as Romans 5:6–10.";
        return;
      }
      problem.textContent = "";
      let chapter = null;
      let source = null;
      try {
        source = await loadChapterPage(ref.bookKey, ref.chapter);
        chapter = source.textBox ? source.anchorText() : null;
      } catch (_) {}
      const last = chapter?.verses?.length ? Math.max(...chapter.verses) : null;
      const verse = ref.verse ?? 1;
      const end = ref.rangeEnd ?? (ref.verse ? ref.verse : last ?? 1);
      if (last && verse > last) {
        problem.textContent = `${passageReference({ bookKey: ref.bookKey, chapter: ref.chapter, verse })} isn’t in the LIT; that chapter ends at verse ${last}.`;
        return;
      }
      const ok = await me.addPassage(passageFromVerses(chapter, ref, verse, Math.min(end, last ?? end), ctx().contentVersion));
      if (ok) input.value = "";
    });
    form.append(line, problem);

    // From the notebook: its notes, highlights and bookmarks, newest first.
    const fromBook = make("div", "desk-sheet__from");
    fromBook.append(make("p", "desk-sheet__from-title", "From my notebook"));
    form.append(fromBook);
    let records = [];
    try {
      records = (await store.all())
        .filter((r) => ["note", "highlight", "bookmark"].includes(r.kind) && r.bookKey && Number.isInteger(r.verse))
        .sort((a, b) => String(b.modified ?? "").localeCompare(String(a.modified ?? "")))
        .slice(0, 40);
    } catch (_) {}
    if (!records.length) {
      fromBook.append(make("p", "desk-sheet__empty", "Notes, highlights, and bookmarks you make will be listed here."));
      return;
    }
    const ul = make("ul", "desk-sheet__from-list");
    const KIND = { note: "Note", highlight: "Highlight", bookmark: "Bookmark" };
    for (const r of records) {
      const li = make("li");
      const b = button("", "desk-sheet__from-item");
      b.append(make("span", "desk-sheet__from-ref", recordReference(r)), make("span", "desk-sheet__from-kind", KIND[r.kind]));
      const words = r.kind === "note" ? r.text : r.quote?.exact;
      if (words) b.append(make("span", "desk-sheet__from-words", words.length > 90 ? words.slice(0, 89) + "…" : words));
      b.addEventListener("click", async () => {
        let chapter = null;
        try {
          const source = await loadChapterPage(r.bookKey, r.chapter);
          chapter = source.textBox ? source.anchorText() : null;
        } catch (_) {}
        const fields = passageFromRecord(r, chapter, ctx().contentVersion);
        if (fields) await me.addPassage(fields);
      });
      li.append(b);
      ul.append(li);
    }
    fromBook.append(ul);
  }

  // ---- dragging into order ----

  function wireDrag(list) {
    let dragging = null;
    const marker = make("div", "desk-sheet__drop");
    marker.setAttribute("aria-hidden", "true");
    const indexAt = (y) => {
      const items = [...list.querySelectorAll(":scope > .desk-sheet__module")];
      for (let i = 0; i < items.length; i++) {
        const r = items[i].getBoundingClientRect();
        if (y < r.top + r.height / 2) return { i, before: items[i] };
      }
      return { i: items.length, before: null };
    };
    list.addEventListener("dragstart", (e) => {
      const card = e.target.closest?.(".desk-sheet__module");
      if (!card || !card.draggable) return;
      dragging = card.dataset.moduleId;
      card.classList.add("is-dragging");
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", passageOrName(dragging));
    });
    list.addEventListener("dragover", (e) => {
      if (!dragging) return;
      e.preventDefault();
      const { before } = indexAt(e.clientY);
      if (before) list.insertBefore(marker, before);
      else list.append(marker);
    });
    const end = () => {
      marker.remove();
      list.querySelector(".is-dragging")?.classList.remove("is-dragging");
      dragging = null;
    };
    list.addEventListener("drop", (e) => {
      if (!dragging) return;
      e.preventDefault();
      const id = dragging;
      marker.remove();
      const { i } = indexAt(e.clientY);
      const from = sheet.modules.findIndex((x) => x.id === id);
      end();
      if (from < 0) return;
      const to = i > from ? i - 1 : i;
      change((s) => moveModule(s, id, to, opCtx()), { announce: `Moved to ${to + 1} of ${sheet.modules.length}.` });
    });
    list.addEventListener("dragend", end);
  }

  const passageOrName = (id) => {
    const m = sheet?.modules.find((x) => x.id === id);
    return m?.type === "passage" ? passageReference(m) : TYPE_NAMES[m?.type] ?? "";
  };

  // ---- changes made elsewhere ----

  const unsubscribe = store.subscribe(async (ids) => {
    if (!sheet || !ids?.includes?.(sheet.id)) return;
    await saving;
    const n = seq;
    let record = null;
    try {
      record = await store.get(sheet.id);
    } catch (_) {
      return;
    }
    if (n !== seq || destroyed || !sheet) return;
    if (record?.kind !== "sheet") {
      // Deleted here or in another tab.
      setSheet(null);
      showList();
      return;
    }
    if (json(record) === json(sheet)) return;
    sheet = record;
    draw();
  });

  queueMicrotask(() => {
    const id = getSheet();
    if (id) openSheet(id);
    else showList();
  });

  return {
    el,
    destroy() {
      flushAll();
      destroyed = true;
      seq++;
      unsubscribe();
      openPanes.delete(me);
      if (lastUsed === me) lastUsed = null;
      for (const card of cards.values()) card.inst?.destroy?.();
    },
  };
}
