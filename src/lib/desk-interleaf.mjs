// src/lib/desk-interleaf.mjs
//
// The interleaf's one rule (STUDY-DESK.md, N7): a band of the reader's notes
// follows each paragraph that has any, and a note belongs to the paragraph its
// first word is in. Pure: no DOM, no storage. The page-side half
// (src/scripts/desk/interleaf.js) works out which block each note starts in
// and draws the bands.

/**
 * Group placed notes into bands. `entries` are { record, block, start }:
 * `block` is the index of the paragraph the note's first word is in, `start`
 * its offset in the chapter's anchor text. Returns [{ block, records }] in
 * page order, each band's notes in the order they are read. An entry with no
 * block (its words aren't on the page) is left out, as the margin leaves it.
 */
export function groupIntoBands(entries) {
  const byBlock = new Map();
  for (const e of entries) {
    if (!Number.isInteger(e?.block) || e.block < 0) continue;
    if (!byBlock.has(e.block)) byBlock.set(e.block, []);
    byBlock.get(e.block).push(e);
  }
  return [...byBlock.keys()]
    .sort((a, b) => a - b)
    .map((block) => ({
      block,
      records: byBlock
        .get(block)
        .sort((a, b) => a.start - b.start || String(a.record.created).localeCompare(String(b.record.created)))
        .map((e) => e.record),
    }));
}

/** What a band is called to a screen reader: "My notes on this paragraph" (one or several). */
export function bandLabel(count) {
  return count === 1 ? "My note on this paragraph" : "My notes on this paragraph";
}
