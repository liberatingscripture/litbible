// src/scripts/read-mode.js

// Text size, line spacing and verse numbers used to live here too, under
// lit_rm_fontSize / lit_rm_lineHeight / lit_rm_markers. They moved to the
// site's Display tray (SiteHeader.astro), which applies them before first
// paint (Layout.astro still reads those three keys as fallbacks). Focus is
// the one reading setting that stays Read View's own.
const STORAGE = {
  focus: "lit_rm_focus",
};

const ON_OFF_OPTIONS = new Set(["on", "off"]);

// Single source of truth for "sheet mode" (toolbar becomes a bottom sheet,
// FAB appears). MUST match the small-mode media query in read-mode.css.
const sheetModeQuery = window.matchMedia("(max-width: 900px)");

// The viewport line (as a fraction of viewport height) that decides the
// active chapter: the active chapter is the last anchor above this line.
// Drives BOTH the IntersectionObserver rootMargin and the programmatic
// findActiveChapterByViewportLine() sync used after jumps/resumes.
const ACTIVE_CHAPTER_LINE = 0.3;

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

    const scrollY = Number(parsed.scrollY);
    const hasScrollY = Number.isFinite(scrollY);

    if (!anchor && !hasScrollY) return null;

    return {
      anchor,
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

  // The live location label is the passage picker's trigger label
  // (ReadMenu mode="read" stamps data-rm-where on it); the picker root also
  // carries data-current-chapter, which we keep in sync so its chapter grid
  // highlights the chapter the reader is actually at.
  const whereEl = page.querySelector("[data-rm-where]");
  const readMenuRoot = page.querySelector(".rm-toolbar .read-menu");
  const progressEl = page.querySelector("[data-rm-progress]");
  const progressBar = page.querySelector("[data-rm-progress-bar]");

  // Study switch (anchor) matches the current markup.
  const studySwitch = page.querySelector("[data-rm-study-switch]");

  const focusToggle = page.querySelector("[data-rm-focus-toggle]");

  const resumeChip = page.querySelector("[data-rm-resume-chip]");
  const resumeGo = page.querySelector("[data-rm-resume-go]");
  const resumeDismiss = page.querySelector("[data-rm-resume-dismiss]");
  const startOverButton = page.querySelector("[data-rm-start-over]");
  const fabToggle = page.querySelector("[data-rm-fab]");
  const toolbarClose =
    page.querySelector("[data-rm-mobile-close]") ||
    page.querySelector("[data-rm-toolbar-close]");

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

  let focusMode = ON_OFF_OPTIONS.has(safeGet(STORAGE.focus) || "")
    ? safeGet(STORAGE.focus)
    : "off";

  const resumeKey = `lit_rm_resume_${bookKey}`;
  let resumeState = parseResume(safeGet(resumeKey));

  // Return-to-location state for the Start Over button.
  let returnLocationState = null;

  let activeFocusTarget = null;
  const visibleFocusTargets = new Set();

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
    label.textContent = "Back to Top";

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

  let lastToolbarOffset = -1;

  function updateToolbarOffset() {
    const h = Math.ceil(toolbar.getBoundingClientRect().height);
    if (h === lastToolbarOffset) return;
    lastToolbarOffset = h;
    page.style.setProperty("--rm-toolbar-offset", `${h}px`);
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
      // Only the label: the button also holds its icon.
      const label = focusToggle.querySelector(".rm-focus-label") || focusToggle;
      label.textContent = on ? "Focus: On" : "Focus: Off";
    }

    if (focusMode !== "on") clearFocusClass();
    else pickActiveFocusTarget();

    if (persist) safeSet(STORAGE.focus, focusMode);
  }

  // The picker rebuilds its chapter grid from data-current-chapter on every
  // open, so keeping the attribute fresh is all the sync it needs.
  function syncReadMenuChapter() {
    if (!(readMenuRoot instanceof HTMLElement)) return;
    readMenuRoot.setAttribute("data-current-chapter", String(activeChapter));
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
      updateStudySwitchHref();
      return;
    }

    activeChapter = bounded;

    if (whereEl instanceof HTMLElement) {
      whereEl.textContent = `${bookTitle} ${activeChapter}`;
    }

    syncReadMenuChapter();
    updateStudySwitchHref();
  }

  function findActiveChapterByViewportLine() {
    const line = window.innerHeight * ACTIVE_CHAPTER_LINE;
    let winner = chapterAnchors[0];

    for (const anchor of chapterAnchors) {
      const top = anchor.getBoundingClientRect().top;
      if (top <= line) winner = anchor;
      else break;
    }

    return Number(winner.dataset.rmChapter || 1) || 1;
  }

  // Which chapter anchor would a given scrollY land in (same rule as the
  // active-chapter line)? Used to validate saved resume offsets, which go
  // stale whenever layout changed since they were saved (viewport width,
  // font settings, toolbar changes all reflow the page).
  function chapterIdAtScrollY(y) {
    const line = y + window.innerHeight * ACTIVE_CHAPTER_LINE;
    let winner = chapterAnchors[0];

    for (const anchor of chapterAnchors) {
      const top = anchor.getBoundingClientRect().top + window.scrollY;
      if (top <= line) winner = anchor;
      else break;
    }

    return winner.id;
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
    // The passage picker rides on the sheet — close its popover along with
    // it rather than leaving it floating over the closed sheet.
    try {
      const openPopover = document.querySelector(
        ".read-menu__panel:popover-open",
      );
      if (openPopover instanceof HTMLElement) openPopover.hidePopover();
    } catch {
      // :popover-open unsupported — nothing to close.
    }

    // Clean up any drag styles/state
    resetSheetDragStyles();
    dragActive = false;

    if (isToolsOpen()) {
      html.classList.remove("rm-tools-open");
      // Deferred: a synchronous layout read straight after the class change
      // would force layout mid-mutation.
      requestAnimationFrame(updateToolbarOffset);
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
    const scrollY = Math.round(window.scrollY);

    safeSet(resumeKey, JSON.stringify({ anchor, scrollY }));

    resumeState = { anchor, scrollY };

    // Site-wide "Continue reading" listens for this (read/[book].astro).
    // This file is served unbundled (?url), so it can't import that module.
    page.dispatchEvent(
      new CustomEvent("rm:position", { detail: { book: bookKey, chapter: activeChapter } }),
    );
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
    const label = returnLocationState ? "My Location" : "Back to Top";

    if (startOverIconEl instanceof HTMLElement) {
      startOverIconEl.textContent = icon;
    }
    if (startOverLabelEl instanceof HTMLElement) {
      startOverLabelEl.textContent = label;
    }

    if (returnLocationState) {
      startOverButton.setAttribute(
        "aria-label",
        "My Location: back to where you were reading",
      );
    } else {
      startOverButton.setAttribute(
        "aria-label",
        "Back to top of the book",
      );
    }
  }

  function captureReturnLocation() {
    const anchor = `ch-${activeChapter}`;

    const focusIndex =
      activeFocusTarget instanceof HTMLElement
        ? focusTargets.indexOf(activeFocusTarget)
        : -1;

    return {
      anchor,
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
    whereEl.textContent = `${bookTitle} ${activeChapter}`;
  }

  // Ensure button structure early, before first label set.
  ensureStartOverButtonStructure();

  syncReadMenuChapter();
  updateStudySwitchHref();

  updateProgress();

  applyFocus(focusMode || "off", false);

  setReturnButtonState();

  html.classList.remove("rm-tools-open");
  setFabExpanded(false);

  updateToolbarOffset();

  // Enable swipe-to-dismiss handling once
  enableSheetDrag();

  // Active-chapter detection, driven directly by observer entries: the band
  // spans from the ACTIVE_CHAPTER_LINE down past the bottom of the document,
  // so an anchor's intersection state flips exactly when it crosses the line
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
      rootMargin: `-${ACTIVE_CHAPTER_LINE * 100}% 0px 1000000px 0px`,
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

  // Same-book picks from the passage picker are /read/<book>#ch-N links that
  // target THIS page: intercept them for an in-page smooth scroll instead of
  // a hard hash jump. Other books' links (and modified clicks) navigate
  // normally. The picker popover hangs off <body>, so listen on document.
  const normalizePath = (p) => p.replace(/\/+$/, "") || "/";

  document.addEventListener("click", (event) => {
    if (event.defaultPrevented) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
      return;
    }
    if (!(event.target instanceof Element)) return;

    const link = event.target.closest('a[href*="#ch-"]');
    if (!(link instanceof HTMLAnchorElement)) return;

    let url;
    try {
      url = new URL(link.href, window.location.href);
    } catch {
      return;
    }
    if (url.origin !== window.location.origin) return;
    if (normalizePath(url.pathname) !== normalizePath(window.location.pathname)) {
      return;
    }

    const anchor = decodeURIComponent(url.hash.replace(/^#/, ""));
    if (!chapterById.has(anchor)) return;

    event.preventDefault();

    // Close the picker explicitly: scrolling light-dismisses it anyway, but
    // re-picking the current chapter produces no scroll at all.
    try {
      const openPopover = document.querySelector(":popover-open");
      if (openPopover instanceof HTMLElement) openPopover.hidePopover();
    } catch {
      // :popover-open unsupported — the picker is a plain link there.
    }

    if (scrollToAnchor(anchor)) setHash(anchor);
    closeMobileTools();
  });

  if (focusToggle instanceof HTMLButtonElement) {
    focusToggle.addEventListener("click", () => {
      applyFocus(focusMode === "on" ? "off" : "on", true);
    });
  }

  if (resumeGo instanceof HTMLButtonElement) {
    resumeGo.addEventListener("click", () => {
      const target = resumeChipTarget;
      hideResumeChip();
      if (!target) return;

      const y = Number(target.scrollY);

      // Only trust the saved pixel offset if it still lands in the chapter
      // the chip promised — otherwise deliver the chapter start.
      const offsetIsStale =
        Number.isFinite(y) &&
        typeof target.anchor === "string" &&
        chapterById.has(target.anchor) &&
        chapterIdAtScrollY(Math.max(0, y)) !== target.anchor;

      if (Number.isFinite(y) && !offsetIsStale) {
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
        return;
      }

      // First click: capture current location then go to top
      setActiveChapter(findActiveChapterByViewportLine());
      returnLocationState = captureReturnLocation();
      setReturnButtonState();

      clearResume(true);
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

    // A detached target means another handler already rebuilt the UI around
    // it (the passage picker replaces its grid in place on a book pick), so
    // containment can't be judged — treat it as an inside click.
    if (!event.target.isConnected) return;

    // The picker panel lives on <body> (top-layer popover), not in the
    // toolbar — its clicks are toolbar interactions all the same.
    if (
      event.target instanceof Element &&
      event.target.closest(".read-menu__panel")
    ) {
      return;
    }

    const clickedToolbar = toolbar.contains(event.target);
    const clickedFab =
      fabToggle instanceof HTMLButtonElement && fabToggle.contains(event.target);

    if (isSheetMode() && isToolsOpen() && !clickedToolbar && !clickedFab) {
      closeMobileTools();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;

    // With the passage picker open, this Escape is the popover's native
    // light-dismiss — don't also collapse the sheet behind it.
    try {
      if (document.querySelector(":popover-open")) return;
    } catch {
      // Selector unsupported → no popover can be open; fall through.
    }

    // Likewise the Display tray, which the toolbar's Aa opens: its own
    // handler closes it, and the sheet under it should stay.
    const displayTray = document.getElementById("fontTray");
    if (displayTray instanceof HTMLElement && !displayTray.hidden) return;

    if (resumeChipTarget) {
      hideResumeChip();
      return;
    }

    if (isSheetMode() && isToolsOpen()) {
      event.preventDefault();
      closeMobileTools({ focusFab: true });
    }
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
    updateProgress();
    pickActiveFocusTarget();
  });

  // Arriving on a link into the book (#ch-10 from Study View's "Switch to
  // Read View", #luke-10-v5 from search) has to land on that spot and
  // stay there. The whole book is one page, tens of thousands of pixels
  // tall, so anything that changes its height above the target after the
  // first jump (a web font finishing, the Android app banner; the reader's
  // text size is set before first paint) slides the text under a fixed
  // scroll offset, and Safari has no scroll anchoring to put it back. An
  // animated scroll made that worse: its destination is computed once, when
  // it starts. So land instantly, then land again whenever the text's size
  // changes, until the reader scrolls, touches, clicks or types.
  function landOnHash(anchor) {
    const target = document.getElementById(anchor);
    if (!target) return;

    const m = /^ch-(\d+)$/.exec(anchor) || /^[0-9a-z]+-(\d+)-v\d+$/.exec(anchor);
    const chapter = m ? Number(m[1]) : null;
    const stopEvents = ["wheel", "touchstart", "pointerdown", "keydown"];
    let pinned = true;
    let resizeObserver = null;

    const land = () => {
      if (!pinned) return;
      // "auto" here would defer to the stylesheet's smooth scrolling.
      const previous = html.style.scrollBehavior;
      html.style.scrollBehavior = "auto";
      target.scrollIntoView({ block: "start" });
      html.style.scrollBehavior = previous;
      setActiveChapter(chapter ?? findActiveChapterByViewportLine());
      updateProgress();
    };

    const release = () => {
      pinned = false;
      for (const type of stopEvents) window.removeEventListener(type, release, true);
      resizeObserver?.disconnect();
    };

    for (const type of stopEvents) {
      window.addEventListener(type, release, { capture: true, passive: true });
    }

    land();
    requestAnimationFrame(land);
    if ("ResizeObserver" in window) {
      resizeObserver = new ResizeObserver(() => land());
      resizeObserver.observe(textRoot);
    }
    document.fonts?.ready.then(land);
    window.addEventListener("load", land, { once: true });
    // Held until the reader acts rather than for a guessed settling time: a
    // re-land only ever returns someone who hasn't moved to where they
    // already are. The cap just stops the observer on a page left open.
    window.setTimeout(release, 10000);
  }

  const hash = decodeURIComponent(window.location.hash.replace(/^#/, ""));
  const hashTarget = hash ? document.getElementById(hash) : null;

  if (hashTarget) {
    landOnHash(hash);
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
