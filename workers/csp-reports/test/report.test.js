// What is kept of a report (src/report.js): a fixed set of words and short
// strings, and nothing about the reader.
import { describe, expect, it } from "vitest";
import { DIRECTIVES, MAX_FIELD, MAX_REPORTS, browserOf, directiveOf, dispositionOf, group, pageOf, placeOf, trim } from "../src/report.js";
import { CHROME, FIREFOX, SAFARI, SITE, legacy, modern } from "./post.js";

const from = (userAgent = FIREFOX) => ({ site: SITE, userAgent });

describe("the two shapes a browser sends", () => {
  it("keeps six things of a report sent the old way (report-uri), and the request's user agent decides the browser", () => {
    expect(trim(legacy(), from(FIREFOX))).toEqual([
      { disposition: "report", directive: "connect-src", blocked: "https://api.example.com", page: "/john-3/", source: "", browser: "firefox" },
    ]);
  });

  it("keeps the same six of each report sent the new way (report-to), and each report's own user agent decides", () => {
    const kept = trim([modern(), modern({ disposition: "enforce", effectiveDirective: "frame-src", blockedURL: "https://www.example.net/embed/1" }, { user_agent: SAFARI })], from(FIREFOX));
    expect(kept).toEqual([
      { disposition: "report", directive: "connect-src", blocked: "https://api.example.com", page: "/john-3/", source: "/_astro/chapter-tools.B5E1GIKE.js", browser: "chromium" },
      { disposition: "enforce", directive: "frame-src", blocked: "https://www.example.net", page: "/john-3/", source: "/_astro/chapter-tools.B5E1GIKE.js", browser: "safari" },
    ]);
  });

  it("reads one report sent the new way without its array", () => {
    expect(trim(modern(), from())).toHaveLength(1);
  });

  it("falls back to the report's own `url` for the page, and to the request's user agent", () => {
    const report = modern({ documentURL: undefined }, { url: `${SITE}/read/john/`, user_agent: undefined });
    expect(trim([report], from(SAFARI))[0]).toMatchObject({ page: "/read/john/", browser: "safari" });
  });

  it("reads the rule from an older browser's violated-directive, which may be the whole directive", () => {
    const kept = trim(legacy({ "effective-directive": undefined, "violated-directive": "script-src 'self' https://challenges.cloudflare.com" }), from());
    expect(kept[0].directive).toBe("script-src");
  });

  it("keeps nothing else: no referrer, policy, sample, status, line, or column", () => {
    for (const entry of [...trim(legacy(), from()), ...trim([modern()], from())]) {
      expect(Object.keys(entry)).toEqual(["disposition", "directive", "blocked", "page", "source", "browser"]);
      expect(JSON.stringify(entry)).not.toMatch(/someone|example\.org|default-src|token|abc|44/);
    }
  });
});

describe("what is dropped whole", () => {
  it("drops a report about a page that isn't the site's", () => {
    for (const address of ["https://evil.example/john-3/", "http://litbible.net/john-3/", "https://www.litbible.net/", "https://litbible.net.evil.example/", "https://abc123.litbible.pages.dev/john-3/", "about:blank", "/john-3/", ""]) {
      expect(trim(legacy({ "document-uri": address }), from()), address).toEqual([]);
      expect(trim([modern({ documentURL: address }, { url: address })], from()), address).toEqual([]);
    }
  });

  it("drops what isn't a policy report: another report type, and anything that isn't a report at all", () => {
    expect(trim([{ type: "deprecation", url: `${SITE}/`, body: { id: "x" } }, { type: "crash", url: `${SITE}/`, body: {} }], from())).toEqual([]);
    for (const junk of [null, 7, "csp-report", true, {}, [], [null, 7, "x", []], { "csp-report": null }, { "csp-report": "x" }, { "csp-report": [] }, { type: "csp-violation" }, { type: "csp-violation", body: 3 }]) {
      expect(trim(junk, from()), JSON.stringify(junk)).toEqual([]);
    }
  });

  it("reads no more than MAX_REPORTS from one post", () => {
    expect(MAX_REPORTS).toBe(20);
    const many = Array.from({ length: 50 }, (_, i) => modern({ documentURL: `${SITE}/page-${i}/` }));
    const kept = trim(many, from());
    expect(kept).toHaveLength(20);
    expect(kept.at(-1).page).toBe("/page-19/");
  });

  it("is not fooled by members that aren't strings", () => {
    const kept = trim(legacy({ "blocked-uri": { toString: "x" }, "effective-directive": ["script-src"], disposition: 1, "source-file": 99 }), from());
    expect(kept).toEqual([{ disposition: "unknown", directive: "connect-src", blocked: "", page: "/john-3/", source: "", browser: "firefox" }]);
  });
});

describe("the page", () => {
  it("is the path alone: no query string, no fragment", () => {
    expect(pageOf("https://litbible.net/search/?q=my+private+search#results", SITE)).toBe("/search/");
    expect(pageOf("https://litbible.net/sheets/#s=eyJ0aXRsZSI6InNlY3JldCJ9", SITE)).toBe("/sheets/");
    expect(pageOf("https://litbible.net", SITE)).toBe("/");
  });

  it("is cut at MAX_FIELD characters", () => {
    expect(pageOf(`https://litbible.net/${"a".repeat(500)}`, SITE)).toHaveLength(MAX_FIELD);
  });
});

describe("what was blocked, and the file that asked", () => {
  it("is the origin alone for another site: no path, no query", () => {
    expect(placeOf("https://api.example.com/v1/charge?token=abc#x", SITE)).toBe("https://api.example.com");
    expect(placeOf("http://example.com:8080/a", SITE)).toBe("http://example.com:8080");
    expect(placeOf("wss://live.example.com/socket?user=7", SITE)).toBe("wss://live.example.com");
  });

  it("is the path for the site's own files, without a query", () => {
    expect(placeOf("https://litbible.net/_astro/chapter-tools.B5E1GIKE.js?v=2", SITE)).toBe("/_astro/chapter-tools.B5E1GIKE.js");
    expect(placeOf("https://litbible.net/search/?q=my+private+search", SITE)).toBe("/search/");
  });

  it("is the scheme alone for a browser extension: the id, which Firefox makes unique to one installation, is dropped", () => {
    expect(placeOf("moz-extension://3f2b6c1e-8a57-4d0b-9c33-5e1f0a7d2b44/content/inject.js", SITE)).toBe("moz-extension");
    expect(placeOf("chrome-extension://cjpalhdlnbpafiamejdnhcphjbkeiagm/web_accessible_resources/x.js", SITE)).toBe("chrome-extension");
    expect(placeOf("safari-web-extension://6F1A2B3C-0000-4D5E-9F00-ABCDEF012345/a.js", SITE)).toBe("safari-web-extension");
    expect(placeOf("chrome-extension", SITE)).toBe("chrome-extension");
  });

  it("is the scheme alone for what has no origin", () => {
    expect(placeOf("data:text/javascript;base64,YWxlcnQoMSk=", SITE)).toBe("data");
    expect(placeOf("blob:https://litbible.net/0f1e2d3c-aaaa-bbbb-cccc-000000000000", SITE)).toBe("blob");
    expect(placeOf("about:blank", SITE)).toBe("about");
  });

  it("keeps the browser's own word where it gives one", () => {
    for (const word of ["inline", "eval", "wasm-eval", "self", "data", "blob", "trusted-types-sink"]) expect(placeOf(word, SITE)).toBe(word);
    expect(placeOf("INLINE", SITE)).toBe("inline");
    expect(placeOf("  eval ", SITE)).toBe("eval");
  });

  it("is empty for nothing, and `other` for what is neither an address nor a word", () => {
    for (const nothing of ["", "   ", undefined, null, 5, {}]) expect(placeOf(nothing, SITE)).toBe("");
    for (const odd of ["not an address", "<script>alert(1)</script>", "x".repeat(60), "a b", "1abc", `https://${"a".repeat(200)}.example.com/`]) {
      expect(placeOf(odd, SITE), odd).toBe("other");
    }
  });
});

describe("the rule, the disposition, and the browser", () => {
  it("is one of the directives a policy can name, or `other`", () => {
    expect(DIRECTIVES.size).toBe(25);
    for (const name of DIRECTIVES) expect(directiveOf(name)).toBe(name);
    expect(directiveOf("Script-Src-Elem")).toBe("script-src-elem");
    for (const odd of ["", "made-up-src", "script-src; drop table", undefined, 4]) expect(directiveOf(odd)).toBe("other");
  });

  it("says whether the browser blocked it or only flagged it, by either word MDN gives for the second", () => {
    expect(dispositionOf("enforce")).toBe("enforce");
    expect(dispositionOf("report")).toBe("report");
    expect(dispositionOf("reporting")).toBe("report");
    for (const odd of ["", "blocked", undefined, 1]) expect(dispositionOf(odd)).toBe("unknown");
  });

  it("names the browser by its engine, which is what applies the policy", () => {
    expect(browserOf(CHROME)).toBe("chromium");
    expect(browserOf(FIREFOX)).toBe("firefox");
    expect(browserOf(SAFARI)).toBe("safari");
    // Edge, and Chrome on Android: Chrome's engine.
    expect(browserOf("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36 Edg/142.0.0.0")).toBe("chromium");
    expect(browserOf("Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Mobile Safari/537.36")).toBe("chromium");
    // Every browser on an iPhone is Safari's engine under another name.
    expect(browserOf("Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/142.0.7444.77 Mobile/15E148 Safari/604.1")).toBe("safari");
    expect(browserOf("Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/144.0 Mobile/15E148 Safari/605.1.15")).toBe("safari");
    expect(browserOf("Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1")).toBe("safari");
    for (const odd of ["", "curl/8.11.0", undefined, null, 3]) expect(browserOf(odd)).toBe("other");
  });
});

describe("folding alike reports together", () => {
  it("gives each distinct report once, with how many it stands for", () => {
    const kept = trim([modern(), modern(), modern({ effectiveDirective: "img-src" }), modern()], from());
    expect(group(kept).map((entry) => [entry.directive, entry.n])).toEqual([
      ["connect-src", 3],
      ["img-src", 1],
    ]);
    expect(group([])).toEqual([]);
  });
});
