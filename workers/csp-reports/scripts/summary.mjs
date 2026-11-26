// Prints a stretch of the policy's reports, grouped by rule and by what was
// blocked, with browser extensions apart from the site's own gaps
// (src/summary.js has the layout).
//
//   npm run summary                        the last 7 days, from the deployed database
//   npm run summary -- --days 14           the last 14
//   npm run summary -- --from 2026-11-25 --to 2026-12-01
//   npm run summary -- --local             from `wrangler dev`'s local database
//   npm run summary -- --save week.json    also keep the rows, to summarize again later
//   npm run summary -- --file week.json    from rows kept that way: asks Cloudflare nothing
//
// READING THE DEPLOYED DATABASE ASKS CLOUDFLARE, through Wrangler and the
// login it already has on this machine: two SELECTs, which change nothing.
// It is still a command against BVJ's account, so it is BVJ's to run or to
// say yes to (workers/CLAUDE.md, "Deploys are the owner's"). There is no
// token and no secret here.
//
// The rows hold nothing about a reader (src/report.js), so a saved file is
// safe to keep or to paste.

import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { MAX_REPORTS } from "../src/report.js";
import { HOURLY_CAP } from "../src/store.js";
import { summarize } from "../src/summary.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const packageDir = path.resolve(here, "..");
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 24 * 60 * 60 * 1000;
// The cap on a whole day before it was split by the hour: rows of `days` keyed by a bare day are held to it.
const LEGACY_DAY_CAP = 5000;

function fail(message) {
  console.error(message);
  process.exit(1);
}

/** The arguments: --days N, --from DAY, --to DAY, --local, --save FILE, --file FILE. */
function options(argv) {
  const found = { days: 7, local: false };
  for (let i = 0; i < argv.length; i++) {
    const name = argv[i];
    if (name === "--local") found.local = true;
    else if (["--days", "--from", "--to", "--save", "--file"].includes(name)) {
      const value = argv[++i];
      if (value === undefined) fail(`${name} needs a value.`);
      found[name.slice(2)] = value;
    } else fail(`Unknown argument: ${name}. See the top of scripts/summary.mjs.`);
  }
  const days = Number(found.days);
  if (!Number.isInteger(days) || days < 1 || days > 366) fail("--days takes a whole number from 1 to 366.");
  const to = found.to ?? new Date().toISOString().slice(0, 10);
  // Checked as a real day before it is ever written into a query.
  const real = (day) => DAY.test(day) && !Number.isNaN(Date.parse(`${day}T00:00:00Z`)) && new Date(`${day}T00:00:00Z`).toISOString().slice(0, 10) === day;
  if (!real(to)) fail("--to takes a day as 2026-12-01.");
  const from = found.from ?? new Date(Date.parse(`${to}T00:00:00Z`) - (days - 1) * DAY_MS).toISOString().slice(0, 10);
  if (!real(from)) fail("--from takes a day as 2026-11-25.");
  if (from > to) fail("--from is after --to.");
  return { from, to, local: found.local, save: found.save, file: found.file };
}

/** Runs one SELECT through the package's own Wrangler and returns its rows. No shell: the arguments go as they are. */
function select(sql, local) {
  const require = createRequire(import.meta.url);
  const manifest = require.resolve("wrangler/package.json");
  const wrangler = path.join(path.dirname(manifest), JSON.parse(readFileSync(manifest, "utf8")).bin.wrangler);
  const ran = spawnSync(process.execPath, [wrangler, "d1", "execute", "DB", local ? "--local" : "--remote", "--json", "--command", sql], {
    cwd: packageDir,
    encoding: "utf8",
    stdio: ["inherit", "pipe", "inherit"],
    maxBuffer: 256 * 1024 * 1024,
  });
  if (ran.error) fail(`Wrangler could not be run: ${ran.error.message}`);
  if (ran.status !== 0) fail(`Wrangler stopped with status ${ran.status}.${ran.stdout ? `\n${ran.stdout.trim()}` : ""}`);
  const start = ran.stdout.indexOf("[");
  let parsed;
  try {
    parsed = JSON.parse(ran.stdout.slice(start));
  } catch {
    fail(`Wrangler's answer was not the JSON expected:\n${ran.stdout.trim().slice(0, 2000)}`);
  }
  if (!Array.isArray(parsed) || !Array.isArray(parsed[0]?.results)) fail("Wrangler's answer held no rows.");
  return parsed[0].results;
}

const { from, to, local, save, file } = options(process.argv.slice(2));

let rows;
let days;
if (file) {
  ({ rows, days } = JSON.parse(readFileSync(path.resolve(file), "utf8")));
  if (!Array.isArray(rows) || !Array.isArray(days)) fail(`${file} is not a file this script saved.`);
  rows = rows.filter((row) => row.day >= from && row.day <= to);
  days = days.filter((day) => day.day >= from && day.day <= `${to}T99`);
} else {
  rows = select(`SELECT day, disposition, directive, blocked, page, source, browser, n FROM counts WHERE day BETWEEN '${from}' AND '${to}'`, local);
  days = select(`SELECT day, n FROM days WHERE day BETWEEN '${from}' AND '${to}T99' ORDER BY day`, local);
}

if (save) {
  writeFileSync(path.resolve(save), `${JSON.stringify({ from, to, rows, days }, null, 2)}\n`);
  console.error(`Rows saved to ${path.resolve(save)}`);
}

console.log(summarize(rows, days, { from, to, cap: HOURLY_CAP, perPost: MAX_REPORTS, dayCap: LEGACY_DAY_CAP }));
