// src/scripts/desk/sheets/my-sheets.js
//
// The sheet editor's list view (Audit 6, LG6-2, taken out of
// `createSheetEditor` as kind-menu.js was taken out of desk-page.js's
// `start()`): "My sheets" with each sheet's Duplicate, Save as template and
// Delete, the reader's own templates under it ("My templates"), and the
// template chooser New sheet opens, which /sheets/ uses too. It draws the
// list and acts on its rows; what the editor shows, and when, stays the
// editor's, handed in as `host`. /sheets/'s own list draws its rows with
// `sheetRow` and `ownTemplatesList` too (through sheet-page-list.js), so a
// sheet has the same actions on the page as in a Sheets pane. The host:
//
// - `store`, `opCtx` and `idSuffix`, as the editor has them;
// - `say(text)`, the editor's live region;
// - `content`, the element the list is drawn in, which a problem is shown in;
// - `openSheet(id, options)`, `startFrom(template)` and `showList(options)`,
//   the editor's own, which a row's action ends in;
// - `onTour`, the host's way to start the Sheets tour (E63), or null: the
//   Sheets pane passes it, and /sheets/' editor doesn't;
// - `sheetHref(record)`, optional: where a row's name links to. /sheets/
//   passes it, so a row is a link (a sheet's versions, a template's editor)
//   rather than a button calling `openSheet`;
// - `headingTag`, optional: "My templates"' heading, "h3" unless given.
//
// It imports nothing of the editor's, so /sheets/ can load it to draw its
// list without the editor (the page loads it by import(), with the history).

import { canEdit } from "../../../lib/desk-records.mjs";
import { duplicateSheet, hasTemplateParts, sheetTooBig, templateFromSheet } from "../../../lib/desk-sheets.mjs";
import { TEMPLATES } from "../../../lib/desk-sheet-templates.mjs";
import { sheetName, sortSheets } from "../../../lib/desk-sheet-passages.mjs";
import { undoEntry } from "../history.js";
import { showUndo } from "../undo-bar.js";
import { make } from "../dom.js";

// The editor's own `button`, kept here so this file never imports the editor.
function button(label, cls = "desk-sheet__btn") {
  const b = make("button", cls, label);
  b.type = "button";
  return b;
}

const dateWords = (iso) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
};

/**
 * The list of templates New sheet opens in place (M9). Hidden until asked
 * for; the first choice takes focus when it opens, and Cancel or Escape
 * closes it and puts focus back on New sheet (`opener`). `mine` is the
 * reader's own templates, offered after the built-in ones, and `onPick` is
 * handed a built-in template's id or one of those records. /sheets/ shows it
 * too, under its own "New sheet…" (S12, part 1, step 2).
 */
export function templateChooser({ opener, mine = [], idSuffix, onPick }) {
  const box = make("div", "desk-sheet__passage-form desk-sheet__templates");
  box.id = `deskSheetTemplates-${idSuffix}`;
  box.hidden = true;
  box.setAttribute("role", "group");
  box.setAttribute("aria-label", "Start a sheet from");
  const ul = make("ul", "desk-sheet__from-list");
  for (const t of TEMPLATES) {
    const li = make("li");
    const b = button("", "desk-sheet__from-item desk-sheet__choice");
    b.append(make("span", "desk-sheet__choice-name", t.name), make("span", "desk-sheet__from-words", t.description));
    b.addEventListener("click", () => onPick(t.id));
    li.append(b);
    ul.append(li);
  }
  // The reader's own, after the built-in seven, under a heading of their own.
  let own = null;
  if (mine.length) {
    own = make("div", "desk-sheet__own-templates");
    const h = make("p", "desk-sheet__own-head", "Your templates");
    h.id = `deskSheetOwnHead-${idSuffix}`;
    const oul = make("ul", "desk-sheet__from-list");
    oul.setAttribute("aria-labelledby", h.id);
    for (const t of mine) {
      const li = make("li");
      const b = button("", "desk-sheet__from-item desk-sheet__choice");
      const parts = t.modules?.length ?? 0;
      b.append(
        make("span", "desk-sheet__choice-name", sheetName(t)),
        make("span", "desk-sheet__from-words", `${parts} ${parts === 1 ? "part" : "parts"}${t.modified ? `, changed ${dateWords(t.modified)}` : ""}`),
      );
      if (!canEdit(t)) b.disabled = true;
      b.addEventListener("click", () => onPick(t));
      li.append(b);
      oul.append(li);
    }
    own.append(h, oul);
  }
  const cancel = button("Cancel", "desk-sheet__btn desk-sheet__btn--quiet");
  const close = () => {
    box.hidden = true;
    opener.setAttribute("aria-expanded", "false");
    opener.focus();
  };
  cancel.addEventListener("click", close);
  box.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    e.preventDefault();
    e.stopPropagation();
    close();
  });
  box.append(ul, ...(own ? [own] : []), cancel);
  box.toggle = () => {
    if (box.hidden) {
      box.hidden = false;
      opener.setAttribute("aria-expanded", "true");
      box.querySelector("button")?.focus();
    } else {
      close();
    }
  };
  return box;
}

/**
 * The list view: "My sheets" with New sheet and its chooser, a row per sheet,
 * and "My templates" when the reader has any. `sheets` and `mine` are the
 * reader's sheets and own templates, already told apart. Returns the list,
 * its chooser, and its heading, which takes focus when nothing else should.
 */
export function mySheetsList(host, { sheets, mine }) {
  const list = make("div", "desk-sheet__list");
  const head = make("div", "desk-sheet__list-head");
  const heading = make("h3", "desk-sheet__list-title", "My sheets");
  heading.tabIndex = -1;
  const fresh = button("New sheet", "desk-sheet__btn desk-sheet__btn--primary");
  fresh.setAttribute("aria-expanded", "false");
  fresh.dataset.focusKey = "new-sheet";
  const chooser = templateChooser({ opener: fresh, mine, idSuffix: host.idSuffix, onPick: host.startFrom });
  fresh.setAttribute("aria-controls", chooser.id);
  fresh.addEventListener("click", () => chooser.toggle());
  head.append(heading, fresh);
  list.append(head, chooser);
  if (!sheets.length) {
    list.append(make("p", "desk-sheet__empty", "A sheet gathers passages and your own words into a handout for a study, a class, or a sermon. Start one with New sheet, then add passages from the LIT pane’s verse numbers or by selecting words."));
  } else {
    const ul = make("ul", "desk-sheet__sheets");
    for (const s of sortSheets(sheets)) ul.append(sheetRow(host, s, ul));
    list.append(ul);
  }
  if (mine.length) list.append(ownTemplatesList(host, mine));
  // The standing way into the Sheets tour (E63): a quiet link at the foot,
  // since the title menu's "Take the tour" is the Study Desk tour's and the
  // Sheets tour has no line there.
  if (host.onTour) {
    const line = make("p", "desk-sheet__tour-line");
    const tour = button("Take the Sheets tour", "desk-sheet__tour");
    tour.addEventListener("click", () => host.onTour());
    line.append(tour);
    list.append(line);
  }
  return { list, chooser, heading };
}

/**
 * A row's name and line: a link where the host gives an address
 * (`sheetHref`, on /sheets/), else a button that opens the record here.
 */
function opener(host, record) {
  const href = host.sheetHref?.(record);
  if (href) {
    const a = make("a", "desk-sheet__open");
    a.href = href;
    return a;
  }
  const b = button("", "desk-sheet__open");
  b.addEventListener("click", () => host.openSheet(record.id, { focusTitle: true }));
  return b;
}

/** One sheet's row: open it, Duplicate, Save as template, Delete. */
export function sheetRow(host, s, ul) {
  const li = make("li", "desk-sheet__sheet");
  const open = opener(host, s);
  open.append(make("span", "desk-sheet__open-name", sheetName(s)));
  const passages = s.modules?.filter((m) => m?.type === "passage").length ?? 0;
  // An untitled sheet names its template, so two can be told apart (SH6-7).
  const from = s.title?.trim() ? null : TEMPLATES.find((t) => t.id === s.template && t.id !== "blank")?.name;
  const bits = [s.subtitle, from, `${passages} ${passages === 1 ? "passage" : "passages"}`, s.modified ? `changed ${dateWords(s.modified)}` : ""].filter(Boolean);
  open.append(make("span", "desk-sheet__open-meta", bits.join(" · ")));
  open.dataset.focusKey = `open-${s.id}`;
  const dup = button("Duplicate", "desk-sheet__btn desk-sheet__btn--quiet");
  dup.setAttribute("aria-label", `Duplicate ${sheetName(s)}`);
  // A sheet of a newer sheet format can't be changed here, so it isn't copied either.
  if (!canEdit(s)) {
    dup.disabled = true;
    dup.title = "Made with a newer version of the Study Desk, so it can’t be duplicated here.";
  }
  dup.addEventListener("click", () => duplicate(host, s));
  const keep = button("Save as template", "desk-sheet__btn desk-sheet__btn--quiet");
  keep.setAttribute("aria-label", `Save ${sheetName(s)} as a template`);
  keep.title = "Keep this sheet’s parts, without its passages, as a template of your own that New sheet offers.";
  if (!canEdit(s)) {
    keep.disabled = true;
    keep.title = "Made with a newer version of the Study Desk, so it can’t be kept as a template here.";
  }
  // A template is a sheet without its passages, so a sheet of passages alone would make an empty one (DK6-8).
  if (canEdit(s) && !hasTemplateParts(s)) {
    keep.disabled = true;
    keep.title = "This sheet has only passages, and a template keeps everything but those. Add a part of your own first.";
  }
  keep.addEventListener("click", () => saveAsTemplate(host, s));
  const del = button("Delete", "desk-sheet__btn desk-sheet__btn--quiet");
  del.setAttribute("aria-label", `Delete ${sheetName(s)}`);
  del.addEventListener("click", () => removeRow(host, s, `${sheetName(s)} deleted.`, ul, open));
  li.append(open, dup, keep, del);
  return li;
}

/**
 * The reader's own templates under the sheets (Audit 5, D #1): open one to
 * change it, or delete it. New sheet starts from them.
 */
export function ownTemplatesList(host, mine) {
  const box = make("section", "desk-sheet__own");
  const h = make(host.headingTag ?? "h3", "desk-sheet__list-title", "My templates");
  h.id = `deskSheetOwn-${host.idSuffix}`;
  box.setAttribute("aria-labelledby", h.id);
  const ul = make("ul", "desk-sheet__sheets");
  for (const t of mine) {
    const li = make("li", "desk-sheet__sheet");
    const open = opener(host, t);
    open.append(make("span", "desk-sheet__open-name", sheetName(t)));
    const parts = t.modules?.length ?? 0;
    const bits = [`Template, ${parts} ${parts === 1 ? "part" : "parts"}`, t.modified ? `changed ${dateWords(t.modified)}` : ""];
    open.append(make("span", "desk-sheet__open-meta", bits.filter(Boolean).join(" · ")));
    open.dataset.focusKey = `open-${t.id}`;
    const del = button("Delete", "desk-sheet__btn desk-sheet__btn--quiet");
    del.setAttribute("aria-label", `Delete the template ${sheetName(t)}`);
    del.addEventListener("click", () => removeRow(host, t, `Template ${sheetName(t)} deleted.`, ul, open));
    li.append(open, del);
    ul.append(li);
  }
  box.append(h, ul);
  return box;
}

/**
 * Delete a sheet or template from its row, with Undo. The row below takes
 * focus (else the one above, else New sheet).
 */
async function removeRow(host, record, said, ul, open) {
  const trash = await host.store.remove(record.id);
  const entry = trash ? host.store.lastEntry() : null;
  if (entry) showUndo(said, () => undoEntry(entry));
  const rows = Array.from(ul.querySelectorAll(".desk-sheet__open"));
  const at = rows.indexOf(open);
  const next = rows[at + 1] ?? rows[at - 1];
  host.showList({ focus: next ? next.dataset.focusKey : "new-sheet" });
}

/** Keep one of the reader's sheets as a template of their own (Audit 5, D #1). */
async function saveAsTemplate(host, source) {
  let current = source;
  let t = null;
  try {
    current = (await host.store.get(source.id)) ?? source;
    t = templateFromSheet(current, host.opCtx());
    await host.store.save(t);
  } catch (err) {
    console.error("Study Desk: couldn't keep a sheet as a template", err);
    listProblem(host, sheetTooBig(err)
      ? "That sheet is too big to keep as a template."
      : "The template couldn’t be saved in this browser. Try again in a moment.");
    return;
  }
  await host.showList({ focus: `open-${t.id}` });
  host.say(`Saved ${sheetName(current)} as a template. New sheet now offers it.`);
}

/** Duplicate one of the reader's sheets (Audit 2, decision 12) and open the copy. */
async function duplicate(host, source) {
  // The copy is made from the sheet as stored now, which another tab may have changed.
  let current = source;
  let copy = null;
  try {
    current = (await host.store.get(source.id)) ?? source;
    copy = duplicateSheet(current, host.opCtx());
    await host.store.save(copy);
  } catch (err) {
    console.error("Study Desk: couldn't duplicate a sheet", err);
    const text = sheetTooBig(err)
      ? "That sheet is too big to duplicate."
      : "The sheet couldn’t be duplicated in this browser. Try again in a moment.";
    listProblem(host, text);
    return;
  }
  host.say(`Duplicated ${sheetName(current)}.`);
  await host.openSheet(copy.id, { focusTitle: true });
}

/**
 * A problem with the list's own actions, shown under its heading as well as
 * heard (CP-13). On /sheets/ it goes under the row marked
 * `data-list-problems` (the page's "New sheet…").
 */
export function listProblem(host, text) {
  const head = host.content.querySelector(".desk-sheet__list-head, [data-list-problems]");
  if (head) {
    head.parentElement.querySelector(".desk-sheet__made-not")?.remove();
    head.after(make("p", "desk-sheet__status desk-sheet__made-not", text));
  }
  host.say(text);
}
