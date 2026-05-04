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
let currentDraggingTabEl = null;
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
  const hasTabs = tabContainer.querySelectorAll(".tab-row").length > 0;
  showEmptyState(!hasTabs);
}

// ---- Tab Row Factory (shared across list & favorites views) ----
function createTabRow(tab) {
  const { url, title, id, favIconUrl, description, created_at, isFavorite } =
    tab;

  const row = document.createElement("div");
  row.className = "tab-row";
  row.setAttribute("draggable", "true");
  row.dataset.tabId = id;
  row.dataset.tabUrl = url;
  row.dataset.tabDescription = description || "";
  row.dataset.createdAt = created_at || Date.now();
  row.dataset.isFavorite = isFavorite ? "true" : "false";
  if (favIconUrl) row.dataset.tabFavicon = favIconUrl;

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

  // ---- Drag & Drop ----
  row.addEventListener("dragstart", (e) => {
    e.dataTransfer.setData("tabId", id);
    e.dataTransfer.effectAllowed = "move";
    row.classList.add("dragging");
    currentDraggingTabEl = row;
  });
  row.addEventListener("dragend", () => {
    row.classList.remove("dragging");
    currentDraggingTabEl = null;
    document.querySelectorAll(".drop-above, .drop-below").forEach((el) => {
      el.classList.remove("drop-above", "drop-below");
    });
  });
  row.addEventListener("dragover", (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    const rect = row.getBoundingClientRect();
    const offset = e.clientY - rect.top;
    row.classList.remove("drop-above", "drop-below");
    row.classList.add(offset < rect.height / 2 ? "drop-above" : "drop-below");
  });
  row.addEventListener("dragleave", () => {
    row.classList.remove("drop-above", "drop-below");
  });
  row.addEventListener("drop", (e) => {
    e.stopPropagation();
    e.preventDefault();
    row.classList.remove("drop-above", "drop-below");
    const draggingEl = currentDraggingTabEl;
    if (!draggingEl || draggingEl === row) return;
    const rect = row.getBoundingClientRect();
    const offset = e.clientY - rect.top;
    if (offset < rect.height / 2) {
      row.parentElement.insertBefore(draggingEl, row);
    } else {
      row.parentElement.insertBefore(draggingEl, row.nextSibling);
    }
    saveCurrentUIStateToStorage();
  });

  return row;
}

// ---- Persist DOM order → storage (for drag reorder in list view) ----
function saveCurrentUIStateToStorage() {
  const tabContainer = $.viewList.tabContainer;
  if (!tabContainer) return;
  const tabsInDOM = tabContainer.querySelectorAll(".tab-row");
  const tabs = [];
  tabsInDOM.forEach((row) => {
    tabs.push({
      id: parseInt(row.dataset.tabId),
      title: row.querySelector(".tab-title")?.textContent || "",
      url: row.dataset.tabUrl,
      favIconUrl: row.dataset.tabFavicon || "",
      description: row.dataset.tabDescription || "",
      created_at: parseInt(row.dataset.createdAt) || Date.now(),
      isFavorite: row.dataset.isFavorite === "true",
    });
  });
  if (tabs.length > 0) {
    chrome.storage.local.set({ tabs });
  }
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
  tabContainer.querySelectorAll(".tab-row").forEach((el) => el.remove());

  if (!tabs || tabs.length === 0) {
    showEmptyState(true);
    return;
  }
  showEmptyState(false);

  const sortedTabs = [...tabs].sort(
    (a, b) => (b.created_at || 0) - (a.created_at || 0),
  );
  sortedTabs.forEach((tab) => {
    const tabEl = createTabRow(tab);
    tabContainer.appendChild(tabEl);
  });
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
  let port = null;
  try {
    port = chrome.runtime.connect({ name: "sidepanel" });
  } catch (_) {
    // Extension context invalidated, side panel will close shortly
    return;
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
    // Extension was reloaded or unloaded — close the side panel
    window.close();
  });
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
