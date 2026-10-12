// HTTP layer for the word-alignment tool (alignment phase 2). Routing and
// request/response plumbing only: every read or write lives in store.mjs. The
// plumbing below is the glossary review tool's (scripts/alignment-review/
// server.mjs, which runs its own main() on import and so can't be shared);
// the localhost-only bind and the exact-path allowlist are the same on purpose.
//
//   npm run review:words [-- --port N --chapters-dir <dir> --out-dir <dir>]
//
// Default port 4501, one above the glossary tool's 4500, so both can be open.

import { createServer } from "node:http";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createStore } from "./store.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, "..", "..");
const UI_DIR = path.join(HERE, "ui");

const DEFAULT_PORT = 4501;
// A chapter is saved whole (a link may cross a verse), so the cap is a few
// hundred links, not one verse's handful.
const MAX_BODY_BYTES = 2 * 1024 * 1024;
const JS_TYPE = "text/javascript; charset=utf-8";

/**
 * Exact-path allowlist, never a path-join from the request. The UI imports
 * nothing: the server sends it ready-tokenized English and the Greek words, so
 * there is no second copy of any rule in the browser to keep in step. (The
 * glossary tool serves its pure core to the browser because its UI groups
 * renderings as you click; this one has no such logic to share.)
 */
const STATIC_FILES = {
  "/": { file: path.join(UI_DIR, "index.html"), type: "text/html; charset=utf-8" },
  "/app.css": { file: path.join(UI_DIR, "app.css"), type: "text/css; charset=utf-8" },
  "/app.js": { file: path.join(UI_DIR, "app.js"), type: JS_TYPE },
};

function argValue(name) {
  const args = process.argv.slice(2);
  for (let i = 0; i < args.length; i++) {
    if (args[i] === `--${name}` && args[i + 1]) return args[i + 1];
    if (args[i].startsWith(`--${name}=`)) return args[i].slice(name.length + 3);
  }
  return null;
}

function resolvePort() {
  const given = argValue("port") ?? process.env.PORT;
  return given ? Number(given) : DEFAULT_PORT;
}

function sendJson(res, statusCode, body) {
  const json = JSON.stringify(body);
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(json),
  });
  res.end(json);
}

/** Body reader with a hard cap: a doubled request should 413, not grow memory. */
function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    let tooLarge = false;
    const chunks = [];
    req.on("data", (chunk) => {
      if (tooLarge) return; // keep draining so the socket can still carry the 413
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        tooLarge = true;
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
      return sendJson(res, 404, { error: `UI asset missing: ${path.relative(REPO_ROOT, entry.file)}` });
    }
    throw err;
  }
}

async function handleApi(store, req, res, method, pathname) {
  if (method === "GET" && pathname === "/api/chapters") {
    return sendJson(res, 200, { chapters: store.getChapters(), outDir: path.relative(REPO_ROOT, store.outDir) });
  }

  const m = pathname.match(/^\/api\/chapters\/([^/]+)$/);
  if (m && method === "GET") return sendJson(res, 200, store.getChapter(decodeURIComponent(m[1])));
  if (m && method === "POST") {
    const body = await readJsonBody(req);
    return sendJson(res, 200, await store.saveChapter(decodeURIComponent(m[1]), body));
  }

  return sendJson(res, 404, { error: `Not found: ${method} ${pathname}` });
}

async function main() {
  let store;
  try {
    store = await createStore({
      ...(argValue("chapters-dir") && { chaptersDir: path.resolve(argValue("chapters-dir")) }),
      ...(argValue("out-dir") && { outDir: path.resolve(argValue("out-dir")) }),
    });
  } catch (err) {
    console.error(err.message || err); // a fatal, expected condition: the message alone
    process.exit(1);
  }

  const server = createServer((req, res) => {
    const { pathname } = new URL(req.url, "http://127.0.0.1");
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
    console.log(`Word alignment: http://127.0.0.1:${port}`);
    console.log(`  English from ${path.relative(REPO_ROOT, store.chaptersDir) || "."}`);
    console.log(`  Writing to   ${path.relative(REPO_ROOT, store.outDir) || "."}`);
  });
}

main();
