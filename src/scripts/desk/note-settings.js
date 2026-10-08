// src/scripts/desk/note-settings.js
//
// The reader's settings for their own notes (STUDY-DESK.md, "Decisions",
// 2026-10-07: the margin switch, and the margin notes' look):
//   - "My notes": whether the margin shows them (shown by default);
//   - "Handwriting / Plain": Playpen Sans or Inter for margin notes
//     (handwriting by default). The reader's own font choice, Atkinson
//     Hyperlegible or OpenDyslexic, still wins: global.css sets every element
//     to it under html[data-font];
//   - whether the Notebook panel's list shows notes in full or at two lines
//     (two lines by default).
//
// The first two have a control in the Display tray's Show group and another
// in the Notebook panel, both full switches for one setting, kept in step
// (BVJ). Like the tray's own settings, each is an attribute on <html>, absent
// for the default, with one localStorage key; unlike them there is no
// pre-paint script, since nothing of the desk paints before this file runs.

const SETTINGS = {
  notes: { attr: "data-desk-notes", key: "lit-desk-notes", fallback: "on" },
  noteFont: { attr: "data-desk-note-font", key: "lit-desk-note-font", fallback: "handwriting" },
  listFull: { attr: "data-desk-list", key: "lit-desk-list", fallback: "lines" },
};

export const SETTINGS_EVENT = "desk:settings";

export function getSetting(name) {
  const { attr, fallback } = SETTINGS[name];
  return document.documentElement.getAttribute(attr) || fallback;
}

function applyAttr(name, value) {
  const { attr, fallback } = SETTINGS[name];
  if (value === fallback) document.documentElement.removeAttribute(attr);
  else document.documentElement.setAttribute(attr, value);
}

export function setSetting(name, value) {
  const { key, fallback } = SETTINGS[name];
  applyAttr(name, value);
  try {
    if (value === fallback) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch (_) {}
  document.dispatchEvent(new CustomEvent(SETTINGS_EVENT, { detail: { name, value } }));
}

/** Read the stored settings onto <html>, and follow changes made in other tabs. */
export function initNoteSettings() {
  for (const name of Object.keys(SETTINGS)) {
    let v = null;
    try { v = localStorage.getItem(SETTINGS[name].key); } catch (_) {}
    applyAttr(name, v || SETTINGS[name].fallback);
  }
  window.addEventListener("storage", (e) => {
    const name = Object.keys(SETTINGS).find((n) => SETTINGS[n].key === e.key);
    if (!name) return;
    const value = e.newValue || SETTINGS[name].fallback;
    applyAttr(name, value);
    document.dispatchEvent(new CustomEvent(SETTINGS_EVENT, { detail: { name, value } }));
  });
  injectIntoTray();
}

let uid = 0;

/**
 * The "My notes" box and the Handwriting / Plain choice, as a group of
 * controls that follow the setting wherever it changes. `classes` names the
 * host's own styles, so the same controls sit naturally in the tray and in
 * the panel.
 */
function noteControls(classes) {
  const n = ++uid;
  const check = document.createElement("label");
  check.className = classes.check;
  check.innerHTML = `<input type="checkbox" class="${classes.checkInput}" id="deskNotesCheck${n}" />
    <span class="${classes.checkLabel}">My notes</span>`;
  const box = check.querySelector("input");
  box.addEventListener("change", () => setSetting("notes", box.checked ? "on" : "off"));

  const seg = document.createElement("div");
  seg.className = classes.seg;
  seg.setAttribute("role", "radiogroup");
  seg.setAttribute("aria-label", "My notes’ lettering");
  seg.innerHTML = ["handwriting", "plain"]
    .map(
      (v) => `<label class="${classes.segOption}">
        <input type="radio" class="${classes.segInput}" name="desk-note-font-${n}" value="${v}" />
        <span class="${classes.segText}">${v === "handwriting" ? "Handwriting" : "Plain"}</span>
      </label>`,
    )
    .join("");
  const radios = Array.from(seg.querySelectorAll("input"));
  for (const r of radios) r.addEventListener("change", () => r.checked && setSetting("noteFont", r.value));

  const sync = () => {
    box.checked = getSetting("notes") === "on";
    const font = getSetting("noteFont");
    for (const r of radios) r.checked = r.value === font;
  };
  sync();
  document.addEventListener(SETTINGS_EVENT, sync);
  return { check, seg, sync };
}

/** The controls in the Display tray's Show group, on a Study View chapter. */
function injectIntoTray() {
  const terms = document.querySelector("#fontTray [data-terms-check]");
  const checks = terms?.closest(".font-tray__checks");
  const show = checks?.closest("fieldset");
  if (!checks || !show || !document.querySelector(".chapter-paragraphs")) return;
  const { check, seg } = noteControls({
    check: "font-tray__check",
    checkInput: "font-tray__check-input",
    checkLabel: "font-tray__check-label",
    seg: "font-tray__seg",
    segOption: "font-tray__seg-option",
    segInput: "font-tray__seg-input",
    segText: "font-tray__seg-text",
  });
  check.dataset.desk = "";
  checks.append(check);
  const row = document.createElement("fieldset");
  row.className = "font-tray__row";
  row.dataset.desk = "";
  row.innerHTML = `<legend class="font-tray__legend">My notes’ lettering</legend>`;
  seg.removeAttribute("role");
  seg.removeAttribute("aria-label");
  row.append(seg);
  show.after(row);
}

/** The same controls for the Notebook panel's foot. */
export function panelNoteControls() {
  const { check, seg } = noteControls({
    check: "desk-setting",
    checkInput: "desk-setting__input",
    checkLabel: "desk-setting__label",
    seg: "desk-seg",
    segOption: "desk-seg__option",
    segInput: "desk-seg__input",
    segText: "desk-seg__text",
  });
  const wrap = document.createElement("div");
  wrap.className = "desk-panel__settings";
  wrap.append(check, seg);
  return wrap;
}
