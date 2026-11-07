// src/lib/desk-bookmark-change.mjs
//
// What changing a bookmark's name, its verse and its "Move as I read" switch
// decide, as a plan over the records the notebook holds *now*
// (STUDY-DESK-AUDIT-1.md BA102, kept through STUDY-DESK-FIXES.md E9 and E46).
// The function takes the `{ get, all }` that `store.change` hands its builder,
// so the read and the write are one transaction: a bookmark another tab (or a
// /desk pane) deleted meanwhile is reported as gone and nothing is written,
// instead of the reader's stale copy coming back beside its own trash record,
// and the six-bookmark limit on the ones that move, and the one-of-each-kind
// rule on the verse it goes to, are checked against what the notebook holds at
// the write, not what the form saw when it opened.
//
// Pure: no DOM, no store of its own. It resolves to `{ plan, problem, record,
// moved }`: `plan` is what to write (null for nothing), `problem` a plain
// sentence for the reader when the change was refused, `record` the bookmark as
// it will be (or, when nothing needed writing, as it is), and `moved` whether
// its verse changes.

import { BOOKS, bookKeyToLabel } from "../data/books.js";
import { verseCount } from "../data/verse-counts.js";
import { canEdit, editRecord } from "./desk-records.mjs";
import { canFollowMore, cleanBookmarkName, MAX_FOLLOWING } from "./desk-bookmarks.mjs";
import { bookmarksOn, followChoices, planSave } from "./desk-store-core.mjs";
import { numberWord } from "./desk-wording.mjs";

/** Said when the bookmark being changed is no longer in the notebook. */
export const BOOKMARK_GONE = "That bookmark has been deleted.";

/** Said when the notebook filled up with bookmarks that move while one was being edited. */
export const FOLLOW_LIMIT_REACHED = `${numberWord(MAX_FOLLOWING, { capital: true })} of your bookmarks already move as you read. Turn that off on one of them first.`;

/** Said when a newer version of the Study Desk wrote the bookmark. */
export const BOOKMARK_NEWER = "That bookmark was made by a newer version and can’t be changed here.";

/** Said when the verse already holds a bookmark that moves, or one that stays put, and the change would make two. */
export const KIND_TAKEN_MOVES = "This verse already has a bookmark that moves as you read.";
export const KIND_TAKEN_STAYS = "This verse already has a bookmark that stays put.";

/** Said when the verse typed for a bookmark isn't one. */
export const NOT_A_VERSE = "That isn’t a verse in the New Testament. Try John 3:16.";

const refused = (problem) => ({ plan: null, problem, record: null, moved: false });

/** "John 3:16": a bookmark's verse as the form and its lines name it. */
export function placeLabel(place) {
  return `${bookKeyToLabel(place.bookKey)} ${place.chapter}:${place.verse}`;
}

/** Said when the verse a bookmark is moved to already holds one of its kind. */
export function kindTakenAt(place, follow) {
  return `${placeLabel(place)} already has a bookmark that ${follow ? "moves as you read" : "stays put"}.`;
}

/**
 * The verse a bookmark goes to (E46), from a reference as the Go to passage
 * field reads one (`parseReference` in search-core.js: "John 3:16", "jn 3.16",
 * "Rom 8"), as `{ place, problem }`. A bookmark is one verse, so a range keeps
 * its first, and a chapter alone is its verse 1, as a chapter opened at its
 * top is for a bookmark that follows (`positionOnPage`). A verse past the
 * chapter's last is refused, saying how many it has.
 *
 * @param {{ bookKey: string, chapter: number, verse?: number | null } | null} ref
 * @returns {{ place: { bookKey: string, chapter: number, verse: number, endVerse: number } | null, problem: string | null }}
 */
export function bookmarkPlace(ref) {
  const bookKey = ref?.bookKey;
  if (typeof bookKey !== "string" || !Object.hasOwn(BOOKS, bookKey)) return { place: null, problem: NOT_A_VERSE };
  const book = bookKeyToLabel(bookKey);
  const chapter = ref.chapter;
  if (!Number.isInteger(chapter) || chapter < 1 || chapter > BOOKS[bookKey]) {
    const n = BOOKS[bookKey];
    return { place: null, problem: `${book} has ${n} chapter${n === 1 ? "" : "s"}.` };
  }
  const verse = ref.verse ?? 1;
  const last = verseCount(bookKey, chapter);
  if (!Number.isInteger(verse) || verse < 1 || verse > last) {
    return { place: null, problem: `${book} ${chapter} has ${last} verses.` };
  }
  return { place: { bookKey, chapter, verse, endVerse: verse }, problem: null };
}

const samePlace = (a, b) => a.bookKey === b.bookKey && a.chapter === b.chapter && a.verse === b.verse;

/**
 * Which values of "Move as I read" `record` may take on the verse `place`: the
 * kind that verse doesn't already hold. On its own verse that is
 * `followChoices` (its own value is always allowed, so a bookmark that is
 * already a second of its kind can still be edited); on another, only what
 * the verse lacks. `except` is the bookmark this tab is following, which only
 * rests where it is.
 *
 * @returns {{ moves: boolean, stays: boolean }}
 */
export function roomAt(records, record, place = record, { except = null } = {}) {
  if (samePlace(record, place)) return followChoices(records, record, { except });
  const others = bookmarksOn(records, place, { except }).filter((r) => r.id !== record.id);
  return {
    moves: !others.some((r) => r.follow === true),
    stays: !others.some((r) => r.follow !== true),
  };
}

/**
 * Change a bookmark's name, its verse and whether it moves as the reader reads.
 * `change` is `{ name?, follow?, place? }`; a field left out stays as it is.
 * `place` is a reference as `bookmarkPlace` takes one (null for one that
 * didn't read as a verse), and is sent only when the reader changed the verse,
 * so a move the follower made while the form was open is kept otherwise.
 * Refused when the bookmark is gone, when it would be the seventh to move, or
 * when the verse it would be on already holds a bookmark of its kind. A name
 * that comes out empty removes the bookmark's `label`; `follow: false` removes
 * `follow`, so a plain bookmark is the record it always was. A new verse is
 * written as a new bookmark's is (`verse` and `endVerse` the one verse, and
 * `contentVersion` the text it is on now, from `stamp`). The same values over
 * themselves write nothing.
 *
 * @param {{ now?: string, client?: string, contentVersion?: string }} stamp
 * @param {{ except?: string | null }} [options] `except`: the bookmark this tab follows
 */
export async function planBookmarkEdit({ get, all }, id, change, stamp, { except = null } = {}) {
  const current = await get(id);
  if (!current || current.kind !== "bookmark") return refused(BOOKMARK_GONE);
  if (!canEdit(current)) return refused(BOOKMARK_NEWER);

  const fields = {};
  if (change.name !== undefined) {
    const name = cleanBookmarkName(change.name);
    if (name !== (current.label ?? "")) fields.label = name || undefined;
  }
  // The verse (E46): the record's anchor is rebuilt for the new verse.
  let place = null;
  if (change.place !== undefined) {
    const read = bookmarkPlace(change.place);
    if (read.problem) return refused(read.problem);
    if (!samePlace(current, read.place) || (current.endVerse ?? current.verse) !== read.place.verse) place = read.place;
  }
  const follow = change.follow === undefined ? current.follow === true : change.follow === true;
  const turned = follow !== (current.follow === true);
  if (turned || place) {
    const records = await all();
    if (turned && follow && !canFollowMore(records, id)) return refused(FOLLOW_LIMIT_REACHED);
    // A verse holds one bookmark of each kind (BVJ, 2026-11-04), the verse it
    // goes to included.
    const room = roomAt(records, { ...current, follow }, place ?? current, { except });
    if (!(follow ? room.moves : room.stays)) {
      if (place && !samePlace(current, place)) return refused(kindTakenAt(place, follow));
      return refused(follow ? KIND_TAKEN_MOVES : KIND_TAKEN_STAYS);
    }
    if (turned) fields.follow = follow ? true : undefined;
    if (place) {
      Object.assign(fields, place);
      if (stamp?.contentVersion) fields.contentVersion = stamp.contentVersion;
    }
  }
  if (!Object.keys(fields).length) return { plan: null, problem: null, record: current, moved: false };
  const record = withoutUndefined(editRecord(current, fields, stamp));
  return { plan: planSave(record), problem: null, record, moved: Boolean(place) };
}

/** A record without the fields an edit set to `undefined`, which are the fields it removes. */
function withoutUndefined(record) {
  return Object.fromEntries(Object.entries(record).filter(([, v]) => v !== undefined));
}
