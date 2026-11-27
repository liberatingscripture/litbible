// src/scripts/desk/account/ui.js
//
// What the account page's screens are built from (the plan's step 4h): an
// element maker, one screen at a time in the page's sheet, a button that is
// busy while its step runs, and the two places a result is said. No words
// of its own (src/lib/desk-account-words.mjs has them) and no imports but
// those words, so the account's basics on a phone load it without the desk.

import { WORDS, failureWords } from "../../../lib/desk-account-words.mjs";

/**
 * An element. `props` are attributes, with four that aren't: `class`,
 * `text` (set as text, never as markup), `on<event>` listeners, and a value
 * of `true` for an empty attribute. A null, undefined, or false value sets
 * nothing. `kids` are nodes, strings, or arrays of them.
 */
export function h(tag, props = {}, ...kids) {
  const e = document.createElement(tag);
  for (const [name, value] of Object.entries(props ?? {})) {
    if (value == null || value === false) continue;
    if (name === "class") e.className = value;
    else if (name === "text") e.textContent = value;
    else if (name.startsWith("on")) e.addEventListener(name.slice(2), value);
    else e.setAttribute(name, value === true ? "" : String(value));
  }
  for (const kid of kids.flat(Infinity)) if (kid != null && kid !== false) e.append(kid);
  return e;
}

/**
 * The page's one screen. `root` is the element a screen is drawn into.
 * Returns:
 *   show(nodes, { focus })  replaces the screen, and moves focus to its
 *                            heading (or to `focus`), so a screen reader and a
 *                            keyboard both start where the screen does
 *   fail(error)             says what went wrong, in the screen's alert line
 *   say(text)               a result, said politely and shown
 *   warn(text)              a step that couldn't go on, in the alert line
 *   clear()                 empties both lines
 *   run(button, step)       runs `step`, with the button busy and its failure said
 *   live()                  a token that is true only while this screen is up:
 *                            a step that waited checks it before drawing
 */
export function screens(root, { log = (...args) => console.error("LIT Bible account:", ...args) } = {}) {
  let turn = 0;
  let shown = 0; // the loading line is the first, the page's first screen the second
  const alert = h("p", { class: "account__alert", role: "alert", hidden: true });
  const status = h("p", { class: "account__status", role: "status", hidden: true });
  const body = h("div", { class: "account__screen" });
  root.replaceChildren(status, alert, body);
  root.removeAttribute("aria-busy");

  const set = (line, text) => {
    line.textContent = text ?? "";
    line.hidden = !text;
  };

  const api = {
    show(nodes, { focus } = {}) {
      turn++;
      set(alert, "");
      body.replaceChildren(...[nodes].flat(Infinity).filter((node) => node != null && node !== false));
      // The page's first screen leaves focus where the reader's browser put it: taking it on load would
      // scroll /delete-account/ down to its box. Every screen after that starts at its heading.
      shown += 1;
      const target = focus ?? (shown > 2 ? body.querySelector(".account__title") : null);
      if (target) {
        if (!target.hasAttribute("tabindex") && !/^(BUTTON|INPUT|A|TEXTAREA|SELECT)$/.test(target.tagName)) target.setAttribute("tabindex", "-1");
        target.focus({ preventScroll: false });
      }
    },
    fail(error) {
      log(error);
      set(status, "");
      set(alert, failureWords(error));
    },
    say(text) {
      set(alert, "");
      set(status, text);
    },
    /** A step that couldn't go on for a reason the page words itself: said as a failure is, and logged nowhere. */
    warn(text) {
      set(status, "");
      set(alert, text);
    },
    clear() {
      set(alert, "");
      set(status, "");
    },
    live() {
      const mine = turn;
      return () => mine === turn;
    },
    /** Busy, not disabled: the button keeps focus while its step runs, and a second press does nothing. */
    async run(button, step) {
      if (button?.getAttribute("aria-disabled") === "true") return;
      button?.setAttribute("aria-disabled", "true");
      api.clear();
      try {
        await step();
      } catch (error) {
        api.fail(error);
      } finally {
        button?.removeAttribute("aria-disabled");
      }
    },
    body,
  };
  return api;
}

/** A button that runs a step through `ui.run`. `kind` is "primary", "quiet", or "danger". */
export function button(ui, label, step, { kind = "quiet", ...props } = {}) {
  const b = h("button", { type: "button", class: `account__button account__button--${kind}`, text: label, ...props });
  b.addEventListener("click", () => ui.run(b, () => step(b)));
  return b;
}

/** A text field with its label above it. Returns { row, input }. */
export function field(label, { id, hint, ...props } = {}) {
  const input = h("input", { type: "text", id, class: "account__input", autocomplete: "off", autocapitalize: "off", spellcheck: "false", ...props });
  const row = h("div", { class: "account__field" }, h("label", { for: id, class: "account__label", text: label }), input, hint ? h("p", { class: "account__hint", text: hint }) : null);
  return { row, input };
}

let asked = 0;

/**
 * A step the reader is asked to confirm, in place: the question, a button
 * that does it, and Cancel. The group is named by its question and the yes
 * button described by it, so a screen reader says what the button does
 * with it; Escape anywhere in the box is Cancel. Neither cancels while the
 * yes step runs, since that step can't be called back. Show it with
 * `focusConfirm`, never by focusing its first button (Audit 9, AC9-1).
 */
export function confirmBox(ui, { ask, yes, kind = "primary", onYes, onCancel }) {
  const id = `account-confirm-${++asked}`;
  const box = h("div", { class: "account__confirm", role: "group", "aria-labelledby": id }, h("p", { id, class: "account__confirm-ask", tabindex: "-1", text: ask }));
  const doIt = button(ui, yes, onYes, { kind, "aria-describedby": id });
  const cancel = h("button", { type: "button", class: "account__button account__button--quiet", text: WORDS.cancel });
  const dismiss = () => {
    if (doIt.getAttribute("aria-disabled") === "true") return;
    box.remove();
    onCancel?.();
  };
  cancel.addEventListener("click", dismiss);
  box.addEventListener("keydown", (e) => {
    if (e.key !== "Escape" || e.defaultPrevented) return;
    e.preventDefault();
    dismiss();
  });
  box.append(h("div", { class: "account__actions" }, doIt, cancel));
  return box;
}

/**
 * Focus for a confirm box just shown in `within`: its question, so the
 * reader hears what is asked before reaching the button that does it, and a
 * keyboard's next Tab is that button.
 */
export function focusConfirm(within) {
  within.querySelector(".account__confirm-ask")?.focus();
}

/** A section of the account's home: a heading, then its parts. */
export const section = (title, ...kids) => h("section", { class: "account__section" }, h("h2", { class: "account__heading", text: title }), ...kids);
