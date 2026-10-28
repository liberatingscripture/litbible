/**
 * Undoing a Studio apply run that fails its checks. Kept apart from store.mjs
 * (which loads sharp) so the tests can reach it without the image library.
 */
import { existsSync } from "node:fs";
import { readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(fileURLToPath(new URL("../..", import.meta.url)));

/**
 * What a run is about to write, kept so a failed run can be undone exactly:
 * a file it created is removed, and a file it replaced (an app icon) gets
 * its old bytes back. Nothing the run didn't touch is ever removed.
 */
export class Undo {
  constructor(root = ROOT) { this.root = root; this.entries = []; }
  async remember(rel) {
    if (!rel || this.entries.some((e) => e.rel === rel)) return;
    const abs = path.join(this.root, rel);
    this.entries.push({ rel, prev: existsSync(abs) ? await readFile(abs) : null });
  }
  async run() {
    for (const { rel, prev } of [...this.entries].reverse()) {
      const abs = path.join(this.root, rel);
      if (prev) await writeFile(abs, prev);
      else await rm(abs, { force: true });
    }
  }
}
