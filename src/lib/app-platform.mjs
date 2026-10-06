// src/lib/app-platform.mjs
//
// Whether this device is one the LIT apps serve: iOS, iPadOS or Android,
// told apart by the OS rather than the screen width. The one copy of the
// test, read by "Make an image" and the app announcement (both through
// announcement-gate.js, which re-exports it) and by the Study Desk's gate,
// which keeps the desk to computers (STUDY-DESK.md, ground rule 1).
//
// Layout.astro's pre-paint script can't import, so it is handed
// APP_PLATFORM_UA.source through define:vars and repeats the two lines
// below. Change both together.

export const APP_PLATFORM_UA = /iPhone|iPad|iPod|Android/i;

/**
 * iOS, iPadOS or Android. iPadOS Safari reports a Mac, so a Mac with a touch
 * screen counts as one.
 */
export function isAppPlatform(nav = navigator) {
  const ua = nav.userAgent || "";
  return APP_PLATFORM_UA.test(ua) || (/Macintosh/.test(ua) && nav.maxTouchPoints > 1);
}
