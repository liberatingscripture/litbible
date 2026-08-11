// HTTP layer for the alignment review tool. Routing and request/response
// plumbing only — every read or write of src/data/alignment/, the corpus, or
// the glossary lives in store.mjs. This file's job is: parse a request into a
// store call, and turn whatever the store returns (or throws) into JSON.
//
// Run directly: `node scripts/alignment-review/server.mjs [--port N]`.

import { createServer } from "node:http";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createStore } from "./store.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, "..", "..");
const UI_DIR = path.join(HERE, "ui");

const DEFAULT_PORT = 4500;
const MAX_BODY_BYTES = 64 * 1024;

const JS_TYPE = "text/javascript; charset=utf-8";

/**
 * Exact-path allowlist for static files — never a path-join from user input.
 * Every servable URL is spelled out here; anything else is a 404, not a
 * filesystem lookup.
 *
 * The three /lib/ + /src/ entries are NOT a directory mount. The UI needs
 * formSignature()/suggestForm() to group renderings as the reviewer clicks,
 * and those live in review-core.mjs — which is pure and browser-safe, so the
 * browser imports the real module rather than the UI keeping a second copy of
 * a rule that has to agree with the server's. The URLs are chosen so that
 * review-core's own relative specifiers ("../lib/alignment-forms.mjs",
 * "../../src/lib/word-stem.mjs") resolve to the other two entries unchanged;
 * if you move any of these files, the URLs here have to move with them.
 */
const STATIC_FILES = {
  "/": { file: path.join(UI_DIR, "index.html"), type: "text/html; charset=utf-8" },
  "/app.css": { file: path.join(UI_DIR, "app.css"), type: "text/css; charset=utf-8" },
  "/app.js": { file: path.join(UI_DIR, "app.js"), type: JS_TYPE },
  "/lib/review-core.mjs": { file: path.join(HERE, "review-core.mjs"), type: JS_TYPE },
  "/lib/alignment-forms.mjs": {
    file: path.join(REPO_ROOT, "scripts", "lib", "alignment-forms.mjs"),
    type: JS_TYPE,
  },
  "/src/lib/word-stem.mjs": {
    file: path.join(REPO_ROOT, "src", "lib", "word-stem.mjs"),
    type: JS_TYPE,
  },
};

function resolvePort() {
  const args = process.argv.slice(2);
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--port" && args[i + 1]) return Number(args[i + 1]);
    const m = args[i].match(/^--port=(\d+)$/);
    if (m) return Number(m[1]);
  }
  if (process.env.PORT) return Number(process.env.PORT);
  return DEFAULT_PORT;
}

function sendJson(res, statusCode, body) {
  const json = JSON.stringify(body);
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(json),
  });
  res.end(json);
}

/** Body reader with a hard cap — this is a local review tool, not a public endpoint, but a runaway client (or a doubled request) should 413 rather than grow memory unbounded. */
function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    let tooLarge = false;
    const chunks = [];
    req.on("data", (chunk) => {
      if (tooLarge) return; // already rejected; keep draining so the socket can still carry the response
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        tooLarge = true;
        // Deliberately NOT req.destroy() here — on HTTP/1.1 the request and
        // response share one socket, and destroying it races the 413 response
        // we're about to write. Letting the stream drain (dropping further
        // chunks, above) costs a little bandwidth but keeps the connection
        // alive to actually deliver the error.
        reject(Object.assign(new Error("Request body too large"), { statusCode: 413 }));
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      if (!chunks.length) return resolve({});
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      } catch {
        reject(Object.assign(new Error("Invalid JSON body"), { statusCode: 400 }));
      }
    });
    req.on("error", (err) => reject(Object.assign(err, { statusCode: 400 })));
  });
}

async function serveStatic(res, pathname) {
  const entry = STATIC_FILES[pathname];
  if (!entry) return sendJson(res, 404, { error: `Not found: ${pathname}` });
  try {
    const body = await fs.readFile(entry.file);
    res.writeHead(200, { "Content-Type": entry.type, "Content-Length": body.length });
    res.end(body);
  } catch (err) {
    if (err.code === "ENOENT") {
      return sendJson(res, 404, {
        error: `UI asset missing: ${path.relative(REPO_ROOT, entry.file)}`,
      });
    }
    throw err;
  }
}

async function handleApi(store, req, res, method, pathname) {
  if (method === "GET" && pathname === "/api/terms") {
    return sendJson(res, 200, { terms: store.getTermsSummary() });
  }

  let m = pathname.match(/^\/api\/terms\/([^/]+)$/);
  if (method === "GET" && m) {
    const detail = store.getTermDetail(decodeURIComponent(m[1]));
    if (!detail) return sendJson(res, 404, { error: `Unknown term: ${m[1]}` });
    return sendJson(res, 200, detail);
  }

  m = pathname.match(/^\/api\/terms\/([^/]+)\/verses\/([^/]+)$/);
  if (method === "POST" && m) {
    const body = await readJsonBody(req);
    const result = await store.applyVerseDecision(
      decodeURIComponent(m[1]),
      decodeURIComponent(m[2]),
      body,
    );
    return sendJson(res, 200, result);
  }

  m = pathname.match(/^\/api\/terms\/([^/]+)\/form-merges$/);
  if (method === "GET" && m) {
    return sendJson(res, 200, store.getFormMerges(decodeURIComponent(m[1])));
  }

  m = pathname.match(/^\/api\/terms\/([^/]+)\/merge-forms$/);
  if (method === "POST" && m) {
    const body = await readJsonBody(req);
    const result = await store.mergeForms(decodeURIComponent(m[1]), body);
    return sendJson(res, 200, result);
  }

  m = pathname.match(/^\/api\/terms\/([^/]+)\/accept-double-confirmed$/);
  if (method === "POST" && m) {
    const result = await store.acceptDoubleConfirmed(decodeURIComponent(m[1]));
    return sendJson(res, 200, result);
  }

  if (method === "GET" && pathname === "/api/absent") {
    return sendJson(res, 200, store.getAbsentGroups());
  }

  if (method === "POST" && pathname === "/api/absent/bulk-reject") {
    const body = await readJsonBody(req);
    const result = await store.bulkReject(body?.recordKeys);
    return sendJson(res, 200, result);
  }

  return sendJson(res, 404, { error: `Not found: ${method} ${pathname}` });
}

async function main() {
  let store;
  try {
    store = await createStore();
  } catch (err) {
    // A fatal, expected condition (no corpus) — print the message alone,
    // not a stack trace, since createStore() already explains the fix.
    console.error(err.message || err);
    process.exit(1);
  }

  const server = createServer((req, res) => {
    // Route matching runs on the raw (still-encoded) pathname; individual
    // path SEGMENTS (term id, ref) are decodeURIComponent'd per-route below,
    // since a ref like "1Cor.7.9" is a single segment but the "1" isn't a
    // reason to touch the "/" structure itself.
    const url = new URL(req.url, "http://127.0.0.1");
    const pathname = url.pathname;

    const dispatch = pathname.startsWith("/api/")
      ? handleApi(store, req, res, req.method, pathname)
      : req.method === "GET"
        ? serveStatic(res, pathname)
        : sendJson(res, 405, { error: `Method not allowed: ${req.method}` });

    Promise.resolve(dispatch).catch((err) => {
      if (res.headersSent) return;
      const statusCode = Number.isInteger(err?.statusCode) ? err.statusCode : 500;
      if (statusCode >= 500) console.error(err);
      sendJson(res, statusCode, { error: err?.message || "Internal server error" });
    });
  });

  const port = resolvePort();
  server.listen(port, "127.0.0.1", () => {
    console.log(`Alignment review server: http://127.0.0.1:${port}`);
  });
}

main();
