// src/lib/desk-pick.mjs
//
// The rules behind the pick window (src/scripts/desk/pick-window.js;
// STUDY-DESK-FIXES.md, E154): a list of named items, narrowed by a filter box
// as the reader types, and the line that says what the filter left. It knows
// nothing of sheets, so the "All collections…" window D13 plans can use it as
// "All sheets…" does. Pure.

import { fold } from "./desk-notebook.mjs";

/**
 * The items whose name holds every word typed, in any order, ignoring case
 * and accents ("sunday easter" finds "Easter Sunday"), in the order given.
 * An empty filter keeps them all.
 *
 * @template {{ name: string }} T
 * @param {T[]} items
 * @param {string} query
 * @returns {T[]}
 */
export function filterPicks(items, query) {
  const words = fold(query).split(" ").filter(Boolean);
  const list = items ?? [];
  if (!words.length) return [...list];
  return list.filter((item) => {
    const name = fold(item?.name);
    return words.every((w) => name.includes(w));
  });
}

/**
 * The line under the filter box: how many there are, how many the filter
 * left, or that it left none.
 *
 * @param {number} shown how many the filter left
 * @param {number} total how many there are
 * @param {string} query what is in the filter box
 * @param {[string, string]} noun the item's name, one and many: ["sheet", "sheets"]
 */
export function pickCountLine(shown, total, query, [one, many]) {
  const typed = String(query ?? "").replace(/\s+/g, " ").trim();
  const count = (n) => `${n} ${n === 1 ? one : many}`;
  if (!typed) return count(total);
  if (!shown) return `No title matches “${typed}.”`;
  return `${shown} of ${count(total)}`;
}
