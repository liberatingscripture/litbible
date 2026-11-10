// src/lib/sheet-viewer-floor.mjs
//
// The floor of a shared sheet's phone viewer, asked by sheet-share-gate.js
// before it imports the viewer. Shared code: no desk imports.

/**
 * Whether this browser can run the viewer: Safari 16.4 (iOS 16.4) is its floor
 * (BVJ, 2026-11-10, Audit 8 LG8-9), the first with a regular expression
 * lookbehind, which the reference linker uses, and with CompressionStream,
 * which unpacks the link. Below it the viewer's code fails to parse, so this is
 * asked first, and the reader is told the browser is too old rather than to
 * check a connection that is fine.
 */
export function viewerSupported(env = globalThis) {
  if (typeof env.DecompressionStream !== "function") return false;
  try {
    new RegExp("(?<!a)b");
    return true;
  } catch (_) {
    return false;
  }
}
