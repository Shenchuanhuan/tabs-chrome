const addCurrentBtn = document.getElementById("addCurrent");
const closePanelBtn = document.getElementById("closePanel");
const groupInput = document.getElementById("groupInput");
// ... rest of the constants

if (closePanelBtn) {
  closePanelBtn.addEventListener("click", () => {
    window.parent.postMessage("close-tabs-home-panel", "*");
  });
}
const groupContainer = document.getElementById("groupContainer");
const searchInput = document.getElementById("keywordSearch");
const searchClear = document.getElementById("searchClear");
const emptyState = document.getElementById("emptyState");

let currentDraggingTabEl = null;
let currentSearchWords = "";

function getFaviconUrl(url, favIconUrl) {
  if (favIconUrl) return favIconUrl;
  try {
    const domain = new URL(url).hostname;
    return `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;
  } catch {
    return "";
  }
}

function escapeHtml(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function showEmptyState(show) {
  if (show) {
    emptyState.classList.remove("hidden");
  } else {
    emptyState.classList.add("hidden");
  }
}

// ---- Render ----

function renderElements(groups) {
  groupContainer.querySelectorAll(".group").forEach((el) => el.remove());

  if (!groups || groups.length === 0) {
    showEmptyState(true);
    return;
  }
  showEmptyState(false);

  groups.forEach((groupItem) => {
    const { title, id, tabs } = groupItem;
    const group = createGroupElement({ name: title, id, isAbleToOperate: id && !id.startsWith("group-") ? false : true });
    // Auto-domain groups use domain as id, manual groups use "group-{timestamp}"
    const isDomain = !id || !id.startsWith("group-");
    if (isDomain) {
      group.dataset.group = title;
      group.dataset.groupId = title;
    }

    tabs.forEach((tab) => {
      const tabEl = createTabRow(tab);
      group.querySelector(".group-tabs").appendChild(tabEl);
    });

    updateGroupCount(group);
    groupContainer.appendChild(group);
  });
}

// ---- Group Element ----

function createGroupElement({ name, id, isAbleToOperate }) {
  const group = document.createElement("div");
  const groupId = id || "group-" + Date.now();
  group.dataset.groupId = groupId;
  group.className = "group";
  group.dataset.type = "group";

  // Header
  const header = document.createElement("div");
  header.className = "group-header";
  header.addEventListener("click", (e) => {
    if (e.target.closest(".group-actions button")) return;
    group.classList.toggle("collapsed");
  });

  // Favicon for domain groups
  const domainIcon = document.createElement("span");
  domainIcon.className = "group-icon";
  if (name.includes(".") && !isAbleToOperate) {
    domainIcon.innerHTML = `<img src="https://www.google.com/s2/favicons?domain=${escapeHtml(name)}&sz=32" width="16" height="16" onerror="this.style.display='none'" />`;
  }
  header.appendChild(domainIcon);

  // Title
  const titleEl = document.createElement("span");
  titleEl.className = "group-title";
  titleEl.textContent = name;
  header.appendChild(titleEl);

  // Tab count
  const countEl = document.createElement("span");
  countEl.className = "group-count";
  countEl.textContent = "0";
  header.appendChild(countEl);

  // Actions (only for manual groups)
  if (isAbleToOperate) {
    const actions = document.createElement("span");
    actions.className = "group-actions";

    const renameBtn = document.createElement("button");
    renameBtn.innerHTML = "&#9998;";
    renameBtn.title = "重命名";
    renameBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      const newName = prompt("请输入新的分组名称", titleEl.textContent);
      if (newName && newName.trim()) {
        titleEl.textContent = newName.trim();
        updateGroupNameInStorage(groupId, newName.trim());
      }
    });
    actions.appendChild(renameBtn);

    const deleteBtn = document.createElement("button");
    deleteBtn.className = "btn-delete";
    deleteBtn.innerHTML = "&#10005;";
    deleteBtn.title = "删除分组";
    deleteBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      if (confirm("确定删除该分组及其包含链接？")) {
        group.remove();
        deleteGroupFromStorage(groupId);
        updateGlobalEmptyState();
      }
    });
    actions.appendChild(deleteBtn);

    header.appendChild(actions);
  }

  // Collapse chevron
  const chevron = document.createElement("span");
  chevron.className = "collapse-chevron";
  chevron.innerHTML = '<svg viewBox="0 0 16 16" fill="none"><path d="M4 6l4 4 4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  header.appendChild(chevron);

  group.appendChild(header);

  // Tabs container
  const tabsContainer = document.createElement("div");
  tabsContainer.className = "group-tabs";
  group.appendChild(tabsContainer);

  // Drag & drop on group
  group.addEventListener("dragover", (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    group.classList.add("drag-over");
  });
  group.addEventListener("dragleave", () => {
    group.classList.remove("drag-over");
  });
  group.addEventListener("drop", (e) => {
    e.preventDefault();
    group.classList.remove("drag-over");

    const tabId = e.dataTransfer.getData("tabId");
    if (!tabId) return;

    const draggingEl = currentDraggingTabEl;
    currentDraggingTabEl = null;

    chrome.tabs.get(Number(tabId), (tab) => {
      const tabEl = createTabRow(tab);
      tabsContainer.appendChild(tabEl);

      if (draggingEl && draggingEl.parentElement) {
        draggingEl.parentElement.removeChild(draggingEl);
        const oldGroup = draggingEl.closest(".group");
        if (oldGroup) {
          updateGroupCount(oldGroup);
          maybeRemoveEmptyGroup(oldGroup);
        }
      }

      updateGroupCount(group);
      saveCurrentUIStateToStorage();
      updateGlobalEmptyState();
    });
  });

  return group;
}

// ---- Tab Row ----

function createTabRow(tab) {
  const { url, title, id, favIconUrl } = tab;

  const row = document.createElement("div");
  row.className = "tab-row";
  row.setAttribute("draggable", "true");
  row.dataset.tabId = id;
  row.dataset.tabUrl = url;
  if (favIconUrl) row.dataset.tabFavicon = favIconUrl;

  // Favicon
  const favicon = document.createElement("img");
  favicon.className = "tab-favicon";
  favicon.src = getFaviconUrl(url, favIconUrl);
  favicon.onerror = function () {
    this.style.display = "none";
  };
  row.appendChild(favicon);

  // Info
  const info = document.createElement("div");
  info.className = "tab-info";

  const titleSpan = document.createElement("span");
  titleSpan.className = "tab-title";
  titleSpan.textContent = title;
  info.appendChild(titleSpan);

  try {
    const urlSpan = document.createElement("span");
    urlSpan.className = "tab-url";
    urlSpan.textContent = new URL(url).hostname;
    info.appendChild(urlSpan);
  } catch (_) {}

  row.appendChild(info);

  // Close button
  const closeBtn = document.createElement("button");
  closeBtn.className = "tab-close";
  closeBtn.innerHTML = "&#10005;";
  closeBtn.title = "移除";
  closeBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    const groupEl = row.closest(".group");
    row.remove();
    if (groupEl) {
      updateGroupCount(groupEl);
      maybeRemoveEmptyGroup(groupEl);
    }
    saveCurrentUIStateToStorage();
    updateGlobalEmptyState();
  });
  row.appendChild(closeBtn);

  // Click to open
  row.addEventListener("click", (e) => {
    if (e.target.closest(".tab-close")) return;
    const groupEl = row.closest(".group");
    chrome.tabs.create({ url: url });
    row.remove();
    if (groupEl) {
      updateGroupCount(groupEl);
      maybeRemoveEmptyGroup(groupEl);
    }
    saveCurrentUIStateToStorage();
    updateGlobalEmptyState();
  });

  // Drag events
  row.addEventListener("dragstart", (e) => {
    e.dataTransfer.setData("tabId", id);
    e.dataTransfer.effectAllowed = "move";
    row.classList.add("dragging");
    currentDraggingTabEl = row;
  });
  row.addEventListener("dragend", () => {
    row.classList.remove("dragging");
    currentDraggingTabEl = null;
    document.querySelectorAll(".drag-over").forEach((el) => el.classList.remove("drag-over"));
    document.querySelectorAll(".drop-above, .drop-below").forEach((el) => {
      el.classList.remove("drop-above", "drop-below");
    });
  });

  // Drop position indicator
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

    const position = row.dataset.dropPosition || (offset => offset < row.getBoundingClientRect().height / 2 ? "above" : "below")(e);
    if (row.classList.contains("drop-above") || position === "above") {
      row.parentElement.insertBefore(draggingEl, row);
    } else {
      row.parentElement.insertBefore(draggingEl, row.nextSibling);
    }

    const oldGroup = groupContainer.querySelector(".group:not(.group):has(.tab-row)");
    document.querySelectorAll(".group").forEach((g) => {
      if (g.querySelectorAll(".tab-row").length === 0) {
        g.remove();
      } else {
        updateGroupCount(g);
      }
    });
    updateGroupCount(row.closest(".group"));
    saveCurrentUIStateToStorage();
    updateGlobalEmptyState();
  });

  return row;
}

// ---- Storage Helpers ----

function updateGroupCount(groupEl) {
  const count = groupEl.querySelectorAll(".tab-row").length;
  const countBadge = groupEl.querySelector(".group-count");
  if (countBadge) countBadge.textContent = count;
}

function maybeRemoveEmptyGroup(groupEl) {
  const tabs = groupEl.querySelectorAll(".tab-row");
  if (tabs.length === 0) {
    groupEl.remove();
  }
}

function updateGlobalEmptyState() {
  const hasGroups = groupContainer.querySelectorAll(".group").length > 0;
  showEmptyState(!hasGroups);
}

function saveCurrentUIStateToStorage() {
  const groups = [];
  document.querySelectorAll(".group").forEach((groupEl) => {
    const groupId = groupEl.dataset.groupId;
    const title = groupEl.dataset.group || groupEl.querySelector(".group-title")?.textContent || groupEl.dataset.groupId;
    const tabs = [];

    groupEl.querySelectorAll(".tab-row").forEach((row) => {
      tabs.push({
        id: parseInt(row.dataset.tabId),
        title: row.querySelector(".tab-title")?.textContent || "",
        url: row.dataset.tabUrl,
        favIconUrl: row.dataset.tabFavicon || "",
      });
    });

    groups.push({ id: groupId, title, tabs });
  });

  chrome.storage.local.set({ groups });
}

function updateGroupNameInStorage(groupId, newTitle) {
  chrome.storage.local.get(["groups"], (res) => {
    const groups = res.groups || [];
    const group = groups.find((g) => g.id === groupId);
    if (group) {
      group.title = newTitle;
      chrome.storage.local.set({ groups });
    }
  });
}

function deleteGroupFromStorage(groupId) {
  chrome.storage.local.get(["groups"], (res) => {
    const groups = res.groups || [];
    chrome.storage.local.set({ groups: groups.filter((g) => g.id !== groupId) });
  });
}

// ---- Search ----

async function updateGroupTabsBySearch(keyword) {
  const { groups } = await chrome.storage.local.get(["groups"]);
  let filteredGroups = [];

  if (!keyword) {
    filteredGroups = groups || [];
  } else {
    (groups || []).forEach((group) => {
      const filteredTabs = group.tabs.filter(
        (tab) => tab.title.toLowerCase().includes(keyword.toLowerCase()) ||
                tab.url.toLowerCase().includes(keyword.toLowerCase())
      );
      if (filteredTabs.length > 0) {
        filteredGroups.push({ ...group, tabs: filteredTabs });
      }
    });
  }

  groupContainer.querySelectorAll(".group").forEach((el) => el.remove());
  renderElements(filteredGroups);
}

// ---- Event Handlers ----

groupInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    const name = groupInput.value.trim();
    groupInput.value = "";
    groupInput.style.display = "none";
    if (name === "") return;
    createGroupElement({ name });
    saveCurrentUIStateToStorage();
    updateGlobalEmptyState();
  }
});

// Collapse current tab
addCurrentBtn.addEventListener("click", () => {
  chrome.tabs.query({ currentWindow: true }, (allTabs) => {
    const activeTab = allTabs.find((tab) => tab.active);
    if (!activeTab) return;
    const { url, index, id, favIconUrl } = activeTab;

    if (url.indexOf("chrome://newtab") !== -1) return;

    const _url = new URL(url);
    const domain = _url.hostname;
    const groups = document.querySelectorAll('.group[data-group="' + domain + '"]');

    const group = groups[0] || createGroupElement({ name: domain, id: domain, isAbleToOperate: false });
    group.dataset.group = domain;
    group.dataset.groupId = domain;

    const tabEl = createTabRow({ url, title: activeTab.title || url, id, favIconUrl });
    group.querySelector(".group-tabs").appendChild(tabEl);
    updateGroupCount(group);
    if (!group.parentElement) {
      groupContainer.appendChild(group);
    }

    showEmptyState(false);
    saveCurrentUIStateToStorage();

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

// Search
searchInput.addEventListener("keydown", (e) => {
  if (e.code === "Enter") {
    const searchWords = e.target.value.trim();
    if (currentSearchWords !== searchWords) {
      currentSearchWords = searchWords;
      updateGroupTabsBySearch(searchWords);
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
  updateGroupTabsBySearch("");
  searchInput.focus();
});

// Init
window.addEventListener("DOMContentLoaded", () => {
  chrome.storage.local.get(["groups"], (result) => {
    const groups = result.groups || [];
    renderElements(groups);
  });
});
