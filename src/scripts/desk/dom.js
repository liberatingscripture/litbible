// src/scripts/desk/dom.js
//
// The small DOM helpers the desk's modules share (Audit 2, LG-13). Each was
// copied into a dozen files, so a fix had to be made in every one. Only the
// copies that were identical are here; `announce` and `say` look alike but
// differ in what they do, so they stay where they are.

/**
 * An element with a class and text. `text` is set with textContent, so it is
 * never read as markup; null or undefined sets none.
 */
export function make(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}

/** `make` under the name some modules use. */
export const el = make;

/**
 * Text made safe to put in element text or in a double-quoted attribute. It
 * leaves `'` alone, so never use it inside a single-quoted attribute.
 */
export function escapeHtml(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
}

/**
 * A `button` maker with its module's usual class (Audit 8, LG8-7): each module
 * says once which class its buttons wear, and gets `button(label, cls?)`.
 * `type` is "button", so none of them ever submits a form by accident.
 */
export function buttons(defaultClass) {
  return (label, cls = defaultClass) => {
    const b = make("button", cls, label);
    b.type = "button";
    return b;
  };
}

let hintCount = 0;

/**
 * A sentence a control's `title` carries, given to a screen reader as well
 * (CP-9): a hidden span the control is described by, which the caller puts
 * in the page. The title stays, for a mouse. One counter for every module, so
 * two editors on one page never share an id.
 */
export function describe(control, text) {
  const hint = make("span", "sr-only", text);
  hint.id = `deskHint${++hintCount}`;
  control.setAttribute("aria-describedby", hint.id);
  return hint;
}
