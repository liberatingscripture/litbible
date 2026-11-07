// src/lib/desk-greek-text.mjs
//
// The plain-text flavor of a copy from the Greek tab (E54, GK3-12). The tab's
// selection can span the Greek text (paragraphs), a lexicon entry's head (a
// paragraph) and its body (a div of text, <b> and <br>, with no paragraph in
// it), so the text is read by walking the copied nodes, not by asking for
// paragraphs: every block is a paragraph of its own, a <br> is a line break,
// and the white space of the markup is one space. Reads only nodeType,
// tagName and childNodes, so a test can run it over a small DOM.

const BLOCK = new Set(["P", "H1", "H2", "H3", "H4", "H5", "H6", "LI", "UL", "OL", "DIV", "SECTION", "TABLE", "TR"]);
const BREAK = "\u0000";
const LINE = "\u0001";

/** The text of copied nodes: blocks apart by a blank line, a <br> by a line break. */
export function plainTextOf(root) {
  let out = "";
  const walk = (node) => {
    for (const n of node.childNodes) {
      if (n.nodeType === 3) {
        out += String(n.nodeValue).replace(/\s+/g, " ");
      } else if (n.nodeType === 1) {
        if (n.tagName === "BR") {
          out += LINE;
        } else if (BLOCK.has(n.tagName)) {
          out += BREAK;
          walk(n);
          out += BREAK;
        } else {
          walk(n);
        }
      }
    }
  };
  walk(root);
  return out
    .split(BREAK)
    .map((part) =>
      part
        .split(LINE)
        .map((line) => line.replace(/\s+/g, " ").trim())
        .join("\n")
        .trim(),
    )
    .filter(Boolean)
    .join("\n\n");
}
