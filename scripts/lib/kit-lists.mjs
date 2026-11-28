// scripts/lib/kit-lists.mjs
//
// The kit's levels and their lists, read from and written into
// src/styles/kit.css ("THE KIT'S OTHER NAMES" in its header). Each level's
// rules open with one list, `:is(<kit class>[, <kit class>], :where(<names>))`,
// and every rule of the level carries the same list, so a name is added to or
// taken from all of them at once. Pure: text in, text out. Used by
// scripts/kit-names.mjs (by hand) and test/featherboa-kit.test.js.

/** Each level, by the kit class that opens its lists. */
export const LEVELS = Object.freeze({
  filled: ".kit-btn--filled",
  tinted: ".kit-btn--tinted",
  plain: ".kit-btn--plain",
  danger: ".kit-btn--danger",
  row: ".kit-row",
  "row-on": ".kit-row--on",
  tab: ".kit-tab",
  "tab-on": ".kit-tab--on",
  inline: ".kit-inline",
  field: ".kit-field",
  dot: ".kit-dot",
});

/** Splits a selector list at its top-level commas. */
export function splitList(text) {
  const out = [];
  let depth = 0;
  let quote = "";
  let cur = "";
  for (const ch of text) {
    if (quote) {
      cur += ch;
      if (ch === quote) quote = "";
      continue;
    }
    if (ch === '"' || ch === "'") quote = ch;
    else if (ch === "(" || ch === "[") depth++;
    else if (ch === ")" || ch === "]") depth--;
    if (ch === "," && depth === 0) {
      out.push(cur.trim());
      cur = "";
    } else cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

/** The index of the parenthesis closing the one at `open`. */
function closing(text, open) {
  let depth = 0;
  let quote = "";
  for (let i = open; i < text.length; i++) {
    const ch = text[i];
    if (quote) {
      if (ch === quote) quote = "";
      continue;
    }
    if (ch === '"' || ch === "'") quote = ch;
    else if (ch === "(") depth++;
    else if (ch === ")" && --depth === 0) return i;
  }
  throw new Error(`unclosed parenthesis at ${open}`);
}

/** Comments blanked to spaces, so offsets still line up. */
const blank = (css) => css.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "));

/**
 * Every list of a level: { start, end, items, kit, names }, where start and
 * end bound the text inside `:is(...)`, kit is the kit classes before the
 * :where(), and names the selectors inside it.
 */
export function listsOf(css, level) {
  const anchor = LEVELS[level];
  if (!anchor) throw new Error(`no level "${level}"; the levels: ${Object.keys(LEVELS).join(", ")}`);
  const text = blank(css);
  const out = [];
  let at = 0;
  for (;;) {
    at = text.indexOf(":is(", at);
    if (at < 0) break;
    const open = at + 3;
    const close = closing(text, open);
    const inner = text.slice(open + 1, close);
    const items = splitList(inner);
    if (items[0] === anchor) {
      const last = items[items.length - 1];
      const where = /^:where\(([\s\S]*)\)$/.exec(last);
      out.push({
        start: open + 1,
        end: close,
        items,
        kit: where ? items.slice(0, -1) : items,
        names: where ? splitList(where[1]) : [],
      });
    }
    at = close;
  }
  return out;
}

/** The names a level takes, from its first list. */
export function namesOf(css, level) {
  const lists = listsOf(css, level);
  return lists.length ? lists[0].names : [];
}

/** Every level's names: { level: [names] }. */
export function allNames(css) {
  return Object.fromEntries(Object.keys(LEVELS).map((level) => [level, namesOf(css, level)]));
}

/** The text of a list with these kit classes and names. */
function listText(kit, names) {
  return names.length ? `${kit.join(", ")}, :where(${names.join(", ")})` : kit.join(", ");
}

/** Rewrites every list of a level with `change(names)`'s result. */
function rewrite(css, level, change) {
  const lists = listsOf(css, level);
  if (!lists.length) throw new Error(`kit.css has no list for "${level}"`);
  let out = css;
  // From the end, so earlier offsets stay true.
  for (const list of [...lists].reverse()) {
    out = out.slice(0, list.start) + listText(list.kit, change(list.names)) + out.slice(list.end);
  }
  return out;
}

/** Adds names to a level (each once, at the end). */
export function addNames(css, level, names) {
  for (const n of names) {
    if (!n || /[{};]/.test(n)) throw new Error(`not a selector: ${n}`);
  }
  return rewrite(css, level, (have) => [...have, ...names.filter((n) => !have.includes(n))]);
}

/** Takes names from a level. */
export function removeNames(css, level, names) {
  return rewrite(css, level, (have) => have.filter((n) => !names.includes(n)));
}
