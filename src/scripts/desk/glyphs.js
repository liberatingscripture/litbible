// src/scripts/desk/glyphs.js
//
// The apps' seven note markers, drawn for the website (STUDY-DESK-FORMAT.md,
// `note.marker`). Each leads its note like a bullet in the margin and the
// Notebook panel, and stands alone in a circle where the margin has no room.
// Always decorative: the marker's name is said in words wherever it matters
// (the editor's choices), so every glyph is aria-hidden.
//
// The coloured markers keep their colour in both themes, as in the apps; the
// plain "note" marker is drawn in the text colour so it reads on either.

const PATHS = {
  note: `<g fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M3 6h13M3 11h10M3 16h6"/><path d="M14.5 20.5l1-3.6 5.4-5.4a1.8 1.8 0 0 1 2.6 2.6l-5.4 5.4z" stroke-linejoin="round"/></g>`,
  emphasis: `<circle cx="12" cy="12" r="11" fill="#D93025"/><path d="M12 6v8" stroke="#fff" stroke-width="2.6" stroke-linecap="round"/><circle cx="12" cy="17.6" r="1.6" fill="#fff"/>`,
  question: `<circle cx="12" cy="12" r="11" fill="#1F5BC6"/><path d="M9.2 9.2a2.9 2.9 0 1 1 4.1 2.6c-.9.5-1.3 1-1.3 2v.6" fill="none" stroke="#fff" stroke-width="2.3" stroke-linecap="round"/><circle cx="12" cy="17.8" r="1.5" fill="#fff"/>`,
  heart: `<path d="M12 21s-8.5-5.3-8.5-11.3A4.7 4.7 0 0 1 12 6.9a4.7 4.7 0 0 1 8.5 2.8C20.5 15.7 12 21 12 21z" fill="#D81B60"/>`,
  bookmark: `<path d="M6 2.5h12a1 1 0 0 1 1 1v18l-7-4.6-7 4.6v-18a1 1 0 0 1 1-1z" fill="#1E7A46"/>`,
  lightbulb: `<path d="M12 2a7 7 0 0 0-4.2 12.6c.8.6 1.2 1.4 1.2 2.4h6c0-1 .4-1.8 1.2-2.4A7 7 0 0 0 12 2z" fill="#7B3FD1"/><rect x="9" y="18.4" width="6" height="2" rx="1" fill="#7B3FD1"/><rect x="10" y="21.2" width="4" height="1.8" rx=".9" fill="#7B3FD1"/>`,
  flame: `<path d="M12 1.8c.6 3.4 5.7 6 5.7 11.4A5.7 5.7 0 0 1 6.3 13.2c0-2.6 1.3-4.3 2.6-5.6.2 1.9 1 3 2.2 3.4-.3-3.5.2-6.4.9-9.2z" fill="#E8590C"/><path d="M12 22.2a3 3 0 0 1-3-3c0-1.8 1.6-2.8 2.2-4.6 1.6 1.3 3.8 2.6 3.8 4.6a3 3 0 0 1-3 3z" fill="#FFD08A"/>`,
};

/** A marker's glyph as SVG markup; an unknown marker gets the plain note's. */
export function glyph(marker, cls = "desk-glyph") {
  const inner = PATHS[marker] ?? PATHS.note;
  return `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${inner}</svg>`;
}
