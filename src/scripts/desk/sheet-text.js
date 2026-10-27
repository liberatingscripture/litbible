// src/scripts/desk/sheet-text.js
//
// The formatted-text editor of the sheet editor on /desk (STUDY-DESK.md, D9;
// "Order of work", 3f): a toolbar and a contenteditable area for a sheet's
// `text` and `question` modules, whose html is the one canonical form
// STUDY-DESK-FORMAT.md ("Formatted text") defines and
// src/lib/desk-sheet-format.mjs enforces.
//
// The rules it keeps:
//  - The editor never decides what is saved. Whatever the area holds is
//    reported through sanitizeSheetHtml, the same function every client
//    uses, so what the reader sees and what is stored can only differ where
//    the format drops something. A lone empty paragraph is reported as "".
//  - It never replaces the area's DOM while the reader is typing. The caller
//    saves the sanitized form, and calls setHtml only when the editor does not
//    have focus (a change from another tab, an undo).
//  - Nothing is reported twice: a value equal to the last one reported or
//    given is not sent again. Changes go out 400 ms after the last input, and
//    at once on flush(), on focus leaving the whole editor, and on destroy().
//  - Pasted or dropped text is read by pastedSheetHtml (the sanitizer, plus
//    what Google Docs, Word and web pages mean) before it goes in, so a paste
//    can't bring in a style, an image, or a tag the format doesn't have.
//  - The toolbar is one tab stop (the WAI-ARIA toolbar pattern, arrow keys
//    inside it). A button press never takes focus from the text: the
//    selection is remembered, and put back before an action is applied.
//  - Styles are names. A span carries data-font, data-size, data-color or
//    data-mark and nothing else; how "red" looks is the stylesheet's
//    business (desk.css, `.desk-rich`).
//
// The browser commands bold, italic, lists and the like go through
// document.execCommand: deprecated, but present in every browser the
// preview targets, and the only way to keep the browser's own undo working
// for them. The named styles, text alignment, the horizontal line and
// un-quoting edit the DOM directly, so the browser's undo steps over them.

import { ALIGNMENTS, SPAN_STYLES, pastedSheetHtml, sanitizeSheetHtml } from "../../lib/desk-sheet-format.mjs";

const STYLE_KEYS = Object.keys(SPAN_STYLES);
const SAVE_DELAY = 400;
const MAX_LIST_DEPTH = 3;
const EMPTY_BLOCK = "<p><br></p>";

const STYLE_LABELS = {
  font: { sans: "Sans", serif: "Serif", display: "Display", handwriting: "Handwriting", atkinson: "Atkinson Hyperlegible" },
  size: { small: "Small", large: "Large", larger: "Larger" },
  color: { red: "Red", blue: "Blue", green: "Green", purple: "Purple", gray: "Gray" },
  mark: { yellow: "Yellow", green: "Green", blue: "Blue", pink: "Pink" },
};
const STYLE_GROUP_NAMES = { font: "Font", size: "Size", color: "Color", mark: "Background" };
/** The item that means "no attribute" in each group, and where it sits in the list. */
const STYLE_DEFAULTS = { font: ["Default", 0], size: ["Normal", 1], color: ["Default", 0], mark: ["None", 0] };
const ALIGN_LABELS = { center: "Center", right: "Right", justify: "Justified" };

const ICONS = {
  link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
  ul: '<circle cx="4" cy="6" r="1.4" fill="currentColor" stroke="none"/><circle cx="4" cy="12" r="1.4" fill="currentColor" stroke="none"/><circle cx="4" cy="18" r="1.4" fill="currentColor" stroke="none"/><path d="M9 6h12M9 12h12M9 18h12"/>',
  ol: '<text x="1" y="8" font-size="7" fill="currentColor" stroke="none">1</text><text x="1" y="14" font-size="7" fill="currentColor" stroke="none">2</text><text x="1" y="20" font-size="7" fill="currentColor" stroke="none">3</text><path d="M9 6h12M9 12h12M9 18h12"/>',
  indent: '<path d="M3 5h18M12 10h9M12 14h9M3 19h18"/><path d="M3 9l4 3-4 3z" fill="currentColor"/>',
  outdent: '<path d="M3 5h18M12 10h9M12 14h9M3 19h18"/><path d="M7 9l-4 3 4 3z" fill="currentColor"/>',
  left: '<path d="M3 5h18M3 10h11M3 15h18M3 20h11"/>',
  center: '<path d="M3 5h18M7 10h10M3 15h18M7 20h10"/>',
  right: '<path d="M3 5h18M10 10h11M3 15h18M10 20h11"/>',
  justify: '<path d="M3 5h18M3 10h18M3 15h18M3 20h18"/>',
  hr: '<path d="M3 12h18"/><path d="M7 6h10M7 18h10" opacity="0.45"/>',
  clear: '<path d="M6 5h12M12 5l-3 14M9 19h6"/><path d="M4 4l16 16"/>',
};

/** An element with a class and, optionally, text. */
function make(tag, cls, text) {
  const el = document.createElement(tag);
  if (cls) el.className = cls;
  if (text !== undefined) el.textContent = text;
  return el;
}

function icon(name) {
  const span = make("span", "desk-rich-icon");
  span.setAttribute("aria-hidden", "true");
  span.innerHTML = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"
    stroke-linecap="round" stroke-linejoin="round" focusable="false">${ICONS[name]}</svg>`;
  return span;
}

const escText = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const escAttr = (s) => escText(s).replace(/"/g, "&quot;");

/** A link address the sheet can keep, from what the reader typed; null when it is none. */
function normalizeAddress(raw) {
  const v = raw.trim();
  if (!v || /[\s<>"]/.test(v)) return null;
  if (/^(?:https?:\/\/|mailto:)\S+/i.test(v)) return v;
  if (v.startsWith("/") && !v.startsWith("//") && !v.startsWith("/\\")) return v;
  if (/^[^\s@/:]+@[^\s@/:]+\.[^\s@/:]+$/.test(v)) return `mailto:${v}`;
  if (/^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}(?::\d+)?(?:[/?#]\S*)?$/i.test(v)) return `https://${v}`;
  return null;
}

/** Plain text as paragraphs (blank lines) and line breaks (single newlines). */
function plainToHtml(text) {
  return text
    .replace(/\r\n?/g, "\n")
    .split(/\n{2,}/)
    .map((p) => p.replace(/^\n+|\n+$/g, ""))
    .filter(Boolean)
    .map((p) => `<p>${escText(p).replace(/\n/g, "<br>")}</p>`)
    .join("");
}

/** Whether a drag under way began in a sheet's own text (any editor's); its drop is the browser's. */
let draggingText = false;

/** A collapsed range where a drop at (x, y) lands, or null. */
function caretAt(x, y) {
  const pos = document.caretPositionFromPoint?.(x, y);
  if (pos?.offsetNode) {
    const range = document.createRange();
    range.setStart(pos.offsetNode, pos.offset);
    return range;
  }
  return document.caretRangeFromPoint?.(x, y) ?? null;
}

/** The inside of html that is one plain paragraph, so a paste can join the line it lands in; else null. */
function singleParagraphInner(html) {
  const m = /^<p(?: data-align="[a-z]+")?>([\s\S]*)<\/p>$/.exec(html);
  if (!m || /<\/?(?:p|h2|h3|ul|ol|li|blockquote|hr)[\s>]/.test(m[1])) return null;
  return m[1];
}

function exec(command, value) {
  try {
    return document.execCommand(command, false, value);
  } catch {
    return false;
  }
}

function queryState(command) {
  try {
    return document.queryCommandState(command);
  } catch {
    return false;
  }
}

/**
 * The formatted-text editor for a sheet's text modules.
 *
 * @param {{ html: string, label: string, placeholder?: string, idPrefix: string,
 *   onChange: (html: string) => void }} options
 *   `html` is the starting text (sanitized on the way in); `label` names the
 *   text for a screen reader ("Text", "Question"); `idPrefix` keeps ids apart
 *   from other editors on the page; `onChange` gets the sanitized html.
 * @returns {{ el: HTMLElement, setHtml(html: string): void, focus(): void,
 *   hasFocus(): boolean, flush(): void, destroy(): void }}
 */
export function createSheetText({ html, label, placeholder, idPrefix, onChange }) {
  const el = make("div", "desk-rich-editor");
  const toolbar = make("div", "desk-rich-toolbar");
  const editable = make("div", "desk-rich");
  const status = make("div", "desk-rich-status");
  const editableId = `${idPrefix}-text`;

  toolbar.id = `${idPrefix}-toolbar`;
  toolbar.setAttribute("role", "toolbar");
  toolbar.setAttribute("aria-label", `Formatting for ${label}`);
  toolbar.setAttribute("aria-controls", editableId);

  editable.id = editableId;
  editable.contentEditable = "true";
  editable.setAttribute("role", "textbox");
  editable.setAttribute("aria-multiline", "true");
  editable.setAttribute("aria-label", label);
  editable.spellcheck = true;
  if (placeholder) editable.dataset.placeholder = placeholder;

  status.setAttribute("role", "status");
  status.setAttribute("aria-live", "polite");

  /** The canonical form of html, with a lone empty paragraph read as no text. */
  function canon(source) {
    const clean = sanitizeSheetHtml(source);
    return clean === EMPTY_BLOCK ? "" : clean;
  }

  let last = canon(html);
  let dirty = false;
  let timer = 0;
  let statusTimer = 0;
  let lastRange = null;
  let openMenu = null;
  let linkAnchor = null;

  /* ── Reporting changes ───────────────────────────────────────── */

  function emit() {
    clearTimeout(timer);
    timer = 0;
    dirty = false;
    const now = canon(editable.innerHTML);
    if (now === last) return;
    last = now;
    onChange(now);
  }

  function isEmpty() {
    return editable.children.length <= 1 && !editable.textContent.trim() && !editable.querySelector("hr, ul, ol, blockquote");
  }

  function updateEmpty() {
    editable.toggleAttribute("data-empty", isEmpty());
  }

  function changed() {
    dirty = true;
    updateEmpty();
    clearTimeout(timer);
    timer = setTimeout(emit, SAVE_DELAY);
  }

  function say(message) {
    status.textContent = message;
    clearTimeout(statusTimer);
    statusTimer = setTimeout(() => {
      status.textContent = "";
    }, 5000);
  }

  function load(source) {
    const clean = canon(source);
    editable.innerHTML = clean || EMPTY_BLOCK;
    last = clean;
    dirty = false;
    clearTimeout(timer);
    timer = 0;
    lastRange = null;
    updateEmpty();
  }

  /* ── The selection ───────────────────────────────────────────── */

  const selection = () => document.getSelection();

  /** The live selection's range when it lies in the text, else null. */
  function rangeInside() {
    const sel = selection();
    if (!sel || !sel.rangeCount) return null;
    const range = sel.getRangeAt(0);
    return editable.contains(range.commonAncestorContainer) ? range : null;
  }

  function placeCaret(node, offset) {
    const range = document.createRange();
    range.setStart(node, offset);
    range.collapse(true);
    const sel = selection();
    sel.removeAllRanges();
    sel.addRange(range);
    lastRange = range.cloneRange();
  }

  function caretToEnd() {
    const range = document.createRange();
    range.selectNodeContents(editable);
    range.collapse(false);
    const sel = selection();
    sel.removeAllRanges();
    sel.addRange(range);
    lastRange = range.cloneRange();
  }

  function prepareCommands() {
    exec("styleWithCSS", false);
    exec("defaultParagraphSeparator", "p");
  }

  /** Focus the text with the selection the reader had; the end of the text if there was none. */
  function restore() {
    prepareCommands();
    editable.focus({ preventScroll: true });
    if (lastRange && editable.contains(lastRange.commonAncestorContainer)) {
      const sel = selection();
      sel.removeAllRanges();
      sel.addRange(lastRange.cloneRange());
    } else {
      caretToEnd();
    }
  }

  /** Run an action on the remembered selection, then bring the toolbar up to date. */
  function act(fn) {
    restore();
    fn();
    const range = rangeInside();
    if (range) lastRange = range.cloneRange();
    changed();
    refresh();
  }

  const closestIn = (node, selector) => {
    const start = node?.nodeType === 1 ? node : node?.parentElement;
    const found = start?.closest(selector) ?? null;
    return found && found !== editable && editable.contains(found) ? found : null;
  };

  /** Lists open above a node, inside the text. */
  function listDepth(node) {
    let depth = 0;
    for (let n = node?.nodeType === 1 ? node : node?.parentElement; n && n !== editable; n = n.parentElement) {
      if (n.nodeName === "UL" || n.nodeName === "OL") depth++;
    }
    return depth;
  }

  /** The items a range touches. */
  function itemsIn(range) {
    return Array.from(editable.querySelectorAll("li")).filter((li) => range.intersectsNode(li));
  }

  function currentBlockName() {
    const range = lastRange;
    if (!range) return "Paragraph";
    if (closestIn(range.startContainer, "blockquote")) return "Quotation";
    const block = closestIn(range.startContainer, "h2, h3");
    if (block?.nodeName === "H2") return "Heading";
    if (block?.nodeName === "H3") return "Subheading";
    return "Paragraph";
  }

  /* ── Blocks ──────────────────────────────────────────────────── */

  function unquote() {
    const range = rangeInside();
    const quote = closestIn(range?.startContainer, "blockquote");
    if (!quote) return;
    exec("outdent");
    if (!closestIn(rangeInside()?.startContainer, "blockquote") || !quote.isConnected) return;
    while (quote.firstChild) quote.before(quote.firstChild);
    quote.remove();
  }

  function setBlock(kind) {
    const inQuote = Boolean(closestIn(rangeInside()?.startContainer, "blockquote"));
    if (kind === "quote") {
      if (inQuote) unquote();
      else exec("formatBlock", "<blockquote>");
      return;
    }
    if (inQuote) unquote();
    exec("formatBlock", `<${kind}>`);
  }

  /** The paragraphs and headings a range touches. */
  function blocksIn(range) {
    return Array.from(editable.querySelectorAll("p, h2, h3, div")).filter((b) => range.intersectsNode(b));
  }

  function setAlign(value) {
    const range = rangeInside();
    if (!range) return;
    for (const block of blocksIn(range)) {
      if (value) block.setAttribute("data-align", value);
      else block.removeAttribute("data-align");
    }
  }

  function insertRule() {
    const range = rangeInside();
    let top = range?.startContainer ?? null;
    while (top && top.parentNode !== editable) top = top.parentNode;
    const hr = document.createElement("hr");
    const after = document.createElement("p");
    after.append(document.createElement("br"));
    if (!top) editable.append(hr, after);
    else if (top.nodeName === "P" && !top.textContent.trim() && !top.querySelector("hr")) top.replaceWith(hr, after);
    else top.after(hr, after);
    placeCaret(after, 0);
  }

  /* ── Lists ───────────────────────────────────────────────────── */

  function indent() {
    const range = rangeInside();
    const items = range ? itemsIn(range) : [];
    if (!items.length) return say("Put the cursor in a list item to indent it.");
    if (items.some((li) => listDepth(li) >= MAX_LIST_DEPTH)) return say("Lists nest three levels deep at most.");
    exec("indent");
  }

  function outdent() {
    const range = rangeInside();
    if (!range || !itemsIn(range).length) return say("Put the cursor in a list item to move it out.");
    exec("outdent");
  }

  /* ── The named styles ────────────────────────────────────────── */

  const hasStyleAttr = (span) => STYLE_KEYS.some((k) => span.hasAttribute(`data-${k}`));

  /** Take a span's wrapper away, keeping what is inside it. */
  function unwrap(node) {
    while (node.firstChild) node.before(node.firstChild);
    node.remove();
  }

  function keySpan(from, attr) {
    for (let n = from; n && n !== editable; n = n.parentElement) {
      if (n.nodeName === "SPAN" && n.hasAttribute(attr)) return n;
    }
    return null;
  }

  const hasContent = (fragment) => fragment.textContent !== "" || Boolean(fragment.querySelector("br"));

  /** Split `owner` so it holds only the text node `t` (and the markup around it). */
  function isolate(owner, t) {
    const before = document.createRange();
    before.setStart(owner, 0);
    before.setEndBefore(t);
    const head = before.extractContents();
    if (hasContent(head)) {
      const left = owner.cloneNode(false);
      left.append(head);
      owner.before(left);
    }
    const after = document.createRange();
    after.setStartAfter(t);
    after.setEnd(owner, owner.childNodes.length);
    const tail = after.extractContents();
    if (hasContent(tail)) {
      const right = owner.cloneNode(false);
      right.append(tail);
      owner.after(right);
    }
  }

  /** Cut the text nodes at the range's ends, so the range covers whole nodes. */
  function splitAtEnds(range) {
    const { endContainer, endOffset } = range;
    if (endContainer.nodeType === 3 && endOffset > 0 && endOffset < endContainer.length) endContainer.splitText(endOffset);
    const { startContainer, startOffset } = range;
    if (startContainer.nodeType === 3 && startOffset > 0 && startOffset < startContainer.length) {
      range.setStart(startContainer.splitText(startOffset), 0);
    }
  }

  function textNodesIn(range) {
    const root = range.commonAncestorContainer;
    if (root.nodeType === 3) return root.data ? [root] : [];
    const out = [];
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      if (!n.data || !range.intersectsNode(n)) continue;
      if (!n.data.trim() && /^(?:UL|OL|BLOCKQUOTE)$/.test(n.parentNode.nodeName)) continue;
      out.push(n);
    }
    return out;
  }

  function pruneEmpty() {
    for (const node of Array.from(editable.querySelectorAll("span, strong, em, u, s, sup, sub, a, b, i"))) {
      if (!node.textContent && !node.querySelector("br")) node.remove();
    }
  }

  /**
   * Give the selected text one of the named styles (`value` null for the
   * default), wrapping each text run in a span, or taking the attribute off the
   * spans that carry it. A span that also covers text outside the selection is
   * split first, so a size never compounds on a size. Returns false when
   * nothing is selected.
   */
  function styleSelection(key, value) {
    const range = rangeInside();
    if (!range || range.collapsed) return false;
    const attr = `data-${key}`;
    splitAtEnds(range);
    const texts = textNodesIn(range);
    if (!texts.length) return false;
    let lastWrap = null;
    for (const t of texts) {
      let handled = false;
      let from = t.parentElement;
      for (;;) {
        const owner = keySpan(from, attr);
        if (!owner) break;
        isolate(owner, t);
        if (value && !handled) {
          owner.setAttribute(attr, value);
          handled = true;
        } else {
          owner.removeAttribute(attr);
          if (!hasStyleAttr(owner)) {
            from = owner.parentElement;
            unwrap(owner);
            continue;
          }
        }
        from = owner.parentElement;
      }
      if (value && !handled) {
        if (lastWrap && lastWrap.nextSibling === t) lastWrap.append(t);
        else {
          lastWrap = document.createElement("span");
          lastWrap.setAttribute(attr, value);
          t.before(lastWrap);
          lastWrap.append(t);
        }
      }
    }
    pruneEmpty();
    const first = texts[0];
    const end = texts[texts.length - 1];
    const next = document.createRange();
    next.setStart(first, 0);
    next.setEnd(end, end.length);
    const sel = selection();
    sel.removeAllRanges();
    sel.addRange(next);
    return true;
  }

  /** The style value in force at the start of the selection, or null. */
  function styleAt(key) {
    if (!lastRange) return null;
    let node = lastRange.startContainer;
    if (node.nodeType === 1 && node.childNodes[lastRange.startOffset]) node = node.childNodes[lastRange.startOffset];
    const span = keySpan(node.nodeType === 1 ? node : node.parentElement, `data-${key}`);
    return span?.getAttribute(`data-${key}`) ?? null;
  }

  function clearFormatting() {
    const range = rangeInside();
    if (!range || range.collapsed) return say("Select some text to clear its formatting.");
    exec("removeFormat");
    for (const command of ["bold", "italic", "underline", "strikeThrough", "superscript", "subscript"]) {
      if (queryState(command)) exec(command);
    }
    for (const key of STYLE_KEYS) styleSelection(key, null);
  }

  /* ── Links ───────────────────────────────────────────────────── */

  const linkForm = make("form", "desk-rich-link");
  linkForm.hidden = true;
  linkForm.noValidate = true;
  linkForm.setAttribute("aria-label", "Link");
  const linkInput = make("input", "desk-rich-link__field");
  linkInput.type = "text";
  linkInput.id = `${idPrefix}-link`;
  linkInput.autocomplete = "off";
  linkInput.spellcheck = false;
  linkInput.placeholder = "Web address, email, or /page";
  linkInput.setAttribute("aria-label", "Link address");
  linkInput.setAttribute("aria-describedby", `${idPrefix}-link-error`);
  const linkApply = make("button", "desk-rich-link__button desk-rich-link__button--primary", "Apply");
  linkApply.type = "submit";
  const linkRemove = make("button", "desk-rich-link__button", "Remove");
  linkRemove.type = "button";
  const linkCancel = make("button", "desk-rich-link__button", "Cancel");
  linkCancel.type = "button";
  const linkError = make("p", "desk-rich-link__error");
  linkError.id = `${idPrefix}-link-error`;
  linkError.setAttribute("role", "alert");
  linkError.hidden = true;
  linkForm.append(linkInput, linkApply, linkRemove, linkCancel, linkError);

  function showLinkError(message) {
    linkError.hidden = !message;
    linkError.textContent = message ?? "";
    linkInput.setAttribute("aria-invalid", String(Boolean(message)));
  }

  function openLinkForm() {
    closeMenus();
    const range = rangeInside() ?? lastRange;
    if (range) lastRange = range.cloneRange();
    linkAnchor = closestIn(lastRange?.startContainer, "a");
    linkInput.value = linkAnchor?.getAttribute("href") ?? "";
    linkRemove.hidden = !linkAnchor;
    showLinkError(null);
    linkForm.hidden = false;
    linkInput.focus();
    linkInput.select();
  }

  function closeLinkForm() {
    linkForm.hidden = true;
    linkAnchor = null;
    showLinkError(null);
  }

  function setLink(href) {
    const range = rangeInside();
    if (!range) return;
    if (range.collapsed) {
      if (linkAnchor && editable.contains(linkAnchor)) linkAnchor.setAttribute("href", href);
      else exec("insertHTML", `<a href="${escAttr(href)}">${escText(href.replace(/^mailto:/i, ""))}</a>`);
    } else exec("createLink", href);
  }

  function removeLink() {
    const range = rangeInside();
    if (!range) return;
    const anchor = linkAnchor && editable.contains(linkAnchor) ? linkAnchor : closestIn(range.startContainer, "a");
    if (range.collapsed && anchor) {
      const whole = document.createRange();
      whole.selectNodeContents(anchor);
      const sel = selection();
      sel.removeAllRanges();
      sel.addRange(whole);
    }
    exec("unlink");
  }

  linkForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const raw = linkInput.value.trim();
    if (!raw) {
      if (linkAnchor) {
        closeLinkForm();
        act(removeLink);
      } else showLinkError("Type an address, or choose Cancel.");
      return;
    }
    const href = normalizeAddress(raw);
    if (!href) {
      showLinkError("Use a web address, an email address, or a page on this site that starts with /.");
      linkInput.focus();
      return;
    }
    closeLinkForm();
    act(() => setLink(href));
  });
  linkRemove.addEventListener("click", () => {
    closeLinkForm();
    act(removeLink);
  });
  linkCancel.addEventListener("click", () => {
    closeLinkForm();
    act(() => {});
  });
  linkForm.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    e.preventDefault();
    e.stopPropagation();
    closeLinkForm();
    act(() => {});
  });
  linkInput.addEventListener("input", () => {
    if (!linkError.hidden) showLinkError(null);
  });

  /* ── Menus ───────────────────────────────────────────────────── */

  function closeMenus() {
    if (openMenu) openMenu.close(false);
  }

  /**
   * A toolbar button that opens a menu of radio items.
   * @param {{ name: string, groups: { label?: string, items: { label: string, value: any, sample?: object }[] }[],
   *   isChecked: (group: object, item: object) => boolean, pick: (group: object, item: object) => void,
   *   content: Node }} spec
   */
  function menuButton({ name, groups, isChecked, pick, content }) {
    const button = make("button", "desk-rich-tool desk-rich-tool--menu");
    button.type = "button";
    button.setAttribute("aria-label", name);
    button.setAttribute("aria-haspopup", "menu");
    button.setAttribute("aria-expanded", "false");
    button.title = name;
    button.append(content);
    const menuId = `${idPrefix}-menu-${name.toLowerCase().replace(/[^a-z]+/g, "-")}`;

    function close(refocus) {
      if (openMenu?.button !== button) return;
      openMenu.menu.remove();
      button.setAttribute("aria-expanded", "false");
      button.removeAttribute("aria-controls");
      openMenu = null;
      if (refocus) button.focus();
    }

    function open() {
      closeMenus();
      closeLinkForm();
      const menu = make("div", "desk-rich-menu");
      menu.id = menuId;
      menu.setAttribute("role", "menu");
      menu.setAttribute("aria-label", name);
      const items = [];
      for (const group of groups) {
        let host = menu;
        if (group.label) {
          host = make("div", "desk-rich-menu__group");
          host.setAttribute("role", "group");
          host.setAttribute("aria-label", group.label);
          const heading = make("div", "desk-rich-menu__label", group.label);
          heading.setAttribute("aria-hidden", "true");
          host.append(heading);
          menu.append(host);
        }
        for (const item of group.items) {
          const checked = isChecked(group, item);
          const row = make("button", "desk-rich-menu__item");
          row.type = "button";
          row.tabIndex = -1;
          row.setAttribute("role", "menuitemradio");
          row.setAttribute("aria-checked", String(checked));
          const text = make("span", "desk-rich-menu__text", item.label);
          if (item.sample) {
            const swatch = make("span", "desk-rich-sample", "Aa");
            swatch.setAttribute("aria-hidden", "true");
            for (const [k, v] of Object.entries(item.sample)) swatch.setAttribute(`data-${k}`, v);
            row.append(swatch);
          }
          if (item.fontSample) text.setAttribute("data-font", item.fontSample);
          row.append(text);
          row.addEventListener("click", () => {
            close(false);
            pick(group, item);
          });
          host.append(row);
          items.push(row);
        }
      }
      el.append(menu);
      button.setAttribute("aria-expanded", "true");
      button.setAttribute("aria-controls", menuId);
      openMenu = { button, menu, close };

      const box = el.getBoundingClientRect();
      const at = button.getBoundingClientRect();
      menu.style.top = `${at.bottom - box.top + 2}px`;
      menu.style.left = `${Math.max(0, Math.min(at.left - box.left, box.width - menu.offsetWidth))}px`;

      const start = items.find((r) => r.getAttribute("aria-checked") === "true") ?? items[0];
      start.focus();
      start.scrollIntoView({ block: "nearest" });

      menu.addEventListener("keydown", (e) => {
        const i = items.indexOf(document.activeElement);
        let to = null;
        if (e.key === "ArrowDown") to = (i + 1) % items.length;
        else if (e.key === "ArrowUp") to = (i - 1 + items.length) % items.length;
        else if (e.key === "Home") to = 0;
        else if (e.key === "End") to = items.length - 1;
        else if (e.key === "Escape" || e.key === "Tab") {
          e.preventDefault();
          e.stopPropagation();
          close(true);
          return;
        } else return;
        e.preventDefault();
        items[to].focus();
      });
    }

    button.addEventListener("click", () => (openMenu?.button === button ? close(true) : open()));
    button.addEventListener("keydown", (e) => {
      if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
      e.preventDefault();
      if (openMenu?.button !== button) open();
    });
    return button;
  }

  /* ── The toolbar ─────────────────────────────────────────────── */

  const tools = [];
  const toggles = [];
  let indentButton = null;
  let outdentButton = null;
  let blockLabel = null;

  function addTool(button) {
    tools.push(button);
    toolbar.append(button);
    return button;
  }

  function separator() {
    const sep = make("span", "desk-rich-sep");
    sep.setAttribute("aria-hidden", "true");
    toolbar.append(sep);
  }

  /** A button; `content` is a Node or short text. */
  function toolButton(name, content, onClick, shortcut) {
    const button = make("button", "desk-rich-tool");
    button.type = "button";
    button.setAttribute("aria-label", name);
    button.title = shortcut ? `${name} (${shortcut})` : name;
    if (shortcut) button.setAttribute("aria-keyshortcuts", shortcut.replace("Ctrl", "Control"));
    if (typeof content === "string") {
      button.textContent = content;
      button.classList.add("desk-rich-tool--text");
    } else button.append(content);
    button.addEventListener("click", onClick);
    return addTool(button);
  }

  /** A button for a browser command that is on or off (aria-pressed). */
  function toggleButton(name, content, command, shortcut) {
    const button = toolButton(name, content, () => act(() => exec(command)), shortcut);
    button.setAttribute("aria-pressed", "false");
    toggles.push({ button, command });
    return button;
  }

  // 1. The block
  blockLabel = make("span", "desk-rich-tool__text", "Paragraph");
  const BLOCKS = [
    { label: "Paragraph", value: "p" },
    { label: "Heading", value: "h2" },
    { label: "Subheading", value: "h3" },
    { label: "Quotation", value: "quote" },
  ];
  addTool(
    menuButton({
      name: "Paragraph style",
      content: blockLabel,
      groups: [{ items: BLOCKS }],
      isChecked: (_g, item) => item.label === currentBlockName(),
      pick: (_g, item) => act(() => setBlock(item.value)),
    }),
  );
  separator();

  // 2. Bold, italic, underline, strikethrough
  const bold = toggleButton("Bold", "B", "bold", "Ctrl+B");
  bold.classList.add("desk-rich-tool--bold");
  const italic = toggleButton("Italic", "I", "italic", "Ctrl+I");
  italic.classList.add("desk-rich-tool--italic");
  const underline = toggleButton("Underline", "U", "underline", "Ctrl+U");
  underline.classList.add("desk-rich-tool--underline");
  const strike = toggleButton("Strikethrough", "S", "strikeThrough");
  strike.classList.add("desk-rich-tool--strike");
  separator();

  // 3. Superscript, subscript
  toggleButton("Superscript", "x²", "superscript");
  toggleButton("Subscript", "x₂", "subscript");
  separator();

  // 4. Link
  toolButton("Link", icon("link"), openLinkForm, "Ctrl+K");
  separator();

  // 5. Lists
  toggleButton("Bulleted list", icon("ul"), "insertUnorderedList");
  toggleButton("Numbered list", icon("ol"), "insertOrderedList");
  indentButton = toolButton("Indent list item", icon("indent"), () => act(indent));
  outdentButton = toolButton("Outdent list item", icon("outdent"), () => act(outdent));
  separator();

  // 6. Alignment
  const alignIcon = make("span", "desk-rich-tool__icon");
  alignIcon.append(icon("left"));
  const ALIGNS = [{ label: "Left", value: null }, ...ALIGNMENTS.map((v) => ({ label: ALIGN_LABELS[v] ?? v, value: v }))];
  addTool(
    menuButton({
      name: "Text alignment",
      content: alignIcon,
      groups: [{ items: ALIGNS }],
      isChecked: (_g, item) => {
        const block = closestIn(lastRange?.startContainer, "p, h2, h3, div");
        return (block?.getAttribute("data-align") ?? null) === item.value;
      },
      pick: (_g, item) => act(() => setAlign(item.value)),
    }),
  );

  // 7. Style
  const STYLE_MENU = STYLE_KEYS.map((key) => {
    const [defaultLabel, defaultAt] = STYLE_DEFAULTS[key];
    const items = SPAN_STYLES[key].map((value) => ({
      label: STYLE_LABELS[key][value] ?? value,
      value,
      ...(key === "font" ? { fontSample: value } : {}),
      ...(key === "color" || key === "mark" ? { sample: { [key]: value } } : {}),
    }));
    items.splice(defaultAt, 0, { label: defaultLabel, value: null });
    return { key, label: STYLE_GROUP_NAMES[key], items };
  });
  addTool(
    menuButton({
      name: "Style",
      content: make("span", "desk-rich-tool__text", "Style"),
      groups: STYLE_MENU,
      isChecked: (group, item) => styleAt(group.key) === item.value,
      pick: (group, item) =>
        act(() => {
          if (!styleSelection(group.key, item.value)) say("Select some words first, then choose a style.");
        }),
    }),
  );
  separator();

  // 8. Horizontal line, 9. Clear formatting
  toolButton("Horizontal line", icon("hr"), () => act(insertRule));
  toolButton("Clear formatting", icon("clear"), () => act(clearFormatting));

  toolbar.append(linkForm);

  /* The roving tab stop. */
  let rove = 0;
  function setRove(i) {
    rove = i;
    tools.forEach((b, n) => {
      b.tabIndex = n === i ? 0 : -1;
    });
  }
  setRove(0);
  toolbar.addEventListener("focusin", (e) => {
    const i = tools.indexOf(e.target);
    if (i >= 0 && i !== rove) setRove(i);
  });
  toolbar.addEventListener("keydown", (e) => {
    const i = tools.indexOf(e.target);
    if (i < 0 || e.altKey || e.ctrlKey || e.metaKey) return;
    let to = null;
    if (e.key === "ArrowRight") to = (i + 1) % tools.length;
    else if (e.key === "ArrowLeft") to = (i - 1 + tools.length) % tools.length;
    else if (e.key === "Home") to = 0;
    else if (e.key === "End") to = tools.length - 1;
    if (to === null) return;
    e.preventDefault();
    tools[to].focus();
  });

  // Ctrl+Z on a toolbar button undoes the typing, as it would in the text:
  // the desk's own undo stands down anywhere in the editor (BA74).
  toolbar.addEventListener("keydown", (e) => {
    if (!(e.ctrlKey || e.metaKey) || e.altKey || e.target.closest("input")) return;
    const key = e.key.toLowerCase();
    const command = key === "z" ? (e.shiftKey ? "redo" : "undo") : key === "y" && !e.shiftKey ? "redo" : null;
    if (!command) return;
    e.preventDefault();
    act(() => exec(command));
  });

  /** Keep the selection in the text while a toolbar or menu button is pressed. */
  el.addEventListener("mousedown", (e) => {
    if (editable.contains(e.target) || e.target.closest("input")) return;
    const range = rangeInside();
    if (range) lastRange = range.cloneRange();
    e.preventDefault();
  });

  /** Bring the pressed states, the block name and the list buttons up to date. */
  function refresh() {
    const inside = Boolean(rangeInside());
    for (const { button, command } of toggles) {
      button.setAttribute("aria-pressed", String(inside && queryState(command)));
    }
    const range = lastRange;
    const items = range && inside ? itemsIn(range) : [];
    const inList = items.length > 0;
    indentButton.setAttribute("aria-disabled", String(!inList));
    outdentButton.setAttribute("aria-disabled", String(!inList));
    blockLabel.textContent = currentBlockName();
  }

  function onSelectionChange() {
    const range = rangeInside();
    if (!range) return;
    lastRange = range.cloneRange();
    refresh();
  }
  document.addEventListener("selectionchange", onSelectionChange);

  function onOutsidePress(e) {
    if (!openMenu) return;
    if (openMenu.menu.contains(e.target) || openMenu.button.contains(e.target)) return;
    openMenu.close(false);
  }
  document.addEventListener("mousedown", onOutsidePress, true);

  /* ── The text ────────────────────────────────────────────────── */

  load(html);

  editable.addEventListener("focus", prepareCommands);

  editable.addEventListener("input", () => {
    // Emptied entirely: give typing a paragraph to land in.
    const only = editable.childNodes.length === 1 ? editable.firstChild : null;
    if (!editable.firstChild || only?.nodeName === "BR") {
      editable.innerHTML = EMPTY_BLOCK;
      placeCaret(editable.firstChild, 0);
    }
    changed();
  });

  editable.addEventListener("keydown", (e) => {
    if (!(e.ctrlKey || e.metaKey) || e.altKey || e.shiftKey) return;
    const key = e.key.toLowerCase();
    const commands = { b: "bold", i: "italic", u: "underline" };
    if (commands[key]) {
      e.preventDefault();
      act(() => exec(commands[key]));
    } else if (key === "k") {
      e.preventDefault();
      openLinkForm();
    }
  });

  /** Put pasted or dropped text in at the selection, read the way a paste is (BA68, BA71). */
  function insertTransfer(data) {
    let clean = pastedSheetHtml(data.getData("text/html"));
    if (!clean) clean = sanitizeSheetHtml(plainToHtml(data.getData("text/plain")));
    if (!clean) return;
    prepareCommands();
    const inner = singleParagraphInner(clean);
    if (!exec("insertHTML", inner ?? clean)) exec("insertText", data.getData("text/plain"));
  }

  editable.addEventListener("paste", (e) => {
    const data = e.clipboardData;
    if (!data) return;
    e.preventDefault();
    insertTransfer(data);
  });

  // Files dropped on the text would open or embed; the format holds no images.
  editable.addEventListener("dragover", (e) => {
    if (e.dataTransfer?.types?.includes("Files")) e.preventDefault();
  });
  // Text dropped from elsewhere goes in as a paste does, so its colors, fonts
  // and images never show only to vanish on reload (BA73). Words dragged from
  // one of the sheet's own editors are left to the browser, which moves them.
  editable.addEventListener("dragstart", () => {
    draggingText = true;
  });
  editable.addEventListener("dragend", () => {
    draggingText = false;
  });
  editable.addEventListener("drop", (e) => {
    const data = e.dataTransfer;
    if (!data) return;
    if (data.files?.length) {
      e.preventDefault();
      return;
    }
    if (draggingText || !(data.types.includes("text/html") || data.types.includes("text/plain"))) return;
    e.preventDefault();
    const at = caretAt(e.clientX, e.clientY);
    editable.focus();
    if (at && editable.contains(at.startContainer)) placeCaret(at.startContainer, at.startOffset);
    else if (!rangeInside()) caretToEnd();
    insertTransfer(data);
  });

  el.addEventListener("focusout", (e) => {
    if (e.relatedTarget && el.contains(e.relatedTarget)) return;
    closeMenus();
    if (dirty) emit();
  });

  el.append(toolbar, status, editable);

  return {
    el,
    /** Replace the content (sanitized). The caller does this only while the editor has no focus. */
    setHtml(next) {
      load(next);
      refresh();
    },
    /** Focus the text, at the selection the reader had or at the end. */
    focus() {
      restore();
    },
    /** Whether focus is anywhere inside the editor, toolbar included. */
    hasFocus() {
      return el.contains(document.activeElement);
    },
    /** Report a pending change now. */
    flush() {
      if (dirty) emit();
    },
    /** Report a pending change and let go of the page's listeners. */
    destroy() {
      if (dirty) emit();
      clearTimeout(timer);
      clearTimeout(statusTimer);
      closeMenus();
      document.removeEventListener("selectionchange", onSelectionChange);
      document.removeEventListener("mousedown", onOutsidePress, true);
    },
  };
}
