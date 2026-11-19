// src/scripts/desk/collections/name-window.js
//
// The window that asks for a collection's name (D13, decision 25: every look
// is one the site already has). It is E154's pick window drawn without its
// list: a float-window.js window of the same classes (`desk-pick`), a lead
// line, a labeled field, and the note editor's Cancel and primary button
// (`desk-editor__actions`). "New collection…" (new-collection.js) and the
// collection page's "Rename…" are this window with different fields.
//
// It sits where the control it came from was (`near`), takes the pick
// window's one slot (so opening either replaces the other), is closed by its
// ×, Escape or Cancel, never by a click elsewhere, and gives focus back to
// `back` when it closes, after a save too (as the pick window does after a
// pick), unless the save put focus somewhere of its own. Enter in the name
// field saves.

import { createFloatWindow } from "../../float-window.js";
import { claimPickSlot, placePick } from "../pick-window.js";
import { make } from "../dom.js";

let seq = 0;

/**
 * @param {{ heading: string, title: string, lead?: string, submit: string,
 *   fields: { key: string, label: string, value?: string, multiline?: boolean, maxLength?: number }[],
 *   onSubmit: (values: Record<string, string>) => (string | null | void | Promise<string | null | void>),
 *   near?: { left: number, top: number } | null,
 *   back?: HTMLElement | (() => HTMLElement | null) | null }} options
 *   `heading` is the small label in the header ("Add to collection"), `title`
 *   the window's name. `onSubmit` gets each field's text; it returns a
 *   sentence to show under the fields (the window stays open) or nothing (the
 *   window closes). The first field is required: an empty one is told so
 *   before `onSubmit` is called.
 * @returns {{ el: HTMLElement, close: (reason?: string) => void, isOpen: () => boolean }}
 */
export function openNameWindow({ heading, title, lead = "", submit, fields, onSubmit, near = null, back = null }) {
  const id = `deskNameWindow${++seq}`;
  let release = () => {};
  const win = createFloatWindow({
    heading,
    title,
    className: "desk-pick",
    attrs: { "data-desk-dock": "" },
    place: (el) => placePick(el, near),
    onClose: (reason) => {
      release();
      window.removeEventListener("pagehide", onPageHide);
      if (reason === "close" || reason === "saved") giveBack();
    },
  });
  const onPageHide = () => win.close("page");

  /** Focus back where the reader came from, unless they have put it somewhere else since. */
  function giveBack() {
    const to = typeof back === "function" ? back() : back;
    const at = document.activeElement;
    const lost = !at || at === document.body || !at.isConnected || win.el.contains(at);
    if (lost && to?.isConnected) to.focus({ preventScroll: true });
  }

  const form = make("form");
  form.noValidate = true;
  if (lead) {
    const p = make("p", "desk-pick__lead", lead);
    p.id = `${id}-lead`;
    win.el.setAttribute("aria-describedby", p.id);
    form.append(p);
  }
  const inputs = new Map();
  fields.forEach((f, i) => {
    const label = make("label", "desk-pick__label", f.label);
    label.htmlFor = `${id}-${f.key}`;
    const input = document.createElement(f.multiline ? "textarea" : "input");
    if (!f.multiline) input.type = "text";
    else input.rows = 3;
    input.id = `${id}-${f.key}`;
    input.className = "desk-pick__filter";
    input.autocomplete = "off";
    input.value = f.value ?? "";
    if (f.maxLength) input.maxLength = f.maxLength;
    if (i > 0) label.style.marginTop = "10px";
    inputs.set(f.key, input);
    form.append(label, input);
  });
  const problem = make("p", "desk-sheet__problem");
  problem.setAttribute("role", "alert");
  const actions = make("div", "desk-editor__actions");
  const cancel = make("button", "", "Cancel");
  cancel.type = "button";
  const save = make("button", "desk-editor__save", submit);
  save.type = "submit";
  actions.append(cancel, save);
  form.append(problem, actions);
  win.body.append(form);

  cancel.addEventListener("click", () => win.close("close"));
  let busy = false;
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (busy) return;
    const values = Object.fromEntries([...inputs].map(([k, input]) => [k, input.value]));
    const [first] = fields;
    if (!values[first.key].trim()) {
      problem.textContent = `Type ${/^[aeiou]/i.test(first.label) ? "an" : "a"} ${first.label.toLowerCase()} first.`;
      inputs.get(first.key).focus();
      return;
    }
    problem.textContent = "";
    busy = true;
    save.disabled = true;
    let said = null;
    try {
      said = await onSubmit(values);
    } finally {
      busy = false;
      save.disabled = false;
    }
    if (said) problem.textContent = said;
    else win.close("saved");
  });

  const handle = { el: win.el, close: (reason = "close") => win.close(reason), isOpen: () => win.isOpen() };
  release = claimPickSlot(handle);
  window.addEventListener("pagehide", onPageHide);
  win.show({ focus: false });
  const first = inputs.get(fields[0].key);
  first.focus({ preventScroll: true });
  first.select?.();
  return handle;
}
