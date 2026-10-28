// The Apps Page Studio's core (scripts/apps-studio/): reading the /apps page
// into the board's model, applying a request's changes, and writing back only
// what changed. The board edits real content files through this, so the
// round trip has to be exact and a stale edit has to be refused, not written.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseDoc, serializeDoc, fieldLines } from "../scripts/apps-studio/frontmatter.mjs";
import {
  applyChanges, DIRS, PAGE_FILE, planImage, planPicture, readModel, RULES, sectionImages, slotFor, slugify,
  smartQuotes, textWarnings, validateModel, writeModel, fitCarouselFrame, imagePaths,
} from "../scripts/apps-studio/core.mjs";
import { buildBoardCss, SOURCES } from "../scripts/apps-studio/board-css.mjs";
import { inline, band, leavesSite } from "../src/components/apps/render.ts";
import { inline as boardInline, band as boardBand, smartQuotes as boardQuotes, renderPage } from "../scripts/apps-studio/board/page.js";

const repo = fileURLToPath(new URL("..", import.meta.url));

function repoFiles() {
  const files = {};
  for (const dir of Object.values(DIRS)) {
    for (const name of readdirSync(join(repo, dir)).sort()) {
      if (/\.(json|md)$/.test(name)) files[`${dir}/${name}`] = readFileSync(join(repo, dir, name), "utf8");
    }
  }
  files[PAGE_FILE] = readFileSync(join(repo, PAGE_FILE), "utf8");
  return files;
}

const change = (op, rest) => ({ key: `${op}:${JSON.stringify(rest.path ?? rest.id ?? rest.collection)}`, op, ...rest });

// --- The frontmatter subset -----------------------------------------------------

test("every /apps Markdown file reads and writes back byte for byte", () => {
  for (const dir of [DIRS.callouts, DIRS.examples, DIRS.seasons]) {
    for (const name of readdirSync(join(repo, dir))) {
      const path = `${dir}/${name}`;
      const text = readFileSync(join(repo, path), "utf8");
      const doc = parseDoc(text, path);
      const kept = serializeDoc(doc.fields.map((f) => ({ ...f, original: f.value })), { body: doc.body, bodyRaw: doc.bodyRaw, originalBody: doc.body });
      assert.equal(kept, text, path);
      // Written fresh, every field still reads back as the same value.
      const fresh = serializeDoc(doc.fields.map((f) => ({ key: f.key, value: f.value })), { body: doc.body });
      const again = parseDoc(fresh, path);
      assert.deepEqual(again.fields.map((f) => [f.key, f.value]), doc.fields.map((f) => [f.key, f.value]), path);
      assert.equal(again.body, doc.body, path);
    }
  }
});

test("the frontmatter reader refuses what it can't be sure of", () => {
  for (const bad of ["---\ntags:\n  - a\n---\n", "---\ntitle: a: b\n---\n", "---\ntitle: x # note\n---\n", "---\ntitle: [x]\n---\n", "---\ntitle: a\ntitle: b\n---\n"]) {
    assert.throws(() => parseDoc(bad), Error, JSON.stringify(bad));
  }
});

test("a one-line value goes bare only when YAML reads it back unchanged", () => {
  assert.deepEqual(fieldLines("title", "Read with the church all year."), ["title: Read with the church all year."]);
  assert.deepEqual(fieldLines("title", "...Or nerd out. Hard."), ["title: ...Or nerd out. Hard."]);
  for (const s of ["Note: this", "yes", "12", "- list", "#hash", " padded", "a #b"]) {
    assert.deepEqual(fieldLines("title", s), [`title: ${JSON.stringify(s)}`], s);
  }
  assert.deepEqual(fieldLines("note", "plain", { quote: true }), ['note: "plain"']);
  assert.deepEqual(fieldLines("litText", "One.\n\nTwo.\n"), ["litText: |", "  One.", "", "  Two."]);
});

// --- Reading the page -----------------------------------------------------------

test("the model holds every section, callout, example and season in page order", () => {
  const m = readModel(repoFiles());
  assert.deepEqual(m.sections.map((s) => s.kind), ["hero", "about", "examples", "reader", "bigscreens", "humane", "get-app"]);
  assert.equal(m.callouts.length >= 1, true);
  assert.equal(m.examples.filter((e) => e.placement === "hero").length, 1);
  assert.equal(m.seasons.length >= 1, true);
  assert.match(m.page.title, /LIT Bible Apps/);
  assert.deepEqual(validateModel(m), []);
});

test("the Studio's lists match the site's schema", () => {
  const schema = readFileSync(join(repo, "src/components/apps/collections.ts"), "utf8");
  const enums = [...schema.matchAll(/z\s*\.enum\(\[([^\]]*)\]\)/g)].map((m) => m[1].replace(/\s+/g, ""));
  const asText = (list) => list.map((s) => `"${s}"`).join(",");
  for (const name of ["backgrounds", "accents", "platforms", "modes", "sides", "comparisons", "placements"]) {
    assert.ok(enums.includes(asText(RULES[name])), `${name} is ${asText(RULES[name])} in core.mjs but not in collections.ts`);
  }
});

// --- Changing it -----------------------------------------------------------------

test("an edit applies when the page still says what BDR saw", () => {
  const m = readModel(repoFiles());
  const hero = m.sections.find((s) => s.id === "hero");
  const c = change("set", { path: ["sections", "hero", "title"], before: hero.title, after: "A New Testament for *everyone*." });
  const { model, results } = applyChanges(m, [c]);
  assert.equal(results[0].status, "applied");
  assert.equal(model.sections.find((s) => s.id === "hero").title, "A New Testament for *everyone*.");
  assert.equal(m.sections.find((s) => s.id === "hero").title, hero.title, "the input model is untouched");
});

test("an edit to something that changed since is refused, and one already made is noted", () => {
  const m = readModel(repoFiles());
  const stale = change("set", { path: ["sections", "hero", "title"], before: "Something older", after: "New" });
  const done = change("set", { path: ["sections", "about", "title"], before: "Old", after: m.sections[1].title });
  const { results } = applyChanges(m, [stale, done]);
  assert.equal(results[0].status, "conflict");
  assert.match(results[0].reason, /changed since/);
  assert.equal(results[1].status, "already");
});

test("prose gets curly quotes; links and file names don't", () => {
  const m = readModel(repoFiles());
  const about = m.sections.find((s) => s.id === "about");
  const { model } = applyChanges(m, [
    change("set", { path: ["sections", "about", "text"], before: about.text, after: `It's "for" everyone` }),
    change("set", { path: ["sections", "about", "link", "href"], before: about.link.href, after: "https://example.org/?q='x'" }),
  ]);
  const next = model.sections.find((s) => s.id === "about");
  assert.equal(next.text, "It’s “for” everyone");
  assert.equal(next.link.href, "https://example.org/?q='x'");
  assert.equal(smartQuotes(`"Hi," she said. 'Twas (‘ok’) don't`), "“Hi,” she said. ‘Twas (‘ok’) don’t");
});

test("hiding a section writes `hidden`, and showing it again removes the key", () => {
  const files = repoFiles();
  const m = readModel(files);
  const hidden = applyChanges(m, [change("set", { path: ["sections", "about", "hidden"], before: false, after: true })]).model;
  assert.equal(hidden.sections.find((s) => s.id === "about").hidden, true);
  const shown = applyChanges(hidden, [change("set", { path: ["sections", "about", "hidden"], before: true, after: false })]).model;
  assert.equal("hidden" in shown.sections.find((s) => s.id === "about"), false);
  assert.deepEqual(writeModel(shown, files).writes, {});
});

test("reordering renumbers the list, and a list that changed since is refused", () => {
  const m = readModel(repoFiles());
  const ids = m.sections.map((s) => s.id);
  const swapped = [ids[0], ids[2], ids[1], ...ids.slice(3)];
  const { model, results } = applyChanges(m, [change("order", { collection: "sections", before: ids, after: swapped })]);
  assert.equal(results[0].status, "applied");
  assert.deepEqual(model.sections.map((s) => s.id), swapped);
  assert.deepEqual(model.sections.map((s) => s.order), swapped.map((_, i) => i + 1));
  const bad = applyChanges(m, [change("order", { collection: "sections", after: swapped.slice(1) })]);
  assert.equal(bad.results[0].status, "conflict");
});

test("callouts and copyable sections can be added and removed; the rest only hide", () => {
  const m = readModel(repoFiles());
  const add = change("add", {
    collection: "callouts", id: "widgets", after: m.callouts[0].id,
    data: { title: "Widgets.", platform: "ios", mode: "light", accent: "lent", imageSide: "left", image: "/assets/screenshots/iphone-today.webp", body: "On your home screen." },
  });
  const copy = change("add", { collection: "sections", id: "about-2", after: "about", data: { ...structuredClone(m.sections[1]), id: undefined } });
  const { model, results } = applyChanges(m, [add, copy]);
  assert.deepEqual(results.map((r) => r.status), ["applied", "applied"]);
  assert.equal(model.callouts[1].id, "widgets");
  assert.equal(model.sections[2].id, "about-2");
  assert.deepEqual(validateModel(model), []);

  const refused = applyChanges(m, [
    change("add", { collection: "callouts", id: m.callouts[0].id, data: {} }),
    change("add", { collection: "sections", id: "hero-2", data: { kind: "hero" } }),
    change("remove", { collection: "sections", id: "hero" }),
    change("add", { collection: "callouts", id: "Bad Name", data: {} }),
  ]);
  assert.deepEqual(refused.results.map((r) => r.status), ["conflict", "conflict", "conflict", "conflict"]);
  const removed = applyChanges(model, [change("remove", { collection: "sections", id: "about-2" })]);
  assert.equal(removed.results[0].status, "applied");
  assert.equal(removed.model.sections.some((s) => s.id === "about-2"), false);
});

test("a new picture takes its processed file's path and size, and its alt text", () => {
  const m = readModel(repoFiles());
  const front = m.sections.find((s) => s.id === "hero").phones.front;
  const c = change("image", { path: ["sections", "hero", "phones", "front"], before: front, alt: `The "Today" page` });
  const { model, results } = applyChanges(m, [c], { images: { [c.key]: { src: "/assets/screenshots/new.webp", width: 489, height: 1000 } } });
  assert.equal(results[0].status, "applied");
  assert.deepEqual(model.sections.find((s) => s.id === "hero").phones.front, { src: "/assets/screenshots/new.webp", alt: "The “Today” page", width: 489, height: 1000 });
  const missing = applyChanges(m, [c]);
  assert.equal(missing.results[0].status, "conflict");
});

test("a note is left for Claude", () => {
  const { results } = applyChanges(readModel(repoFiles()), [change("note", { text: "Make the iPad bigger" })]);
  assert.equal(results[0].status, "manual");
});

test("the schema check catches what would break the page", () => {
  const m = readModel(repoFiles());
  m.examples.forEach((e) => { e.placement = "hero"; });
  m.sections[0].buttons = m.sections[0].buttons.slice(0, 1);
  m.page.title = 'Say "hi"';
  const problems = validateModel(m).join("\n");
  assert.match(problems, /Exactly one example/);
  assert.match(problems, /two store buttons/);
  assert.match(problems, /straight double quote/);
});

test("a link or store button takes only an address the page can safely use", () => {
  const m = readModel(repoFiles());
  const about = m.sections.find((s) => s.id === "about");
  const hero = m.sections.find((s) => s.id === "hero");
  for (const href of ["https://example.org/", "/privacy", "#join", "mailto:hello@example.org"]) {
    about.link.href = href;
    hero.buttons[0].href = href;
    assert.deepEqual(validateModel(m), [], href);
  }
  for (const href of ["javascript:alert(1)", " https://example.org/", "http://example.org/", "www.example.org", "//example.org", "/\\example.org", "https://example.org/a b", "data:text/html,hi"]) {
    about.link.href = href;
    hero.buttons[0].href = href;
    const problems = validateModel(m).join("\n");
    assert.match(problems, /“about” section’s link has to start with https:\/\//, href);
    assert.match(problems, /“hero” section, button 1: its link has to start with https:\/\//, href);
  }
});

test("the hero can't be hidden, since its title is the page's only <h1>; other sections can", () => {
  const m = readModel(repoFiles());
  const hide = (id) => applyChanges(m, [change("set", { path: ["sections", id, "hidden"], before: false, after: true })]).model;
  assert.match(validateModel(hide("hero")).join("\n"), /“hero” section can’t be hidden/);
  assert.deepEqual(validateModel(hide("about")), []);
  const hero = readFileSync(join(repo, "src/components/apps/Hero.astro"), "utf8");
  assert.match(hero, /<h1\b/, "the hero no longer holds the page's <h1>; revisit RULES.alwaysShown");
});

test("house-style notes flag British spelling and straight quotes", () => {
  const m = readModel(repoFiles());
  m.sections[0].subtitle = "Pick a colour you'd like";
  const w = textWarnings(m).join("\n");
  assert.match(w, /“colour” is written “color”/);
  assert.match(w, /straight quote/);
});

// --- Writing it back -----------------------------------------------------------------

test("an unchanged model writes nothing", () => {
  const files = repoFiles();
  assert.deepEqual(writeModel(readModel(files), files), { writes: {}, deletes: [] });
});

test("one edit to a callout changes that file's one line", () => {
  const files = repoFiles();
  const m = readModel(files);
  const c = m.callouts[0];
  const { model } = applyChanges(m, [change("set", { path: ["callouts", c.id, "title"], before: c.title, after: "A new title" })]);
  const { writes, deletes } = writeModel(model, files);
  const path = `${DIRS.callouts}/${c.id}.md`;
  assert.deepEqual(Object.keys(writes), [path]);
  assert.deepEqual(deletes, []);
  const before = files[path].split("\n");
  const after = writes[path].split("\n");
  assert.equal(after.length, before.length);
  assert.deepEqual(after.filter((l, i) => l !== before[i]), ["title: A new title"]);
});

test("a new callout is written in the house format, and a removed one deleted", () => {
  const files = repoFiles();
  const m = readModel(files);
  const { model } = applyChanges(m, [change("add", {
    collection: "callouts", id: "widgets",
    data: { title: "Widgets.", platform: "ios", mode: "light", accent: "lent", imageSide: "left", image: "/assets/screenshots/x.webp", body: "One *two* three." },
  })]);
  const { writes } = writeModel(model, files);
  assert.equal(writes[`${DIRS.callouts}/widgets.md`], [
    "---", "title: Widgets.", `order: ${m.callouts.length + 1}`, "platform: ios", "mode: light", "accent: lent",
    "imageSide: left", 'image: "/assets/screenshots/x.webp"', "---", "", "One *two* three.", "",
  ].join("\n"));
  const gone = applyChanges(m, [change("remove", { collection: "callouts", id: m.callouts[0].id })]).model;
  assert.ok(writeModel(gone, files).deletes.includes(`${DIRS.callouts}/${m.callouts[0].id}.md`));
});

test("the page's title and description are rewritten in place", () => {
  const files = repoFiles();
  const m = readModel(files);
  const { model } = applyChanges(m, [change("set", { path: ["page", "title"], before: m.page.title, after: "LIT Bible for iPhone and Android" })]);
  const { writes } = writeModel(model, files);
  assert.deepEqual(Object.keys(writes), [PAGE_FILE]);
  assert.match(writes[PAGE_FILE], /title="LIT Bible for iPhone and Android"/);
  assert.equal(writes[PAGE_FILE].replace("LIT Bible for iPhone and Android", m.page.title), files[PAGE_FILE]);
});

test("the carousel's frame follows screenshots that all share one size", () => {
  const m = readModel(repoFiles());
  const sizes = Object.fromEntries(m.seasons.map((s) => [s.image, { width: 489, height: 1000 }]));
  assert.match(fitCarouselFrame(m, sizes), /now matches/);
  assert.deepEqual(m.sections.find((s) => s.kind === "reader").carousel.frame, { width: 489, height: 1000 });
  assert.equal(fitCarouselFrame(m, sizes), null);
});

// --- Pictures ---------------------------------------------------------------------------

test("a picture's spot decides where it goes and how big it ships", () => {
  assert.equal(slotFor(["sections", "hero", "phones", "front"]), "phone");
  assert.equal(slotFor(["sections", "bigscreens", "devices", "tablet"]), "tablet");
  assert.equal(slotFor(["sections", "bigscreens", "devices", "foldable"]), "foldable");
  assert.equal(slotFor(["seasons", "lent", "image"]), "carousel");
  assert.equal(slotFor(["callouts", "x", "image"]), "phone");
  assert.equal(slotFor(["files", "/assets/images/lit-app-icon.svg"]), "icon-svg");
  assert.equal(slugify("iPhone - John 3 - Advent.png"), "iphone-john-3-advent");
  const taken = new Set(["public/assets/screenshots/iphone-john-3-advent.webp"]);
  const plan = planImage({ path: ["sections", "hero", "phones", "front"], upload: { name: "iPhone - John 3 - Advent.png" } }, taken);
  assert.deepEqual(plan, {
    slot: "phone",
    out: "public/assets/screenshots/iphone-john-3-advent-2.webp",
    src: "/assets/screenshots/iphone-john-3-advent-2.webp",
    archive: "_source-images/screenshots/iPhone - John 3 - Advent.png",
  });
  assert.equal(planImage({ path: ["files", "/assets/images/lit-app-icon-ios.webp"] }, new Set()).out, "public/assets/images/lit-app-icon-ios.webp");
  assert.throws(() => planImage({ path: ["files", "/assets/screenshots/x.webp"] }, new Set()));
});

test("an archived original never overwrites one already kept", () => {
  const taken = new Set([
    "_source-images/screenshots/IMG_1234.PNG",
    "_source-images/screenshots/IMG_1234-2.PNG",
    "_source-images/screenshots/image.png",
  ]);
  assert.equal(planImage({ path: ["callouts", "x", "image"], upload: { name: "IMG_1234.PNG" } }, taken).archive, "_source-images/screenshots/IMG_1234-3.PNG");
  assert.equal(planPicture({ name: "image.png" }, taken).archive, "_source-images/screenshots/image-2.png");
  assert.equal(planPicture({ name: "fresh.png" }, taken).archive, "_source-images/screenshots/fresh.png");
});

test("a failed run gives back what it replaced and removes only what it created", async () => {
  const { mkdtemp, writeFile: write, readFile: read, rm } = await import("node:fs/promises");
  const { existsSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const { Undo } = await import("../scripts/apps-studio/undo.mjs");
  const root = await mkdtemp(join(tmpdir(), "apps-studio-undo-"));
  try {
    await write(join(root, "icon.webp"), "old icon");
    await write(join(root, "untouched.png"), "an older original");
    const undo = new Undo(root);
    await undo.remember("icon.webp");
    await undo.remember("new.webp");
    await write(join(root, "icon.webp"), "new icon");
    await write(join(root, "new.webp"), "new picture");
    await undo.run();
    assert.equal(await read(join(root, "icon.webp"), "utf8"), "old icon");
    assert.equal(existsSync(join(root, "new.webp")), false);
    assert.equal(await read(join(root, "untouched.png"), "utf8"), "an older original");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("a picture added to a section is converted as a picture, and swappable once it's laid out", () => {
  // A note carries the picture; the apply step plans its file like any other.
  const plan = planPicture({ name: "iPhone Duo - Philippians 2.png", fileName: "iphone-duo-philippians-2" }, new Set());
  assert.deepEqual(plan, {
    slot: "picture",
    out: "public/assets/screenshots/iphone-duo-philippians-2.webp",
    src: "/assets/screenshots/iphone-duo-philippians-2.webp",
    archive: "_source-images/screenshots/iPhone Duo - Philippians 2.png",
  });
  assert.equal(RULES.slots.picture.frame, "apple");
  assert.equal(RULES.slots.picture.longestWide, 1300);

  // Once Claude makes it a field of the section, every rule already knows it.
  const m = readModel(repoFiles());
  const showcase = m.sections.find((s) => s.kind === "bigscreens");
  showcase.devices.duo = { src: "/assets/screenshots/iphone-duo.webp", alt: "LIT Bible on an iPhone Duo", width: 1000, height: 1000 };
  assert.equal(slotFor(["sections", showcase.id, "devices", "duo"]), "picture");
  assert.equal(slotFor(["sections", "hero", "phones", "front"]), "phone");
  assert.ok(sectionImages(showcase).some(([keys]) => keys.join(".") === "devices.duo"));
  assert.ok(imagePaths(m).includes("/assets/screenshots/iphone-duo.webp"));
  assert.deepEqual(validateModel(m), []);
  showcase.devices.duo.alt = "";
  assert.match(validateModel(m).join("\n"), /devices duo needs a picture, its alt text, and its size/);

  // And a swap of it applies like any other picture.
  showcase.devices.duo.alt = "LIT Bible on an iPhone Duo";
  const c = change("image", { path: ["sections", showcase.id, "devices", "duo"], before: structuredClone(showcase.devices.duo) });
  const { results, model } = applyChanges(m, [c], { images: { [c.key]: { src: "/assets/screenshots/iphone-duo-2.webp", width: 990, height: 1000 } } });
  assert.equal(results[0].status, "applied");
  assert.equal(model.sections.find((s) => s.id === showcase.id).devices.duo.src, "/assets/screenshots/iphone-duo-2.webp");
});

test("a note, with or without pictures, is left for Claude and changes nothing by itself", () => {
  const files = repoFiles();
  const m = readModel(files);
  const note = change("note", { anchor: ["sections", "hero"], text: "Add the Duo beside the phones", images: [{ asset: "a1", name: "duo.png", width: 2007, height: 2484 }] });
  const { model, results } = applyChanges(m, [note]);
  assert.equal(results[0].status, "manual");
  assert.deepEqual(writeModel(model, files), { writes: {}, deletes: [] });
});

// --- The page and the board read copy the same way -------------------------------------------

test("the board's page styles are current with the components' own", () => {
  const files = Object.fromEntries(SOURCES.map((p) => [p, readFileSync(join(repo, p), "utf8")]));
  const committed = readFileSync(join(repo, "scripts/apps-studio/board/page.css"), "utf8");
  assert.equal(committed, buildBoardCss(files), "run `npm run studio:apps -- board-css` and commit board/page.css");
  assert.doesNotMatch(committed, /:global\(|prefers-color-scheme|\dvw\b/);
});

// The class names each component's template writes, read from its source: static
// class="…" values, and the string literals inside class={…} and class:list={…}
// (template literals with their ${…} parts left out, and a name cut off by one dropped).
function templateClasses(astro) {
  const template = astro
    .replace(/^---[\s\S]*?\n---\n/, "")
    .replace(/<script[\s\S]*?<\/script>/g, "")
    .replace(/<style[\s\S]*?<\/style>/g, "");
  const names = new Set();
  const add = (text) => text.split(/\s+/).filter((c) => /^[a-z][\w-]*$/i.test(c) && !c.endsWith("-")).forEach((c) => names.add(c));
  for (const m of template.matchAll(/\bclass="([^"]*)"/g)) add(m[1]);
  for (const m of template.matchAll(/\bclass(?::list)?=\{/g)) {
    let depth = 1;
    let i = m.index + m[0].length;
    const start = i;
    while (i < template.length && depth) {
      if (template[i] === "{") depth++;
      else if (template[i] === "}") depth--;
      i++;
    }
    const expr = template.slice(start, i - 1);
    for (const s of expr.matchAll(/'([^']*)'|"([^"]*)"|`([^`]*)`/g)) add((s[1] ?? s[2] ?? s[3] ?? "").replace(/\$\{[^}]*\}/g, " "));
  }
  return names;
}

test("the board draws the page with the components' own class names", () => {
  // A coarse markup check: it catches an element added, renamed or dropped in a
  // component and not in board/page.js (or the reverse), not one moved within it.
  const components = readdirSync(join(repo, "src/components/apps")).filter((f) => f.endsWith(".astro"));
  const fromComponents = new Set();
  for (const f of components) for (const c of templateClasses(readFileSync(join(repo, "src/components/apps", f), "utf8"))) fromComponents.add(c);
  const html = renderPage(readModel(repoFiles()));
  const fromBoard = new Set([...html.matchAll(/\bclass="([^"]*)"/g)].flatMap((m) => m[1].split(/\s+/)).filter(Boolean));
  // Names the data decides at render time: a section's band, a callout's side, the carousel's live frame.
  const fromData = /^(band--|callout--image-|is-active$)/;
  assert.deepEqual([...fromComponents].filter((c) => !fromBoard.has(c)).sort(), [], "class names the components write and board/page.js doesn't");
  assert.deepEqual([...fromBoard].filter((c) => !fromComponents.has(c) && !fromData.test(c)).sort(), [], "class names board/page.js writes and the components don't");
});

test("render.ts and the board draw the inline format identically", () => {
  for (const s of ["A New Testament that’s *for* everyone.", "Expand your views,\nand your view.", "Fish & <loaves>", "*a* and *b*", "no marks"]) {
    assert.equal(boardInline(s), inline(s), s);
  }
  assert.equal(inline("Expand your views,\nand your view."), "Expand your views,<br>and your view.");
  assert.equal(inline("Fish & <loaves> *now*"), "Fish &amp; &lt;loaves&gt; <em>now</em>");
  for (const b of RULES.backgrounds) assert.equal(boardBand(b), band(b), b);
  for (const s of [`"Hi," she said. 'Twas`, `don't`]) assert.equal(boardQuotes(s), smartQuotes(s));
  assert.equal(leavesSite("https://litbible.net/glossary/"), false);
  assert.equal(leavesSite("/privacy"), false);
  assert.equal(leavesSite("https://apps.apple.com/app/x"), true);
});
