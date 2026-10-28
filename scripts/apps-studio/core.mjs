/**
 * The Apps Page Studio's core: the /apps page as one model the board edits,
 * read from its content files and written back to them.
 *
 * Pure. Every function takes file contents and returns file contents or
 * data; store.mjs reads and writes the disk and processes images, and cli.mjs
 * is the shell Claude runs. The board itself is scripts/apps-studio/board/.
 *
 * The model, which the board receives as its seed:
 *   page      { title, description }      litbible.net only (src/pages/apps.astro)
 *   sections  [{ id, kind, order, ... }]  src/content/apps-sections/<id>.json
 *   callouts  [{ id, ..., body }]         src/content/callouts/<id>.md
 *   examples  [{ id, ... }]               src/content/examples/<id>.md
 *   seasons   [{ id, ... }]               src/content/seasons/<id>.md
 *
 * A change names a place in the model by `path` (["sections", "hero",
 * "title"], ["callouts", "the-day-youre-in", "body"], ["page", "title"]) and
 * carries the value it had when Brandon edited it (`before`). A change whose
 * place no longer holds `before` is refused as a conflict rather than written
 * over, because someone (or something) changed the page since.
 *
 * A `note` is for Claude to act on by hand. It may name a section
 * (`anchor: ["sections", id]`) and carry pictures (`images`), as when
 * Brandon adds a picture to a section and says where it goes: the apply step
 * converts each picture (planPicture) and Claude lays it out, making it a
 * picture field of that section so the board can swap it from then on.
 */
import { parseDoc, serializeDoc } from "./frontmatter.mjs";

export const FORMAT = 1;

export const DIRS = {
  sections: "src/content/apps-sections",
  callouts: "src/content/callouts",
  examples: "src/content/examples",
  seasons: "src/content/seasons",
};
export const PAGE_FILE = "src/pages/apps.astro";

/** The order a new Markdown file's fields are written in; existing files keep theirs. */
const KEYS = {
  callouts: ["title", "order", "platform", "mode", "accent", "imageSide", "image"],
  examples: ["reference", "placement", "order", "comparison", "litText", "traditionalText", "note"],
  seasons: ["name", "order", "colorVar", "image"],
};
/** Fields these files write in double quotes, as they always have. */
const QUOTED = ["image", "note", "colorVar"];

/**
 * The board's rules, sent with every seed so the board never keeps its own
 * copy. The enums must match src/components/apps/collections.ts; the tests
 * hold them to it.
 */
export const RULES = {
  backgrounds: ["plain", "soft", "advent", "christmas", "lent", "easter", "ot", "green"],
  accents: ["advent", "christmas", "lent", "easter", "ot"],
  platforms: ["ios", "android"],
  modes: ["light", "dark"],
  sides: ["left", "right"],
  comparisons: ["NIV", "NRSV", "ESV", "KJV"],
  placements: ["hero", "deeper"],
  /** Section kinds that can be copied into a second section, or removed. The rest only hide. */
  duplicable: ["about", "bigscreens", "humane"],
  /**
   * Where each kind of image goes and how big it ships (FIXLIST O8: longest
   * edge 1000–1300px at WebP quality 80). `frame: "apple"` means a raw iPhone,
   * iPhone Duo or iPad screenshot can be framed by the `frames` CLI, which
   * knows only Apple devices; Android screenshots arrive framed. `picture` is
   * any other picture in a section, including one Brandon adds to a section
   * for Claude to lay out: 1000px tall, or 1300px wide when it's landscape.
   */
  slots: {
    phone: { label: "Phone screenshot", dir: "public/assets/screenshots", longest: 1000, frame: "apple" },
    carousel: { label: "Carousel screenshot", dir: "public/assets/screenshots/carousel", longest: 1000, frame: "apple" },
    tablet: { label: "Tablet screenshot", dir: "public/assets/screenshots", longest: 1300, frame: "apple" },
    foldable: { label: "Foldable screenshot", dir: "public/assets/screenshots", longest: 1000, frame: null },
    picture: { label: "Picture", dir: "public/assets/screenshots", longest: 1000, longestWide: 1300, frame: "apple" },
    icon: { label: "App icon", dir: "public/assets/images", longest: 512, frame: null, square: true },
    "icon-svg": { label: "App icon (SVG)", dir: "public/assets/images", frame: null, svg: true },
  },
  quality: 80,
  /** The app icons, replaced in place: every page that shows them (here, the home page, the banner, the share card) follows. */
  iconFiles: ["/assets/images/lit-app-icon-ios.webp", "/assets/images/lit-app-icon.svg"],
};

/** Fields that hold something other than prose, so quotes and spelling are left alone. */
const NOT_PROSE = new Set([
  "href", "src", "id", "kind", "background", "platform", "mode", "accent", "imageSide",
  "image", "colorVar", "comparison", "placement", "order", "hidden", "width", "height",
]);
const FIXED = new Set(["id", "kind", "order"]);
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

// --- Reading -------------------------------------------------------------

const base = (p) => p.slice(p.lastIndexOf("/") + 1).replace(/\.(json|md)$/, "");
const byOrder = (a, b) => (a.order ?? 0) - (b.order ?? 0) || a.id.localeCompare(b.id);

/** @param {Record<string, string>} files repo-relative path → contents */
export function readModel(files) {
  const model = {
    format: FORMAT,
    page: readPage(files[PAGE_FILE] ?? ""),
    sections: [],
    callouts: [],
    examples: [],
    seasons: [],
  };
  for (const [path, text] of Object.entries(files)) {
    const dir = path.slice(0, path.lastIndexOf("/"));
    if (dir === DIRS.sections && path.endsWith(".json")) {
      model.sections.push({ id: base(path), ...JSON.parse(text) });
    }
    for (const name of ["callouts", "examples", "seasons"]) {
      if (dir !== DIRS[name] || !path.endsWith(".md")) continue;
      const doc = parseDoc(text, path);
      const entry = { id: base(path) };
      for (const f of doc.fields) entry[f.key] = f.value;
      if (name === "callouts") entry.body = doc.body;
      model[name].push(entry);
    }
  }
  for (const name of ["sections", "callouts", "examples", "seasons"]) model[name].sort(byOrder);
  return model;
}

const LAYOUT_ATTR = (name) => new RegExp(`(<Layout\\b[^>]*?\\s${name}=")([^"]*)(")`);

export function readPage(text) {
  const title = LAYOUT_ATTR("title").exec(text);
  const description = LAYOUT_ATTR("description").exec(text);
  return { title: title ? title[2] : "", description: description ? description[2] : "" };
}

// --- Changing --------------------------------------------------------------

export function deepEqual(a, b) {
  if (Object.is(a, b)) return true;
  if (typeof a !== "object" || typeof b !== "object" || a === null || b === null) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const ka = Object.keys(a).filter((k) => a[k] !== undefined);
  const kb = Object.keys(b).filter((k) => b[k] !== undefined);
  return ka.length === kb.length && ka.every((k) => deepEqual(a[k], b[k]));
}

const show = (v) => (typeof v === "string" ? `“${v.length > 80 ? `${v.slice(0, 77)}…` : v}”` : JSON.stringify(v));
const singular = { sections: "section", callouts: "callout", examples: "example", seasons: "season" };

function locate(model, path) {
  if (!Array.isArray(path) || !path.length) throw new Error("the change doesn’t say where it goes");
  const [where, ...rest] = path;
  if (where === "page") return { obj: model.page, keys: rest };
  const list = model[where];
  if (!Array.isArray(list)) throw new Error(`there is no “${where}” on the page`);
  const [id, ...keys] = rest;
  const entry = list.find((e) => e.id === id);
  if (!entry) throw new Error(`there is no ${singular[where]} “${id}” any more`);
  return { obj: entry, keys };
}

const getAt = (obj, keys) => keys.reduce((o, k) => (o == null ? undefined : o[k]), obj);

function setAt(obj, keys, value) {
  let o = obj;
  for (const k of keys.slice(0, -1)) {
    if (o[k] == null || typeof o[k] !== "object") throw new Error(`“${keys.join(".")}” isn’t a field there`);
    o = o[k];
  }
  const last = keys[keys.length - 1];
  if (value === undefined) delete o[last];
  else o[last] = value;
}

/** Number entries 1, 2, 3… in list order, as the files always have. */
function renumber(list) {
  list.forEach((e, i) => { e.order = i + 1; });
}

const OP_ORDER = { add: 0, remove: 1, set: 2, image: 2, order: 3, note: 4 };

/**
 * Apply a request's changes to a model.
 * @param {object} model from readModel
 * @param {object[]} changes from the board
 * @param {{images?: Record<string, {src: string, width: number, height: number}>}} [opts]
 *   each image change's processed file (store.mjs), keyed by the change's `key`
 * @returns {{model: object, results: {key: string, status: string, reason?: string}[]}}
 *   status is applied, already (the page already says so), conflict (not
 *   written; reason says why), or manual (a note for Claude to act on by hand)
 */
export function applyChanges(model, changes, { images = {} } = {}) {
  const m = structuredClone(model);
  const results = [];
  const sorted = changes
    .map((c, i) => ({ c, i }))
    .sort((a, b) => (OP_ORDER[a.c.op] ?? 9) - (OP_ORDER[b.c.op] ?? 9) || a.i - b.i);
  for (const { c } of sorted) {
    try {
      results.push({ key: c.key, label: c.label, ...applyOne(m, c, images) });
    } catch (e) {
      results.push({ key: c.key, label: c.label, status: "conflict", reason: e.message });
    }
  }
  // Report in the order the board sent them.
  const position = new Map(changes.map((c, i) => [c.key, i]));
  results.sort((a, b) => (position.get(a.key) ?? 0) - (position.get(b.key) ?? 0));
  return { model: m, results };
}

function applyOne(m, c, images) {
  switch (c.op) {
    case "set": {
      const { obj, keys } = locate(m, c.path);
      if (!keys.length) throw new Error("the change doesn’t name a field");
      if (FIXED.has(keys[0])) throw new Error(`“${keys[0]}” isn’t changed this way`);
      const field = String(keys[keys.length - 1]);
      let after = c.after;
      if (typeof after === "string" && !NOT_PROSE.has(field)) after = smartQuotes(after);
      if (field === "hidden" && after === false) after = undefined;
      const now = getAt(obj, keys);
      if (deepEqual(now, after)) return { status: "already" };
      const before = field === "hidden" && c.before === false ? undefined : c.before;
      if (!deepEqual(now, before)) throw new Error(`it changed since you edited it; it now reads ${show(now)}`);
      setAt(obj, keys, after);
      return { status: "applied" };
    }
    case "image": {
      const img = images[c.key];
      if (!img) throw new Error("the new image wasn’t processed");
      if (c.path[0] === "files") return { status: "applied" }; // replaced in place by store.mjs
      const { obj, keys } = locate(m, c.path);
      const now = getAt(obj, keys);
      const nowSrc = typeof now === "string" ? now : now?.src ?? null;
      const beforeSrc = typeof c.before === "string" ? c.before : c.before?.src ?? null;
      if (nowSrc !== beforeSrc) throw new Error(`the image there changed since you chose this one; it’s now ${show(nowSrc)}`);
      if (typeof now === "object" && now !== null) {
        setAt(obj, keys, { ...now, src: img.src, alt: c.alt ? smartQuotes(c.alt) : now.alt, width: img.width, height: img.height });
      } else {
        setAt(obj, keys, img.src);
      }
      return { status: "applied" };
    }
    case "add": {
      const list = m[c.collection];
      if (!["sections", "callouts"].includes(c.collection)) throw new Error("only sections and callouts can be added");
      if (!SLUG.test(c.id ?? "")) throw new Error(`“${c.id}” can’t be a file name (lowercase letters, digits and hyphens)`);
      if (list.some((e) => e.id === c.id)) throw new Error(`there is already a ${singular[c.collection]} called “${c.id}”`);
      // A copy's data may still carry its source's id and place; the change's own win.
      const data = structuredClone(c.data ?? {});
      delete data.id;
      delete data.order;
      const entry = { id: c.id, ...data };
      if (c.collection === "sections" && !RULES.duplicable.includes(entry.kind)) {
        throw new Error(`a “${entry.kind}” section can’t be copied`);
      }
      const at = c.after ? list.findIndex((e) => e.id === c.after) : list.length - 1;
      list.splice(at < 0 ? list.length : at + 1, 0, entry);
      renumber(list);
      return { status: "applied" };
    }
    case "remove": {
      const list = m[c.collection];
      if (!["sections", "callouts"].includes(c.collection)) throw new Error("only sections and callouts can be removed");
      const i = list.findIndex((e) => e.id === c.id);
      if (i < 0) return { status: "already" };
      if (c.collection === "sections" && !RULES.duplicable.includes(list[i].kind)) {
        throw new Error(`the “${list[i].kind}” section can be hidden but not removed`);
      }
      list.splice(i, 1);
      renumber(list);
      return { status: "applied" };
    }
    case "order": {
      const list = m[c.collection];
      if (!["sections", "callouts", "seasons"].includes(c.collection)) throw new Error("that list can’t be reordered");
      const now = list.map((e) => e.id);
      const after = c.after ?? [];
      if (deepEqual(now, after)) return { status: "already" };
      if (now.length !== after.length || !now.every((id) => after.includes(id))) {
        throw new Error("the list changed since you reordered it");
      }
      list.sort((a, b) => after.indexOf(a.id) - after.indexOf(b.id));
      renumber(list);
      return { status: "applied" };
    }
    case "note":
      return { status: "manual" };
    default:
      throw new Error(`unknown kind of change “${c.op}”`);
  }
}

// --- Checking ----------------------------------------------------------------

const str = (v) => typeof v === "string" && v.trim() !== "";
const oneOf = (v, list) => list.includes(v);

function checkImage(img, where, problems) {
  if (!img || !str(img.src) || !str(img.alt) || !(img.width > 0) || !(img.height > 0)) {
    problems.push(`${where} needs a picture, its alt text, and its size`);
  }
}

function checkButtons(buttons, where, problems) {
  if (!Array.isArray(buttons) || buttons.length !== 2) return problems.push(`${where} needs exactly two store buttons`);
  buttons.forEach((b, i) => {
    if (!oneOf(b?.platform, RULES.platforms) || !str(b?.label) || !str(b?.href)) {
      problems.push(`${where}, button ${i + 1}, needs a platform, a label and a link`);
    }
  });
}

/** Problems that would fail the site's own schema or break the page. Nothing is written while any remain. */
export function validateModel(m) {
  const problems = [];
  if (!str(m.page?.title)) problems.push("The page needs a title");
  if (!str(m.page?.description)) problems.push("The page needs a description");
  for (const field of ["title", "description"]) {
    if (/"/.test(m.page?.[field] ?? "")) problems.push(`The page ${field} can’t contain a straight double quote`);
  }
  for (const s of m.sections) {
    const where = `The “${s.id}” section`;
    if (!SLUG.test(s.id)) problems.push(`${where} has a file name that isn’t lowercase-kebab`);
    if (!oneOf(s.background ?? "plain", RULES.backgrounds)) problems.push(`${where} has an unknown background`);
    if (typeof s.order !== "number") problems.push(`${where} has no place in the page`);
    const need = (fields) => fields.filter((f) => !str(s[f])).forEach((f) => problems.push(`${where} needs its ${f}`));
    switch (s.kind) {
      case "hero":
        need(["title", "subtitle"]);
        checkButtons(s.buttons, where, problems);
        checkImage(s.phones?.back, `${where}’s back phone`, problems);
        checkImage(s.phones?.front, `${where}’s front phone`, problems);
        break;
      case "about":
        need(["title", "text"]);
        if (s.link && (!str(s.link.label) || !str(s.link.href))) problems.push(`${where}’s link needs a label and an address`);
        break;
      case "examples":
        need(["eyebrow", "title", "litLabel"]);
        break;
      case "reader": {
        const cy = s.carousel ?? {};
        if (!str(cy.title) || !str(cy.text) || !str(cy.passage) || !str(cy.stageLabel)) problems.push(`${where}’s carousel needs its title, text, passage and label`);
        if (!(cy.frame?.width > 0) || !(cy.frame?.height > 0)) problems.push(`${where}’s carousel needs its frame size`);
        break;
      }
      case "bigscreens":
        need(["eyebrow", "title", "text"]);
        checkImage(s.devices?.tablet, `${where}’s tablet`, problems);
        checkImage(s.devices?.foldable, `${where}’s foldable`, problems);
        break;
      case "humane":
        need(["eyebrow", "title"]);
        if (!Array.isArray(s.paragraphs) || !s.paragraphs.length || !s.paragraphs.every(str)) problems.push(`${where} needs at least one paragraph, none empty`);
        if (!Array.isArray(s.negations) || !s.negations.every(str)) problems.push(`${where}’s short lines can’t be empty`);
        if (s.link && (!str(s.link.label) || !str(s.link.href))) problems.push(`${where}’s link needs a label and an address`);
        break;
      case "get-app":
        need(["title", "text"]);
        checkButtons(s.buttons, where, problems);
        break;
      default:
        problems.push(`${where} is an unknown kind, “${s.kind}”`);
    }
    // Every other picture in a section, such as one added to a layout later.
    const named = new Set(["phones.back", "phones.front", "devices.tablet", "devices.foldable"]);
    for (const [keys, img] of sectionImages(s)) {
      if (!named.has(keys.join("."))) checkImage(img, `${where}’s ${keys.join(" ")}`, problems);
    }
  }
  for (const c of m.callouts) {
    const where = `The callout “${c.title || c.id}”`;
    if (!SLUG.test(c.id)) problems.push(`${where} has a file name that isn’t lowercase-kebab`);
    if (!str(c.title) || !str(c.body)) problems.push(`${where} needs a title and text`);
    if (!oneOf(c.platform, RULES.platforms) || !oneOf(c.mode, RULES.modes)) problems.push(`${where} needs a platform and a light or dark mode`);
    if (!oneOf(c.accent, RULES.accents)) problems.push(`${where} needs a season color`);
    if (!oneOf(c.imageSide, RULES.sides)) problems.push(`${where} needs a side for its picture`);
    if (!str(c.image)) problems.push(`${where} needs a picture`);
  }
  const heroes = m.examples.filter((e) => e.placement === "hero");
  if (heroes.length !== 1) problems.push(`Exactly one example must be the one shown (found ${heroes.length})`);
  for (const e of m.examples) {
    const where = `The example “${e.reference || e.id}”`;
    if (!str(e.reference) || !str(e.litText) || !str(e.traditionalText)) problems.push(`${where} needs a reference and both texts`);
    if (!oneOf(e.comparison, RULES.comparisons)) problems.push(`${where} compares against an unknown translation`);
    if (!oneOf(e.placement, RULES.placements)) problems.push(`${where} has an unknown placement`);
  }
  for (const s of m.seasons) {
    if (!str(s.name) || !str(s.image) || !str(s.colorVar)) problems.push(`The season “${s.id}” needs a name, a color and a picture`);
  }
  return problems;
}

// --- House style ---------------------------------------------------------------

/**
 * Straight quotes to curly, as every page of the site is written. An opening
 * mark follows a space, a dash or an opening bracket; anything else closes,
 * which is also the apostrophe.
 */
export function smartQuotes(s) {
  return s
    .replace(/(^|[\s([{—–-])"/g, "$1“")
    .replace(/"/g, "”")
    .replace(/(^|[\s([{—–“-])'/g, "$1‘")
    .replace(/'/g, "’");
}

const BRITISH = {
  colour: "color", colours: "colors", favourite: "favorite", favourites: "favorites",
  behaviour: "behavior", centre: "center", centred: "centered", grey: "gray",
  cancelled: "canceled", organise: "organize", organised: "organized", realise: "realize",
  recognise: "recognize", honour: "honor", honours: "honors", labour: "labor",
  catalogue: "catalog", travelling: "traveling", licence: "license", programme: "program",
};

/** Notes for Claude, never blockers: the site writes American English and curly quotes. */
export function textWarnings(m) {
  const warnings = [];
  const visit = (value, where) => {
    if (typeof value === "string") {
      if (/["']/.test(value)) warnings.push(`${where} has a straight quote`);
      for (const word of value.toLowerCase().match(/[a-z]+/g) ?? []) {
        if (BRITISH[word]) warnings.push(`${where}: “${word}” is written “${BRITISH[word]}” on this site`);
      }
    } else if (value && typeof value === "object") {
      for (const [k, v] of Object.entries(value)) if (!NOT_PROSE.has(k)) visit(v, `${where} › ${k}`);
    }
  };
  visit(m.page, "page");
  for (const name of ["sections", "callouts", "examples", "seasons"]) {
    for (const e of m[name]) visit(e, `${singular[name]} “${e.id}”`);
  }
  return warnings;
}

// --- Images --------------------------------------------------------------------

/**
 * Which kind of image a change replaces. Any picture object in a section
 * that isn't a phone, the tablet or the foldable is a `picture`, so one
 * Claude adds to a layout is swappable from the board with no rule of its own.
 */
export function slotFor(path) {
  const [where, id, ...keys] = path.map(String);
  if (where === "files") return id.endsWith(".svg") ? "icon-svg" : "icon";
  if (where === "callouts" && keys[0] === "image") return "phone";
  if (where === "seasons" && keys[0] === "image") return "carousel";
  if (where === "sections" && keys[0] === "phones" && ["back", "front"].includes(keys[1])) return "phone";
  if (where === "sections" && keys[0] === "devices" && keys[1] === "tablet") return "tablet";
  if (where === "sections" && keys[0] === "devices" && keys[1] === "foldable") return "foldable";
  if (where === "sections" && keys.length) return "picture";
  throw new Error(`no picture goes at ${path.join(" › ")}`);
}

/** Every picture object in a section (`{src, alt, width, height}`), with its path. */
export function sectionImages(section) {
  const out = [];
  const walk = (value, keys) => {
    if (!value || typeof value !== "object") return;
    if (typeof value.src === "string") { out.push([keys, value]); return; }
    for (const [k, v] of Object.entries(value)) walk(v, [...keys, k]);
  };
  walk(section, []);
  return out;
}

/** A file name the mirror accepts: lowercase-kebab, no spaces. */
export function slugify(name) {
  return name
    .replace(/\.[a-z0-9]+$/i, "")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Where an image change's new file goes.
 * @param {object} change an `image` change
 * @param {Set<string>} taken repo paths that already exist
 * @returns {{slot: string, out: string, src: string, archive: string|null}}
 */
export function planImage(change, taken) {
  const slot = slotFor(change.path);
  if (change.path[0] === "files") {
    const src = change.path[1];
    if (!RULES.iconFiles.includes(src)) throw new Error(`${src} isn’t one of the app icons`);
    return { slot, out: `public${src}`, src, archive: null };
  }
  return planFile(slot, change.fileName || change.upload?.name, change.upload?.name, taken);
}

/**
 * Where a picture attached to a note goes: a new file in the screenshots
 * folder, sized as a `picture`, for Claude to lay out by hand.
 * @param {{name?: string, fileName?: string}} picture one of a note's `images`
 */
export function planPicture(picture, taken) {
  return planFile("picture", picture.fileName || picture.name, picture.name, taken);
}

function planFile(slot, wanted, original, taken) {
  const spec = RULES.slots[slot];
  const stem = slugify(wanted || "") || (slot === "picture" ? "picture" : "screenshot");
  let name = `${stem}.webp`;
  for (let n = 2; taken.has(`${spec.dir}/${name}`); n++) name = `${stem}-${n}.webp`;
  const out = `${spec.dir}/${name}`;
  const kept = (original || `${stem}.png`).replace(/[/\\]/g, "-");
  const archiveDir = slot === "carousel" ? "_source-images/screenshots/carousel" : "_source-images/screenshots";
  return { slot, out, src: out.replace(/^public/, ""), archive: `${archiveDir}/${kept}` };
}

/** Every image path the model points at, plus the icons. */
export function imagePaths(m) {
  const paths = new Set(RULES.iconFiles);
  for (const s of m.sections) {
    for (const [, img] of sectionImages(s)) paths.add(img.src);
  }
  for (const c of m.callouts) if (c.image) paths.add(c.image);
  for (const s of m.seasons) if (s.image) paths.add(s.image);
  return [...paths];
}

/**
 * The carousel's frame follows its screenshots: when every season's image is
 * one size and the frame says another, the frame takes that size.
 * @param {Record<string, {width: number, height: number}>} sizes src → size
 * @returns {string|null} a sentence for the report when it moved
 */
export function fitCarouselFrame(m, sizes) {
  const reader = m.sections.find((s) => s.kind === "reader");
  if (!reader) return null;
  const dims = m.seasons.map((s) => sizes[s.image]).filter(Boolean);
  if (dims.length !== m.seasons.length || !dims.length) return null;
  const { width, height } = dims[0];
  if (!dims.every((d) => d.width === width && d.height === height)) return "The carousel’s screenshots aren’t all one size, so some will show with space around them.";
  const f = reader.carousel.frame;
  if (f.width * height === f.height * width) return null; // same shape already
  reader.carousel.frame = { width, height };
  return `The carousel’s frame now matches its screenshots (${width}×${height}).`;
}

// --- Writing -------------------------------------------------------------------

/**
 * The files a model becomes, given the files it was read from.
 * @returns {{writes: Record<string, string>, deletes: string[]}} only what changed
 */
export function writeModel(m, files) {
  const writes = {};
  const deletes = [];
  const keep = new Set();
  const put = (path, text) => {
    keep.add(path);
    if (files[path] !== text) writes[path] = text;
  };

  for (const s of m.sections) {
    const { id, ...data } = s;
    put(`${DIRS.sections}/${id}.json`, `${JSON.stringify(data, null, 2)}\n`);
  }

  for (const name of ["callouts", "examples", "seasons"]) {
    for (const e of m[name]) {
      const path = `${DIRS[name]}/${e.id}.md`;
      const { id, body, ...data } = e;
      let fields;
      let bodyArgs;
      if (files[path] !== undefined) {
        const doc = parseDoc(files[path], path);
        fields = doc.fields.map((f) => ({ ...f, original: f.value, value: data[f.key] }));
        for (const k of [...KEYS[name], ...Object.keys(data)]) {
          if (data[k] !== undefined && !fields.some((f) => f.key === k)) fields.push({ key: k, value: data[k] });
        }
        bodyArgs = { body: body ?? doc.body, bodyRaw: doc.bodyRaw, originalBody: doc.body };
      } else {
        const keys = [...new Set([...KEYS[name], ...Object.keys(data)])];
        fields = keys.filter((k) => data[k] !== undefined).map((k) => ({ key: k, value: data[k] }));
        bodyArgs = { body: body ?? "" };
      }
      put(path, serializeDoc(fields, bodyArgs, { quoteKeys: QUOTED }));
    }
  }

  if (files[PAGE_FILE] !== undefined) {
    let text = files[PAGE_FILE];
    for (const field of ["title", "description"]) {
      text = text.replace(LAYOUT_ATTR(field), (_, a, _v, c) => `${a}${m.page[field]}${c}`);
    }
    put(PAGE_FILE, text);
  }

  for (const path of Object.keys(files)) {
    const dir = path.slice(0, path.lastIndexOf("/"));
    if (Object.values(DIRS).includes(dir) && !keep.has(path)) deletes.push(path);
  }
  return { writes, deletes };
}

/** The seed the board loads: the model, the rules, and each image's size. */
export function makeSeed(m, { commit, sizes, seededAt }) {
  return {
    ...structuredClone(m),
    format: FORMAT,
    seededAt,
    commit,
    rules: RULES,
    images: sizes,
  };
}
