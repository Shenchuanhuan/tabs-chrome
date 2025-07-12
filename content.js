const createGroupBtn = document.getElementById("createGroupBtn");
const groupInput = document.getElementById("groupInput");
const groupContainer = document.getElementById("groupContainer");

let currentGroup = null;

createGroupBtn.addEventListener("click", () => {
  groupInput.style.display = "block";
  groupInput.focus();
});

groupInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    const name = groupInput.value.trim();
    groupInput.value = "";
    groupInput.style.display = "none";

    if (name === "") return;

    createGroup(name);
  }
});

function createGroup(name) {
  const group = document.createElement("div");
  group.className = "group";
  group.dataset.group = name;

  const title = document.createElement("h3");
  title.textContent = name;
  group.appendChild(title);

  group.addEventListener("dragover", (e) => {
    e.preventDefault();
  });

  group.addEventListener("drop", (e) => {
    const tabId = e.dataTransfer.getData("tabId");
    if (!tabId) return;

    // 检查是否已存在该 tabItem，如果存在则先移除
    const existing = groupContainer.querySelector(
      `.tab-item[data-tab-id="${tabId}"]`,
    );
    if (existing && existing.parentElement !== group) {
      existing.parentElement.removeChild(existing);
      group.insertBefore(existing, group.children[1]); // 插入在标题之后
      return;
    }

    // 新建 tab item
    chrome.tabs.get(Number(tabId), (tab) => {
      const tabEl = createTabElement(tab);
      group.appendChild(tabEl);
    });
  });

  groupContainer.appendChild(group);
}

function createTabElement(tab) {
  const tabEl = document.createElement("div");
  tabEl.className = "tab-item";
  tabEl.textContent = tab.title;
  tabEl.setAttribute("draggable", "true");
  tabEl.dataset.tabId = tab.id;

  tabEl.addEventListener("click", () => {
    chrome.tabs.create({ url: tab.url });
  });

  tabEl.addEventListener("dragstart", (e) => {
    e.dataTransfer.setData("tabId", tab.id);
  });

  return tabEl;
}

// 初始化所有可拖拽 tab（从当前窗口中获取）
chrome.tabs.query({ currentWindow: true }, (tabs) => {
  tabs.forEach((tab) => {
    const tabEl = createTabElement(tab);
    groupContainer.appendChild(tabEl);
  });
});
