// src/scripts/desk/boot.js
//
// What every page that runs the desk does first, shared by the shell
// (shell.js, on a reading page) and the notebook page (notebook-page.js, which
// is not a reading surface and so has no panel): add the desk's stylesheet,
// and say what a record this page writes is stamped with.

// As text, added below as a <style>. A plain CSS import is gathered into
// every page's stylesheet by Astro, dynamic import or not, which would have
// every reader download the desk's styles.
import deskCss from "../../styles/desk.css?inline";
import { addTabStyle } from "./notebook-tab.js";
import { addSearchStyle } from "./search-style.js";
import { addSheetViewStyle } from "./sheets/sheet-view-style.js";
// Previews for the references in a reader's notes (N4). Chapter View, intros,
// articles and the glossary load it already; Read View and the notebook page
// don't, and a module loads once wherever it is asked for.
import "../ref-preview.js";

// What every record this page writes is stamped with (desk-ctx.js, its own
// module so a phone showing a shared sheet needn't load this one).
export { deskCtx } from "./desk-ctx.js";

/**
 * Add the desk's stylesheets to the page, once each: the tab's (which the
 * first stage may have added already), the search rows' (desk-search.css,
 * which /search adds by itself; LG8-10), a sheet's look (desk-sheet-view.css,
 * which a phone showing a shared sheet adds by itself; LG8-10), and the rest.
 */
export function addDeskStyle() {
  addTabStyle();
  addSearchStyle();
  addSheetViewStyle();
  if (document.querySelector("style[data-desk]")) return;
  const style = document.createElement("style");
  style.dataset.desk = "";
  style.textContent = deskCss;
  document.head.append(style);
}
