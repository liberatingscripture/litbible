// src/lib/app-platform.mjs
//
// Whether this device is one the LIT apps serve: iOS, iPadOS or Android,
// told apart by the OS rather than the screen width. The one copy of the
// test, read by "Make an image" and the app announcement (both through
// announcement-gate.js, which re-exports it) and by the Study Desk's gate,
// which keeps the desk to computers (STUDY-DESK.md, ground rule 1).
//
// Layout.astro's pre-paint script can't import, so it is handed
// APP_PLATFORM_UA.source through define:vars and repeats the test below.
// Change both together.

export const APP_PLATFORM_UA = /iPhone|iPad|iPod|Android/i;

/**
 * iOS, iPadOS or Android. Two kinds of tablet pass for a computer in their
 * user agent, so a touch screen decides them: iPadOS Safari reports a Mac,
 * and Chrome and Firefox on an Android tablet in desktop site mode report
 * Linux with no "Android" (BA26). So a Mac or a Linux machine with a touch
 * screen counts as one, except a Chromebook ("CrOS"), which is a computer.
 * A browser that says it is mobile (`userAgentData.mobile`) counts too.
 */
export function isAppPlatform(nav = navigator) {
  const ua = nav.userAgent || "";
  if (APP_PLATFORM_UA.test(ua) || nav.userAgentData?.mobile === true) return true;
  return nav.maxTouchPoints > 1 && (/Macintosh/.test(ua) || (/Linux/.test(ua) && !/CrOS/.test(ua)));
}
