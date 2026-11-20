// src/lib/desk-collection-nest.mjs
//
// Bible order's nesting (STUDY-DESK.md, D13; BVJ, 2026-11-20, E193): a record
// whose verses lie wholly inside a passage the collection holds is drawn on
// that passage's sheet, indented under it, rather than on a sheet of its own.
// Pure: the rows `collectionRows` gives in Bible order go in, and the same
// rows come out, with a host passage's nested rows as its `children` and gone
// from the top level. collection-view.js draws them.
//
// The rule (BVJ asked for one to be picked and written down):
//   - A host is a passage not wholly inside another passage of the
//     collection. Nesting is one level deep: whatever lies inside a host, a
//     smaller passage included (Luke 1:54 inside Luke 1:46–55), goes under
//     it, and a record inside that smaller passage goes under the host too,
//     beside it, in Bible order.
//   - A row goes under the first host, in Bible order, that holds all of its
//     verses (the same book and chapter, its first and last verse within the
//     host's). Two passages that only partly overlap are both hosts, and a
//     row inside both goes under the one that starts first.
//   - A row that only partly overlaps a host stands on its own sheet. Sheets,
//     and rows on no verse (a note on an article), never nest.
//   - Two passages on the same verses aren't added, but one may arrive from
//     elsewhere: the first is the host, and the second goes under it.
//   - Bible order only. My order is the reader's own, and By type groups by
//     kind, so neither nests.

const isWhole = (n) => Number.isInteger(n);

/** The verses a row covers, or null for a row on no verse (a group, a heading, a sheet). */
function spanOf(row) {
  const x = row?.type === "passage" ? row.member : row?.type === "record" && row.record?.kind !== "sheet" ? row.record : null;
  if (!x || typeof x.bookKey !== "string" || !isWhole(x.chapter) || !isWhole(x.verse)) return null;
  const to = isWhole(x.endVerse) && x.endVerse >= x.verse ? x.endVerse : x.verse;
  return { book: x.bookKey, chapter: x.chapter, from: x.verse, to };
}

/** Whether `outer` holds every verse of `inner`. */
const holds = (outer, inner) =>
  outer.book === inner.book && outer.chapter === inner.chapter && outer.from <= inner.from && inner.to <= outer.to;

const width = (s) => s.to - s.from;

/**
 * Bible order's rows with each host passage's nested rows as its `children`
 * (a new row object; the others are the very rows given).
 *
 * @param {object[]} rows rows from `collectionRows` in Bible order
 * @returns {object[]}
 */
export function nestRows(rows) {
  const list = Array.isArray(rows) ? rows : [];
  const spans = new Map();
  for (const row of list) {
    const s = spanOf(row);
    if (s) spans.set(row, s);
  }
  const passages = list.filter((r) => r.type === "passage" && spans.has(r));
  // A passage inside a wider one, or inside an earlier one on the same verses, isn't a host.
  const hosts = passages.filter((p, i) => {
    const s = spans.get(p);
    return !passages.some((q, j) => {
      if (q === p) return false;
      const t = spans.get(q);
      return holds(t, s) && (width(t) > width(s) || j < i);
    });
  });
  const hostSet = new Set(hosts);
  const parent = new Map();
  for (const row of list) {
    const s = spans.get(row);
    if (!s || hostSet.has(row)) continue;
    const host = hosts.find((h) => holds(spans.get(h), s));
    if (host) parent.set(row, host);
  }
  if (!parent.size) return list;
  const children = new Map(hosts.map((h) => [h, []]));
  for (const row of list) if (parent.has(row)) children.get(parent.get(row)).push(row);
  return list
    .filter((row) => !parent.has(row))
    .map((row) => (children.get(row)?.length ? { ...row, children: children.get(row) } : row));
}
