// src/scripts/desk/export-import.js
//
// "Back up your notebook" and "Merge a backup into this notebook" on the
// notebook page (STUDY-DESK.md, D1 and the export every plan needs; the words
// are E113's). Three files can be saved (src/lib/desk-export.mjs says what
// each is for; only the full JSON file is "a backup", the others sit under
// "Other formats"), and a file the reader chooses is read and shown as a plain
// summary before anything is written: what is new, what would change, what
// stays as it is here, and anything left out with its line number. Only Merge
// writes, in one store.change (read, planned and written together, DI-9), so
// it is one step in the undo history and the undo bar offers it back. Merge
// plans again against the notebook as it is then, since the summary may have
// stood open while notes changed here, in another tab or by Keep: if the
// outcome differs, it shows the new one and writes nothing until pressed again
// (audit BA3).
//
// Nothing is uploaded: the file is made and read in the browser (by
// backup-file.js, which the reminder's "Back up now" shares). The time of the
// last backup is kept in the notebook's meta ("lastExport", an ISO string) so
// the page, and the reminder, can say how long ago it was.

import { describeLastExport, planChanges, planOpen, sameOpen } from "../../lib/desk-export.mjs";
import { planWrite } from "../../lib/desk-store-core.mjs";
import { FORMATS, LAST_EXPORT_KEY, saveFile } from "./backup-file.js";
import { undoEntry } from "./history.js";
import { showUndo } from "./undo-bar.js";

export { LAST_EXPORT_KEY };

/** The largest file Merge a backup reads (SEC-6): far past any real notebook, short of freezing the tab. */
const MAX_FILE_BYTES = 50_000_000;

/**
 * Build the section's contents inside `el`.
 *
 * @param {HTMLElement} el
 * @param {{ store: object, ctx: () => { client: string, contentVersion: string } }} options
 */
export function mountBackup(el, { store, ctx }) {
  el.innerHTML = `
    <h2 class="desk-np__h2" id="deskBackupTitle">Back up your notebook</h2>
    <p>A backup is a file you keep yourself. Your notebook stays in this browser, and a browser can lose it, so back up your notebook now and then.</p>
    <p class="desk-backup__last" data-backup-last></p>
    <ul class="desk-backup__formats" data-backup-main></ul>
    <h3 class="desk-np__h3" id="deskOtherTitle">Other formats</h3>
    <p>These are for reading, editing, or other tools. They aren’t backups, and the notebook page can’t restore everything from them.</p>
    <ul class="desk-backup__formats" data-backup-other></ul>
    <h3 class="desk-np__h3" id="deskOpenTitle">Merge a backup into this notebook</h3>
    <p>Adds what the backup holds to this notebook, keeping the newer copy of anything that’s in both. Nothing here is removed, and anything deleted since the backup stays deleted.</p>
    <p class="desk-backup__pick">
      <label class="desk-backup__file">
        <span class="desk-backup__file-button">Merge a backup…</span>
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
  const mainFormats = el.querySelector("[data-backup-main]");
  const otherFormats = el.querySelector("[data-backup-other]");

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
    b.textContent = f.button;
    const about = document.createElement("span");
    about.className = "desk-backup__about";
    about.textContent = f.about;
    li.append(b, about);
    (f.id === "backup" ? mainFormats : otherFormats).append(li);
    b.addEventListener("click", async () => {
      const { name } = await saveFile({ store, ctx, format: f });
      status.textContent = "";
      // A page can't see a cancelled save dialog, so it says only that the download began (NB-19).
      setTimeout(() => (status.textContent = `Started the download of ${name}. Your browser may ask where to keep it.`), 50);
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
    if (chosen.size > MAX_FILE_BYTES) {
      return showResult({ message: `That file is too large to open here (over ${MAX_FILE_BYTES / 1_000_000} MB). A notebook backup is far smaller.` });
    }
    try {
      text = await chosen.text();
    } catch (err) {
      console.error("Study Desk: the file couldn’t be read", err);
      return showResult({ message: "That file couldn’t be read. Choose a file made by “Download a full backup.”" });
    }
    showResult({ name: chosen.name, text, opened: await plan(text) });
  });

  /** The file read and planned against the notebook as it is now. */
  async function plan(text) {
    // A file malformed in a way the readers don't foresee throws; say so
    // rather than leave the reader with nothing happening (BA9).
    try {
      const local = await store.all();
      return planOpen(text, { local, ctx: ctx(), now: new Date().toISOString() });
    } catch (err) {
      console.error("Study Desk: the file couldn’t be merged", err);
      return { message: "That file couldn’t be read. Choose a file made by “Download a full backup.”" };
    }
  }

  function showResult({ message = null, name = "", text = "", opened = null, changed = false }) {
    result.replaceChildren();
    result.hidden = false;
    message ??= opened?.message ?? null;
    if (message) {
      result.append(paragraph(message, "desk-backup__message"));
      announce(message);
      return;
    }
    const { read, planned, sentence, ahead } = opened;
    const head = document.createElement("h4");
    head.className = "desk-np__h4";
    head.textContent = `Merging ${name}`;
    result.append(head);
    const since = "Your notebook has changed since you chose this file, so here is what merging it would do now.";
    if (changed) result.append(paragraph(since, "desk-backup__changed"));
    result.append(paragraph(sentence, "desk-backup__summary"));
    if (ahead) result.append(paragraph(ahead));
    for (const note of read.notes) result.append(paragraph(note));
    // Kept, with something to say about it (a deletion whose words couldn't be read, DI3-4).
    for (const w of (planned.warnings ?? []).slice(0, 10)) result.append(paragraph(w.reason));

    // What was left out, with its line when the file has lines.
    const left = [
      ...read.problems.map((p) => (p.line ? `Line ${p.line}: ${p.message}` : p.message)),
      ...planned.skipped.map((s) => `An item in this file was left out: ${s.reason}`),
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
      go.textContent = "Merge this backup";
      go.addEventListener("click", () => doImport(go, { name, text, opened }));
      actions.append(go);
    }
    actions.append(close);
    result.append(actions);
    announce(`${changed ? `${since} ` : ""}${sentence}${can ? " Choose Merge this backup to go ahead." : ""}`);
    result.focus({ preventScroll: false });
  }

  async function doImport(go, shown) {
    go.disabled = true;
    // Plan again against the notebook as it is now (BA3), and write that
    // plan; if it would do anything other than what the reader was shown, show that.
    // Read, planned and written in one transaction (DI-9), so another tab's
    // write can't land between the plan and its commit.
    let opened;
    let differs = false;
    try {
      await store.change(async ({ all }) => {
        const local = await all();
        opened = planOpen(shown.text, { local, ctx: ctx(), now: new Date().toISOString() });
        if (opened.message || !sameOpen(shown.opened, opened)) {
          differs = true;
          return null;
        }
        return planWrite(opened.planned.plan);
      });
    } catch (err) {
      console.error("Study Desk: the backup wasn’t merged", err);
      go.disabled = false;
      return announce("That couldn’t be saved in this browser. Nothing was changed. Choose Merge this backup to try again.");
    }
    if (differs) return showResult({ name: shown.name, text: shown.text, opened, changed: !opened.message });
    const { sentence } = opened;
    const entry = store.lastEntry();
    clearResult();
    file.value = "";
    result.hidden = false;
    result.append(paragraph(`Merged. ${sentence}`, "desk-backup__message"));
    announce(`Merged. ${sentence}`);
    if (entry) showUndo(`Merged a backup. ${sentence}`, () => undoEntry(entry));
  }

  function announce(message) {
    status.textContent = "";
    setTimeout(() => (status.textContent = message), 50);
  }
}
