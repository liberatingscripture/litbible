// src/scripts/announcement-gate.js
//
// When the site's announcement popover may open. Layout.astro renders one
// announcement at a time (AppsLaunchPopover today; WelcomePopover is a
// retired one kept for reuse), and every one of them inherits these rules,
// whatever it is about:
//
//   - never on a session's first pageview (lit_pv). A modal on a
//     search-landing page is what Google's intrusive-interstitial penalty
//     targets (FIXLIST O3)
//   - never on a link shared into scripture: a verse (#v16), a range
//     (#v16-17), part of a verse (#john-8-p9), a Reading View verse
//     (#john-3-v16)
//   - never on /apps or /privacy, which people open to act on or to read
//     terms, not to be pitched to
//   - never over scripture: a Study View chapter or intro, or Reading View.
//     A reader who chose a passage came to read it (audit F5). An
//     announcement can opt out with { overScripture: true }
//
// What is particular to one announcement (the app popover's shared dismissal
// with the Android banner, say) is passed in as `skip`, so nothing about one
// announcement is written into the slot itself.

const SUPPRESSED_PATHS = /^\/(apps|privacy)\/?$/;
const VERSE_LINK = /^#(?:v\d+(?:-\d+)?|[0-9a-z]+-\d+-[pv]\d+)$/;
const SCRIPTURE_SURFACES = ".scripture-layout--scripture, .scripture-layout--intro, .rm-page";

/** Counts this pageview and returns the session's total so far. */
export function countPageview() {
  try {
    const n = (parseInt(sessionStorage.getItem("lit_pv") || "0", 10) || 0) + 1;
    sessionStorage.setItem("lit_pv", String(n));
    return n;
  } catch (_) {
    return 1; // storage unavailable: treat it as a first pageview
  }
}

export function hasCookie(name) {
  return document.cookie.split("; ").some((c) => c.startsWith(name + "="));
}

export const isVerseDeepLink = (hash = location.hash) => VERSE_LINK.test(hash);
export const isOverScripture = (root = document) => !!root.querySelector(SCRIPTURE_SURFACES);

/**
 * iOS, iPadOS or Android, by the device's OS rather than the screen width.
 * iPadOS Safari reports a Mac, so a Mac with a touch screen counts as one.
 */
export function isAppPlatform(nav = navigator) {
  const ua = nav.userAgent || "";
  return /iPhone|iPad|iPod|Android/i.test(ua) || (/Macintosh/.test(ua) && nav.maxTouchPoints > 1);
}

/**
 * Whether the announcement may open on this pageview. Counts the pageview
 * either way, so call it once per page.
 *
 * @param {object} options
 * @param {string} options.cookie  the announcement's own dismissal cookie
 * @param {boolean} [options.overScripture]  allow it over scripture
 * @param {() => boolean} [options.skip]  the announcement's own rules
 */
export function shouldAnnounce({ cookie, overScripture = false, skip = null } = {}) {
  const pageviews = countPageview();
  if (cookie && hasCookie(cookie)) return false;
  if (pageviews < 2) return false;
  if (isVerseDeepLink()) return false;
  if (SUPPRESSED_PATHS.test(location.pathname)) return false;
  if (!overScripture && isOverScripture()) return false;
  if (skip && skip()) return false;
  return true;
}
