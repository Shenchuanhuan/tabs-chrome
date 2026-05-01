const addCurrentBtn = document.getElementById("addCurrent");
const closePanelBtn = document.getElementById("closePanel");
const saveReasonInput = document.getElementById("saveReason");

const tabContainer = document.getElementById("groupContainer");
const searchInput = document.getElementById("keywordSearch");
const searchClear = document.getElementById("searchClear");
const emptyState = document.getElementById("emptyState");

let currentDraggingTabEl = null;
let currentSearchWords = "";

if (closePanelBtn) {
  closePanelBtn.addEventListener("click", () => {
    window.parent.postMessage("close-tabs-home-panel", "*");
  });
}

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
  if (show) {
    emptyState.classList.remove("hidden");
  } else {
    emptyState.classList.add("hidden");
  }
}

// ---- Render ----

function renderElements(tabs) {
  tabContainer.querySelectorAll(".tab-row").forEach((el) => el.remove());

  if (!tabs || tabs.length === 0) {
    showEmptyState(true);
    return;
  }
  showEmptyState(false);

  // Sort by created_at descending (newest first)
  const sortedTabs = [...tabs].sort((a, b) => (b.created_at || 0) - (a.created_at || 0));

  sortedTabs.forEach((tab) => {
    const tabEl = createTabRow(tab);
    tabContainer.appendChild(tabEl);
  });
}

// ---- Tab Row ----
function createTabRow(tab) {
  const { url, title, id, favIconUrl, description, created_at } = tab;

  const row = document.createElement("div");
  row.className = "tab-row";
  row.setAttribute("draggable", "true");
  row.dataset.tabId = id;
  row.dataset.tabUrl = url;
  row.dataset.tabDescription = description || "";
  row.dataset.createdAt = created_at || Date.now();
  if (favIconUrl) row.dataset.tabFavicon = favIconUrl;

  // Info
  const info = document.createElement("div");
  info.className = "tab-info";

  const titleSpan = document.createElement("span");
  titleSpan.className = "tab-title";
  titleSpan.textContent = title;
  info.appendChild(titleSpan);

  if (description) {
    const descSpan = document.createElement("span");
    descSpan.className = "tab-description";
    descSpan.textContent = description;
    info.appendChild(descSpan);
  }

  const metaLine = document.createElement("div");
  metaLine.className = "tab-meta";

  try {
    const urlSpan = document.createElement("span");
    urlSpan.className = "tab-url";
    urlSpan.textContent = new URL(url).hostname;
    metaLine.appendChild(urlSpan);
  } catch (_) {}

  const timeSpan = document.createElement("span");
  timeSpan.className = "tab-time";
  const date = new Date(parseInt(row.dataset.createdAt));
  timeSpan.textContent = date.toLocaleString('zh-CN', { hour12: false, month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  metaLine.appendChild(timeSpan);

  info.appendChild(metaLine);
  row.appendChild(info);

  const closeBtn = document.createElement("button");
  closeBtn.className = "tab-close";
  closeBtn.innerHTML = "&#10005;";
  closeBtn.title = "移除";
  closeBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    row.remove();
    saveCurrentUIStateToStorage();
    updateGlobalEmptyState();
  });
  row.appendChild(closeBtn);

  row.addEventListener("click", (e) => {
    if (e.target.closest(".tab-close")) return;
    chrome.tabs.create({ url: url });
    row.remove();
    saveCurrentUIStateToStorage();
    updateGlobalEmptyState();
  });

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

    const tabId = e.dataTransfer.getData("tabId");
    if (!tabId) return;

    const draggingEl = currentDraggingTabEl;
    currentDraggingTabEl = null;
    if (!draggingEl || draggingEl === row) return;

    const rect = row.getBoundingClientRect();
    const offset = e.clientY - rect.top;
    if (offset < rect.height / 2) {
      row.parentElement.insertBefore(draggingEl, row);
    } else {
      row.parentElement.insertBefore(draggingEl, row.nextSibling);
    }

    saveCurrentUIStateToStorage();
    updateGlobalEmptyState();
  });

  return row;
}

// ---- Storage Helpers ----

function updateGlobalEmptyState() {
  const hasTabs = tabContainer.querySelectorAll(".tab-row").length > 0;
  showEmptyState(!hasTabs);
}

function saveCurrentUIStateToStorage() {
  const tabs = [];
  tabContainer.querySelectorAll(".tab-row").forEach((row) => {
    tabs.push({
      id: parseInt(row.dataset.tabId),
      title: row.querySelector(".tab-title")?.textContent || "",
      url: row.dataset.tabUrl,
      favIconUrl: row.dataset.tabFavicon || "",
      description: row.dataset.tabDescription || "",
      created_at: parseInt(row.dataset.createdAt) || Date.now(),
    });
  });

  chrome.storage.local.set({ tabs });
}

// ---- Search ----

async function updateTabsBySearch(keyword) {
  const { tabs } = await chrome.storage.local.get(["tabs"]);
  let filteredTabs = [];

  if (!keyword) {
    filteredTabs = tabs || [];
  } else {
    filteredTabs = (tabs || []).filter(
      (tab) => tab.title.toLowerCase().includes(keyword.toLowerCase()) ||
              tab.url.toLowerCase().includes(keyword.toLowerCase()) ||
              (tab.description && tab.description.toLowerCase().includes(keyword.toLowerCase()))
    );
  }

  renderElements(filteredTabs);
}

// ---- Event Handlers ----

addCurrentBtn.addEventListener("click", () => {
  chrome.tabs.query({ currentWindow: true }, (allTabs) => {
    const activeTab = allTabs.find((tab) => tab.active);
    if (!activeTab) return;
    const { url, index, id, favIconUrl } = activeTab;

    if (url.indexOf("chrome://newtab") !== -1) return;

    const reason = saveReasonInput ? saveReasonInput.value.trim() : "";
    const tabEl = createTabRow({ url, title: activeTab.title || url, id, favIconUrl, description: reason, created_at: Date.now() });
    
    // Prepend to top
    if (tabContainer.firstChild) {
      tabContainer.insertBefore(tabEl, tabContainer.firstChild);
    } else {
      tabContainer.appendChild(tabEl);
    }

    showEmptyState(false);
    saveCurrentUIStateToStorage();
    if (saveReasonInput) saveReasonInput.value = "";

    let adjacentTab = null;
    if (index > 0) {
      adjacentTab = allTabs[index - 1];
    } else if (allTabs.length > 1) {
      adjacentTab = allTabs[index + 1];
    }

    if (adjacentTab) {
      chrome.tabs.update(adjacentTab.id, { active: true }, () => {
        chrome.tabs.remove(id);
      });
    } else {
      chrome.tabs.create({ url: "chrome://newtab" }, () => {
        chrome.tabs.remove(id);
      });
    }
  });
});

searchInput.addEventListener("keydown", (e) => {
  if (e.code === "Enter") {
    const searchWords = e.target.value.trim();
    if (currentSearchWords !== searchWords) {
      currentSearchWords = searchWords;
      updateTabsBySearch(searchWords);
      if (searchWords) {
        searchClear.classList.remove("hidden");
      } else {
        searchClear.classList.add("hidden");
      }
    }
  }
});

searchClear.addEventListener("click", () => {
  searchInput.value = "";
  currentSearchWords = "";
  searchClear.classList.add("hidden");
  updateTabsBySearch("");
  searchInput.focus();
});

window.addEventListener("DOMContentLoaded", () => {
  chrome.storage.local.get(["tabs"], (result) => {
    const tabs = result.tabs || [];
    renderElements(tabs);
  });
});

// Sync data across multiple open tabs/pages
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.tabs) {
    // Only re-render if the search is empty to avoid interrupting user search
    if (!currentSearchWords) {
      renderElements(changes.tabs.newValue || []);
    }
  }
});
