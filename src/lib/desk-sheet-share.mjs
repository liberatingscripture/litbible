// src/lib/desk-sheet-share.mjs
//
// Sharing a sheet without a server (STUDY-DESK.md, S8; "Order of work", 3k;
// STUDY-DESK-FORMAT.md, "Sharing a sheet"). A shared sheet travels whole,
// either in a link's fragment, the part after the `#` that a browser never
// sends to a server, or in a Markdown file that carries the same data on its
// last line. Nothing is stored anywhere but in the link or the file.
//
//   https://litbible.net/sheets/#share1.<data>
//
// `<data>` is the shared sheet as JSON, compressed with raw DEFLATE and
// written in base64url. The shared sheet is the sheet's own fields and
// modules, less what means nothing to anyone else: the record's own fields
// (id, client, times, labels), each module's id, and the passages' comparison
// copies (`verseCopy`, which hold scripture and are compared with nothing on
// the other side). A participant share also leaves out the parts marked
// Leader only, the questions' answers and every part of a type this version
// doesn't know (whose fields it can't vouch for), so the link can go to the
// room.
//
// Opening one never trusts it: the data is decompressed with a ceiling (a
// small link can't grow into something huge), parsed, rebuilt as a sheet
// record with fresh ids, and put through the same check a sheet must pass to
// be saved (validateSheet). Its formatted text is sanitized again when shown,
// as every sheet's is (sheetHtmlForShow).
//
// Pure apart from CompressionStream and DecompressionStream, which browsers
// and Node both provide; no DOM, no storage. Each function that needs an id,
// a clock or a client takes them from the caller's `ctx`, as createRecord does.

import { bookKeyToLabel } from "../data/books.js";
import { createRecord, validateRecord } from "./desk-records.mjs";
import { MODULE_TYPES, SHEET_FORMAT, SHEET_LIMITS } from "./desk-sheet-format.mjs";

/** The fragment's prefix: "share", then the share format's version, then a dot. */
export const SHARE_PREFIX = "share1.";
/** The page a shared link opens. */
export const SHARE_PATH = "sheets/";
/** What a share holds: everything, or the participant copy's parts only. */
export const SHARE_SCOPES = Object.freeze(["leader", "participant"]);
/**
 * The longest link offered as a code to scan. A QR code holds about 2,900
 * characters at its lowest error correction, but past about 1,000 its squares
 * get too small to scan from a printed page or a screen across a table.
 */
export const QR_LINK_LIMIT = 1000;
/**
 * The file's data line: an HTML comment, so a Markdown viewer shows nothing of
 * it. Whitespace inside the data is allowed and removed, since an email client
 * may fold a long line (BA87). The file writes its data line last, so the last
 * match is the one taken (BA80). The data's characters and the whitespace
 * between them are matched as separate runs, never one class with `\s` in
 * it, which would retry the closing `\s*-->` at every space (quadratic on a
 * crafted file).
 */
const DATA_LINE = /<!--\s*lit-sheet\s+(share1\.[A-Za-z0-9_-]*(?:\s+[A-Za-z0-9_-]+)*)\s*-->/g;
/** A data line's opener, to tell a damaged data line from a file with none. */
const DATA_OPENER = /<!--\s*lit-sheet\b/;
/** Decompressed data larger than this is refused (the sheet limit with room for JSON's own). */
const MAX_JSON_BYTES = SHEET_LIMITS.bytes * 2;

/** Module fields that never travel. */
const DROP = new Set(["id", "verseCopy", "verseCopyAsOf"]);

/* ── base64url ───────────────────────────────────────────────────────── */

function toBase64Url(bytes) {
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(text) {
  if (!/^[A-Za-z0-9_-]*$/.test(text)) throw new ShareError("damaged");
  const b64 = text.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((text.length + 3) % 4);
  let bin;
  try {
    bin = atob(b64);
  } catch (_) {
    throw new ShareError("damaged");
  }
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/* ── Compression ─────────────────────────────────────────────────────── */

async function deflate(bytes) {
  const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** Inflated bytes, refusing to read past `limit`. */
async function inflate(bytes, limit) {
  const reader = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("deflate-raw")).getReader();
  const parts = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > limit) {
        reader.cancel().catch(() => {});
        throw new ShareError("too-large");
      }
      parts.push(value);
    }
  } catch (err) {
    if (err instanceof ShareError) throw err;
    throw new ShareError("damaged");
  }
  const out = new Uint8Array(size);
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}

/* ── Errors ──────────────────────────────────────────────────────────── */

/** Why a shared sheet can't be opened, in words for the reader. */
export const SHARE_ERRORS = Object.freeze({
  damaged: "This link or file is damaged, perhaps cut short when it was sent. Ask for it again.",
  "too-large": "This link or file holds more than a sheet can, so it wasn’t opened.",
  "not-a-sheet": "This link or file doesn’t hold a sheet from the Study Desk.",
  newer: "This sheet was shared from a newer version of the LIT. Reload the page to try again.",
  invalid: "This sheet couldn’t be read. Ask for it again.",
  "no-data": "This file doesn’t hold a shared sheet. A shared sheet’s file is one saved with “Save as a file.”",
});

export class ShareError extends Error {
  /** @param {keyof typeof SHARE_ERRORS} code */
  constructor(code, detail = "") {
    super(SHARE_ERRORS[code] ?? SHARE_ERRORS.invalid);
    this.code = code;
    this.detail = detail;
  }
}

/* ── Making a share ──────────────────────────────────────────────────── */

function plainModule(m, scope) {
  const out = {};
  for (const [k, v] of Object.entries(m)) if (!DROP.has(k) && v !== undefined) out[k] = v;
  if (scope === "participant" && m.type === "question") out.answer = "";
  return out;
}

/**
 * What a share of `sheet` holds, as a plain object: the shared sheet's JSON.
 *
 * @param {object} sheet a sheet record
 * @param {{ scope?: "leader" | "participant" }} [opts]
 */
export function sharedSheet(sheet, { scope = "leader" } = {}) {
  if (sheet?.kind !== "sheet") throw new Error("desk-sheet-share: not a sheet");
  if (!SHARE_SCOPES.includes(scope)) throw new Error(`desk-sheet-share: unknown scope "${scope}"`);
  const modules = (sheet.modules ?? [])
    // A participant share has what the participant copy prints (modulesForCopy):
    // no Leader only part, and no part of a type this version doesn't know (BA81).
    .filter((m) => scope === "leader" || (m?.leaderOnly !== true && MODULE_TYPES.includes(m?.type)))
    .map((m) => plainModule(m, scope));
  const out = {
    lit: "sheet",
    sheetFormat: sheet.sheetFormat ?? SHEET_FORMAT,
    scope,
    title: sheet.title ?? "",
    subtitle: sheet.subtitle ?? "",
    template: sheet.template || "blank",
    contentVersion: sheet.contentVersion ?? "unversioned",
    modules,
  };
  if (sheet.commercial === true) out.commercial = true;
  return out;
}

/** The fragment for `sheet` (without the `#`): "share1." and the data. */
export async function shareFragment(sheet, opts) {
  const json = JSON.stringify(sharedSheet(sheet, opts));
  return SHARE_PREFIX + toBase64Url(await deflate(new TextEncoder().encode(json)));
}

/** The whole link, on `origin` ("https://litbible.net"). */
export async function shareLink(sheet, { origin, base = "/", ...opts } = {}) {
  const root = String(base).replace(/\/?$/, "/");
  return `${origin}${root}${SHARE_PATH}#${await shareFragment(sheet, opts)}`;
}

/* ── The file ────────────────────────────────────────────────────────── */

/** Formatted text as plain lines, for the human half of the file. */
export function plainText(html) {
  return String(html ?? "")
    .replace(/<li[^>]*>/gi, "\n- ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/li>/gi, "")
    .replace(/<\/(p|h2|h3|blockquote|ul|ol)>/gi, "\n")
    .replace(/<hr[^>]*>/gi, "\n---\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&amp;/g, "&")
    // A sheet's own text can't plant a data line in the file (BA80).
    .replace(/<!--/g, "&lt;!--")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function passageLabel(m) {
  const end = m.endVerse ?? m.verse;
  return `${bookKeyToLabel(m.bookKey)} ${m.chapter}:${m.verse}${end > m.verse ? "–" + end : ""}`;
}

/** The parts of a shared sheet in words, one block each, for the file. */
function describeModules(modules) {
  const out = [];
  for (const m of modules) {
    const leader = m.leaderOnly ? " (Leader only)" : "";
    switch (m.type) {
      case "passage":
        out.push(`## ${passageLabel(m)}${leader}`);
        break;
      case "text": {
        const t = plainText(m.html);
        if (t) out.push(leader ? `${t}\n\n_(Leader only)_` : t);
        break;
      }
      case "question": {
        const q = plainText(m.html);
        if (q) out.push(`**Question${leader}:** ${q}`);
        const a = plainText(m.answer);
        if (a) out.push(`**Answer:** ${a}`);
        break;
      }
      case "keyTerms":
        out.push(`_Key terms box${leader}_`);
        break;
      default:
        break;
    }
  }
  return out;
}

/**
 * A Markdown file of the shared sheet: its title, its parts in words (the
 * passages by reference, never their text), how to open it, and the data on
 * its last line.
 */
export async function shareFile(sheet, opts = {}) {
  const shared = sharedSheet(sheet, opts);
  const fragment = await shareFragment(sheet, opts);
  const head = [`# ${shared.title.trim() || "Untitled sheet"}`];
  if (shared.subtitle.trim()) head.push(shared.subtitle.trim());
  const how =
    "A sheet from the Study Desk on litbible.net. To open it, go to https://litbible.net/sheets/ on a computer and choose “Open a shared file.” The passages are read from the LIT when it is opened, so they are named here, not quoted.";
  return [...head, "", how, "", ...describeModules(shared.modules).flatMap((b) => [b, ""]), `<!-- lit-sheet ${fragment} -->`, ""].join("\n");
}

/** A file name for the shared sheet's file. */
export function shareFileName(sheet) {
  const slug = String(sheet?.title ?? "")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return `${slug || "sheet"}.lit-sheet.md`;
}

/**
 * The fragment a shared sheet's file carries, or null when it has no data
 * line. Throws ShareError("damaged") when a data line is begun but can't be
 * read, so the reader is told to ask for the file again (BA87).
 */
export function fragmentInFile(text) {
  const str = String(text ?? "");
  let last = null;
  for (const m of str.matchAll(DATA_LINE)) last = m[1];
  if (last !== null) return last.replace(/\s+/g, "");
  if (DATA_OPENER.test(str)) throw new ShareError("damaged");
  return null;
}

/* ── Opening a share ─────────────────────────────────────────────────── */

/** Whether a fragment (with or without its `#`) is a shared sheet's. */
export const isShareFragment = (fragment) => String(fragment ?? "").replace(/^#/, "").startsWith(SHARE_PREFIX);

/**
 * The shared sheet a fragment holds, as a sheet record ready to show (not
 * yet saved anywhere), with `scope` beside it. Throws a ShareError.
 *
 * @param {string} fragment with or without its `#`
 * @param {{ now?: string, client: string, id?: string, newId?: () => string }} ctx
 * @returns {Promise<{ sheet: object, scope: "leader" | "participant" }>}
 */
export async function openShare(fragment, ctx) {
  const text = String(fragment ?? "").replace(/^#/, "");
  if (!text.startsWith(SHARE_PREFIX)) throw new ShareError("not-a-sheet");
  const bytes = await inflate(fromBase64Url(text.slice(SHARE_PREFIX.length)), MAX_JSON_BYTES);
  let data;
  try {
    data = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch (_) {
    throw new ShareError("damaged");
  }
  return { sheet: sheetFromShared(data, ctx), scope: data.scope === "participant" ? "participant" : "leader" };
}

/** The shared sheet `data` as a sheet record with fresh ids. Throws a ShareError. */
export function sheetFromShared(data, { now, client, id, newId = () => globalThis.crypto.randomUUID() } = {}) {
  if (data?.lit !== "sheet" || !Array.isArray(data.modules)) throw new ShareError("not-a-sheet");
  if (!Number.isInteger(data.sheetFormat) || data.sheetFormat < 1) throw new ShareError("invalid", "sheetFormat");
  if (data.sheetFormat > SHEET_FORMAT) throw new ShareError("newer");
  const modules = data.modules.map((m) => {
    if (!m || typeof m !== "object" || Array.isArray(m)) throw new ShareError("invalid", "module");
    // What never travels is dropped here too, whatever a crafted share holds,
    // so a shared sheet is never flagged as changed (BA82).
    const rest = {};
    for (const [k, v] of Object.entries(m)) if (!DROP.has(k)) rest[k] = v;
    return { id: newId(), ...rest };
  });
  const fields = {
    sheetFormat: data.sheetFormat,
    title: typeof data.title === "string" ? data.title : "",
    subtitle: typeof data.subtitle === "string" ? data.subtitle : "",
    template: typeof data.template === "string" && data.template ? data.template : "blank",
    commercial: data.commercial === true,
    modules,
  };
  const contentVersion = typeof data.contentVersion === "string" ? data.contentVersion : "unversioned";
  const sheet = createRecord("sheet", fields, { now, client, contentVersion, id: id ?? newId() });
  const problems = validateRecord(sheet);
  if (problems.length) throw new ShareError("invalid", problems.join("; "));
  return sheet;
}

/**
 * The shared sheet as the reader's own, to save: the same sheet with a fresh
 * id and fresh times, made by this client, so it is a new sheet in their
 * notebook and the sender's is untouched.
 */
export function copyOfShared(sheet, { now, client, contentVersion, id, newId = () => globalThis.crypto.randomUUID() } = {}) {
  const { id: _i, kind: _k, schema: _s, created: _c, modified: _m, client: _cl, contentVersion: cv, labels: _l, ...fields } = sheet;
  return createRecord("sheet", { ...fields, modules: fields.modules.map((m) => ({ ...m, id: newId() })) }, {
    now,
    client,
    contentVersion: contentVersion ?? cv,
    id: id ?? newId(),
  });
}
