// src/scripts/desk/export-import.js
//
// "Save a copy" and "Open a copy" on the notebook page (STUDY-DESK.md, D1 and
// the export every plan needs). Three files can be saved (src/lib/desk-export.mjs
// says what each is for), and a file the reader chooses is read and shown as a
// plain summary before anything is written: what is new, what would change,
// what stays as it is here, and anything left out with its line number. Only
// Open writes, in one store.commit, so it is one step in the undo history and
// the undo bar offers it back.
//
// Nothing is uploaded: the file is made and read in the browser. The time of
// the last copy is kept in the notebook's meta ("lastExport", an ISO string)
// so the page, and a reminder elsewhere, can say how long ago it was.

import {
  describeLastExport,
  describeSummary,
  exportFilename,
  parseImport,
  planChanges,
  planImport,
  toBackupJson,
  toMarkdown,
  toWebAnnotation,
} from "../../lib/desk-export.mjs";
import { undoEntry } from "./history.js";
import { showUndo } from "./undo-bar.js";

export const LAST_EXPORT_KEY = "lastExport";

const FORMATS = [
  {
    id: "markdown",
    label: "Markdown",
    about: "For reading and editing. Opens in any text editor. Words you change here come back in when you open it.",
    make: toMarkdown,
    type: "text/markdown;charset=utf-8",
  },
  {
    id: "webAnnotation",
    label: "Web Annotation (JSON)",
    about: "For other study tools. Your marks on the text in the W3C’s standard shape.",
    make: toWebAnnotation,
    type: "application/json;charset=utf-8",
  },
  {
    id: "backup",
    label: "Full backup (JSON)",
    about: "Everything the notebook keeps, exactly as it is, for restoring it completely.",
    make: toBackupJson,
    type: "application/json;charset=utf-8",
  },
];

/** Hand a file to the browser to save. */
function download(name, text, type) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/**
 * Build the section's contents inside `el`.
 *
 * @param {HTMLElement} el
 * @param {{ store: object, ctx: () => { client: string, contentVersion: string } }} options
 */
export function mountBackup(el, { store, ctx }) {
  el.innerHTML = `
    <h2 class="desk-np__h2" id="deskBackupTitle">Save a copy</h2>
    <p>A copy is a file you keep yourself. Your notebook stays in this browser, and a browser can lose it, so save a copy now and then.</p>
    <p class="desk-backup__last" data-backup-last></p>
    <ul class="desk-backup__formats"></ul>
    <h3 class="desk-np__h3" id="deskOpenTitle">Open a copy</h3>
    <p>Choose a file saved from here. You will see what it would do before anything changes, and nothing is deleted because it is missing from the file.</p>
    <p class="desk-backup__pick">
      <label class="desk-backup__file">
        <span class="desk-backup__file-button">Open a copy…</span>
        <input class="sr-only" type="file" accept=".md,.markdown,.json,.jsonld,text/markdown,application/json" data-backup-file />
      </label>
    </p>
    <div class="desk-backup__result" data-backup-result tabindex="-1" hidden></div>
    <p class="sr-only" role="status" data-backup-status></p>`;
  el.setAttribute("aria-labelledby", "deskBackupTitle");

  const last = el.querySelector("[data-backup-last]");
  const status = el.querySelector("[data-backup-status]");
  const result = el.querySelector("[data-backup-result]");
  const file = el.querySelector("[data-backup-file]");
  const formats = el.querySelector(".desk-backup__formats");

  async function showLast() {
    let at = null;
    try {
      at = await store.getMeta?.(LAST_EXPORT_KEY);
    } catch (_) {}
    last.textContent = describeLastExport(at);
  }
  showLast();

  for (const f of FORMATS) {
    const li = document.createElement("li");
    const b = document.createElement("button");
    b.type = "button";
    b.className = "desk-backup__save";
    b.textContent = `Save ${f.label}`;
    const about = document.createElement("span");
    about.className = "desk-backup__about";
    about.textContent = f.about;
    li.append(b, about);
    formats.append(li);
    b.addEventListener("click", async () => {
      const exported = new Date().toISOString();
      const records = await store.all();
      const text = f.make(records, { exported, contentVersion: ctx().contentVersion });
      download(exportFilename(f.id, exported), text, f.type);
      try {
        await store.setMeta?.(LAST_EXPORT_KEY, exported);
      } catch (err) {
        console.error("Study Desk: the time of the copy wasn’t kept", err);
      }
      status.textContent = "";
      setTimeout(() => (status.textContent = `Saved ${exportFilename(f.id, exported)}.`), 50);
      showLast();
    });
  }

  /* ── Opening ─────────────────────────────────────────────────────── */

  function clearResult() {
    result.hidden = true;
    result.replaceChildren();
  }

  function paragraph(text, className = "") {
    const p = document.createElement("p");
    if (className) p.className = className;
    p.textContent = text;
    return p;
  }

  file.addEventListener("change", async () => {
    const chosen = file.files?.[0];
    clearResult();
    if (!chosen) return;
    let text;
    try {
      text = await chosen.text();
    } catch (err) {
      console.error("Study Desk: the file couldn’t be read", err);
      return showResult({ message: "That file couldn’t be read." });
    }
    const local = await store.all();
    const now = new Date().toISOString();
    // A file malformed in a way the readers don't foresee throws; say so
    // rather than leave the reader with nothing happening (BA9).
    let read, planned;
    try {
      read = parseImport(text, { local, ctx: ctx(), now });
      if (read.kind === "unknown") return showResult({ message: read.problems[0]?.message ?? "This isn’t a notebook file.", problems: [] });
      planned = planImport(local, read.records, { now });
    } catch (err) {
      console.error("Study Desk: the file couldn’t be opened", err);
      return showResult({ message: "That file couldn’t be read." });
    }
    showResult({ name: chosen.name, read, planned, now });
  });

  function showResult({ message = null, name = "", read = null, planned = null }) {
    result.replaceChildren();
    result.hidden = false;
    if (message) {
      result.append(paragraph(message, "desk-backup__message"));
      announce(message);
      return;
    }
    // What the file's own reading left out counts with what the merge left out.
    const sentence = describeSummary({ ...planned.summary, skipped: planned.summary.skipped + read.problems.length });
    const head = document.createElement("h4");
    head.className = "desk-np__h4";
    head.textContent = `Opening ${name}`;
    result.append(head, paragraph(sentence, "desk-backup__summary"));
    for (const note of read.notes) result.append(paragraph(note));

    // What was left out, with its line when the file has lines.
    const left = [
      ...read.problems.map((p) => (p.line ? `Line ${p.line}: ${p.message}` : p.message)),
      ...planned.skipped.map((s) => `A record was left out: ${s.reason}`),
    ];
    if (left.length) {
      result.append(paragraph("Left out, so you can look them over:", "desk-backup__left-title"));
      const ul = document.createElement("ul");
      ul.className = "desk-backup__left";
      for (const line of left.slice(0, 50)) {
        const li = document.createElement("li");
        li.textContent = line;
        ul.append(li);
      }
      result.append(ul);
      if (left.length > 50) result.append(paragraph(`And ${left.length - 50} more.`));
    }

    const actions = document.createElement("div");
    actions.className = "desk-backup__actions";
    const close = document.createElement("button");
    close.type = "button";
    close.className = "desk-backup__cancel";
    const can = planChanges(planned.plan);
    close.textContent = can ? "Cancel" : "Close";
    close.addEventListener("click", () => {
      clearResult();
      file.value = "";
      file.focus({ preventScroll: true });
    });
    if (can) {
      const go = document.createElement("button");
      go.type = "button";
      go.className = "desk-backup__import";
      go.textContent = "Open this copy";
      go.addEventListener("click", () => doImport(go, planned, sentence));
      actions.append(go);
    }
    actions.append(close);
    result.append(actions);
    announce(`${sentence}${can ? " Choose Open this copy to go ahead." : ""}`);
    result.focus({ preventScroll: false });
  }

  async function doImport(go, planned, sentence) {
    go.disabled = true;
    try {
      await store.commit(planned.plan);
    } catch (err) {
      console.error("Study Desk: the copy wasn’t opened", err);
      go.disabled = false;
      return announce("That couldn’t be saved in this browser. Nothing was changed.");
    }
    const entry = store.lastEntry();
    clearResult();
    file.value = "";
    result.hidden = false;
    result.append(paragraph(`Opened. ${sentence}`, "desk-backup__message"));
    announce(`Opened. ${sentence}`);
    if (entry) showUndo(`Opened a copy. ${sentence}`, () => undoEntry(entry));
  }

  function announce(message) {
    status.textContent = "";
    setTimeout(() => (status.textContent = message), 50);
  }
}
