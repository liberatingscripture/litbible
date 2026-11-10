// src/scripts/desk/sheets/sheet-view-style.js
//
// What a sheet looks like wherever it is shown, desk-sheet-view.css (its
// formatted text and its buttons), added once as a <style> (Audit 8, LG8-10).
// A phone showing a shared sheet adds this alone (sheet-page.js's
// `showSharedOnPhone`), never all of desk.css; boot.js adds it on every desk
// page, ahead of desk.css.

// As text, added as a <style>, for the reason boot.js gives for desk.css.
import viewCss from "../../../styles/desk-sheet-view.css?inline";

/** Add the sheets' look to the page, once. */
export function addSheetViewStyle() {
  if (document.querySelector("style[data-desk-sheet-view]")) return;
  const style = document.createElement("style");
  style.setAttribute("data-desk-sheet-view", "");
  style.textContent = viewCss;
  document.head.append(style);
}
