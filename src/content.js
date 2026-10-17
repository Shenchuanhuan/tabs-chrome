// ============================================================
//  Tabs Home — Side Panel Content Script
//  Dynamically loads view fragments from html/views/ on demand
// ============================================================

// ---- Extension context guard ----
function isExtensionAlive() {
  try {
    return !!(chrome.runtime && chrome.runtime.id);
  } catch (_) {
    return false;
  }
}

// ---- Shared State ----
let currentSearchWords = "";
let currentActiveView = "viewList";

// ---- View Manager ----
// Cache: viewId → { html: string, container: HTMLElement, initialized: boolean }
const viewCache = {};

// Per-view DOM element references, populated after each view initializes.
const $ = {
  viewList: {},
  viewFavorites: {},
  viewDownloads: {},
  viewSettings: {},
};

// Map viewId → path to HTML fragment
const VIEW_PATH = {
  viewList: "views/list.html",
  viewFavorites: "views/favorites.html",
  viewDownloads: "views/downloads.html",
  viewSettings: "views/settings.html",
};

// ============================================================
//  Shared Utilities
// ============================================================

function getFaviconUrl(url, favIconUrl) {
  if (favIconUrl) return favIconUrl;
  try {
    const domain = new URL(url).hostname;
    return `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;
  } catch {
    return "";
  }
}

function showEmptyState(show) {
  const emptyState = $.viewList.emptyState;
  if (!emptyState) return;
  emptyState.classList.toggle("hidden", !show);
}

function updateGlobalEmptyState() {
  const tabContainer = $.viewList.tabContainer;
  if (!tabContainer) return;
  refreshDateDividers();
  const hasTabs = tabContainer.querySelectorAll(".tab-row").length > 0;
  showEmptyState(!hasTabs);
}

// ---- Date Dividers (list view) ----
const WEEKDAYS = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];

function getDayKey(timestamp) {
  const d = new Date(timestamp);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function formatDividerDate(timestamp) {
  const d = new Date(timestamp);
  const today = new Date();
  const yesterday = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate() - 1,
  );
  const key = getDayKey(timestamp);
  if (key === getDayKey(today)) return "今天";
  if (key === getDayKey(yesterday)) return "昨天";
  const monthDay = `${d.getMonth() + 1}月${d.getDate()}日`;
  if (d.getFullYear() === today.getFullYear()) {
    return `${monthDay} ${WEEKDAYS[d.getDay()]}`;
  }
  return `${d.getFullYear()}年${monthDay}`;
}

function createDateDivider(timestamp) {
  const divider = document.createElement("div");
  divider.className = "date-divider";

  const label = document.createElement("span");
  label.className = "date-divider-label";
  label.textContent = formatDividerDate(timestamp);
  divider.appendChild(label);

  const count = document.createElement("span");
  count.className = "date-divider-count";
  divider.appendChild(count);

  return divider;
}

// Update each divider's count; drop dividers whose day has no rows left
// (after a row is removed)
function refreshDateDividers() {
  const tabContainer = $.viewList.tabContainer;
  if (!tabContainer) return;
  tabContainer.querySelectorAll(".date-divider").forEach((divider) => {
    let count = 0;
    let el = divider.nextElementSibling;
    while (el && !el.classList.contains("date-divider")) {
      if (el.classList.contains("tab-row")) count++;
      el = el.nextElementSibling;
    }
    if (count === 0) {
      divider.remove();
    } else {
      divider.querySelector(".date-divider-count").textContent = count;
    }
  });
}

// ---- Tab Row Factory (shared across list & favorites views) ----
function createTabRow(tab) {
  const { url, title, id, favIconUrl, description, created_at, isFavorite } =
    tab;

  const row = document.createElement("div");
  row.className = "tab-row";
  row.dataset.isFavorite = isFavorite ? "true" : "false";

  // Top block (favicon + text)
  const header = document.createElement("div");
  header.className = "tab-top";

  const favicon = document.createElement("img");
  favicon.className = "tab-favicon";
  favicon.src = getFaviconUrl(url, favIconUrl);
  favicon.onerror = function () {
    this.style.display = "none";
  };
  header.appendChild(favicon);

  const text = document.createElement("div");
  text.className = "tab-text";

  const titleSpan = document.createElement("span");
  titleSpan.className = "tab-title";
  titleSpan.textContent = title;
  text.appendChild(titleSpan);

  // Description (inside tab-text)
  if (description) {
    const descSpan = document.createElement("span");
    descSpan.className = "tab-description";
    descSpan.textContent = description;
    text.appendChild(descSpan);
  }

  header.appendChild(text);

  row.appendChild(header);

  // Bottom block (url + actions)
  const bottom = document.createElement("div");
  bottom.className = "tab-bottom";

  try {
    const urlSpan = document.createElement("span");
    urlSpan.className = "tab-url";
    urlSpan.textContent = new URL(url).hostname;
    bottom.appendChild(urlSpan);
  } catch (_) {}

  // Favorite button
  const favBtn = document.createElement("button");
  favBtn.className = "tab-favorite" + (isFavorite ? " is-active" : "");
  favBtn.innerHTML = isFavorite ? "&#9733;" : "&#9734;";
  favBtn.title = isFavorite ? "取消收藏" : "收藏";
  favBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    const newFavState = row.dataset.isFavorite !== "true";
    row.dataset.isFavorite = newFavState ? "true" : "false";
    favBtn.className = "tab-favorite" + (newFavState ? " is-active" : "");
    favBtn.innerHTML = newFavState ? "&#9733;" : "&#9734;";
    favBtn.title = newFavState ? "取消收藏" : "收藏";

    chrome.storage.local.get(["tabs"], (result) => {
      const allTabs = result.tabs || [];
      const updatedTabs = allTabs.map((t) => {
        if (t.id == id || (t.url === url && t.created_at == created_at)) {
          return { ...t, isFavorite: newFavState };
        }
        return t;
      });
      chrome.storage.local.set({ tabs: updatedTabs });
    });
  });
  // Close / remove button
  const closeBtn = document.createElement("button");
  closeBtn.className = "tab-close";
  closeBtn.innerHTML = "&#10005;";
  closeBtn.title = "移除";
  closeBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    chrome.storage.local.get(["tabs"], (result) => {
      const allTabs = result.tabs || [];
      const updatedTabs = allTabs.filter(
        (t) => !(t.id == id || (t.url === url && t.created_at == created_at)),
      );
      chrome.storage.local.set({ tabs: updatedTabs });
    });
    row.remove();
    updateGlobalEmptyState();
  });
  // Action buttons: close left, fav right
  const actions = document.createElement("div");
  actions.className = "tab-actions";
  actions.appendChild(closeBtn);
  actions.appendChild(favBtn);
  bottom.appendChild(actions);
  row.appendChild(bottom);

  // Click to open
  row.addEventListener("click", (e) => {
    if (e.target.closest(".tab-close") || e.target.closest(".tab-favorite"))
      return;
    chrome.tabs.create({ url: url });
    if (row.dataset.isFavorite !== "true") {
      chrome.storage.local.get(["tabs"], (result) => {
        const allTabs = result.tabs || [];
        const updatedTabs = allTabs.filter(
          (t) => !(t.id == id || (t.url === url && t.created_at == created_at)),
        );
        chrome.storage.local.set({ tabs: updatedTabs });
      });
      row.remove();
      updateGlobalEmptyState();
    }
  });

  return row;
}

// ============================================================
//  View Loader
// ============================================================

/**
 * Fetch a view's HTML fragment from html/views/ and cache it.
 * Returns the HTML string.
 */
async function loadViewHtml(viewId) {
  if (viewCache[viewId] && viewCache[viewId].html) {
    return viewCache[viewId].html;
  }

  const path = VIEW_PATH[viewId];
  if (!path) throw new Error(`Unknown view: ${viewId}`);

  const response = await fetch(path);
  if (!response.ok) {
    throw new Error(`Failed to load ${path}: ${response.status}`);
  }
  const html = await response.text();

  // Initialize cache entry
  if (!viewCache[viewId]) {
    viewCache[viewId] = { html: null, container: null, initialized: false };
  }
  viewCache[viewId].html = html;
  return html;
}

/**
 * Insert a view's HTML into #mainContent and create its container element.
 */
function injectViewContainer(viewId, html) {
  const mainContent = document.getElementById("mainContent");
  if (!mainContent) throw new Error("mainContent element not found");

  // Parse the HTML fragment. The first element should be the view root.
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");

  // The view root is the first element child in the parsed body
  const viewRoot = doc.body.firstElementChild;
  if (!viewRoot) throw new Error(`No root element in ${viewId} fragment`);

  // Ensure it has the right id and classes
  viewRoot.id = viewId;
  viewRoot.classList.add("view-container");
  // All views except the active one start hidden
  if (viewId !== currentActiveView) {
    viewRoot.classList.remove("active");
  } else {
    viewRoot.classList.add("active");
  }

  mainContent.appendChild(viewRoot);
  viewCache[viewId].container = viewRoot;
  return viewRoot;
}

function formatExportDate(value) {
  const date = new Date(value);
  if (!value || Number.isNaN(date.getTime())) return "";

  const pad = (number) => String(number).padStart(2, "0");
  return `${date.getFullYear()}/${pad(date.getMonth() + 1)}/${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function cleanLinkForExport(tab) {
  const { id, isFavorite, created_at, ...link } = tab;
  return {
    ...link,
    created_at: formatExportDate(created_at),
  };
}

function getBrowserName() {
  const userAgent = navigator.userAgent;
  if (/Edg\//.test(userAgent)) return "edge";
  if (/Firefox\//.test(userAgent)) return "firefox";
  if (/OPR\//.test(userAgent) || /Opera\//.test(userAgent)) return "opera";
  if (/Chrome\//.test(userAgent)) return "chrome";
  if (/Safari\//.test(userAgent)) return "safari";
  return "browser";
}

function getExportFilename() {
  const now = new Date();
  const pad = (number) => String(number).padStart(2, "0");
  const dayMonth = `${pad(now.getDate())}-${pad(now.getMonth() + 1)}`;
  return `${getBrowserName()} stored pages ${dayMonth}.txt`;
}

function downloadStoredLinks() {
  chrome.storage.local.get(["tabs"], (result) => {
    const links = (result.tabs || []).map(cleanLinkForExport);
    const jsonText = JSON.stringify(links, null, 2);
    const blob = new Blob([jsonText], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");

    anchor.href = url;
    anchor.download = getExportFilename();
    anchor.style.display = "none";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();

    setTimeout(() => URL.revokeObjectURL(url), 0);
  });
}

// ============================================================
//  View Initializers
// ============================================================

// -- List View -------------------------------------------------
function initListView() {
  const container = viewCache.viewList.container;
  if (!container) return;

  // Cache DOM references
  $.viewList.addCurrentBtn = container.querySelector("#addCurrent");
  $.viewList.saveReasonInput = container.querySelector("#saveReason");
  $.viewList.tabContainer = container.querySelector("#groupContainer");
  $.viewList.searchInput = container.querySelector("#keywordSearch");
  $.viewList.searchClear = container.querySelector("#searchClear");
  $.viewList.emptyState = container.querySelector("#emptyState");

  const {
    addCurrentBtn,
    saveReasonInput,
    searchInput,
    searchClear,
    tabContainer,
  } = $.viewList;

  // "收起当前页" button
  if (addCurrentBtn) {
    addCurrentBtn.addEventListener("click", () => {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const activeTab = tabs[0];
        if (!activeTab) return;
        const { url, id, favIconUrl, title } = activeTab;
        if (
          url.startsWith("chrome://") ||
          url.startsWith("chrome-extension://") ||
          url === "about:blank"
        )
          return;
        const reason = saveReasonInput ? saveReasonInput.value.trim() : "";
        chrome.storage.local.get(["tabs"], (result) => {
          const allTabs = result.tabs || [];
          const newTab = {
            url,
            title: title || url,
            id,
            favIconUrl,
            description: reason,
            created_at: Date.now(),
            isFavorite: false,
          };
          chrome.storage.local.set({ tabs: [newTab, ...allTabs] }, () => {
            chrome.tabs.query({ currentWindow: true }, (allWindowTabs) => {
              let adjacentTab = null;
              const currentIndex = allWindowTabs.findIndex((t) => t.id === id);
              if (currentIndex > 0)
                adjacentTab = allWindowTabs[currentIndex - 1];
              else if (allWindowTabs.length > 1)
                adjacentTab = allWindowTabs[currentIndex + 1];
              if (adjacentTab)
                chrome.tabs.update(adjacentTab.id, { active: true }, () =>
                  chrome.tabs.remove(id),
                );
              else
                chrome.tabs.create({ url: "chrome://newtab" }, () =>
                  chrome.tabs.remove(id),
                );
            });
          });
        });
        if (saveReasonInput) saveReasonInput.value = "";
      });
    });
  }

  // Search
  if (searchInput) {
    searchInput.addEventListener("keydown", (e) => {
      if (e.code === "Enter") {
        const sw = e.target.value.trim();
        if (currentSearchWords !== sw) {
          currentSearchWords = sw;
          updateTabsBySearch(sw);
          if (searchClear) searchClear.classList.toggle("hidden", !sw);
        }
      }
    });
  }
  if (searchClear) {
    searchClear.addEventListener("click", () => {
      if (searchInput) {
        searchInput.value = "";
        currentSearchWords = "";
        searchClear.classList.add("hidden");
        updateTabsBySearch("");
        searchInput.focus();
      }
    });
  }

  // Action bar visibility (chrome:// etc.)
  updateActionBarVisibility();
  chrome.tabs.onActivated.addListener(() => {
    if (!isExtensionAlive()) return;
    updateActionBarVisibility();
  });
  chrome.tabs.onUpdated.addListener(() => {
    if (!isExtensionAlive()) return;
    updateActionBarVisibility();
  });

  viewCache.viewList.initialized = true;
}

// -- Favorites View --------------------------------------------
function initFavoritesView() {
  const container = viewCache.viewFavorites.container;
  if (!container) return;

  $.viewFavorites.favoritesContainer = container.querySelector(
    "#favoritesContainer",
  );
  viewCache.viewFavorites.initialized = true;
}

// ============================================================
//  View Renderers
// ============================================================

function renderElements(tabs) {
  const tabContainer = $.viewList.tabContainer;
  if (!tabContainer) return;
  tabContainer
    .querySelectorAll(".tab-row, .date-divider")
    .forEach((el) => el.remove());

  if (!tabs || tabs.length === 0) {
    showEmptyState(true);
    return;
  }
  showEmptyState(false);

  const sortedTabs = [...tabs].sort(
    (a, b) => (b.created_at || 0) - (a.created_at || 0),
  );
  // Insert a date divider whenever the day changes
  let lastDayKey = null;
  sortedTabs.forEach((tab) => {
    const createdAt = tab.created_at || Date.now();
    const dayKey = getDayKey(createdAt);
    if (dayKey !== lastDayKey) {
      tabContainer.appendChild(createDateDivider(createdAt));
      lastDayKey = dayKey;
    }
    const tabEl = createTabRow(tab);
    tabContainer.appendChild(tabEl);
  });
  refreshDateDividers();
}

function renderFavorites(tabs) {
  const favoritesContainer = $.viewFavorites.favoritesContainer;
  if (!favoritesContainer) return;
  favoritesContainer.innerHTML = "";

  const favoriteTabs = (tabs || []).filter((tab) => tab.isFavorite);

  if (favoriteTabs.length === 0) {
    const empty = document.createElement("div");
    empty.className =
      "flex flex-col items-center justify-center text-center py-12";
    empty.innerHTML = `<p class="text-sm text-gray-400">暂无收藏内容</p>`;
    favoritesContainer.appendChild(empty);
    return;
  }

  const sortedTabs = [...favoriteTabs].sort(
    (a, b) => (b.created_at || 0) - (a.created_at || 0),
  );
  sortedTabs.forEach((tab) => {
    const tabEl = createTabRow(tab);
    favoritesContainer.appendChild(tabEl);
  });
}

async function updateTabsBySearch(keyword) {
  const { tabs } = await chrome.storage.local.get(["tabs"]);
  let filteredTabs = tabs || [];
  if (keyword) {
    const kw = keyword.toLowerCase();
    filteredTabs = filteredTabs.filter(
      (tab) =>
        tab.title.toLowerCase().includes(kw) ||
        tab.url.toLowerCase().includes(kw) ||
        (tab.description && tab.description.toLowerCase().includes(kw)),
    );
  }
  renderElements(filteredTabs);
}

function updateActionBarVisibility() {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const activeTab = tabs[0];
    const container = viewCache.viewList.container;
    if (!container) return;
    const actionBar = container.querySelector(".action-bar");
    if (!actionBar) return;
    const isRestricted =
      activeTab &&
      (activeTab.url.startsWith("chrome://") ||
        activeTab.url.startsWith("chrome-extension://") ||
        activeTab.url === "about:blank");
    actionBar.style.display = isRestricted ? "none" : "flex";
  });
}

// ============================================================
//  View Switching
// ============================================================

/**
 * Switch to a different view. Loads the view HTML on first access,
 * injects it into the DOM, and runs its initializer.
 */
async function switchView(viewId) {
  if (currentActiveView === viewId && viewCache[viewId]?.initialized) return;

  // 1. Hide current view
  if (viewCache[currentActiveView]?.container) {
    viewCache[currentActiveView].container.classList.remove("active");
  }

  // 2. Load HTML if not yet fetched
  if (!viewCache[viewId] || !viewCache[viewId].html) {
    await loadViewHtml(viewId);
  }

  // 3. Inject into DOM if not yet attached
  if (!viewCache[viewId].container) {
    injectViewContainer(viewId, viewCache[viewId].html);
  }

  // 4. Show the target view
  viewCache[viewId].container.classList.add("active");

  // 5. Run initializer on first activation
  if (!viewCache[viewId].initialized) {
    if (viewId === "viewList") initListView();
    else if (viewId === "viewFavorites") initFavoritesView();
    else viewCache[viewId].initialized = true; // downloads / settings need no init
  }

  // 6. Refresh data for data-driven views
  chrome.storage.local.get(["tabs"], (result) => {
    const tabs = result.tabs || [];
    if (viewId === "viewList") renderElements(tabs);
    else if (viewId === "viewFavorites") renderFavorites(tabs);
  });

  // 7. Update nav active state
  document.querySelectorAll(".nav-item").forEach((item) => {
    item.classList.toggle("active", item.dataset.view === viewId);
  });

  currentActiveView = viewId;
}

// ============================================================
//  Shell Initialization
// ============================================================

function init() {
  const navItems = document.querySelectorAll(".nav-item");

  // Wire up nav clicks
  navItems.forEach((item) => {
    item.addEventListener("click", () => {
      const viewId = item.dataset.view;
      if (viewId === "viewDownloads") {
        downloadStoredLinks();
        return;
      }
      if (viewId) switchView(viewId);
    });
  });

  // Migrate old "groups" data to "tabs" format if needed
  chrome.storage.local.get(["tabs", "groups"], (result) => {
    let tabs = result.tabs;
    if (
      (!tabs || tabs.length === 0) &&
      result.groups &&
      result.groups.length > 0
    ) {
      tabs = [];
      result.groups.forEach((g) => {
        if (g.tabs)
          g.tabs.forEach((t) =>
            tabs.push({
              ...t,
              description: t.description || "",
              created_at: t.created_at || Date.now(),
              isFavorite: false,
            }),
          );
      });
      chrome.storage.local.set({ tabs });
    }
  });

  // Listen for storage changes from other contexts (e.g. inject.js via background)
  chrome.storage.onChanged.addListener((changes, area) => {
    if (!isExtensionAlive()) return;
    if (area === "local" && changes.tabs && !currentSearchWords) {
      const viewId = currentActiveView;
      // Only re-render if the target view is already initialized
      if (viewId === "viewList" && viewCache.viewList?.initialized) {
        renderElements(changes.tabs.newValue || []);
      } else if (
        viewId === "viewFavorites" &&
        viewCache.viewFavorites?.initialized
      ) {
        renderFavorites(changes.tabs.newValue || []);
      }
    }
  });

  // --- Side panel lifecycle (connect to background) ---
  // The MV3 service worker is terminated after ~30s idle, which also
  // disconnects this port. That is not a reason to close the panel: reconnect
  // so background can track this panel again. Only close when the extension
  // itself was reloaded or unloaded.
  function connectToBackground() {
    let port = null;
    try {
      port = chrome.runtime.connect({ name: "sidepanel" });
    } catch (_) {
      // Extension context invalidated
      return false;
    }

    chrome.windows.getCurrent((win) => {
      if (chrome.runtime.lastError || !win) return;
      try {
        port.postMessage({ action: "init", windowId: win.id });
      } catch (_) {}
    });
    port.onMessage.addListener((m) => {
      if (m.action === "close_side_panel") window.close();
    });
    port.onDisconnect.addListener(() => {
      if (!isExtensionAlive()) {
        window.close();
        return;
      }
      void chrome.runtime.lastError; // mark as checked to avoid console warning
      if (!connectToBackground()) window.close();
    });
    return true;
  }

  if (!connectToBackground()) {
    // Extension context invalidated, side panel will close shortly
    return;
  }
  chrome.runtime.onMessage.addListener((m) => {
    if (m.action === "close_side_panel") window.close();
  });

  // --- Load the default view (list) ---
  switchView("viewList");
}

// Boot
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
