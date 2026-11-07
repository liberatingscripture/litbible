// test/helpers/xml-check.js
//
// A strict reader for the XML the sheet's document writers produce
// (test/desk-sheet-doc.test.js): it throws on anything that isn't
// well-formed (a tag left open or closed out of order, an attribute without
// quotes or given twice, a bare "&" or "<", an unknown entity, text or a
// second element outside the root) and returns the tree, so a test can look
// for the elements it expects. Not a general parser: no DTDs, no CDATA, no
// processing instructions but the XML declaration.

const ENTITY = /&(?:amp|lt|gt|quot|apos|#\d+|#x[0-9a-fA-F]+);/y;
const NAME = "[A-Za-z_][\\w.:-]*";

function decode(s) {
  return s.replace(/&(amp|lt|gt|quot|apos|#\d+|#x[0-9a-fA-F]+);/g, (_, e) => {
    if (e[0] === "#") return String.fromCodePoint(e[1] === "x" ? parseInt(e.slice(2), 16) : Number(e.slice(1)));
    return { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" }[e];
  });
}

function checkText(text, where) {
  if (text.includes("<") || text.includes(">")) throw new Error(`xml: a bare < or > in ${where}`);
  for (let i = text.indexOf("&"); i !== -1; i = text.indexOf("&", i + 1)) {
    ENTITY.lastIndex = i;
    if (!ENTITY.test(text)) throw new Error(`xml: a bare & in ${where}: ${text.slice(i, i + 20)}`);
  }
  if (/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(text)) throw new Error(`xml: a control character in ${where}`);
}

/**
 * @param {string} xml
 * @returns {{ name: string, attrs: Record<string, string>, children: object[], text: string }} the root element
 */
export function parseXml(xml) {
  let s = xml.replace(/^﻿/, "");
  const decl = s.match(/^<\?xml[^?]*\?>\s*/);
  if (decl) s = s.slice(decl[0].length);
  const root = { name: "#document", attrs: {}, children: [], text: "" };
  const stack = [root];
  const tag = new RegExp(`<(/?)(${NAME})((?:\\s+${NAME}\\s*=\\s*(?:"[^"<]*"|'[^'<]*'))*)\\s*(/?)>`, "y");
  let at = 0;
  while (at < s.length) {
    const lt = s.indexOf("<", at);
    const text = s.slice(at, lt === -1 ? s.length : lt);
    if (text) {
      checkText(text, `<${stack.at(-1).name}>`);
      if (stack.length === 1 && text.trim()) throw new Error("xml: text outside the root element");
      stack.at(-1).text += decode(text);
      stack.at(-1).children.push({ name: "#text", text: decode(text) });
    }
    if (lt === -1) break;
    if (s.startsWith("<!--", lt)) {
      const end = s.indexOf("-->", lt);
      if (end === -1) throw new Error("xml: an unclosed comment");
      at = end + 3;
      continue;
    }
    tag.lastIndex = lt;
    const m = tag.exec(s);
    if (!m) throw new Error(`xml: a malformed tag at ${lt}: ${s.slice(lt, lt + 60)}`);
    at = tag.lastIndex;
    const [, closing, name, attrText, selfClosing] = m;
    if (closing) {
      if (attrText || selfClosing) throw new Error(`xml: a closing tag with attributes: </${name}>`);
      const open = stack.pop();
      if (!open || open.name !== name) throw new Error(`xml: </${name}> closes <${open?.name}>`);
      continue;
    }
    const attrs = {};
    for (const a of attrText.matchAll(new RegExp(`(${NAME})\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, "g"))) {
      if (a[1] in attrs) throw new Error(`xml: ${a[1]} given twice on <${name}>`);
      const value = a[2] ?? a[3];
      checkText(value, `${name}@${a[1]}`);
      attrs[a[1]] = decode(value);
    }
    const el = { name, attrs, children: [], text: "" };
    if (stack.length === 1 && root.children.some((c) => c.name !== "#text")) throw new Error("xml: a second root element");
    stack.at(-1).children.push(el);
    if (!selfClosing) stack.push(el);
  }
  if (stack.length !== 1) throw new Error(`xml: <${stack.at(-1).name}> never closed`);
  const top = root.children.filter((c) => c.name !== "#text");
  if (top.length !== 1) throw new Error("xml: no root element");
  return top[0];
}

/** Every element under `el` (itself included) named `name`, in document order. */
export function findAll(el, name, out = []) {
  if (el.name === name) out.push(el);
  for (const c of el.children ?? []) if (c.name !== "#text") findAll(c, name, out);
  return out;
}

/** All the text under `el`, in order. */
export function textOf(el) {
  if (el.name === "#text") return el.text;
  return (el.children ?? []).map(textOf).join("");
}
