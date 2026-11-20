// src/scripts/desk/record-words.js
//
// How a record's kind and a highlight's words are shown, shared by the
// panel's My Notes tab (tab-mine.js) and the notebook page's rows
// (record-rows.js) so the two never drift (Audit 8, LG8-7).

import { COLORS } from "../../lib/desk-records.mjs";
import { kindName } from "../../lib/desk-store-core.mjs";
import { splitQuoteIntoLines } from "../../lib/desk-quote-lines.mjs";

/** A highlight's color if the format knows it; null for anything else, which is shown plainly. */
export const colorOf = (r) => (r?.kind === "highlight" && COLORS.includes(r.color) ? r.color : null);

/** What a reader calls a record's kind: "Yellow highlight", or the plain kind name. */
export function nameOf(r) {
  const color = colorOf(r);
  return color ? `${color[0].toUpperCase()}${color.slice(1)} highlight` : kindName(r.kind);
}

/**
 * A highlight's words wearing its color: a swatch wrapped round a sample,
 * which desk.css tints (a tint only, the desk file's rule 7). A color the
 * format doesn't know gets plain text.
 */
export function highlightedWords(color, words) {
  if (!color) return document.createTextNode(words);
  const swatch = document.createElement("span");
  swatch.className = "desk-swatch";
  swatch.dataset.color = color;
  const sample = document.createElement("span");
  sample.className = "desk-swatch__sample";
  sample.textContent = words;
  swatch.append(sample);
  return swatch;
}

/* ── A highlight's words in the chapter's lines (E198) ─────────────────── */

/**
 * The lines of a chapter's verses `verse` to `endVerse`, each as its words, read
 * from the chapter's own page: a poetry line, a paragraph, or a run between
 * `<br>`s is one line; verse numbers and footnote letters are left out. Null
 * when the chapter can't be read (a draft, an offline fetch).
 */
export async function readChapterLines(bookKey, chapter, verse, endVerse = verse) {
  try {
    const { loadChapterPage } = await import("./chapter-page.js");
    const source = await loadChapterPage(bookKey, chapter);
    if (source.draft || !source.textBox) return null;
    const inRange = (el) => {
      const v = Number(el.getAttribute("data-verse"));
      return v >= verse && v <= endVerse;
    };
    const lines = [];
    for (const block of source.textBox.children) {
      const units = block.querySelectorAll(".hbq-line").length ? [...block.querySelectorAll(".hbq-line")] : [block];
      for (const unit of units) {
        const spans = [...unit.querySelectorAll("[data-verse]")].filter(inRange);
        if (!spans.length) continue;
        let text = "";
        for (const span of spans) {
          const copy = span.cloneNode(true);
          copy.querySelectorAll("sup.vn, sup.fn-ref, .vn-gap").forEach((n) => n.remove());
          copy.querySelectorAll("br").forEach((br) => br.replaceWith("\n"));
          text += copy.textContent;
        }
        for (const part of text.split("\n")) if (part.trim()) lines.push(part);
      }
    }
    return lines.length ? lines : null;
  } catch (_) {
    return null;
  }
}

/** Run `fn` when `el` nears the view (a margin below and above); at once where there is no IntersectionObserver. */
function whenNear(el, fn) {
  if (typeof IntersectionObserver !== "function") {
    fn();
    return;
  }
  const io = new IntersectionObserver((entries) => {
    if (!entries.some((e) => e.isIntersecting)) return;
    io.disconnect();
    fn();
  }, { rootMargin: "600px 0px" });
  io.observe(el);
}

/**
 * Once a highlight's row nears the view, read its chapter and break the tinted
 * words at the chapter's line boundaries (a poetry line, a paragraph), in place:
 * the same swatch and sample, the same tint, with a `<br>` between lines. The
 * flat words stay if the chapter can't be read, the quote isn't found in it, or
 * it falls on one line; nothing is said. A one-word quote can't span a line and
 * is never read.
 *
 * @param {HTMLElement} container the element holding `highlightedWords`' result
 * @param {object} record the highlight
 * @param {string} shown the words the row shows (possibly cut short with “…”)
 * @param {(bookKey: string, chapter: number, verse: number, endVerse: number) => Promise<string[] | null>} [read]
 */
export function keepLines(container, record, shown, read = readChapterLines) {
  const cut = /…$/.test(shown);
  const words = shown.replace(/…$/, "").trim();
  if (!words || !/\s/.test(words) || !record?.bookKey || !record.chapter || !record.verse) return;
  whenNear(container, async () => {
    let lines = null;
    try {
      lines = await read(record.bookKey, record.chapter, record.verse, record.endVerse ?? record.verse);
    } catch (_) {
      return;
    }
    const pieces = lines && splitQuoteIntoLines(lines, { exact: words, prefix: record.quote?.prefix });
    if (!pieces || pieces.length < 2) return;
    const target = container.querySelector(".desk-swatch__sample") ?? container.querySelector(".desk-swatch") ?? container;
    if (target === container && container.querySelector("a, button")) return;
    target.textContent = "";
    pieces.forEach((piece, i) => {
      if (i) target.append(document.createElement("br"));
      target.append(piece + (cut && i === pieces.length - 1 ? "…" : ""));
    });
  });
}
