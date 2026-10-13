// src/scripts/desk/interleaf-state.js
//
// Whether the interleaf is open (STUDY-DESK.md, N7). Deliberately the whole of
// its memory: a flag for this page view, never stored, so a page always loads
// with the bands closed and nothing on it jumps (audit C13). It lives apart
// from interleaf.js so the switches that open it (note-settings.js, actions.js)
// can read it without importing the drawing code.

/** Sent on `document` whenever the interleaf opens or closes: { open }. */
export const INTERLEAF_EVENT = "desk:interleaf";

let open = false;

export function isInterleafOpen() {
  return open;
}

export function setInterleafOpen(value) {
  const next = Boolean(value);
  if (next === open) return;
  open = next;
  document.dispatchEvent(new CustomEvent(INTERLEAF_EVENT, { detail: { open } }));
}
