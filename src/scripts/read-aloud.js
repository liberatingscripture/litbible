// src/scripts/read-aloud.js
//
// "Read aloud" (audit X9, an experiment): Study View reads the chapter in the
// device's own voice, through the Web Speech API. No audio files, no server,
// nothing to pay for. What is said and in what pieces is
// src/lib/read-aloud.mjs; this file speaks it, highlights each verse as it is
// read, keeps it in view, and runs the player bar.
//
// Five things shape it:
//
// 1. One piece at a time, a couple queued ahead. A piece is a verse, or part
//    of a long one (Chrome's online voices stop partway through an utterance
//    longer than about fifteen seconds). Queuing ahead keeps the gap between
//    pieces short; each piece's start event moves the highlight.
// 2. Pause is cancel, and play starts the current piece again. The API's own
//    pause() does nothing on Android and can't resume an online voice in
//    Chrome, so cancelling is the one behaviour every browser shares. A
//    generation count makes a cancelled piece's late events harmless.
// 3. The first piece is spoken inside the tap. Safari and Chrome refuse
//    speech a page starts on its own, so nothing here speaks except in
//    answer to a tap or a key, and "next chapter" is a link, not autoplay.
// 4. The screen is kept awake while it reads (Screen Wake Lock, where the
//    browser has it), since a phone that locks stops the voice.
// 5. It follows the reading down the page until the reader scrolls away,
//    and picks it up again when the verse being read is back in view or the
//    reader taps the verse's name in the bar.

import {
  DEFAULT_RATE,
  RATES,
  buildChunks,
  chapterIntro,
  englishVoices,
  firstChunkOf,
  nextVerseStart,
  pickVoice,
  previousVerseStart,
  rateLabel,
  voiceLabel,
} from "../lib/read-aloud.mjs";

const synth = typeof window !== "undefined" ? window.speechSynthesis : undefined;

/** Whether this browser can speak at all. The page's inline script asks the same. */
export const readAloudSupported = !!(synth && typeof window.SpeechSynthesisUtterance === "function");

const RATE_KEY = "lit-read-aloud-rate";
const VOICE_KEY = "lit-read-aloud-voice";
const LOOKAHEAD = 2; // pieces handed to the engine beyond the one being spoken
const HIGHLIGHT = "lit-read-aloud";

function load(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function store(key, value) {
  try {
    if (value == null || value === "") localStorage.removeItem(key);
    else localStorage.setItem(key, String(value));
  } catch {
    /* storage blocked: the choice lasts for this page only */
  }
}

const ICONS = {
  play: '<path d="M8 5.5v13l11-6.5z" fill="currentColor" stroke="none"/>',
  pause:
    '<rect x="6.5" y="5" width="4" height="14" rx="1" fill="currentColor" stroke="none"/><rect x="13.5" y="5" width="4" height="14" rx="1" fill="currentColor" stroke="none"/>',
  prev: '<path d="M6 5v14"/><path d="M18 5.5v13L9 12z" fill="currentColor"/>',
  next: '<path d="M18 5v14"/><path d="M6 5.5v13L15 12z" fill="currentColor"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
};

function icon(name) {
  return (
    '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" ' +
    'stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' +
    ICONS[name] +
    "</svg>"
  );
}

function iconButton(name, label, className = "read-aloud-bar__btn") {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = className;
  btn.setAttribute("aria-label", label);
  btn.innerHTML = icon(name);
  return btn;
}

/**
 * Wire up Read aloud for one chapter. `verseText(n)` gives verse n's text as
 * Copy verse would, without its number; `title` is the chapter's name as the
 * page shows it ("Romans 8"). Returns { startAt(verse) } for the verse menu,
 * or null when the browser can't speak.
 */
export function initReadAloud({ container, root, startButton, verseText, title }) {
  if (!readAloudSupported || !container || !root) return null;

  const supportsHighlight = typeof CSS !== "undefined" && "highlights" in CSS;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  let chunks = null; // built on first use; the text never changes under us
  let pos = 0; // the piece being spoken, or the one play will start with
  let queuedTo = 0; // next piece to hand to the engine
  let playing = false;
  let gen = 0;
  let live = []; // utterances in the engine, kept referenced (Chrome drops events of collected ones)
  let shownVerse = undefined;
  let following = true;
  let finished = false;
  let wakeLock = null;
  let bar = null;
  let toggleBtn, prevBtn, nextBtn, whereBtn, statusEl, nextChapter, rateSelect, voiceSelect;

  let rate = Number(load(RATE_KEY));
  if (!RATES.includes(rate)) rate = DEFAULT_RATE;
  let voice = null;
  // What the utterance asks for when the device offers no English voice.
  const lang = /^en/i.test(navigator.language) ? navigator.language : "en-US";

  const lastSpace = title.lastIndexOf(" ");
  const bookLabel = lastSpace > 0 ? title.slice(0, lastSpace) : title;
  const chapter = lastSpace > 0 ? title.slice(lastSpace + 1) : "";
  const nextLink = document.querySelector('.chapter-nav a[rel="next"]');

  /* ── The chapter's pieces ─────────────────────────────────────────── */

  function ensureChunks() {
    if (chunks) return chunks;
    const numbers = [];
    for (const span of container.querySelectorAll("[data-verse]")) {
      const n = Number(span.dataset.verse);
      if (n && !numbers.includes(n)) numbers.push(n);
    }
    chunks = buildChunks(
      numbers.map((verse) => ({ verse, text: verseText(verse) })),
      { intro: chapter ? chapterIntro(bookLabel, chapter) : "" }
    );
    return chunks;
  }

  /* ── Voices ───────────────────────────────────────────────────────── */

  function voices() {
    return englishVoices(synth.getVoices(), navigator.language);
  }

  function resolveVoice() {
    voice = pickVoice(synth.getVoices(), load(VOICE_KEY), navigator.language);
  }

  /* ── Speaking ─────────────────────────────────────────────────────── */

  function stopEngine() {
    gen++;
    live = [];
    synth.cancel();
  }

  function speakFrom(i) {
    ensureChunks();
    if (!chunks.length) return;
    stopEngine();
    finished = false;
    pos = Math.max(0, Math.min(i, chunks.length - 1));
    queuedTo = pos;
    playing = true;
    holdWake();
    feed(gen);
    render();
    showPosition();
  }

  function feed(g) {
    while (queuedTo < chunks.length && queuedTo <= pos + LOOKAHEAD) {
      const idx = queuedTo++;
      const u = new SpeechSynthesisUtterance(chunks[idx].text);
      u.lang = voice?.lang || lang;
      if (voice) u.voice = voice;
      u.rate = rate;
      u.onstart = () => {
        if (g !== gen) return;
        pos = idx;
        showPosition();
      };
      u.onend = () => {
        if (g !== gen) return;
        live = live.filter((x) => x !== u);
        if (idx >= chunks.length - 1) return finish();
        // Some engines skip start events for queued pieces; the end of one
        // is the start of the next.
        pos = Math.max(pos, idx + 1);
        showPosition();
        feed(g);
      };
      u.onerror = (e) => {
        if (g !== gen) return;
        if (e.error === "interrupted" || e.error === "canceled") return;
        fail(e.error);
      };
      live.push(u);
      synth.speak(u);
    }
  }

  function pause() {
    if (!playing) return;
    stopEngine();
    playing = false;
    dropWake();
    render();
  }

  function finish() {
    stopEngine();
    playing = false;
    finished = true;
    dropWake();
    clearHighlight();
    shownVerse = undefined;
    render();
  }

  function fail(error) {
    stopEngine();
    playing = false;
    dropWake();
    // "not-allowed": the browser wants a fresh tap (a phone coming back from
    // the lock screen). Anything else is the voice itself.
    setStatus(
      error === "not-allowed"
        ? "Tap play to carry on."
        : "This voice couldn’t read that. Try another voice."
    );
    render({ keepStatus: true });
  }

  function close() {
    stopEngine();
    playing = false;
    finished = false;
    dropWake();
    clearHighlight();
    shownVerse = undefined;
    bar?.remove();
    bar = null;
    document.documentElement.classList.remove("read-aloud-on");
    startButton?.focus({ preventScroll: true });
  }

  /* ── The screen stays on while it reads ───────────────────────────── */

  async function holdWake() {
    if (wakeLock || !("wakeLock" in navigator)) return;
    try {
      wakeLock = await navigator.wakeLock.request("screen");
      wakeLock.addEventListener("release", () => {
        wakeLock = null;
      });
    } catch {
      wakeLock = null; // refused (battery saver, a hidden tab): read on anyway
    }
  }

  function dropWake() {
    wakeLock?.release().catch(() => {});
    wakeLock = null;
  }

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState !== "visible" || !playing) return;
    holdWake();
    // A phone that locked has dropped the voice; carry on from this piece.
    if (!synth.speaking && !synth.pending) speakFrom(pos);
  });

  window.addEventListener("pagehide", () => synth.cancel());

  /* ── Highlight and follow ─────────────────────────────────────────── */

  function spansOf(verse) {
    return [...container.querySelectorAll(`[data-verse="${verse}"]`)];
  }

  function clearHighlight() {
    if (supportsHighlight) CSS.highlights.delete(HIGHLIGHT);
    container.querySelectorAll(".is-read-aloud").forEach((s) => s.classList.remove("is-read-aloud"));
  }

  function highlight(spans) {
    clearHighlight();
    if (!spans.length) return;
    if (supportsHighlight) {
      const ranges = spans.map((span) => {
        const range = document.createRange();
        range.selectNodeContents(span);
        return range;
      });
      CSS.highlights.set(HIGHLIGHT, new Highlight(...ranges));
    } else {
      spans.forEach((s) => s.classList.add("is-read-aloud"));
    }
  }

  function showPosition() {
    const verse = chunks?.[pos]?.verse ?? null;
    if (verse === shownVerse) return;
    shownVerse = verse;
    setWhere(verse);
    if (verse === null) {
      clearHighlight();
      return;
    }
    const spans = spansOf(verse);
    highlight(spans);
    follow(spans);
  }

  // Where the text may sit: below the top edge, above the bar.
  function band() {
    const bottom = bar ? bar.getBoundingClientRect().top - 16 : window.innerHeight - 16;
    return { top: 16, bottom };
  }

  function follow(spans, force = false) {
    if (!spans.length) return;
    const first = spans[0].getBoundingClientRect();
    const last = spans[spans.length - 1].getBoundingClientRect();
    const { top, bottom } = band();
    if (!following && !force) {
      // The reader scrolled away. Pick up again once the reading is back in
      // view, whether they scrolled back or the reading caught up.
      if (last.bottom > top && first.top < bottom) following = true;
      else return;
    }
    if (first.top >= top && last.bottom <= bottom) return;
    const y = window.scrollY + first.top - Math.max(top, bottom * 0.25);
    window.scrollTo({ top: Math.max(0, y), behavior: reduceMotion.matches ? "auto" : "smooth" });
  }

  function stopFollowing() {
    if (playing) following = false;
  }

  window.addEventListener("wheel", stopFollowing, { passive: true });
  window.addEventListener("touchmove", stopFollowing, { passive: true });
  window.addEventListener("keydown", (e) => {
    if (["PageUp", "PageDown", "ArrowUp", "ArrowDown", "Home", "End"].includes(e.key)) stopFollowing();
  });

  /* ── The bar ──────────────────────────────────────────────────────── */

  function buildBar() {
    bar = document.createElement("div");
    bar.className = "read-aloud-bar";
    bar.setAttribute("role", "region");
    bar.setAttribute("aria-label", "Read aloud");
    bar.dataset.pagefindIgnore = "";

    const controls = document.createElement("div");
    controls.className = "read-aloud-bar__controls";

    prevBtn = iconButton("prev", "Previous verse");
    toggleBtn = iconButton("pause", "Pause", "read-aloud-bar__btn read-aloud-bar__btn--main");
    nextBtn = iconButton("next", "Next verse");
    prevBtn.addEventListener("click", () => jump(previousVerseStart(ensureChunks(), pos)));
    nextBtn.addEventListener("click", () => {
      const j = nextVerseStart(ensureChunks(), pos);
      if (j >= 0) jump(j);
    });
    toggleBtn.addEventListener("click", () => {
      if (playing) pause();
      else speakFrom(finished ? 0 : pos);
    });

    whereBtn = document.createElement("button");
    whereBtn.type = "button";
    whereBtn.className = "read-aloud-bar__where";
    whereBtn.title = "Show the verse being read";
    whereBtn.addEventListener("click", () => {
      following = true;
      const verse = chunks?.[pos]?.verse;
      if (verse) follow(spansOf(verse), true);
    });

    statusEl = document.createElement("span");
    statusEl.className = "read-aloud-bar__status";
    statusEl.hidden = true;

    nextChapter = document.createElement("a");
    nextChapter.className = "read-aloud-bar__next-chapter";
    nextChapter.hidden = true;
    if (nextLink) {
      nextChapter.href = nextLink.getAttribute("href");
      nextChapter.textContent = (nextLink.getAttribute("aria-label") || "Next chapter").replace(/^Next: /, "") + " →";
    }

    const closeBtn = iconButton("close", "Stop reading aloud", "read-aloud-bar__btn read-aloud-bar__btn--close");
    closeBtn.addEventListener("click", close);

    const now = document.createElement("div");
    now.className = "read-aloud-bar__now";
    now.append(whereBtn, statusEl, nextChapter);

    controls.append(prevBtn, toggleBtn, nextBtn, now, closeBtn);

    const settings = document.createElement("div");
    settings.className = "read-aloud-bar__settings";

    rateSelect = document.createElement("select");
    for (const r of RATES) rateSelect.add(new Option(rateLabel(r), String(r), false, r === rate));
    rateSelect.addEventListener("change", () => {
      rate = Number(rateSelect.value);
      store(RATE_KEY, rate === DEFAULT_RATE ? null : rate);
      if (playing) speakFrom(pos);
    });

    voiceSelect = document.createElement("select");
    voiceSelect.addEventListener("change", () => {
      voice = voices().find((v) => v.voiceURI === voiceSelect.value) || null;
      store(VOICE_KEY, voice?.voiceURI);
      if (playing) speakFrom(pos);
    });
    fillVoices();

    settings.append(labelled("Speed", rateSelect), labelled("Device voice", voiceSelect));

    bar.append(controls, settings);
    // Right after the Read aloud button, so the bar is next in the tab order
    // even though it shows at the foot of the screen.
    root.appendChild(bar);
    document.documentElement.classList.add("read-aloud-on");
  }

  function labelled(text, control) {
    const label = document.createElement("label");
    label.className = "read-aloud-bar__setting";
    const span = document.createElement("span");
    span.textContent = text;
    label.append(span, control);
    return label;
  }

  function fillVoices() {
    if (!voiceSelect) return;
    const list = voices();
    resolveVoice();
    voiceSelect.replaceChildren();
    if (!list.length) {
      voiceSelect.add(new Option("Default voice", ""));
      voiceSelect.disabled = true;
      return;
    }
    voiceSelect.disabled = false;
    for (const v of list) {
      voiceSelect.add(new Option(voiceLabel(v), v.voiceURI, false, v.voiceURI === voice?.voiceURI));
    }
  }

  // Chrome loads its voices after the page does.
  synth.addEventListener?.("voiceschanged", () => {
    const before = voice?.voiceURI;
    fillVoices();
    if (playing && voice?.voiceURI !== before) speakFrom(pos);
  });

  function jump(i) {
    if (i < 0) return;
    following = true;
    if (playing) return speakFrom(i);
    finished = false;
    pos = i;
    showPosition();
    render();
  }

  function setWhere(verse) {
    if (!whereBtn) return;
    whereBtn.textContent = verse === null ? title : `${title}:${verse}`;
  }

  function setStatus(text) {
    if (!statusEl) return;
    statusEl.textContent = text;
    statusEl.hidden = !text;
  }

  function render({ keepStatus = false } = {}) {
    if (!bar) return;
    toggleBtn.innerHTML = icon(playing ? "pause" : "play");
    toggleBtn.setAttribute("aria-label", playing ? "Pause" : finished ? "Read the chapter again" : "Play");
    whereBtn.hidden = finished;
    nextChapter.hidden = !finished || !nextLink;
    if (!keepStatus) setStatus(finished ? `End of ${title}.` : "");
  }

  /* ── Starting ─────────────────────────────────────────────────────── */

  function startAt(verse) {
    ensureChunks();
    if (!chunks.length) return;
    resolveVoice();
    if (!bar) buildBar();
    following = true;
    shownVerse = undefined;
    const i = verse == null ? 0 : firstChunkOf(chunks, verse);
    speakFrom(i < 0 ? 0 : i);
  }

  startButton?.addEventListener("click", () => {
    // A second press while the bar is open is a request to hear it from the
    // top, which is what the button says.
    startAt(null);
  });

  return { startAt };
}
