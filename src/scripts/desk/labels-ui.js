// src/scripts/desk/labels-ui.js
//
// The "Labels…" popover on a notebook row (STUDY-DESK.md, M8): a checkbox for
// each of the reader's labels and a field to make a new one that goes straight
// onto the record. It is a floating panel (lit-panel.js), so Escape and an
// outside click close it and focus goes back to the button that opened it.
//
// Every change is one store.commit of a plan from src/lib/desk-labels.mjs, so
// Ctrl+Z takes it back; there is no undo bar for it, as ticking a box is too
// small to announce twice. The list is redrawn from the notebook whenever it
// changes (another tab, an undo), and the record is read fresh before each
// write, so a stale popover can't overwrite a newer edit.

import { liveLabels, planNewLabelOn, planSetLabel } from "../../lib/desk-labels.mjs";
import { kindName } from "../../lib/desk-store-core.mjs";
import { closePanel, showPanel } from "../lit-panel.js";

let seq = 0;

const MESSAGES = {
  empty: "Type a name first.",
  readonly: "This item was saved by a newer version, so it can’t take labels here.",
  missing: "That item isn’t in the notebook any more.",
};

/**
 * @param {object} options
 * @param {Element} options.trigger the button the popover opens beside
 * @param {object} options.store
 * @param {() => object} options.ctx
 * @param {string} options.recordId the record the labels are for
 * @param {string} [options.name] what to call it in the popover ("note on Romans 8:3")
 * @returns {Promise<HTMLElement>} the panel
 */
export async function openLabelsPopover({ trigger, store, ctx, recordId, name = "" }) {
  const n = ++seq;
  const panel = document.createElement("div");
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-labelledby", `deskLabelsTitle${n}`);
  panel.tabIndex = -1;
  panel.classList.add("lit-panel--menu", "desk-labels");
  panel.innerHTML = `
    <div class="lit-panel__header">
      <p class="lit-panel__heading" id="deskLabelsTitle${n}">Labels</p>
      <button type="button" class="lit-panel__close" aria-label="Close">×</button>
    </div>
    ${name ? `<p class="desk-labels__for"></p>` : ""}
    <ul class="desk-labels__list"></ul>
    <p class="desk-labels__none" hidden>No labels yet. Make one below.</p>
    <form class="desk-labels__new">
      <label class="sr-only" for="deskLabelsNew${n}">New label</label>
      <input class="desk-labels__input" id="deskLabelsNew${n}" type="text" maxlength="60" placeholder="New label" autocomplete="off" />
      <button type="submit" class="desk-labels__add">Add</button>
    </form>
    <p class="desk-labels__error" role="alert" hidden></p>`;
  if (name) panel.querySelector(".desk-labels__for").textContent = name;

  const list = panel.querySelector(".desk-labels__list");
  const none = panel.querySelector(".desk-labels__none");
  const input = panel.querySelector(".desk-labels__input");
  const error = panel.querySelector(".desk-labels__error");
  const say = (message) => {
    error.hidden = !message;
    error.textContent = message ?? "";
  };

  async function draw() {
    const records = await store.all();
    const record = records.find((r) => r.id === recordId);
    if (!record) return closePanel();
    const labels = liveLabels(records);
    const had = new Set(record.labels ?? []);
    const focused = list.contains(document.activeElement) ? document.activeElement.dataset.labelId : null;
    none.hidden = labels.length > 0;
    list.hidden = labels.length === 0;
    list.replaceChildren(
      ...labels.map((l) => {
        const li = document.createElement("li");
        const row = document.createElement("label");
        row.className = "desk-setting desk-labels__row";
        const box = document.createElement("input");
        box.type = "checkbox";
        box.className = "desk-setting__input";
        box.checked = had.has(l.id);
        box.dataset.labelId = l.id;
        const text = document.createElement("span");
        text.className = "desk-setting__label";
        text.textContent = l.name;
        row.append(box, text);
        li.append(row);
        box.addEventListener("change", () => toggle(l.id, box));
        return li;
      }),
    );
    if (focused) list.querySelector(`[data-label-id="${CSS.escape(focused)}"]`)?.focus({ preventScroll: true });
  }

  async function toggle(labelId, box) {
    say(null);
    const record = await store.get(recordId);
    const done = planSetLabel(record, labelId, box.checked, ctx());
    if (!done.ok) {
      box.checked = !box.checked;
      return say(MESSAGES[done.reason] ?? "That couldn’t be changed.");
    }
    try {
      await store.commit(done.plan);
    } catch (err) {
      console.error("Study Desk: the label wasn’t changed", err);
      box.checked = !box.checked;
      say("That couldn’t be saved in this browser.");
    }
  }

  panel.querySelector(".desk-labels__new").addEventListener("submit", async (e) => {
    e.preventDefault();
    say(null);
    const records = await store.all();
    const record = records.find((r) => r.id === recordId);
    if (!record) return closePanel();
    const done = planNewLabelOn(records, record, input.value, ctx());
    if (!done.ok) return say(MESSAGES[done.reason] ?? "That couldn’t be added.");
    try {
      await store.commit(done.plan);
      input.value = "";
      input.focus({ preventScroll: true });
    } catch (err) {
      console.error("Study Desk: the label wasn’t added", err);
      say("That couldn’t be saved in this browser.");
    }
  });
  panel.querySelector(".lit-panel__close").addEventListener("click", closePanel);

  const off = store.subscribe(() => draw());
  // Drawn before it is placed, so the popover is its full height when it finds room.
  await draw();
  showPanel(trigger, panel, {
    restoreFocus: trigger,
    sheet: false,
    onClose: off,
    extra: { kind: "labels", labelsFor: recordId },
  });
  panel.focus({ preventScroll: true });
  return panel;
}

/** What the popover calls a record: "note on Romans 8:3". */
export function labelsSubject(record, reference) {
  return `${kindName(record.kind).toLowerCase()}${reference ? ` on ${reference}` : ""}`;
}
