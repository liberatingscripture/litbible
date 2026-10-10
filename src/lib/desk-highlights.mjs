// src/lib/desk-highlights.mjs
//
// How a reader's highlights meet one another (STUDY-DESK-FORMAT.md,
// "Highlights that meet"), kept apart from the page so Node can test it. Pure:
// chapter text and records in, a write plan out. src/scripts/desk/highlights.js
// draws the marks, src/scripts/desk/actions.js asks for a plan when the reader
// highlights or removes a highlight, and the store commits it
// (store.commit, which checks it with planWrite in desk-store-core.mjs).
//
// The rule, restated on the chapter's anchor text:
//   - Same colour: two highlights whose ranges overlap, or are separated only
//     by whitespace, become one. They stay apart across a paragraph or a line
//     of poetry, which the caller reports through `blockAt`.
//   - A different colour: the new mark trims the old one where they overlap,
//     cutting it in two when the new mark sits in the middle of it, and
//     deleting it when the new mark covers it. A remainder loses any stray
//     space at its edges.
//   - A highlight that carries an unread change notice (changeNotice in
//     desk-change.mjs: its words changed, it fell back to whole verses, or its
//     verses are gone) is never touched, even when it lies under the new
//     mark, since its old words are what the notice quotes. Nor is one this
//     client can't rewrite (a newer schema, or made on text newer than this
//     page's). A highlight whose quote failed to match only because of
//     typography (curled quotes, an en dash) carries no notice, and so is
//     still editable.
//
// The rule applies only when THIS reader makes a highlight here, never to
// records arriving from elsewhere, so two devices can't rewrite each other's
// marks. That is why it lives in planHighlight, called from the reader's
// action, and not in placeHighlights, which only reads.
//
// Every record this writes is made on today's text, so its quote, verses and
// verse copy are taken afresh from the chapter, and an edited record's
// `contentVersion` moves to today's (mayRewriteAnchor has already said this
// client may). A highlight that is merely read, or left alone, keeps `modified`
// where it was (principle 4).

import { changeNotice } from "./desk-change.mjs";
import {
  COLORS,
  canEdit,
  createRecord,
  editRecord,
  mayRewriteAnchor,
  placeRecord,
  quoteFields,
  trashRecord,
  verseCopyFor,
} from "./desk-records.mjs";

/** The colours' names for screen readers and lists; capitalize at the call site. */
export const COLOR_WORDS = Object.freeze({
  yellow: "yellow",
  green: "green",
  blue: "blue",
  pink: "pink",
});

/* ── Reading ─────────────────────────────────────────────────────────── */

/**
 * Where each of these records' highlights sits in today's text. Only
 * highlights are placed; one whose verses are gone ("lost") is left out.
 * `editable` says whether a new mark may change this one: it carries no change
 * notice (a placement whose words really changed, or that fell back to whole
 * verses, has one the reader hasn't read; one that differs from its quote only
 * in typography has none), and this client may rewrite it.
 *
 * @returns {{record: object, start: number, end: number, status: string, editable: boolean}[]}
 */
export function placeHighlights(chapter, records, currentVersion) {
  const out = [];
  for (const record of records ?? []) {
    if (record?.kind !== "highlight") continue;
    const { status, start, end } = placeRecord(chapter, record);
    if (start == null) continue;
    const editable =
      changeNotice(chapter, record, currentVersion) === null &&
      status !== "lost" &&
      canEdit(record) &&
      mayRewriteAnchor(record, currentVersion);
    out.push({ record, start, end, status, editable });
  }
  return out;
}

const overlaps = (a, b) => a.start < b.end && b.start < a.end;

/** The editable entries of `placed` that overlap chapter text [start, end). */
export function overlappingHighlights(placed, start, end) {
  const range = { start, end };
  return (placed ?? []).filter((p) => p.editable && overlaps(p, range));
}

/* ── Planning ────────────────────────────────────────────────────────── */

function emptyPlan() {
  return {
    put: [],
    remove: [],
    created: null,
    summary: { merged: 0, trimmed: 0, removed: 0, split: 0, otherColors: 0 },
    undo: { put: [], remove: [] },
  };
}

/** [a, b) with the spaces at either edge taken off (anchor text has only plain spaces). */
function trimmed(text, a, b) {
  while (a < b && text[a] === " ") a++;
  while (b > a && text[b - 1] === " ") b--;
  return [a, b];
}

const byPosition = (a, b) =>
  a.start - b.start || a.end - b.end || (String(a.record.id) < String(b.record.id) ? -1 : 1);

/** Whether `a` was made before `b`; the smaller id settles an exact tie. */
function older(a, b) {
  const ta = Date.parse(a.record.created);
  const tb = Date.parse(b.record.created);
  if (ta !== tb && !Number.isNaN(ta) && !Number.isNaN(tb)) return ta < tb;
  return String(a.record.id) < String(b.record.id);
}

/**
 * Plan a new highlight, or the removal of highlighting, on chapter text
 * [start, end).
 *
 * `color` is one of COLORS, or null to erase highlighting from the range (the
 * same cut a new colour makes, with nothing put in its place). `blockAt(pos)`
 * says which paragraph or line of poetry the character at `pos` sits in, as
 * any value compared with ===; null or undefined means unknown and counts as
 * the same block, so a page that can't tell merges as the text alone allows.
 *
 * The plan is { put, remove } for store.commit (trash records are in `put`),
 * with `created` (the record that now holds the mark: the new one, or the
 * survivor of a merge; null when nothing was written or the range was erased),
 * `summary` and `undo`, the plan that puts everything back. The counts:
 *   merged       same-colour highlights this joined (the survivor counts, so
 *                widening one highlight is 1)
 *   trimmed      highlights cut shorter, at one end
 *   removed      highlights deleted because the mark covered them
 *   split        highlights cut in two by a mark in their middle
 *   otherColors  trimmed + removed + split: highlights of another colour that
 *                this changed (for an erase, any colour)
 * Undoing is the reader acting, so the originals come back with `modified`
 * moved to `now`; a caller that undoes later should stamp the time it undoes.
 * The plan is empty when nothing would change (the text is already
 * highlighted in that colour), so `modified` moves only when the reader changes
 * something.
 *
 * @param {object} args
 * @param {{ verses: Map, spans: Map, text: string }} args.chapter anchor-core's chapter
 * @param {ReturnType<typeof placeHighlights>} args.placed
 * @param {number} args.start
 * @param {number} args.end
 * @param {string|null} args.color
 * @param {(pos: number) => unknown} [args.blockAt]
 * @param {{ bookKey: string, chapter: number }} args.where
 * @param {string} [args.now] an ISO time; the clock when left out
 * @param {{ client: string, contentVersion: string }} args.ctx
 */
export function planHighlight({ chapter, placed = [], start, end, color, blockAt, where, now = new Date().toISOString(), ctx = {} }) {
  if (color !== null && !COLORS.includes(color)) {
    throw new Error(`desk-highlights: "${color}" is not a highlight colour`);
  }
  if (!Number.isInteger(start) || !Number.isInteger(end)) {
    throw new Error("desk-highlights: the mark needs a start and an end");
  }
  const text = chapter.text;
  const [s, e] = trimmed(text, Math.max(0, start), Math.min(text.length, end));
  if (e <= s) return emptyPlan();
  const mark = { start: s, end: e };

  const put = [];
  const remove = [];
  const undo = { put: [], remove: [] };
  const summary = { merged: 0, trimmed: 0, removed: 0, split: 0, otherColors: 0 };
  let created = null;

  const stamp = { now, client: ctx.client };
  const made = { now, client: ctx.client, contentVersion: ctx.contentVersion };
  const back = (record) => ({ ...record, modified: now, ...(ctx.client ? { client: ctx.client } : {}) });

  /** What a record keeps for text [a, b): its verses, quote and verse copy, all from today's text. */
  const fieldsFor = (a, b) => {
    const q = quoteFields(chapter, a, b);
    return { ...q, verseCopy: verseCopyFor(chapter, q.verse, q.endVerse), verseCopyAsOf: now };
  };
  const rewrite = (p, a, b) => editRecord(p.record, { ...fieldsFor(a, b), contentVersion: ctx.contentVersion }, stamp);
  const fresh = (a, b, tint, labels) =>
    createRecord("highlight", { ...where, ...fieldsFor(a, b), color: tint, ...(labels ? { labels: [...labels] } : {}) }, made);
  /** Delete a highlight: its trash record goes in, it comes out, and an undo reverses both. */
  const discard = (p) => {
    const trash = trashRecord(p.record, made);
    put.push(trash);
    remove.push(p.record.id);
    undo.put.push(back(p.record));
    undo.remove.push(trash.id);
  };

  const live = placed.filter((p) => p.editable).sort(byPosition);

  // A different colour trims what it lies over; an erase trims every colour.
  for (const p of live.filter((x) => x.record.color !== color && overlaps(x, mark))) {
    const left = p.start < s ? trimmed(text, p.start, s) : null;
    const right = p.end > e ? trimmed(text, e, p.end) : null;
    const [first, second] = [left, right].filter((r) => r && r[1] > r[0]);
    if (!first) {
      discard(p);
      summary.removed++;
    } else {
      put.push(rewrite(p, ...first));
      undo.put.push(back(p.record));
      if (second) {
        const piece = fresh(...second, p.record.color, p.record.labels);
        put.push(piece);
        undo.remove.push(piece.id);
        summary.split++;
      } else {
        summary.trimmed++;
      }
    }
    summary.otherColors++;
  }

  if (color) {
    // The same colour: take in everything that overlaps or touches the mark,
    // and everything that touches what that took in, until nothing is left.
    const touches = (left, right) =>
      /^\s*$/.test(text.slice(left.end, right.start)) &&
      sameBlock(blockAt?.(left.end - 1), blockAt?.(right.start));
    const joins = (p, u) => overlaps(p, u) || (p.end <= u.start ? touches(p, u) : touches(u, p));

    const pool = live.filter((p) => p.record.color === color);
    const absorbed = [];
    let union = mark;
    for (let i = pool.findIndex((p) => joins(p, union)); i !== -1; i = pool.findIndex((p) => joins(p, union))) {
      const [p] = pool.splice(i, 1);
      absorbed.push(p);
      union = { start: Math.min(union.start, p.start), end: Math.max(union.end, p.end) };
    }

    if (!absorbed.length) {
      created = fresh(union.start, union.end, color);
      put.push(created);
      undo.remove.push(created.id);
    } else {
      const survivor = absorbed.reduce((a, b) => (older(b, a) ? b : a));
      created = survivor.record;
      // A survivor that already covers the whole mark is left exactly as it is.
      if (union.start !== survivor.start || union.end !== survivor.end) {
        created = rewrite(survivor, union.start, union.end);
        put.push(created);
        undo.put.push(back(survivor.record));
      }
      for (const p of absorbed) if (p !== survivor) discard(p);
      summary.merged = absorbed.length;
    }
  }

  if (!put.length && !remove.length) return emptyPlan();
  return { put, remove, created, summary, undo };
}

/** Unknown on either side counts as the same block. */
function sameBlock(a, b) {
  return a == null || b == null || a === b;
}
