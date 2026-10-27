#!/usr/bin/env node
/**
 * npm run studio:apps -- <command>
 *
 *   seed [--out=FILE]
 *       The board's seed: the /apps page as it stands in this checkout, the
 *       rules, and each image's size. Claude writes it to the board's
 *       `studio/page` document (see .claude/skills/apps-studio/SKILL.md).
 *
 *   apply --request=FILE [--uploads=DIR] [--report=FILE] [--dry-run]
 *       Apply one request from the board: FILE is the request document as
 *       JSON, DIR holds the pictures it uploaded, each saved as
 *       <asset id>.<ext>. Prints a report (and writes it to --report): every
 *       change applied, already true, refused as a conflict (with why), or
 *       left for Claude to do by hand. Nothing is written while the result
 *       would break the page's schema. --dry-run writes nothing at all.
 *
 *   check
 *       Read the page's files and report anything the Studio couldn't read
 *       or the schema would refuse.
 *
 *   board-css
 *       Rewrite board/page.css from the /apps page's own styles. Run it after
 *       changing apps.css or a component's <style>; a test fails until you do.
 *
 *   board-files
 *       Print the files map the board is published with (published path →
 *       repo path), for the Artifact tool's `files`.
 */
import { readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { buildBoardCss, SOURCES } from "./board-css.mjs";
import {
  applyChanges, fitCarouselFrame, imagePaths, makeSeed, planImage, readModel,
  RULES, textWarnings, validateModel, writeModel,
} from "./core.mjs";
import { headCommit, imageSizes, processImage, readFiles, ROOT, takenPaths, unusedImages, writeAll } from "./store.mjs";

export const BOARD_CSS = "scripts/apps-studio/board/page.css";

const [command, ...rest] = process.argv.slice(2);
const args = Object.fromEntries(rest.map((a) => {
  const m = /^--([^=]+)(?:=(.*))?$/.exec(a);
  if (!m) throw new Error(`unexpected argument ${a}`);
  return [m[1], m[2] ?? true];
}));

async function seed() {
  const files = await readFiles();
  const model = readModel(files);
  const problems = validateModel(model);
  const sizes = await imageSizes(imagePaths(model));
  const out = makeSeed(model, { commit: headCommit(), sizes, seededAt: new Date().toISOString() });
  const json = `${JSON.stringify(out, null, 2)}\n`;
  if (args.out) await writeFile(args.out, json);
  else process.stdout.write(json);
  if (problems.length) {
    console.error(`\nThe page has ${problems.length} problem(s):\n- ${problems.join("\n- ")}`);
    process.exitCode = 1;
  }
}

async function apply() {
  if (!args.request) throw new Error("apply needs --request=FILE");
  const request = JSON.parse(await readFile(args.request, "utf8"));
  const changes = Array.isArray(request.changes) ? request.changes : [];
  const files = await readFiles();
  const model = readModel(files);
  const taken = await takenPaths();
  const dry = Boolean(args["dry-run"]);
  const uploadsDir = args.uploads ? path.resolve(args.uploads) : null;

  // Pictures first: each becomes a file, and its size goes into the model.
  const images = {};
  const imageNotes = [];
  const failed = [];
  const written = [];
  for (const change of changes.filter((c) => c.op === "image")) {
    try {
      const plan = planImage(change, taken);
      taken.add(plan.out);
      if (dry) {
        const spec = RULES.slots[plan.slot];
        const w = change.upload?.width ?? 1;
        const h = change.upload?.height ?? 1;
        const k = spec.longest ? Math.min(1, spec.longest / Math.max(w, h)) : 1;
        images[change.key] = { src: plan.src, width: Math.round(w * k), height: Math.round(h * k) };
      } else {
        const done = await processImage(change, plan, { uploadsDir });
        images[change.key] = done;
        written.push(plan.out);
        if (plan.archive) written.push(plan.archive);
        imageNotes.push({ key: change.key, label: change.label, file: plan.out, width: done.width, height: done.height, notes: done.notes });
      }
    } catch (e) {
      failed.push({ key: change.key, label: change.label, status: "conflict", reason: e.message });
    }
  }

  const failedKeys = new Set(failed.map((f) => f.key));
  const { model: next, results } = applyChanges(model, changes.filter((c) => !failedKeys.has(c.key)), { images });
  const allResults = [...results, ...failed];

  // The carousel's frame follows its screenshots, but only when this request
  // changed one: a request about something else never moves the carousel.
  const notes = [];
  const seasonImages = allResults.some((r) => r.status === "applied" && changes.find((c) => c.key === r.key)?.path?.[0] === "seasons");
  if (!dry && seasonImages) {
    const sizes = await imageSizes(next.seasons.map((s) => s.image));
    const moved = fitCarouselFrame(next, sizes);
    if (moved) notes.push(moved);
  }

  const problems = validateModel(next);
  const report = {
    request: request.id ?? null,
    dryRun: dry,
    results: allResults,
    images: imageNotes,
    notes,
    warnings: textWarnings(next),
    problems,
    files: { written: [], deleted: [] },
  };

  if (problems.length) {
    // Leave the tree as it was: take back the pictures this run made.
    for (const rel of written) await rm(path.join(ROOT, rel), { force: true });
  } else if (!dry) {
    const { writes, deletes } = writeModel(next, files);
    const retired = allResults.filter((r) => r.status === "applied").map((r) => changes.find((c) => c.key === r.key))
      .filter((c) => c?.op === "image" && c.path[0] !== "files")
      .map((c) => (typeof c.before === "string" ? c.before : c.before?.src));
    await writeAll({ writes, deletes });
    const unused = await unusedImages(retired);
    await writeAll({ writes: {}, deletes: unused });
    report.files.written = [...Object.keys(writes), ...written];
    report.files.deleted = [...deletes, ...unused];
  }

  const text = `${JSON.stringify(report, null, 2)}\n`;
  if (args.report) await writeFile(args.report, text);
  process.stdout.write(text);
  if (problems.length) process.exitCode = 1;
}

async function check() {
  const files = await readFiles();
  const model = readModel(files);
  const problems = validateModel(model);
  const missing = Object.entries(await imageSizes(imagePaths(model))).filter(([, s]) => s.missing).map(([src]) => src);
  for (const src of missing) problems.push(`The page points at ${src}, which isn’t in public/`);
  const warnings = textWarnings(model);
  console.log(problems.length ? `Problems:\n- ${problems.join("\n- ")}` : "The /apps content reads cleanly.");
  if (warnings.length) console.log(`Warnings:\n- ${warnings.join("\n- ")}`);
  if (problems.length) process.exitCode = 1;
}

async function boardCss() {
  const files = {};
  for (const p of SOURCES) files[p] = await readFile(path.join(ROOT, p), "utf8");
  await writeFile(path.join(ROOT, BOARD_CSS), buildBoardCss(files));
  console.log(`Wrote ${BOARD_CSS}`);
}

async function boardFiles() {
  const board = "scripts/apps-studio/board";
  const js = (from) => ({ from, contentType: "text/javascript" });
  const files = {
    "board/studio.js": js(`${board}/studio.js`),
    "board/page.js": js(`${board}/page.js`),
    "board/page.css": `${board}/page.css`,
    "core.mjs": js("scripts/apps-studio/core.mjs"),
    "frontmatter.mjs": js("scripts/apps-studio/frontmatter.mjs"),
  };
  const model = readModel(await readFiles());
  for (const src of imagePaths(model).sort()) files[`site${src}`] = `public${src}`;
  console.log(JSON.stringify({ file_path: `${board}/index.html`, files }, null, 2));
}

const commands = { seed, apply, check, "board-css": boardCss, "board-files": boardFiles };
if (!commands[command]) {
  console.error("usage: npm run studio:apps -- seed [--out=FILE] | apply --request=FILE [--uploads=DIR] [--report=FILE] [--dry-run] | check | board-css | board-files");
  process.exit(2);
}
await commands[command]();
