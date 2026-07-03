// src/scripts/read-mode.js

const STORAGE = {
  markers: "lit_rm_markers",
  font: "lit_rm_fontSize",
  leading: "lit_rm_lineHeight",
  focus: "lit_rm_focus",
};

const FONT_OPTIONS = new Set(["sm", "md", "lg"]);
const LEADING_OPTIONS = new Set(["normal", "roomy"]);
const ON_OFF_OPTIONS = new Set(["on", "off"]);

// Single source of truth for "sheet mode" (toolbar becomes a bottom sheet,
// FAB appears). MUST match the small-mode media query in read-mode.css.
const sheetModeQuery = window.matchMedia("(max-width: 1100px)");

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
    const scrollY = Number(parsed.scrollY);

    const hasOldFormat = anchor && Number.isFinite(offset);
    const hasScrollY = Number.isFinite(scrollY);

    if (!hasOldFormat && !hasScrollY) return null;

    return {
      anchor: hasOldFormat ? anchor : null,
      offset: hasOldFormat ? offset : 0,
      scrollY: hasScrollY ? scrollY : null,
    };
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

  const whereEl = page.querySelector("[data-rm-where]");
  const progressEl = page.querySelector("[data-rm-progress]");
  const progressBar = page.querySelector("[data-rm-progress-bar]");

  // Study switch (anchor) matches the current markup.
  const studySwitch = page.querySelector("[data-rm-study-switch]");

  const markersToggle = page.querySelector("[data-rm-markers-toggle]");
  const focusToggle = page.querySelector("[data-rm-focus-toggle]");

  const aaToggle = page.querySelector("[data-rm-aa-toggle]");
  const aaPanel = page.querySelector("[data-rm-aa-panel]");

  const tocToggle = page.querySelector("[data-rm-toc-toggle]");
  const tocPanel = page.querySelector("[data-rm-toc-panel]");

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

  const resumeChip = page.querySelector("[data-rm-resume-chip]");
  const resumeGo = page.querySelector("[data-rm-resume-go]");
  const resumeDismiss = page.querySelector("[data-rm-resume-dismiss]");
  const startOverButton = page.querySelector("[data-rm-start-over]");
  const fabToggle = page.querySelector("[data-rm-fab]");
  const toolbarClose =
    page.querySelector("[data-rm-mobile-close]") ||
    page.querySelector("[data-rm-toolbar-close]");

  const typographyButtons = Array.from(page.querySelectorAll("[data-rm-set]"));

  function isSheetMode() {
    return sheetModeQuery.matches;
  }

  // Leaving sheet mode must close the bottom sheet; toolbar geometry changes
  // at the breakpoint either way.
  sheetModeQuery.addEventListener("change", (e) => {
    if (!e.matches) closeMobileTools();
    updateToolbarOffset();
  });

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

  // Return-to-location state for the Start Over button.
  let returnLocationState = null;

  let activeFocusTarget = null;
  const visibleFocusTargets = new Set();
  let tocSelectedGroup = -1;
  let tocUserSelectedGroupWhileOpen = false;

  const studyChapterHref = (chapter) => `/${bookKey}-${chapter}`;

  // --- Start Over button structure (prevents text concatenation) ---
  let startOverIconEl = null;
  let startOverLabelEl = null;

  function ensureStartOverButtonStructure() {
    if (!(startOverButton instanceof HTMLButtonElement)) return;

    const existingIcon = startOverButton.querySelector(".rm-btn-icon");
    const existingLabel = startOverButton.querySelector(".rm-btn-label");

    if (existingIcon && existingLabel) {
      startOverIconEl = existingIcon;
      startOverLabelEl = existingLabel;
      return;
    }

    startOverButton.textContent = "";

    const icon = document.createElement("span");
    icon.className = "rm-btn-icon";
    icon.setAttribute("aria-hidden", "true");
    icon.textContent = "↑";

    const label = document.createElement("span");
    label.className = "rm-btn-label";
    label.textContent = "Return to Beginning";

    startOverButton.append(icon, label);

    startOverIconEl = icon;
    startOverLabelEl = label;
  }
  // ---------------------------------------------------------------

  function setFabExpanded(expanded) {
    if (!(fabToggle instanceof HTMLButtonElement)) return;
    fabToggle.setAttribute("aria-expanded", expanded ? "true" : "false");
  }

  function isToolsOpen() {
    return html.classList.contains("rm-tools-open");
  }

  // Landing position is handled by CSS: anchors carry scroll-margin-top
  // (toolbar offset + reading gap), so a plain scrollIntoView is enough.
  function scrollToAnchor(anchor) {
    const target = document.getElementById(anchor);
    if (!target) return false;

    target.scrollIntoView({
      behavior: prefersReducedMotion ? "auto" : "smooth",
      block: "start",
    });
    return true;
  }

  function setHash(anchor) {
    if (!anchor) return;
    const next = `${window.location.pathname}#${anchor}`;
    window.history.replaceState(null, "", next);
  }

  function setToolbarOpenState(state) {
    const open = state === "toc" || state === "aa" ? state : "";
    toolbar.dataset.rmOpen = open;
  }

  function closePanels() {
    if (tocPanel instanceof HTMLElement) tocPanel.hidden = true;
    if (aaPanel instanceof HTMLElement) aaPanel.hidden = true;
    tocUserSelectedGroupWhileOpen = false;

    if (tocToggle instanceof HTMLButtonElement) {
      tocToggle.setAttribute("aria-expanded", "false");
    }
    if (aaToggle instanceof HTMLButtonElement) {
      aaToggle.setAttribute("aria-expanded", "false");
    }

    setToolbarOpenState("");
    requestAnimationFrame(updateToolbarOffset);
  }

  function openPanel(panelName) {
    const openToc = panelName === "toc";
    const openAa = panelName === "aa";

    if (tocPanel instanceof HTMLElement) tocPanel.hidden = !openToc;
    if (aaPanel instanceof HTMLElement) aaPanel.hidden = !openAa;

    if (tocToggle instanceof HTMLButtonElement) {
      tocToggle.setAttribute("aria-expanded", openToc ? "true" : "false");
    }
    if (aaToggle instanceof HTMLButtonElement) {
      aaToggle.setAttribute("aria-expanded", openAa ? "true" : "false");
    }

    if (openToc) setToolbarOpenState("toc");
    else if (openAa) setToolbarOpenState("aa");
    else setToolbarOpenState("");

    if (!openToc) {
      tocUserSelectedGroupWhileOpen = false;
    } else {
      syncTocGroupToActiveChapter(true);
    }

    requestAnimationFrame(updateToolbarOffset);
  }

  let lastToolbarOffset = -1;

  function updateToolbarOffset() {
    const h = Math.ceil(toolbar.getBoundingClientRect().height);
    if (h === lastToolbarOffset) return;
    lastToolbarOffset = h;
    page.style.setProperty("--rm-toolbar-offset", `${h}px`);
  }

  function applyMarkers(mode, persist = true) {
    markersMode = mode === "off" ? "off" : "on";
    reader.dataset.rmMarkers = markersMode;

    if (markersToggle instanceof HTMLButtonElement) {
      const on = markersMode === "on";
      markersToggle.setAttribute("aria-pressed", on ? "true" : "false");
      markersToggle.textContent = on ? "Numbers: On" : "Numbers: Off";
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

  function updateStudySwitchHref() {
    if (!(studySwitch instanceof HTMLAnchorElement)) return;
    studySwitch.href = studyChapterHref(activeChapter);
    studySwitch.setAttribute(
      "aria-label",
      `Switch to Study View for ${bookTitle} chapter ${activeChapter}`,
    );
  }

  function setActiveChapter(nextChapter) {
    const bounded = clamp(Number(nextChapter) || 1, 1, chapterAnchors.length);
    if (activeChapter === bounded) {
      syncTocGroupToActiveChapter(false);
      updateActiveChapterButton();
      updateStudySwitchHref();
      return;
    }

    activeChapter = bounded;

    if (whereEl instanceof HTMLElement) {
      whereEl.textContent = `${bookTitle} · Chapter ${activeChapter}`;
    }

    syncTocGroupToActiveChapter(false);
    updateActiveChapterButton();
    updateStudySwitchHref();
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
        : clamp(
            Math.round(((window.scrollY - start) / (end - start)) * 100),
            0,
            100,
          );

    if (progressEl instanceof HTMLElement) {
      progressEl.textContent = `${pct}%`;
    }

    if (progressBar instanceof HTMLElement) {
      progressBar.style.width = `${pct}%`;
    }
  }

  // --- Non-blocking resume chip ("Continue at chapter N ↓") ---
  // The chip's target is captured once at load: saveResume() overwrites
  // resumeState as soon as the user scrolls, and the chip must keep offering
  // the position from the PREVIOUS visit.
  let resumeChipTarget = null;

  function hideResumeChip() {
    if (resumeChip instanceof HTMLElement) resumeChip.hidden = true;
    resumeChipTarget = null;
  }

  function showResumeChip() {
    if (!(resumeChip instanceof HTMLElement) || !resumeState) return;

    resumeChipTarget = { ...resumeState };

    if (resumeGo instanceof HTMLButtonElement) {
      const m = /^ch-(\d+)$/.exec(resumeChipTarget.anchor || "");
      resumeGo.textContent = m
        ? `Continue at chapter ${m[1]} ↓`
        : "Continue reading ↓";
    }

    resumeChip.hidden = false;
  }

  // --- Swipe-to-dismiss (bottom sheet) ---
  let dragActive = false;
  let dragStartY = 0;
  let dragLastY = 0;

  function isInteractiveTarget(node) {
    if (!(node instanceof Element)) return false;
    return !!node.closest(
      "button,a,input,select,textarea,label,[role='button'],[data-no-swipe]",
    );
  }

  function setSheetDragTransform(dy) {
    toolbar.style.transform = `translateY(${Math.max(0, dy)}px)`;
  }

  function resetSheetDragStyles() {
    toolbar.style.removeProperty("transform");
    toolbar.style.removeProperty("transition");
    toolbar.style.removeProperty("will-change");
  }

  function enableSheetDrag() {
    // Attached regardless of current mode — the handlers check isSheetMode()
    // so drag keeps working after a resize across the breakpoint.
    toolbar.addEventListener(
      "pointerdown",
      (e) => {
        if (!isSheetMode() || !isToolsOpen()) return;
        if (e.button !== 0) return;
        if (isInteractiveTarget(e.target)) return;

        // Only allow swipe-dismiss when the sheet is scrolled to top.
        // Prevents fighting with normal sheet-content scrolling.
        if (toolbar.scrollTop > 0) return;

        dragActive = true;
        dragStartY = e.clientY;
        dragLastY = e.clientY;

        toolbar.style.willChange = "transform";
        toolbar.style.transition = "none";

        try {
          toolbar.setPointerCapture(e.pointerId);
        } catch {
          // ignore
        }
      },
      { passive: true },
    );

    toolbar.addEventListener(
      "pointermove",
      (e) => {
        if (!dragActive) return;

        // Prevent the page from scrolling while we drag-dismiss the sheet.
        e.preventDefault();

        dragLastY = e.clientY;
        const dy = dragLastY - dragStartY;

        if (dy <= 0) {
          setSheetDragTransform(0);
          return;
        }

        setSheetDragTransform(dy);
      },
      { passive: false },
    );

    function endDrag() {
      if (!dragActive) return;
      dragActive = false;

      const dy = dragLastY - dragStartY;
      const h = toolbar.getBoundingClientRect().height;
      const threshold = Math.min(h * 0.25, 90);

      toolbar.style.transition = prefersReducedMotion
        ? "none"
        : "transform 180ms ease";

      if (dy > threshold) {
        resetSheetDragStyles();
        closeMobileTools({ focusFab: true });
      } else {
        setSheetDragTransform(0);
        window.setTimeout(() => {
          resetSheetDragStyles();
        }, prefersReducedMotion ? 0 : 200);
      }
    }

    toolbar.addEventListener("pointerup", endDrag, { passive: true });
    toolbar.addEventListener("pointercancel", endDrag, { passive: true });
  }
  // ---------------------------------------------------------

  function closeMobileTools({ focusFab = false } = {}) {
    // Clean up any drag styles/state
    resetSheetDragStyles();
    dragActive = false;

    if (isToolsOpen()) {
      html.classList.remove("rm-tools-open");
      // closePanels() already queues updateToolbarOffset() via requestAnimationFrame —
      // calling it synchronously here would force a layout read immediately after DOM
      // mutations, causing layout thrashing. Let the rAF handle it.
      closePanels();
    }

    setFabExpanded(false);

    if (focusFab && fabToggle instanceof HTMLButtonElement) {
      fabToggle.focus();
    }
  }

  function openMobileTools() {
    if (!isSheetMode()) return;

    html.classList.add("rm-tools-open");
    setFabExpanded(true);

    window.requestAnimationFrame(() => {
      updateToolbarOffset();

      if (toolbarClose instanceof HTMLButtonElement) {
        toolbarClose.focus();
      }
    });
  }

  function saveResume() {
    const anchor = `ch-${activeChapter}`;
    const chapterEl = chapterById.get(anchor);

    let offset = 0;
    if (chapterEl instanceof HTMLElement) {
      const chapterTop = window.scrollY + chapterEl.getBoundingClientRect().top;
      offset = Math.round(window.scrollY - chapterTop);
    }

    const scrollY = Math.round(window.scrollY);

    const payload = JSON.stringify({ anchor, offset, scrollY });
    safeSet(resumeKey, payload);

    resumeState = { anchor, offset, scrollY };
  }

  function clearResume(andScrollTop = false) {
    safeRemove(resumeKey);
    resumeState = null;
    hideResumeChip();

    if (andScrollTop) {
      window.scrollTo({
        top: 0,
        behavior: prefersReducedMotion ? "auto" : "smooth",
      });
      window.history.replaceState(null, "", window.location.pathname);
    }
  }

  function setReturnButtonState() {
    if (!(startOverButton instanceof HTMLButtonElement)) return;

    ensureStartOverButtonStructure();

    const icon = returnLocationState ? "↓" : "↑";
    const label = returnLocationState
      ? "Return to Location"
      : "Return to Beginning";

    if (startOverIconEl instanceof HTMLElement) {
      startOverIconEl.textContent = icon;
    }
    if (startOverLabelEl instanceof HTMLElement) {
      startOverLabelEl.textContent = label;
    }

    if (returnLocationState) {
      startOverButton.setAttribute(
        "aria-label",
        "Return to previous reading location",
      );
    } else {
      startOverButton.setAttribute(
        "aria-label",
        "Return to beginning of reading view",
      );
    }
  }

  function captureReturnLocation() {
    const anchor = `ch-${activeChapter}`;
    const chapterEl = chapterById.get(anchor);

    let offset = 0;
    if (chapterEl instanceof HTMLElement) {
      const chapterTop = window.scrollY + chapterEl.getBoundingClientRect().top;
      offset = Math.round(window.scrollY - chapterTop);
    }

    const focusIndex =
      activeFocusTarget instanceof HTMLElement
        ? focusTargets.indexOf(activeFocusTarget)
        : -1;

    return {
      anchor,
      offset,
      scrollY: Math.round(window.scrollY),
      focusIndex,
    };
  }

  function restoreReturnLocation() {
    if (!returnLocationState) return;

    const targetY = Number(returnLocationState.scrollY);
    const hasScrollY = Number.isFinite(targetY);

    if (hasScrollY) {
      window.scrollTo({
        top: Math.max(0, targetY),
        behavior: prefersReducedMotion ? "auto" : "smooth",
      });
    } else if (returnLocationState.anchor) {
      const moved = scrollToAnchor(returnLocationState.anchor);
      if (!moved) return;
    }

    if (returnLocationState.anchor) {
      setHash(returnLocationState.anchor);
    }

    window.requestAnimationFrame(() => {
      setActiveChapter(findActiveChapterByViewportLine());
      updateProgress();
      pickActiveFocusTarget();

      if (focusMode !== "on") return;

      const idx = Number(returnLocationState?.focusIndex);
      if (!Number.isFinite(idx) || idx < 0 || idx >= focusTargets.length) return;

      const target = focusTargets[idx];
      if (!(target instanceof HTMLElement)) return;

      clearFocusClass();
      activeFocusTarget = target;
      activeFocusTarget.classList.add("rm-focus-active");
    });
  }

  // Initial UI state
  if (whereEl instanceof HTMLElement) {
    whereEl.textContent = `${bookTitle} · Chapter ${activeChapter}`;
  }

  // Ensure button structure early, before first label set.
  ensureStartOverButtonStructure();

  syncTocGroupToActiveChapter(true);
  updateActiveChapterButton();
  updateStudySwitchHref();

  updateProgress();

  applyMarkers(markersMode || "on", false);
  applyTypography(false);
  applyFocus(focusMode || "off", false);

  setReturnButtonState();

  html.classList.remove("rm-tools-open");
  setFabExpanded(false);

  updateToolbarOffset();
  setToolbarOpenState("");

  // Enable swipe-to-dismiss handling once
  enableSheetDrag();

  // Active-chapter detection, driven directly by observer entries: the band
  // spans from the 30% viewport line down past the bottom of the document, so
  // an anchor's intersection state flips exactly when it crosses the line
  // (no narrow band a fast scroll could skip). An anchor NOT intersecting is
  // above the line — the active chapter is the last such anchor.
  const chaptersAboveLine = new Set();

  const chapterObserver = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!(entry.target instanceof HTMLElement)) continue;
        const chapter = Number(entry.target.dataset.rmChapter || 0);
        if (!chapter) continue;

        if (entry.isIntersecting) chaptersAboveLine.delete(chapter);
        else chaptersAboveLine.add(chapter);
      }

      let latest = 1;
      for (const chapter of chaptersAboveLine) {
        if (chapter > latest) latest = chapter;
      }
      setActiveChapter(latest);
    },
    {
      root: null,
      rootMargin: "-30% 0px 1000000px 0px",
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

  const startFocusObserver = () => {
    for (const node of focusTargets) {
      focusObserver.observe(node);
    }
  };

  if (typeof requestIdleCallback === "function") {
    requestIdleCallback(startFocusObserver, { timeout: 2000 });
  } else {
    setTimeout(startFocusObserver, 200);
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
        typographyState.leading = value;
      } else {
        return;
      }

      applyTypography(true);
      updateToolbarOffset();
    });
  }

  if (resumeGo instanceof HTMLButtonElement) {
    resumeGo.addEventListener("click", () => {
      const target = resumeChipTarget;
      hideResumeChip();
      if (!target) return;

      const y = Number(target.scrollY);

      if (Number.isFinite(y)) {
        window.scrollTo({
          top: Math.max(0, y),
          behavior: prefersReducedMotion ? "auto" : "smooth",
        });

        // Update the hash once the (possibly smooth) scroll settles — doing
        // it on the next frame would record the starting chapter instead.
        const finish = () => {
          setActiveChapter(findActiveChapterByViewportLine());
          updateProgress();
          setHash(`ch-${activeChapter}`);
        };
        if ("onscrollend" in window) {
          window.addEventListener("scrollend", finish, { once: true });
        } else {
          window.setTimeout(finish, prefersReducedMotion ? 50 : 800);
        }
        return;
      }

      if (target.anchor) {
        const moved = scrollToAnchor(target.anchor);
        if (moved) setHash(target.anchor);
      }
    });
  }

  if (resumeDismiss instanceof HTMLButtonElement) {
    resumeDismiss.addEventListener("click", () => {
      hideResumeChip();
    });
  }

  if (startOverButton instanceof HTMLButtonElement) {
    startOverButton.addEventListener("click", () => {
      // Second click: return to previous location
      if (returnLocationState) {
        restoreReturnLocation();
        returnLocationState = null;
        setReturnButtonState();
        closePanels();
        return;
      }

      // First click: capture current location then go to top
      setActiveChapter(findActiveChapterByViewportLine());
      returnLocationState = captureReturnLocation();
      setReturnButtonState();

      clearResume(true);
      closePanels();
    });
  }

  if (fabToggle instanceof HTMLButtonElement) {
    fabToggle.addEventListener("click", () => {
      if (isToolsOpen()) {
        closeMobileTools({ focusFab: true });
      } else {
        openMobileTools();
      }
    });
  }

  if (toolbarClose instanceof HTMLButtonElement) {
    toolbarClose.addEventListener("click", () => {
      closeMobileTools({ focusFab: true });
    });
  }

  document.addEventListener("click", (event) => {
    if (!(event.target instanceof Node)) return;

    const clickedToolbar = toolbar.contains(event.target);
    const clickedFab =
      fabToggle instanceof HTMLButtonElement && fabToggle.contains(event.target);

    if (isSheetMode() && isToolsOpen() && !clickedToolbar && !clickedFab) {
      closeMobileTools();
      return;
    }

    if (clickedToolbar) return;

    // Only close panels if one is actually open — avoids unnecessary
    // getBoundingClientRect() in updateToolbarOffset() on every document click.
    const tocOpen = tocPanel instanceof HTMLElement && !tocPanel.hidden;
    const aaOpen = aaPanel instanceof HTMLElement && !aaPanel.hidden;
    if (tocOpen || aaOpen) closePanels();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;

    if (resumeChip instanceof HTMLElement && !resumeChip.hidden) {
      hideResumeChip();
      return;
    }

    if (isSheetMode() && isToolsOpen()) {
      event.preventDefault();
      closeMobileTools({ focusFab: true });
      return;
    }

    closePanels();
  });

  let scrollRaf = 0;
  let saveTimer = 0;

  const onScroll = () => {
    // Allow page scroll while sheet remains open. The active chapter is
    // tracked by chapterObserver, not here.

    if (!scrollRaf) {
      scrollRaf = window.requestAnimationFrame(() => {
        scrollRaf = 0;
        updateProgress();
        pickActiveFocusTarget();
      });
    }

    // A reader who has scrolled a full viewport past the top has started
    // reading — the resume offer is no longer relevant.
    if (resumeChipTarget && window.scrollY > window.innerHeight) {
      hideResumeChip();
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
      scrollToAnchor(hash);
      setActiveChapter(findActiveChapterByViewportLine());
      updateProgress();
    });
  } else {
    const canShowResume =
      !!resumeState &&
      (Number.isFinite(Number(resumeState.scrollY)) ||
        (resumeState.anchor && chapterById.has(resumeState.anchor)));

    if (canShowResume) showResumeChip();
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initReadMode, { once: true });
} else {
  initReadMode();
}
