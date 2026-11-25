// What the address answers, to a browser and to anyone else who posts to it:
// a status and never a body, nothing about the sender stored, nothing logged.
import { env } from "cloudflare:workers";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MAX_BODY_BYTES, PATH } from "../src/http.js";
import { CHROME, ENDPOINT, FIREFOX, SITE, clear, legacy, modern, postLegacy, postModern, rows, send } from "./post.js";

// Called with nothing: Vitest hands a hook its own context, which is not a database.
beforeEach(() => clear());

/** Everything both tables hold, as one string to search. */
async function everythingStored() {
  const tables = (await env.DB.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' AND name NOT LIKE 'd1_%'").all()).results;
  expect(tables.map((table) => table.name).sort()).toEqual(["counts", "days"]);
  let all = "";
  for (const { name } of tables) all += JSON.stringify((await env.DB.prepare(`SELECT * FROM ${name}`).all()).results);
  return all;
}

describe("a report", () => {
  it("is counted when sent the old way (report-uri), and answered 204 with nothing", async () => {
    const res = await postLegacy();
    expect([res.status, res.text]).toEqual([204, ""]);
    expect(await rows()).toMatchObject([{ disposition: "report", directive: "connect-src", blocked: "https://api.example.com", page: "/john-3/", source: "", browser: "firefox", n: 1 }]);
  });

  it("is counted when sent the new way (report-to), several at once", async () => {
    const res = await postModern([modern(), modern(), modern({ effectiveDirective: "img-src", blockedURL: "data:image/png;base64,AAAA" })]);
    expect([res.status, res.text]).toEqual([204, ""]);
    expect((await rows()).map((row) => [row.directive, row.blocked, row.browser, row.n])).toEqual([
      ["connect-src", "https://api.example.com", "chromium", 2],
      ["img-src", "data", "chromium", 1],
    ]);
  });

  it("is counted when an older browser sends the old shape as plain JSON, and whatever the type's parameters", async () => {
    for (const type of ["application/json", "application/csp-report; charset=utf-8", "APPLICATION/REPORTS+JSON"]) {
      expect((await send("POST", { type, body: legacy() })).status, type).toBe(204);
    }
    expect((await rows())[0].n).toBe(3);
  });

  it("has the day it arrived, in UTC", async () => {
    await postLegacy();
    expect((await rows())[0].day).toBe(new Date().toISOString().slice(0, 10));
  });
});

describe("what is answered alike and counted for nothing", () => {
  it("answers 204 to a report about a page that isn't the site's, and writes nothing", async () => {
    expect((await postLegacy({ "document-uri": "https://evil.example/john-3/" })).status).toBe(204);
    expect((await postModern([modern({ documentURL: "https://abc.litbible.pages.dev/" }, { url: "https://abc.litbible.pages.dev/" })])).status).toBe(204);
    expect(await rows()).toEqual([]);
  });

  it("answers 204 to JSON that is no report at all, and writes nothing", async () => {
    for (const body of ["null", "7", '"x"', "{}", "[]", '[{"type":"deprecation","body":{}}]', '{"csp-report":null}']) {
      const res = await send("POST", { type: "application/csp-report", body });
      expect([res.status, res.text], body).toEqual([204, ""]);
    }
    expect(await rows()).toEqual([]);
  });
});

describe("what is refused", () => {
  it("answers 405 to anything but a POST, and names POST", async () => {
    for (const method of ["GET", "HEAD", "PUT", "DELETE", "OPTIONS", "PATCH"]) {
      const res = await send(method);
      expect([res.status, res.text, res.headers.get("allow")], method).toEqual([405, "", "POST"]);
    }
  });

  it("answers 404 at any other path", async () => {
    expect(PATH).toBe("/csp-report");
    for (const path of ["/", "/csp-report/", "/csp-report/x", "/csp-reports", "/contact/submit"]) {
      const res = await send("POST", { path, type: "application/csp-report", body: legacy() });
      expect([res.status, res.text], path).toEqual([404, ""]);
    }
    expect(await rows()).toEqual([]);
  });

  it("ignores a query string on its own address, and keeps none of it", async () => {
    expect((await send("POST", { path: "/csp-report?who=someone", type: "application/csp-report", body: legacy() })).status).toBe(204);
    expect(await everythingStored()).not.toContain("someone");
  });

  it("answers 415 to a type no browser sends a report as", async () => {
    for (const type of [undefined, "text/plain", "application/x-www-form-urlencoded", "multipart/form-data; boundary=x", "application/jsonp", "text/json"]) {
      const res = await send("POST", { type, body: JSON.stringify(legacy()) });
      expect([res.status, res.text], String(type)).toEqual([415, ""]);
    }
    expect(await rows()).toEqual([]);
  });

  it("answers 413 to a post that says it is too large, without reading it", async () => {
    const res = await send("POST", { type: "application/csp-report", body: legacy(), headers: { "content-length": String(MAX_BODY_BYTES + 1) } });
    expect([res.status, res.text]).toEqual([413, ""]);
    expect(await rows()).toEqual([]);
  });

  it("answers 413 to a post that is too large whatever it says, and takes one that is exactly the limit", async () => {
    expect(MAX_BODY_BYTES).toBe(64 * 1024);
    const padded = (bytes) => {
      const report = JSON.stringify(legacy({ "original-policy": "" }));
      return report.replace('"original-policy":""', `"original-policy":"${"x".repeat(bytes - report.length)}"`);
    };
    expect(padded(MAX_BODY_BYTES)).toHaveLength(MAX_BODY_BYTES);

    const over = await send("POST", { type: "application/csp-report", body: padded(MAX_BODY_BYTES + 1) });
    expect([over.status, over.text]).toEqual([413, ""]);
    // The same, arriving in pieces with no length given.
    const pieces = new TextEncoder().encode(padded(MAX_BODY_BYTES + 1));
    const stream = new ReadableStream({
      start(controller) {
        for (let at = 0; at < pieces.length; at += 4096) controller.enqueue(pieces.slice(at, at + 4096));
        controller.close();
      },
    });
    expect((await send("POST", { type: "application/csp-report", body: stream })).status).toBe(413);
    expect(await rows()).toEqual([]);

    expect((await send("POST", { type: "application/csp-report", body: padded(MAX_BODY_BYTES) })).status).toBe(204);
    expect(await rows()).toHaveLength(1);
  });

  it("answers 400 to what isn't JSON, or isn't UTF-8, or is empty", async () => {
    for (const body of ["{", "csp-report=1", "", "<xml/>", new Uint8Array([0x7b, 0xff, 0xfe, 0x7d])]) {
      const res = await send("POST", { type: "application/csp-report", body });
      expect([res.status, res.text], String(body)).toEqual([400, ""]);
    }
    expect((await send("POST", { type: "application/csp-report" })).status).toBe(400);
    expect(await rows()).toEqual([]);
  });
});

describe("nothing is given back", () => {
  it("answers every case with an empty body, no-store, and no header that carries anything of the request", async () => {
    const marker = "zq9marker";
    const cases = [
      await postLegacy({ "blocked-uri": `https://${marker}.example.com/` }),
      await postModern([modern({ blockedURL: `https://${marker}.example.com/` })]),
      await send("GET", { headers: { "x-thing": marker } }),
      await send("POST", { type: "text/plain", body: marker }),
      await send("POST", { type: "application/csp-report", body: `{"${marker}` }),
      await send("POST", { path: `/${marker}`, type: "application/csp-report", body: legacy() }),
      await send("POST", { type: "application/csp-report", body: legacy(), headers: { "content-length": "9999999" } }),
    ];
    expect(cases.map((res) => res.status)).toEqual([204, 204, 405, 415, 400, 404, 413]);
    for (const res of cases) {
      expect(res.text).toBe("");
      expect(res.headers.get("cache-control")).toBe("no-store");
      expect(res.headers.get("access-control-allow-origin")).toBeNull();
      expect(JSON.stringify([...res.headers])).not.toContain(marker);
    }
  });
});

describe("nothing about the sender is kept or logged", () => {
  const spies = [];
  beforeEach(() => {
    for (const level of ["log", "info", "warn", "error", "debug"]) spies.push(vi.spyOn(console, level).mockImplementation(() => {}));
  });
  afterEach(() => {
    while (spies.length) spies.pop().mockRestore();
  });

  it("writes no log line for a report, counted or not, or for any refusal", async () => {
    await postLegacy();
    await postModern([modern()]);
    await postLegacy({ "document-uri": "https://evil.example/" });
    await send("GET");
    await send("POST", { type: "text/plain", body: "x" });
    await send("POST", { type: "application/csp-report", body: "{" });
    await send("POST", { type: "application/csp-report", body: "x".repeat(MAX_BODY_BYTES + 1) });
    for (const spy of spies) expect(spy).not.toHaveBeenCalled();
  });

  it("stores none of: the address, the user agent, a query string, the referrer, the policy, an extension's id", async () => {
    const ip = "203.0.113.77";
    const extension = "3f2b6c1e-8a57-4d0b-9c33-5e1f0a7d2b44";
    await postLegacy(
      {
        "document-uri": `${SITE}/search/?q=my+private+search#frag`,
        "blocked-uri": "https://tracker.example.com/pixel?uid=reader-12345",
        "source-file": `moz-extension://${extension}/inject.js`,
        referrer: "https://mail.example.com/inbox/message-98765",
      },
      { headers: { "cf-connecting-ip": ip, "user-agent": FIREFOX, cookie: "session=cookie-value-1", referer: `${SITE}/private-path/` } },
    );
    await postModern(
      [modern({ documentURL: `${SITE}/sheets/?share=sheet-secret-1`, sourceFile: `chrome-extension://abcdefghijklmnopabcdefghijklmnop/x.js`, sample: "sample-text-1" })],
      { headers: { "cf-connecting-ip": ip } },
    );
    const stored = await everythingStored();
    expect((await rows()).map((row) => [row.page, row.blocked, row.source, row.browser])).toEqual([
      ["/sheets/", "https://api.example.com", "chrome-extension", "chromium"],
      ["/search/", "https://tracker.example.com", "moz-extension", "firefox"],
    ]);
    for (const needle of [ip, "203.0", "Mozilla", "Gecko", "Chrome/", "rv:128", "private", "frag", "reader-12345", "uid", extension, "abcdefghijklmnop", "mail.example", "98765", "cookie", "sheet-secret", "sample-text", "default-src", "someone"]) {
      expect(stored, needle).not.toContain(needle);
    }
    for (const spy of spies) expect(spy).not.toHaveBeenCalled();
  });

  it("answers 500 with nothing when the database fails, and logs one line of fixed words", async () => {
    const broken = { prepare: () => ({ bind: () => ({}) }), batch: async () => { throw new Error("D1_ERROR: no such table: counts"); } };
    const res = await postLegacy({ "blocked-uri": "https://zq9marker.example.com/" }, { env: { DB: broken }, headers: { "cf-connecting-ip": "203.0.113.78", "user-agent": CHROME } });
    expect([res.status, res.text]).toEqual([500, ""]);
    const [log, info, warn, error, debug] = spies;
    for (const quiet of [log, info, warn, debug]) expect(quiet).not.toHaveBeenCalled();
    // One call with one argument, which is exactly these words: nothing rides along beside the line.
    expect(error.mock.calls).toEqual([[JSON.stringify({ failure: "request", error: "D1_ERROR: no such table: counts" })]]);
    const line = error.mock.calls[0][0];
    for (const needle of ["zq9marker", "203.0.113", "Mozilla", "john-3", ENDPOINT]) expect(line).not.toContain(needle);
  });

  it("answers 500 to everything when its configuration is incomplete, instead of counting wrongly", async () => {
    for (const [missing, words] of [["SITE_ORIGIN", "no SITE_ORIGIN"], ["DB", "no DB binding"]]) {
      const res = await postLegacy({}, { env: { [missing]: undefined } });
      expect([res.status, res.text], missing).toEqual([500, ""]);
      expect(JSON.parse(spies[3].mock.calls.at(-1)[0])).toEqual({ failure: "request", error: words });
    }
  });
});
