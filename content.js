const createGroupBtn = document.getElementById("createGroupBtn");
const groupInput = document.getElementById("groupInput");
const groupContainer = document.getElementById("groupContainer");

// 记录当前拖拽元素
let currentDraggingTabEl = null;

// 初始化所有可拖拽 tab（从当前窗口中获取）
chrome.tabs.query({ currentWindow: true }, (tabs) => {
  tabs.forEach((tab) => {
    const tabEl = createTabElement(tab);
    groupContainer.appendChild(tabEl);
  });
});

// TODO
function createGroupName(name) {
  const group = document.createElement("div");
  group.className = "group";
  group.dataset.group = name;

  const title = document.createElement("h3");
  title.textContent = name;
  group.appendChild(title);

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
        console.log("remove child");
        draggingEl.parentElement.removeChild(draggingEl);
      }

      // 关闭对应chrome tab
      if (active) {
      } else {
        chrome.tabs.remove(id);
      }
    });
  });

  groupContainer.appendChild(group);
}

// TODO
function createTabElement(tab) {
  const { url, title, id } = tab;

  const tabEl = document.createElement("div");
  tabEl.className = "tab-item";
  tabEl.textContent = title;
  tabEl.setAttribute("draggable", "true");
  tabEl.dataset.tabId = id;

  // 点击打开
  tabEl.addEventListener("click", () => {
    chrome.tabs.create({ url: url });
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
    createGroupName(name);
  }
});
