/**
 * The Apps Page Studio board's drawing of the /apps page.
 *
 * It writes the same markup the components in src/components/apps/ render,
 * from the same model, so page.css (generated from those components' own
 * styles by `npm run studio:apps -- board-css`) lays it out the same way.
 * When a component's markup changes, change its function here to match.
 *
 * Pure: studio.js puts the result on screen and makes it editable. With
 * `editable` on, editable elements carry where they live in the model:
 *   data-edit="<path>"   a piece of text       data-image="<path>"  a picture
 *   data-link="<path>"   a button or link      data-section="<id>"  a section
 *   data-callout="<id>"  a callout card        data-season="<id>"   a carousel chip
 *   data-carousel-card="<section id>"  the carousel's card, the last callout
 *   data-example="<id>"  the comparison card
 * A path is the model path with each part URI-encoded and joined by "/",
 * so an icon's path ["files", "/assets/images/x.webp"] survives the trip.
 *
 * `inline`, `band` and `smartQuotes` restate render.ts and core.mjs for the
 * browser; test/apps-studio.test.js holds them equal.
 */

export function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** render.ts's `inline`: *italic*, and a line break where the text has one. */
export function inline(text) {
  return String(text ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\*([^*\n]+)\*/g, "<em>$1</em>")
    .replace(/\n/g, "<br>");
}

/** render.ts's `band`. */
export function band(background) {
  if (!background || background === "plain") return "";
  if (background === "soft") return "band--soft";
  return `band--tint band--${background}`;
}

/** core.mjs's `smartQuotes`. */
export function smartQuotes(s) {
  return s
    .replace(/(^|[\s([{—–-])"/g, "$1“")
    .replace(/"/g, "”")
    .replace(/(^|[\s([{—–“-])'/g, "$1‘")
    .replace(/'/g, "’");
}

/** Paragraphs split on blank lines, each in the inline format (callout bodies, example texts). */
export function paragraphs(text) {
  return String(text ?? "")
    .trim()
    .split(/\n\s*\n/)
    .filter((p) => p.trim())
    .map((p) => `<p>${inline(p.replace(/\s*\n\s*/g, " "))}</p>`)
    .join("");
}

export const pathKey = (path) => path.map((p) => encodeURIComponent(String(p))).join("/");
export const parsePathKey = (key) => key.split("/").map(decodeURIComponent);

const byOrder = (a, b) => (a.order ?? 0) - (b.order ?? 0) || String(a.id).localeCompare(String(b.id));
const cls = (...names) => names.filter(Boolean).join(" ");

/**
 * What each section kind is called on the board, and the text in it that
 * can be edited, with how: line (one line), title (Shift+Return for a line
 * break), prose (one paragraph), paras (paragraphs, kept as a list), list
 * (one item per line).
 */
export const KINDS = {
  hero: { name: "Hero", fields: { title: ["Headline", "title"], subtitle: ["Subheading", "prose"] } },
  about: { name: "Text band", fields: { title: ["Heading", "title"], text: ["Text", "prose"] } },
  examples: { name: "A first taste", fields: { eyebrow: ["Small heading", "line"], title: ["Heading", "title"], litLabel: ["LIT column label", "line"] } },
  reader: { name: "Reader features", fields: { "carousel/title": ["Carousel heading", "title"], "carousel/text": ["Carousel text", "prose"], "carousel/passage": ["Passage the screenshots show", "line"], "carousel/stageLabel": ["What a screen reader hears for the carousel", "prose"] } },
  bigscreens: { name: "Device showcase", fields: { eyebrow: ["Small heading", "line"], title: ["Heading", "title"], text: ["Text", "prose"] } },
  humane: { name: "Humane by design", fields: { eyebrow: ["Small heading", "line"], title: ["Heading", "title"], negations: ["Short lines", "list"], paragraphs: ["Text", "paras"] } },
  "get-app": { name: "Get the app", fields: { title: ["Heading", "title"], text: ["Text", "prose"] } },
};

export const CALLOUT_FIELDS = { title: ["Callout heading", "line"], body: ["Callout text", "paragraphs"] };
export const EXAMPLE_FIELDS = {
  reference: ["Passage", "line"],
  litText: ["LIT text", "paragraphs"],
  traditionalText: ["Traditional text", "paragraphs"],
  note: ["Note under the comparison", "prose"],
};

export const APPLE = '<svg class="platform-icon platform-icon--apple" viewBox="0 0 384 512" aria-hidden="true" focusable="false"><path fill="currentColor" d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z"/></svg>';
export const ANDROID = '<svg class="platform-icon platform-icon--android" viewBox="0 0 576 512" aria-hidden="true" focusable="false"><path fill="currentColor" d="M420.55 301.93a24 24 0 1 1 24-24 24 24 0 0 1-24 24m-265.1 0a24 24 0 1 1 24-24 24 24 0 0 1-24 24m273.7-144.48 47.94-83a10 10 0 1 0-17.27-10l-48.54 84.07a301.25 301.25 0 0 0-246.56 0L116.18 64.45a10 10 0 1 0-17.27 10l47.94 83C64.53 202.22 8.24 285.55 0 384h576c-8.24-98.45-64.54-181.78-146.85-226.55"/></svg>';

export const ICONS = {
  ios: { src: "/assets/images/lit-app-icon-ios.webp", alt: "The LIT Bible app icon on iOS" },
  android: { src: "/assets/images/lit-app-icon.svg", alt: "The LIT Bible app icon on Android" },
};

/**
 * The page body.
 * @param {object} model the Studio model (core.mjs)
 * @param {{editable?: boolean, img?: (src: string) => string, season?: number, changed?: Set<string>,
 *   pending?: Map<string, {key: string, label: string, text: string, images: string[], sent: boolean}[]>}} [o]
 *   img turns a model src into a URL the board can load; season is the
 *   carousel frame on show; changed holds the path keys with a pending edit;
 *   pending holds the notes and pictures to add, by section id ("_page" for
 *   the whole page), drawn as placeholders after their section
 */
export function renderPage(model, o = {}) {
  const c = { editable: false, img: (s) => s, season: 0, changed: new Set(), pending: new Map(), ...o, model };
  const sections = [...model.sections].sort(byOrder);
  const extra = (id, name) => (c.editable && c.pending.get(id)?.length ? pendingStrip(c.pending.get(id), name) : "");
  const body = sections.map((s) => {
    const name = KINDS[s.kind]?.name ?? s.kind;
    if (s.hidden) return c.editable ? hiddenSection(s, c) + extra(s.id, name) : "";
    const draw = DRAW[s.kind];
    return (draw ? draw(s, c) : "") + extra(s.id, name);
  });
  return `<div class="apps">${extra("_page", "The whole page")}${body.join("")}</div>`;
}

/** Placeholders for what BDR asked to add: the pictures and their words about them, until Claude lays them out. */
function pendingStrip(list, name) {
  return list
    .map((p) => {
      const pics = p.images.length ? `<span class="studio-pending__pics">${p.images.map((u) => `<img src="${escapeHtml(u)}" alt="">`).join("")}</span>` : "";
      const text = p.text ? escapeHtml(p.text) : "<i>Say where it goes</i>";
      return `<div class="studio-pending${p.sent ? " is-sent" : ""}"${p.sent ? "" : ` data-note="${escapeHtml(p.key)}"`}><span class="studio-pending__tag">${escapeHtml(p.label)} · ${escapeHtml(name)}${p.sent ? " · sent" : ""}</span>${pics}<span class="studio-pending__text">${text}</span></div>`;
    })
    .join("");
}

// --- Editing attributes ------------------------------------------------------------

function mark(c, path) {
  return c.changed.has(pathKey(path)) ? " is-changed" : "";
}
function ed(c, path, label, type) {
  if (!c.editable) return "";
  return ` data-edit="${escapeHtml(pathKey(path))}" data-label="${escapeHtml(label)}" data-type="${type}"`;
}
function im(c, path, label, slot) {
  if (!c.editable) return "";
  return ` data-image="${escapeHtml(pathKey(path))}" data-label="${escapeHtml(label)}" data-slot="${slot}"`;
}
function ln(c, path, label) {
  if (!c.editable) return "";
  return ` data-link="${escapeHtml(pathKey(path))}" data-label="${escapeHtml(label)}"`;
}
function sec(s, c) {
  if (!c.editable) return "";
  const name = KINDS[s.kind]?.name ?? s.kind;
  return ` data-section="${escapeHtml(s.id)}" data-label="${escapeHtml(name)}"`;
}
function tag(s, c) {
  if (!c.editable) return "";
  const name = KINDS[s.kind]?.name ?? s.kind;
  return `<button type="button" class="studio-tag" data-section-tag="${escapeHtml(s.id)}">${escapeHtml(name)}</button>`;
}
/** Class list for an element, plus the "changed" mark when its field has an edit. */
function edc(c, path, ...names) {
  return `class="${cls(...names)}${mark(c, path)}"`;
}

function hiddenSection(s, c) {
  const name = KINDS[s.kind]?.name ?? s.kind;
  return `<div class="studio-hidden" data-section="${escapeHtml(s.id)}" data-label="${escapeHtml(name)}"><span>Hidden: ${escapeHtml(name)}${s.title ? ` · ${escapeHtml(s.title.replace(/[*\n]/g, " "))}` : ""}</span><button type="button" class="studio-tag studio-tag--inline" data-section-tag="${escapeHtml(s.id)}">Select</button></div>`;
}

function buttons(s, c, path) {
  return s.buttons
    .map((b, i) => {
      const p = [...path, "buttons", i];
      const icon = b.platform === "android" ? ANDROID : APPLE;
      return `<a href="${escapeHtml(b.href)}" ${edc(c, p, "btn", i === 0 ? "btn-primary" : "btn-secondary")} target="_blank" rel="external noopener noreferrer"${ln(c, p, `Button ${i + 1}`)}>${icon}${escapeHtml(b.label)}</a>`;
    })
    .join("");
}

function image(c, img, path, cl, label, slot, extra = "") {
  return `<img src="${escapeHtml(c.img(img.src))}" alt="${escapeHtml(img.alt)}" ${edc(c, path, cl)} width="${img.width}" height="${img.height}"${extra}${im(c, path, label, slot)}>`;
}

function link(c, s, path, cl) {
  if (!s.link) return "";
  const away = /^https?:\/\//i.test(s.link.href) && !/^https?:\/\/(www\.)?litbible\.net(\/|$)/i.test(s.link.href);
  return `<p class="${cl}"><a href="${escapeHtml(s.link.href)}"${away ? ' target="_blank" rel="noopener noreferrer"' : ""}${mark(c, [...path, "link"]) ? ` class="is-changed"` : ""}${ln(c, [...path, "link"], "Link")}>${escapeHtml(s.link.label)}</a></p>`;
}

// --- The sections --------------------------------------------------------------------

const DRAW = {
  hero(s, c) {
    const p = ["sections", s.id];
    const { back, front } = s.phones;
    return `<section class="${cls("hero", band(s.background))}"${sec(s, c)}>${tag(s, c)}<div class="hero__inner container"><div class="hero__copy"><h1 ${edc(c, [...p, "title"], "hero__title")}${ed(c, [...p, "title"], "Headline", "title")}>${inline(s.title)}</h1><p ${edc(c, [...p, "subtitle"], "hero__sub")}${ed(c, [...p, "subtitle"], "Subheading", "prose")}>${inline(s.subtitle)}</p><div class="hero__ctas">${buttons(s, c, p)}</div></div><div class="hero__image"><div class="hero__phones">${image(c, back, [...p, "phones", "back"], "hero__phone hero__phone--back", "Back phone", "phone", ' decoding="async"')}${image(c, front, [...p, "phones", "front"], "hero__phone hero__phone--front", "Front phone", "phone", ' fetchpriority="high" decoding="async"')}</div></div></div></section>`;
  },

  about(s, c) {
    const p = ["sections", s.id];
    return `<section class="${cls("about", band(s.background))}"${sec(s, c)}>${tag(s, c)}<div class="container about__inner"><h2 ${edc(c, [...p, "title"], "about__title")}${ed(c, [...p, "title"], "Heading", "title")}>${inline(s.title)}</h2><p ${edc(c, [...p, "text"], "about__lede")}${ed(c, [...p, "text"], "Text", "prose")}>${inline(s.text)}</p>${link(c, s, p, "about__more")}</div></section>`;
  },

  examples(s, c) {
    const p = ["sections", s.id];
    const e = c.model.examples.find((x) => x.placement === "hero");
    if (!e) return c.editable ? `<section class="examples"${sec(s, c)}>${tag(s, c)}<div class="container"><p class="studio-empty">No example is chosen to show. Select this section to pick one.</p></div></section>` : "";
    const q = ["examples", e.id];
    const note = e.note
      ? `<p ${edc(c, [...q, "note"], "example__note")}${ed(c, [...q, "note"], "Note under the comparison", "prose")}>${escapeHtml(e.note)}</p>`
      : c.editable ? `<p class="example__note studio-placeholder"${ed(c, [...q, "note"], "Note under the comparison", "prose")}>Add a note under the comparison</p>` : "";
    return `<section class="${cls("examples", band(s.background))}"${sec(s, c)}>${tag(s, c)}<div class="container"><header class="examples__head"><span ${edc(c, [...p, "eyebrow"], "examples__eyebrow")}${ed(c, [...p, "eyebrow"], "Small heading", "line")}>${inline(s.eyebrow)}</span><h2 ${edc(c, [...p, "title"], "examples__title")}${ed(c, [...p, "title"], "Heading", "title")}>${inline(s.title)}</h2></header><article class="example"${c.editable ? ` data-example="${escapeHtml(e.id)}" data-label="Comparison"` : ""}><h3 ${edc(c, [...q, "reference"], "example__reference")}${ed(c, [...q, "reference"], "Passage", "line")}>${escapeHtml(e.reference)}</h3><div class="example__columns"><div class="example__col example__col--lit"><span ${edc(c, [...p, "litLabel"], "example__label")}${ed(c, [...p, "litLabel"], "LIT column label", "line")}>${escapeHtml(s.litLabel)}</span><div ${edc(c, [...q, "litText"], "example__text")}${ed(c, [...q, "litText"], "LIT text", "paragraphs")}>${paragraphs(e.litText)}</div></div><div class="example__col example__col--trad"><span class="example__label"${c.editable ? ` data-example="${escapeHtml(e.id)}" data-label="Comparison"` : ""}>${escapeHtml(e.comparison)}</span><div ${edc(c, [...q, "traditionalText"], "example__text", "example__text--trad")}${ed(c, [...q, "traditionalText"], "Traditional text", "paragraphs")}>${paragraphs(e.traditionalText)}</div></div></div>${note}</article></div></section>`;
  },

  reader(s, c) {
    const callouts = [...c.model.callouts].sort(byOrder);
    const add = c.editable ? `<button type="button" class="studio-add" data-add="callout">Add a callout</button>` : "";
    return `<section class="${cls("reader", band(s.background))}"${sec(s, c)}>${tag(s, c)}<div class="container"><div class="reader__callouts">${callouts.map((co) => callout(co, c)).join("")}${add}</div>${carousel(s, c)}</div></section>`;
  },

  bigscreens(s, c) {
    const p = ["sections", s.id];
    const { tablet, foldable, duo } = s.devices;
    return `<section class="${cls("bigscreens", band(s.background))}"${sec(s, c)}>${tag(s, c)}<div class="container bigscreens__inner"><header class="bigscreens__head"><span ${edc(c, [...p, "eyebrow"], "bigscreens__eyebrow")}${ed(c, [...p, "eyebrow"], "Small heading", "line")}>${inline(s.eyebrow)}</span><h2 ${edc(c, [...p, "title"], "bigscreens__title")}${ed(c, [...p, "title"], "Heading", "title")}>${inline(s.title)}</h2><p ${edc(c, [...p, "text"], "bigscreens__body")}${ed(c, [...p, "text"], "Text", "prose")}>${inline(s.text)}</p></header><div class="${cls("bigscreens__stage", duo ? "bigscreens__stage--trio" : "")}"><figure class="bigscreens__device bigscreens__device--fold">${image(c, foldable, [...p, "devices", "foldable"], "bigscreens__shot bigscreens__shot--fold", "Foldable", "foldable", ' loading="lazy" decoding="async"')}</figure><figure class="bigscreens__device bigscreens__device--pad">${image(c, tablet, [...p, "devices", "tablet"], "bigscreens__shot bigscreens__shot--pad", "Tablet", "tablet", ' loading="lazy" decoding="async"')}</figure>${duo ? `<figure class="bigscreens__device bigscreens__device--duo">${image(c, duo, [...p, "devices", "duo"], "bigscreens__shot bigscreens__shot--duo", "iPhone Duo", "picture", ' loading="lazy" decoding="async"')}</figure>` : ""}</div></div></section>`;
  },

  humane(s, c) {
    const p = ["sections", s.id];
    const negs = s.negations?.length
      ? `<p ${edc(c, [...p, "negations"], "humane__negations")} aria-hidden="true"${ed(c, [...p, "negations"], "Short lines", "list")}>${s.negations.map((n) => `<span>${inline(n)}</span>`).join("")}</p>`
      : "";
    return `<section class="${cls("humane", band(s.background))}"${sec(s, c)}>${tag(s, c)}<div class="container humane__inner"><header class="humane__head"><span ${edc(c, [...p, "eyebrow"], "humane__eyebrow")}${ed(c, [...p, "eyebrow"], "Small heading", "line")}>${inline(s.eyebrow)}</span><h2 ${edc(c, [...p, "title"], "humane__title")}${ed(c, [...p, "title"], "Heading", "title")}>${inline(s.title)}</h2>${negs}</header><div class="humane__body${mark(c, [...p, "paragraphs"])}"${ed(c, [...p, "paragraphs"], "Text", "paras")}>${s.paragraphs.map((t) => `<p>${inline(t)}</p>`).join("")}${link(c, s, p, "humane__more")}</div></div></section>`;
  },

  "get-app"(s, c) {
    const p = ["sections", s.id];
    const icon = (k) => {
      const ic = ICONS[k];
      const path = ["files", ic.src];
      return `<img src="${escapeHtml(c.img(ic.src))}" alt="${ic.alt}" ${edc(c, path, "app-icons__icon", `app-icons__icon--${k}`)} width="68" height="68" loading="lazy"${im(c, path, k === "ios" ? "iOS app icon" : "Android app icon", k === "ios" ? "icon" : "icon-svg")}>`;
    };
    return `<section id="join" class="${cls("get-app", band(s.background))}"${sec(s, c)}>${tag(s, c)}<div class="container get-app__inner"><h2 ${edc(c, [...p, "title"], "get-app__title")}${ed(c, [...p, "title"], "Heading", "title")}>${inline(s.title)}</h2><div class="app-icons get-app__icons" style="--icon-size: 68px; --icon-pad: 6px;">${icon("ios")}${icon("android")}</div><p ${edc(c, [...p, "text"], "get-app__lede")}${ed(c, [...p, "text"], "Text", "prose")}>${inline(s.text)}</p><div class="get-app__ctas">${buttons(s, c, p)}</div></div></section>`;
  },
};

function callout(co, c) {
  const p = ["callouts", co.id];
  const alt = `${co.platform === "android" ? "Android" : "iOS"} ${co.mode === "dark" ? "dark mode" : "light mode"}: ${co.title}`;
  const img = co.image
    ? `<img src="${escapeHtml(c.img(co.image))}" alt="${escapeHtml(alt)}" ${edc(c, [...p, "image"], "callout__phone")} loading="lazy" decoding="async"${im(c, [...p, "image"], "Callout picture", "phone")}>`
    : c.editable ? `<button type="button" class="studio-drop" data-image="${escapeHtml(pathKey([...p, "image"]))}" data-label="Callout picture" data-slot="phone">Add a picture</button>` : "";
  const sel = c.editable ? ` data-callout="${escapeHtml(co.id)}" data-label="Callout"` : "";
  return `<article class="callout callout--image-${co.imageSide}" style="--callout-band: var(--band-${co.accent});"${sel}><div class="callout__copy"><h3 ${edc(c, [...p, "title"], "callout__title")}${ed(c, [...p, "title"], "Callout heading", "line")}>${escapeHtml(co.title)}</h3><div ${edc(c, [...p, "body"], "callout__body")}${ed(c, [...p, "body"], "Callout text", "paragraphs")}>${paragraphs(co.body)}</div></div><div class="callout__image">${img}</div></article>`;
}

function carousel(s, c) {
  const cy = s.carousel;
  const p = ["sections", s.id, "carousel"];
  const seasons = [...c.model.seasons].sort(byOrder);
  if (!seasons.length) return "";
  const active = Math.min(Math.max(c.season, 0), seasons.length - 1);
  const chips = seasons
    .map((se, i) => {
      const on = i === active;
      const sel = c.editable ? ` data-season="${escapeHtml(se.id)}" data-label="Season"` : "";
      return `<button class="church-year__chip${on ? " is-active" : ""}" role="listitem" data-index="${i}" data-accent-var="${escapeHtml(se.colorVar)}" aria-pressed="${on}"${sel}><span class="church-year__dot" style="background-color: var(${se.colorVar});" aria-hidden="true"></span><span class="church-year__chip-label${mark(c, ["seasons", se.id, "name"])}">${escapeHtml(se.name)}</span></button>`;
    })
    .join("");
  const frames = seasons
    .map((se, i) => {
      const q = ["seasons", se.id, "image"];
      return `<div class="church-year__frame${i === active ? " is-active" : ""}" data-index="${i}" aria-label="${escapeHtml(`${cy.passage} with ${se.name} accent color`)}"><img src="${escapeHtml(c.img(se.image))}" alt="${escapeHtml(`LIT Bible showing ${cy.passage} with ${se.name} accent color`)}" ${edc(c, q, "church-year__phone")} loading="lazy" decoding="async" width="${cy.frame.width}" height="${cy.frame.height}"${im(c, q, `${se.name} screenshot`, "carousel")}></div>`;
    })
    .join("");
  const sel = c.editable ? ` data-carousel-card="${escapeHtml(s.id)}" data-label="Carousel"` : "";
  return `<div class="church-year" data-carousel${sel} style="--cy-band: var(${seasons[active].colorVar.replace("--season-", "--band-")});"><div class="church-year__copy"><h3 ${edc(c, [...p, "title"], "church-year__title")}${ed(c, [...p, "title"], "Carousel heading", "title")}>${inline(cy.title)}</h3><p ${edc(c, [...p, "text"], "church-year__body")}${ed(c, [...p, "text"], "Carousel text", "prose")}>${inline(cy.text)}</p><div class="church-year__chips" role="list">${chips}</div></div><div class="church-year__stage" role="group" aria-label="${escapeHtml(cy.stageLabel)}" style="aspect-ratio: ${cy.frame.width} / ${cy.frame.height};">${frames}</div></div>`;
}
