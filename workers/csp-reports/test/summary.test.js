// The page a week of counts is read as (src/summary.js): grouped by rule and
// by what was blocked, extensions apart from the site's own.
import { describe, expect, it } from "vitest";
import { NOT_THE_SITES, daysBetween, summarize, tally } from "../src/summary.js";

const row = (fields = {}) => ({ day: "2026-11-25", disposition: "report", directive: "connect-src", blocked: "https://api.stripe.com", page: "/support/", source: "https://secure.givelively.org", browser: "chromium", n: 1, ...fields });
const week = { from: "2026-11-25", to: "2026-12-01", cap: 5000, perPost: 20 };
const dayRows = (rows) => {
  const totals = new Map();
  for (const r of rows) totals.set(r.day, (totals.get(r.day) ?? 0) + r.n);
  return [...totals].map(([day, n]) => ({ day, n }));
};
const page = (rows, options = week, days = dayRows(rows)) => summarize(rows, days, options);

describe("folding the counts", () => {
  it("groups by rule and by what was blocked, most reports first, with pages, askers, browsers, and days", () => {
    const groups = tally([
      row({ n: 30 }),
      row({ n: 11, browser: "safari", day: "2026-11-26" }),
      row({ n: 2, page: "/support/thanks/" }),
      row({ n: 50, directive: "frame-src", blocked: "https://js.stripe.com" }),
    ]);
    expect(groups.map((g) => [g.directive, g.blocked, g.n])).toEqual([
      ["frame-src", "https://js.stripe.com", 50],
      ["connect-src", "https://api.stripe.com", 43],
    ]);
    const [, connect] = groups;
    expect([...connect.pages]).toEqual([["/support/", 41], ["/support/thanks/", 2]]);
    expect([...connect.browsers]).toEqual([["chromium", 32], ["safari", 11]]);
    expect([...connect.sources]).toEqual([["https://secure.givelively.org", 43]]);
    expect([...connect.days]).toEqual(["2026-11-25", "2026-11-26"]);
  });

  it("keeps a blocked report and a flagged one apart, and an extension's apart from the site's", () => {
    const groups = tally([
      row({ directive: "script-src-elem", blocked: "inline", source: "/john-3/" }),
      row({ directive: "script-src-elem", blocked: "inline", source: "moz-extension" }),
      row({ directive: "script-src-elem", blocked: "inline", source: "/john-3/", disposition: "enforce" }),
    ]);
    expect(groups.map((g) => [g.extension, g.disposition])).toEqual(expect.arrayContaining([[false, "report"], [true, "report"], [false, "enforce"]]));
    expect(groups).toHaveLength(3);
  });

  it("calls it an extension's when what was blocked, or the file that asked, has an extension's scheme", () => {
    for (const scheme of NOT_THE_SITES) {
      expect(tally([row({ blocked: scheme })])[0].extension, scheme).toBe(true);
      expect(tally([row({ source: scheme })])[0].extension, scheme).toBe(true);
    }
    for (const own of ["inline", "eval", "data", "blob", "about", "https://chrome-extension.example.com", "/chrome-extension/", ""]) {
      expect(tally([row({ blocked: own, source: own })])[0].extension, own).toBe(false);
    }
  });
});

describe("the page", () => {
  const rows = [
    row({ n: 39 }),
    row({ n: 2, page: "/support/thanks/", browser: "safari", day: "2026-11-27" }),
    row({ n: 4, directive: "form-action", blocked: "https://forms.example.com", disposition: "enforce", page: "/contact/", source: "" }),
    row({ n: 12, directive: "script-src-elem", blocked: "chrome-extension", page: "/john-3/", source: "" }),
    row({ n: 3, directive: "style-src-elem", blocked: "inline", page: "/read/john/", source: "moz-extension", browser: "firefox", day: "2026-11-30" }),
  ];
  const text = page(rows);

  it("opens with the stretch, the total, and the days that had reports", () => {
    expect(text.split("\n").slice(0, 4)).toEqual([
      "Content security policy reports, 2026-11-25 to 2026-12-01 (7 days)",
      "",
      "60 reports counted, on 3 of the 7 days.",
      "No hour reached the cap of 5,000.",
    ]);
  });

  it("has the site's own gaps first, then what is already blocked, then extensions", () => {
    const one = text.indexOf("1. WOULD BE BLOCKED if the whole policy were enforced today: 41 reports");
    const two = text.indexOf("2. ALREADY BLOCKED by the part of the policy that is enforced: 4 reports");
    const three = text.indexOf("3. BROWSER EXTENSIONS, and the browser's own pages: 15 reports");
    expect(one).toBeGreaterThan(0);
    expect(two).toBeGreaterThan(one);
    expect(three).toBeGreaterThan(two);
    // The Stripe gap is in the first section and the extensions are in the last, nowhere else.
    expect(text.slice(one, two)).toContain("connect-src  https://api.stripe.com");
    expect(text.slice(one, two)).not.toContain("extension");
    expect(text.slice(two, three)).toContain("form-action  https://forms.example.com");
    expect(text.slice(three)).toContain("script-src-elem  chrome-extension");
    expect(text.slice(three)).toContain("style-src-elem  inline");
  });

  it("gives each line its count, its days and pages, who asked, and the browsers", () => {
    const at = text.indexOf("  connect-src  https://api.stripe.com");
    expect(text.slice(at).split("\n").slice(0, 5)).toEqual([
      "  connect-src  https://api.stripe.com",
      "      41 reports on 2 days, 2 pages",
      "      pages     /support/ 39, /support/thanks/ 2",
      "      asked by  https://secure.givelively.org 41",
      "      browsers  chromium 39, safari 2",
    ]);
    expect(text).toContain("      asked by  (not given) 4");
  });

  it("says a section has none, and ends with how to tell an extension from a gap", () => {
    const quiet = page([row({ n: 1 })]);
    expect(quiet).toContain("1 report counted, on 1 of the 7 days.");
    expect(quiet).toContain("      1 report on 1 day, 1 page");
    expect(quiet).toContain("2. ALREADY BLOCKED by the part of the policy that is enforced: none");
    expect(quiet).toContain("3. BROWSER EXTENSIONS, and the browser's own pages: none");
    expect(quiet).toContain("How to read section 1");
  });

  it("names five pages and counts the rest", () => {
    const many = Array.from({ length: 8 }, (_, i) => row({ page: `/page-${i}/`, n: 8 - i }));
    expect(page(many)).toContain("      pages     /page-0/ 8, /page-1/ 7, /page-2/ 6, /page-3/ 5, /page-4/ 4, and 3 more");
  });

  it("gives reports whose browser didn't say blocked or flagged a section of their own, only when there are some", () => {
    const withUnsaid = page([row(), row({ disposition: "unknown", directive: "img-src", blocked: "data" })]);
    expect(withUnsaid).toContain("3. NOT SAID whether blocked or only flagged: 1 report");
    expect(withUnsaid).toContain("4. BROWSER EXTENSIONS, and the browser's own pages: none");
    expect(text).not.toContain("NOT SAID");
  });

  it("names the hours that came within one post of the cap, since those hours' counts are a floor and the rest of the day is not", () => {
    const hours = [{ day: "2026-11-25T03", n: 31 }, { day: "2026-11-25T04", n: 30 }, { day: "2026-11-25T14", n: 50 }, { day: "2026-11-30T23", n: 49 }];
    const capped = page(rows, { ...week, cap: 50 }, hours);
    expect(capped).toContain("REACHED THE HOUR'S CAP of 50 in the UTC hours starting 2026-11-25 03:00, 2026-11-25 14:00, 2026-11-30 23:00: those hours' counts are a floor, not a total. Every other hour counted in full.");
    expect(capped).not.toContain("2026-11-25 04:00");
    expect(capped).not.toContain("No hour reached");
  });

  it("says no hour reached the cap when none did", () => {
    expect(page(rows, week, [{ day: "2026-11-25T03", n: 150 }])).toContain("No hour reached the cap of 5,000.");
  });

  it("holds a row keyed by a bare day (from before the hourly cap) to the old day's cap, not the hour's", () => {
    const text = page(rows, { ...week, cap: 208, dayCap: 5000 }, [{ day: "2026-11-25", n: 4990 }, { day: "2026-11-26", n: 1000 }]);
    expect(text).toContain("REACHED THE DAY'S CAP of 5,000 on 2026-11-25 (before the cap was hourly)");
    expect(text).not.toContain("2026-11-26 ");
    expect(text).not.toContain("HOUR'S CAP");
  });

  it("says what to check when nothing was counted, instead of calling the policy clean", () => {
    const empty = page([]);
    expect(empty).toContain("No reports were counted.");
    expect(empty).toContain("or reports are not arriving");
    expect(empty).not.toContain("WOULD BE BLOCKED");
  });
});

describe("the days of a stretch", () => {
  it("counts both ends, across a month's end", () => {
    expect(daysBetween("2026-11-29", "2026-12-02")).toEqual(["2026-11-29", "2026-11-30", "2026-12-01", "2026-12-02"]);
    expect(daysBetween("2026-11-25", "2026-11-25")).toEqual(["2026-11-25"]);
  });
});
