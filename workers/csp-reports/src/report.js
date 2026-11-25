// What is kept of a report, and nothing more.
//
// A browser sends a report when a page of the site loads, or tries to load,
// something the content security policy doesn't name (public/_headers). Two
// shapes arrive, because browsers have two ways of sending:
//
//   report-uri   one object, { "csp-report": { "blocked-uri": ..., ... } },
//                hyphenated keys. Every browser. The sender's user agent is
//                the request's own header.
//   report-to    an array of { type: "csp-violation", user_agent, url,
//                body: { blockedURL: ..., ... } }, camelCase keys. Chrome and
//                Edge 96, Safari 16.4, Firefox 149. A browser that knows this
//                way ignores the other.
//
// A REPORT IS WHATEVER ITS SENDER SAYS IT IS: anyone can post one. So every
// field kept is either one of a fixed set of words or a short string cut to
// its origin or path, and a report about a page that isn't the site's is
// dropped.
//
// WHAT IS THROWN AWAY, because it is about the reader and not the policy:
//   - the query string and fragment of every address (a search, a shared
//     sheet's link);
//   - everything after the scheme of a browser extension's address. Firefox
//     gives each installation of an extension an id of its own, so that id
//     would mark one reader's browser;
//   - the user agent, once it has been read for its family;
//   - the referrer, the policy's own text, the sample, line and column.
// The address a report comes from is never read here at all.

/** No more than this many reports are read from one post; the rest are ignored. */
export const MAX_REPORTS = 20;

/** The longest path or origin kept. A longer one is cut (a path) or becomes "other" (an origin). */
export const MAX_FIELD = 120;

/** Every directive a policy can name. Anything else is counted as "other". */
export const DIRECTIVES = new Set([
  "default-src",
  "script-src",
  "script-src-elem",
  "script-src-attr",
  "style-src",
  "style-src-elem",
  "style-src-attr",
  "img-src",
  "font-src",
  "connect-src",
  "media-src",
  "object-src",
  "frame-src",
  "child-src",
  "worker-src",
  "manifest-src",
  "prefetch-src",
  "fenced-frame-src",
  "base-uri",
  "form-action",
  "frame-ancestors",
  "sandbox",
  "require-trusted-types-for",
  "trusted-types",
  "upgrade-insecure-requests",
]);

/** A word a browser gives in place of an address ("inline", "eval", "data"), or a bare scheme ("chrome-extension"). */
const WORD = /^[a-z][a-z0-9+.-]{0,39}$/;

const NETWORK = new Set(["http:", "https:", "ws:", "wss:"]);

const text = (value) => (typeof value === "string" ? value : "");

/** The first of `names` that `body` holds as a non-empty string. */
function read(body, ...names) {
  for (const name of names) {
    const value = text(body[name]);
    if (value) return value;
  }
  return "";
}

function parse(value) {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

/** The path of a page of the site, or null when `value` isn't one. */
export function pageOf(value, site) {
  const url = parse(text(value));
  if (!url || url.origin !== site) return null;
  return url.pathname.slice(0, MAX_FIELD);
}

/**
 * Where something came from, or would have, cut to what tells one cause from
 * another: a path for the site's own files, an origin for anyone else's, a
 * scheme for what has no origin (an extension, data:, blob:), and the
 * browser's own word where it gives one. Empty for nothing.
 */
export function placeOf(value, site) {
  const given = text(value).trim();
  if (!given) return "";
  const url = parse(given);
  if (url) {
    if (!NETWORK.has(url.protocol)) return url.protocol.slice(0, -1).slice(0, 40);
    if (url.origin === site) return url.pathname.slice(0, MAX_FIELD);
    return url.origin.length <= MAX_FIELD ? url.origin : "other";
  }
  const word = given.toLowerCase();
  return WORD.test(word) ? word : "other";
}

/** The rule that was broken, as one of DIRECTIVES, or "other". */
export function directiveOf(value) {
  // Older browsers give the whole directive ("script-src 'self' https://..."): its name is the first word.
  const name = text(value).trim().split(/\s+/)[0].toLowerCase();
  return DIRECTIVES.has(name) ? name : "other";
}

/** Whether the browser blocked it ("enforce") or only said so ("report"). MDN gives the second as both "report" and "reporting". */
export function dispositionOf(value) {
  const word = text(value).toLowerCase();
  if (word === "enforce") return "enforce";
  if (word === "report" || word === "reporting") return "report";
  return "unknown";
}

/**
 * The family of browser, by the engine that applies the policy, which is
 * what a difference between browsers comes down to. Every browser on an
 * iPhone or iPad is Safari's engine under another name.
 */
export function browserOf(userAgent) {
  const ua = text(userAgent);
  if (/\b(CriOS|FxiOS|EdgiOS)\//.test(ua)) return "safari";
  if (/\bFirefox\//.test(ua)) return "firefox";
  if (/\b(Chrome|Chromium)\//.test(ua)) return "chromium";
  if (/\b(Safari|AppleWebKit)\//.test(ua)) return "safari";
  return "other";
}

/** What is kept of one report, or null when it isn't a policy report about a page of the site. */
function keep(item, site, userAgent) {
  if (item === null || typeof item !== "object" || Array.isArray(item)) return null;
  let body;
  let ua = userAgent;
  if (item["csp-report"] !== undefined) {
    body = item["csp-report"];
  } else if (item.type === "csp-violation") {
    body = item.body;
    if (typeof item.user_agent === "string") ua = item.user_agent;
  } else {
    return null;
  }
  if (body === null || typeof body !== "object" || Array.isArray(body)) return null;

  const page = pageOf(read(body, "documentURL", "document-uri") || item.url, site);
  if (page === null) return null;
  return {
    disposition: dispositionOf(read(body, "disposition")),
    directive: directiveOf(read(body, "effectiveDirective", "effective-directive", "violated-directive")),
    blocked: placeOf(read(body, "blockedURL", "blocked-uri"), site),
    page,
    source: placeOf(read(body, "sourceFile", "source-file"), site),
    browser: browserOf(ua),
  };
}

/**
 * What is kept of a post's parsed body: one entry for each report that is a
 * policy report about a page of `site`, at most MAX_REPORTS of them read.
 * `userAgent` is the request's header, used where a report carries none.
 */
export function trim(parsed, { site, userAgent }) {
  const items = Array.isArray(parsed) ? parsed : [parsed];
  const kept = [];
  for (const item of items.slice(0, MAX_REPORTS)) {
    const entry = keep(item, site, userAgent);
    if (entry) kept.push(entry);
  }
  return kept;
}

/** The same entries with the alike ones folded together: each with `n`, how many it stands for. */
export function group(entries) {
  const groups = new Map();
  for (const entry of entries) {
    const key = JSON.stringify([entry.disposition, entry.directive, entry.blocked, entry.page, entry.source, entry.browser]);
    const found = groups.get(key);
    if (found) found.n += 1;
    else groups.set(key, { ...entry, n: 1 });
  }
  return [...groups.values()];
}
