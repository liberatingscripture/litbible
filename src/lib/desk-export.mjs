// src/lib/desk-export.mjs
//
// Saving a copy of the notebook and opening one (STUDY-DESK.md, D1 and the
// export every plan needs; STUDY-DESK-FORMAT.md, "The export file"). Three
// files, each for a different reader:
//
//   Full backup (JSON)    the format's own records, every one unchanged,
//                         trash and kinds this code doesn't know included.
//                         The one that restores a notebook completely.
//   Web Annotation (JSON) the W3C shape, for other tools: the marks on the
//                         text as annotations. Every annotation also carries
//                         the whole logical record under `lit.record`, so this
//                         file re-imports losslessly here too.
//   Markdown              for people, after the mocked file in D1: headings,
//                         the quoted words, the note. A note edited in the
//                         file comes back as an edit; a new well-formed entry
//                         comes back as a new note.
//
// Opening a copy never deletes anything because it is missing from the file
// (audit C17): a record absent from the file is simply not read. A deletion
// reaches the notebook only as a trash record, which only the full backup
// carries. Pure: no storage, no DOM, no clock unless the caller leaves `now`
// or `exported` out.
//
// Motivations in the Web Annotation file (decided here, for BVJ to confirm):
//   highlight    highlighting
//   note         commenting, or questioning when its marker is `question`
//   bookmark     bookmarking
//   footnotePin  bookmarking, with a TextQuoteSelector of the footnote's text
//   hidden       commenting, since the Web Annotation vocabulary has nothing
//                for hiding; `lit.kind` says what it really is
// Places, labels, sheets, mark rules, unknown kinds and trash records are not
// marks on the text, so they travel in the collection's own `lit.records`
// (trash only in the full backup; a deleted note's words stay out of a file
// meant for other tools).

import { BOOKS, BOOK_ABBREVIATIONS, BOOK_ORDER, bookKeyToLabel } from "../data/books.js";
import { LIT_CREDIT_LINE } from "./lit-credit.mjs";
import { osisRef } from "./osis.mjs";
import { labelMap, labelsOf } from "./desk-labels.mjs";
import { mergeRecords } from "./desk-merge.mjs";
import { MARKERS, SCHEMA_VERSION, createRecord, editRecord, proseTarget, validateRecord } from "./desk-records.mjs";
import { kindName, liveRecords, recordHref, recordReference } from "./desk-store-core.mjs";

export const ORIGIN = "https://litbible.net";
export const LICENSE_URL = `${ORIGIN}/read/#license-terms`;
/** The file format's own name and version, for the full backup and the Markdown header. */
export const BACKUP_FORMAT = "lit-notebook";
export const BACKUP_VERSION = 1;
const ANNO_CONTEXT = "http://www.w3.org/ns/anno.jsonld";
const RFC3986 = "http://tools.ietf.org/rfc/rfc3986";

const isoNow = () => new Date().toISOString();
const dateOf = (iso) => String(iso ?? "").slice(0, 10);

/** Marks on the text that become annotations. */
const ANNOTATED = new Set(["highlight", "note", "bookmark", "footnotePin", "hidden"]);

/* ── Where a record is ───────────────────────────────────────────────── */

/** The address of a record's page, in the format's form (`https://litbible.net/romans-8/#v3-4`), or null. */
export function addressOf(r) {
  if (typeof r?.glossaryId === "string" && r.glossaryId && !r.glossaryEntry) return `${ORIGIN}/glossary/#${r.glossaryId}`;
  const href = recordHref(r);
  return href ? `${ORIGIN}${href}` : null;
}

/** What a record on the text is headed with: its reference, or the glossary term it is about. */
function headingOf(r) {
  const ref = recordReference(r);
  if (ref) return ref;
  if (typeof r?.glossaryId === "string" && r.glossaryId) return `Glossary: ${r.targetTitle || r.glossaryId}`;
  return kindName(r?.kind);
}

/** Whether a record is a mark on the text or on a page (an annotation), as opposed to a place, label and so on. */
function isAnnotated(r) {
  if (!ANNOTATED.has(r?.kind)) return false;
  return Boolean(r.bookKey && r.chapter) || Boolean(proseTarget(r)) || typeof r.glossaryId === "string";
}

/* ── Full backup ─────────────────────────────────────────────────────── */

/**
 * The full backup: every record, unchanged, in the format's own JSON. Kinds
 * and fields this code doesn't know are written as they are held (principle
 * 6), and so are trash records.
 *
 * @param {object[]} records
 * @param {{ exported?: string, contentVersion?: string }} [opts]
 * @returns {string}
 */
export function toBackupJson(records, { exported = isoNow(), contentVersion = "unversioned" } = {}) {
  return JSON.stringify(
    { format: BACKUP_FORMAT, version: BACKUP_VERSION, exported, contentVersion, records },
    null,
    2,
  );
}

/* ── W3C Web Annotation ──────────────────────────────────────────────── */

function motivationOf(r) {
  switch (r.kind) {
    case "highlight":
      return "highlighting";
    case "note":
      return r.marker === "question" ? "questioning" : "commenting";
    case "bookmark":
    case "footnotePin":
      return "bookmarking";
    default:
      return "commenting";
  }
}

function textual(value, purpose) {
  return { type: "TextualBody", value, format: "text/plain", purpose };
}

/** The annotation's target: the page, and where on it. */
function targetOf(r) {
  const address = addressOf(r);
  const [source, fragment] = address ? address.split("#") : [ORIGIN + "/", ""];
  const selector = [];
  if (r.bookKey && r.verse) {
    const end = r.endVerse && r.endVerse !== r.verse ? `-${r.endVerse}` : "";
    selector.push({ type: "FragmentSelector", value: `v${r.verse}${end}`, conformsTo: RFC3986 });
  } else if (fragment) {
    selector.push({ type: "FragmentSelector", value: fragment, conformsTo: RFC3986 });
  }
  if (r.quote?.exact) {
    selector.push({ type: "TextQuoteSelector", exact: r.quote.exact, prefix: r.quote.prefix ?? "", suffix: r.quote.suffix ?? "" });
  } else if ((r.kind === "footnotePin" || r.kind === "note") && r.footnote) {
    selector.push({ type: "TextQuoteSelector", exact: r.footnote });
  }
  return selector.length ? { source, selector } : { source };
}

/** One record as an annotation, carrying the whole record under `lit.record`. */
export function toAnnotation(r, labels = new Map()) {
  const body = [];
  const words = r.kind === "bookmark" ? r.label : r.kind === "hidden" ? (r.body ?? r.note) : r.body;
  if (typeof words === "string" && words) body.push(textual(words, r.kind === "bookmark" ? "describing" : motivationOf(r)));
  for (const l of labelsOf(r, labels)) body.push(textual(l.name, "tagging"));
  const osis = r.bookKey ? osisRef(r.bookKey, r.chapter, r.verse, r.endVerse) : "";
  return {
    id: /^[0-9a-f-]{36}$/i.test(r.id) ? `urn:uuid:${r.id}` : `urn:lit-notebook:${r.id}`,
    type: "Annotation",
    motivation: motivationOf(r),
    created: r.created,
    modified: r.modified,
    ...(body.length ? { body } : {}),
    target: targetOf(r),
    lit: { kind: r.kind, ...(osis ? { osis } : {}), record: r },
  };
}

/**
 * The marks on the text as a W3C Web Annotation collection. Records that
 * aren't marks (places, labels, sheets, unknown kinds) are carried in the
 * collection's `lit.records`; trash is left out.
 */
export function webAnnotationCollection(records, { exported = isoNow(), contentVersion = "unversioned" } = {}) {
  const live = liveRecords(records);
  const labels = labelMap(live);
  const items = live.filter(isAnnotated).map((r) => toAnnotation(r, labels));
  const rest = live.filter((r) => !isAnnotated(r));
  return {
    "@context": ANNO_CONTEXT,
    type: "AnnotationCollection",
    label: "My LIT notebook",
    created: exported,
    total: items.length,
    first: { type: "AnnotationPage", items },
    lit: { format: BACKUP_FORMAT, version: BACKUP_VERSION, exported, contentVersion, records: rest },
  };
}

export function toWebAnnotation(records, opts) {
  return JSON.stringify(webAnnotationCollection(records, opts), null, 2);
}

/* ── Markdown ────────────────────────────────────────────────────────── */

const MD_TITLE = "# My LIT notebook";
const MD_END = "<!-- lit-notebook end -->";
const idComment = (id) => `<!-- lit:id=${id} -->`;
const ID_COMMENT = /^<!--\s*lit:id=(\S+?)\s*-->$/;

/** Body lines that could be read as structure get a backslash, which parsing takes off again. */
export function escapeBody(text) {
  return String(text ?? "")
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => (/^(#|>|\\|<!--)/.test(line) ? `\\${line}` : line))
    .join("\n");
}

export function unescapeBody(text) {
  return text
    .split("\n")
    .map((line) => line.replace(/^\\(?=[#>\\]|<!--)/, ""))
    .join("\n");
}

const clock = (iso) => `${dateOf(iso)} ${String(iso).slice(11, 16)}`;

/** The kind word on an entry's second line: "Note", "Note (question)", "Highlight (yellow)". */
function kindLine(r) {
  switch (r.kind) {
    case "highlight":
      return r.color ? `Highlight (${r.color})` : "Highlight";
    case "note": {
      // A note on a footnote (M11) says so, and Markdown won't make a new one,
      // since a heading names the verse and not which of its footnotes.
      const word = typeof r.footnote === "string" ? "Note on a footnote" : "Note";
      return r.marker && r.marker !== "note" ? `${word} (${r.marker})` : word;
    }
    default:
      return kindName(r.kind);
  }
}

function entryMarkdown(r, labels) {
  const lines = [`## ${headingOf(r)}`, idComment(r.id)];
  const address = addressOf(r);
  if (address) lines.push(address);
  const names = labelsOf(r, labels).map((l) => l.name);
  lines.push([kindLine(r), dateOf(r.created), ...(names.length ? [`Labels: ${names.join(", ")}`] : [])].join(" · "));
  const quoted = r.kind === "footnotePin" || (r.kind === "note" && r.footnote) ? r.footnote : r.quote?.exact;
  if (quoted) {
    lines.push("", ...String(quoted).replace(/\r\n?/g, "\n").split("\n").map((l) => `> ${l}`.trimEnd()));
  }
  const words = r.kind === "bookmark" ? r.label : r.kind === "hidden" ? (r.body ?? r.note) : r.body;
  if (typeof words === "string" && words.trim()) lines.push("", escapeBody(words.trim()));
  return lines.join("\n");
}

/**
 * The notebook as Markdown, for people. Marks on the text come first in Bible
 * order, one `##` entry each; then Places and Labels as lists; then the LIT's
 * attribution notice and the license link, since quoted words travel with the
 * file. Trash is left out.
 */
export function toMarkdown(records, { exported = isoNow() } = {}) {
  const live = liveRecords(records);
  const labels = labelMap(live);
  const entries = live.filter((r) => isAnnotated(r) && r.kind !== "place");
  const places = live.filter((r) => r.kind === "place");
  const labelRecords = [...labels.values()];
  const out = [MD_TITLE, `<!-- ${BACKUP_FORMAT} ${BACKUP_VERSION} · saved ${clock(exported)} -->`];
  for (const r of entries) out.push("", entryMarkdown(r, labels));
  if (places.length) {
    out.push("", "## Places");
    for (const p of places) {
      const ref = recordReference(p);
      const name = typeof p.name === "string" ? p.name.trim() : "";
      out.push(`- ${name ? `${name}: ${ref}` : ref} ${idComment(p.id)}`);
    }
  }
  if (labelRecords.length) {
    out.push("", "## Labels");
    for (const l of labelRecords) out.push(`- ${l.name} ${idComment(l.id)}`);
  }
  out.push("", MD_END, "", LIT_CREDIT_LINE, "", `Terms of use: ${LICENSE_URL}`, "");
  return out.join("\n");
}

/* ── Reading a reference ─────────────────────────────────────────────── */

let bookNames = null;
/** Folded book names to the site's keys: "1 corinthians", "1 cor", "romans". */
function bookByName() {
  if (bookNames) return bookNames;
  bookNames = new Map();
  const fold = (s) => s.toLowerCase().replace(/\./g, "").replace(/\s+/g, " ").trim();
  for (const key of BOOK_ORDER) {
    bookNames.set(fold(bookKeyToLabel(key)), key);
    bookNames.set(fold(BOOK_ABBREVIATIONS[key] ?? key), key);
    bookNames.set(key, key);
  }
  bookNames.fold = fold;
  return bookNames;
}

/**
 * "Romans 8:3–4" as { bookKey, chapter, verse, endVerse }; a chapter alone has
 * no verse. Null for anything that isn't a reference to a book of the New
 * Testament this site has.
 */
export function parseReference(text) {
  const m = /^(.+?)\s+(\d+)(?:\s*:\s*(\d+)(?:\s*[–—-]\s*(\d+))?)?\s*$/.exec(String(text ?? "").trim());
  if (!m) return null;
  const names = bookByName();
  const bookKey = names.get(names.fold(m[1]));
  if (!bookKey || !(bookKey in BOOKS)) return null;
  const chapter = Number(m[2]);
  if (m[3] == null) return { bookKey, chapter, verse: null, endVerse: null };
  const verse = Number(m[3]);
  return { bookKey, chapter, verse, endVerse: m[4] ? Number(m[4]) : verse };
}

/* ── Reading a file ──────────────────────────────────────────────────── */

const KIND_WORD = /^(Highlight|Note on a footnote|Note|Bookmark|Pinned footnote|Hidden passage)\b(?:\s*\(([^)]*)\))?/;

/** One `##` entry of a Markdown file, as written. */
function readEntries(text) {
  const lines = String(text).replace(/\r\n?/g, "\n").split("\n");
  const entries = [];
  let section = null; // "Places" | "Labels" | null
  let at = null;
  const finish = () => {
    if (at) entries.push(at);
    at = null;
  };
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim() === MD_END) break;
    const heading = /^##\s+(.*\S)\s*$/.exec(line);
    if (heading) {
      finish();
      const next = lines.slice(i + 1).find((l) => l.trim() !== "") ?? "";
      if ((heading[1] === "Places" || heading[1] === "Labels") && !ID_COMMENT.test(next.trim())) {
        section = heading[1];
        continue;
      }
      section = null;
      at = { line: i + 1, heading: heading[1], id: null, link: null, meta: null, quote: [], body: [], seenQuote: false, seenBody: false };
      continue;
    }
    if (section || !at) continue;
    const t = line.trim();
    // Metadata first, in any order, directly under the heading.
    if (!at.seenQuote && !at.seenBody) {
      const id = ID_COMMENT.exec(t);
      if (id && !at.id) {
        at.id = id[1];
        continue;
      }
      if (/^https?:\/\//.test(t) && !at.link) {
        at.link = t;
        continue;
      }
      if (!at.meta && KIND_WORD.test(t)) {
        at.meta = t;
        continue;
      }
      if (t === "") continue;
    }
    if (!at.seenBody && /^>/.test(line)) {
      at.seenQuote = true;
      at.quote.push(line.replace(/^>\s?/, ""));
      continue;
    }
    if (!at.seenBody && t === "") continue;
    at.seenBody = true;
    at.body.push(line);
  }
  finish();
  return entries;
}

const fail = (line, message) => ({ line, message });

function parseMarkdown(text, { local = [], ctx = {}, now = isoNow() } = {}) {
  const localById = new Map(local.filter((r) => typeof r?.id === "string").map((r) => [r.id, r]));
  const records = [];
  const problems = [];
  const entries = readEntries(text);
  for (const e of entries) {
    const word = e.meta ? KIND_WORD.exec(e.meta) : null;
    const kind = word ? word[1] : "Note";
    const qualifier = word?.[2]?.trim() ?? "";
    const body = unescapeBody(e.body.join("\n")).trim();
    const quote = e.quote.join("\n").trim();
    const have = e.id ? localById.get(e.id) : null;

    if (have) {
      // A known id: the words may have been edited. Nothing else is read back,
      // so a heading or a date edited in the file changes nothing.
      const field = have.kind === "note" ? "body" : have.kind === "bookmark" ? "label" : null;
      if (field && body !== String(have[field] ?? "").trim()) {
        if (have.kind === "note" && !body && !have.quote && !have.marker) {
          records.push(have);
        } else {
          records.push(editRecord(have, { [field]: body }, { now, client: ctx.client }));
        }
      } else {
        records.push(have);
      }
      continue;
    }

    if (kind !== "Note") {
      problems.push(
        fail(e.line, `“${e.heading}” is ${/^[AEIOU]/i.test(kind) ? "an" : "a"} ${kind.toLowerCase()}, which Markdown can’t add to this notebook. Use a full backup (JSON) to bring those over.`),
      );
      continue;
    }
    if (!body) {
      problems.push(fail(e.line, `“${e.heading}” has no note under it, so it was left out.`));
      continue;
    }
    const marker = MARKERS.includes(qualifier) ? qualifier : "note";
    const place = placeOf(e);
    if (!place) {
      problems.push(fail(e.line, `“${e.heading}” isn’t a reference this notebook can read, like “Romans 8:3–4.”`));
      continue;
    }
    if (place.verse == null && !place.type) {
      problems.push(fail(e.line, `“${e.heading}” needs a verse, like “Romans 8:3.”`));
      continue;
    }
    const fields = {
      ...place.fields,
      ...(quote ? { quote: { exact: quote, prefix: "", suffix: "" } } : {}),
      body,
      marker,
    };
    const record = createRecord("note", fields, { now, ...ctx, ...(e.id ? { id: e.id } : {}) });
    const bad = validateRecord(record);
    if (bad.length) {
      problems.push(fail(e.line, `“${e.heading}” couldn’t be added: ${bad.join("; ")}.`));
      continue;
    }
    records.push(record);
  }
  const notes = [];
  if (!entries.length) problems.push(fail(null, "No entries were found in this file."));
  notes.push("Places and labels in a Markdown file aren’t read back. Nothing is deleted because it is missing from the file.");
  return { kind: "markdown", records, problems, notes };
}

/** Where an entry without a known id points: verses, a glossary entry or an article. */
function placeOf(e) {
  const link = e.link ?? "";
  const gloss = /^https:\/\/litbible\.net\/glossary\/#([^\s#]+)$/.exec(link);
  if (gloss) {
    const title = e.heading.replace(/^Glossary:\s*/, "");
    return { type: "glossaryEntry", fields: { glossaryEntry: gloss[1], targetTitle: title } };
  }
  const article = /^https:\/\/litbible\.net\/articles\/([^/\s#]+)\/?$/.exec(link);
  if (article) return { type: "article", fields: { article: article[1], targetTitle: e.heading } };
  const ref = parseReference(e.heading);
  if (!ref) return null;
  return {
    verse: ref.verse,
    fields: { bookKey: ref.bookKey, chapter: ref.chapter, verse: ref.verse, endVerse: ref.endVerse },
  };
}

/* ── Detecting and reading any of the three ──────────────────────────── */

/**
 * Read a file the reader chose. Works out which of the three it is.
 *
 * @param {string} text
 * @param {{ local?: object[], ctx?: { client: string, contentVersion: string }, now?: string }} [opts]
 *   `local` (the notebook's records) lets a Markdown entry with a known id
 *   become an edit of that record; `ctx` stamps notes made from new entries.
 * @returns {{ kind: "backup" | "webAnnotation" | "markdown" | "unknown",
 *   records: object[], problems: { line: number | null, message: string }[], notes: string[] }}
 *   `problems` are things left out, for the reader to look over; `notes` are
 *   things worth saying that left nothing out.
 */
export function parseImport(text, opts = {}) {
  const source = String(text ?? "").replace(/^﻿/, "");
  const trimmed = source.trim();
  if (!trimmed) return { kind: "unknown", records: [], problems: [fail(null, "The file is empty.")], notes: [] };

  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    let data;
    try {
      data = JSON.parse(trimmed);
    } catch {
      return { kind: "unknown", records: [], problems: [fail(null, "This looks like JSON but couldn’t be read.")], notes: [] };
    }
    if (data && !Array.isArray(data) && data.format === BACKUP_FORMAT) return parseBackup(data);
    if (isAnnotation(data)) return parseAnnotations(data);
    return { kind: "unknown", records: [], problems: [fail(null, "This isn’t a notebook file this page knows how to open.")], notes: [] };
  }
  if (/^\s*#\s+My LIT notebook\b/m.test(source) || /<!--\s*lit-notebook\b/.test(source)) return parseMarkdown(source, opts);
  return { kind: "unknown", records: [], problems: [fail(null, "This isn’t a notebook file this page knows how to open.")], notes: [] };
}

function parseBackup(data) {
  const notes = [];
  const problems = [];
  if (!Array.isArray(data.records)) {
    return { kind: "backup", records: [], problems: [fail(null, "This backup has no list of records.")], notes };
  }
  if (Number.isFinite(data.version) && data.version > BACKUP_VERSION) {
    notes.push("This copy was saved by a newer version of the notebook. Anything this version doesn’t know is kept as it is.");
  }
  return { kind: "backup", records: data.records, problems, notes };
}

function isAnnotation(data) {
  if (!data || typeof data !== "object") return false;
  const ctx = JSON.stringify(data["@context"] ?? "");
  return /w3\.org\/ns\/anno/.test(ctx) || ["AnnotationCollection", "AnnotationPage", "Annotation"].includes(data.type);
}

function parseAnnotations(data) {
  const items = Array.isArray(data) ? data : data.type === "Annotation" ? [data] : (data.first?.items ?? data.items ?? []);
  const records = [];
  const problems = [];
  const notes = [];
  items.forEach((a, i) => {
    const record = a?.lit?.record;
    if (record && typeof record === "object") records.push(record);
    else problems.push(fail(null, `Annotation ${i + 1}${a?.id ? ` (${a.id})` : ""} wasn’t made by the LIT notebook, so it was left out.`));
  });
  if (Array.isArray(data.lit?.records)) records.push(...data.lit.records);
  if (data.lit?.version > BACKUP_VERSION) {
    notes.push("This copy was saved by a newer version of the notebook. Anything this version doesn’t know is kept as it is.");
  }
  return { kind: "webAnnotation", records, problems, notes };
}

/* ── Planning an import ──────────────────────────────────────────────── */

/** JSON with keys sorted, so equal records compare equal. */
function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .filter((k) => value[k] !== undefined)
      .map((k) => `${JSON.stringify(k)}:${canonical(value[k])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

const same = (a, b) => canonical(a) === canonical(b);

/**
 * What opening a copy would do, before anything is written. Merged with the
 * merge engine (desk-merge.mjs), so the newer writing wins for every kind,
 * a deletion and an edit settle by the later action, and a copy that is
 * older than what is here changes nothing. A record that is malformed is
 * reported and left out, never written.
 *
 * @param {object[]} local what the notebook holds now, trash included
 * @param {object[]} incoming the records read from the file
 * @param {{ now?: string, tiebreak?: Function }} [ctx]
 * @returns {{ plan: { put: object[], remove: string[] },
 *   summary: { added: number, updated: number, unchanged: number, keptHere: number, deleted: number, skipped: number },
 *   skipped: { record: unknown, reason: string }[] }}
 *   `keptHere` counts records whose copy here is newer, or whose deletion
 *   here stands; `deleted` those the file deletes.
 */
export function planImport(local, incoming, ctx = {}) {
  const skipped = [];
  const usable = [];
  for (const r of incoming ?? []) {
    const bad = r && typeof r === "object" && r.kind !== "trash" ? validateRecord(r) : [];
    if (bad.length) skipped.push({ record: r, reason: `${bad.join("; ")}.`.replace(/^./, (c) => c.toUpperCase()) });
    else usable.push(r);
  }
  const merged = mergeRecords(local, usable, { now: ctx.now, tiebreak: ctx.tiebreak });
  skipped.push(...merged.skipped);

  const was = new Map(local.filter((r) => typeof r?.id === "string").map((r) => [r.id, r]));
  const now = new Map(was);
  for (const id of merged.remove) now.delete(id);
  for (const r of merged.put) now.set(r.id, r);

  const rejected = new Set(merged.skipped.map((s) => s.record));
  const counted = new Set();
  const summary = { added: 0, updated: 0, unchanged: 0, keptHere: 0, deleted: 0, skipped: skipped.length };
  for (const r of usable) {
    if (rejected.has(r) || typeof r.id !== "string" || counted.has(r.id)) continue;
    if (r.kind === "trash") {
      const live = was.get(r.deletedId);
      if (live && live.kind !== "trash" && !now.has(r.deletedId)) summary.deleted++;
      continue;
    }
    counted.add(r.id);
    const before = was.get(r.id);
    const after = now.get(r.id);
    if (!before) {
      if (after) summary.added++;
      else summary.keptHere++;
    } else if (!after) {
      summary.keptHere++;
    } else if (!same(before, after)) {
      summary.updated++;
    } else if (same(before, r)) {
      summary.unchanged++;
    } else {
      summary.keptHere++;
    }
  }
  return { plan: { put: merged.put, remove: merged.remove }, summary, skipped };
}

/** A plain sentence for a summary: "3 new, 1 updated, 12 already here." */
export function describeSummary(s) {
  const parts = [];
  if (s.added) parts.push(`${s.added} new`);
  if (s.updated) parts.push(`${s.updated} updated`);
  if (s.deleted) parts.push(`${s.deleted} deleted`);
  if (s.unchanged) parts.push(`${s.unchanged} already here`);
  if (s.keptHere) parts.push(`${s.keptHere} kept as they are here (yours ${s.keptHere === 1 ? "is" : "are"} newer)`);
  if (s.skipped) parts.push(`${s.skipped} left out`);
  return parts.length ? `${parts.join(", ")}.` : "Nothing to open in this file.";
}

/** Whether a plan would change anything. */
export const planChanges = (plan) => plan.put.length > 0 || plan.remove.length > 0;

/* ── Names and times ─────────────────────────────────────────────────── */

const EXTENSIONS = { markdown: ".md", webAnnotation: ".annotations.json", backup: ".json" };

/** `lit-notebook-2026-10-12.md` (or `.annotations.json`, `.json`). */
export function exportFilename(format, now = isoNow()) {
  return `lit-notebook-${dateOf(now)}${EXTENSIONS[format] ?? ".json"}`;
}

/** "Last saved a copy: 3 days ago", or "Not saved yet." */
export function describeLastExport(iso, now = isoNow()) {
  const then = Date.parse(iso);
  if (typeof iso !== "string" || Number.isNaN(then)) return "Not saved yet.";
  const minutes = Math.floor((Date.parse(now) - then) / 60_000);
  const ago = (n, unit) => `${n} ${unit}${n === 1 ? "" : "s"} ago`;
  let when;
  if (minutes < 1) when = "just now";
  else if (minutes < 60) when = ago(minutes, "minute");
  else if (minutes < 60 * 24) when = ago(Math.floor(minutes / 60), "hour");
  else when = ago(Math.floor(minutes / (60 * 24)), "day");
  return `Last saved a copy: ${when}.`;
}

export { SCHEMA_VERSION };
