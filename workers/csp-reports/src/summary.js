// A stretch of the counts, as a page to read (scripts/summary.mjs prints it).
//
// The question it answers is step 4i's: what would break if the policy were
// enforced today? So the counts are grouped by rule and by what was blocked,
// and split three ways:
//
//   would be blocked   flagged under the report-only policy. THE LIST TO WORK
//                      THROUGH: each line is either a gap in the policy's
//                      list or something that shouldn't be on the page.
//   already blocked    refused under the part of the policy that is enforced.
//   extensions         asked for by, or aimed at, a browser extension or the
//                      browser's own pages. Not the site's, and nothing the
//                      site can fix.
//
// Pure: no clock, no file, no network. It runs in Node and in the tests.

/**
 * Schemes that mean a browser extension, or the browser's own pages, asked
 * or was asked. A report with one as what was blocked or as the file that
 * asked is not about the site's own code.
 */
export const NOT_THE_SITES = new Set([
  "chrome-extension",
  "moz-extension",
  "safari-extension",
  "safari-web-extension",
  "ms-browser-extension",
  "webkit-masked-url",
  "extension",
  "chrome",
  "edge",
  "resource",
]);

/** How many pages, files, or browsers a line names before it says "and N more". */
const SHOWN = 5;

const plural = (n, one, many = `${one}s`) => `${n.toLocaleString("en-US")} ${n === 1 ? one : many}`;

const add = (map, key, n) => map.set(key, (map.get(key) ?? 0) + n);

/** A map's entries, most first, then by name: "a 12, b 3, and 4 more". */
function most(map) {
  const entries = [...map].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1));
  const shown = entries.slice(0, SHOWN).map(([name, n]) => `${name} ${n.toLocaleString("en-US")}`);
  if (entries.length > SHOWN) shown.push(`and ${entries.length - SHOWN} more`);
  return shown.join(", ");
}

/** Every day from `from` to `to`, both included, as 2026-11-24. */
export function daysBetween(from, to) {
  const days = [];
  for (let at = Date.parse(`${from}T00:00:00Z`); at <= Date.parse(`${to}T00:00:00Z`); at += 24 * 60 * 60 * 1000) {
    days.push(new Date(at).toISOString().slice(0, 10));
  }
  return days;
}

/**
 * The rows of `counts`, folded by rule and by what was blocked, most reports
 * first. Each group says whether it is an extension's, and holds its pages,
 * the files that asked, the browsers, and the days it was seen on.
 */
export function tally(rows) {
  const groups = new Map();
  for (const row of rows) {
    const extension = NOT_THE_SITES.has(row.blocked) || NOT_THE_SITES.has(row.source);
    const key = JSON.stringify([extension, row.disposition, row.directive, row.blocked]);
    let found = groups.get(key);
    if (!found) {
      found = { extension, disposition: row.disposition, directive: row.directive, blocked: row.blocked, n: 0, pages: new Map(), sources: new Map(), browsers: new Map(), days: new Set() };
      groups.set(key, found);
    }
    found.n += row.n;
    add(found.pages, row.page, row.n);
    add(found.sources, row.source || "(not given)", row.n);
    add(found.browsers, row.browser, row.n);
    found.days.add(row.day);
  }
  return [...groups.values()].sort((a, b) => b.n - a.n || (a.directive + a.blocked < b.directive + b.blocked ? -1 : 1));
}

function lines(group) {
  const what = group.blocked || "(not given)";
  return [
    `  ${group.directive}  ${what}`,
    `      ${plural(group.n, "report")} on ${plural(group.days.size, "day")}, ${plural(group.pages.size, "page")}`,
    `      pages     ${most(group.pages)}`,
    `      asked by  ${most(group.sources)}`,
    `      browsers  ${most(group.browsers)}`,
  ];
}

function section(title, note, groups) {
  const total = groups.reduce((sum, group) => sum + group.n, 0);
  const out = ["", `${title}: ${groups.length ? plural(total, "report") : "none"}`];
  if (groups.length) {
    out.push(`  ${note}`);
    for (const group of groups) out.push("", ...lines(group));
  }
  return out;
}

/**
 * The page. `rows` are the rows of `counts` and `days` the rows of `days`
 * for the stretch `from` to `to` (both days included); `cap` is the most a
 * day counts, and `perPost` the most one post can add, so a day within that
 * of its cap may have turned reports away.
 */
export function summarize(rows, days, { from, to, cap, perPost }) {
  const stretch = daysBetween(from, to);
  const counted = rows.reduce((sum, row) => sum + row.n, 0);
  const withReports = new Set(rows.map((row) => row.day));
  const full = days.filter((day) => day.n > cap - perPost).map((day) => day.day);

  const out = [`Content security policy reports, ${from} to ${to} (${plural(stretch.length, "day")})`, ""];
  if (counted === 0) {
    out.push(
      "No reports were counted.",
      "",
      "Either nothing on the site broke the policy, or reports are not arriving.",
      "To tell which, check that a page's headers name the address",
      "(curl -sI https://litbible.net/ shows Reporting-Endpoints and both policies),",
      "and open a page of the site in a browser with an extension that changes pages.",
    );
    return out.join("\n");
  }

  out.push(`${plural(counted, "report")} counted, on ${withReports.size} of the ${plural(stretch.length, "day")}.`);
  out.push(
    full.length
      ? `REACHED THE DAY'S CAP of ${cap.toLocaleString("en-US")} on ${full.join(", ")}: that day's counts are a floor, not a total.`
      : `No day reached the cap of ${cap.toLocaleString("en-US")}.`,
  );

  const groups = tally(rows);
  const own = groups.filter((group) => !group.extension);
  out.push(
    ...section("1. WOULD BE BLOCKED if the whole policy were enforced today", "The list to work through. Each is a gap in the policy's list, or something that shouldn't be on the page.", own.filter((group) => group.disposition === "report")),
    ...section("2. ALREADY BLOCKED by the part of the policy that is enforced", "These were refused in the reader's browser.", own.filter((group) => group.disposition === "enforce")),
  );
  const unsaid = own.filter((group) => group.disposition === "unknown");
  if (unsaid.length) out.push(...section("3. NOT SAID whether blocked or only flagged", "The browser's report left that out. Read each as section 1 or 2 by its rule.", unsaid));
  out.push(
    ...section(`${unsaid.length ? 4 : 3}. BROWSER EXTENSIONS, and the browser's own pages`, "Not the site's code, and nothing the site can fix. Listed so they can be told apart from the rest.", groups.filter((group) => group.extension)),
  );

  out.push(
    "",
    "How to read section 1: a line there is not proven to be the site's. An extension",
    "that loads a file from its maker's server looks the same as a gap. The signs of",
    "an extension are one browser only, many unrelated pages, and an origin the site",
    "has no business with. A gap in the list shows on the pages that use the thing,",
    "in every browser.",
  );
  return out.join("\n");
}
