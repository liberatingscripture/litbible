const STORAGE = {
  markers: "lit_rm_markers",
  font: "lit_rm_fontSize",
  leading: "lit_rm_lineHeight",
  focus: "lit_rm_focus",
};

const FONT_OPTIONS = new Set(["sm", "md", "lg"]);
const LEADING_OPTIONS = new Set(["normal", "roomy"]);
const ON_OFF_OPTIONS = new Set(["on", "off"]);

const prefersReducedMotion = window.matchMedia(
  "(prefers-reduced-motion: reduce)",
).matches;

function safeGet(key) {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(key, value) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Ignore storage failures.
  }
}

function safeRemove(key) {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Ignore storage failures.
  }
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function parseResume(raw) {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;

    const anchor =
      typeof parsed.anchor === "string" && parsed.anchor.trim()
        ? parsed.anchor.trim()
        : null;
    const offset = Number(parsed.offset);

    if (!anchor || !Number.isFinite(offset)) return null;
    return { anchor, offset };
  } catch {
    return null;
  }
}

function initReadMode() {
  const page = document.querySelector(".rm-page[data-rm-root]");
  if (!(page instanceof HTMLElement)) return;

  const reader = page.querySelector("[data-rm-reader]");
  const toolbar = page.querySelector(".rm-toolbar");
  const textRoot = page.querySelector("[data-rm-text]");

  if (!(reader instanceof HTMLElement)) return;
  if (!(toolbar instanceof HTMLElement)) return;
  if (!(textRoot instanceof HTMLElement)) return;

  const html = document.documentElement;

  const bookKey = String(page.dataset.rmBook || "").trim();
  const bookTitle = String(page.dataset.rmBookTitle || "").trim() || "Book";
  const hasIntro = String(page.dataset.rmHasIntro || "") === "true";
  const studyIntroHref =
    String(page.dataset.rmStudyIntroHref || "").trim() || `/${bookKey}-intro`;

  const whereEl = page.querySelector("[data-rm-where]");
  const progressEl = page.querySelector("[data-rm-progress]");
  const progressBar = page.querySelector("[data-rm-progress-bar]");

  const studyToggle = page.querySelector("[data-rm-study-toggle]");
  const studyPanel = page.querySelector("[data-rm-study-panel]");
  const studyChapterOption = page.querySelector("[data-rm-study-chapter-option]");
  const studyIntroOption = page.querySelector("[data-rm-study-intro-option]");

  const markersToggle = page.querySelector("[data-rm-markers-toggle]");
  const focusToggle = page.querySelector("[data-rm-focus-toggle]");

  const aaToggle = page.querySelector("[data-rm-aa-toggle]");
  const aaPanel = page.querySelector("[data-rm-aa-panel]");

  const tocToggle = page.querySelector("[data-rm-toc-toggle]");
  const tocPanel = page.querySelector("[data-rm-toc-panel]");

  const tocTop = page.querySelector("[data-rm-top]");
  const tocCurrent = page.querySelector("[data-rm-current]");
  const tocTargets = Array.from(page.querySelectorAll("[data-rm-target]"));
  const tocChapterButtons = Array.from(
    page.querySelectorAll("[data-rm-chapter-btn]"),
  ).filter((el) => el instanceof HTMLButtonElement);
  const tocGroupTabs = Array.from(
    page.querySelectorAll("[data-rm-group-tab]"),
  ).filter((el) => el instanceof HTMLButtonElement);
  const tocGroupPanels = Array.from(
    page.querySelectorAll("[data-rm-group-panel]"),
  ).filter((el) => el instanceof HTMLElement);

  const resumeBox = page.querySelector("[data-rm-resume]");
  const resumeYes = page.querySelector("[data-rm-resume-yes]");
  const resumeNo = page.querySelector("[data-rm-resume-no]");
  const startOverButton = page.querySelector("[data-rm-start-over]");

  const typographyButtons = Array.from(page.querySelectorAll("[data-rm-set]"));

  const chapterAnchors = Array.from(
    page.querySelectorAll(".rm-ch-anchor[data-rm-chapter]"),
  ).filter((el) => el instanceof HTMLElement);

  if (!chapterAnchors.length) return;

  const chapterById = new Map();
  for (const anchor of chapterAnchors) {
    chapterById.set(anchor.id, anchor);
  }

  const focusTargets = Array.from(
    page.querySelectorAll(".rm-text p, .rm-text p.hbq-line"),
  ).filter((el) => el instanceof HTMLElement);

  let activeChapter = Number(chapterAnchors[0].dataset.rmChapter || 1) || 1;

  let markersMode = ON_OFF_OPTIONS.has(safeGet(STORAGE.markers) || "")
    ? safeGet(STORAGE.markers)
    : "on";

  const typographyState = {
    font: FONT_OPTIONS.has(safeGet(STORAGE.font) || "")
      ? safeGet(STORAGE.font)
      : "md",
    leading: LEADING_OPTIONS.has(safeGet(STORAGE.leading) || "")
      ? safeGet(STORAGE.leading)
      : "normal",
  };

  let focusMode = ON_OFF_OPTIONS.has(safeGet(STORAGE.focus) || "")
    ? safeGet(STORAGE.focus)
    : "off";

  const resumeKey = `lit_rm_resume_${bookKey}`;
  let resumeState = parseResume(safeGet(resumeKey));

  let activeFocusTarget = null;
  const visibleFocusTargets = new Set();
  let tocSelectedGroup = -1;
  let tocUserSelectedGroupWhileOpen = false;

  const studyChapterHref = (chapter) => `/${bookKey}-${chapter}`;

  function scrollToAnchor(anchor, extraOffset = 0) {
    const target = document.getElementById(anchor);
    if (!target) return false;

    const top =
      window.scrollY + target.getBoundingClientRect().top + Number(extraOffset || 0);

    window.scrollTo({
      top,
      behavior: prefersReducedMotion ? "auto" : "smooth",
    });
    return true;
  }

  function setHash(anchor) {
    if (!anchor) return;
    const next = `${window.location.pathname}#${anchor}`;
    window.history.replaceState(null, "", next);
  }

  function setToolbarOpenState(state) {
    const open =
      state === "toc" || state === "study" || state === "aa" ? state : "";
    toolbar.dataset.rmOpen = open;
  }

  function closePanels() {
    if (tocPanel instanceof HTMLElement) tocPanel.hidden = true;
    if (aaPanel instanceof HTMLElement) aaPanel.hidden = true;
    if (studyPanel instanceof HTMLElement) studyPanel.hidden = true;
    tocUserSelectedGroupWhileOpen = false;

    if (tocToggle instanceof HTMLButtonElement) {
      tocToggle.setAttribute("aria-expanded", "false");
    }
    if (aaToggle instanceof HTMLButtonElement) {
      aaToggle.setAttribute("aria-expanded", "false");
    }
    if (studyToggle instanceof HTMLButtonElement) {
      studyToggle.setAttribute("aria-expanded", "false");
    }

    setToolbarOpenState("");
    requestAnimationFrame(updateToolbarOffset);
  }

  function openPanel(panelName) {
    const openToc = panelName === "toc";
    const openAa = panelName === "aa";
    const openStudy = panelName === "study";

    if (tocPanel instanceof HTMLElement) tocPanel.hidden = !openToc;
    if (aaPanel instanceof HTMLElement) aaPanel.hidden = !openAa;
    if (studyPanel instanceof HTMLElement) studyPanel.hidden = !openStudy;

    if (tocToggle instanceof HTMLButtonElement) {
      tocToggle.setAttribute("aria-expanded", openToc ? "true" : "false");
    }
    if (aaToggle instanceof HTMLButtonElement) {
      aaToggle.setAttribute("aria-expanded", openAa ? "true" : "false");
    }
    if (studyToggle instanceof HTMLButtonElement) {
      studyToggle.setAttribute("aria-expanded", openStudy ? "true" : "false");
    }

    if (openToc) setToolbarOpenState("toc");
    else if (openStudy) setToolbarOpenState("study");
    else if (openAa) setToolbarOpenState("aa");
    else setToolbarOpenState("");

    if (!openToc) {
      tocUserSelectedGroupWhileOpen = false;
    } else {
      syncTocGroupToActiveChapter(true);
    }

    requestAnimationFrame(updateToolbarOffset);
  }

  function updateToolbarOffset() {
    const h = toolbar.getBoundingClientRect().height;
    page.style.setProperty("--rm-toolbar-offset", `${Math.ceil(h)}px`);
  }

  function applyMarkers(mode, persist = true) {
    markersMode = mode === "off" ? "off" : "on";
    reader.dataset.rmMarkers = markersMode;

    if (markersToggle instanceof HTMLButtonElement) {
      const on = markersMode === "on";
      markersToggle.setAttribute("aria-pressed", on ? "true" : "false");
      markersToggle.textContent = on ? "Nums: On" : "Nums: Off";
    }

    if (persist) safeSet(STORAGE.markers, markersMode);
  }

  function applyTypography(persist = true) {
    html.dataset.rmFont = typographyState.font;
    html.dataset.rmLeading = typographyState.leading;
    for (const button of typographyButtons) {
      if (!(button instanceof HTMLButtonElement)) continue;

      const token = String(button.dataset.rmSet || "");
      const [group, value] = token.split(":");

      const pressed =
        (group === "font" && value === typographyState.font) ||
        (group === "leading" && value === typographyState.leading);

      button.setAttribute("aria-pressed", pressed ? "true" : "false");
    }

    if (!persist) return;

    safeSet(STORAGE.font, typographyState.font);
    safeSet(STORAGE.leading, typographyState.leading);
  }

  function clearFocusClass() {
    if (!(activeFocusTarget instanceof HTMLElement)) return;
    activeFocusTarget.classList.remove("rm-focus-active");
    activeFocusTarget = null;
  }

  function pickActiveFocusTarget() {
    if (focusMode !== "on") {
      clearFocusClass();
      return;
    }

    const pool =
      visibleFocusTargets.size > 0
        ? Array.from(visibleFocusTargets)
        : focusTargets;

    if (!pool.length) {
      clearFocusClass();
      return;
    }

    const anchorY = window.innerHeight * 0.3;
    let best = null;
    let bestDistance = Number.POSITIVE_INFINITY;

    for (const node of pool) {
      const rect = node.getBoundingClientRect();
      if (rect.bottom <= 0 || rect.top >= window.innerHeight) continue;

      const center = rect.top + rect.height / 2;
      const distance = Math.abs(center - anchorY);

      if (distance < bestDistance) {
        bestDistance = distance;
        best = node;
      }
    }

    if (!(best instanceof HTMLElement)) {
      clearFocusClass();
      return;
    }

    if (activeFocusTarget === best) return;

    clearFocusClass();
    activeFocusTarget = best;
    activeFocusTarget.classList.add("rm-focus-active");
  }

  function applyFocus(mode, persist = true) {
    focusMode = mode === "on" ? "on" : "off";
    reader.dataset.rmFocus = focusMode;

    if (focusToggle instanceof HTMLButtonElement) {
      const on = focusMode === "on";
      focusToggle.setAttribute("aria-pressed", on ? "true" : "false");
      focusToggle.textContent = on ? "Focus: On" : "Focus: Off";
    }

    if (focusMode !== "on") clearFocusClass();
    else pickActiveFocusTarget();

    if (persist) safeSet(STORAGE.focus, focusMode);
  }

  function getGroupIndexForChapter(chapter) {
    if (!tocGroupPanels.length) return -1;

    const chapterNum = Number(chapter) || 1;
    for (let i = 0; i < tocGroupPanels.length; i += 1) {
      const panel = tocGroupPanels[i];
      const start = Number(panel.dataset.rmGroupStart || 0);
      const end = Number(panel.dataset.rmGroupEnd || 0);
      if (chapterNum >= start && chapterNum <= end) return i;
    }

    return 0;
  }

  function setTocGroupSelection(index, fromUser = false) {
    if (!tocGroupTabs.length || !tocGroupPanels.length) return;

    const bounded = clamp(Number(index) || 0, 0, tocGroupPanels.length - 1);
    tocSelectedGroup = bounded;

    for (let i = 0; i < tocGroupTabs.length; i += 1) {
      const tab = tocGroupTabs[i];
      tab.setAttribute("aria-selected", i === bounded ? "true" : "false");
    }

    for (let i = 0; i < tocGroupPanels.length; i += 1) {
      tocGroupPanels[i].hidden = i !== bounded;
    }

    if (fromUser) tocUserSelectedGroupWhileOpen = true;
  }

  function syncTocGroupToActiveChapter(force = false) {
    if (!tocGroupTabs.length || !tocGroupPanels.length) return;

    const tocIsOpen = tocPanel instanceof HTMLElement && !tocPanel.hidden;
    if (!force && tocIsOpen && tocUserSelectedGroupWhileOpen) return;

    const nextGroup = getGroupIndexForChapter(activeChapter);
    if (nextGroup < 0) return;
    if (tocSelectedGroup === nextGroup && !force) return;
    setTocGroupSelection(nextGroup, false);
  }

  function updateActiveChapterButton() {
    if (!tocChapterButtons.length) return;

    for (const button of tocChapterButtons) {
      const chapter = Number(button.dataset.rmChapterBtn || 0);
      const isCurrent = chapter === activeChapter;
      if (isCurrent) {
        button.setAttribute("aria-current", "true");
      } else {
        button.removeAttribute("aria-current");
      }
    }
  }

  function setActiveChapter(nextChapter) {
    const bounded = clamp(Number(nextChapter) || 1, 1, chapterAnchors.length);
    if (activeChapter === bounded) {
      syncTocGroupToActiveChapter(false);
      updateActiveChapterButton();
      return;
    }

    activeChapter = bounded;

    if (whereEl instanceof HTMLElement) {
      whereEl.textContent = `${bookTitle} · Chapter ${activeChapter}`;
    }

    if (studyChapterOption instanceof HTMLAnchorElement) {
      studyChapterOption.href = studyChapterHref(activeChapter);
    }

    syncTocGroupToActiveChapter(false);
    updateActiveChapterButton();
  }

  function findActiveChapterByViewportLine() {
    const line = window.innerHeight * 0.3;
    let winner = chapterAnchors[0];

    for (const anchor of chapterAnchors) {
      const top = anchor.getBoundingClientRect().top;
      if (top <= line) winner = anchor;
      else break;
    }

    return Number(winner.dataset.rmChapter || 1) || 1;
  }

  function updateProgress() {
    const toolbarHeight = toolbar.getBoundingClientRect().height;

    const textTop = window.scrollY + textRoot.getBoundingClientRect().top;
    const start = textTop - toolbarHeight;
    const end = start + textRoot.scrollHeight - window.innerHeight;

    const pct =
      end <= start
        ? 100
        : clamp(Math.round(((window.scrollY - start) / (end - start)) * 100), 0, 100);

    if (progressEl instanceof HTMLElement) {
      progressEl.textContent = `${pct}%`;
    }

    if (progressBar instanceof HTMLElement) {
      progressBar.style.width = `${pct}%`;
    }
  }

  function hideResumePrompt() {
    if (resumeBox instanceof HTMLElement) resumeBox.hidden = true;
  }

  function saveResume() {
    const anchor = `ch-${activeChapter}`;
    const chapterEl = chapterById.get(anchor);
    if (!(chapterEl instanceof HTMLElement)) return;

    const chapterTop = window.scrollY + chapterEl.getBoundingClientRect().top;
    const offset = Math.round(window.scrollY - chapterTop);

    const payload = JSON.stringify({ anchor, offset });
    safeSet(resumeKey, payload);
    resumeState = { anchor, offset };
  }

  function clearResume(andScrollTop = false) {
    safeRemove(resumeKey);
    resumeState = null;
    hideResumePrompt();

    if (andScrollTop) {
      window.scrollTo({
        top: 0,
        behavior: prefersReducedMotion ? "auto" : "smooth",
      });
      window.history.replaceState(null, "", window.location.pathname);
    }
  }

  function jumpToCurrentChapter() {
    const anchor = `ch-${activeChapter}`;
    if (!scrollToAnchor(anchor)) return;
    setHash(anchor);
    closePanels();
  }

  function goToStudyChapter() {
    const href = studyChapterHref(activeChapter);
    if (href) window.location.href = href;
  }

  if (studyIntroOption instanceof HTMLAnchorElement) {
    if (hasIntro) {
      studyIntroOption.href = studyIntroHref;
    }
  }

  if (whereEl instanceof HTMLElement) {
    whereEl.textContent = `${bookTitle} · Chapter ${activeChapter}`;
  }

  if (studyChapterOption instanceof HTMLAnchorElement) {
    studyChapterOption.href = studyChapterHref(activeChapter);
  }

  syncTocGroupToActiveChapter(true);
  updateActiveChapterButton();

  updateProgress();

  applyMarkers(markersMode || "on", false);
  applyTypography(false);
  applyFocus(focusMode || "off", false);

  updateToolbarOffset();
  setToolbarOpenState("");

  const chapterObserver = new IntersectionObserver(
    () => {
      setActiveChapter(findActiveChapterByViewportLine());
    },
    {
      root: null,
      rootMargin: "-30% 0px -65% 0px",
      threshold: 0,
    },
  );

  for (const anchor of chapterAnchors) {
    chapterObserver.observe(anchor);
  }

  const focusObserver = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!(entry.target instanceof HTMLElement)) continue;

        if (entry.isIntersecting) visibleFocusTargets.add(entry.target);
        else visibleFocusTargets.delete(entry.target);
      }

      pickActiveFocusTarget();
    },
    {
      root: null,
      rootMargin: "-30% 0px -60% 0px",
      threshold: [0, 0.15, 0.4, 0.8],
    },
  );

  for (const node of focusTargets) {
    focusObserver.observe(node);
  }

  if (studyToggle instanceof HTMLButtonElement) {
    studyToggle.addEventListener("click", () => {
      const shouldOpen = !(studyPanel instanceof HTMLElement) || studyPanel.hidden;
      openPanel(shouldOpen ? "study" : "none");
    });

    studyToggle.addEventListener("keydown", (event) => {
      if (event.key !== "Enter") return;
      event.preventDefault();
      goToStudyChapter();
    });
  }

  if (tocToggle instanceof HTMLButtonElement) {
    tocToggle.addEventListener("click", () => {
      const shouldOpen = !(tocPanel instanceof HTMLElement) || tocPanel.hidden;
      openPanel(shouldOpen ? "toc" : "none");
    });
  }

  if (aaToggle instanceof HTMLButtonElement) {
    aaToggle.addEventListener("click", () => {
      const shouldOpen = !(aaPanel instanceof HTMLElement) || aaPanel.hidden;
      openPanel(shouldOpen ? "aa" : "none");
    });
  }

  if (tocTop instanceof HTMLButtonElement) {
    tocTop.addEventListener("click", () => {
      window.scrollTo({ top: 0, behavior: prefersReducedMotion ? "auto" : "smooth" });
      window.history.replaceState(null, "", window.location.pathname);
      closePanels();
    });
  }

  if (tocCurrent instanceof HTMLButtonElement) {
    tocCurrent.addEventListener("click", () => {
      jumpToCurrentChapter();
    });
  }

  for (const tab of tocGroupTabs) {
    tab.addEventListener("click", () => {
      const idx = Number(tab.dataset.rmGroupTab);
      if (!Number.isFinite(idx)) return;
      setTocGroupSelection(idx, true);
    });
  }

  for (const target of tocTargets) {
    if (!(target instanceof HTMLButtonElement)) continue;

    target.addEventListener("click", () => {
      const anchor = String(target.dataset.rmTarget || "").trim();
      if (!anchor) return;

      if (scrollToAnchor(anchor)) {
        setHash(anchor);
      }

      closePanels();
    });
  }

  if (markersToggle instanceof HTMLButtonElement) {
    markersToggle.addEventListener("click", () => {
      applyMarkers(markersMode === "on" ? "off" : "on", true);
    });
  }

  if (focusToggle instanceof HTMLButtonElement) {
    focusToggle.addEventListener("click", () => {
      applyFocus(focusMode === "on" ? "off" : "on", true);
    });
  }

  for (const button of typographyButtons) {
    if (!(button instanceof HTMLButtonElement)) continue;

    button.addEventListener("click", () => {
      const token = String(button.dataset.rmSet || "");
      const [group, value] = token.split(":");

      if (group === "font" && FONT_OPTIONS.has(value)) {
        typographyState.font = value;
      } else if (group === "leading" && LEADING_OPTIONS.has(value)) {
        typographyState.leading = value;      } else {
        return;
      }

      applyTypography(true);
      updateToolbarOffset();
    });
  }

  if (resumeYes instanceof HTMLButtonElement) {
    resumeYes.addEventListener("click", () => {
      if (!resumeState) {
        hideResumePrompt();
        return;
      }

      const moved = scrollToAnchor(resumeState.anchor, resumeState.offset);
      if (moved) setHash(resumeState.anchor);
      hideResumePrompt();
    });
  }

  if (resumeNo instanceof HTMLButtonElement) {
    resumeNo.addEventListener("click", () => {
      clearResume(true);
    });
  }

  if (startOverButton instanceof HTMLButtonElement) {
    startOverButton.addEventListener("click", () => {
      clearResume(true);
      closePanels();
    });
  }

  toolbar.addEventListener("click", () => {
    updateToolbarOffset();
  });

  document.addEventListener("click", (event) => {
    if (!(event.target instanceof Node)) return;
    if (toolbar.contains(event.target)) return;
    closePanels();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closePanels();
  });

  let scrollRaf = 0;
  let saveTimer = 0;

  const onScroll = () => {
    if (!scrollRaf) {
      scrollRaf = window.requestAnimationFrame(() => {
        scrollRaf = 0;
        setActiveChapter(findActiveChapterByViewportLine());
        updateProgress();
        pickActiveFocusTarget();
      });
    }

    window.clearTimeout(saveTimer);
    saveTimer = window.setTimeout(() => {
      saveResume();
    }, 420);
  };

  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", () => {
    updateToolbarOffset();
    setToolbarOpenState(toolbar.dataset.rmOpen || "");
    updateProgress();
    pickActiveFocusTarget();
  });

  const hash = decodeURIComponent(window.location.hash.replace(/^#/, ""));
  const hashTarget = hash ? document.getElementById(hash) : null;

  if (hashTarget) {
    requestAnimationFrame(() => {
      scrollToAnchor(hash, 0);
      setActiveChapter(findActiveChapterByViewportLine());
      updateProgress();
    });
    hideResumePrompt();
  } else if (resumeState && chapterById.has(resumeState.anchor)) {
    if (resumeBox instanceof HTMLElement) resumeBox.hidden = false;
  } else {
    hideResumePrompt();
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initReadMode, { once: true });
} else {
  initReadMode();
}

