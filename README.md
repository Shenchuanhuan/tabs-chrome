# Tabs Home

Chrome 浏览器标签页管理扩展，支持一键收起当前页、按域名自动分组、拖拽排序和关键词搜索。

## 功能

- **收起当前页** — 一键关闭当前标签页并按域名保存到侧边栏分组中，点击即可恢复打开
- **自动分组** — 按 URL 域名（hostname）自动将标签页归类，无需手动创建分组
- **拖拽排序** — 标签页项可在不同分组间拖拽移动
- **关键词搜索** — 支持按标题或 URL 关键词过滤已保存的标签页
- **持久化存储** — 所有分组数据保存在 `chrome.storage.local` 中，浏览器重启后数据不丢失
- **手动分组** — 支持创建可重命名、可删除的手动分组
- **快捷键** — `Ctrl+B` 快速打开侧边栏

## 技术栈

- **运行时**: Chrome Extension Manifest V3
- **语言**: Vanilla JavaScript (无框架)
- **样式**: Tailwind CSS v4 + 自定义 CSS
- **API**: Chrome Extensions API (`storage`, `tabs`, `sidePanel`, `commands`, `scripting`, `activeTab`)
- **包管理**: Yarn 1.x

## 项目结构

```
tabs-chrome/
├── assets/icons/          # 扩展图标 (16/32/48/128px)
├── dist/
│   └── style.css          # Tailwind 编译输出（由构建脚本生成）
├── html/
│   └── sidepanel.html     # 侧边栏页面 (扩展 UI 入口)
├── src/
│   ├── background.js      # Service Worker (注册 side panel 和快捷键)
│   └── content.js         # 侧边栏主逻辑 (DOM 渲染、拖拽、搜索、存储)
├── manifest.json          # Chrome 扩展配置 (MV3)
├── package.json           # Node.js 依赖和脚本配置
├── style.css              # Tailwind 源文件 + 自定义样式
└── product.md             # 产品规划文档
```

## 架构

```
┌──────────────────────────────────────────────────────┐
│  inject.js (Content Script)                          │
│  - 在页面右下角注入悬浮按钮                              │
│  - 管理面板 Iframe 的显示/隐藏                          │
└────────────┬─────────────────────────────────────────┘
             │ 点击按钮
             ▼
┌──────────────────────────────────────────────────────┐
│  sidepanel.html + content.js (Iframe)                │
│  - 从 chrome.storage.local 读取分组数据并渲染         │
│  - 收起当前页: 提取域名 → 创建/更新分组 → 关闭标签页  │
│  - 拖拽: HTML5 Drag & Drop API                       │
│  - 搜索: 过滤匹配的分组和标签页                        │
│  - 所有变动即时持久化到 chrome.storage.local          │
└────────────┬─────────────────────────────────────────┘
             │ chrome.storage.local
             ▼
┌──────────────────────────────────────────────────────┐
│  Data Model { "groups": [{ id, title, tabs }] }      │
└──────────────────────────────────────────────────────┘
```

## 数据模型

存储在 `chrome.storage.local` 中，key 为 `"groups"`：

```ts
type Tab = {
  id: number;    // Chrome tab id
  title: string; // 页面标题
  url: string;   // 页面 URL
};

type Group = {
  id: string;         // 分组唯一标识 (域名 或 "group-{timestamp}")
  title: string;      // 分组名称
  tabs: Tab[];        // 分组内包含的标签页
};
```

## 快速开始

### 环境要求

- Node.js 18+
- Yarn 1.x
- Chrome / Edge / 或其他 Chromium 内核浏览器

### 安装依赖

```bash
yarn install
```

### 开发

编译 CSS（监听模式）：

```bash
yarn css
```

在 Chrome 中加载扩展：

1. 打开 `chrome://extensions/`
2. 开启右上角「开发者模式」
3. 点击「加载已解压的扩展程序」
4. 选择项目根目录 `tabs-chrome/`
5. 每次修改 JS/HTML 后，在扩展卡片上点击刷新图标

### 构建

无打包步骤，仅需编译 CSS：

```bash
npx @tailwindcss/cli -i style.css -o dist/style.css
```

### 使用

1. 点击工具栏扩展图标，或按 `Ctrl+B`
2. 点击 **「收起当前页」** 将当前标签页保存到对应域名分组并关闭
3. 点击已保存的标签页可重新打开
4. 拖拽标签页在不同分组间移动
5. 在搜索框输入关键词后按 Enter 进行过滤

## 权限说明

| 权限 | 用途 |
|------|------|
| `storage` | 持久化保存分组数据 |
| `tabs` | 查询、创建、关闭标签页 |
| `sidePanel` | 注册和打开侧边栏 |
| `activeTab` | 获取当前活动标签页信息 |
| `scripting` | 预留权限 |
| `commands` | 注册 Ctrl+B 快捷键 |

## License

MIT
