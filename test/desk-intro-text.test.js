// test/desk-intro-text.test.js
//
// The Book Intro pane's pure parts (src/scripts/desk/intro-text.js, Audit 3,
// LG3-9 item d): the heading shift, the stripping of ids, the link rules, and
// the `held` rule that keeps the pane on its book. introText only needs a few
// DOM calls (importNode, createElement, replaceWith, [id] and a[href] selectors,
// reflected target and rel), so this file gives it a stub of exactly those.
// mini-dom.js has no replaceWith or property reflection, so it isn't used.
import { test } from "node:test";
import assert from "node:assert/strict";

class Text {
  constructor(value) {
    this.nodeType = 3;
    this.nodeValue = value;
    this.parentNode = null;
  }
  get textContent() { return this.nodeValue; }
}

function detach(n) {
  const p = n.parentNode;
  if (!p) return;
  p.childNodes.splice(p.childNodes.indexOf(n), 1);
  n.parentNode = null;
}

class Elem {
  constructor(tag) {
    this.nodeType = 1;
    this.tagName = tag.toUpperCase();
    this.attrs = new Map();
    this.childNodes = [];
    this.parentNode = null;
  }
  get className() { return this.attrs.get("class") ?? ""; }
  set className(v) { this.attrs.set("class", String(v)); }
  // The DOM reflects these as attributes, which the module sets as properties.
  get target() { return this.getAttribute("target"); }
  set target(v) { this.setAttribute("target", v); }
  get rel() { return this.getAttribute("rel"); }
  set rel(v) { this.setAttribute("rel", v); }
  getAttribute(k) { return this.attrs.has(k) ? this.attrs.get(k) : null; }
  setAttribute(k, v) { this.attrs.set(k, String(v)); }
  removeAttribute(k) { this.attrs.delete(k); }
  get textContent() { return this.childNodes.map((c) => c.textContent).join(""); }
  set textContent(v) {
    for (const c of this.childNodes) c.parentNode = null;
    this.childNodes = [];
    this.append(String(v));
  }
  append(...nodes) {
    for (const n of nodes) {
      const x = typeof n === "string" ? new Text(n) : n;
      detach(x);
      x.parentNode = this;
      this.childNodes.push(x);
    }
  }
  replaceWith(node) {
    const p = this.parentNode;
    const i = p.childNodes.indexOf(this);
    detach(node);
    node.parentNode = p;
    p.childNodes.splice(i, 1, node);
    this.parentNode = null;
  }
  querySelectorAll(sel) {
    const out = [];
    const walk = (n) => {
      for (const c of n.childNodes) {
        if (c.nodeType !== 1) continue;
        if (matches(c, sel)) out.push(c);
        walk(c);
      }
    };
    walk(this);
    return out;
  }
  querySelector(sel) { return this.querySelectorAll(sel)[0] ?? null; }
}

/** A comma list of tags and [attr] tests: "h2, h3", "[id]", "a[href]". */
function matches(el, sel) {
  return sel.split(",").some((simple) => {
    const m = /^([a-z0-9]*)((?:\[[\w-]+\])*)$/i.exec(simple.trim());
    if (!m) throw new Error(`intro-text stub: selector "${simple}" isn't supported`);
    if (m[1] && el.tagName !== m[1].toUpperCase()) return false;
    for (const a of m[2].matchAll(/\[([\w-]+)\]/g)) if (!el.attrs.has(a[1])) return false;
    return true;
  });
}

function clone(n) {
  if (n.nodeType === 3) return new Text(n.nodeValue);
  const c = new Elem(n.tagName);
  for (const [k, v] of n.attrs) c.attrs.set(k, v);
  for (const k of n.childNodes) c.append(clone(k));
  return c;
}

globalThis.document = {
  createElement: (tag) => new Elem(tag),
  importNode: (n) => clone(n),
};

const { introText, keepsBook, heldAfterReference } = await import("../src/scripts/desk/intro-text.js");

/** An element with attributes and children, for building the intro's section. */
function node(tag, attrs = {}, ...kids) {
  const e = new Elem(tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  e.append(...kids);
  return e;
}

/** The `section.intro` a page holds, as loadIntro moves it out. */
const section = (...kids) => node("section", { class: "intro" }, ...kids);

test("headings move two levels down under the pane's own, keeping their text and inline markup", () => {
  const body = section(
    node("h2", { id: "a" }, "Structure"),
    node("h3", { id: "b" }, "The ", node("em", {}, "Letter")),
    node("h4", {}, "Date"),
  );
  const box = introText(body);
  assert.deepEqual(box.querySelectorAll("h2, h3").length, 0, "no heading keeps its old level");
  const heads = box.querySelectorAll("h4, h5, h6");
  assert.deepEqual(heads.map((h) => h.tagName), ["H4", "H5", "H6"]);
  assert.deepEqual(heads.map((h) => h.className), ["desk-intro__heading", "desk-intro__heading", "desk-intro__heading"]);
  assert.deepEqual(heads.map((h) => h.textContent), ["Structure", "The Letter", "Date"]);
  assert.equal(heads[1].querySelector("em").textContent, "Letter", "inline markup moves with its words");
});

test("ids are stripped from the copy, and the page's own section keeps them", () => {
  const body = section(
    node("p", { id: "p1" }, node("a", { id: "x", class: "sref", href: "/romans-8" }, "Romans 8")),
    node("span", { id: "s" }, "text"),
  );
  const box = introText(body);
  assert.equal(box.querySelectorAll("[id]").length, 0);
  const link = box.querySelector("a");
  assert.equal(link.getAttribute("class"), "sref", "other attributes stay, so the pane still finds a.sref");
  assert.equal(link.getAttribute("href"), "/romans-8");

  // The cached page text is copied, not moved, so a second show is the same.
  assert.equal(body.querySelector("a").getAttribute("id"), "x");
  assert.equal(body.querySelector("p").getAttribute("id"), "p1");
  assert.equal(introText(body).querySelectorAll("[id]").length, 0);
});

test("every link with an address opens a new tab with noopener noreferrer, and a link without one is left alone", () => {
  const body = section(
    node(
      "p",
      {},
      node("a", { class: "sref", href: "/romans-8", rel: "author" }, "Romans 8"),
      node("a", { href: "https://example.com" }, "a site"),
      node("a", { name: "anchor" }, "no address"),
    ),
  );
  const box = introText(body);
  const [inside, outside] = box.querySelectorAll("a[href]");
  for (const a of [inside, outside]) {
    assert.equal(a.getAttribute("target"), "_blank");
    assert.equal(a.getAttribute("rel"), "noopener noreferrer", "an authored rel is replaced");
  }
  const bare = box.querySelectorAll("a").find((a) => !a.getAttribute("href"));
  assert.equal(bare.getAttribute("target"), null);
  assert.equal(bare.getAttribute("rel"), null);
  assert.equal(body.querySelector("a").getAttribute("target"), null, "the page's own links are not changed");
});

test("the pane keeps its book while a reference sent the LIT to the book it holds", () => {
  // Romans's introduction, a reference to Galatians 2:11 clicked: held is Galatians.
  const held = heldAfterReference("romans", "galatians");
  assert.equal(held, "galatians");
  assert.equal(keepsBook(held, "galatians"), true, "the LIT shows the passage it sent; the pane stays");
  assert.equal(keepsBook(held, "romans"), false, "the LIT moved on to Romans itself: the pane follows");
  assert.equal(keepsBook(null, "galatians"), false, "with nothing held, every book moves the pane");
});

test("a reference inside the pane's own book holds nothing", () => {
  assert.equal(heldAfterReference("romans", "romans"), null);
  assert.equal(keepsBook(null, "romans"), false);
});
