// A menu's unavailable lines, read aloud (src/scripts/desk/menu-reasons.js),
// driven with a small stub tree: Audit 3 follow-up to DK3-7.
import test from "node:test";
import assert from "node:assert/strict";
import { describeUnavailable, unavailableSentences } from "../src/scripts/desk/menu-reasons.js";

class Node {
  constructor(tag, doc) {
    this.tag = tag;
    this.ownerDocument = doc;
    this.attrs = new Map();
    this.children = [];
    this.parent = null;
    this.className = "";
    this.id = "";
    this.textContent = "";
  }
  setAttribute(k, v) { this.attrs.set(k, String(v)); }
  getAttribute(k) { return this.attrs.has(k) ? this.attrs.get(k) : null; }
  removeAttribute(k) { this.attrs.delete(k); }
  append(...kids) { for (const k of kids) { k.parent = this; this.children.push(k); } }
  after(n) {
    n.parent = this.parent;
    this.parent.children.splice(this.parent.children.indexOf(this) + 1, 0, n);
  }
  remove() { if (this.parent) this.parent.children.splice(this.parent.children.indexOf(this), 1); this.parent = null; }
  closest(sel) {
    const role = /\[role="(\w+)"\]/.exec(sel)?.[1];
    for (let n = this; n; n = n.parent) if (n.getAttribute("role") === role) return n;
    return null;
  }
  all() { return this.children.flatMap((c) => [c, ...c.all()]); }
  querySelectorAll(sel) {
    return this.all().filter((n) => (sel.includes("aria-disabled") && n.getAttribute("aria-disabled") === "true"));
  }
  querySelector(sel) {
    const cls = sel.slice(1);
    return this.all().find((n) => n.className.split(" ").includes(cls)) ?? null;
  }
}

const doc = { createElement: (tag) => new Node(tag, doc) };
const node = (tag, cls = "", text = "") => {
  const n = doc.createElement(tag);
  n.className = cls;
  n.textContent = text;
  return n;
};
const menu = () => {
  const root = node("div");
  const m = node("div");
  m.setAttribute("role", "menu");
  root.append(m);
  return { root, m };
};
const line = (label, why, disabled = true) => {
  const b = node("button");
  b.append(node("span", "desk-title__label", label));
  if (why != null) b.append(node("span", "desk-title__hint", why));
  if (disabled) b.setAttribute("aria-disabled", "true");
  return b;
};

test("one short sentence per disabled line with a reason", () => {
  assert.deepEqual(
    unavailableSentences([
      { label: "Add pane", why: "Needs a larger window" },
      { label: "Move", why: "Four is the most." },
      { label: "Busy", why: "" },
      { label: "", why: "x" },
    ]),
    ["Add pane is unavailable: needs a larger window.", "Move is unavailable: four is the most."],
  );
});

test("the menu is described by a hidden note, and it follows the lines", () => {
  const { root, m } = menu();
  const add = line("Add pane", "Needs a larger window");
  const open = line("Layout…", null, false);
  m.append(add, open);
  const r = describeUnavailable(m, { id: "why1" });
  assert.equal(m.getAttribute("aria-describedby"), "why1");
  assert.equal(r.note.id, "why1");
  assert.equal(r.note.className, "sr-only");
  assert.equal(r.note.textContent, "Add pane is unavailable: needs a larger window.");
  assert.equal(root.children[1], r.note, "beside the menu, not in it");

  // The reason changes while the menu is open.
  add.querySelector(".desk-title__hint").textContent = "Four is the most";
  r.refresh();
  assert.equal(r.note.textContent, "Add pane is unavailable: four is the most.");

  // The line becomes available: no description at all.
  add.removeAttribute("aria-disabled");
  r.refresh();
  assert.equal(r.note.textContent, "");
  assert.equal(m.getAttribute("aria-describedby"), null);

  // And unavailable again; a second line joins the first.
  add.setAttribute("aria-disabled", "true");
  open.setAttribute("aria-disabled", "true");
  open.append(node("span", "desk-title__hint", "Nothing to lay out"));
  r.refresh();
  assert.equal(r.note.textContent, "Add pane is unavailable: four is the most. Layout… is unavailable: nothing to lay out.");
});

test("a disabled line with no reason adds nothing", () => {
  const { m } = menu();
  m.append(line("Save", null), line("Stop", ""));
  const r = describeUnavailable(m, { id: "why2" });
  assert.equal(r.note.textContent, "");
  assert.equal(m.getAttribute("aria-describedby"), null);
});

test("a nested menu describes itself, not its parent", () => {
  const { m } = menu();
  const fly = node("div");
  fly.setAttribute("role", "menu");
  fly.append(line("Add column", "Needs a wider window"));
  m.append(fly);
  const r = describeUnavailable(m, { id: "why3" });
  assert.equal(r.note.textContent, "");
});

test("destroy takes the note and the description away", () => {
  const { root, m } = menu();
  m.append(line("Add pane", "Needs a larger window"));
  const r = describeUnavailable(m, { id: "why4" });
  r.destroy();
  assert.equal(root.children.length, 1);
  assert.equal(m.getAttribute("aria-describedby"), null);
});
