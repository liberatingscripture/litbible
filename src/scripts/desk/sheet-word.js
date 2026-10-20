// src/scripts/desk/sheet-word.js
//
// "Copy for Word" on /sheets/ (STUDY-DESK.md, S9): the copy on screen as two
// clipboard flavors, HTML that Word, Google Docs and Pages take with its
// headings, italics, lists and the credit line, and plain text for anything
// else. Nothing is needed but the clipboard: no account, no file.
//
// It reads the copy sheet-copy.js drew, so what is pasted is what would print:
// the same parts, the same blanks (a line with the hint after it in brackets,
// since a word processor can't stack the hint beneath), the same footnotes
// beside their passage. The codes are left out; the chapters' addresses at the
// foot say the same thing in words. Styles are written inline, the one form
// every word processor reads, and named colors become the print colors.

import { plainBlank } from "../../lib/desk-sheet-copy.mjs";

const COLORS = { red: "#b3261e", blue: "#1d4fb8", green: "#0f6b33", purple: "#6b3fa0", gray: "#595e57" };
// The highlight tints as they look on white, which is what sheets-page.css prints.
const MARKS = { yellow: "#ffeea3", green: "#ddefb2", blue: "#cfe4ff", pink: "#ffd9e9" };
const SIZES = { small: "0.85em", large: "1.2em", larger: "1.45em" };
const INLINE = new Set(["em", "strong", "u", "s", "sub", "a"]);
const BLOCKS = new Set(["p", "h2", "h3", "blockquote", "ul", "ol", "li"]);
const RULE = "_".repeat(60);

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const attr = (s) => esc(s).replace(/"/g, "&quot;");

/** Collapse source whitespace the way a browser would, for the plain flavor. */
const squash = (s) => s.replace(/[ \t\r\n]+/g, " ");

/**
 * The copy as { html, text }.
 *
 * @param {HTMLElement} article a copy from renderCopy
 */
export function copyForWord(article) {
  const html = [];
  const text = [];
  let line = "";
  const flush = () => {
    const t = line.replace(/[ \t]+/g, " ").replace(/ ?\n ?/g, "\n").trim();
    if (t) text.push(t);
    line = "";
  };

  /** Inline content: a node's children as HTML, adding their words to `line`. */
  function inline(node) {
    let out = "";
    for (const n of node.childNodes) {
      if (n.nodeType === Node.TEXT_NODE) {
        out += esc(n.nodeValue);
        line += squash(n.nodeValue);
        continue;
      }
      if (n.nodeType !== Node.ELEMENT_NODE) continue;
      const tag = n.tagName.toLowerCase();
      if (n.matches(".sheet-blank")) {
        const hint = n.dataset.hint || "";
        const answer = n.querySelector(".sheet-blank__line")?.textContent ?? "";
        if (n.matches(".sheet-blank--leader") && answer.trim()) {
          out += `<u><b>${esc(answer)}</b></u>${hint ? ` <span style="font-size:0.8em">(${esc(hint)})</span>` : ""}`;
          line += `[${answer}]${hint ? ` (${hint})` : ""}`;
        } else {
          out += `<u>${"&nbsp;".repeat(16)}</u>${hint ? ` <span style="font-size:0.8em">(${esc(hint)})</span>` : ""}`;
          line += plainBlank(hint);
        }
        continue;
      }
      if (tag === "br") {
        out += "<br>";
        line += "\n";
        continue;
      }
      if (tag === "sup") {
        const t = n.textContent.trim();
        if (!t) continue;
        const vn = n.matches(".vn");
        out += vn ? `<sup><b>${esc(t)}</b></sup>&nbsp;` : `<sup>${esc(t)}</sup>`;
        line += vn ? `${t} ` : `[${t}]`;
        continue;
      }
      if (n.matches(".vn-gap")) {
        continue; // the verse number above carries its own space
      }
      if (INLINE.has(tag)) {
        const inner = inline(n);
        if (tag === "a") {
          const href = n.getAttribute("href") ?? "";
          const abs = href.startsWith("/") ? `https://litbible.net${href}` : href;
          out += /^(https?:|mailto:)/.test(abs) ? `<a href="${attr(abs)}">${inner}</a>` : inner;
        } else {
          out += `<${tag}>${inner}</${tag}>`;
        }
        continue;
      }
      if (tag === "span") {
        const style = [];
        if (COLORS[n.dataset.color]) style.push(`color:${COLORS[n.dataset.color]}`);
        if (MARKS[n.dataset.mark]) style.push(`background-color:${MARKS[n.dataset.mark]}`);
        if (SIZES[n.dataset.size]) style.push(`font-size:${SIZES[n.dataset.size]}`);
        const inner = inline(n);
        out += style.length ? `<span style="${style.join(";")}">${inner}</span>` : inner;
        continue;
      }
      out += inline(n);
    }
    return out;
  }

  /** A block and what it holds. */
  function block(node, extraStyle = "") {
    const tag = node.tagName.toLowerCase();
    if (tag === "hr") {
      html.push("<hr>");
      flush();
      text.push("———");
      return;
    }
    if (tag === "ul" || tag === "ol") {
      html.push(`<${tag}>`);
      for (const li of node.children) if (li.tagName.toLowerCase() === "li") listItem(li, tag === "ol" ? "1." : "•");
      html.push(`</${tag}>`);
      return;
    }
    if (tag === "blockquote") {
      // A poetry quotation (hbq) sets one line per paragraph, indented.
      const poetry = node.classList.contains("hbq");
      if (!poetry) html.push("<blockquote>");
      for (const child of node.children) block(child, poetry ? "margin:0 0 0 2em" : "");
      if (!poetry) html.push("</blockquote>");
      return;
    }
    const style = [];
    if (extraStyle) style.push(extraStyle);
    const align = node.dataset?.align;
    if (align) style.push(`text-align:${align}`);
    const out = BLOCKS.has(tag) ? tag : "p";
    html.push(`<${out}${style.length ? ` style="${style.join(";")}"` : ""}>${inline(node)}</${out}>`);
    flush();
  }

  function listItem(li, marker) {
    let inner = "";
    const before = line;
    line = "";
    for (const n of li.childNodes) {
      if (n.nodeType === Node.ELEMENT_NODE && /^(ul|ol)$/i.test(n.tagName)) continue;
      const wrap = document.createElement("span");
      wrap.append(n.cloneNode(true));
      inner += inline(wrap);
    }
    const t = line.trim();
    line = before;
    flush();
    if (t) text.push(`${marker} ${t}`);
    const nested = [...li.children].filter((c) => /^(ul|ol)$/i.test(c.tagName));
    html.push(`<li>${inner}`);
    for (const list of nested) block(list);
    html.push("</li>");
  }

  function rich(box) {
    for (const child of box.children) block(child);
  }

  function lines(box) {
    for (const _ of box.querySelectorAll(".sheet-copy__line")) {
      html.push(`<p style="color:#888">${RULE}</p>`);
      text.push(RULE);
    }
  }

  function tag(section) {
    const t = section.querySelector(":scope > .sheet-copy__tag");
    if (!t) return;
    html.push(`<p><i>${esc(t.textContent)}</i></p>`);
    text.push(`(${t.textContent})`);
  }

  for (const part of article.children) {
    if (part.matches(".sheet-copy__head")) {
      const title = part.querySelector(".sheet-copy__title")?.textContent ?? "";
      const sub = part.querySelector(".sheet-copy__subtitle")?.textContent ?? "";
      html.push(`<h1>${esc(title)}</h1>`);
      text.push(title);
      if (sub) {
        html.push(`<p><i>${esc(sub)}</i></p>`);
        text.push(sub);
      }
    } else if (part.matches(".sheet-copy__passage")) {
      const ref = part.querySelector(".sheet-copy__ref")?.textContent ?? "";
      html.push(`<h2>${esc(ref)}</h2>`);
      text.push("", ref);
      tag(part.querySelector(".sheet-copy__passage-head") ?? part);
      const words = part.querySelector(".sheet-copy__words");
      if (words) for (const b of words.children) block(b);
      for (const missing of part.querySelectorAll(":scope > .sheet-copy__missing")) block(missing);
      for (const note of part.querySelectorAll(".sheet-copy__note")) {
        const label = note.querySelector(".sheet-copy__note-label")?.textContent ?? "";
        const body = note.querySelector(".sheet-copy__note-text");
        html.push(`<p style="font-size:0.85em;margin-left:1em"><sup>${esc(label)}</sup> ${body ? inline(body) : ""}</p>`);
        line = `[${label}] ${line}`;
        flush();
      }
    } else if (part.matches(".sheet-copy__text")) {
      tag(part);
      text.push("");
      for (const box of part.querySelectorAll(":scope > .desk-rich")) rich(box);
    } else if (part.matches(".sheet-copy__question")) {
      tag(part);
      text.push("");
      for (const box of part.querySelectorAll(":scope > .desk-rich")) rich(box);
      const answer = part.querySelector(".sheet-copy__answer .desk-rich");
      if (answer) {
        html.push(`<p style="margin-left:1em"><b>Answer</b></p>`);
        text.push("Answer:");
        rich(answer);
      }
      const ruled = part.querySelector(".sheet-copy__lines");
      if (ruled) lines(ruled);
    } else if (part.matches(".sheet-copy__space")) {
      tag(part);
      const ruled = part.querySelector(".sheet-copy__lines");
      if (ruled) lines(ruled);
    } else if (part.matches(".sheet-copy__terms")) {
      tag(part);
      html.push("<h2>Key terms</h2>");
      text.push("", "Key terms");
      const list = part.querySelector(".sheet-copy__term-list");
      if (list) block(list);
      const note = part.querySelector(".sheet-copy__terms-note, .sheet-copy__missing");
      if (note) block(note);
    } else if (part.matches(".sheet-copy__break")) {
      html.push('<br clear="all" style="page-break-before:always">');
      text.push("");
    } else if (part.matches(".sheet-copy__foot")) {
      text.push("");
      for (const p of part.children) {
        html.push(`<p style="font-size:0.85em">${inline(p)}</p>`);
        flush();
      }
    } else if (part.matches(".sheet-copy__missing")) {
      block(part);
    }
  }

  return {
    html: `<meta charset="utf-8"><div style="font-family:Georgia,'Times New Roman',serif">${html.join("\n")}</div>`,
    text: text.join("\n").replace(/\n{3,}/g, "\n\n").trim() + "\n",
  };
}
