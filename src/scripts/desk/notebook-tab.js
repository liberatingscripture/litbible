// src/scripts/desk/notebook-tab.js
//
// The minimized Notebook's tab, and its stylesheet. One maker for both
// stages (Audit 3, LG3-2): the first stage (first-stage.js) draws the tab
// before the rest of the desk has loaded, and the panel (panel.js) draws its
// own when it takes over, so the two are the same button in the same place
// and the hand-over moves nothing.

// As text, added as a <style>, for the reason boot.js gives for desk.css.
import tabCss from "../../styles/desk-tab.css?inline";

const ICON_NOTEBOOK = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor"
  stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
  <rect x="5" y="3" width="14" height="18" rx="2" /><path d="M9 3v18M12.5 8h3M12.5 12h3" /></svg>`;

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
  tab.innerHTML = `${ICON_NOTEBOOK}<span class="desk-tab__label">Notebook</span>`;
  return tab;
}
