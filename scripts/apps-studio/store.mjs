/**
 * The Apps Page Studio's disk side: reads the /apps content files, measures
 * and converts images, and writes a request's result. Every rule about what
 * to write is in core.mjs; this file only does what core.mjs can't (fs, git,
 * sharp, the `frames` CLI).
 */
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { copyFile, mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { DIRS, PAGE_FILE, RULES } from "./core.mjs";

export const ROOT = path.resolve(fileURLToPath(new URL("../..", import.meta.url)));

/** The files the model is read from, repo-relative path → contents. */
export async function readFiles(root = ROOT) {
  const files = {};
  for (const dir of Object.values(DIRS)) {
    for (const name of (await readdir(path.join(root, dir))).sort()) {
      if (/\.(json|md)$/.test(name)) files[`${dir}/${name}`] = await readFile(path.join(root, dir, name), "utf8");
    }
  }
  files[PAGE_FILE] = await readFile(path.join(root, PAGE_FILE), "utf8");
  return files;
}

/**
 * Every file under public/assets/ and the archive of originals, as repo
 * paths, so a new picture's name and its archived original's name never
 * collide with a file already there.
 */
export async function takenPaths(root = ROOT) {
  const taken = new Set();
  async function walk(rel) {
    if (!existsSync(path.join(root, rel))) return;
    for (const e of await readdir(path.join(root, rel), { withFileTypes: true })) {
      const p = `${rel}/${e.name}`;
      if (e.isDirectory()) await walk(p);
      else taken.add(p);
    }
  }
  await walk("public/assets");
  await walk("_source-images/screenshots");
  return taken;
}


/** Each image's real size on disk, keyed by its src ("/assets/…"). */
export async function imageSizes(srcs, root = ROOT) {
  const sizes = {};
  for (const src of srcs) {
    const file = path.join(root, "public", src);
    if (!existsSync(file)) { sizes[src] = { missing: true }; continue; }
    const meta = await sharp(file).metadata();
    const bytes = (await readFile(file)).length;
    sizes[src] = { width: meta.width, height: meta.height, bytes };
  }
  return sizes;
}

export function headCommit(root = ROOT) {
  try { return execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim(); }
  catch { return null; }
}

/** The file Claude saved for an uploaded asset: <uploads>/<asset id>.<ext>. */
async function findUpload(uploadsDir, assetId) {
  if (!uploadsDir || !assetId) throw new Error("the uploaded picture wasn’t downloaded");
  const hit = (await readdir(uploadsDir)).find((n) => n.startsWith(`${assetId}.`) || n === assetId);
  if (!hit) throw new Error(`the uploaded picture (${assetId}) isn’t in ${uploadsDir}`);
  return path.join(uploadsDir, hit);
}

/** Put a raw iPhone or iPad screenshot in its device frame, with the `frames` CLI's saved defaults. */
function frameScreenshot(file, outDir) {
  let out;
  try {
    out = execFileSync("frames", ["--json", "-o", outDir, file], { encoding: "utf8" });
  } catch (e) {
    throw new Error(`the screenshot couldn’t be framed (${(e.stderr || e.message || "").toString().trim().split("\n").pop()})`);
  }
  const result = JSON.parse(out.slice(out.indexOf("{")));
  const one = Array.isArray(result) ? result[0] : result;
  if (!one?.output) throw new Error("the framing tool didn’t say where it saved the framed picture");
  return { file: one.output, device: one.device };
}

/**
 * Turn one uploaded picture into the file the page ships.
 * @param {object} change the `image` change
 * @param {{slot: string, out: string, src: string, archive: string|null}} plan from core.planImage
 * @returns {Promise<{src: string, width: number, height: number, notes: string[]}>}
 */
export async function processImage(change, plan, { uploadsDir, root = ROOT }) {
  const spec = RULES.slots[plan.slot];
  const notes = [];
  const input = await findUpload(uploadsDir, change.upload?.asset);
  const outFile = path.join(root, plan.out);
  await mkdir(path.dirname(outFile), { recursive: true });

  if (spec.svg) {
    const text = await readFile(input, "utf8");
    if (!/^\s*(<\?xml[^>]*>\s*)?(<!--[\s\S]*?-->\s*)*<svg[\s>]/i.test(text)) throw new Error("the Android icon has to be an SVG file");
    await writeFile(outFile, text);
    const meta = await sharp(Buffer.from(text)).metadata();
    return { src: plan.src, width: meta.width, height: meta.height, notes };
  }

  let source = input;
  let temp = null;
  if (change.frame) {
    if (spec.frame !== "apple") throw new Error(`a ${spec.label.toLowerCase()} can’t be framed for you; upload it with its frame`);
    temp = await mkdtemp(path.join(tmpdir(), "apps-studio-"));
    const framed = frameScreenshot(input, temp);
    source = framed.file;
    notes.push(`Framed as ${framed.device}.`);
  }

  try {
    const meta = await sharp(source).metadata();
    const target = spec.longestWide && meta.width > meta.height ? spec.longestWide : spec.longest;
    if (Math.max(meta.width, meta.height) < target) notes.push(`The picture is ${meta.width}×${meta.height}, smaller than the ${target}px this spot ships at, so it may look soft.`);
    if (spec.square && meta.width !== meta.height) notes.push("The icon isn’t square; it was fitted inside a square.");
    const resize = spec.square
      ? { width: target, height: target, fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }
      : meta.width >= meta.height ? { width: target } : { height: target };
    const info = await sharp(source)
      .rotate()
      .resize({ ...resize, withoutEnlargement: !spec.square })
      .webp({ quality: RULES.quality, effort: 6 })
      .toFile(outFile);
    if (plan.archive) {
      const archiveFile = path.join(root, plan.archive);
      await mkdir(path.dirname(archiveFile), { recursive: true });
      await copyFile(source, archiveFile);
    }
    return { src: plan.src, width: info.width, height: info.height, notes };
  } finally {
    if (temp) await rm(temp, { recursive: true, force: true });
  }
}

/** Write a request's files and remove the ones it retired. */
export async function writeAll({ writes, deletes }, root = ROOT) {
  for (const [rel, text] of Object.entries(writes)) {
    await mkdir(path.dirname(path.join(root, rel)), { recursive: true });
    await writeFile(path.join(root, rel), text);
  }
  for (const rel of deletes) await rm(path.join(root, rel), { force: true });
}

/**
 * Old pictures nothing points at any more, which the request retires. A
 * picture still named anywhere under src/ (an article, another page) stays.
 */
export async function unusedImages(srcs, root = ROOT) {
  const texts = [];
  async function walk(rel) {
    for (const e of await readdir(path.join(root, rel), { withFileTypes: true })) {
      const p = `${rel}/${e.name}`;
      if (e.isDirectory()) await walk(p);
      else if (/\.(astro|md|json|ts|mjs|js|css)$/.test(e.name) && !e.name.startsWith("CLAUDE")) texts.push(await readFile(path.join(root, p), "utf8"));
    }
  }
  await walk("src");
  return srcs.filter((src) => src && !RULES.iconFiles.includes(src) && !texts.some((t) => t.includes(src)))
    .map((src) => `public${src}`)
    .filter((rel) => existsSync(path.join(root, rel)));
}
