// test/helpers/mini-dom.js
//
// Just enough of the DOM for Node tests to drive src/lib/desk-anchor-dom.mjs
// over rendered chapter HTML: elements with attributes, text nodes, sibling
// and parent links, and entity decoding. It is not a browser. It doesn't
// repair bad nesting the way an HTML parser does, so it throws on a mismatched
// close tag rather than guessing, and an unknown named entity throws too
// rather than passing through. Either one means the chapter HTML did something
// the anchor-text tests haven't accounted for.

const VOID = new Set(["br", "img", "hr", "wbr", "input", "meta", "link", "source"]);

const NAMED = {
  nbsp: " ",
  mdash: "—",
  ndash: "–",
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  hellip: "…",
  thinsp: " ",
  zwj: "‍",
  zwnj: "‌",
};

export function decodeEntities(s) {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (_, e) => {
    if (e[0] === "#") {
      const code = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : Number(e.slice(1));
      return String.fromCodePoint(code);
    }
    if (!(e in NAMED)) throw new Error(`mini-dom: unknown entity &${e};`);
    return NAMED[e];
  });
}

class MiniNode {
  constructor(nodeType) {
    this.nodeType = nodeType;
    this.parentNode = null;
    this.childNodes = [];
  }
  get nextSibling() {
    const kids = this.parentNode?.childNodes;
    return kids ? (kids[kids.indexOf(this) + 1] ?? null) : null;
  }
  get previousSibling() {
    const kids = this.parentNode?.childNodes;
    return kids ? (kids[kids.indexOf(this) - 1] ?? null) : null;
  }
  appendChild(child) {
    child.parentNode = this;
    this.childNodes.push(child);
    return child;
  }
}

class MiniText extends MiniNode {
  constructor(value) {
    super(3);
    this.nodeValue = value;
  }
}

class MiniElement extends MiniNode {
  constructor(tag, attrs) {
    super(1);
    this.tagName = tag.toUpperCase();
    this.attrs = attrs;
  }
  getAttribute(name) {
    return name in this.attrs ? this.attrs[name] : null;
  }
  setAttribute(name, value) {
    this.attrs[name.toLowerCase()] = String(value);
  }
  removeAttribute(name) {
    delete this.attrs[name.toLowerCase()];
  }
  getAttributeNames() {
    return Object.keys(this.attrs);
  }
  remove() {
    const kids = this.parentNode?.childNodes;
    if (kids) kids.splice(kids.indexOf(this), 1);
    this.parentNode = null;
  }
  get textContent() {
    return this.childNodes.map((c) => (c.nodeType === 3 ? c.nodeValue : c.textContent)).join("");
  }
  /** Descendant elements matching a predicate, in document order. */
  findAll(pred, out = []) {
    for (const c of this.childNodes) {
      if (c.nodeType !== 1) continue;
      if (pred(c)) out.push(c);
      c.findAll(pred, out);
    }
    return out;
  }

  // Enough more for the sheet page's walks (test/desk-sheet-doc.test.js):
  // child elements, classes, data attributes, and selectors made of tags and
  // classes joined by descendant or child combinators, with `:scope` and
  // comma lists. Anything else in a selector throws.
  get children() {
    return this.childNodes.filter((c) => c.nodeType === 1);
  }
  get classList() {
    const names = (this.attrs.class ?? "").split(/\s+/).filter(Boolean);
    return { contains: (n) => names.includes(n) };
  }
  get dataset() {
    const out = {};
    for (const [k, v] of Object.entries(this.attrs)) {
      if (k.startsWith("data-")) out[k.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = v;
    }
    return out;
  }
  matches(selector, scope = null) {
    return parseSelector(selector).some((chain) => matchChain(this, chain, chain.length - 1, scope));
  }
  querySelectorAll(selector) {
    return this.findAll((el) => el.matches(selector, this));
  }
  querySelector(selector) {
    return this.querySelectorAll(selector)[0] ?? null;
  }
  append(...nodes) {
    for (const n of nodes) this.appendChild(typeof n === "string" ? new MiniText(n) : n);
  }
  cloneNode(deep = false) {
    const copy = new MiniElement(this.tagName, { ...this.attrs });
    if (deep) for (const c of this.childNodes) copy.appendChild(c.nodeType === 3 ? new MiniText(c.nodeValue) : c.cloneNode(true));
    return copy;
  }
}

MiniText.prototype.cloneNode = function () {
  return new MiniText(this.nodeValue);
};

/** "a > .b c, d" as [[{ tag, classes, scope, combinator }, …], …]. */
function parseSelector(selector) {
  return selector.split(",").map((part) => {
    const chain = [];
    let combinator = " ";
    for (const token of part.trim().split(/\s*(>)\s*|\s+/).filter(Boolean)) {
      if (token === ">") {
        combinator = ">";
        continue;
      }
      if (token === ":scope") {
        chain.push({ scope: true, combinator });
      } else {
        const m = token.match(/^([a-z][\w-]*)?((?:\.[\w-]+)*)$/i);
        if (!m) throw new Error(`mini-dom: selector "${token}" isn't supported`);
        chain.push({ tag: m[1]?.toUpperCase() ?? null, classes: m[2].split(".").filter(Boolean), combinator });
      }
      combinator = " ";
    }
    return chain;
  });
}

function matchOne(el, step, scope) {
  if (step.scope) return el === scope;
  if (step.tag && el.tagName !== step.tag) return false;
  return step.classes.every((c) => el.classList.contains(c));
}

function matchChain(el, chain, i, scope) {
  if (!el || el.nodeType !== 1 || !matchOne(el, chain[i], scope)) return false;
  if (i === 0) return true;
  if (chain[i].combinator === ">") return matchChain(el.parentNode, chain, i - 1, scope);
  for (let up = el.parentNode; up; up = up.parentNode) if (matchChain(up, chain, i - 1, scope)) return true;
  return false;
}

/** A `document` with createElement and createTextNode, for code that builds a node or two. */
export const miniDocument = {
  createElement: (tag) => new MiniElement(tag, {}),
  createTextNode: (text) => new MiniText(text),
};

function parseAttrs(src) {
  const attrs = {};
  for (const m of src.matchAll(/([^\s=/]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g)) {
    attrs[m[1].toLowerCase()] = decodeEntities(m[2] ?? m[3] ?? m[4] ?? "");
  }
  return attrs;
}

/** Parse an HTML fragment into a root element (tag "#root") holding it. */
export function parseHtml(html) {
  const root = new MiniElement("#root", {});
  const stack = [root];
  const re = /<!--[\s\S]*?-->|<\/([a-zA-Z][\w-]*)\s*>|<([a-zA-Z][\w-]*)((?:\s[^>]*?)?)(\/?)>|([^<]+)/g;
  for (const m of html.matchAll(re)) {
    const top = stack[stack.length - 1];
    if (m[0].startsWith("<!--")) continue;
    if (m[1]) {
      const tag = m[1].toUpperCase();
      if (top.tagName !== tag) {
        throw new Error(`mini-dom: </${m[1]}> closes <${top.tagName.toLowerCase()}>`);
      }
      stack.pop();
    } else if (m[2]) {
      const el = top.appendChild(new MiniElement(m[2], parseAttrs(m[3] ?? "")));
      if (!VOID.has(m[2].toLowerCase()) && !m[4]) stack.push(el);
    } else if (m[5] != null) {
      top.appendChild(new MiniText(decodeEntities(m[5])));
    }
  }
  if (stack.length !== 1) throw new Error(`mini-dom: <${stack.at(-1).tagName.toLowerCase()}> never closed`);
  return root;
}
