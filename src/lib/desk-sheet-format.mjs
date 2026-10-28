// src/lib/desk-sheet-format.mjs
//
// The sheet record (kind 9) as STUDY-DESK-FORMAT.md, "Sheets (kind 9)",
// defines it: the limits, the module types, the check a sheet must pass
// before it is saved (validateSheet), and the sanitizer for the one canonical
// form of formatted text (sanitizeSheetHtml). Pure: no DOM, no storage, no
// clock. Imports only the book list.
//
// The sanitizer is security-relevant. A sheet's `html` is the reader's own
// text, but it also arrives from an imported file, a merge or another device,
// and it is drawn into the page, so everything it returns is BUILT from an
// allowlist rather than filtered from the input: a tree of known elements and
// text, serialized with its own escaping. What is kept: the tags of the
// format's set; a link's `href` (http, https, mailto or a path on this site);
// `data-align` on p, h2 and h3; and on a `span` the four named styles
// (SPAN_STYLES), as names only, never CSS values. Anything unrecognized becomes
// escaped text or disappears. It is also idempotent, sanitize(sanitize(x)) ===
// sanitize(x) for every input, which is what lets validateSheet ask "is this
// html already in the canonical form" and lets a merge compare two copies
// without seeing a change that isn't one.
//
// How it works, in four steps:
//   1. tokenize: tags, comments and text, decoding the entities the format
//      names (script, style and the like are cut out here with their contents);
//   2. parse: a lenient tree (close tags find their opener, nothing throws),
//      dropping the elements that go with their contents;
//   3. normalize: map and unwrap tags, keep only `href`, `data-align` and a
//      span's named styles, fit the nesting rules, collapse whitespace, drop
//      empties, join seams;
//   4. serialize: lowercase tags, `&`, `<` and `>` escaped in text, plus `"`
//      in an attribute.
//
// Nothing here throws on any string; a non-string is "".

import { BOOKS } from "../data/books.js";

/** The version of the sheet section of the format this code writes. */
export const SHEET_FORMAT = 1;

export const MODULE_TYPES = Object.freeze(["passage", "text", "question", "space", "keyTerms", "pageBreak"]);

export const HINTS = Object.freeze(["none", "traditional", "custom"]);

/** Text alignments other than left, which is the default and is no attribute. */
export const ALIGNMENTS = Object.freeze(["center", "right", "justify"]);

/** `bytes` is the sheet as JSON; the text limits count characters (code points). */
export const SHEET_LIMITS = Object.freeze({
  bytes: 524288,
  modules: 300,
  title: 200,
  subtitle: 200,
  hintText: 100,
  questionLines: 20,
  spaceLines: 40,
});

/* ── The sanitizer ───────────────────────────────────────────────────── */

/**
 * The named styles a `span` may carry, by attribute (`data-font`, `data-size`,
 * `data-color`, `data-mark`, written in this order). A sheet stores names, never
 * values, so each theme, print and the Word copy decide what "red" looks like.
 */
export const SPAN_STYLES = Object.freeze({
  font: Object.freeze(["sans", "serif", "display", "handwriting", "atkinson"]),
  size: Object.freeze(["small", "large", "larger"]),
  color: Object.freeze(["red", "blue", "green", "purple", "gray"]),
  mark: Object.freeze(["yellow", "green", "blue", "pink"]),
});
const STYLE_KEYS = Object.keys(SPAN_STYLES);

const ALLOWED = new Set(["p", "h2", "h3", "blockquote", "hr", "ul", "ol", "li", "strong", "em", "u", "s", "sup", "sub", "a", "span", "br"]);
const INLINE = new Set(["strong", "em", "u", "s", "sup", "sub", "a", "span"]);
const RENAMED = { div: "p", tr: "p", b: "strong", i: "em", h1: "h2", h4: "h3", h5: "h3", h6: "h3", strike: "s", del: "s", ins: "u" };
/** Elements read as raw text: found by their closing tag in the source and dropped whole. */
const RAW_TEXT = new Set(["script", "style", "textarea", "title", "iframe", "noscript"]);
/** Other elements dropped with their contents (counted by nesting). */
const DROPPED = new Set(["template", "object", "svg", "math", "head", "select", "button"]);
/** Elements with no contents. Only br and hr are kept. */
const VOID = new Set(["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "param", "source", "track", "wbr", "keygen"]);

/** Open elements deeper than this are not opened, so a hostile document can't overflow the stack. */
const MAX_OPEN = 100;
/** Inline elements nested deeper than this are unwrapped, so the output always re-parses within MAX_OPEN. */
const MAX_INLINE_DEPTH = 40;

const NAMED_ENTITIES = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  mdash: "—",
  ndash: "–",
  hellip: "…",
  lsquo: "‘",
  rsquo: "’",
  ldquo: "“",
  rdquo: "”",
  shy: "­",
};

/** One pass: an entity decodes to the character, never to something that decodes again. */
function decodeEntities(s) {
  if (!s.includes("&")) return s;
  return s.replace(/&(?:#(\d+)|#[xX]([0-9a-fA-F]+)|([a-zA-Z][a-zA-Z0-9]*));/g, (whole, dec, hex, name) => {
    if (name !== undefined) return Object.hasOwn(NAMED_ENTITIES, name) ? NAMED_ENTITIES[name] : whole;
    const code = dec !== undefined ? Number(dec) : parseInt(hex, 16);
    if (!Number.isFinite(code) || code === 0 || code > 0x10ffff || (code >= 0xd800 && code <= 0xdfff)) return "�";
    return String.fromCodePoint(code);
  });
}

const WS_CHAR = /[ \t\r\n\f]/;
const NAME_CHAR = /[a-zA-Z0-9-]/;
const LETTER = /[a-zA-Z]/;

/** What readTag returns for a tag the input ends inside of. */
const UNFINISHED = Symbol("unfinished");

/**
 * A tag starting at `lt` (a "<"): { end, closing, name, attrs }, null when it
 * is not a tag, in which case the "<" is text, or UNFINISHED when the input
 * ends inside it (no closing ">", or a quote that never closes).
 */
function readTag(src, lt) {
  const n = src.length;
  let j = lt + 1;
  let closing = false;
  if (src[j] === "/") {
    closing = true;
    j++;
  }
  if (j >= n || !LETTER.test(src[j])) return null;
  const nameStart = j;
  while (j < n && NAME_CHAR.test(src[j])) j++;
  const name = src.slice(nameStart, j).toLowerCase();
  const attrs = new Map();
  for (;;) {
    while (j < n && (WS_CHAR.test(src[j]) || src[j] === "/")) j++;
    if (j >= n) return UNFINISHED;
    if (src[j] === ">") return { end: j + 1, closing, name, attrs };
    const s = j;
    while (j < n && !WS_CHAR.test(src[j]) && src[j] !== "=" && src[j] !== ">" && src[j] !== "/") j++;
    if (j === s) j++; // a stray "=" starts a name, as a browser reads it
    const attr = src.slice(s, j).toLowerCase();
    while (j < n && WS_CHAR.test(src[j])) j++;
    let value = "";
    if (src[j] === "=") {
      j++;
      while (j < n && WS_CHAR.test(src[j])) j++;
      const q = src[j];
      if (q === '"' || q === "'") {
        const close = src.indexOf(q, j + 1);
        if (close < 0) return UNFINISHED;
        value = src.slice(j + 1, close);
        j = close + 1;
      } else {
        const v = j;
        while (j < n && !WS_CHAR.test(src[j]) && src[j] !== ">") j++;
        value = src.slice(v, j);
      }
    }
    if (!attrs.has(attr)) attrs.set(attr, decodeEntities(value));
  }
}

/** The source as tokens: { t: "text", s }, { t: "open", name, attrs } and { t: "close", name }. */
function tokenize(src) {
  const tokens = [];
  const n = src.length;
  let i = 0;
  const text = (s) => {
    if (s) tokens.push({ t: "text", s: decodeEntities(s) });
  };
  while (i < n) {
    const lt = src.indexOf("<", i);
    if (lt < 0) {
      text(src.slice(i));
      break;
    }
    text(src.slice(i, lt));
    const next = src[lt + 1];
    if (src.startsWith("<!--", lt)) {
      const end = src.indexOf("-->", lt + 4);
      i = end < 0 ? n : end + 3;
      continue;
    }
    if (next === "!" || next === "?") {
      const end = src.indexOf(">", lt + 2);
      i = end < 0 ? n : end + 1;
      continue;
    }
    const tag = readTag(src, lt);
    if (tag === UNFINISHED) {
      // The rest is text. Trying again from the next character made this
      // quadratic, since every later "<" scans to the end as well: 48 KB of
      // "<a " took 21 seconds (BA67).
      text(src.slice(lt));
      break;
    }
    if (!tag) {
      text("<");
      i = lt + 1;
      continue;
    }
    i = tag.end;
    if (tag.closing) {
      tokens.push({ t: "close", name: tag.name });
    } else if (RAW_TEXT.has(tag.name)) {
      const re = new RegExp(`</${tag.name}(?=[\\s/>])`, "gi");
      re.lastIndex = i;
      const m = re.exec(src);
      if (!m) i = n;
      else {
        const gt = src.indexOf(">", m.index);
        i = gt < 0 ? n : gt + 1;
      }
    } else {
      tokens.push({ t: "open", name: tag.name, attrs: tag.attrs });
    }
  }
  return tokens;
}

const textNode = (s) => ({ t: "text", s });
const elNode = (name, kids = [], extra) => ({ t: "el", name, kids, ...extra });
const br = () => elNode("br");

/** The tokens as a tree of { t: "el", name, attrs, kids } (names as written, lowercase) and text. */
function parse(tokens) {
  const root = { t: "el", name: "#root", attrs: new Map(), kids: [] };
  const stack = [root];
  const append = (node) => {
    const kids = stack[stack.length - 1].kids;
    const last = kids[kids.length - 1];
    if (node.t === "text" && last?.t === "text") last.s += node.s;
    else kids.push(node);
  };
  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i];
    if (tok.t === "text") {
      append(textNode(tok.s));
    } else if (tok.t === "open") {
      const { name } = tok;
      if (DROPPED.has(name)) {
        let depth = 1;
        for (i++; i < tokens.length; i++) {
          const u = tokens[i];
          if (u.name !== name) continue;
          if (u.t === "open") depth++;
          else if (u.t === "close" && --depth === 0) break;
        }
        continue;
      }
      if (VOID.has(name)) {
        if (name === "br" || name === "hr") append(elNode(name, [], { attrs: tok.attrs }));
        continue;
      }
      if (name === "li") {
        // An open item ends where the next one starts (not across a list or quotation).
        for (let k = stack.length - 1; k >= 1; k--) {
          const open = stack[k].name;
          if (open === "li") {
            stack.length = k;
            break;
          }
          if (open === "ul" || open === "ol" || open === "blockquote") break;
        }
      }
      if (stack.length >= MAX_OPEN) continue;
      const el = elNode(name, [], { attrs: tok.attrs });
      append(el);
      stack.push(el);
    } else {
      for (let k = stack.length - 1; k >= 1; k--) {
        if (stack[k].name === tok.name) {
          stack.length = k;
          break;
        }
      }
    }
  }
  return root.kids;
}

/** A link target this sheet may keep, or null. See the header of the format's "Formatted text". */
function cleanHref(value) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  const check = trimmed.replace(/[\x00-\x20\x7f]/g, "");
  const ok = /^(?:https?|mailto):/i.test(check) || (check.startsWith("/") && !check.startsWith("//") && !check.startsWith("/\\"));
  if (!ok) return null;
  return trimmed.replace(/[\x00-\x1f\x7f]/g, "");
}

/** The alignment a block asks for, from data-align, align or style, whichever is there first. */
function alignOf(attrs) {
  const known = (v) => (ALIGNMENTS.includes(v) ? v : null);
  const clean = (v) => v.trim().toLowerCase();
  if (attrs.has("data-align")) return known(clean(attrs.get("data-align")));
  if (attrs.has("align")) return known(clean(attrs.get("align")));
  if (attrs.has("style")) {
    let last = null;
    for (const m of attrs.get("style").matchAll(/text-align\s*:\s*([^;]*)/gi)) last = m[1];
    if (last !== null) return known(clean(last.replace(/!\s*important\s*$/i, "")));
  }
  return null;
}

/** A span's valid named styles as { font, size, color, mark } (null for none), or null when it has none. */
function spanStyles(attrs) {
  const styles = {};
  let any = false;
  for (const key of STYLE_KEYS) {
    const v = attrs.has(`data-${key}`) ? attrs.get(`data-${key}`).trim().toLowerCase() : null;
    styles[key] = v !== null && SPAN_STYLES[key].includes(v) ? v : null;
    if (styles[key] !== null) any = true;
  }
  return any ? styles : null;
}

/** The parse tree with canonical names, only the two attributes, and unknown elements replaced by their contents. */
function convert(nodes, out = []) {
  for (const n of nodes) {
    if (n.t === "text") {
      out.push(textNode(n.s));
      continue;
    }
    const name = RENAMED[n.name] ?? n.name;
    if (!ALLOWED.has(name)) {
      convert(n.kids, out);
    } else if (name === "br" || name === "hr") {
      out.push(elNode(name));
    } else if (name === "a") {
      const href = cleanHref(n.attrs.get("href"));
      if (href === null) convert(n.kids, out);
      else out.push(elNode("a", convert(n.kids), { href }));
    } else if (name === "span") {
      const styles = spanStyles(n.attrs);
      if (styles === null) convert(n.kids, out);
      else out.push(elNode("span", convert(n.kids), { styles }));
    } else if (name === "p" || name === "h2" || name === "h3") {
      out.push(elNode(name, convert(n.kids), { align: alignOf(n.attrs) }));
    } else {
      out.push(elNode(name, convert(n.kids)));
    }
  }
  return out;
}

const isBlockName = (name) => name === "p" || name === "h2" || name === "h3" || name === "blockquote" || name === "ul" || name === "ol" || name === "li";
const NOT_SPACE = /[^ \t\r\n\f]/;

/** Whether nodes hold no break and no character but ASCII whitespace. */
function isBlank(nodes) {
  for (const n of nodes) {
    if (n.t === "text") {
      if (NOT_SPACE.test(n.s)) return false;
    } else if (n.name === "br" || !isBlank(n.kids)) return false;
  }
  return true;
}

const pushAll = (to, from) => {
  for (const x of from) to.push(x);
};

/**
 * Inline content only: text, br and the inline tags. A block found inside is
 * unwrapped to its inline content, blocks separated by a br; an hr goes; an
 * `a` inside an `a` is unwrapped.
 */
function toInline(nodes, inLink) {
  const segs = [];
  let run = [];
  const flush = () => {
    if (run.length) segs.push({ block: false, nodes: run });
    run = [];
  };
  for (const n of nodes) {
    if (n.t === "text") run.push(textNode(n.s));
    else if (n.name === "br") run.push(br());
    else if (INLINE.has(n.name)) {
      if (n.name === "a" && inLink) pushAll(run, toInline(n.kids, true));
      else run.push({ ...n, kids: toInline(n.kids, inLink || n.name === "a") });
    } else if (n.name === "hr") {
      // dropped
    } else {
      flush();
      segs.push({ block: true, nodes: toInline(n.kids, inLink) });
    }
  }
  flush();
  const out = [];
  let prev = null;
  for (const seg of segs) {
    if (segs.length > 1 && isBlank(seg.nodes)) continue;
    if (prev && (prev.block || seg.block)) out.push(br());
    pushAll(out, seg.nodes);
    prev = seg;
  }
  return out;
}

/** The text and br leaves of inline nodes in document order. */
function leavesOf(nodes, out = []) {
  for (const n of nodes) {
    if (n.t === "text" || n.name === "br") out.push(n);
    else leavesOf(n.kids, out);
  }
  return out;
}

const hasText = (nodes) => nodes.some((n) => (n.t === "text" ? n.s !== "" : n.name !== "br" && hasText(n.kids)));

/** Remove the breaks at the very end, looking through elements that hold nothing else. */
function stripTrailingBr(list) {
  for (let i = list.length - 1; i >= 0; i--) {
    const n = list[i];
    if (n.t === "text") {
      if (n.s === "") continue;
      return;
    }
    if (n.name === "br") {
      list.splice(i, 1);
      continue;
    }
    stripTrailingBr(n.kids);
    if (hasText(n.kids)) return;
  }
}

const styleKey = (n) => (n.styles ? STYLE_KEYS.map((k) => n.styles[k] ?? "").join("|") : "");
const sameAttrs = (a, b) => (a.href ?? null) === (b.href ?? null) && styleKey(a) === styleKey(b);

/** An element whose only child is an element of its own name: one element, a span's styles merged, the inner winning. */
function collapsed(el) {
  while (el.kids.length === 1 && el.kids[0].t === "el" && el.kids[0].name === el.name) {
    const inner = el.kids[0];
    if (el.name === "span") {
      const styles = {};
      for (const k of STYLE_KEYS) styles[k] = inner.styles[k] ?? el.styles[k];
      el = { ...inner, styles };
    } else if (sameAttrs(el, inner)) el = inner;
    else break;
  }
  return el;
}

/** Add a node to a list, joining it to the one before when they are the same text or the same element. */
function addNode(out, n) {
  if (n.t === "text") {
    if (n.s === "") return;
    const last = out[out.length - 1];
    if (last?.t === "text") last.s += n.s;
    else out.push(textNode(n.s));
    return;
  }
  const last = out[out.length - 1];
  if (n.name !== "br" && last?.t === "el" && last.name === n.name && sameAttrs(last, n)) {
    for (const k of n.kids) addNode(last.kids, k);
  } else out.push(n);
}

/** What an element holds: a break, or any character other than ASCII whitespace. */
const holdsSomething = (nodes) => nodes.some((n) => (n.t === "text" ? NOT_SPACE.test(n.s) : n.name === "br" || holdsSomething(n.kids)));

/**
 * Drop empty elements, keep the space of one holding only whitespace, collapse
 * `<em><em>x</em></em>`, and join seams (`<em>a</em><em>b</em>`) at every level.
 */
function simplify(list) {
  const out = [];
  for (const n of list) {
    if (n.t === "text" || n.name === "br") {
      addNode(out, n);
      continue;
    }
    n.kids = simplify(n.kids);
    if (!holdsSomething(n.kids)) {
      for (const k of n.kids) addNode(out, k); // only whitespace text is left
      continue;
    }
    addNode(out, collapsed(n));
  }
  return out;
}

/** Unwrap inline elements nested deeper than MAX_INLINE_DEPTH; reports whether any was. */
function capDepth(list, depth, state) {
  const out = [];
  for (const n of list) {
    if (n.t === "text" || n.name === "br") out.push(n);
    else if (depth >= MAX_INLINE_DEPTH) {
      state.cut = true;
      pushAll(out, capDepth(n.kids, depth, state));
    } else {
      n.kids = capDepth(n.kids, depth + 1, state);
      out.push(n);
    }
  }
  return out;
}

/**
 * A block's inline content in canonical form: whitespace collapsed (across
 * element edges, and none beside a break or at either end), a lone break kept
 * as the one thing an otherwise empty block may hold, a trailing break gone,
 * empties dropped, seams joined. Null when nothing is left.
 */
function cleanInline(nodes) {
  const leaves = leavesOf(nodes);
  let prev = "start";
  let lastText = null;
  for (const leaf of leaves) {
    if (leaf.t === "text") {
      let s = leaf.s.replace(/[ \t\r\n\f]+/g, " ");
      if (s.startsWith(" ") && prev !== "text") s = s.slice(1);
      leaf.s = s;
      if (s) {
        prev = s.endsWith(" ") ? "space" : "text";
        lastText = leaf;
      }
    } else {
      if (prev === "space") lastText.s = lastText.s.slice(0, -1);
      prev = "br";
    }
  }
  if (prev === "space") lastText.s = lastText.s.slice(0, -1);
  if (!hasText(nodes)) return leaves.some((l) => l.t === "el") ? [br()] : null;
  stripTrailingBr(nodes);
  let out = simplify(nodes);
  const state = { cut: false };
  out = capDepth(out, 0, state);
  if (state.cut) out = simplify(out);
  return out;
}

/* Blocks. A block is { t: "block", name, align?, kids } for p, h2, h3 (inline kids),
   { name: "hr" }, { name: "blockquote", kids: blocks }, or { name: "ul"|"ol", items },
   an item being { inline, sub } with `sub` a list or null. */

const MAX_LIST_DEPTH = 3;

function inlineBlock(name, align, nodes) {
  const inline = cleanInline(toInline(nodes, false));
  return inline ? { t: "block", name, align, kids: inline } : null;
}

/** Items for the children of a list `depth` levels deep (a deeper list's items join the third). */
function buildItems(children, depth) {
  const items = [];
  let loose = [];
  const flushLoose = () => {
    if (loose.some((n) => n.t === "el" || NOT_SPACE.test(n.s))) pushAll(items, itemFrom(loose, depth));
    loose = [];
  };
  for (const c of children) {
    if (c.t === "el" && c.name === "li") {
      flushLoose();
      pushAll(items, itemFrom(c.kids, depth));
    } else loose.push(c);
  }
  flushLoose();
  return items;
}

/** The item for an li's contents, then any items hoisted up from lists nested too deep. */
function itemFrom(nodes, depth) {
  const lists = [];
  const rest = [];
  for (const n of nodes) (n.t === "el" && (n.name === "ul" || n.name === "ol") ? lists : rest).push(n);
  let inline = cleanInline(toInline(rest, false));
  let sub = null;
  let hoisted = [];
  if (lists.length) {
    const merged = [];
    for (const l of lists) pushAll(merged, l.kids);
    const subItems = buildItems(merged, depth + 1);
    if (depth < MAX_LIST_DEPTH) {
      if (subItems.length) sub = { t: "block", name: lists[0].name, items: subItems };
    } else hoisted = subItems;
  }
  if (sub && inline && inline.length === 1 && inline[0].name === "br") inline = null;
  const own = inline || sub ? [{ inline, sub }] : [];
  return [...own, ...hoisted];
}

function listBlock(el, depth) {
  const items = buildItems(el.kids, depth);
  return items.length ? { t: "block", name: el.name, items } : null;
}

/** The top level (ctx "top") or a blockquote (ctx "quote") as blocks. */
function toBlocks(nodes, ctx, out = []) {
  let run = [];
  const flush = () => {
    if (run.length && !isBlank(run)) {
      const b = inlineBlock("p", null, run);
      if (b) out.push(b);
    }
    run = [];
  };
  for (const n of nodes) {
    if (n.t === "text" || n.name === "br" || INLINE.has(n.name)) {
      run.push(n);
      continue;
    }
    flush();
    if (n.name === "p") {
      const b = inlineBlock("p", n.align, n.kids);
      if (b) out.push(b);
    } else if (n.name === "h2" || n.name === "h3") {
      const b = ctx === "top" ? inlineBlock(n.name, n.align, n.kids) : inlineBlock("p", null, n.kids);
      if (b) out.push(b);
    } else if (n.name === "li") {
      const b = inlineBlock("p", null, n.kids);
      if (b) out.push(b);
    } else if (n.name === "blockquote") {
      if (ctx === "quote") toBlocks(n.kids, "quote", out);
      else {
        const kids = toBlocks(n.kids, "quote");
        if (kids.length) out.push({ t: "block", name: "blockquote", kids });
      }
    } else if (n.name === "ul" || n.name === "ol") {
      const b = listBlock(n, 1);
      if (b) out.push(b);
    } else if (n.name === "hr" && ctx === "top") {
      out.push({ t: "block", name: "hr" });
    }
  }
  flush();
  return out;
}

/* Serializing */

const escText = (s) => s.normalize("NFC").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const escAttr = (s) => escText(s).replace(/"/g, "&quot;");

const spanAttrs = (styles) => STYLE_KEYS.filter((k) => styles[k]).map((k) => ` data-${k}="${styles[k]}"`).join("");

function serInline(nodes) {
  let html = "";
  for (const n of nodes) {
    if (n.t === "text") html += escText(n.s);
    else if (n.name === "br") html += "<br>";
    else html += `<${n.name}${n.name === "a" ? ` href="${escAttr(n.href)}"` : ""}${n.name === "span" ? spanAttrs(n.styles) : ""}>${serInline(n.kids)}</${n.name}>`;
  }
  return html;
}

function serList(list) {
  let html = `<${list.name}>`;
  for (const item of list.items) {
    html += `<li>${item.inline ? serInline(item.inline) : ""}${item.sub ? serList(item.sub) : ""}</li>`;
  }
  return `${html}</${list.name}>`;
}

function serBlock(b) {
  if (b.name === "hr") return "<hr>";
  if (b.name === "blockquote") return `<blockquote>${b.kids.map(serBlock).join("")}</blockquote>`;
  if (b.name === "ul" || b.name === "ol") return serList(b);
  return `<${b.name}${b.align ? ` data-align="${b.align}"` : ""}>${serInline(b.kids)}</${b.name}>`;
}

/**
 * The canonical form of formatted text for a sheet's `text` and `question`
 * modules: only the format's tags, only `href` (a link that is http, https,
 * mailto or a path on this site) and `data-align` (center, right, justify),
 * nesting that fits the format's rules, one space where there were many, no
 * empty elements and no seams. Anything else is dropped with its text kept,
 * and `<script>`, `<style>` and the like with their contents. Idempotent. A
 * value that is not a string is "".
 *
 * @param {unknown} html
 * @returns {string}
 */
export function sanitizeSheetHtml(html) {
  if (typeof html !== "string" || html === "") return "";
  const blocks = toBlocks(convert(parse(tokenize(html))), "top");
  return blocks.map(serBlock).join("");
}

/* ── Reading a paste ─────────────────────────────────────────────────── */

// What another program puts on the clipboard says some things in ways the
// sanitizer, which reads stored text, shouldn't guess at (BA68, BA71). So a
// paste or a drop is read here first, on the parse tree, and then goes through
// the sanitizer's own steps; what comes out is the canonical form, so
// sanitizeSheetHtml(pastedSheetHtml(x)) === pastedSheetHtml(x). None of this
// is in the format: how a client reads a paste is its own business.

/** Elements that are blocks in what is pasted (tr is read as a paragraph). */
const PASTED_BLOCKS = new Set(["p", "h1", "h2", "h3", "h4", "h5", "h6", "ul", "ol", "li", "blockquote", "hr", "div", "tr"]);
const BOLD_WEIGHT = /^(?:bold|bolder|[6-9]00)$/;
const NORMAL_WEIGHT = /^(?:normal|lighter|[1-4]00)$/;
const WORD_MARKER = /mso-list\s*:\s*ignore/i;

/** A style attribute's declarations, by property in lowercase, the last one winning. */
function readStyle(style) {
  const out = new Map();
  for (const part of (style ?? "").split(";")) {
    const colon = part.indexOf(":");
    if (colon < 0) continue;
    const value = part.slice(colon + 1).replace(/!\s*important\s*$/i, "").trim().toLowerCase();
    out.set(part.slice(0, colon).trim().toLowerCase(), value);
  }
  return out;
}

/** Whether nodes hold a block, directly or through elements the sanitizer unwraps. */
function holdsBlock(nodes) {
  return nodes.some(
    (n) =>
      n.t === "el" &&
      (PASTED_BLOCKS.has(n.name) || ((n.name === "span" || !ALLOWED.has(RENAMED[n.name] ?? n.name)) && holdsBlock(n.kids))),
  );
}

/** A span's inline styles as the tags they mean (Google Docs writes bold as a weight, never as `<b>`). */
function styledKids(style, kids, inLink) {
  const s = readStyle(style);
  let out = kids;
  const wrap = (name) => {
    out = [elNode(name, out, { attrs: new Map() })];
  };
  if (BOLD_WEIGHT.test(s.get("font-weight") ?? "")) wrap("strong");
  if (/^(?:italic|oblique)/.test(s.get("font-style") ?? "")) wrap("em");
  const decoration = `${s.get("text-decoration") ?? ""} ${s.get("text-decoration-line") ?? ""}`;
  // A link is underlined already; Docs says so on the span inside it.
  if (!inLink && decoration.includes("underline")) wrap("u");
  if (decoration.includes("line-through")) wrap("s");
  const va = s.get("vertical-align");
  if (va === "super") wrap("sup");
  else if (va === "sub") wrap("sub");
  return out;
}

const textOf = (nodes) => nodes.map((n) => (n.t === "text" ? n.s : textOf(n.kids))).join("");

/** The first marker span (Word's bullet or number) among nodes, or null. */
function wordMarker(nodes) {
  for (const n of nodes) {
    if (n.t !== "el") continue;
    if (WORD_MARKER.test(n.attrs?.get("style") ?? "")) return n;
    const inner = wordMarker(n.kids);
    if (inner) return inner;
  }
  return null;
}

/**
 * A Word list paragraph's place in its list, { level, ordered }, or null when
 * the paragraph isn't one. Word writes a list item as a paragraph whose style
 * names its list and level (`mso-list:l0 level2 lfo1`) and whose bullet or
 * number is text in a marker span; "List Paragraph" without numbering has the
 * class but neither, and stays a paragraph.
 */
function wordListItem(p) {
  const style = p.attrs?.get("style") ?? "";
  const listed = /mso-list\s*:\s*l\d+/i.test(style);
  const marker = wordMarker(p.kids);
  if (!listed && !marker) return null;
  const level = Number(/level(\d+)/i.exec(style)?.[1] ?? 1);
  const label = marker ? textOf(marker.kids).replace(/[\s ]+/g, "") : "";
  return { level: Math.min(Math.max(level, 1), 9), ordered: /^\(?[0-9a-z]+[.)]$/i.test(label) };
}

/** Runs of Word list paragraphs among siblings, rebuilt as nested ul and ol. */
function wordLists(nodes) {
  const out = [];
  let run = [];
  let gap = [];
  const flush = () => {
    if (run.length) out.push(buildWordList(run));
    run = [];
    pushAll(out, gap);
    gap = [];
  };
  for (const n of nodes) {
    if (n.t === "el" && n.wordList) {
      gap = []; // whitespace between two items
      run.push(n);
    } else if (run.length && n.t === "text" && !NOT_SPACE.test(n.s)) gap.push(n);
    else {
      flush();
      out.push(n);
    }
  }
  flush();
  return out;
}

function buildWordList(paragraphs) {
  let top = null;
  const stack = [];
  for (const p of paragraphs) {
    const { level, ordered } = p.wordList;
    stack.length = Math.min(stack.length, level);
    while (stack.length < level) {
      const list = elNode(ordered ? "ol" : "ul", [], { attrs: new Map() });
      const parent = stack[stack.length - 1];
      if (!parent) top = list;
      else {
        if (!parent.kids.length) parent.kids.push(elNode("li", [], { attrs: new Map() }));
        parent.kids[parent.kids.length - 1].kids.push(list);
      }
      stack.push(list);
    }
    stack[stack.length - 1].kids.push(elNode("li", p.kids, { attrs: new Map() }));
  }
  return top;
}

/** The parse tree of a paste, with what other programs mean said the sanitizer's way. */
function readPasteNodes(nodes, inLink) {
  const out = [];
  for (const n of nodes) {
    if (n.t === "text") {
      out.push(n);
      continue;
    }
    const style = n.attrs?.get("style") ?? "";
    // Word's bullet or number, with the spaces after it; the list is rebuilt below.
    if (WORD_MARKER.test(style)) continue;
    const link = inLink || n.name === "a";
    const kids = readPasteNodes(n.kids, link);
    if (n.name === "b" && NORMAL_WEIGHT.test(readStyle(style).get("font-weight") ?? "")) {
      // Google Docs wraps a whole copy in <b style="font-weight:normal">.
      pushAll(out, kids);
    } else if (n.name === "div" && holdsBlock(kids)) {
      // A wrapper (a web page's, webmail's, Word's WordSection1), not a paragraph.
      pushAll(out, kids);
    } else if (n.name === "span" && !holdsBlock(kids)) {
      out.push({ ...n, kids: styledKids(style, kids, link) });
    } else {
      const el = { ...n, kids };
      if (n.name === "p") {
        const item = wordListItem(n);
        if (item) el.wordList = item;
      }
      out.push(el);
    }
  }
  return wordLists(out);
}

/**
 * Pasted or dropped HTML in the canonical form, read as sanitizeSheetHtml
 * reads it, except that what Google Docs, Word and web pages mean is kept:
 * Docs' `<b style="font-weight:normal">` wrapper is not bold, and its bold,
 * italic, underline, strikethrough, superscript and subscript, which it writes
 * as styles on a span, are the tags; a `div` that holds blocks is a wrapper,
 * not one paragraph; and Word's list paragraphs are lists again, without their
 * typed bullets. A value that is not a string is "".
 *
 * @param {unknown} html
 * @returns {string}
 */
export function pastedSheetHtml(html) {
  if (typeof html !== "string" || html === "") return "";
  const blocks = toBlocks(convert(readPasteNodes(parse(tokenize(html)), false)), "top");
  // An empty line at either end is the copy's edge (Docs ends one with a <br>), not text.
  const empty = (b) => b?.name === "p" && b.kids.length === 1 && b.kids[0].name === "br";
  while (blocks.length > 1 && empty(blocks[blocks.length - 1])) blocks.pop();
  while (blocks.length > 1 && empty(blocks[0])) blocks.shift();
  return blocks.map(serBlock).join("");
}

/** The formatted fields of each module type that has them. */
const FORMATTED = Object.freeze({ text: ["html"], question: ["html", "answer"] });

/**
 * A sheet record with its modules' formatted fields sanitized, whatever its
 * sheetFormat (BA66). validateSheet holds a sheet in this code's format to
 * the canonical form already, but a sheet in a newer format isn't checked
 * (canEdit says no), and it is still drawn. The sanitizer's output is safe
 * for any version, so an import puts every sheet through this. Returns the
 * record itself when nothing changes, so a copy already here still compares
 * equal; anything else, a trash record included, is returned as it is.
 */
export function cleanSheetText(r) {
  if (r?.kind !== "sheet" || !Array.isArray(r.modules)) return r;
  let changed = false;
  const modules = r.modules.map((m) => {
    const fields = FORMATTED[m?.type];
    if (!fields) return m;
    let out = m;
    for (const f of fields) {
      if (typeof m[f] !== "string") continue;
      const clean = sanitizeSheetHtml(m[f]);
      if (clean !== m[f]) out = { ...out, [f]: clean };
    }
    if (out !== m) changed = true;
    return out;
  });
  return changed ? { ...r, modules } : r;
}

/* ── Checking a sheet ────────────────────────────────────────────────── */

/** The length of a string in characters (code points), as a reader counts them. */
const chars = (s) => Array.from(s).length;
const isObject = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const nonEmpty = (v) => typeof v === "string" && v.length > 0;
const isInt = Number.isInteger;

function jsonBytes(r) {
  try {
    return new TextEncoder().encode(JSON.stringify(r)).length;
  } catch {
    return Infinity;
  }
}

/** Problems with one passage module, each already prefixed with where it is. */
function passageProblems(m, at) {
  const problems = [];
  const need = (ok, msg) => ok || problems.push(`${at}: ${msg}`);

  const knownBook = typeof m.bookKey === "string" && Object.hasOwn(BOOKS, m.bookKey);
  need(knownBook, `bookKey "${m.bookKey}" is not a book`);
  need(isInt(m.chapter) && m.chapter >= 1 && m.chapter <= (knownBook ? BOOKS[m.bookKey] : 0), "chapter is out of range");
  need(isInt(m.verse) && m.verse >= 1, "verse is not a positive integer");
  need(m.endVerse == null || (isInt(m.endVerse) && m.endVerse >= m.verse), "endVerse comes before verse");
  if (m.quote != null) {
    need(isObject(m.quote), "quote is not an object");
    if (isObject(m.quote)) {
      need(nonEmpty(m.quote.exact), "quote.exact is empty");
      need(typeof m.quote.prefix === "string" && typeof m.quote.suffix === "string", "quote needs prefix and suffix");
    }
  }
  need(m.verseCopy == null || typeof m.verseCopy === "string", "verseCopy is not text");
  need(m.verseCopyAsOf == null || typeof m.verseCopyAsOf === "string", "verseCopyAsOf is not text");

  need(Array.isArray(m.blanks), "blanks is not a list");
  if (Array.isArray(m.blanks)) {
    const first = isInt(m.verse) ? m.verse : null;
    const last = isInt(m.endVerse) ? m.endVerse : first;
    const ids = new Set();
    m.blanks.forEach((b, i) => {
      const where = `${at}, blank ${i + 1}`;
      if (!isObject(b)) return problems.push(`${where} is not an object`);
      if (!nonEmpty(b.id)) problems.push(`${where} has no id`);
      else if (ids.has(b.id)) problems.push(`${where} repeats the id of another blank`);
      else ids.add(b.id);
      if (!isInt(b.verse) || (first !== null && (b.verse < first || b.verse > last))) problems.push(`${where} is in a verse outside the passage`);
      if (!nonEmpty(b.exact)) problems.push(`${where} has no words`);
      if (typeof b.prefix !== "string" || typeof b.suffix !== "string") problems.push(`${where} needs prefix and suffix`);
      if (!HINTS.includes(b.hint)) problems.push(`${where} has hint "${b.hint}", which is not one of ${HINTS.join(", ")}`);
      if (b.hintText != null && (typeof b.hintText !== "string" || chars(b.hintText) > SHEET_LIMITS.hintText)) {
        problems.push(`${where} has a hint of more than ${SHEET_LIMITS.hintText} characters`);
      }
      if (b.hint === "custom" && !nonEmpty(b.hintText)) problems.push(`${where} has a custom hint with no text`);
    });
  }

  need(Array.isArray(m.footnotes), "footnotes is not a list");
  if (Array.isArray(m.footnotes)) {
    m.footnotes.forEach((f, i) => {
      const where = `${at}, footnote choice ${i + 1}`;
      if (!isObject(f)) return problems.push(`${where} is not an object`);
      if (!isInt(f.verse) || f.verse < 1) problems.push(`${where} has a verse that is not a positive integer`);
      if (!nonEmpty(f.footnote)) problems.push(`${where} has no footnote text`);
      if (f.n != null && (!isInt(f.n) || f.n < 1)) problems.push(`${where} has an n that is not a positive integer`);
      if (typeof f.print !== "boolean") problems.push(`${where} has a print that is not true or false`);
    });
  }
  return problems;
}

/**
 * Problems with a sheet's own fields and modules, as plain sentences; empty
 * when there are none. validateRecord calls it for a sheet once the fields
 * every record carries have passed. A module of a type this code doesn't know
 * is checked only for its `id` and `type`, since its fields aren't this
 * code's to judge (principle 6).
 *
 * @param {object} r a record of kind "sheet"
 * @returns {string[]}
 */
export function validateSheet(r) {
  const problems = [];
  const need = (ok, msg) => ok || problems.push(msg);

  need(isInt(r?.sheetFormat) && r.sheetFormat >= 1, "sheetFormat is not a positive integer");
  need(typeof r?.title === "string" && chars(r.title) <= SHEET_LIMITS.title, `title is not text of at most ${SHEET_LIMITS.title} characters`);
  need(typeof r?.subtitle === "string" && chars(r.subtitle) <= SHEET_LIMITS.subtitle, `subtitle is not text of at most ${SHEET_LIMITS.subtitle} characters`);
  need(nonEmpty(r?.template), "template is empty");
  need(r?.commercial == null || typeof r.commercial === "boolean", "commercial is not true or false");

  if (!Array.isArray(r?.modules)) {
    problems.push("modules is not a list");
    return problems;
  }
  if (r.modules.length > SHEET_LIMITS.modules) problems.push(`a sheet holds at most ${SHEET_LIMITS.modules} modules`);
  // Too big is reason enough to refuse it, so its modules aren't sanitized
  // one by one to find more (BA67).
  if (jsonBytes(r) > SHEET_LIMITS.bytes) {
    problems.push(`a sheet is at most ${SHEET_LIMITS.bytes / 1024} KB`);
    return problems;
  }

  const ids = new Set();
  let keyTerms = 0;
  r.modules.forEach((m, i) => {
    const at = `Module ${i + 1}`;
    if (!isObject(m)) return problems.push(`${at} is not an object`);
    if (!nonEmpty(m.id)) problems.push(`${at} has no id`);
    else if (ids.has(m.id)) problems.push(`${at} repeats the id of another module`);
    else ids.add(m.id);
    if (!nonEmpty(m.type)) return problems.push(`${at} has no type`);
    if (!MODULE_TYPES.includes(m.type)) return;

    const here = `${at} (${m.type})`;
    const check = (ok, msg) => ok || problems.push(`${here}: ${msg}`);
    check(m.leaderOnly == null || typeof m.leaderOnly === "boolean", "leaderOnly is not true or false");
    switch (m.type) {
      case "passage":
        problems.push(...passageProblems(m, here));
        break;
      case "text":
        check(typeof m.html === "string" && sanitizeSheetHtml(m.html) === m.html, "html is not in the sheet's formatted-text form");
        break;
      case "question":
        check(typeof m.html === "string" && sanitizeSheetHtml(m.html) === m.html, "html is not in the sheet's formatted-text form");
        check(typeof m.answer === "string" && sanitizeSheetHtml(m.answer) === m.answer, "answer is not in the sheet's formatted-text form");
        check(isInt(m.lines) && m.lines >= 0 && m.lines <= SHEET_LIMITS.questionLines, `lines is not a whole number from 0 to ${SHEET_LIMITS.questionLines}`);
        break;
      case "space":
        check(isInt(m.lines) && m.lines >= 1 && m.lines <= SHEET_LIMITS.spaceLines, `lines is not a whole number from 1 to ${SHEET_LIMITS.spaceLines}`);
        break;
      case "keyTerms":
        check(Array.isArray(m.omit) && m.omit.every((id) => typeof id === "string"), "omit is not a list of glossary IDs");
        if (++keyTerms === 2) problems.push("A sheet has at most one key terms module");
        break;
      default:
        break; // pageBreak holds nothing
    }
  });
  return problems;
}
