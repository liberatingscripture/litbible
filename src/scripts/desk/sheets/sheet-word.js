// src/scripts/desk/sheets/sheet-word.js
//
// The copy on screen read into a document (STUDY-DESK.md, S9; E37), for the
// "Copy" button on /sheets/ (E36 renamed it from "Copy for Word") and for the
// files under "Save as". `readCopy` walks the copy sheet-copy.js drew into
// the neutral model of src/lib/desk-sheet-doc.mjs; Copy is that model written
// as two clipboard flavors, HTML that Word, Google Docs and Pages take with
// its headings, italics, lists and the credit line, and plain text for
// anything else. Nothing is needed but the clipboard: no account, no file.
//
// Reading the copy on screen is what makes a paste or a file match what would
// print: the same parts, the same blanks (a line with the hint after it in
// brackets, since a word processor can't stack the hint beneath), the same
// footnotes beside their passage. Copy leaves the codes out; the chapters'
// addresses at the foot say the same thing in words. The files carry them,
// when the page shows them.

import { DOC_COLORS, DOC_MARKS, DOC_SIZES, docHref, docHtml, docText } from "../../../lib/desk-sheet-doc.mjs";
import { unpaged } from "./sheet-pages.js";

const INLINE = new Set(["em", "strong", "u", "s", "sub", "a"]);
// <b> and <i> are what the chapters' own footnotes use (GF8c-3).
const ALIAS = { b: "strong", i: "em" };
const BLOCKISH = new Set(["div", "p"]);
const isList = (n) => n.nodeType === Node.ELEMENT_NODE && /^(ul|ol)$/i.test(n.tagName);

/** A node list's inline pieces (the model's inline tree). */
export function inlines(nodes) {
  const out = [];
  let ownBreak = false; // the last thing out is a break this function added after a block
  for (const n of nodes) {
    if (ownBreak && !(n.nodeType === Node.ELEMENT_NODE && BLOCKISH.has(n.tagName.toLowerCase()))) ownBreak = false;
    if (n.nodeType === Node.TEXT_NODE) {
      out.push({ t: "text", text: n.nodeValue });
      continue;
    }
    if (n.nodeType !== Node.ELEMENT_NODE) continue;
    let tag = n.tagName.toLowerCase();
    if (ALIAS[tag]) tag = ALIAS[tag];
    if (BLOCKISH.has(tag)) {
      // A note's own blocks each take a line, as on paper (the 1 Corinthians 11 chiasm).
      if (out.length && out[out.length - 1].t !== "br") out.push({ t: "br" });
      out.push(...inlines(n.childNodes));
      if (out.length && out[out.length - 1].t !== "br") out.push({ t: "br" });
      ownBreak = true;
      continue;
    }
    if (n.matches(".sheet-blank")) {
      const answer = n.querySelector(".sheet-blank__line")?.textContent ?? "";
      const leader = n.matches(".sheet-blank--leader") && answer.trim();
      out.push({ t: "blank", answer: leader ? answer : null, hint: n.dataset.hint || "" });
      continue;
    }
    if (tag === "br") {
      out.push({ t: "br" });
      continue;
    }
    if (tag === "sup") {
      // A verse number or a footnote letter is the copy's own; any other
      // superscript is the reader's ("1st", "x²"), kept as raised words (DK3-5).
      if (n.matches(".vn, .fn-ref, .sheet-copy__fnref")) {
        const text = n.textContent.trim();
        if (text) out.push({ t: n.matches(".vn") ? "vn" : "fn", text });
      } else {
        const kids = inlines(n.childNodes);
        if (kids.length) out.push({ t: "sup", kids });
      }
      continue;
    }
    if (n.matches(".vn-gap")) continue; // the verse number above carries its own space
    if (INLINE.has(tag)) {
      const kids = inlines(n.childNodes);
      if (tag !== "a") {
        out.push({ t: tag, kids });
        continue;
      }
      const href = n.getAttribute("href") ?? "";
      const abs = docHref(href.startsWith("/") ? `https://litbible.net${href}` : href);
      if (abs) out.push({ t: "link", href: abs, kids });
      else out.push(...kids);
      continue;
    }
    if (tag === "span") {
      const kids = inlines(n.childNodes);
      if (n.matches(".chiasm-key")) kids.push({ t: "text", text: " " }); // "A:" and its words are two spans
      const style = {};
      if (DOC_COLORS[n.dataset.color]) style.color = n.dataset.color;
      if (DOC_MARKS[n.dataset.mark]) style.mark = n.dataset.mark;
      if (DOC_SIZES[n.dataset.size]) style.size = n.dataset.size;
      if (Object.keys(style).length) out.push({ t: "style", ...style, kids });
      else out.push(...kids);
      continue;
    }
    out.push(...inlines(n.childNodes));
  }
  if (ownBreak && out[out.length - 1]?.t === "br") out.pop();
  return out;
}

/** A block and what it holds, onto `out`. A poetry quotation (hbq) sets one indented line per paragraph. */
export function block(node, out, poetry = false) {
  const tag = node.tagName.toLowerCase();
  if (tag === "hr") {
    out.push({ type: "rule" });
    return;
  }
  if (tag === "ul" || tag === "ol") {
    const items = [];
    for (const li of node.children) {
      if (li.tagName.toLowerCase() !== "li") continue;
      const lists = [];
      for (const list of li.children) if (isList(list)) block(list, lists);
      items.push({ inlines: inlines([...li.childNodes].filter((n) => !isList(n))), lists });
    }
    out.push({ type: "list", ordered: tag === "ol", items });
    return;
  }
  if (tag === "blockquote") {
    if (node.classList.contains("hbq")) {
      for (const child of node.children) block(child, out, true);
    } else {
      const blocks = [];
      for (const child of node.children) block(child, blocks);
      out.push({ type: "quote", blocks });
    }
    return;
  }
  const b = tag === "h2" || tag === "h3"
    ? { type: "heading", level: Number(tag[1]), inlines: inlines(node.childNodes) }
    : { type: "para", inlines: inlines(node.childNodes) };
  if (node.dataset?.align) b.align = node.dataset.align;
  if (poetry) b.poetry = true;
  out.push(b);
}

/**
 * The copy on screen as the document model (desk-sheet-doc.mjs).
 *
 * @param {HTMLElement} article a copy from renderCopy
 * @returns {{ title: string, blocks: object[], size: number }} `size`: the sheet's text size in points (E101)
 */
export function readCopy(article) {
  // The screen's page spacers (sheet-pages.js) are no part of the copy.
  article = unpaged(article);
  const blocks = [];
  let title = "";
  const tag = (section) => {
    const t = section.querySelector(":scope > .sheet-copy__tag");
    if (t) blocks.push({ type: "tag", text: t.textContent });
  };
  const rich = (box) => {
    for (const child of box.children) block(child, blocks);
  };
  const lines = (part) => {
    const ruled = part.querySelector(".sheet-copy__lines");
    if (ruled) blocks.push({ type: "lines", count: ruled.querySelectorAll(".sheet-copy__line").length });
  };

  for (const part of article.children) {
    if (part.matches(".sheet-copy__head")) {
      title = part.querySelector(".sheet-copy__title")?.textContent ?? "";
      const sub = part.querySelector(".sheet-copy__subtitle")?.textContent ?? "";
      blocks.push({ type: "title", text: title });
      if (sub) blocks.push({ type: "subtitle", text: sub });
    } else if (part.matches(".sheet-copy__passage")) {
      blocks.push({ type: "section", text: part.querySelector(".sheet-copy__ref")?.textContent ?? "" });
      tag(part.querySelector(".sheet-copy__passage-head") ?? part);
      const code = part.querySelector(":scope > .sheet-copy__code");
      if (code) {
        blocks.push({
          type: "code",
          svg: code.querySelector(".sheet-copy__code-art")?.innerHTML ?? "",
          caption: code.querySelector("figcaption")?.textContent ?? "",
          label: code.querySelector("svg")?.getAttribute("aria-label") ?? "A code to scan",
        });
      }
      const words = part.querySelector(".sheet-copy__words");
      if (words) for (const b of words.children) block(b, blocks);
      for (const missing of part.querySelectorAll(":scope > .sheet-copy__missing")) block(missing, blocks);
      for (const note of part.querySelectorAll(".sheet-copy__note")) {
        const body = note.querySelector(".sheet-copy__note-text");
        blocks.push({
          type: "note",
          label: note.querySelector(".sheet-copy__note-label")?.textContent ?? "",
          inlines: body ? inlines(body.childNodes) : [],
        });
      }
    } else if (part.matches(".sheet-copy__text")) {
      tag(part);
      blocks.push({ type: "gap" });
      for (const box of part.querySelectorAll(":scope > .desk-rich")) rich(box);
    } else if (part.matches(".sheet-copy__question")) {
      tag(part);
      blocks.push({ type: "gap" });
      for (const box of part.querySelectorAll(":scope > .desk-rich")) rich(box);
      const answer = part.querySelector(".sheet-copy__answer .desk-rich");
      if (answer) {
        blocks.push({ type: "answer" });
        rich(answer);
      }
      lines(part);
    } else if (part.matches(".sheet-copy__space")) {
      tag(part);
      lines(part);
    } else if (part.matches(".sheet-copy__terms")) {
      tag(part);
      const box = { type: "box", blocks: [{ type: "section", text: "Key terms", flush: true }] };
      const list = part.querySelector(".sheet-copy__term-list");
      if (list) block(list, box.blocks);
      const note = part.querySelector(".sheet-copy__terms-note, .sheet-copy__missing");
      if (note) block(note, box.blocks);
      blocks.push(box);
    } else if (part.matches(".sheet-copy__key")) {
      // The leader's optional answer key: a page of its own (E100), a
      // heading, then a line per passage.
      blocks.push({ type: "break" });
      blocks.push({ type: "section", text: part.querySelector(".sheet-copy__key-title")?.textContent ?? "Answer key" });
      for (const row of part.querySelectorAll(".sheet-copy__key-row")) blocks.push({ type: "para", inlines: inlines(row.childNodes) });
    } else if (part.matches(".sheet-copy__break")) {
      blocks.push({ type: "break" });
    } else if (part.matches(".sheet-copy__foot")) {
      blocks.push({ type: "gap" });
      for (const p of part.children) {
        const foot = { type: "foot", inlines: inlines(p.childNodes) };
        if (p.matches(".sheet-copy__credit")) foot.credit = true;
        blocks.push(foot);
      }
    } else if (part.matches(".sheet-copy__missing")) {
      block(part, blocks);
    }
  }
  return { title, blocks, size: Number(article.dataset.textSize) || 12 };
}

/**
 * The copy as { html, text }, for the clipboard.
 *
 * @param {HTMLElement} article a copy from renderCopy
 */
export function copyForWord(article) {
  const doc = readCopy(article);
  return { html: docHtml(doc), text: docText(doc) };
}
