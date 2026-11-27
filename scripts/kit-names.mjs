#!/usr/bin/env node
// The kit's other names (src/styles/kit.css): until a surface's markup takes
// the kit's classes, its controls are named in the level whose look they
// take. This adds a name to every rule of its level at once, or takes one
// away when the markup moves to the kit's class, so the level's lists stay
// alike (test/featherboa-kit.test.js holds them). Run by hand:
//
//   node scripts/kit-names.mjs list [level]
//   node scripts/kit-names.mjs add <level> <selector> [<selector>...]
//   node scripts/kit-names.mjs remove <level> <selector> [<selector>...]
//
// The levels: filled, tinted, plain (an icon alone too), danger, row, row-on,
// tab, tab-on, inline (a press that reads as text), field, dot. A selector
// with a space in it goes in quotes.

import { mkdirSync, readFileSync, rmdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { LEVELS, addNames, allNames, removeNames } from "./lib/kit-lists.mjs";

const file = join(dirname(fileURLToPath(import.meta.url)), "../src/styles/kit.css");
const [cmd, level, ...names] = process.argv.slice(2);

/** One writer at a time: two sessions sweeping at once can't drop a name. */
function locked(fn) {
  const lock = `${file}.lock`;
  const until = Date.now() + 10_000;
  for (;;) {
    try {
      mkdirSync(lock);
      break;
    } catch {
      if (Date.now() > until) throw new Error(`kit.css is locked (${lock}); remove it if no one is writing`);
      const t = Date.now() + 50;
      while (Date.now() < t);
    }
  }
  try {
    return fn();
  } finally {
    rmdirSync(lock);
  }
}

if (cmd === "list") {
  const all = allNames(readFileSync(file, "utf8"));
  for (const [lv, list] of Object.entries(all)) {
    if (level && lv !== level) continue;
    console.log(`${lv} (${LEVELS[lv]}): ${list.length}`);
    for (const n of list) console.log(`  ${n}`);
  }
} else if ((cmd === "add" || cmd === "remove") && level && names.length) {
  locked(() => {
    const css = readFileSync(file, "utf8");
    const next = cmd === "add" ? addNames(css, level, names) : removeNames(css, level, names);
    writeFileSync(file, next);
  });
  console.log(`${cmd === "add" ? "added to" : "removed from"} ${level}: ${names.join(", ")}`);
} else {
  console.error("usage: node scripts/kit-names.mjs list [level] | add <level> <selector>... | remove <level> <selector>...");
  process.exit(1);
}
