// src/scripts/desk/search-style.js
//
// The desk's search rows' stylesheet, desk-search.css, added once as a
// <style> (Audit 8, LG8-10). notebook-search.js and sheets/search-sheet.js
// add it, since /search and the home page's search strip aren't pages the
// desk's shell runs on; boot.js adds it beside desk.css, so every desk page
// has it too. Until LG8-10 those two modules added all of desk.css, about
// 200 KB, for these few rules.

// As text, added as a <style>, for the reason boot.js gives for desk.css.
import searchCss from "../../styles/desk-search.css?inline";

/** Add the search rows' stylesheet to the page, once. */
export function addSearchStyle() {
  if (document.querySelector("style[data-desk-search]")) return;
  const style = document.createElement("style");
  style.setAttribute("data-desk-search", "");
  style.textContent = searchCss;
  document.head.append(style);
}
