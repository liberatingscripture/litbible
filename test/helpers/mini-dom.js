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
}

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
