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
import { webClient } from "../../lib/desk-store-core.mjs";
// Previews for the references in a reader's notes (N4). Study View, intros,
// articles and the glossary load it already; Read View and the notebook page
// don't, and a module loads once wherever it is asked for.
import "../ref-preview.js";

// Stamped at build by Layout.astro (src/lib/content-version.mjs, which reads
// the file system and so can't be imported here).
const contentVersion = document.documentElement.dataset.contentVersion || "unversioned";

/** Add the desk's stylesheet to the page, once. */
export function addDeskStyle() {
  if (document.querySelector("style[data-desk]")) return;
  const style = document.createElement("style");
  style.dataset.desk = "";
  style.textContent = deskCss;
  document.head.append(style);
}

/** What every record this page writes is stamped with. */
export const deskCtx = () => ({ client: webClient(contentVersion), contentVersion });
