// src/scripts/desk/print-look.js
//
// What "Print with my notes" (print-notes.js, M6) and "Print with room to
// write" (print-room.js, N9) share: one desk print at a time, under
// `data-desk-print` on <html>, and the look always taken away again (BA35).
//
// `afterprint` is the ordinary end. It never comes when no print dialog opens:
// printing blocked by policy, or a print the browser refuses because the
// press that asked for it is too long ago after the font wait. Without
// another end the attribute would stay, the next plain Ctrl+P would print the
// notes or the ruled margin (rule 19 says it never does), and both buttons
// would do nothing until a reload. So once `print()` returns, which in every
// browser that shows a dialog is after the dialog closes, the reader's next
// focus, pointer or key event ends it too. Ctrl+P's own keydown is one, so it
// prints plainly.
//
// The two share the one guard, so pressing both quickly prints the first
// alone, in its own look.

const ATTR = "data-desk-print";
const NEXT = ["focus", "pointerdown", "keydown"];

let current = null; // the finish of the print under way

/**
 * Print with the page in a desk look.
 *
 * @param {"notes" | "room"} kind the value stamped on `data-desk-print`
 * @param {{ build?: () => Promise<{ undo?: () => void } | null | void>,
 *   ready?: (built: any) => Promise<void>, what?: string }} [steps]
 *   `build` adds what the look needs before the attribute is set, and returns
 *   its `undo`; `ready` waits (for the fonts) once the attribute is set;
 *   `what` names the print in the console if it fails.
 * @param {{ win?: Window, root?: Element }} [env] for tests
 * @returns {Promise<boolean>} false when another desk print was under way
 */
export async function printLook(kind, { build = async () => null, ready = async () => {}, what = "printing" } = {}, env = {}) {
  if (current) return false;
  const win = env.win ?? window;
  const root = env.root ?? document.documentElement;
  let built = null;
  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    win.removeEventListener("afterprint", finish);
    for (const type of NEXT) win.removeEventListener(type, finish, true);
    root.removeAttribute(ATTR);
    try {
      built?.undo?.();
    } catch (err) {
      console.error(`Study Desk: ${what} didn't clean up`, err);
    }
    current = null;
  };
  current = finish; // first, so a second press while this builds does nothing
  try {
    built = await build();
    win.addEventListener("afterprint", finish);
    root.setAttribute(ATTR, kind);
    await ready(built);
    win.print();
    if (!done) for (const type of NEXT) win.addEventListener(type, finish, true);
  } catch (err) {
    console.error(`Study Desk: ${what} didn't start`, err);
    finish();
  }
  return true;
}

/** Whether a desk print is under way. */
export const printing = () => Boolean(current);
