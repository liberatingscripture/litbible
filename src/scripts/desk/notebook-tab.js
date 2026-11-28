// src/scripts/desk/notebook-tab.js
//
// The minimized Notebook's tab, and its stylesheet. One maker for both
// stages (Audit 3, LG3-2): the first stage (first-stage.js) draws the tab
// before the rest of the desk has loaded, and the panel (panel.js) draws its
// own when it takes over, so the two are the same button in the same place
// and the hand-over moves nothing.

// As text, added as a <style>, for the reason boot.js gives for desk.css.
import tabCss from "../../styles/desk-tab.css?inline";
// The notebook icon from the one set (src/lib/icons.mjs), which every chapter
// page already carries for its own controls.
import { icon } from "../../lib/icons.mjs";

/** Add the rail's and the tab's stylesheet to the page, once. */
export function addTabStyle() {
  if (document.querySelector("style[data-desk-tab]")) return;
  const style = document.createElement("style");
  style.dataset.deskTab = "";
  style.textContent = tabCss;
  document.head.append(style);
}

/**
 * The collapsed notebook, at the window's edge. Its name is its visible
 * word; aria-expanded says the panel is folded away.
 */
export function notebookTab() {
  const tab = document.createElement("button");
  tab.type = "button";
  tab.className = "desk-tab";
  tab.setAttribute("data-desk-dock", "");
  tab.setAttribute("aria-controls", "deskPanel");
  tab.setAttribute("aria-expanded", "false");
  tab.innerHTML = `${icon("notebook", { size: 18 })}<span class="desk-tab__label">Notebook</span>`;
  return tab;
}
