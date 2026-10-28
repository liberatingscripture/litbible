/**
 * The Apps Page Studio board: BDR edits the /apps page here, and the
 * edits go to Claude as numbered requests.
 *
 * Its data lives in the artifact's db:
 *   studio/page       the page as it stands on main; Claude writes it from
 *                     `npm run studio:apps -- seed` after every publish
 *   studio/draft      edits not sent yet: { changes: { <key>: change }, message }
 *   requests/r0001…   sent batches, which Claude updates as it works on them
 * and uploaded pictures in its asset store. The change format, and every
 * rule about applying one, is ../core.mjs, imported here as it is: what the
 * board shows is what the apply step will write.
 *
 * Layout of the published artifact (the files map in
 * .claude/skills/apps-studio/SKILL.md): index.html at the root, this folder
 * as board/, core.mjs and frontmatter.mjs beside index.html, and the site's
 * pictures under site/assets/.
 */
import { applyChanges, deepEqual, RULES, slotFor, slugify, textWarnings, validateModel } from "../core.mjs";
import {
  CALLOUT_FIELDS, EXAMPLE_FIELDS, escapeHtml as esc, ICONS, KINDS, parsePathKey, pathKey, renderPage, smartQuotes,
} from "./page.js";

const $ = (s, root = document) => root.querySelector(s);
const $$ = (s, root = document) => [...root.querySelectorAll(s)];

const DEVICES = { desktop: ["Desktop", 1440], tablet: ["Tablet", 820], phone: ["Phone", 390] };
const OPEN = new Set(["sent", "working", "needs-you", "review"]);
const STATUS = {
  sent: "Sent", working: "Claude is on it", "needs-you": "Needs your answer", review: "Ready to review",
  live: "Live", withdrawn: "Withdrawn", closed: "Closed",
};
const BACKGROUNDS = {
  plain: "Plain", soft: "Soft gray", advent: "Advent blue", christmas: "Christmas red",
  lent: "Lent purple", easter: "Easter gold", ot: "Ordinary green", green: "LIT green",
};
const ACCENTS = { advent: "Advent", christmas: "Christmas", lent: "Lent", easter: "Easter", ot: "Ordinary Time" };
/** Each color's light and dark value (apps.css, global.css), for swatches drawn outside the page. */
const HUES = {
  advent: ["#1A4FA0", "#6BA3E8"], christmas: ["#C62D25", "#F05252"], lent: ["#800080", "#CC66CC"],
  easter: ["#A67C00", "#E0B93A"], ot: ["#186420", "#4DB84D"], green: ["#209D50", "#209D50"],
};
const RESULT = {
  applied: ["Applied", "good"], already: ["Already so", "good"], conflict: ["Needs a look", "warn"],
  manual: ["Claude does by hand", "sel"], skipped: ["Skipped", "warn"],
};

const st = {
  db: null,
  assets: null,
  seed: null,
  draft: { changes: {}, message: "" },
  requests: [],
  selection: null,
  device: "desktop",
  pageTheme: "light",
  showChanges: true,
  preview: false,
  season: 0,
  tab: "edit",
  dirty: false,
  saving: false,
  readOnly: false,
  blobUrls: new Map(),
};

const els = {
  bar: $("#bar"), canvas: $("#canvas"), sheet: $("#sheet"), replica: $("#replica"), status: $("#status"),
  notice: $("#notice"), count: $("#count"), reqCount: $("#req-count"), sendN: $("#send-n"),
  reviewSend: $("#review-send"), widthLabel: $("#width-label"), seedLabel: $("#seed-label"),
  file: $("#file"), toastEl: $("#toast"),
  panels: { edit: $("#panel-edit"), changes: $("#panel-changes"), requests: $("#panel-requests") },
};

// --- Small helpers ---------------------------------------------------------------

const clone = (v) => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));
const getAt = (obj, keys) => keys.reduce((o, k) => (o == null ? undefined : o[k]), obj);
const byOrder = (a, b) => (a.order ?? 0) - (b.order ?? 0);
const byAt = (a, b) => (a.at ?? 0) - (b.at ?? 0);
const plain = (s) => String(s ?? "").replace(/\*/g, "").replace(/\s+/g, " ").trim();
const short = (s, n = 60) => { const t = plain(s); return t.length > n ? `${t.slice(0, n - 1)}…` : t; };

function rgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function mix(hex, amount, baseHex) {
  const a = rgb(hex);
  const b = rgb(baseHex);
  return `rgb(${a.map((v, i) => Math.round(v * amount + b[i] * (1 - amount))).join(", ")})`;
}
/** A band's color in light and dark, as apps.css mixes it. */
function bandColors(bg) {
  if (bg === "plain") return ["#FAFAF8", "#1d1d1f"];
  if (bg === "soft") return ["#F2F2EE", "#161617"];
  const [light, dark] = HUES[bg];
  return [mix(light, 0.08, "#FAFAF8"), mix(dark, 0.15, "#161617")];
}

function store(key, value) {
  try {
    if (value === undefined) return localStorage.getItem(`apps-studio:${key}`);
    localStorage.setItem(`apps-studio:${key}`, value);
  } catch { return null; }
  return value;
}

let toastTimer = null;
function toast(text) {
  els.toastEl.textContent = text;
  els.toastEl.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { els.toastEl.hidden = true; }, 5200);
}

function setStatus(state, text) {
  els.status.dataset.state = state;
  els.status.textContent = text;
}

function showNotice(html) {
  els.notice.innerHTML = html;
  els.notice.hidden = !html;
}

// --- The model: the page, with sent and unsent edits laid over it ------------------

const seedModel = () => {
  const s = st.seed;
  return { format: s.format, page: s.page, sections: s.sections, callouts: s.callouts, examples: s.examples, seasons: s.seasons };
};
const draftList = (except) => Object.values(st.draft.changes).filter((c) => c.key !== except).sort(byAt);
const openRequests = () => st.requests.filter((r) => OPEN.has(r.status)).sort((a, b) => a.number - b.number);
const pendingList = () => openRequests().flatMap((r) => r.changes ?? []);

/** core.mjs's rule for which kind of picture a place holds. */
function slotOf(path) {
  try { return slotFor(path); } catch { return "picture"; }
}

/** An uploaded picture's size once it ships, for drawing it at the right shape now. */
function shippedSize(c) {
  const spec = RULES.slots[slotOf(c.path)];
  const w = c.upload?.width || 1;
  const h = c.upload?.height || 1;
  if (spec?.square) return { width: spec.longest, height: spec.longest };
  const k = spec?.longest ? Math.min(1, spec.longest / Math.max(w, h)) : 1;
  return { width: Math.round(w * k), height: Math.round(h * k) };
}

function build(changes) {
  const images = {};
  for (const c of changes) {
    if (c.op === "image" && c.upload?.asset) images[c.key] = { src: `/_blob/${c.upload.asset}`, ...shippedSize(c) };
  }
  return applyChanges(seedModel(), changes, { images });
}

let memo = null;
function current() {
  if (!memo) {
    const draft = draftList();
    const all = build([...pendingList(), ...draft]);
    const results = Object.fromEntries(all.results.map((r) => [r.key, r]));
    memo = { model: all.model, results, live: seedModel() };
  }
  return memo;
}
const invalidate = () => { memo = null; };
const shown = () => (st.showChanges ? current().model : current().live);
/** The model a change is made against: everything except that change itself. */
const baseFor = (key) => build([...pendingList(), ...draftList(key)]).model;

function valueAt(model, path) {
  const [where, id, ...keys] = path;
  if (where === "page") return getAt(model.page, [id, ...keys]);
  if (where === "files") return id;
  const entry = model[where]?.find((e) => e.id === id);
  return keys.length ? getAt(entry, keys) : entry;
}

/** Where an uploaded or replaced icon is drawn from now. */
function iconOverride(src) {
  const all = st.showChanges ? [...pendingList(), ...draftList()] : [];
  const c = all.filter((x) => x.op === "image" && x.path[0] === "files" && x.path[1] === src).pop();
  return c?.upload?.asset ? `/_blob/${c.upload.asset}` : null;
}

function imgUrl(src) {
  if (!src) return "data:image/gif;base64,R0lGODlhAQABAAAAACw=";
  const blob = /^\/_blob\/(.+)$/.exec(src);
  if (blob) return st.blobUrls.get(blob[1]) ?? src;
  const icon = iconOverride(src);
  if (icon) return imgUrl(icon);
  return `site${src}`;
}

/** Every path a draft edit touches, so the page can mark them. */
function changedPaths() {
  const out = new Set();
  for (const c of draftList()) if (c.path) out.add(pathKey(c.path));
  return out;
}

// --- Labels --------------------------------------------------------------------------

function entryName(model, coll, id) {
  const e = model[coll]?.find((x) => x.id === id);
  if (coll === "sections") return e ? (KINDS[e.kind]?.name ?? e.kind) + (st.seed?.sections.some((s) => s.id === id) ? "" : " (copy)") : id;
  if (coll === "callouts") return `Callout: ${short(e?.title ?? id, 40)}`;
  if (coll === "seasons") return `Carousel: ${e?.name ?? id}`;
  if (coll === "examples") return `Comparison: ${e?.reference ?? id}`;
  return id;
}

function fieldLabel(path) {
  const [where, id, ...keys] = path.map(String);
  const model = current().model;
  if (where === "page") return { title: "Page title (search and sharing)", description: "Page description (search and sharing)" }[id] ?? id;
  if (where === "files") return id.endsWith(".svg") ? "Android app icon" : "iOS app icon";
  const k = keys.join("/");
  if (where === "sections") {
    const s = model.sections.find((x) => x.id === id);
    const f = KINDS[s?.kind]?.fields?.[k];
    if (f) return f[0];
    if (/^buttons\/\d+/.test(k)) return `Button ${Number(keys[1]) + 1}`;
    if (k === "link") return "Link";
    const named = { "phones/back": "Back phone", "phones/front": "Front phone", "devices/tablet": "Tablet picture", "devices/foldable": "Foldable picture" };
    if (named[k]) return named[k];
    if (getAt(s, keys)?.src !== undefined) return `${keys[keys.length - 1].replace(/^./, (ch) => ch.toUpperCase())} picture`;
    return { background: "Background", hidden: "Shown on the page" }[k] ?? k;
  }
  if (where === "callouts") return CALLOUT_FIELDS[k]?.[0] ?? { accent: "Season color", imageSide: "Picture side", platform: "Platform", mode: "Screen mode", image: "Picture" }[k] ?? k;
  if (where === "examples") return EXAMPLE_FIELDS[k]?.[0] ?? { comparison: "Compared with", placement: "Shown" }[k] ?? k;
  if (where === "seasons") return { name: "Season name", image: "Screenshot" }[k] ?? k;
  return k;
}

function groupOf(c) {
  const model = current().model;
  if (c.op === "order") return { sections: "Page order", callouts: "Callouts", seasons: "Carousel" }[c.collection];
  if (c.op === "add" || c.op === "remove") return entryName({ ...model, [c.collection]: [...model[c.collection], { id: c.id, ...(c.data ?? c.before ?? {}) }] }, c.collection, c.id);
  if (c.op === "note") return c.anchor ? anchorName(c.anchor) : "Notes for Claude";
  const [where, id] = c.path;
  if (where === "page") return "Search and sharing";
  if (where === "files") return "App icons";
  return entryName(model, where, id);
}

// --- Making changes ---------------------------------------------------------------------

function keyOf(c) {
  switch (c.op) {
    case "set": return `set:${pathKey(c.path)}`;
    case "image": return `image:${pathKey(c.path)}`;
    case "add": return `add:${c.collection}/${c.id}`;
    case "remove": return `remove:${c.collection}/${c.id}`;
    case "order": return `order:${c.collection}`;
    default: return c.key;
  }
}
const addFor = (path) => st.draft.changes[`add:${path[0]}/${path[1]}`];

function setDeep(obj, keys, value) {
  let o = obj;
  for (const k of keys.slice(0, -1)) o = o[k];
  const last = keys[keys.length - 1];
  if (value === undefined) delete o[last];
  else o[last] = value;
}

/** Record that a field now reads `after` (or forget the change, if that's what it said before). */
function setField(path, after, { quiet = false } = {}) {
  path = path.map(String);
  if (path[path.length - 1] === "hidden" && after === false) after = undefined;
  const add = addFor(path);
  if (add) {
    setDeep(add.data, path.slice(2), clone(after));
    return quiet ? changedQuietly() : changed();
  }
  const key = `set:${pathKey(path)}`;
  const prev = st.draft.changes[key];
  const before = prev ? prev.before : clone(valueAt(baseFor(key), path));
  if (deepEqual(before, after)) delete st.draft.changes[key];
  else st.draft.changes[key] = { key, op: "set", path, before, after: clone(after), label: fieldLabel(path), note: prev?.note ?? "", at: prev?.at ?? Date.now() };
  return quiet ? changedQuietly() : changed();
}

function changed() {
  invalidate();
  normalizeOrders();
  invalidate();
  queueSave();
  renderAll();
}
function changedQuietly() {
  invalidate();
  queueSave();
  renderReplica();
  renderCounts();
}

const listOf = (model, coll) => [...model[coll]].sort(byOrder).map((e) => e.id);

/** Keep each reorder a reordering of the list as it now stands, after adds and removals. */
function normalizeOrders() {
  for (const coll of ["sections", "callouts", "seasons"]) {
    const key = `order:${coll}`;
    const c = st.draft.changes[key];
    if (!c) continue;
    const base = listOf(baseFor(key), coll);
    const after = c.after.filter((id) => base.includes(id));
    base.forEach((id, i) => { if (!after.includes(id)) after.splice(Math.min(i, after.length), 0, id); });
    if (deepEqual(after, base)) delete st.draft.changes[key];
    else Object.assign(c, { before: base, after });
  }
}

function move(coll, id, dir) {
  const key = `order:${coll}`;
  const list = listOf(current().model, coll);
  const i = list.indexOf(id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= list.length) return;
  [list[i], list[j]] = [list[j], list[i]];
  const before = listOf(baseFor(key), coll);
  if (deepEqual(before, list)) delete st.draft.changes[key];
  else st.draft.changes[key] = { key, op: "order", collection: coll, before, after: list, label: { sections: "Page order", callouts: "Callout order", seasons: "Carousel order" }[coll], at: st.draft.changes[key]?.at ?? Date.now() };
  changed();
}

function uniqueId(coll, stem) {
  const taken = new Set(current().model[coll].map((e) => e.id));
  if (!taken.has(stem)) return stem;
  let n = 2;
  while (taken.has(`${stem}-${n}`)) n++;
  return `${stem}-${n}`;
}

function addCallout(afterId, template) {
  const id = uniqueId("callouts", "new-callout");
  const data = template
    ? (({ id: _i, order: _o, ...rest }) => clone(rest))(template)
    : { title: "A new feature.", platform: "ios", mode: "light", accent: "advent", imageSide: "right", image: "", body: "Say what it does, and why a reader would care." };
  const after = afterId ?? listOf(current().model, "callouts").pop();
  const key = `add:callouts/${id}`;
  st.draft.changes[key] = { key, op: "add", collection: "callouts", id, after, data, label: template ? "Copy of a callout" : "New callout", note: "", at: Date.now() };
  st.selection = { type: "callout", id };
  st.tab = "edit";
  changed();
  scrollToSelection();
}

function duplicateSection(id) {
  const s = current().model.sections.find((x) => x.id === id);
  if (!s || !RULES.duplicable.includes(s.kind)) return;
  const newId = uniqueId("sections", s.kind);
  const { id: _i, order: _o, hidden: _h, ...data } = clone(s);
  const key = `add:sections/${newId}`;
  st.draft.changes[key] = { key, op: "add", collection: "sections", id: newId, after: id, data, label: "Copy of a section", note: "", at: Date.now() };
  st.selection = { type: "section", id: newId };
  changed();
  scrollToSelection();
}

function removeEntry(coll, id) {
  const addKey = `add:${coll}/${id}`;
  const touches = (c) => c.path && c.path[0] === coll && c.path[1] === id;
  if (st.draft.changes[addKey]) {
    for (const [k, c] of Object.entries(st.draft.changes)) if (k === addKey || touches(c)) delete st.draft.changes[k];
  } else {
    const key = `remove:${coll}/${id}`;
    const before = clone(valueAt(baseFor(key), [coll, id]));
    for (const [k, c] of Object.entries(st.draft.changes)) if (touches(c)) delete st.draft.changes[k];
    st.draft.changes[key] = { key, op: "remove", collection: coll, id, before, label: coll === "callouts" ? "Removed callout" : "Removed section", note: "", at: Date.now() };
  }
  st.selection = null;
  changed();
}

function revert(key) {
  const c = st.draft.changes[key];
  if (!c) return;
  if (c.op === "add") return removeEntry(c.collection, c.id);
  delete st.draft.changes[key];
  if (st.selection?.key === key) st.selection = null;
  changed();
}

function addNote(text, anchor) {
  const t = text.trim();
  if (!t) return;
  const key = `note:${Date.now()}`;
  st.draft.changes[key] = { key, op: "note", text: t, anchor: anchor ?? null, label: "Note for Claude", at: Date.now() };
  changed();
  toast("Added to your changes.");
}

/** Notes ride on a change; a selection with no change of its own gets a note change. */
function setNote(key, text) {
  const c = st.draft.changes[key];
  if (!c) return;
  c.note = text;
  invalidate();
  queueSave();
  renderCounts();
}

/** New callouts are named for their headings when they're sent, so the file name means something. */
function finalizeIds() {
  for (const c of Object.values(st.draft.changes)) {
    if (c.op !== "add" || c.collection !== "callouts" || !/^new-callout(-\d+)?$/.test(c.id)) continue;
    const stem = slugify(c.data.title || "") || "callout";
    const taken = new Set(current().model.callouts.map((e) => e.id).filter((x) => x !== c.id));
    let id = stem;
    for (let n = 2; taken.has(id); n++) id = `${stem}-${n}`;
    if (id !== c.id) rekey("callouts", c.id, id);
    invalidate();
  }
}

function rekey(coll, from, to) {
  const next = {};
  for (const c of Object.values(st.draft.changes)) {
    const n = clone(c);
    if (n.collection === coll && n.id === from) n.id = to;
    if (n.collection === coll && n.after === from) n.after = to;
    if (n.path && n.path[0] === coll && n.path[1] === from) n.path = [coll, to, ...n.path.slice(2)];
    if (n.op === "order" && n.collection === coll) {
      n.after = n.after.map((x) => (x === from ? to : x));
      n.before = n.before.map((x) => (x === from ? to : x));
    }
    n.key = keyOf(n);
    next[n.key] = n;
  }
  st.draft.changes = next;
}

// --- Pictures -------------------------------------------------------------------------

function measure(file) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight, url });
    img.onerror = () => resolve({ width: 0, height: 0, url });
    img.src = url;
  });
}

const TYPES = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp", svg: "image/svg+xml" };

async function upload(path, file) {
  if (!st.assets) return toast("Pictures can only be added from the Studio on claude.ai, by its owner.");
  const slot = slotOf(path);
  const ext = (file.name.split(".").pop() || "").toLowerCase();
  const type = file.type || TYPES[ext] || "";
  if (slot === "icon-svg" ? type !== "image/svg+xml" : !["image/png", "image/jpeg", "image/webp"].includes(type)) {
    return toast(slot === "icon-svg" ? "The Android icon has to be an SVG file." : "Use a PNG, JPEG or WebP picture.");
  }
  setStatus("saving", "Uploading…");
  const dims = await measure(file);
  let res;
  try {
    res = await st.assets.upload(file, { type });
  } catch (e) {
    setStatus("error", "Upload failed");
    return toast(e?.code === "too_large" ? "That picture is over 20 MB. Export it smaller and try again." : `The picture didn’t upload (${e?.message || e?.code || "unknown error"}).`);
  }
  st.blobUrls.set(res.id, res.url || dims.url);
  const key = `image:${pathKey(path)}`;
  const prev = st.draft.changes[key];
  const before = prev ? prev.before : clone(path[0] === "files" ? path[1] : valueAt(baseFor(key), path));
  st.draft.changes[key] = {
    key, op: "image", path, before,
    upload: { asset: res.id, name: file.name, type, width: dims.width, height: dims.height, bytes: file.size },
    fileName: slugify(file.name),
    frame: false,
    alt: before && typeof before === "object" ? (prev?.alt ?? before.alt) : undefined,
    label: fieldLabel(path),
    note: prev?.note ?? "",
    at: prev?.at ?? Date.now(),
  };
  st.selection = { type: "image", path };
  changed();
}

let pendingPick = null;
els.file.addEventListener("change", () => {
  const f = els.file.files?.[0];
  if (f && pendingPick) pendingPick(f);
  els.file.value = "";
});
function pick(onFile, accept = "image/png,image/jpeg,image/webp") {
  pendingPick = onFile;
  els.file.accept = accept;
  els.file.click();
}
/** Choose a file to replace the picture at `path`. */
function pickImage(path) {
  pick((f) => upload(path, f), slotOf(path) === "icon-svg" ? "image/svg+xml,.svg" : undefined);
}

// --- Pictures to add, and notes for Claude ---------------------------------------
// A note is something for Claude to do by hand. It can name a section and carry
// pictures, which is how BDR adds a picture to a section: the apply step
// converts it, and Claude lays it out from BDR's words.

function anchorName(anchor) {
  if (!anchor) return "The whole page";
  const s = current().model.sections.find((x) => x.id === anchor[1]);
  return s ? (KINDS[s.kind]?.name ?? s.kind) : anchor[1];
}

function newNote(anchor, text = "") {
  const key = `note:${Date.now()}`;
  st.draft.changes[key] = { key, op: "note", text, anchor: anchor ?? null, images: [], label: "Note for Claude", at: Date.now() };
  return key;
}

/** Upload a file and attach it to a note as a picture to add. */
async function attachPicture(key, file) {
  const c = st.draft.changes[key];
  if (!c) return false;
  if (!st.assets) { toast("Pictures can only be added from the Studio on claude.ai, by its owner."); return false; }
  const ext = (file.name.split(".").pop() || "").toLowerCase();
  const type = file.type || TYPES[ext] || "";
  if (!["image/png", "image/jpeg", "image/webp"].includes(type)) { toast("Use a PNG, JPEG or WebP picture."); return false; }
  setStatus("saving", "Uploading…");
  const dims = await measure(file);
  let res;
  try {
    res = await st.assets.upload(file, { type });
  } catch (e) {
    setStatus("error", "Upload failed");
    toast(e?.code === "too_large" ? "That picture is over 20 MB. Export it smaller and try again." : `The picture didn’t upload (${e?.message || e?.code || "unknown error"}).`);
    return false;
  }
  st.blobUrls.set(res.id, res.url || dims.url);
  c.images = [...(c.images ?? []), { asset: res.id, name: file.name, type, width: dims.width, height: dims.height, bytes: file.size, frame: false, fileName: slugify(file.name), alt: "" }];
  c.label = "Picture to add";
  return true;
}

/** A new picture-to-add note for a section, from a dropped or chosen file. */
async function addPictureTo(sectionId, file, text = "") {
  const key = newNote(sectionId ? ["sections", sectionId] : null, text);
  if (!(await attachPicture(key, file))) { delete st.draft.changes[key]; return; }
  st.selection = { type: "note", key };
  st.tab = "edit";
  changed();
  requestAnimationFrame(() => $("#note-text")?.focus({ preventScroll: true }));
}

/** Every picture uploaded in this draft, for using one in a second place. */
function draftUploads(exceptKey) {
  const seen = new Map();
  for (const c of draftList()) {
    if (c.op === "image" && c.upload?.asset && c.key !== exceptKey) seen.set(c.upload.asset, { ...c.upload });
    if (c.op === "note") for (const p of c.images ?? []) if (c.key !== exceptKey) seen.set(p.asset, p);
  }
  const mine = new Set((st.draft.changes[exceptKey]?.images ?? []).map((p) => p.asset));
  return [...seen.values()].filter((p) => !mine.has(p.asset));
}

function reusePicture(key, asset) {
  const c = st.draft.changes[key];
  const found = draftUploads(key).find((p) => p.asset === asset);
  if (!c || !found) return;
  c.images = [...(c.images ?? []), { asset, name: found.name, type: found.type, width: found.width, height: found.height, bytes: found.bytes, frame: Boolean(found.frame), fileName: found.fileName ?? slugify(found.name ?? ""), alt: found.alt ?? "" }];
  c.label = "Picture to add";
  changed();
}

function unattachPicture(key, asset) {
  const c = st.draft.changes[key];
  if (!c) return;
  c.images = (c.images ?? []).filter((p) => p.asset !== asset);
  c.label = c.images.length ? "Picture to add" : "Note for Claude";
  changed();
}

/** The placeholders the page shows for notes, sent or not, by section id. */
function pendingByAnchor() {
  const out = new Map();
  const add = (c, sent) => {
    const id = c.anchor?.[0] === "sections" ? c.anchor[1] : "_page";
    if (!out.has(id)) out.set(id, []);
    out.get(id).push({
      key: c.key,
      label: c.images?.length ? (c.images.length === 1 ? "Picture to add" : `${c.images.length} pictures to add`) : "Note for Claude",
      text: c.text ?? "",
      images: (c.images ?? []).map((p) => imgUrl(`/_blob/${p.asset}`)),
      sent,
    });
  };
  for (const r of openRequests()) for (const c of r.changes ?? []) if (c.op === "note") add(c, true);
  for (const c of draftList()) if (c.op === "note") add(c, false);
  return out;
}

// --- Saving the draft -----------------------------------------------------------------

let saveTimer = null;
let renderLater = false;

/** Whether a text field has focus. Nothing saves or redraws under someone typing. */
function typing() {
  const a = document.activeElement;
  return !!a && (a.isContentEditable || a.matches("textarea, input:not([type]), input[type=text], input[type=url], input[type=search]"));
}

// Typing is saved when the field is left: another pane, a click elsewhere, or
// the tab hidden. Other edits (a swatch, a button) save after a short pause.
function queueSave() {
  if (st.readOnly || !st.db) return;
  st.dirty = true;
  setStatus("saving", "Unsaved");
  clearTimeout(saveTimer);
  if (!typing()) saveTimer = setTimeout(flush, 650);
}

/** Redraw for news from the database, unless it would replace the field being typed in. */
function renderFromDb() {
  if (typing()) { renderLater = true; return; }
  if (st.seed) renderAll();
}

// Leaving a field saves it, even straight into another field: saving
// redraws nothing, since the board ignores the echo of its own save.
document.addEventListener("focusout", () => setTimeout(() => {
  if (st.dirty) flush();
  if (typing()) return;
  if (renderLater) { renderLater = false; if (st.seed) renderAll(); }
}, 0));

async function flush() {
  clearTimeout(saveTimer);
  if (!st.db || st.readOnly || st.saving) return;
  st.saving = true;
  st.dirty = false;
  setStatus("saving", "Saving…");
  const body = { changes: clone(st.draft.changes), message: st.draft.message || "", updatedAt: new Date().toISOString() };
  try {
    await st.db.doc("studio/draft").set(body);
    if (!st.dirty) setStatus("saved", `Saved ${new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`);
  } catch (e) {
    st.dirty = true;
    if (e?.code === "invalid_argument") {
      st.readOnly = true;
      setStatus("error", "View only");
      showNotice("<strong>You can look but not change this board.</strong> Only its owner can edit and send changes.");
    } else {
      setStatus("error", "Not saved, retrying…");
      setTimeout(flush, 2000);
    }
  } finally {
    st.saving = false;
    if (st.dirty && !st.readOnly && els.status.dataset.state !== "error") flush();
  }
}
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden" && st.dirty) flush(); });
window.addEventListener("pagehide", () => { if (st.dirty) flush(); });

// --- Sending, answering, withdrawing --------------------------------------------------

function review() {
  const model = current().model;
  const draft = draftList();
  const problems = draft.length ? validateModel(model) : [];
  for (const c of draft) {
    if (c.op !== "note" || (c.text ?? "").trim()) continue;
    problems.push(c.images?.length ? `Say where the picture for ${anchorName(c.anchor)} should go` : `A note for ${anchorName(c.anchor)} is empty`);
  }
  const conflicts = draft.filter((c) => current().results[c.key]?.status === "conflict");
  const ids = new Set(draft.flatMap((c) => (c.path && c.path[0] !== "page" ? [String(c.path[1])] : c.id ? [c.id] : [])));
  const page = draft.some((c) => c.path?.[0] === "page");
  const warnings = draft.length ? textWarnings(model).filter((w) => [...ids].some((id) => w.includes(`“${id}”`)) || (page && w.startsWith("page"))) : [];
  return { problems, conflicts, warnings };
}

async function send() {
  const { problems, conflicts } = review();
  if (!draftList().length || problems.length || conflicts.length || !st.db) return;
  finalizeIds();
  invalidate();
  const changes = draftList();
  const number = st.requests.reduce((m, r) => Math.max(m, r.number || 0), 0) + 1;
  const id = `r${String(number).padStart(4, "0")}`;
  const now = new Date().toISOString();
  const btn = $("#send");
  if (btn) btn.disabled = true;
  try {
    await st.db.doc(`requests/${id}`).set({
      number, createdAt: now, status: "sent", statusAt: now,
      message: (st.draft.message || "").trim(), changes,
      log: [{ at: now, text: "Sent from the Studio." }],
    });
    st.draft = { changes: {}, message: "" };
    st.selection = null;
    st.tab = "requests";
    invalidate();
    await flush();
    renderAll();
    toast(`Sent as request #${number}. In Claude, type /apps-studio to have it applied.`);
  } catch (e) {
    toast(`Couldn’t send (${e?.message || e?.code || "unknown error"}). Your changes are still here.`);
    if (btn) btn.disabled = false;
  }
}

async function answerCall(reqId, callId, optionId, note) {
  const r = st.requests.find((x) => x.id === reqId);
  if (!r || !st.db) return;
  const calls = clone(r.calls ?? []);
  const call = calls.find((c) => c.id === callId);
  if (!call) return;
  Object.assign(call, { answer: optionId, answerNote: note || "", answeredAt: new Date().toISOString() });
  try {
    await st.db.doc(`requests/${reqId}`).update({ calls });
    toast("Answer saved. In Claude, type /apps-studio to carry on.");
  } catch (e) {
    toast(`Couldn’t save the answer (${e?.message || e?.code}).`);
  }
}

async function withdraw(reqId, { edit }) {
  const r = st.requests.find((x) => x.id === reqId);
  if (!r || r.status !== "sent" || !st.db) return;
  const now = new Date().toISOString();
  try {
    await st.db.doc(`requests/${reqId}`).update({ status: "withdrawn", statusAt: now, log: [...(r.log ?? []), { at: now, text: edit ? "Taken back to edit." : "Withdrawn." }] });
    if (edit) {
      for (const c of r.changes ?? []) st.draft.changes[c.key] = { ...c, at: c.at ?? Date.now() };
      if (r.message && !st.draft.message) st.draft.message = r.message;
      st.tab = "changes";
      changed();
    }
  } catch (e) {
    toast(`Couldn’t withdraw it (${e?.message || e?.code}).`);
  }
}

// --- Drawing ----------------------------------------------------------------------------

function renderAll() {
  renderReplica();
  renderCounts();
  renderTabs();
  if (st.tab === "edit") renderEdit();
  if (st.tab === "changes") renderChanges();
  if (st.tab === "requests") renderRequests();
}

function renderCounts() {
  const n = draftList().length;
  els.count.textContent = n ? String(n) : "";
  els.sendN.textContent = n ? `(${n})` : "";
  els.reviewSend.disabled = !n;
  const waiting = st.requests.filter((r) => r.status === "needs-you" && (r.calls ?? []).some((c) => !c.answer)).length;
  const active = openRequests().length;
  els.reqCount.textContent = waiting ? String(waiting) : active ? String(active) : "";
  els.reqCount.classList.toggle("count--warn", waiting > 0);
  els.reqCount.title = waiting ? `${waiting} waiting for your answer` : "";
}

function renderTabs() {
  for (const [name, panel] of Object.entries(els.panels)) {
    panel.hidden = name !== st.tab;
    $(`#tab-${name}`).setAttribute("aria-selected", String(name === st.tab));
  }
}

let fitFrame = 0;
function renderReplica() {
  if (!st.seed) { els.replica.innerHTML = ""; return; }
  els.replica.innerHTML = renderPage(shown(), {
    editable: !st.preview,
    img: imgUrl,
    season: st.season,
    changed: st.showChanges ? changedPaths() : new Set(),
    pending: st.showChanges ? pendingByAnchor() : new Map(),
  });
  els.replica.dataset.theme = st.pageTheme;
  els.canvas.dataset.mode = st.preview ? "preview" : "edit";
  markSelection();
  cancelAnimationFrame(fitFrame);
  fitFrame = requestAnimationFrame(fit);
  for (const img of $$("img", els.replica)) if (!img.complete) img.addEventListener("load", () => requestAnimationFrame(fit), { once: true });
}

function fit() {
  const [, width] = DEVICES[st.device];
  const avail = els.canvas.clientWidth - parseFloat(getComputedStyle(els.canvas).paddingLeft) - parseFloat(getComputedStyle(els.canvas).paddingRight);
  const scale = Math.min(1, avail / width);
  els.replica.style.width = `${width}px`;
  els.replica.style.transform = `scale(${scale})`;
  els.replica.style.setProperty("--inv", String(1 / scale));
  els.sheet.style.width = `${Math.round(width * scale)}px`;
  els.sheet.style.height = `${Math.ceil(els.replica.offsetHeight * scale)}px`;
  $("#canvas-meta").style.maxWidth = `${Math.round(width * scale)}px`;
  els.widthLabel.textContent = `${DEVICES[st.device][0]} · ${width}px${scale < 1 ? ` · shown at ${Math.round(scale * 100)}%` : ""}`;
}
new ResizeObserver(() => requestAnimationFrame(fit)).observe(els.canvas);
new ResizeObserver(() => document.documentElement.style.setProperty("--bar-h", `${els.bar.offsetHeight}px`)).observe(els.bar);

function selector(sel) {
  if (!sel) return null;
  const q = (attr, v) => `[${attr}="${CSS.escape(v)}"]`;
  switch (sel.type) {
    case "field": return q("data-edit", pathKey(sel.path));
    case "image": return q("data-image", pathKey(sel.path));
    case "link": return q("data-link", pathKey(sel.path));
    case "section": return q("data-section", sel.id);
    case "callout": return q("data-callout", sel.id);
    case "season": return q("data-season", sel.id);
    case "carousel": return q("data-carousel-card", sel.id);
    case "example": return `article${q("data-example", sel.id)}`;
    case "note": return q("data-note", sel.key);
    default: return null;
  }
}

function markSelection() {
  const s = selector(st.selection);
  if (s) for (const el of $$(s, els.replica)) el.classList.add("is-selected");
}

/** Bring the selection to the middle of the window, scrolling the window only (never the page's frame). */
function scrollToSelection() {
  requestAnimationFrame(() => {
    const s = selector(st.selection);
    const el = s && $(s, els.replica);
    if (!el) return;
    const r = el.getBoundingClientRect();
    const top = window.scrollY + r.top - Math.max(0, (window.innerHeight - r.height) / 2);
    window.scrollTo({ top: Math.max(0, top), behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  });
}

function select(sel, { scroll = false, focus = true } = {}) {
  st.selection = sel;
  if (sel?.type === "season") {
    const i = [...current().model.seasons].sort(byOrder).findIndex((x) => x.id === sel.id);
    if (i >= 0) st.season = i;
  }
  st.tab = "edit";
  renderAll();
  if (scroll) scrollToSelection();
  if (focus) {
    requestAnimationFrame(() => {
      const el = $("#panel-edit [data-autofocus]");
      if (!el) return;
      el.focus({ preventScroll: true });
      if (typeof el.setSelectionRange === "function" && el.type !== "url") el.setSelectionRange(el.value.length, el.value.length);
    });
  }
}

// --- The Edit panel ----------------------------------------------------------------

function fieldType(path) {
  const [where, id, ...keys] = path.map(String);
  const k = keys.join("/");
  if (where === "page") return id === "title" ? "line" : "prose";
  if (where === "sections") {
    const s = current().model.sections.find((x) => x.id === id);
    return KINDS[s?.kind]?.fields?.[k]?.[1] ?? "line";
  }
  if (where === "callouts") return CALLOUT_FIELDS[k]?.[1] ?? "line";
  if (where === "examples") return EXAMPLE_FIELDS[k]?.[1] ?? "line";
  return "line";
}

const toText = (value, type) => (type === "list" ? (value ?? []).join("\n") : type === "paras" ? (value ?? []).join("\n\n") : value ?? "");
function fromText(text, type) {
  if (type === "list") return text.split("\n").map((s) => s.trim()).filter(Boolean);
  if (type === "paras") return text.split(/\n\s*\n/).map((s) => s.replace(/\s*\n\s*/g, " ").trim()).filter(Boolean);
  if (type === "line" || type === "prose") return text.replace(/\s*\n\s*/g, " ");
  return text;
}
const HINTS = {
  line: "One line.",
  title: "Shift-Return or a new line breaks the heading where you want it.",
  prose: "One paragraph.",
  paragraphs: "A blank line starts a new paragraph.",
  paras: "A blank line starts a new paragraph.",
  list: "One per line.",
};

function noteBox(c) {
  if (!c) return "";
  return `<details class="note"${c.note ? " open" : ""}><summary>Note to Claude ${c.note ? '<span class="has">· has a note</span>' : ""}</summary><div class="fld"><textarea id="change-note" data-note="${esc(c.key)}" rows="2" placeholder="Anything to check, or how you want this handled">${esc(c.note ?? "")}</textarea></div></details>`;
}

/** What sits under the field: its length against the old one, the old words, the note, Undo. Redrawn as you type. */
function fieldMeta(path) {
  const type = fieldType(path);
  const key = `set:${pathKey(path)}`;
  const c = st.draft.changes[key];
  const text = toText(valueAt(current().model, path), type);
  const wasText = c ? toText(c.before, type) : "";
  const longer = c && wasText && plain(text).length > plain(wasText).length * 1.3;
  return `
    <div class="meta"><span>${plain(text).length} characters</span>${c ? `<span class="${longer ? "warn" : ""}">was ${plain(wasText).length}${longer ? " · much longer; check Phone" : ""}</span>` : ""}</div>
    ${c ? `<div class="was"><b>Was</b>${esc(short(wasText, 400)) || "<i>empty</i>"}</div>` : ""}
    ${noteBox(c)}
    <div class="row">${c ? `<button type="button" class="btn" data-action="revert" data-key="${esc(key)}">Undo this change</button>` : ""}<button type="button" class="btn btn--quiet" data-action="deselect">Done</button></div>`;
}

function fieldPanel(path) {
  const type = fieldType(path);
  const text = toText(valueAt(current().model, path), type);
  const where = path[0] === "page" ? "Search and sharing" : groupOf({ op: "set", path });
  const guide = path[0] === "page" ? (path[1] === "title" ? " Search results show about 60 characters." : " Search results show about 155 characters.") : "";
  return `
    <p class="crumb">${esc(where)}</p>
    <div class="fld"><span id="field-label">${esc(fieldLabel(path))}</span>
      <textarea id="field-text" class="${type === "paragraphs" || type === "paras" ? "big" : ""}" aria-labelledby="field-label" data-path="${esc(pathKey(path))}" data-type="${type}" data-autofocus rows="${type === "line" ? 2 : 4}">${esc(text)}</textarea>
    </div>
    <div class="row">
      <button type="button" class="btn" data-action="italic" title="Wrap the selected words in stars">Italic</button>
      <span class="hint">${HINTS[type] ?? ""}${path[0] === "page" ? "" : " *Stars* make italics."}${guide}</span>
    </div>
    <div id="field-meta">${fieldMeta(path)}</div>
    ${path[0] === "page" ? `<p class="hint">These are litbible.net’s own; liberatingscripture.org keeps its own title and description for its copy of the page.</p>` : ""}
    <p class="hint">Straight quotes turn curly as you type, as they are everywhere on the site.</p>`;
}

function linkPanel(path) {
  const now = valueAt(current().model, path) ?? {};
  const lk = `set:${pathKey([...path, "label"])}`;
  const hk = `set:${pathKey([...path, "href"])}`;
  const changedOne = st.draft.changes[lk] || st.draft.changes[hk];
  return `
    <p class="crumb">${esc(groupOf({ op: "set", path }))}</p>
    <h2>${esc(fieldLabel(path))}</h2>
    <label class="fld" for="link-label"><span>Words on it</span><input type="text" id="link-label" data-path="${esc(pathKey([...path, "label"]))}" value="${esc(now.label ?? "")}" data-autofocus autocomplete="off"></label>
    <label class="fld" for="link-href"><span>Where it goes</span><input type="url" id="link-href" data-path="${esc(pathKey([...path, "href"]))}" value="${esc(now.href ?? "")}" autocomplete="off" spellcheck="false"></label>
    <p class="hint">Write litbible.net pages in full (https://litbible.net/…) so the copy of this page on liberatingscripture.org reaches them too. Other sites open in a new tab.</p>
    ${noteBox(st.draft.changes[lk] ?? st.draft.changes[hk])}
    <div class="row">${changedOne ? `<button type="button" class="btn" data-action="revert-link" data-path="${esc(pathKey(path))}">Undo these changes</button>` : ""}<button type="button" class="btn btn--quiet" data-action="deselect">Done</button></div>`;
}

function imagePanel(path) {
  const key = `image:${pathKey(path)}`;
  const c = st.draft.changes[key];
  const slot = slotOf(path);
  const spec = RULES.slots[slot];
  const live = path[0] === "files" ? path[1] : valueAt(current().live, path) ?? valueAt(current().model, path);
  const src = typeof live === "object" && live ? live.src : live;
  const size = st.seed.images?.[src];
  const isObject = typeof (c ? c.before : valueAt(current().model, path)) === "object";
  const newSrc = c ? `/_blob/${c.upload.asset}` : null;
  const shape = (w, h) => (w && h ? w / h : 0);
  const notes = [];
  if (c) {
    const w = c.upload.width;
    const h = c.upload.height;
    if (spec.longest && Math.max(w, h) < spec.longest) notes.push(`It’s ${w}×${h}, smaller than the ${spec.longest}px this spot ships at, so it may look soft.`);
    const a = shape(size?.width, size?.height);
    const b = shape(w, h);
    if (!c.frame && a && b && Math.abs(a - b) / a > 0.06 && !spec.square) notes.push("It’s a different shape from the picture it replaces, so the layout around it will shift a little.");
    if (slot === "carousel") notes.push("Every season’s screenshot should be the same size, so the carousel doesn’t jump.");
  }
  const outName = c ? (spec.svg || spec.square ? path[1] : `${spec.dir.replace(/^public/, "")}/${slugify(c.fileName || c.upload.name) || "screenshot"}.webp`) : "";
  const generatedAlt = path[0] === "callouts" ? "Written from the callout’s heading, platform and mode." : path[0] === "seasons" ? "Written from the passage and the season’s name." : "";
  return `
    <p class="crumb">${esc(groupOf({ op: "image", path }))}</p>
    <h2>${esc(fieldLabel(path))}</h2>
    <div class="thumbs">
      <figure><img src="${esc(imgUrl(src))}" alt=""><figcaption>${c ? "Now" : "On the page"}${size?.width ? ` · ${size.width}×${size.height}` : ""}</figcaption></figure>
      ${c ? `<span class="arrow" aria-hidden="true">→</span><figure><img src="${esc(imgUrl(newSrc))}" alt=""><figcaption>New · ${c.upload.width}×${c.upload.height}</figcaption></figure>` : ""}
    </div>
    <div class="drop" data-action="pick" data-path="${esc(pathKey(path))}" role="button" tabindex="0" data-autofocus>
      <b>${c ? "Choose a different picture" : "Replace this picture"}</b>
      <span class="hint">Drop a file here, or click to choose. ${spec.svg ? "SVG only." : "PNG, JPEG or WebP."}</span>
    </div>
    ${c && spec.frame === "apple" ? `
    <fieldset class="fld choice"><legend>Device frame</legend>
      <label><input type="radio" name="frame" value="framed" ${!c.frame ? "checked" : ""}> <span>It already has its frame<small>Like the pictures on the page now.</small></span></label>
      <label><input type="radio" name="frame" value="frame" ${c.frame ? "checked" : ""}> <span>Frame it for me<small>For a raw iPhone or iPad screenshot, framed with your saved colors.</small></span></label>
    </fieldset>` : c && slot === "foldable" ? `<p class="hint">Upload foldable and Android pictures with their frame; the framing tool only knows Apple devices.</p>` : ""}
    ${c && !spec.svg && !spec.square ? `<label class="fld" for="image-name"><span>File name</span><input type="text" id="image-name" value="${esc(c.fileName ?? "")}" autocomplete="off" spellcheck="false"></label><p class="meta"><span>Ships as ${esc(outName)}</span></p>` : ""}
    ${c && spec.square ? `<p class="meta"><span>Replaces ${esc(path[1])} everywhere it appears: this page, the home page, the app banner, and the share card.</span></p>` : ""}
    ${isObject ? `<label class="fld" for="image-alt"><span>What a screen reader says</span><textarea id="image-alt" rows="3">${esc(c ? c.alt ?? "" : live?.alt ?? "")}</textarea></label>` : generatedAlt ? `<p class="hint">Alt text: ${esc(generatedAlt)}</p>` : ""}
    ${notes.length ? `<div class="box box--warn">${notes.map((n) => `<p>${esc(n)}</p>`).join("")}</div>` : ""}
    ${noteBox(c)}
    <div class="row">${c ? `<button type="button" class="btn" data-action="revert" data-key="${esc(key)}">Keep the old picture</button>` : ""}<button type="button" class="btn btn--quiet" data-action="deselect">Done</button></div>`;
}

function swatches(name, options, current_, labelFor, colorsFor) {
  return `<div class="swatches" role="group" aria-label="${esc(name)}">${options.map((o) => {
    const [light, dark] = colorsFor(o);
    return `<button type="button" class="swatch" data-swatch="${esc(name)}" data-value="${o}" aria-pressed="${o === current_}"><i style="background: linear-gradient(135deg, ${light} 50%, ${dark} 50%);"></i>${esc(labelFor(o))}</button>`;
  }).join("")}</div>`;
}

function sectionPanel(id) {
  const model = current().model;
  const s = model.sections.find((x) => x.id === id);
  if (!s) return homePanel();
  const list = listOf(model, "sections");
  const i = list.indexOf(id);
  const isCopy = !st.seed.sections.some((x) => x.id === id);
  const fields = Object.entries(KINDS[s.kind]?.fields ?? {});
  const examples = s.kind === "examples" ? model.examples : [];
  const hero = examples.find((e) => e.placement === "hero");
  return `
    <p class="crumb">Section ${i + 1} of ${list.length}</p>
    <h2>${esc(KINDS[s.kind]?.name ?? s.kind)}${isCopy ? " (copy)" : ""}</h2>
    <div class="fld"><span>Background</span>${swatches("background", RULES.backgrounds, s.background ?? "plain", (b) => BACKGROUNDS[b], bandColors)}
      <p class="hint">Each swatch shows its light and dark mode. Tints mix the season colors in gently, like the callout cards.</p></div>
    <div class="fld"><span>Place on the page</span><div class="row">
      <button type="button" class="btn" data-action="move" data-coll="sections" data-id="${esc(id)}" data-dir="-1" ${i === 0 ? "disabled" : ""}>Move up</button>
      <button type="button" class="btn" data-action="move" data-coll="sections" data-id="${esc(id)}" data-dir="1" ${i === list.length - 1 ? "disabled" : ""}>Move down</button>
      ${!RULES.alwaysShown.includes(s.kind) || s.hidden ? `<button type="button" class="btn" data-action="hide" data-id="${esc(id)}">${s.hidden ? "Show on the page" : "Hide from the page"}</button>` : ""}
    </div></div>
    ${RULES.duplicable.includes(s.kind) ? `<div class="row"><button type="button" class="btn" data-action="duplicate" data-id="${esc(id)}">Make a copy below</button>${isCopy ? `<button type="button" class="btn btn--danger" data-action="remove" data-coll="sections" data-id="${esc(id)}">Remove this copy</button>` : ""}</div>` : ""}
    ${s.kind === "examples" ? `
      <label class="fld" for="pick-example"><span>Passage shown</span><select id="pick-example">${examples.map((e) => `<option value="${esc(e.id)}" ${e === hero ? "selected" : ""}>${esc(e.reference)}</option>`).join("")}</select></label>
      ${hero ? `<label class="fld" for="pick-comparison"><span>Compared with</span><select id="pick-comparison" data-id="${esc(hero.id)}">${RULES.comparisons.map((v) => `<option ${v === hero.comparison ? "selected" : ""}>${v}</option>`).join("")}</select></label>` : ""}` : ""}
    ${fields.length ? `<div class="fld"><span>Words in this section</span><ul class="outline">${fields.map(([k, [label]]) => `<li><button type="button" data-action="edit-field" data-path="${esc(pathKey(["sections", id, ...k.split("/")]))}">${esc(label)}<em>${esc(short(toText(getAt(s, k.split("/")), "line"), 34))}</em></button></li>`).join("")}</ul></div>` : ""}
    ${s.kind === "reader" ? `<div class="row"><button type="button" class="btn" data-action="add-callout">Add a callout</button></div>` : ""}
    ${additionsFor(id)}
    <div class="row"><button type="button" class="btn btn--quiet" data-action="deselect">Done</button></div>`;
}

/** A section's pictures to add and notes, and the way to add another. */
function additionsFor(id) {
  const list = draftList().filter((c) => c.op === "note" && c.anchor?.[1] === id);
  return `
    <div class="fld"><span>Add to this section</span>
      ${list.length ? `<ul class="outline">${list.map((c) => `<li><button type="button" data-action="edit-note" data-key="${esc(c.key)}">${esc(c.images?.length ? "Picture to add" : "Note")}<em>${esc(short(c.text, 30) || "say where it goes")}</em></button></li>`).join("")}</ul>` : ""}
      <div class="drop" data-action="add-picture" data-id="${esc(id)}" role="button" tabindex="0"><b>Add a picture to this section</b><span class="hint">Drop a file here or click to choose, then say where it goes. You can also drop a file straight onto the section.</span></div>
      <div class="row"><button type="button" class="btn" data-action="add-section-note" data-id="${esc(id)}">Add a note about this section</button></div>
    </div>`;
}

function pictureCard(c, p, i) {
  const a = esc(p.asset);
  return `<div class="pic">
    <img src="${esc(imgUrl(`/_blob/${p.asset}`))}" alt="">
    <div class="pic__body">
      <p class="meta"><span>${p.width}×${p.height}</span><span>${esc(p.name ?? "")}</span></p>
      <fieldset class="fld choice"><legend>Device frame</legend>
        <label><input type="radio" name="pic-frame-${i}" data-pic="${a}" data-pic-field="frame" value="framed" ${!p.frame ? "checked" : ""}> <span>It already has its frame</span></label>
        <label><input type="radio" name="pic-frame-${i}" data-pic="${a}" data-pic-field="frame" value="frame" ${p.frame ? "checked" : ""}> <span>Frame it for me<small>For a raw iPhone, iPhone Duo or iPad screenshot, framed with your saved colors.</small></span></label>
      </fieldset>
      <label class="fld"><span>What a screen reader says</span><textarea rows="2" data-pic="${a}" data-pic-field="alt" placeholder="Leave blank and Claude will write it">${esc(p.alt ?? "")}</textarea></label>
      <label class="fld"><span>File name</span><input type="text" data-pic="${a}" data-pic-field="fileName" value="${esc(p.fileName ?? "")}" autocomplete="off" spellcheck="false"></label>
      <div class="row"><button type="button" class="btn btn--quiet" data-action="unattach" data-key="${esc(c.key)}" data-asset="${a}">Remove this picture</button></div>
    </div>
  </div>`;
}

function notePanel(key) {
  const c = st.draft.changes[key];
  if (!c || c.op !== "note") return homePanel();
  const sections = [...current().model.sections].sort(byOrder);
  const pics = c.images ?? [];
  const reuse = draftUploads(key);
  const at = c.anchor?.[1] ?? "";
  return `
    <p class="crumb">${esc(anchorName(c.anchor))} · ${pics.length ? "Picture to add" : "Note for Claude"}</p>
    <h2>${pics.length ? (pics.length === 1 ? "A picture to add" : `${pics.length} pictures to add`) : "A note for Claude"}</h2>
    <label class="fld" for="note-anchor"><span>Part of the page</span><select id="note-anchor"><option value="">The whole page</option>${sections.map((s) => `<option value="${esc(s.id)}" ${s.id === at ? "selected" : ""}>${esc(KINDS[s.kind]?.name ?? s.kind)}</option>`).join("")}</select></label>
    <label class="fld" for="note-text"><span>${pics.length ? "Where and how should it appear?" : "What should change?"}</span><textarea id="note-text" rows="4" data-autofocus placeholder="${pics.length ? "For example: beside the two phones, as tall as the iPhone, slightly behind it" : "Describe the change"}">${esc(c.text ?? "")}</textarea></label>
    ${pics.map((p, i) => pictureCard(c, p, i)).join("")}
    <div class="drop" data-action="attach" data-key="${esc(key)}" role="button" tabindex="0"><b>${pics.length ? "Add another picture" : "Add a picture"}</b><span class="hint">Drop a file here, or click to choose. PNG, JPEG or WebP.</span></div>
    ${reuse.length ? `<div class="fld"><span>Or use a picture you already added</span><div class="reuse">${reuse.map((p) => `<button type="button" class="reuse__pick" data-action="reuse" data-key="${esc(key)}" data-asset="${esc(p.asset)}" title="${esc(p.name ?? "")}"><img src="${esc(imgUrl(`/_blob/${p.asset}`))}" alt="${esc(p.name ?? "A picture you added")}"></button>`).join("")}</div></div>` : ""}
    <p class="hint">${pics.length ? "A new picture needs a place in the layout, so Claude puts it there by hand from your words, and you’ll see it on the real page in the preview link. Here it shows as a placeholder after its section. Once it’s in, you can swap it like any other picture." : "Claude reads this when it applies your changes, and asks if anything is unclear."}</p>
    <div class="row"><button type="button" class="btn btn--danger" data-action="revert" data-key="${esc(key)}">Delete this ${pics.length ? "addition" : "note"}</button><button type="button" class="btn btn--quiet" data-action="deselect">Done</button></div>`;
}

function calloutPanel(id) {
  const model = current().model;
  const co = model.callouts.find((x) => x.id === id);
  if (!co) return homePanel();
  const list = listOf(model, "callouts");
  const i = list.indexOf(id);
  const isNew = Boolean(st.draft.changes[`add:callouts/${id}`]);
  const seg = (field, options) => `<div class="seg" role="group" aria-label="${esc(fieldLabel(["callouts", id, field]))}">${options.map(([v, label]) => `<button type="button" data-set-field="${esc(pathKey(["callouts", id, field]))}" data-value="${v}" aria-pressed="${co[field] === v}">${label}</button>`).join("")}</div>`;
  return `
    <p class="crumb">Callout ${i + 1} of ${list.length}${isNew ? " · new" : ""}</p>
    <h2>${esc(co.title)}</h2>
    <div class="fld"><span>Season color</span>${swatches("accent", RULES.accents, co.accent, (a) => ACCENTS[a], (a) => HUES[a])}<p class="hint">Paints the card in the season’s band, as the app’s Today card is.</p></div>
    <div class="fld"><span>Picture side, on wide screens</span>${seg("imageSide", [["left", "Left"], ["right", "Right"]])}</div>
    <div class="fld"><span>The screenshot shows</span><div class="row">${seg("platform", [["ios", "iPhone"], ["android", "Android"]])}${seg("mode", [["light", "Light mode"], ["dark", "Dark mode"]])}</div><p class="hint">Used for the picture’s alt text.</p></div>
    <div class="fld"><span>Words and picture</span><ul class="outline">
      <li><button type="button" data-action="edit-field" data-path="${esc(pathKey(["callouts", id, "title"]))}">Heading<em>${esc(short(co.title, 30))}</em></button></li>
      <li><button type="button" data-action="edit-field" data-path="${esc(pathKey(["callouts", id, "body"]))}">Text<em>${esc(short(co.body, 30))}</em></button></li>
      <li><button type="button" data-action="edit-image" data-path="${esc(pathKey(["callouts", id, "image"]))}">Picture<em>${co.image ? esc(co.image.split("/").pop()) : "none yet"}</em></button></li>
    </ul></div>
    <div class="fld"><span>Place</span><div class="row">
      <button type="button" class="btn" data-action="move" data-coll="callouts" data-id="${esc(id)}" data-dir="-1" ${i === 0 ? "disabled" : ""}>Move up</button>
      <button type="button" class="btn" data-action="move" data-coll="callouts" data-id="${esc(id)}" data-dir="1" ${i === list.length - 1 ? "disabled" : ""}>Move down</button>
    </div></div>
    <div class="row">
      <button type="button" class="btn" data-action="copy-callout" data-id="${esc(id)}">Add one like this</button>
      <button type="button" class="btn btn--danger" data-action="remove" data-coll="callouts" data-id="${esc(id)}">${isNew ? "Discard this callout" : "Remove this callout"}</button>
    </div>
    ${isNew ? `<p class="hint">Its file is named for its heading when you send it.</p>` : ""}
    <div class="row"><button type="button" class="btn btn--quiet" data-action="deselect">Done</button></div>`;
}

/** The carousel's card ("Mark sacred time"), drawn as the last callout of the reader section. */
function carouselPanel(id) {
  const model = current().model;
  const s = model.sections.find((x) => x.id === id);
  if (!s?.carousel) return homePanel();
  const cy = s.carousel;
  const p = ["sections", id, "carousel"];
  const seasons = [...model.seasons].sort(byOrder);
  const field = (k, label) => `<li><button type="button" data-action="edit-field" data-path="${esc(pathKey([...p, k]))}">${label}<em>${esc(short(cy[k] ?? "", 30))}</em></button></li>`;
  return `
    <p class="crumb">Callout ${model.callouts.length + 1} of ${model.callouts.length + 1} · the season carousel</p>
    <h2>${esc(cy.title)}</h2>
    <div class="fld"><span>Words</span><ul class="outline">
      ${field("title", "Heading")}${field("text", "Text")}${field("passage", "Passage the screenshots show")}${field("stageLabel", "What a screen reader hears")}
    </ul></div>
    <div class="fld"><span>Seasons, with their screenshots</span><ul class="outline">${seasons.map((se) => `<li><button type="button" data-action="select-season" data-id="${esc(se.id)}">${esc(se.name)}<em>${esc(String(se.image).split("/").pop())}</em></button></li>`).join("")}</ul></div>
    <p class="hint">Its color follows whichever season is showing, and its picture stays on the right. To change either, leave Claude a note.</p>
    <div class="row"><button type="button" class="btn btn--quiet" data-action="deselect">Done</button></div>`;
}

function seasonPanel(id) {
  const model = current().model;
  const se = model.seasons.find((x) => x.id === id);
  if (!se) return homePanel();
  const list = listOf(model, "seasons");
  const i = list.indexOf(id);
  return `
    <p class="crumb">Carousel · season ${i + 1} of ${list.length}</p>
    <h2>${esc(se.name)}</h2>
    <ul class="outline">
      <li><button type="button" data-action="edit-field" data-path="${esc(pathKey(["seasons", id, "name"]))}">Name on the chip<em>${esc(se.name)}</em></button></li>
      <li><button type="button" data-action="edit-image" data-path="${esc(pathKey(["seasons", id, "image"]))}">Screenshot<em>${esc(String(se.image).split("/").pop())}</em></button></li>
    </ul>
    <div class="row">
      <button type="button" class="btn" data-action="move" data-coll="seasons" data-id="${esc(id)}" data-dir="-1" ${i === 0 ? "disabled" : ""}>Earlier</button>
      <button type="button" class="btn" data-action="move" data-coll="seasons" data-id="${esc(id)}" data-dir="1" ${i === list.length - 1 ? "disabled" : ""}>Later</button>
    </div>
    <p class="hint">The chip’s color is the season’s own and stays as it is.</p>
    <div class="row"><button type="button" class="btn btn--quiet" data-action="deselect">Done</button></div>`;
}

function examplePanel(id) {
  const model = current().model;
  const e = model.examples.find((x) => x.id === id);
  if (!e) return homePanel();
  return `
    <p class="crumb">A first taste</p>
    <h2>${esc(e.reference)}</h2>
    <label class="fld" for="pick-comparison"><span>Compared with</span><select id="pick-comparison" data-id="${esc(e.id)}">${RULES.comparisons.map((v) => `<option ${v === e.comparison ? "selected" : ""}>${v}</option>`).join("")}</select></label>
    <ul class="outline">${Object.entries(EXAMPLE_FIELDS).map(([k, [label]]) => `<li><button type="button" data-action="edit-field" data-path="${esc(pathKey(["examples", id, k]))}">${esc(label)}<em>${esc(short(e[k] ?? "", 30) || "empty")}</em></button></li>`).join("")}</ul>
    <p class="hint">The LIT text should match the translation word for word; Claude checks it against the chapter before applying.</p>
    <div class="row"><button type="button" class="btn btn--quiet" data-action="deselect">Done</button></div>`;
}

function homePanel() {
  const model = current().model;
  const sections = [...model.sections].sort(byOrder);
  const seededAt = st.seed.seededAt ? new Date(st.seed.seededAt) : null;
  return `
    <h2>Edit the page</h2>
    <p class="lede">Click any words, picture, button or section on the page to change it. Edits save as you go, and nothing reaches the site until you send them.</p>
    <h3>On this page</h3>
    <ul class="outline">${sections.map((s) => `<li><button type="button" data-action="select-section" data-id="${esc(s.id)}">${esc(KINDS[s.kind]?.name ?? s.kind)}${s.hidden ? "<em>hidden</em>" : ""}</button></li>${s.kind === "reader" ? [...model.callouts].sort(byOrder).map((co) => `<li class="sub"><button type="button" data-action="select-callout" data-id="${esc(co.id)}">${esc(short(co.title, 34))}</button></li>`).join("") + (s.carousel ? `<li class="sub"><button type="button" data-action="select-carousel" data-id="${esc(s.id)}">${esc(short(s.carousel.title, 34))}</button></li>` : "") : ""}`).join("")}</ul>
    <div class="row"><button type="button" class="btn" data-action="page-title">Search and sharing text</button><button type="button" class="btn" data-action="add-callout">Add a callout</button></div>
    <h3>Something else?</h3>
    <label class="fld" for="free-anchor"><span>Which part of the page?</span><select id="free-anchor"><option value="">The whole page</option>${sections.map((s) => `<option value="${esc(s.id)}">${esc(KINDS[s.kind]?.name ?? s.kind)}</option>`).join("")}</select></label>
    <div class="fld"><textarea id="free-note" rows="3" aria-label="Describe the change" placeholder="Describe a change the Studio can’t make here, like a new kind of section or a new layout"></textarea></div>
    <div class="row"><button type="button" class="btn" data-action="add-note">Add to my changes</button><button type="button" class="btn" data-action="add-note-picture">Add with a picture…</button></div>
    <p class="hint">The page here is the live site${seededAt ? ` as of ${seededAt.toLocaleDateString([], { month: "short", day: "numeric" })}` : ""}, plus anything you’ve sent that isn’t live yet.</p>`;
}

function renderEdit() {
  const p = els.panels.edit;
  if (!st.seed) { p.innerHTML = ""; return; }
  const s = st.selection;
  let html;
  if (!s) html = homePanel();
  else if (s.type === "field") html = fieldPanel(s.path);
  else if (s.type === "link") html = linkPanel(s.path);
  else if (s.type === "image") html = imagePanel(s.path);
  else if (s.type === "section") html = sectionPanel(s.id);
  else if (s.type === "callout") html = calloutPanel(s.id);
  else if (s.type === "season") html = seasonPanel(s.id);
  else if (s.type === "carousel") html = carouselPanel(s.id);
  else if (s.type === "example") html = examplePanel(s.id);
  else if (s.type === "note") html = notePanel(s.key);
  else html = homePanel();
  p.innerHTML = html;
}

// --- The Changes panel ---------------------------------------------------------------

function wordDiff(a, b) {
  const A = String(a ?? "").split(/(\s+)/);
  const B = String(b ?? "").split(/(\s+)/);
  if (A.length * B.length > 250000) return `<del>${esc(a)}</del> <ins>${esc(b)}</ins>`;
  const m = A.length;
  const n = B.length;
  const L = Array.from({ length: m + 1 }, () => new Uint16Array(n + 1));
  for (let i = m - 1; i >= 0; i--) for (let j = n - 1; j >= 0; j--) L[i][j] = A[i] === B[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
  let i = 0;
  let j = 0;
  let out = "";
  while (i < m && j < n) {
    if (A[i] === B[j]) { out += esc(A[i]); i++; j++; }
    else if (L[i + 1][j] >= L[i][j + 1]) { out += `<del>${esc(A[i])}</del>`; i++; }
    else { out += `<ins>${esc(B[j])}</ins>`; j++; }
  }
  while (i < m) out += `<del>${esc(A[i++])}</del>`;
  while (j < n) out += `<ins>${esc(B[j++])}</ins>`;
  return out.replace(/<\/del><del>/g, "").replace(/<\/ins><ins>/g, "");
}

function describe(c) {
  const model = current().model;
  switch (c.op) {
    case "set": {
      const field = String(c.path[c.path.length - 1]);
      if (field === "hidden") return c.after ? "Hidden from the page" : "Shown on the page again";
      if (field === "background") return `${BACKGROUNDS[c.before ?? "plain"]} → ${BACKGROUNDS[c.after ?? "plain"]}`;
      if (field === "accent") return `${ACCENTS[c.before]} → ${ACCENTS[c.after]}`;
      if (field === "placement") return c.after === "hero" ? "Now the passage shown" : "No longer shown";
      if (["imageSide", "platform", "mode", "comparison", "href"].includes(field)) return `${esc(c.before ?? "")} → ${esc(c.after ?? "")}`;
      const type = fieldType(c.path);
      return wordDiff(toText(c.before, type), toText(c.after, type));
    }
    case "image":
      return `<span class="thumbs" style="display:inline-grid;grid-template-columns:56px auto 56px;gap:8px"><img src="${esc(imgUrl(typeof c.before === "object" ? c.before?.src : c.before))}" alt="" style="max-height:72px"><span class="arrow">→</span><img src="${esc(imgUrl(`/_blob/${c.upload?.asset}`))}" alt="" style="max-height:72px"></span>${c.frame ? " · framed for you" : ""}`;
    case "order": {
      const name = (id) => short(entryName(model, c.collection, id).replace(/^(Callout|Carousel): /, ""), 22);
      return c.after.map((id) => esc(name(id))).join(" → ");
    }
    case "add": return c.collection === "callouts" ? `Adds “${esc(short(c.data?.title, 50))}”` : `Adds a copy of ${esc(KINDS[c.data?.kind]?.name ?? "a section")}`;
    case "remove": return c.collection === "callouts" ? `Removes “${esc(short(c.before?.title, 50))}”` : "Removes this section";
    case "note": {
      const pics = (c.images ?? []).map((p) => `<img src="${esc(imgUrl(`/_blob/${p.asset}`))}" alt="" style="max-height:72px;border-radius:6px">`).join(" ");
      return `${pics ? `<span class="row">${pics}</span>` : ""}${esc(c.text) || "<i>Say where it goes</i>"}`;
    }
    default: return "";
  }
}

function showTarget(c) {
  if (c.op === "note") return { type: "note", key: c.key };
  if (c.op === "add" || c.op === "remove") return c.collection === "callouts" ? { type: "callout", id: c.id } : { type: "section", id: c.id };
  if (c.op === "order") return null;
  if (!c.path) return null;
  const [where, id] = c.path;
  const last = String(c.path[c.path.length - 1]);
  if (c.op === "image") return { type: "image", path: c.path };
  if (where === "sections" && ["background", "hidden"].includes(last)) return { type: "section", id };
  if (where === "callouts" && ["accent", "imageSide", "platform", "mode"].includes(last)) return { type: "callout", id };
  if (/^(label|href)$/.test(last) && (c.path.includes("buttons") || c.path.includes("link"))) return { type: "link", path: c.path.slice(0, -1) };
  if (where === "examples" && ["comparison", "placement"].includes(last)) return { type: "example", id };
  return { type: "field", path: c.path };
}

function renderChanges() {
  const p = els.panels.changes;
  if (!st.seed) { p.innerHTML = ""; return; }
  const draft = draftList();
  if (!draft.length) {
    p.innerHTML = `<h2>Your changes</h2><p class="lede">Nothing changed yet. Click anything on the page to edit it; every edit shows up here before you send it.</p>`;
    return;
  }
  const { problems, conflicts, warnings } = review();
  const groups = new Map();
  for (const c of draft) {
    const g = groupOf(c);
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g).push(c);
  }
  const results = current().results;
  p.innerHTML = `
    <h2>Your changes</h2>
    <p class="lede">${draft.length} change${draft.length === 1 ? "" : "s"}, saved here until you send them.</p>
    ${problems.length ? `<div class="box box--bad"><strong>Fix before sending</strong><ul>${problems.map((x) => `<li>${esc(x)}</li>`).join("")}</ul></div>` : ""}
    ${conflicts.length ? `<div class="box box--warn"><strong>${conflicts.length} change${conflicts.length === 1 ? "" : "s"} no longer fit</strong><p>The live page changed under ${conflicts.length === 1 ? "it" : "them"} since you edited. Use your version anyway, or drop ${conflicts.length === 1 ? "it" : "them"}.</p></div>` : ""}
    ${[...groups.entries()].map(([g, list]) => `
      <section class="group"><h3>${esc(g)}</h3><ul class="changes">${list.map((c) => {
        const r = results[c.key];
        const conflict = r?.status === "conflict";
        const target = showTarget(c);
        return `<li class="change${conflict ? " is-conflict" : ""}">
          <div class="change__top"><strong>${esc(c.label || fieldLabel(c.path ?? []))}</strong>${conflict ? '<span class="chip chip--warn">Changed since</span>' : `<span class="chip chip--sel">${c.op === "note" && c.images?.length ? "New picture" : { set: "Edit", image: "Picture", order: "Order", add: "Added", remove: "Removed", note: "Note" }[c.op]}</span>`}</div>
          <div class="diff">${describe(c)}</div>
          ${conflict ? `<p class="hint">${esc(r.reason)}</p>` : ""}
          ${c.note ? `<p class="change__note">Note: ${esc(c.note)}</p>` : ""}
          <div class="row">
            ${target ? `<button type="button" class="btn" data-action="show" data-key="${esc(c.key)}">Show</button>` : ""}
            ${conflict && c.op === "set" ? `<button type="button" class="btn" data-action="rebase" data-key="${esc(c.key)}">Use my version</button>` : ""}
            <button type="button" class="btn btn--quiet" data-action="revert" data-key="${esc(c.key)}">${c.op === "note" ? "Delete" : "Undo"}</button>
          </div>
        </li>`;
      }).join("")}</ul></section>`).join("")}
    ${warnings.length ? `<div class="box"><strong>House style</strong><ul>${warnings.map((w) => `<li>${esc(w)}</li>`).join("")}</ul><p class="hint">The site writes American English with curly quotes. Claude will ask before changing your words.</p></div>` : ""}
    <label class="fld" for="message"><span>Anything Claude should know about this batch?</span><textarea id="message" rows="3" placeholder="Optional">${esc(st.draft.message ?? "")}</textarea></label>
    <button type="button" class="btn btn--primary" id="send" ${problems.length || conflicts.length ? "disabled" : ""}>Send ${draft.length} change${draft.length === 1 ? "" : "s"} to Claude</button>
    <p class="hint">Claude applies them, opens a review on GitHub with a preview of the real page, and reports back under Requests. The page goes live once the review is merged.</p>`;
}

// --- The Requests panel --------------------------------------------------------------

function renderRequests() {
  const p = els.panels.requests;
  const list = [...st.requests].sort((a, b) => b.number - a.number);
  if (!list.length) {
    p.innerHTML = `<h2>Requests</h2><p class="lede">Batches you send show up here, with where each one stands: sent, being worked on, ready to review with a preview link, then live.</p>`;
    return;
  }
  const when = (iso) => (iso ? new Date(iso).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "");
  p.innerHTML = `<h2>Requests</h2>${list.map((r) => {
    const results = r.results ?? {};
    const calls = (r.calls ?? []).map((call) => `
      <div class="call"><p><strong>${esc(call.question)}</strong></p>${call.why ? `<p class="hint">${esc(call.why)}</p>` : ""}
        <div class="choice" role="radiogroup" aria-label="${esc(call.question)}">${(call.options ?? []).map((o) => `<label><input type="radio" name="call-${esc(r.id)}-${esc(call.id)}" value="${esc(o.id)}" ${call.answer === o.id ? "checked" : ""}> <span>${esc(o.label)}${o.recommended ? " <small>Recommended</small>" : ""}${o.detail ? `<small>${esc(o.detail)}</small>` : ""}</span></label>`).join("")}</div>
        <div class="row"><button type="button" class="btn" data-action="answer" data-req="${esc(r.id)}" data-call="${esc(call.id)}">${call.answer ? "Change answer" : "Send answer"}</button>${call.answer ? '<span class="chip chip--good">Answered</span>' : ""}</div>
      </div>`).join("");
    return `<article class="req">
      <div class="req__top"><strong>#${r.number}</strong><span class="pill" data-s="${esc(r.status)}">${esc(STATUS[r.status] ?? r.status)}</span><time datetime="${esc(r.createdAt ?? "")}">${esc(when(r.createdAt))}</time></div>
      ${r.message ? `<p>${esc(r.message)}</p>` : ""}
      ${calls}
      ${r.pr?.url || r.preview ? `<div class="links">${r.preview ? `<a class="btn btn--primary" href="${esc(r.preview)}" target="_blank" rel="noopener noreferrer">See the preview</a>` : ""}${r.pr?.url ? `<a class="btn" href="${esc(r.pr.url)}" target="_blank" rel="noopener noreferrer">Review on GitHub${r.pr.number ? ` (#${r.pr.number})` : ""}</a>` : ""}</div>` : ""}
      <details><summary class="hint">${(r.changes ?? []).length} change${(r.changes ?? []).length === 1 ? "" : "s"}</summary><ul class="items">${(r.changes ?? []).map((c) => {
        const res = results[c.key];
        const [label, tone] = RESULT[res?.status] ?? [];
        const what = c.op === "note" ? `${c.anchor ? `${anchorName(c.anchor)}: ` : ""}${short(c.text, 50)}` : "";
        return `<li><span>${esc(c.label || "Change")}${what ? `: ${esc(what)}` : ""}</span>${label ? `<span class="chip chip--${tone}" title="${esc(res.reason ?? "")}">${label}</span>` : ""}</li>`;
      }).join("")}</ul></details>
      ${(r.log ?? []).length ? `<ul class="log">${[...r.log].reverse().slice(0, 6).map((l) => `<li><time>${esc(when(l.at))}</time>${esc(l.text)}</li>`).join("")}</ul>` : ""}
      ${r.status === "sent" ? `<div class="row"><button type="button" class="btn" data-action="withdraw-edit" data-req="${esc(r.id)}">Take back to edit</button><button type="button" class="btn btn--quiet" data-action="withdraw" data-req="${esc(r.id)}">Withdraw</button></div>` : ""}
    </article>`;
  }).join("")}`;
}

// --- Events ------------------------------------------------------------------------------

els.replica.addEventListener("click", (e) => {
  e.preventDefault();
  if (st.preview || !st.seed) return;
  const t = e.target.closest("[data-section-tag],[data-add],[data-note],[data-edit],[data-image],[data-link],[data-season],[data-callout],[data-carousel-card],[data-example],[data-section]");
  if (!t) return select(null);
  if (t.dataset.sectionTag) return select({ type: "section", id: t.dataset.sectionTag });
  if (t.dataset.add === "callout") return addCallout();
  if (t.dataset.note) return select({ type: "note", key: t.dataset.note });
  if (t.dataset.edit) return select({ type: "field", path: parsePathKey(t.dataset.edit) });
  if (t.dataset.image) {
    const path = parsePathKey(t.dataset.image);
    select({ type: "image", path });
    if (t.classList.contains("studio-drop")) pickImage(path);
    return;
  }
  if (t.dataset.link) return select({ type: "link", path: parsePathKey(t.dataset.link) });
  if (t.dataset.season) return select({ type: "season", id: t.dataset.season });
  if (t.dataset.callout) return select({ type: "callout", id: t.dataset.callout });
  if (t.dataset.carouselCard) return select({ type: "carousel", id: t.dataset.carouselCard });
  if (t.dataset.example) return select({ type: "example", id: t.dataset.example });
  if (t.dataset.section) return select({ type: "section", id: t.dataset.section });
});

// Drop a file onto a picture to replace it, or anywhere else in a section to
// add it there (then say where it goes).
els.replica.addEventListener("dragover", (e) => {
  if (st.preview || !e.dataTransfer?.types.includes("Files")) return;
  if (e.target.closest("[data-image],[data-note],[data-section]")) e.preventDefault();
});
els.replica.addEventListener("drop", (e) => {
  const f = e.dataTransfer?.files?.[0];
  if (!f || st.preview) return;
  const img = e.target.closest("[data-image]");
  const note = e.target.closest("[data-note]");
  const section = e.target.closest("[data-section]");
  if (!img && !note && !section) return;
  e.preventDefault();
  if (img) return upload(parsePathKey(img.dataset.image), f);
  if (note) return attachAndShow(note.dataset.note, f);
  return addPictureTo(section.dataset.section, f);
});

function attachAndShow(key, file) {
  return attachPicture(key, file).then((ok) => {
    if (!ok) return;
    st.selection = { type: "note", key };
    st.tab = "edit";
    changed();
  });
}

/** What a drop zone in the panel does with a file, chosen or dropped. */
function useFile(drop, file) {
  const d = drop.dataset;
  if (d.action === "pick") return upload(parsePathKey(d.path), file);
  if (d.action === "attach") return attachAndShow(d.key, file);
  if (d.action === "add-picture") return addPictureTo(d.id, file);
}
function chooseFile(drop) {
  if (drop.dataset.action === "pick") return pickImage(parsePathKey(drop.dataset.path));
  pick((f) => useFile(drop, f));
}

const panelsRoot = $("#inspector");

panelsRoot.addEventListener("click", (e) => {
  const tab = e.target.closest("[data-tab]");
  if (tab) { st.tab = tab.dataset.tab; renderAll(); return; }
  const sw = e.target.closest("[data-swatch]");
  if (sw) {
    const s = st.selection;
    if (sw.dataset.swatch === "background" && s?.type === "section") setField(["sections", s.id, "background"], sw.dataset.value === "plain" && valueAt(baseFor(`set:${pathKey(["sections", s.id, "background"])}`), ["sections", s.id, "background"]) === undefined ? undefined : sw.dataset.value);
    if (sw.dataset.swatch === "accent" && s?.type === "callout") setField(["callouts", s.id, "accent"], sw.dataset.value);
    return;
  }
  const sf = e.target.closest("[data-set-field]");
  if (sf) return setField(parsePathKey(sf.dataset.setField), sf.dataset.value);
  const a = e.target.closest("[data-action]");
  if (!a) return;
  const d = a.dataset;
  switch (d.action) {
    case "deselect": return select(null, { focus: false });
    case "revert": return revert(d.key);
    case "revert-link": {
      const path = parsePathKey(d.path);
      delete st.draft.changes[`set:${pathKey([...path, "label"])}`];
      delete st.draft.changes[`set:${pathKey([...path, "href"])}`];
      return changed();
    }
    case "italic": {
      const ta = $("#field-text");
      if (!ta) return;
      const [s0, s1] = [ta.selectionStart, ta.selectionEnd];
      const v = ta.value;
      const picked = v.slice(s0, s1);
      ta.value = picked.startsWith("*") && picked.endsWith("*") && picked.length > 1 ? v.slice(0, s0) + picked.slice(1, -1) + v.slice(s1) : `${v.slice(0, s0)}*${picked || "italic"}*${v.slice(s1)}`;
      ta.focus();
      ta.dispatchEvent(new Event("input", { bubbles: true }));
      return;
    }
    case "pick":
    case "attach":
    case "add-picture":
      return chooseFile(a);
    case "reuse": return reusePicture(d.key, d.asset);
    case "unattach": return unattachPicture(d.key, d.asset);
    case "edit-note": return select({ type: "note", key: d.key }, { scroll: true });
    case "add-section-note": {
      const key = newNote(["sections", d.id]);
      st.selection = { type: "note", key };
      changed();
      requestAnimationFrame(() => $("#note-text")?.focus({ preventScroll: true }));
      return;
    }
    case "add-note-picture": {
      const at = $("#free-anchor")?.value || null;
      const text = smartQuotes($("#free-note")?.value ?? "");
      return pick((f) => addPictureTo(at, f, text));
    }
    case "move": return move(d.coll, d.id, Number(d.dir));
    case "hide": {
      const s = current().model.sections.find((x) => x.id === d.id);
      return setField(["sections", d.id, "hidden"], !s?.hidden);
    }
    case "duplicate": return duplicateSection(d.id);
    case "remove": return removeEntry(d.coll, d.id);
    case "add-callout": return addCallout();
    case "copy-callout": return addCallout(d.id, current().model.callouts.find((x) => x.id === d.id));
    case "edit-field": return select({ type: "field", path: parsePathKey(d.path) }, { scroll: true });
    case "edit-image": return select({ type: "image", path: parsePathKey(d.path) }, { scroll: true });
    case "select-section": return select({ type: "section", id: d.id }, { scroll: true, focus: false });
    case "select-callout": return select({ type: "callout", id: d.id }, { scroll: true, focus: false });
    case "select-carousel": return select({ type: "carousel", id: d.id }, { scroll: true, focus: false });
    case "select-season": return select({ type: "season", id: d.id }, { scroll: true, focus: false });
    case "page-title": return select({ type: "field", path: ["page", "title"] });
    case "add-note": {
      const at = $("#free-anchor")?.value;
      addNote(smartQuotes($("#free-note")?.value ?? ""), at ? ["sections", at] : null);
      return;
    }
    case "show": {
      const c = st.draft.changes[d.key];
      const target = c && showTarget(c);
      if (target) select(target, { scroll: true, focus: false });
      return;
    }
    case "rebase": {
      const c = st.draft.changes[d.key];
      if (!c) return;
      c.before = clone(valueAt(baseFor(d.key), c.path));
      return changed();
    }
    case "answer": {
      const picked = $(`input[name="call-${CSS.escape(d.req)}-${CSS.escape(d.call)}"]:checked`, panelsRoot);
      if (!picked) return toast("Pick an answer first.");
      return answerCall(d.req, d.call, picked.value);
    }
    case "withdraw": return withdraw(d.req, { edit: false });
    case "withdraw-edit": return withdraw(d.req, { edit: true });
    default:
  }
});

panelsRoot.addEventListener("keydown", (e) => {
  const drop = e.target.closest(".drop");
  if (drop && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); chooseFile(drop); }
});

panelsRoot.addEventListener("dragover", (e) => {
  const drop = e.target.closest(".drop");
  if (drop) { e.preventDefault(); drop.classList.add("is-over"); }
});
panelsRoot.addEventListener("dragleave", (e) => e.target.closest(".drop")?.classList.remove("is-over"));
panelsRoot.addEventListener("drop", (e) => {
  const drop = e.target.closest(".drop");
  const f = e.dataTransfer?.files?.[0];
  if (!drop || !f) return;
  e.preventDefault();
  drop.classList.remove("is-over");
  useFile(drop, f);
});

panelsRoot.addEventListener("input", (e) => {
  const t = e.target;
  if (t.id === "field-text") {
    const type = t.dataset.type;
    const [s0, s1] = [t.selectionStart, t.selectionEnd];
    const curled = smartQuotes(t.value);
    if (curled !== t.value) { t.value = curled; t.setSelectionRange(s0, s1); }
    const path = parsePathKey(t.dataset.path);
    setField(path, fromText(t.value, type), { quiet: true });
    const meta = $("#field-meta");
    const open = meta?.querySelector("details.note")?.open;
    if (meta) {
      meta.innerHTML = fieldMeta(path);
      if (open) meta.querySelector("details.note")?.setAttribute("open", "");
    }
    return;
  }
  if (t.id === "link-label" || t.id === "link-href") {
    let v = t.value;
    if (t.id === "link-label") {
      const curled = smartQuotes(v);
      if (curled !== v) { const s0 = t.selectionStart; t.value = curled; t.setSelectionRange(s0, s0); v = curled; }
    }
    setField(parsePathKey(t.dataset.path), v, { quiet: true });
    return;
  }
  if (t.id === "image-alt" || t.id === "image-name") {
    const s = st.selection;
    const c = s && st.draft.changes[`image:${pathKey(s.path)}`];
    if (!c) {
      if (t.id === "image-alt" && s) setField([...s.path, "alt"], smartQuotes(t.value), { quiet: true });
      return;
    }
    if (t.id === "image-alt") c.alt = smartQuotes(t.value);
    else c.fileName = slugify(t.value) || c.fileName;
    invalidate();
    queueSave();
    if (t.id === "image-name") {
      const spec = RULES.slots[slotOf(s.path)];
      const meta = t.closest(".panel")?.querySelector(".fld + .meta span");
      if (meta) meta.textContent = `Ships as ${spec.dir.replace(/^public/, "")}/${slugify(t.value) || "screenshot"}.webp`;
    }
    return;
  }
  if (t.id === "note-text" || t.dataset.pic) {
    const c = st.selection?.type === "note" && st.draft.changes[st.selection.key];
    if (!c) return;
    if (t.id === "note-text") {
      const [s0, s1] = [t.selectionStart, t.selectionEnd];
      const curled = smartQuotes(t.value);
      if (curled !== t.value) { t.value = curled; t.setSelectionRange(s0, s1); }
      c.text = t.value;
    } else {
      const p = (c.images ?? []).find((x) => x.asset === t.dataset.pic);
      if (!p) return;
      if (t.dataset.picField === "alt") p.alt = smartQuotes(t.value);
      if (t.dataset.picField === "fileName") p.fileName = slugify(t.value) || p.fileName;
    }
    return changedQuietly();
  }
  if (t.dataset.note) return setNote(t.dataset.note, t.value);
  if (t.id === "message") { st.draft.message = t.value; queueSave(); }
});

panelsRoot.addEventListener("change", (e) => {
  const t = e.target;
  if (t.name === "frame") {
    const c = st.selection && st.draft.changes[`image:${pathKey(st.selection.path)}`];
    if (c) { c.frame = t.value === "frame"; changed(); }
  }
  if (t.id === "note-anchor" || t.dataset.picField === "frame") {
    const c = st.selection?.type === "note" && st.draft.changes[st.selection.key];
    if (!c) return;
    if (t.id === "note-anchor") c.anchor = t.value ? ["sections", t.value] : null;
    else {
      const p = (c.images ?? []).find((x) => x.asset === t.dataset.pic);
      if (p) p.frame = t.value === "frame";
    }
    changed();
  }
  if (t.id === "pick-example") {
    const model = current().model;
    const old = model.examples.find((x) => x.placement === "hero");
    if (old && old.id !== t.value) setField(["examples", old.id, "placement"], "deeper", { quiet: true });
    setField(["examples", t.value, "placement"], "hero");
  }
  if (t.id === "pick-comparison") setField(["examples", t.dataset.id, "comparison"], t.value);
});

document.addEventListener("click", (e) => {
  if (e.target.closest("#send")) send();
  if (e.target.closest("#review-send")) { st.tab = "changes"; renderAll(); }
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && st.selection && !e.target.closest("textarea, input, select")) select(null, { focus: false });
});

$("#devices").addEventListener("click", (e) => {
  const b = e.target.closest("[data-device]");
  if (!b) return;
  st.device = b.dataset.device;
  store("device", st.device);
  for (const x of $$("[data-device]")) x.setAttribute("aria-pressed", String(x === b));
  fit();
});
$("#themes").addEventListener("click", (e) => {
  const b = e.target.closest("[data-page-theme]");
  if (!b) return;
  st.pageTheme = b.dataset.pageTheme;
  store("theme", st.pageTheme);
  for (const x of $$("[data-page-theme]")) x.setAttribute("aria-pressed", String(x === b));
  els.replica.dataset.theme = st.pageTheme;
});
$("#show-changes").addEventListener("change", (e) => { st.showChanges = e.target.checked; renderReplica(); });
$("#preview").addEventListener("change", (e) => { st.preview = e.target.checked; if (st.preview) st.selection = null; renderAll(); });

// --- Start ----------------------------------------------------------------------------------

function restoreView() {
  const device = store("device");
  if (DEVICES[device]) st.device = device;
  const dark = document.documentElement.dataset.theme === "dark" || (!document.documentElement.dataset.theme && matchMedia("(prefers-color-scheme: dark)").matches);
  const theme = store("theme");
  st.pageTheme = theme === "light" || theme === "dark" ? theme : dark ? "dark" : "light";
  if (window.innerWidth < 700 && !device) st.device = "phone";
  for (const x of $$("[data-device]")) x.setAttribute("aria-pressed", String(x.dataset.device === st.device));
  for (const x of $$("[data-page-theme]")) x.setAttribute("aria-pressed", String(x.dataset.pageTheme === st.pageTheme));
}

(async () => {
  restoreView();
  let db = null;
  try { db = window.claude?.use ? await window.claude.use("db") : null; } catch { db = null; }
  if (!db) {
    setStatus("error", "Offline");
    showNotice("<strong>The Studio needs claude.ai to work.</strong> Open it there, signed in, to see and edit the page.");
    return;
  }
  st.db = db;
  try { st.assets = window.claude?.use ? await window.claude.use("assets") : null; } catch { st.assets = null; }

  db.doc("studio/page").onSnapshot((snap) => {
    if (!snap.exists) {
      showNotice("<strong>The page hasn’t been loaded yet.</strong> In Claude, type /apps-studio and it will load the live page here.");
      setStatus("idle", "Waiting for the page");
      return;
    }
    st.seed = snap.data();
    showNotice("");
    els.seedLabel.textContent = st.seed.commit ? `live page · ${String(st.seed.commit).slice(0, 7)}` : "live page";
    invalidate();
    renderFromDb();
    if (els.status.dataset.state === "idle") setStatus("saved", "Up to date");
  }, (e) => setStatus("error", e?.code === "revoked" ? "Access changed" : "Lost the connection; reload"));

  db.doc("studio/draft").onSnapshot((snap) => {
    if (snap.metadata.hasPendingWrites || st.dirty || st.saving) return;
    const data = snap.exists ? snap.data() : null;
    const next = { changes: clone(data?.changes ?? {}), message: data?.message ?? "" };
    if (deepEqual(next, st.draft)) return; // the echo of this board's own save
    st.draft = next;
    invalidate();
    renderFromDb();
  });

  db.collection("requests").onSnapshot((snap) => {
    st.requests = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    invalidate();
    renderFromDb();
  });
})();
