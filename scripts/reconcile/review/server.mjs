#!/usr/bin/env node
// Localhost review tool for the reconciliation ledger (`npm run review:reconcile`).
//
// NOT part of any build and never shipped. Its ui/ is served from this Node
// process by an exact-path allowlist and deliberately NOT from public/ - Astro
// copies public/ into dist/ as a filesystem operation, so a .gitignore there
// stops a commit but not a deploy. Same arrangement, and same reason, as
// scripts/alignment-review/.
//
// It answers one question per hunk, not per record: see review-core.mjs's
// header for why that distinction is the whole point of the tool.
//
// Decisions are written to out/decisions.json the moment they are made - no
// save step, so a crash costs at most one hunk. apply.mjs reads that file
// (via the `decision` build-ledger stamps onto each record) and splices the
// composed `resolvedValue`, which is why a decision records the SHA of the
// text it was made against: regenerate the ledger after editing a chapter and
// any decision whose base moved is refused rather than applied blind.
import { createServer } from "node:http";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { diffSegments, defaultVerdicts, compose, decisionFor, isReviewable, summarize } from "./review-core.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(__dirname, "../out");
const LEDGER_PATH = path.join(OUT_DIR, "ledger.json");
const DECISIONS_PATH = path.join(OUT_DIR, "decisions.json");

function argValue(flag, fallback) {
  const pref = `--${flag}=`;
  const found = process.argv.find((a) => a.startsWith(pref));
  return found ? found.slice(pref.length) : fallback;
}
const PORT = Number(argValue("port", "4600"));
const BUCKETS = argValue("buckets", "B,C,D").split(",").map((b) => b.trim()).filter(Boolean);

if (!existsSync(LEDGER_PATH)) {
  console.error(`No ledger at ${LEDGER_PATH}.`);
  console.error("Run: node scripts/reconcile/build-ledger.mjs --master-dir=<unpacked master XML>");
  process.exit(1);
}

const sha = (s) => createHash("sha256").update(s, "utf8").digest("hex").slice(0, 16);

// ---------------------------------------------------------------------
// Ledger -> review items. Segments are computed once at startup; the ledger
// is a file on disk that nothing else is writing while this runs.
// ---------------------------------------------------------------------

const ledger = JSON.parse(readFileSync(LEDGER_PATH, "utf8"));
const items = [];
for (const r of ledger) {
  if (!BUCKETS.includes(r.bucket)) continue;
  if (!isReviewable(r)) continue;
  const segments = diffSegments(r.patch.oldValue, r.patch.newValue);
  if (!segments.some((s) => s.type === "hunk")) continue; // nothing to choose
  items.push({
    id: r.id,
    kind: r.kind,
    bookKey: r.bookKey,
    chapter: r.chapter,
    verse: r.verse ?? null,
    repoLabel: r.repoLabel ?? null,
    bucket: r.bucket,
    subclass: r.subclass,
    settledAt: r.settledAt?.date ?? null,
    forceHandReview: r.forceHandReview ?? null,
    baseSha: sha(r.patch.oldValue),
    segments,
  });
}

if (items.length === 0) {
  console.error(`No reviewable records in bucket(s) ${BUCKETS.join(", ")}. Nothing to do.`);
  process.exit(1);
}

const counts = summarize(items.map((i) => i.segments));

function loadDecisions() {
  if (!existsSync(DECISIONS_PATH)) return {};
  try {
    return JSON.parse(readFileSync(DECISIONS_PATH, "utf8"));
  } catch (e) {
    console.error(`WARNING: ${DECISIONS_PATH} is not valid JSON (${e.message}) - starting empty.`);
    return {};
  }
}
let decisions = loadDecisions();

// Prune decisions that no longer refer to anything appliable. Applying a
// record and rebuilding the ledger leaves its decision behind: either the
// record is gone (the repo now matches the master) or it has dropped to bucket
// E, where only quote style still differs and there is no patch to write. Both
// read as an unfinished approval in the UI when they are in fact done. This is
// bucket-independent on purpose - `--buckets` must not delete decisions for
// records it simply isn't showing.
{
  const byId = new Map(ledger.map((r) => [r.id, r]));
  let pruned = 0;
  for (const id of Object.keys(decisions)) {
    const r = byId.get(id);
    if (!r || r.patch?.newValue == null) {
      delete decisions[id];
      pruned++;
    }
  }
  if (pruned) {
    saveDecisions();
    console.log(`Pruned ${pruned} decision(s) with nothing left to apply.`);
  }
}

function saveDecisions() {
  writeFileSync(DECISIONS_PATH, JSON.stringify(decisions, null, 2) + "\n", "utf8");
}

// ---------------------------------------------------------------------
// Static files: EXACT-PATH allowlist, never a path-join from the request.
// review-core.mjs is served from outside ui/ so the browser imports the real
// module rather than a copy that could drift from the server's rules.
// ---------------------------------------------------------------------

const STATIC_FILES = new Map([
  ["/", [path.join(__dirname, "ui/index.html"), "text/html; charset=utf-8"]],
  ["/app.js", [path.join(__dirname, "ui/app.js"), "text/javascript; charset=utf-8"]],
  ["/style.css", [path.join(__dirname, "ui/style.css"), "text/css; charset=utf-8"]],
  ["/review-core.mjs", [path.join(__dirname, "review-core.mjs"), "text/javascript; charset=utf-8"]],
]);

function sendJson(res, code, body) {
  const buf = Buffer.from(JSON.stringify(body), "utf8");
  res.writeHead(code, { "content-type": "application/json; charset=utf-8", "content-length": buf.length });
  res.end(buf);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (c) => {
      data += c;
      if (data.length > 4 * 1024 * 1024) reject(new Error("body too large"));
    });
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");

  if (req.method === "GET" && STATIC_FILES.has(url.pathname)) {
    const [file, type] = STATIC_FILES.get(url.pathname);
    res.writeHead(200, { "content-type": type });
    res.end(readFileSync(file));
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/items") {
    sendJson(res, 200, { items, decisions, counts, buckets: BUCKETS });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/decision") {
    let payload;
    try {
      payload = JSON.parse(await readBody(req));
    } catch (e) {
      sendJson(res, 400, { error: `bad JSON: ${e.message}` });
      return;
    }
    const item = items.find((i) => i.id === payload.id);
    if (!item) {
      sendJson(res, 404, { error: `no such record: ${payload.id}` });
      return;
    }
    const verdicts = payload.verdicts || {};
    const { resolved, undecided } = compose(item.segments, verdicts);
    if (undecided.length) {
      // Held, not written: a half-decided record must never look settled to
      // apply.mjs. The UI keeps the partial verdicts in memory and in the
      // sidecar under `pending` so a reload does not lose them.
      decisions[item.id] = { decision: "pending", verdicts, baseSha: item.baseSha };
      saveDecisions();
      sendJson(res, 200, { id: item.id, decision: "pending", undecided });
      return;
    }
    const decision = decisionFor(resolved, findOldValue(item.id));
    decisions[item.id] = {
      decision,
      verdicts,
      baseSha: item.baseSha,
      resolvedValue: decision === "approved" ? resolved : undefined,
      note: payload.note || undefined,
    };
    saveDecisions();
    sendJson(res, 200, { id: item.id, decision });
    return;
  }

  res.writeHead(404, { "content-type": "text/plain" });
  res.end("not found");
});

function findOldValue(id) {
  return ledger.find((r) => r.id === id).patch.oldValue;
}

// 127.0.0.1, not 0.0.0.0: this reads and writes repo content and has no auth.
server.listen(PORT, "127.0.0.1", () => {
  const decided = Object.values(decisions).filter((d) => d.decision !== "pending").length;
  console.log(`Reconciliation review — http://127.0.0.1:${PORT}`);
  console.log(`  buckets   : ${BUCKETS.join(", ")}`);
  console.log(`  records   : ${items.length}`);
  console.log(`  hunks     : ${counts.total} (${counts.mechanical} mechanical, ${counts.judgment} need judgment)`);
  console.log(`  decided   : ${decided} record(s) already in out/decisions.json`);
  console.log(`\nDecisions are written as you make them. Apply them with:`);
  console.log(`  node scripts/reconcile/apply.mjs --decision=approved --write`);
});
