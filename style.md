# Tabs Home — 样式规则文档

## 设计令牌

### 色彩系统

| 角色 | 色值 | 用途 |
|------|------|------|
| 主色 | `#6366f1` (Indigo-500) | 导航激活态、按钮背景、搜索框聚焦边框、悬停边框、拖拽指示线 |
| 主色 hover | `#4f46e5` (Indigo-600) | 按钮悬停 |
| 主色 active | `#4338ca` (Indigo-700) | 按钮按下 |
| 主色浅影 | `rgba(99, 102, 241, 0.1)` | 搜索框聚焦光晕、卡片悬停阴影 |
| 卡片背景 | `#ffffff` | 卡片、顶栏、底栏、导航栏背景 |
| 页面背景 | `#f3f4f6` (Gray-100) | body 背景、搜索框默认背景、导航 hover/active 背景、分隔线 |
| 标题文字 | `#1f2937` (Gray-800) | 卡片标题 |
| 正文文字 | `#4b5563` (Gray-600) | 描述文字 |
| 辅助文字 | `#9ca3af` (Gray-400) | URL、导航图标 |
| 弱化文字 | `#d1d5db` (Gray-300) | 时间戳、按钮默认色、空状态图标 |
| 卡片边框 | `#f0f0f0` | 卡片默认边框 |
| 危险色 hover | `#fee2e2` (Red-100) / `#ef4444` (Red-500) | 删除按钮悬停背景/图标 |
| 收藏色 hover | `#fef3c7` (Amber-100) / `#f59e0b` (Amber-500) | 收藏按钮悬停背景/图标、激活态 |
| 拖拽中背景 | `#f5f3ff` (Indigo-50) | 拖拽时卡片背景 |
| 提示框背景 | `#1f2937` (Gray-800) | tooltip 背景 |
| 提示框文字 | `#ffffff` | tooltip 文字 |
| 悬浮按钮背景 | `#6366f1` / hover `#4f46e5` | 页面右下角悬浮按钮 |

### 字体

| 属性 | 值 |
|------|-----|
| 系统字体栈 | `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif` |
| 标题字号 | `14px` |
| 标题字重 | `600` |
| 描述字号 | `12px` |
| 描述字重 | `500` |
| URL / 时间字号 | `11px` |
| 按钮图标字号 | `16px` |
| tooltip 字号 | `12px` |
| 按钮文字 | `14px` (`text-sm`) / `font-medium` |

### 间距

| 场景 | 值 |
|------|-----|
| 卡片内边距 | `16px` |
| 卡片元素间距 | `12px` |
| 卡片信息块间距 | `3px` |
| 卡片圆角 | `12px` |
| 按钮圆角 | `5px` |
| favicon 圆角 | `3px` |
| 导航按钮圆角 | `8px` |
| 搜索框/按钮圆角 | `6px` (`rounded-md`) |
| 列表项间距 | `8px` (`space-y-2`) |
| 导航栏宽度 | `48px` (`w-12`) |

### 过渡

| 场景 | 值 |
|------|-----|
| 卡片交互 | `all 0.2s cubic-bezier(0.4, 0, 0.2, 1)` |
| 操作按钮 | `all 0.15s` |
| 导航项 | `all 0.2s` |
| 悬浮按钮 | `transform 0.2s, background-color 0.2s` |

---

## 布局架构 (Layout)

```
┌────────────────────────────────────────────┐
│ body (flex row, 100vw × 100vh)            │
│ ┌────────────────────────┬────────────────┐│
│ │ #mainContent (flex: 1) │ nav.side-nav   ││
│ │ ┌────────────────────┐ │ (w-12, shrink) ││
│ │ │ .view-container    │ │                ││
│ │ │  (active/flex)     │ │  [列表]        ││
│ │ │                    │ │  [收藏]        ││
│ │ │  top-bar           │ │  [下载]        ││
│ │ │  #groupContainer   │ │  [设置] ← 底   ││
│ │ │  .action-bar       │ │                ││
│ │ └────────────────────┘ │                ││
│ └────────────────────────┴────────────────┘│
└────────────────────────────────────────────┘
```

- **body**: `display: flex; flex-direction: row; overflow: hidden; width: 100%; height: 100vh`
- **#mainContent**: `flex: 1; min-width: 0` — 占据所有可用空间
- **.side-nav**: 固定 48px 宽，`border-left: 1px solid #f3f4f6` 左侧分割线
- **.view-container**: 默认 `display: none`，激活态 `.active` 时 `display: flex`

---

## 组件样式

### 1. 侧边导航 (.side-nav / .nav-item)

```css
/* 容器 */
.side-nav {
  background: #ffffff;
  border-left: 1px solid #f3f4f6;
  z-index: 30;
}

/* 按钮 */
.nav-item {
  background: transparent;
  border: none;
  cursor: pointer;
  padding: 8px;
  color: #9ca3af;
  border-radius: 8px;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
}
```

| 状态 | 背景 | 图标色 |
|------|------|--------|
| 默认 | transparent | `#9ca3af` |
| hover | `#f3f4f6` | `#6366f1` |
| active | `#f3f4f6` | `#6366f1` + `inset 0 2px 4px rgba(0,0,0,0.05)` |

---

### 2. 标签卡片 (.tab-row)

#### 容器

```css
.tab-row {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 16px;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  background: #ffffff;
  border: 1px solid #f0f0f0;
  border-radius: 12px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
  text-align: left;
}
```

| 状态 | 效果 |
|------|------|
| 默认 | 白色背景 + `#f0f0f0` 边框 + 微阴影 |
| hover | 边框变 `#6366f1` + 阴影加深 + 上移 1px |
| dragging | 透明度 50% + 虚线边框 + 紫色背景 `#f5f3ff` + 无阴影 |

#### 子元素

| 元素 | 样式 |
|------|------|
| **.tab-favicon** | `20×20px`, `flex-shrink: 0`, `border-radius: 3px`, `margin-top: 2px` |
| **.tab-info** | `flex: 1; min-width: 0; flex-direction: column; gap: 3px` |
| **.tab-title** | `14px / 600 / #1f2937 / ellipsis / line-height: 1.4` |
| **.tab-description** | `12px / 500 / #4b5563 / ellipsis / line-height: 1.3` |
| **.tab-meta** | `flex row; gap: 10px; margin-top: 8px` |
| **.tab-url** | `11px / #9ca3af / ellipsis` |
| **.tab-time** | `11px / #d1d5db / nowrap` |

#### 操作按钮 (.tab-actions)

```css
.tab-actions {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}
```

**按钮 (.tab-close / .tab-favorite)**:

| 属性 | 值 |
|------|-----|
| 尺寸 | `24×24px` |
| 字号 | `16px` |
| 圆角 | `5px` |
| 默认 | `color: #d1d5db; opacity: 0; background: transparent` |
| 卡片 hover 时 | `opacity: 1` |

**收藏按钮状态**:

| 状态 | 背景 | 图标色 |
|------|------|--------|
| 默认 | transparent | `#d1d5db` |
| hover | `#fef3c7` | `#f59e0b` |
| active | transparent | `#f59e0b` (opacity: 1 常驻) |

**删除按钮状态**:

| 状态 | 背景 | 图标色 |
|------|------|--------|
| 默认 | transparent | `#d1d5db` |
| hover | `#fee2e2` | `#ef4444` |

---

### 3. 搜索栏 (.search-wrapper)

```css
.search-wrapper input {
  background: #f3f4f6;
  border-color: transparent;
}
.search-wrapper input:focus {
  background: #fff;
  border-color: #6366f1;
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
}
```

- 默认：浅灰背景，无边框
- 聚焦：白色背景 + Indigo 边框 + 外发光 3px

**清除按钮 (.search-clear)**:
- 默认隐藏 (`class="hidden"`)
- hover 时线条变深 `#4b5563`

---

### 4. 顶部栏 (.top-bar)

```css
.top-bar {
  flex-shrink: 0;
  border-bottom-color: #f3f4f6;
}
```
- `position: sticky; top: 0; z-index: 10`（Tailwind 类）
- 背景 `#ffffff` + 底部浅灰分隔线

---

### 5. 底部操作栏 (.action-bar)

```css
.action-bar {
  flex-shrink: 0;
  z-index: 20;
  background: #ffffff;
  border-top-color: #f3f4f6;
}
```
- `position: sticky; bottom: 0`
- 带 `shadow-[0_-4px_12px_rgba(0,0,0,0.05)]` 向上投影

---

### 6. 主按钮 (.btn-collapse)

```css
.btn-collapse {
  color: #fff;
  background: #6366f1;
  border: none;
  cursor: pointer;
  white-space: nowrap;
}
```

| 状态 | 背景 |
|------|------|
| 默认 | `#6366f1` |
| hover | `#4f46e5` |
| active | `#4338ca` |

---

### 7. 空状态 (.empty-state)

```css
.empty-state { display: flex; }
.empty-state.hidden { display: none; }
```
- 居中 flex 布局，显示图标 + 提示文字
- 图标 SVG stroke `#d1d5db`
- 文字 `text-sm / font-medium / text-gray-400`

---

### 8. 拖拽指示器

| 类 | 效果 |
|------|------|
| `.group.drag-over` | 边框变 `#6366f1` + 外发光 |
| `.tab-row.drop-above` | `border-top: 2px solid #6366f1` |
| `.tab-row.drop-below` | `border-bottom: 2px solid #6366f1` |

---

### 9. Tooltip

```css
.tooltip {
  position: fixed;
  bottom: 8px;
  left: 50%;
  transform: translateX(-50%);
  background: #1f2937;
  color: #fff;
  font-size: 12px;
  padding: 4px 10px;
  border-radius: 4px;
  pointer-events: none;
  white-space: nowrap;
  z-index: 100;
}
```

---

## 页面悬浮按钮 (inject.js)

由 `src/inject.js` 在每个网页右下角动态注入：

```css
#tabs-home-floating-button {
  position: fixed;
  bottom: 20px;
  right: 20px;
  width: 48px;
  height: 48px;
  background-color: #6366f1;
  background-image: url("favicon-32x32.png");
  background-repeat: no-repeat;
  background-position: center;
  background-size: 24px;
  border-radius: 50%;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  cursor: pointer;
  z-index: 2147483647;
  transition: transform 0.2s, background-color 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
  user-select: none;
  touch-action: none;
}
```

| 状态 | 效果 |
|------|------|
| 默认 | `scale(1)` / `#6366f1` |
| hover | `scale(1.1)` / `#4f46e5` |
| 拖拽 | 跟随鼠标移动，限定在视口内 |

---

## z-index 层级

| 元素 | z-index |
|------|---------|
| 悬浮按钮 (inject.js) | `2147483647` (最大) |
| 拖拽遮罩 (inject.js) | `2147483646` |
| tooltip | `100` |
| 侧边导航 | `30` |
| 底部操作栏 | `20` |
| 顶部栏 | `10` |
