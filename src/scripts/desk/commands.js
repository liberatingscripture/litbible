// src/scripts/desk/commands.js
//
// What the search box's commands do (STUDY-DESK.md, D3). The box offers them
// through src/scripts/desk/notebook-search.js, which only sends
// `lit:desk-command` on `document` with { id }; this file, loaded by the
// shell on the pages that have a Notebook panel, is the one listener. A
// command the page can't carry out is never offered there (desk-commands.mjs
// offers only what can work), and an id this file doesn't know is ignored, so
// a newer search box can ask for something an older page lacks and nothing
// breaks. The commands that are plain links never come here.

/**
 * @param {{ panel: { open: (from?: Element) => void, close: () => void,
 *   showTab: (id: string) => boolean },
 *   printNotes?: { can: () => boolean, print: () => Promise<void> } | null,
 *   printRoom?: { can: () => boolean, print: () => Promise<void> } | null }} options
 */
export function initCommands({ panel, printNotes = null, printRoom = null }) {
  const run = {
    "open-notebook": () => panel.open(null),
    "show-my-notes": () => panel.showTab("mine"),
    "show-this-verse": () => panel.showTab("verse"),
    // The Greek tab exists on Study View chapters and draft chapters; showTab
    // returns false where it is absent, so the command does nothing there.
    "show-greek": () => panel.showTab("greek"),
    // The same event the H key sends; note-settings.js toggles M1.
    "hide-notes": () => document.dispatchEvent(new CustomEvent("lit:desk-hide")),
    // M6: a Study View chapter or Read View, which is where the command is
    // offered (desk-commands.mjs); anywhere else it does nothing.
    "print-with-notes": () => {
      if (printNotes?.can()) printNotes.print();
    },
    // N9: the same pages, and no notebook needed.
    "print-with-room": () => {
      if (printRoom?.can()) printRoom.print();
    },
    // The tour is built apart (phase 1d) and listens for this id itself.
  };
  document.addEventListener("lit:desk-command", (e) => {
    const id = e.detail?.id;
    if (typeof id === "string" && Object.hasOwn(run, id)) run[id]();
  });
}
