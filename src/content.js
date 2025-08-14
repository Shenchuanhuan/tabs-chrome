const createGroupBtn = document.getElementById("createGroupBtn");
const addCurrentBtn = document.getElementById("addCurrent");
const addOthersBtn = document.getElementById("addOthesBtn");
const groupInput = document.getElementById("groupInput");
const groupContainer = document.getElementById("groupContainer");
const searchInput = document.getElementById("keywordSearch");

// 记录当前拖拽元素
let currentDraggingTabEl = null;

// 记录当前搜索值
let currentSearchWords = "";

// 临时数据中转站
let tempGroupDatas = [];

// 初始化所有可拖拽 tab（从当前窗口中获取）
// chrome.tabs.query({ currentWindow: true }, (tabs) => {
//   tabs.forEach((tab) => {
//     const tabEl = createTabElement(tab);
//     groupContainer.appendChild(tabEl);
//   });
// });

// Render group datas
function renderElements(groups) {
  groups.forEach((groupItem) => {
    const { title, id } = groupItem;
    const group = createGroupName({ name: title, id });

    groupItem.tabs.forEach((tab) => {
      const tabEl = createTabElement(tab);
      group.appendChild(tabEl);
    });
  });
}

// TODO
function createGroupName({ name, id, isAbleToOperate }) {
  const group = document.createElement("div");
  const groupId = id || `group-${Date.now()}`;
  group.dataset.groupId = groupId;
  group.className = "group";
  group.dataset.group = name;
  group.dataset.type = "group";

  // 标题部分
  const titleWrapper = document.createElement("div");
  titleWrapper.className = "group-title-wrapper";

  const titleEl = document.createElement("h3");
  titleEl.textContent = name;

  titleWrapper.appendChild(titleEl);

  if (isAbleToOperate) {
    // ✏️ 创建重命名按钮
    const renameBtn = document.createElement("button");
    renameBtn.textContent = "✏️";
    renameBtn.title = "重命名";
    renameBtn.addEventListener("click", () => {
      const newName = prompt("请输入新的分组名称", titleEl.textContent);
      if (newName && newName.trim()) {
        titleEl.textContent = newName.trim();
        updateGroupNameInStorage(groupId, newName.trim());
      }
    });

    // ❌ 创建删除按钮
    const deleteBtn = document.createElement("button");
    deleteBtn.textContent = "❌";
    deleteBtn.title = "删除分组";
    deleteBtn.addEventListener("click", () => {
      if (confirm("确定删除该分组及其包含链接？")) {
        group.remove();
        deleteGroupFromStorage(groupId);
      }
    });

    titleWrapper.appendChild(renameBtn);
    titleWrapper.appendChild(deleteBtn);
  }

  group.appendChild(titleWrapper);

  group.addEventListener("dragover", (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  });
  group.addEventListener("drop", (e) => {
    const tabId = e.dataTransfer.getData("tabId");
    if (!tabId) return;

    // 提前保存拖拽元素引用
    const draggingEl = currentDraggingTabEl;
    // 清除状态
    currentDraggingTabEl = null;

    chrome.tabs.get(Number(tabId), (tab) => {
      const { active, id } = tab;
      const tabEl = createTabElement(tab);
      group.appendChild(tabEl);

      // 移除元素元素
      if (draggingEl && draggingEl.parentElement) {
        draggingEl.parentElement.removeChild(draggingEl);
      }

      // 关闭对应chrome tab: 现在的功能应该不会出现这种情况了
      // if (active) {
      //   // TODO
      // } else {
      //   chrome.tabs.remove(id);
      // }

      // 更新持续缓存
      saveCurrentUIStateToStorage();
    });
  });

  groupContainer.appendChild(group);
  return group;
}

// 创建group里的tab element
function createTabElement(tab) {
  const { url, title, id } = tab;

  const tabEl = document.createElement("div");
  tabEl.className = "tab-item";
  tabEl.textContent = title;
  tabEl.setAttribute("draggable", "true");
  tabEl.dataset.tabId = id;
  tabEl.dataset.tabUrl = url;

  // 点击打开: 仅group中点击打开
  tabEl.addEventListener("click", () => {
    if (tabEl.parentElement && tabEl.parentElement.dataset.type === "group") {
      const groupEl = tabEl.parentElement;
      const groupId = groupEl.dataset.groupId;

      // 在新的标签页打开点击的tab
      chrome.tabs.create({ url: url });
      // 从父容器中移除当前 tab 元素
      groupEl.removeChild(tabEl);
      // 父容器中没有tab元素后，移除父容器
      const noTabsInGroup = groupEl.querySelectorAll(".tab-item").length === 0;
      if (noTabsInGroup) {
        groupContainer.removeChild(groupEl);
      }

      // 更新localStorage数据
      chrome.storage.local.get(["groups"], (res) => {
        let groups = res.groups;
        const group = groups.find((g) => g.id === groupId);
        // 如果domain group内没有任何tab，则删除对应group
        if (noTabsInGroup) {
          groups = groups.filter((g) => g.id !== groupId);
        } else {
          group.tabs = group.tabs.filter(
            (tab) => tab.id != tabEl.dataset.tabId,
          );
        }

        chrome.storage.local.set({ groups });
      });
    }
  });
  // 开始拖拽
  tabEl.addEventListener("dragstart", (e) => {
    e.dataTransfer.setData("tabId", id);
    e.dataTransfer.effectAllowed = "move";
    tabEl.classList.add("dragging");

    // 保存当前拖拽元素
    currentDraggingTabEl = tabEl;
  });
  // 拖拽结束
  tabEl.addEventListener("dragend", () => {
    tabEl.classList.remove("dragging");
    console.log("dragend");
    // 清除当前拖拽记录
    currentDraggingTabEl = null;
  });
  // 拖拽排序
  tabEl.addEventListener("dragover", (e) => {
    e.preventDefault();

    // 插入逻辑判断,将其写到属性上
    const draggingRect = tabEl.getBoundingClientRect();
    const offset = e.clientY - draggingRect.top;
    tabEl.dataset.dropPosition =
      offset < draggingRect.height / 2 ? "above" : "below";
  });

  return tabEl;
}

function saveCurrentUIStateToStorage() {
  const groups = [];

  document.querySelectorAll(".group").forEach((groupEl) => {
    const groupId = groupEl.dataset.groupId;
    const title = groupEl.dataset.group;
    const tabs = [];

    groupEl.querySelectorAll(".tab-item").forEach((tabEl) => {
      tabs.push({
        id: parseInt(tabEl.dataset.tabId),
        title: tabEl.textContent,
        url: tabEl.dataset.tabUrl,
      });
    });

    groups.push({ id: groupId, title, tabs });
  });

  chrome.storage.local.set({ groups });
}

// 更新group name
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

// delete group
function deleteGroupFromStorage(groupId) {
  chrome.storage.local.get(["groups"], (res) => {
    const groups = res.groups || [];
    const newGroups = groups.filter((g) => g.id !== groupId);
    chrome.storage.local.set({ groups: newGroups });
  });
}

// 更新搜索
async function updateGroupTabsBySearch(keyword) {
  const { groups } = await chrome.storage.local.get(["groups"]);
  let filtered_groups = [];
  if (!keyword) {
    filtered_groups = groups;
  } else {
    groups.forEach((group) => {
      const filtered_tabs = group.tabs.filter(
        (tab) => tab.title.includes(keyword) || tab.url.includes(keyword),
      );

      if (filtered_tabs.length > 0) {
        filtered_groups.push({ ...group, tabs: filtered_tabs });
      }
    });
  }

  groupContainer.innerHTML = "";
  renderElements(filtered_groups);
}

// createGroupBtn.addEventListener("click", () => {
//   groupInput.style.display = "block";
//   groupInput.focus();
// });

groupInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    const name = groupInput.value.trim();
    groupInput.value = "";
    groupInput.style.display = "none";

    if (name === "") return;
    createGroupName({ name });
    saveCurrentUIStateToStorage();
  }
});

// Collapse current tab
addCurrentBtn.addEventListener("click", () => {
  chrome.tabs.query({ currentWindow: true }, (allTabs) => {
    const activeTab = allTabs.find((tab) => tab.active);
    const { url, index, id } = activeTab;

    // 空白tab不需要存储
    if (url.indexOf("chrome://newtab") !== -1) {
      return false;
    }

    // 将当前tab加入domain分组
    const _url = new URL(url);
    const domain = _url.hostname;
    const groups = document.querySelectorAll(`.group[data-group="${domain}"]`);

    const group =
      groups[0] ?? createGroupName({ name: domain, isAbleToOperate: false });
    const tabEl = createTabElement(activeTab);
    group.appendChild(tabEl);
    // 保存分组变化
    saveCurrentUIStateToStorage();

    // 激活新的currentTab并关闭当前currentTab
    let adjacentTab = null;
    if (index > 0) {
      adjacentTab = allTabs[index - 1];
    } else if (allTabs.length > 1) {
      adjacentTab = allTabs[index + 1];
    }

    if (adjacentTab) {
      chrome.tabs.update(adjacentTab.id, { active: true }, () => {
        // 激活后再关闭当前active tab
        chrome.tabs.remove(id);
      });
    } else {
      // 当前窗口仅有current tab且是有效tab，收起当前tab并创新一个新的窗口
      // 这里先创建再收起，否则仅有一个窗口关闭后，创建新tab时，如果还有其它window，当前window会puch关闭，新tab在其它window创建
      chrome.tabs.create({ url: "chrome://newtab" }, () => {
        chrome.tabs.remove(id);
      });
    }
  });
});

// search
searchInput.addEventListener("keydown", (e) => {
  if (e.code === "Enter") {
    const searchWords = e.target.value.trim();
    if (currentSearchWords !== searchWords) {
      // record current search words
      currentSearchWords = searchWords;
      updateGroupTabsBySearch(searchWords);
    }
  }
});

window.addEventListener("DOMContentLoaded", () => {
  chrome.storage.local.get(["groups"], (result) => {
    let groups = result.groups || [];
    renderElements(groups);
  });
});
