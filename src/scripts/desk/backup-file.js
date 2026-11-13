// src/scripts/desk/backup-file.js
//
// Making a notebook file and handing it to the browser to keep: the one path
// behind /notebook's three files and the reminder's "Back up now" (E113), so
// the full backup is made, downloaded and dated the same way from both. The
// time is kept in the notebook's meta ("lastExport", an ISO string), which
// the Settings tab's line and the reminder read.
//
// Loaded on press (the reminder imports it dynamically), never by stage one.

import { exportFilename, toBackupJson, toMarkdown, toWebAnnotation } from "../../lib/desk-export.mjs";

export const LAST_EXPORT_KEY = "lastExport";

/** The files /notebook can save. Only the full backup is "a backup" (BVJ, 2026-11-13). */
export const FORMATS = [
  {
    id: "backup",
    label: "Full backup (JSON)",
    button: "Download a full backup",
    about: "Everything the notebook keeps, exactly as it is, for restoring it completely. Merge it into a notebook on another computer or browser, or into this one.",
    make: toBackupJson,
    type: "application/json;charset=utf-8",
  },
  {
    id: "markdown",
    label: "Markdown",
    button: "Download Markdown",
    about: "For reading and editing. Opens in any text editor, and words you change there come back when you merge the file here.",
    make: toMarkdown,
    type: "text/markdown;charset=utf-8",
  },
  {
    id: "webAnnotation",
    label: "Web Annotation (JSON)",
    button: "Download Web Annotation",
    about: "For other study tools. Your marks on the text in the W3C’s standard shape.",
    make: toWebAnnotation,
    type: "application/json;charset=utf-8",
  },
];

export const FULL_BACKUP = FORMATS[0];

/** Hand a file to the browser to save. */
export function download(name, text, type) {
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
 * Make one file from the whole notebook, download it, and keep the time. The
 * time is kept for every format, as it always was; a failure to keep it is
 * logged and does not undo the download.
 *
 * @param {{ store: object, ctx: () => { contentVersion: string }, format?: typeof FULL_BACKUP }} options
 * @returns {Promise<{ name: string, exported: string }>}
 */
export async function saveFile({ store, ctx, format = FULL_BACKUP }) {
  const exported = new Date().toISOString();
  const records = await store.all();
  const text = format.make(records, { exported, contentVersion: ctx().contentVersion });
  const name = exportFilename(format.id, exported);
  download(name, text, format.type);
  try {
    await store.setMeta?.(LAST_EXPORT_KEY, exported);
  } catch (err) {
    console.error("Study Desk: the time of the backup wasn’t kept", err);
  }
  return { name, exported };
}

/**
 * The reminder's "Back up now": the full backup, with the notebook opened
 * here when the page hasn't one (a reading page before the shell loads).
 */
export async function backUpNow({ store = null } = {}) {
  const { deskCtx } = await import("./desk-ctx.js");
  if (!store) {
    const { openStore } = await import("./store.js");
    store = await openStore({ ctx: deskCtx });
  }
  return saveFile({ store, ctx: deskCtx });
}
